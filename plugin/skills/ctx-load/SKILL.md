---
name: ctx-load
description: This skill should be used when the user asks to "load context about", "find context for", "show me the context", "what do we know about", "get documentation on", "/ctx.load", or wants to search and retrieve context files. Uses CLI to query metadata and applies semantic understanding to find relevant contexts.
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

@../../shared/CLI_REFERENCE.md

---

## Execution Algorithm

### Step 1: Query Context Metadata via CLI

Use `ctx list` to get context metadata:

```bash
# Project contexts only (default)
ctx list

# Both project and global
ctx list --all

# For specific target file
ctx list --target src/api.ts
```

**JSON Output Format:**
```json
[
  {
    "path": ".ctx/contexts/architecture.md",
    "what": "System architecture overview",
    "keywords": ["architecture", "structure", "design"],
    "target": null,
    "registry": "project",
    "type": "standalone"
  },
  {
    "path": "src/api.ctx.md",
    "what": "API routing patterns",
    "keywords": ["api", "routing", "endpoint"],
    "target": "src/api.ts",
    "registry": "project",
    "type": "bound"
  }
]
```

### Step 2: Analyze Context Metadata

**Key fields for relevance matching:**
- `what` - What this context is about
- `keywords` - Keywords that trigger this context
- `target` - If present, this context is bound to a specific file
- `type` - "bound" (file-specific) or "standalone" (general)

### Step 3: Select Relevant Contexts (AI Judgment)

Based on the user's request, determine which contexts are relevant using semantic understanding:

**Example:** User asks "인증 구현해줘" (implement authentication)
- Keyword matching would miss "JWT 토큰 검증"
- AI understands JWT is related to authentication → selects it

**Selection criteria:**
1. Direct keyword match in `keywords` array
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
         keywords: ["api", "rest", "endpoint"]
     '.ctx/contexts/architecture.md':
       preview:
         what: "System architecture overview"
         keywords: ["architecture", "structure"]
     'src/routes.ctx.md':
       target: 'src/routes.ts'
       preview:
         what: "Route definitions and middleware"
         keywords: ["routing", "middleware"]
   ```
3. Select relevant: `api-design.md`, `routes.ctx.md` (semantic match)
4. Read both files
5. Present content to user

---

## CLI Commands Summary

| Command | Purpose | Output |
|---------|---------|--------|
| `ctx list` | Get context metadata for AI selection | JSON with what/keywords |
| `ctx load -k <keywords>` | Load by keyword matching | Content or paths |
| `ctx load -t <file>` | Load by target file | Content or paths |

**Recommended workflow:**
1. Use `ctx list` to get metadata
2. AI applies semantic understanding to select relevant contexts
3. Use Read tool to load selected context files

This approach follows the **CLI First principle** while preserving AI semantic understanding.

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
        keywords: ["api", "routing"]
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

1. **Query metadata via CLI first** - `ctx list` returns all metadata needed for selection
2. **Selective loading** - Only read contexts that are actually relevant
3. **Parallel file reads** - Load multiple context files simultaneously
4. **Smart summarization** - For large contexts (>500 lines), show key sections only

---

## Related Suggestions

After loading, suggest related contexts based on:
- Same category/folder
- Similar `keywords`
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
