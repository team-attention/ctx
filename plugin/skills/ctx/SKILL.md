---
name: ctx
description: This skill should be used when the user asks to "load context about", "save this context", "find context for", "remember this", "document this pattern", "what do we know about", "ctx status", "ctx sync", "ctx list", "컨텍스트 로드", "저장해줘", "기억해줘", or any context management operation. Central entry point for all CTX operations except session capture.
version: 1.0.0
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
---

# CTX Skill

모든 컨텍스트 작업의 단일 진입점.

---

## CLI-First Principle

> **ALWAYS use CLI for context operations. NEVER access registry directly.**

```
DO:  ctx load -k api              # Use CLI
DO:  ctx save --project ...       # Use CLI
DO:  ctx status --pretty          # Use CLI

DON'T: cat .ctx/registry.yaml     # Direct access
DON'T: Write to .ctx/registry.yaml # Direct modification
```

**Why CLI-First:**
- CLI handles validation, error handling, and schema changes
- Ensures consistency across all operations
- One interface for all components

---

## Step 0: Read CLI Reference

**Before any operation, read the CLI reference first:**

```
Read: ./shared/CLI_REFERENCE.md
```

This file contains all available `ctx` commands and their options.

---

## Operation Routing

| User Intent | Action |
|-------------|--------|
| Load/Find context | Execute Load Operations |
| Save/Remember | Execute Save Operations |
| Status/Check/Sync | Execute CLI directly |
| Session capture | Delegate to `session-capture` skill |

---

## Load Operations

Search and load context from the 2-Level Context System.

### Context Priority

| Level | Location | Description |
|-------|----------|-------------|
| Project (bound) | `*.ctx.md` with `target` | File-specific context |
| Project (standalone) | `.ctx/contexts/` | Team/project knowledge |
| Global | `~/.ctx/contexts/` | Personal/universal patterns |

### Load Algorithm

**Step 1: Query Context Metadata via CLI**

```bash
# Project contexts only (default)
ctx list

# Both project and global
ctx list --all

# For specific target file
ctx list --target src/api.ts
```

**Step 2: Analyze Metadata**

Key fields for relevance matching:
- `what` - What this context is about
- `keywords` - Keywords that trigger this context
- `target` - If present, this context is bound to a specific file
- `type` - "bound" (file-specific) or "standalone" (general)

**Step 3: Select Relevant Contexts (AI Judgment)**

Based on the user's request, determine which contexts are relevant using semantic understanding:

Example: User asks "인증 구현해줘" (implement authentication)
- Keyword matching would miss "JWT 토큰 검증"
- AI understands JWT is related to authentication -> selects it

Selection criteria:
1. Direct keyword match in `keywords` array
2. Semantic relevance of `what` description to user's request
3. File path hints (e.g., `auth.ctx.md`, `security/`)
4. Target file relevance (if user is working on specific files)

**Step 4: Load Selected Contexts**

Read the actual context files using the Read tool.

For **bound contexts** (has `target` field): Consider reading the target file too for full context.

**Step 5: Present to User**

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

## Save Operations

Save context to the CTX system with principled approach.

### Core Principles

**1. Always Check Existing Contexts First**

```bash
# List all contexts
ctx list --pretty

# Or search by keywords
ctx load <keyword> --paths
```

**2. Decide and Explain**

Make a judgment and explain in one line:
- "terraform.md exists, so I'll add it there"
- "No related context found, creating new one"
- "Multiple matches found, auth.md seems most relevant"

**3. Safe Defaults**

| Priority | Action | Risk |
|----------|--------|------|
| 1 | Append | Low |
| 2 | Create | Low |
| 3 | Replace | High - explicit request only |

**4. Execution Judgment (Confirm by Default)**

```
Default -> Always confirm with AskUserQuestion
  Show: path, what, keywords, content preview (300 chars)
  Options: Save / Change path / Edit content / Cancel

Immediate save -> Only when explicitly requested
  e.g., "바로 저장해", "즉시 저장", "directly save"

Risky -> Extra warning in confirmation
  e.g., Replace/delete existing content
```

### Save Flow

```
1. Check Registry (ctx list --pretty)
   |
2. Related context exists?
   |- None -> Create new file
   |- One -> Suggest append
   +- Multiple -> Suggest most suitable
   |
3. Explain decision + Confirm (AskUserQuestion)
   |
4. Execute (ctx save --path ... --content ...)
   |
5. ctx sync
```

### Confirmation Template

**Step 1: Show preview in message**

```
📁 Context 저장 확인

경로: {path}
what: "{what}"
keywords: {keywords}

--- 내용 미리보기 ---
{content_preview_300_chars}
---
```

**Step 2: Get final confirmation with AskUserQuestion**

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

### CLI Commands

| Command | Purpose | Use Case |
|---------|---------|----------|
| `ctx create` | Scaffolding | Human workflow (template -> edit) |
| `ctx save` | Capturing | Agent workflow (content -> save) |

```bash
# Save content directly
ctx save --path .ctx/contexts/api.md --content "..." --what "API patterns" --keywords "api,rest"

# Save to project context
ctx save --project --path architecture.md --content "..."

# Save to global context
ctx save --global --path typescript-tips.md --content "..."

# Pipe content via stdin
echo "..." | ctx save --path src/api.ctx.md --what "API patterns"
```

### Scope Guide

| Content Type | Scope | Location |
|--------------|-------|----------|
| Personal style, tool settings | Global | `~/.ctx/contexts/` |
| Project architecture, patterns | Project | `.ctx/contexts/` |
| Specific file implementation details | Local | `*.ctx.md` |

### Content Structure

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

---

## Session Capture

For session capture operations, delegate to the `session-capture` skill.

**Trigger phrases:**
- "capture session", "save session history"
- User references conversation/session as source: "what we discussed", "오늘 세션", "대화내용에서"

**Action:** Read and follow `../session-capture/SKILL.md`

---

## Common Workflows

### Initialize a new project

```bash
ctx init .                              # Create .ctx/ structure
ctx create .ctx/contexts/readme.md      # Create first context
ctx sync                                # Sync to registry
```

### Find context for a file

```bash
ctx status --target src/api.ts         # Show status
ctx list --target src/api.ts           # List matching contexts
ctx load --target src/api.ts           # Full content
```

### Check and sync

```bash
ctx check --pretty               # See issues
ctx sync                         # Sync registry
```

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Registry not found | "No context registry found. Run `ctx init` first." |
| File missing | "Warning: Context registered but file missing. Run `ctx sync`." |
| No project found | "No project found. Use `ctx init .` to initialize." |
| No relevant contexts | Suggest: create new context |

---

## References

상세 예시는 `references/examples.md` 참조.
