# ctx

A context graph search engine for projects. Finds the right business rules at the right time.

## Problem

AI tools either load all project rules at once (CLAUDE.md) or rely on humans to decide which rules apply. `ctx` makes this programmatic — match code changes against context nodes via glob triggers and a dependency graph.

## How it works

Context nodes are `.md` files with `ctx: true` frontmatter. They can live anywhere in your project.

```yaml
# .ctx/billing.md
---
ctx: true
name: billing
what: "Billing domain change checklist"
keywords: ["billing", "payment", "coupon"]
category: domain
triggers:
  - "**/billing/**"
depends_on: [ux, infra]
actions: []
---

- [ ] Check coupon discount logic when changing payment flow
- [ ] Verify subscriber migration when modifying plans
```

## Two search modes

**Programmatic** — deterministic, glob-based matching:
```bash
$ ctx match --diff
→ billing [direct]  ← **/billing/** matched
  ↳ ux [dependency] (via billing)
  ↳ infra [dependency] (via billing)
```

**Semantic** — BM25 full-text search over keywords, descriptions, and body:
```bash
$ ctx query "payment subscription plan"
→ billing (score: 5.91)
  ↳ ux (via billing)
  ↳ infra (via billing)
```

## Install

```bash
# Build from source
cargo install --path .

# Or copy the binary
cargo build --release
cp target/release/ctx ~/.local/bin/
```

## Quick start

```bash
# Initialize in your project
ctx init

# Create a context node
ctx create billing --category domain --triggers "**/billing/**" --depends-on "ux,infra"
# Then edit .ctx/billing.md to add your checklist

# Or migrate existing rule files
ctx migrate --from .dev/rules/ --apply

# Match against your changes
ctx match --diff --body

# Search for related context
ctx query "payment logic"

# View dependency graph
ctx graph
```

## CLI Reference

### Core

```bash
ctx match <file...>          # Match files against trigger patterns
ctx match --diff             # Match against git diff (HEAD + untracked)
ctx match --diff --staged    # Match against staged changes only
ctx match --diff --base main # Match against a base branch
ctx match --body             # Include checklist body in output
ctx query "<text>"           # BM25 search over all nodes
ctx show <node>              # Show a specific node's content
```

### Management

```bash
ctx init                     # Create .ctxconfig + .ctx/
ctx create <name>            # Create a new node
ctx list                     # List all nodes (JSON)
ctx list --pretty            # Human-readable list
ctx check                    # Health check (broken deps, duplicates, missing fields)
```

### Graph

```bash
ctx graph                    # Full dependency graph (ASCII)
ctx graph <node>             # Show a node's connections (incoming + outgoing)
```

### Integration

```bash
ctx migrate --from <dir>          # Dry-run: preview migration
ctx migrate --from <dir> --apply  # Execute migration
```

## Context Node Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ctx` | bool | Yes | Must be `true` for the file to be recognized as a node |
| `name` | string | Yes | Node ID. `[a-z0-9-]`, max 64 chars, unique per project |
| `what` | string | Yes | One-line description |
| `keywords` | string[] | Yes | Search keywords (used by BM25 and for discovery) |
| `category` | enum | Yes | `domain` \| `concern` \| `pipeline` |
| `triggers` | string[] | No | Glob patterns matched against changed file paths |
| `depends_on` | string[] | No | Other node names. Auto-expanded 1 level on match |
| `actions` | string[] | No | Natural language directives for AI |

## Graph traversal

1. Scan all `.md` files with `ctx: true` frontmatter
2. Match each changed file against each node's `triggers` (glob)
3. Expand `depends_on` **1 level only** (billing → ux, but not ux → term)
4. Deduplicate and output with direct/dependency distinction

## Output

JSON by default (for scripts and AI). Add `--pretty` for human-readable output.

```bash
ctx match --diff          # JSON array
ctx match --diff --pretty # Human-readable
```

Exit codes: `0` = success, `1` = error, `2` = warnings (check only).

## Design decisions

- **Rust** — single binary, zero runtime deps, sub-ms parsing
- **No registry** — `.md` files are the source of truth, scanned at runtime
- **No sync** — add/edit a file and it's immediately available
- **Native BM25** — no external search dependency
- **1-level traversal** — keeps results focused and predictable
- **`ctx: true` marker** — non-ctx markdown files are silently ignored

## License

MIT
