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
| `ctx add-pattern` | Add glob pattern to context_paths |
| `ctx adopt` | Adopt existing documents by adding frontmatter |
| `ctx remove` | Remove context files from registry |

---

## Command Reference

### ctx init

Initialize context management.

```bash
ctx init              # Global initialization (~/.ctx/)
ctx init .            # Project initialization (.ctx/)
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
ctx status --target src/api.ts  # Show contexts for specific file
```

| Flag | Description |
|------|-------------|
| `--pretty` | Human-readable dashboard output |
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
ctx sync --prune          # Remove registry entries not matching context_paths
```

| Flag | Description |
|------|-------------|
| `--global` | Sync global contexts (~/.ctx/) |
| `--rebuild-index` | Rebuild global index from all registered projects |
| `--prune` | Remove registry entries that don't match context_paths patterns |

**Output:**
- Summary of synced contexts with updated checksums
- List of removed entries (if files were deleted or pruned)

---

### ctx check

Check context health and freshness.

```bash
ctx check                          # Check project contexts
ctx check --target src/api.ts      # Check contexts for specific file
ctx check --pretty                 # Human-readable output
```

| Flag | Description |
|------|-------------|
| `--target <filePath>` | Check only contexts bound to this file (supports glob) |
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
    "registry": "project",
    "matchType": "exact",
    "target": "src/api.ts"
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

**Output:** Path to saved context file, automatically registered to registry.

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

### ctx add-pattern

Add a glob pattern to context_paths in registry settings.

Defines which file paths are scanned for context files during sync.

```bash
ctx add-pattern <pattern> <purpose>           # Add to project
ctx add-pattern <pattern> <purpose> --global  # Add to global
```

**Examples:**
```bash
ctx add-pattern 'docs/**/*.md' 'API documentation'
ctx add-pattern '**/*.test.ctx.md' 'Test context files'
ctx add-pattern --global '**/*.ctx.md' 'Global context pattern'
```

| Flag | Description |
|------|-------------|
| `--global` | Add to global registry instead of project |

**Output:** Updated context_paths list with the new pattern.

---

### ctx adopt

Adopt existing documents by adding frontmatter.

Automatically adds YAML frontmatter to existing markdown files, making them discoverable as context without manual editing. Generates `what` and `when` fields from filenames and directory structure.

```bash
ctx adopt <patterns...>           # Adopt documents to project registry
ctx adopt <patterns...> --global  # Adopt to global registry
```

**Examples:**
```bash
ctx adopt docs/**/*.md            # Adopt all docs
ctx adopt README.md CONTRIBUTING.md  # Adopt specific files
ctx adopt --global ~/notes/*.md   # Adopt to global registry
```

| Flag | Description |
|------|-------------|
| `--global` | Adopt to global registry instead of project |

**Output:** List of adopted files with auto-generated frontmatter.

**Behavior:**
- Skips files that already have frontmatter
- Skips non-markdown files
- Skips `.ctx.md` context files
- Auto-generates `what` and `when` from filename/path
- Automatically registers adopted files to registry

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

### Check issues

```bash
ctx check --pretty               # See issues
```

### Find context for a file

```bash
ctx status --target src/api.ts         # Show metadata
ctx load --target src/api.ts --json    # JSON output
ctx load --target src/api.ts --paths   # Paths only
ctx load --target src/api.ts           # Full content
ctx check --target src/api.ts          # Check health
```

### Adopt existing documentation

```bash
ctx adopt docs/**/*.md           # Add frontmatter to all docs
ctx adopt README.md              # Adopt specific file
ctx sync                         # Sync adopted files to registry
```

### Manage context_paths patterns

```bash
ctx add-pattern 'docs/**/*.md' 'Documentation'  # Add pattern
ctx sync --prune                                # Remove unmatched contexts
```

### Load contexts programmatically

```bash
# In scripts or hooks
CONTEXTS=$(ctx load --paths api auth)
for ctx in $CONTEXTS; do
  cat "$ctx"
done
```
