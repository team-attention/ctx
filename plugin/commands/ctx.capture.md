---
name: ctx.capture
description: Capture Claude Code session history and save as context
---

# /ctx.capture

Capture session history and save as context.

## Usage

```
/ctx.capture session [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--save` | Auto-save without review (1-step) |
| `--no-redact` | Disable sensitive data masking |

## Examples

```
/ctx.capture session                    # Today's session
/ctx.capture session today              # Today's session
/ctx.capture session terraform          # Filter by keyword
/ctx.capture session "this week" --save # This week, auto-save
```

## How It Works

The session-capture skill is invoked to:
1. Find session files in `~/.claude/projects/`
2. Parse and filter messages
3. Apply redaction (mask sensitive data)
4. Save to inbox (`.ctx/inbox/session/`)

## Workflow

### 2-Step (Default)

```
Step 1: Capture → Inbox
/ctx.capture session
# Result saved to .ctx/inbox/session/<run_id>.json

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
└── session/
    └── <run_id>.json
```

Inbox files are:
- Temporary (auto-cleaned after 7 days)
- Git-ignored (`**/.ctx/inbox/`)
- JSON format for debugging

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
