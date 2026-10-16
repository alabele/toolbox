#!/bin/zsh
# Runs the harness scorer headless and commits its scorecard. Installed monthly by install-scorer.sh; run by hand any time.
set -e
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
for k in ${(k)parameters}; do [[ $k == ANTHROPIC_* || $k == CLAUDE_* || $k == CLAUDECODE ]] && unset $k; done
DAY=$(date +%F); LOG="$HOME/.config/stillroom/scorer.log"; mkdir -p "$HOME/.config/stillroom" research/harness-scorecards
PREV=$(ls -t research/harness-scorecards/*.md 2>/dev/null | head -1)
SINCE=$(date -v-30d +%F 2>/dev/null || date -d '30 days ago' +%F)
echo "$(date) scorer start" >> "$LOG"
claude -p "Adopt the role in agents/hx-harness-scorer.md (read it fully first) and write the harness scorecard for the period $SINCE to $DAY. Also read config/harness-rubric.json and research/harnesses.md. Data: ~/.config/stillroom/{ledger.json,prs.json,sessions.json,sessions-log.jsonl,waits.json,projects.json,fairy.json}; transcripts under ~/.claude/projects/ (one folder per cwd with the path dashed, JSONL per session; the sessionId is the file name). The previous scorecard is ${PREV:-none}; show the delta against it. Read only; the only files you may write are research/harness-scorecards/$DAY.md and one appended line in QUEUE.md under the heading '## Suggested by the harness scorer'. Never touch app/ or anything under ~/.config/stillroom. For error analysis read up to 40 transcripts of partly or failed sessions, the last 300 lines of each large one. Also check the fairy's four-day and five-day thresholds against real session and wait ages and say whether they fit. Keep the scorecard under 900 words." \
  --allowedTools "Read,Glob,Grep,Bash(ls:*),Bash(wc:*),Bash(head:*),Bash(tail:*),Bash(python3:*),Bash(jq:*),Bash(git log:*),Bash(git diff:*),Bash(gh pr:*),Write(research/harness-scorecards/*),Edit(QUEUE.md)" \
  --max-turns 120 >> "$LOG" 2>&1 || { echo "$(date) scorer failed" >> "$LOG"; exit 1; }
if [[ -f "research/harness-scorecards/$DAY.md" ]]; then
  git add "research/harness-scorecards/$DAY.md" QUEUE.md && git commit -q -m "docs(nd-dashboard): harness scorecard $DAY (scheduled run)" && git push -q origin main && echo "$(date) scorecard committed" >> "$LOG"
else echo "$(date) no scorecard written" >> "$LOG"; exit 1; fi
