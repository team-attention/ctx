---
description: Initialize a new issue (online or offline)
argument-hint: [-w|--worktree] <url|file-path|requirements>
allowed-tools: [Read, Write, Bash, mcp__linear-server__get_issue, mcp__linear-server__list_comments, mcp__linear-server__create_issue]
---

{{snippet:load-config}}

# Task

Initialize a new issue by creating `.ctx.current` and optionally creating a new issue (local file, GitHub, or Linear based on config).

**Input Types**:
1. **Online URL** (starts with `http`): GitHub/Linear issue → Online flow
2. **Local file path** (existing file): Local issue file → Offline flow (use existing)
3. **Requirements text**: Create new issue → Based on `{{work.issue_store.type}}` config:
   - `local`: Create local file in `{{global.directory}}/issues/`
   - `github-issue`: Create GitHub Issue via `gh` CLI
   - `linear`: Create Linear Issue via MCP

**Options**:
- `-w, --worktree`: Create a git worktree for isolated work environment

---

# Workflow

## Step 0: Parse Flags

Parse `$ARGUMENTS` to separate flags from actual input:

1. Check for `-w` or `--worktree` flag
2. If found: `worktree_mode = true`, remove flag from arguments
3. Remaining arguments = `actual_input`

Examples:
- `--worktree https://github.com/user/repo/issues/123` → worktree_mode=true, actual_input=URL
- `-w "Add dark mode toggle"` → worktree_mode=true, actual_input=requirements
- `https://github.com/user/repo/issues/123` → worktree_mode=false, actual_input=URL

---

## Step 0.5: Create Worktree (if worktree_mode)

**Skip this step if worktree_mode is false.**

### 0.5.1 Check Git Repository

Verify current directory is a git repository:
```bash
git rev-parse --git-dir
```
If not a git repo, show error and suggest using without `--worktree` flag.

### 0.5.2 Determine Identifier

Based on `actual_input` type:

| Input Type | Identifier | Example |
|------------|------------|---------|
| GitHub URL | Issue number | `123` |
| Linear URL | Issue ID | `ABC-123` |
| File path | Filename stem | `2025-11-19-1430_feature` |
| Requirements | Timestamp | `20251203-1430` |

**Extraction patterns**:
- GitHub: `/issues/(\d+)` → `123`
- Linear: `/issue/([A-Z]+-\d+)` → `ABC-123`

### 0.5.3 Create Worktree

```bash
mkdir -p {{work.directory}}
git worktree add {{work.directory}}/issue-{identifier} -b issue-{identifier}
```

**On error** (branch already exists):
```
❌ Error: Branch 'issue-{identifier}' already exists.

Solutions:
1. Delete existing branch: git branch -d issue-{identifier}
2. Remove stale worktree: git worktree remove {{work.directory}}/issue-{identifier}
3. Use different identifier
```

### 0.5.4 Set Working Directory Context

From this point forward, all file operations use the worktree path:
- `WORKTREE_PATH = {{work.directory}}/issue-{identifier}`
- `.ctx.current` → `{WORKTREE_PATH}/.ctx.current`
- `{{global.directory}}/issues/` → `{WORKTREE_PATH}/{{global.directory}}/issues/`

---

## Step 1: Detect Input Type

Check `actual_input` (not `$ARGUMENTS`):

1. Starts with `http` → **Online issue** (Flow A)
2. Is a file path that exists → **Existing local file** (Flow B1)
3. Otherwise → **Create new issue** - branch based on `{{work.issue_store.type}}`:
   - `local` → Flow B2-local (create local file)
   - `github-issue` → Flow B2-github (create GitHub Issue)
   - `linear` → Flow B2-linear (create Linear Issue)

---

## Flow A: Online Issue Initialization

### 1.1 Validate URL

{{snippet:issue-providers}}

If URL doesn't match any pattern, show error.

### 1.2 Check Existing `.ctx.current`

Use the Read tool to check if `.ctx.current` exists.

If exists:
- Read the JSON content
- Ask user: "Override existing issue `{current.issue}`? (y/n)"
- If user says no, exit

### 1.3 Fetch Issue from Provider

{{snippet:issue-providers}}

Extract from the fetched issue:
- Title
- Description (will be used as Spec)
- URL

### 1.4 Write `.ctx.current`

{{snippet:ctx-current}}

Create the file with `issue` field set to the URL.

### 1.5 Show Summary

**If worktree_mode is false:**
```
✓ Initialized issue: <title>
📎 Source: <url>

Next: Run /ctx.work.plan to generate implementation plan
```

**If worktree_mode is true:**
```
✓ Worktree created: {{work.directory}}/issue-{identifier}
✓ Branch: issue-{identifier}
✓ Initialized issue: <title>
📎 Source: <url>

👉 To start working:
   cd {{work.directory}}/issue-{identifier}

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

{{snippet:ctx-current}}

Create the file with `issue` field set to the file path.
Example: `{{global.directory}}/issues/2025-11-19-1430_add-dark-mode.md`

### 1.4 Show Summary

**If worktree_mode is false:**
```
✓ Initialized issue from file: <filename>
📎 Title: <issue-title>
📊 Status: <status>

Next: Run /ctx.work.plan to generate implementation plan
```

**If worktree_mode is true:**
```
✓ Worktree created: {{work.directory}}/issue-{identifier}
✓ Branch: issue-{identifier}
✓ Initialized issue from file: <filename>
📎 Title: <issue-title>
📊 Status: <status>

👉 To start working:
   cd {{work.directory}}/issue-{identifier}

Next: Run /ctx.work.plan to generate implementation plan
```

---

## Flow B2-local: Create Local Issue File

> **When**: `{{work.issue_store.type}}` is `local`

### 2.1 Ensure Directory Exists

Check if `{{global.directory}}/issues/` directory exists. Use Bash tool to create it:
```bash
mkdir -p {{global.directory}}/issues
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

Use the Write tool to create file at `{{global.directory}}/issues/{filename}` with this structure:

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

{{snippet:ctx-current}}

Create the file with `issue` field set to `{{global.directory}}/issues/<filename>`

### 2.8 Show Summary

**If worktree_mode is false:**
```
✓ Created issue file: {{global.directory}}/issues/<filename>
✓ Initialized .ctx.current

Next steps:
1. Edit the Spec section in the issue file if needed
2. Run /ctx.work.plan to generate implementation plan
```

**If worktree_mode is true:**
```
✓ Worktree created: {{work.directory}}/issue-{identifier}
✓ Branch: issue-{identifier}
✓ Created issue file: {{global.directory}}/issues/<filename>
✓ Initialized .ctx.current

👉 To start working:
   cd {{work.directory}}/issue-{identifier}

Next steps:
1. Edit the Spec section in the issue file if needed
2. Run /ctx.work.plan to generate implementation plan
```

---

## Flow B2-github: Create GitHub Issue

> **When**: `{{work.issue_store.type}}` is `github-issue`

### 2.1 Check GitHub CLI

Verify `gh` CLI is installed and authenticated:
```bash
gh auth status
```

If not authenticated, show error:
```
❌ Error: GitHub CLI not authenticated
Run: gh auth login
```

### 2.2 Generate Title

**AI task**: Generate a concise, descriptive title from requirements.

Examples:
- "사용자가 설정 페이지에서 다크모드를 토글할 수 있어야 함" → "Add dark mode toggle"
- "Fix memory leak in rendering process" → "Fix memory leak in rendering"

### 2.3 Check Existing `.ctx.current`

Same as Flow A step 1.2.

### 2.4 Create GitHub Issue

Extract repo info from `{{work.issue_store.url}}`:
- Pattern: `https://github.com/{owner}/{repo}/issues`
- Extract: `owner`, `repo`

Create issue using `gh` CLI:
```bash
gh issue create --repo {owner}/{repo} --title "<generated-title>" --body "<requirements>"
```

Capture the returned issue URL from stdout (e.g., `https://github.com/owner/repo/issues/123`).

### 2.5 Write `.ctx.current`

{{snippet:ctx-current}}

Create the file with `issue` field set to the **GitHub Issue URL** returned from step 2.4.

### 2.6 Show Summary

**If worktree_mode is false:**
```
✓ Created GitHub Issue: <title>
📎 URL: <github-issue-url>
✓ Initialized .ctx.current

Next: Run /ctx.work.plan to generate implementation plan
```

**If worktree_mode is true:**
```
✓ Worktree created: {{work.directory}}/issue-{identifier}
✓ Branch: issue-{identifier}
✓ Created GitHub Issue: <title>
📎 URL: <github-issue-url>

👉 To start working:
   cd {{work.directory}}/issue-{identifier}

Next: Run /ctx.work.plan to generate implementation plan
```

---

## Flow B2-linear: Create Linear Issue

> **When**: `{{work.issue_store.type}}` is `linear`

### 2.1 Check Linear MCP

Verify Linear MCP server is available by attempting to use `mcp__linear-server__create_issue`.

If not available, show error:
```
❌ Error: Linear MCP server not available
Please configure Linear MCP server in your settings.
```

### 2.2 Generate Title

**AI task**: Generate a concise, descriptive title from requirements.

Examples:
- "사용자가 설정 페이지에서 다크모드를 토글할 수 있어야 함" → "Add dark mode toggle"
- "Fix memory leak in rendering process" → "Fix memory leak in rendering"

### 2.3 Check Existing `.ctx.current`

Same as Flow A step 1.2.

### 2.4 Get Team ID from URL

Extract team/workspace info from `{{work.issue_store.url}}`:
- Pattern: `https://linear.app/{workspace}`
- The workspace name is used to identify the team

Use `mcp__linear-server__list_teams` (if available) to get the team ID, or ask user to provide it.

### 2.5 Validate project

Check if `{{work.issue_store.project}}` is configured. If not, show error:
```
❌ Error: project is required for Linear issue store
Please add project to your ctx.config.yaml:

work:
  issue_store:
    type: linear
    url: https://linear.app/{workspace}
    project: YOUR_PROJECT_NAME
```

### 2.6 Create Linear Issue

Use `mcp__linear-server__create_issue` with:
- `title`: Generated title from step 2.2
- `description`: User's requirements
- `teamId`: From step 2.4
- `project`: From `{{work.issue_store.project}}`

Capture the returned issue identifier (e.g., `ABC-123`) and URL.  

### 2.7 Write `.ctx.current`

{{snippet:ctx-current}}

Create the file with `issue` field set to the **Linear Issue URL** (e.g., `https://linear.app/workspace/issue/ABC-123`).

### 2.8 Show Summary

**If worktree_mode is false:**
```
✓ Created Linear Issue: <title>
📎 ID: <issue-id> (e.g., ABC-123)
📎 URL: <linear-issue-url>
✓ Initialized .ctx.current

Next: Run /ctx.work.plan to generate implementation plan
```

**If worktree_mode is true:**
```
✓ Worktree created: {{work.directory}}/issue-{identifier}
✓ Branch: issue-{identifier}
✓ Created Linear Issue: <title>
📎 ID: <issue-id>
📎 URL: <linear-issue-url>

👉 To start working:
   cd {{work.directory}}/issue-{identifier}

Next: Run /ctx.work.plan to generate implementation plan
```

---

# Error Handling

- **No arguments**: Show error with usage example:
  ```
  ❌ Error: No input provided
  Usage: /ctx.work.init [-w|--worktree] <url|file-path|requirements>

  Examples:
    /ctx.work.init https://github.com/user/repo/issues/123
    /ctx.work.init --worktree https://github.com/user/repo/issues/123
    /ctx.work.init {{global.directory}}/issues/2025-11-19-1430_add-dark-mode.md
    /ctx.work.init -w "Add dark mode toggle to settings page"
  ```
- **Invalid file path**: File doesn't exist or missing required frontmatter
- **Unsupported URL**: Show supported formats (GitHub, Linear)
- **GitHub CLI not installed**: Show installation instructions (`gh` CLI required)
- **GitHub CLI not authenticated**: Run `gh auth login` first
- **GitHub issue creation failed**: Check repo permissions or network
- **Linear MCP not available**: Show MCP setup instructions
- **Linear team not found**: Ask user to verify workspace URL or provide team ID
- **File creation failed**: Show error with permissions/directory check
- **Not a git repository** (with --worktree): Cannot create worktree outside git repo
- **Branch already exists** (with --worktree): Suggest deleting branch or using different identifier
- **Worktree path already exists**: Ask user if they want to use existing worktree
- **Invalid issue_store config**: Show supported types (local, github-issue, linear)

---

# Important Notes

- **DO NOT create implementation plan** - that's done by `/ctx.work.plan`
- **Issue store config** (`{{work.issue_store.type}}`):
  - `local`: Create file in `{{global.directory}}/issues/`, `.ctx.current` points to file path
  - `github-issue`: Create GitHub Issue via `gh` CLI, `.ctx.current` points to issue URL
  - `linear`: Create Linear Issue via MCP, `.ctx.current` points to issue URL
- **Online URL input** (starts with `http`): Always use Flow A regardless of `issue_store.type`
- **Status management**:
  - Local issues: `initialized` → `in_progress` (after `/ctx.work.plan`)
  - GitHub/Linear issues: Status managed on respective platforms
- **AI generates summary and title**: Be concise, actionable, and descriptive
- **Directory creation**: Ensure `{{global.directory}}/issues/` directory exists before creating file (Flow B2-local only)
- **Timestamp format**: Always use ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`)
- **Worktree mode**: When `--worktree` flag is used:
  - All files are created inside the worktree directory
  - User must `cd` into worktree to continue work
  - Each worktree is a fully independent work environment
  - Branch name follows pattern: `issue-{identifier}`
