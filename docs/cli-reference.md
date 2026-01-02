# CTX CLI Reference

Shared CLI reference for CTX plugin skills.

## Commands Overview

| Command | Description | Key Options |
|---------|-------------|-------------|
| `ctx init` | Initialize context management | - |
| `ctx status` | Show context status (JSON) | `--pretty`, `--target <path>` |
| `ctx sync` | Sync context files to registries | `--local`, `--global` |
| `ctx check` | Check context health/freshness | `--local`, `--global`, `--path <file>`, `--fix`, `--pretty` |
| `ctx create <target>` | Create new context file | `--template <type>`, `--force`, `--global` |
| `ctx refresh` | Refresh AI commands with config | - |
| `ctx session [file]` | Extract Claude session messages | `--role <user\|assistant>`, `--format <jsonl\|text\|markdown>` |

---

## Detailed Command Reference

### ctx init

Initialize context management in current project.

```bash
npx ctx init
```

Creates:
- `.ctx/` directory
- `.ctx/registry.yaml` (empty)
- `.ctx/contexts/` directory

---

### ctx status

Show current context status. Returns JSON by default.

```bash
# JSON output (default)
npx ctx status

# Human-readable
npx ctx status --pretty

# Find context for a specific file
npx ctx status --target src/api.ts
```

**JSON Output Structure:**
```json
{
  "projectRoot": "/path/to/project",
  "globalRoot": "/Users/name/.ctx",
  "contexts": {
    "local": [...],
    "project": [...],
    "global": [...]
  }
}
```

---

### ctx sync

Sync context files to registries. Updates checksums and preview fields.

```bash
# Sync all levels
npx ctx sync

# Sync only local contexts
npx ctx sync --local

# Sync only global contexts
npx ctx sync --global
```

---

### ctx check

Check context health and freshness.

```bash
# Check all
npx ctx check

# Check specific level
npx ctx check --local
npx ctx check --global

# Check specific file
npx ctx check --path .ctx/contexts/auth.md

# Auto-fix registry issues
npx ctx check --fix

# Human-readable output
npx ctx check --pretty
```

**Checks performed:**
- File exists for each registry entry
- Checksum matches content
- Preview fields are current

---

### ctx create

Create a new context file from template.

```bash
# Create local context for a file
npx ctx create src/api.ts
# → Creates src/api.ctx.md

# Create global context
npx ctx create --global typescript-patterns
# → Creates ~/.ctx/contexts/typescript-patterns.md

# Force overwrite
npx ctx create --force src/api.ts

# Use specific template
npx ctx create --template detailed src/api.ts
```

---

### ctx refresh

Refresh AI commands with current config settings.

```bash
npx ctx refresh
```

---

### ctx session

Extract messages from Claude Code session files.

```bash
# Extract all messages as JSONL
npx ctx session

# Extract user messages only
npx ctx session --role user

# Extract as markdown
npx ctx session --format markdown

# From specific session file
npx ctx session ~/.claude/projects/abc/session.jsonl
```

---

## Common Patterns for AI

### Check if initialized

```bash
npx ctx status --json 2>/dev/null | jq -r '.projectRoot // empty'
# Returns project root or empty string
```

### Get registry path

```bash
PROJECT_ROOT=$(npx ctx status --json | jq -r '.projectRoot')
cat "$PROJECT_ROOT/.ctx/registry.yaml"
```

### Sync after changes

```bash
npx ctx sync && npx ctx check --fix
```

### Create and sync

```bash
npx ctx create src/new-file.ts && npx ctx sync
```
