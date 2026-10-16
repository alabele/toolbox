// The hard rules a session cannot talk its way past. Code, not prose: deny rules and a PreToolUse hook that run on
// every tool call, in every permission mode (design: research/harnesses.md S5, S6, S8; QUEUE item 4).
//   - writes stay inside the session's folder (its worktree), plus /tmp and Stillroom's uploads
//   - no pushes to a protected branch, no force pushes, no deleting remote branches, no merging PRs from a session
//   - credential files stay closed
//   - after N blocked actions in a row the session pauses and asks her, instead of retrying
// Settings live in ~/.config/stillroom/guard.json; every key is optional.
// sandbox stays off by default: probed 2026-10-16, the sandbox proxy breaks gh (TLS verify fails) while git and curl work. Turn it on only once gh trusts the proxy.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";

export interface GuardConfig { sandbox: boolean; maxTurns: number; maxBudgetUsd: number; denialsBeforePause: number; protectedBranches: string[]; writeAllow: string[] }
const CFG = join(homedir(), ".config", "stillroom", "guard.json");
const REPOS = join(homedir(), ".config", "stillroom", "repos.json");
const DEFAULTS: GuardConfig = { sandbox: false, maxTurns: 400, maxBudgetUsd: 30, denialsBeforePause: 3, protectedBranches: ["main", "master", "development", "develop", "release/*"], writeAllow: ["/tmp", "/private/tmp", join(homedir(), ".config", "stillroom", "uploads"), join(homedir(), ".config", "stillroom", "worktrees")] };
export function guardConfig(): GuardConfig { let c: Partial<GuardConfig> = {}; try { c = JSON.parse(readFileSync(CFG, "utf8")); } catch {} const g = { ...DEFAULTS, ...c }; if (process.env.ND_SANDBOX) g.sandbox = process.env.ND_SANDBOX === "1"; try { for (const r of Object.values<any>(JSON.parse(readFileSync(REPOS, "utf8")))) if (r?.base && !g.protectedBranches.includes(r.base)) g.protectedBranches.push(String(r.base)); } catch {} return g; }

/** Permission deny rules the SDK enforces before any hook or mode. Read rules take paths; Bash rules are prefixes. */
export const DENY_RULES = [
  "Read(~/.ssh/**)", "Read(~/.aws/**)", "Read(~/.netrc)", "Read(~/.claude/.credentials.json)", "Read(~/.config/stillroom/jira-token)", "Read(**/.env)", "Read(**/.env.local)", "Read(**/.env.production)",
  "Bash(sudo *)", "Bash(git push --force*)", "Bash(git push -f *)", "Bash(gh pr merge*)", "Bash(gh repo delete*)",
];

const SECRETS = /(^|[\s"'=\/])(~|\$HOME|\/Users\/[^/\s]+)?\/?(\.ssh\/|\.aws\/credentials|\.netrc\b|\.claude\/\.credentials\.json|stillroom\/jira-token)|(^|[\s"'=\/])\.env(\.local|\.production)?(?=[\s"']|$)/;
const home = homedir();
function expand(p: string, cwd: string) { if (p.startsWith("~/") || p === "~") p = join(home, p.slice(1)); if (p.startsWith("$HOME")) p = home + p.slice(5); return isAbsolute(p) ? resolve(p) : resolve(cwd, p); }
function inside(p: string, dir: string) { const d = resolve(dir); return p === d || p.startsWith(d + sep); }
function branchMatches(b: string, pats: string[]) { return pats.some(p => p.endsWith("/*") ? b.startsWith(p.slice(0, -1)) : b === p); }
function currentBranch(cwd: string): string { try { const r = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], { cwd, stdout: "pipe", stderr: "ignore" }); return r.success ? r.stdout.toString().trim() : ""; } catch { return ""; } }

/** The reason this call is blocked, or "" when it may run. Pure apart from one git rev-parse for a bare `git push`. */
export function checkCall(tool: string, input: any, cwd: string, g: GuardConfig = guardConfig()): string {
  const allowed = [cwd, ...g.writeAllow];
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) {
    const raw = String(input?.file_path ?? input?.notebook_path ?? input?.path ?? ""); if (!raw) return "";
    const p = expand(raw, cwd);
    if (SECRETS.test(p)) return `Stillroom rule: credential files stay closed (${raw}).`;
    if (!allowed.some(d => inside(p, d))) return `Stillroom rule: writes stay inside this session's folder, ${cwd}. ${raw} is outside it.`;
    return "";
  }
  if (tool !== "Bash") return "";
  const cmd = String(input?.command ?? "");
  if (/(^|[;&|]\s*)sudo\b/.test(cmd)) return "Stillroom rule: no sudo.";
  if (SECRETS.test(cmd) && !/\.env\.(example|sample|template)/.test(cmd)) return "Stillroom rule: credential files stay closed.";
  if (/\bgh\s+(pr\s+merge|repo\s+delete|release\s+delete)\b/.test(cmd)) return "Stillroom rule: merging and deleting on GitHub is hers. Open the PR and stop at Ready to merge.";
  for (const m of cmd.matchAll(/\bgit\s+(?:-C\s+\S+\s+)?push\b([^|;&]*)/g)) {
    const args = (m[1] || "").trim().split(/\s+/).filter(Boolean);
    if (args.some(a => /^(--force|-f|--force-with-lease(=.*)?|--delete|-d)$/.test(a) || /^\+/.test(a))) return "Stillroom rule: no force pushes and no deleting remote branches.";
    const refs = args.filter(a => !a.startsWith("-")).slice(1); // after the remote
    if (refs.some(r => r.startsWith(":"))) return "Stillroom rule: no deleting remote branches.";
    const targets = refs.length ? refs.map(r => r.includes(":") ? r.split(":").pop()! : r).map(r => r.replace(/^refs\/heads\//, "")) : [currentBranch(cwd)].filter(Boolean);
    const hit = targets.find(t => branchMatches(t, g.protectedBranches));
    if (hit) return `Stillroom rule: no pushes to ${hit}. Push the ticket branch and open a PR.`;
  }
  for (const m of cmd.matchAll(/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+|--recursive\s+)([^|;&]*)/g)) {
    const targets = (m[2] || "").split(/\s+/).filter(t => t && !t.startsWith("-"));
    for (const t of targets) { const p = expand(t.replace(/["']/g, ""), cwd); if (p === "/" || p === home || !allowed.some(d => inside(p, d))) return `Stillroom rule: nothing is deleted outside this session's folder (${t}).`; }
  }
  return "";
}

/** The PreToolUse hook for one session. onDeny runs on every block so the session can count and, at the limit, pause. */
export function guardHook(ctx: { cwd: () => string; onDeny: (reason: string) => void }) {
  return async (input: any) => {
    if (input?.hook_event_name !== "PreToolUse") return {};
    const reason = checkCall(String(input.tool_name), input.tool_input, ctx.cwd());
    if (!reason) return {};
    ctx.onDeny(reason);
    return { hookSpecificOutput: { hookEventName: "PreToolUse" as const, permissionDecision: "deny" as const, permissionDecisionReason: `${reason} If the task needs this, say so and call pause_session with the reason; that is a good outcome.` } };
  };
}
