#!/bin/zsh
# Ask the running Stillroom to restart itself once nothing is working. Safe to run any time; it waits.
curl -s -X POST "http://localhost:${ND_PORT:-4747}/api/restart" && echo
