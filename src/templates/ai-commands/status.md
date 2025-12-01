---
description: Show current ctx and work session status
argument-hint: ""
allowed-tools: [Bash]
---

# Task

Run `npx ctx status` and display the output to the user.

---

# Workflow

```bash
npx ctx status
```

Display the output as-is. The CLI handles all formatting.

---

# What It Shows

- **Context Status**: Local/global context counts, health, last sync time
- **Work Session**: Active issue, branch, session count
- **Suggestions**: Actionable next steps based on current state
