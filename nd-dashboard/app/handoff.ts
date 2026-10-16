// A hand-off per piece of work (QUEUE item 5; research/harnesses.md S2, S6, S18, S20). Written when a session pauses,
// closes, or hits its cap. Read first by the next session on the same worktree or folder. The file list comes from git,
// not from the model: every summarizer tested was bad at listing changed files.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { ask } from "./titles";

const DIR = join(homedir(), ".config", "stillroom", "handoffs");
export const HANDOFF_FILE = "HANDOFF.md";
export function handoffPath(cwd: string, worktree?: { path: string } | null) { return worktree?.path ? join(worktree.path, HANDOFF_FILE) : join(DIR, cwd.replace(/[^\w.-]+/g, "-").replace(/^-/, "") + ".md"); }

function git(cwd: string, ...args: string[]) { try { const r = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "ignore" }); return r.success ? r.stdout.toString().trim() : ""; } catch { return ""; } }
/** What git knows: the branch, commits since the base, changed files, and what is not committed. */
export function gitFacts(cwd: string): string {
  if (!git(cwd, "rev-parse", "--is-inside-work-tree")) return "";
  const branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  const base = ["@{upstream}", "origin/HEAD", "origin/development", "origin/main"].map(r => git(cwd, "merge-base", r, "HEAD") ? r : "").find(Boolean);
  const commits = base ? git(cwd, "log", "--oneline", "--no-decorate", `${base}..HEAD`).split("\n").filter(Boolean).slice(0, 15) : [];
  const files = base ? git(cwd, "diff", "--stat", `${base}...HEAD`).split("\n").filter(Boolean).slice(0, 40) : [];
  const dirty = git(cwd, "status", "--short").split("\n").filter(Boolean).slice(0, 40);
  return [`Branch: ${branch}${base ? ` (base ${base})` : ""}`, commits.length ? `Commits since base:\n${commits.map(c => "- " + c).join("\n")}` : "No commits since base.", files.length ? `Files changed since base:\n${files.map(f => "- " + f.trim()).join("\n")}` : "", dirty.length ? `Uncommitted:\n${dirty.map(f => "- " + f).join("\n")}` : "Working tree clean."].filter(Boolean).join("\n\n");
}

export interface HandoffInput { cwd: string; worktree?: { path: string; branch: string; repo: string } | null; title: string; first?: string; abstract?: string; turns: string; why: string }
/** Writes the hand-off. Returns its path, or null when nothing was written. */
export async function writeHandoff(h: HandoffInput): Promise<string | null> {
  const facts = gitFacts(h.cwd);
  const body = await ask(`Write a hand-off note for the next engineer (or the next Claude session) picking up this work. They start with no memory of this session. Plain words, short lines, no preamble.

Use exactly these headings, each followed by bullets (or "none"):
## Goal
## Done
## Next step
## Open questions
## Watch out

Rules: Goal is one line. Done lists what is finished and verified, not what was tried. Next step is the single first thing to do, concrete enough to start on. Open questions are decisions someone else must make. Watch out is anything that bit this session (a flaky test, a rule that blocked something, a wrong assumption). Do not list changed files; git does that below. Under 200 words.

Title: ${h.title}
Why the session stopped: ${h.why}
${h.first ? `First request:\n${h.first.slice(0, 1200)}\n` : ""}${h.abstract ? `So far (earlier summary):\n${h.abstract.slice(0, 1500)}\n` : ""}
Last turns:
${h.turns.slice(-6000)}`, 90_000);
  if (!body) return null;
  const path = handoffPath(h.cwd, h.worktree);
  const text = `# Hand-off: ${h.title}\n\nWritten ${new Date().toISOString().slice(0, 16).replace("T", " ")} because: ${h.why}\nFolder: ${h.cwd}\n\n${body.trim()}\n\n## From git\n\n${facts || "Not a git folder."}\n`;
  try { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, text); return path; } catch { return null; }
}
/** The hand-off a new session should read first, if one is fresh enough. */
export function findHandoff(cwd: string, worktree?: { path: string } | null, maxDays = 45): string | null {
  for (const p of [worktree?.path ? join(worktree.path, HANDOFF_FILE) : "", join(cwd, HANDOFF_FILE), handoffPath(cwd, null)]) {
    if (!p || !existsSync(p)) continue; try { if (Date.now() - statSync(p).mtimeMs < maxDays * 86400e3) return p; } catch {} }
  return null;
}
export function readHandoff(p: string) { try { return readFileSync(p, "utf8"); } catch { return ""; } }
export const handoffName = (p: string) => basename(p);
