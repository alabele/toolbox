// Triage: what each Slack item wants from her. Three dispositions, sorted by acuity and not by how it arrived.
// Emergency is promoted by facts only — a person she named, a word she named, a channel she named — and the
// model may veto a match but never make one. Needs-you is the judgement call, and that is the model's job:
// she is the SME in a dozen channels, so a question there is hers whether or not anyone tagged her.
// One Haiku call per item through `ask`, cached on disk, one at a time. State in ~/.config/stillroom/slack-triage.json.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { ask } from "./titles";
import type { SlackItem } from "./slackIn";

const FILE = process.env.ND_SLACK_TRIAGE ?? join(homedir(), ".config", "stillroom", "slack-triage.json");
const RULES_FILE = join(homedir(), ".config", "stillroom", "slack-urgent.json");
const RETRY_AFTER = 10 * 60_000, BATCH = 20;

export type Disposition = "emergency" | "needs-you" | "nothing";
export const DISPOSITION_WORDS: Record<Disposition, string> = { emergency: "Now", "needs-you": "Wants an answer", nothing: "Nothing to do" };

export interface Verdict { disp: Disposition; why: string; at: number; vetoed?: boolean }
interface Rules { people: string[]; words: string[]; channels: string[] }
const DEFAULT_RULES: Rules = {
  people: [], // display names whose DMs may jump the queue; she fills this in, and empty is the right default
  words: ["outage", "is down", "p0", "sev1", "emergency", "prod is down"],
  channels: ["video-client-alerts"],
};

/** Her own list of what counts as an emergency. Facts, so she can read and change them without a model in the way. */
export function urgentRules(): Rules {
  try { return { ...DEFAULT_RULES, ...JSON.parse(readFileSync(RULES_FILE, "utf8")) }; } catch { return DEFAULT_RULES; }
}

/** Does this item match one of her emergency facts? Returns the matching fact, or null. */
export function urgentMatch(i: SlackItem, r = urgentRules()): string | null {
  const t = (i.text || "").toLowerCase();
  const w = r.words.find(w => t.includes(w.toLowerCase()));
  if (w) return `says "${w}"`;
  if (r.channels.some(c => c.replace(/^#/, "") === i.channelName)) return `in #${i.channelName}`;
  if (i.kind === "dm" && r.people.some(p => p.toLowerCase() === (i.userName || "").toLowerCase())) return `${i.userName} said so directly`;
  return null;
}

const PROMPT = (i: SlackItem, sme: string[], urgent: string | null) => `Lauren is a senior engineer who owns the video client SDK, the docs site, and several customer accounts. Decide what this Slack message wants from her.

needs-you — someone is waiting on her. A question in her area counts even with no tag: a bug, a request for help, a review ask, a customer question. Anything where no answer leaves the asker stuck.
nothing — no answer is owed. Thanks, FYIs, announcements, bot notices, chat, or a question aimed at someone else.

Judge by what the sender needs, not by whether they used her name.${urgent ? `\nA fact rule flagged this urgent (it ${urgent}). Answer emergency only if someone is blocked right now; otherwise ignore the flag.` : ""}

Her channels: ${sme.slice(0, 12).join(", ")}

where: ${i.kind === "dm" ? `DM from ${i.userName}` : i.kind === "group-dm" ? `group DM from ${i.userName}` : `#${i.channelName}, from ${i.userName}`}
text: ${(i.text || "").slice(0, 700)}

Reply with one line only: the disposition, a colon, at most eight words. No markdown.`;

export class Triage {
  private rows: Record<string, Verdict> = {};
  private jobs = new Map<string, SlackItem>();
  private busy = false;
  constructor(private onChange: () => void = () => {}, private sme: string[] = []) {
    try { this.rows = JSON.parse(readFileSync(FILE, "utf8")); } catch {}
  }
  /** The verdict on this item, and a fresh one on the way when there is none yet. */
  get(i: SlackItem): Verdict | undefined {
    const v = this.rows[i.id];
    if (!v && !this.jobs.has(i.id)) { this.jobs.set(i.id, i); this.drain(); }
    if (v && !v.disp && Date.now() - v.at > RETRY_AFTER) { this.jobs.set(i.id, i); this.drain(); }
    return v;
  }
  /** Verdicts for a whole list, queueing whatever is missing. */
  decorate(items: SlackItem[]): (SlackItem & { verdict?: Verdict })[] {
    return items.map(i => ({ ...i, verdict: this.get(i) }));
  }
  private async drain() {
    if (this.busy) return; this.busy = true;
    try {
      while (this.jobs.size) {
        const batch = [...this.jobs.values()].slice(0, BATCH);
        for (const j of batch) this.jobs.delete(j.id);
        const vs = await decideBatch(batch, this.sme);
        for (const [id, v] of vs) this.rows[id] = v;
        this.save(); this.onChange();
      }
    } finally { this.busy = false; }
  }
  /** Items she dealt with stop being worth a verdict. Called with the register's own prune. */
  prune(liveIds: Set<string>) {
    let n = 0; for (const id of Object.keys(this.rows)) if (!liveIds.has(id)) { delete this.rows[id]; n++; }
    if (n) this.save();
  }
  private save() { try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE + ".tmp", JSON.stringify(this.rows, null, 1)); renameSync(FILE + ".tmp", FILE); } catch {} }
}

/** One item, one Haiku call. A bot never needs her, so it never reaches the model. */
export async function decide(i: SlackItem, sme: string[]): Promise<Verdict> {
  const urgent = urgentMatch(i);
  if (/^(Slackbot|Automation for Jira|.*\bbot\b.*)$/i.test(i.userName || "")) return { disp: "nothing", why: "a bot posted it", at: Date.now() };
  // One call, then one retry: `ask` spawns a process per call, so a slow start reads as an empty answer.
  let out = (await ask(PROMPT(i, sme, urgent), 90_000)).trim();
  if (!out) out = (await ask(PROMPT(i, sme, urgent), 90_000)).trim();
  const m = read(out);
  if (!m) return { disp: "needs-you", why: out ? "could not read the verdict, so it stays" : "no answer came back, so it stays", at: Date.now() };
  const disp = m[0];
  return { disp, why: m[1].slice(0, 80), at: Date.now(), vetoed: !!urgent && disp !== "emergency" };
}

/** The model answers in one line, but markdown and preambles creep in, so read the last line that names a disposition. */
function read(out: string): [Disposition, string] | null {
  for (const raw of out.split("\n").reverse()) {
    const line = raw.replace(/[*_`#>]/g, "").trim();
    const m = line.match(/\b(emergency|needs[- ]you|nothing)\b\s*[:\-–]?\s*(.*)$/i);
    if (m?.[1]) return [m[1].toLowerCase().replace(" ", "-") as Disposition, (m[2] ?? "").trim()];
  }
  return null;
}

const LINE = (i: SlackItem, n: number) => `${n}. ${i.kind === "dm" ? `DM from ${i.userName}` : i.kind === "group-dm" ? `group DM from ${i.userName}` : `#${i.channelName}, from ${i.userName}`}\n   ${(i.text || "").replace(/\n+/g, " ").slice(0, 400)}`;

/** Every new item in one call. `ask` spawns a process per call, and that cost runs from two seconds to nine
 *  minutes, so the batch is what keeps a slow start from stalling the whole register one message at a time. */
export async function decideBatch(items: SlackItem[], sme: string[]): Promise<[string, Verdict][]> {
  const out: [string, Verdict][] = [];
  const bots = items.filter(i => isBot(i));
  for (const b of bots) out.push([b.id, { disp: "nothing", why: "a bot posted it", at: Date.now() }]);
  const live = items.filter(i => !isBot(i));
  if (!live.length) return out;

  const urgent = new Map(live.map(i => [i.id, urgentMatch(i)]));
  const flagged = live.map((i, n) => urgent.get(i.id) ? `${n + 1} (flagged urgent: it ${urgent.get(i.id)})` : "").filter(Boolean);
  const prompt = `Lauren is a senior engineer who owns the video client SDK, the docs site, and several customer accounts. For each message below, decide what it wants from her.

needs-you — someone is waiting on her. A question in her area counts even with no tag: a bug, a request for help, a review ask, a customer question. Anything where no answer leaves the asker stuck.
nothing — no answer is owed. Thanks, FYIs, announcements, chat, or a question aimed at someone else.
emergency — someone is blocked right now and only she can unblock them. Rare. ${flagged.length ? `A fact rule flagged ${flagged.join("; ")}. Use emergency only if that message really does block someone; otherwise ignore the flag.` : "Nothing is flagged, so emergency is almost certainly wrong."}

Judge by what the sender needs, not by whether they used her name.

Her channels: ${sme.slice(0, 14).join(", ")}

${live.map((i, n) => LINE(i, n + 1)).join("\n\n")}

Reply with exactly ${live.length} lines, one per message, in order: the number, a full stop, the disposition, a colon, then at most eight words. No markdown, no other text.`;

  let text = (await ask(prompt, 180_000)).trim();
  if (!text) text = (await ask(prompt, 180_000)).trim();
  const byIndex = new Map<number, [Disposition, string]>();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/[*_`#>]/g, "").trim();
    const m = line.match(/^(\d{1,2})\s*[.):]\s*(emergency|needs[- ]you|nothing)\b\s*[:\-–]?\s*(.*)$/i);
    if (m?.[1] && m[2]) byIndex.set(+m[1], [m[2].toLowerCase().replace(" ", "-") as Disposition, (m[3] ?? "").trim()]);
  }
  live.forEach((i, n) => {
    const hit = byIndex.get(n + 1);
    const u = urgent.get(i.id);
    out.push([i.id, hit
      ? { disp: hit[0], why: hit[1].slice(0, 80), at: Date.now(), vetoed: !!u && hit[0] !== "emergency" }
      : { disp: "needs-you", why: "no verdict came back, so it stays in the list", at: Date.now() }]);
  });
  return out;
}
function isBot(i: SlackItem) { return /^(Slackbot|Automation for Jira|.*\bbot\b.*)$/i.test(i.userName || ""); }
