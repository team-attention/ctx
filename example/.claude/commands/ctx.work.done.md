---
description: Complete work session, extract context, and cleanup workspace
argument-hint: [--skip-extract]
allowed-tools: [Read, Write, Edit, Bash, TodoWrite, SlashCommand, mcp__linear-server__list_comments, mcp__linear-server__get_issue]
---

# Task

Complete the current work session by extracting valuable context and cleaning up the workspace (`.ctx.current`). This command marks the end of the issue lifecycle.

**Options**:
- `--skip-extract`: Skip context extraction step (use when you've already run `/ctx.work.extract`)

---

# Workflow

## Step 0: Parse Flags

Parse `$ARGUMENTS` to check for flags:

1. Check for `--skip-extract` flag
2. If found: `skip_extract = true`

---

## Step 1: Read .ctx.current

Use the Read tool to check if `.ctx.current` exists in the project root.

If it doesn't exist:
# Common Error Messages

## no-active-session
```
❌ Error: No active work session found
Run /ctx.work.init first to start a work session
```

## invalid-provider
```
❌ Error: Unsupported issue provider
Supported: GitHub (github.com), Linear (linear.app)
```

## file-not-found
```
❌ Error: Issue file not found
Check the path in .ctx.current
```

## invalid-frontmatter
```
❌ Error: Invalid issue file format
File must be markdown with frontmatter containing: title, source, provider, status
```

## no-gh-cli
```
❌ Error: GitHub CLI not installed
Install: https://cli.github.com
```

## no-linear-mcp
```
❌ Error: Linear MCP not available
Setup Linear MCP server in Claude Code settings
```

## target-not-found
```
❌ Error: Target file not found: [path]
Cannot create context for non-existent file
```

## context-already-exists
```
⚠️ Context already exists: [path]
Use UPDATE mode or specify a different path
```

## invalid-context-path
```
❌ Error: Invalid context path format
Expected: *.ctx.md (local) or ctx/**/*.md (global)
```

## registry-lookup-failed
```
⚠️ Warning: Could not find context in registry for target: [path]
Creating new context file
```


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


Extract:
- Issue reference (URL or file path)
- Session file paths

---

## Step 2: Verify Work is Submitted

Check if work has been pushed/submitted:

```bash
git status
git log --oneline origin/main..HEAD 2>/dev/null || git log --oneline -5
```

Check for unpushed commits or uncommitted changes.

**If uncommitted changes exist:**
```
⚠️ Warning: You have uncommitted changes

Uncommitted files:
  - <file1>
  - <file2>

Would you like to:
1. Continue anyway (changes will be lost from context)
2. Abort and run /ctx.work.commit first

Please respond with 1 or 2.
```

Wait for user response. If user chooses 2, exit.

**If unpushed commits exist:**
```
⚠️ Warning: You have unpushed commits

Unpushed commits:
  - <commit1>
  - <commit2>

Would you like to:
1. Continue anyway
2. Abort and run /ctx.work.submit first

Please respond with 1 or 2.
```

Wait for user response. If user chooses 2, exit.

---

## Step 3: Extract Context (unless --skip-extract)

**Skip this step if `skip_extract` is true.**

Use TodoWrite to track progress.

Run context extraction by invoking the extract command:

```
SlashCommand("/ctx.work.extract")
```

This will:
- Analyze session history, issue, PR reviews
- Generate context proposals
- Get user approval
- Update global/local context files
- Sync registries

**Wait for extraction to complete before proceeding.**

If user cancels extraction (chooses option 3), continue to cleanup anyway.

---

## Step 4: Update Issue Status

### 4.1 Detect Issue Type

Read `.ctx.current` and determine if issue is online or offline.

### 4.2 Update Status

**If offline issue (file path):**

Read the issue file and update frontmatter:

```markdown
---
title: <existing>
source: <existing>
provider: <existing>
created_at: <existing>
updated_at: <current-timestamp>
status: completed
completed_at: <current-timestamp>
git_branch: <current-branch>
---
```

Use Edit tool to update the frontmatter fields.

**If online issue (URL):**

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


For GitHub, add a completion comment:
```bash
gh issue comment <number> --body "✅ Work completed

Branch: $(git branch --show-current)
PR: $(gh pr view --json url -q .url 2>/dev/null || echo 'N/A')

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

For Linear:
```
mcp__linear-server__create_comment(issueId: "<id>", body: "✅ Work completed...")
```

---

## Step 5: Cleanup Workspace

### 5.1 Archive Session Info (optional)

If `.ctx.current` contains session paths, they are already saved.
No additional action needed - sessions are preserved for future reference.

### 5.2 Delete .ctx.current

```bash
rm .ctx.current
```

This marks the workspace as clean and ready for a new issue.

### 5.3 Check for Worktree

Check if current directory is a worktree:

```bash
git worktree list
pwd
```

If working in a worktree (path contains `.worktrees/`):
```
ℹ️ You're in a worktree: .worktrees/issue-<id>

To cleanup the worktree later:
  cd <main-repo-path>
  git worktree remove .worktrees/issue-<id>
```

---

## Step 6: Show Completion Summary

Display final summary:

```
✅ Work session completed!

📋 Issue: <title>
   Source: <url-or-file>
   Status: completed

📝 Context extracted:
   - <N> global contexts updated
   - <M> local contexts updated
   (or "Skipped" if --skip-extract was used)

🧹 Cleanup:
   ✓ .ctx.current removed
   ✓ Issue status updated

📊 Session stats:
   - Commits: <count>
   - Files changed: <count>
   - PR: <url-if-exists>

---

Ready for next issue! Run /ctx.work.init to start.
```

---

# Guidelines

## When to Use This Command

- After PR is merged
- After PR is approved and ready
- When you're done working on an issue (even without PR)
- When you want to switch to a different issue

## What This Command Does

1. **Preserves knowledge** - Extracts valuable context before closing
2. **Updates status** - Marks issue as completed
3. **Cleans workspace** - Removes `.ctx.current` for fresh start
4. **Provides closure** - Clear summary of what was accomplished

## What This Command Does NOT Do

- Does NOT delete the issue file (offline issues are archived)
- Does NOT close GitHub/Linear issues (that's a manual decision)
- Does NOT delete git branches (user may need them)
- Does NOT remove worktrees automatically (user controls this)

---

# Error Handling

- **No .ctx.current**: Show error and suggest running `/ctx.work.init`
- **Extract fails**: Ask user if they want to continue without extraction
- **Issue file not found**: Warning but continue with cleanup
- **Git commands fail**: Warning but continue with cleanup
- **Online provider unavailable**: Skip status update, continue with cleanup

---

# Examples

## Example 1: Normal completion

```bash
/ctx.work.done
```

Output:
```
📋 Reading work session...
✓ Found issue: Add dark mode toggle

📝 Extracting context...
[... extraction flow ...]
✓ Context extraction complete

📊 Updating issue status...
✓ Issue marked as completed

🧹 Cleaning up workspace...
✓ Removed .ctx.current

---

✅ Work session completed!

📋 Issue: Add dark mode toggle
   Source: ctx/issues/2025-12-03-1430_add-dark-mode.md
   Status: completed

📝 Context extracted:
   - 1 global context updated
   - 2 local contexts updated

📊 Session stats:
   - Commits: 5
   - Files changed: 12
   - PR: https://github.com/user/repo/pull/456

---

Ready for next issue! Run /ctx.work.init to start.
```

## Example 2: Skip extraction (already done)

```bash
/ctx.work.done --skip-extract
```

Output:
```
📋 Reading work session...
✓ Found issue: Fix memory leak

📝 Context extraction: Skipped (--skip-extract)

📊 Updating issue status...
✓ Issue marked as completed

🧹 Cleaning up workspace...
✓ Removed .ctx.current

---

✅ Work session completed!
...
```

## Example 3: With uncommitted changes

```bash
/ctx.work.done
```

Output:
```
📋 Reading work session...
✓ Found issue: Add authentication

⚠️ Warning: You have uncommitted changes

Uncommitted files:
  - src/auth/login.ts
  - src/auth/logout.ts

Would you like to:
1. Continue anyway (changes will be lost from context)
2. Abort and run /ctx.work.commit first

> 2

Aborted. Please run /ctx.work.commit first.
```

---

# Related Commands

- `/ctx.work.init` - Start a new work session (opposite of done)
- `/ctx.work.extract` - Extract context (called automatically unless --skip-extract)
- `/ctx.work.commit` - Commit changes (should be done before done)
- `/ctx.work.submit` - Create/update PR (should be done before done)
