---
name: ctx.load
description: Search and load context files by keywords
---

# /ctx.load

Invoke the ctx-load skill to search and load context.

## Usage

```
/ctx.load <keywords>   # Search by keywords
/ctx.load --all        # Load summary of all contexts
/ctx.load --global     # Search global contexts only
/ctx.load --project    # Search project contexts only
```

## Examples

```
/ctx.load authentication    # Find auth-related contexts
/ctx.load api design        # Find API design patterns
/ctx.load payment refund    # Multi-keyword search
/ctx.load --all             # Overview of all contexts
```

## How It Works

The skill searches across all 3 levels:

1. **Local** (`*.ctx.md`) - File-specific contexts
2. **Project** (`.ctx/contexts/`) - Team/project knowledge
3. **Global** (`~/.ctx/contexts/`) - Personal/universal patterns

Matches are found by searching:
- `what` field (description)
- `when` field (trigger keywords)
- File paths and names

## Execution

This command invokes the `ctx-load` skill. The skill will:
1. Parse keywords from request
2. Search registries at all levels
3. Load and display matching contexts
4. Summarize findings

## Priority Order

Results are shown in priority order:
1. Exact keyword matches in `when` field
2. Partial matches in `what` field
3. Path matches

Project contexts are shown before Global contexts.
