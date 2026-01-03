---
name: ctx.capture
description: Capture data from external sources (Slack, session) and save as context
---

# /ctx.capture

Capture data from external sources and save as context.

## Usage

```
/ctx.capture <source> [options]
```

### Sources

| Source | Description |
|--------|-------------|
| `session` | Claude Code session history |
| `slack` | Slack channel messages |
| `all` | All available sources |

### Options

| Option | Description |
|--------|-------------|
| `--save` | Auto-save without review (1-step) |
| `--expand-threads` | Include Slack thread replies |
| `--no-redact` | Disable sensitive data masking |

## Examples

### Session Capture

```
/ctx.capture session                    # Today's session
/ctx.capture session today              # Today's session
/ctx.capture session terraform          # Filter by keyword
/ctx.capture session "this week" --save # This week, auto-save
```

### Slack Capture

```
/ctx.capture slack #general             # #general channel
/ctx.capture slack #team-ai yesterday   # Yesterday's messages
/ctx.capture slack #dev --expand-threads # Include threads
```

### Multi-Source Capture

```
/ctx.capture all today                  # All sources, today
/ctx.capture all terraform              # All sources, filtered
```

## How It Works

### Single Source (Skill)

For single source capture, the corresponding skill is invoked:
- `session` → session-capture skill
- `slack` → slack-capture skill

### Multiple Sources (Agent)

For `all` or multiple sources, the ctx-capture agent orchestrates:
1. Execute each capture skill
2. Save to inbox (`.ctx/inbox/<source>/`)
3. Synthesize insights
4. Save final context

## Workflow

### 2-Step (Default)

```
Step 1: Capture → Inbox
/ctx.capture slack #team-ai
# Result saved to .ctx/inbox/slack/<run_id>.json

Step 2: Review → Save
# Agent shows summary
# User confirms save location
# Saved to .ctx/contexts/<name>.md
```

### 1-Step (--save)

```
/ctx.capture session --save
# Capture → Inbox → Auto-save
# No review step
```

## Progress Feedback

During capture, progress is shown:

```
🔄 session-capture: searching ~/.claude/projects/...
✓ session-capture: 3 sessions, 150 messages found
🔄 Applying redaction...
✓ 2 sensitive items masked
🔄 Saving to inbox...
✓ Saved: .ctx/inbox/session/550e8400-....json

Ready to save. Review inbox content or run ctx-save.
```

## Inbox Location

Captured data is saved to:

```
.ctx/inbox/
├── slack/
│   └── <run_id>.json
└── session/
    └── <run_id>.json
```

Inbox files are:
- Temporary (auto-cleaned after 7 days)
- Git-ignored (`**/.ctx/inbox/`)
- JSON format for debugging

## Execution

This command routes to appropriate skill or agent:

| Request | Handler |
|---------|---------|
| Single source | Skill (session-capture, slack-capture) |
| Multiple sources | Agent (ctx-capture) |
| Complex synthesis | Agent (ctx-capture) |

## Related Commands

| Command | Description |
|---------|-------------|
| `/ctx.save` | Save context from conversation |
| `/ctx.load` | Load existing contexts |
| `/sync` | Sync context registry |

## Policies

See `shared/capture-policy.md` for:
- Scope policies (current project, all projects)
- Redaction patterns
- Inbox retention (7 days)
