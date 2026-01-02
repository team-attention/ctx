---
name: ctx-load
description: This skill should be used when the user asks to "load context about", "find context for", "show me the context", "what do we know about", "get documentation on", "/ctx.load", or wants to search and retrieve context files. Searches across Global (~/.ctx/), Project (.ctx/), and Local (*.ctx.md) levels with keyword matching.
allowed-tools: Read, Glob, Grep, Bash
---

# CTX Load Skill

Search and load context from the 3-Level Context System.

## Trigger Conditions

Activate this skill when:
- Request contains "load context about...", "find context for..."
- Request contains "what context do we have for...", "what do we know about..."
- Request contains "show me documentation on...", "get context on..."
- Explicit command `/ctx.load` or `/ctx:load`

## Context Priority

Load and present contexts in this priority order:

| Level | Location | Description |
|-------|----------|-------------|
| Local | `*.ctx.md` | Most specific, file-attached |
| Project | `.ctx/contexts/` | Team/project knowledge |
| Global | `~/.ctx/contexts/` | Personal/universal patterns |

---

## CLI Reference

Use `npx ctx` commands to interact with the context system:

| Command | Description | Key Options |
|---------|-------------|-------------|
| `ctx init` | Initialize context management | - |
| `ctx status` | Show context status (JSON) | `--pretty`, `--target <path>` |
| `ctx sync` | Sync context files to registries | `--local`, `--global` |
| `ctx check` | Check context health/freshness | `--local`, `--global`, `--path <file>`, `--fix`, `--pretty` |
| `ctx create <target>` | Create new context file | `--template <type>`, `--force`, `--global` |
| `ctx refresh` | Refresh AI commands with config | - |

### Common Usage Patterns

```bash
# Get project status as JSON (for parsing)
npx ctx status --json | jq '.projectRoot'

# Check if context system is initialized
npx ctx status --json 2>/dev/null | jq -r '.projectRoot // empty'

# Sync after changes
npx ctx sync

# Check and auto-fix registry
npx ctx check --fix
```

For complete CLI reference, see `../../shared/cli-reference.md`.

---

## Execution Algorithm

### Step 1: Parse Keywords

Extract search keywords from the request:

```
"load context about authentication" → ["authentication"]
"what do we know about payment and refunds" → ["payment", "refunds"]
"/ctx.load api design" → ["api", "design"]
```

Expand with common synonyms:
- auth → authentication, authorization, login
- api → endpoint, route, rest
- db → database, sql, query

### Step 2: Determine Project Root

```bash
PROJECT_ROOT=$(npx ctx status --json 2>/dev/null | jq -r '.projectRoot // empty')
```

If empty, search Global only.

### Step 3: Search Registries

Read registries and match keywords against:
- `preview.what` - Context description
- `preview.when` - Trigger keywords (array)
- File path and name

**Project Registry:**
```bash
[ -n "$PROJECT_ROOT" ] && cat "$PROJECT_ROOT/.ctx/registry.yaml"
```

**Global Registry:**
```bash
cat ~/.ctx/registry.yaml
```

### Step 4: Load and Present

For each matched context, read the file and output:

```markdown
### Loaded: [path]

**What:** [preview.what]
**When:** [preview.when as bullets]
**Scope:** [Global/Project/Local]

[Key content summary or full content]
```

**Local contexts** (has `target` field): Also read the target file.

### Step 5: Summarize

```markdown
Loaded N contexts for "[keywords]"

By Level:
- Local: X contexts
- Project: Y contexts
- Global: Z contexts

[List of loaded paths]

These contexts are now in our conversation.
```

---

## Search Patterns

### Keyword Search (default)
```bash
/ctx.load authentication
# Searches all levels for "authentication"
```

### Level Filter
```bash
/ctx.load --global typescript   # Global only
/ctx.load --project architecture   # Project only
/ctx.load --local api   # Local only
```

### All Contexts
```bash
/ctx.load --all
# Load summary of ALL registered contexts
```

### Path Pattern
```bash
/ctx.load src/auth/*
# Load all contexts under src/auth/
```

---

## Cross-Project Search

For `--all` flag, also search Global registry's `index` section:

```yaml
# ~/.ctx/registry.yaml
index:
  'projects/myapp':
    contexts:
      - path: 'src/api.ctx.md'
        what: "API routing logic"
        when: ["api", "routing"]
```

This enables finding contexts across all registered projects.

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Registry not found | "No context registry found. Run `ctx init` first." |
| File missing | "Warning: Context registered but file missing: [path]. Run `ctx sync` to clean up." |
| No project (for --project) | "No project found. Use `ctx init .` to create one, or search Global with --global." |
| No results | Show search stats and suggest: try different keywords, run `ctx sync`, or create with `/ctx.save` |

---

## Performance Guidelines

1. **Read registries first** - Never scan filesystem; use registry data
2. **Parallel file reads** - Load multiple context files simultaneously
3. **Session caching** - Skip re-loading already loaded contexts
4. **Use Global index** - For cross-project search, read index not each project
5. **Smart summarization** - For large contexts (>500 lines), show key sections only

---

## Related Suggestions

After loading, suggest related contexts based on:
- Same category/folder
- Similar `when` keywords
- Referenced in loaded content

```markdown
Related contexts you might want:
- .ctx/contexts/security.md - Security best practices
- ~/.ctx/contexts/jwt.md - JWT patterns

Load these? [Y/n]
```

---

## Additional Resources

### Reference Files

For detailed examples and usage patterns:
- **`references/examples.md`** - Complete interaction examples for all search patterns

### Related Skills

- **ctx-save** - Save new context from conversation or external sources
