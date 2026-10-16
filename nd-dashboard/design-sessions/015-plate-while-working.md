# 015 — The plate while it works

**Asked:** "This UI is pretty confusing." A screenshot of an open plate right after Send: her new question, then "Sent. Working on it.", then the previous reply in bright text with a green DONE, faded mid-sentence, "Read the whole reply", a bordered High/Med/Low, and More.

**Roundtable:** interaction designer, art director, bad-day simulator. Unanimous.

## What was wrong

The plate showed two conversations at once. The old reply sat under the new question and read as its answer. "Working on it" and DONE said opposite things three lines apart, and the bright one won. The bad-day walk quit at the 40-second glance: "the screen gave me an old answer in bright text under my new question, so I stopped trusting it."

## Decided

- **The ask and the reply under it are always a pair.** While the session works, the last reply folds to one dim line above the ask, labeled "Before that", with its first sentence and "Read it". Closed by default.
- **The waiting moment** reads top to bottom in time order: label Working, title, So far, Before that, You asked, then where the answer will land: the working mark, "Working on it", and how long so far in mono. The reply box is hidden. "Sent." is gone; the quote already proves it.
- **When the reply lands** it fills that spot with no motion. The label flips to Your turn, the reply box comes back with the gold Send. That gold is the arrival signal.
- **The clamp stops at a block edge.** Whole bullets or none; no fade through a sentence. "Read the whole reply" is caps text like More, not a filled button.
- **Priority leaves the plate face.** It sits behind More as three plain words (High Med Low), no frame, as session 014 did for PR rows. It is a sorting decision, not a per-turn one.
- **"How long so far" is honest time**, not a countdown. Claude cannot know how long it has left. A "usually 2 to 6 min" range from that session's own past turns, and a line saying what it is doing right now, are queued; both need the server. The "doing now" line is hidden behind a toggle by default, never hover, because she called it noise.
- **Bug fixed:** a turn that ended without needing her stayed "Sent" forever. A sent plate now clears on any new reply or any end state.

## Amended

Session 006: "folds in place and reads Sent. Working on it." becomes the structure above. The in-body status word (DONE) stays, because she asked for the green check in session 006's reply shape; it only ever shows on the current reply now.
