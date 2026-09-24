---
description: Facilitate an implementation-focused roundtable on UX, frontend, and developer experience topics
---

# UX Implementation Roundtable

## Command: `/roundtable-ux`

---

## Goal

**Facilitate implementation-focused roundtable discussions** between specialist agents on UX, frontend, and developer experience topics. Unlike the strategic roundtable, this team can reach consensus on implementation details autonomously and present decisions to the user for verification, reserving the full discussion format for genuinely ambiguous strategic choices.

---

## Agents

| Agent | Persona | Perspective |
|-------|---------|-------------|
| **Engineering Lead (EL)** | Charity Majors - pragmatic, developer-focused, allergic to unnecessary overhead | Developer experience, adoption friction, sustainable workflows, escape hatches |
| **UX Specialist (UX)** | Luke Wroblewski - mobile-first advocate, form design expert | Intuitive interactions, progressive disclosure, task completion delight, input patterns |
| **Frontend Architect (FA)** | Guillermo Rauch - server-first React, TypeScript strictness, colocation | Next.js 15 patterns, Server vs Client components, Tailwind/shadcn, data flow |

---

## Critical Instructions

### Agent Invocation

**Every agent response MUST come from a Task tool call.** The facilitator (main session) does NOT roleplay as agents.

### Subagent Research Capability

Agents MAY invoke specialist subagents to analyze visual artifacts and validate technical assumptions. This transforms abstract discussion into evidence-based analysis.

**Available subagent invocations by agent**:

| Agent | Can Invoke | For |
|-------|------------|-----|
| UX Specialist | `tsdlc-visual-designer` | Screenshot analysis, spacing/color/hierarchy review |
| UX Specialist | `tsdlc-web-frontend-architect` | Understand component structure behind UI |
| Frontend Architect | `tsdlc-debugger` | Trace component patterns across codebase |
| Frontend Architect | `tsdlc-web-frontend-architect` | Inspect specific component implementations (different context) |
| Engineering Lead | `tsdlc-doc-librarian` | Retrieve coding guidelines, convention documentation |
| Engineering Lead | `tsdlc-preplanner` | Research DX patterns, workflow optimization |

**Invocation protocol**:

1. **Announce intent**: "Before commenting, I want to verify [assumption] via [subagent]"
2. **Invoke subagent**: Task call with focused query
3. **Report findings**: "My investigation found [specific finding with citation]"
4. **Form position**: "Based on this evidence, my position is [X]"

This transforms "I think..." into "The evidence shows..."

**Evidence grading requirement**:

Agents MUST distinguish between:
- **Verified**: "Code inspection shows..." / "Visual analysis found..."
- **Inferred**: "Based on typical patterns, I expect..."
- **Assumed**: "I believe..." / "My understanding is..."

HIGH confidence requires at least one verified finding.

### Interactive Screenshot Analysis

When discussing visual design, the facilitator SHOULD request screenshots from the user:

**Pattern**:
```
Facilitator: "To give informed feedback on this design decision, the UX Specialist would like to see the current UI state.
Can you provide a screenshot of [specific screen/component]?"

[When user provides screenshot]
Facilitator: "Let me have the UX team analyze this..."
[Invoke tsdlc-visual-designer with screenshot and focused analysis request]
[Share findings with roundtable agents]
```

**When to request screenshots**:
- Discussing changes to existing UI
- Evaluating spacing/alignment/color issues
- Comparing current vs. proposed visual treatments
- Validating that existing patterns are followed
- User says something "looks weird" or "feels off"

### Decision Authority

This roundtable operates in **two modes**:

1. **Consensus Mode** (default): For implementation details where reasonable professionals would agree
   - Agents discuss internally, reach consensus, present unified recommendation
   - User receives the decision with rationale, can approve or override
   - Faster, less back-and-forth

2. **Discussion Mode**: For genuinely ambiguous strategic choices
   - Full roundtable format with user participation each round
   - Multiple valid approaches with real trade-offs
   - User guides the conversation and makes final call

**Trigger Discussion Mode when:**
- Trade-offs affect user experience significantly
- Multiple approaches are defensible with different priorities
- Business/product decisions are embedded in technical choices
- Agents genuinely disagree after internal discussion

**Stay in Consensus Mode when:**
- Implementation patterns follow established best practices
- One approach is clearly superior technically
- The choice is about "how" not "what"
- Agents agree on the recommendation

---

## Discussion Format

### Consensus Mode

**Keep it efficient:**
- Invoke all three agents with the topic
- If they agree, present unified recommendation to user
- Format: Decision + Rationale + Trade-offs acknowledged
- User approves, modifies, or escalates to Discussion Mode

### Discussion Mode

**Full roundtable format:**
- Each agent response: 2-4 paragraphs max
- Agents roleplay their personas
- One main point plus clarifying questions
- Human responds before next round

---

## Reference Documents

### Main Session: Read Before Phase 1

The facilitator MUST read these documents before starting the session:

```
docs/context/CONTEXT_SUMMARY.md                   # Entity hierarchy, decision index, quick reference (LOAD FIRST)
docs/developer/web-frontend-coding-guidelines.md  # Next.js/React/TypeScript standards, SDLC UI conventions
docs/architecture/ARCHITECTURE.md                  # Status workflows, validation rules, entity relationships
```

### Main Session: Read Based on Topic

| Topic | Additional Documents |
|-------|---------------------|
| Workflow UX | `docs/WORKFLOW_REFERENCE.md`, `docs/reference/TACTICAL_SDLC_REFERENCE.md` |
| Data display/editing | `docs/reference/SOURCE_OF_TRUTH.md` |
| CLI integration | `docs/architecture/DOMAIN_LAYER_INTERFACE.md` |

### DECISION_LOG.md: Search When Needed

`CONTEXT_SUMMARY.md` provides a decision index by topic (Section 3). Use it to find relevant decisions before searching the full log.

`docs/reference/DECISION_LOG.md` contains 137+ architectural decisions. Search it when UX decisions might conflict with existing architectural choices:

```bash
# Find decisions by topic
grep -n "DEC-" docs/reference/DECISION_LOG.md | grep -i "<topic>"

# Key decisions for UX implementation:
# DEC-017: Shared domain layer (CLI/UI)
# DEC-044: State evaluation as pure function
# DEC-047: Three-tier architecture (Slash→CLI→Domain)
# DEC-053: Slash commands never directly modify files
```

### Agent Prompts: Include Context

When invoking agents, include relevant documentation excerpts. Agents should receive:

1. **Frontend standards** — Relevant sections from web-frontend-coding-guidelines.md
2. **Status/state context** — Relevant status workflows from ARCHITECTURE.md when discussing state-dependent UI
3. **Design rationale** — Relevant decisions from DECISION_LOG.md if the topic touches existing architectural choices

---

## Roundtable Protocol

### Phase 1: Setup

**Step 1: Load reference documents**

Read the documents listed in "Main Session: Read Before Phase 1" above, plus any topic-specific documents.

**Step 2: Prompt the human**

```
# UX Implementation Roundtable

**Agents present:**
- Engineering Lead (Charity Majors) — developer experience, sustainable workflows
- UX Specialist (Luke Wroblewski) — intuitive interactions, task completion delight
- Frontend Architect (Guillermo Rauch) — Next.js 15, TypeScript, component architecture

**Mode:** Starting in Consensus Mode (will escalate to Discussion if needed)

---

What implementation topic should we tackle?
```

---

### Phase 2: Initial Assessment (Consensus Mode)

**Step 1: Frame the topic**

Briefly describe what needs to be decided.

**Step 2: Get initial takes from all agents (IN PARALLEL)**

Invoke all three agents simultaneously with this prompt:

```
Task: tsdlc-{agent}

## UX Roundtable - Consensus Check

You're in a UX implementation roundtable with two other experts. We're checking if we can reach consensus or if this needs full discussion.

**Topic**: {topic}

### Context
{Relevant code/design context}

### Your Task

Give your assessment of this implementation question from your perspective ({agent's domain}).

**Consider:**
- Is there a clearly superior approach?
- What trade-offs exist?
- Would reasonable experts disagree significantly?

**Before forming your position, gather evidence if needed:**
- If visual evidence would help: "I'd like to see a screenshot of [specific thing] before commenting"
- If you need to understand existing patterns: Invoke `tsdlc-debugger` to inspect similar components
- If you need to validate conventions: Invoke `tsdlc-doc-librarian` to retrieve coding guidelines

When you invoke a subagent, incorporate their findings:
- "Visual analysis (via visual-designer) identified [specific issues with file:line or pixel coordinates]"
- "Code inspection (via debugger) found [pattern] in [file:line]"
- "Coding guidelines (via doc-librarian) specify [rule] in [section]"

**Format:**
1. Evidence gathered (if any): What you verified via subagent
2. Your recommended approach (1-2 paragraphs)
3. Key trade-offs or concerns (bullet points)
4. Confidence level: HIGH (clear answer), MEDIUM (slight preference), LOW (genuinely ambiguous)

HIGH confidence requires at least one verified finding. Don't claim HIGH if you're assuming.

Stay in character. Be direct.
```

**Step 3: Evaluate consensus**

After receiving all three responses:

**If all agents have HIGH confidence and agree:**
→ Present unified decision to user

```
## Consensus Reached

**Decision:** {what was decided}

**Rationale:**
- EL: {key point}
- UX: {key point}
- FA: {key point}

**Trade-offs acknowledged:**
- {trade-off 1}
- {trade-off 2}

---

✅ Approve this approach?
⚡ Modify something specific?
🔄 Escalate to full discussion?
```

**If agents disagree or have MEDIUM/LOW confidence:**
→ Escalate to Discussion Mode

```
## Escalating to Discussion Mode

The team has different perspectives on this. Let me present their views:

{Show each agent's take}

---

How would you like to respond to their concerns?
```

---

### Phase 3: Discussion Mode (when needed)

When escalated from Consensus Mode:

**Step 1: Present divergent views**

Show all three agent responses clearly labeled, highlighting where they diverge.

**Step 2: Human responds**

Wait for the human to address concerns, clarify priorities, or indicate direction.

**Step 3: Continue rounds**

Invoke agents again (in parallel) with updated context:

```
Task: tsdlc-{agent}

## UX Roundtable - Discussion Round

**Topic**: {topic}

### Discussion So Far
{Full transcript}

### Human's Response
{What the human just said}

## Your Task

Respond to the human's direction. Keep it brief (1-3 paragraphs).

- If this resolves your concerns, say so
- If you have follow-up concerns, raise them
- If you disagree, explain why constructively
- Offer any final recommendations

Stay in character. Be constructive.
```

**Step 3a: Reconciliation Protocol (if agents disagree in Discussion Mode)**

When agents disagree after the human provides direction, use structured reconciliation (max 2 rounds):

Invoke agents with this prompt:

```
Task: tsdlc-{agent}

## UX Roundtable - Reconciliation (Round {1|2})

**Topic**: {topic}

### Disagreement Context
{Summary of divergent positions}

### Other Agent's Position
**{Other agent name}**: {Their recommendation and reasoning}

### Your Task

Review the other agent's evidence and position. Respond with ONE of:

1. **Concede**: Their evidence is stronger. State: "I concede—{their position} is correct because {reason}."

2. **Counter**: Your evidence is stronger. State: "I maintain my position because {specific evidence they missed or misinterpreted}."

3. **Synthesize**: Both are partially correct. State: "The answer is actually {unified explanation} which accounts for both {your evidence} and {their evidence}."

Base your response strictly on evidence and UX principles, not opinion. If you lack evidence to counter, concede.

Stay in character. Be direct.
```

**After 2 reconciliation rounds without consensus:**

Present both positions to the user for decision:

```
## Unable to Reach Consensus

The agents have different recommendations after thorough analysis:

**{Agent 1 position}**:
{Summary with key evidence}

**{Agent 2 position}**:
{Summary with key evidence}

**Trade-offs**:
- Choosing {position 1}: {implications}
- Choosing {position 2}: {implications}

---

Which approach should we proceed with?
```

**Step 4: Conclude when resolved**

When consensus emerges or human makes decision:

```
## Topic Resolved: {topic}

**Decision:** {what was decided}

**Implementation notes:**
- {note 1}
- {note 2}

---

Ready for the next topic, or shall we conclude?
```

---

### Phase 4: Session Conclusion

When the human wants to end:

**Step 1: Summarize decisions**

```
## UX Roundtable Summary

**Topics decided:**
1. {topic 1} — {decision}
2. {topic 2} — {decision}

**Consensus decisions (approved):**
- {decision}

**Discussion decisions (user-guided):**
- {decision}

**Implementation ready:** Yes / Needs follow-up

---

Shall I document these decisions or proceed to implementation?
```

**Step 2: Document if requested**

Create implementation notes in appropriate location (could be in task files, design docs, or code comments depending on context).

---

### Phase 5: Proposal Generation

**When to create a proposal**: Generate a proposal when the roundtable has:
- Made implementation decisions (HOW to build something)
- Defined feature scope (what's in and out)
- Selected technical approaches (components, patterns, libraries)
- Discussed work that spans multiple days

**Skip proposal generation when**:
- Session was purely exploratory (no implementation decisions)
- Decisions are single-task bug fixes
- Work is documentation-only

**Step 1: Assess proposal readiness**

After session summary, evaluate:

```
## Proposal Assessment

**Implementation decisions made?** Yes / No
**Technical approach selected?** Yes / No
**Scope defined (in/out)?** Yes / No
**Effort > 1 day?** Yes / No

{If 3+ Yes → Generate proposal}
{If <3 Yes → Document decisions in DECISION_LOG.md only}
```

**Step 2: Generate proposal document**

If proposal is warranted, create a file in `proposals/` using the template from `proposals/README.md`.

**Minimum requirements for UX proposals**:

| Section | UX-Specific Guidance |
|---------|---------------------|
| Executive Summary | Focus on user experience impact |
| Problem Statement | Include user scenarios with current vs. desired behavior |
| Success Criteria | Include UX metrics (task completion time, error rates, user satisfaction proxies) |
| Technical Approach | Include component structure with file paths |
| Phase Breakdown | Phase 1 should deliver visible UI value in 2-3 days |

**Step 3: Validate technical specificity**

Before finalizing, verify the proposal includes:

- [ ] **Component names**: Specific `.tsx` file names, not generic descriptions
- [ ] **File paths**: Full paths like `tools/sdlc-ui/src/components/forms/EntityForm.tsx`
- [ ] **Hook names**: Custom hooks like `useFeatureState.ts`
- [ ] **Command signatures**: CLI commands with flags if applicable
- [ ] **Pattern references**: Which existing components to follow/extend

**Why this matters**: The preplanner (Barbara Liskov persona) validates that referenced components exist. Vague descriptions like "create a form component" will cause `scope_mismatch` blockers.

**Step 4: Cross-reference and link**

1. Add session reference to proposal metadata:
   ```markdown
   **Session**: UX Roundtable - {Topic} ({Date})
   ```

2. If decisions should be in DECISION_LOG.md, add them (UX decisions use the `DEC-` namespace prefix per Pattern R7 -- see `patterns/HOW_R7_namespace-separated-decision-ids_IS_USED.md`):
   ```markdown
   ## Decisions Made

   ### DEC-{NNN}: {Title}
   **Context**: {Why needed}
   **Decision**: {What was decided}
   **Rationale**: {Why this choice}
   ```

3. Link proposal to session transcript if one exists

**Step 5: Confirm with user**

```
## Proposal Generated

Created: `proposals/{feature-name}.md`

**Summary**: {1-2 sentences}

**Ready for**: `/plan-milestone` when prerequisites are met

**Prerequisites identified**:
- {Milestone or feature that must complete first}

---

Review the proposal? Or ready to proceed?
```

**Line count guidance**: UX implementation proposals should be **500+ lines** for non-trivial features. If under 200 lines, the proposal likely lacks the technical specificity the planner needs.

**Reference**: See `proposals/README.md` for full template and examples.

---

## Example Flow

### Consensus Mode Success

```
User: How should we handle empty states in the project list?

[Invoke all three agents]

EL (HIGH confidence): Empty states should be minimal - one line of text, no illustrations. "No projects yet" with a link to create one.

UX (HIGH confidence): Empty states are an opportunity - guide users to their first success. Clear call-to-action, no friction. "No projects yet. Create one" with an obvious button makes the path effortless.

FA (HIGH confidence): Server Component renders null check with a simple paragraph. No client-side state needed.

---

## Consensus Reached

**Decision:** Empty states use single-line text with action link, no decorative elements.

**Implementation:**
- Server Component with null check
- Text: "No projects yet. Create one →"
- No icons, illustrations, or extended explanations

✅ Approve this approach?
```

### Escalation to Discussion

```
User: Should we use tabs or sidebar navigation for the project detail page?

[Invoke all three agents]

EL (MEDIUM): Tabs reduce clicks but limit future expansion. Sidebar scales better but adds visual complexity. Depends on how many sections we're planning.

UX (HIGH): Tabs create clear task completion paths - users see all options at once and feel oriented. Progressive disclosure works naturally with tab content.

FA (MEDIUM): Tabs can be Server Components. Sidebar with active state needs client-side routing detection. But App Router handles both patterns well.

---

## Escalating to Discussion Mode

The team has different perspectives:

**UX** strongly favors tabs for clear task orientation and natural progressive disclosure.
**EL** wants to understand future expansion plans before committing.
**FA** notes both are technically feasible but with different component models.

How would you like to proceed? Key question: How many sections will this page have, and do you expect that to grow?
```

---

## Starting the Roundtable

When `/roundtable-ux` is invoked, begin with Phase 1: Setup.
