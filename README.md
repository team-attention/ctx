<div align="center">

# ctx

### Your AI's persistent memory.

Context that loads automatically, grows over time, and travels with your code.

[Philosophy](#philosophy) · [Quick Start](#quick-start) · [Talk to AI](#talk-to-ai) · [How It Works](#how-it-works)

</div>

---

## Philosophy

> **Context is the bottleneck, not AI capability.**

AI models are powerful, but they start every session blank. They don't know *your* patterns, *your* decisions, or *your* standards. You end up repeating yourself. Every. Single. Time.

**ctx** fixes this:

```
Human insight  →  Saved as context  →  Auto-loaded when needed
     ↑                                          │
     └──────────── Feedback loop ───────────────┘
```

Every correction, every pattern, every "no, we do it this way" — captured once, loaded forever.

### AI-First Design

**ctx** is designed to be used through AI, not by humans directly.

```
You  →  Talk to AI  →  AI uses ctx CLI  →  Context managed
         (natural)      (automated)         (persistent)
```

You describe what you want in plain language. AI handles the rest.

---

## Quick Start

```bash
cd your-project
npx @team-attention/ctx init .
```

That's it. Now just talk to your AI:

```
"Save our API validation pattern as context"
"Load context related to authentication"
"What contexts do we have for this project?"
```

---

## Talk to AI

Here's how to use ctx through natural conversation:

### Save Context

When AI does something right, or you teach it a pattern:

```
"Save this as context so you remember next time"
"Remember: we always use Zod for validation in this project"
"Create a context for our API response patterns"
```

### Load Context

When you need specific knowledge:

```
"Load context about authentication"
"What do we have documented about the API?"
"Find context related to testing patterns"
```

### Manage Context

```
"Show me all contexts in this project"
"Check if our contexts are healthy"
"Sync the context registry"
```

### Capture Knowledge

```
"Save what we learned in this session as context"
"Capture our discussion about error handling"
```

---

## How It Works

### 2-Level Context System

```
┌─────────────────────────────────────────────────────────────┐
│                      2-Level Hierarchy                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Global (~/.ctx/)                               [Personal]   │
│  └─ Your coding style, tool preferences, patterns           │
│  └─ Applies to ALL projects                                  │
│  └─ Not in Git (machine-specific)                            │
│                                                              │
│  Project (.ctx/ + *.ctx.md)                     [Team]       │
│  └─ Architecture, API patterns, business logic               │
│  └─ Shared via Git                                           │
│  └─ New teammate? Clone and go.                              │
│                                                              │
│  Priority: Project > Global                                  │
│  (More specific wins)                                        │
└─────────────────────────────────────────────────────────────┘
```

### Auto-Load Magic

When AI reads a file, matching contexts load automatically:

```
AI reads: src/api.ts
    ↓
Hook triggers: ctx load --target src/api.ts
    ↓
Matching contexts injected into conversation
```

No commands. No manual loading. Context finds you.

### Context File Format

```markdown
---
target: src/api/**/*.ts
what: API routing patterns and conventions
keywords: [api, routing, validation]
---

## Validation
Always use Zod schemas. Never trust raw input.

## Response Format
Wrap all responses in `ApiResponse<T>`.
```

The `target` field enables auto-loading. The `keywords` field enables search.

---

## Directory Structure

```
~/.ctx/                          # Global (personal, not in Git)
├── registry.yaml
└── contexts/
    └── coding-style.md

your-project/
├── .ctx/                        # Project (team-shared, in Git)
│   ├── registry.yaml
│   └── contexts/
│       ├── architecture.md
│       └── api-patterns.md
├── src/
│   ├── api.ts
│   └── api.ctx.md               # File-specific context
└── docs/
    └── api-guide.md             # Can be added as context
```

---

## Git Workflow

```
~/.ctx/                  ❌ Not in Git (personal)
.ctx/                    ✅ In Git (team-shared)
*.ctx.md                 ✅ In Git (team-shared)
```

New teammate joins?
```bash
git clone <repo>
# Done. All project context is already there.
```

---

## For Advanced Users

Need direct CLI access? See [CLI Reference](docs/CLI_REFERENCE.md).

Common scenarios:
- CI/CD automation
- Bulk operations
- Debugging context issues
- Scripting

---

<div align="center">

**Stop repeating yourself. Just talk to AI.**

MIT License · [GitHub](https://github.com/team-attention/ctx)

</div>
