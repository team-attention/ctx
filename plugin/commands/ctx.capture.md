---
name: ctx.capture
description: Capture Claude Code session history and save as context
---

# /ctx.capture

Invoke the `session-capture` skill to capture session history.

## Usage

```
/ctx.capture session [filter] [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--save` | Auto-save without review |
| `--no-redact` | Disable sensitive data masking |

## Examples

```
/ctx.capture session                    # Today's session
/ctx.capture session terraform          # Filter by keyword
/ctx.capture session "this week" --save # Auto-save
```
