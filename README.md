<div align="center">

# ctx

### Turn your thinking into AI's intelligence.

Your decisions, feedback, and insights don't disappear after each session.<br/>
**ctx** captures human thinking as persistent context — and grows it over time.

[Philosophy](#philosophy) · [Installation](#installation) · [Quick Start](#quick-start) · [How It Works](#how-it-works)

</div>

---

## Philosophy

> **Your thinking is the most valuable context.**

AI models are powerful, but they start every session with zero knowledge of *your* codebase, *your* decisions, and *your* standards. The bottleneck isn't AI capability — it's context.

**ctx** is built on a simple belief:

```
Human insight  →  Captured as context  →  AI performs better
     ↑                                           │
     └───────── Feedback loop ──────────────────┘
```

Every correction you make, every pattern you explain, every "no, we do it this way" — these are valuable signals. Instead of losing them, **ctx** turns them into persistent, growing knowledge that compounds over time.

**The result:** AI that gets better at understanding *your* project with every interaction.

- **Capture** — Your feedback becomes documented context
- **Grow** — Context evolves as your codebase and thinking evolve
- **Compound** — Each session builds on previous knowledge

This isn't just memory. It's **accumulated intelligence**.

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

# 2. Sync contexts to your AI editor
ctx sync

# 3. Save context using AI commands
/ctx.save src/api/routes.ts "Always use Zod validation"
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
└── rules/
    └── api-design.md      ← API patterns to follow
```

### Context File Structure

```markdown
---
target: /src/api/routes.ts
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

## Commands

### CLI Commands

| Command | What it does |
|---------|--------------|
| `ctx init` | Initialize ctx in your project |
| `ctx create <path>` | Create a new context file from template |
| `ctx sync` | Sync all contexts to registries |
| `ctx check` | Check context integrity and staleness |
| `ctx status` | Show context and work session status |
| `ctx refresh` | Refresh AI commands with current config |

#### Command Flags

**`ctx check`**
```bash
ctx check              # Check all contexts
ctx check --local      # Check local contexts only
ctx check --global     # Check global contexts only
ctx check --fix        # Auto-fix issues (run sync)
ctx check --pretty     # Human-readable output
```

**`ctx status`**
```bash
ctx status                    # Show project status
ctx status --pretty           # Human-readable output
ctx status --target src/api/  # Find context for a specific file
```

**`ctx create`**
```bash
ctx create src/api/routes.ctx.md           # Create local context
ctx create ctx/rules/api.md --global       # Create global context
ctx create <path> --template custom.md     # Use custom template
ctx create <path> --force                  # Overwrite existing
```

### AI Commands (Claude Code)

Once initialized, use these commands directly in Claude Code:

#### Core Commands

| Command | Purpose |
|---------|---------|
| `/ctx.save [path] [description]` | Save context (unified command for create/update) |
| `/ctx.load <description>` | Load relevant contexts by description |
| `/ctx.sync` | Sync context registries |
| `/ctx.status` | Show current status |
| `/ctx.audit [description]` | Audit context files for issues |

#### `/ctx.save` - Unified Context Command

The `/ctx.save` command intelligently handles both local and global contexts:

```bash
# Save local context (by context path)
/ctx.save src/services/payment.ctx.md Add webhook handling

# Save local context (by target file - auto-detects context)
/ctx.save src/services/payment.ts Document payment processing

# Save global context
/ctx.save ctx/rules/api.md Add REST versioning guidelines

# Semantic mode (AI suggests options based on description)
/ctx.save Document the auth flow
```

**How it works:**
1. Parses input to detect type (context-path, target-path, or description)
2. Checks existing contexts for issues
3. Generates content based on code analysis
4. Shows diff preview for approval
5. Writes file and syncs registry

#### `/ctx.audit` - Context Health Check

The `/ctx.audit` command performs comprehensive context health analysis:

```bash
# Quick audit (mechanical checks only)
/ctx.audit

# Deep audit with semantic analysis
/ctx.audit Check for contradictions in API contexts
```

**What it checks:**
- **Mechanical**: Registry freshness, checksum validity, file existence
- **Semantic**: Contradictions between contexts, redundancy, ambiguous documentation

### Work Session Commands

For issue-to-PR workflows, ctx provides session management:

| Command | Purpose |
|---------|---------|
| `/ctx.work.init <source>` | Start from GitHub/Linear issue or local requirements |
| `/ctx.work.plan` | Generate implementation plan |
| `/ctx.work.extract` | Extract insights back to context |
| `/ctx.work.commit` | Commit changes with context |
| `/ctx.work.submit` | Create PR and link to issue |

```bash
# Start from online issue
/ctx.work.init https://github.com/user/repo/issues/123

# Or start from local requirements
/ctx.work.init "Add dark mode toggle to settings page"

# Generate implementation plan
/ctx.work.plan

# ... code with AI ...

# Extract learnings to context
/ctx.work.extract

# Commit changes
/ctx.work.commit

# Create PR and submit
/ctx.work.submit
```

This captures context at every step of your work — from planning through completion.

## Project Structure

After `ctx init`, your project will have:

```
your-project/
├── ctx.config.yaml           ← Configuration file
├── ctx/                      ← Global context directory
│   ├── README.md
│   ├── local-context-registry.yml
│   ├── global-context-registry.yml
│   ├── issues/               ← Work session issues
│   └── templates/            ← Customizable templates
├── .claude/
│   ├── commands/             ← AI commands (auto-installed)
│   │   ├── ctx.save.md
│   │   ├── ctx.load.md
│   │   ├── ctx.sync.md
│   │   └── ...
│   └── hooks/                ← Session tracking hooks
├── .ctx.current              ← Active work session tracker
├── .worktrees/               ← Work session branches
└── src/
    └── *.ctx.md              ← Local context files
```

## Configuration

`ctx.config.yaml` controls how ctx works:

```yaml
version: 0.1.0
editor: claude-code

local:
  patterns:
    - "**/*.ctx.md"
    - "**/ctx.md"
  ignore:
    - node_modules/**
    - dist/**

global:
  directory: ctx
  patterns: "**/*.md"
  ignore:
    - templates/**
    - "*-context-registry.yml"
    - issues/**

work:
  directory: .worktrees

frontmatter:
  local: optional    # required | optional | none
  global: optional
```

## Editor Support

| Editor | Status |
|--------|--------|
| Claude Code | Supported |
| Cursor | Planned |
| Windsurf | Planned |

## Advanced

### Template Customization

After `ctx init`, you can customize templates in `ctx/templates/`:

```
ctx/templates/
├── local-context.md     ← Template for new local contexts
└── global-context.md    ← Template for new global contexts
```

Edit these files to match your project's documentation style.

### Snippet System

AI command templates support reusable snippets with `{{snippet:name}}` syntax:

```markdown
{{snippet:errors}}              <!-- Include entire snippet -->
{{snippet:check-issues#section}} <!-- Include specific section -->
```

Snippets are defined in `src/templates/snippets/` and allow code reuse across AI commands.

---

<div align="center">

**Stop repeating yourself. Start growing intelligence.**

MIT License · [GitHub](https://github.com/11x-lab/ctx)

</div>
