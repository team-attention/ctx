<div align="center">

# ctx

### Your AI's persistent memory.

Context that loads automatically, grows over time, and travels with your code.

[Philosophy](#philosophy) · [Installation](#installation) · [Quick Start](#quick-start) · [How It Works](#how-it-works)

</div>

---

## Philosophy

> **Context is the bottleneck, not AI capability.**

AI models are powerful, but they start every session blank. They don't know *your* patterns, *your* decisions, or *your* standards. You end up repeating yourself. Every. Single. Time.

**ctx** fixes this with one simple idea:

```
Human insight  →  Saved as context  →  Auto-loaded when needed
     ↑                                          │
     └──────────── Feedback loop ───────────────┘
```

Every correction, every pattern, every "no, we do it this way" — captured once, loaded forever.

**The result:** AI that remembers.

---

## The Problem

You've been here:

```
You: "Add a new API endpoint"
AI: *ignores your patterns*
You: "No, we use Zod for validation..."
AI: *rewrites*
You: "And we wrap responses in ApiResponse..."
AI: *rewrites again*

Next session: repeat from scratch.
```

## The Solution

**ctx** is a context management system with 3 levels of memory:

```
Global   ~/.ctx/              Your personal patterns (all projects)
Project  .ctx/                Team knowledge (shared via Git)
Local    *.ctx.md             File-specific context (right next to code)
```

Context **auto-loads** when you read files. No manual loading. No commands to remember.

---

## Installation

```bash
npm install -g @11x-lab/ctx
```

## Quick Start

```bash
# 1. Initialize global context (once per machine)
ctx init

# 2. Initialize project context
cd your-project
ctx init .

# 3. Add existing docs as context
ctx add docs/**/*.md

# 4. Create file-specific context
ctx create src/api/routes.ts
```

That's it. Context auto-loads when AI reads your files.

---

## How It Works

### 3-Level Context System

```
┌─────────────────────────────────────────────────────────────┐
│                    3-Level Hierarchy                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Global (~/.ctx/)                              [Personal]   │
│  └─ Your coding style, tool preferences, patterns          │
│  └─ Applies to ALL projects                                │
│  └─ Not in Git (machine-specific)                          │
│                                                             │
│  Project (.ctx/)                               [Team]       │
│  └─ Architecture, API patterns, business logic             │
│  └─ Shared via Git                                         │
│  └─ New teammate? Clone and go.                            │
│                                                             │
│  Local (*.ctx.md)                              [File]       │
│  └─ File-specific context, right next to the code          │
│  └─ src/api.ctx.md → loaded when reading src/api.ts        │
│                                                             │
│  Priority: Local > Project > Global                         │
│  (More specific wins)                                       │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
~/.ctx/                          # Global (personal)
├── registry.yaml                # Context index
└── contexts/
    ├── coding-style.md          # Your patterns
    ├── typescript.md            # TS preferences
    └── tools/
        └── docker.md            # Tool-specific knowledge

your-project/
├── .ctx/                        # Project (team-shared, in Git)
│   ├── registry.yaml            # Context index
│   └── contexts/
│       ├── architecture.md      # System design
│       └── api-patterns.md      # API conventions
├── src/
│   ├── api.ts
│   ├── api.ctx.md               # Local: api.ts specific
│   └── utils/
│       ├── ctx.md               # Local: utils/ folder
│       └── helpers.ts
└── docs/
    └── api-guide.md             # Can be added as context
```

### Auto-Load Magic

When AI reads a file, matching contexts load automatically:

```
AI reads: src/api.ts

Auto-loaded (if target matches):
  1. src/api.ctx.md           (exact match)
  2. .ctx/contexts/ts.md      (glob: src/**/*.ts)
  3. ~/.ctx/contexts/api.md   (glob: **/api.ts)
```

No commands. No manual loading. Just works.

### Context File Format

```markdown
---
target: src/api/**/*.ts
what: API routing patterns and conventions
---

## Validation
Always use Zod schemas. Never trust raw input.

## Response Format
Wrap all responses in `ApiResponse<T>`.

## Error Handling
Use `AppError` class for consistent error responses.
```

The `target` field enables auto-loading. Without it, the context is still searchable but won't auto-load.

---

## Commands

### CLI

```bash
# ─────────────────────────────────────
# Initialize
# ─────────────────────────────────────
ctx init                    # Create ~/.ctx/ (global, once per machine)
ctx init .                  # Create .ctx/ (project)

# ─────────────────────────────────────
# Register/Unregister Context
# ─────────────────────────────────────
ctx add <path>              # Register file(s) as context
ctx add docs/**/*.md        # Glob patterns supported
ctx add --global <path>     # Add to global registry

ctx remove <path>           # Unregister from context
ctx remove docs/old/**      # Glob patterns supported

# ─────────────────────────────────────
# Create Context
# ─────────────────────────────────────
ctx create <target>         # Create local context (file.ctx.md)
ctx create --project <name> # Create project context
ctx create --global <name>  # Create global context

# ─────────────────────────────────────
# Load Context (for hooks)
# ─────────────────────────────────────
ctx load --target <path>      # Get matching contexts for a file
ctx load --target src/api.ts  # Returns JSON of matching contexts

# ─────────────────────────────────────
# Sync & Verify
# ─────────────────────────────────────
ctx sync                    # Sync project registry + update global index
ctx sync --global           # Sync global registry only
ctx check                   # Health check
ctx check --strict          # Require frontmatter

# ─────────────────────────────────────
# Status
# ─────────────────────────────────────
ctx status                  # Show project contexts
ctx status --global         # Show global contexts
ctx status --all            # Show everything (uses global index)

```

### AI Skills (Claude Code Plugin)

```bash
/ctx.save [message]         # Save context from session/input
                            # AI suggests scope and location

/ctx.load [keywords]        # Search and load contexts
                            # "auth jwt" → finds auth-related contexts

/ctx.sync                   # Sync registries
/ctx.status                 # Show context status
```

---

## Registry (No Config Needed)

**ctx** uses a single `registry.yaml` per scope. No separate config file.

```yaml
# .ctx/registry.yaml (Project)
meta:
  version: "1.0.0"
  last_synced: "2025-12-30T10:00:00Z"

settings:
  context_paths:
    - path: '.ctx/contexts/'
      purpose: "Project architecture and patterns"
    - path: 'docs/'
      purpose: "API documentation"

contexts:
  # Project context (no target = won't auto-load)
  '.ctx/contexts/architecture.md':
    checksum: abc123
    what: "System architecture overview"

  # Local context (has target = auto-loads)
  'src/api.ctx.md':
    target: 'src/api.ts'
    checksum: def456
    what: "API routing patterns"

  # Glob target (auto-loads for matching files)
  '.ctx/contexts/test-guide.md':
    target: '**/*.test.ts'
    checksum: ghi789
    what: "Testing conventions"
```

### Why No Config?

| Old (config.yaml) | New (registry only) |
|-------------------|---------------------|
| `contexts.include` patterns | `ctx add docs/**/*.md` |
| `contexts.ignore` patterns | Just don't add them |
| `frontmatter.mode` | `ctx check --strict` |
| Separate config + registry | Single registry.yaml |

Simpler. Explicit. Predictable.

---

## Auto-Load Hook

The Claude Code plugin includes a hook that auto-loads context:

```
AI calls Read("src/api.ts")
    ↓
PostToolUse hook triggers
    ↓
ctx load --target src/api.ts
    ↓
Matching contexts injected into conversation
```

This is the core value: **context finds you, not the other way around.**

---

## Git Workflow

```
~/.ctx/                  ❌ Not in Git (personal)
.ctx/registry.yaml       ✅ In Git (team-shared)
.ctx/contexts/**         ✅ In Git (team-shared)
**/*.ctx.md              ✅ In Git (team-shared)
```

New teammate joins?
```bash
git clone <repo>
# Done. All project context is already there.
```

---

## Plugin Structure

```
ctx/
├── src/                      # CLI
│   └── commands/
│       ├── init.ts
│       ├── add.ts
│       ├── remove.ts
│       ├── create.ts
│       ├── load.ts
│       ├── sync.ts
│       ├── check.ts
│       └── status.ts
│
└── plugin/                   # Claude Code Plugin
    ├── skills/
    │   ├── ctx-save/
    │   │   └── SKILL.md      # /ctx.save
    │   └── ctx-load/
    │       └── SKILL.md      # /ctx.load
    └── hooks/
        └── auto-load-context.sh  # PostToolUse(Read)
```

Install plugin after `ctx init`:
```bash
claude plugins install ctx
```

---

<div align="center">

**Stop repeating yourself. Let context load itself.**

MIT License · [GitHub](https://github.com/11x-lab/ctx)

</div>
