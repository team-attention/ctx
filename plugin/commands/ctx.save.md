---
name: ctx.save
description: Save context from conversation
---

# /ctx.save

Invoke the `ctx-save` skill to extract and save context from the current conversation.

## Usage

```
/ctx.save                   # Analyze conversation and save context
```

## Example

```
User: /ctx.save
AI: Found valuable patterns in our conversation:
    - JWT refresh token rotation
    - Error handling middleware

    Save to: .ctx/contexts/auth-patterns.md
    Proceed? [Y/n]
```
