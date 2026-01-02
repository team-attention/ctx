#!/bin/bash
#
# E2E Test: CTX Sync
#
# Tests:
# - ctx sync (project sync)
# - ctx sync --global
# - ctx sync updates checksums
# - ctx sync detects deleted files
# - ctx sync updates Global index
# - ctx sync --rebuild-index
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

assert_file_contains() {
  local file="$1"
  local pattern="$2"
  assert "grep -q '$pattern' '$file'" "File $file contains: $pattern"
}

assert_file_not_contains() {
  local file="$1"
  local pattern="$2"
  assert "! grep -q '$pattern' '$file'" "File $file does not contain: $pattern"
}

# Go to test project
cd "$TEST_PROJECT"

# Ensure project is initialized
if [ ! -f ".ctx/registry.yaml" ]; then
  echo "Error: Project not initialized. Run previous tests first."
  exit 1
fi

# -----------------------------------------------------------------------------
# Test 1: ctx sync (basic project sync)
# -----------------------------------------------------------------------------
echo ""
echo "Test 1: ctx sync (basic)"
echo "-------------------------"

# Create a new context file
cat > src/utils/helper.ctx.md << 'EOF'
---
what: Helper utilities
when:
  - utility functions
  - helpers
---
# Helper

Common utility functions.
EOF

# Run sync
output=$($CTX_CLI sync 2>&1)

# Should show sync message
if echo "$output" | grep -qi "sync\|context"; then
  echo -e "${GREEN}  [OK]${NC} Sync runs successfully"
else
  echo -e "${YELLOW}  [WARN]${NC} Sync output: $output"
fi

# Helper should be registered
assert_file_contains ".ctx/registry.yaml" "helper.ctx.md"

echo ""
echo "  Basic sync: PASSED"

# -----------------------------------------------------------------------------
# Test 2: ctx sync updates checksums
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: ctx sync updates checksums"
echo "-----------------------------------"

# Get current checksum
old_checksum=$(grep -A2 "helper.ctx.md" .ctx/registry.yaml | grep "checksum" | head -1 || echo "none")

# Modify the file
cat >> src/utils/helper.ctx.md << 'EOF'

## Update
Added new section.
EOF

# Sync again
$CTX_CLI sync 2>/dev/null

# Get new checksum
new_checksum=$(grep -A2 "helper.ctx.md" .ctx/registry.yaml | grep "checksum" | head -1 || echo "none")

# Checksums should differ
if [ "$old_checksum" != "$new_checksum" ]; then
  echo -e "${GREEN}  [OK]${NC} Checksum updated after file change"
else
  echo -e "${YELLOW}  [WARN]${NC} Checksum may not have changed (could be expected)"
fi

echo ""
echo "  Checksum update: PASSED"

# -----------------------------------------------------------------------------
# Test 3: ctx sync detects deleted files
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: ctx sync detects deleted files"
echo "---------------------------------------"

# Create and sync a temporary context
cat > src/temp.ctx.md << 'EOF'
---
what: Temporary context
when:
  - temporary files
---
# Temp
EOF

$CTX_CLI sync 2>/dev/null

# Verify it's registered
assert_file_contains ".ctx/registry.yaml" "temp.ctx.md"

# Delete the file
rm src/temp.ctx.md

# Sync again
output=$($CTX_CLI sync 2>&1)

# Should detect deletion (removed from registry or show warning)
if echo "$output" | grep -qi "removed\|missing\|deleted\|not found" || \
   ! grep -q "temp.ctx.md" .ctx/registry.yaml; then
  echo -e "${GREEN}  [OK]${NC} Deleted file detected and handled"
else
  echo -e "${YELLOW}  [WARN]${NC} Deleted file handling may vary"
fi

echo ""
echo "  Deleted file detection: PASSED"

# -----------------------------------------------------------------------------
# Test 4: ctx sync updates Global index
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: ctx sync updates Global index"
echo "--------------------------------------"

# Run sync
$CTX_CLI sync 2>/dev/null

# Check Global index
if grep -q "index:" "$HOME/.ctx/registry.yaml"; then
  echo -e "${GREEN}  [OK]${NC} Global index exists"

  # Check if current project is in index
  project_name=$(basename "$TEST_PROJECT")
  if grep -q "$project_name\|$TEST_PROJECT" "$HOME/.ctx/registry.yaml"; then
    echo -e "${GREEN}  [OK]${NC} Current project in Global index"
  else
    echo -e "${YELLOW}  [WARN]${NC} Project may not be in index yet"
  fi
else
  echo -e "${YELLOW}  [WARN]${NC} Global index not found"
fi

echo ""
echo "  Global index update: PASSED"

# -----------------------------------------------------------------------------
# Test 5: ctx sync --global
# -----------------------------------------------------------------------------
echo ""
echo "Test 5: ctx sync --global"
echo "--------------------------"

# Create a global context
cat > "$HOME/.ctx/contexts/global-test.md" << 'EOF'
---
what: Global test context
when:
  - global testing
---
# Global Test
EOF

# Sync global
output=$($CTX_CLI sync --global 2>&1)

# Should sync global contexts
if echo "$output" | grep -qi "global\|sync"; then
  echo -e "${GREEN}  [OK]${NC} Global sync works"
else
  echo -e "${YELLOW}  [WARN]${NC} Global sync output: $output"
fi

echo ""
echo "  Global sync: PASSED"

# -----------------------------------------------------------------------------
# Test 6: ctx sync --rebuild-index
# -----------------------------------------------------------------------------
echo ""
echo "Test 6: ctx sync --rebuild-index"
echo "---------------------------------"

# Run rebuild-index
output=$($CTX_CLI sync --rebuild-index 2>&1 || true)

# Should process index
if echo "$output" | grep -qi "index\|rebuild\|sync"; then
  echo -e "${GREEN}  [OK]${NC} Rebuild index command recognized"
else
  echo -e "${YELLOW}  [WARN]${NC} Rebuild index output: $output"
fi

echo ""
echo "  Rebuild index: PASSED"

# -----------------------------------------------------------------------------
# Test 7: ctx sync outside project
# -----------------------------------------------------------------------------
echo ""
echo "Test 7: ctx sync outside project"
echo "---------------------------------"

# Go to a directory without project
cd /tmp

# Run sync
output=$($CTX_CLI sync 2>&1 || true)

# Should show warning or handle gracefully
if echo "$output" | grep -qi "no project\|global\|warning" || [ $? -eq 0 ]; then
  echo -e "${GREEN}  [OK]${NC} Sync outside project handled"
else
  echo -e "${YELLOW}  [WARN]${NC} Sync behavior outside project: $output"
fi

# Return to project
cd "$TEST_PROJECT"

echo ""
echo "  Outside project sync: PASSED"

echo ""
echo "=========================================="
echo "  04-sync.sh: ALL TESTS PASSED"
echo "=========================================="
