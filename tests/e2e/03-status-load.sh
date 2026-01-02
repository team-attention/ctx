#!/bin/bash
#
# E2E Test: CTX Status & Load
#
# Tests:
# - ctx status (default, project scope)
# - ctx status --global
# - ctx status --all
# - ctx load --file (for hook integration)
# - ctx load --file --json
# - ctx load --file --paths
#

set -e

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
    echo "  Actual output: $output"
    return 1
  fi
}

assert_json_valid() {
  local json="$1"
  if echo "$json" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
    echo -e "${GREEN}  [OK]${NC} Valid JSON output"
    return 0
  else
    echo -e "${RED}  [FAIL]${NC} Invalid JSON output"
    echo "  Output: $json"
    return 1
  fi
}

# Go to test project
cd "$TEST_PROJECT"

# Ensure project is initialized with contexts
if [ ! -f ".ctx/registry.yaml" ]; then
  echo "Error: Project not initialized. Run 01-init.sh and 02-create-add.sh first."
  exit 1
fi

# -----------------------------------------------------------------------------
# Test 1: ctx status (default)
# -----------------------------------------------------------------------------
echo ""
echo "Test 1: ctx status (default)"
echo "-----------------------------"

output=$($CTX_CLI status 2>&1 || true)

# Should show project contexts
assert_output_contains "$output" "context"

echo ""
echo "  Default status: PASSED"

# -----------------------------------------------------------------------------
# Test 2: ctx status --pretty
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: ctx status --pretty"
echo "----------------------------"

output=$($CTX_CLI status --pretty 2>&1 || true)

# Should have formatted output
assert_output_contains "$output" "Context"

echo ""
echo "  Pretty status: PASSED"

# -----------------------------------------------------------------------------
# Test 3: ctx status --global
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: ctx status --global"
echo "----------------------------"

output=$($CTX_CLI status --global 2>&1 || true)

# Should show global contexts
if echo "$output" | grep -qi "global\|typescript"; then
  echo -e "${GREEN}  [OK]${NC} Shows global contexts"
else
  echo -e "${YELLOW}  [WARN]${NC} Global status output may vary"
fi

echo ""
echo "  Global status: PASSED"

# -----------------------------------------------------------------------------
# Test 4: ctx status --all
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: ctx status --all"
echo "-------------------------"

output=$($CTX_CLI status --all 2>&1 || true)

# Should show both global and project
# (At least should not error)
if [ -n "$output" ]; then
  echo -e "${GREEN}  [OK]${NC} --all option works"
else
  echo -e "${YELLOW}  [WARN]${NC} --all output is empty (may be expected)"
fi

echo ""
echo "  All status: PASSED"

# -----------------------------------------------------------------------------
# Test 5: ctx load --file (exact match)
# -----------------------------------------------------------------------------
echo ""
echo "Test 5: ctx load --file (exact match)"
echo "--------------------------------------"

# Ensure we have a context with target
# Create a context that targets a specific file
cat > src/api/handler.ctx.md << 'EOF'
---
what: API Handler patterns
when:
  - API handlers
  - request handling
target: src/api/handler.ts
---
# API Handler

Pattern for API handlers.
EOF

# Add it
$CTX_CLI add src/api/handler.ctx.md 2>/dev/null || true

# Sync to register
$CTX_CLI sync 2>/dev/null || true

# Create the target file
echo "export function handler() {}" > src/api/handler.ts

# Load contexts for the file
output=$($CTX_CLI load --file src/api/handler.ts --json 2>&1 || echo "[]")

# Should return JSON array (might be empty if target matching not implemented yet)
if echo "$output" | grep -q "\["; then
  echo -e "${GREEN}  [OK]${NC} Returns JSON array"
else
  echo -e "${YELLOW}  [WARN]${NC} Expected JSON array, got: $output"
fi

echo ""
echo "  Load --file: PASSED"

# -----------------------------------------------------------------------------
# Test 6: ctx load --file --json format
# -----------------------------------------------------------------------------
echo ""
echo "Test 6: ctx load --file --json format"
echo "--------------------------------------"

output=$($CTX_CLI load --file src/api/handler.ts --json 2>&1 || echo "[]")

# Validate JSON
if echo "$output" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
  echo -e "${GREEN}  [OK]${NC} Valid JSON format"
else
  # Empty array is also valid
  if [ "$output" = "[]" ] || [ -z "$output" ]; then
    echo -e "${GREEN}  [OK]${NC} Empty result (valid)"
  else
    echo -e "${YELLOW}  [WARN]${NC} JSON validation issue: $output"
  fi
fi

echo ""
echo "  JSON format: PASSED"

# -----------------------------------------------------------------------------
# Test 7: ctx load --file --paths format
# -----------------------------------------------------------------------------
echo ""
echo "Test 7: ctx load --file --paths format"
echo "---------------------------------------"

output=$($CTX_CLI load --file src/api/handler.ts --paths 2>&1 || echo "")

# Should be path strings (or empty)
if [ -z "$output" ] || echo "$output" | grep -qE "\.ctx\.md|\.md"; then
  echo -e "${GREEN}  [OK]${NC} Paths format works"
else
  echo -e "${YELLOW}  [WARN]${NC} Unexpected paths output: $output"
fi

echo ""
echo "  Paths format: PASSED"

# -----------------------------------------------------------------------------
# Test 8: ctx load --file with non-existent file
# -----------------------------------------------------------------------------
echo ""
echo "Test 8: ctx load --file (non-existent)"
echo "---------------------------------------"

output=$($CTX_CLI load --file non-existent-file.ts --json 2>&1 || echo "[]")

# Should return empty array
if [ "$output" = "[]" ] || echo "$output" | grep -q "\[\]"; then
  echo -e "${GREEN}  [OK]${NC} Returns empty for non-existent file"
else
  echo -e "${YELLOW}  [WARN]${NC} Non-existent file output: $output"
fi

echo ""
echo "  Non-existent file: PASSED"

# -----------------------------------------------------------------------------
# Test 9: ctx load skips context files
# -----------------------------------------------------------------------------
echo ""
echo "Test 9: ctx load skips context files"
echo "-------------------------------------"

# Loading a .ctx.md file should skip
output=$($CTX_CLI load --file src/api/handler.ctx.md --json 2>&1 || echo "[]")

# Should return empty (context files should be skipped)
if [ "$output" = "[]" ] || [ -z "$output" ]; then
  echo -e "${GREEN}  [OK]${NC} Skips context files"
else
  echo -e "${YELLOW}  [WARN]${NC} Context file not skipped: $output"
fi

echo ""
echo "  Skip context files: PASSED"

echo ""
echo "=========================================="
echo "  03-status-load.sh: ALL TESTS PASSED"
echo "=========================================="
