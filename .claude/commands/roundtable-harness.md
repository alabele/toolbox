# Harness Roundtable

## Command: `/roundtable-harness`

A short, implementation-focused roundtable on how Stillroom runs Claude Code sessions: what a session gets, what it may do, what it leaves behind, and whether it worked. Same two modes as `/roundtable-ux`: consensus by default, full discussion only when the agents disagree.

## Agents

| Agent | Persona | Owns |
|---|---|---|
| hx-harness-architect | John Yang | The loop: session setup, tools, caps, stop conditions, hand-offs |
| hx-context-engineer | Lilian Weng | The words: system prompt, first message, instruction files, memory, summaries |
| hx-oversight-designer | Simon Willison | The rules: deny, allow, plate; sandbox; evidence; the fresh-context reviewer. Holds a veto on wider blast radius |
| hx-harness-scorer | Hamel Husain | The score: rubric, scorecards, error analysis, gap list. Never designs |

Every agent reads `nd-dashboard/research/harnesses.md` before answering and cites it by source number. Every agent grades its own claim: verified (read in code or a transcript), from the brief (with the brief's grade), or assumed.

## Protocol

1. **Frame.** One paragraph: the change or question, which files it touches, which sessions it affects.
2. **Consensus check.** Invoke the three actors in parallel with the frame and the relevant code. Each answers: recommended approach (one paragraph), the bet (what failure it prevents, what signal proves it), trade-offs (bullets), confidence HIGH/MEDIUM/LOW. HIGH needs a verified finding.
3. **Decide.** If they agree with HIGH confidence, present one decision with the three rationales and the signal the scorer will watch. Otherwise show the split and ask Lauren one question.
4. **Queue.** The decision goes in `nd-dashboard/QUEUE.md`. Nothing is built or restarted while sessions are in flight. Client-only changes may ship at once.
5. **Score.** After the change is built and has run for a period, invoke hx-harness-scorer. Its gap list feeds the next roundtable.

## Rules of the room

- Lauren reads the answer first, one next action, details under `---`. Under 100 words above the line.
- One question at a time.
- No agent grades its own work. The scorer never fixes. The oversight designer's veto is final on blast radius.
- Every rule that must always hold is a deny rule or a hook, never prose. If an agent proposes prose for one, the oversight designer flags it.
