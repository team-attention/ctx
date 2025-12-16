---
description: Review code changes with relevant context loaded
argument-hint: [review requirements]
allowed-tools: [Read, Bash, SlashCommand, TodoWrite]
---

# Task

Review code changes on the current branch by:
1. Analyzing diff against base branch (default: `main`)
2. Loading relevant contexts for changed files
3. Providing comprehensive code review **focused on user requirements** (if provided)

---

# Workflow

## Step 1: Parse User Requirements

**If `$ARGUMENTS` provided:**
- Use as **review requirements** - specific areas to focus on

**Examples:**
- `/ctx.work.review` → General review (all aspects)
- `/ctx.work.review 성능과 보안에 집중` → Focus on performance and security
- `/ctx.work.review API 변경사항이 하위호환성을 유지하는지 확인` → Check API backward compatibility
- `/ctx.work.review 이 기능이 로그인 없이 접근 가능한지 확인해줘` → Check specific requirement

**Display:**
```
🔍 Review Configuration

User Requirements: <$ARGUMENTS or "General review (all aspects)">
```

---

## Step 2: Create Todo List

Create todos to track progress:

1. Identify base branch and get diff
2. Analyze changed files
3. Load relevant contexts
4. Perform code review (with focus on user requirements if provided)

---

## Step 3: Identify Base Branch

- Default to `main` branch
- If `main` doesn't exist, try `master`

```bash
git rev-parse --verify main 2>/dev/null || git rev-parse --verify master 2>/dev/null
```

---

## Step 3: Get Diff Statistics

Get overview of changes:

```bash
git diff <base-branch>...HEAD --stat
```

Get list of changed files:

```bash
git diff <base-branch>...HEAD --name-only
```

**Output:**
```
📊 Changes Summary

Base: <base-branch>
Head: <current-branch>

Files changed: N
Insertions: +X
Deletions: -Y

Changed files:
• src/auth/login.ts
• src/components/Button.tsx
• ...
```

---

## Step 4: Analyze Changed Files

For each changed file, categorize:
- **Added**: New files
- **Modified**: Existing files with changes
- **Deleted**: Removed files

Extract key technical terms from:
- File paths (e.g., `src/auth/*` → "authentication")
- Function names in diff
- Import statements

---

## Step 5: Load Relevant Contexts

**5.1. Load contexts for changed areas:**

Extract keywords from changed files and load relevant contexts:

```
SlashCommand(command: "/ctx.load <keywords-from-changed-files>")
```

**Examples:**
- Changed `src/auth/login.ts` → `/ctx.load authentication login`
- Changed `src/components/Button.tsx` → `/ctx.load components button ui`
- Changed `src/api/users.ts` → `/ctx.load api users`

**5.2. Load global review guidelines (if exists):**

Check for review-related contexts:
```
SlashCommand(command: "/ctx.load code review guidelines")
```

---

## Step 6: Get Detailed Diff

Read the actual diff content:

```bash
git diff <base-branch>...HEAD
```

If diff is too large, read file by file:

```bash
git diff <base-branch>...HEAD -- <file-path>
```

---

## Step 7: Perform Code Review

**If user requirements provided:**
- **Primary focus**: Address user's specific requirements FIRST
- **Secondary**: General review aspects below

**User Requirements Focus (if provided):**
```
📋 Reviewing with Focus:

"<user requirements>"

Checking against this requirement...
```

With loaded contexts, review the changes focusing on:

### 7.1. Code Quality
- [ ] Follows project coding standards
- [ ] Consistent with existing patterns in codebase
- [ ] No unnecessary complexity
- [ ] Proper error handling

### 7.2. Logic & Correctness
- [ ] Logic is correct and handles edge cases
- [ ] No obvious bugs or issues
- [ ] Proper null/undefined checks
- [ ] Race conditions considered (if async)

### 7.3. Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation present
- [ ] No SQL injection / XSS vulnerabilities
- [ ] Proper authentication/authorization checks

### 7.4. Performance
- [ ] No N+1 queries or unnecessary loops
- [ ] Efficient algorithms used
- [ ] No memory leaks
- [ ] Proper caching considered

### 7.5. Maintainability
- [ ] Code is readable and self-documenting
- [ ] Complex logic has comments
- [ ] Functions have appropriate size
- [ ] DRY principle followed

### 7.6. Tests
- [ ] Tests added for new functionality
- [ ] Tests updated for changed functionality
- [ ] Edge cases covered

---

## Step 8: Generate Review Report

**Format:**

```markdown
# Code Review Report

**Branch:** <current-branch>
**Base:** <base-branch>
**Files Changed:** N
**Review Focus:** <user requirements or "General">

---

## Summary

<1-2 sentence overall assessment>

---

## User Requirements Check (if requirements provided)

📋 **Requirements:** "<user requirements>"

### Assessment

<Detailed analysis of whether the code meets the user's requirements>

| Requirement | Status | Notes |
|-------------|--------|-------|
| <extracted requirement 1> | ✅/⚠️/❌ | <explanation> |
| <extracted requirement 2> | ✅/⚠️/❌ | <explanation> |

---

## Contexts Loaded

• <context-1> - <why relevant>
• <context-2> - <why relevant>

---

## Review Findings

### ✅ Good

<List of positive aspects>

### ⚠️ Suggestions

<List of suggestions for improvement>

### ❌ Issues

<List of issues that should be addressed>

---

## File-by-File Review

### `<file-1>`

<Specific feedback for this file>

### `<file-2>`

<Specific feedback for this file>

---

## Checklist

- [x] Code quality
- [x] Logic & correctness
- [x] Security
- [x] Performance
- [x] Maintainability
- [ ] Tests (if applicable)

---

## Recommendation

<Overall recommendation: Approve / Request Changes / Needs Discussion>
```

---

# Rules

1. **User requirements first** - If requirements provided, address them FIRST and PROMINENTLY
2. **Always load contexts** - Use `/ctx.load` to get relevant codebase context before reviewing
3. **Be specific** - Reference specific lines and files in feedback
4. **Be constructive** - Provide actionable suggestions, not just criticism
5. **Prioritize** - Mark issues by severity (critical, suggestion, nitpick)
6. **Consider context** - Use loaded contexts to understand project patterns
7. **Check consistency** - Ensure changes are consistent with existing codebase
8. **Security first** - Always check for security vulnerabilities

---

# Error Handling

- **No changes found:**
  ```
  ℹ️ No changes found between <base-branch> and current branch.

  Make sure you have committed your changes or check the base branch.
  ```

- **Base branch not found:**
  ```
  ❌ Base branch 'main' or 'master' not found.

  Available branches:
  <list branches>

  Please ensure you have a main or master branch.
  ```

- **Not in git repository:**
  ```
  ❌ Not in a git repository.

  This command must be run inside a git repository.
  ```

---

# Examples

## Example 1: Review against main

```bash
/ctx.work.review
```

Output:
```
📊 Changes Summary

Base: main
Head: feature/user-auth

Files changed: 5
Insertions: +120
Deletions: -15

Changed files:
• src/auth/login.ts
• src/auth/middleware.ts
• src/types/user.ts
• tests/auth.test.ts
• package.json

🔍 Loading relevant contexts...
✓ Loaded: authentication, middleware, testing

---

# Code Review Report

**Branch:** feature/user-auth
**Base:** main
**Files Changed:** 5

## Summary

Solid implementation of user authentication with JWT tokens. A few security suggestions noted below.

## Contexts Loaded

• src/auth/*.ctx.md - Authentication patterns in codebase
• rules/security.md - Security guidelines

## Review Findings

### ✅ Good

- Clean separation of concerns
- Proper TypeScript types
- Good test coverage

### ⚠️ Suggestions

1. `src/auth/login.ts:45` - Consider using constant-time comparison for token validation
2. `src/auth/middleware.ts:23` - Add rate limiting to prevent brute force attacks

### ❌ Issues

1. `src/auth/login.ts:78` - JWT secret is hardcoded. Move to environment variable.

## Recommendation

**Request Changes** - Address the hardcoded secret before merging.
```

## Example 2: Review with specific requirements

```bash
/ctx.work.review 성능과 보안에 집중해서 리뷰해줘
```

Output:
```
🔍 Review Configuration

User Requirements: 성능과 보안에 집중해서 리뷰해줘

📊 Changes Summary
...

---

# Code Review Report

**Branch:** feature/user-auth
**Base:** main
**Files Changed:** 5
**Review Focus:** 성능과 보안에 집중해서 리뷰해줘

---

## Summary

Authentication implementation reviewed with focus on performance and security.

---

## User Requirements Check

📋 **Requirements:** "성능과 보안에 집중해서 리뷰해줘"

### Assessment

| Requirement | Status | Notes |
|-------------|--------|-------|
| 성능 (Performance) | ⚠️ | Token validation could be optimized with caching |
| 보안 (Security) | ❌ | JWT secret is hardcoded - critical issue |

**상세 분석:**

1. **성능**: `login.ts:45`에서 매 요청마다 DB 조회 발생 - 캐싱 고려 필요
2. **보안**: `login.ts:78`에서 JWT 시크릿이 하드코딩됨 - 환경변수로 이동 필요

---

## Review Findings
...
```

## Example 3: Review checking specific functionality

```bash
/ctx.work.review 이 기능이 로그인 없이도 접근 가능한지 확인해줘
```

Reviews changes and specifically checks if the functionality is accessible without login.

---

# Reference

- Base branch detection: Uses `main` or `master` by default
- Context loading: `/ctx.load` command
- Diff commands: `git diff <base>...HEAD`
- Related: `/ctx.work.commit`, `/ctx.work.submit`
