#!/bin/bash
# SessionStart hook: Show current issue from .ctx.current
# This hook runs on session startup/resume and outputs the current issue to Claude's context

project_root="$PWD"
ctx_current="$project_root/.ctx.current"

# Exit silently if .ctx.current doesn't exist
if [ ! -f "$ctx_current" ]; then
  exit 0
fi

# Extract issue field from JSON
issue=$(python3 -c "
import json
try:
    with open('$ctx_current', 'r') as f:
        data = json.load(f)
    issue = data.get('issue', '')
    if issue:
        print(issue)
except:
    pass
" 2>/dev/null)

# Output issue to stdout (will be added to Claude's context)
if [ -n "$issue" ]; then
  echo "Current issue: $issue"
fi

exit 0
