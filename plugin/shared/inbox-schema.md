# Inbox Schema

> Inbox storage format definition for Source Capture System
> Schema Version: 1.0
> Reference: docs/RFC-source-capture-system.md

---

## 1. Overview

### Inbox Role

```
[External Source]  →  [Capture]  →  [inbox (RAW)]  →  [Process]  →  [ctx save]
   Session            Skill         JSON format       Agent        Markdown
                                    Temporary         Insights     Permanent
```

### Storage Location

```
.ctx/inbox/
└── session/
    └── 772g0622-g40d-63f6-c938-668877662222.json
```

### Filename Convention

- **Format**: `<run_id>.json`
- **run_id**: UUID v4 (prevents overwrite on same-day re-runs)

---

## 2. Common Schema (v1.0)

Base structure shared by all inbox files:

```json
{
  "schema_version": "1.0",
  "run_id": "<UUID v4>",
  "source": "session",
  "fetched_at": "<ISO 8601 timestamp>",
  "query": { },
  "data": { },
  "metadata": { },
  "provenance": {
    "tool": "ctx-capture",
    "version": "1.0.0",
    "user": "<username>",
    "cwd": "<current working directory>"
  }
}
```

### Field Description

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | ✅ | Schema version ("1.0") |
| `run_id` | string | ✅ | Unique execution ID (UUID v4) |
| `source` | string | ✅ | Data source type |
| `fetched_at` | string | ✅ | Collection timestamp (ISO 8601) |
| `query` | object | ✅ | Collection query parameters |
| `data` | object | ✅ | Collected data |
| `metadata` | object | ✅ | Collection result metadata |
| `provenance` | object | ✅ | Source tracking info |

---

## 3. Session Inbox Schema

### Full Structure

```json
{
  "schema_version": "1.0",
  "run_id": "661f9511-f39c-52e5-b827-557766551111",
  "source": "session",
  "fetched_at": "2026-01-03T10:00:00Z",
  "query": {
    "project": "/Users/hoyeonlee/team-attention/ctx",
    "scope": "current_project",
    "date_range": {
      "since": "2026-01-03",
      "until": "2026-01-03"
    },
    "filter": "terraform"
  },
  "data": {
    "sessions": [
      {
        "session_id": "60394218-abcd-1234-efgh-567890123456",
        "file_path": "~/.claude/projects/-Users-hoyeonlee-team-attention-ctx/60394218.jsonl",
        "started_at": "2026-01-03T09:00:00Z",
        "messages": [
          {
            "type": "user",
            "content": "Check terraform config",
            "timestamp": "2026-01-03T09:00:00Z"
          },
          {
            "type": "assistant",
            "content": "I'll check the terraform configuration...",
            "timestamp": "2026-01-03T09:00:05Z"
          }
        ]
      }
    ]
  },
  "metadata": {
    "session_count": 3,
    "message_count": 150,
    "filtered_message_count": 42,
    "redacted_count": 0
  },
  "provenance": {
    "tool": "ctx-capture",
    "version": "1.0.0",
    "user": "hoyeonlee",
    "cwd": "/Users/hoyeonlee/team-attention/ctx"
  }
}
```

### query Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project` | string | ✅ | Project path |
| `scope` | string | ✅ | Scope (current_project, specific_project, all_projects) |
| `date_range.since` | string | - | Start date (YYYY-MM-DD) |
| `date_range.until` | string | - | End date (YYYY-MM-DD) |
| `filter` | string | - | Filter keyword |

### data.sessions Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_id` | string | ✅ | Session unique ID |
| `file_path` | string | ✅ | Session file path |
| `started_at` | string | - | Session start time |
| `messages` | array | ✅ | Message list |

### data.sessions[].messages Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | ✅ | Message type (user, assistant) |
| `content` | string | ✅ | Message content |
| `timestamp` | string | - | Message timestamp |

### metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `session_count` | number | Processed session count |
| `message_count` | number | Total message count |
| `filtered_message_count` | number | Post-filter message count |
| `redacted_count` | number | Masked item count |

---

## 4. Path Encoding Rules

Claude Code sessions store project paths with encoding:

### Encoding Rule

```
/ → -
```

### Examples

| Original Path | Encoded Result |
|---------------|----------------|
| `/Users/hoyeonlee/team-attention/ctx` | `-Users-hoyeonlee-team-attention-ctx` |
| `/home/user/project` | `-home-user-project` |

### Session File Location

```
~/.claude/projects/<encoded-cwd>/*.jsonl
```

---

## 5. UUID Generation

### run_id Generation Rules

- **Format**: UUID v4
- **Generated**: Once at capture start
- **Purpose**:
  - Used as filename (prevents overwrite)
  - Shared across multi-source capture
  - Provenance tracking

### Implementation Example

```typescript
import { randomUUID } from 'crypto';

function generateRunId(): string {
  return randomUUID();
}

// Result: "550e8400-e29b-41d4-a716-446655440000"
```

---

## 6. Schema Version Management

### Version Rules

- **Major**: Breaking changes (1.0 → 2.0)
- **Minor**: Backward-compatible additions (1.0 → 1.1)

### Version Check Logic

```typescript
function isCompatible(schemaVersion: string): boolean {
  const [major] = schemaVersion.split('.').map(Number);
  return major === 1; // Currently supported version
}
```

### Migration

Migration script provided for schema changes:

```bash
ctx inbox migrate --from 1.0 --to 2.0
```

---

## References

- [RFC: Source Capture System](../../../docs/RFC-source-capture-system.md)
- [Capture Policy](./capture-policy.md)
