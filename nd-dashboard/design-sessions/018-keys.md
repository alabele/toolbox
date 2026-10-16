# 018 — Keys

**Asked:** keyboard shortcuts, with launch at login.

**Roundtable:** desktop UX expert (macOS conventions), with the interaction designer's names.

## Decided

- **Bare keys, only when she is not typing.** N new session in this room, G go to the next room that needs her, P pull requests, L ledger, F open this session in Focus, Esc back to the room (and first, out of a text box), R refresh, ? the sheet. ⌘↓ and ⌘↑ between plates stay, and now stay out of text boxes.
- **No new ⌘ keys.** Chrome owns ⌘N, ⌘W, ⌘T in an app window; ⌘R stays reload as the way out; ⌘1 to 9 would land on a different room each day because rooms sort by priority.
- **Pause and Close stay unbound.** A bare key fired by mistake on a bad day costs more than a click.
- **One static sheet** behind ? and a row in the settings menu. Keys never show on hover alone.
- **Launch at login** is a launchd agent (`app/install-login.sh`) with KeepAlive, so the server also comes back if it dies. A self-restart under launchd just exits.
