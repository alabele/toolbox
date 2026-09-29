// Titles the app writes itself. Claude Code's own names ("video-client-53") and its ai-title
// say what a session is about, not what it is doing. A short Haiku call turns the first
// request and the latest reply into "doing X for Y". Cached on disk, one call at a time,
// hookless and unsaved so it never shows up as a session of its own.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdirSync as mk } from "node:fs";
export const HELPER_DIR = join(homedir(), ".config", "stillroom", "helpers"); try { mk(HELPER_DIR, { recursive: true }); } catch {}
import { sessionEnv } from "./sessions";

const FILE = process.env.ND_TITLES ?? join(homedir(), ".config", "stillroom", "titles.json");
const OFF = process.env.ND_NO_TITLES === "1";
const RETITLE_AFTER = 10 * 60_000; // a settled session is retitled at most this often; titles that keep shifting are worse than a stale one
const RETRY_AFTER = 10 * 60_000; // after a failed call
type Row = { key: string; title: string; at: number };
type Job = { id: string; key: string; first: string; last: string; current: string };

export class Titler {
  private rows = new Map<string, Row>();
  private jobs = new Map<string, Job>();
  private busy = false;
  constructor(private onChange: () => void) { try { for (const [id, r] of Object.entries(JSON.parse(readFileSync(FILE, "utf8")))) this.rows.set(id, r as Row); } catch {} }

  /** The cached title for this session, and a fresh one on the way when what it is doing changed. */
  get(id: string, first: string, last: string, settled: boolean, current = ""): string {
    if (OFF || !id || id.startsWith("pending-") || !first?.trim()) return "";
    const key = hash("v3\n" + first.slice(0, 400) + "\n" + (last || "").slice(0, 400)); // v2: titles lead with the thing
    const row = this.rows.get(id);
    const stale = !row || (row.key !== key && settled && Date.now() - row.at > RETITLE_AFTER) || (!row?.title && Date.now() - (row?.at ?? 0) > RETRY_AFTER);
    if (stale && this.jobs.get(id)?.key !== key) { this.jobs.set(id, { id, key, first, last, current: row?.title || current }); this.drain(); }
    return row?.title ?? "";
  }

  private async drain() {
    if (this.busy) return; this.busy = true;
    try { for (let j = next(this.jobs); j; j = next(this.jobs)) { this.jobs.delete(j.id); const title = await makeTitle(j); this.rows.set(j.id, { key: j.key, title, at: Date.now() }); this.save(); if (title) this.onChange(); } }
    finally { this.busy = false; }
  }
  private save() { try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE + ".tmp", JSON.stringify(Object.fromEntries(this.rows), null, 1)); renameSync(FILE + ".tmp", FILE); } catch {} }
}
const next = (m: Map<string, Job>) => m.values().next().value as Job | undefined;
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

async function makeTitle(j: Job): Promise<string> {
  const prompt = [
    "Title this coding session. One session is one ticket. If the first request names a ticket key (like VDC-1234, D-413, STORY-205, PROJ-030), the title is that key, a colon, then 3 to 6 plain words for the matter: \"VDC-2318: demo driver startup\". With no ticket, lead with the thing, then the matter: the pull request, file or repo first, then a noun phrase, no verb: \"docs #5243: deliver plugin review\", \"Cam2Cam iOS Safari failure\".",
    "Name a pull request as repo #number, like docs-pipeline #319, never PR 2244. Never quote the request or the reply. No quotes, no trailing period, no words like session, task, user or Claude. Reply with the title only.",
    j.current ? `Current title: ${j.current}. Keep it if it still fits; change it only if what is happening has changed.` : "",
    `\nFirst request:\n${j.first.slice(0, 1500)}`,
    j.last ? `\nLatest reply:\n${j.last.slice(0, 1500)}` : "",
  ].filter(Boolean).join("\n");
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 45_000);
  try {
    const q = query({ prompt, options: { model: "haiku", settingSources: [], tools: [], maxTurns: 1, persistSession: false, env: sessionEnv(), cwd: HELPER_DIR, abortController: abort } as any });
    let text = "";
    for await (const m of q) if (m.type === "assistant") for (const b of (m as any).message.content) if (b.type === "text") text += b.text;
    return withTicket(clean(text), j.first);
  } catch { return ""; } finally { clearTimeout(timer); }
}
/** One hookless, unsaved Haiku call. Text back, or empty on failure. */
export async function ask(prompt: string, timeoutMs = 60_000): Promise<string> {
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const q = query({ prompt, options: { model: "haiku", settingSources: [], tools: [], maxTurns: 1, persistSession: false, env: sessionEnv(), cwd: HELPER_DIR, abortController: abort } as any });
    let text = ""; for await (const m of q) if (m.type === "assistant") for (const b of (m as any).message.content) if (b.type === "text") text += b.text;
    return text.trim();
  } catch { return ""; } finally { clearTimeout(timer); }
}
/** A reply that missed the Stillroom shape is rewritten into it. Every fact kept, none added. Empty on failure. */
export async function reshape(reply: string, style: string): Promise<string> {
  if (!reply.trim() || !style) return "";
  const prompt = `Rewrite the reply below into the shape described. Keep every fact, name, number and link exactly. Add nothing, drop nothing that matters. Bullets, not paragraphs, above the ---. Output only the rewritten reply.\n\n## The shape\n${style}\n\n## The reply\n${reply.slice(0, 12000)}`;
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 60_000);
  try {
    const q = query({ prompt, options: { model: "haiku", settingSources: [], tools: [], maxTurns: 1, persistSession: false, env: sessionEnv(), cwd: HELPER_DIR, abortController: abort } as any });
    let text = ""; for await (const m of q) if (m.type === "assistant") for (const b of (m as any).message.content) if (b.type === "text") text += b.text;
    return text.trim();
  } catch { return ""; } finally { clearTimeout(timer); }
}
function clean(t: string) { const line = t.trim().split("\n").map(s => s.trim()).filter(Boolean)[0] ?? ""; return line.replace(/^["'“”]+|["'“”.]+$/g, "").replace(/^title:\s*/i, "").slice(0, 80); }
const TICKET = /\b(VDC|D|STORY|PROJ|OPS|DOCS)-(\d{1,6})\b/i;
/** The ticket named in the first request leads the title, as KEY: matter. */
function withTicket(title: string, first: string): string {
  const m = first.match(TICKET); if (!m) return title; const key = `${m[1].toUpperCase()}-${m[2]}`;
  const lead = title.match(new RegExp(`^\\s*${key}\\s*[:\\-–—]?\\s*(.*)$`, "i")); if (lead) return `${key}: ${lead[1].trim() || "in progress"}`; // already leads: just normalize the separator
  return `${key}: ${title.trim() || "in progress"}`; }
