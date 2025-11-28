---
description: Save context (create or update) - unified command for local and global contexts
argument-hint: [path] [description]
---

You are assisting with saving context documentation using a unified interface.

# Arguments

**$ARGUMENTS**: Path (optional) and description

Examples:
- `src/services/payment.ctx.md Add webhook handling` (local context-path)
- `{{global.directory}}/rules/api.md Add REST versioning guidelines` (global context-path)
- `src/services/payment.ts Document payment processing` (target-path)
- `Document the auth flow` (description-only, semantic mode)

# Your Task

Save context based on the provided arguments, automatically detecting scope (local/global) and mode (create/update).

# Workflow

## Step 1: Parse Arguments

**Parse $ARGUMENTS to determine type:**

```
First token analysis:
1. Ends with `.ctx.md` → context-path (local if not in {{global.directory}}/, global if in {{global.directory}}/)
2. Starts with `{{global.directory}}/` and ends with `.md` → context-path (global)
3. Matches code file extension (*.ts, *.js, *.py, *.go, *.rs, *.java, *.tsx, *.jsx) → target-path
4. None of above → description-only (semantic mode)
```

### Parsing Results:

**Context-path detected:**
- Extract: contextPath, scope (local/global), description (remaining text)
- Proceed to Step 2

**Target-path detected:**
- Extract: targetPath, scope = 'local', description (remaining text)
- Proceed to Step 2 (will lookup registry for context path)

**Description-only detected:**
- Extract: description = entire $ARGUMENTS
- Proceed to Semantic Mode (Step 2b)

---

## Step 2: Validate & Prepare

### For context-path or target-path:

**Run validation based on scope:**

```bash
# For local scope
ctx validate --local

# For global scope
ctx validate --global
```

### Handle Validation Results

**If errors found:**
```markdown
❌ Validation errors found

[Show error details with affected files]

Please fix these errors manually before proceeding:
1. [Specific fix instruction for error 1]
2. [Specific fix instruction for error 2]

After fixing, run this command again.
```
**STOP - Do not proceed with any further steps.**

**If warnings only:**
- Show warnings briefly
- Proceed to next step immediately (warnings are non-blocking)

**If no errors or warnings:**
- Briefly confirm validation passed
- Proceed to next step

---

### For target-path: Resolve Context Path

1. **Search for target in registry**:
   ```bash
   ctx status --target [targetPath]
   ```

2. **Parse JSON response**:
   - If `found: true` → use `contextPath` from response
   - If `found: false` → no existing context

3. **If not found in registry**:
   ```markdown
   ⚠️ No existing context found for: [targetPath]
   ```
   - Infer context path: `payment.ts` → `payment.ctx.md` (same directory)
   - Inform user: "Creating new context at: [inferred-path]"

4. **Verify target file exists**:
   - If target file doesn't exist:
     ```markdown
     {{snippet:errors#target-not-found}}
     ```
     **STOP**

---

## Step 2b: Semantic Mode (description-only)

When no path is provided, use semantic analysis:

1. **Analyze conversation context**:
   - What files were recently discussed/edited?
   - What was the user working on?

2. **Get current context status**:
   ```bash
   ctx status
   ```
   - Parse JSON response to see existing local/global contexts
   - Use this to suggest relevant options to the user

3. **Present options using AskUserQuestion**:
   ```markdown
   ## Context Save Options

   Based on your request: "[description]"

   I found these options:

   1. **Update existing**: [existing-context-path] - [brief description]
   2. **Create new local context** for: [suggested-target-file]
   3. **Create new global context** at: {{global.directory}}/[suggested-path].md

   Which option would you like?
   ```

4. **Based on user selection**:
   - Update existing → Proceed to Step 3 with that context path
   - New local → Ask for target file if not clear, then proceed
   - New global → Proceed to Step 3 with global path

---

## Step 3: Determine Mode

**Check if context file exists:**

1. **Check existence** of context file path

2. **Determine operation mode**:
   - **Context file EXISTS** → UPDATE mode
   - **Context file NOT EXISTS** → CREATE mode

3. **Inform user of mode**:
   ```markdown
   [Creating new/Updating existing] [local/global] context: `[context-path]`
   ```

---

## Step 4: Generate Content

### Common: Read Source File (if applicable)

**For local context:**
- Read the target file to understand what needs to be documented
- Analyze: purpose, exports, dependencies, usage patterns

**For global context:**
- Read existing related documents for consistency
- Understand existing patterns and conventions

### Check Frontmatter Requirements

Read `ctx.config.yaml` to check frontmatter settings:
- `frontmatter.local` for local contexts
- `frontmatter.global` for global contexts

Apply frontmatter according to config (required/optional/none).

### For CREATE Mode

Generate complete context based on:
- User-provided description
- Code analysis (for local)
- Template structure

**Present draft for approval (diff format):**

```markdown
## 📝 Creating: `[context-path]`

```diff
+ ---
+ target: /[target-path]
+ what: [Brief description]
+ when:
+   - [Usage scenario 1]
+   - [Usage scenario 2]
+ not_when:
+   - [When not to use]
+ ---
+
+ # [Title]
+
+ [Content...]
```

Proceed with this content?
```

### For UPDATE Mode

1. **Read existing context file**

2. **Analyze what needs updating**:
   - Based on user description
   - Based on code changes (if local, try git diff)

3. **Generate update proposal (diff format):**

```markdown
## 🔄 Updating: `[context-path]`

```diff
  ---
  target: /[target-path]
- what: [Old description]
+ what: [New description]
  when:
    - [Existing scenario]
+   - [New scenario]
  ---
```

Proceed with this update?
```

**Wait for user approval before proceeding to write.**

---

## Step 5: Save & Sync

### Write the File

**For CREATE:**
- Use Write tool to create the context file
- Include all content (frontmatter + body)
- Ensure proper Markdown formatting
- For local contexts: ensure `target` path is absolute (starts with `/`)

**For UPDATE:**
- Use Edit tool to update the existing context file
- Apply approved changes
- Preserve existing formatting

### MANDATORY: Sync Registry

**Run sync command based on scope:**

```bash
# For local scope
ctx sync --local

# For global scope
ctx sync --global
```

### Handle Sync Results

**If sync succeeds:**
```markdown
✓ [Created/Updated] [context-path]
✓ Synced [local/global] context registry

Summary:
• [For local: Target: /target-path]
• Context: [context-path]
• [Brief description of changes]
```

**If sync fails:**
```markdown
⚠️ Context file written but sync failed

✓ File [created/updated]: [context-path]
❌ Sync error: [error message]

Next steps:
1. Check the error message above
2. Verify file syntax
3. Run: ctx sync --[local/global]
```

---

# Error Handling

{{snippet:errors#target-not-found}}

{{snippet:errors#context-already-exists}}

{{snippet:errors#invalid-context-path}}

{{snippet:errors#registry-lookup-failed}}

---

# Path Type Reference

| Input Pattern | Type | Scope | Action |
|---------------|------|-------|--------|
| `*.ctx.md` (not in {{global.directory}}/) | context-path | local | Direct file handling |
| `{{global.directory}}/**/*.md` | context-path | global | Direct file handling |
| `*.ts`, `*.js`, `*.py`, etc. | target-path | local | Registry lookup → context |
| Other text | description-only | semantic | AI analysis → suggest options |

---

# Important Rules

1. **Parse accurately** - Correct type detection is critical for proper workflow

2. **Always validate first** - Run validation before any modifications

3. **Target must exist** - Cannot create local context for non-existent target file

4. **Registry lookup for targets** - Always check registry before inferring context path

5. **Diff format for confirmation** - Show changes in diff format for clear visibility

6. **User approval required** - Always present content and wait for approval before writing

7. **MANDATORY sync** - Always sync after write, handle failures gracefully

8. **Scope detection** - Correctly identify local vs global based on path patterns

---

# Example Interactions

## Example 1: Context-path (local)

**User:** `/ctx.save src/services/payment.ctx.md Add webhook handling`

**AI:**
```markdown
[Runs: ctx validate --local]
✓ Validation passed

Updating existing local context: `src/services/payment.ctx.md`

[Reads src/services/payment.ctx.md]
[Reads src/services/payment.ts for context]

## 🔄 Updating: `src/services/payment.ctx.md`

```diff
  ---
  target: /src/services/payment.ts
- what: Stripe payment processing service
+ what: Stripe payment processing and webhook handling service
  when:
    - Processing customer payments
    - Managing subscriptions
+   - Handling Stripe webhook events
  ---
```

Proceed with this update?
```

**User:** `yes`

**AI:**
```markdown
[Updates src/services/payment.ctx.md]
[Runs: ctx sync --local]

✓ Updated src/services/payment.ctx.md
✓ Synced local context registry

Summary:
• Target: /src/services/payment.ts
• Context: src/services/payment.ctx.md
• Added webhook handling documentation
```

---

## Example 2: Context-path (global)

**User:** `/ctx.save {{global.directory}}/rules/typescript.md Use union types instead of enums`

**AI:**
```markdown
[Runs: ctx validate --global]
✓ Validation passed

Creating new global context: `{{global.directory}}/rules/typescript.md`

## 📝 Creating: `{{global.directory}}/rules/typescript.md`

```diff
+ ---
+ what: TypeScript coding guidelines for union types
+ when:
+   - Defining type alternatives
+   - Creating status or state types
+ not_when:
+   - Interop with libraries requiring enums
+ ---
+
+ # TypeScript Guidelines
+
+ ## Prefer Union Types Over Enums
+
+ Use union types for better type safety:
+
+ ```typescript
+ // ✅ Prefer
+ type Status = 'active' | 'inactive';
+
+ // ❌ Avoid
+ enum Status { Active, Inactive }
+ ```
```

Proceed with this content?
```

---

## Example 3: Target-path

**User:** `/ctx.save src/services/payment.ts Document webhook processing`

**AI:**
```markdown
[Runs: ctx validate --local]
✓ Validation passed

[Runs: ctx status --target src/services/payment.ts]
→ {"found": true, "contextPath": "src/services/payment.ctx.md", ...}

Updating existing local context: `src/services/payment.ctx.md`

[Reads src/services/payment.ctx.md]
[Reads src/services/payment.ts]

## 🔄 Updating: `src/services/payment.ctx.md`

```diff
  ---
  target: /src/services/payment.ts
  what: Stripe payment processing service
  when:
    - Processing customer payments
+   - Processing Stripe webhooks
  ---

  # Payment Service
  ...
+ ## Webhook Processing
+
+ Handles incoming Stripe webhook events...
```

Proceed with this update?
```

---

## Example 4: Description only (semantic mode)

**User:** `/ctx.save Document the authentication flow`

**AI:**
```markdown
## Context Save Options

Based on your request: "Document the authentication flow"

I found these options:

1. **Update existing**: src/services/auth.ctx.md - Authentication service context
2. **Create new local context** for: src/middleware/auth.ts
3. **Create new global context** at: {{global.directory}}/architecture/authentication.md

Which option would you like?
```

**User:** `3`

**AI:**
```markdown
[Runs: ctx validate --global]
✓ Validation passed

Creating new global context: `{{global.directory}}/architecture/authentication.md`

## 📝 Creating: `{{global.directory}}/architecture/authentication.md`

```diff
+ ---
+ what: Authentication flow architecture and design decisions
+ when:
+   - Implementing new auth features
+   - Understanding login/logout flow
+   - Debugging auth issues
+ ---
+
+ # Authentication Architecture
+
+ ## Overview
+
+ [Based on conversation context and codebase analysis...]
```

Proceed with this content?
```

---

## Example 5: Target not found error

**User:** `/ctx.save src/services/nonexistent.ts Add documentation`

**AI:**
```markdown
[Runs: ctx validate --local]
✓ Validation passed

{{snippet:errors#target-not-found}}
```

---

## Example 6: New local context from target

**User:** `/ctx.save src/utils/validator.ts Input validation utilities`

**AI:**
```markdown
[Runs: ctx validate --local]
✓ Validation passed

[Runs: ctx status --target src/utils/validator.ts]
→ {"found": false, "target": "src/utils/validator.ts", "contextPath": null}

⚠️ No existing context found for: src/utils/validator.ts
Creating new context at: src/utils/validator.ctx.md

[Reads src/utils/validator.ts]

## 📝 Creating: `src/utils/validator.ctx.md`

```diff
+ ---
+ target: /src/utils/validator.ts
+ what: Input validation utilities for forms and APIs
+ when:
+   - Validating user form inputs
+   - Sanitizing API request data
+   - Checking data integrity
+ not_when:
+   - Type checking (use TypeScript)
+   - Business logic validation
+ ---
+
+ # Validation Utilities
+
+ Provides reusable validation functions for user input...
```

Proceed with this content?
```
