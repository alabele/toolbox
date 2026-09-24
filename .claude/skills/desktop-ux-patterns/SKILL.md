---
name: desktop-ux-patterns
description: >
  Design macOS-native UI patterns including menu bar integration, system tray, window
  management, keyboard shortcuts, desktop notifications, and Dock behavior. Use when
  building or evaluating desktop-specific interface elements.
  Triggers: "menu bar", "system tray", "keyboard shortcuts", "window management",
  "desktop notifications", "Dock icon", "global shortcut", "macOS native".
---

# Desktop UX Patterns Skill

## Overview

This skill provides procedural knowledge for designing macOS-native UI patterns in desktop applications. Use this skill when you need to design menu bar integrations, system tray behavior, keyboard shortcut schemes, window management strategies, desktop notification systems, or Dock icon behavior. Applies to both native apps and Electron/Tauri-wrapped web apps targeting macOS.

## Core Capability

This skill enables:

- Designing macOS menu bar structure following HIG conventions
- Planning system tray (status bar) integrations with popovers
- Creating keyboard shortcut schemes that avoid system conflicts
- Defining window management behavior (resize, minimize, close, full-screen)
- Designing desktop notification patterns using macOS notification center
- Specifying Dock icon behavior and badge states

**Scope Boundaries:**

- IN SCOPE: macOS-specific UI patterns, HIG compliance, keyboard/mouse interaction design, window strategy, notification design, Electron/Tauri implementation considerations
- OUT OF SCOPE: Adapting mobile patterns to desktop (use `mobile-to-desktop-adaptation`), general usability audits (use `ux-audit`), Windows/Linux desktop patterns

## Input Contract

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `pattern_type` | string | Yes | Type of desktop pattern to design |
| `app_context` | string | No | Description of the app and its primary use case |
| `wrapper` | string | No | "electron" or "tauri" (affects implementation guidance) |
| `existing_shortcuts` | object[] | No | Already-assigned keyboard shortcuts to avoid conflicts |
| `window_requirements` | object | No | Specific window needs (always-on-top, resizable, minimum size) |

**Supported pattern_type values:**
- `menu-bar`: App menu bar structure and items
- `status-bar`: Menu bar status item (tray icon) with popover
- `keyboard-shortcuts`: Full shortcut scheme design
- `window-management`: Window behavior and sizing strategy
- `notifications`: Desktop notification design and scheduling
- `dock-behavior`: Dock icon states and interactions
- `full-scheme`: Complete desktop UX scheme (all of the above)

**Validation Rules:**
- `pattern_type` must be one of the supported values
- `wrapper` if provided, must be "electron" or "tauri"
- `existing_shortcuts` each entry must include `keys` and `action` fields

## Output Contract

| Output | Type | Description |
|--------|------|-------------|
| `pattern` | object | The designed desktop pattern |
| `hig_compliance` | object[] | macOS HIG requirements met and any deviations |
| `implementation_notes` | object | Electron/Tauri-specific guidance |
| `conflict_analysis` | object | Keyboard shortcut conflicts with system and common apps |

**Output Structure:**
```json
{
  "pattern": {
    "type": "keyboard-shortcuts",
    "shortcuts": [
      {
        "keys": "Cmd+Shift+T",
        "action": "Start/pause timer",
        "scope": "global",
        "menu_location": "Timer > Start/Pause Timer",
        "discoverable": true
      }
    ]
  },
  "hig_compliance": [
    {
      "requirement": "All keyboard shortcuts must appear in menu items",
      "status": "compliant",
      "reference": "macOS HIG: Keyboard Shortcuts"
    }
  ],
  "implementation_notes": {
    "electron": "Use globalShortcut.register() for global shortcuts. Use Menu.buildFromTemplate() for menu bar. Note: globalShortcut does not show in menu automatically -- must add to menu template separately.",
    "tauri": "Use tauri::GlobalShortcutManager for global shortcuts. Menu built via tauri::Menu in Rust."
  },
  "conflict_analysis": {
    "system_conflicts": [],
    "common_app_conflicts": [
      {
        "shortcut": "Cmd+Shift+T",
        "conflicting_app": "Safari, Chrome (reopen closed tab)",
        "severity": "low",
        "recommendation": "Acceptable -- global shortcuts only fire when other apps are not focused, and this shortcut's meaning (start timer) aligns with 'reopen/restart' mental model"
      }
    ]
  }
}
```

## Methodology

### Step 1: Identify Pattern Requirements

Determine what macOS integrations are needed based on app purpose:

| App Behavior | Required Patterns |
|--------------|-------------------|
| Always running in background | Status bar item, Dock icon badge, global shortcuts |
| Occasional foreground use | Standard window, menu bar, local shortcuts |
| Timer/alert based | Status bar with countdown, notifications, always-on-top option |
| Productivity tool | Full scheme: menu bar, shortcuts, status bar, notifications |

For the Transition Bridge app (ADHD timer/task manager): **Full scheme** is required. The app must be accessible at all times without disrupting the user's primary work.

### Step 2: Design Menu Bar Structure

Follow macOS HIG menu bar conventions:

**Required Menus (in order):**

| Menu | Required Items | Notes |
|------|---------------|-------|
| App Menu (Momentum) | About, Preferences (Cmd+,), Hide (Cmd+H), Hide Others (Cmd+Opt+H), Quit (Cmd+Q) | Never omit these standard items |
| File | New Task (Cmd+N), Close Window (Cmd+W) | File menu handles creation and window actions |
| Edit | Undo (Cmd+Z), Redo (Cmd+Shift+Z), Cut/Copy/Paste, Select All | Required even if not all are used -- users expect them |
| Timer | Start/Pause (Cmd+Shift+T), Stop (Cmd+Shift+S), Skip to Next Task, Add 5 Minutes | App-specific actions get their own menu |
| View | Toggle Task Drawer (Cmd+Shift+D), Toggle Always on Top, Enter Full Screen (Ctrl+Cmd+F) | View controls window presentation |
| Window | Minimize (Cmd+M), Zoom, Bring All to Front | Standard window management |
| Help | Search, Momentum Help | macOS provides search automatically |

**Rules:**
- Every keyboard shortcut must appear next to its menu item
- Menu items must use sentence case ("Start timer" not "Start Timer")
- Disabled menu items stay visible but grayed out (never hidden)
- Separator lines group related items within a menu

### Step 3: Design Status Bar (Tray) Integration

The status bar icon is the app's persistent desktop presence:

**Icon States:**

| State | Icon Appearance | Additional Info |
|-------|----------------|-----------------|
| Idle (no active timer) | Monochrome app icon, standard weight | No additional text |
| Timer running | Monochrome icon + countdown text (e.g., "12:34") | Text updates every second |
| Warning (5 min) | Monochrome icon + amber countdown text | Color shift signals urgency |
| Warning (2 min) | Monochrome icon + red countdown text | Increased urgency |
| Timer complete | Filled/highlighted icon | Demands attention |

**Popover Design (click on status bar icon):**

```
+----------------------------------+
| Current: Write project proposal  |
| [====........] 12:34 remaining   |
|                                  |
| Next: Review email inbox         |
|                                  |
| [Start/Pause]  [Skip]  [+ Task] |
+----------------------------------+
| Preferences...       Quit        |
+----------------------------------+
```

**Rules:**
- Popover width: 280-320px (standard macOS popover width)
- Popover appears on click, dismisses on click-outside or Escape
- Status bar text must use monospace or tabular figures for countdown (prevents jitter)
- Respect macOS appearance (dark mode / light mode) automatically
- Status bar icon must be a template image (automatically adapts to light/dark menu bar)

### Step 4: Design Keyboard Shortcuts

**Global Shortcuts (work when app is not focused):**

| Shortcut | Action | Rationale |
|----------|--------|-----------|
| Cmd+Shift+T | Start/pause timer | T for Timer. Shift+Cmd avoids most conflicts. Matches muscle memory of "toggle" |
| Cmd+Shift+N | Quick add task | N for New. Global task capture without switching to app |
| Cmd+Shift+B | Show/hide main window | B for Bridge. Quick access to full UI |

**Local Shortcuts (only when app is focused):**

| Shortcut | Action | Menu Location |
|----------|--------|---------------|
| Cmd+N | New task | File > New task |
| Cmd+, | Preferences | Momentum > Preferences |
| Cmd+W | Close window | File > Close window |
| Cmd+Q | Quit | Momentum > Quit |
| Space | Start/pause timer | Timer > Start/Pause timer |
| Cmd+Shift+D | Toggle task drawer | View > Toggle task drawer |
| Cmd+Shift+S | Stop timer | Timer > Stop timer |
| Cmd+] | Next task | Timer > Skip to next task |
| Escape | Dismiss overlay/modal | (implicit) |

**Conflict Analysis Process:**

1. Check against macOS system shortcuts (System Preferences > Keyboard > Shortcuts)
2. Check against common app shortcuts (browsers, IDEs, Slack, Finder)
3. For global shortcuts, verify they do not conflict when the target app is focused
4. Prefer Cmd+Shift+Letter for global (fewer conflicts than Cmd+Letter or Cmd+Opt+Letter)

**Reserved (never override):**
- Cmd+Space (Spotlight)
- Cmd+Tab (App switcher)
- Cmd+Q (Quit -- must always quit)
- Cmd+H (Hide -- must always hide)
- Cmd+M (Minimize -- must always minimize)
- Ctrl+Cmd+F (Full screen -- system standard)

### Step 5: Design Window Management

**Window Strategy:**

| Component | Window Type | Behavior |
|-----------|------------|----------|
| Main app | Standard NSWindow | Resizable, minimizable, closable. Closing hides to tray (does not quit). Remembers position and size |
| Timer focus view | Floating panel | Small (300x200), always-on-top option, draggable, minimal chrome |
| Add task | Sheet or modal | Attached to main window, Cmd+N to open, Escape to close |
| Transition alert | Alert-level window | Appears above all windows including full-screen apps. Cannot be minimized |
| Preferences | Standard preferences window | Cmd+comma, standard macOS preferences layout with toolbar icons |

**Window Behavior Rules:**
- Closing the main window should hide the app (not quit) -- the app lives in the status bar
- Cmd+Q should quit completely (with confirmation if timer is active)
- Window position and size must persist across launches
- App must support macOS full-screen mode (green button) for the main window
- App must appear correctly in Mission Control and Stage Manager
- Minimum window size: 400x500 (prevents unusable layouts)

### Step 6: Design Notification Strategy

**macOS Notification Types:**

| Notification Level | macOS Type | When to Use |
|-------------------|------------|-------------|
| Informational | Banner (auto-dismiss) | Timer started, task completed |
| Warning | Banner with actions | 5-minute warning, 2-minute warning |
| Critical | Alert (requires dismissal) | Timer complete, transition required |
| Persistent | Badge on Dock icon | Tasks remaining today |

**Notification Actions:**

```
5-Minute Warning Notification:
+----------------------------------------+
| Momentum                          now  |
| Wrapping up in 5 minutes              |
| Current: Write project proposal        |
|                                        |
| [Got it]              [Snooze 2 min]  |
+----------------------------------------+

Timer Complete Notification:
+----------------------------------------+
| Momentum                          now  |
| Time to transition!                    |
| Next: Review email inbox               |
|                                        |
| [Start transition]                     |
+----------------------------------------+
```

**Rules:**
- Request notification permission at first launch with clear explanation
- Respect macOS Focus/Do Not Disturb modes for informational notifications
- Request "time-sensitive" notification entitlement for warnings and critical alerts
- Never send more than 6 notifications per hour
- Notification sound should be distinct but not jarring -- consider a custom sound
- Dock badge shows number of remaining tasks for today (updates in real-time)

### Step 7: Verify HIG Compliance

Check the complete design against macOS Human Interface Guidelines:

| Category | Check |
|----------|-------|
| Menu bar | All standard items present? Shortcuts shown? Correct order? |
| Shortcuts | No system conflicts? All discoverable via menus? |
| Windows | Standard buttons work? Remembers position? Respects full-screen? |
| Notifications | Correct urgency levels? Actions provided? Sound appropriate? |
| Status bar | Template image used? Dark/light mode support? Popover sized correctly? |
| Dock | Badge meaningful? Icon distinguishable at 16x16? |
| Accessibility | VoiceOver labels on all elements? Keyboard-navigable? Respects Reduce Motion? |

## Error Handling

| Type | Code | Description | Recovery |
|------|------|-------------|----------|
| VALIDATION | E001 | Unknown pattern type | Use one of the supported pattern_type values |
| VALIDATION | E002 | Shortcut conflicts with macOS system shortcut | Choose different key combination |
| SEMANTIC | E003 | Requested behavior violates macOS HIG | Design alternative that complies with HIG |
| EXECUTION | E004 | Pattern not achievable in specified wrapper | Document limitation and suggest workaround |
| SCOPE | E005 | Request is about mobile UX, not desktop | Use `ux-audit` or `adhd-interaction-patterns` |

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "type": "VALIDATION",
    "code": "E002",
    "message": "Cmd+Space is reserved by macOS for Spotlight and cannot be overridden as a global shortcut.",
    "suggestion": "Use Cmd+Shift+Space instead, which is available and follows the Cmd+Shift pattern for global shortcuts."
  }
}
```

## Examples

### Example 1: Full Status Bar Design

**Scenario:** Design the system tray integration for the Momentum timer app.

**Input:**
```json
{
  "pattern_type": "status-bar",
  "app_context": "ADHD task timer that runs continuously in background. Must show timer countdown and allow quick task management without switching to full app.",
  "wrapper": "electron"
}
```

**Output:**
```json
{
  "pattern": {
    "type": "status-bar",
    "icon": {
      "idle": "Template image, 18x18pt, monochrome hourglass/timer outline",
      "active": "Template image + live countdown text (tabular figures, 5 chars max: '12:34')",
      "warning_5min": "Same + countdown text in system orange",
      "warning_2min": "Same + countdown text in system red",
      "complete": "Filled/solid version of icon, no text"
    },
    "popover": {
      "width": 300,
      "sections": [
        {
          "name": "current-task",
          "content": "Task name (truncated to 35 chars), progress bar, time remaining"
        },
        {
          "name": "actions",
          "content": "Start/Pause button, Skip button, Quick Add Task button"
        },
        {
          "name": "next-task",
          "content": "Next task name (truncated), estimated duration"
        },
        {
          "name": "footer",
          "content": "Preferences... link, Quit link"
        }
      ],
      "behavior": {
        "open": "Left-click on status bar icon",
        "close": "Click outside, Escape key, or click status bar icon again",
        "detach": "Not supported (popover only)"
      }
    },
    "right_click_menu": [
      { "label": "Start timer", "shortcut": "Cmd+Shift+T", "enabled_when": "timer_idle" },
      { "label": "Pause timer", "shortcut": "Cmd+Shift+T", "enabled_when": "timer_active" },
      { "separator": true },
      { "label": "Quick add task...", "shortcut": "Cmd+Shift+N" },
      { "separator": true },
      { "label": "Show Momentum", "shortcut": "Cmd+Shift+B" },
      { "label": "Preferences...", "shortcut": "Cmd+," },
      { "separator": true },
      { "label": "Quit Momentum", "shortcut": "Cmd+Q" }
    ]
  },
  "hig_compliance": [
    {
      "requirement": "Status bar icons must be template images for automatic dark/light adaptation",
      "status": "compliant",
      "reference": "macOS HIG: Menu Bar Extras"
    },
    {
      "requirement": "Status bar text must not exceed ~5 characters to avoid excessive menu bar consumption",
      "status": "compliant",
      "reference": "macOS HIG: Menu Bar Extras"
    }
  ],
  "implementation_notes": {
    "electron": "Use Tray class for status bar item. Set tray.setTitle('12:34') for countdown text (macOS only). Use tray.setImage() with nativeImage template. Popover requires BrowserWindow positioned relative to tray bounds -- use tray.getBounds() and screen.getCursorScreenPoint(). Use powerMonitor for sleep/wake to pause timer sync.",
    "tauri": "Use SystemTray with menu. Popover requires custom window positioned via PhysicalPosition. Tray title text via system_tray.set_title()."
  },
  "conflict_analysis": {
    "system_conflicts": [],
    "common_app_conflicts": []
  }
}
```

### Example 2: Shortcut Conflict Error

**Scenario:** User requests Cmd+Space as global shortcut.

**Input:**
```json
{
  "pattern_type": "keyboard-shortcuts",
  "existing_shortcuts": [
    { "keys": "Cmd+Space", "action": "Quick add task" }
  ]
}
```

**Output:**
```json
{
  "success": false,
  "error": {
    "type": "VALIDATION",
    "code": "E002",
    "message": "Cmd+Space is reserved by macOS for Spotlight search. This shortcut cannot be registered as a global shortcut and will silently fail on most systems.",
    "suggestion": "Alternatives for 'Quick add task': Cmd+Shift+N (N for New, follows Cmd+Shift global pattern), Cmd+Shift+Space (adds Shift to avoid Spotlight conflict), or Ctrl+Opt+N (rarely used combination)."
  }
}
```

## Constraints

### Operational Limits

- Maximum 5 global shortcuts (more causes discoverability and memorization issues)
- Maximum 7 status bar popover sections (cognitive load limit)
- Notification frequency cap: 6 per hour (macOS will throttle beyond this)
- Status bar countdown text: 5 characters maximum (preserves menu bar space)

### Prohibited Actions

- NEVER override macOS system shortcuts (Cmd+Space, Cmd+Tab, Cmd+Q, Cmd+H, Cmd+M)
- NEVER design a status bar icon that is not a template image (will break on dark menu bars)
- NEVER design a window that cannot be closed with Cmd+W
- NEVER design a notification strategy that ignores Focus/Do Not Disturb (except time-sensitive with proper entitlement)
- NEVER omit keyboard shortcut annotations from menu items
- NEVER design an app that quits when the last window closes (status bar apps must persist)

## Output Template

```markdown
## Desktop UX Pattern: {pattern_type}

### Pattern Overview
- **Type**: {pattern_type}
- **Wrapper**: {electron/tauri/native}
- **App Context**: {context}

### Design

{pattern-specific details}

### HIG Compliance

| Requirement | Status | Reference |
|-------------|--------|-----------|
| {requirement} | {compliant/deviation} | {HIG section} |

### Implementation Notes

**Electron:**
{electron-specific guidance}

**Tauri:**
{tauri-specific guidance}

### Conflict Analysis

| Shortcut | Conflict | Severity | Resolution |
|----------|----------|----------|------------|
| {keys} | {conflicting app/system} | {low/medium/high} | {recommendation} |
```

## Related Skills

| Skill | Use When |
|-------|----------|
| `mobile-to-desktop-adaptation` | Need to translate existing mobile patterns to desktop equivalents |
| `ux-audit` | Need to review existing UI for general usability and accessibility |
| `adhd-interaction-patterns` | Need to design ADHD-specific interaction flows (the desktop skill handles macOS-native presentation of those flows) |
