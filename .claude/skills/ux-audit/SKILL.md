---
name: ux-audit
description: >
  Systematic review of screens and components for usability, accessibility, and ADHD-friendliness.
  Use when evaluating existing UI for issues, verifying WCAG AAA compliance, or checking
  cognitive load. Triggers: "review this screen", "audit the UI", "check accessibility",
  "is this usable", "evaluate the design".
---

# UX Audit Skill

## Overview

This skill provides procedural knowledge for conducting systematic UX audits of mobile app screens and components. Use this skill when you need to review an existing screen for usability issues, verify accessibility compliance, or assess ADHD-friendliness.

## Core Capability

This skill enables:

- Systematic screen review against usability, accessibility, and ADHD-specific criteria
- WCAG AAA contrast ratio verification for all theme color pairings
- Cognitive load assessment with specific reduction recommendations
- Touch target size verification
- Visual hierarchy analysis

**Scope Boundaries:**

- IN SCOPE: Reviewing existing screens/components, identifying issues, recommending specific fixes, verifying WCAG compliance
- OUT OF SCOPE: Designing new interaction flows (use `adhd-interaction-patterns`), implementing code changes, conducting user research

## Input Contract

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `target` | string | Yes | Screen name, component name, or file path to audit |
| `audit_type` | string | No | "full", "accessibility", "cognitive-load", "visual-hierarchy" (default: "full") |
| `theme` | string | No | Theme to evaluate against (default: all themes) |
| `screenshot` | image | No | Screenshot of the current screen state |
| `context` | string | No | User context (e.g., "this is shown during a timer countdown") |

**Validation Rules:**
- `target` must identify a specific screen or component, not the entire app
- `audit_type` must be one of the four supported types
- `theme` if provided, must be one of: calm-waters, forest-floor, soft-purple, high-contrast, sunrise-warmth

## Output Contract

| Output | Type | Description |
|--------|------|-------------|
| `findings` | object[] | Prioritized list of UX issues found |
| `accessibility_report` | object | WCAG compliance status |
| `cognitive_load_score` | object | Assessment of cognitive demands |
| `recommendations` | object[] | Prioritized, actionable fixes |

**Output Structure:**
```json
{
  "findings": [
    {
      "id": "F001",
      "severity": "critical",
      "category": "accessibility",
      "element": "Start Timer button",
      "issue": "Contrast ratio 4.8:1 fails WCAG AAA (requires 7:1)",
      "wcag_ref": "1.4.6",
      "recommendation": "Change button text color from #94a3b8 to #e2e8f0 on #4299e1 background"
    }
  ],
  "accessibility_report": {
    "wcag_aaa_pass": false,
    "contrast_failures": 2,
    "touch_target_failures": 1,
    "focus_indicator_issues": 0
  },
  "cognitive_load_score": {
    "decisions_required": 3,
    "visual_elements": 8,
    "rating": "medium",
    "max_recommended_decisions": 3,
    "max_recommended_elements": 7
  },
  "recommendations": [
    {
      "priority": 1,
      "finding_id": "F001",
      "action": "Update text color to #e2e8f0",
      "impact": "Fixes WCAG AAA violation for primary action button",
      "effort": "low"
    }
  ]
}
```

## Methodology

### Step 1: Identify Audit Scope

Determine what is being audited:

- If a file path is provided, read the component source code
- If a screenshot is provided, analyze the visual output
- If a screen name is provided, locate the corresponding component file
- Note the user context (when is this screen shown, what state is the user in)

### Step 2: Cognitive Load Assessment

Count and evaluate cognitive demands:

| Check | Criteria | ADHD Threshold |
|-------|----------|----------------|
| Decision count | How many choices must the user make? | Max 3 visible at once |
| Text density | How many words are on screen? | Max 20 words visible (excluding content) |
| Visual elements | How many distinct visual elements compete for attention? | Max 7 elements |
| Action clarity | Can the primary action be identified in under 2 seconds? | Must be instant |
| Recovery ease | If distracted, can the user re-orient in under 3 seconds? | Must be fast |

Rate cognitive load as:
- **Low** (0-1 threshold exceeded): Good for ADHD users
- **Medium** (2 threshold exceeded): Acceptable but could improve
- **High** (3+ thresholds exceeded): Likely to cause overwhelm

### Step 3: Visual Hierarchy Check

Evaluate the screen's visual structure:

1. **Focal Point**: Is there exactly one clear primary element? Multiple competing focal points cause paralysis
2. **Grouping**: Are related items visually grouped with whitespace or containers? Ungrouped elements increase scanning time
3. **Progression**: Does the eye naturally flow from most important to least important? Check: size, color, position, contrast
4. **Noise**: Are there decorative elements that serve no functional purpose? Every non-functional element is cognitive load

### Step 4: Accessibility Verification

Check against WCAG AAA standards:

**Color Contrast** (for each theme):
```
Normal text (<18px or <14px bold): 7:1 ratio required
Large text (>=18px or >=14px bold): 4.5:1 ratio required
UI components and graphics: 3:1 ratio required
```

Verify these pairings for each theme:
- text-primary on background-primary
- text-primary on background-secondary
- text-secondary on background-primary
- text-secondary on background-secondary
- action-primary text on action-primary background
- Timer state colors on timer background

**Touch Targets**:
- Minimum 48x48dp for all interactive elements
- Minimum 8dp spacing between adjacent touch targets
- Verify: buttons, icons, links, switches, sliders, list items

**Focus Indicators**:
- All interactive elements must have visible focus state
- Focus ring must have 3:1 contrast against adjacent colors
- Focus order must follow logical reading order

### Step 5: ADHD-Specific Review

Check patterns specific to neurodivergent users:

| Check | Pass Criteria |
|-------|--------------|
| Animation purpose | Every animation serves a functional purpose (progress, state change, feedback). No decorative motion |
| Dismissibility | User can dismiss non-critical overlays. Critical overlays have clear single action |
| State persistence | If user leaves and returns, they can pick up where they left off without confusion |
| Error recovery | Errors show what went wrong AND what to do next in plain language |
| Time pressure | No countdown timers on user input (timer is for task duration, not UI interaction) |
| Sensory load | No simultaneous visual + audio + haptic unless escalating an alert intentionally |

### Step 6: Generate Findings

For each issue found:

1. Assign a severity:
   - **Critical**: Blocks task completion or violates accessibility law
   - **High**: Causes significant confusion or frustration for ADHD users
   - **Medium**: Suboptimal but does not block or significantly confuse
   - **Low**: Minor polish issue

2. Provide specific fix with exact values (colors, sizes, positions)

3. Reference WCAG criteria where applicable

### Step 7: Prioritize Recommendations

Order recommendations by: Critical severity first, then by impact-to-effort ratio (high impact + low effort = fix first).

## Error Handling

| Type | Code | Description | Recovery |
|------|------|-------------|----------|
| VALIDATION | E001 | Target screen/component not found | Verify file path or screen name |
| VALIDATION | E002 | Theme name not recognized | Use one of the 5 defined themes |
| SCOPE | E003 | Request is for interaction design, not audit | Use `adhd-interaction-patterns` skill |
| EXECUTION | E004 | Cannot calculate contrast ratio without hex values | Provide theme color values or screenshot |

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "type": "VALIDATION",
    "code": "E001",
    "message": "Cannot locate screen 'TransitionScreen'. Found similar: 'TransitionWarningScreen.tsx', 'BreathingExerciseScreen.tsx'",
    "suggestion": "Did you mean TransitionWarningScreen?"
  }
}
```

## Examples

### Example 1: Home Screen Audit

**Scenario:** Review the main home screen for ADHD usability.

**Input:**
```json
{
  "target": "src/screens/MainScreen.tsx",
  "audit_type": "full",
  "context": "Primary screen shown during active task with running timer"
}
```

**Output:**
```json
{
  "findings": [
    {
      "id": "F001",
      "severity": "high",
      "category": "cognitive-load",
      "element": "Bottom action bar",
      "issue": "Add Task (+) and View All Tasks buttons are same visual weight as timer, creating 3 competing focal points",
      "recommendation": "Reduce bottom actions to ghost/outline style. Timer must be the dominant element during active task. Use 12px text and 32px icons for bottom bar vs 120px timer."
    },
    {
      "id": "F002",
      "severity": "medium",
      "category": "adhd-specific",
      "element": "Next task preview",
      "issue": "Showing next task during active timer may pull attention away from current task",
      "recommendation": "Hide next task preview while timer is active. Show only during paused state or in the last 2 minutes as part of transition warning."
    }
  ],
  "accessibility_report": {
    "wcag_aaa_pass": true,
    "contrast_failures": 0,
    "touch_target_failures": 0,
    "focus_indicator_issues": 1
  },
  "cognitive_load_score": {
    "decisions_required": 2,
    "visual_elements": 6,
    "rating": "low",
    "max_recommended_decisions": 3,
    "max_recommended_elements": 7
  },
  "recommendations": [
    {
      "priority": 1,
      "finding_id": "F001",
      "action": "Reduce visual weight of bottom action bar during active timer state",
      "impact": "Eliminates competing focal points, reinforces timer as primary element",
      "effort": "low"
    },
    {
      "priority": 2,
      "finding_id": "F002",
      "action": "Conditionally hide next task preview based on timer state",
      "impact": "Reduces distraction during focus periods",
      "effort": "medium"
    }
  ]
}
```

### Example 2: Accessibility-Only Audit (Error Case)

**Scenario:** User requests audit of a non-existent screen.

**Input:**
```json
{
  "target": "src/screens/DashboardScreen.tsx",
  "audit_type": "accessibility"
}
```

**Output:**
```json
{
  "success": false,
  "error": {
    "type": "VALIDATION",
    "code": "E001",
    "message": "Cannot locate 'DashboardScreen.tsx'. This screen does not exist in the project.",
    "suggestion": "Available screens: MainScreen.tsx, OnboardingScreen.tsx, SettingsScreen.tsx, TransitionWarningScreen.tsx, BreathingExerciseScreen.tsx. Did you mean MainScreen (the home/dashboard screen)?"
  }
}
```

## Constraints

### Operational Limits

- Maximum 1 screen per audit invocation (audit individual screens, not the whole app)
- Maximum 20 findings per audit (prioritize, don't enumerate every minor issue)
- Contrast ratio calculations require actual hex color values

### Prohibited Actions

- NEVER approve a design that fails WCAG AAA contrast ratios without explicitly flagging it
- NEVER recommend decorative animations for an ADHD-focused app
- NEVER suggest adding more visible options when the screen already exceeds 3 decisions
- NEVER provide vague recommendations ("make it better") -- always specify exact values

## Output Template

```markdown
## UX Audit: {screen_name}

### Audit Context
- **Screen**: {target}
- **Type**: {audit_type}
- **Theme(s)**: {theme or "all"}
- **User Context**: {context}

### Cognitive Load Assessment
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Decisions required | {n} | 3 | {PASS/FAIL} |
| Visual elements | {n} | 7 | {PASS/FAIL} |
| Primary action identifiable in <2s | {yes/no} | Yes | {PASS/FAIL} |
| Re-orientation time | {estimate} | <3s | {PASS/FAIL} |
| **Overall Rating** | | | **{Low/Medium/High}** |

### Accessibility Report
| Check | Status | Details |
|-------|--------|---------|
| WCAG AAA Contrast | {PASS/FAIL} | {n} failures |
| Touch Targets (48dp) | {PASS/FAIL} | {n} failures |
| Focus Indicators | {PASS/FAIL} | {n} issues |

### Findings

#### [{severity}] F{id}: {title}
- **Element**: {element}
- **Issue**: {description}
- **WCAG**: {reference if applicable}
- **Fix**: {specific actionable recommendation}

### Prioritized Recommendations

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| 1 | {action} | {impact} | {low/medium/high} |
| 2 | {action} | {impact} | {low/medium/high} |
```

## Related Skills

| Skill | Use When |
|-------|----------|
| `adhd-interaction-patterns` | Need to design new interaction flows rather than audit existing ones |
