// The fairy (her word, her ask, 2026-10-16): tidies while she is away, and sets the table when she asks.
// Tidying runs at midnight on weekdays (her call, 2026-10-16), once a night, and every action can be undone from
// the panel behind the wand in the top bar. Setting the table never runs unless she pressed the button or opted in.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { ask } from "./titles";
import { findHandoff, readHandoff } from "./handoff";

const FILE = process.env.ND_FAIRY ?? join(homedir(), ".config", "stillroom", "fairy.json");
const SESSION_DAYS = 4, WAIT_DAYS = 5;
export interface Action { id: string; at: number; kind: "closed-session" | "let-go-wait" | "filed"; text: string; undo: any; undone?: boolean; runAt: number }
export interface TableItem { ref: string; title: string; step: string; why: string; done?: boolean }
interface Store { log: Action[]; table?: { at: number; items: TableItem[] }; seenAt: number; lastRun: number; autoTable?: boolean }
export interface SessionLike { sessionId: string; cwd: string; title: string; userTitle?: string; status: string; stateSince: number; startedAt: number; paused?: any; worktree?: any; parent?: string; abstract?: string; abstractN?: number; note?: string; lastReply?: string; prompt?: string; first?: string; mode?: any }
export interface FairyCtx {
  sessions: () => SessionLike[]; end: (id: string) => void; reopen: (s: SessionLike) => void;
  waits: { list: () => any[]; remove: (id: string) => void; restore: (w: any) => void };
  projects: { list: () => { projects: { id: string; name: string; prio: number; keys: string[]; words: string[]; on: boolean }[]; assign: Record<string, string> }; assign: (item: string, project: string | null, key?: string) => void };
  prs: () => { key: string; short: string; title: string; needsYou: boolean; reason: string; state: string; sessionId?: string }[];
}
const KEY = /\b([A-Z]+)-(\d{1,6})\b/;

export class Fairy {
  private s: Store = { log: [], seenAt: 0, lastRun: 0 }; lastSeen = Date.now(); private busy = false;
  constructor(private ctx: FairyCtx, private onChange: () => void) { try { this.s = { ...this.s, ...JSON.parse(readFileSync(FILE, "utf8")) }; } catch {} }
  seen() { this.lastSeen = Date.now(); }
  payload() { const log = this.s.log.filter(a => Date.now() - a.at < 14 * 86400e3).slice(-40); return { log, unseen: log.some(a => a.at > this.s.seenAt && !a.undone), table: this.s.table, autoTable: !!this.s.autoTable, lastRun: this.s.lastRun }; }
  markSeen() { this.s.seenAt = Date.now(); this.save(); this.onChange(); }
  setAutoTable(on: boolean) { this.s.autoTable = on; this.save(); this.onChange(); }
  get autoTable() { return !!this.s.autoTable; }
  get tableAge() { return this.s.table ? Date.now() - this.s.table.at : Infinity; }

  /** Called every few minutes. Tidies at midnight on a weekday (local time), once a night. */
  async tick(now = new Date()) { if (this.busy) return; if (!Fairy.isTidyTime(now, this.s.lastRun)) return; this.busy = true; try { await this.tidy(now.getTime()); } finally { this.busy = false; } }
  static isTidyTime(now: Date, lastRun: number) { const day = now.getDay(); if (day === 0 || day === 6 || now.getHours() !== 0) return false; const last = new Date(lastRun); return !(lastRun && last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth() && last.getDate() === now.getDate()); }
  async tidy(at = Date.now()) {
    const runAt = at; const acts: Action[] = []; const add = (kind: Action["kind"], text: string, undo: any) => acts.push({ id: Math.random().toString(36).slice(2, 10), at: Date.now(), kind, text, undo, runAt });
    // sessions that have sat on "your turn" for days: closed, with a hand-off written by the close
    for (const m of this.ctx.sessions()) { if (m.status !== "idle" || m.paused || m.sessionId.startsWith("pending-")) continue; if (Date.now() - m.stateSince < SESSION_DAYS * 86400e3) continue;
      const keep = { sessionId: m.sessionId, cwd: m.cwd, title: m.title, userTitle: m.userTitle, startedAt: m.startedAt, worktree: m.worktree, parent: m.parent, abstract: m.abstract, abstractN: m.abstractN, note: m.note, mode: m.mode };
      this.ctx.end(m.sessionId); add("closed-session", `Closed "${m.userTitle || m.title}", quiet for ${Math.round((Date.now() - m.stateSince) / 86400e3)} days. Its hand-off is written.`, keep); }
    // waits she was asked about and left: let go
    for (const w of this.ctx.waits.list()) { if (w.back || !w.askedAt || Date.now() - w.askedAt < WAIT_DAYS * 86400e3) continue; this.ctx.waits.remove(w.id); add("let-go-wait", `Let go of the wait "${w.text}".`, w); }
    // unassigned sessions filed into a project by key or words; the rest by one Haiku call, only when it is sure
    const pj = this.ctx.projects.list(); const open = pj.projects.filter(p => p.on);
    if (open.length) { const loose = this.ctx.sessions().filter(m => !pj.assign[`s:${m.sessionId}`] && !m.sessionId.startsWith("pending-") && m.status !== "ended");
      const unsure: SessionLike[] = [];
      for (const m of loose) { const title = m.userTitle || m.title; const k = title.match(KEY)?.[0]?.toUpperCase(); const t = title.toLowerCase();
        const hit = open.find(p => (k && p.keys.includes(k)) || p.words.some(w => w && t.includes(w.toLowerCase())));
        if (hit) { this.ctx.projects.assign(`s:${m.sessionId}`, hit.id, k); add("filed", `Filed "${title}" under ${hit.name}.`, { item: `s:${m.sessionId}` }); } else unsure.push(m); }
      if (unsure.length && unsure.length <= 30 && !process.env.ND_NO_FAIRY_HAIKU) { const ans = await ask(`Sort session titles into her projects. Answer only with JSON: {"<n>": "<project id>" or null}. Use null unless you are sure from the title alone. Never guess.\n\nProjects:\n${open.map(p => `- ${p.id}: ${p.name}${p.keys.length ? ` (keys ${p.keys.join(", ")})` : ""}${p.words.length ? ` (words ${p.words.join(", ")})` : ""}`).join("\n")}\n\nTitles:\n${unsure.map((m, i) => `${i}: ${m.userTitle || m.title}`).join("\n")}`, 45_000);
        try { const j = JSON.parse(ans.match(/\{[\s\S]*\}/)?.[0] || "{}"); for (const [i, pid] of Object.entries<any>(j)) { const m = unsure[+i]; const p = pid && open.find(x => x.id === pid); if (!m || !p) continue; this.ctx.projects.assign(`s:${m.sessionId}`, p.id); add("filed", `Filed "${m.userTitle || m.title}" under ${p.name}.`, { item: `s:${m.sessionId}` }); } } catch {} } }
    this.s.lastRun = runAt; if (acts.length) this.s.log.push(...acts); this.s.log = this.s.log.slice(-200); this.save(); this.onChange(); return acts.length;
  }
  undo(id: string): boolean {
    const a = this.s.log.find(x => x.id === id); if (!a || a.undone) return false;
    if (a.kind === "closed-session") this.ctx.reopen(a.undo); else if (a.kind === "let-go-wait") this.ctx.waits.restore(a.undo); else if (a.kind === "filed") this.ctx.projects.assign(a.undo.item, null);
    a.undone = true; this.save(); this.onChange(); return true;
  }
  undoAll(runAt?: number) { let n = 0; for (const a of [...this.s.log].reverse()) if (!a.undone && (!runAt || a.runAt === runAt)) { if (this.undo(a.id)) n++; } return n; }

  /** Sets the table: a to-do list she walks herself, one row per thing, in her priority order, each with the next step and why. Only when asked. */
  async setTable(): Promise<TableItem[]> {
    const ss = this.ctx.sessions().filter(m => !m.sessionId.startsWith("pending-") && m.status !== "ended").slice(0, 25);
    const lines = ss.map(m => { const h = findHandoff(m.cwd, m.worktree); const hand = h ? readHandoff(h).split("## From git")[0]!.slice(0, 600) : ""; return `- ref s:${m.sessionId} | ${m.userTitle || m.title} [${m.paused ? `paused: ${m.paused.note}` : m.status}]${m.abstract ? `\n  so far: ${m.abstract.replace(/\s+/g, " ").slice(0, 350)}` : ""}${m.lastReply ? `\n  last reply: ${m.lastReply.replace(/\s+/g, " ").slice(0, 300)}` : ""}${hand ? `\n  hand-off: ${hand.replace(/\s+/g, " ")}` : ""}`; }).join("\n");
    const prs = this.ctx.prs().filter(p => p.needsYou).map(p => `- ref pr:${p.key} | ${p.short}: ${p.title} (${p.reason})`).join("\n");
    const waits = this.ctx.waits.list().filter(w => w.back).map(w => `- ref wait:${w.id} | ${w.text}: ${w.back}`).join("\n");
    const pj = this.ctx.projects.list().projects.filter(p => p.on).sort((a, b) => a.prio - b.prio).map(p => `${p.prio === 1 ? "High" : p.prio === 2 ? "Med" : "Low"}: ${p.name}`).join("; ");
    const raw = await ask(`You set the table for Lauren, a senior engineer with ADHD, before she sits down: a short to-do list she walks herself. Answer only with JSON, an array of at most 8 items, in the order she should take them:
[{"ref": "<the ref given>", "title": "<the thing, 3 to 8 words>", "step": "<the next concrete step, one line, starts with a verb>", "why": "<one short reason it is this high>"}]
Rules: order by her project priority first (${pj || "no projects"}), then by what is blocked on her. Skip sessions that are working or paused with nothing for her. The step comes from the hand-off's Next step or the last reply's Next line when there is one. Never say "you haven't". If nothing needs her, answer [].

Sessions:
${lines || "- none"}

Pull requests needing her:
${prs || "- none"}

Waits that came back:
${waits || "- none"}`, 90_000);
    let items: TableItem[] = []; try { items = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || "[]").filter((x: any) => x && x.ref && x.title).slice(0, 8).map((x: any) => ({ ref: String(x.ref), title: String(x.title), step: String(x.step || ""), why: String(x.why || "") })); } catch {}
    if (!raw) return this.s.table?.items || [];
    const done = new Set((this.s.table?.items || []).filter(i => i.done).map(i => i.ref)); for (const it of items) if (done.has(it.ref)) it.done = true; // ticks survive a re-set within the day
    this.s.table = { at: Date.now(), items }; this.save(); this.onChange(); return items;
  }
  /** She ticked one off, or unticked it. */
  tick_(ref: string, done: boolean) { const it = this.s.table?.items.find(i => i.ref === ref); if (!it) return false; it.done = done; this.save(); this.onChange(); return true; }
  private save() { try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE + ".tmp", JSON.stringify(this.s, null, 1)); renameSync(FILE + ".tmp", FILE); } catch {} }
}
