# Slack in Stillroom

**Written 2026-10-15, after a roundtable and two days of measurement. This is the problem, not the design. Read it before proposing a screen.**

## What it is for

Lauren is the point person or SME in roughly a dozen Slack channels. She needs to be acceptably responsive, reliable and thorough across all of them, and she needs that without being pulled off her work, without carrying a background fear that she has forgotten something, and without the overwhelm that ends in her abandoning Slack for a week.

Her own frame: handle things one at a time, the way an attending physician works a shift. Triage, then act, then the next one.

## What the data says

Over 90 days, people asked Lauren something 119 times. She answered 38 of them — under a third.

When she answers, she is fast: median 12 minutes, 76% within the hour, and every answer she gave arrived inside 24 hours. There is no slow middle. She answers a message almost immediately or she never answers it.

The unanswered ones cluster in exactly the channels she is responsible for:

```
#proj-documentation-phase-2     9 asked   0 answered
#documentation                  7 asked   0 answered
#proj-documentation-phase-3     6 asked   0 answered
#cust-letso                     5 asked   0 answered
#letso-lively                  27 asked   8 answered
#video-client-sdk-general      22 asked  14 answered
```

**How the count was made, and what it misses.** For each message mentioning her, the script looked for any message she posted in that channel within the next 72 hours. That misses replies inside threads, emoji acknowledgements, answers she gave in a DM instead, and messages someone else picked up. The real coverage is higher than 32%. The shape holds regardless: fast when she sees it, invisible when she does not.

Volume, for sizing: 3.2 asks per working day, on 16 days out of 30. Fourteen days a month bring nothing at all. The worst day brought 12. Arrivals cluster between 9am and 4pm.

Emergencies, for sizing: across 90 days and eleven urgency patterns (outage, urgent, asap, emergency, escalation, sev1, p0, "is down", "prod is", "customer is", "right now"), two messages used that language and mentioned her. One of the two said "somewhat urgent."

## What that changes

Lauren asked for an emergency gatekeeper and an hourly nudge. Both belong in the design. Neither addresses the measured problem, because she answers in twelve minutes when she sees something — a faster alarm has nothing to fix.

She misses things because they never enter her field of view.

So the promise this feature makes is **nothing falls out**. Every ask gets a row. A row leaves only when she answered it, decided not to, or handed it to someone else. Delivery timing sits on top of that guarantee; it is not the guarantee.

This also resolves the tension in what she asked for. A complete register overwhelms her, and a filtered list drops things. The way out is to keep the register complete and show one item at a time, rather than to shorten the register.

## Triage, properly

Hospital triage sorts by acuity — what happens to this person if nobody touches them for four hours — and not by arrival order or by who is loudest. So the question to ask of a Slack item is not "is this urgent" but "what breaks if she reaches it tomorrow."

Three dispositions, from her own words:

| | What it means | How it reaches her |
|---|---|---|
| **Emergency** | Someone is blocked right now and it is hers | Immediately, bypassing everything |
| **Needs her** | She owes an answer, and the day is soon enough | At the next nudge |
| **Nothing to do** | Read it or don't | Only when she opens the room |

The worst outcome is not a wrong sort. It is the person who left the waiting room unseen. Design for that first.

## Settled

**The hour is a floor, not a trigger.** A nudge fires when something is actually waiting, and never more than once an hour. Empty hours stay silent. Nine working hours against 3.2 items a day means a fixed hourly nudge would mostly find nothing, and a nudge that is usually empty is one she learns to ignore before the day it matters.

**No indicators of any kind.** No desktop notification, no bouncing dock icon, no unread badge, no count of things undone on any default screen. This holds for every kind of Slack item, including the ones she is waiting on.

**The emergency path bypasses the nudge, and nothing else does.**

**The harness works ahead of her, up to the point where it would change something outside Stillroom.** Reading a repository, reading Jira, reading GitHub, running a Claude Code session and writing a draft all happen before she arrives, because each one is reversible and costs her nothing. Filing a ticket, posting a message and replying to the asker wait for her, because other people see those and she cannot take them back.

**The gatekeeper keys on facts, not on a model's sense of urgency.** A named person, an explicit word, a channel like `#video-client-alerts`. A model asked "is this urgent?" answers yes too often; at one real emergency every 45 days, even a 5% false positive rate fires the emergency path about weekly, and she stops trusting it within a month. Let the model veto a match, never promote one.

**Nothing moves on screen while she reads.** The poll runs every two minutes; arrivals queue behind the stale marker that already exists, and appear when she asks.

**No Slack visual idiom.** No avatars, no initial bubbles, no unread bold, no reaction chips, no presence dots, no channel pills. The art director's alternative is a transcript plate: one plate per conversation, speaker names in a fixed left column, each message a single line, so repeats from one person stack visibly. It reads as a playscript.

**How an item arrived does not predict whether it needs her.** Of the 13 items live during the mockup, two that mentioned her wanted nothing ("Stay classy @Lauren", "all clear!") and two that never mentioned her were hers (a PR posted for VDC review, a VDC-2351 ticket). DM, mention and channel are Slack's categories, so they carry no weight in sorting and no name in the interface.

## Overturned

The brief told all five agents that messages in the 23 channels she reads in full are hers to read and not to answer. The brief was wrong. Those are the channels where she is the SME, so a question there is hers whether or not anyone tagged her — and the measured zeros sit in exactly those channels.

All five agents vetoed channel messages as rows on that premise. The veto does not survive the correction. Whether an item needs her is a judgement about the message, which makes the assessor load-bearing rather than a convenience.

## An ask is a workflow, not a reply

Lauren's description of what a Slack ask actually costs: minimize Slack, open eight applications, check something, file a ticket, message someone else, then reply to the person who asked. The reply is the last and smallest step.

Her own messages over 90 days show which systems those eight applications really are. Of 500 messages she sent:

| Shape | Count | Share |
|---|---|---|
| Names a Jira ticket | 40 | 8% |
| Posts a pull request link | 31 | 6% |
| Posts an afk notice | 30 | 6% |
| Asks a named person to do something | 22 | 4% |
| Names a QA environment | 12 | 2% |
| Re-requests review | 9 | 2% |

Roughly one message in four touches Jira or GitHub.

The application that does not appear in that table is the one that does most of the work. For almost every Slack ask, Lauren opens Claude Code first, answers the question there, and only then files the ticket, opens the pull request and replies. Jira and GitHub are where the answer gets recorded; Claude Code is where it gets found.

Stillroom runs Claude Code sessions already. That is the whole of `app/sessions.ts`, and sessions are the thing the app was built to supervise. So the three applications a Slack ask really needs are Claude Code, Jira and GitHub, and Stillroom holds all three.

Three days of her messages show the shapes those moves take:

- **Route a blocker to a person.** "Hey Jeremiah, VIDEO-640 is blocking the VDC release. Charles is unable to test at the moment. Is this something you could help with today?" She found the blocker, named the ticket, named the person, and left them room to say no.
- **Ask for verification with the evidence attached.** "Can I ask you to re-try the repro on VDC-2339 when you get a sec? We can't get it to happen anymore. I ran the two checklist tests against qa8 — still on development @ eb5e4bb, the same build you tested." Behind that one message: read the ticket, run two named checklist tests, check the environment's build, compare it to the tester's build.
- **Report work back and re-request review.** "Ilya's feedback is addressed and pushed — re-requested review," followed by what changed and which checklist items it covers.
- **Decide, and defer the rest.** "Scratch the dump hunt — not holding the merge for it. If the burst comes from somewhere else, separate ticket."
- **Broadcast review asks.** "@here some priority PRs," with links, into `#video-client-developers`.

None of these are new capabilities. Stillroom already reads GitHub in `app/prs.ts` and Jira in `app/jira.ts`. The `jira-vdc` skill already files a VDC ticket that passes the project's hidden validators, and already handles assign-to-me and move-to-In-Progress. The `lauren-voice` skill already writes in her register. A session can already stop and ask her something through the `pending` mechanism in `app/sessions.ts`, which is exactly the verify-and-approve step she wants.

What is missing is a trigger. None of it can be reached from a Slack message.

So the third piece of this feature is an action vocabulary on a row — open the ticket, file a ticket, ask a named person, reply to the asker — where a harness proposes the whole chain and she approves or edits it. The draft is the unit of work, not the send.

### A worked example

At 10:35 on 15 October, Margot asked in `#cust-dark-media-redquarter`: "are you able to provide this? — they need documentation of the event that should be used when a broadcaster stream disconnects because of a network drop."

What Lauren then did, over 65 minutes: asked Margot where to post it, found the answer, posted it in the partner's channel, found that it was not in the documentation, and filed VDC-2360 to add a page.

The finding step needed nothing from her. `websocketReconnect` is declared in `core/types/api/call.d.ts:112` and emitted in `core/lib-esm/internal/call.js:162`, and her own ticket title records that the event is dead. A Claude Code session reading the repository reaches that in minutes, and it could have started at 10:36.

This is the shape to build for: by the time she opens the row, the research is done, the gap is identified, the ticket is drafted and the reply is written. She reads four things and approves them.

### The intake

A row opens into one page, which Lauren calls the intake. It holds what was asked and by whom, what the harness found with links back to each source, and what it proposes to do: a drafted ticket, a drafted reply, a message to a third person. She reads the page once, edits any part of it, and approves each proposal separately.

This is one review and several approvals, not a sequence of gates. The resident works the patient up and presents; the attending reads the workup, changes what is wrong, and signs.

**The measure is steps, not minutes.** The intake earns its place by turning four steps into one, and it earns it even when the wall-clock time is the same. For someone with ADHD, the cost of a task sits in starting each step and in holding the list of remaining steps in mind, so a four-step list is not four times one step — it is the thing that does not get started. Collapsing the list is the whole point. Speed is a side effect.

So it shows its sources — the file and line, the ticket, the pull request — because she spot-checks a claim she can trace and has to re-derive one she cannot. A wrong intake she can see through costs a glance. A wrong intake she has to verify from scratch costs more than if the app had done nothing.

## Open

- **What "acceptably responsive" means per relationship.** A partner channel and an internal one do not carry the same expectation. Lauren sets these; nobody can derive them from the data.
- **What happens to an ask she never answers.** Does a colleague pick it up, does someone ask again, or does the work stall? This decides how hard a row should push.
- **Whether "needs her" is one category or two.** Answering a question and making a decision cost different things on a bad day.

- **Where the register lives.** Inside the project rooms, on its own screen, or split by disposition. Four layouts are drawn in `/Users/lauren.abele/code/slack-triage/where.html`; she rejected the first, and leans toward the one split by what each item wants.
- **What a nudge looks like when she is mid-session.** The attention researcher allows a line at a boundary she already crosses and vetoes one that fires because time passed. Her hourly floor is a clock, so the two need reconciling.

## Where the code stands

`app/slackIn.ts` reads Slack with her own user token from the keychain (service `stillroom-slack`), with no Claude in the data path. One `search.messages` call covers every mention; `conversations.history` covers DMs, group DMs and her Tier 1 channels, bounded at 25 conversations per tick. It is wired into `app/server.ts` and serves `/api/slack/in`.

The running server has not picked it up — restart it.

Her channel triage lives in `~/.config/stillroom/slack-tiers.json`: 23 channels read in full, 28 muted, 14 muted and parked.

Not built: the assessor, the gatekeeper, the nudge, and any interface.
