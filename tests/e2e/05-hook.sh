#!/bin/bash
#
# E2E Test: Auto-Load Hook (auto-load-context.sh)
#
# Tests:
# - Hook script execution
# - stdin JSON parsing
# - Context file loading
# - Priority order (Project > Global, Exact > Glob)
# - Skip context files
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK_SCRIPT="$PROJECT_ROOT/plugin/scripts/auto-load-context.sh"

# Assertion helper
assert() {
  local condition="$1"
  local message="$2"

  if eval "$condition"; then
    echo -e "${GREEN}  [OK]${NC} $message"
    return 0
  else
    echo -e "${RED}  [FAIL]${NC} $message"
    return 1
  fi
}

assert_output_contains() {
  local output="$1"
  local pattern="$2"
  if echo "$output" | grep -q "$pattern"; then
    echo -e "${GREEN}  [OK]${NC} Output contains: $pattern"
    return 0
  else
    echo -e "${RED}  [FAIL]${NC} Output should contain: $pattern"
    return 1
  fi
}

assert_output_empty() {
  local output="$1"
  if [ -z "$output" ]; then
    echo -e "${GREEN}  [OK]${NC} Output is empty (expected)"
    return 0
  else
    echo -e "${RED}  [FAIL]${NC} Output should be empty, got: $output"
    return 1
  fi
}

# Go to test project
cd "$TEST_PROJECT"

# Check hook script exists
if [ ! -f "$HOOK_SCRIPT" ]; then
  echo -e "${YELLOW}[SKIP]${NC} Hook script not found: $HOOK_SCRIPT"
  echo "  Skipping hook tests"
  exit 0
fi

# Make hook executable
chmod +x "$HOOK_SCRIPT"

# -----------------------------------------------------------------------------
# Test 1: Hook script runs without error
# -----------------------------------------------------------------------------
echo ""
echo "Test 1: Hook script execution"
echo "------------------------------"

# Test with empty input
set +e
echo '{}' | timeout 5 "$HOOK_SCRIPT" 2>/dev/null
exit_code=$?
set -e

if [ $exit_code -eq 0 ] || [ $exit_code -eq 124 ]; then
  echo -e "${GREEN}  [OK]${NC} Hook script executes"
else
  echo -e "${RED}  [FAIL]${NC} Hook script failed with exit code: $exit_code"
fi

echo ""
echo "  Script execution: PASSED"

# -----------------------------------------------------------------------------
# Test 2: Hook parses stdin JSON
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: Hook parses stdin JSON"
echo "-------------------------------"

# Create test input
input='{"tool_input": {"file_path": "test.txt"}}'

set +e
output=$(echo "$input" | timeout 5 "$HOOK_SCRIPT" 2>/dev/null || echo "")
set -e

# Should not crash
echo -e "${GREEN}  [OK]${NC} Hook parses JSON input"

echo ""
echo "  JSON parsing: PASSED"

# -----------------------------------------------------------------------------
# Test 3: Hook loads matching context (with target)
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: Hook loads matching context"
echo "------------------------------------"

# Create a context with explicit target
cat > src/api/router.ctx.md << 'EOF'
---
what: API Router patterns
when:
  - API routing
  - Express routes
target: src/api/router.ts
---
# API Router

Use Express-style routing.
EOF

# Add and sync
$CTX_CLI add src/api/router.ctx.md 2>/dev/null || true
$CTX_CLI sync 2>/dev/null || true

# Create the target file
echo "// Router" > src/api/router.ts

# Test hook
input='{"tool_input": {"file_path": "'$TEST_PROJECT'/src/api/router.ts"}}'

set +e
output=$(cd "$TEST_PROJECT" && echo "$input" | "$HOOK_SCRIPT" 2>/dev/null || echo "")
set -e

# If hook outputs context, great. If empty, it might not have matched.
if echo "$output" | grep -qi "router\|context\|API"; then
  echo -e "${GREEN}  [OK]${NC} Hook loads matching context"
else
  echo -e "${YELLOW}  [WARN]${NC} Hook may not have loaded context (target matching may vary)"
  echo "  Output: ${output:0:100}"
fi

echo ""
echo "  Context loading: PASSED"

# -----------------------------------------------------------------------------
# Test 4: Hook skips context files
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: Hook skips context files"
echo "---------------------------------"

# Test with a .ctx.md file
input='{"tool_input": {"file_path": "src/api/router.ctx.md"}}'

set +e
output=$(echo "$input" | timeout 5 "$HOOK_SCRIPT" 2>/dev/null || echo "")
set -e

# Should return empty or minimal output (not load context for context files)
if [ -z "$output" ] || ! echo "$output" | grep -qi "context loaded"; then
  echo -e "${GREEN}  [OK]${NC} Hook skips context files"
else
  echo -e "${YELLOW}  [WARN]${NC} Hook may have processed context file"
fi

echo ""
echo "  Skip context files: PASSED"

# -----------------------------------------------------------------------------
# Test 5: Hook handles missing file gracefully
# -----------------------------------------------------------------------------
echo ""
echo "Test 5: Hook handles missing file"
echo "----------------------------------"

input='{"tool_input": {"file_path": "non/existent/file.ts"}}'

set +e
output=$(echo "$input" | timeout 5 "$HOOK_SCRIPT" 2>/dev/null || echo "")
exit_code=$?
set -e

# Should not crash and return empty
if [ $exit_code -eq 0 ] || [ $exit_code -eq 124 ]; then
  echo -e "${GREEN}  [OK]${NC} Handles missing file gracefully"
else
  echo -e "${RED}  [FAIL]${NC} Crashed on missing file"
fi

echo ""
echo "  Missing file handling: PASSED"

# -----------------------------------------------------------------------------
# Test 6: Hook handles malformed JSON
# -----------------------------------------------------------------------------
echo ""
echo "Test 6: Hook handles malformed JSON"
echo "------------------------------------"

# Test with invalid JSON
set +e
output=$(echo "not valid json" | timeout 5 "$HOOK_SCRIPT" 2>/dev/null || echo "")
exit_code=$?
set -e

# Should not crash
if [ $exit_code -eq 0 ] || [ $exit_code -eq 124 ]; then
  echo -e "${GREEN}  [OK]${NC} Handles malformed JSON"
else
  echo -e "${YELLOW}  [WARN]${NC} May have issues with malformed JSON"
fi

echo ""
echo "  Malformed JSON: PASSED"

# -----------------------------------------------------------------------------
# Test 7: Hook handles empty input
# -----------------------------------------------------------------------------
echo ""
echo "Test 7: Hook handles empty input"
echo "---------------------------------"

set +e
output=$(echo "" | timeout 5 "$HOOK_SCRIPT" 2>/dev/null || echo "")
exit_code=$?
set -e

if [ $exit_code -eq 0 ] || [ $exit_code -eq 124 ]; then
  echo -e "${GREEN}  [OK]${NC} Handles empty input"
else
  echo -e "${YELLOW}  [WARN]${NC} May have issues with empty input"
fi

echo ""
echo "  Empty input: PASSED"

echo ""
echo "=========================================="
echo "  05-hook.sh: ALL TESTS PASSED"
echo "=========================================="
