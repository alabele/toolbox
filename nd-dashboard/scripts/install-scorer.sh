#!/bin/zsh
# The harness scorer runs on its own on the 16th of every month at 03:00. Run once. Undo: launchctl bootout gui/$(id -u)/com.stillroom.scorer
set -e
cd "$(dirname "$0")/.."
PLIST="$HOME/Library/LaunchAgents/com.stillroom.scorer.plist"; LABEL="com.stillroom.scorer"; SCRIPT="$PWD/scripts/score-harness.sh"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$SCRIPT</string></array>
  <key>WorkingDirectory</key><string>$PWD</string>
  <key>StartCalendarInterval</key><dict><key>Day</key><integer>16</integer><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$HOME/.config/stillroom/scorer.log</string>
  <key>StandardErrorPath</key><string>$HOME/.config/stillroom/scorer.log</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string><key>HOME</key><string>$HOME</string></dict>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "The scorer runs on the 16th of each month at 03:00 and commits its scorecard. Log: ~/.config/stillroom/scorer.log. Run it by hand: scripts/score-harness.sh"
