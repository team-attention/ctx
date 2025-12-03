# ctx Workflow Summary

ctx is a **context management system** that enables AI editors to continuously learn and utilize project decisions, patterns, and rules.

---

## Core Loop

```
Code  →  Learn  →  Save  →  Sync  →  Load
  ↑                                   │
  └───────────────────────────────────┘
```

## Two Levels of Context

| Level | Location | Example |
|-------|----------|---------|
| **Local** | `*.ctx.md` (next to code) | `src/payment.ctx.md` |
| **Global** | `ctx/**/*.md` | `ctx/rules/api.md` |

---

## Core Commands

| Command | Purpose |
|---------|---------|
| `/ctx.save` | Create or update context (local/global) |
| `/ctx.load` | Load contexts by semantic search |
| `/ctx.sync` | Sync registries with file system |
| `/ctx.audit` | Health check (mechanical + semantic) |
| `/ctx.status` | Show current status |

---

## Work Session Commands

### Complete Flow

```
init → plan → [coding] → commit ─┬─→ submit (PR)
                  ↑              │       ↓
                  └──────────────┘   [review]
                                       ↓
                                     done
                              (extract + cleanup)
```

### Command Summary

| Command | Purpose | Creates/Modifies |
|---------|---------|------------------|
| `/ctx.work.init` | Start work session | `.ctx.current` |
| `/ctx.work.plan` | Generate implementation plan | Issue file |
| `/ctx.work.commit` | Create conventional commit | Git commit |
| `/ctx.work.submit` | Create/update PR | PR (or push) |
| `/ctx.work.extract` | Extract context from session | Context files |
| `/ctx.work.done` | Complete session | Cleanup `.ctx.current` |

---

## Key Data Structures

### .ctx.current

```json
{
  "issue": "<url-or-file-path>",
  "sessions": ["<session-path>"]
}
```

### Issue File (Offline)

```yaml
---
title: Add dark mode
source: local
provider: local
status: initialized | in_progress | completed
---
```

### Context File

```yaml
---
target: /src/api/routes.ts
what: API route patterns
when:
  - Adding endpoints
---
```

---

## Issue Providers

| Provider | URL Pattern | CLI/MCP |
|----------|-------------|---------|
| GitHub | `github.com/*/issues/*` | `gh` CLI |
| Linear | `linear.app/*/issue/*` | Linear MCP |

---

## Status Flow (Offline Issues)

```
initialized  →  in_progress  →  completed
   (init)         (plan)          (done)
```

---

## Commit Types

| Emoji | Type | Purpose |
|-------|------|---------|
| ✨ | feat | New feature |
| 🐛 | fix | Bug fix |
| 📝 | docs | Documentation |
| ♻️ | refactor | Refactoring |
| ✅ | test | Tests |
| 🔧 | chore | Tooling |

---

## Quick Reference

```bash
# Start new issue
/ctx.work.init https://github.com/user/repo/issues/123
/ctx.work.init "Add dark mode toggle"

# Plan implementation
/ctx.work.plan

# Commit changes
/ctx.work.commit

# Submit PR (or push to existing)
/ctx.work.submit

# Complete work session
/ctx.work.done
```

---

For detailed command specifications, see `src/templates/ai-commands/`.
