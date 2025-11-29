# ctx Workflow Summary

This document provides a comprehensive overview of ctx workflows and AI commands.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Philosophy](#core-philosophy)
3. [Architecture Overview](#architecture-overview)
4. [Core Commands](#core-commands)
   - [/ctx.save](#ctxsave---save-context)
   - [/ctx.load](#ctxload---load-context)
   - [/ctx.sync](#ctxsync---sync-registry)
   - [/ctx.audit](#ctxaudit---context-health-check)
   - [/ctx.status](#ctxstatus---show-status)
5. [Work Session Commands](#work-session-commands)
   - [/ctx.work.init](#ctxworkinit---initialize-issue)
   - [/ctx.work.plan](#ctxworkplan---generate-implementation-plan)
   - [/ctx.work.extract](#ctxworkextract---extract-context)
   - [/ctx.work.commit](#ctxworkcommit---commit-changes)
   - [/ctx.work.submit](#ctxworksubmit---create-pr)
6. [Data Structures](#data-structures)
7. [Issue Provider Integration](#issue-provider-integration)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)

---

## Overview

ctx is a **context management system** that enables AI editors (Claude Code, etc.) to continuously learn and utilize project decisions, patterns, and rules.

### The Core Loop

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│    Code  →  Learn  →  Save  →  Sync  →  Load       │
│     ↑                                     │         │
│     └─────────────────────────────────────┘         │
│                                                     │
│         Context grows with every cycle              │
└─────────────────────────────────────────────────────┘
```

### Two Levels of Context

| Level | Location | Purpose | Example |
|-------|----------|---------|---------|
| **Local** | `*.ctx.md` (next to code) | Per-file context | `payment.ctx.md` |
| **Global** | `ctx/**/*.md` | Project-wide knowledge | `ctx/rules/api.md` |

---

## Core Philosophy

> **Your thinking is the most valuable context.**

1. **Capture** — Feedback becomes documented context
2. **Grow** — Context evolves as your codebase and thinking evolve
3. **Compound** — Each session builds on previous knowledge

**Result**: AI that gets better at understanding *your* project with every interaction.

---

## Architecture Overview

### File Structure

```
your-project/
├── ctx.config.yaml              # Configuration file
├── ctx/                         # Global context directory
│   ├── README.md
│   ├── local-context-registry.yml   # Local context registry
│   ├── global-context-registry.yml  # Global context registry
│   ├── issues/                  # Work session issue files
│   └── templates/               # Customizable templates
├── .claude/
│   ├── commands/                # AI commands (auto-installed)
│   │   ├── ctx.save.md
│   │   ├── ctx.load.md
│   │   └── ...
│   └── hooks/                   # Session tracking hooks
├── .ctx.current                 # Active work session tracker
├── .worktrees/                  # Work session branches
└── src/
    └── *.ctx.md                 # Local context files
```

### Context File Structure

```markdown
---
target: /src/api/routes.ts
what: API route definitions and patterns
when:
  - Adding new endpoints
  - Modifying API responses
not_when:
  - Modifying internal utility functions
---

## Validation
Always use Zod schemas. Never trust raw input.

## Response Format
Wrap all responses in `ApiResponse<T>` type.
```

---

## Core Commands

### /ctx.save - Save Context

**Purpose**: Unified command to create or update local/global contexts

#### Input Type Detection

| Input Pattern | Type | Scope | Example |
|---------------|------|-------|---------|
| `*.ctx.md` (outside ctx/) | context-path | local | `src/payment.ctx.md` |
| `ctx/**/*.md` | context-path | global | `ctx/rules/api.md` |
| Code file extensions | target-path | local | `src/payment.ts` |
| Other text | description-only | semantic | "Document auth flow" |

#### Workflow

```
Step 1: Parse Arguments
         │
         ├─> context-path → Step 2
         ├─> target-path → Step 2 (registry lookup)
         └─> description-only → Step 2b (semantic mode)

Step 2: Check & Prepare
         │
         └─> ctx check --path [contextPath]

Step 2b: Semantic Mode
         │
         ├─> ctx status
         └─> AskUserQuestion (present options)

Step 3: Determine Mode
         │
         ├─> File exists → UPDATE mode
         └─> File doesn't exist → CREATE mode

Step 4: Generate Content
         │
         ├─> Read source file (for local)
         ├─> Check frontmatter requirements
         └─> Generate preview in diff format

Step 5: Save & Sync
         │
         ├─> Save with Write/Edit tool
         └─> ctx sync --local/--global
```

#### Examples

```bash
# Save local context (context path)
/ctx.save src/services/payment.ctx.md Add webhook handling

# Save local context (target path - registry lookup)
/ctx.save src/services/payment.ts Document payment processing

# Save global context
/ctx.save ctx/rules/api.md Add REST versioning guidelines

# Semantic mode (AI suggests options)
/ctx.save Document the auth flow
```

---

### /ctx.load - Load Context

**Purpose**: Search and load contexts matching the description

#### Workflow

```
Step 1: READ Registries
         │
         ├─> ctx/local-context-registry.yml
         └─> ctx/global-context-registry.yml

Step 2: SEARCH & FILTER
         │
         └─> Semantic matching (preview.what, preview.when, folder, path)

Step 3: EVALUATE & LOAD
         │
         ├─> No matches → Error message
         └─> Matches found → Load immediately

Step 4: LOAD Files
         │
         ├─> Local: context file + target file
         └─> Global: document file

Step 5: CONFIRM Completion
```

#### Matching Strategy

- Uses **semantic matching** (not exact string)
- Considers **synonyms and related terms** (e.g., "auth" → authentication, authorization)
- Supports **folder loading** (loads entire folder when folder name matches)
- Supports **wildcard patterns** (`src/auth/*`, `rules/*`)

#### Examples

```bash
/ctx.load authentication
/ctx.load payment processing
/ctx.load api design rules
```

---

### /ctx.sync - Sync Registry

**Purpose**: Synchronize context registries with the file system (mechanical operation)

#### Workflow

```bash
# Sync both (default)
ctx sync

# Local only
ctx sync --local

# Global only
ctx sync --global
```

#### What It Does

- Scans `*.ctx.md` and `ctx/**/*.md` files
- Computes checksums for change detection
- Updates registry files

#### When to Use

- After creating/editing context files
- Before running `/ctx.audit`
- Periodically to keep registries fresh

---

### /ctx.audit - Context Health Check

**Purpose**: Comprehensive audit with mechanical + semantic analysis

#### Two Modes

| Mode | Arguments | Behavior |
|------|-----------|----------|
| **Quick Scan** | (none) | Fast semantic scan using previews |
| **Deep Review** | description provided | Deep review of related contexts only |

#### Workflow

```
Step 1: Mechanical Scan (always)
         │
         └─> ctx check

Step 2: Semantic Analysis
         │
         ├─> With args → Filter then full read
         └─> No args → Preview-based analysis

Step 3: Generate Report
         │
         ├─> Mechanical Issues
         │    ├─> Errors
         │    ├─> Stale
         │    └─> Unsynced
         │
         └─> Semantic Issues
              ├─> Contradictions
              ├─> Redundancy
              └─> Ambiguity
```

#### Semantic Issue Types

| Type | Description | Example |
|------|-------------|---------|
| **Contradictions** | Conflicting guidelines | A: "throw exceptions" vs B: "return Result type" |
| **Redundancy** | Duplicate documentation | Same topic documented in multiple places |
| **Ambiguity** | Vague descriptions | Phrases like "handles stuff" |

#### Examples

```bash
# Quick audit
/ctx.audit

# Deep audit focused on authentication
/ctx.audit Check authentication-related contexts
```

---

### /ctx.status - Show Status

**Purpose**: Display current ctx and work session status

```bash
ctx status
```

#### What It Shows

- **Context Status**: Local/global context counts, health, last sync time
- **Work Session**: Active issue, branch, session count
- **Suggestions**: Actionable next steps based on current state

---

## Work Session Commands

Work sessions manage the complete workflow: **Issue → Plan → Implement → Extract → Commit → PR**

### Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  /ctx.work.init  →  /ctx.work.plan  →  [coding]  →  /ctx.work.extract
│                                                           │
│                                                           ↓
│  /ctx.work.submit  ←  /ctx.work.commit  ←  [context updates]
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### /ctx.work.init - Initialize Issue

**Purpose**: Create `.ctx.current` file to track active issue, optionally create local issue file

#### Input Types & Flow Selection

| Input Type | Detection | Flow | Creates |
|------------|-----------|------|---------|
| Online URL | Starts with `http` | **Flow A** | `.ctx.current` only |
| Local file path | File exists | **Flow B1** | `.ctx.current` only |
| Requirements text | Otherwise | **Flow B2** | `.ctx.current` + issue file |

---

#### Flow A: Online Issue Initialization

**Supported Providers:**

| Provider | URL Pattern | ID Extraction |
|----------|-------------|---------------|
| **GitHub** | `github.com/*/issues/*` | `123` |
| **Linear** | `linear.app/*/issue/*` | `ABC-123` |

**Steps:**

```
1.1 Validate URL
     │
     └─> Unsupported URL → Error

1.2 Check Existing .ctx.current
     │
     └─> If exists → "Override existing issue? (y/n)"

1.3 Fetch Issue from Provider
     │
     ├─> GitHub: gh issue view <number> --json title,body,url
     └─> Linear: mcp__linear-server__get_issue(issueId)

1.4 Write .ctx.current
     │
     └─> { "issue": "https://github.com/..." }

1.5 Show Summary
     │
     └─> ✓ Initialized issue: <title>
         📎 Source: <url>
         Next: Run /ctx.work.plan
```

---

#### Flow B1: Offline Issue - Existing File

**Steps:**

```
1.1 Validate File Path
     │
     └─> Check existence + verify frontmatter (title, source, provider, status)

1.2 Check Existing .ctx.current (same as Flow A)

1.3 Write .ctx.current
     │
     └─> { "issue": "ctx/issues/2025-11-19-1430_add-dark-mode.md" }

1.4 Show Summary
```

---

#### Flow B2: Offline Issue - Create New

**Steps:**

```
2.1 Ensure Directory Exists
     │
     └─> mkdir -p ctx/issues

2.2 Generate Summary (AI task)
     │
     └─> Requirements → kebab-case slug (max 30 chars)
         Example: "Add dark mode toggle" → "add-dark-mode-toggle"

2.3 Generate Filename
     │
     └─> {YYYY-MM-DD}-{HHmm}_{summary}.md
         Example: 2025-11-19-1430_add-dark-mode-toggle.md

2.4 Check Existing .ctx.current (same as Flow A)

2.5 Generate Title (AI task)
     │
     └─> Generate concise, descriptive title

2.6 Create Issue File
     │
     └─> frontmatter + Spec section

2.7 Write .ctx.current

2.8 Show Summary
```

**Generated Issue File Structure:**

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

---

### /ctx.work.plan - Generate Implementation Plan

**Purpose**: Generate implementation plan for the active issue in `.ctx.current`

**Important**: This generates the **HOW** (implementation details), NOT the **WHAT** (requirements/spec)

#### Common Steps

```
Step 1: Read .ctx.current
         │
         └─> If not exists → Error: "Run /ctx.work.init first"

Step 2: Detect Online vs Offline
         │
         ├─> Starts with http → Flow A
         └─> Otherwise → Flow B
```

---

#### Flow A: Online Issue Planning

```
A1. Fetch Issue from Provider
     │
     ├─> GitHub: gh issue view + comments
     └─> Linear: get_issue + list_comments

A2. Parse Additional Requirements
     │
     └─> If $ARGUMENTS provided, append to Spec

A3. Load Relevant Contexts
     │
     └─> SlashCommand("/ctx.load <keywords-from-spec>")

A4. Q&A Session (Implementation Focus)
     │
     ├─> Spec ambiguity → AskUserQuestion
     ├─> Code reuse decisions
     ├─> Architecture impact
     └─> Breaking changes

A5. Generate Implementation Plan

A6. Sync Plan to Issue
     │
     ├─> GitHub: gh issue edit --body (original + plan)
     └─> Linear: update_issue(description: original + plan)

A7. Show Summary
     │
     └─> ✓ Implementation plan synced to <platform> issue
         📎 View: <issue-url>
```

---

#### Flow B: Offline Issue Planning

```
B1. Read Issue File

B2. Check Existing Plan
     │
     └─> If exists → "Override? (y/n)"

B3-B6: Same as Flow A

B7. Save Plan to File
     │
     ├─> No existing plan → Append
     └─> Override → Replace

B8. Update Frontmatter
     │
     └─> status: initialized → in_progress
         updated_at: <current timestamp>

B9. Show Summary
```

---

#### Q&A Session Guidelines

**What to Ask (Implementation):**
- ✓ Which files will change?
- ✓ What patterns/architecture to use?
- ✓ What existing code to reuse?
- ✓ What are the technical challenges?
- ✓ Will you write tests?

**What NOT to Ask (Spec):**
- ❌ What should this feature do?
- ❌ What are the requirements?
- ❌ What problem are we solving?
- ❌ Who are the users?

**Reason**: User already wrote the spec. Only plan HOW, not WHAT.

---

#### Plan Structure

```markdown
## Q&A

**Q: Found existing `ThemeManager` in `src/utils/theme.ts`. Extend or create new?**
A: Extend existing `ThemeManager` - maintains consistency with current architecture.

## Phases

### Phase 1: <Name>

**Step 1: <Task>**
- [ ] <Subtask>
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
- <Edge cases>
```

---

### /ctx.work.extract - Extract Context

**Purpose**: Extract valuable context from work session and update global/local context files

#### Workflow

```
Step 1: Read .ctx.current

Step 2: Collect Context Data
         │
         ├─> 2.1 Read Session History (JSONL)
         ├─> 2.2 Read Issue Information
         ├─> 2.3 Read PR Reviews (if exists)
         └─> 2.4 Read Git Context

Step 3: Analyze & Extract
         │
         ├─> Global Context (project-wide)
         │    - New architectural patterns
         │    - Coding conventions
         │    - Team guidelines
         │
         └─> Local Context (per-file)
              - File-specific implementation decisions
              - Edge cases
              - Dependencies

Step 4: Get User Approval
         │
         ├─> 1. ✅ Approve all
         ├─> 2. ✏️ Review and edit
         └─> 3. ❌ Cancel

Step 5: Apply Changes
         │
         ├─> Update global context files
         └─> Update local context files

Step 6: Prompt for Commit
         │
         └─> "📌 Next: Please run /ctx.work.commit"
```

#### What Makes Good Context

**Include:**
- Implementation decisions and rationale ("why" not just "what")
- Patterns and conventions established
- Edge cases and special handling
- Performance/security considerations

**Exclude:**
- Obvious information already in code
- Temporary debugging discussions
- Off-topic conversations
- Step-by-step implementation details (those are in git history)

---

### /ctx.work.commit - Commit Changes

**Purpose**: Create commits with conventional commit format

#### Workflow

```
1. Pre-commit Checks (unless --no-verify)
    │
    └─> lint, test, build, etc.

2. Stage Files
    │
    └─> If no staged files, run git add .

3. Analyze Changes
    │
    ├─> Check .ctx.current
    └─> Analyze git diff --cached

4. Create Commit
    │
    └─> <emoji> <type>: <description>

        <optional body>

        Issue: <link-if-available>
```

#### Commit Types & Emoji

| Emoji | Type | Purpose |
|-------|------|---------|
| ✨ | feat | New feature |
| 🐛 | fix | Bug fix |
| 📝 | docs | Documentation |
| 💄 | style | Formatting/style |
| ♻️ | refactor | Code refactoring |
| ⚡️ | perf | Performance improvements |
| ✅ | test | Tests |
| 🔧 | chore | Tooling, configuration |
| 🚀 | ci | CI/CD improvements |
| 🗑️ | revert | Reverting changes |

---

### /ctx.work.submit - Create PR

**Purpose**: Stage changes, create commit, run quality checks/tests, create PR

#### Workflow

```
Step 1: Create Todo List

Step 2: Check for Uncommitted Changes
         │
         └─> None → Stop

Step 3: Stage All Changes
         │
         └─> git add .

Step 4: Generate Commit Message
         │
         ├─> $ARGUMENTS provided → Use it
         └─> Not provided → Analyze diff and generate

Step 5: Create Commit
         │
         └─> HEREDOC format + Claude attribution

Step 6: Run Quality Checks (Lint/Format)
         │
         ├─> Success → Continue
         └─> Failure → Offer auto-fix

Step 7: Run Tests
         │
         ├─> Success → Continue
         └─> Failure → Stop PR creation

Step 8: Push Branch

Step 9: Read Issue Context (.ctx.current)

Step 10: Generate PR Description

Step 11: Create PR
          │
          └─> gh pr create --title --body

Step 12: Show Summary
```

#### PR Description Structure

```markdown
## Summary
{Brief summary of changes - from commit message or issue title}

## Changes
{List of main changes from git diff --stat}

## Related Issue
{Link to issue with title}

## Implementation Plan
{Implementation plan from issue file, if available}

## Test Plan
- [x] Quality checks passed
- [x] Tests passed
- [ ] Manual testing completed

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Data Structures

### .ctx.current

```json
{
  "issue": "<url-or-file-path>",
  "sessions": ["<session-path-1>", "<session-path-2>"]
}
```

**Fields:**
- `issue`: URL (online) or file path (offline)
  - Online example: `https://github.com/user/repo/issues/123`
  - Online example: `https://linear.app/team/issue/ABC-123`
  - Offline example: `ctx/issues/2025-11-20-0000_feature.md`
- `sessions`: Array of JSONL session file paths (optional)
  - Example: `[".claude/sessions/2025-11-20-session.jsonl"]`

**Location:** Project root (`.ctx.current`)

---

### Issue File (Offline)

```markdown
---
title: <title>
source: local
provider: local
created_at: 2025-11-19T14:30:00Z
updated_at: 2025-11-19T14:30:00Z
status: initialized | in_progress
git_branch: ""
---

# Spec

<user's requirements>

---

# Implementation Plan

_Generated at <timestamp>_

<plan content>
```

---

### Registry Structure

**local-context-registry.yml:**

```yaml
- source: src/services/payment.ctx.md
  target: /src/services/payment.ts
  checksum: abc123
  lastModified: 2025-11-19T14:30:00Z
  preview:
    what: Stripe payment processing
    when:
      - Processing customer payments
      - Managing subscriptions
```

**global-context-registry.yml:**

```yaml
- source: ctx/rules/api.md
  folder: rules
  checksum: def456
  lastModified: 2025-11-19T14:30:00Z
  preview:
    what: API design guidelines
    when:
      - Creating new endpoints
      - Designing API responses
```

---

## Issue Provider Integration

### GitHub

| Action | Command |
|--------|---------|
| Fetch issue | `gh issue view <number> --json title,body,url` |
| Fetch comments | `gh issue view <number> --json comments` |
| Update issue | `gh issue edit <number> --body "..."` |
| Create PR | `gh pr create --title --body` |

### Linear

| Action | MCP Tool |
|--------|----------|
| Fetch issue | `mcp__linear-server__get_issue(issueId)` |
| Fetch comments | `mcp__linear-server__list_comments(issueId)` |
| Update issue | `mcp__linear-server__update_issue(id, description)` |
| Create comment | `mcp__linear-server__create_comment(issueId, body)` |

**Linear URL Parsing:**
- URL format: `linear.app/{workspace}/issue/{issueId}`
- Example: `https://linear.app/team/issue/ABC-123` → `ABC-123`

---

## Error Handling

### Common Errors

| Code | Message | Resolution |
|------|---------|------------|
| no-active-session | No active work session found | Run `/ctx.work.init` first |
| invalid-provider | Unsupported issue provider | Use GitHub or Linear |
| file-not-found | Issue file not found | Check path in `.ctx.current` |
| invalid-frontmatter | Invalid issue file format | Check frontmatter fields |
| no-gh-cli | GitHub CLI not installed | https://cli.github.com |
| no-linear-mcp | Linear MCP not available | Setup Linear MCP in Claude Code settings |
| target-not-found | Target file not found | Verify target file exists |

---

## Best Practices

### Writing Context

1. **Be concise**: Each context should be 2-5 sentences
2. **Be actionable**: Future developers should know what to do
3. **Be specific**: Include concrete examples where helpful
4. **Be organized**: Group related contexts together

### Managing Work Sessions

1. **Issue first**: Always start with `/ctx.work.init`
2. **Plan before coding**: Use `/ctx.work.plan` to clarify approach
3. **Extract knowledge**: Capture insights with `/ctx.work.extract` before completion
4. **Regular audits**: Run `/ctx.audit` weekly

### Timestamp Format

**Standard**: ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`)

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```

**Example**: `2025-11-19T14:30:00Z`

---

## Status Management

| Issue Type | Status Flow | Managed In |
|------------|-------------|------------|
| **Offline** | `initialized` → `in_progress` | Local frontmatter |
| **Online** | Platform-dependent | GitHub/Linear |

---

## Summary Checklist

### Core Commands

- [ ] `/ctx.save` - Unified context save (local/global, create/update)
- [ ] `/ctx.load` - Load contexts via semantic search
- [ ] `/ctx.sync` - Sync registries (mechanical)
- [ ] `/ctx.audit` - Context health check (mechanical + semantic)
- [ ] `/ctx.status` - Show status

### Work Session Commands

- [ ] `/ctx.work.init` - Initialize issue (online/offline)
- [ ] `/ctx.work.plan` - Generate implementation plan
- [ ] `/ctx.work.extract` - Extract context from session
- [ ] `/ctx.work.commit` - Create conventional commit
- [ ] `/ctx.work.submit` - Tests + quality checks + create PR

---

This document comprehensively covers all ctx workflows. For detailed implementation of each command, refer to the individual template files in `src/templates/ai-commands/`.
