# Stillroom queue

Work Lauren has asked for that is NOT to be built or deployed until she says go.
Nothing here runs on its own. No server restarts while sessions are in flight.

## Queued

1. **The ship checklist runs itself end to end, configured per repo.** (asked 2026-10-09)
   - Per repo, each checklist step gets a way to run: a Stillroom action (Claude review, Ask for review), an instruction to the session, or a command. Steps carry an order and a "stop here and ask me" flag.
   - A "Ship it" button on the PR row runs the steps in order in the session that made the PR (or a new one on its branch): each step ticks itself via ship_step when it finishes, skips itself with a reason when it does not apply, and the run stops at the first failure or at a step marked "ask me".
   - Progress shows on the checklist as it goes; the Ledger records the run; the ticket moves with the steps as already configured.
   - Setup lives in the repo's existing setup form, one step per line: `step | how to run it | ask`.

2. **Turn length on the working plate: "usually 2 to 6 min".** (asked 2026-10-16)
   - The server records how long each turn took per session. The plate's "Working on it · 3 min" line adds "usually 2 to 6 min" from that session's own past turns (fall back to all sessions in the same repo). Past the range, it says "longer than usual". No countdown, no bar, no colour.

3. **What it is doing right now, hidden by default.** (asked 2026-10-16)
   - The server keeps the session's current step from the stream (tool name and target: "running tests", "reading prs.ts", "editing app.js") and puts it on the view as `doing`.
   - On the working plate it sits behind a small toggle next to "Working on it" ("What is it doing"), off by default, and the choice is remembered in prefs. Never on hover. She said showing it by default is too much noise.

4. **Hard rules out of prose and into the SDK.** (from research/harnesses.md, 2026-10-16)
   - Deny rules and PreToolUse hooks for: push to main, any write outside the session's worktree, deleting remote branches, reading credential files. Deny rules hold even in bypass mode.
   - Turn on the SDK sandbox. Auto-approve reads and edits inside the worktree; a plate only for push, network, deletes outside the worktree, credentials.
   - `maxTurns` and `maxBudgetUsd` on every session. After 3 denials in a row, pause the session and show her a plate instead of retrying.
   - Owner: hx-oversight-designer sets the rules; hx-harness-architect wires them.

5. **Hand-off file per ticket, and evidence on the Ledger.** (from research/harnesses.md, 2026-10-16)
   - At pause and at ship, the session writes `HANDOFF.md` in its worktree: goal, done, next step, open questions, and a file list built from `git diff --stat`, not from memory. Resume starts a fresh session from that file plus the git log, never from the old transcript.
   - The Ledger records per session: turns, cost, plates shown, denials, commits, and whether the PR merged. The harness scorer needs these; today it can only see done/partly.
   - Owner: hx-context-engineer writes the file's shape; hx-harness-architect wires when it is read and written.

6. **Ship step: a fresh-context reviewer and a tests-untouched check.** (from research/harnesses.md, 2026-10-16)
   - ship_step runs a separate review session with a clean context before "Claude approved", and fails the step if the working session edited test files on a task that did not ask for it.
   - The style file tells sessions that pause_session with a reason is a good outcome when a task cannot be done.
   - Owner: hx-oversight-designer.

## Suggested by Claude, not asked for

- Restart safely: the server waits until no session is working before it restarts, or reloads without ending sessions. This is the real fix for the interruptions.

## Suggested by the harness scorer

- Connector down or restricted was the top failure cause this period (7 of 23; scorecard research/harness-scorecards/2026-10-16-baseline.md): a session whose MCP client fails at startup never retries and cannot see a reconnect, and Slack Connect channels refuse sends. Owner: hx-harness-architect (retry or a "reconnect tools" step); hx-context-engineer (draft to external channels, never send first).
