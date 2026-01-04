# CTX 3-Level System 수동 테스트

> 테스트 환경 준비 후 각 항목을 순서대로 검증

---

## 테스트 환경

```bash
# 테스트 디렉토리
/tmp/ctx-test      # 새 프로젝트 테스트용
/tmp/legacy-test   # 마이그레이션 테스트용

# 빌드된 CLI 경로
node /path/to/ctx/dist/bin/ctx.js <command>
```

---

## Phase 1: 삭제 및 정리 검증

### 1.1 빌드 성공
- [ ] `pnpm build` 실행 → TypeScript 컴파일 에러 없음

### 1.2 ctx init - work 관련 제거 확인
- [ ] `ctx init` 실행 시 "issue store" 선택 prompt 없음
- [ ] "work directory" 관련 prompt 없음
- [ ] Global init 메시지: "🌍 Initializing Global Context"

### 1.3 ctx status - work 섹션 제거 확인
- [ ] `ctx status --pretty` 실행
- [ ] "Work Session" 섹션 없음
- [ ] "Context Status" 섹션만 표시됨

---

## Phase 2: 3-Level 아키텍처 검증

### 2.1 Global Init (`ctx init`)

**테스트 경로:** 아무 디렉토리

**사전 조건:** `~/.ctx/` 없음

**실행:**
```bash
ctx init
```

**검증:**
- [ ] `~/.ctx/` 디렉토리 생성됨
- [ ] `~/.ctx/registry.yaml` 생성됨 (version: 2.0.0)
- [ ] `~/.ctx/contexts/` 디렉토리 생성됨
- [ ] `~/.ctx/registry.yaml`에 `index: {}` 필드 있음

### 2.2 Project Init (`ctx init .`)

**테스트 경로:** `/tmp/ctx-test`

**사전 조건:** Global init 완료, 빈 디렉토리

**실행:**
```bash
mkdir -p /tmp/ctx-test && cd /tmp/ctx-test
ctx init .
```

**검증:**
- [ ] `.ctx/` 디렉토리 생성됨
- [ ] `.ctx/registry.yaml` 생성됨 (version: 2.0.0)
- [ ] `.ctx/contexts/` 디렉토리 생성됨
- [ ] `.claude/commands/` AI commands 설치됨
- [ ] Global 없이 실행 시 에러 메시지 표시

### 2.3 ctx sync - 3-Level 시스템

**테스트 경로:** `/tmp/ctx-test`

**사전 조건:** Project init 완료

**준비:**
```bash
# Local context 파일 생성
cat > test.ctx.md << 'EOF'
---
what: Test context
keywords:
  - testing sync
---
# Test
EOF
```

**실행:**
```bash
ctx sync
```

**검증:**
- [ ] "Syncing (3-level system)..." 메시지 출력
- [ ] "Syncing local contexts..." → Local context 카운트
- [ ] "Syncing project contexts..." → Project context 카운트
- [ ] "Updating global index..." 메시지 출력
- [ ] `.ctx/registry.yaml`에 context 등록됨 (scope: local)
- [ ] `~/.ctx/registry.yaml`의 `index`에 프로젝트 정보 등록됨

### 2.4 Global Index 확인

**테스트 경로:** `~/.ctx/registry.yaml`

**검증:**
- [ ] `index` 필드에 프로젝트 이름 키 있음
- [ ] `path`: 프로젝트 절대 경로
- [ ] `context_count`: context 개수
- [ ] `contexts`: 각 context의 what, keywords 정보

---

## Phase 3: 신규 커맨드 검증

### 3.1 ctx add

**테스트 경로:** `/tmp/ctx-test`

**준비:**
```bash
cat > new.ctx.md << 'EOF'
---
what: New context
keywords:
  - testing add
---
# New
EOF
```

**실행:**
```bash
ctx add new.ctx.md
```

**검증:**
- [ ] "add: new.ctx.md" 메시지 출력
- [ ] `.ctx/registry.yaml`에 등록됨
- [ ] 중복 실행 시 "already registered" 메시지

**Global 옵션 테스트:**
```bash
ctx add --global ~/.ctx/contexts/test.md
```
- [ ] Global registry에 등록됨

### 3.2 ctx remove

**테스트 경로:** `/tmp/ctx-test`

**실행:**
```bash
ctx remove test.ctx.md
```

**검증:**
- [ ] "remove: test.ctx.md" 메시지 출력
- [ ] 파일은 삭제되지 않음 (ls로 확인)
- [ ] `.ctx/registry.yaml`에서 제거됨
- [ ] "Note: files are NOT deleted" 안내 메시지 표시

---

## 테스트 정리

```bash
# 테스트 디렉토리 삭제
rm -rf /tmp/ctx-test /tmp/legacy-test

# Global ctx 삭제 (선택)
rm -rf ~/.ctx
```

---

## 결과 요약

| Phase | 항목 | 상태 |
|-------|------|------|
| 1 | 빌드 성공 | [ ] |
| 1 | work prompt 제거 | [ ] |
| 1 | work 섹션 제거 | [ ] |
| 2 | Global init | [ ] |
| 2 | Project init | [ ] |
| 2 | 3-level sync | [ ] |
| 2 | Global index | [ ] |
| 3 | ctx add | [ ] |
| 3 | ctx remove | [ ] |

**전체 테스트 통과:** [ ]
