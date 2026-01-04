# CTX Framework Core Principles

## 1. UX Simplicity (Core Principle)

> **Design UX to be simple from the user's perspective.**

- Complex internal structures should surface as simple interfaces
- Defaults optimized for the most common use cases
- Advanced options hidden until needed
- Error messages guide users to solutions

## 2. CLI First (Plugin Principle)

> **Always interact with CTX through CLI**

```
Good:  ctx load api auth           # Use CLI
Bad:   Parse .ctx/registry.yaml    # Direct access
```

**Reasons:**
- **Stability**: CLI maintains compatibility even when registry schema changes
- **Validation**: CLI handles input validation and error handling
- **Consistency**: All components use the same interface
- **Maintainability**: One CLI fix benefits all plugins

## 3. Scope Defaults

> **Default = Project scope (narrowest, safest)**

```bash
ctx list              # Project only (default)
ctx list --global     # Global only
ctx list --all        # Both
```

Follows industry standards: `npm list` (project) vs `npm list -g` (global)

## 4. Write vs Read Command Distinction

| Type | No Project Found | Examples |
|------|------------------|----------|
| **Write** | Error + exit(1) | sync, create, add, save |
| **Read** | Warning + global fallback | status, list, load |

## 5. Output Format Principle

- **JSON is default** (machine-readable, scriptable)
- `--pretty` → human-readable
- `--paths` → simple line output (useful for piping)

## 6. Context Distinction Criteria

> **Based on `target` field presence (not file location)**

- `target` present → Bound context (auto-loaded when reading that file)
- `target` absent → Standalone context (loaded by keywords matching)

## 7. Priority Order

```
Project (with target) > Project (without target) > Global
```

## 8. Context Philosophy

> **Context is the bottleneck, not AI capability.**

```
Human insight  →  Saved as context  →  Auto-loaded when needed
     ↑                                          │
     └──────────── Feedback loop ───────────────┘
```
