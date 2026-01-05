---
name: ctx-save
description: This skill should be used when the user asks to "save this context", "remember this", "extract context", "store this knowledge", "document this pattern", "store this insight", "add to project knowledge", "save for future reference", "document this decision", "저장해줘", "기억해줘", or requests `/ctx.save`.
version: 0.2.0
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# CTX Save Skill

Save context to the CTX system. Simple, principled approach.

---

## Core Principles

### 1. Always Check Existing Contexts First

Search existing contexts before saving:

```bash
# List all contexts
ctx list --pretty

# Or search by keywords
ctx load <keyword> --paths
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

### 4. Execution Judgment (Confirm by Default)

```
Default → Always confirm with AskUserQuestion
  Show: path, what, keywords, content preview (300 chars)
  Options: Save / Change path / Edit content / Cancel

Immediate save → Only when explicitly requested
  e.g., "바로 저장해", "즉시 저장", "directly save"
  e.g., "--save" flag in /ctx.capture

Risky → Extra warning in confirmation
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

## Confirmation Template

Use AskUserQuestion to confirm before saving. Show structured information:

### Message Format

```
📁 Context 저장 확인

경로: {path}
what: "{what}"
keywords: {keywords}

--- 내용 미리보기 ---
{content_preview_300_chars}
---
```

### AskUserQuestion Options

```yaml
question: "이대로 저장할까요?"
header: "Context"
options:
  - label: "저장 (Recommended)"
    description: "위 내용대로 저장합니다"
  - label: "경로 변경"
    description: "다른 위치에 저장합니다"
  - label: "내용 수정"
    description: "저장할 내용을 수정합니다"
  - label: "취소"
    description: "저장하지 않습니다"
```

### When to Skip Confirmation

Skip only when user explicitly requests immediate save:
- "바로 저장해", "즉시 저장", "directly save"
- `/ctx.capture --save` flag

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
ctx create .ctx/contexts/api.md
ctx create src/auth.ctx.md --target src/auth.ts
```

**Workflow:** `ctx create` → Edit file manually → `ctx sync`

### ctx save (Content-based)

```bash
# Save content directly (AI agent use case)
ctx save --path .ctx/contexts/api.md --content "..." --what "API patterns" --keywords "api,rest"

# Pipe content via stdin
echo "..." | ctx save --path notes.md --what "Notes"
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

---

## Full CLI Reference

@../../shared/CLI_REFERENCE.md
