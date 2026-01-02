---
name: ctx-save
description: Save context from conversation, external sources, or user input. Triggers on requests like "save this context", "remember this", "extract context", "store this knowledge", "document this pattern". Supports Quick mode (zero-friction) and Deliberate mode (detailed control).
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# CTX Save Skill

Save context to the 3-Level Context System (Global, Project, Local).

## When to Use

Activate this skill when:
- User wants to save/store/remember something from the conversation
- User says "save this", "store this", "remember this", "extract context"
- User wants to document a pattern, decision, or knowledge
- User explicitly requests `/ctx.save` or `/ctx:save`

## Two Modes

### Quick Mode (Default)
Zero-friction saving from current session.

**Triggers:**
- "save this" / "store this" / "remember this"
- `/ctx.save` without additional arguments
- Session end context suggestions

**Flow:**
1. Analyze conversation for valuable knowledge
2. AI determines scope (Global/Project/Local)
3. AI proposes content and location
4. Single confirmation: "This looks right? [Y/n]"

### Deliberate Mode
Detailed control for external sources or complex cases.

**Triggers:**
- External source mentioned: "from Slack", "from this URL", "from clipboard"
- User says "deliberate" or wants more control
- Updating existing context (conflict potential)

**Flow:**
1. User selects source
2. User reviews/edits extracted content
3. User chooses from multiple location options
4. Step-by-step confirmation

---

## Execution Algorithm

### Step 1: Detect Mode

Analyze user request to determine mode:

```
IF request mentions external source (slack, url, clipboard):
  → Deliberate Mode
ELSE IF request mentions "deliberate" or "carefully":
  → Deliberate Mode
ELSE IF request mentions updating existing context:
  → Deliberate Mode
ELSE:
  → Quick Mode
```

---

### Step 2: Gather Content

#### Quick Mode
1. Analyze current conversation for valuable knowledge:
   - Patterns discovered
   - Decisions made
   - Gotchas/pitfalls learned
   - Implementation approaches
   - Architecture insights

2. Summarize into structured content

#### Deliberate Mode
Based on source:

**From Session:**
- Same as Quick Mode but with user review

**From Slack (requires MCP):**
```
Ask user for channel/thread → Fetch via MCP → Extract key points
```

**From URL:**
```
Ask for URL → WebFetch → Extract relevant content
```

**From Clipboard:**
```
Ask user to paste → Analyze content
```

**Direct Input:**
```
User provides content directly in natural language
```

---

### Step 3: Determine Scope

Analyze content to recommend scope:

| Content Type | Recommended Scope |
|-------------|-------------------|
| Personal coding style, tool preferences | Global (`~/.ctx/contexts/`) |
| Project architecture, API patterns | Project (`.ctx/contexts/`) |
| File-specific implementation details | Local (`*.ctx.md`) |

**For Quick Mode:** AI recommends single best option
**For Deliberate Mode:** Present all applicable options

---

### Step 4: Determine Location

#### Check Settings for Path Hints

Read registry's `settings.context_paths` to inform location:

```bash
# Find project root
PROJECT_ROOT=$(npx ctx status --json | jq -r '.projectRoot // empty')

if [ -n "$PROJECT_ROOT" ]; then
  # Read project settings
  cat "$PROJECT_ROOT/.ctx/registry.yaml"
fi

# Read global settings
cat ~/.ctx/registry.yaml
```

Match content purpose with `context_paths[].purpose` to suggest path.

#### Location Decision

**Global contexts:** `~/.ctx/contexts/<category>/<name>.md`
**Project contexts:** `.ctx/contexts/<category>/<name>.md`
**Local contexts:** `<target>.ctx.md` or `<folder>/ctx.md`

---

### Step 5: Create or Update

#### Check if Context Exists

```bash
npx ctx status --path <proposed-path>
```

#### CREATE (new context)

```bash
# For Local
npx ctx create <target-file>

# For Project
npx ctx create --project <name>

# For Global
npx ctx create --global <name>
```

Then use Edit tool to fill in content.

#### UPDATE (existing context)

1. Read existing context
2. Show diff of proposed changes
3. Wait for approval
4. Apply with Edit tool

---

### Step 6: Register and Sync

```bash
# Add to registry if not already registered
npx ctx add <context-path>

# Sync to update checksums and Global index
npx ctx sync
```

---

## Quick Mode Example

```
User: This auth pattern we figured out, save it

AI: I'll save the authentication pattern we discussed.

Analyzing conversation...
- JWT refresh token rotation pattern
- Token storage best practices
- Middleware structure for auth checks

Recommended: Project context at `.ctx/contexts/auth-patterns.md`
(This is project-specific knowledge that should be shared with the team)

Content preview:
---
# Authentication Patterns

## JWT Refresh Token Rotation
When access token expires...
[preview of content]
---

Save this? [Y/n]

User: Y

AI:
npx ctx create --project auth-patterns
[Writes content with Edit tool]
npx ctx sync

Saved: .ctx/contexts/auth-patterns.md
Synced with Global index
```

---

## Deliberate Mode Example

```
User: Extract context from that Slack thread about deployment

AI: I'll help extract context from Slack. Let me access it.

[Uses Slack MCP to fetch thread]

Found thread with 15 messages about deployment pipeline.

Key points extracted:
1. Blue-green deployment strategy
2. Rollback procedure
3. Monitoring checklist

Where should I save this?

1. Global (~/.ctx/contexts/devops/) - Personal reference
2. Project (.ctx/contexts/deployment.md) - Team knowledge
3. Local (deploy.ctx.md) - Specific to deploy script

User: 2

AI: Creating project context...

[Shows full content for review]

Does this look correct? You can edit or approve.

User: Looks good, save it

AI:
npx ctx create --project deployment
[Writes content]
npx ctx sync

Saved: .ctx/contexts/deployment.md
```

---

## Content Structure

Generated context files should follow this structure:

```markdown
---
what: "Brief description of this context"
when:
  - "Trigger keyword 1"
  - "Trigger keyword 2"
---

# Title

## Overview
[Main content]

## Details
[Supporting information]

## Related
- [Links to related contexts]
```

---

## Frontmatter Guidelines

| Field | Required | Purpose |
|-------|----------|---------|
| `what` | Yes | Single sentence describing content |
| `when` | Yes | Array of keywords/situations for auto-loading |
| `target` | Local only | Path to the code file this context describes |

---

## Error Handling

**Global not initialized:**
```
Run `ctx init` first to set up global context system.
```

**Project not found (for Project/Local scope):**
```
No project found. Run `ctx init .` to initialize this directory.
Or save to Global scope with --global.
```

**File already exists (CREATE):**
```
Context already exists. Would you like to update it instead?
```

---

## Tips for AI

1. **Be proactive** - Suggest saving when valuable knowledge emerges
2. **Prefer Quick Mode** - Minimize friction for common cases
3. **Smart defaults** - Use conversation context to pre-fill content
4. **Respect scope** - Personal preferences → Global, Team knowledge → Project
5. **Always sync** - Run `ctx sync` after every save
6. **Parallel operations** - Use Glob/Grep in parallel when checking existing contexts
