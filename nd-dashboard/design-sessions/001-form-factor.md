# Session 001: Form factor

**Date**: 2026-09-22. **Decided by**: the user, after research and a recommendation.

## Decision
A local web app in TypeScript, installed as a standalone window through Safari or Chrome. Tauri wrapping is a later option. Not a terminal app.

## Why
The research was neutral on form factor. The decision rests on the user's own report, "everything in the terminal looks the same, is hard to distinguish, and lacks UI", and on two findings: autistic adults spend the most visual effort when regions are hard to tell apart (F31), and adults with ADHD show stronger visual crowding (F35). Identical monospace panes are exactly that.

## Rejected
- Terminal cockpit next to Claude Code: the thing she is trying to leave.
- Menubar indicator plus terminal: same problem, split in two.
- Native macOS app in Swift: a new language for her, less control over type and layout than CSS.

## Consequences
Every session and repo needs a visual identity she can tell apart at a glance. The data layer is a small local process; the interface is HTML and CSS she can iterate on by refreshing.
