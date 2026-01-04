# Plugin Development Guide

Principles for developing Claude Code plugins (skills, commands, agents).

---

## Core Principles

@../shared/CORE_PRINCIPLE.md

> Key principle for plugins: **CLI First** (See #2)

---

## CLI Reference

### Load Context

```bash
# Search by keywords
ctx load -k api auth

# Get context for specific file
ctx load -t src/api.ts

# Paths only
ctx load -k api --paths
```

### Save Context

```bash
# Save project context
ctx save --project --path contexts/api-guide.md --content "..."

# Save global context
ctx save --global --path tips/debugging.md --content "..."

# Pass content via stdin
echo "content" | ctx save --project --path name.md --stdin
```

### Check Status

```bash
# JSON output
ctx status

# Human-readable
ctx status --pretty

# Context for specific file
ctx status --target src/api.ts
```

### Sync

```bash
ctx sync                  # Sync project registry
ctx sync --global         # Sync global registry
ctx sync --rebuild-index  # Rebuild index
```

---

## Do's and Don'ts

### DO

```bash
# Load context via ctx load
result=$(ctx load -k api)

# Save context via ctx save
ctx save --project --path contexts/new.md --content "..."

# Check status via ctx status
ctx status --pretty
```

### DON'T

```bash
# Read registry.yaml directly
cat .ctx/registry.yaml | yq ...  # Bad

# Modify registry.yaml directly
echo "..." >> .ctx/registry.yaml  # Bad

# Create files without sync
echo "..." > .ctx/contexts/new.md  # Bad (needs sync)
```

---

## Skill/Command Examples

### Good: Use CLI

```markdown
## Steps

1. Load relevant contexts:
   ```bash
   ctx load -k $KEYWORDS
   ```

2. Process and create new context:
   ```bash
   ctx save --project --path contexts/result.md --content "$CONTENT"
   ```

3. Verify:
   ```bash
   ctx status --pretty
   ```
```

### Bad: Direct File Manipulation

```markdown
## Steps

1. Parse registry:
   ```bash
   cat .ctx/registry.yaml | ...  # Don't do this
   ```

2. Write directly:
   ```bash
   echo "..." > .ctx/contexts/new.md  # Don't do this
   ```
```

---

## Exception: When Direct Access is OK

Direct access only when CLI cannot handle the task:

1. **Inbox files**: `.ctx/inbox/` is temp storage, not supported by CLI
2. **Debugging**: Inspect registry directly for troubleshooting
3. **Migration**: Schema upgrade scripts

Even then, always run `ctx sync` to ensure consistency.

---

## Related

- `../AGENTS.md` - Project-wide guide
- `shared/CLI_REFERENCE.md` - Full CLI reference
- `skills/ctx-load/SKILL.md` - ctx load skill
- `skills/ctx-save/SKILL.md` - ctx save skill
