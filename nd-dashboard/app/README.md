# Stillroom

A local web app where Claude Code sessions run, so you can stop handling them in the terminal. It shows what needs you, lets you start sessions, answer permission prompts and questions, reply, and resume past sessions, and stays still otherwise.

## Run

```bash
cd ~/code/toolbox/nd-dashboard/app
bun run server.ts          # http://localhost:4747  (formerly Quiet)
./install-hooks.sh         # once; adds six async hooks to ~/.claude/settings.json
```

New Claude Code sessions pick up the hooks. Existing ones keep working through the poll alone.

## Install as its own window

- **Safari:** File → Add to Dock.
- **Chrome:** the install icon in the address bar, or ⋮ → Cast, save, and share → Install page as app.

Either gives Quiet a Dock icon and a window with no browser chrome.

## Layout

One sidebar holds every session, Stillroom's own and terminal ones alike, grouped Needs you, Working, Done, and an Older shelf (collapsed) for anything that has waited more than three days or is resting. Each entry is a jar: a fixed shape and a serif label for the repo, the state, and one line saying where it's at, or your own note if you parked it. Older entries have Let it go. Home is the new-session form and one Next card.

## What it shows

Opening screen when nothing needs you: "Nothing needs you." plus how many agents are working. Otherwise, the sessions that need you, then the ones working, then (hidden by default) the ones resting.

The first thing that needs you gets a focus card: repo, state pill, title, what the agent needs in its own words, and the three actions. The rest sit in compact rows: repo dot and name, state pill (icon plus word, never color alone), title, time in state, and hover-revealed actions.

Six states: needs permission, needs an answer, failed, finished, working, resting. The first four count as "needs you". Finished fades to resting after 60 minutes (`ND_FINISHED_FADES_MIN`), which is a guess to tune.

## Refresh policy

Pull only. It fetches on load, when you return to the window, and on R or the Refresh button. While you are looking, it never redraws. Once a minute it checks quietly and, if something changed, shows one static line inviting you to refresh.

## Keys

R refresh · S show or hide resting sessions · Esc close details

## Appearance

The default theme is the Stillroom cabinet: layered dark surfaces, parchment text, brass for what needs you, Fraunces for jar labels and headings, IBM Plex for everything else. No motion, no ornament. The gear menu also offers the six Momentum Desktop themes (Calm Waters default, Forest Floor, Soft Purple, Midnight Rose, Sunrise Warmth, High Contrast), each in dark, light, or system mode, plus compact or roomy density and a switch to show resting sessions. Tokens are ported verbatim from `transition-bridge/momentum-desktop/src/renderer/src/services/themes.ts`. Saved in the browser.

## Actions

The focus card and every row offer three user-initiated actions. Resume opens a terminal window running the resume command (`ND_TERMINAL` picks the app; default Terminal, iTerm supported). Show folder reveals the working directory in Finder. Copy puts the resume command on the clipboard.

## Running sessions here

Sessions started from Quiet run inside the server through the Claude Agent SDK, sharing your login, settings, agents, plugins, and MCP servers. The browser talks to them over a WebSocket at `/ws`.

- **Start:** folder plus prompt plus permission mode on the home screen. Enter starts it and opens the session view.
- **Session view:** your messages, Claude's replies, one collapsed line per tool call (expand for input and result), and a turn summary with cost.
- **Permission prompts** appear as a card with Allow, Allow for this session, and Deny. Typing a reply while a prompt is open denies it with your note.
- **Questions** from Claude render as option buttons, or answer in your own words.
- **Stop** interrupts the current turn. **End** closes the session; the conversation stays on disk.
- **Restarts are safe.** The server records the sessions it owns in `~/.config/stillroom/sessions.json` and reopens them on boot with their transcripts rebuilt from disk. A turn in progress at the moment of restart ends; everything else carries over.
- **Open here** on a background session whose process has exited resumes it inside Quiet. Sessions live in a terminal stay monitor-only, since two processes on one session would conflict.

## Data sources

- `claude agents --json --all` polled every 15 s (`ND_POLL_MS`).
- Lifecycle hooks posted to `/hook/<Event>`: SessionStart, UserPromptSubmit, Notification, Stop, StopFailure, SessionEnd.
- Transcripts in `~/.claude/projects/` for the session title and last assistant text only.

Nothing is written anywhere except the hook entries in settings.json.
