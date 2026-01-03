#!/bin/bash
#
# CTX Auto-Load Context Hook (3-Level System)
#
# Triggered on PostToolUse(Read) to automatically inject companion context
# when reading a code file that has associated context files.
#
# Supports 3-Level priority:
#   1. Project exact match (highest priority)
#   2. Global exact match
#   3. Project glob match
#   4. Global glob match (lowest priority)
#
# Input: JSON from stdin with tool_name, tool_input, tool_response
# Output: additionalContext to stdout (will be injected into conversation)

set -e

# Read input from stdin
input=$(cat)

# Extract file path from tool input
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Exit if no file path
if [ -z "$file_path" ]; then
  exit 0
fi

# Skip if already reading a context file
if [[ "$file_path" == *.ctx.md ]] || [[ "$file_path" == */ctx.md ]]; then
  exit 0
fi

# Skip if reading from .ctx directory
if [[ "$file_path" == */.ctx/* ]] || [[ "$file_path" == */.ctx ]]; then
  exit 0
fi

# Skip common non-code files that rarely have contexts
case "$file_path" in
  *.lock|*.log|package-lock.json|yarn.lock|pnpm-lock.yaml)
    exit 0
    ;;
esac

# Use ctx load to find and output matching contexts
# The ctx load command handles:
# - Registry lookup (Project + Global)
# - Target matching (exact + glob patterns)
# - Priority ordering (Project exact > Global exact > Project glob > Global glob)
# - Content output
ctx load --target "$file_path" 2>/dev/null || true

exit 0
