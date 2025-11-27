---
description: Sync context registry (mechanical operation)
argument-hint: [--local|--global]
---

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
- `ctx/local-context-registry.yml`
- `ctx/global-context-registry.yml`
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
- Scans `*.ctx.yml` and `ctx/**/*.md` files
- Computes checksums for change detection
- Updates registry files (`ctx/local-context-registry.yml`, `ctx/global-context-registry.yml`)
- NO AI logic, just file I/O

**When to use:**
- After creating/editing context files
- Before running `/ctx.validate`
- Periodically to keep registry fresh

**Note:** Sync is fast (~1s), idempotent, and safe to run anytime.

# Reference Documents

- Registries: `ctx/local-context-registry.yml`, `ctx/global-context-registry.yml`

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
- `ctx/local-context-registry.yml`
- `ctx/global-context-registry.yml`
```

```
User: /ctx.sync --local

AI:
[Runs: ctx sync --local]

## ✓ Sync Complete

**Results**:
- ✓ Synced 45 local context(s)

**Updated Files**:
- `ctx/local-context-registry.yml`
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
- src/old.ctx.yml: Target file not found
- ctx/broken.md: Invalid frontmatter

**Recommendation**:
- Remove src/old.ctx.yml (target deleted)
- Fix ctx/broken.md frontmatter
- Run `/ctx.sync` again
```
