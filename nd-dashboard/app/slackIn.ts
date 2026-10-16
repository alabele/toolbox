// Slack, the other way round: what is addressed to her, as rows in the same list as sessions and pull requests.
// Her own user token (an app she installed herself) out of the keychain, so no Claude sits in the data path —
// the connector in slack.ts spawns a session per call, which is fine to post one message and absurd to poll with.
// `search.messages` for every mention, one call; `conversations.history` for DMs and the channels she reads in full.
// State lives in ~/.config/stillroom/slack-in.json, the tiers in slack-tiers.json.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const FILE = process.env.ND_SLACK_IN ?? join(homedir(), ".config", "stillroom", "slack-in.json");
const TIERS_FILE = join(homedir(), ".config", "stillroom", "slack-tiers.json");
const SERVICE = process.env.ND_SLACK_KEYCHAIN ?? "stillroom-slack";
const POLL_MS = 2 * 60_000, DIRECTS_MS = 15 * 60_000, SWEEP = 25, FIRST_RUN_HOURS = 24;

export type SlackKind = "dm" | "group-dm" | "mention" | "channel";
export const SLACK_WORDS: Record<SlackKind, string> = { dm: "Direct message", "group-dm": "Group DM", mention: "You were tagged", channel: "In a channel you read" };
// A mention or a DM is hers to answer; a Tier 1 channel message is hers to read.
export const NEEDS_YOU: SlackKind[] = ["dm", "group-dm", "mention"];

export interface SlackItem {
  id: string; kind: SlackKind; channel: string; channelName: string; user: string; userName: string;
  text: string; ts: string; at: number; permalink: string; threadTs?: string;
  firstSeen: number; seenAt?: number; needsYou: boolean;
}
interface Store { items: Record<string, SlackItem>; cursors: Record<string, string>; dmWith?: Record<string, string>; directsAt: number; searchAt: number; mentionFrom?: number; me?: string; team?: string; users?: Record<string, string>; channels?: Record<string, string>; error?: string }

/** The token she pasted into the keychain. Read once; a reinstall needs a restart, which is the honest cost of not caching it in a file. */
let token: string | null | undefined;
function slackToken(): string | null {
  if (token !== undefined) return token;
  try { const p = Bun.spawnSync(["security", "find-generic-password", "-s", SERVICE, "-a", process.env.USER ?? "", "-w"], { stdout: "pipe", stderr: "pipe" }); token = p.stdout.toString().trim() || null; }
  catch { token = null; }
  return token;
}
export function slackInReady() { return !!slackToken(); }

async function api(method: string, params: Record<string, string | number> = {}): Promise<any> {
  const t = slackToken(); if (!t) return { ok: false, error: "no_token" };
  const url = new URL(`https://slack.com/api/${method}`); for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  try {
    const r = await fetch(url, { headers: { authorization: `Bearer ${t}` } });
    if (r.status === 429) return { ok: false, error: "ratelimited", retry: +(r.headers.get("retry-after") || 30) };
    return await r.json();
  } catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export class SlackIn {
  private s: Store = { items: {}, cursors: {}, directsAt: 0, searchAt: 0 };
  private ims: string[] = []; private mpims: string[] = []; // one-to-one DMs always swept; group DMs by what we last saw in them
  private busy = false; private timer: any;
  constructor(private onChange: () => void) { try { this.s = JSON.parse(readFileSync(FILE, "utf8")); } catch {} }

  /** Unseen first, newest last, so the oldest thing she has not looked at sits on top. Ids become names on the way out. */
  list(): SlackItem[] {
    return Object.values(this.s.items).filter(i => !i.seenAt)
      .sort((a, b) => (b.needsYou ? 1 : 0) - (a.needsYou ? 1 : 0) || a.at - b.at)
      .map(i => ({ ...i, text: this.pretty(i.text), userName: i.userName || this.s.users?.[i.user] || "", channelName: this.place(i) }));
  }
  /** Where an item is, in words: a DM is the person, everything else is its channel. An id is never a place. */
  private place(i: SlackItem) {
    if (i.kind === "dm") return this.s.users?.[this.s.dmWith?.[i.channel] || i.user] || i.userName || "";
    const n = i.channelName || this.s.channels?.[i.channel] || "";
    return /^[UWCD][A-Z0-9]{6,}$/.test(n) ? (this.s.users?.[n] || this.s.channels?.[n] || "") : n;
  }
  /** Slack's wire format is unreadable: user ids, channel ids and piped links become the words they stand for. */
  private pretty(t: string) {
    return (t || "")
      .replace(/<@([UW][A-Z0-9]+)(\|[^>]*)?>/g, (_, id) => "@" + (this.s.users?.[id] || id))
      .replace(/<#([C][A-Z0-9]+)(\|([^>]*))?>/g, (_, id, __, name) => "#" + (name || this.s.channels?.[id] || id))
      .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2").replace(/<(https?:[^>]+)>/g, "$1")
      .replace(/<!(here|channel|everyone)>/g, "@$1").trim();
  }
  status() { return { connected: slackInReady(), error: this.s.error, at: this.s.searchAt, unseen: this.list().length }; }
  /** She dealt with it. Slack's own read state is not reachable with a user token, so this is the app's own mark. */
  markSeen(id: string) { const i = this.s.items[id]; if (!i) return false; i.seenAt = Date.now(); this.save(); this.onChange(); return true; }
  markAllSeen() { const n = Date.now(); for (const i of Object.values(this.s.items)) if (!i.seenAt) i.seenAt = n; this.save(); this.onChange(); }

  start() { if (!slackInReady()) return; this.tick(); this.timer = setInterval(() => this.tick(), POLL_MS); }
  stop() { clearInterval(this.timer); }

  private tiers(): Record<string, string[]> {
    try { return JSON.parse(readFileSync(TIERS_FILE, "utf8")); } catch { return {}; }
  }
  /** The channels she is the SME in, which for now are the ones she reads in full. The triage needs their names. */
  smeChannels(): Record<string, true> { return Object.fromEntries((this.tiers()["1"] || []).map(n => [n.replace(/^#/, ""), true as const])); }
  /** The channels she reads every message of. Names in the file, ids here. */
  private tier1Ids(): string[] {
    const want = new Set((this.tiers()["1"] || []).map(n => n.replace(/^#/, "")));
    return Object.entries(this.s.channels || {}).filter(([, name]) => want.has(name)).map(([id]) => id);
  }

  private async tick() {
    if (this.busy) return; this.busy = true;
    try {
      if (!this.s.me) { const a = await api("auth.test"); if (!a.ok) { this.s.error = a.error; return; } this.s.me = a.user_id; this.s.team = new URL(a.url).hostname.split(".")[0]; }
      this.s.error = undefined;
      this.s.mentionFrom ??= Date.now() - FIRST_RUN_HOURS * 3600_000; // a first run is a catch-up, not an archive
      if (Date.now() - this.s.directsAt > DIRECTS_MS) await this.refreshDirects();
      await this.mentions();
      for (const id of [...this.sweep(), ...this.tier1Ids()]) await this.history(id);
      this.s.searchAt = Date.now(); this.save(); this.onChange();
    } catch (e: any) { this.s.error = e?.message ?? String(e); }
    finally { this.busy = false; }
  }

  /** Every DM and group DM, plus the name of every channel she is in. Both change rarely. */
  private async refreshDirects() {
    const names: Record<string, string> = {}; const dm: Record<string, string> = {}; const ims: string[] = [], mpims: string[] = [];
    for (const types of ["im,mpim", "public_channel,private_channel"]) {
      let cursor = "";
      for (let page = 0; page < 10; page++) {
        const r = await api("conversations.list", { types, limit: 200, exclude_archived: "true", ...(cursor ? { cursor } : {}) });
        if (!r.ok) { this.s.error = r.error; break; }
        for (const c of r.channels || []) { if (c.is_im) { if (!c.is_user_deleted) { ims.push(c.id); if (c.user) dm[c.id] = c.user; } } else if (c.is_mpim) mpims.push(c.id); else names[c.id] = c.name; }
        cursor = r.response_metadata?.next_cursor || ""; if (!cursor) break;
      }
    }
    if (ims.length || mpims.length) { this.ims = ims; this.mpims = mpims; }
    if (Object.keys(names).length) this.s.channels = names;
    if (Object.keys(dm).length) this.s.dmWith = { ...(this.s.dmWith || {}), ...dm };
    this.s.directsAt = Date.now();
  }
  /** One-to-one DMs first, then the group DMs we last saw something in. Bounded, so a tick stays well inside the rate limit. */
  private sweep(): string[] {
    const by = (id: string) => parseFloat(this.s.cursors[id] || "0");
    return [...this.ims, ...this.mpims.sort((a, b) => by(b) - by(a))].slice(0, SWEEP);
  }

  /** One call covers every mention of her, anywhere she can see — channels, DMs and group DMs alike. */
  private async mentions() {
    const r = await api("search.messages", { query: `<@${this.s.me}>`, count: 40, sort: "timestamp", sort_dir: "desc" });
    if (!r.ok) { this.s.error = r.error === "ratelimited" ? "Slack rate limit; it will retry" : r.error; return; }
    let newest = this.s.mentionFrom || 0;
    for (const m of r.messages?.matches || []) {
      if (m.user === this.s.me) continue; // her own messages quoting someone else
      const at = Math.round(parseFloat(m.ts) * 1000); newest = Math.max(newest, at);
      if (at <= (this.s.mentionFrom || 0)) continue; // older than the window: already hers, or before the app existed
      const ch = m.channel || {};
      this.add({ kind: ch.is_im ? "dm" : ch.is_mpim ? "group-dm" : "mention", channel: ch.id, channelName: ch.name || "", user: m.user || "", userName: m.username || "", text: m.text || "", ts: m.ts, threadTs: m.thread_ts, permalink: m.permalink });
    }
    this.s.mentionFrom = newest;
  }

  /** New messages in one conversation since we last looked. First sight of it only goes back a day. */
  private async history(id: string) {
    const oldest = this.s.cursors[id] || String((Date.now() - FIRST_RUN_HOURS * 3600_000) / 1000);
    const r = await api("conversations.history", { channel: id, oldest, limit: 30, inclusive: "false" });
    if (!r.ok) { if (r.error !== "ratelimited") this.s.error = r.error; return; }
    const msgs = (r.messages || []).filter((m: any) => m.ts && m.user !== this.s.me && m.subtype !== "channel_join" && m.subtype !== "channel_leave");
    for (const m of msgs) {
      const name = this.s.channels?.[id];
      this.add({ kind: name ? "channel" : id.startsWith("D") ? "dm" : "group-dm", channel: id, channelName: name || "", user: m.user || "", userName: m.username || "", text: m.text || "", ts: m.ts, threadTs: m.thread_ts, permalink: this.link(id, m.ts) });
    }
    const newest = (r.messages || []).map((m: any) => m.ts).sort().pop();
    if (newest) this.s.cursors[id] = newest;
  }

  private add(p: Omit<SlackItem, "id" | "at" | "firstSeen" | "needsYou">) {
    const id = `${p.channel}:${p.ts}`;
    if (this.s.items[id] || !this.pretty(p.text)) return; // already here, or nothing to read: a huddle start, a join, a bare file drop
    const at = Math.round(parseFloat(p.ts) * 1000);
    this.s.items[id] = { ...p, id, at, firstSeen: Date.now(), needsYou: NEEDS_YOU.includes(p.kind), permalink: p.permalink || this.link(p.channel, p.ts), userName: p.userName || this.s.users?.[p.user] || "" };
  }
  /** Slack's own permalink shape, so we do not spend a call on chat.getPermalink. */
  private link(channel: string, ts: string) { return `https://${this.s.team || "app"}.slack.com/archives/${channel}/p${ts.replace(".", "")}`; }

  /** Names for the ids that came back bare. Cheap, cached, and only when something is missing one. */
  async names() {
    if (!Object.values(this.s.items).some(i => !i.userName && i.user)) return;
    const r = await api("users.list", { limit: 500 }); if (!r.ok) return;
    const map: Record<string, string> = { ...(this.s.users || {}) };
    for (const u of r.members || []) map[u.id] = u.profile?.display_name || u.real_name || u.name;
    this.s.users = map;
    for (const i of Object.values(this.s.items)) if (!i.userName) i.userName = map[i.user] || "";
    this.save(); this.onChange();
  }

  /** Items she has dealt with stop being worth keeping after a week. */
  prune() {
    const cut = Date.now() - 7 * 86400_000; let n = 0;
    for (const [k, i] of Object.entries(this.s.items)) if (i.seenAt && i.seenAt < cut) { delete this.s.items[k]; n++; }
    if (n) this.save();
  }
  private save() { try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE + ".tmp", JSON.stringify(this.s, null, 1)); renameSync(FILE + ".tmp", FILE); } catch {} }
}
