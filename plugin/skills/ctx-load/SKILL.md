---
name: ctx-load
description: Load and search context files by keywords or topics. Triggers on requests like "load context about", "show me the context for", "what do we know about", "find context", "get documentation on". Searches across Global, Project, and Local levels.
allowed-tools: Read, Glob, Grep, Bash
---

# CTX Load Skill

Search and load context from the 3-Level Context System.

## When to Use

Activate this skill when:
- User wants to find/load/show context on a topic
- User says "load context about...", "what context do we have for..."
- User asks "show me documentation on...", "find context for..."
- User explicitly requests `/ctx.load` or `/ctx:load`

## Priority Order

Contexts are searched and loaded in this priority:
1. **Local** (`*.ctx.md`) - Most specific
2. **Project** (`.ctx/contexts/`) - Team knowledge
3. **Global** (`~/.ctx/contexts/`) - Personal/universal

---

## Execution Algorithm

### Step 1: Parse Keywords

Extract search keywords from user request:

```
"load context about authentication" → keywords: ["authentication"]
"what do we know about payment and refunds" → keywords: ["payment", "refunds"]
"/ctx.load api design" → keywords: ["api", "design"]
```

Expand keywords with synonyms:
- "auth" → "authentication", "authorization", "login"
- "api" → "endpoint", "route", "rest"

---

### Step 2: Find Project Root

```bash
# Check if in a project
PROJECT_ROOT=$(npx ctx status --json 2>/dev/null | jq -r '.projectRoot // empty')
```

If no project found, search Global only.

---

### Step 3: Search Registries

Read registries and match keywords against:
- `preview.what` - What the context describes
- `preview.when` - When to use it
- File paths and names
- Folder names

#### Search Project Registry (if exists)

```bash
if [ -n "$PROJECT_ROOT" ]; then
  cat "$PROJECT_ROOT/.ctx/registry.yaml"
fi
```

Match keywords against each context entry's `preview.what` and `preview.when`.

#### Search Global Registry

```bash
cat ~/.ctx/registry.yaml
```

Match in `contexts` section and optionally search `index` for cross-project contexts.

---

### Step 4: Load Matches

For each matched context:

#### Local Context (has `target` field)
1. Read context file (`*.ctx.md`)
2. Read target file (actual code)
3. Present both with summary

#### Project/Global Context (no `target`)
1. Read context file (`.ctx/contexts/*.md` or `~/.ctx/contexts/*.md`)
2. Present with summary

**Output format per context:**
```markdown
### Loaded: [path]

**What:** [preview.what]
**When:** [preview.when as bullets]
**Scope:** [Global/Project/Local]

[Key content preview]
```

---

### Step 5: Summarize

After loading all matches:

```markdown
Loaded N contexts for "[keywords]"

By Level:
- Local: X contexts
- Project: Y contexts
- Global: Z contexts

[List paths]

These contexts are now in our conversation.
```

---

## Search Patterns

### Keyword Search (default)
```
/ctx.load authentication
→ Searches all levels for "authentication" keyword
```

### Level Filter
```
/ctx.load --global typescript
→ Only search Global (~/.ctx/)

/ctx.load --project architecture
→ Only search Project (.ctx/)

/ctx.load --local api
→ Only search Local (*.ctx.md)
```

### All Contexts
```
/ctx.load --all
→ Load summary of ALL registered contexts
→ Uses Global index for cross-project search
```

### Path Pattern
```
/ctx.load src/auth/*
→ Load all contexts under src/auth/
```

---

## Cross-Project Search

When using `--all`, search Global registry's `index` section:

```yaml
# ~/.ctx/registry.yaml
index:
  'projects/myapp':
    contexts:
      - path: 'src/api.ctx.md'
        what: "API routing logic"
        when: ["api", "routing"]
```

This allows finding contexts across all registered projects.

---

## Example: Single Topic

```
User: Load context about payment processing

AI: Searching for "payment processing"...

Found 3 matches:

### Loaded: src/services/payment.ctx.md
**What:** Payment service implementation
**When:** Payment processing, Stripe integration, checkout
**Scope:** Local

Key patterns:
- Stripe webhook handling
- Idempotency keys
- Error recovery

---

### Loaded: .ctx/contexts/payment-flow.md
**What:** End-to-end payment flow
**When:** Payment, checkout, refunds
**Scope:** Project

Flow diagram and edge cases...

---

### Loaded: ~/.ctx/contexts/stripe.md
**What:** Stripe API patterns
**When:** Stripe, payment gateway
**Scope:** Global

Personal notes on Stripe integration...

---

Loaded 3 contexts for "payment processing"
- Local: 1
- Project: 1
- Global: 1

These contexts are now in our conversation!
```

---

## Example: All Contexts

```
User: /ctx.load --all

AI: Loading all contexts...

Global (~/.ctx/):
- coding-style.md: Personal coding conventions
- tools/docker.md: Docker patterns
- tools/aws.md: AWS best practices

Project (.ctx/):
- architecture.md: System architecture
- api-patterns.md: REST API conventions
- auth.md: Authentication flow

Local (*.ctx.md):
- src/api.ctx.md: API router
- src/auth/middleware.ctx.md: Auth middleware
- src/services/payment.ctx.md: Payment service

Total: 9 contexts across 3 levels
```

---

## No Results Handling

```
User: /ctx.load blockchain

AI: No contexts found for "blockchain"

Searched: 5 local + 3 project + 8 global contexts

Suggestions:
- Try different keywords
- Run `ctx sync` to update registries
- Create new context with `/ctx.save`
```

---

## Related Suggestions

After loading, suggest related contexts:

```markdown
Related contexts you might want:
- .ctx/contexts/security.md - Security best practices
- ~/.ctx/contexts/jwt.md - JWT patterns

Load these? [Y/n]
```

---

## Performance Tips

1. **Read registries first** - Don't scan filesystem; use registries
2. **Parallel reads** - Load multiple context files simultaneously
3. **Cache within session** - Don't re-load already loaded contexts
4. **Use Global index** - For cross-project search, read index not each project
5. **Smart summarization** - For large contexts, show key sections only

---

## Error Handling

**Registry not found:**
```
No context registry found. Run `ctx init` first.
```

**File missing:**
```
Warning: Context registered but file missing: [path]
Run `ctx sync` to clean up registry.
```

**No project (for --project):**
```
No project found in current directory.
Use `ctx init .` to create one, or search Global with --global.
```
