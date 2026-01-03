---
name: ctx-load
description: This skill should be used when the user asks to "load context about", "find context for", "show me the context", "what do we know about", "get documentation on", "/ctx.load", or wants to search and retrieve context files. Reads registry directly and uses semantic understanding to find relevant contexts.
allowed-tools: Read, Glob, Grep, Bash
---

# CTX Load Skill

Search and load context from the 2-Level Context System.

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
| Project (bound) | `*.ctx.md` with `target` | File-specific context |
| Project (standalone) | `.ctx/contexts/` | Team/project knowledge |
| Global | `~/.ctx/contexts/` | Personal/universal patterns |

---

## CLI Reference

Use `npx ctx` commands to interact with the context system:

| Command | Description | Key Options |
|---------|-------------|-------------|
| `ctx init` | Initialize context management | - |
| `ctx status` | Show context status (JSON) | `--pretty`, `--target <path>` |
| `ctx sync` | Sync context files to registries | `--global`, `--rebuild-index`, `--prune` |
| `ctx check` | Check context health/freshness | `--target <file>`, `--pretty` |
| `ctx create <path>` | Create new context file | `--target`, `--force`, `--global` |
| `ctx load` | Load context (for scripts/hooks) | `--target <path>`, `--json`, `--paths` |

For complete CLI reference, see `../../shared/cli-reference.md`.

---

## Execution Algorithm

### Step 1: Read Registries Directly

Use the Read tool to read registry files:

**Project Registry:**
```
.ctx/registry.yaml
```

**Global Registry:**
```
~/.ctx/registry.yaml
```

### Step 2: Analyze Context Index

Each registry contains a `contexts` map with metadata:

```yaml
contexts:
  '.ctx/contexts/architecture.md':
    checksum: 'abc123'
    preview:
      what: "System architecture overview"
      when: ["architecture", "structure", "design"]
  'src/api.ctx.md':
    target: 'src/api.ts'
    checksum: 'def456'
    preview:
      what: "API routing patterns"
      when: ["api", "routing", "endpoint"]
```

**Key fields for relevance判断:**
- `preview.what` - What this context is about
- `preview.when` - Keywords that trigger this context
- `target` - If present, this context is bound to a specific file

### Step 3: Select Relevant Contexts (AI Judgment)

Based on the user's request, determine which contexts are relevant using semantic understanding:

**Example:** User asks "인증 구현해줘" (implement authentication)
- Keyword matching would miss "JWT 토큰 검증"
- AI understands JWT is related to authentication → selects it

**Selection criteria:**
1. Direct keyword match in `when` array
2. Semantic relevance of `what` description to user's request
3. File path hints (e.g., `auth.ctx.md`, `security/`)
4. Target file relevance (if user is working on specific files)

### Step 4: Load Selected Contexts

Read the actual context files using the Read tool:

```
Read: .ctx/contexts/architecture.md
Read: src/api.ctx.md
```

For **bound contexts** (has `target` field): Consider reading the target file too for full context.

### Step 5: Present to User

Format loaded contexts clearly:

```markdown
## Loaded Contexts

### .ctx/contexts/auth.md (Project)
> JWT authentication patterns

[content...]

### ~/.ctx/contexts/security.md (Global)
> Security best practices

[content...]

---
Loaded 2 contexts relevant to "authentication"
```

---

## Example Workflow

**User:** "API 엔드포인트 설계에 대한 컨텍스트 로드해줘"

**AI Actions:**
1. Read `.ctx/registry.yaml`
2. Scan contexts:
   ```yaml
   contexts:
     '.ctx/contexts/api-design.md':
       preview:
         what: "REST API design conventions"
         when: ["api", "rest", "endpoint"]
     '.ctx/contexts/architecture.md':
       preview:
         what: "System architecture overview"
         when: ["architecture", "structure"]
     'src/routes.ctx.md':
       target: 'src/routes.ts'
       preview:
         what: "Route definitions and middleware"
         when: ["routing", "middleware"]
   ```
3. Select relevant: `api-design.md`, `routes.ctx.md` (semantic match)
4. Read both files
5. Present content to user

---

## When to Use CLI Instead

The `ctx load` CLI command is useful for:
- **Scripts/automation**: `npx ctx load --paths api | xargs cat`
- **Hook integration**: Pipe JSON to stdin for auto-matching
- **Quick terminal lookup**: `npx ctx load --json auth`

For AI-assisted context loading, **direct registry reading is preferred** because:
- AI can apply semantic understanding (not just keyword matching)
- Faster (no process spawn)
- More flexible relevance judgment

---

## Cross-Project Search

The Global registry's `index` section stores summaries of all registered projects:

```yaml
# ~/.ctx/registry.yaml
index:
  'projects/myapp':
    contexts:
      - path: 'src/api.ctx.md'
        what: "API routing logic"
        when: ["api", "routing"]
```

This enables discovering contexts across all registered projects.

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Registry not found | "No context registry found. Run `ctx init` first." |
| File missing | "Warning: Context registered but file missing: [path]. Run `ctx sync` to clean up." |
| No project found | "No project found. Use `ctx init .` to initialize project context." |
| No relevant contexts | Suggest: create new context with `/ctx.save` |

---

## Performance Guidelines

1. **Read registry first** - Small file, contains all metadata
2. **Selective loading** - Only read contexts that are actually relevant
3. **Parallel file reads** - Load multiple context files simultaneously
4. **Session caching** - Skip re-loading already loaded contexts
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
- **`references/examples.md`** - Complete interaction examples

### Related Skills

- **ctx-save** - Save new context from conversation or external sources
