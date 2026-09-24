#!/usr/bin/env bash
# Adds Quiet's lifecycle hooks to ~/.claude/settings.json without touching anything else there.
# Each hook is an async curl with a 3-second cap, so a stopped server never slows a session.
set -euo pipefail
SETTINGS="$HOME/.claude/settings.json"
PORT="${ND_PORT:-4747}"
cp "$SETTINGS" "$SETTINGS.bak.$(date +%Y%m%d%H%M%S)"
hook() { # $1 = event name
  jq -n --arg url "http://localhost:$PORT/hook/$1" '{hooks:[{type:"command",command:("curl -s -m 2 -o /dev/null -H \"content-type: application/json\" --data-binary @- " + $url + " || true"),async:true,timeout:3}]}'
}
tmp=$(mktemp)
jq --argjson ss "$(hook SessionStart)" --argjson ups "$(hook UserPromptSubmit)" --argjson n "$(hook Notification)" \
   --argjson st "$(hook Stop)" --argjson sf "$(hook StopFailure)" --argjson se "$(hook SessionEnd)" '
  .hooks //= {} |
  def add(ev; h): .hooks[ev] = (((.hooks[ev] // []) | map(select((.hooks[0].command // "") | test("localhost:[0-9]+/hook/") | not))) + [h]);
  add("SessionStart"; $ss) | add("UserPromptSubmit"; $ups) | add("Notification"; $n) |
  add("Stop"; $st) | add("StopFailure"; $sf) | add("SessionEnd"; $se)
' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
echo "Hooks installed for port $PORT. Backup kept beside settings.json. Restart Claude Code sessions to pick them up."
