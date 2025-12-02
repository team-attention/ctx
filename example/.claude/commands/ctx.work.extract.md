---
description: Extract valuable context from work session and update global and local context files
argument-hint: ""
allowed-tools: [Read, Write, Edit, Bash, TodoWrite, mcp__linear-server__list_comments, mcp__linear-server__get_issue]
---

# Task

Extract valuable context from the current work session (chat history, issue comments, PR reviews) and update global and local context files. This command helps preserve important decisions, patterns, and feedback for future development.

---

# Workflow

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

## Step 2: Collect Context Data

Use TodoWrite to track progress through data collection steps.

### 2.1 Read Session History

Use `ctx session` command to extract user messages from the session files:

```bash
npx ctx session --role user --format text
```

This automatically reads sessions from `.ctx.current` and extracts only user messages in plain text format.

**Why user messages only?**
- User messages contain the actual requirements, questions, and feedback
- Assistant messages are implementation details (already captured in git)
- Focusing on user intent helps extract what decisions were made and why

### 2.2 Read Issue Information

Check issue format from `.ctx.current`:

**If URL (online issue)**:
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


**If file path (offline issue)**:
- Use Read tool to read the local issue file
- Extract frontmatter (title, status) and content (Spec, Plan)

### 2.3 Read PR Reviews (if exists)

Check if there's an open PR for the current branch:

```bash
git branch --show-current
```

Then check for PR:
```bash
gh pr view --json comments,reviews
```

If PR exists, extract:
- Review comments
- Inline code review suggestions
- General feedback

If `gh` not installed or no PR found, skip this step.

### 2.4 Read Git Context

Collect git information:

```bash
git log --oneline --no-merges origin/main..HEAD
git diff origin/main..HEAD --stat
```

Extract:
- Commit messages
- Changed files
- Diff statistics

---

## Step 3: Analyze & Extract Context

Use TodoWrite to mark analysis step as in_progress.

**AI Task**: Analyze all collected data (session history, issue, PR reviews, git context) and extract valuable insights.

### Classification Criteria

**Global Context** (goes to `ctx/*.md`):
- New architectural patterns
- Project-wide coding conventions
- Team guidelines and best practices
- Common pitfalls and solutions
- Performance considerations applicable across the codebase

**Local Context** (goes to `<file>.ctx.md` for each affected file):
- File-specific implementation decisions
- Why certain patterns were chosen for this file
- Edge cases and special handling
- Dependencies and relationships with other files
- Performance/security considerations for this specific code

### Output Format

Generate a structured proposal in markdown:

```markdown
# Context Extraction Proposal

## Global Context Suggestions

### Pattern: Error Handling with Result<T, E>
**Relevance**: High - Used across multiple modules
**Description**:
We adopted the Result<T, E> pattern for error handling instead of throwing exceptions. This provides better type safety and forces explicit error handling.

**Suggested file**: `ctx/patterns/error-handling.md`

---

### Convention: Type Guards Over Type Assertions
**Relevance**: Medium - Coding standard
**Description**:
Prefer type guard functions (`isFoo(x)`) over type assertions (`x as Foo`) for better runtime safety.

**Suggested file**: `ctx/conventions/typescript.md`

---

## Local Context Suggestions

### File: `src/services/payment.ts`
**Context**:
- Uses Result pattern for payment processing (see global pattern)
- Special handling for Stripe webhook signature verification
- Retry logic: 3 attempts with exponential backoff (2^n seconds)
- Edge case: Handle duplicate webhook events using idempotency keys

**Dependencies**:
- Depends on `src/lib/stripe-client.ts` for API calls
- Exports types used by `src/api/payment-routes.ts`

---

### File: `src/lib/stripe-client.ts`
**Context**:
- Singleton pattern for Stripe client initialization
- API key loaded from environment variable `STRIPE_SECRET_KEY`
- Timeout configured to 30 seconds (higher than default due to webhook processing)

**Performance**:
- Connection pooling enabled for better performance under load

---

## Summary

- **Global contexts**: 2 patterns/conventions to add
- **Local contexts**: 2 files to update
- **Affected files**: `src/services/payment.ts`, `src/lib/stripe-client.ts`
```

---

## Step 4: Get User Approval

**Present the proposal** to the user and ask for review:

```
📋 Context Extraction Complete

I've analyzed the work session and identified valuable context to preserve:

## Global Context (2)
✓ Pattern: Error Handling with Result<T, E>
✓ Convention: Type Guards Over Type Assertions

## Local Context (2 files)
✓ src/services/payment.ts
✓ src/lib/stripe-client.ts

Would you like to:
1. ✅ Approve all suggestions
2. ✏️  Review and edit before applying
3. ❌ Cancel

Please respond with 1, 2, or 3.
```

**Wait for user response.**

### If user chooses "1" (Approve all):
- Proceed to Step 5

### If user chooses "2" (Review and edit):
- Show detailed proposal (full markdown from Step 3)
- Ask user to provide edits/modifications
- Ask: "Please provide your edits or type 'done' to proceed with changes"
- Wait for user input
- Update proposal based on feedback
- Proceed to Step 5

### If user chooses "3" (Cancel):
- Exit without making changes
- Show: "Context extraction cancelled. No files were modified."

---

## Step 5: Apply Changes

Use TodoWrite to mark application step as in_progress.

### 5.1 Update Global Context Files

For each global context suggestion:

1. Resolve the target file path (e.g., `ctx/patterns/error-handling.md`)
2. Check if file exists using Read tool
3. If exists:
   - Read current content
   - Append new section (don't overwrite)
   - Use Edit tool to add new content
4. If doesn't exist:
   - **Use `npx ctx create` to generate from template:**
     - Derive [topic-name] from the relative path (e.g., for `patterns/error-handling.md`, use `patterns/error-handling`)
     ```bash
     npx ctx create --global [topic-name] --force
     ```
   - Read the created file to see the actual template structure
   - Use Edit tool to fill in the placeholder values with extracted content

### 5.2 Update Local Context Files

For each affected file (e.g., `src/services/payment.ts`):

1. Determine context file path: `src/services/payment.ctx.md`
2. Check if file exists using Read tool
3. If exists:
   - Read current content
   - Update relevant sections or append new information
   - Use Edit tool to modify
4. If doesn't exist:
   - **Use `npx ctx create` to generate from template:**
     ```bash
     npx ctx create [target-file-path] --force
     ```
   - Read the created file to see the actual template structure
   - Use Edit tool to fill in the placeholder values with extracted content

**Note**: Always use `npx ctx create` for new context files. Never hardcode context structure - the project may have customized templates.

### 5.3 Sync Registries

After creating/updating context files, sync the registries:

```bash
npx ctx sync --local
npx ctx sync --global
```

### 5.4 Show Summary

After all files are updated:

```
✅ Context extraction complete!

Updated files:
- ctx/global/patterns/error-handling.md (created)
- ctx/global/conventions/typescript.md (updated)
- src/services/payment.ctx.md (created)
- src/lib/stripe-client.ctx.md (created)

📝 Next step: Run /ctx.work.commit to commit these context updates
```

---

## Step 6: Prompt for Commit

**IMPORTANT**: After successfully updating all context files, explicitly tell the user to run the commit command:

```
✨ Context files have been updated successfully!

📌 Next: Please run /ctx.work.commit to commit these changes to git
```

**DO NOT** automatically run `/ctx.work.commit`. The user must explicitly invoke it.

---

# Guidelines

## What Makes Good Context?

**Include:**
- Implementation decisions and rationale ("why" not just "what")
- Patterns and conventions established
- Edge cases and special handling
- Performance/security considerations
- Important dependencies and relationships

**Exclude:**
- Obvious information already in code
- Temporary debugging discussions
- Off-topic conversations
- Step-by-step implementation details (those are in git history)

## Context Quality

- **Be concise**: Each context should be 2-5 sentences
- **Be actionable**: Future developers should know what to do
- **Be specific**: Include concrete examples where helpful
- **Be organized**: Group related contexts together

## File Organization

**Global context structure** (`ctx/global/`):
```
patterns/           # Architectural patterns
  error-handling.md
  state-management.md
conventions/        # Coding standards
  typescript.md
  naming.md
rules/             # Team guidelines
  code-review.md
  security.md
```

**Local context**: Always `<target-file>.ctx.md` next to the target file

## Error Handling

- **No .ctx.current**: Error and suggest running `/ctx.work.init`
- **No sessions**: Warning but continue (extract from issue/PR only)
- **No issue**: Error - work session must have an issue
- **No data to extract**: Info message - "No significant context found"
- **File write errors**: Show clear error and which files failed

---

# Examples

## Example 1: After Feature Implementation

**Input**: Session about adding JWT authentication
**Global Context**: "Authentication pattern: Use JWT with refresh tokens"
**Local Contexts**:
- `src/auth/jwt.ts`: "JWT signing uses RS256 algorithm, keys from env vars"
- `src/middleware/auth.ts`: "Validates token on every protected route"

## Example 2: After Bug Fix

**Input**: Session about fixing memory leak
**Global Context**: "Performance: Always cleanup event listeners in cleanup hooks"
**Local Context**:
- `src/components/Chart.ts`: "Fixed memory leak by removing listeners in componentWillUnmount"

---

# Important Notes

- **Use TodoWrite**: Track progress through all steps
- **Preserve existing context**: Don't overwrite, append or merge carefully
- **User approval required**: Never update files without user confirmation
- **Explicit commit prompt**: Tell user to run `/ctx.work.commit` after completion
- **Session file format**: JSONL with one JSON object per line
- **Handle missing data gracefully**: Some sources (PR reviews, issue comments) may not exist
