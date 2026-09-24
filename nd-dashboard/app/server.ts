// nd-dashboard data layer and static server. Run: bun run server.ts
// Sources: `claude agents --json --all` (poll) and Claude Code lifecycle hooks (push).
// Transcripts are read only for a session's title and last assistant text.

import { readFileSync, existsSync, openSync, readSync, fstatSync, closeSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { SessionManager, type Meta } from "./sessions";
import { Titler } from "./titles";
import { Ledger } from "./ledger";
import { Prs, type Pr } from "./prs";
import { postToSlack, replyInThread, slackConnected, slackProbe } from "./slack";

const PORT = Number(process.env.ND_PORT ?? 4747);
const POLL_MS = Number(process.env.ND_POLL_MS ?? 15_000);
const FINISHED_FADES_MIN = Number(process.env.ND_FINISHED_FADES_MIN ?? 60); // hypothesis, tune it
const PUBLIC = join(import.meta.dir, "public");
const PROJECTS = join(homedir(), ".claude", "projects");
const JOBS = join(homedir(), ".claude", "jobs");

type State = "working" | "needs-permission" | "needs-answer" | "finished" | "failed" | "idle";
const NEEDS_YOU: State[] = ["needs-permission", "needs-answer", "finished", "failed"];

interface HookEvent { name: string; at: number; notificationType?: string; message?: string; lastAssistant?: string; prompt?: string }
interface Session {
  sessionId: string; cwd: string; kind: "interactive" | "background"; name?: string; shortId?: string; pid?: number;
  startedAt: number; pollState?: string; pollStatus?: string; firstSeen: number;
  lastHook?: HookEvent; prevState?: State; stateSince: number; seenInLastPoll: boolean; fromDisk?: boolean; diskAt?: number;
}

const sessions = new Map<string, Session>();
let lastPollAt = 0;
let pollError: string | null = null;
let version = 0; // bumps whenever the computed view changes

// ---------- poll ----------
async function poll() {
  try {
    const proc = Bun.spawn(["claude", "agents", "--json", "--all"], { stdout: "pipe", stderr: "pipe" });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    const rows = JSON.parse(out) as any[];
    for (const s of sessions.values()) s.seenInLastPoll = false;
    for (const r of rows) {
      const id = r.sessionId as string;
      const cur = sessions.get(id) ?? { sessionId: id, cwd: r.cwd, kind: r.kind, startedAt: r.startedAt, firstSeen: Date.now(), stateSince: r.startedAt, seenInLastPoll: true } as Session;
      cur.cwd = r.cwd; cur.kind = r.kind; cur.startedAt = r.startedAt;
      cur.pollState = r.state; cur.pollStatus = r.status; cur.seenInLastPoll = true; if (r.name) cur.name = r.name; if (r.id) cur.shortId = r.id; cur.pid = r.pid;
      sessions.set(id, cur);
    }
    recentFromDisk();
    lastPollAt = Date.now(); pollError = null;
  } catch (e: any) {
    pollError = String(e?.message ?? e);
  }
  recompute();
}

// ---------- hooks ----------
function recordHook(name: string, payload: any) {
  const id = payload?.session_id; if (!id) return;
  const cur = sessions.get(id) ?? { sessionId: id, cwd: payload.cwd ?? "", kind: "interactive", startedAt: Date.now(), firstSeen: Date.now(), stateSince: Date.now(), seenInLastPoll: false } as Session;
  if (payload.cwd) cur.cwd = payload.cwd;
  cur.lastHook = { name, at: Date.now(), notificationType: payload.notification_type, message: payload.message, lastAssistant: payload.last_assistant_message, prompt: payload.prompt };
  sessions.set(id, cur);
  recompute();
}

// Sessions that ended in a terminal keep a place on the Older shelf for a day, so they can be opened here.
const DISK_KEEP_MS = 24 * 60 * 60_000;
function recentFromDisk() {
  try {
    const found: { id: string; path: string; mtime: number }[] = [];
    for (const dir of readdirSync(PROJECTS)) { const d = join(PROJECTS, dir); let names: string[] = []; try { names = readdirSync(d); } catch { continue; }
      for (const n of names) { if (!n.endsWith(".jsonl")) continue; const p = join(d, n); let st; try { st = statSync(p); } catch { continue; } if (Date.now() - st.mtimeMs > DISK_KEEP_MS || st.size < 200) continue; found.push({ id: n.slice(0, -6), path: p, mtime: st.mtimeMs }); } }
    found.sort((a, b) => b.mtime - a.mtime);
    for (const f of found.slice(0, 30)) {
      const cur = sessions.get(f.id);
      if (cur) { if (cur.fromDisk) cur.diskAt = f.mtime; continue; }
      if (mgr.get(f.id)) continue;
      const cwd = cwdFromTranscript(f.path); if (!cwd) continue;
      sessions.set(f.id, { sessionId: f.id, cwd, kind: "interactive", startedAt: f.mtime, firstSeen: Date.now(), stateSince: f.mtime, seenInLastPoll: false, fromDisk: true, diskAt: f.mtime } as Session);
    }
    for (const [id, s] of sessions) if (s.fromDisk && !s.seenInLastPoll && Date.now() - (s.diskAt ?? 0) > DISK_KEEP_MS) sessions.delete(id);
  } catch {}
}
function cwdFromTranscript(path: string): string {
  try { const head = readFileSync(path, { encoding: "utf8" }).slice(0, 32_000).split("\n"); for (const ln of head) { try { const o = JSON.parse(ln); if (o.cwd) return o.cwd; } catch {} } } catch {} return "";
}

// ---------- state ----------
function deriveState(s: Session): State | null {
  const h = s.lastHook; const hookAgeMin = h ? (Date.now() - h.at) / 60_000 : Infinity;
  if (h?.name === "SessionEnd") { s.fromDisk = true; if (!s.diskAt) s.diskAt = h.at; return "idle"; } // ended in a terminal; it rests on the Older shelf and can be opened here
  if (s.kind === "background") {
    const ps = s.pollState;
    if (ps === "stopped") return null;
    if (ps === "failed") return "failed";
    if (ps === "blocked") return "needs-answer";
    if (ps === "completed" || ps === "done") return "finished";
    if (h?.name === "Notification" && h.notificationType === "permission_prompt" && hookAgeMin < 30) return "needs-permission";
    if (!s.seenInLastPoll && lastPollAt) return null;
    return "working";
  }
  // interactive
  if (!s.seenInLastPoll && lastPollAt) { if (s.fromDisk) return "idle"; return null; }
  const busy = s.pollStatus === "busy";
  if (busy) {
    if (h?.name === "Notification" && (h.notificationType === "permission_prompt" || h.notificationType?.startsWith("elicitation")) && hookAgeMin < 30) return "needs-permission";
    if (h?.name === "Notification" && h.notificationType === "agent_needs_input" && hookAgeMin < 30) return "needs-answer";
    return "working";
  }
  // idle
  if (h?.name === "StopFailure" && hookAgeMin < FINISHED_FADES_MIN) return "failed";
  if ((h?.name === "Stop" || (h?.name === "Notification" && h.notificationType === "idle_prompt")) && hookAgeMin < FINISHED_FADES_MIN) return "finished";
  return "idle";
}

interface View { live?: boolean; note?: string; managed?: boolean; pending?: any; lastReply?: string; prompt?: string; sessionId: string; kind: string; cwd: string; repo: string; sub: string | null; state: State; stateSince: number; startedAt: number; title: string; last: string; resume: string; needsYou: boolean }
let view: View[] = [];

function recompute() {
  const next: View[] = [];
  for (const s of sessions.values()) {
    const st = deriveState(s); if (!st) continue;
    if (s.prevState !== st) { s.stateSince = s.lastHook && s.prevState !== undefined ? s.lastHook.at : (s.prevState === undefined ? s.startedAt : Date.now()); s.prevState = st; }
    const t = transcriptInfo(s); const j = jobInfo(s);
    const { repo, sub } = identity(s.cwd);
    let live = false; if (s.pid) { try { process.kill(s.pid, 0); live = true; } catch {} } else live = s.seenInLastPoll === true;
    next.push({ live, sessionId: s.sessionId, kind: s.kind, cwd: s.cwd, repo, sub, state: st, stateSince: s.stateSince, startedAt: s.startedAt,
      title: titler.get(s.sessionId, t.first || s.lastHook?.prompt || "", t.last, st !== "working", titleFor(s, t.title)) || titleFor(s, t.title), last: (j.needs ? `Needs: ${j.needs}` : j.detail) || s.lastHook?.lastAssistant?.slice(0, 160) || t.last || "",
      resume: `cd ${JSON.stringify(s.cwd)} && claude --resume ${s.sessionId}`, needsYou: NEEDS_YOU.includes(st) });
  }
  for (const mm of mgr.list()) {
    const st: State | null = mm.status === "waiting" ? (mm.pending?.kind === "question" ? "needs-answer" : "needs-permission") : mm.status === "working" || mm.status === "starting" ? "working" : mm.status === "idle" ? "finished" : mm.status === "failed" ? "failed" : null;
    if (!st) continue;
    const i = next.findIndex(v => v.sessionId === mm.sessionId); if (i >= 0) next.splice(i, 1);
    const { repo, sub } = identity(mm.cwd);
    const ai = mm.sessionId.startsWith("pending-") ? "" : transcriptInfo({ cwd: mm.cwd, sessionId: mm.sessionId } as any).title;
    next.push({ note: mm.note, managed: true, pending: mm.pending, lastReply: mm.lastReply, prompt: mm.prompt, sessionId: mm.sessionId, kind: "quiet", cwd: mm.cwd, repo, sub, state: st, stateSince: mm.stateSince, startedAt: mm.startedAt, title: mm.userTitle || titler.get(mm.sessionId, mm.first || mm.prompt || "", mm.lastReply || "", st !== "working", ai || mm.title) || ai || mm.title, last: mm.pending ? (mm.pending.kind === "question" ? "Asked you a question" : `Wants to run ${mm.pending.toolName}`) : mm.lastText, resume: `cd ${JSON.stringify(mm.cwd)} && claude --resume ${mm.sessionId}`, needsYou: NEEDS_YOU.includes(st) });
  }
  const order: Record<State, number> = { "needs-permission": 0, "needs-answer": 1, failed: 2, finished: 3, working: 4, idle: 5 };
  next.sort((a, b) => order[a.state] - order[b.state] || a.repo.localeCompare(b.repo) || a.startedAt - b.startedAt);
  const sig = JSON.stringify(next.map(v => [v.sessionId, v.state, v.title]));
  if (sig !== JSON.stringify(view.map(v => [v.sessionId, v.state, v.title]))) version++;
  view = next;
  for (const v of next) if (v.managed) ledger.retitle(v.sessionId, v.title); // ledger rows follow the session's current title
}

// A default display name like "video-client-53" says nothing; prefer Claude's own title, then the first prompt.
function titleFor(s: Session, aiTitle: string): string {
  const base = basename(s.cwd); const generic = !s.name || new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-[0-9a-z]{1,4}$`, "i").test(s.name);
  return (!generic && s.name) || aiTitle || s.lastHook?.prompt?.slice(0, 90) || s.name || "(untitled)";
}

// ---------- identity ----------
const topCache = new Map<string, string>();
function identity(cwd: string): { repo: string; sub: string | null } {
  const m = cwd.match(/\.claude-pr-loop\/worktrees\/([^/]+?)(?:[-_]pr-(\d+))?(?:\/pr-(\d+))?(?:\/|$)/);
  if (m) { const repo = m[1].replace(/^[^_]+_/, "").replace(/-bare-git$/, ""); const pr = m[2] ?? m[3]; return { repo, sub: pr ? `PR ${pr}` : "worktree" }; }
  let top = topCache.get(cwd);
  if (top === undefined) {
    try { const p = Bun.spawnSync(["git", "-C", cwd, "rev-parse", "--show-toplevel"]); top = p.exitCode === 0 ? new TextDecoder().decode(p.stdout).trim() : cwd; } catch { top = cwd; }
    topCache.set(cwd, top);
  }
  const repo = basename(top) || cwd; const rel = cwd.startsWith(top) && cwd !== top ? cwd.slice(top.length + 1) : null;
  return { repo, sub: rel };
}

// ---------- background job state (what it needs from you, in its own words) ----------
function jobInfo(s: Session): { needs?: string; detail?: string } {
  if (s.kind !== "background" || !s.shortId) return {};
  try { const j = JSON.parse(readFileSync(join(JOBS, s.shortId, "state.json"), "utf8")); return { needs: j.needs || undefined, detail: j.detail || undefined }; } catch { return {}; }
}

// ---------- transcript (title + last assistant text) ----------
const tCache = new Map<string, { mtime: number; title: string; last: string }>();
function slug(cwd: string) { return cwd.replace(/[^a-zA-Z0-9-]/g, "-"); }
function transcriptInfo(s: Session): { title: string; last: string; first: string } {
  const path = join(PROJECTS, slug(s.cwd), `${s.sessionId}.jsonl`);
  if (!existsSync(path)) return { title: "", last: "", first: "" };
  try {
    const fd = openSync(path, "r"); const size = fstatSync(fd).size; const mtime = fstatSync(fd).mtimeMs;
    const c = tCache.get(path); if (c && c.mtime === mtime) { closeSync(fd); return c; }
    const tailLen = Math.min(size, 400_000); const buf = Buffer.alloc(tailLen);
    readSync(fd, buf, 0, tailLen, size - tailLen); closeSync(fd);
    const lines = buf.toString("utf8").split("\n"); if (size > tailLen) lines.shift();
    let title = "", last = "";
    for (const ln of lines) { if (!ln) continue; let o: any; try { o = JSON.parse(ln); } catch { continue; }
      if (o.type === "ai-title" && o.aiTitle) title = o.aiTitle;
      if (o.type === "assistant") { const c = o.message?.content; const txt = Array.isArray(c) ? c.filter((x: any) => x.type === "text").map((x: any) => x.text).join(" ") : typeof c === "string" ? c : ""; if (txt.trim()) last = txt.trim().replace(/\s+/g, " ").slice(0, 160); }
    }
    let first = c?.first ?? ""; if (!first) { // the first user request lives in the head of the file
      const head = readFileSync(path, { encoding: "utf8", flag: "r" }).slice(0, 64_000).split("\n");
      for (const ln of head) { try { const o = JSON.parse(ln); if (o.type === "user") { const c = o.message?.content; const txt = typeof c === "string" ? c : Array.isArray(c) ? c.filter((x: any) => x.type === "text").map((x: any) => x.text).join(" ") : ""; if (txt && !txt.startsWith("<")) { first = txt.replace(/\s+/g, " ").slice(0, 2000); break; } } } catch {} }
    }
    if (!title) title = first.slice(0, 90);
    const r = { mtime, title, last, first }; tCache.set(path, r); return r;
  } catch { return { title: "", last: "", first: "" }; }
}

// ---------- websocket + managed sessions ----------
const sockets = new Set<any>();
const broadcast = (o: any) => { const s = JSON.stringify(o); for (const ws of sockets) { try { ws.send(s); } catch {} } };
const titler = new Titler(() => { recompute(); broadcast({ type: "list", payload: { version, sessions: view } }); });
const ledger = new Ledger(() => broadcast({ type: "ledger", payload: ledger.list() }));
const mgr = new SessionManager((type, sessionId, payload) => { broadcast({ type, sessionId, payload }); recompute(); broadcast({ type: "list", payload: { version, sessions: view } }); });
const ROOTS = (process.env.ND_ROOTS ?? join(homedir(), "code")).split(":");
function projectDirs(): string[] { // git repos directly under each root, plus every folder a session has used
  const out = new Set<string>([...view.map(v => v.cwd), ...mgr.list().map(m => m.cwd)]);
  for (const r of ROOTS) { try { for (const d of require("node:fs").readdirSync(r, { withFileTypes: true })) if (d.isDirectory() && !d.name.startsWith(".") && existsSync(join(r, d.name, ".git"))) out.add(join(r, d.name)); } catch {} }
  return [...out].sort();
}
const knownCwds = projectDirs;

// ---------- server ----------
const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
Bun.serve({
  port: PORT,
  websocket: {
    open(ws) { sockets.add(ws); try { ws.send(JSON.stringify({ type: "ledger", payload: ledger.list() })); ws.send(JSON.stringify({ type: "prs", payload: { prs: prs.list(), repos: prs.repos, jira: prs.jira() } })); } catch {} ws.send(JSON.stringify({ type: "hello", payload: { sessions: view, managed: mgr.list(), cwds: knownCwds(), version } })); },
    close(ws) { sockets.delete(ws); },
    async message(ws, raw) {
      let msg: any; try { msg = JSON.parse(String(raw)); } catch { return; }
      try {
        switch (msg.type) {
          case "start": { const cwd = String(msg.cwd || "").replace(/^~(?=\/|$)/, homedir()); let ok = false; try { ok = statSync(cwd).isDirectory(); } catch {}
            if (!ok) { ws.send(JSON.stringify({ type: "start-failed", payload: `That folder does not exist: ${cwd || "(empty)"}` })); break; } // a missing folder makes the binary fail to launch with a misleading message
            const id = mgr.start({ cwd, prompt: msg.prompt, mode: msg.mode }); ws.send(JSON.stringify({ type: "started", payload: { tempId: id } })); break; }
          case "resume": { const id = mgr.start({ cwd: msg.cwd, resume: msg.sessionId, prompt: msg.prompt, mode: msg.mode }); ws.send(JSON.stringify({ type: "started", payload: { tempId: id } })); break; }
          case "open": ws.send(JSON.stringify({ type: "transcript", sessionId: msg.sessionId, payload: { meta: mgr.get(msg.sessionId)?.meta ?? null, events: mgr.events(msg.sessionId) } })); break;
          case "send": mgr.send(msg.sessionId, msg.text); break;
          case "answer": mgr.answer(msg.sessionId, msg.requestId, msg.decision); break;
          case "interrupt": await mgr.interrupt(msg.sessionId); break;
          case "mode": await mgr.setMode(msg.sessionId, msg.mode); break;
          case "end": mgr.end(msg.sessionId); break;
          case "note": mgr.setNote(msg.sessionId, String(msg.note ?? "")); break;
          case "title": mgr.setTitle(msg.sessionId, String(msg.title ?? "")); if (String(msg.title ?? "").trim()) ledger.retitle(msg.sessionId, String(msg.title).trim()); break;
        }
      } catch (e: any) { ws.send(JSON.stringify({ type: "error", payload: String(e?.message ?? e) })); }
    },
  },
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") { if (server.upgrade(req)) return undefined as any; return new Response("upgrade failed", { status: 400 }); }
    if (url.pathname === "/api/ledger") return Response.json(ledger.list());
    if (url.pathname === "/api/prs") return Response.json({ prs: prs.list(), repos: prs.repos, jira: prs.jira() });
    if (url.pathname === "/api/slack/status") return Response.json({ connected: await slackConnected() });
    if (url.pathname === "/api/slack/probe") return new Response(await slackProbe(url.searchParams.get("q") || "general"));
    if (url.pathname === "/api/jira/refresh" && req.method === "POST") { await prs.refreshTickets(); return Response.json(prs.jira()); }
    if (url.pathname === "/api/pr/review" && req.method === "POST") { const b = await req.json(); return runPrLoop(String(b.key)) ? new Response("ok") : new Response("already running or unknown", { status: 409 }); }
    if (url.pathname === "/api/pr/channel" && req.method === "POST") { const b = await req.json(); prs.setChannel(String(b.repo), String(b.channel).trim()); broadcast({ type: "prs", payload: { prs: prs.list(), repos: prs.repos, jira: prs.jira() } }); return new Response("ok"); }
    if (url.pathname === "/api/pr/slack" && req.method === "POST") { const b = await req.json(); const pr = prs.get(String(b.key)); if (!pr) return new Response("unknown", { status: 404 });
      const channel = prs.repos[pr.repo]?.channel; if (!channel) return new Response("no channel for this repo", { status: 400 });
      if (b.kind === "nudge") { if (!pr.slack?.permalink) return new Response("nothing to nudge", { status: 400 }); const r = await replyInThread(pr.slack.permalink, String(b.text || `Still looking for a reviewer on ${pr.short}. ${pr.url}`)); if (r !== "ok") return new Response(r, { status: 502 }); prs.noteSlack(pr.key, { nudgedAt: Date.now() }); return new Response("ok"); }
      const r = await postToSlack(channel, String(b.text || `Review request: ${pr.title} ${pr.url}`)); if (r.startsWith("ERROR")) return new Response(r, { status: 502 }); prs.noteSlack(pr.key, { channel, askedAt: Date.now(), permalink: r }); return new Response("ok"); }
    if (url.pathname === "/api/state") {
      const counts: Record<string, number> = {}; for (const v of view) counts[v.state] = (counts[v.state] ?? 0) + 1;
      return Response.json({ version, checkedAt: lastPollAt, pollError, finishedFadesMin: FINISHED_FADES_MIN, counts, needsYou: view.filter(v => v.needsYou).length, sessions: view });
    }
    if (url.pathname.startsWith("/hook/") && req.method === "POST") {
      const name = url.pathname.slice(6); let payload: any = {};
      try { payload = await req.json(); } catch {}
      recordHook(name, payload); return new Response("ok");
    }
    if (url.pathname === "/api/refresh" && req.method === "POST") { await poll(); return Response.json({ version }); }
    if (url.pathname === "/api/resume" && req.method === "POST") { // user-initiated: open a terminal window running the resume command
      const { sessionId } = await req.json(); const v = view.find(x => x.sessionId === sessionId); if (!v) return new Response("unknown session", { status: 404 });
      const app = process.env.ND_TERMINAL ?? "Terminal"; const cmd = v.resume.replace(/"/g, '\\"');
      const script = app === "iTerm" || app === "iTerm2"
        ? `tell application "iTerm" to create window with default profile command "/bin/zsh -lc \"${cmd}; exec zsh\""`
        : `tell application "${app}" to do script "${cmd}"\nactivate application "${app}"`;
      const p = Bun.spawnSync(["osascript", "-e", script]); return p.exitCode === 0 ? new Response("ok") : new Response(new TextDecoder().decode(p.stderr), { status: 500 });
    }
    if (url.pathname === "/api/dirs") { // shell-style completion: directories matching a partial path
      const q = (url.searchParams.get("q") ?? "").replace(/^~(?=\/|$)/, homedir());
      const dir = q.endsWith("/") ? q : q.slice(0, q.lastIndexOf("/") + 1) || homedir() + "/"; const part = q.endsWith("/") ? "" : q.slice(q.lastIndexOf("/") + 1).toLowerCase();
      let out: string[] = [];
      try { out = require("node:fs").readdirSync(dir, { withFileTypes: true }).filter((d: any) => d.isDirectory() && (part ? d.name.toLowerCase().startsWith(part) : !d.name.startsWith("."))).map((d: any) => (dir.endsWith("/") ? dir : dir + "/") + d.name).sort().slice(0, 30); } catch {}
      return Response.json({ dirs: out, home: homedir() });
    }
    if (url.pathname === "/api/pick-folder" && req.method === "POST") { // native macOS folder dialog, user-initiated
      const p = Bun.spawnSync(["osascript", "-e", 'POSIX path of (choose folder with prompt "Start a session in…")']);
      const out = new TextDecoder().decode(p.stdout).trim().replace(/\/$/, "");
      return p.exitCode === 0 && out ? Response.json({ cwd: out }) : Response.json({ cwd: null });
    }
    if (url.pathname === "/api/letgo" && req.method === "POST") { // user-initiated: end a terminal or background session
      const { sessionId } = await req.json(); const s = sessions.get(sessionId); if (!s) return new Response("unknown session", { status: 404 });
      if (s.kind === "background" && s.shortId) { const p = Bun.spawnSync(["claude", "rm", s.shortId]); if (p.exitCode !== 0) return new Response(new TextDecoder().decode(p.stderr) || "could not remove", { status: 500 }); }
      else if (s.pid) { try { process.kill(s.pid, "SIGTERM"); } catch (e: any) { return new Response(String(e?.message ?? e), { status: 500 }); } }
      sessions.delete(sessionId); recompute(); broadcast({ type: "list", payload: { version, sessions: view } }); return new Response("ok");
    }
    if (url.pathname === "/api/reveal" && req.method === "POST") { // user-initiated: show the folder in Finder
      const { sessionId } = await req.json(); const v = view.find(x => x.sessionId === sessionId); if (!v) return new Response("unknown session", { status: 404 });
      Bun.spawn(["open", v.cwd]); return new Response("ok");
    }
    if (url.pathname === "/vendor/lucide.min.js") return new Response(Bun.file(join(import.meta.dir, "node_modules", "lucide", "dist", "umd", "lucide.min.js")), { headers: { "content-type": "text/javascript", "cache-control": "no-cache" } });
    if (url.pathname === "/vendor/marked.min.js") return new Response(Bun.file(join(import.meta.dir, "node_modules", "marked", "lib", "marked.umd.js")), { headers: { "content-type": "text/javascript", "cache-control": "no-cache" } });
    let p = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join(PUBLIC, p));
    if (await file.exists()) { const ext = p.slice(p.lastIndexOf(".")); return new Response(file, { headers: { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "no-cache" } }); }
    return new Response("not found", { status: 404 });
  },
});
console.log(`Stillroom on http://localhost:${PORT}  (poll ${POLL_MS / 1000}s, finished fades after ${FINISHED_FADES_MIN} min)`);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(sig, () => { console.log(`${sig}: stopping sessions cleanly`); mgr.shutdown(); setTimeout(() => process.exit(0), 300); });
await poll(); setInterval(poll, POLL_MS);
// ---------- pull requests ----------
const gitCache = new Map<string, { at: number; repo: string; branch: string }>();
function gitInfo(cwd: string) {
  const c = gitCache.get(cwd); if (c && Date.now() - c.at < 60_000) return c;
  let repo = "", branch = "";
  try { const r = Bun.spawnSync(["git", "-C", cwd, "remote", "get-url", "origin"], { stdout: "pipe", stderr: "pipe" }); const url = r.stdout.toString().trim(); const m = url.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/); if (m) repo = m[1]; } catch {}
  try { const r = Bun.spawnSync(["git", "-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"], { stdout: "pipe", stderr: "pipe" }); branch = r.stdout.toString().trim(); } catch {}
  const v = { at: Date.now(), repo, branch }; gitCache.set(cwd, v); return v;
}
function linkPr(pr: Pr): { sessionId: string; title: string } | null {
  const short = pr.repo.split("/")[1];
  for (const m of mgr.list()) { if (m.status === "ended" || m.sessionId.startsWith("pending-")) continue;
    const g = gitInfo(m.cwd); if (g.repo.toLowerCase() !== pr.repo.toLowerCase()) continue;
    const title = view.find(x => x.sessionId === m.sessionId)?.title || m.userTitle || m.title;
    if (pr.headRef && g.branch === pr.headRef) return { sessionId: m.sessionId, title };
    const text = [m.first, m.prompt, m.lastReply].filter(Boolean).join("\n");
    const re = new RegExp(`(?:${pr.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|\\b(?:PR|pull request)\\s*#?${pr.number}\\b|${short}\\s*#${pr.number}\\b|(?<![\\w/])#${pr.number}\\b)`, "i");
    if (re.test(text)) return { sessionId: m.sessionId, title }; }
  return null;
}
const prs = new Prs(() => broadcast({ type: "prs", payload: { prs: prs.list(), repos: prs.repos, jira: prs.jira() } }), linkPr);
const reviewing = new Map<string, any>();
function runPrLoop(key: string) {
  const pr = prs.get(key); if (!pr || reviewing.has(key)) return false;
  const proc = Bun.spawn([join(homedir(), "code", "toolbox", "claude-pr-loop", "claude-pr-loop"), pr.url], { stdout: "ignore", stderr: "ignore", env: { ...process.env } });
  reviewing.set(key, proc); prs.markReviewing(key, true);
  proc.exited.then(() => { reviewing.delete(key); prs.markReviewing(key, false); }); return true;
}
mgr.onOutcome = (m, text, at) => { const row = view.find(x => x.sessionId === m.sessionId); ledger.add({ id: `${m.sessionId}:${at}`, sessionId: m.sessionId, cwd: m.cwd, title: row?.title || m.userTitle || m.title, text, at }); };
const restored = mgr.restore(); prs.start(); if (restored) console.log(`reopened ${restored} Stillroom session${restored === 1 ? "" : "s"} from ${process.env.ND_STATE ?? "~/.config/stillroom/sessions.json"}`);
