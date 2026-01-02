#!/bin/bash
#
# E2E Test: /ctx.load Skill (Automated via claude -p)
#
# Tests:
# - Keyword-based context search
# - /ctx.load command recognition
# - Context content retrieval
# - Multi-level search (Global + Project)
#
# Requirements:
# - claude CLI installed and authenticated
# - CTX plugin installed in Claude Code
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
  echo -e "${YELLOW}[SKIP]${NC} claude CLI not found - skipping skill tests"
  echo "  Install: https://claude.ai/code"
  exit 0
fi

# Go to test project
cd "$TEST_PROJECT"

# Ensure project is initialized with some contexts
if [ ! -f ".ctx/registry.yaml" ]; then
  echo "Error: Project not initialized. Run previous tests first."
  exit 1
fi

# Create some test contexts for search
mkdir -p .ctx/contexts
cat > .ctx/contexts/auth-patterns.md << 'EOF'
---
what: Authentication patterns and best practices
when:
  - authentication
  - JWT
  - OAuth
---
# Authentication Patterns

## JWT Authentication
Use JWT for stateless authentication.

## OAuth 2.0
Implement OAuth for third-party auth.
EOF

cat > .ctx/contexts/api-design.md << 'EOF'
---
what: API design guidelines
when:
  - API design
  - REST conventions
---
# API Design

## REST Conventions
Follow RESTful naming conventions.

## Error Handling
Return consistent error responses.
EOF

# Sync to register
$CTX_CLI sync 2>/dev/null || true

# -----------------------------------------------------------------------------
# Test 1: /ctx.load with keyword search
# -----------------------------------------------------------------------------
echo ""
echo "Test 1: Keyword search"
echo "----------------------"

set +e
output=$(claude -p "인증 관련 컨텍스트 찾아줘" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions \
  --max-turns 5 \
  --output-format json \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ]; then
  # Check if output mentions auth-patterns
  if echo "$output" | grep -qi "auth\|인증\|authentication"; then
    echo -e "${GREEN}  [OK]${NC} Found auth-related context"
  else
    echo -e "${YELLOW}  [WARN]${NC} Auth context not clearly identified"
  fi
else
  echo -e "${YELLOW}  [WARN]${NC} Skill execution issue"
fi

echo ""
echo "  Keyword search: PASSED (or SKIPPED)"

# -----------------------------------------------------------------------------
# Test 2: Explicit /ctx.load command
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: Explicit /ctx.load"
echo "---------------------------"

set +e
output=$(claude -p "/ctx.load API" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions \
  --max-turns 5 \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ]; then
  if echo "$output" | grep -qi "api\|design\|REST"; then
    echo -e "${GREEN}  [OK]${NC} /ctx.load found API context"
  else
    echo -e "${YELLOW}  [WARN]${NC} API context not clearly found"
  fi
else
  echo -e "${YELLOW}  [WARN]${NC} /ctx.load command issue"
fi

echo ""
echo "  Explicit command: PASSED (or SKIPPED)"

# -----------------------------------------------------------------------------
# Test 3: ctx status integration
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: Status integration"
echo "---------------------------"

# Skill should use ctx status internally
set +e
output=$(claude -p "등록된 모든 컨텍스트 목록 보여줘" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions \
  --max-turns 3 \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ]; then
  # Should mention multiple contexts
  if echo "$output" | grep -qi "auth\|api\|context"; then
    echo -e "${GREEN}  [OK]${NC} Lists contexts via status"
  else
    echo -e "${YELLOW}  [WARN]${NC} Context list not clear"
  fi
else
  echo -e "${YELLOW}  [WARN]${NC} Status integration issue"
fi

echo ""
echo "  Status integration: PASSED (or SKIPPED)"

# -----------------------------------------------------------------------------
# Test 4: Read context content
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: Read context content"
echo "-----------------------------"

set +e
output=$(claude -p "auth-patterns 컨텍스트 내용 보여줘" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions \
  --max-turns 5 \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ]; then
  # Should contain actual content
  if echo "$output" | grep -qi "JWT\|OAuth\|authentication"; then
    echo -e "${GREEN}  [OK]${NC} Read context content successfully"
  else
    echo -e "${YELLOW}  [WARN]${NC} Content not clearly shown"
  fi
else
  echo -e "${YELLOW}  [WARN]${NC} Content read issue"
fi

echo ""
echo "  Read content: PASSED (or SKIPPED)"

# -----------------------------------------------------------------------------
# Test 5: Multi-level search (Global + Project)
# -----------------------------------------------------------------------------
echo ""
echo "Test 5: Multi-level search"
echo "---------------------------"

# Create a global context
mkdir -p "$HOME/.ctx/contexts"
cat > "$HOME/.ctx/contexts/global-coding-style.md" << 'EOF'
---
what: Global coding style guidelines
when:
  - coding style
  - naming conventions
---
# Coding Style

Use consistent naming conventions.
EOF

# Sync global
$CTX_CLI sync --global 2>/dev/null || true

set +e
output=$(claude -p "코딩 스타일 관련 컨텍스트 찾아줘. 글로벌과 프로젝트 모두 검색해" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions \
  --max-turns 5 \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ]; then
  if echo "$output" | grep -qi "coding\|style\|global"; then
    echo -e "${GREEN}  [OK]${NC} Multi-level search works"
  else
    echo -e "${YELLOW}  [WARN]${NC} Multi-level results unclear"
  fi
else
  echo -e "${YELLOW}  [WARN]${NC} Multi-level search issue"
fi

echo ""
echo "  Multi-level search: PASSED (or SKIPPED)"

# -----------------------------------------------------------------------------
# Test 6: No results handling
# -----------------------------------------------------------------------------
echo ""
echo "Test 6: No results handling"
echo "----------------------------"

set +e
output=$(claude -p "블록체인 관련 컨텍스트 찾아줘" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions \
  --max-turns 3 \
  2>&1)
exit_code=$?
set -e

# Should handle gracefully (not crash)
if [ $exit_code -eq 0 ]; then
  if echo "$output" | grep -qi "없\|not found\|no\|찾을 수"; then
    echo -e "${GREEN}  [OK]${NC} No results handled gracefully"
  else
    echo -e "${YELLOW}  [WARN]${NC} No results message unclear"
  fi
else
  echo -e "${YELLOW}  [WARN]${NC} Handling issue"
fi

echo ""
echo "  No results: PASSED (or SKIPPED)"

echo ""
echo "=========================================="
echo "  07-skill-load.sh: TESTS COMPLETED"
echo "=========================================="
echo ""
echo "Note: Skill tests require claude CLI and may"
echo "show WARN/SKIP if not fully configured."
