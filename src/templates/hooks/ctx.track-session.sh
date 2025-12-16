#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Extract transcript_path using python
transcript_path=$(echo "$input" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('transcript_path', ''))
")

# Exit if no transcript_path
if [ -z "$transcript_path" ]; then
  exit 0
fi

# Get the project root directory (where .claude directory exists)
project_root="$PWD"
ctx_current="$project_root/.ctx.current"

# Update .ctx.current file and get result
result=$(python3 << EOF
import json
import os
import sys

ctx_path = "$ctx_current"
transcript = "$transcript_path"

# Read current .ctx.current
if not os.path.exists(ctx_path):
    # No .ctx.current file - skip session tracking
    print("No .ctx.current found - session not tracked (run /ctx.work.init first)")
    sys.exit(0)

with open(ctx_path, 'r') as f:
    data = json.load(f)

# Check if issue field exists
if 'issue' not in data or not data['issue']:
    print("⚠️ .ctx.current has no issue field - session not tracked")
    sys.exit(0)

# Initialize sessions array if not exists
if 'sessions' not in data:
    data['sessions'] = []

# Add transcript_path if not already present (deduplication)
was_added = False
if transcript not in data['sessions']:
    data['sessions'].append(transcript)
    was_added = True

# Write back to file
with open(ctx_path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')

# Output result
if was_added:
    print(f"✓ Session recorded to .ctx.current ({len(data['sessions'])} total sessions)")
else:
    print(f"Session already tracked in .ctx.current")
EOF
)

# Output success message to stdout (shown to Claude)
echo "$result"
exit 0
