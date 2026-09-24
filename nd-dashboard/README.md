# nd-dashboard

**Status: DRAFT.** A bench of expert agents for designing and building a personal, nervous-system-regulating work dashboard for an engineer who works best with low cognitive load: one thing at a time, little text, no surprises. The research draws on the ADHD and autism literature. The dashboard's job is to reduce overwhelm from five sources:

1. Many concurrent Claude Code sessions
2. Many projects across many git repositories
3. Priority setting and task initiation
4. Ticket management (Jira, VDC project)
5. Communications triage (Slack, GitHub PRs, email)

The research report is at [research/REPORT.md](research/REPORT.md). Each agent ends with an Evidence Notes section tying its principles to the report's graded findings. The report and its interactive page are generated from `research/build/data.js` by `research/build/build.js`. Four agents rest on frameworks the research did not verify (Barkley's executive-function model, calm technology, situation awareness, and kanban work-in-progress limits). Run `nd-evidence-auditor` over those before treating their principles as requirements.

## The bench

| Agent | Persona | Role | Owns |
|---|---|---|---|
| [nd-executive-function-coach](agents/nd-executive-function-coach.md) | Russell Barkley | advisor | Task initiation, prioritization logic, externalized working memory, "point of performance" design |
| [nd-sensory-regulation-specialist](agents/nd-sensory-regulation-specialist.md) | Winnie Dunn | advisor | Sensory load, arousal regulation, the "regulating" claims and their evidence grade |
| [nd-lived-experience-advocate](agents/nd-lived-experience-advocate.md) | Fergus Murray | critic | Monotropism, autistic inertia, 2e reality check; vetoes patterns that pathologize or infantilize |
| [nd-attention-interruption-researcher](agents/nd-attention-interruption-researcher.md) | Gloria Mark | advisor | Notification policy, interruption timing, batching, task-switch cost budget |
| [nd-flow-and-priority-specialist](agents/nd-flow-and-priority-specialist.md) | Dominica DeGrandis | actor | WIP limits, kanban flow, the single priority model across Jira, GitHub, and sessions |
| [nd-agent-supervision-architect](agents/nd-agent-supervision-architect.md) | Mica Endsley | actor | Multi-session situation awareness, the "needs me now" queue, alerting, data layer over Claude Code / gh / Jira / Slack |
| [nd-calm-technology-designer](agents/nd-calm-technology-designer.md) | Amber Case | actor | Visual hierarchy, color, motion, typography, progressive disclosure, focus modes, form factor |
| [nd-cognitive-accessibility-engineer](agents/nd-cognitive-accessibility-engineer.md) | Lisa Seeman | actor | WCAG 2.2 and W3C COGA conformance, thresholds, keyboard and reduced-motion systems |
| [nd-evidence-auditor](agents/nd-evidence-auditor.md) | Ben Goldacre | critic | Grades every research claim; flags pop-psychology; keeps the bench honest |
| [nd-bad-day-simulator](agents/nd-bad-day-simulator.md) | none (simulated user) | critic | Walks flows as the user on a low-executive-function day; reports where they stall |
| [nd-desktop-ux-expert](../.claude/agents/nd-desktop-ux-expert.md) | Bruce Tognazzini | advisor | macOS conventions, window strategy, keyboard (ported from transition-bridge) |
| [nd-art-director](agents/nd-art-director.md) | Frank Chimero | actor | Visual identity and whether it feels like hers; vetoes template defaults |
| [nd-iconographer](agents/nd-iconographer.md) | Susan Kare | actor | The bespoke celestial icon set, one weight, readable at 13px, always with a word |
| [nd-interaction-designer](agents/nd-interaction-designer.md) | Alan Cooper | actor | Flows, screens, states, controls, and their names, from her goals |
| [nd-design-critic](agents/nd-design-critic.md) | Michael Bierut | critic | Runs DESIGN_GOVERNANCE.md and the generic-tells list against every screenshot |
| [nd-usability-scorer](agents/nd-usability-scorer.md) | Ginny Redish | critic | Persona-by-goal scorecard, 0 to 4, ported from the docs project |

## Design governance

`DESIGN_GOVERNANCE.md` holds the numbered rules. `config/design-rules.json` is its machine-checkable half; `bun scripts/validate-design.js` checks it. `config/usability-rubric.json` and `config/usability-goals.json` drive the scorer. Decisions live in `design-sessions/`. Process: proposal by an actor, validator, critic on a screenshot, simulator walk, scorer when a flow changed, then the user.

## Boundary map

- **Thresholds vs. taste.** The accessibility engineer sets the bar (contrast, motion, target size, timing). The calm-technology designer chooses how to clear it.
- **Regulation claims vs. design choices.** The sensory specialist and the evidence auditor decide what the research supports. The designer decides what to build. Neither builds nor grades the other's work.
- **Priority model vs. its display.** The flow specialist defines the single priority model and WIP policy. The supervision architect surfaces it; the designer renders it.
- **Interruption policy vs. alert design.** The attention researcher sets when and how often the dashboard may interrupt. The supervision architect decides what is alert-worthy and implements it.
- **Coach vs. advocate.** The executive-function coach proposes scaffolds. The lived-experience advocate can veto any scaffold that reads as surveillance, shame, or gamified pressure.
- **Simulator vs. everyone.** The bad-day simulator never proposes fixes. It reports stalls and hands them to the owning agent.

## Suggested pipeline

1. **Ground.** Evidence auditor grades the research report. Sensory specialist and executive-function coach extract design implications from the surviving claims.
2. **Principle.** Designer, accessibility engineer, and attention researcher write a one-page design-principles doc. Advocate reviews it.
3. **Model.** Flow specialist defines the priority model. Supervision architect defines the data layer and the "needs me now" queue.
4. **Build.** Architect, designer, and accessibility engineer implement. Form factor decided at this step, informed by the report.
5. **Break.** Bad-day simulator walks every flow. Advocate and auditor review. Loop to step 3 or 4.

## Install

Agents live in `agents/`. To make them available in every Claude Code session:

```bash
for f in ~/code/toolbox/nd-dashboard/agents/*.md; do ln -sf "$f" ~/.claude/agents/; done
```

To scope them to one project instead, copy them into that project's `.claude/agents/`.

## Decisions

- **2026-09-22, form factor:** a local web app in TypeScript, installed as a standalone window. Not a terminal app; the user reports that terminal sessions all look the same, and the distinguishability findings (F31, F35) agree. A small local process owns the data layer. Tauri wrapping is a later option.

## Environment facts the agents assume

- `claude agents --json` lists live sessions with state and cwd; lifecycle hooks (`Notification`, `Stop`, `SessionEnd`, http type) push events. Transcripts live at `~/.claude/projects/<path-slug>/<session-uuid>.jsonl`, one directory per working directory, roughly 70 today, many of them `claude-pr-loop` worktrees.
- tmux is installed but not in use.
- Available runtimes: node 24, bun, python3, cargo. `gh` and `jq` are present.
- Jira is reached through the Atlassian MCP (project VDC). Slack through the Slack MCP.
