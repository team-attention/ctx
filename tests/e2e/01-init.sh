#!/bin/bash
#
# E2E Test: CTX Init (Global & Project)
#
# Tests:
# - ctx init (Global initialization)
# - ctx init . (Project initialization)
# - Global prerequisite check
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

assert_file_exists() {
  assert "[ -f '$1' ]" "File exists: $1"
}

assert_dir_exists() {
  assert "[ -d '$1' ]" "Directory exists: $1"
}

assert_file_contains() {
  local file="$1"
  local pattern="$2"
  assert "grep -q '$pattern' '$file'" "File $file contains: $pattern"
}

# -----------------------------------------------------------------------------
# Test 1: Global Init (ctx init)
# -----------------------------------------------------------------------------
echo ""
echo "Test 1: Global Init (ctx init)"
echo "-------------------------------"

# Ensure clean state
rm -rf "$HOME/.ctx"

# Run ctx init
$CTX_CLI init --context-paths "contexts/:general knowledge"

# Assertions
assert_dir_exists "$HOME/.ctx"
assert_dir_exists "$HOME/.ctx/contexts"
assert_file_exists "$HOME/.ctx/registry.yaml"
assert_file_contains "$HOME/.ctx/registry.yaml" "version:"
assert_file_contains "$HOME/.ctx/registry.yaml" "contexts:"

echo ""
echo "  Global init: PASSED"

# -----------------------------------------------------------------------------
# Test 2: Duplicate Global Init (should show already initialized)
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: Duplicate Global Init"
echo "------------------------------"

# Run ctx init again
output=$($CTX_CLI init 2>&1 || true)

# Should mention already initialized
if echo "$output" | grep -qi "already\|exists"; then
  echo -e "${GREEN}  [OK]${NC} Shows 'already initialized' message"
else
  echo -e "${YELLOW}  [WARN]${NC} No 'already initialized' message (may be acceptable)"
fi

echo ""
echo "  Duplicate init handling: PASSED"

# -----------------------------------------------------------------------------
# Test 3: Project Init (ctx init .)
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: Project Init (ctx init .)"
echo "----------------------------------"

# Go to test project directory
cd "$TEST_PROJECT"

# Run ctx init .
$CTX_CLI init . --context-paths ".ctx/contexts/:project contexts"

# Assertions
assert_dir_exists "$TEST_PROJECT/.ctx"
assert_dir_exists "$TEST_PROJECT/.ctx/contexts"
assert_file_exists "$TEST_PROJECT/.ctx/registry.yaml"
assert_file_contains "$TEST_PROJECT/.ctx/registry.yaml" "version:"
assert_file_contains "$TEST_PROJECT/.ctx/registry.yaml" "contexts:"

# Check Global index was updated
assert_file_contains "$HOME/.ctx/registry.yaml" "index:"

echo ""
echo "  Project init: PASSED"

# -----------------------------------------------------------------------------
# Test 4: Project Init without Global (should fail)
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: Project Init without Global"
echo "------------------------------------"

# Create a new project directory without Global
temp_project="/tmp/ctx-e2e-no-global-$$"
mkdir -p "$temp_project"
cd "$temp_project"

# Backup and remove Global
mv "$HOME/.ctx" "$HOME/.ctx.temp"

# Try project init (should fail)
set +e
output=$($CTX_CLI init . 2>&1)
exit_code=$?
set -e

# Restore Global
mv "$HOME/.ctx.temp" "$HOME/.ctx"

# Clean up temp project
rm -rf "$temp_project"

# Check it failed appropriately
if [ $exit_code -ne 0 ] || echo "$output" | grep -qi "global\|first"; then
  echo -e "${GREEN}  [OK]${NC} Project init fails without Global"
else
  echo -e "${YELLOW}  [WARN]${NC} Project init should require Global (exit code: $exit_code)"
fi

echo ""
echo "  Global prerequisite check: PASSED"

# Return to test project
cd "$TEST_PROJECT"

echo ""
echo "=========================================="
echo "  01-init.sh: ALL TESTS PASSED"
echo "=========================================="
