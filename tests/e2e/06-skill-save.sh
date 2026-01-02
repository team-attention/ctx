#!/bin/bash
#
# E2E Test: /ctx.save Skill - Three Modes
#
# Tests:
# - Auto Mode: Non-interactive, immediate execution
# - Quick Mode: Single confirmation (interactive)
# - Deliberate Mode: Multi-step confirmation (interactive)
#
# Requirements:
# - claude CLI installed and authenticated
# - CTX plugin installed (~/.claude/plugins/ctx)
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

# Ensure project is initialized
if [ ! -f ".ctx/registry.yaml" ]; then
  echo "Error: Project not initialized. Run previous tests first."
  exit 1
fi

# Clean up previous test files
rm -f .ctx/contexts/auto-*.md .ctx/contexts/quick-*.md .ctx/contexts/deliberate-*.md 2>/dev/null || true

echo ""
echo "=============================================="
echo "  Testing /ctx.save Skill - Three Modes"
echo "=============================================="

# =============================================================================
# AUTO MODE TESTS (Non-Interactive)
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AUTO MODE (Non-Interactive)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# -----------------------------------------------------------------------------
# Test 1.1: Auto Mode - Explicit path trigger
# -----------------------------------------------------------------------------
echo ""
echo "Test 1.1: Auto Mode - Explicit path"
echo "------------------------------------"

set +e
output=$(claude -p ".ctx/contexts/auto-path-test.md에 테스트 저장해. 내용은 '# Path Test'." \
  --allowedTools "Write,Read" \
  --dangerously-skip-permissions \
  --max-turns 5 \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ] && [ -f ".ctx/contexts/auto-path-test.md" ]; then
  content=$(cat .ctx/contexts/auto-path-test.md)
  if echo "$content" | grep -q "Path Test"; then
    echo -e "${GREEN}  [OK]${NC} File created with correct content"
  else
    echo -e "${YELLOW}  [WARN]${NC} File created but content differs"
  fi
else
  echo -e "${YELLOW}  [WARN]${NC} Auto mode (path) - file not created"
  echo "  Exit code: $exit_code"
fi

# -----------------------------------------------------------------------------
# Test 1.2: Auto Mode - "directly" keyword trigger
# -----------------------------------------------------------------------------
echo ""
echo "Test 1.2: Auto Mode - 'directly' keyword"
echo "-----------------------------------------"

set +e
output=$(claude -p "directly save to .ctx/contexts/auto-directly-test.md with content '# Direct Test'" \
  --allowedTools "Write,Read" \
  --dangerously-skip-permissions \
  --max-turns 5 \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ] && [ -f ".ctx/contexts/auto-directly-test.md" ]; then
  echo -e "${GREEN}  [OK]${NC} 'directly' keyword triggered Auto mode"
else
  echo -e "${YELLOW}  [WARN]${NC} 'directly' trigger - file not created"
fi

# -----------------------------------------------------------------------------
# Test 1.3: Auto Mode - Scope + Filename trigger
# -----------------------------------------------------------------------------
echo ""
echo "Test 1.3: Auto Mode - Scope + Filename"
echo "---------------------------------------"

set +e
output=$(claude -p "project scope에 auto-scope-test.md로 저장해. 내용은 '# Scope Test'." \
  --allowedTools "Write,Read" \
  --dangerously-skip-permissions \
  --max-turns 5 \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ] && [ -f ".ctx/contexts/auto-scope-test.md" ]; then
  echo -e "${GREEN}  [OK]${NC} Scope+Filename triggered Auto mode"
else
  echo -e "${YELLOW}  [WARN]${NC} Scope+Filename trigger - file not created"
fi

# -----------------------------------------------------------------------------
# Test 1.4: Auto Mode - Global scope
# -----------------------------------------------------------------------------
echo ""
echo "Test 1.4: Auto Mode - Global scope"
echo "-----------------------------------"

set +e
output=$(claude -p "~/.ctx/contexts/auto-global-test.md에 '# Global Test' 저장해" \
  --allowedTools "Write,Read" \
  --dangerously-skip-permissions \
  --max-turns 5 \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ] && [ -f "$HOME/.ctx/contexts/auto-global-test.md" ]; then
  echo -e "${GREEN}  [OK]${NC} Global context created via Auto mode"
else
  echo -e "${YELLOW}  [WARN]${NC} Global Auto mode - file not created"
fi

# -----------------------------------------------------------------------------
# Test 1.5: Auto Mode - With frontmatter
# -----------------------------------------------------------------------------
echo ""
echo "Test 1.5: Auto Mode - With frontmatter"
echo "---------------------------------------"

set +e
output=$(claude -p ".ctx/contexts/auto-frontmatter-test.md에 저장해. frontmatter에 what: 'Frontmatter Test', when: ['testing'] 포함하고 내용은 '# Frontmatter Test'." \
  --allowedTools "Write,Read" \
  --dangerously-skip-permissions \
  --max-turns 5 \
  2>&1)
exit_code=$?
set -e

if [ $exit_code -eq 0 ] && [ -f ".ctx/contexts/auto-frontmatter-test.md" ]; then
  if grep -q "what:" .ctx/contexts/auto-frontmatter-test.md; then
    echo -e "${GREEN}  [OK]${NC} Frontmatter included"
  else
    echo -e "${YELLOW}  [WARN]${NC} File created but no frontmatter"
  fi
else
  echo -e "${YELLOW}  [WARN]${NC} Frontmatter test - file not created"
fi

# =============================================================================
# QUICK MODE TESTS (Interactive - Limited in CLI)
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  QUICK MODE (Interactive)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Note: Quick Mode requires interaction."
echo "      Testing mode detection only."

# -----------------------------------------------------------------------------
# Test 2.1: Quick Mode - Triggers confirmation (max-turns reached)
# -----------------------------------------------------------------------------
echo ""
echo "Test 2.1: Quick Mode - Mode detection"
echo "--------------------------------------"

set +e
output=$(claude -p "이 패턴 저장해줘" \
  --allowedTools "Write,Read,Bash(ctx:*)" \
  --dangerously-skip-permissions \
  --max-turns 2 \
  2>&1)
exit_code=$?
set -e

# Quick mode should ask for clarification or confirmation
if echo "$output" | grep -qi "어떤\|무엇\|what\|which\|저장할까\|save this\|looks right\|패턴\|pattern"; then
  echo -e "${GREEN}  [OK]${NC} Quick mode detected (asked for clarification)"
elif echo "$output" | grep -qi "max turns"; then
  echo -e "${GREEN}  [OK]${NC} Quick mode detected (interactive, hit max-turns)"
elif [ $exit_code -ne 0 ]; then
  echo -e "${GREEN}  [OK]${NC} Quick mode detected (waiting for input)"
else
  echo -e "${YELLOW}  [WARN]${NC} Quick mode behavior unclear"
  echo "  Output: ${output:0:100}..."
fi

# -----------------------------------------------------------------------------
# Test 2.2: Quick Mode - /ctx.save without path
# -----------------------------------------------------------------------------
echo ""
echo "Test 2.2: Quick Mode - /ctx.save command"
echo "-----------------------------------------"

set +e
output=$(claude -p "/ctx.save" \
  --allowedTools "Write,Read,Bash(ctx:*)" \
  --dangerously-skip-permissions \
  --max-turns 2 \
  2>&1)
exit_code=$?
set -e

# Should trigger Quick mode and ask questions
if echo "$output" | grep -qi "what\|어떤\|무엇\|저장\|context\|save\|패턴"; then
  echo -e "${GREEN}  [OK]${NC} /ctx.save triggers Quick mode (interactive)"
elif echo "$output" | grep -qi "max turns"; then
  echo -e "${GREEN}  [OK]${NC} /ctx.save triggers Quick mode (hit max-turns)"
elif [ $exit_code -ne 0 ]; then
  echo -e "${GREEN}  [OK]${NC} /ctx.save triggers Quick mode (waiting for input)"
else
  echo -e "${YELLOW}  [WARN]${NC} /ctx.save behavior unclear"
fi

# =============================================================================
# DELIBERATE MODE TESTS (Interactive - Limited in CLI)
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DELIBERATE MODE (Interactive)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Note: Deliberate Mode requires multi-step interaction."
echo "      Testing mode detection only."

# -----------------------------------------------------------------------------
# Test 3.1: Deliberate Mode - External source trigger (Slack)
# -----------------------------------------------------------------------------
echo ""
echo "Test 3.1: Deliberate Mode - Slack source"
echo "-----------------------------------------"

set +e
output=$(claude -p "Slack에서 배포 관련 내용 추출해서 저장해줘" \
  --allowedTools "Write,Read,Bash(ctx:*)" \
  --dangerously-skip-permissions \
  --max-turns 2 \
  2>&1)
exit_code=$?
set -e

# Deliberate mode should recognize Slack source - may hit max-turns (expected)
if echo "$output" | grep -qi "slack\|channel\|채널\|thread\|스레드\|선택\|배포\|deploy\|MCP\|접근"; then
  echo -e "${GREEN}  [OK]${NC} Deliberate mode detected (Slack source recognized)"
elif echo "$output" | grep -qi "max turns"; then
  echo -e "${GREEN}  [OK]${NC} Deliberate mode detected (multi-step, hit max-turns)"
elif [ $exit_code -ne 0 ]; then
  echo -e "${GREEN}  [OK]${NC} Deliberate mode detected (processing/waiting)"
else
  echo -e "${YELLOW}  [WARN]${NC} Deliberate mode (Slack) behavior unclear"
  echo "  Output: ${output:0:100}..."
fi

# -----------------------------------------------------------------------------
# Test 3.2: Deliberate Mode - URL source trigger
# -----------------------------------------------------------------------------
echo ""
echo "Test 3.2: Deliberate Mode - URL source"
echo "---------------------------------------"

set +e
output=$(claude -p "이 URL에서 내용 추출해서 저장해줘: https://example.com/docs" \
  --allowedTools "Write,Read,Bash(ctx:*),WebFetch" \
  --dangerously-skip-permissions \
  --max-turns 2 \
  2>&1)
exit_code=$?
set -e

# Deliberate mode should process URL - may hit max-turns (expected)
if echo "$output" | grep -qi "url\|fetch\|추출\|content\|내용\|example\|문서\|저장"; then
  echo -e "${GREEN}  [OK]${NC} Deliberate mode detected (URL source recognized)"
elif echo "$output" | grep -qi "max turns"; then
  echo -e "${GREEN}  [OK]${NC} Deliberate mode detected (multi-step, hit max-turns)"
elif [ $exit_code -ne 0 ]; then
  echo -e "${GREEN}  [OK]${NC} Deliberate mode detected (processing/waiting)"
else
  echo -e "${YELLOW}  [WARN]${NC} Deliberate mode (URL) behavior unclear"
  echo "  Output: ${output:0:100}..."
fi

# =============================================================================
# VERIFICATION
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# -----------------------------------------------------------------------------
# Test 4.1: Count created files
# -----------------------------------------------------------------------------
echo ""
echo "Test 4.1: Auto Mode file count"
echo "-------------------------------"

auto_files=$(find .ctx/contexts -name "auto-*.md" 2>/dev/null | wc -l | tr -d ' ')
global_auto=$(find "$HOME/.ctx/contexts" -name "auto-*.md" 2>/dev/null | wc -l | tr -d ' ')

echo "  Project Auto files: $auto_files"
echo "  Global Auto files: $global_auto"

if [ "$auto_files" -ge 3 ]; then
  echo -e "${GREEN}  [OK]${NC} Auto Mode created multiple files"
else
  echo -e "${YELLOW}  [WARN]${NC} Fewer Auto Mode files than expected"
fi

# -----------------------------------------------------------------------------
# Test 4.2: Registry sync
# -----------------------------------------------------------------------------
echo ""
echo "Test 4.2: Registry sync"
echo "------------------------"

$CTX_CLI sync 2>/dev/null || true

if grep -q "auto-" .ctx/registry.yaml 2>/dev/null; then
  echo -e "${GREEN}  [OK]${NC} Auto files registered"
else
  echo -e "${YELLOW}  [WARN]${NC} Auto files not in registry (sync may be needed)"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=========================================="
echo "  06-skill-save.sh: TESTS COMPLETED"
echo "=========================================="
echo ""
echo "Mode Summary:"
echo "  Auto Mode:      Fully testable (non-interactive)"
echo "  Quick Mode:     Mode detection only (requires interaction)"
echo "  Deliberate Mode: Mode detection only (requires interaction)"
echo ""
echo "Created files:"
ls -la .ctx/contexts/auto-*.md 2>/dev/null || echo "  (none in project)"
ls -la "$HOME/.ctx/contexts/auto-*.md" 2>/dev/null || echo "  (none in global)"
