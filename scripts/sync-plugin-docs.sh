#!/bin/bash
# Sync shared/ to plugin/shared/
# This ensures Single Source of Truth - edit shared/, plugin gets copies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SHARED_DIR="$PROJECT_ROOT/shared"
PLUGIN_SHARED="$PROJECT_ROOT/plugin/shared"

mkdir -p "$PLUGIN_SHARED"

echo "Syncing shared/ → plugin/shared/..."

# Sync all files from shared/ to plugin/shared/
for file in "$SHARED_DIR"/*; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    cp "$file" "$PLUGIN_SHARED/$filename"
    echo "  ✓ $filename"
  fi
done

echo "Done!"
