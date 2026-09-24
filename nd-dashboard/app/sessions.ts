// SDK-managed Claude Code sessions. Each runs as a long-lived streaming query inside this process.
// Permission prompts and Claude's questions pause the session until the browser answers.
import { readFileSync as readSync_ } from "node:fs";
import { reshape } from "./titles";
import { query, type Query, type SDKUserMessage, type PermissionResult, type PermissionUpdate, type PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const STATE_FILE = process.env.ND_STATE ?? join(homedir(), ".config", "stillroom", "sessions.json");
const STYLE = (() => { try { return readSync_(new URL("./stillroom-style.md", import.meta.url), "utf8"); } catch { return ""; } })();
const OLD_STATE_FILE = join(homedir(), ".config", "quiet", "sessions.json");
try { if (!existsSync(STATE_FILE) && existsSync(OLD_STATE_FILE)) { mkdirSync(dirname(STATE_FILE), { recursive: true }); renameSync(OLD_STATE_FILE, STATE_FILE); } } catch {}
const PROJECTS = join(homedir(), ".claude", "projects");
const slug = (cwd: string) => cwd.replace(/[^a-zA-Z0-9-]/g, "-");

// Rebuild a transcript from the session's JSONL on disk, so a reopened session shows its history.
function eventsFromDisk(cwd: string, sessionId: string, cap = 400): Ev[] {
  const path = join(PROJECTS, slug(cwd), `${sessionId}.jsonl`);
  if (!existsSync(path)) return [];
  const out: Ev[] = []; const tools = new Map<string, Extract<Ev, { kind: "tool" }>>();
  for (const ln of readFileSync(path, "utf8").split("\n")) {
    if (!ln) continue; let o: any; try { o = JSON.parse(ln); } catch { continue; }
    const at = o.timestamp ? Date.parse(o.timestamp) : Date.now(); const c = o.message?.content;
    if (o.type === "user") {
      if (typeof c === "string") { if (!c.startsWith("<")) out.push({ kind: "user", text: c, at }); continue; }
      if (!Array.isArray(c)) continue;
      for (const b of c) {
        if (b.type === "text" && !String(b.text).startsWith("<")) out.push({ kind: "user", text: b.text, at });
        if (b.type === "tool_result") { const t = tools.get(b.tool_use_id); if (t) { t.result = (typeof b.content === "string" ? b.content : Array.isArray(b.content) ? b.content.filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n") : "").slice(0, 4000); t.isError = !!b.is_error; t.doneAt = at; } }
      }
    } else if (o.type === "assistant" && Array.isArray(c)) {
      for (const b of c) {
        if (b.type === "text" && b.text?.trim()) out.push({ kind: "text", text: b.text, at });
        if (b.type === "tool_use") { const ev: Extract<Ev, { kind: "tool" }> = { kind: "tool", id: b.id, name: b.name, input: b.input, at }; tools.set(b.id, ev); out.push(ev); }
      }
    }
  }
  return out.length > cap ? out.slice(-cap) : out;
}

export type Ev =
  | { kind: "user"; text: string; at: number }
  | { kind: "text"; text: string; at: number }
  | { kind: "tool"; id: string; name: string; input: any; at: number; result?: string; isError?: boolean; doneAt?: number }
  | { kind: "result"; subtype: string; cost?: number; turns?: number; at: number }
  | { kind: "note"; text: string; at: number };

export interface Pending {
  id: string; kind: "permission" | "question"; toolName: string; input: any; at: number;
  suggestions?: PermissionUpdate[]; blockedPath?: string; decisionReason?: string;
}
export type MStatus = "starting" | "working" | "waiting" | "idle" | "failed" | "ended";
export interface Meta { sessionId: string; cwd: string; title: string; startedAt: number; status: MStatus; stateSince: number; pending: Pending | null; lastText: string; mode: PermissionMode; model?: string; cost: number; note?: string; lastReply?: string; prompt?: string; userTitle?: string; first?: string }

class Inbox implements AsyncIterable<SDKUserMessage> {
  private q: SDKUserMessage[] = []; private waiters: ((v: IteratorResult<SDKUserMessage>) => void)[] = []; private closed = false;
  push(m: SDKUserMessage) { const w = this.waiters.shift(); if (w) w({ value: m, done: false }); else this.q.push(m); }
  close() { this.closed = true; for (const w of this.waiters.splice(0)) w({ value: undefined as any, done: true }); }
  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return { next: () => { if (this.q.length) return Promise.resolve({ value: this.q.shift()!, done: false }); if (this.closed) return Promise.resolve({ value: undefined as any, done: true }); return new Promise(r => this.waiters.push(r)); } };
  }
}

// Sessions use the claude.ai login by default. An ANTHROPIC_API_KEY in the shell that launched the
// server would otherwise switch them to API billing and disable claude.ai connectors (Slack, Docs, ...).
// Set ND_USE_API_KEY=1 to keep the key.
export function sessionEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  if (process.env.ND_USE_API_KEY !== "1") { delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN; }
  // marks of a parent Claude Code session (if the server was started from inside one) would make every app session a child of it and hide the claude.ai connectors
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_") || k === "CLAUDE_PID" || k === "CLAUDE_EFFORT") delete env[k];
  return env;
}

interface Managed { meta: Meta; events: Ev[]; inbox: Inbox; q: Query; resolvers: Map<string, (r: PermissionResult) => void>; abort: AbortController; resumedWithoutPrompt?: boolean }

export class SessionManager {
  private byId = new Map<string, Managed>();
  constructor(private emit: (type: "meta" | "event" | "gone" | "transcript", sessionId: string, payload: any) => void) {}
  /** Set by the server: called with the final text of each turn, after any reshaping. */
  onOutcome: (m: Meta, text: string, eventAt: number) => void = () => {};

  list(): Meta[] { return [...this.byId.values()].map(m => m.meta); }

  private persist() {
    if (this.shuttingDown && this.persistedOnShutdown) return; this.persistedOnShutdown = this.shuttingDown;
    const rows = this.list().filter(m => !m.sessionId.startsWith("pending-") && m.status !== "ended").map(m => ({ sessionId: m.sessionId, cwd: m.cwd, title: m.title, mode: m.mode, startedAt: m.startedAt, note: m.note, userTitle: m.userTitle }));
    try { mkdirSync(dirname(STATE_FILE), { recursive: true }); writeFileSync(STATE_FILE + ".tmp", JSON.stringify(rows, null, 2)); renameSync(STATE_FILE + ".tmp", STATE_FILE); } catch {}
  }
  /** Reopen every session this server owned before it last stopped. Each waits for input; no turn is started. */
  restore(): number {
    let rows: any[] = []; try { rows = JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return 0; }
    for (const r of rows) { try { this.start({ cwd: r.cwd, resume: r.sessionId, mode: r.mode, title: r.title, startedAt: r.startedAt, note: r.note, userTitle: r.userTitle }); } catch {} }
    return rows.length;
  }
  get(id: string) { return this.byId.get(id); }
  events(id: string) { return this.byId.get(id)?.events ?? []; }

  start(opts: { cwd: string; prompt?: string; resume?: string; mode?: PermissionMode; title?: string; startedAt?: number; note?: string; userTitle?: string }): string {
    const tempId = opts.resume ?? `pending-${randomUUID()}`;
    const inbox = new Inbox(); const abort = new AbortController();
    const prior = opts.resume ? eventsFromDisk(opts.cwd, opts.resume) : [];
    const firstUser = prior.find(e => e.kind === "user") as Extract<Ev, { kind: "user" }> | undefined;
    const lastUser = [...prior].reverse().find(e => e.kind === "user") as Extract<Ev, { kind: "user" }> | undefined;
    const lastText = [...prior].reverse().find(e => e.kind === "text") as Extract<Ev, { kind: "text" }> | undefined;
    const meta: Meta = { sessionId: tempId, cwd: opts.cwd, title: opts.title ?? opts.prompt?.slice(0, 80) ?? firstUser?.text.slice(0, 80) ?? "(resumed)", startedAt: opts.startedAt ?? Date.now(), status: "starting", stateSince: Date.now(), pending: null, lastText: lastText?.text.replace(/\s+/g, " ").slice(0, 160) ?? "", mode: opts.mode ?? "bypassPermissions", cost: 0, note: opts.note, userTitle: opts.userTitle, lastReply: lastText?.text.slice(0, 6000), prompt: opts.prompt ?? lastUser?.text ?? firstUser?.text, first: opts.prompt ?? firstUser?.text };
    const m: Managed = { meta, events: prior, inbox, resolvers: new Map(), abort, q: null as any };
    m.resumedWithoutPrompt = !!opts.resume && !opts.prompt;
    if (m.resumedWithoutPrompt) { meta.status = "idle"; } // the CLI reports nothing until it gets a message; it is ready and waiting
    m.q = query({
      prompt: inbox,
      options: {
        cwd: opts.cwd, resume: opts.resume, permissionMode: opts.mode ?? "bypassPermissions", abortController: abort, includePartialMessages: false, env: sessionEnv(),
        systemPrompt: { type: "preset", preset: "claude_code", append: STYLE, snapshot: false }, // how replies are shaped for the app (stillroom-style.md); no snapshot, so resumed sessions follow the current text
        canUseTool: (toolName, input, o) => this.ask(m, toolName, input, o),
      },
    });
    this.byId.set(tempId, m);
    if (opts.resume) for (const e of prior) if (e.kind === "text") this.onOutcome(meta, e.text, e.at); // earlier outcomes join the ledger
    if (opts.prompt) this.send(tempId, opts.prompt);
    this.pump(m).catch(e => this.fail(m, String(e?.message ?? e)));
    return tempId;
  }

  send(id: string, text: string) {
    const m = this.byId.get(id); if (!m) throw new Error("unknown session");
    if (m.meta.pending?.kind === "question") { this.answer(id, m.meta.pending.id, { freeText: text }); return; }
    m.events.push({ kind: "user", text, at: Date.now() }); this.emit("event", m.meta.sessionId, m.events.at(-1));
    m.meta.prompt = text; // the reply is always read against what you last asked
    m.inbox.push({ type: "user", parent_tool_use_id: null, message: { role: "user", content: text } });
    this.setStatus(m, "working");
  }

  answer(id: string, requestId: string, d: { behavior?: "allow" | "deny"; remember?: boolean; message?: string; answers?: Record<string, string>; freeText?: string }) {
    const m = this.byId.get(id); const p = m?.meta.pending; const resolve = m?.resolvers.get(requestId);
    if (!m || !p || !resolve || p.id !== requestId) return;
    let result: PermissionResult;
    if (p.kind === "question") {
      const qs = (p.input.questions ?? []) as any[];
      const answers = d.answers ?? Object.fromEntries(qs.map(q => [q.question, d.freeText ?? ""]));
      result = { behavior: "allow", updatedInput: { questions: qs, answers } };
      m.events.push({ kind: "user", text: Object.entries(answers).map(([q, a]) => `${a}`).join("; "), at: Date.now() }); this.emit("event", m.meta.sessionId, m.events.at(-1));
    } else if (d.behavior === "deny") {
      result = { behavior: "deny", message: d.message || "The user declined this action." };
    } else {
      const updates: PermissionUpdate[] | undefined = d.remember ? (p.suggestions?.length ? p.suggestions : [{ type: "addRules", rules: [{ toolName: p.toolName }], behavior: "allow", destination: "session" }]) : undefined;
      result = { behavior: "allow", updatedInput: p.input, ...(updates ? { updatedPermissions: updates } : {}) };
    }
    m.resolvers.delete(requestId); m.meta.pending = null; this.setStatus(m, "working"); resolve(result);
  }

  /** On server shutdown: stop every session process so none keeps running with no one to answer its prompts. Keeps the state file, so they reopen on the next boot. */
  private shuttingDown = false; private persistedOnShutdown = false;
  shutdown() { this.shuttingDown = true; this.persist(); for (const m of this.byId.values()) { try { m.inbox.close(); } catch {} try { m.q.close(); } catch {} try { m.abort.abort(); } catch {} } }
  /** Rename: the user's own title wins over Claude's. Empty restores Claude's. */
  setTitle(id: string, title: string) { const m = this.byId.get(id); if (!m) return; m.meta.userTitle = title.trim() || undefined; this.emit("meta", m.meta.sessionId, m.meta); this.persist(); }
  /** Park: a note to self that shows on the outside, so the session can be put down safely. Empty clears it. */
  setNote(id: string, note: string) { const m = this.byId.get(id); if (!m) return; m.meta.note = note.trim() || undefined; this.emit("meta", m.meta.sessionId, m.meta); this.persist(); }
  async interrupt(id: string) { const m = this.byId.get(id); if (m) { await m.q.interrupt(); } }
  async setMode(id: string, mode: PermissionMode) { const m = this.byId.get(id); if (m) { await m.q.setPermissionMode(mode); m.meta.mode = mode; this.emit("meta", m.meta.sessionId, m.meta); } }
  end(id: string) { const m = this.byId.get(id); if (!m) return; m.inbox.close(); try { m.q.close(); } catch {} m.abort.abort(); this.setStatus(m, "ended"); this.byId.delete(m.meta.sessionId); this.emit("gone", m.meta.sessionId, null); this.persist(); }

  private ask(m: Managed, toolName: string, input: any, o: { suggestions?: PermissionUpdate[]; blockedPath?: string; decisionReason?: string }): Promise<PermissionResult> {
    return new Promise(resolve => {
      const p: Pending = { id: randomUUID(), kind: toolName === "AskUserQuestion" ? "question" : "permission", toolName, input, at: Date.now(), suggestions: o.suggestions, blockedPath: o.blockedPath, decisionReason: o.decisionReason };
      m.resolvers.set(p.id, resolve); m.meta.pending = p; this.setStatus(m, "waiting");
    });
  }

  /** The last reply missed the shape (no status word up front): rewrite it in place. The raw text stays in the event. */
  private async shapeLast(m: Managed) {
    const ev = [...m.events].reverse().find(e => e.kind === "text") as Extract<Ev, { kind: "text" }> | undefined;
    if (!ev || process.env.ND_NO_SHAPE === "1" || /^\s*(Done|Partly done|Blocked|Found|Question|Working)\b/i.test(ev.text)) return;
    const shaped = await reshape(ev.text, STYLE); if (!shaped) return;
    if ([...m.events].reverse().find(e => e.kind === "text") !== ev) return; // a newer reply landed meanwhile
    (ev as any).raw = ev.text; ev.text = shaped; m.meta.lastText = shaped.replace(/\s+/g, " ").slice(0, 160); m.meta.lastReply = shaped.slice(0, 6000);
    this.emit("transcript", m.meta.sessionId, { meta: m.meta, events: m.events }); this.emit("meta", m.meta.sessionId, m.meta);
  }
  private setStatus(m: Managed, s: MStatus) { if (m.meta.status !== s) { m.meta.status = s; m.meta.stateSince = Date.now(); } this.emit("meta", m.meta.sessionId, m.meta); }
  private fail(m: Managed, text: string) { m.events.push({ kind: "note", text: `Session error: ${text}`, at: Date.now() }); this.emit("event", m.meta.sessionId, m.events.at(-1)); this.setStatus(m, "failed"); }

  private async pump(m: Managed) {
    for await (const msg of m.q) {
      if (msg.type === "system" && msg.subtype === "init") {
        if (m.meta.sessionId !== msg.session_id) { this.byId.delete(m.meta.sessionId); const old = m.meta.sessionId; m.meta.sessionId = msg.session_id; this.byId.set(msg.session_id, m); this.emit("gone", old, null); }
        m.meta.model = msg.model; if (m.resumedWithoutPrompt) { m.resumedWithoutPrompt = false; } this.emit("meta", m.meta.sessionId, m.meta);
        this.persist();
      } else if (msg.type === "assistant") {
        for (const b of msg.message.content as any[]) {
          if (b.type === "text" && b.text.trim()) { m.events.push({ kind: "text", text: b.text, at: Date.now() }); m.meta.lastText = b.text.replace(/\s+/g, " ").slice(0, 160); m.meta.lastReply = b.text.slice(0, 6000); this.emit("event", m.meta.sessionId, m.events.at(-1)); }
          if (b.type === "tool_use") { m.events.push({ kind: "tool", id: b.id, name: b.name, input: b.input, at: Date.now() }); this.emit("event", m.meta.sessionId, m.events.at(-1)); }
        }
        if (m.meta.status !== "waiting") this.setStatus(m, "working");
      } else if (msg.type === "user") {
        const content = (msg as any).message?.content; if (!Array.isArray(content)) continue;
        for (const b of content) if (b.type === "tool_result") {
          const ev = m.events.find(e => e.kind === "tool" && e.id === b.tool_use_id) as Extract<Ev, { kind: "tool" }> | undefined;
          if (ev) { ev.result = typeof b.content === "string" ? b.content : Array.isArray(b.content) ? b.content.filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n") : ""; ev.result = ev.result.slice(0, 4000); ev.isError = !!b.is_error; ev.doneAt = Date.now(); this.emit("event", m.meta.sessionId, ev); }
        }
      } else if (msg.type === "result") {
        m.meta.cost = (msg as any).total_cost_usd ?? m.meta.cost;
        m.events.push({ kind: "result", subtype: msg.subtype, cost: (msg as any).total_cost_usd, turns: (msg as any).num_turns, at: Date.now() }); this.emit("event", m.meta.sessionId, m.events.at(-1));
        this.setStatus(m, msg.subtype === "success" ? "idle" : "failed");
        this.shapeLast(m).then(() => { const ev = [...m.events].reverse().find(e => e.kind === "text") as Extract<Ev, { kind: "text" }> | undefined; if (ev) this.onOutcome(m.meta, ev.text, ev.at); });
      }
    }
    if (this.shuttingDown) return; // the process is closing on purpose; the state file must keep this session so it reopens next boot
    if (m.meta.status !== "ended") { this.setStatus(m, "ended"); this.byId.delete(m.meta.sessionId); this.emit("gone", m.meta.sessionId, null); this.persist(); }
  }
}
