---
description: Save context (create or update) - unified command for local and global contexts
argument-hint: [path] [description]
---

## Runtime Config Resolution

Before executing this command, read `ctx.config.yaml` from the project root to resolve configuration variables.

**Config Variables Used:**
| Variable | Config Path | Default |
|----------|-------------|---------|
| `{{global.directory}}` | `global.directory` | `ctx` |
| `{{work.directory}}` | `work.directory` | `.worktrees` |
| `{{work.issue_store.type}}` | `work.issue_store.type` | `local` |
| `{{work.issue_store.url}}` | `work.issue_store.url` | - |
| `{{work.issue_store.project}}` | `work.issue_store.project` | - |

**How to resolve:**
1. Read `ctx.config.yaml` using the Read tool
2. Parse YAML content
3. Replace `{{variable}}` placeholders with actual config values
4. Use defaults if config values are not set


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

## Step 2: Check & Prepare

### 1. Resolve Path (if needed)

**If input is `target-path`:**

1. **Search for target in registry**:
   ```bash
   ctx status --target [targetPath]
   ```

2. **Parse JSON response**:
   - If `found: true` → use `contextPath` from response
   - If `found: false` → no existing context, will create new (determine expected path)

3. **Verify target file exists**:
   - If target file doesn't exist:
     ```markdown
     ```
❌ Error: Target file not found: [path]
Cannot create context for non-existent file
```
     ```
     **STOP**

**If input is `context-path`:**
- Use provided path directly.

---

### 2. Run Check

**Run check for contexts:**

```bash
ctx check
```

This verifies the registry is in sync with filesystem.

### 3. Handle Check Results

**If errors found for THIS context:**
```
Show error details and STOP.
```

**If this context is stale or fresh:**
- Proceed to next step

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

3. **Present options to the user**:
   - Update existing context
   - Create new local context for a specific file
   - Create new global context

4. **Based on user selection**, proceed to Step 3

---

## Step 3: Determine Mode & Execute

**Check if context file exists:**

### CREATE Mode (context file does NOT exist)

**Use `ctx create` to generate the context file from the project's template:**

```bash
# For local context
ctx create [target-path] --force

# For global context
ctx create --global [topic-name] --force
```

This creates a properly structured context file using the project's configured templates. The template structure may vary based on user customization.

**Then:**

1. Read the newly created context file to see its actual structure
2. Read the target file (for local) to understand what needs to be documented
3. Analyze the code: purpose, exports, dependencies, usage patterns
4. Use Edit tool to replace placeholder values with actual content

**Present the proposed changes in diff format and wait for user approval.**

### UPDATE Mode (context file EXISTS)

1. **Read existing context file**

2. **Analyze what needs updating**:
   - Based on user description
   - Based on code changes (if local, try git diff)

3. **Generate update proposal in diff format**

4. **Wait for user approval before applying changes**

---

## Step 4: Apply Changes & Sync

### Apply Approved Changes

- Use Edit tool to update the context file
- Preserve the existing structure from the template

### MANDATORY: Sync Registry

**Run sync command based on scope:**

```bash
# For local scope
ctx sync --local

# For global scope
ctx sync --global
```

### Handle Results

**Success:**
```
✓ [Created/Updated] [context-path]
✓ Synced [local/global] context registry
```

**Sync failed:**
```
⚠️ Context file written but sync failed
[Show error and next steps]
```

---

# Error Handling

```
❌ Error: Target file not found: [path]
Cannot create context for non-existent file
```

```
⚠️ Context already exists: [path]
Use UPDATE mode or specify a different path
```

```
❌ Error: Invalid context path format
Expected: *.ctx.md (local) or {{global.directory}}/**/*.md (global)
```

```
⚠️ Warning: Could not find context in registry for target: [path]
Creating new context file
```

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

1. **Use `ctx create` for new contexts** - Never hardcode context structure; always use the CLI to generate from templates

2. **Read the created file** - After `ctx create`, read the file to see the actual template structure (may be customized by user)

3. **Parse accurately** - Correct type detection is critical for proper workflow

4. **Always check first** - Run check before any modifications

5. **Target must exist** - Cannot create local context for non-existent target file

6. **User approval required** - Always present changes in diff format and wait for approval

7. **MANDATORY sync** - Always sync after write, handle failures gracefully
