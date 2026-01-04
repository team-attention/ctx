# ctx-save Examples

Principle-based save examples.

---

## Basic Flow Examples

### Example 1: Create New Context

```
User: GraphQL 패턴 저장해줘

AI: [Check registry - no GraphQL related]

    No related context found, creating new one.

    [Create .ctx/contexts/graphql-patterns.md]
    [ctx sync]

Created: .ctx/contexts/graphql-patterns.md
```

### Example 2: Append to Existing

```
User: terraform 인사이트 저장해줘

AI: [Check registry - found terraform.md]

    terraform.md exists, so I'll add it there.

    [Add new section to terraform.md]
    [ctx sync]

Appended to .ctx/contexts/terraform.md
```

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

## Execution Judgment Examples

### Clear Instruction → Execute Immediately

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

### Uncertain → Confirm

```
User: 이거 저장해

AI: [Check registry - 2 similar contexts]

    Found auth.md and security.md.
    auth.md seems more relevant. Should I add there?

User: ㅇㅇ

AI: [Add to auth.md]

Appended.
```

### Risky → Always Confirm

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

## Scope Examples

### Project (Default)

```
User: API 패턴 저장해

AI: [Project knowledge → Project scope]

    Creating .ctx/contexts/api-patterns.md.

Created: .ctx/contexts/api-patterns.md
```

### Global

```
User: 내 디버깅 팁 global로 저장해

AI: [Personal knowledge → Global scope]

    Creating ~/.ctx/contexts/debug-tips.md.

Created: ~/.ctx/contexts/debug-tips.md
```

### Local (Target Binding)

```
User: 이 auth.ts 파일에 대한 컨텍스트 저장해

AI: [Specific file → Local scope]

    Creating src/auth.ctx.md and binding to auth.ts.

    [ctx create src/auth.ctx.md --target src/auth.ts]

Created: src/auth.ctx.md (bound to src/auth.ts)
```

---

## Capture Integration Examples

### Session → Save

```
User: 오늘 세션 내용 저장해줘

AI: [Run session-capture]
    → .ctx/inbox/session/abc123.json

    [Extract insights]

    [Check registry - no related]

    Creating session-2026-01-04.md.

Created: .ctx/contexts/session-2026-01-04.md
```

---

## Append Strategy

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
