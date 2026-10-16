#!/bin/zsh
# Stops the launchd agent and removes it. Stillroom stays off until you start it by hand (./start.sh).
LABEL="com.stillroom.server"; PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true; rm -f "$PLIST"; echo "Removed. Start by hand with ./start.sh when you want it."
