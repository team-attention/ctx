# CTX Plugin for Claude Code

Persistent memory for AI. Context auto-loads, grows over time, and travels with your code.

## Installation

```bash
# Add marketplace
/plugin marketplace add team-attention/ctx

# Install plugin
/plugin install ctx@team-attention
```

Or test locally:

```bash
claude --plugin-dir ./plugin
```

## Features

### Commands

| Command | Description |
|---------|-------------|
| `/ctx:load` | Load contexts by keywords or target file |
| `/ctx:save` | Save content as context |
| `/ctx:status` | Show current context status |
| `/ctx:sync` | Sync registry with filesystem |
| `/ctx:capture` | Capture external sources (sessions) |

### Skills

| Skill | Description |
|-------|-------------|
| `ctx-load` | Auto-load relevant contexts |
| `ctx-save` | Save insights as persistent context |
| `session-capture` | Capture Claude Code sessions |

### Agents

| Agent | Description |
|-------|-------------|
| `ctx-capture` | Orchestrate multi-source capture |

## Requirements

- Claude Code CLI
- CTX CLI installed globally: `npm install -g @team-attention/ctx`

## Documentation

- [CLI Reference](shared/cli-reference.md)
- [Capture Policy](shared/capture-policy.md)
- [Project AGENTS.md](../AGENTS.md)
