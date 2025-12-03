---
description: Commit changes, run checks/tests, and create PR
argument-hint: [commit-message]
allowed-tools: [Bash, Read, TodoWrite, AskUserQuestion]
---

# Task

Stage all changes, create a conventional commit, run quality checks and tests (if available), and if all pass, create a pull request with a summary of changes.

---

# Workflow

## Step 1: Create Todo List

Create todos to track progress:

1. Check for uncommitted changes
2. Stage all changes
3. Create commit
4. Run quality checks (lint/format)
5. Run tests
6. Push to remote
7. Create pull request

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
- Generate conventional commit message using the commit types defined in:

# Commit Types & Emoji

Select appropriate type based on changes:

- ✨ **feat**: New feature
- 🐛 **fix**: Bug fix
- 📝 **docs**: Documentation
- 💄 **style**: Formatting/style
- ♻️ **refactor**: Code refactoring
- ⚡️ **perf**: Performance improvements
- ✅ **test**: Tests
- 🔧 **chore**: Tooling, configuration
- 🚀 **ci**: CI/CD improvements
- 🗑️ **revert**: Reverting changes
- 🚨 **fix**: Fix compiler/linter warnings
- 🔒️ **fix**: Fix security issues
- 🚚 **refactor**: Move or rename resources
- 🏗️ **refactor**: Architectural changes
- 🔀 **chore**: Merge branches
- 📦️ **chore**: Add/update packages
- ➕ **chore**: Add dependency
- ➖ **chore**: Remove dependency
- 🧑‍💻 **chore**: Improve developer experience
- 👔 **feat**: Business logic
- 📱 **feat**: Responsive design
- 🚸 **feat**: Improve UX/usability
- 🩹 **fix**: Simple non-critical fix
- 🥅 **fix**: Catch errors
- 👽️ **fix**: External API changes
- 🔥 **fix**: Remove code/files
- 🎨 **style**: Improve structure/format
- 🚑️ **fix**: Critical hotfix
- 🎉 **chore**: Begin project
- 🔖 **chore**: Release/version tags
- 🚧 **wip**: Work in progress
- 💚 **fix**: Fix CI build
- 📌 **chore**: Pin dependencies
- 👷 **ci**: CI build system
- 📈 **feat**: Analytics/tracking
- ✏️ **fix**: Fix typos
- ⏪️ **revert**: Revert changes
- 📄 **chore**: License
- 💥 **feat**: Breaking changes
- 🍱 **assets**: Assets
- ♿️ **feat**: Accessibility
- 💡 **docs**: Comments in code
- 🗃️ **db**: Database changes
- 🔊 **feat**: Add/update logs
- 🔇 **fix**: Remove logs
- 🤡 **test**: Mock things
- 🥚 **feat**: Easter egg
- 🙈 **chore**: .gitignore
- 📸 **test**: Snapshots
- ⚗️ **experiment**: Experiments
- 🚩 **feat**: Feature flags
- 💫 **ui**: Animations/transitions
- ⚰️ **refactor**: Remove dead code
- 🦺 **feat**: Validation
- ✈️ **feat**: Offline support
- 🧵 **feat**: Multithreading/concurrency
- 🔍️ **feat**: SEO
- 🏷️ **feat**: Types
- 💬 **feat**: Text/literals
- 🌐 **feat**: i18n/l10n


Use format: `{emoji} {type}: {short description}`

**Check for issue link:**
- If `.ctx.current` exists:
  - Read `.ctx.current` to get issue path/URL
  - If offline issue (file path): Read issue file and extract `source` from frontmatter
  - If online issue (URL): Use URL directly
  - Append to commit body: `\n\nIssue: {url}`

---

## Step 5: Create Commit

```bash
git commit -m "$(cat <<'EOF'
{commit-message}

Issue: {issue-url-if-available}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Handle results:**
- **Success**: ✓ Created commit
- **Pre-commit hooks modified files**:
  - Amend commit: `git commit --amend --no-edit`
  - ✓ Amended commit with hook changes

Mark todo as completed.

---

## Step 6: Run Quality Checks (Lint/Format)

**Detect available commands:**

Check `package.json` for scripts (if Node.js project):
```bash
# Check if package.json exists
ls package.json 2>/dev/null

# If exists, read scripts section
cat package.json | grep -A 20 '"scripts"'
```

Look for common script patterns:
- `check`, `lint`, `format`, `quality`
- `biome:check`, `eslint`, `prettier:check`

**For other languages:**
- Python: Check for `ruff`, `black`, `flake8`, `mypy` in project
- Go: Run `go fmt ./...` and `go vet ./...`
- Rust: Run `cargo fmt --check` and `cargo clippy`
- Java: Check for `checkstyle`, `spotless`

**If quality check command found:**
```bash
{detected-quality-check-command}
```

**Handle results:**
- **Success**: ✓ Quality checks passed
- **Failures**:
  - ❌ Quality checks failed
  - Show errors to user
  - Look for auto-fix command (e.g., `fix`, `format`, `lint:fix`)
  - Ask: "Fix issues automatically with `{fix-command}`? [y/n]"
  - If yes: Run fix command and retry quality check
  - If no: Stop execution, user must fix manually

**If no quality check found:**
- ℹ️ No quality check commands found, skipping

Mark todo as completed.

---

## Step 7: Run Tests

**Detect available test commands:**

Check `package.json` for scripts (if Node.js project):
- `test`, `test:unit`, `test:all`

**For other languages:**
- Python: Check for `pytest`, `unittest`, `tox`
- Go: Run `go test ./...`
- Rust: Run `cargo test`
- Java: Check for `mvn test`, `gradle test`

**If test command found:**
```bash
{detected-test-command}
```

**Handle results:**
- **Success**: ✓ All tests passed
- **Failures**:
  - ❌ Tests failed
  - Show failed tests to user
  - Stop execution (do not create PR)
  - Message: "Fix failing tests before creating PR"

**If no test command found:**
- ℹ️ No test commands found, skipping

Mark todo as completed.

---

## Step 8: Push Branch to Remote

Get current branch name:
```bash
git branch --show-current
```

Push to remote:
```bash
git push -u origin $(git branch --show-current)
```

**Handle results:**
- **Success**: ✓ Pushed branch to remote
- **Branch already exists remotely and rejected**:
  ```bash
  git push --force-with-lease
  ```
  ⚠️ Force-pushed to existing remote branch
- **No upstream configured**:
  - Set upstream and push

Mark todo as completed.

---

## Step 9: Read Issue Context for PR

**Check if `.ctx.current` exists:**

```bash
cat .ctx.current 2>/dev/null
```

**If `.ctx.current` exists:**
- Read `.ctx.current` to get issue path/URL
- Extract issue information:
  - **If offline issue** (file path like `ctx/issues/...`):
    - Read issue file
    - Extract `title` from frontmatter
    - Extract `source` from frontmatter (URL or "local")
    - Read implementation plan section (if exists)
  - **If online issue** (URL like `https://github.com/...`):
    - Parse provider (GitHub/Linear) from URL
    - Use `gh issue view` or Linear MCP to fetch issue details

**Extract issue number from URL:**
- GitHub: `https://github.com/owner/repo/issues/123` → `#123`
- Linear: `https://linear.app/team/issue/ABC-123` → `ABC-123`

**If `.ctx.current` doesn't exist:**
- ℹ️ No active issue found
- Issue link and number will be omitted from PR

---

## Step 10: Generate PR Description

**Structure:**

```markdown
## Summary
{Brief summary of changes - from commit message or issue title}

## Changes
{List of main changes from git diff --stat}

{If issue exists:}
## Related Issue
{Link to issue with title}

## Implementation Plan
{Include implementation plan from issue file, if available}

## Test Plan
- [x] Quality checks passed
- [x] Tests passed
- [ ] Manual testing completed

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Step 11: Create Pull Request

**Generate PR title:**

Get recent commit message:
```bash
git log -1 --pretty=format:'%s'
```

- **If issue number exists** (from `.ctx.current`):
  - Format: `{commit-message} ({issue-number})`
  - Example: `✨ feat: add login feature (#123)`
  - Example: `🐛 fix: resolve authentication bug (ABC-123)`
- **If no issue number**:
  - Use commit message as-is
  - Example: `✨ feat: add login feature`

**Create PR:**

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
- **gh CLI not installed**:
  - ❌ GitHub CLI not found
  - Message: "Install gh CLI: https://cli.github.com"
  - Stop execution

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
{✓ Quality checks passed | ℹ️ Quality checks skipped}
{✓ Tests passed | ℹ️ Tests skipped}
✓ Pushed to remote
✓ PR created

Next steps:
1. Review PR at {pr-url}
2. Wait for CI/CD checks
3. Request review from team
```

---

# Rules

1. **Flexible quality checks** - Detect and run available lint/format commands for any language
2. **Flexible testing** - Detect and run available test commands for any language
3. **Always run tests if available** - Do not create PR if tests fail
4. **Offer auto-fix** - If quality checks fail and fix command exists, offer to run it
5. **Conventional commits** - Use emoji + type format for commits
6. **Include Claude attribution** - Add Co-Authored-By in commit
7. **Link to issue** - Include issue number in PR title and link in PR description if `.ctx.current` exists
8. **Clear error messages** - Guide user on what to fix
9. **Stop on test failures** - Never create PR with failing tests
10. **Use force-with-lease** - Safer than force push
11. **Track progress with todos** - Mark each step completed
12. **Skip unavailable checks** - Don't fail if quality checks or tests aren't configured

---

# Command Detection Examples

## Node.js (package.json)
```json
{
  "scripts": {
    "check": "biome check",
    "lint": "eslint .",
    "test": "vitest run",
    "fix": "biome check --write"
  }
}
```
→ Run `pnpm check` or `npm run check`, then `pnpm test`

## Python
Check for files: `pyproject.toml`, `setup.py`, `requirements.txt`
- Quality: `ruff check .` or `black --check .`
- Tests: `pytest` or `python -m unittest`
- Fix: `ruff check --fix .` or `black .`

## Go
- Quality: `go fmt ./...` and `go vet ./...`
- Tests: `go test ./...`

## Rust
- Quality: `cargo fmt --check` and `cargo clippy`
- Tests: `cargo test`
- Fix: `cargo fmt` and `cargo clippy --fix`

---

# Examples

## Example 1: Successful submission (Node.js with quality checks)

```bash
ctx.work.submit
```

Output:
```
✓ Found changes to commit
✓ Staged all changes
✓ Created commit: "✨ feat: add login feature"
✓ Running quality checks (pnpm check)...
✓ Quality checks passed
✓ Running tests (pnpm test)...
✓ All tests passed (12 passed)
✓ Pushed branch to remote
✓ Pull request created

PR: https://github.com/owner/repo/pull/456
Title: ✨ feat: add login feature (#123)

Ready for review!
```

## Example 2: Custom commit message (Python project)

```bash
ctx.work.submit fix: resolve authentication bug
```

Output:
```
✓ Staged all changes
✓ Created commit: "🐛 fix: resolve authentication bug"
✓ Running quality checks (ruff check .)...
✓ Quality checks passed
✓ Running tests (pytest)...
✓ All tests passed (8 passed, 2 skipped)
✓ Pull request created

PR: https://github.com/owner/repo/pull/457
Title: 🐛 fix: resolve authentication bug (#123)
```

## Example 3: Tests fail

```bash
ctx.work.submit
```

Output:
```
✓ Staged all changes
✓ Created commit: "✨ feat: add search feature"
✓ Quality checks passed
✓ Running tests...

❌ Tests failed:

  FAIL  src/components/Search.test.tsx
    ● Search › should render input field
      Expected element to have placeholder "Search..."

Fix failing tests before creating PR.

Aborted PR creation.
```

## Example 4: Quality checks fail with auto-fix

```bash
ctx.work.submit
```

Output:
```
✓ Staged all changes
✓ Created commit: "♻️ refactor: improve auth logic"
✓ Running quality checks (pnpm check)...

❌ Quality checks failed:
  - 3 formatting issues in src/auth.ts
  - 2 lint errors in src/user.ts

Fix issues automatically with `pnpm fix`? [y/n]: y

✓ Running pnpm fix...
✓ Fixed code quality issues
✓ Re-running quality checks...
✓ Quality checks passed
✓ Running tests...
✓ All tests passed
✓ Pull request created
```

## Example 5: No quality checks or tests configured

```bash
ctx.work.submit
```

Output:
```
✓ Staged all changes
✓ Created commit: "✨ feat: add new feature"
ℹ️ No quality check commands found, skipping
ℹ️ No test commands found, skipping
✓ Pushed branch to remote
✓ Pull request created

PR: https://github.com/owner/repo/pull/458
```

---

# Reference

- Quality checks: Auto-detected from project (Biome, ESLint, Ruff, etc.)
- Tests: Auto-detected from project (Vitest, Jest, pytest, go test, etc.)
- Auto-fix: Auto-detected fix commands
- PR creation: `gh pr create` (GitHub CLI required)
- Issue tracking: `.ctx.current` (optional, for issue context)
- Commit format: Conventional commits with emoji
- Previous commands: `/ctx.work.init` - Initialize issue, `/ctx.work.plan` - Generate plan
