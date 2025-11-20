---
description: Create well-formatted commits with conventional commit messages
argument-hint: [--no-verify]
allowed-tools: [Read, Bash, TodoWrite]
---

# Task
Create a commit with conventional commit format (emoji + type + message). If `.ctx.current` exists, include issue link from the active issue.

---

# Workflow

## 1. Pre-commit Checks (unless --no-verify)

**Detect and run common checks:**
- Check for `package.json` scripts (lint, test, build) and detect package manager (pnpm/yarn/npm/bun)
- Check for language-specific tools (Python: ruff/pytest, Go: go fmt/vet, Rust: cargo fmt/clippy)
- Check for `.git/hooks/pre-commit`

**If checks fail**, ask user whether to fix or skip.

## 2. Stage Files

Run `git status`. If no staged files, run `git add .`

## 3. Analyze Changes

Check if `.ctx.current` exists. If it does:
- Read `.ctx.current` to get the issue path/URL
- If it's a file path (offline): Read the issue file and get `source` from frontmatter (will be "local" or the original URL)
- If it's a URL (online): Use the URL directly

This will be used as the issue link in the commit message.

Run `git diff --cached` to analyze changes. Determine:
- Should changes be split into multiple commits? (multiple unrelated concerns, different types)
- Appropriate commit type and emoji

## 4. Create Commit(s)

Use this format:
```
<emoji> <type>: <description>

<optional body>

Issue: <link-if-available>
```

Use HEREDOC for commit message:
```bash
git commit -m "$(cat <<'EOF'
✨ feat: add authentication system

Issue: https://github.com/user/repo/issues/123
EOF
)"
```

---

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

---

# Guidelines

- **First line**: <72 characters, present tense, imperative mood ("add" not "added")
- **Splitting commits**: Suggest split if changes have multiple unrelated concerns
- **Issue link**: Include only if `.ctx.current` exists and has a valid issue URL (not "local")
- **Use TodoWrite**: Track progress through steps
- **Verify**: Show `git log -1` after commit

---

# Examples

```
✨ feat: add user authentication system

JWT-based auth with refresh tokens

Issue: https://github.com/user/repo/issues/123
```

```
🐛 fix: resolve memory leak in rendering process

Properly cleanup event listeners when components unmount
```
