# CTX Load Examples

Detailed examples for the ctx-load skill.

## Example 1: Single Topic Search

```
User: Load context about payment processing

AI: Searching for "payment processing"...

Found 3 matches:

### Loaded: src/services/payment.ctx.md
**What:** Payment service implementation
**When:** Payment processing, Stripe integration, checkout
**Scope:** Local

Key patterns:
- Stripe webhook handling
- Idempotency keys
- Error recovery

---

### Loaded: .ctx/contexts/payment-flow.md
**What:** End-to-end payment flow
**When:** Payment, checkout, refunds
**Scope:** Project

Flow diagram and edge cases...

---

### Loaded: ~/.ctx/contexts/stripe.md
**What:** Stripe API patterns
**When:** Stripe, payment gateway
**Scope:** Global

Personal notes on Stripe integration...

---

Loaded 3 contexts for "payment processing"
- Local: 1
- Project: 1
- Global: 1

These contexts are now in our conversation!
```

---

## Example 2: Load All Contexts

```
User: /ctx.load --all

AI: Loading all contexts...

Global (~/.ctx/):
- coding-style.md: Personal coding conventions
- tools/docker.md: Docker patterns
- tools/aws.md: AWS best practices

Project (.ctx/):
- architecture.md: System architecture
- api-patterns.md: REST API conventions
- auth.md: Authentication flow

Local (*.ctx.md):
- src/api.ctx.md: API router
- src/auth/middleware.ctx.md: Auth middleware
- src/services/payment.ctx.md: Payment service

Total: 9 contexts across 3 levels
```

---

## Example 3: No Results Found

```
User: /ctx.load blockchain

AI: No contexts found for "blockchain"

Searched: 5 local + 3 project + 8 global contexts

Suggestions:
- Try different keywords
- Run `ctx sync` to update registries
- Create new context with `/ctx.save`
```

---

## Example 4: Level-Filtered Search

```
User: /ctx.load --global typescript

AI: Searching Global (~/.ctx/) for "typescript"...

Found 2 matches:

### Loaded: ~/.ctx/contexts/typescript-patterns.md
**What:** TypeScript best practices and patterns
**When:** typescript, type definitions, generics
**Scope:** Global

- Strict mode configuration
- Utility types cheat sheet
- Generic constraints patterns

---

### Loaded: ~/.ctx/contexts/tsconfig.md
**What:** TSConfig recommendations
**When:** typescript, configuration, compiler options
**Scope:** Global

Recommended tsconfig.json settings for different project types...
```

---

## Example 5: Path Pattern Search

```
User: /ctx.load src/auth/*

AI: Loading contexts under src/auth/...

Found 2 matches:

### Loaded: src/auth/middleware.ctx.md
**What:** Authentication middleware implementation
**When:** auth middleware, JWT validation, request authentication
**Scope:** Local
**Target:** src/auth/middleware.ts

- Token extraction from headers
- Validation flow
- Error responses

---

### Loaded: src/auth/session.ctx.md
**What:** Session management
**When:** sessions, cookies, session store
**Scope:** Local
**Target:** src/auth/session.ts

- Redis session store
- Session expiration handling
```

---

## Example 6: Related Suggestions

After loading contexts, suggest related ones:

```
User: /ctx.load authentication

AI: [loads auth contexts...]

---

Related contexts you might want:
- .ctx/contexts/security.md - Security best practices
- ~/.ctx/contexts/jwt.md - JWT patterns
- src/middleware/rate-limit.ctx.md - Rate limiting

Load these? [Y/n]
```

---

## Example 7: Cross-Project Search

```
User: /ctx.load --all api design

AI: Searching across all projects for "api design"...

Current Project (myapp):
- .ctx/contexts/api-patterns.md: REST API conventions

Other Projects (from Global index):
- projects/backend-service/.ctx/contexts/api.md: API versioning
- projects/shared-lib/.ctx/contexts/types.md: API type definitions

Total: 3 contexts across 2 projects
```
