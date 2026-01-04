---
name: ctx-save
description: This skill should be used when the user asks to "save this context", "remember this", "extract context", "store this knowledge", "document this pattern", "store this insight", "add to project knowledge", "save for future reference", "document this decision", "저장해줘", "기억해줘", or requests `/ctx.save`.
version: 0.2.0
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# CTX Save Skill

Save context to the CTX system. Simple, principled approach.

---

## Core Principles

### 1. Always Check Existing Contexts First

Search existing contexts before saving:

```bash
# List all contexts
npx ctx list --pretty

# Or search by keywords
npx ctx load <keyword> --paths
```

**Search criteria:**
- Filename contains keyword?
- `what` field contains keyword?

### 2. Decide and Explain

Make a judgment based on the situation and explain in one line:

```
"terraform.md exists, so I'll add it there"
"No related context found, creating new one"
"Multiple matches found, auth.md seems most relevant"
```

### 3. Safe Defaults

| Priority | Action | Risk |
|----------|--------|------|
| 1 | Append | Low |
| 2 | Create | Low |
| 3 | Replace | High - explicit request only |

### 4. Execution Judgment

```
Clear instruction → Execute immediately
  e.g., "Save to .ctx/contexts/auth.md"
  e.g., "바로 저장해", "즉시", "directly"

Uncertain → Confirm
  e.g., Need to choose among multiple candidates
  e.g., Ambiguous: new file vs append to existing

Risky → Always confirm
  e.g., Replace/delete existing content
  e.g., "교체해줘", "덮어써"
```

---

## Save Flow

```
1. Check Registry
   ↓
2. Related context exists?
   ├─ None → Create new file
   ├─ One → Suggest append
   └─ Multiple → Suggest most suitable
   ↓
3. Explain decision + Execute
   ↓
4. ctx sync
```

**Decide freely within principles.** These are guidelines, not rigid rules.

---

## CLI Reference

Two commands with distinct roles:

| Command | Purpose | Use Case |
|---------|---------|----------|
| `ctx create` | Scaffolding | Human workflow (template → edit) |
| `ctx save` | Capturing | Agent workflow (content → save) |

### ctx create (Template-based)

```bash
# Create template file for manual editing
npx ctx create .ctx/contexts/api.md
npx ctx create src/auth.ctx.md --target src/auth.ts
```

**Workflow:** `ctx create` → Edit file manually → `ctx sync`

### ctx save (Content-based)

```bash
# Save content directly (AI agent use case)
npx ctx save --path .ctx/contexts/api.md --content "..." --what "API patterns" --keywords "api,rest"

# Pipe content via stdin
echo "..." | npx ctx save --path notes.md --what "Notes"
```

**Note:** `--content` or stdin is required. No content = error with `ctx create` suggestion.

---

## Scope Guide

| Content Type | Scope | Location |
|--------------|-------|----------|
| Personal style, tool settings | Global | `~/.ctx/contexts/` |
| Project architecture, patterns | Project | `.ctx/contexts/` |
| Specific file implementation details | Local | `*.ctx.md` |

---

## Content Structure

```markdown
---
what: "One sentence describing this context"
keywords:
  - keyword1
  - keyword2
---

# Title

## Overview
Core content

## Details
Detailed content
```

### Frontmatter

| Field | Required | Purpose |
|-------|----------|---------|
| `what` | Yes | One sentence description |
| `keywords` | Yes | Auto-loading keywords (3-5) |
| `target` | Local only | File path to bind |

---

## How It Works

### Registry Sync

When `ctx sync` runs:
1. Parse frontmatter from file
2. Generate checksum
3. Update registry.yaml

### Keyword Matching

Auto-loaded by `keywords`:

```
User mentions "terraform"
    ↓
ctx load matches keywords: ["terraform"]
    ↓
Load that context
```

---

## Content Guidelines

### Good Contexts

| Aspect | Good | Bad |
|--------|------|-----|
| Focus | Single topic | Mixed topics |
| Length | 200-800 words | Too short or long |
| Content | "How to do X" | "X exists" |
| Keywords | Specific: `jwt`, `refresh-token` | Vague: `auth`, `code` |

### Structure Template

```markdown
# Clear Title

## Overview (1-2 paragraphs)
What it is and why it matters

## Key Points
- Actionable insight 1
- Actionable insight 2

## Examples
Working code over abstract explanations
```

---

## Integration with Capture System

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ session-capture │────▶│  .ctx/inbox/    │────▶│    ctx-save     │
│                 │     │  (raw JSON)     │     │  (final .md)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Capture → Inbox → Save flow transforms external data into contexts.

---

## Error Handling

| Error | Response |
|-------|----------|
| Not initialized | Run `ctx init` or `ctx init .` |
| File already exists | Suggest append |
| Permission error | Check path |

---

## Reference

- **`references/mode-examples.md`** - Detailed examples
