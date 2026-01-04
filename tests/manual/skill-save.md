# /ctx.save Skill 테스트

> AI Skill은 `claude -p` 옵션으로 자동화 테스트가 가능합니다!
> 자동화가 어려운 케이스만 수동으로 검증합니다.

---

## 자동화 테스트 (권장)

```bash
# E2E 테스트 실행
./tests/e2e/06-skill-save.sh

# 또는 직접 실행
claude -p "JWT 인증 패턴 저장해줘" \
  --allowedTools "Bash(ctx:*),Read,Write,Edit" \
  --dangerously-skip-permissions \
  --max-turns 5

# JSON 출력으로 결과 파싱
claude -p "/ctx.save 테스트 컨텍스트" \
  --output-format json \
  --allowedTools "Bash(ctx:*),Read,Write,Edit"
```

---

## 사전 조건

```bash
# 1. CTX 초기화
ctx init                     # Global
ctx init .                   # Project

# 2. Plugin 설치 확인
ls ~/.claude/plugins/        # ctx plugin 있어야 함

# 3. 빌드 확인
pnpm build
```

---

## Test 1: Quick Mode 기본 동작

### 시나리오
> 대화 중 생성된 내용을 빠르게 저장

### 테스트 단계

1. **Claude Code에서 대화 시작**
   ```
   User: JWT 인증 구현 방법 알려줘
   Claude: [JWT 인증에 대한 상세 설명]
   ```

2. **저장 요청**
   ```
   User: 이거 저장해줘
   ```

3. **검증 항목**
   - [ ] ctx-save Skill이 활성화됨
   - [ ] "Quick mode" 또는 즉시 저장 흐름 진행
   - [ ] scope 자동 추천 (Global/Project/Local)
   - [ ] 저장 위치 1개 추천 (예: `.ctx/contexts/auth-jwt.md`)
   - [ ] 확인 프롬프트: "이대로 저장할까요? [Y/n]"
   - [ ] Y 입력 후 파일 생성
   - [ ] registry에 자동 등록

4. **결과 확인**
   ```bash
   cat .ctx/contexts/auth-jwt.md   # 파일 내용 확인
   cat .ctx/registry.yaml          # 등록 확인
   ```

### 결과
- [ ] **PASS** / **FAIL**
- 메모: _______________

---

## Test 2: Quick Mode 트리거 문구

### 시나리오
> 다양한 트리거 문구로 Quick mode 활성화 확인

### 테스트 문구

| 입력 | 예상 동작 | 결과 |
|------|----------|------|
| "이거 저장해줘" | Quick mode | [ ] |
| "save this" | Quick mode | [ ] |
| "remember this" | Quick mode | [ ] |
| "/ctx.save" | Quick mode | [ ] |
| "컨텍스트로 저장" | Quick mode | [ ] |

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 3: Deliberate Mode - URL

### 시나리오
> URL에서 내용 추출하여 저장

### 테스트 단계

1. **URL 제공**
   ```
   User: 이 문서에서 중요한 내용 추출해서 저장해줘
   User: https://docs.example.com/api-guide
   ```

2. **검증 항목**
   - [ ] URL fetch (WebFetch 사용)
   - [ ] 내용 추출 및 프리뷰
   - [ ] 저장 위치 선택
   - [ ] 파일 생성 및 등록

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 4: 기존 Context 업데이트

### 시나리오
> 이미 존재하는 context 파일 수정

### 테스트 단계

1. **기존 context 확인**
   ```bash
   cat .ctx/contexts/architecture.md
   ```

2. **업데이트 요청**
   ```
   User: architecture 컨텍스트에 마이크로서비스 패턴 추가해줘
   ```

3. **검증 항목**
   - [ ] 기존 파일 인식
   - [ ] 변경사항 diff 표시
   - [ ] merge/override 선택
   - [ ] 업데이트 후 sync 자동 실행

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 5: Scope 자동 결정 로직

### 시나리오
> AI가 적절한 scope를 추천하는지 확인

### 테스트 케이스

| 내용 유형 | 예상 Scope | 결과 |
|----------|-----------|------|
| 개인 코딩 스타일 | Global | [ ] |
| 프로젝트 아키텍처 | Project | [ ] |
| 특정 파일 전용 | Local | [ ] |
| 범용 도구 사용법 | Global | [ ] |
| API 엔드포인트 설명 | Project | [ ] |

### 결과
- [ ] **PASS** / **FAIL**
- 메모: _______________

---

## Test 6: 저장 후 자동 Sync

### 시나리오
> 저장 후 registry와 Global index가 갱신되는지 확인

### 테스트 단계

1. **저장 전 상태 기록**
   ```bash
   cat .ctx/registry.yaml > /tmp/before.yaml
   cat ~/.ctx/registry.yaml > /tmp/before-global.yaml
   ```

2. **새 context 저장**
   ```
   User: 이 패턴 저장해줘
   ```

3. **저장 후 확인**
   ```bash
   diff /tmp/before.yaml .ctx/registry.yaml
   diff /tmp/before-global.yaml ~/.ctx/registry.yaml
   ```

4. **검증 항목**
   - [ ] Project registry 갱신됨
   - [ ] Global index 갱신됨 (context_count 증가)
   - [ ] checksum 포함

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 7: 에러 처리

### 시나리오
> 저장 실패 시 graceful 처리

### 테스트 케이스

| 상황 | 예상 동작 | 결과 |
|-----|----------|------|
| 권한 없는 경로 | 에러 메시지 + 대안 제시 | [ ] |
| 디스크 풀 | 에러 메시지 | [ ] |
| 이미 존재하는 파일 | 덮어쓰기 확인 | [ ] |
| registry 손상 | 복구 시도 또는 경고 | [ ] |

### 결과
- [ ] **PASS** / **FAIL**

---

## 전체 결과 요약

| 테스트 | 상태 |
|-------|------|
| Test 1: Quick Mode 기본 | [ ] |
| Test 2: Quick Mode 트리거 | [ ] |
| Test 3: Deliberate - URL | [ ] |
| Test 4: 기존 Context 업데이트 | [ ] |
| Test 5: Scope 자동 결정 | [ ] |
| Test 6: 자동 Sync | [ ] |
| Test 7: 에러 처리 | [ ] |

**전체 통과:** [ ] / 7

---

## 참고: SKILL.md 동작 확인

```bash
# Skill 파일 위치
cat plugin/skills/ctx-save/SKILL.md

# Skill 활성화 조건 (frontmatter)
# - name: ctx-save
# - description: 저장 관련 키워드 반응
# - allowed-tools: Bash, Edit, Read, Write
```
