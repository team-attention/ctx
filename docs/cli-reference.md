# CTX CLI Reference

Shared CLI reference for CTX plugin skills.

## Commands Overview
-
| Command | Description |
|---------|-------------|
| `ctx init` | Initialize context management |
| `ctx status` | Show context status |
| `ctx sync` | Sync context files to registries |
| `ctx check` | Check context health/freshness |
| `ctx create` | Create new context file |
| `ctx load` | Load context files by keywords |
| `ctx save` | Save content to context file |
| `ctx add` | Add context files to registry |
| `ctx remove` | Remove context files from registry |
| `ctx refresh` | Refresh AI commands with config |

---

## Command Reference

### ctx init

Initialize context management.

```bash
ctx init              # Global 초기화 (~/.ctx/)
ctx init .            # Project 초기화 (.ctx/)
```

| Flag | Description |
|------|-------------|
| `--context-paths <paths>` | Context paths with purposes (format: `path1:purpose1,path2:purpose2`) |
| `-y, --yes` | Non-interactive mode (use defaults, auto-confirm) |

**Output:**
- Creates `~/.ctx/` directory (global) or `.ctx/` directory (project)
- Creates `registry.yaml` and `contexts/` subdirectory

---

### ctx status

Show current context status.

```bash
ctx status                      # JSON output (default)
ctx status --pretty             # Human-readable dashboard
ctx status --global             # Show global registry only
ctx status --all                # Show all registered projects
ctx status --target src/api.ts  # Show contexts for specific file
```

| Flag | Description |
|------|-------------|
| `--pretty` | Human-readable dashboard output |
| `--global` | Show global registry contexts only |
| `--all` | Show all registered projects from global index |
| `--target <filePath>` | Show contexts bound to this file (supports glob) |

**Output (JSON, default):**
```json
{
  "initialized": true,
  "global": {
    "path": "/Users/name/.ctx",
    "contextCount": 5,
    "projectCount": 3,
    "lastSynced": "2025-01-03T10:00:00.000Z"
  },
  "project": {
    "path": "/path/to/project",
    "name": "my-project",
    "contextCount": 8,
    "bound": 5,
    "standalone": 3,
    "lastSynced": "2025-01-03T10:00:00.000Z"
  }
}
```

**Output (--pretty):**
Human-readable dashboard showing global and project status with context counts.

---

### ctx sync

Sync context files to registry. Updates checksums and preview fields.

**Important:** Registry is rebuilt from file system on each sync (file system is source of truth). Deleted files are automatically removed from registry.

```bash
ctx sync                  # Sync project contexts
ctx sync --global         # Sync global contexts (~/.ctx/)
ctx sync --rebuild-index  # Rebuild global index
```

| Flag | Description |
|------|-------------|
| `--global` | Sync global contexts (~/.ctx/) |
| `--rebuild-index` | Rebuild global index from all registered projects |

**Output:**
- Summary of synced contexts with updated checksums
- List of removed entries (if files were deleted)

---

### ctx check

Check context health and freshness.

```bash
ctx check                          # Check project contexts
ctx check --global                 # Check only global
ctx check --target src/api.ts      # Check contexts for specific file
ctx check --fix                    # Auto-fix registry issues
ctx check --pretty                 # Human-readable output
```

| Flag | Description |
|------|-------------|
| `--global` | Check only global contexts |
| `--target <filePath>` | Check only contexts bound to this file (supports glob) |
| `--fix` | Update registry to match filesystem |
| `--pretty` | Human-readable output (default is JSON) |

**Checks performed:**
- File exists for each registry entry
- Checksum matches content
- Preview fields are current

**Output (JSON, default):**
```json
{
  "status": "fresh",
  "summary": {
    "total": 8,
    "fresh": 8,
    "stale": 0,
    "new": 0,
    "deleted": 0,
    "errors": 0
  },
  "issues": []
}
```

---

### ctx create

Create a new context file from template.

```bash
# Project contexts (default)
ctx create .ctx/contexts/architecture.md
ctx create .ctx/docs/api-guide.md
ctx create src/api.ctx.md
ctx create src/api.ctx.md --target src/api.ts

# Global contexts
ctx create --global contexts/typescript-tips.md
ctx create --global rules/api.md --target "**/*.ts"

# Force overwrite
ctx create --force .ctx/contexts/auth.md
```

| Flag | Description |
|------|-------------|
| `--target <pattern>` | Optional target file/pattern for frontmatter |
| `--force` | Overwrite existing context file without confirmation |
| `--global` | Create in global registry (`~/.ctx/`) |

**Output:** Path to created context file.

---

### ctx load

Load context files by keywords or auto-match by file path.

```bash
ctx load api auth                # Load by keywords
ctx load --target src/api.ts     # Match by file path (supports glob)
ctx load --json                  # Output as JSON (metadata only)
ctx load --paths                 # Output paths only
```

| Flag | Description |
|------|-------------|
| `--target <filePath>` | File path to match against targets (supports glob) |
| `--json` | Output as JSON (paths + metadata only, no content) |
| `--paths` | Output paths only (newline separated) |

**Output (default):** Full content of matched context files.

**Output (--json):**
```json
[
  {
    "path": ".ctx/contexts/api.md",
    "what": "API design patterns",
    "when": ["api", "routing"]
  }
]
```

**Output (--paths):**
```
.ctx/contexts/api.md
src/auth.ctx.md
```

---

### ctx save

Save content to a context file (non-interactive).

```bash
# Save with all options
ctx save --path src/api.ctx.md --content "..." --what "API patterns" --when "api,routing"

# Save to project context
ctx save --project --path architecture.md --content "..."

# Save to global context
ctx save --global --path typescript-tips.md --content "..."

# Pipe content via stdin
echo "content" | ctx save --path src/api.ctx.md --what "API patterns"
```

| Flag | Description |
|------|-------------|
| `--path <filepath>` | Path for the context file (required) |
| `--content <text>` | Content to save (or pipe via stdin) |
| `--what <description>` | Brief description for frontmatter |
| `--when <keywords>` | Comma-separated keywords for auto-loading |
| `--global` | Save to global context (`~/.ctx/contexts/`) |
| `--project` | Save to project context (`.ctx/contexts/`) |
| `--force` | Overwrite existing file |

**Output:** Path to saved context file, automatically runs `ctx sync`.

---

### ctx add

Add context files to registry.

```bash
ctx add src/*.ctx.md            # Add local contexts by glob
ctx add .ctx/contexts/auth.md   # Add specific file
ctx add --global ~/notes/*.md   # Add to global registry
```

| Flag | Description |
|------|-------------|
| `--global` | Add to global registry instead of project |

**Output:** List of added context files.

---

### ctx remove

Remove context files from registry. Files are NOT deleted.

```bash
ctx remove src/api.ctx.md       # Remove from project registry
ctx remove --global old-tips.md # Remove from global registry
```

| Flag | Description |
|------|-------------|
| `--global` | Remove from global registry instead of project |

**Output:** List of removed registry entries (files remain on disk).

---

### ctx refresh

Refresh AI commands with current config settings.

```bash
ctx refresh
```

**Output:** Confirmation of refreshed commands.

---

## Common Patterns

### Initialize a new project

```bash
ctx init .                              # Create .ctx/ structure
ctx create .ctx/contexts/readme.md      # Create first context
ctx sync                                # Sync to registry
```

### Create and sync context

```bash
ctx create .ctx/contexts/api.md && ctx sync
ctx create src/api.ctx.md --target src/api.ts && ctx sync
```

### Check and fix issues

```bash
ctx check --pretty               # See issues
ctx check --fix                  # Auto-fix
```

### Find context for a file

```bash
ctx status --target src/api.ts         # Show metadata
ctx load --target src/api.ts --json    # JSON output
ctx load --target src/api.ts --paths   # Paths only
ctx load --target src/api.ts           # Full content
ctx check --target src/api.ts          # Check health
```

### Load contexts programmatically

```bash
# In scripts or hooks
CONTEXTS=$(ctx load --paths api auth)
for ctx in $CONTEXTS; do
  cat "$ctx"
done
```
