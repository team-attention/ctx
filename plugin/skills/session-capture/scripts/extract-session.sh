#!/bin/bash
# extract-session.sh
# Extract essential content from Claude Code session JSONL files
# Removes thinking blocks, tool_use, and metadata to reduce token count
#
# Usage: ./extract-session.sh <session.jsonl>
# Output: Filtered JSON to stdout

set -e

SESSION_FILE="$1"

if [ -z "$SESSION_FILE" ]; then
  echo "Usage: $0 <session.jsonl>" >&2
  exit 1
fi

if [ ! -f "$SESSION_FILE" ]; then
  echo "Error: File not found: $SESSION_FILE" >&2
  exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

# Extract essential content:
# - summary: session summary (useful)
# - user: user messages (essential)
# - assistant: only text content (exclude thinking, tool_use)
#
# This typically reduces file size by 60-80%
# Original: 48000 tokens → Filtered: ~10000 tokens

jq -c '
  if .type == "summary" then
    {type: "summary", summary: .summary}
  elif .type == "user" then
    {
      type: "user",
      content: .message.content,
      timestamp: .timestamp
    }
  elif .type == "assistant" then
    # Extract only text content, skip thinking and tool_use
    {
      type: "assistant",
      texts: [.message.content[]? | select(.type == "text") | .text],
      timestamp: .timestamp
    } | select(.texts | length > 0)
  else
    empty
  end
' "$SESSION_FILE" 2>/dev/null | jq -s '{
  file: "'"$SESSION_FILE"'",
  messages: .
}'
