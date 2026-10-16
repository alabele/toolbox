// Reads one Slack thread with the same user token the inbox uses, so a wait on a Slack reply can come back on its own.
// Read-only. Nothing here posts.
const SERVICE = process.env.ND_SLACK_KEYCHAIN ?? "stillroom-slack";
let token: string | null | undefined; let me: string | undefined; const names = new Map<string, string>();
function slackToken(): string | null { if (token !== undefined) return token; try { const p = Bun.spawnSync(["security", "find-generic-password", "-s", SERVICE, "-a", process.env.USER ?? "", "-w"], { stdout: "pipe", stderr: "pipe" }); token = p.stdout.toString().trim() || null; } catch { token = null; } return token; }
export function slackReadReady() { return !!slackToken(); }
async function api(method: string, params: Record<string, string | number> = {}): Promise<any> {
  const t = slackToken(); if (!t) return { ok: false, error: "no_token" };
  const url = new URL(`https://slack.com/api/${method}`); for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  try { const r = await fetch(url, { headers: { authorization: `Bearer ${t}` } }); return await r.json(); } catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}
/** A permalink names a channel and a message; a reply carries thread_ts for its root. */
export function parsePermalink(link: string): { channel: string; ts: string; root: string } | null {
  const m = String(link || "").match(/slack\.com\/archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})(?:\?[^#]*thread_ts=(\d+\.\d+))?/i); if (!m) return null;
  const ts = `${m[2]}.${m[3]}`; return { channel: m[1]!, ts, root: m[4] || ts };
}
/** A link to a channel with no message: the thread is her own last message there, around the time she started waiting. */
export function parseChannel(link: string): string | null { const m = String(link || "").match(/slack\.com\/archives\/([A-Z0-9]+)\/?(?:[?#].*)?$/i); return m ? m[1]! : null; }
async function myLastMessage(channel: string, around: number): Promise<string | null> {
  if (!me) { const a = await api("auth.test"); if (a.ok) me = a.user_id; } if (!me) return null;
  const r = await api("conversations.history", { channel, oldest: Math.floor(around - 3 * 86400), limit: 100 }); if (!r.ok) return null;
  const mine = (r.messages || []).filter((m: any) => m.user === me && !m.subtype && +m.ts <= around + 6 * 3600).sort((a: any, b: any) => +b.ts - +a.ts);
  return mine[0]?.ts || null;
}
async function who(id: string): Promise<string> { if (names.has(id)) return names.get(id)!; const r = await api("users.info", { user: id }); const n = r.ok ? (r.user?.profile?.display_name || r.user?.real_name || r.user?.name || id) : id; names.set(id, n); return n; }
/** Replies on the thread by other people, newest last. `after` is a unix-seconds floor. */
export async function repliesSince(link: string, after: number): Promise<{ ok: boolean; replies: { user: string; name: string; ts: string; text: string }[]; error?: string }> {
  let p = parsePermalink(link);
  if (!p) { const ch = parseChannel(link); if (!ch) return { ok: false, replies: [], error: "not a Slack link" }; const ts = await myLastMessage(ch, after); if (!ts) return { ok: false, replies: [], error: "no message of hers found in that channel" }; p = { channel: ch, ts, root: ts }; }
  if (!me) { const a = await api("auth.test"); if (a.ok) me = a.user_id; }
  const r = await api("conversations.replies", { channel: p.channel, ts: p.root, limit: 50 }); if (!r.ok) return { ok: false, replies: [], error: r.error };
  const out = []; for (const m of (r.messages || []).slice(1)) { if (!m.ts || +m.ts <= after || m.user === me || m.subtype) continue; out.push({ user: m.user || "", name: m.user ? await who(m.user) : "Someone", ts: m.ts, text: String(m.text || "").replace(/\s+/g, " ").slice(0, 200) }); }
  return { ok: true, replies: out };
}
