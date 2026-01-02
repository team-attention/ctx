# CTX CLI Reference

Shared CLI reference for CTX plugin skills.

## Commands Overview

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
| `ctx migrate` | Migrate from legacy structure |
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
ctx status --target src/api.ts  # Find context for specific file
ctx status --global             # Show global registry only
ctx status --all                # Show all registered projects
```

| Flag | Description |
|------|-------------|
| `--pretty` | Human-readable dashboard output |
| `--target <path>` | Find context file for a target file path |
| `--global` | Show global registry contexts only |
| `--all` | Show all registered projects from global index |

**Output (JSON, default):**
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

**Output (--pretty):**
Human-readable dashboard with context counts and paths.

---

### ctx sync

Sync context files to registries. Updates checksums and preview fields.

```bash
ctx sync                # Sync all levels
ctx sync --local        # Sync only local contexts
ctx sync --global       # Sync only global contexts
ctx sync --rebuild-index  # Rebuild global index
```

| Flag | Description |
|------|-------------|
| `--local` | Sync only local contexts (*.ctx.md files) |
| `--global` | Sync only global contexts (~/.ctx/) |
| `--rebuild-index` | Rebuild global index from all registered projects |

**Output:** Summary of synced contexts with updated checksums.

---

### ctx check

Check context health and freshness.

```bash
ctx check                        # Check all
ctx check --local                # Check only local
ctx check --global               # Check only global
ctx check --path .ctx/contexts/auth.md  # Check specific file
ctx check --fix                  # Auto-fix registry issues
ctx check --pretty               # Human-readable output
```

| Flag | Description |
|------|-------------|
| `--local` | Check only local contexts |
| `--global` | Check only global contexts |
| `--path <file>` | Check only a specific context file |
| `--fix` | Update registry to match filesystem |
| `--pretty` | Human-readable output (default is JSON) |

**Checks performed:**
- File exists for each registry entry
- Checksum matches content
- Preview fields are current

**Output (JSON, default):**
```json
{
  "healthy": true,
  "issues": [],
  "checked": { "local": 5, "project": 3, "global": 2 }
}
```

---

### ctx create

Create a new context file from template.

```bash
ctx create src/api.ts                    # Local (src/api.ctx.md)
ctx create --project architecture        # Project (.ctx/contexts/architecture.md)
ctx create --global typescript-patterns  # Global (~/.ctx/contexts/...)
ctx create --force src/api.ts            # Force overwrite
ctx create --template detailed src/api.ts  # Use specific template
```

| Flag | Description |
|------|-------------|
| `--template <type>` | Template type (default: `default`) |
| `--force` | Overwrite existing context file without confirmation |
| `--global` | Create a global context in `~/.ctx/contexts/` |
| `--project` | Create a project context in `.ctx/contexts/` |

**Output:** Path to created context file.

---

### ctx load

Load context files by keywords or auto-match by file path.

```bash
ctx load api auth              # Load by keywords
ctx load --file src/api.ts     # Match by file path
ctx load --json                # Output as JSON (metadata only)
ctx load --paths               # Output paths only
```

| Flag | Description |
|------|-------------|
| `--file <path>` | File path to match against targets (for hook integration) |
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

### ctx migrate

Migrate from legacy `ctx/` structure to new `.ctx/` structure.

```bash
ctx migrate
```

**Output:** Migration summary with moved files and updated paths.

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
ctx init .                       # Create .ctx/ structure
ctx create --project readme      # Create first context
ctx sync                         # Sync to registry
```

### Create and sync context

```bash
ctx create src/api.ts && ctx sync
```

### Check and fix issues

```bash
ctx check --pretty               # See issues
ctx check --fix                  # Auto-fix
```

### Find context for a file

```bash
ctx status --target src/api.ts
```

### Load contexts programmatically

```bash
# In scripts or hooks
CONTEXTS=$(ctx load --paths api auth)
for ctx in $CONTEXTS; do
  cat "$ctx"
done
```
