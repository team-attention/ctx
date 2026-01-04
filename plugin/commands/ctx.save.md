---
name: ctx.save
description: Save context from conversation
---

# /ctx.save

Invoke the ctx-save skill to save context.

## Usage

```
/ctx.save              # Save from current session
```

## How It Works

AI analyzes the current conversation and:
1. Identifies valuable knowledge
2. Recommends scope (Global/Project)
3. Proposes save location
4. Single confirmation needed

## Execution

This command invokes the `ctx-save` skill. The skill will:
1. Analyze the conversation to identify valuable content
2. Recommend scope and location
3. Create and register the context file
4. Sync the registry

## Example

```
User: /ctx.save
AI: I found these key patterns in our conversation:
    - JWT refresh token rotation
    - Error handling middleware

    Saving to: .ctx/contexts/auth-patterns.md
    Looks good? [Y/n]
```
