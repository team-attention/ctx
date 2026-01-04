---
name: session-capture
description: This skill should be used when the user asks to "capture session", "save session history", "get today's work", "extract feedback from session", "summarize what I worked on", "/ctx.capture session", or wants to capture Claude Code session history as context.
allowed-tools: Read, Glob, Bash, Write
---

# Session Capture Skill

Capture Claude Code session history and save to inbox for context creation.

## Trigger Conditions

Activate this skill when:
- Request contains "capture session", "save session history"
- Request contains "today's work", "get session history"
- Request contains "extract feedback from session"
- Request contains "summarize what I worked on"
- Explicit command `/ctx.capture session`

---

## Policy References

Before capturing, review these policies:

| Policy | Location | Key Points |
|--------|----------|------------|
| **Scope Policy** | `shared/CAPTURE_POLICY.md` Section 1 | Default: current_project |
| **Redaction** | `shared/CAPTURE_POLICY.md` Section 2 | Auto-mask sensitive data |
| **Inbox Schema** | `shared/INBOX_SCHEMA.md` Section 4 | Session inbox format |

---

## Data Location

Claude Code stores session history at:

```
~/.claude/projects/<encoded-cwd>/*.jsonl
```

### Path Encoding Rule

| Original | Encoded |
|----------|---------|
| `/Users/hoyeonlee/team-attention/ctx` | `-Users-hoyeonlee-team-attention-ctx` |
| `/home/user/project` | `-home-user-project` |

**Rule:** Replace `/` with `-`

### Session File Format (JSONL)

Each line is a JSON object:

```json
{"type":"user","message":{"role":"user","content":"check terraform config"}}
{"type":"assistant","message":{"role":"assistant","content":"I'll check the terraform configuration..."}}
```

---

## Execution Algorithm

### Step 1: Determine Scope

**Default scope:** `current_project` (no confirmation needed)

Check user request for scope hints:

| Request Pattern | Scope | Action |
|-----------------|-------|--------|
| Default / no hint | `current_project` | Proceed |
| "in /path/to/project" | `specific_project` | Use specified path |
| "all projects", "every project" | `all_projects` | **Require confirmation** |

**For `all_projects` scope, show confirmation:**

```
⚠️ You requested to search all projects.

This will search all sessions under ~/.claude/projects/.
Sensitive information from other projects may be included.

Continue? [y/N]
```

### Step 2: Encode Project Path

Convert current working directory to encoded path:

```typescript
function encodeProjectPath(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

// Example:
// /Users/hoyeonlee/team-attention/ctx
// → -Users-hoyeonlee-team-attention-ctx
```

### Step 3: Find Session Files

Use Glob to find session files:

```
~/.claude/projects/<encoded-cwd>/*.jsonl
```

**Filter by date if specified:**
- "today" → files modified today
- "this week" → files modified this week
- "yesterday" → files modified yesterday

### Step 4: Parse Session Files

Read each JSONL file and parse messages:

```typescript
interface SessionMessage {
  type: 'user' | 'assistant';
  message: {
    role: string;
    content: string;
  };
}
```

### Step 5: Apply Filters

If user specified filter keywords:

```
User: "extract only terraform-related content"
```

Filter messages containing the keyword in content.

### Step 6: Apply Redaction

Apply redaction patterns from `shared/CAPTURE_POLICY.md`:

```typescript
const REDACTION_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED:API_KEY]' },
  { pattern: /xox[baprs]-[a-zA-Z0-9-]+/g, replacement: '[REDACTED:SLACK_TOKEN]' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED:GITHUB_TOKEN]' },
  // ... more patterns
];
```

**Track redaction count** for metadata.

### Step 7: Generate run_id

Create UUID v4 for this capture run:

```typescript
import { randomUUID } from 'crypto';
const runId = randomUUID();
```

### Step 8: Save to Inbox

Create inbox directory if not exists:

```bash
mkdir -p .ctx/inbox/session
```

Write inbox file following schema:

**Path:** `.ctx/inbox/session/<run_id>.json`

```json
{
  "schema_version": "1.0",
  "run_id": "<uuid>",
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
    "sessions": [...]
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
    "user": "<username>",
    "cwd": "<current working directory>"
  }
}
```

### Step 9: Report Results

Provide summary to user:

```markdown
## Session Capture Complete

- **Sessions:** 3 files processed
- **Messages:** 150 total, 42 after filter
- **Redacted:** 0 sensitive items masked
- **Inbox:** `.ctx/inbox/session/550e8400-....json`

### Next Steps

1. Review inbox content (optional)
2. Run `ctx save` to create final context

Example:
\`\`\`bash
ctx save --path learnings/terraform-2026-01-03.md --content "..."
\`\`\`
```

---

## Example Workflows

### Example 1: Basic Session Capture

**User:** "Save today's session history"

**Actions:**
1. Scope: `current_project` (default)
2. Encode CWD → `-Users-hoyeonlee-team-attention-ctx`
3. Glob: `~/.claude/projects/-Users-hoyeonlee-team-attention-ctx/*.jsonl`
4. Filter: files modified today
5. Parse JSONL, apply redaction
6. Save to `.ctx/inbox/session/<run_id>.json`
7. Report: "3 sessions, 150 messages captured"

### Example 2: Filtered Capture

**User:** "Summarize what I learned about terraform today"

**Actions:**
1. Scope: `current_project`
2. Find today's session files
3. Parse and filter: messages containing "terraform"
4. Save to inbox
5. Report filtered results
6. Optionally: Extract insights and suggest `ctx save`

### Example 3: All Projects (Requires Confirmation)

**User:** "Get this week's work from all projects"

**Actions:**
1. Detect `all_projects` scope
2. **Show confirmation prompt**
3. If confirmed:
   - Glob: `~/.claude/projects/*/*.jsonl`
   - Filter: files modified this week
   - Process all sessions
4. Save to inbox
5. Report: "15 projects, 42 sessions processed"

---

## Error Handling

| Scenario | Response |
|----------|----------|
| No session files found | "No session files found for this project. Ensure you have previous Claude Code sessions." |
| Project path not encoded | "Could not find encoded path for: [cwd]. Check ~/.claude/projects/ structure." |
| JSONL parse error | "Warning: Could not parse [file]. Skipping." |
| Inbox write failed | "Error: Could not write to inbox. Check .ctx/ permissions." |

---

## Security Notes

1. **Never expose full paths** in user-facing output (use `~` prefix)
2. **Always apply redaction** unless `--no-redact` explicitly specified
3. **Warn on wide scope** - `all_projects` requires explicit confirmation
4. **Inbox is temporary** - files auto-cleaned after 7 days

---

## Related Resources

### Policy Files
- `shared/CAPTURE_POLICY.md` - Security and privacy policies
- `shared/INBOX_SCHEMA.md` - Inbox data format

### Related Skills
- **ctx-save** - Save final context from inbox

---

## CLI Reference

@../../shared/CLI_REFERENCE.md
