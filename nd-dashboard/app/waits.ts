// Things she is waiting on that are not pull requests: a Slack reply, a ticket moving, a person. Only what she adds.
// A ticket wait checks Jira and comes back when the status changes. The rest come back when she says so.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fetchTickets, jiraReady } from "./jira";

const FILE = join(homedir(), ".config", "stillroom", "waits.json");
const KEY = /\b(VDC|D|STORY|PROJ|OPS|DOCS)-(\d{1,6})\b/i;
export interface Wait { id: string; kind: "ticket" | "slack" | "pr" | "note"; text: string; link?: string; ticket?: string; until?: string; prKey?: string; status?: string; since: number; back?: string; backAt?: number; sessionId?: string }

export class Waits {
  private rows: Wait[] = [];
  constructor(private onChange: () => void) { try { this.rows = JSON.parse(readFileSync(FILE, "utf8")); } catch {} }
  list() { return this.rows; }
  /** until: a ticket status to wait for ("Done"); prKey: "owner/repo#123" to wait for its merge. */
  async add(text: string, link?: string, sessionId?: string, until?: string, prKey?: string): Promise<Wait> {
    const url = (link || "").trim() || (text.match(/https?:\/\/\S+/) || [""])[0];
    const pm = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/); if (!prKey && pm) prKey = `${pm[1]}#${pm[2]}`;
    const k = text.match(KEY); const ticket = k ? `${k[1].toUpperCase()}-${k[2]}` : undefined;
    const kind: Wait["kind"] = prKey ? "pr" : ticket ? "ticket" : /slack\.com/.test(url) ? "slack" : "note";
    const w: Wait = { id: Math.random().toString(36).slice(2, 10), kind, text: text.trim(), link: url || undefined, ticket: kind === "ticket" ? ticket : undefined, until: until?.trim() || undefined, prKey, since: Date.now(), sessionId };
    if (w.ticket && jiraReady()) { const r = await fetchTickets([w.ticket]); w.status = r.tickets[0]?.status; if (w.until && w.status && w.status.toLowerCase() === w.until.toLowerCase()) { w.back = `${w.ticket} is already ${w.status}`; w.backAt = Date.now(); } }
    this.rows.push(w); this.save(); this.onChange(); return w;
  }
  remove(id: string) { this.rows = this.rows.filter(w => w.id !== id); this.save(); this.onChange(); }
  /** She says it came back (or the app noticed). It moves to Needs you until she removes it. */
  back(id: string, why: string) { const w = this.rows.find(w => w.id === id); if (!w) return; w.back = why; w.backAt = Date.now(); this.save(); this.onChange(); }
  /** Ticket waits: a status change brings them back. Called with the poll. */
  async check() {
    const open = this.rows.filter(w => w.kind === "ticket" && w.ticket && !w.back); if (!open.length || !jiraReady()) return;
    const r = await fetchTickets(open.map(w => w.ticket!)); if (r.error) return; let changed = false;
    for (const w of open) { const t = r.tickets.find(t => t.key === w.ticket); if (!t) continue;
      const hit = w.until ? t.status.toLowerCase() === w.until.toLowerCase() : (w.status && t.status !== w.status);
      if (hit) { w.back = `${w.ticket} is ${t.status}`; w.backAt = Date.now(); changed = true; } if (t.status !== w.status) { w.status = t.status; changed = true; } }
    if (changed) { this.save(); this.onChange(); }
  }
  /** A PR left the list: the waits on it come back. */
  prGone(prKey: string, how: string) { let n = 0; for (const w of this.rows) if (w.prKey === prKey && !w.back) { w.back = `${prKey.split("/").pop()} ${how}`; w.backAt = Date.now(); n++; } if (n) { this.save(); this.onChange(); } }
  private save() { try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE + ".tmp", JSON.stringify(this.rows, null, 1)); renameSync(FILE + ".tmp", FILE); } catch {} }
}
