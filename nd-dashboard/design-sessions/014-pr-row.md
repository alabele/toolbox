# 014 — The PR row in three groups

**Asked:** "I'd like to clean up this UI a bit." The row carried seven pieces in three type styles, gold on every HIGH, "In Progress" (Jira) beside "In progress" (the step).

**Roundtable:** interaction designer, art director.

## Decided

- **Three groups on one line:** what it is (mark and title), which one (`VDC-2318 #2259`, mono, dim), where it stands (one word in caps). Then the eye if watched, then the plus.
- **One slot, one word.** The step name by default. A needs-her word replaces it when something needs her. A ticket mismatch replaces it when the ticket and PR disagree. Never two words.
- **Steps renamed** so none sounds like a Jira status: Draft, Before review, Claude approved, Review asked, Reviewed, In QA, Ready to merge.
- **Priority leaves the line** and sorts the rows. Behind the plus: the step count, every ticket with its status, priority, the reasons, the checklist, the actions.
- **Gold once:** the slot word of the first PR that needs her on the screen. Rust only on Checks failing. The mark stays ink; the word carries the state.
- **A grid** with fixed columns so names and words line up. Middle dots gone. The plus is quiet until hover.
- Checks running and Claude is reviewing show their words but never count as needing her.
