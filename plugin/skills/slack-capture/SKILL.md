---
name: slack-capture
description: This skill should be used when the user asks to "capture slack", "get slack messages", "fetch slack channel", "save slack conversation", "get slack history", "/ctx.capture slack", or wants to capture Slack channel messages as context.
allowed-tools: mcp__slack__*, Write, Read
---

# Slack Capture Skill

Capture Slack channel messages using MCP and save to inbox for context creation.

## Trigger Conditions

Activate this skill when:
- Request contains "capture slack", "get slack messages"
- Request contains "get slack history", "fetch slack messages"
- Request contains "save slack conversation", "fetch slack channel"
- Explicit command `/ctx.capture slack`

---

## Policy References

Before capturing, review these policies:

| Policy | Location | Key Points |
|--------|----------|------------|
| **Redaction** | `shared/capture-policy.md` Section 2 | Auto-mask sensitive data |
| **Inbox Schema** | `shared/inbox-schema.md` Section 3 | Slack inbox format |

---

## Prerequisites

### MCP Server Configuration

Slack MCP must be configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-slack"],
      "env": {
        "SLACK_TOKEN": "${SLACK_TOKEN}"
      }
    }
  }
}
```

### Required Environment Variable

```bash
export SLACK_TOKEN="xoxb-your-bot-token"
```

---

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp__slack__slack_list_channels` | List available channels |
| `mcp__slack__slack_get_channel_history` | Get channel messages |
| `mcp__slack__slack_get_thread_replies` | Get thread replies |
| `mcp__slack__slack_get_users` | Get user list (for name resolution) |

---

## Execution Algorithm

### Step 1: Identify Target Channel

If channel not specified, list available channels:

```
mcp__slack__slack_list_channels(limit: 100)
```

Match user's channel name to channel ID:
- "#team-ai" → "C1234567890"
- User may use channel name or ID

### Step 2: Determine Time Range

Parse user's time specification:

| User Input | Interpretation |
|------------|----------------|
| "yesterday" | Previous day (00:00-23:59) |
| "today" | Current day (00:00-now) |
| "this week" | Monday-today |
| "last 3 days" | 3 days ago-now |
| No specification | Last 24 hours (default) |

### Step 3: Fetch Messages

Call `mcp__slack__slack_get_channel_history`:

```typescript
mcp__slack__slack_get_channel_history({
  channel_id: "C1234567890",
  limit: 100  // Default 10, max 200
})
```

**Pagination Strategy:**

```
1. Initial request with limit=100
2. If has_more=true:
   - Get cursor from response
   - Wait 1 second (rate-limit)
   - Request next page
3. Repeat until has_more=false or limit reached
```

### Step 4: Expand Threads (Optional)

If `--expand-threads` or user requests thread content:

```
For each message where reply_count > 0:
  1. Wait 1 second (rate-limit)
  2. Call mcp__slack__slack_get_thread_replies({
       channel_id: "C1234567890",
       thread_ts: message.ts
     })
  3. Append replies to message
```

### Step 5: Resolve User Names

Get user info for better readability:

```
mcp__slack__slack_get_users(limit: 200)
```

Map user IDs to display names in messages.

### Step 6: Apply Redaction

Apply redaction patterns from `shared/capture-policy.md`:

```typescript
// Patterns to redact
const patterns = [
  /sk-[a-zA-Z0-9]{20,}/g,      // API keys
  /xox[baprs]-[a-zA-Z0-9-]+/g, // Slack tokens
  /Bearer\s+[a-zA-Z0-9._-]+/g, // Bearer tokens
  // ... more patterns
];
```

Track redaction count for metadata.

### Step 7: Generate run_id

```typescript
import { randomUUID } from 'crypto';
const runId = randomUUID();
```

### Step 8: Save to Inbox

Create inbox directory:

```bash
mkdir -p .ctx/inbox/slack
```

Write inbox file:

**Path:** `.ctx/inbox/slack/<run_id>.json`

```json
{
  "schema_version": "1.0",
  "run_id": "<uuid>",
  "source": "slack",
  "fetched_at": "2026-01-03T10:00:00Z",
  "query": {
    "channel": "#team-ai",
    "channel_id": "C1234567890",
    "since": "2026-01-02T00:00:00Z",
    "until": "2026-01-03T00:00:00Z",
    "timezone": "Asia/Seoul",
    "expand_threads": false
  },
  "data": {
    "messages": [...]
  },
  "metadata": {
    "message_count": 42,
    "thread_count": 5,
    "user_count": 8,
    "has_more": false,
    "redacted_count": 2
  },
  "provenance": {
    "tool": "ctx-capture",
    "version": "1.0.0",
    "user": "<username>",
    "cwd": "<cwd>"
  }
}
```

### Step 9: Report Results

```markdown
## Slack Capture Complete

- **Channel:** #team-ai
- **Time Range:** 2026-01-02 ~ 2026-01-03
- **Messages:** 42
- **Threads:** 5 (not expanded)
- **Redacted:** 2 sensitive items masked
- **Inbox:** `.ctx/inbox/slack/550e8400-....json`

### Next Steps

1. Review inbox content (optional)
2. Run ctx-save skill to create final context

Or use ctx-capture agent to auto-summarize and save.
```

---

## Rate-Limit Handling

Slack API has rate limits (Tier 1: ~1 req/sec):

```
On 429 Error:
1. Wait: Retry-After header (or 1 second default)
2. Retry with exponential backoff:
   - Attempt 1: 1s wait
   - Attempt 2: 2s wait
   - Attempt 3: 4s wait
3. Max 3 retries, then fail gracefully
```

---

## Example Workflows

### Example 1: Basic Channel Capture

**User:** "Save yesterday's #general slack conversation"

**Actions:**
1. List channels → find #general → C1234567890
2. Calculate yesterday's time range (Asia/Seoul)
3. Fetch messages (limit=100)
4. Apply redaction
5. Save to `.ctx/inbox/slack/<run_id>.json`
6. Report: "42 messages captured"

### Example 2: With Thread Expansion

**User:** "Get today's #team-ai slack with threads"

**Actions:**
1. Find channel ID
2. Fetch main messages
3. For each thread (reply_count > 0):
   - Fetch thread replies
   - 1s delay between requests
4. Merge threads into messages
5. Save to inbox
6. Report: "42 messages, 15 thread replies captured"

### Example 3: Specific Date Range

**User:** "Get #dev slack from last Monday to Friday"

**Actions:**
1. Parse date range → 2025-12-30 ~ 2026-01-03
2. Fetch messages with pagination
3. Filter by timestamp
4. Save to inbox

---

## Error Handling

| Scenario | Response |
|----------|----------|
| MCP not configured | "Slack MCP not configured. Add to .mcp.json and set SLACK_TOKEN." |
| Channel not found | "Channel '#xyz' not found. Available: #general, #dev, #team-ai" |
| Rate limited | "Rate limited by Slack. Waiting 5s before retry..." |
| No messages | "No messages found in #channel for the specified time range." |
| Token expired | "Slack token expired or invalid. Please refresh SLACK_TOKEN." |

---

## Timezone Handling

Default timezone: `Asia/Seoul` (KST, UTC+9)

Convert user's local time to UTC for API:
- "yesterday" (KST) → Previous day 00:00 KST = Previous day 15:00 UTC

Store in inbox with original timezone info for traceability.

---

## Security Notes

1. **Never log tokens** - SLACK_TOKEN is sensitive
2. **Redact before save** - Apply patterns before inbox write
3. **Channel access** - Only capture channels bot has access to
4. **User privacy** - Consider DM/private channel policies

---

## Related Resources

### Policy Files
- `shared/capture-policy.md` - Security and privacy policies
- `shared/inbox-schema.md` - Inbox data format

### MCP Documentation
- [Slack MCP Server](https://github.com/anthropics/mcp-servers/tree/main/slack)

### Related Skills
- **session-capture** - Capture Claude Code sessions
- **ctx-save** - Save final context from inbox
