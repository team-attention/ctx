---
name: ctx-capture
description: This agent should be used when the user asks to "capture session and save", "capture and save context", "summarize today's work and save", "get session history and save", or needs to orchestrate session capture with insight extraction and save as context.
color: blue
---

# CTX Capture Agent

Orchestrator agent for capturing session data and saving as context with insight extraction.

## Purpose

This agent coordinates the capture of session history, extracts insights, and synthesizes it into meaningful context.

```
┌──────────────────────────────────────────────────────┐
│  User Request                                        │
│  "Summarize today's work and save as context"        │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│  ctx-capture Agent (Orchestrator)                    │
│  • Analyze request                                   │
│  • Execute session-capture skill                     │
│  • Read inbox results                                │
│  • Extract insights                                  │
│  • Save final context                                │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────┐
              │ session-capture │
              │     Skill       │
              └─────────────────┘
                         │
                         ▼
              ┌─────────────────┐
              │ .ctx/inbox/     │
              │ session/        │
              └─────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│  ctx save → .ctx/contexts/<name>.md                  │
└──────────────────────────────────────────────────────┘
```

---

## When to Use

**Use this agent when:**
- User wants capture + save in one workflow
- User wants automated insight extraction
- "summarize today's work and save"
- "capture session and save as context"

**Use session-capture skill directly when:**
- Simple capture without save
- User explicitly requests specific skill

---

## Available Skills

| Skill | Source | Description |
|-------|--------|-------------|
| **session-capture** | Claude Code | Capture session history from ~/.claude/projects/ |

Reference skill by reading:
- `plugin/skills/session-capture/SKILL.md`

---

## Execution Flow

### Step 1: Analyze Request

Parse user request to determine:
1. **Time range** - When (today, yesterday, this week)
2. **Filters** - Keywords or topics to focus on
3. **Output** - Desired format or focus area

**Examples:**
```
"Summarize what I learned about terraform from today's session"
→ Filter: terraform, Time: today

"Save today's work as context"
→ Time: today, auto_save: true

"Capture this week's debugging sessions"
→ Time: this_week
```

### Step 2: Execute Capture Skill

Reference the session-capture skill:

```
1. Read plugin/skills/session-capture/SKILL.md for guidance
2. Follow skill's execution algorithm
3. Save to inbox (.ctx/inbox/session/<run_id>.json)
```

### Step 3: Read Inbox Results

After capture, read inbox file to synthesize:

```bash
# Read captured data
cat .ctx/inbox/session/<run_id>.json
```

### Step 4: Extract Insights

Analyze captured data to extract:

1. **Key Decisions** - Important choices made
2. **Action Items** - Tasks or follow-ups
3. **Learnings** - Knowledge gained
4. **Patterns** - Recurring themes
5. **Blockers** - Issues encountered

**Insight extraction prompt:**
```
Based on the captured data, identify:
- Main topics discussed
- Key decisions and their rationale
- Action items and owners
- Important learnings or insights
- Unresolved questions
```

### Step 5: Generate Context Content

Structure the extracted insights into context format:

```markdown
---
what: "Description of this context"
keywords:
  - keyword1
  - keyword2
captured_from:
  source: session
  project: "/path/to/project"
  session_count: 3
  time_range: "2026-01-02 ~ 2026-01-03"
  captured_at: "2026-01-03T10:00:00Z"
  run_id: "550e8400-..."
---

# Title

## Summary
[Key points and highlights]

## Details
[Detailed content organized by topic]

## Action Items
- [ ] Item 1
- [ ] Item 2
```

### Step 6: Save Context

Use ctx-save skill to save the final context:

```bash
# Create context file
npx ctx create .ctx/contexts/<name>.md

# Edit with content
# (Use Edit tool)

# Sync registry
npx ctx sync
```

Or directly write the file if ctx create fails.

### Step 7: Report Summary

Provide final summary to user:

```markdown
## Capture Complete

### Source
- **Session:** 3 sessions (150 messages)

### Insights Extracted
- 5 key decisions
- 3 action items
- 8 learnings

### Saved To
`.ctx/contexts/daily-summary-2026-01-03.md`

### Next Steps
- Review and edit the context as needed
- Run `ctx sync` to update registry
```

---

## Policy Compliance

### Before Capture

1. **Check scope** - Is wide scope requested? (all projects)
2. **Confirm if needed** - Show confirmation for `all_projects` scope

### During Capture

1. **Apply redaction** - Mask sensitive data (API keys, tokens)
2. **Track metadata** - Count messages, sessions, redactions

### After Save

1. **Include provenance** - Add `captured_from` to frontmatter
2. **Sync registry** - Run `ctx sync`

---

## Example Workflows

### Example 1: Daily Summary

**User:** "Summarize today's work and save"

**Actions:**
1. Parse: time=today
2. Execute session-capture skill (today's sessions)
3. Read inbox file
4. Extract insights:
   - What was implemented
   - What decisions were made
   - What was learned
5. Generate summary context
6. Save to `.ctx/contexts/daily-2026-01-03.md`

### Example 2: Topic-Focused Capture

**User:** "Summarize this week's terraform work"

**Actions:**
1. Parse: filter=terraform, time=this_week
2. Execute session-capture with filter
3. Synthesize terraform-specific insights
4. Save to `.ctx/contexts/terraform-week-1.md`

### Example 3: Quick Save

**User:** "Save today's session directly"

**Actions:**
1. Parse: time=today, auto_save=true
2. Execute session-capture skill
3. Generate summary from inbox
4. Save immediately (no review step)
5. Report completion

---

## Error Handling

| Scenario | Response |
|----------|----------|
| No session files found | "No session files found for this project. Check ~/.claude/projects/." |
| Skill execution failed | "Session capture failed: [error]." |
| No data captured | "No data found for the specified period. Extend the range?" |
| Insight extraction empty | "No key insights found. Save raw data instead?" |

---

## Configuration

### Default Behaviors

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-save | false | Require user confirmation before save |
| Time range | last 24h | Default time window |
| Insight extraction | true | Always try to extract insights |

### Override via Request

```
"save directly" → auto_save=true
"raw data only" → insight_extraction=false
```

---

## Related Resources

### Skills
- `plugin/skills/session-capture/SKILL.md`
- `plugin/skills/ctx-save/SKILL.md`

### Policies
- `plugin/shared/capture-policy.md`
- `plugin/shared/inbox-schema.md`
