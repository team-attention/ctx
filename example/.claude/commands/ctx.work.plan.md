---
description: Create a planning document from an issue URL
argument-hint: <url> [requirements] [--no-ask]
allowed-tools: [Read, Write, Edit, TodoWrite, Bash, WebFetch, Glob, Grep, SlashCommand, mcp__linear-server__get_issue, mcp__linear-server__list_comments, mcp__github__*]
---

# Task
Create a comprehensive planning document based on the issue at: **$ARGUMENTS**

This command will:
1. Create a todo list to track progress
2. Fetch issue details (including comments, images, attachments) from the provided URL
3. Check if spec or implementation plan already exist in the issue
4. Create a local `plan.md` file for tracking
5. Create or validate the **Spec** (WHY and WHAT - business requirements)
6. Load relevant contexts based on the spec
7. Generate a **Implementation Plan** (HOW - technical execution)
8. Provide a final summary

**Note**: `plan.md` is a local artifact for your own tracking. It is gitignored and serves as your workspace.

---

# Execution Algorithm

## Step 0: Create Todo List

**Create a todo list** to track progress through all steps.

Use TodoWrite to create todos for:
1. Get git branch and parse arguments
2. Fetch issue from URL (enhanced with comments/images)
3. Check existing spec/implementation plan in issue
4. Create plan.md template
5. Create or validate Spec _(skip questions if `--no-ask` flag is present)_
6. Load relevant contexts (based on spec)
7. Generate implementation plan _(auto-generate if `--no-ask` flag is present)_
8. Show final summary

**Note**: Adjust todo list based on flags:
- If `--no-ask`: Auto-generate spec and implementation plan without user interaction

**Mark each todo as completed** as you finish each step.

---

## Step 1: Get Current Git Branch

```bash
git branch --show-current
```

**Store the branch name** for inclusion in frontmatter.

If not in a git repository → Use `"not-in-git-repo"` as branch name.

---

## Step 2: Parse Arguments

Extract from `$ARGUMENTS`:
- **URL** (required): First argument (e.g., `https://github.com/user/repo/issues/123`)
- **Requirements** (optional): Text after URL (but before flags)
- **Flags** (optional):
  - `--no-ask`: Auto-generate spec and implementation plan without asking questions

**Parsing Logic:**
1. Extract URL (first argument that starts with `http://` or `https://`)
2. Extract flags (arguments starting with `--`)
3. Extract requirements (remaining text between URL and flags)

**Validation:**
- If no URL provided → Show error: "Error: URL is required. Usage: /ctx.work.plan <url> [requirements] [--no-ask]"
- If URL is invalid → Show error: "Error: Invalid URL format"
- If unknown flag provided → Show warning: "Warning: Unknown flag '<flag>' will be ignored"

**Store for later use:**
- `use_interactive_mode = !has_flag("--no-ask")`

---

## Step 3: Enhanced Issue Fetching

### GitHub URLs
If URL contains `github.com`:

```bash
# Extract issue number from URL
gh issue view <issue-number> --repo <owner/repo> --json title,body,labels,assignees,comments,milestone
```

**Parse the response to extract:**
- Issue title
- Issue description/body (with markdown formatting)
- Issue metadata (labels, assignees, milestone)
- **All comments** (may contain existing spec or implementation plan)
- **Images/attachments** referenced in body (analyze with Read tool if image URLs are present)

**Alternative**: Use GitHub MCP if available.

### Linear URLs
If URL contains `linear.app`:

```typescript
// Extract issue ID from URL (e.g., ABC-123)
mcp__linear-server__get_issue({ id: "<issue-id>" })

// Also fetch comments separately
mcp__linear-server__list_comments({ issueId: "<issue-id>" })
```

**Parse the response to extract:**
- Issue title
- Issue description/body (with markdown formatting)
- **All comments** 
- **Attachments** (returned by get_issue)

### Generic URLs
For all other URLs:

```typescript
WebFetch({
  url: "<url>",
  prompt: "Extract the main content, title, description, and any structured information from this page. Include any images or attachments mentioned."
})
```

**Store all fetched data:**
- Issue title
- Issue description/body
- Issue metadata (labels, assignees, etc.)
- **Comments array** (all comments from issue)
- **Images/attachments** (URLs or content)
- **Related links** (mentioned in description or comments)

---

## Step 4: Check Existing Spec/Plan in Issue

**Goal**: Determine if spec or implementation plan already exist in the issue to avoid duplicate work.

**Search through:**
- Issue description/body
- All comments from Step 3

**Look for these sections:**
1. **Spec indicators**: Sections titled "Spec", "Specification", "Requirements", "Problem Statement", "User Stories", or similar
2. **Implementation plan indicators**: Sections titled "Implementation Plan", "Technical Plan", "Phases", or checkboxes with implementation tasks

**Decision tree:**

| Found in Issue | Action | Store |
|---|---|---|
| **Both exist** | Ask: 1) Start fresh 2) Skip 3) Cancel | 1: `need_spec=true, need_plan=true` / 2: Exit / 3: Exit |
| **Spec only** | Ask: Continue to create plan? [y/n] | y: `need_spec=false, need_plan=true` / n: Exit |
| **Plan only** | Ask: 1) Create spec first 2) Skip to plan 3) Cancel | 1: `need_spec=true, need_plan=false` / 2: `need_spec=false, need_plan=true` / 3: Exit |
| **Neither** | Ask: Create both? [y/n] | y: `need_spec=true, need_plan=true` / n: Exit |

**If `--no-ask` flag**: Always proceed with `need_spec=true, need_plan=true` without asking.

---

## Step 5: Create plan.md with Template

**Write to**: `plan.md`

**Simplified Template:**

```markdown
---
issue_link: <URL>
git_branch: <branch-name>
created_at: <ISO-timestamp>
---

# Spec

<!-- Will be filled in next step -->

# Implementation Plan

<!-- Will be filled after contexts are loaded -->

---

**Note**: This is a local workspace file (gitignored).
The spec and implementation plan are the core outputs.
```

✓ Created plan.md

---

## Step 6: Create or Validate Spec

**Goal**: Create spec focusing on WHY and WHAT, not HOW.

**Check from Step 4**: If `need_spec = false`, skip to Step 7.

---

### If `--no-ask` flag:
Auto-generate spec from issue content (description, comments, images). Add note: "_Auto-generated. Review and refine as needed._"

---

### If interactive mode:

**Step 6.1: Generate draft spec (core sections)**

Analyze issue and generate: Problem Statement, User Stories/Use Cases, Success Criteria.

**Step 6.2: Review core spec with user**

1. **First, output the generated spec to the user** (DO NOT use AskUserQuestion yet):

```markdown
I've drafted a spec based on the issue:

---

## Problem Statement
[Generated content]

## User Stories / Use Cases
[Generated content]

## Success Criteria
[Generated content]

---
```

2. **Then, use AskUserQuestion tool** to get feedback:

```
Does this spec look correct?

Options:
- 'yes' to proceed
- 'skip' to use as-is and move forward
- Provide corrections directly (e.g., "change success criteria to X, add user story Y")
```

**Handle response:**
- `yes` → Proceed to Step 6.3
- `skip` → Proceed to Step 6.3, add note "_User skipped review_"
- Corrections → Apply changes, **output updated spec to user**, ask for confirmation again

**Step 6.3: Ask about detailed sections**

**Use AskUserQuestion tool**:

```
Would you like to add more detailed sections to the spec?
- Scope (in-scope and out-of-scope)
- Constraints (technical/business/timeline limits)
- Dependencies (prerequisites, external systems)
- Context & References

Reply 'yes' to add these sections, or 'no' to skip.
```

**If yes:**
1. Generate detailed sections (Scope, Constraints, Dependencies, Context & References)
2. **Output the detailed sections to user** (show the generated content)
3. **Then use AskUserQuestion tool** for review (same yes/skip/corrections flow as Step 6.2)
4. If corrections needed: Apply changes, **output updated sections**, ask for confirmation again

**If no:**
- Proceed with core spec only

---

### Spec Template

```markdown
# Spec

## Problem Statement
[Why, who's affected, pain point]

## User Stories / Use Cases
[As a X, I want Y so that Z]

## Success Criteria
- [ ] Measurable outcome 1
- [ ] Measurable outcome 2

## Scope
### In Scope
- [What will be done]

### Out of Scope
- [What won't be done]

## Constraints
[Technical/business/timeline limits]
```

Generate spec and update `plan.md`. ✓ Spec created

---

## Step 7: Load Relevant Contexts

**Goal**: Load contexts that will inform the implementation plan, now that we have a clear spec.

**Create search description from:**
- **Spec content** (problem statement, scope, requirements)
- Issue title
- Issue labels/tags
- Optional requirements argument from Step 2
- Key technical terms from description

**Run:** `/ctx.load <search-description-from-spec>`

✓ Loaded contexts

---

## Step 8: Generate Implementation Plan

**Goal**: Create a high-level, phase-based implementation plan that focuses on HOW to implement the spec.

**Check from Step 4**: If `need_plan = false`, skip to Step 9.

---

### Plan Generation Approach

**Use the following inputs:**
1. **Spec from Step 6** (WHY and WHAT - requirements, scope, success criteria)
2. **Loaded contexts from Step 7** (existing patterns, code structures, utilities)
3. Issue metadata (labels, constraints)
4. Optional requirements argument

---

### If `--no-ask` flag is present:

**Auto-generate implementation plan** without user interaction:

1. Analyze spec requirements
2. Reference loaded contexts for patterns
3. Generate phase-based plan
4. Add note: "_Auto-generated from spec and contexts. Review and refine as needed._"

ℹ Auto-generated plan (--no-ask mode)

---

### If `--no-ask` flag is NOT present:

**Interactive Planning Process** - Clarify scope and reusable components:

1. **Review loaded contexts** (from Step 7) - Identify reusable code:
   - Existing utilities, functions, or patterns that can be reused
   - Similar implementations in the codebase
   - Shared components or libraries

2. **Use AskUserQuestion tool** to clarify scope:
   - **In-scope questions**: "Should we include [feature X] in this implementation?"
   - **Out-of-scope questions**: "Should we defer [feature Y] to a future iteration?"
   - **Reusability questions**: "I found [utility Z] in the codebase. Should we reuse it or implement a new approach?"
   - **Technical approach questions**: "Approach A vs Approach B - which aligns better with project goals?"
   - **Refactoring questions**: "Should we refactor [existing code] or work around it?"

3. **Define clear boundaries**:
   - ✅ **In-scope**: What WILL be implemented in this task
   - ❌ **Out-of-scope**: What will NOT be implemented (and why - future work, out of bounds, etc.)
   - ♻️ **Reusable**: What existing code/patterns will be leveraged

4. **Generate implementation plan** with clarified scope and reusable components

---

### Implementation Plan Template

```markdown
# Implementation Plan

## Overview
[Brief technical approach - reference spec sections and loaded contexts]

## Scope Definition

### ✅ In-Scope (What we WILL implement)
- [Feature/component to implement]
- [Another feature to implement]

### ❌ Out-of-Scope (What we will NOT implement)
- [Feature to defer] - Reason: [future iteration/separate task]
- [Feature to exclude] - Reason: [out of bounds/not required]

### ♻️ Reusable Components
- **`path/to/utility.ts`** - `functionName()` - [How we'll reuse it]
- **`path/to/pattern.ts`** - [Existing pattern to follow]

## Phase 1: <Phase-Name>
### Step 1: <Step-Name>
- [ ] <High-level task>

## Phase N: Testing & Validation
### Write Tests
- [ ] Unit/integration/E2E tests

### Validate Success Criteria
- [ ] [Reference spec success criteria]

## Technical Details
- **Files to Modify**: `path/to/file.ts` - description
- **Files to Reuse**: `path/to/utility.ts` - `functionName`
- **New Files**: `path/to/new-file.ts` - purpose

## Notes
[Patterns from contexts, constraints from spec, dependencies]
```

### Plan Generation Rules

1. **Reference the spec** - Link back to spec sections (scope, success criteria, constraints)
2. **High-level only** - No detailed code implementation steps
3. **Phase-based** - Group related steps into logical phases (2-5 steps per phase)
4. **Checkbox format** - Each task should be actionable
5. **Always include testing phase** - Reference success criteria from spec
6. **Use loaded contexts** - Reference patterns, utilities, and structures from context files
7. **Map to success criteria** - Ensure plan addresses all success criteria from spec

Update `plan.md` with generated implementation plan.

✓ Implementation plan created

---

## Step 9: Final Summary

Show summary with:
- Issue title, link, branch
- Outputs: Spec (WHY/WHAT) and Implementation Plan (HOW) in `plan.md`
- Loaded contexts
- Next steps: Review, adjust, implement, validate against success criteria

Note: `plan.md` is local (gitignored) workspace.

---

# Rules

1. **Create todos first** - Track progress with TodoWrite
2. **Get git branch** - Include in plan.md frontmatter
3. **Validate URL** - Required and must be valid format
4. **Enhanced fetching** - Fetch comments, images, attachments from issue
5. **Check existing content** - Search for existing spec/plan, ask user before overwriting (unless `--no-ask`)
6. **Spec first** - Create/validate spec (WHY/WHAT) before loading contexts
7. **Load contexts from spec** - Use spec content to inform context search
8. **Minimal adaptive questions** - Only ask for info NOT in issue
9. **Spec ≠ code** - Spec is WHY/WHAT, plan is HOW
10. **High-level only** - Phases and steps, not detailed implementation
11. **Plan.md is local** - Gitignored workspace, not synced to issue
12. **--no-ask flag** - Auto-generate spec and plan without questions

---

# Reference

- Local registry: `ctx/local-context-registry.yml`
- Global registry: `ctx/global-context-registry.yml`
- Plan file: `plan.md` (gitignored)
- Keep contexts updated: `/ctx.sync`
- Validate contexts: `/ctx.validate`
- Load contexts: `/ctx.load <description>`
