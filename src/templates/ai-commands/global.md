---
description: Create or update global context documentation
argument-hint: [path] [intent]
---

You are assisting with managing global context documentation.

# Arguments

**$ARGUMENTS**: Path (optional) and intent

- **Path**: relative or absolute path (`./`, `../`, `/`)
- **Intent**: Natural language description of what to create/update

Examples:
- `{{global.directory}}/rules/api.md Add REST versioning guidelines`
- `./architecture/caching.md Document Redis strategy`
- `Add TypeScript enum alternatives to coding rules`

# Your Task

Create or update global context documentation with validation and smart conflict detection.

# Workflow

## Step 1: Validate First

**ALWAYS start by running validation:**

```bash
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
- Show warnings to user
- Inform that these are non-blocking
- Proceed to next step

**If no errors or warnings:**
- Briefly confirm validation passed
- Proceed to next step

---

## Step 2: Parse Arguments

**Extract path and intent from $ARGUMENTS:**

1. **Detect path format:**
   - IF $ARGUMENTS starts with `{{global.directory}}/` OR `./` OR `../`:
     - path = first token (everything before first space)
     - intent = remaining text (everything after first space)
   - ELSE:
     - path = null
     - intent = entire $ARGUMENTS

2. **Validate path format (if path provided):**
   - Path MUST start with `{{global.directory}}/`, `./`, or `../`
   - If not → Show error and STOP:
     ```markdown
     ❌ Invalid path format: `[invalid-path]`

     Path must include:
     - `{{global.directory}}/` prefix (e.g., `{{global.directory}}/rules/api.md`)
     - OR relative path (e.g., `./rules/api.md` or `../{{global.directory}}/rules/api.md`)

     Examples:
     ✅ {{global.directory}}/rules/api.md
     ✅ ./rules/api.md
     ✅ ../{{global.directory}}/rules/api.md
     ❌ rules/api.md (missing prefix)
     ```

---

## Step 3: Determine Target

### If path provided:

1. **Check file existence:**
   - File exists → UPDATE mode
   - File does not exist → CREATE mode

2. **Search for similar documents** (duplicate detection):
   - Search registry for semantically similar docs
   - Match against: paths, ai_comments, categories
   - Consider: similar naming, related topics

3. **Warn if duplicates found:**
   ```markdown
   ⚠️ Similar documents already exist:

   • [doc-path-1] - [ai_comment or description]
   • [doc-path-2] - [ai_comment or description]

   Continue creating/updating `[target-path]`?
   ```
   - Use **AskUserQuestion** tool for confirmation
   - If user says no → Ask which existing doc to update instead
   - If user says yes → Proceed to Generate Content

4. **If no duplicates:**
   - Proceed directly to Generate Content

### If intent only (no path):

1. **Search registry semantically:**
   - Search entire intent in: file paths, ai_comments, categories
   - Find all potentially relevant documents

2. **Handle search results:**

   **IF exactly 1 match:**
   ```markdown
   Found: [doc-path] - [ai_comment]

   I'll update this document with: "[intent]"
   ```
   - Auto-select and proceed to Generate Content

   **IF multiple matches:**
   ```markdown
   ## Found related documents for: "[intent]"

   1. [path-1] - [ai_comment-1]
   2. [path-2] - [ai_comment-2]
   ...

   Which document should I work on? (enter number or 'new' for new document)
   ```
   - Use **AskUserQuestion** tool
   - Based on response:
     - Number → Select that document → Generate Content
     - 'new' → Proceed to "no matches" flow below

   **IF no matches:**
   ```markdown
   No related documents found.

   Based on your request, I suggest creating:
   **{{global.directory}}/[suggested-path]**

   Create at this path? (yes / or provide custom path)
   ```
   - Use **AskUserQuestion** tool
   - Generate suggested path from intent semantics
   - If custom path provided → validate format → use it
   - Proceed to Generate Content

---

## Step 4: Generate Content

### Determine if content is sufficient:

**If intent has substantial content:**
- Proceed to generate document immediately
- For CREATE: Generate new document from intent
- For UPDATE: Read existing doc, merge/apply changes from intent

**If intent is empty or too vague:**
- Use **AskUserQuestion** tool:
  - CREATE: "What should this document contain?"
  - UPDATE: "What would you like to change in this document?"
- Wait for user response
- Generate based on detailed response

### Generate and present:

**Generate the content:**
- For CREATE: Write complete new document
- For UPDATE: Read existing, create updated version showing changes

**Check frontmatter requirements:**
- Read `ctx.config.yaml` to check global frontmatter settings
- Apply frontmatter according to config (required/optional/none)
- If required: Include `when`, `what`, `not_when` fields
- If optional: Include frontmatter but note it's optional
- Respect user's configuration preference

**Present for approval:**
```markdown
## 📝 [Creating/Updating]: `[path]`

[For CREATE: Show full document]
[For UPDATE: Show changes/diff or full updated content]

---

Proceed with this change?
```

**Wait for user approval before proceeding to write.**

---

## Step 5: Write & Sync

### Write the File

**For CREATE:**

1. **Use Write tool to create the file:**
   - Write to exact path specified
   - Include all content (frontmatter + body)
   - Ensure proper Markdown formatting

**For UPDATE:**

1. **Use Edit tool to update the file:**
   - Apply specific changes
   - Preserve existing formatting
   - Update relevant sections only

### MANDATORY: Sync Registry

**Run sync command:**
```bash
ctx sync --global
```

**Handle sync results:**

**If sync succeeds:**
```markdown
✓ [Created/Updated] [doc-path]
✓ Synced global context registry

Summary:
• Document: [doc-path]
• [Brief description of changes - 1-2 sentences]
```

**If sync fails:**
```markdown
⚠️ File written but sync failed

✓ File [created/updated]: [doc-path]
❌ Sync error: [error message from command]

The document was written successfully, but the registry update failed.

Possible causes:
• Invalid YAML syntax in a context file
• Missing frontmatter fields (if required by config)
• Malformed registry file

Next steps:
1. Check the error message above
2. If mentioned, fix issues in: [affected-file-paths]
3. Run: ctx sync --global
4. If issue persists, check ctx.config.yaml settings

Your document is ready, just not indexed by AI yet.
```

**Do NOT mark task as complete if sync fails** - make this clear to user.

---

# What Global Context Does

Global contexts are project-wide Markdown documents stored in `{{global.directory}}/`:

- **Architecture** - System design, diagrams, architectural decisions
- **Rules** - Coding standards, conventions, best practices
- **Processes** - Workflows, deployment procedures, team processes
- **Knowledge** - Any project-level knowledge that applies across the codebase

### When to use global context:

✅ Standards that apply to the entire project
✅ Architecture that multiple files/modules reference
✅ Rules that guide code design decisions
✅ Processes that the team follows
✅ Knowledge that helps understand the project

❌ File-specific implementation details (use local context)
❌ Function-level documentation (use code comments)
❌ Temporary notes (use git commits or docs)

### Frontmatter handling:

- Controlled by `ctx.config.yaml` global configuration
- Can be: required, optional, or omitted
- Recommended fields: `when`, `what`, `not_when` for better AI indexing
- AI annotations added automatically during sync

---

# Important Rules

1. **Always validate first** - Catch issues before creating/updating, block on errors

2. **Path format is strict** - Must use `{{global.directory}}/` prefix or relative paths (`./`, `../`)

3. **Check for duplicates** - Warn even when explicit path is provided

4. **Use AskUserQuestion** - For ambiguous cases, confirmations, and missing information

5. **MANDATORY sync** - Always sync after write, handle failures gracefully with clear guidance

6. **Respect config** - Follow frontmatter settings defined in `ctx.config.yaml`

7. **User approval required** - Always present content and wait for approval before writing

8. **Clear error messages** - Provide actionable guidance when things fail

---

# Reference Documents

- **Global registry**: `{{global.directory}}/global-context-registry.yml` - Index of all global contexts
- **Configuration**: `ctx.config.yaml` - Frontmatter and behavior settings

---

# Example Interactions

## Example 1: Path with content (CREATE with duplicate warning)

**User:** `/ctx.global {{global.directory}}/rules/typescript.md Use union types instead of enums`

**AI:**
```markdown
[Runs: ctx validate --global]
✓ Validation passed

⚠️ Similar documents already exist:

• {{global.directory}}/rules/coding-style.md - TypeScript coding standards and conventions
• {{global.directory}}/rules/type-safety.md - Type safety guidelines for the project

Continue creating {{global.directory}}/rules/typescript.md?
```

**User:** `yes`

**AI:**
```markdown
## 📝 Creating: {{global.directory}}/rules/typescript.md

---
when: Writing TypeScript code
what: Guidelines for using union types instead of enums
not_when: Using third-party libraries that export enums
---

# TypeScript Guidelines

## Union Types Over Enums

Prefer union types instead of enums for better type safety and flexibility.

### Why Union Types?

- Better type inference
- More flexible and composable
- No runtime overhead
- Easier to extend

### Example

**❌ Avoid:**
```typescript
enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE'
}
```

**✅ Prefer:**
```typescript
type Status = 'ACTIVE' | 'INACTIVE';
```

### When to use enums

- Interoperating with libraries that expect enums
- Need reverse mapping (enum value to name)

---

Proceed with this change?
```

**User:** `yes`

**AI:**
```markdown
[Writes file]
[Runs: ctx sync --global]

✓ Created {{global.directory}}/rules/typescript.md
✓ Synced global context registry

Summary:
• Document: {{global.directory}}/rules/typescript.md
• Added guidelines preferring union types over enums with examples
```

---

## Example 2: Intent only (multiple matches)

**User:** `/ctx.global Add Redis caching TTL guidelines`

**AI:**
```markdown
[Runs: ctx validate --global]
✓ Validation passed

## Found related documents for: "Add Redis caching TTL guidelines"

1. {{global.directory}}/architecture/caching-strategy.md - Redis caching architecture and patterns
2. {{global.directory}}/rules/performance.md - Performance optimization rules and practices
3. {{global.directory}}/architecture/backend.md - Backend services architecture overview

Which document should I work on? (enter number or 'new' for new document)
```

**User:** `1`

**AI:**
```markdown
[Reads {{global.directory}}/architecture/caching-strategy.md]

## 📝 Updating: {{global.directory}}/architecture/caching-strategy.md

[Shows current content with new TTL section added:]

... [existing content] ...

## TTL Configuration

### Recommended TTL Values

- **Session data**: 30 minutes
- **User profiles**: 1 hour
- **Product catalog**: 24 hours
- **Static content**: 7 days

### Setting TTL in Redis

```javascript
await redis.setex(key, ttlInSeconds, value);
```

### Automatic Expiration

Configure automatic key expiration to prevent stale data:

```javascript
await redis.expire(key, 3600); // 1 hour
```

---

Proceed with this change?
```

**User:** `yes`

**AI:**
```markdown
✓ Updated {{global.directory}}/architecture/caching-strategy.md
✓ Synced global context registry

Summary:
• Document: {{global.directory}}/architecture/caching-strategy.md
• Added Redis TTL configuration guidelines with recommended values
```

---

## Example 3: Validation error blocks execution

**User:** `/ctx.global {{global.directory}}/rules/new-rule.md Add database guidelines`

**AI:**
```markdown
[Runs: ctx validate --global]

❌ Validation errors found

Errors:
• {{global.directory}}/architecture/old-system.md - Target file not found (referenced in registry)
• {{global.directory}}/broken.yml - Invalid YAML syntax at line 15

Please fix these errors manually before proceeding:
1. Remove {{global.directory}}/architecture/old-system.md from registry or restore the file
2. Fix YAML syntax error in {{global.directory}}/broken.yml (check line 15 for unclosed bracket)

After fixing, run this command again.
```

---

## Example 4: Sync failure with guidance

**User:** `/ctx.global {{global.directory}}/processes/deploy.md Document our CI/CD pipeline`

**AI:**
```markdown
[Validates successfully, generates content, gets approval, writes file]

[Runs: ctx sync --global]

⚠️ File written but sync failed

✓ File created: {{global.directory}}/processes/deploy.md
❌ Sync error: Invalid frontmatter in {{global.directory}}/rules/api.md: missing required field 'what'

The document was written successfully, but the registry update failed.

Possible causes:
• Invalid YAML syntax in a context file
• Missing frontmatter fields (if required by config)
• Malformed registry file

Next steps:
1. Check the error message above
2. If mentioned, fix issues in: {{global.directory}}/rules/api.md
3. Run: ctx sync --global
4. If issue persists, check ctx.config.yaml settings

Your document is ready, just not indexed by AI yet.
```

---

## Example 5: Invalid path format

**User:** `/ctx.global rules/security.md Add OWASP guidelines`

**AI:**
```markdown
[Runs: ctx validate --global]
✓ Validation passed

❌ Invalid path format: `rules/security.md`

Path must include:
- `{{global.directory}}/` prefix (e.g., `{{global.directory}}/rules/security.md`)
- OR relative path (e.g., `./rules/security.md` or `../{{global.directory}}/rules/security.md`)

Examples:
✅ {{global.directory}}/rules/security.md
✅ ./rules/security.md
✅ ../{{global.directory}}/rules/security.md
❌ rules/security.md (missing prefix)

Please provide a valid path format.
```

---

## Example 6: No matches, suggest path

**User:** `/ctx.global Add GraphQL schema design best practices`

**AI:**
```markdown
[Runs: ctx validate --global]
✓ Validation passed

No related documents found.

Based on your request, I suggest creating:
**{{global.directory}}/rules/graphql-schema.md**

Create at this path? (yes / or provide custom path)
```

**User:** `{{global.directory}}/architecture/graphql.md`

**AI:**
```markdown
## 📝 Creating: {{global.directory}}/architecture/graphql.md

---
when: Designing GraphQL schemas
what: Best practices for GraphQL schema design
not_when: Using REST APIs
---

# GraphQL Schema Design Best Practices

## Schema-First Development

Start with schema definition before {{global.directory}}...

[Full document content]

---

Proceed with this change?
```
