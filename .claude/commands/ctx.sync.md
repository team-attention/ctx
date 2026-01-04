---
description: Sync context registry (mechanical operation)
argument-hint: [--local|--global]
---

## Runtime Config Resolution

Before executing this command, read `ctx.config.yaml` from the project root to resolve configuration variables.

**Config Variables Used:**
| Variable | Config Path | Default |
|----------|-------------|---------|
| `{{global.directory}}` | `global.directory` | `ctx` |
| `{{work.directory}}` | `work.directory` | `.worktrees` |
| `{{work.issue_store.type}}` | `work.issue_store.type` | `local` |
| `{{work.issue_store.url}}` | `work.issue_store.url` | - |
| `{{work.issue_store.project}}` | `work.issue_store.project` | - |

**How to resolve:**
1. Read `ctx.config.yaml` using the Read tool
2. Parse YAML content
3. Replace `{{variable}}` placeholders with actual config values
4. Use defaults if config values are not set


You are assisting with syncing the context registry.

# Arguments

**$ARGUMENTS**: Optional flags (default: sync both)
- `--local` - Sync local contexts only
- `--global` - Sync global contexts only
- (no args) - Sync both local and global

# Your Task

Run the sync command and report results clearly.

# Workflow

## Step 1: Determine Scope

Parse $ARGUMENTS to determine flags:
- No args → `ctx sync`
- `--local` → `ctx sync --local`
- `--global` → `ctx sync --global`

## Step 2: Execute Command

Run the appropriate `ctx sync` command.

## Step 3: Report Results

Parse the command output and present a clear summary to the user.

### If Successful:
```markdown
## ✓ Sync Complete

**Results**:
- ✓ Synced X local context(s)
- ✓ Synced Y global context(s)

**Updated Files**:
- `{{global.directory}}/local-context-registry.yml`
- `{{global.directory}}/global-context-registry.yml`
```

### If Warnings:
```markdown
## ⚠️ Sync Completed with Warnings

**Results**:
- ✓ Synced X context(s)
- ⚠️ Y warning(s)

**Warnings**:
[List warnings from command output]

**Recommendation**:
- Fix the issues listed above
- Run `/ctx.sync` again to include skipped files
```

# What Sync Does (Background Info)

**Mechanical operation only:**
- Scans `*.ctx.md` and `ctx/**/*.md` files
- Computes checksums for change detection
- Updates registry files (`{{global.directory}}/local-context-registry.yml`, `{{global.directory}}/global-context-registry.yml`)
- NO AI logic, just file I/O

**When to use:**
- After creating/editing context files
- Before running `/ctx.audit`
- Periodically to keep registry fresh

**Note:** Sync is fast (~1s), idempotent, and safe to run anytime.

# Reference Documents

- Registries: `{{global.directory}}/local-context-registry.yml`, `{{global.directory}}/global-context-registry.yml`

# Example Interactions

```
User: /ctx.sync

AI:
[Runs: ctx sync]

## ✓ Sync Complete

**Results**:
- ✓ Synced 45 local context(s)
- ✓ Synced 12 global context(s)

**Updated Files**:
- `{{global.directory}}/local-context-registry.yml`
- `{{global.directory}}/global-context-registry.yml`
```

```
User: /ctx.sync --local

AI:
[Runs: ctx sync --local]

## ✓ Sync Complete

**Results**:
- ✓ Synced 45 local context(s)

**Updated Files**:
- `{{global.directory}}/local-context-registry.yml`
```

```
User: /ctx.sync

AI:
[Runs: ctx sync]

## ⚠️ Sync Completed with Warnings

**Results**:
- ✓ Synced 43 context(s)
- ⚠️ 2 warning(s)

**Warnings**:
- src/old.ctx.md: Target file not found
- ctx/broken.md: Invalid frontmatter

**Recommendation**:
- Remove src/old.ctx.md (target deleted)
- Fix ctx/broken.md frontmatter
- Run `/ctx.sync` again
```
