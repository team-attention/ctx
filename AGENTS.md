# AGENTS.md

Project guide for AI agents working with CTX.

---

## Core Principles

@CORE_PRINCIPLE.md

---

## Project Overview

**CTX** is a persistent memory system for AI. Context is auto-loaded, grows over time, and travels with your code.

---

## 2-Level Context System

| Level | Location | Purpose | Scope |
|-------|----------|---------|-------|
| **Global** | `~/.ctx/` | Personal patterns, tool settings | Personal (all projects) |
| **Project** | `.ctx/` + `*.ctx.md` | Team knowledge, architecture | Team (shared via Git) |

> Context distinction and priority: See CORE_PRINCIPLE.md #7, #8

---

## CLI Commands

```bash
# Initialize
ctx init              # Global init (~/.ctx/)
ctx init .            # Project init (.ctx/)

# Create contexts
ctx create .ctx/contexts/architecture.md   # Project context
ctx create src/api.ctx.md --target src/api.ts  # With target binding
ctx create --global contexts/tips.md       # Global context

# Add/Remove contexts
ctx add <path>              # Register file(s) as context
ctx add docs/**/*.md        # Glob patterns supported
ctx add --global <path>     # Add to global registry
ctx remove <path>           # Unregister from context

# Adopt existing docs
ctx adopt docs/**/*.md      # Add frontmatter to existing docs
ctx adopt --global ~/notes/*.md  # Adopt to global registry

# Manage patterns
ctx add-pattern <pattern> <purpose>  # Add to context_paths

# List contexts (default: project only)
ctx list                    # Project contexts (default)
ctx list --global           # Global only
ctx list --all              # Both project and global
ctx list --target src/api.ts   # Match by file path
ctx list --pretty           # Human-readable output
ctx list --paths            # Output paths only

# Load contexts (default: project only)
ctx load -k api auth        # Load by keywords (project only)
ctx load --global -k api    # Global only
ctx load --all -k api       # Both project and global
ctx load -t src/api.ts      # Match by file path
ctx load -t src/api.ts --paths  # Output paths only

# Save contexts
ctx save --path <path> --content "..."  # Save content
ctx save --project --path <name> ...    # Save to .ctx/contexts/
ctx save --global --path <name> ...     # Save to ~/.ctx/contexts/

# Sync
ctx sync                  # Sync project registry
ctx sync --global         # Sync global contexts (~/.ctx/)
ctx sync --rebuild-index  # Rebuild global index
ctx sync --prune          # Remove entries not matching context_paths

# Status (default: project only)
ctx status            # Project status (default)
ctx status --global   # Global only
ctx status --all      # Both project and global
ctx status --pretty   # Human-readable format
ctx status --target src/api.ts   # Find context for specific file

# Health check
ctx check                         # Check context health
ctx check --target src/api.ts     # Check contexts for specific file
ctx check --pretty                # Human-readable output
```

---

## CLI Design Principles

> See CORE_PRINCIPLE.md #4, #5, #6 for scope defaults, write/read distinction, and output format.

---

## Project Structure

```
ctx/
├── src/
│   ├── bin/              # CLI entrypoint
│   ├── commands/         # CLI command implementations
│   │   ├── init.ts       # ctx init
│   │   ├── create.ts     # ctx create
│   │   ├── add.ts        # ctx add
│   │   ├── add-pattern.ts # ctx add-pattern
│   │   ├── adopt.ts      # ctx adopt
│   │   ├── remove.ts     # ctx remove
│   │   ├── load.ts       # ctx load
│   │   ├── save.ts       # ctx save
│   │   ├── sync.ts       # ctx sync
│   │   ├── status.ts     # ctx status
│   │   └── check.ts      # ctx check
│   ├── lib/              # Core library
│   └── templates/        # Context templates
├── plugin/               # Claude Code plugin
│   ├── .claude-plugin/
│   │   └── plugin.json   # Plugin config
│   ├── .mcp.json         # MCP server config
│   ├── agents/           # AI Agents (orchestrators)
│   │   └── ctx-capture/  # Source capture orchestrator
│   ├── skills/           # AI Skills
│   │   ├── ctx-load/     # Context load skill
│   │   ├── ctx-save/     # Context save skill
│   │   └── session-capture/  # Claude session capture
│   ├── hooks/            # PostToolUse hooks
│   ├── commands/         # /ctx.* commands
│   └── shared/           # Shared resources
│       ├── cli-reference.md
│       ├── capture-policy.md   # Capture security policy
│       └── inbox-schema.md     # Inbox data format
├── tests/
├── docs/
└── dist/                 # Build output
```

---

## Development Conventions

### TypeScript

- **Strict mode** enabled
- **ESM** module system (`type: "module"`)
- **pnpm** package manager

### Commands

```bash
pnpm validate         # Required before PR! (typecheck + build + test)
pnpm build            # TypeScript compile
pnpm test             # Jest tests
pnpm typecheck        # Type check only (no build)
```

### Local Testing

```bash
# Build and run locally
pnpm build
npx ctx status

# Or run directly with tsx
pnpm tsx src/bin/ctx.ts status
```

---

## Registry Structure

### Project Registry (`.ctx/registry.yaml`)

```yaml
version: 2
contexts:
  '.ctx/contexts/architecture.md':
    checksum: 'abc123'
    preview:
      what: "System architecture overview"
      keywords: ["architecture", "structure", "design"]
  'src/api.ctx.md':
    target: 'src/api.ts'
    checksum: 'def456'
    preview:
      what: "API routing patterns"
      keywords: ["api", "routing", "endpoint"]
```

### Global Registry (`~/.ctx/registry.yaml`)

```yaml
version: 2
contexts:
  '~/.ctx/contexts/coding-style.md':
    checksum: 'xyz789'
    preview:
      what: "Personal coding style"
      keywords: ["style", "convention"]

index:
  'projects/myapp':
    contexts:
      - path: 'src/api.ctx.md'
        what: "API patterns"
        keywords: ["api"]
```

---

## Plugin Development

### Skill Structure

```
skills/skill-name/
├── SKILL.md              # Required: Frontmatter + guide
├── references/           # Detailed docs
├── scripts/              # Utility scripts
└── assets/               # Templates, images, etc.
```

### SKILL.md Frontmatter

```yaml
---
name: skill-name
description: This skill should be used when... (3rd person, trigger phrases)
allowed-tools: Read, Write, Edit, Bash
---
```

### Writing Style

- **Description**: Third-person ("This skill should be used when...")
- **Body**: Imperative form ("Execute...", "Check...", not "You should...")
- **Size**: 1,500-2,000 words recommended, detailed content goes to references/

---

## Source Capture System

External data capture and context creation system.

### Overview

```
/ctx.capture <source>  →  .ctx/inbox/  →  ctx save  →  .ctx/contexts/
     │                        │                              │
   Capture               Raw JSON                      Final Markdown
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **ctx-capture Agent** | `plugin/agents/ctx-capture/` | Orchestrate multi-source capture |
| **session-capture Skill** | `plugin/skills/session-capture/` | Capture Claude Code sessions |
| **/ctx.capture Command** | `plugin/commands/ctx.capture.md` | User entry point |

### Usage

```bash
# Session capture
/ctx.capture session              # Today's sessions
/ctx.capture session terraform    # Filter by keyword
/ctx.capture session --save       # Auto-save without review
```

### Inbox

Captured data is temporarily stored in `.ctx/inbox/`:

```
.ctx/inbox/
└── session/<run_id>.json
```

- **Git-ignored**: `**/.ctx/inbox/` in `.gitignore`
- **Auto-cleanup**: 7 days retention
- **Schema**: See `plugin/shared/inbox-schema.md`

### Policies

Security and privacy policies in `plugin/shared/capture-policy.md`:

| Policy | Description |
|--------|-------------|
| **Scope** | Default: current project only |
| **Redaction** | Auto-mask API keys, tokens, secrets |
| **Provenance** | Track source info in frontmatter |

---

## Common Mistakes

### 1. Forgetting to sync

After creating/modifying contexts, always run:
```bash
ctx sync
```

### 2. Editing registry directly

Registry is auto-generated by `ctx sync`. Never edit manually.

### 3. Bound vs Standalone contexts

Distinction is based on **`target` field presence, not file location**:
- `target` present → Bound (auto-loaded when reading that file)
- `target` absent → Standalone (loaded by `keywords` matching)

---

## Debugging

```bash
# Check current status
npx ctx status --pretty

# Inspect registry directly
cat .ctx/registry.yaml
cat ~/.ctx/registry.yaml

# Health check
npx ctx check --pretty

# Find context for specific file
npx ctx status --target src/api.ts
```

---

## PR Checklist

Items to verify before submitting a PR:

### Required: Run validation

```bash
pnpm validate
```

This must pass before PR. (typecheck → build → test)

### When changing CLI

If you added/modified CLI commands or options:

- [ ] Update `docs/cli-reference.md`
- [ ] Update `plugin/shared/cli-reference.md`
- [ ] Check `plugin/skills/ctx-load/SKILL.md` CLI Reference section
- [ ] Check `plugin/skills/ctx-save/SKILL.md` CLI Reference section
- [ ] Check `AGENTS.md` CLI commands section

### When changing Plugin/Skill

- [ ] SKILL.md frontmatter validity (name, description)
- [ ] Description uses third-person + trigger phrases
- [ ] Body uses imperative form (not "You should...")
- [ ] Verify references/ file links

### Documentation sync

Ensure these files maintain consistency:

| Change | Files to update |
|--------|-----------------|
| CLI commands/options | `docs/cli-reference.md`, `plugin/shared/cli-reference.md`, `AGENTS.md` |
| 2-Level structure | `README.md`, `AGENTS.md`, `docs/RFC-*.md` |
| Plugin structure | `plugin/.claude-plugin/plugin.json`, `AGENTS.md` |
| Add skill | `plugin/skills/*/SKILL.md`, `AGENTS.md` project structure |

### When changing Registry schema

- [ ] Update types in `src/lib/registry.ts`
- [ ] Update `AGENTS.md` Registry structure section

---

## Related Documents

| Document | Description |
|----------|-------------|
| `README.md` | User guide |
| `docs/cli-reference.md` | CLI command reference |
| `docs/RFC-3-level-context-system.md` | Context system design |
| `docs/RFC-source-capture-system.md` | Source capture design |
| `docs/REFACTORING-PLAN.md` | Refactoring plan |
| `plugin/shared/cli-reference.md` | Plugin CLI reference |
| `plugin/shared/capture-policy.md` | Capture security policy |
| `plugin/shared/inbox-schema.md` | Inbox data format |
| `plugin/skills/*/SKILL.md` | Individual skill guides |
| `plugin/agents/*/AGENT.md` | Individual agent guides |
