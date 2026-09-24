# Session 006: Rounds as an accordion of plates

**Date**: 2026-09-23. **Decided by**: the user, from the interaction designer's and art director's proposals.

## What she said
"The view itself is a bit overwhelming ... maybe the ones I am not actively working on are minimized/de-emphasized ... There is a lot of text ... I would prefer if each item were more encapsulated than just having a line between them." And: "I would also like the app to not scroll, but the sections to scroll."

## Decision
- Each Rounds item is a plate. One item is open at a time, the oldest waiting; the rest are collapsed to a single line: title and state (mark plus word) on the plate's edge, plus her note if she left one. No preview, no repo, no controls.
- The open item shows her prompt (two lines), the reply above `---` with the callout in cream and at most four more lines before "Read the whole reply", then the answer (Send, or Allow and Deny, or the question's options), then a quiet row: Leave a note, Close session or Let it go, Open in focus. Time waiting and folder last, small. Cost is not shown.
- After she answers, the item folds in place and reads "Sent. Working on it." It does not move. The next waiting item opens with the cursor in its reply box.
- Terminal sessions use the same frame and say "This one runs in a terminal. Answer it there." with Resume in Terminal as a secondary button.
- Gold is spent once per screen: the open item's Send or Allow. No gold outlines in Rounds. The vine lives inside the open plate, between title and reply. Moon phases stay in the margin. No pills, no vine between items.
- Close session has no confirmation dialog. It closes and shows "Closed. It's under Older" with Undo, in Rounds and in Focus. Let it go on a terminal session still confirms, because it ends a process.
- The window does not scroll. The sidebar and the main pane scroll independently; the reply box stays pinned.

## Amendments
- Session 004: only the open item shows its prompt, reply, and reply box.
- Session 005 and D5: Rounds items are plates, not vine-divided documents.
- I3: back to gold once per screen, everywhere.

## Rejected
- A one-line preview on collapsed items: fewer words was the complaint.
- Several items open at once: one conversation in her head at a time.

## Amendment (same day)

The first build still read as chaotic: the sidebar and the pane listed the same items, the open plate sat second, and four buttons shared one weight. So:

- In Rounds the sidebar goes away. One list. A small "Back to sessions" link at the top right is the only way out.
- The open plate is always first. Closed plates stack under it, dimmer.
- Inside the open plate: title, one plain line saying what it needs, the reply, one way to answer. Note, close, let it go, open in focus, the prompt, the folder and the wait time sit behind "More".
- The margin moons are gone from Rounds. The moon strip in the top bar stays.
- The page heading and its sentence are gone. The first plate is the heading.
- The palette cooled: bluer ink, neutral ivory text, cool grey borders. Gold is the one warm thing, which is the point of it.
- Rounds centers in the pane; the pane's usual max width does not apply there.
- The square corner goes. Plates, cards and inputs take a 6px corner, buttons 4px. Sharp corners read as harsh and as a template, which is the opposite of the plate's job (D4 updated).
