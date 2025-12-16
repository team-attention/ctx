---
description: Audit context health (mechanical + semantic analysis)
argument-hint: [description for focused review]
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


You are performing a comprehensive audit of the context ecosystem.

# Arguments

**$ARGUMENTS**: Optional description for focused semantic review
- **With description**: Deep review of related contexts only
- **Without description**: Quick semantic scan using previews

---

# Workflow

## Step 1: Mechanical Scan (Always)

Run mechanical health check:

```bash
npx ctx check
```

The `npx ctx check` command returns JSON with:
- `status`: overall health (`fresh`, `stale`, `error`)
- `summary.local`: `{ total, fresh, stale, new, deleted, errors }`
- `summary.global`: `{ total, fresh, stale, new, deleted, errors }`
- `issues[]`: array of issue objects

Each issue contains:
- `type`: one of `error`, `stale_target`, `modified`, `new`, `deleted`
- `scope`: `local` or `global`
- `contextPath`: path to the context file
- `targetPath`: (local only) path to the target file
- `message`: human-readable description
- `lastModified`: (optional) last sync timestamp

| Type | Meaning | Severity |
|------|---------|----------|
| `error` | Target file missing, invalid schema | ❌ Error |
| `stale_target` | Target changed, context may be outdated | ⚠️ Warning |
| `modified` | Context modified but not synced | ⚠️ Warning |
| `new` | Context file not in registry | 💡 Info |
| `deleted` | Context in registry but file deleted | 💡 Info |

---

## Step 2: Semantic Analysis

### 2a. If $ARGUMENTS provided (Focused Deep Review)

1. **Get registry data:**
   ```bash
   npx ctx status --json
   ```

2. **Filter relevant contexts:**
   - Search `preview.what` field for semantic match with $ARGUMENTS
   - Include contexts where `what` relates to the description
   - Example: "$ARGUMENTS = auth" → match "JWT authentication", "user authorization", etc.

3. **Full read filtered contexts:**
   - Read each matched context file completely
   - For local contexts, also read the target file

4. **Deep semantic analysis:**
   - Does the context accurately describe the target?
   - Are `when` scenarios comprehensive?
   - Any outdated information based on actual code?
   - Clarity and actionability of the content

---

### 2b. If no $ARGUMENTS (Quick Preview Scan)

1. **Get all previews:**
   ```bash
   npx ctx status --json
   ```

2. **Extract all preview data:**
   ```
   For each context in local + global registries:
     - preview.what
     - preview.when
     - source path
   ```

3. **AI analysis on previews:**

   **Check for Contradictions:**
   - Context A says "do X"
   - Context B says "don't do X"
   - Example: error handling strategy conflicts

   **Check for Redundancy:**
   - Multiple contexts with nearly identical `what`
   - Same topic documented in multiple places
   - Example: two contexts both describing "input validation"

   **Check for Ambiguity:**
   - Vague `what` descriptions ("handles stuff")
   - Missing or unclear `when` scenarios
   - Terms that could be interpreted multiple ways

4. **Selective full read:**
   - Only read contexts flagged as suspicious
   - Verify if the issue is real or false positive
   - Gather details for actionable recommendations

---

## Step 3: Generate Report

### Report Structure

```markdown
## 🔍 Context Audit Report

### Summary
- **Status**: [fresh/stale/error]
- **Scanned**: X local + Y global contexts
- **Issues**: Z mechanical + W semantic

---

### Mechanical Issues

[If no issues]
✅ All contexts are mechanically healthy

[If issues exist, group by type]

#### ❌ Errors (N)
[For each error]
- `[contextPath]`
  - Issue: [message]
  - Target: [targetPath]
  - Action: [specific fix]

#### ⚠️ Stale (N)
[For each stale]
- `[contextPath]`
  - Target changed: [targetPath]
  - Last synced: [lastModified]
  - Action: Review context, run `npx ctx check --fix` if OK

#### 💡 Unsynced (N)
[For new/deleted/modified]
- `[contextPath]` - [message]

---

### Semantic Issues

[If no issues]
✅ No semantic issues detected

[If issues exist]

#### ⚡ Contradictions (N)
[For each contradiction]
- **Conflict**: [brief description]
  - `[context-A]`: "[what A says]"
  - `[context-B]`: "[what B says]"
  - **Impact**: [what could go wrong]
  - **Recommendation**: [how to resolve]

#### 🔄 Redundancy (N)
[For each redundancy]
- **Overlap**: [topic]
  - `[context-A]`: [what]
  - `[context-B]`: [what]
  - **Recommendation**: Merge into one or differentiate scope

#### 🌫️ Ambiguity (N)
[For each ambiguity]
- `[contextPath]`
  - **Issue**: [what's unclear]
  - **Example**: "[vague phrase]"
  - **Recommendation**: [how to clarify]

---

### Recommendations

**Priority Actions:**
1. [Most critical action]
2. [Second priority]
3. [Third priority]

**Quick Fixes:**
- Run `npx ctx check --fix` to sync registry
- [Other one-liner fixes]

**Needs Review:**
- [Items requiring human judgment]
```

---

# Reference

## Registry Locations
- Local: `{{global.directory}}/local-context-registry.yml`
- Global: `{{global.directory}}/global-context-registry.yml`

## Related Commands

| Command | Description |
|---------|-------------|
| `npx ctx check` | Check health, output JSON |
| `npx ctx check --pretty` | Human-readable output |
| `npx ctx check --fix` | Auto-fix by syncing registry |
| `npx ctx check --local` | Check local contexts only |
| `npx ctx check --global` | Check global contexts only |

- `npx ctx sync` - Force sync all contexts
- `/ctx.save` - Update a specific context

---

# Example Interactions

## Example 1: Basic Audit (no arguments)

```
User: /ctx.audit

AI:
[Runs: npx ctx check]
[Runs: npx ctx status --json]
[Analyzes previews for semantic issues]

## 🔍 Context Audit Report

### Summary
- **Status**: stale
- **Scanned**: 23 local + 8 global contexts
- **Issues**: 3 mechanical + 2 semantic

---

### Mechanical Issues

#### ⚠️ Stale (2)
- `src/services/payment.ctx.md`
  - Target changed: `/src/services/payment.ts`
  - Last synced: 3 days ago
  - Action: Review if context needs update

- `src/utils/auth.ctx.md`
  - Target changed: `/src/utils/auth.ts`
  - Last synced: 1 week ago
  - Action: Review if context needs update

#### 💡 Unsynced (1)
- `src/api/users.ctx.md` - New context not in registry

---

### Semantic Issues

#### ⚡ Contradictions (1)
- **Conflict**: Error handling strategy
  - `{{global.directory}}/rules/errors.md`: "Always throw exceptions for errors"
  - `src/services/api.ctx.md`: "Return Result<T, E> type for errors"
  - **Impact**: Inconsistent error handling across codebase
  - **Recommendation**: Decide on one strategy, update the other context

#### 🌫️ Ambiguity (1)
- `src/utils/helpers.ctx.md`
  - **Issue**: Vague description
  - **Example**: "what: Various helper functions"
  - **Recommendation**: Split into specific contexts or detail the functions

---

### Recommendations

**Priority Actions:**
1. Resolve error handling contradiction between global rule and api context
2. Review stale contexts for payment and auth services

**Quick Fixes:**
- Run `npx ctx check --fix` to sync the new users context

**Needs Review:**
- Consider splitting helpers.ctx.md into focused contexts
```

---

## Example 2: Focused Audit (with description)

```
User: /ctx.audit 인증 관련 컨텍스트 점검해줘

AI:
[Runs: npx ctx check]
[Runs: npx ctx status --json]
[Filters contexts where preview.what matches "인증", "auth", "authentication", "JWT", etc.]
[Full reads: src/auth/jwt.ctx.md, src/auth/middleware.ctx.md, {{global.directory}}/rules/auth.md]
[Also reads target files for local contexts]

## 🔍 Context Audit Report (Focused: 인증)

### Summary
- **Focus**: Authentication-related contexts
- **Reviewed**: 3 contexts (deep analysis)
- **Issues**: 1 mechanical + 1 semantic

---

### Mechanical Issues

#### ⚠️ Stale (1)
- `src/auth/jwt.ctx.md`
  - Target changed: `/src/auth/jwt.ts`
  - Changes detected: New `refreshToken()` function added
  - Action: Add refresh token documentation to context

---

### Semantic Issues

#### 📅 Outdated Content (1)
- `src/auth/middleware.ctx.md`
  - **Context says**: "Uses session-based authentication"
  - **Code shows**: JWT bearer token validation
  - **Recommendation**: Update context to reflect JWT-based auth

---

### Detailed Findings

#### src/auth/jwt.ctx.md
- ✅ `what`: Accurate description
- ⚠️ `when`: Missing "token refresh" scenario
- ✅ Content: Well structured

#### src/auth/middleware.ctx.md
- ❌ `what`: Outdated (says session, actually JWT)
- ✅ `when`: Scenarios still valid
- ⚠️ Content: References removed code

#### {{global.directory}}/rules/auth.md
- ✅ `what`: Clear and accurate
- ✅ `when`: Comprehensive
- ✅ Content: Up to date

---

### Recommendations

**Priority Actions:**
1. Update middleware.ctx.md to reflect JWT authentication
2. Add refresh token scenario to jwt.ctx.md

**Quick Fixes:**
- Run `npx ctx check --fix` after updates
```

---

## Example 3: All Clean

```
User: /ctx.audit

AI:
[Runs: npx ctx check]
[Runs: npx ctx status --json]
[Analyzes previews]

## 🔍 Context Audit Report

### Summary
- **Status**: fresh ✨
- **Scanned**: 45 local + 12 global contexts
- **Issues**: 0

---

### Mechanical Issues

✅ All contexts are mechanically healthy

---

### Semantic Issues

✅ No semantic issues detected

---

### Health Score: 💯

Your context ecosystem is in great shape!

**Maintenance Tips:**
- Run `/ctx.audit` periodically (weekly recommended)
- Use `npx ctx check` after coding sessions
- Keep contexts focused and up-to-date
```

---

# Rules

1. **Always run mechanical check first** - `npx ctx check` catches structural issues
2. **Semantic analysis is additive** - It finds issues mechanical checks can't
3. **Be conservative with contradictions** - Only flag clear conflicts, not style differences
4. **Prioritize actionable findings** - Every issue should have a clear resolution
5. **Respect the scope** - If $ARGUMENTS given, focus only on related contexts
6. **Preview-first for efficiency** - Don't full-read unless necessary
