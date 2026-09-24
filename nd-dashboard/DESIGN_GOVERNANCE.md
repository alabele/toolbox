# Stillroom Design Governance

The source of truth for how Stillroom looks and behaves. Rules are numbered. Each is tagged **[CI]** when `scripts/validate-design.js` checks it, or **[review]** when only eyes can. The machine-checkable half lives in `config/design-rules.json`; changing a [CI] rule means editing both files in the same commit.

The decisions behind these rules are recorded in `design-sessions/`. A rule changes in a design session, not in a fix.

## Why this exists

Three visual rewrites in one day all drifted toward the same generic defaults. Research findings (`research/REPORT.md`) set limits on motion, density, and color, but nothing turned them into rules a script could check or a critic could point at. This file does.

## Identity (I1 to I5)

### I1 — One committed palette, through tokens **[CI]**
Every color in the app is a token defined in a theme block. Component rules never carry a raw hex, rgb, or hsl value. The only literal exceptions are listed in `config/design-rules.json` (black and white shadow alphas, the star field).

### I2 — Two typefaces, with roles **[CI]**
Jost for titles, labels, pills, and buttons. IBM Plex Sans for reading text. IBM Plex Mono for code and paths only, never for hints, counts, or timestamps. No other family loads. Serif faces are out (design session 003). Titles are sentence case; labels, pills, and buttons are wide-tracked uppercase (session 005).

### I3 — Boldness once per screen **[review]**
Gold at full strength goes on the callout and on the one button that answers her (Send, Open, Allow). The Next card's edge is gold only when something needs her. Eyebrows, Start, secondary controls, and ornament are cream or dimmed gold. Two competing accents on one screen fail. In Rounds, gold goes only on the open item's Send or Allow (session 006).

### I4 — Ornament carries information or ritual **[review]**
Every ornament answers "what does this tell her" or "what ritual is this part of". The moon strip is the mark. The vine divides title from conversation. A corner mark says "act on this". Nothing decorates a text block.

### I5 — Her references outrank principles **[review]**
When a reference she supplied (the board, the cover, the celestial set) and a principle disagree, the reference wins.

## Stillness (S1 to S3)

### S1 — Nothing moves on its own **[CI]**
No animation, no transition, no keyframes. The global rule that sets both to none stays. Live updates change values in place without motion.

### S2 — The reading surface holds still **[review]**
While she reads a session or the home card, nothing redraws under her. Changes queue behind the stale marker or apply when she returns.

### S4 — The window holds still; sections scroll **[review]**
The app itself never scrolls. The sidebar and the main pane scroll independently, and the reply box stays pinned to the bottom of its pane.

### S3 — No auto-refresh that rewards checking **[review]**
The app pulls on open, on return, and on R. It never polls into view.

## States and marks (M1 to M4)

### M1 — Six states, fixed vocabulary **[CI]**
`needs-permission`, `needs-answer`, `failed`, `finished` (shown as "Your turn"), `working`, `idle` (shown as "Resting"). Adding one is a design session.

### M2 — Mark plus word, never color alone **[CI]**
Every state carries an icon and a word. Color reinforces; it never distinguishes on its own. Repo identity is a shape, not a hue.

### M3 — One line weight across the set **[review]**
Bespoke marks match Lucide's weight at their rendered size. A mixed-weight set fails.

### M4 — Red is reserved **[review]**
Rust marks only "failed". Nothing else in the app is red or orange. "Behind" and "overdue" do not exist as colors.

## Density and hierarchy (D1 to D4)

### D1 — Sidebar groups: at most four **[CI]**
Needs you, Your turn, Working, Older. Working and Older start collapsed.

### D2 — Sidebar entries lead with the title **[review]**
Title, then state, then a two-line preview or her note. No repo. No age on her own items.

### D3 — Replies are documents, not chat **[review]**
Her prompt is a labeled panel. Claude's reply renders as a document. A `---` line folds details. A bold opening line or a "Next action" paragraph becomes the callout. Tool steps are hidden behind a switch.

### D4 — Radii from a short list **[CI]**
Border radii come from the allowed set in the config. Plates, cards and inputs take the soft corner `var(--r)` (6px), controls 4px, pills round. Square plates read as harsh in use (session 006, amendment). Nothing goes past 6px except pills.

### D5 — The plate frame **[review]**
Anything she acts on sits in a plate: square corners, one thin outline, the label breaking the top edge, no fill, no rail, no corner mark. Gold outline means "needs you" on the Next card and prompt cards; all other plates are cream at low alpha. In Rounds, every item is a plate: collapsed ones a single line, the open one larger with a stronger cream outline and the vine inside it (session 006).

## Copy (C1 to C3)

### C1 — Labels state outcomes **[review]**
"Stop this turn", "Close session", "Leave a note", "Let it go". No metaphor that needs a tooltip.

### C2 — No generated-copy tells **[CI]**
No middle-dot meta strings, no em dashes in interface copy, no emoji, no "Great question" or "Sure," openers, no arrows appended to links.

### C3 — Neutral about her **[review]**
No counts of things undone as red badges, no streaks, no "you haven't". Stuck states are observations with an exit.

## Generic tells **[review, with CI where patterns allow]**
The critic checks every screenshot against the tells list in `config/design-rules.json`: cream-and-terracotta, near-black with one acid accent, broadsheet hairlines, one radius everywhere, all-caps eyebrows on every heading, middle-dot meta strings, monospace small labels, appended arrows. Any match is a failure with the element named.

## Process

1. A visual change is proposed by nd-art-director, nd-iconographer, or nd-interaction-designer, within their boundary.
2. The validator runs. A failure stops the change.
3. nd-design-critic screenshots and walks the [review] rules and the tells.
4. nd-bad-day-simulator walks the affected flow; nd-usability-scorer scores it when the flow changed.
5. Only then is a screenshot shown to the user. Her reaction is recorded in `design-sessions/` when it changes a commitment.
