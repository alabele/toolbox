# Stillroom queue

Work Lauren has asked for that is NOT to be built or deployed until she says go.
Nothing here runs on its own. No server restarts while sessions are in flight.

## Queued

(Nothing queued. Everything asked for through 2026-10-16 is built; see Built below.)

## Suggested by Claude, not asked for

- (Built 2026-10-16) Restart safely: `POST /api/restart` (or `app/restart.sh`) queues a restart that happens the first time nothing is working or waiting on her.

## Suggested by the harness scorer

- Connector down or restricted was the top failure cause this period (7 of 23; scorecard research/harness-scorecards/2026-10-16-baseline.md): a session whose MCP client fails at startup never retries and cannot see a reconnect, and Slack Connect channels refuse sends. Owner: hx-harness-architect (retry or a "reconnect tools" step); hx-context-engineer (draft to external channels, never send first).

## Built

- **2026-10-16, item 4: hard rules into the SDK.** `app/guard.ts`. Deny rules the SDK checks first (credential files, sudo, force push, gh pr merge) and a PreToolUse hook on every call: writes stay inside the session's folder, no pushes to main/master/development/release or a repo's configured base, no deleting remote branches, no rm outside the folder. Three blocks in a row pause the session with the reason on its plate. Every session has maxTurns 400 and maxBudgetUsd 30 (`~/.config/stillroom/guard.json` to change). Tools from a connector that failed at start are retried three times. Proved end to end on a probe server: push to main blocked, credentials blocked, session paused honestly.
  - Sandbox stays off: probed, the sandbox proxy breaks `gh` (TLS verify fails) while git and curl work. On again only when gh trusts the proxy.

- **2026-10-16, items 1, 2, 3, 5, 6, data hygiene, safe restarts.**
  - **Item 1, the ship checklist runs itself.** Checklist lines are `step | how | ask`. `how` is `review` (Claude review), `ask for review`, `cmd: <shell>` (run in the PR's worktree), or words for the session that made the PR; `ask` marks a step that waits for her go. "Ship it" on the PR row runs the open steps in order, stops at the first failure or ask step (the row then needs her: Go on / Stop the run), and a session can report a step `failed` through ship_step. A run that finds test files changed waits for her go first. The Ledger records each run. Tested with `app/smoke/ship.test.ts`.
  - **Item 5, hand-offs.** `app/handoff.ts`: on pause, close, or a cap, HANDOFF.md is written in the worktree (or under `~/.config/stillroom/handoffs/` for plain folders): goal, done, next step, open questions, watch out, and the file list from git. A new session on the same work is told to read it first.
  - **Item 6, honesty checks.** A PR whose files touch tests (when the task was not about tests) shows "Tests changed" on the row and the ship run waits for her go. The fresh-context reviewer is claude-pr-loop, which a `review` step runs. Style rule 13 says an honest pause is a good outcome.
  - **Items 2 and 3.** The working plate reads "Working on it · 3 min · usually 2 to 6 min" from that session's own past turns (or the folder's), and "longer than usual" past the range. "What is it doing" sits behind a toggle, off by default, never on hover.
  - **Data hygiene.** Ledger rows that say the same thing within a week count once (94 duplicates folded); a resumed session's earlier rows now carry its real id. Merged and closed PRs keep a record under `gone` in prs.json. Every session end writes a line to `~/.config/stillroom/sessions-log.jsonl`.
  - **Safe restarts.** `POST /api/restart` or `app/restart.sh` queues a restart; it happens the first time nothing is working or waiting on her, and the page says so while it waits. Uncaught errors are logged to `~/.config/stillroom/server.log` and no longer end the server.
- **2026-10-16, the fairy (design session 019).** `app/fairy.ts`, the wand in the top bar. Tidy after an hour away, undo per line; the table as an opt-in to-do list. Also built the same day: Vantage as a ticket source, Slack replies returning on their own, the five-day wait question, Jira title prefill, keys (018), launch at login (`app/install-login.sh`).
