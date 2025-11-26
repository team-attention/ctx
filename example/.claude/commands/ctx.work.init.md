---
description: Initialize a new issue (online or offline)
argument-hint: <url|file-path|requirements>
allowed-tools: [Read, Write, Bash, mcp__linear-server__get_issue, mcp__linear-server__list_comments]
---

# Task

Initialize a new issue by creating `.ctx.current` and optionally creating a local issue file.

**Input Types**:
1. **Online URL** (starts with `http`): GitHub/Linear issue → Online flow
2. **Local file path** (existing file): Local issue file → Offline flow (use existing)
3. **Requirements text**: Create new issue file → Offline flow (create new)

---

# Workflow

## Step 1: Detect Input Type

Check `$ARGUMENTS`:

1. Starts with `http` → **Online issue** (Flow A)
2. Is a file path that exists → **Offline issue - existing file** (Flow B1)
3. Otherwise → **Offline issue - create new** (Flow B2)

---

## Flow A: Online Issue Initialization

### 1.1 Validate URL

**Supported Issue Providers:**

### GitHub

- **URL Pattern**: `github.com/*/issues/*`
- **ID Extraction**: `https://github.com/user/repo/issues/123` → `123`
- **Fetch Command**:
  ```bash
  gh issue view <number> --json title,body,url
  gh issue view <number> --json comments
  ```

### Linear

- **URL Pattern**: `linear.app/*/issue/*`
- **ID Extraction**: `https://linear.app/team/issue/ABC-123` → `ABC-123`
  - URL format: `linear.app/{workspace}/issue/{issueId}`
- **Fetch Command**:
  ```
  mcp__linear-server__get_issue(issueId: "ABC-123")
  mcp__linear-server__list_comments(issueId: "ABC-123")
  ```


If URL doesn't match any pattern, show error.

### 1.2 Check Existing `.ctx.current`

Use the Read tool to check if `.ctx.current` exists.

If exists:
- Read the JSON content
- Ask user: "Override existing issue `{current.issue}`? (y/n)"
- If user says no, exit

### 1.3 Fetch Issue from Provider

**Supported Issue Providers:**

### GitHub

- **URL Pattern**: `github.com/*/issues/*`
- **ID Extraction**: `https://github.com/user/repo/issues/123` → `123`
- **Fetch Command**:
  ```bash
  gh issue view <number> --json title,body,url
  gh issue view <number> --json comments
  ```

### Linear

- **URL Pattern**: `linear.app/*/issue/*`
- **ID Extraction**: `https://linear.app/team/issue/ABC-123` → `ABC-123`
  - URL format: `linear.app/{workspace}/issue/{issueId}`
- **Fetch Command**:
  ```
  mcp__linear-server__get_issue(issueId: "ABC-123")
  mcp__linear-server__list_comments(issueId: "ABC-123")
  ```


Extract from the fetched issue:
- Title
- Description (will be used as Spec)
- URL

### 1.4 Write `.ctx.current`

**.ctx.current Structure** (JSON format):

```json
{
  "issue": "<url-or-file-path>",
  "sessions": ["<session-path-1>", "<session-path-2>"]
}
```

**Fields:**
- `issue`: URL (online) or file path (offline) to the issue
  - Example (online): `https://github.com/user/repo/issues/123`
  - Example (online): `https://linear.app/team/issue/ABC-123`
  - Example (offline): `ctx/issues/2025-11-20-0000_feature.md`
- `sessions`: Array of JSONL session file paths (optional)
  - Example: `[".claude/sessions/2025-11-20-session.jsonl"]`

**Location:** Project root (`.ctx.current`)


Create the file with `issue` field set to the URL.

### 1.5 Show Summary

```
✓ Initialized issue: <title>
📎 Source: <url>

Next: Run /ctx.work.plan to generate implementation plan
```

---

## Flow B1: Offline Issue - Existing File

### 1.1 Validate File Path

Check if file exists and is in correct format (markdown file with frontmatter).

Read the file and verify it has required frontmatter fields:
- `title`
- `source`
- `provider`
- `status`

If invalid, show error.

### 1.2 Check Existing `.ctx.current`

Same as Flow A step 1.2.

### 1.3 Write `.ctx.current`

**.ctx.current Structure** (JSON format):

```json
{
  "issue": "<url-or-file-path>",
  "sessions": ["<session-path-1>", "<session-path-2>"]
}
```

**Fields:**
- `issue`: URL (online) or file path (offline) to the issue
  - Example (online): `https://github.com/user/repo/issues/123`
  - Example (online): `https://linear.app/team/issue/ABC-123`
  - Example (offline): `ctx/issues/2025-11-20-0000_feature.md`
- `sessions`: Array of JSONL session file paths (optional)
  - Example: `[".claude/sessions/2025-11-20-session.jsonl"]`

**Location:** Project root (`.ctx.current`)


Create the file with `issue` field set to the file path.
Example: `ctx/issues/2025-11-19-1430_add-dark-mode.md`

### 1.4 Show Summary

```
✓ Initialized issue from file: <filename>
📎 Title: <issue-title>
📊 Status: <status>

Next: Run /ctx.work.plan to generate implementation plan
```

---

## Flow B2: Offline Issue - Create New

### 2.1 Ensure Directory Exists

Check if `ctx/issues/` directory exists. Use Bash tool to create it:
```bash
mkdir -p ctx/issues
```

This ensures the directory structure is ready before creating the issue file.

### 2.2 Generate Summary from Requirements

**AI task**: Read the requirements text and generate a **concise summary** (max 30 characters).

Examples:
- "사용자가 설정 페이지에서 다크모드를 토글할 수 있어야 함" → "add-dark-mode-toggle"
- "Fix memory leak in rendering process" → "fix-memory-leak-rendering"
- "Implement user authentication with JWT" → "add-jwt-authentication"

Rules:
- Use kebab-case (lowercase with hyphens)
- Remove articles (a, an, the)
- Use action verbs (add, fix, update, etc.)
- Keep it under 30 characters

### 2.3 Generate Filename

Format: `{date}-{time}_{summary}.md`

Generate filename from current date and time:
- Date: `YYYY-MM-DD` (e.g., `2025-11-19`)
- Time: `HHmm` (e.g., `1430` for 2:30 PM)
- Summary: kebab-case slug from step 2.2

Example: `2025-11-19-1430_add-dark-mode-toggle.md`

If file exists, add numeric suffix: `-1`, `-2`, etc.

### 2.4 Check Existing `.ctx.current`

Same as Flow A step 1.2.

### 2.5 Generate Title

**AI task**: Generate a concise, descriptive title from requirements.

Examples:
- "사용자가 설정 페이지에서 다크모드를 토글할 수 있어야 함" → "Add dark mode toggle"
- "Fix memory leak in rendering process" → "Fix memory leak in rendering"
- "Implement user authentication with JWT" → "Add JWT authentication"

### 2.6 Create Issue File

Use the Write tool to create file at `ctx/issues/{filename}` with this structure:

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

### 2.7 Write `.ctx.current`

**.ctx.current Structure** (JSON format):

```json
{
  "issue": "<url-or-file-path>",
  "sessions": ["<session-path-1>", "<session-path-2>"]
}
```

**Fields:**
- `issue`: URL (online) or file path (offline) to the issue
  - Example (online): `https://github.com/user/repo/issues/123`
  - Example (online): `https://linear.app/team/issue/ABC-123`
  - Example (offline): `ctx/issues/2025-11-20-0000_feature.md`
- `sessions`: Array of JSONL session file paths (optional)
  - Example: `[".claude/sessions/2025-11-20-session.jsonl"]`

**Location:** Project root (`.ctx.current`)


Create the file with `issue` field set to `ctx/issues/<filename>`

### 2.8 Show Summary

```
✓ Created issue file: ctx/issues/<filename>
✓ Initialized .ctx.current

Next steps:
1. Edit the Spec section in the issue file if needed
2. Run /ctx.work.plan to generate implementation plan
```

---

# Error Handling

- **No arguments**: Show error with usage example:
  ```
  ❌ Error: No input provided
  Usage: /ctx.work.init <url|file-path|requirements>

  Examples:
    /ctx.work.init https://github.com/user/repo/issues/123
    /ctx.work.init ctx/issues/2025-11-19-1430_add-dark-mode.md
    /ctx.work.init "Add dark mode toggle to settings page"
  ```
- **Invalid file path**: File doesn't exist or missing required frontmatter
- **Unsupported URL**: Show supported formats (GitHub, Linear)
- **GitHub CLI not installed**: Show installation instructions (`gh` CLI required)
- **Linear MCP not available**: Show MCP setup instructions
- **File creation failed**: Show error with permissions/directory check

---

# Important Notes

- **DO NOT create implementation plan** - that's done by `/ctx.work.plan`
- **Online issues**: Only create `.ctx.current` pointing to URL. The plan will be synced to GitHub/Linear as comments by `/ctx.work.plan`
- **Offline issues**: Create local issue file in `ctx/issues/` + `.ctx.current` pointing to it
- **Status management**:
  - Offline issues: `initialized` → `in_progress` (after `/ctx.work.plan`)
  - Online issues: Status managed on GitHub/Linear platform
- **AI generates summary and title**: Be concise, actionable, and descriptive
- **Directory creation**: Ensure `ctx/issues/` directory exists before creating file (Flow B2 only)
- **Timestamp format**: Always use ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`)
