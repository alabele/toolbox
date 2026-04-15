# claude-pr-loop

Automated PR review-fix loop using [Claude Code](https://claude.ai/code) CLI.

## TL;DR

**What it solves:** The manual cycle of reviewing a PR, posting feedback, switching context to fix issues, committing, pushing, re-reviewing, and repeating until clean. This script does that entire loop hands-free — drop a PR link and walk away.

**How it works:**

1. **Clones** the repo into a bare git repo + worktree under `~/.claude-pr-loop/worktrees/` (multiple PRs from the same repo share the object store)
2. **Reviews** via `claude -p --from-pr <URL>` with read-only permissions — outputs structured JSON
3. **Posts** the review on GitHub via `gh pr review` (falls back to comment for own PRs)
4. **Fixes** via `claude -p --dangerously-skip-permissions` in the worktree — edits, commits, pushes
5. **Loops** steps 2-4 until approved or max iterations (default 5)
6. **Notifies** via macOS notification with sound when done

Each Claude call is a fresh context — no state leaks between iterations. Supports batch mode to process multiple labeled PRs in parallel.

## Prerequisites

| Tool | Install | Purpose |
|------|---------|---------|
| [Claude Code](https://claude.ai/code) (`claude`) | `npm install -g @anthropic-ai/claude-code` | LLM-powered review and fix |
| [GitHub CLI](https://cli.github.com/) (`gh`) | `brew install gh` | PR listing, review posting, repo cloning |
| `git` | (preinstalled on macOS) | Worktree management, commit, push |
| `jq` | `brew install jq` | JSON parsing |
| `python3` | (preinstalled on macOS) | Fallback JSON extraction from Claude output |

You must be authenticated with both `gh auth login` and have a valid Claude Code session (`claude` should work interactively before using this script).

## Installation

```bash
# Clone the repo
git clone git@github.com:alabele/toolbox.git ~/code/toolbox

# Symlink into your PATH
ln -s ~/code/toolbox/claude-pr-loop ~/.local/bin/claude-pr-loop
```

## Quick start

```bash
# Review and fix a single PR (full URL)
claude-pr-loop https://github.com/owner/repo/pull/123

# Same thing, shorthand
claude-pr-loop owner/repo#123

# Review only — post findings but don't fix anything
claude-pr-loop --no-fix owner/repo#123

# Batch — process all PRs with a label, in parallel
claude-pr-loop --label needs-review --repo owner/repo

# Dry run — see what would happen without doing anything
claude-pr-loop --dry-run owner/repo#123
```

## How it works

The script runs a loop for each PR:

```
┌─────────────────────────────────────────────────┐
│  1. Clone repo (bare) + create git worktree     │
│  2. Review (claude -p --from-pr, read-only)     │
│  3. Post review to GitHub (gh pr review)        │
│  4. If not approved:                            │
│     a. Fix findings (claude -p, write mode)     │
│     b. Commit + push                            │
│     c. Go to step 2                             │
│  5. macOS notification on completion            │
└─────────────────────────────────────────────────┘
```

Each Claude call uses `claude -p` (print mode), which starts a **fresh context** every time — no manual `/clear` needed.

**Review step** runs with read-only permissions. Claude analyzes the PR diff via `--from-pr` and outputs a structured JSON review with a verdict (`approve` or `changes_requested`), severity-tagged findings, and a formatted GitHub comment.

**Fix step** runs with write permissions (`--dangerously-skip-permissions`) in an isolated git worktree. Claude reads the findings, edits the files, runs linters/tests if available, commits, and pushes.

**Posting** uses `gh pr review` to submit a formal GitHub review. If you're reviewing your own PR (where GitHub blocks formal reviews), it falls back to `gh pr comment`.

## Options

```
--max-iterations N     Max review-fix cycles before giving up (default: 5)
--max-budget-usd N     Spend cap per Claude call in USD (default: 2.00)
--model MODEL          Claude model: sonnet, opus, haiku (default: sonnet)
--effort LEVEL         Claude effort level: low | medium | high | max (default: high)
--log-dir PATH         Where to write log files (default: ~/.claude-pr-loop/logs)
--no-fix               Review-only mode — post the review but skip the fix step
--label LABEL          Batch mode: filter open PRs by this GitHub label
--repo OWNER/REPO      Batch mode: which repository to query (required with --label)
--dry-run              Print what the script would do without executing anything
-h, --help             Show usage help
```

## Batch mode

Batch mode fetches all open PRs matching a label and processes each one in a **parallel background process** with its own worktree and log file:

```bash
claude-pr-loop --label claude-review --repo myorg/myrepo
```

Output:
```
Found 3 PR(s) with label 'claude-review' in myorg/myrepo:
  #42 — Add user authentication
  #45 — Fix rate limiting bug
  #51 — Update API documentation

Starting background loop for PR #42: Add user authentication
Starting background loop for PR #45: Fix rate limiting bug
Starting background loop for PR #51: Update API documentation

All 3 PR(s) running in background. PIDs: 12345 12346 12347
Logs: ~/.claude-pr-loop/logs/
```

Each PR gets a macOS notification when it completes (approved, exhausted iterations, or error).

## How worktrees work

The script uses **bare git repos with worktrees** so multiple PRs from the same repo can run in parallel without conflicts:

```
~/.claude-pr-loop/worktrees/
  owner_repo/
    bare.git/          # Shared object store (cloned once)
    pr-42/             # Worktree for PR #42
    pr-45/             # Worktree for PR #45
```

The bare repo is reused across runs. Worktrees are cleaned up automatically when the loop finishes.

## Logs

Every run writes a timestamped log file:

```
~/.claude-pr-loop/logs/
  owner_repo-pr42-20260415-130500.log
  owner_repo-pr45-20260415-130501.log
```

Log entries include timestamps, iteration markers, verdicts, finding counts, and any errors. If Claude's output fails to parse, the raw output is dumped to the log for debugging.

```bash
# Tail a running review
tail -f ~/.claude-pr-loop/logs/owner_repo-pr42-*.log

# Check all recent logs
ls -lt ~/.claude-pr-loop/logs/ | head
```

## Notifications

On macOS, the script sends a notification via `osascript` when each PR loop finishes:

| Event | Notification |
|-------|-------------|
| PR approved | "owner/repo#42 passed review (2 iterations)" |
| Max iterations hit | "owner/repo#42 — 5 iterations, still has issues" |
| Parse error | "owner/repo#42 — review parse error, check logs" |
| Batch complete | "myrepo: 3 PRs processed (label: review), 0 failed" |

## Cost control

Each `claude -p` call is capped by `--max-budget-usd` (default $2.00). With the default of 5 max iterations, each iteration has 2 Claude calls (review + fix), so worst case for a single PR is:

```
5 iterations x 2 calls x $2.00 = $20.00 max
```

To reduce cost:
- Use `--model haiku` for simpler PRs
- Lower `--max-iterations` if you expect quick convergence
- Use `--no-fix` to just get the review without spending on fixes

## Examples

```bash
# Quick review of a small PR with haiku
claude-pr-loop --model haiku --max-iterations 2 owner/repo#99

# Thorough review with opus, higher budget
claude-pr-loop --model opus --max-budget-usd 5.00 owner/repo#99

# Review a batch, save logs to a project-specific directory
claude-pr-loop --label ready-for-review --repo myorg/api \
  --log-dir ~/logs/api-reviews

# Dry run a batch to see which PRs would be processed
claude-pr-loop --dry-run --label needs-review --repo myorg/frontend
```

## Troubleshooting

**"Error: 'claude' not found in PATH"**
Install Claude Code: `npm install -g @anthropic-ai/claude-code`

**"Error: 'gh' not found in PATH"**
Install GitHub CLI: `brew install gh`, then `gh auth login`

**Review parse errors**
Claude occasionally wraps JSON in markdown fences or adds preamble text. The script handles common cases, but if parsing fails, check the raw output in the log file. The review prompt may need tweaking for specific PR types.

**"Cannot approve own PR"**
GitHub blocks formal review approvals on your own PRs. The script detects this and falls back to posting a comment instead. The loop still works — it just posts comments rather than formal reviews.

**Worktree conflicts**
If a previous run was interrupted (e.g., Ctrl+C), stale worktrees may remain. Clean them up:
```bash
rm -rf ~/.claude-pr-loop/worktrees/owner_repo/pr-42
```

**Push failures**
The fix step pushes to the PR's head branch. If the branch is protected or requires specific permissions, the push will fail. Check the log file for the git error. You need write access to the PR's source branch.
