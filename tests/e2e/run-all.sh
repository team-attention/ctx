#!/bin/bash
#
# CTX 3-Level System E2E Tests
#
# Usage: ./tests/e2e/run-all.sh [options]
#
# Options:
#   --keep    Keep test directories after tests (for debugging)
#   --verbose Show detailed output
#   --only N  Run only test N (e.g., --only 01)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Test directories
export TEST_HOME="/tmp/ctx-e2e-home-$$"
export TEST_PROJECT="/tmp/ctx-e2e-project-$$"
export CTX_CLI="node $PROJECT_ROOT/dist/bin/ctx.js"

# Options
KEEP_DIRS=false
VERBOSE=false
ONLY_TEST=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --keep)
      KEEP_DIRS=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --only)
      ONLY_TEST="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Test results
PASSED=0
FAILED=0
SKIPPED=0

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  PASSED=$((PASSED + 1))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  FAILED=$((FAILED + 1))
}

log_skip() {
  echo -e "${YELLOW}[SKIP]${NC} $1"
  SKIPPED=$((SKIPPED + 1))
}

log_section() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

# Setup test environment
setup() {
  log_section "Setting up test environment"

  # Backup existing ~/.ctx if exists
  if [ -d "$HOME/.ctx" ]; then
    log_info "Backing up existing ~/.ctx to ~/.ctx.backup.$$"
    mv "$HOME/.ctx" "$HOME/.ctx.backup.$$"
  fi

  # Create test directories
  mkdir -p "$TEST_HOME"
  mkdir -p "$TEST_PROJECT"

  # Override HOME for Global ctx
  export ORIGINAL_HOME="$HOME"
  export HOME="$TEST_HOME"

  log_info "TEST_HOME: $TEST_HOME"
  log_info "TEST_PROJECT: $TEST_PROJECT"
  log_info "CTX_CLI: $CTX_CLI"

  # Ensure CLI is built
  if [ ! -f "$PROJECT_ROOT/dist/bin/ctx.js" ]; then
    log_info "Building CTX CLI..."
    cd "$PROJECT_ROOT" && pnpm build
  fi
}

# Cleanup test environment
cleanup() {
  log_section "Cleaning up"

  # Restore HOME
  export HOME="$ORIGINAL_HOME"

  if [ "$KEEP_DIRS" = true ]; then
    log_info "Keeping test directories (--keep flag)"
    log_info "  TEST_HOME: $TEST_HOME"
    log_info "  TEST_PROJECT: $TEST_PROJECT"
  else
    rm -rf "$TEST_HOME" "$TEST_PROJECT"
    log_info "Test directories removed"
  fi

  # Restore ~/.ctx if backed up
  if [ -d "$HOME/.ctx.backup.$$" ]; then
    log_info "Restoring ~/.ctx from backup"
    rm -rf "$HOME/.ctx"
    mv "$HOME/.ctx.backup.$$" "$HOME/.ctx"
  fi
}

# Run a test script
run_test() {
  local test_script="$1"
  local test_name=$(basename "$test_script" .sh)

  if [ -n "$ONLY_TEST" ] && [[ ! "$test_name" == *"$ONLY_TEST"* ]]; then
    log_skip "$test_name (filtered out)"
    return
  fi

  log_section "Running: $test_name"

  # Export helper functions for test scripts
  export -f log_info log_success log_fail log_skip
  export RED GREEN YELLOW BLUE NC

  if bash "$test_script"; then
    log_success "$test_name completed"
  else
    log_fail "$test_name failed"
  fi
}

# Main
main() {
  echo ""
  echo "=================================================="
  echo "  CTX 3-Level System E2E Tests"
  echo "=================================================="
  echo ""

  # Trap cleanup on exit
  trap cleanup EXIT

  # Setup
  setup

  # Run tests in order
  for test_script in "$SCRIPT_DIR"/[0-9][0-9]-*.sh; do
    if [ -f "$test_script" ]; then
      run_test "$test_script"
    fi
  done

  # Summary
  log_section "Test Summary"
  echo -e "  ${GREEN}Passed:${NC}  $PASSED"
  echo -e "  ${RED}Failed:${NC}  $FAILED"
  echo -e "  ${YELLOW}Skipped:${NC} $SKIPPED"
  echo ""

  if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
  else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
  fi
}

main "$@"
