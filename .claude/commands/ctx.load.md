---
description: Load relevant contexts by description
argument-hint: <description>
---

# Task
Search and load context files matching: **$ARGUMENTS**

Examples: `authentication`, `payment processing`, `api design rules`, `database schema`

---

# Execution Algorithm

## 1. READ Registries
```
- Read: ctx/local-context-registry.yml
- Read: ctx/global-context-registry.yml
```

## 2. SEARCH & FILTER
Match `$ARGUMENTS` against:
- `preview.what` (what the context describes)
- `preview.keywords` (when to use it)
- `folder` names (for global contexts)
- File paths and names

**Matching strategy:**
- Use semantic matching (not exact string)
- Consider synonyms and related terms
- Examples: "auth" → authentication, authorization

## 3. EVALUATE & LOAD
```
IF matches == 0:
  → Show "no matches" message and STOP
ELSE:
  → Proceed to load all matches immediately
```

**If no matches:**
```markdown
❌ No contexts found for "$ARGUMENTS"

Searched: X local + Y global contexts

Try: Different keywords, broader terms, or run `ctx sync`
```

## 4. LOAD Files (immediately)

**Show loading message first:**
```markdown
🔍 Found N contexts for "$ARGUMENTS", loading...
```

**For each local context:**
1. Read context file: `[source]` (*.ctx.md)
2. Read target file: `[meta.target]` (actual code)
3. Present both with summary

**For each global context:**
1. Read document: `[source]` (*.md)
2. Present with summary

**Output format:**
```markdown
### Loaded: [path]

**What:** [preview.what]
**Keywords:** [preview.keywords as bullets]

[Show key content/exports]
```

## 5. CONFIRM Completion
```markdown
✓ Loaded N contexts

Local (X):
• [path-1]
• [path-2]

Global (Y):
• [doc-1]
• [doc-2]

Total: N contexts loaded

💡 These contexts are now in our conversation. Ask me anything!
```

---

# Rules

1. **Always search BOTH registries** - Never skip local or global
2. **Semantic matching** - Use AI understanding, not string matching
3. **Load actual files** - Not just metadata
   - Local: Load `.ctx.md` AND target file
   - Global: Load `.md` document
4. **Auto-load matches** - Load all matches immediately without confirmation
5. **Handle errors gracefully** - Skip missing files with warning
6. **Be mindful of context window** - Load efficiently, present key content

---

# Advanced Features

## Folder Loading
If $ARGUMENTS matches a folder name, load all documents in that folder:
```markdown
📁 Found folder: [folder-name] with X documents, loading...

[Loads all documents in folder...]
```

## Wildcard Patterns
Support patterns:
- `src/auth/*` → All auth-related local contexts
- `rules/*` → All rule documents

## Related Suggestions
After loading, suggest related contexts:
```markdown
💡 Related contexts you might want:
• [related-1] - [what]
• [related-2] - [what]
```

---

# Performance Tips (for AI)

- Use **parallel reads** for multiple files
- Cache registry reads within conversation
- Skip re-loading already loaded contexts
- Suggest related contexts proactively
- Format output concisely to save tokens

---

# Example Usage

```
User: /ctx.load authentication

AI:
🔍 Found 5 contexts for "authentication", loading...

[Loads and presents each context...]

### Loaded: src/auth/jwt.ts
**What:** JWT token generation and validation utilities
**When:**
• Implementing JWT authentication
• Token validation in middleware
...

### Loaded: src/auth/middleware.ts
**What:** Express middleware for route authentication
...

### Loaded: rules/auth-security.md
**What:** Authentication security best practices
...

---

✓ Loaded 5 contexts

Local (3):
• src/auth/jwt.ts
• src/auth/middleware.ts
• src/auth/oauth.ts

Global (2):
• rules/auth-security.md
• architecture/auth-flow.md

Total: 5 contexts loaded

💡 I now have all authentication contexts. How can I help?
```

---

# Reference
- Local registry: `ctx/local-context-registry.yml`
- Global registry: `ctx/global-context-registry.yml`
- Keep registries updated: `ctx sync`
