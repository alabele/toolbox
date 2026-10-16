#!/bin/zsh
# Stillroom starts at login and comes back if it ever dies. Installs a launchd agent for this user; run once.
# Undo with: ./uninstall-login.sh
set -e
cd "$(dirname "$0")"
APP="$PWD"; LOG="$HOME/.config/stillroom/server.log"; PLIST="$HOME/Library/LaunchAgents/com.stillroom.server.plist"; LABEL="com.stillroom.server"
mkdir -p "$HOME/.config/stillroom" "$HOME/Library/LaunchAgents"
BUSY=$(curl -s "http://localhost:${ND_PORT:-4747}/api/restart" 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin).get('busy',0))" 2>/dev/null || echo 0)
if [[ "$BUSY" != "0" ]]; then echo "Stillroom has $BUSY session(s) working. Run this again when they are done, so nothing gets cut off."; exit 1; fi
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$APP/start.sh</string></array>
  <key>WorkingDirectory</key><string>$APP</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>$HOME</string>
    <key>STILLROOM_LAUNCHD</key><string>1</string>
  </dict>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
pkill -f "bun run server.ts" 2>/dev/null || true; sleep 1
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 4
if curl -s -o /dev/null "http://localhost:${ND_PORT:-4747}/"; then echo "Stillroom is running under launchd and will start at login. Log: $LOG"; else echo "Installed, but the server is not answering yet. Check $LOG"; fi
