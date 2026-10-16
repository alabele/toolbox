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

## Suggested by Claude, not asked for

- Restart safely: the server waits until no session is working before it restarts, or reloads without ending sessions. This is the real fix for the interruptions.
