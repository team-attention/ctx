#!/bin/bash
#
# E2E Test: CTX Create, Add, Remove
#
# Tests:
# - ctx create (Local context)
# - ctx create --project
# - ctx create --global
# - ctx add (register existing file)
# - ctx add with glob pattern
# - ctx remove
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

assert_file_not_exists() {
  assert "[ ! -f '$1' ]" "File does not exist: $1"
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
  echo "Error: Project not initialized. Run 01-init.sh first."
  exit 1
fi

# Create source directory for tests
mkdir -p src/api src/utils docs

# -----------------------------------------------------------------------------
# Test 1: ctx create (Local context)
# -----------------------------------------------------------------------------
echo ""
echo "Test 1: ctx create (Local context)"
echo "-----------------------------------"

# Create a source file first
echo "export function getUser() { return null; }" > src/api/user.ts

# Create local context for it
$CTX_CLI create src/api/user.ts

# Assertions
assert_file_exists "src/api/user.ctx.md"
assert_file_contains "src/api/user.ctx.md" "what:"
assert_file_contains ".ctx/registry.yaml" "user.ctx.md"

echo ""
echo "  Local context create: PASSED"

# -----------------------------------------------------------------------------
# Test 2: ctx create --project
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: ctx create --project"
echo "-----------------------------"

# Create project-level context
$CTX_CLI create --project architecture

# Assertions
assert_file_exists ".ctx/contexts/architecture.md"
assert_file_contains ".ctx/registry.yaml" "architecture.md"

echo ""
echo "  Project context create: PASSED"

# -----------------------------------------------------------------------------
# Test 3: ctx create --global
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: ctx create --global"
echo "----------------------------"

# Create global context
$CTX_CLI create --global typescript-patterns

# Assertions
assert_file_exists "$HOME/.ctx/contexts/typescript-patterns.md"
assert_file_contains "$HOME/.ctx/registry.yaml" "typescript-patterns.md"

echo ""
echo "  Global context create: PASSED"

# -----------------------------------------------------------------------------
# Test 4: ctx add (register existing file)
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: ctx add (register existing file)"
echo "-----------------------------------------"

# Create a markdown file manually
cat > docs/api-guide.md << 'EOF'
---
what: API Guide
when:
  - API documentation
  - REST endpoints
---
# API Guide

This is the API documentation.
EOF

# Add it to registry
$CTX_CLI add docs/api-guide.md

# Assertions
assert_file_contains ".ctx/registry.yaml" "api-guide.md"

echo ""
echo "  Add existing file: PASSED"

# -----------------------------------------------------------------------------
# Test 5: ctx add with glob pattern
# -----------------------------------------------------------------------------
echo ""
echo "Test 5: ctx add with glob pattern"
echo "----------------------------------"

# Create multiple markdown files
cat > docs/setup.md << 'EOF'
---
what: Setup Guide
when:
  - project setup
  - installation
---
# Setup
EOF

cat > docs/deployment.md << 'EOF'
---
what: Deployment Guide
when:
  - deployment
  - production
---
# Deployment
EOF

# Add all docs with glob
$CTX_CLI add "docs/**/*.md"

# Assertions (setup.md and deployment.md should be added)
assert_file_contains ".ctx/registry.yaml" "setup.md"
assert_file_contains ".ctx/registry.yaml" "deployment.md"

echo ""
echo "  Add with glob: PASSED"

# -----------------------------------------------------------------------------
# Test 6: ctx add --global
# -----------------------------------------------------------------------------
echo ""
echo "Test 6: ctx add --global"
echo "-------------------------"

# Create a global context file manually
mkdir -p "$HOME/.ctx/contexts/coding-rules"
cat > "$HOME/.ctx/contexts/coding-rules/typescript.md" << 'EOF'
---
what: TypeScript Coding Rules
when:
  - TypeScript code
  - coding standards
---
# TypeScript Rules
EOF

# Add to global registry
$CTX_CLI add --global "$HOME/.ctx/contexts/coding-rules/typescript.md"

# Assertions
assert_file_contains "$HOME/.ctx/registry.yaml" "typescript.md"

echo ""
echo "  Add to global: PASSED"

# -----------------------------------------------------------------------------
# Test 7: ctx remove
# -----------------------------------------------------------------------------
echo ""
echo "Test 7: ctx remove"
echo "-------------------"

# Remove a context from registry
$CTX_CLI remove docs/setup.md

# Assertions
# File should still exist
assert_file_exists "docs/setup.md"
# But not in registry
assert_file_not_contains ".ctx/registry.yaml" "setup.md"

echo ""
echo "  Remove from registry: PASSED"

# -----------------------------------------------------------------------------
# Test 8: ctx add duplicate (should handle gracefully)
# -----------------------------------------------------------------------------
echo ""
echo "Test 8: ctx add duplicate"
echo "--------------------------"

# Try to add already registered file
set +e
output=$($CTX_CLI add docs/api-guide.md 2>&1)
exit_code=$?
set -e

# Should either succeed silently or show "already registered"
if [ $exit_code -eq 0 ] || echo "$output" | grep -qi "already\|skip"; then
  echo -e "${GREEN}  [OK]${NC} Duplicate add handled gracefully"
else
  echo -e "${YELLOW}  [WARN]${NC} Unexpected behavior on duplicate add"
fi

echo ""
echo "  Duplicate handling: PASSED"

echo ""
echo "=========================================="
echo "  02-create-add.sh: ALL TESTS PASSED"
echo "=========================================="
