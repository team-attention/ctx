# Workflow Summary: ctx.work Commands

This document provides a comprehensive overview of the `ctx.work.init` and `ctx.work.plan` command workflows after all fixes and improvements.

---

## Overview

The `ctx.work` system provides two main commands:
1. **`/ctx.work.init`** - Initialize a new issue (online or offline)
2. **`/ctx.work.plan`** - Generate implementation plan for the current issue

---

## `/ctx.work.init` - Issue Initialization

### Purpose
Creates `.ctx.current` file to track the active issue and optionally creates a local issue file.

### Input Types & Flow Selection

| Input Type | Detection | Flow | Creates |
|------------|-----------|------|---------|
| Online URL | Starts with `http` | **Flow A** | `.ctx.current` only |
| Local file path | File exists | **Flow B1** | `.ctx.current` only |
| Requirements text | Otherwise | **Flow B2** | `.ctx.current` + issue file |

---

## Flow A: Online Issue Initialization

### Steps

**1.1 Validate URL**
- GitHub: `github.com/*/issues/*`
- Linear: `linear.app/*/issue/*`
- Show error if unsupported

**1.2 Check Existing `.ctx.current`**
- Read if exists
- Ask user: "Override existing issue `{current.issue}`? (y/n)"
- Exit if user says no

**1.3 Fetch Issue from Provider**

**GitHub:**
```bash
gh issue view <number> --json title,body,url
```

**Linear:**
- Extract issue ID from URL: `linear.app/{workspace}/issue/{issueId}` → `{issueId}`
- Call MCP tool:
```
mcp__linear-server__get_issue(issueId: "ABC-123")
```

Extract: Title, Description (Spec), URL

**1.4 Write `.ctx.current`**
```json
{
  "issue": "https://github.com/user/repo/issues/123"
}
```

**1.5 Show Summary**
```
✓ Initialized issue: <title>
📎 Source: <url>

Next: Run /ctx.work.plan to generate implementation plan
```

---

## Flow B1: Offline Issue - Existing File

### Steps

**1.1 Validate File Path**
- Check file exists
- Read and verify frontmatter fields: `title`, `source`, `provider`, `status`
- Show error if invalid

**1.2 Check Existing `.ctx.current`**
- Same as Flow A step 1.2

**1.3 Write `.ctx.current`**
```json
{
  "issue": "ctx/issues/2025-11-19-1430_add-dark-mode.md"
}
```

**1.4 Show Summary**
```
✓ Initialized issue from file: <filename>
📎 Title: <issue-title>
📊 Status: <status>

Next: Run /ctx.work.plan to generate implementation plan
```

---

## Flow B2: Offline Issue - Create New

### Steps

**2.1 Ensure Directory Exists**
```bash
mkdir -p ctx/issues
```

**2.2 Generate Summary from Requirements**
- AI analyzes requirements text
- Creates kebab-case slug (max 30 chars)
- Examples:
  - "사용자가 설정 페이지에서 다크모드를 토글할 수 있어야 함" → `add-dark-mode-toggle`
  - "Fix memory leak in rendering process" → `fix-memory-leak-rendering`

**2.3 Generate Filename**
- Format: `{YYYY-MM-DD}-{HHmm}_{summary}.md`
- Example: `2025-11-19-1430_add-dark-mode-toggle.md`
- Add numeric suffix if file exists: `-1`, `-2`, etc.

**2.4 Check Existing `.ctx.current`**
- Same as Flow A step 1.2

**2.5 Generate Title**
- AI generates concise, descriptive title
- Examples:
  - "사용자가 설정 페이지에서 다크모드를 토글할 수 있어야 함" → "Add dark mode toggle"
  - "Fix memory leak in rendering process" → "Fix memory leak in rendering"

**2.6 Create Issue File**
```markdown
---
title: <generated-title>
source: local
provider: local
created_at: 2025-11-19T14:30:00Z
updated_at: 2025-11-19T14:30:00Z
status: initialized
git_branch: ""
---

# Spec

<user's requirements from $ARGUMENTS>

<!-- Implementation Plan will be added by /ctx.work.plan -->
```

**2.7 Write `.ctx.current`**
```json
{
  "issue": "ctx/issues/<filename>"
}
```

**2.8 Show Summary**
```
✓ Created issue file: ctx/issues/<filename>
✓ Initialized .ctx.current

Next steps:
1. Edit the Spec section in the issue file if needed
2. Run /ctx.work.plan to generate implementation plan
```

---

## `/ctx.work.plan` - Implementation Planning

### Purpose
Generates implementation plan for the active issue in `.ctx.current`.

### Important Distinction
- Generates **HOW** (implementation details)
- NOT **WHAT** (requirements/spec) - user already provided this

---

## Common Steps

**Step 1: Read `.ctx.current`**
- Check file exists
- Extract issue reference (URL or file path)

**Step 2: Detect Online vs Offline**
- Starts with `http` → Flow A (Online)
- Otherwise → Flow B (Offline)

---

## Flow A: Online Issue Planning

### Steps

**A1. Fetch Issue from Provider**

**GitHub:**
```bash
gh issue view <number> --json title,body,url
gh issue view <number> --json comments
```

**Linear:**
```
mcp__linear-server__get_issue(issueId: "ABC-123")
mcp__linear-server__list_comments(issueId: "ABC-123")
```

Extract: Title, Spec (body), Comments

**A2. Parse Additional Requirements**
- If `$ARGUMENTS` provided, append to Spec

**A3. Load Relevant Contexts**
- Extract key technical terms from Spec
- Use SlashCommand tool:
```
SlashCommand(command: "/ctx.load dark mode settings theme")
```

**A4. Q&A Session (AI Self-Analysis)**

**IMPORTANT**: AI autonomously analyzes codebase and generates Q&A. NOT user interaction.

Process:
1. AI analyzes Spec + codebase context
2. AI generates implementation questions
3. AI answers based on codebase analysis
4. AI documents Q&A in plan

Questions to answer:
- What files will be modified?
- What files will be created?
- What existing code can be reused?
- What are the main interfaces/types?
- What are the main technical challenges?
- Will you write tests?

**A5. Generate Implementation Plan**

Structure:
```markdown
## Phases

### Phase 1: <Name>
**Step 1: <Task>**
- [ ] <Subtask>

### Phase 2: <Name>
...

## Files to Modify
- `file1.ts` - <what changes>

## Files to Create
- `newfile.ts` - <purpose>

## Files/Objects to Reuse
- `existing.ts` - `functionName()` - <how to use>

## Notes
- <Technical considerations>
```

**A6. Sync Plan to Issue**

**GitHub:**
```bash
gh issue comment <number> --body "---

## 🎯 Implementation Plan

<plan content>

---

_Generated by ctx at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```
Extract comment URL from output.

**Linear:**
```
mcp__linear-server__create_comment(
  issueId: "ABC-123",
  body: "## 🎯 Implementation Plan\n\n<plan content>\n\n_Generated by ctx at <timestamp>_"
)
```
Extract comment ID and construct URL: `{issue_url}#comment-{comment_id}`

**A7. Show Summary**
```
✓ Implementation plan synced to <platform> issue
📎 View: <actual-comment-url>

Ready to start coding!
```

---

## Flow B: Offline Issue Planning

### Steps

**B1. Read Issue File**
- Read markdown file
- Extract frontmatter, Spec, existing plan

**B2. Check Existing Plan**
- If plan exists: Ask "⚠️ Implementation plan already exists. Override? (y/n)"
- Exit if user says no

**B3. Parse Additional Requirements**
- Same as Flow A step A2

**B4. Load Relevant Contexts**
- Same as Flow A step A3

**B5. Q&A Session**
- Same as Flow A step A4

**B6. Generate Implementation Plan**
- Same as Flow A step A5

**B7. Save Plan to File**

Generate timestamp:
```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```

**If no existing plan** - Append:
```markdown
---

# Implementation Plan

_Generated at <current-timestamp>_

<plan content>
```

**If overriding** - Replace:
```markdown
# Implementation Plan

_Generated at <original-timestamp>_
_Last updated at <current-timestamp>_

<plan content>
```

**B8. Update Frontmatter**
```yaml
---
status: in_progress  # changed from 'initialized'
updated_at: <current-timestamp>
---
```

**B9. Show Summary**
```
✓ Implementation plan added to <filename>
📎 Commit this file to share with team

Ready to start coding!
```

---

## Key Improvements Made

### 1. **Directory Creation** (Issue #1)
- Added explicit step 2.1 in Flow B2 to create `ctx/issues/` directory
- Uses `mkdir -p ctx/issues` before file creation

### 2. **Online Issue Strategy** (Issue #2)
- Clarified: Online issues only create `.ctx.current` (no local file)
- Plans synced to GitHub/Linear as comments
- Status managed on platform, not locally

### 3. **SlashCommand Usage** (Issue #3)
- Added explicit SlashCommand tool usage in A3/B4
- Example: `SlashCommand(command: "/ctx.load dark mode settings theme")`

### 4. **Timestamp Standardization** (Issue #4)
- All timestamps use ISO 8601: `YYYY-MM-DDTHH:mm:ssZ`
- Dynamic generation: `$(date -u +%Y-%m-%dT%H:%M:%SZ)`

### 5. **Encoding Issues** (Issue #6)
- Fixed all special character encoding:
  - ✓ (checkmark)
  - 📎 (paperclip)
  - ⚠️ (warning)
  - ❌ (error)
  - 🎯 (target)

### 6. **Q&A Clarification** (Issue #7)
- Documented as **AI self-analysis**, not user interaction
- AI autonomously generates questions and answers
- Based on codebase context analysis

### 7. **Linear Issue ID Extraction** (Issue #8)
- Added URL parsing logic
- Format: `linear.app/{workspace}/issue/{issueId}` → `{issueId}`

### 8. **Comment ID Retrieval** (Issue #10)
- GitHub: Extract URL from CLI output
- Linear: Extract comment ID from MCP response, construct URL

---

## Important Guidelines

### What to Ask (Implementation)
✓ Which files will change?
✓ What patterns/architecture to use?
✓ What existing code to reuse?
✓ What are the technical challenges?
✓ Will you write tests?

### What NOT to Ask (Spec)
❌ What should this feature do?
❌ What are the requirements?
❌ What problem are we solving?
❌ Who are the users?

**Reason**: User already wrote the spec. Only plan HOW, not WHAT.

---

## Status Management

| Issue Type | Status Flow | Where Managed |
|------------|-------------|---------------|
| **Offline** | `initialized` → `in_progress` | Local frontmatter |
| **Online** | Platform-dependent | GitHub/Linear |

---

## File Structure

```
.ctx.current              # Tracks active issue (JSON)
ctx/
  issues/
    2025-11-19-1430_add-dark-mode.md    # Offline issue file
    2025-11-19-1500_fix-memory-leak.md
```

---

## Error Handling

- **No arguments**: Show usage with examples
- **Invalid file path**: File doesn't exist or invalid frontmatter
- **Unsupported URL**: Show supported formats
- **GitHub CLI not installed**: Show installation instructions
- **Linear MCP not available**: Show MCP setup instructions
- **No `.ctx.current`**: Run `/ctx.work.init` first
- **File creation failed**: Check permissions/directory

---

## Timestamp Format

**Standard**: ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`)

**Generation**:
```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```

**Example**: `2025-11-19T14:30:00Z`

---

## Summary

The workflow now has:
- ✅ Complete directory creation logic
- ✅ Clear online/offline separation
- ✅ Proper tool usage (SlashCommand, MCP, Bash)
- ✅ Consistent timestamp formatting
- ✅ Fixed encoding issues
- ✅ Clarified AI automation vs user interaction
- ✅ Comment URL retrieval for both platforms
- ✅ Linear issue ID extraction

All logical inconsistencies have been resolved, and the workflows are ready for implementation.
