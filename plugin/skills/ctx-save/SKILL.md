---
name: ctx-save
description: This skill should be used when the user asks to "save this context", "remember this", "extract context", "store this knowledge", "document this pattern", or requests `/ctx.save`. Supports Auto mode (non-interactive), Quick mode (zero-friction), and Deliberate mode (detailed control).
version: 0.1.0
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# CTX Save Skill

Save context to the 3-Level Context System (Global, Project, Local).

## CLI Reference

| Command | Description | Key Options |
|---------|-------------|-------------|
| `ctx init` | Initialize context management | - |
| `ctx status` | Show context status (JSON) | `--pretty`, `--target <path>` |
| `ctx create <path>` | Create new context file | `--target`, `--force`, `--global` |
| `ctx sync` | Sync context files to registries | `--local`, `--global` |
| `ctx check` | Check context health/freshness | `--fix`, `--pretty` |

### Common Patterns

```bash
# Check if initialized
npx ctx status --json 2>/dev/null | jq -r '.projectRoot // empty'

# Create and sync
npx ctx create .ctx/contexts/api.md && npx ctx sync
npx ctx create src/api.ctx.md --target src/api.ts && npx ctx sync

# Create global context
npx ctx create --global contexts/typescript-patterns.md && npx ctx sync
```

For complete CLI reference, see `../../shared/cli-reference.md`.

---

## Three Modes

### Auto Mode (Non-Interactive)
For CLI automation (`claude -p`) - execute immediately without questions.

**Triggers:**
- Request contains specific file path (e.g., `.ctx/contexts/auth.md`)
- Request contains: "directly", "direct", "just save", "no questions", "auto mode", "바로 저장", "즉시 저장"
- Request contains both scope AND filename

### Quick Mode (Default for Interactive)
Zero-friction saving with single confirmation.

**Triggers:**
- "save this" / "store this" / "remember this"
- `/ctx.save` without specific path
- Session end context suggestions

### Deliberate Mode
Detailed control for external sources or complex cases.

**Triggers:**
- External source mentioned: "from Slack", "from this URL", "from clipboard"
- Updating existing context (conflict potential)

---

## Execution Algorithm

### Step 1: Detect Mode

```
IF request contains specific file path:
  -> Auto Mode (no questions)
ELSE IF request contains "directly" OR "direct" OR "just save" OR "auto mode" OR "바로 저장" OR "즉시 저장":
  -> Auto Mode (no questions)
ELSE IF request contains BOTH scope AND filename:
  -> Auto Mode (no questions)
ELSE IF request mentions external source:
  -> Deliberate Mode
ELSE IF updating existing context:
  -> Deliberate Mode
ELSE:
  -> Quick Mode
```

**CRITICAL: Auto Mode must NEVER ask questions. Execute immediately.**

---

### Step 2: Gather Content

**Quick Mode:**
1. Analyze conversation for valuable knowledge:
   - Patterns discovered
   - Decisions made
   - Gotchas/pitfalls learned
   - Implementation approaches
2. Summarize into structured content

**Deliberate Mode:**
Based on source, gather content interactively. See `references/mode-examples.md` for detailed flows.

---

### Step 3: Determine Scope

| Content Type | Recommended Scope |
|-------------|-------------------|
| Personal coding style, tool preferences | Global (`~/.ctx/contexts/`) |
| Project architecture, API patterns | Project (`.ctx/contexts/`) |
| File-specific implementation details | Local (`*.ctx.md`) |

**Quick Mode:** Recommend single best option
**Deliberate Mode:** Present all applicable options

---

### Step 4: Determine Location

Check registry settings for path hints:

```bash
PROJECT_ROOT=$(npx ctx status --json | jq -r '.projectRoot // empty')
[ -n "$PROJECT_ROOT" ] && cat "$PROJECT_ROOT/.ctx/registry.yaml"
cat ~/.ctx/registry.yaml
```

Match content purpose with `context_paths[].purpose` to suggest path.

**Location patterns:**
- Global: `~/.ctx/contexts/<category>/<name>.md`
- Project: `.ctx/contexts/<category>/<name>.md`
- Local: `<target>.ctx.md` or `<folder>/ctx.md`

---

### Step 5: Create or Update

**Check existence:**
```bash
npx ctx status --path <proposed-path>
```

**CREATE (new context):**
```bash
npx ctx create <path>                           # Project (default)
npx ctx create <path> --target <file/pattern>   # With target binding
npx ctx create --global <path>                  # Global
```

Then fill content with Edit tool.

**UPDATE (existing context):**
1. Read existing context
2. Show diff of proposed changes
3. Wait for approval (except Auto Mode)
4. Apply with Edit tool

---

### Step 6: Register and Sync

```bash
npx ctx add <context-path>
npx ctx sync
```

---

## Content Structure

Generated context files follow this structure:

```markdown
---
what: "Brief description of this context"
when:
  - "Trigger keyword 1"
  - "Trigger keyword 2"
---

# Title

## Overview
[Main content]

## Details
[Supporting information]
```

### Frontmatter Fields

| Field | Required | Purpose |
|-------|----------|---------|
| `what` | Yes | Single sentence describing content |
| `when` | Yes | Array of keywords for auto-loading |
| `target` | Local only | Path to the code file this context describes |

---

## Error Handling

| Error | Response |
|-------|----------|
| Global not initialized | Run `ctx init` first |
| Project not found | Run `ctx init .` or use `--global` |
| File already exists | Offer update instead of create |

---

## Best Practices

1. **Be proactive** - Suggest saving when valuable knowledge emerges
2. **Prefer Quick Mode** - Minimize friction for common cases
3. **Smart defaults** - Use conversation context to pre-fill content
4. **Respect scope** - Personal preferences -> Global, Team knowledge -> Project
5. **Always sync** - Run `ctx sync` after every save
6. **Parallel operations** - Use Glob/Grep in parallel when checking existing contexts

---

## Additional Resources

### Reference Files
- **`references/mode-examples.md`** - Detailed examples for Auto, Quick, and Deliberate modes including source-specific flows (Slack, URL, Clipboard)
