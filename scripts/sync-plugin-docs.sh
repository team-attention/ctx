#!/bin/bash
# Sync documentation from docs/ to plugin/shared/
# This ensures Single Source of Truth - edit docs/, plugin gets copies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

DOCS_DIR="$PROJECT_ROOT/docs"
PLUGIN_SHARED="$PROJECT_ROOT/plugin/shared"

# Files to sync (add more as needed)
SYNC_FILES=(
  "cli-reference.md"
)

mkdir -p "$PLUGIN_SHARED"

echo "Syncing docs → plugin/shared..."

for file in "${SYNC_FILES[@]}"; do
  if [ -f "$DOCS_DIR/$file" ]; then
    cp "$DOCS_DIR/$file" "$PLUGIN_SHARED/$file"
    echo "  ✓ $file"
  else
    echo "  ⚠ $file not found in docs/"
  fi
done

echo "Done!"
