# CTX Examples

Load와 Save 작업의 상세 예시.

---

## Load Examples

### Example 1: Single Topic Search

```
User: Load context about payment processing

AI: Searching for "payment processing"...

Found 3 matches:

### Loaded: src/services/payment.ctx.md
**What:** Payment service implementation
**Keywords:** Payment processing, Stripe integration, checkout
**Scope:** Project (bound)

Key patterns:
- Stripe webhook handling
- Idempotency keys
- Error recovery

---

### Loaded: .ctx/contexts/payment-flow.md
**What:** End-to-end payment flow
**Keywords:** Payment, checkout, refunds
**Scope:** Project (standalone)

Flow diagram and edge cases...

---

### Loaded: ~/.ctx/contexts/stripe.md
**What:** Stripe API patterns
**Keywords:** Stripe, payment gateway
**Scope:** Global

Personal notes on Stripe integration...

---

Loaded 3 contexts for "payment processing"
- Project (bound): 1
- Project (standalone): 1
- Global: 1

These contexts are now in our conversation!
```

---

### Example 2: Load All Contexts

```
User: /ctx.load --all

AI: Loading all contexts...

Global (~/.ctx/):
- coding-style.md: Personal coding conventions
- tools/docker.md: Docker patterns
- tools/aws.md: AWS best practices

Project (standalone) (.ctx/contexts/):
- architecture.md: System architecture
- api-patterns.md: REST API conventions
- auth.md: Authentication flow

Project (bound) (*.ctx.md):
- src/api.ctx.md: API router
- src/auth/middleware.ctx.md: Auth middleware
- src/services/payment.ctx.md: Payment service

Total: 9 contexts across 2 levels
```

---

### Example 3: No Results Found

```
User: /ctx.load -k blockchain

AI: No contexts found for "blockchain"

Searched: 5 project (bound) + 3 project (standalone) + 8 global contexts

Suggestions:
- Try different keywords
- Run `ctx sync` to update registries
- Create new context with `/ctx.save`
```

---

### Example 4: Level-Filtered Search

```
User: /ctx.load --global -k typescript

AI: Searching Global (~/.ctx/) for "typescript"...

Found 2 matches:

### Loaded: ~/.ctx/contexts/typescript-patterns.md
**What:** TypeScript best practices and patterns
**Keywords:** typescript, type definitions, generics
**Scope:** Global

- Strict mode configuration
- Utility types cheat sheet
- Generic constraints patterns

---

### Loaded: ~/.ctx/contexts/tsconfig.md
**What:** TSConfig recommendations
**Keywords:** typescript, configuration, compiler options
**Scope:** Global

Recommended tsconfig.json settings for different project types...
```

---

### Example 5: Path Pattern Search

```
User: /ctx.load -t "src/auth/*"

AI: Loading contexts under src/auth/...

Found 2 matches:

### Loaded: src/auth/middleware.ctx.md
**What:** Authentication middleware implementation
**Keywords:** auth middleware, JWT validation, request authentication
**Scope:** Project (bound)
**Target:** src/auth/middleware.ts

- Token extraction from headers
- Validation flow
- Error responses

---

### Loaded: src/auth/session.ctx.md
**What:** Session management
**Keywords:** sessions, cookies, session store
**Scope:** Project (bound)
**Target:** src/auth/session.ts

- Redis session store
- Session expiration handling
```

---

### Example 6: Related Suggestions

After loading contexts, suggest related ones:

```
User: /ctx.load -k authentication

AI: [loads auth contexts...]

---

Related contexts you might want:
- .ctx/contexts/security.md - Security best practices
- ~/.ctx/contexts/jwt.md - JWT patterns
- src/middleware/rate-limit.ctx.md - Rate limiting

Load these? [Y/n]
```

---

### Example 7: Cross-Project Search

```
User: /ctx.load --all -k api design

AI: Searching across all projects for "api design"...

Current Project (myapp):
- .ctx/contexts/api-patterns.md: REST API conventions

Other Projects (from Global index):
- projects/backend-service/.ctx/contexts/api.md: API versioning
- projects/shared-lib/.ctx/contexts/types.md: API type definitions

Total: 3 contexts across 2 projects
```

---

## Save Examples

### Example 1: Create New Context

```
User: GraphQL 패턴 저장해줘

AI: [Check registry - no GraphQL related]

    No related context found, creating new one.

    [Create .ctx/contexts/graphql-patterns.md]
    [ctx sync]

Created: .ctx/contexts/graphql-patterns.md
```

---

### Example 2: Append to Existing

```
User: terraform 인사이트 저장해줘

AI: [Check registry - found terraform.md]

    terraform.md exists, so I'll add it there.

    [Add new section to terraform.md]
    [ctx sync]

Appended to .ctx/contexts/terraform.md
```

---

### Example 3: Choose Among Multiple

```
User: 인프라 관련 저장해

AI: [Check registry - found terraform.md, aws.md, docker.md]

    Multiple related contexts found:
    - terraform.md
    - aws.md
    - docker.md

    Which one should I add to? (New file is also possible)

User: aws.md

AI: [Add to aws.md]

Appended to .ctx/contexts/aws.md
```

---

### Example 4: Execution Judgment

**Clear Instruction -> Execute Immediately**

```
User: .ctx/contexts/auth.md에 저장해

AI: [Clear path - execute immediately]
    [Create/append to auth.md]
    [ctx sync]

Done.
```

```
User: 바로 저장해줘

AI: [Immediate execution requested - execute]
    [Save to appropriate location]
    [ctx sync]

Done.
```

**Uncertain -> Confirm**

```
User: 이거 저장해

AI: [Check registry - 2 similar contexts]

    Found auth.md and security.md.
    auth.md seems more relevant. Should I add there?

User: ㅇㅇ

AI: [Add to auth.md]

Appended.
```

**Risky -> Always Confirm**

```
User: terraform.md 내용 교체해줘

AI: [Replace request - risky]

    ⚠️ Existing content will be deleted:

    Current: # Terraform Patterns (15 lines)
    New: # Terraform Best Practices (20 lines)

    Are you sure you want to replace?

User: ㅇㅇ

AI: [Backup and replace]

Replaced. Backup: .ctx/backup/terraform.md.bak
```

---

### Example 5: Scope Selection

**Project (Default)**

```
User: API 패턴 저장해

AI: [Project knowledge -> Project scope]

    Creating .ctx/contexts/api-patterns.md.

Created: .ctx/contexts/api-patterns.md
```

**Global**

```
User: 내 디버깅 팁 global로 저장해

AI: [Personal knowledge -> Global scope]

    Creating ~/.ctx/contexts/debug-tips.md.

Created: ~/.ctx/contexts/debug-tips.md
```

**Local (Target Binding)**

```
User: 이 auth.ts 파일에 대한 컨텍스트 저장해

AI: [Specific file -> Local scope]

    Creating src/auth.ctx.md and binding to auth.ts.

    [ctx create src/auth.ctx.md --target src/auth.ts]

Created: src/auth.ctx.md (bound to src/auth.ts)
```

---

### Example 6: Capture Integration

**Session -> Save**

```
User: 오늘 세션 내용 저장해줘

AI: [Run session-capture]
    -> .ctx/inbox/session/abc123.json

    [Extract insights]

    [Check registry - no related]

    Creating session-2026-01-04.md.

Created: .ctx/contexts/session-2026-01-04.md
```

---

### Example 7: Append Strategy

When adding to existing file:

```markdown
# Existing content preserved
...

## New Section (Added: 2026-01-04)

Newly added content
```

- Don't touch existing sections
- Date stamp for tracking
- Update `keywords` in frontmatter if needed
