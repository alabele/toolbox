// One session, one ticket, one branch, one worktree. A session started in a git repo with a ticket key gets
// ~/.config/stillroom/worktrees/<repo>/<KEY> on branch <KEY>, made from the repo's default branch. Reused next time.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const BASE = join(homedir(), ".config", "stillroom", "worktrees");
const REPOS_FILE = join(homedir(), ".config", "stillroom", "repos.json");
export interface Worktree { path: string; branch: string; repo: string; created: boolean }
const KEY = /\b(VDC|D|STORY|PROJ|OPS|DOCS)-(\d{1,6})\b/i;

function git(cwd: string, ...args: string[]): { ok: boolean; out: string } {
  try { const r = Bun.spawnSync(["git", "-C", cwd, ...args], { stdout: "pipe", stderr: "pipe" }); return { ok: r.exitCode === 0, out: (r.stdout.toString() + r.stderr.toString()).trim() }; } catch (e: any) { return { ok: false, out: String(e?.message ?? e) }; }
}
export function ticketIn(text: string): string | undefined { const m = String(text || "").match(KEY); return m ? `${m[1].toUpperCase()}-${m[2]}` : undefined; }

/** The branch this repo's tickets start from, when its PRs do not land on the GitHub default.
 *  Set "base" on the repo in repos.json; video-client merges into development, not main. */
function configuredBase(repo: string): string | undefined {
  try { for (const [key, cfg] of Object.entries<any>(JSON.parse(readFileSync(REPOS_FILE, "utf8")))) if (key.split("/").pop() === repo && cfg?.base) return String(cfg.base); } catch {}
  return undefined;
}

/** Makes or reuses the worktree for this ticket. Null when the folder is not a repo, there is no key, or it is off. */
export function ensureWorktree(cwd: string, key?: string): Worktree | null {
  if (process.env.ND_NO_WORKTREES === "1" || !key) return null;
  const root = git(cwd, "rev-parse", "--show-toplevel"); if (!root.ok) return null; const repoRoot = root.out;
  if (repoRoot.startsWith(BASE)) { const br = git(repoRoot, "rev-parse", "--abbrev-ref", "HEAD"); return { path: repoRoot, branch: br.out, repo: basename(repoRoot), created: false }; } // already inside one
  const repo = basename(repoRoot); const path = join(BASE, repo, key);
  if (existsSync(path)) { const br = git(path, "rev-parse", "--abbrev-ref", "HEAD"); return { path, branch: br.ok ? br.out : key, repo, created: false }; }
  mkdirSync(join(BASE, repo), { recursive: true });
  git(repoRoot, "fetch", "--quiet", "origin"); // best effort; a stale base is better than no worktree
  const has = (r: string) => git(repoRoot, "rev-parse", "--verify", "--quiet", r).ok; const want = configuredBase(repo); // the repo's own base wins over origin/HEAD
  const head = git(repoRoot, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"); const base = want && has(`origin/${want}`) ? `origin/${want}` : head.ok ? head.out : has("origin/development") ? "origin/development" : has("origin/main") ? "origin/main" : "HEAD";
  const exists = git(repoRoot, "rev-parse", "--verify", "--quiet", `refs/heads/${key}`).ok || git(repoRoot, "rev-parse", "--verify", "--quiet", `refs/remotes/origin/${key}`).ok;
  const r = exists ? git(repoRoot, "worktree", "add", path, key) : git(repoRoot, "worktree", "add", "-b", key, path, base);
  if (!r.ok) { const r2 = git(repoRoot, "worktree", "add", path, key); if (!r2.ok) return null; } // the branch may exist only remotely
  return { path, branch: key, repo, created: true };
}
/** Removes a worktree the app made. The branch stays. */
export function removeWorktree(path: string): string {
  if (!path.startsWith(BASE)) return "Not one of ours."; const root = git(path, "rev-parse", "--git-common-dir"); if (!root.ok) return "Not a worktree.";
  const main = join(root.out.startsWith("/") ? root.out : join(path, root.out), ".."); const r = git(main, "worktree", "remove", "--force", path); return r.ok ? "ok" : r.out;
}
