# 007 — Pull requests

**Asked:** "I need a unified way of showing PRs. Right now we have PR 2244 and docs-pipeline #319. I also need to see all the actual PRs I have open. And a way to show PR / corresponding ticket status." Then: a status for "approved by Claude" (she runs every PR through claude-pr-loop), a button that launches that loop, a button that asks for review in the repo's Slack channel, and a nudge when nobody has reviewed after a day.

**Roundtable:** interaction designer (structure, words), agent-supervision architect (data, needs-you rules), flow and priority specialist (ordering, shelf, WIP).

## Decided

- **One name everywhere:** `repo #number`, like `docs-pipeline #319`. "PR 2244" retires. The titler, the ledger summary and the reply shape all say so.
- **A Pull requests screen** beside Ledger. Groups: Needs you, Waiting on others, Drafts (collapsed), Shelf (collapsed). One line per PR: title, then state in plain words with a mark, then the short name and any ticket keys. A plus opens the reasons and the actions.
- **States:** Changes asked for, Checks failing, Merge conflict, Ready to merge (these four need her); Approved by Claude, Claude is reviewing, Checks running, Waiting on review, Draft, Shelved (these never alert).
- **Shelf:** nothing moved in three weeks, or a draft with no push in two. It never counts anywhere and comes back only when someone else acts.
- **Sessions:** a PR that a Stillroom session is on shows "Open its session" and does not count as needs-you while that session works. Otherwise "Start a session on this" opens the new-session form filled in.
- **Claude review:** "Run Claude review" launches claude-pr-loop on the PR. While it runs the state reads "Claude is reviewing". The loop's own comment on GitHub is what "Approved by Claude" reads from.
- **Slack:** each repo has one channel, set once from the row. "Ask in #channel" posts a message she can edit first. After a day with no review, "Nudge the thread" appears. Nothing posts without her pressing it. Slack goes through the claude.ai connector in a one-shot session, so there is no token to keep.
- **Tickets:** keys (STORY, D, VDC, PROJ) come from the branch, title and body and show as plain tags. Status reads "needs Jira" until a ticket source is connected. Vantage may be that source; unknown yet.
- **Badge:** the sidebar shows one number on Pull requests: how many need her.

## Not yet

- PRs that need her joining Rounds as plates (the flow specialist's ask). After the screen has been lived in.
- Ticket status. Needs a source.
