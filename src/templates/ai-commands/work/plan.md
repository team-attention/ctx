---
description: Generate implementation plan for the current issue
argument-hint: [additional-requirements]
allowed-tools: [Read, Write, Bash, SlashCommand, AskUserQuestion, mcp__linear-server__get_issue, mcp__linear-server__list_comments, mcp__linear-server__update_issue]
---

# Task

Generate an **implementation plan** for the active issue in `.ctx.current`.

**Important**: This command generates the **HOW** (implementation details), NOT the **WHAT** (requirements/spec). The user has already written the spec.

---

# Workflow

## Step 1: Read `.ctx.current`

Use the Read tool to check if `.ctx.current` exists.

If it doesn't exist:
{{snippet:errors}}

{{snippet:ctx-current}}

---

## Step 2: Detect Online vs Offline

Check if `issue` value starts with `http`:
- **Yes** � Online issue (Flow A)
- **No** � Offline issue (Flow B)

---

## Flow A: Online Issue

### A1. Fetch Issue from Provider

{{snippet:issue-providers}}

Extract:
- **Title**: Issue title
- **Spec**: Description/body (this is the user's requirements)
- **Comments**: Check for additional requirements in comments

### A2. Parse Additional Requirements

If `$ARGUMENTS` provided, append to Spec:
```
Original Spec: <from issue description>

Additional Requirements:
<from $ARGUMENTS>
```

### A3. Load Relevant Contexts

Extract key technical terms from Spec (e.g., "authentication", "React", "dark mode", "settings").

Use the SlashCommand tool to load relevant contexts:
```
SlashCommand(command: "/ctx.load <keywords-from-spec>")
```

Example: If Spec mentions "dark mode toggle in settings page", extract keywords like "dark mode", "settings", "theme" and run:
```
SlashCommand(command: "/ctx.load dark mode settings theme")
```

This provides codebase context for planning.

### A4. Q&A Session (Implementation Focus)

**Purpose**:
- Clarify ambiguous parts of the Spec that affect implementation decisions
- Decide whether to reuse/extend existing code vs create new code
- Prevent code fragmentation by maximizing code reuse
- Make informed architectural choices based on existing codebase patterns

**When to ask the user** (use AskUserQuestion tool):

1. **Spec ambiguity**: Parts of the spec that could be implemented in multiple valid ways
   - Example: "The spec says 'add to settings'. Found 2 settings pages - which one?"

2. **Code reuse decision**: Found existing similar code - should we extend it or create new?
   - Example: "Found `ThemeManager` in `src/utils/theme.ts`. Should we extend this or create new `DarkModeContext`?"

3. **Architecture impact**: Implementation choice that affects overall codebase structure
   - Example: "Found 3 different state management patterns (Redux, Context, Zustand). Which should we follow?"

4. **Breaking changes**: Need to refactor existing code vs add new code alongside
   - Example: "Implementing this requires refactoring `UserService`. OK to modify it or create wrapper?"

**Process**:
1. AI analyzes the Spec and loaded codebase context
2. AI identifies ambiguities or critical implementation decisions
3. **AI asks user using AskUserQuestion tool** (only for items above)
4. User answers
5. AI documents the Q&A in the plan

**Important**:
- **DO ask** about implementation choices that affect code quality/architecture
- **DO prioritize** code reuse and consistency over creating new patterns
- **DON'T ask** about spec requirements (WHAT) - only implementation details (HOW)
- **DON'T ask** questions you can answer by analyzing the codebase

**Format in plan**:
```markdown
## Q&A

**Q: Found existing `ThemeManager` in `src/utils/theme.ts`. Extend this or create new context?**
A: Extend existing `ThemeManager` - maintains consistency with current architecture.

**Q: Should we add tests?**
A: Yes. Unit tests for theme toggling, integration tests for persistence.

...
```

### A5. Generate Implementation Plan

Create structured plan with:

```markdown
## Phases

### Phase 1: <Name>

**Step 1: <Task>**
- [ ] <Subtask>
- [ ] <Subtask>

**Step 2: <Task>**
- [ ] <Subtask>

### Phase 2: <Name>
...

## Files to Modify
- `file1.ts` - <what changes>
- `file2.ts` - <what changes>

## Files to Create
- `newfile.ts` - <purpose>

## Files/Objects to Reuse
- `existing.ts` - `functionName()` - <how to use>

## Notes
- <Technical considerations>
- <Edge cases>
- <Performance notes>
```

### A6. Sync Plan to Issue

**For GitHub:**

First, fetch the current issue body:
```bash
gh issue view <number> --json body -q .body
```

Then update the issue body with the plan appended:
```bash
gh issue edit <number> --body "$(cat <<'EOF'
<original-issue-body>

---

## 🎯 Implementation Plan

_Generated at $(date -u +%Y-%m-%dT%H:%M:%SZ)_

<plan content>
EOF
)"
```

**Important**:
- If the issue body already contains an "Implementation Plan" section, replace only that section
- Otherwise, append the plan to the end of the issue body
- Preserve all original content before the Implementation Plan section

**For Linear:**

Use MCP tool to update issue description:
```
mcp__linear-server__update_issue(
  id: "ABC-123",
  description: "<original-description>\n\n---\n\n## 🎯 Implementation Plan\n\n_Generated at $(date -u +%Y-%m-%dT%H:%M:%SZ)_\n\n<plan content>"
)
```

**Important**:
- If the description already contains an "Implementation Plan" section, replace only that section
- Otherwise, append the plan to the end of the description
- Preserve all original content before the Implementation Plan section

### A7. Show Summary

Display the result with the issue URL:

```
✓ Implementation plan synced to <platform> issue
📎 View: <issue-url>

Ready to start coding!
```

---

## Flow B: Offline Issue

### B1. Read Issue File

Read the issue file:
```markdown
---
title: Add dark mode toggle
source: local
provider: local
status: initialized
...
---

# Spec

<user's requirements>

<!-- Implementation Plan will be added by /ctx.work.plan -->
```

Extract:
- **Frontmatter**: Issue metadata
- **Spec**: User's requirements
- **Existing Plan**: Check if plan already exists

### B2. Check Existing Plan

If plan already exists:
```
⚠️ Implementation plan already exists. Override? (y/n)
```

If user says no, exit.

### B3. Parse Additional Requirements

Same as Flow A step A2.

### B4. Load Relevant Contexts

Same as Flow A step A3.

### B5. Q&A Session

Same as Flow A step A4.

### B6. Generate Implementation Plan

Same as Flow A step A5.

### B7. Save Plan to File

Generate current timestamp in ISO 8601 format using Bash:
```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```

**If no existing plan**: Append to file:
```markdown
---

# Implementation Plan

_Generated at <current-timestamp>_

<plan content>
```

**If overriding**: Replace existing plan section:
```markdown
# Implementation Plan

_Generated at <original-timestamp>_
_Last updated at <current-timestamp>_

<plan content>
```

### B8. Update Frontmatter

Update issue file frontmatter with current timestamp:
```yaml
---
status: in_progress  # changed from 'initialized'
updated_at: <current-timestamp>
---
```

Use Edit tool to update the frontmatter while preserving other fields.

### B9. Show Summary

```
✓ Implementation plan added to <filename> 
📎 Commit this file to share with team

Ready to start coding!
```

---

# Error Handling

- **No `.ctx.current`**:
  ```
  ❌ Error: No active issue
  Run /ctx.work.init first to initialize an issue
  ```
- **GitHub CLI not available**: Show installation instructions
- **Linear MCP not available**: Show MCP setup instructions
- **File not found** (offline): Issue file was deleted or moved
- **Invalid frontmatter**: Issue file format is incorrect

---

# Important Guidelines

## What to Ask (Implementation)
✓ Which files will change?
✓ What patterns/architecture to use?
✓ What existing code to reuse?
✓ What are the technical challenges?
✓ Will you write tests?

## What NOT to Ask (Spec)
❌ What should this feature do?
❌ What are the requirements?
❌ What problem are we solving?
❌ Who are the users?

**Reason**: The user has already written the spec. We're only planning HOW to implement it, not WHAT to implement.

## Plan Quality
- **Actionable**: Each step should be clear and concrete
- **Phased**: Group related tasks into logical phases
- **Detailed**: Include file names, function names, key decisions
- **Testable**: Include testing strategy
- **Realistic**: Consider edge cases and technical constraints

## Context Loading
- Extract key technical terms from Spec (e.g., "authentication", "React", "API")
- Load relevant contexts before planning
- This ensures plan is grounded in actual codebase

---

# Examples

## Bad Q&A Examples (Don't Do This)

❌ **Asking about spec requirements:**
```markdown
Q: What should the dark mode feature do?
Q: Should we support system preference detection?
```
→ These are WHAT questions. The spec should already answer these.

❌ **Asking questions you can answer yourself:**
```markdown
Q: What files will be modified?
Q: What are the main interfaces needed?
```
→ You can determine these by analyzing the codebase.

❌ **Generic/vague questions:**
```markdown
Q: Should we write tests?
Q: Is this a good approach?
```
→ Be specific. What kind of tests? Good compared to what alternative?
