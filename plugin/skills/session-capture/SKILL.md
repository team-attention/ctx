---
name: session-capture
description: This skill should be used when user wants to access, capture, or reference Claude Code session history. Trigger when user references past/current conversation, dialogue, or session as a source - whether for saving, extracting, summarizing, or reviewing. This includes any mention of "what we discussed", "today's work", "session history", or when user treats the conversation itself as source material (e.g., "대화내용에서", "세션 기준으로", "아까 얘기한 거", "from our conversation").
allowed-tools: Read, Glob, Bash, Write
context: fork
---

# Session Capture Skill

Capture Claude Code session history and save to inbox for context creation.

## Trigger Conditions

Activate this skill when:
- Explicit: "capture session", "save session history"
- **User references conversation/session as source material:**
  - Treats past/current dialogue as information source
  - Wants to extract, save, summarize, or review session content
  - Examples: "오늘 세션 기준으로", "대화내용에서", "아까 얘기한 거", "what we discussed", "from our conversation", "today's work"

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

### Step 4: Preprocess & Parse Sessions

Session files can be very large (>25000 tokens) due to thinking blocks, tool calls, and metadata.
Use preprocessing to reduce size before parsing.

#### 4a. Check File Count and Size

```bash
# Count session files
SESSION_COUNT=$(ls -1 ~/.claude/projects/<encoded-cwd>/*.jsonl 2>/dev/null | wc -l)

# Check individual file sizes (rough token estimate: bytes / 4)
for f in ~/.claude/projects/<encoded-cwd>/*.jsonl; do
  SIZE=$(wc -c < "$f")
  TOKENS=$((SIZE / 4))
  echo "$f: ~$TOKENS tokens"
done
```

#### 4b. Preprocess with extract-session.sh

Use the bundled script to extract essential content:

```bash
# Extract user messages + assistant text only (removes thinking, tool_use, metadata)
${CLAUDE_PLUGIN_ROOT}/scripts/extract-session.sh <session.jsonl>
```

**What gets extracted:**
- `summary` type → session summary
- `user` type → user messages with timestamp
- `assistant` type → text content only (excludes thinking, tool_use)

**Size reduction:** Typically 60-90% (e.g., 48000 tokens → 5000 tokens)

#### 4c. Parallel Processing for Multiple Sessions

When multiple session files exist, use parallel Task(haiku) for efficiency:

```
┌─────────────────────────────────────────────────────┐
│  Session Files (N개)                                 │
├─────────────────────────────────────────────────────┤
│                    ↓                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Task      │ │Task      │ │Task      │  ...       │
│  │(haiku)   │ │(haiku)   │ │(haiku)   │            │
│  │Session 1 │ │Session 2 │ │Session 3 │            │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘            │
│       │            │            │                   │
│       ↓            ↓            ↓                   │
│  ┌──────────────────────────────────────┐          │
│  │  Main Agent: Collect & Synthesize    │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

**Implementation:**

```markdown
For each session file, launch parallel Task:

Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="
    1. Run: ${CLAUDE_PLUGIN_ROOT}/scripts/extract-session.sh <session_path>
    2. From the filtered output, extract:
       - User's main questions/requests
       - Key decisions and solutions reached
       - Problems encountered and how they were resolved
    3. Return structured summary (max 500 words)
  "
)
```

**Benefits:**
- **Speed**: N sessions processed in parallel vs sequential
- **Cost**: haiku is ~10x cheaper than opus
- **Context**: Each Task has isolated context, no overflow
- **Resilience**: Individual failures don't block other sessions

#### 4d. Decision Tree

```
Session files found?
├─ No → Error: "No sessions found"
└─ Yes → How many files?
    ├─ 1 file, small (<5000 tokens)
    │   → Direct Read + parse
    ├─ 1 file, large (≥5000 tokens)
    │   → extract-session.sh → parse
    └─ Multiple files
        → Parallel Task(haiku) for each
        → Collect results
        → Synthesize
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

### Example 1: Basic Session Capture (Single Small File)

**User:** "Save today's session history"

**Actions:**
1. Scope: `current_project` (default)
2. Encode CWD → `-Users-hoyeonlee-team-attention-ctx`
3. Glob: `~/.claude/projects/-Users-hoyeonlee-team-attention-ctx/*.jsonl`
4. Filter: files modified today → 1 file found, ~5000 tokens
5. Direct Read + parse JSONL
6. Apply redaction
7. Save to `.ctx/inbox/session/<run_id>.json`
8. Report: "1 session, 50 messages captured"

### Example 2: Large File Handling

**User:** "Capture this week's sessions"

**Actions:**
1. Scope: `current_project`
2. Find session files → 1 file, but ~48000 tokens (too large!)
3. Run `extract-session.sh` to preprocess:
   ```bash
   ${CLAUDE_PLUGIN_ROOT}/scripts/extract-session.sh <session.jsonl>
   ```
4. Reduced to ~5000 tokens (90% reduction)
5. Parse filtered output
6. Apply redaction, save to inbox
7. Report: "1 session processed (preprocessed due to size)"

### Example 3: Multiple Sessions - Parallel Processing

**User:** "Get all my terraform sessions from this project"

**Actions:**
1. Scope: `current_project`
2. Find session files → 5 files found
3. Launch 5 parallel Task(haiku):
   ```
   Task 1: extract-session.sh file1.jsonl → summarize
   Task 2: extract-session.sh file2.jsonl → summarize
   Task 3: extract-session.sh file3.jsonl → summarize
   Task 4: extract-session.sh file4.jsonl → summarize
   Task 5: extract-session.sh file5.jsonl → summarize
   ```
4. Collect all summaries
5. Filter: keyword "terraform"
6. Synthesize into unified context
7. Save to inbox
8. Report: "5 sessions processed in parallel, 42 terraform-related messages"

### Example 4: Filtered Capture

**User:** "Summarize what I learned about terraform today"

**Actions:**
1. Scope: `current_project`
2. Find today's session files
3. Preprocess with extract-session.sh if large
4. Parse and filter: messages containing "terraform"
5. Save to inbox
6. Report filtered results
7. Optionally: Extract insights and suggest `ctx save`

### Example 5: All Projects (Requires Confirmation)

**User:** "Get this week's work from all projects"

**Actions:**
1. Detect `all_projects` scope
2. **Show confirmation prompt**
3. If confirmed:
   - Glob: `~/.claude/projects/*/*.jsonl`
   - Filter: files modified this week
   - Launch parallel Task(haiku) per project
4. Collect and synthesize results
5. Save to inbox
6. Report: "15 projects, 42 sessions processed in parallel"

---

## Error Handling

| Scenario | Response |
|----------|----------|
| No session files found | "No session files found for this project. Ensure you have previous Claude Code sessions." |
| Project path not encoded | "Could not find encoded path for: [cwd]. Check ~/.claude/projects/ structure." |
| JSONL parse error | "Warning: Could not parse [file]. Skipping." |
| Inbox write failed | "Error: Could not write to inbox. Check .ctx/ permissions." |
| File too large (>25000 tokens) | Auto-preprocess with extract-session.sh |
| jq not installed | "Error: jq is required for large file processing. Install with: brew install jq" |
| Task(haiku) failed | "Warning: Could not process [file]. Including raw summary only." |

---

## Security Notes

1. **Never expose full paths** in user-facing output (use `~` prefix)
2. **Always apply redaction** unless `--no-redact` explicitly specified
3. **Warn on wide scope** - `all_projects` requires explicit confirmation
4. **Inbox is temporary** - files auto-cleaned after 7 days

---

## Related Resources

### Scripts
- **`scripts/extract-session.sh`** - Extract essential content from session JSONL (removes thinking, tool_use)

### Policy Files
- `shared/CAPTURE_POLICY.md` - Security and privacy policies
- `shared/INBOX_SCHEMA.md` - Inbox data format

### Related Skills
- **ctx-save** - Save final context from inbox

---

## CLI Reference

@../../shared/CLI_REFERENCE.md
