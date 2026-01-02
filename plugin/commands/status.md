---
description: Show context status - registered contexts, health, and statistics
---

# CTX Status Command

Display status of context registries and registered contexts.

## Usage

```
/ctx.status           # Current project status
/ctx.status --global  # Global contexts only
/ctx.status --all     # All contexts across all projects
/ctx.status --json    # Machine-readable output
```

## Execution

Run the CLI command based on arguments:

```bash
# Parse $ARGUMENTS
if [[ "$ARGUMENTS" == *"--all"* ]]; then
  npx ctx status --all
elif [[ "$ARGUMENTS" == *"--global"* ]]; then
  npx ctx status --global
elif [[ "$ARGUMENTS" == *"--json"* ]]; then
  npx ctx status --json
else
  npx ctx status
fi
```

## Expected Output

**Project status (normal):**
```
CTX Status

Project: /Users/me/projects/myapp
Registry: .ctx/registry.yaml

Context Paths (from settings):
  .ctx/contexts/  - Project architecture, design docs
  docs/           - API documentation

Contexts:
  Local (3):
    src/api.ctx.md → src/api.ts
    src/auth/middleware.ctx.md → src/auth/middleware.ts
    src/services/ctx.md → src/services/

  Project (2):
    .ctx/contexts/architecture.md
    .ctx/contexts/auth.md

Last synced: 2 hours ago

Health:
  All contexts up to date
```

**Global status:**
```
CTX Global Status

Location: ~/.ctx/
Registry: ~/.ctx/registry.yaml

Context Paths:
  contexts/  - General personal contexts
  rules/     - Coding rules and style guides
  tools/     - Tool usage patterns

Contexts (8):
  contexts/coding-style.md
  contexts/git-workflow.md
  rules/typescript.md
  tools/docker.md
  ...

Indexed Projects (3):
  projects/app1 - 5 contexts
  projects/app2 - 3 contexts
  projects/lib  - 2 contexts

Last synced: 30 minutes ago
```

**All status (cross-project):**
```
CTX All Contexts

Global (~/.ctx/):
  8 contexts

Projects (via index):
  /Users/me/projects/app1: 5 contexts
  /Users/me/projects/app2: 3 contexts
  /Users/me/projects/lib:  2 contexts

Current Project (/Users/me/projects/app1):
  Local: 3 contexts
  Project: 2 contexts

Total: 18 contexts across 4 locations
```

## Health Indicators

- **Fresh** - File unchanged since last sync
- **Stale** - File modified, needs sync
- **Missing** - Registered but file not found
- **Orphan** - File exists but not registered

## Suggestions

Based on status, provide actionable suggestions:

```
Suggestions:
  Run `ctx sync` to update 2 stale contexts
  Run `ctx add src/new.ctx.md` to register new context
  Run `ctx remove old.ctx.md` to clean up missing file
```
