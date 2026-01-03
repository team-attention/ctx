# Mode Examples

Detailed examples for each ctx-save mode.

## Auto Mode Examples (Non-Interactive)

### Example 1: Direct Path Specification

```
User: .ctx/contexts/auth-jwt.md에 JWT 인증 패턴 저장해. 내용은 토큰 갱신 방법.

AI: [No questions - immediate execution]

[Uses Write tool to create .ctx/contexts/auth-jwt.md]
[Runs: npx ctx sync]

Done. Saved to .ctx/contexts/auth-jwt.md
```

### Example 2: Scope + Filename Combination

```
User: 바로 project scope로 api-patterns.md 생성해줘

AI: [Auto Mode detected - executing immediately]

[Creates .ctx/contexts/api-patterns.md]
[Syncs registry]

Created: .ctx/contexts/api-patterns.md
```

### Example 3: Global Scope Direct Save

```
User: Global에 typescript-tips.md로 저장, 내용은 strict mode 설정법

AI: [Auto Mode - no confirmation needed]

[Creates ~/.ctx/contexts/typescript-tips.md]
[Runs: npx ctx sync]

Saved to ~/.ctx/contexts/typescript-tips.md
```

---

## Quick Mode Examples

### Example 1: Session Knowledge Extraction

```
User: This auth pattern we figured out, save it

AI: Analyzing conversation for valuable knowledge...

Found:
- JWT refresh token rotation pattern
- Token storage best practices
- Middleware structure for auth checks

Recommended: Project context at `.ctx/contexts/auth-patterns.md`
(Project-specific knowledge for team sharing)

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
npx ctx create .ctx/contexts/auth-patterns.md
[Writes content with Edit tool]
npx ctx sync

Saved: .ctx/contexts/auth-patterns.md
Synced with Global index
```

### Example 2: Quick Pattern Save

```
User: remember this error handling approach

AI: Extracting error handling pattern from our discussion...

Key points:
- Custom error classes with status codes
- Centralized error middleware
- Consistent error response format

Scope: Project (team knowledge)
Location: .ctx/contexts/error-handling.md

[Shows content preview]

Save? [Y/n]

User: y

AI: Saved to .ctx/contexts/error-handling.md
```

---

## Deliberate Mode Examples

### Example 1: From Slack Thread

```
User: Extract context from that Slack thread about deployment

AI: Accessing Slack via MCP...

[Uses Slack MCP to fetch thread]

Found thread with 15 messages about deployment pipeline.

Key points extracted:
1. Blue-green deployment strategy
2. Rollback procedure
3. Monitoring checklist

Where to save?

1. Global (~/.ctx/contexts/devops/) - Personal reference
2. Project (.ctx/contexts/deployment.md) - Team knowledge
3. Local (deploy.ctx.md) - Specific to deploy script

User: 2

AI: Creating project context...

[Shows full content for review]

Does this look correct? Edit or approve.

User: Looks good, save it

AI:
npx ctx create .ctx/contexts/deployment.md
[Writes content]
npx ctx sync

Saved: .ctx/contexts/deployment.md
```

### Example 2: From URL

```
User: Save context from this documentation URL

AI: Provide the URL to extract context from.

User: https://example.com/api-docs

AI: [Fetches URL via WebFetch]

Extracted from documentation:
- API authentication methods
- Rate limiting rules
- Endpoint patterns

Review the extracted content:
[Shows content]

Select scope:
1. Global - Personal API reference
2. Project - Team API documentation
3. Local - Specific endpoint context

User: 2, but add the pagination section too

AI: Updated content with pagination section.

[Shows updated content]

Confirm save to .ctx/contexts/api-docs.md? [Y/n]

User: Y

AI: Saved: .ctx/contexts/api-docs.md
```

### Example 3: Updating Existing Context

```
User: Update the auth context with the new refresh token flow

AI: Found existing context: .ctx/contexts/auth-patterns.md

Current content:
[Shows existing content]

Proposed changes:
[Shows diff with new refresh token flow]

Apply these changes? [Y/n]

User: Y

AI: Updated .ctx/contexts/auth-patterns.md
Synced registry.
```

---

## Source-Specific Flows

### From Session (Default)

1. Analyze current conversation
2. Extract valuable knowledge (patterns, decisions, gotchas)
3. Summarize into structured content
4. Propose scope and location

### From Slack (Requires MCP)

1. Request channel/thread identifier
2. Fetch messages via Slack MCP
3. Extract key points and decisions
4. Present for user review
5. Save to selected location

### From URL

1. Request URL
2. Fetch content via WebFetch
3. Extract relevant sections
4. Allow user editing
5. Save to selected location

### From Clipboard

1. Request user to paste content
2. Analyze and structure content
3. Propose scope based on content type
4. Save after confirmation

### Direct Input

1. Accept natural language description
2. Structure into context format
3. Infer appropriate scope
4. Save with minimal friction
