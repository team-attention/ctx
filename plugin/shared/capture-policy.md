# Capture Policy

> Security and privacy policies for Source Capture System
> Version: 1.0
> Reference: docs/RFC-source-capture-system.md

---

## 1. Scope Policy

### Scope Levels

| Scope | Default | Behavior | Confirmation |
|-------|---------|----------|--------------|
| **current_project** | ✅ | Search current project only | ❌ Not required |
| **specific_project** | - | Search specified project path | ❌ Not required |
| **all_projects** | - | Search all ~/.claude/projects/ | ⚠️ Required |

### Default Scope

- **Session capture**: `current_project` (based on current working directory)

### Wide Scope Confirmation Prompt

When `all_projects` scope is requested, user confirmation is required:

```
⚠️ You requested to search all projects.

This will search all sessions under ~/.claude/projects/.
Sensitive information from other projects may be included.

Continue? [y/N]
```

### Scope Decision Logic

```
1. Did user explicitly specify a project path?
   → YES: Use specific_project

2. Does request contain "all projects", "all", "every" keywords?
   → YES: Use all_projects (confirmation required)

3. Otherwise
   → Use current_project (default, no confirmation)
```

---

## 2. Sensitive Data Redaction

### Auto-Redaction Patterns

| Category | Pattern | Example |
|----------|---------|---------|
| **API Key** | `sk-[a-zA-Z0-9]{20,}` | `sk-abc123...` → `[REDACTED:API_KEY]` |
| **GitHub Token** | `ghp_[a-zA-Z0-9]{36}` | `ghp_abc...` → `[REDACTED:GITHUB_TOKEN]` |
| **AWS Key** | `AKIA[A-Z0-9]{16}` | `AKIA...` → `[REDACTED:AWS_KEY]` |
| **Bearer Token** | `Bearer\s+[a-zA-Z0-9._-]+` | `Bearer xyz...` → `[REDACTED:BEARER]` |
| **password=** | `password\s*=\s*['"]?[^'"\s]+` | `password=secret` → `[REDACTED:PASSWORD]` |
| **secret=** | `secret\s*=\s*['"]?[^'"\s]+` | `secret=abc` → `[REDACTED:SECRET]` |
| **token=** | `token\s*=\s*['"]?[^'"\s]+` | `token=xyz` → `[REDACTED:TOKEN]` |

### Redaction Timing

```
[Data Collection]
      │
      ▼
[1st Redaction] ─── Before inbox save
      │              Pattern matching auto-mask
      ▼
[Inbox Save] ─────── .ctx/inbox/<source>/<run_id>.json
      │
      ▼
[2nd Review] ─────── Before ctx save
      │              User/Agent review opportunity
      ▼
[Final Save] ─────── ctx save
```

### Redaction Control Options

```bash
# Default: redaction enabled
/ctx.capture session

# Disable redaction (dangerous - explicit warning shown)
/ctx.capture session --no-redact
# ⚠️ Warning: Redaction disabled. Sensitive data may be exposed.

# Add custom pattern
/ctx.capture session --redact-pattern "INTERNAL_[A-Z0-9]+"
```

### Redaction Implementation

```typescript
const REDACTION_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED:API_KEY]' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED:GITHUB_TOKEN]' },
  { pattern: /AKIA[A-Z0-9]{16}/g, replacement: '[REDACTED:AWS_KEY]' },
  { pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi, replacement: '[REDACTED:BEARER]' },
  { pattern: /password\s*=\s*['"]?[^'"\s]+/gi, replacement: '[REDACTED:PASSWORD]' },
  { pattern: /secret\s*=\s*['"]?[^'"\s]+/gi, replacement: '[REDACTED:SECRET]' },
  { pattern: /token\s*=\s*['"]?[^'"\s]+/gi, replacement: '[REDACTED:TOKEN]' },
];

function redact(text: string, additionalPatterns?: RegExp[]): string {
  let result = text;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  for (const pattern of additionalPatterns ?? []) {
    result = result.replace(pattern, '[REDACTED:CUSTOM]');
  }
  return result;
}
```

---

## 3. Inbox Security Policy

### Storage Location

- **Path**: `.ctx/inbox/<source>/<run_id>.json`
- **Git Exclude**: `**/.ctx/inbox/` must be in `.gitignore`

### Retention Policy

| Policy | Default | Description |
|--------|---------|-------------|
| **Retention Period** | 7 days | Auto-cleanup |
| **Cleanup Trigger** | `ctx sync` | Delete expired files on sync |
| **Manual Cleanup** | `ctx inbox clean` | Immediate deletion |

### Auto-Cleanup Logic

```
On ctx sync execution:
1. Scan .ctx/inbox/ directory
2. Check fetched_at of each file
3. Delete files where (now - fetched_at) > 7 days
4. Log number of deleted files
```

### .gitignore Configuration

```gitignore
# Source capture inbox (temporary, contains raw data)
**/.ctx/inbox/
```

---

## 4. Provenance (Source Tracking)

### Required Metadata

Must be included in final context frontmatter:

```yaml
---
what: "Session work summary"
keywords: ["session", "2026-01"]
captured_from:
  source: session
  project: "/Users/me/project"
  session_count: 3
  time_range: "2026-01-02 ~ 2026-01-03"
  captured_at: "2026-01-03T10:00:00Z"
  run_id: "550e8400-e29b-41d4-a716-446655440000"
---
```

### Provenance Field Description

| Field | Required | Description |
|-------|----------|-------------|
| `captured_from.source` | ✅ | Source type (session) |
| `captured_from.project` | ✅ | Project path |
| `captured_from.captured_at` | ✅ | Capture timestamp (ISO 8601) |
| `captured_from.run_id` | ✅ | Unique execution ID (UUID) |

---

## 5. Error Handling

### Scope Error

```
❌ Error: Project path not found: /path/to/project
   No sessions found for this project in ~/.claude/projects/
```

### Redaction Warning

```
⚠️ Warning: 2 sensitive items were masked.
   - API_KEY: 1
   - PASSWORD: 1
```

### Inbox Cleanup Log

```
ℹ️ Inbox cleanup: 2 files deleted (older than 7 days)
   - session/def456.json (2025-12-24)
   - session/ghi789.json (2025-12-23)
```

---

## References

- [RFC: Source Capture System](../../../docs/RFC-source-capture-system.md)
- [Inbox Schema](./inbox-schema.md)
