#!/bin/zsh
# Start Stillroom. Sheds any parent Claude Code session's env first, so app sessions log in as you and get your claude.ai connectors.
cd "$(dirname "$0")"
for k in ${(k)parameters}; do [[ $k == ANTHROPIC_* || $k == CLAUDE_* || $k == CLAUDECODE ]] && unset $k; done
exec bun run server.ts
