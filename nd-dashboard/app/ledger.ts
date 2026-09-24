// The ledger: what got done, gathered from replies that open with Done or Partly done.
// One entry per such reply: the day, the session, the bullets above the line. Appended to disk, never edited by hand.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { ask } from "./titles";

const FILE = process.env.ND_LEDGER ?? join(homedir(), ".config", "stillroom", "ledger.json");
export interface Summary { key: string; headline: string; points: string[]; at: number }
export interface Entry { id: string; at: number; sessionId: string; cwd: string; title: string; status: "done" | "partly"; lines: string[]; next?: string }

/** Reads the shape off a reply: status word, the bullets (or the one line) above ---, and the Next line. Null when it is not an outcome. */
export function parseOutcome(text: string): { status: "done" | "partly"; lines: string[]; next?: string } | null {
  const m = text.match(/^\s*(Done|Partly done)\b[.,:!]?\s*(.*)$/im); if (!m || text.search(/\S/) !== m.index) return null;
  const head = text.split(/\n\s*(?:-{3,}|\*{3,})\s*\n/)[0];
  const lines: string[] = []; let next: string | undefined;
  for (const raw of head.split("\n")) { const l = raw.trim(); if (!l) continue;
    if (/^(Done|Partly done)\b/i.test(l)) { const rest = l.replace(/^(Done|Partly done)\b[.,:!]?\s*/i, "").replace(/^[—–-]+\s*/, "").trim(); if (rest) lines.push(rest); continue; }
    if (/^\**next( action| step)?\**\s*[:.]?/i.test(l)) { next = l.replace(/^\**next( action| step)?\**\s*[:.]?\s*/i, "").replace(/\*+$/, ""); continue; }
    if (/^question\b/i.test(l) || /^\d+\.\s/.test(l)) continue;
    lines.push(l.replace(/^[-*•]\s+/, "").replace(/^[—–]\s*/, "")); }
  return { status: m[1].toLowerCase().startsWith("partly") ? "partly" : "done", lines: lines.slice(0, 6), next };
}

const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export class Ledger {
  private rows: Entry[] = [];
  private summaries: Record<string, Summary> = {}; // "sessionId|day" -> the day's work in that session, rolled up
  private pending = new Set<string>(); private busy = false;
  constructor(private onChange: () => void) { try { const j = JSON.parse(readFileSync(FILE, "utf8")); if (Array.isArray(j)) this.rows = j; else { this.rows = j.rows ?? []; this.summaries = j.summaries ?? {}; } } catch {} this.queueStale(); }
  list(): { entries: Entry[]; summaries: Record<string, Summary> } { return { entries: this.rows, summaries: this.summaries }; }

  /** Every session-day whose entries changed since its summary gets a new one. One call at a time. */
  private queueStale() { for (const g of this.groups()) { const s = this.summaries[g.key]; if (!s || s.key !== g.sig) this.pending.add(g.key); } this.drain(); }
  private groups() { const m = new Map<string, Entry[]>(); for (const r of this.rows) { const k = `${r.sessionId}|${dayKey(r.at)}`; (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
    return [...m].map(([key, rs]) => ({ key, rows: rs, sig: rs.map(r => r.id).join(",") })); }
  private async drain() {
    if (this.busy) return; this.busy = true;
    try { while (this.pending.size) { const key = this.pending.values().next().value as string; this.pending.delete(key);
      const g = this.groups().find(x => x.key === key); if (!g) continue;
      const s = await summarize(g.rows); if (!s) continue;
      this.summaries[key] = { key: g.sig, headline: s.headline, points: s.points, at: Date.now() }; this.save(); this.onChange(); } }
    finally { this.busy = false; }
  }
  /** Records a reply if it is an outcome. The same reply never lands twice. */
  add(e: { id: string; sessionId: string; cwd: string; title: string; text: string; at?: number }): Entry | null {
    if (this.rows.some(r => r.id === e.id)) return null;
    const p = parseOutcome(e.text); if (!p) return null;
    const row: Entry = { id: e.id, at: e.at ?? Date.now(), sessionId: e.sessionId, cwd: e.cwd, title: e.title, status: p.status, lines: p.lines, next: p.next };
    this.rows.push(row); this.rows = this.rows.slice(-2000); this.save(); this.onChange(); this.queueStale(); return row;
  }
  retitle(sessionId: string, title: string) { let n = 0; for (const r of this.rows) if (r.sessionId === sessionId && r.title !== title) { r.title = title; n++; } if (n) { this.save(); this.onChange(); } }
  private save() { try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE + ".tmp", JSON.stringify({ rows: this.rows, summaries: this.summaries }, null, 1)); renameSync(FILE + ".tmp", FILE); } catch {} }
}

async function summarize(rows: Entry[]): Promise<{ headline: string; points: string[] } | null> {
  const body = rows.map(r => `- ${r.status === "partly" ? "(partly) " : ""}${r.lines.join(" / ")}${r.next ? ` [next: ${r.next}]` : ""}`).join("\n");
  const prompt = `Below are the outcomes reported, in order, during one work session on one day. Roll them up for someone who wants the result, not the play by play.
Return JSON only: {"headline": string, "points": string[]}.
headline: at most 8 words, past tense, what got done overall. Name the PR, ticket, file or repo when there is one. A pull request is named repo #number, like docs-pipeline #319, never PR 2244 or #2244 alone. No "Claude", no "session".
points: 2 to 4, one fact each, no repeats, merged where two lines say the same thing, newest state wins (if something was "pushed" then "edited", say edited). Fragments are fine. Skip anything that is only a note about how to work in future unless it is the whole point.

Session: ${rows[0].title}
Outcomes:
${body}`;
  const out = await ask(prompt); const m = out.match(/\{[\s\S]*\}/); if (!m) return null;
  try { const j = JSON.parse(m[0]); if (!j.headline) return null; return { headline: String(j.headline).slice(0, 90), points: (Array.isArray(j.points) ? j.points : []).map(String).slice(0, 4) }; } catch { return null; }
}
