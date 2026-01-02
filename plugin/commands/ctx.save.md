---
name: ctx.save
description: Save context from conversation or external sources
---

# /ctx.save

Invoke the ctx-save skill to save context.

## Usage

```
/ctx.save              # Quick mode - save from current session
/ctx.save from slack   # Deliberate mode - extract from Slack
/ctx.save from url     # Deliberate mode - extract from URL
```

## Modes

### Quick Mode (Default)
Zero-friction saving. AI analyzes the current conversation and:
1. Identifies valuable knowledge
2. Recommends scope (Global/Project/Local)
3. Proposes save location
4. Single confirmation needed

### Deliberate Mode
Triggered when extracting from external sources:
- "from slack" - Extract from Slack channel/thread
- "from url" - Extract from web page
- "from clipboard" - Extract from pasted content

## Execution

This command invokes the `ctx-save` skill. The skill will:
1. Analyze the request to determine mode (Quick vs Deliberate)
2. Gather content from the specified source
3. Recommend scope and location
4. Create and register the context file
5. Sync the registry

## Examples

**Quick Mode:**
```
User: /ctx.save
AI: I found these key patterns in our conversation:
    - JWT refresh token rotation
    - Error handling middleware

    Saving to: .ctx/contexts/auth-patterns.md
    Looks good? [Y/n]
```

**Deliberate Mode:**
```
User: /ctx.save from slack
AI: Which channel/thread should I extract from?
    1. #engineering (recent deployment discussion)
    2. #architecture (API design thread)
```
