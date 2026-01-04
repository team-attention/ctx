---
description: Synchronize context registries - updates checksums and Global index
---

# CTX Sync Command

Synchronize all context registries across the 3-level system.

## Usage

```
/ctx.sync           # Smart sync (Project if found, else Global)
/ctx.sync --global  # Sync Global registry only
/ctx.sync --rebuild-index  # Force rebuild Global index
```

## Execution

Run the CLI command based on arguments:

```bash
# Parse $ARGUMENTS
if [[ "$ARGUMENTS" == *"--rebuild-index"* ]]; then
  ctx sync --rebuild-index
elif [[ "$ARGUMENTS" == *"--global"* ]]; then
  ctx sync --global
else
  ctx sync
fi
```

## Expected Output

**Project sync (normal):**
```
Syncing project contexts...
 Updated: src/api.ctx.md (checksum changed)
 Verified: .ctx/contexts/architecture.md
 Warning: Missing file removed from registry: old.ctx.md

Synced project registry (.ctx/registry.yaml)
Updated Global index (~/.ctx/registry.yaml)

Project: 5 contexts
Global index: projects/myapp updated
```

**No project (fallback to Global):**
```
No project found in current directory
Syncing global registry...

Synced global registry (~/.ctx/registry.yaml)
Global: 8 contexts

To create a project here: ctx init .
```

**Rebuild index:**
```
Rebuilding Global index...
Scanning all registered projects...

Found 3 projects:
- /Users/me/projects/app1 (5 contexts)
- /Users/me/projects/app2 (3 contexts)
- /Users/me/projects/lib (2 contexts)

Global index rebuilt: 10 project contexts indexed
```

## After Sync

Report the sync results and any issues found:

1. **New files** - Remind user to register with `ctx add`
2. **Missing files** - Files removed from registry
3. **Stale checksums** - Updated automatically
4. **Index updated** - Confirm Global index was refreshed
