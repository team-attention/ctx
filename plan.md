# `/ctx.status` 구현 계획

## 목표

현재 ctx 상태를 한눈에 보여주는 대시보드 AI 커맨드

```
/ctx.status

📊 Context Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Local:  45 contexts (3 stale, 2 errors)
Global: 12 documents
Last sync: 2 hours ago

🔧 Work Session
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Issue:    #123 - Add dark mode toggle
Branch:   feature/dark-mode
Sessions: 3 recorded
Status:   in_progress

💡 Suggestions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 3 contexts need update (run /ctx.validate --diff)
• Work session active - consider /ctx.work.extract before merge
```

---

## 표시할 정보

### 1. Context Status (컨텍스트 상태)

| 항목 | 소스 | 방법 |
|------|------|------|
| Local context 수 | `ctx/local-context-registry.yml` | 파일 읽어서 entries 카운트 |
| Global context 수 | `ctx/global-context-registry.yml` | 파일 읽어서 entries 카운트 |
| Stale contexts | Registry의 checksum vs 실제 파일 | `ctx validate --diff` 결과 파싱 또는 직접 비교 |
| Last sync time | Registry 파일의 mtime | `stat` 명령어 또는 파일 시스템 |

### 2. Work Session (작업 세션)

| 항목 | 소스 | 방법 |
|------|------|------|
| Active issue | `.ctx.current` | JSON 파싱 → `issue` 필드 |
| Issue title | GitHub/Linear API 또는 로컬 파일 | `gh issue view` 또는 파일 읽기 |
| Branch | `git branch --show-current` | Bash 실행 |
| Sessions count | `.ctx.current` → `sessions[]` | 배열 길이 |
| Status | 로컬 이슈 파일의 frontmatter | 파일 읽기 |

### 3. Suggestions (제안)

조건부 메시지:
- Stale contexts 있으면 → "run /ctx.validate --diff"
- Work session 활성화 + PR 존재 → "consider /ctx.work.extract"
- Registry 없으면 → "run /ctx.sync first"
- `.ctx.current` 없으면 → Work Session 섹션 생략

---

## 구현 방식

### 옵션 A: AI 커맨드만 (프롬프트 기반)

**파일**: `src/templates/ai-commands/status.md`

```markdown
---
description: Show current ctx status dashboard
argument-hint: ""
allowed-tools: [Read, Bash]
---

# Task
Read registry files and .ctx.current to display status dashboard.

# Workflow
1. Read ctx/local-context-registry.yml
2. Read ctx/global-context-registry.yml
3. Check .ctx.current existence
4. If exists, parse and show work session
5. Run quick validation check
6. Display formatted dashboard
```

**장점**:
- 빠른 구현
- 기존 패턴과 일치

**단점**:
- AI가 매번 파일 읽어야 함
- 출력 포맷 일관성 보장 어려움

### 옵션 B: CLI 명령어 + AI 커맨드

**파일들**:
- `src/commands/status.ts` - 실제 로직
- `src/templates/ai-commands/status.md` - `ctx status` 호출

```typescript
// src/commands/status.ts
export async function status() {
  // Registry 읽기
  // .ctx.current 읽기
  // 포맷팅된 출력
}
```

**장점**:
- 출력 포맷 일관성
- 빠른 실행 (AI 파싱 불필요)
- 테스트 가능

**단점**:
- 구현량 많음

---

## 결정: 옵션 A (AI 커맨드만)

이유:
1. 빠른 구현
2. 기존 패턴과 일치 (`/ctx.sync`, `/ctx.validate`도 AI가 CLI 호출)
3. 나중에 필요하면 CLI로 분리 가능

---

## 구현 계획

### Phase 1: 템플릿 파일 생성

**파일**: `src/templates/ai-commands/status.md`

```markdown
---
description: Show current ctx and work session status
argument-hint: ""
allowed-tools: [Read, Bash]
---
```

### Phase 2: Workflow 작성

1. Registry 파일 읽기
2. `.ctx.current` 확인
3. Git 상태 확인
4. 대시보드 출력

### Phase 3: 테스트

```bash
npm run build
cd test-project
ctx refresh
# Claude Code에서 /ctx.status 실행
```

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `src/templates/ai-commands/status.md` | **새로 생성** |

---

## 예상 출력 형식

### Case 1: 모든 정보 있음

```
📊 Context Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Local contexts:  45 (3 need update)
Global contexts: 12
Last sync:       2025-11-27 14:30 (2 hours ago)

🔧 Work Session
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Issue:    Add dark mode toggle
Source:   https://github.com/user/repo/issues/123
Branch:   feature/dark-mode
Sessions: 3 recorded
Status:   in_progress

💡 Suggestions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 3 contexts need update → /ctx.validate --diff
• Consider extracting context → /ctx.work.extract
```

### Case 2: Work session 없음

```
📊 Context Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Local contexts:  45 (all valid)
Global contexts: 12
Last sync:       2025-11-27 14:30 (2 hours ago)

🔧 Work Session
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No active work session.

💡 Start with: /ctx.work.init <issue-url>
```

### Case 3: ctx 초기화 안됨

```
⚠️ ctx not initialized

Run: ctx init
```

---

## 질문

1. **출력 포맷 괜찮은가요?** (박스, 이모지 등)
2. **추가로 보여줄 정보 있나요?**
3. **Suggestions 섹션의 조건들 더 필요한가요?**
