---
name: adhd-interaction-patterns
description: >
  Design ADHD-optimized interaction patterns for mobile app flows including alerts,
  transitions, timers, onboarding, and task management. Use when creating new interaction
  flows or evaluating whether existing patterns work for neurodivergent users.
  Triggers: "design the flow", "how should this interaction work", "transition pattern",
  "alert escalation", "onboarding flow", "make this ADHD-friendly".
---

# ADHD Interaction Patterns Skill

## Overview

This skill provides procedural knowledge for designing interaction patterns optimized for ADHD and neurodivergent users. Use this skill when you need to design new interaction flows (alert escalation, transition rituals, onboarding sequences, timer interactions) or evaluate whether existing patterns account for ADHD-specific challenges like attention capture, task inertia, sensory sensitivity, and novelty fatigue.

## Core Capability

This skill enables:

- Designing multi-phase alert escalation patterns that are hard to ignore but not overwhelming
- Creating transition rituals that bridge the gap between tasks
- Building onboarding flows that respect limited patience and working memory
- Designing timer interactions that maintain awareness without causing anxiety
- Evaluating existing flows against ADHD attention and executive function patterns

**Scope Boundaries:**

- IN SCOPE: Interaction flow design, alert/notification patterns, transition sequences, sensory escalation, onboarding flows, timer UX
- OUT OF SCOPE: Reviewing static screen layouts for accessibility (use `ux-audit`), implementing code, conducting user research, clinical ADHD assessment

## Input Contract

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `interaction_type` | string | Yes | Type of interaction to design |
| `user_state` | string | No | Expected emotional/cognitive state of user (e.g., "hyperfocused", "anxious", "low energy") |
| `constraints` | object | No | Technical or design constraints (e.g., platform limits, existing patterns) |
| `existing_flow` | string | No | Description or file path of current flow to evaluate |
| `sensory_preferences` | string | No | User's alert preference: "sounds", "vibration", "visual", "everything" |

**Supported interaction_type values:**
- `alert-escalation`: Multi-phase warning system (e.g., 5-min, 2-min, takeover)
- `transition-ritual`: Guided task-switching sequence (e.g., breathing exercise, next task preview)
- `onboarding`: First-time user flow
- `timer-interaction`: Timer display, controls, and state feedback
- `task-input`: Adding and breaking down tasks
- `notification`: Push notification design and scheduling
- `custom`: Any other interaction flow (describe in constraints)

**Validation Rules:**
- `interaction_type` must be one of the supported values
- `user_state` if provided, should describe cognitive/emotional state, not demographics
- `existing_flow` if a file path, must point to an existing component

## Output Contract

| Output | Type | Description |
|--------|------|-------------|
| `pattern` | object | The designed interaction pattern |
| `adhd_rationale` | object[] | Why each design choice works for ADHD |
| `anti_patterns` | string[] | What to avoid and why |
| `sensory_spec` | object | Visual, audio, and haptic specifications |
| `edge_cases` | object[] | How the pattern handles attention failures |

**Output Structure:**
```json
{
  "pattern": {
    "name": "5-2-0 Alert Escalation",
    "phases": [
      {
        "trigger": "5 minutes remaining",
        "visual": "Semi-transparent overlay, gentle blue tint",
        "haptic": "Single light tap",
        "audio": "None (visual only at this phase)",
        "user_action": "Tap 'Got it' or 'Snooze 2min'",
        "dismissible": true,
        "duration_shown": "Until dismissed or 30 seconds"
      }
    ],
    "flow_diagram": "Phase 1 -> Phase 2 -> Phase 3 -> Ritual"
  },
  "adhd_rationale": [
    {
      "decision": "Phase 1 is visual-only with no audio",
      "reason": "At 5 minutes, the user is likely still engaged. Audio interruption would break flow unnecessarily. A gentle visual cue plants awareness without hijacking attention."
    }
  ],
  "anti_patterns": [
    "Never use the same alert intensity for all phases -- habituation makes uniform alerts invisible within days"
  ],
  "sensory_spec": {
    "phase_1": {
      "background_color": "rgba(66, 153, 225, 0.15)",
      "animation": "Slow fade-in over 500ms, no bounce or shake",
      "haptic_type": "ImpactFeedbackStyle.Light",
      "sound": "none"
    }
  },
  "edge_cases": [
    {
      "scenario": "User is hyperfocused and ignores Phase 1 and Phase 2",
      "handling": "Phase 3 (full takeover) cannot be dismissed. Only action is 'Start Transition'. This is the safety net for hyperfocus blindness."
    }
  ]
}
```

## Methodology

### Step 1: Understand the User's Cognitive Context

Before designing any interaction, establish:

| Question | Why It Matters |
|----------|---------------|
| What is the user doing right now? | Determines how much attention is available for the interaction |
| What emotional state are they likely in? | Anxious users need calm patterns; bored users need engagement |
| What executive function is this interaction asking for? | Task switching, sustained attention, and impulse control are all different challenges |
| What happens if they ignore this entirely? | Determines how aggressive the pattern needs to be |

Map user state to design intensity:

| User State | Design Approach |
|------------|----------------|
| Hyperfocused | Escalating interruptions required -- gentle will not work |
| Anxious | Calm, predictable, no surprises. Clear "you're okay" signals |
| Low energy | Minimal decisions, momentum-building micro-steps |
| Distracted | Strong focal point, remove all non-essential elements |
| Resistant (to task switch) | Acknowledge the resistance, make the first step tiny |

### Step 2: Select Base Pattern

Choose from established ADHD-friendly interaction patterns:

**Pattern A: Escalating Alert (for time-sensitive interruptions)**
```
Phase 1: Gentle awareness (visual cue, dismissible)
    |
    v  [If ignored or time passes]
Phase 2: Moderate insistence (visual + haptic, harder to dismiss)
    |
    v  [If ignored or time passes]
Phase 3: Full takeover (blocks screen, single action only)
    |
    v
Resolution: Guided transition to next action
```

**Pattern B: Guided Ritual (for task transitions)**
```
Step 1: Acknowledge completion ("You finished X")
    |
    v
Step 2: Physical reset (breathing, stretch prompt)
    |
    v
Step 3: Preview next ("Coming up: Y")
    |
    v
Step 4: Tiny first action ("First step: Z")
```

**Pattern C: Progressive Disclosure (for input/onboarding)**
```
Screen 1: Single question, single choice
    |
    v
Screen 2: Single question, single choice
    |
    v  [Continue until complete]
Screen N: Confirmation + immediate value
```

**Pattern D: Ambient Awareness (for timers/status)**
```
Background: Subtle color shift reflects state
    |
    v  [State changes]
Foreground: Numbers/text update smoothly (no jarring transitions)
    |
    v  [Threshold crossed]
Attention grab: Brief animation or color pulse
```

### Step 3: Design Sensory Layers

Layer sensory channels to create escalation without overwhelm:

| Escalation Level | Visual | Haptic | Audio |
|-----------------|--------|--------|-------|
| 1 - Gentle | Color tint, subtle icon | None or single light tap | None |
| 2 - Moderate | Overlay, pulsing border | Medium impact, repeated | Optional soft tone |
| 3 - Urgent | Full screen takeover | Strong notification buzz | Alert sound |
| 4 - Critical | Screen block, no dismiss | Continuous until acknowledged | Persistent tone |

**Key Rules:**
- Never start at level 3 or 4 -- always give the user a chance to self-regulate
- Each level must feel distinctly different from the previous (not just "louder")
- Respect the user's sensory preferences from onboarding (sounds/vibration/visual/everything)
- Haptic patterns should be distinguishable: single tap vs. double tap vs. buzz

### Step 4: Design for Failure Modes

Every interaction must handle these ADHD-specific failure modes:

| Failure Mode | Description | Design Response |
|--------------|-------------|-----------------|
| Hyperfocus blindness | User does not notice non-blocking alerts | Escalate to blocking after timeout |
| Decision paralysis | Too many options cause freeze | Reduce to single obvious action |
| Task inertia | Cannot start new task even after acknowledging | Make first step absurdly small ("Open the document") |
| Novelty fatigue | Pattern stops working after 1-2 weeks | Vary micro-copy, keep structure consistent |
| Anxiety spiral | Timer/deadline causes panic instead of action | Show progress made, not just time remaining |
| Shame response | Missing a transition feels like failure | Neutral language ("Let's refocus" not "You missed your deadline") |

### Step 5: Specify Exact Sensory Values

For each phase of the interaction, specify:

**Visual:**
- Background color with alpha (e.g., `rgba(66, 153, 225, 0.15)`)
- Animation type, duration, and easing (e.g., `fade-in, 500ms, ease-out`)
- Text content, size, weight, and color
- Layout (overlay position, full screen, modal)

**Haptic:**
- Expo Haptics type (e.g., `ImpactFeedbackStyle.Light`, `NotificationFeedbackType.Warning`)
- Pattern (single, double, continuous)
- Timing relative to visual

**Audio:**
- Sound type or "none"
- Volume relative to system (soft/medium/full)
- Duration and repeat behavior

### Step 6: Document Edge Cases

For each interaction, document:

1. What happens if the user ignores every prompt?
2. What happens if the user's phone is on silent/vibrate?
3. What happens if the app is backgrounded?
4. What happens if the user has "reduce motion" enabled?
5. What happens if this is the 100th time they have seen this pattern?

### Step 7: Validate Against Anti-Patterns

Check the designed pattern against known anti-patterns:

| Anti-Pattern | Check |
|--------------|-------|
| Uniform alerts | Are all phases distinctly different in intensity? |
| Wall of text | Does any phase show more than 15 words? |
| Guilt language | Does any copy imply failure or shame? |
| False urgency | Is the escalation proportional to actual importance? |
| Notification spam | Could this pattern fire more than 3 times per hour? |
| Sensory overload | Does any single moment combine all three channels at max? |
| Infinite dismiss | Can the user dismiss critical alerts indefinitely? |

## Error Handling

| Type | Code | Description | Recovery |
|------|------|-------------|----------|
| VALIDATION | E001 | Unsupported interaction type | Use one of the supported types or "custom" |
| VALIDATION | E002 | User state description too vague | Describe cognitive/emotional state specifically |
| SCOPE | E003 | Request is for static layout review | Use `ux-audit` skill instead |
| SEMANTIC | E004 | Conflicting constraints (e.g., "must be dismissible" + "cannot be ignored") | Clarify priority -- which requirement wins? |
| SEMANTIC | E005 | Pattern would fire too frequently | Reduce trigger frequency or add cooldown |

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "type": "SEMANTIC",
    "code": "E004",
    "message": "Conflict: 2-minute warning is specified as both 'harder to dismiss' and 'user can always close'. These are mutually exclusive.",
    "suggestion": "Choose one: (A) Require deliberate action to dismiss (e.g., hold button for 2 seconds) which makes it harder but possible, or (B) Auto-dismiss after 15 seconds but re-appear after 30 seconds."
  }
}
```

## Examples

### Example 1: Transition Bridge Alert Escalation

**Scenario:** Design the complete 5-min to 0-min alert escalation for the Transition Bridge Protocol.

**Input:**
```json
{
  "interaction_type": "alert-escalation",
  "user_state": "Likely hyperfocused on current task, resistant to switching",
  "constraints": {
    "phases": ["5-min warning", "2-min warning", "time-up takeover"],
    "must_support_background": true,
    "must_respect_sensory_preferences": true
  },
  "sensory_preferences": "everything"
}
```

**Output:**
```json
{
  "pattern": {
    "name": "5-2-0 Transition Bridge Escalation",
    "phases": [
      {
        "trigger": "5 minutes remaining",
        "visual": "Bottom sheet slides up 25% of screen. Blue-tinted semi-transparent background. Text: 'Wrapping up in 5 minutes' with current task name. Two buttons: 'Got it' (primary), 'Snooze 2min' (secondary).",
        "haptic": "ImpactFeedbackStyle.Light - single tap",
        "audio": "None",
        "user_action": "Tap 'Got it' to dismiss, or 'Snooze 2min' for one-time snooze",
        "dismissible": true,
        "duration_shown": "Until dismissed or auto-dismiss after 30 seconds",
        "background_behavior": "Push notification with same text if app is backgrounded"
      },
      {
        "trigger": "2 minutes remaining (or after snooze expires)",
        "visual": "Full-width overlay covering top 40% of screen. Orange pulsing border (2px, 1.5s cycle). Text: '2 minutes - Save your work!' with current task name. One button: 'I need more time' (adds 5 min, max once per session).",
        "haptic": "ImpactFeedbackStyle.Medium - double tap pattern (tap-pause-tap)",
        "audio": "Soft chime (if sounds enabled), 500ms duration",
        "user_action": "Tap 'I need more time' for one-time extension, or wait",
        "dismissible": false,
        "duration_shown": "Auto-collapses to persistent banner after 15 seconds",
        "background_behavior": "Urgent push notification + haptic pattern"
      },
      {
        "trigger": "0 minutes remaining",
        "visual": "Full screen takeover. Dark overlay 95% opacity. Large text: 'Time to transition!' followed by 'Let's do this together'. Single button: 'Start Transition' (large, centered, primary color). No close button, no back gesture.",
        "haptic": "NotificationFeedbackType.Warning - continuous pattern until acknowledged",
        "audio": "Distinct alert tone (if sounds enabled), repeats every 10 seconds until acknowledged",
        "user_action": "Tap 'Start Transition' (only available action)",
        "dismissible": false,
        "duration_shown": "Until user taps 'Start Transition'",
        "background_behavior": "Persistent notification + app opens to this screen"
      }
    ],
    "flow_diagram": "Timer Running -> 5min Warning -> 2min Escalation -> Full Takeover -> Breathing Exercise -> Next Task"
  },
  "adhd_rationale": [
    {
      "decision": "Phase 1 is gentle, dismissible, visual+light haptic only",
      "reason": "At 5 minutes, the user may still be productively engaged. A heavy interruption would break flow for no gain. The goal is to plant awareness, not demand action. Most users will dismiss and naturally start wrapping up."
    },
    {
      "decision": "Phase 2 has pulsing border and is not dismissible",
      "reason": "At 2 minutes, gentle reminders are no longer sufficient for hyperfocused users. The pulsing border creates peripheral visual urgency without blocking content. Making it non-dismissible prevents the ADHD pattern of reflexively swiping away notifications without processing them."
    },
    {
      "decision": "Phase 3 blocks the entire screen with only one action",
      "reason": "This is the safety net for hyperfocus blindness. By removing all options except 'Start Transition', we eliminate decision paralysis and make the path forward unambiguous. This mirrors the ADHD experience of needing external structure when internal executive function is depleted."
    },
    {
      "decision": "'I need more time' is limited to once per session",
      "reason": "Unlimited extensions defeat the purpose. But having zero flexibility causes anxiety and resentment. One extension respects user autonomy while maintaining the system's effectiveness. The limit must be communicated clearly."
    }
  ],
  "anti_patterns": [
    "Never use the same visual treatment for all three phases -- the brain stops noticing repeated stimuli (habituation)",
    "Never use guilt language like 'You should have finished by now' -- shame triggers avoidance, not action",
    "Never allow infinite snoozing -- the system must eventually force the transition or it will never work",
    "Never combine full audio + full haptic + full visual simultaneously in phases 1-2 -- save maximum sensory impact for phase 3 only"
  ],
  "sensory_spec": {
    "phase_1": {
      "background_color": "rgba(66, 153, 225, 0.12)",
      "border": "none",
      "animation": "slideUp 400ms ease-out",
      "text_size": "18px semibold (message), 14px regular (task name)",
      "haptic_type": "Haptics.impactAsync(ImpactFeedbackStyle.Light)",
      "haptic_count": 1,
      "sound": "none"
    },
    "phase_2": {
      "background_color": "rgba(237, 137, 54, 0.2)",
      "border": "2px solid #ed8936, pulsing opacity 0.6-1.0 over 1.5s",
      "animation": "slideDown 300ms ease-out, border pulse infinite",
      "text_size": "22px bold (message), 16px regular (task name)",
      "haptic_type": "Haptics.impactAsync(ImpactFeedbackStyle.Medium)",
      "haptic_count": 2,
      "haptic_pattern": "tap, 200ms pause, tap",
      "sound": "soft_chime.wav, 500ms, play once"
    },
    "phase_3": {
      "background_color": "rgba(0, 0, 0, 0.95)",
      "border": "none",
      "animation": "fadeIn 600ms ease-in",
      "text_size": "30px bold (headline), 18px regular (subtext), button 20px semibold",
      "haptic_type": "Haptics.notificationAsync(NotificationFeedbackType.Warning)",
      "haptic_count": "repeat every 5 seconds until acknowledged",
      "sound": "alert_tone.wav, 1s, repeat every 10s until acknowledged"
    }
  },
  "edge_cases": [
    {
      "scenario": "User hyperfocused, ignores phases 1 and 2 entirely",
      "handling": "Phase 3 full takeover is the safety net. It blocks all interaction until acknowledged. Combined with haptic and audio repetition, this is designed to break through hyperfocus."
    },
    {
      "scenario": "Phone is on silent mode",
      "handling": "Audio is skipped but haptic and visual remain. Phase 3 haptic pattern repeats every 5 seconds which is noticeable even without sound."
    },
    {
      "scenario": "App is backgrounded",
      "handling": "Push notifications fire at each phase. Phase 3 notification is marked as critical/time-sensitive. On iOS, request time-sensitive notification permission to bypass Focus mode."
    },
    {
      "scenario": "User has 'reduce motion' enabled",
      "handling": "Replace pulsing border with static high-contrast border. Replace slide animations with instant appearance. Keep color changes but remove animation timing."
    },
    {
      "scenario": "100th time seeing this pattern (novelty fatigue)",
      "handling": "Structure stays identical (consistency is key for ADHD). Vary micro-copy slightly from a pool of 5-10 messages per phase (e.g., 'Almost there - 5 minutes left', 'Time to start wrapping up'). Never change the button labels or positions."
    }
  ]
}
```

### Example 2: Scope Error

**Scenario:** User asks to review an existing screen layout.

**Input:**
```json
{
  "interaction_type": "custom",
  "existing_flow": "The home screen has too many elements and feels cluttered"
}
```

**Output:**
```json
{
  "success": false,
  "error": {
    "type": "SCOPE",
    "code": "E003",
    "message": "This request is about reviewing an existing screen layout for clutter and usability issues, not designing a new interaction flow.",
    "suggestion": "Use the ux-audit skill with audit_type 'cognitive-load' to systematically evaluate the home screen and get specific reduction recommendations."
  }
}
```

## Constraints

### Operational Limits

- Maximum 4 phases per escalation pattern (more phases cause confusion about "where am I in the sequence")
- Maximum 15 words per alert message (ADHD users will not read more)
- Maximum 2 actions per alert phase (ideally 1)
- Minimum 1 minute between escalation phases (faster causes anxiety)
- Notification frequency cap: 6 per hour maximum across all interaction types

### Prohibited Actions

- NEVER design an alert that can be infinitely snoozed or dismissed without consequence
- NEVER use guilt, shame, or negative language in any micro-copy
- NEVER design simultaneous max-intensity visual + audio + haptic except for the final escalation phase
- NEVER design an onboarding flow that takes more than 60 seconds
- NEVER rely solely on audio for critical alerts (accessibility: deaf/hard-of-hearing users)
- NEVER design a timer that shows only time remaining without context (e.g., always show task name alongside timer)

## Output Template

```markdown
## Interaction Pattern: {pattern_name}

### User Context
- **State**: {user_state}
- **Challenge**: {primary ADHD challenge this addresses}
- **Goal**: {what successful interaction looks like}

### Pattern Flow

{flow_diagram}

### Phase Details

#### Phase {n}: {name}
- **Trigger**: {when this activates}
- **Visual**: {exact visual specification}
- **Haptic**: {exact haptic specification}
- **Audio**: {exact audio specification}
- **User Action**: {what the user can do}
- **Dismissible**: {yes/no}
- **Duration**: {how long it shows}

### ADHD Design Rationale

| Decision | Rationale |
|----------|-----------|
| {choice made} | {why it works for ADHD} |

### Anti-Patterns Avoided
- {anti-pattern}: {why it was avoided}

### Edge Cases
| Scenario | Handling |
|----------|----------|
| {edge case} | {how the pattern handles it} |

### Sensory Specification

| Phase | Visual | Haptic | Audio |
|-------|--------|--------|-------|
| {n} | {spec} | {spec} | {spec} |
```

## Related Skills

| Skill | Use When |
|-------|----------|
| `ux-audit` | Need to review an existing screen for usability issues rather than design a new flow |
