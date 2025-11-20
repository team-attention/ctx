---
description: Commit changes, run tests, and create PR
argument-hint: [commit-message]
allowed-tools: [Bash, Read, TodoWrite]
---

# Task
Stage all changes, create a conventional commit, run `pnpm check` and `pnpm test`, and if tests pass, create a pull request with a summary of changes.

---

# Workflow

## Step 1: Create Todo List

Create todos to track progress:

1. Stage all changes
2. Create commit
3. Run pnpm check
4. Run pnpm test
5. Create pull request

---

## Step 2: Check for Uncommitted Changes

```bash
git status --porcelain
```

**If no changes:**
- ℹ️ No changes to commit
- Stop execution

**If changes exist:**
- ✓ Found changes to commit
- Proceed to Step 3

---

## Step 3: Stage All Changes

```bash
git add .
```

✓ Staged all changes

Mark todo as completed.

---

## Step 4: Generate Commit Message

**If user provided commit message in `$ARGUMENTS`:**
- Use provided message

**If no message provided:**
- Analyze staged changes using:
  ```bash
  git diff --cached --stat
  git diff --cached
  ```
- Generate conventional commit message:
  - Format: `{type}: {short description}`
  - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
  - Examples:
    - `feat: add login feature`
    - `fix: resolve search bug`
    - `refactor: improve auth flow`

---

## Step 5: Create Commit

```bash
git commit -m "{commit-message}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Handle results:**
- **Success**: ✓ Created commit
- **Pre-commit hooks modified files**:
  - Amend commit: `git commit --amend --no-edit`
  - ✓ Amended commit with hook changes

Mark todo as completed.

---

## Step 6: Run pnpm check

```bash
pnpm check
```

**Handle results:**
- **Success**: ✓ Code quality checks passed
- **Failures**:
  - ❌ Code quality checks failed
  - Show errors to user
  - Ask: "Fix issues automatically with `pnpm fix`? [y/n]"
  - If yes: Run `pnpm fix` and retry `pnpm check`
  - If no: Stop execution, user must fix manually

Mark todo as completed.

---

## Step 7: Run pnpm test

```bash
pnpm test
```

**Handle results:**
- **Success**: ✓ All tests passed
- **Failures**:
  - ❌ Tests failed
  - Show failed tests to user
  - Stop execution (do not create PR)
  - Message: "Fix failing tests before creating PR"

Mark todo as completed.

---

## Step 8: Push Branch to Remote

```bash
git push -u origin $(git branch --show-current)
```

**Handle results:**
- **Success**: ✓ Pushed branch to remote
- **Branch already exists remotely**:
  ```bash
  git push --force-with-lease
  ```
  ⚠️ Force-pushed to existing remote branch

---

## Step 9: Read plan.md for PR Context

**If plan.md exists:**
- Read plan.md to extract:
  - Issue link (from frontmatter)
  - Issue number (extract from GitHub/Linear URL)
  - Implementation plan (for PR description)

**If plan.md doesn't exist:**
- ℹ️ No plan.md found, generating PR description from commit
- Issue number will be omitted from PR title

**Issue number extraction examples:**
- GitHub: `https://github.com/owner/repo/issues/123` → `#123`
- Linear: `https://linear.app/team/issue/ABC-123` → `ABC-123`

---

## Step 10: Generate PR Description

**Structure:**

```markdown
## Summary
{Brief summary of changes - from commit message or plan.md}

## Changes
{List of main changes from git diff --stat}

## Related Issue
{Link to issue from plan.md, if available}

## Test Plan
- [ ] pnpm check passed
- [ ] pnpm test passed
- [ ] Manual testing completed

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Step 11: Create Pull Request

**Generate PR title:**
- **If issue number exists** (from plan.md):
  - Format: `{type}(#{issue-number}): {description}`
  - Example: `feat(#123): add login feature`
  - Example: `fix(ABC-123): resolve authentication bug`
- **If no issue number**:
  - Use commit message as-is
  - Example: `feat: add login feature`

```bash
gh pr create \
  --title "{pr-title}" \
  --body "$(cat <<'EOF'
{Generated PR description from Step 10}
EOF
)"
```

**Handle results:**
- **Success**:
  - ✓ Pull request created
  - Display PR URL
- **No remote branch**:
  - Push first (Step 8), then retry
- **Already exists**:
  - ℹ️ PR already exists
  - Display existing PR URL

Mark todo as completed.

---

## Step 12: Show Summary

Display:

```
✓ Submission complete!

Commit: {commit-hash} - {commit-message}
Branch: {branch-name}
Pull Request: {pr-url}

Summary:
✓ Staged changes
✓ Created commit
✓ pnpm check passed
✓ pnpm test passed
✓ PR created

Next steps:
1. Review PR at {pr-url}
2. Wait for CI/CD checks
3. Request review from team
```

---

# Rules

1. **Always run tests** - Do not create PR if tests fail
2. **Run quality checks** - Offer to auto-fix with `pnpm fix`
3. **Conventional commits** - Use standard commit format
4. **Include Claude attribution** - Add Co-Authored-By in commit
5. **Link to issue** - Include issue number in PR title and link in PR description if plan.md exists
6. **Clear error messages** - Guide user on what to fix
7. **Stop on test failures** - Never create PR with failing tests
8. **Use force-with-lease** - Safer than force push
9. **Track progress with todos** - Mark each step completed

---

# Examples

## Example 1: Successful submission (with plan.md)

```bash
/work.submit
```

Output:
```
✓ Staged all changes
✓ Created commit: "feat: add login feature"
✓ Running pnpm check...
✓ Code quality checks passed
✓ Running pnpm test...
✓ All tests passed
✓ Pushed branch to remote
✓ Pull request created

PR: https://github.com/owner/repo/pull/456
Title: feat(#123): add login feature

Ready for review!
```

## Example 2: Custom commit message (with plan.md)

```bash
/work.submit fix: resolve authentication bug
```

Output:
```
✓ Staged all changes
✓ Created commit: "fix: resolve authentication bug"
✓ Running pnpm check...
✓ Code quality checks passed
✓ Running pnpm test...
✓ All tests passed
✓ Pull request created

PR: https://github.com/owner/repo/pull/457
Title: fix(#123): resolve authentication bug
```

## Example 3: Tests fail

```bash
/work.submit
```

Output:
```
✓ Staged all changes
✓ Created commit: "feat: add search feature"
✓ Running pnpm check...
✓ Code quality checks passed
✓ Running pnpm test...

❌ Tests failed:

  FAIL  apps/web/src/components/Search.test.tsx
    ● Search › should render input field
      Expected element to have placeholder "Search..."

Fix failing tests before creating PR.

Aborted PR creation.
```

## Example 4: Code quality fails with auto-fix

```bash
/work.submit
```

Output:
```
✓ Staged all changes
✓ Created commit: "refactor: improve auth logic"
✓ Running pnpm check...

❌ Code quality checks failed:
  - 3 formatting issues
  - 2 lint errors

Fix issues automatically with pnpm fix? [y/n]: y

✓ Running pnpm fix...
✓ Fixed code quality issues
✓ Running pnpm check again...
✓ Code quality checks passed
✓ Running pnpm test...
✓ All tests passed
✓ Pull request created
```

---

# Reference

- Quality checks: `pnpm check` (Biome linter/formatter)
- Tests: `pnpm test` (all workspace tests)
- Auto-fix: `pnpm fix` (fixes lint/format issues)
- PR creation: `gh pr create` (GitHub CLI)
- Plan file: `plan.md` (optional, for PR context)
- Commit format: Conventional commits (feat, fix, refactor, etc.)
- Previous command: `/work.setup` - Creates feature branch
