<div align="center">

# ctx

### Your AI forgets everything. Make it remember.

Every AI coding session starts from zero.<br/>
**ctx** gives your AI a persistent memory that grows with your codebase.

[Installation](#installation) · [Quick Start](#quick-start) · [How It Works](#how-it-works) · [Workflow](#workflow)

</div>

---

## The Problem

You've been here before:

```
You: "Add a new API endpoint"
AI: *writes code that ignores your existing patterns*
You: "No, we use Zod for validation here..."
AI: *rewrites*
You: "And we always wrap responses in ApiResponse..."
AI: *rewrites again*
```

**Context is scattered. Knowledge is lost. Every session restarts from scratch.**

## The Solution

**ctx** is a context management system that **saves**, **syncs**, and **loads** project knowledge for your AI.

```
Save   →   Your decisions, patterns, and rules become persistent context
Sync   →   Context stays up-to-date with your evolving codebase
Load   →   AI gets the full picture before writing a single line
```

This is the core philosophy: **Context as a first-class citizen.**

## Installation

```bash
npm install -g @11x-lab/ctx
```

## Quick Start

```bash
# 1. Initialize in your project
cd your-project
ctx init

# 2. Create your first context
ctx create src/api/routes.ts

# 3. Sync contexts to your AI editor
ctx sync
```

That's it. Your AI now has memory.

## How It Works

### Two Levels of Context

**Local Context** — Lives next to your code

```
src/
├── api/
│   ├── routes.ts
│   └── routes.ctx.md      ← "Always use Zod validation"
├── components/
│   ├── Button.tsx
│   └── Button.ctx.md      ← "Use CVA for variants"
```

**Global Context** — Project-wide knowledge

```
ctx/
├── architecture.md        ← System design decisions
├── conventions.md         ← Coding standards
└── patterns/
    └── api-design.md      ← API patterns to follow
```

### Context File Structure

```markdown
---
target: src/api/routes.ts
what: API route definitions and patterns
when:
  - Adding new endpoints
  - Modifying API responses
---

## Validation
Always use Zod schemas. Never trust raw input.

## Response Format
Wrap all responses in `ApiResponse<T>` type.

## Error Handling
Use `AppError` class for consistent error responses.
```

### The Loop

```
┌─────────────────────────────────────────────────┐
│                                                 │
│    Code  →  Learn  →  Save  →  Sync  →  Load   │
│     ↑                                     │     │
│     └─────────────────────────────────────┘     │
│                                                 │
│         Context grows with every cycle          │
└─────────────────────────────────────────────────┘
```

## Workflow

### Core Commands

| Command | What it does |
|---------|--------------|
| `ctx init` | Initialize ctx in your project |
| `ctx create <path>` | Create context for a file/directory |
| `ctx sync` | Sync all contexts to AI editor |
| `ctx validate` | Check context integrity |

### AI Commands (Claude Code)

Once initialized, use these commands directly in Claude Code:

| Command | Purpose |
|---------|---------|
| `/ctx.load` | Load relevant contexts for current task |
| `/ctx.local` | Create local context interactively |
| `/ctx.global` | Create global context document |
| `/ctx.sync` | Sync contexts |

### Work Session (Optional)

For issue-to-PR workflows, ctx provides session management:

```bash
/ctx.work.init <issue-url>    # Start from GitHub/Linear issue
/ctx.work.plan                # Generate implementation plan
# ... code with AI ...
/ctx.work.extract             # Save insights back to context
/ctx.work.submit              # Create PR with summary
```

This captures context at every step of your work — from planning through completion.

## Editor Support

| Editor | Status |
|--------|--------|
| Claude Code | Supported |
| Cursor | Planned |
| Windsurf | Planned |

## Philosophy

> **Context is all you need.**

The best AI coding experience isn't about smarter models. It's about giving them the right context at the right time.

- **Save** what you learn
- **Sync** as code evolves
- **Load** before AI acts

Your codebase already contains years of decisions. **ctx** makes them accessible.

---

<div align="center">

**Stop repeating yourself. Start growing context.**

MIT License · [GitHub](https://github.com/11x-lab/ctx)

</div>