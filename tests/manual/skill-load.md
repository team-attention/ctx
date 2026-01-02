# /ctx.load Skill 테스트

> AI Skill은 `claude -p` 옵션으로 자동화 테스트가 가능합니다!
> 자동화가 어려운 케이스만 수동으로 검증합니다.

---

## 자동화 테스트 (권장)

```bash
# E2E 테스트 실행
./tests/e2e/07-skill-load.sh

# 또는 직접 실행
claude -p "인증 관련 컨텍스트 찾아줘" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions \
  --max-turns 5

# 명시적 /ctx.load 호출
claude -p "/ctx.load API" \
  --output-format json \
  --allowedTools "Bash(ctx:*),Read"

# 모든 컨텍스트 조회
claude -p "등록된 컨텍스트 목록 보여줘" \
  --allowedTools "Bash(ctx:*),Read"
```

---

## 사전 조건

```bash
# 1. CTX 초기화
ctx init                     # Global
ctx init .                   # Project

# 2. 테스트용 컨텍스트 생성
ctx create --project auth-patterns
ctx create --project api-design
ctx sync

# 3. Plugin 설치 확인
ls ~/.claude/plugins/        # ctx plugin 있어야 함

# 4. 빌드 확인
pnpm build
```

---

## Test 1: 키워드 검색 (자동화 가능)

### CLI 테스트
```bash
claude -p "인증 관련 컨텍스트 찾아줘" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions
```

### 검증 항목
- [ ] ctx-load Skill 활성화
- [ ] ctx status 호출하여 목록 조회
- [ ] what 필드에서 키워드 매칭
- [ ] 매칭된 파일 Read로 로드
- [ ] 내용 출력

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 2: /ctx.load 명시적 호출 (자동화 가능)

### CLI 테스트
```bash
# 단일 키워드
claude -p "/ctx.load auth" --allowedTools "Bash(ctx:*),Read"

# 복수 키워드
claude -p "/ctx.load API design" --allowedTools "Bash(ctx:*),Read"
```

### 검증 항목
- [ ] /ctx.load 커맨드 인식
- [ ] 키워드 기반 검색 수행
- [ ] 결과 출력

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 3: 자연어 검색 (수동 권장)

### 시나리오
> 자연어로 context 검색

### 테스트 문구

| 입력 | 예상 동작 | 결과 |
|------|----------|------|
| "인증 관련 컨텍스트 보여줘" | auth 관련 검색 | [ ] |
| "API 설계 가이드 찾아" | api-design 검색 | [ ] |
| "아키텍처 문서 있어?" | architecture 검색 | [ ] |
| "코딩 스타일 규칙" | coding-style 검색 | [ ] |

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 4: 3-Level 검색 우선순위 (자동화 가능)

### CLI 테스트
```bash
# Project + Global 모두 검색
claude -p "모든 레벨에서 코딩 관련 컨텍스트 찾아줘" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions
```

### 검증 항목
- [ ] Project context 먼저 표시
- [ ] Global context 다음 표시
- [ ] 우선순위 명시 (있으면)

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 5: 결과 없음 처리 (자동화 가능)

### CLI 테스트
```bash
claude -p "블록체인 관련 컨텍스트 찾아줘" \
  --allowedTools "Bash(ctx:*),Read" \
  --dangerously-skip-permissions
```

### 검증 항목
- [ ] 크래시 없이 처리
- [ ] "없음" 또는 "찾을 수 없음" 메시지
- [ ] 대안 제시 (있으면)

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 6: 전체 목록 조회 (자동화 가능)

### CLI 테스트
```bash
# --all 옵션
claude -p "/ctx.load --all" \
  --allowedTools "Bash(ctx:*),Read"

# 자연어
claude -p "등록된 모든 컨텍스트 목록 보여줘" \
  --allowedTools "Bash(ctx:*),Read"
```

### 검증 항목
- [ ] Global contexts 표시
- [ ] Project contexts 표시
- [ ] Local contexts 표시 (있으면)
- [ ] 각 context의 what 필드 표시

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 7: 특정 파일 context 로드 (수동)

### 시나리오
> 특정 소스 파일에 연결된 context 확인

### 테스트 단계

1. **Local context 생성**
   ```bash
   echo "export function handler() {}" > src/api.ts
   ctx create src/api.ts
   ctx sync
   ```

2. **Claude에게 요청**
   ```
   User: src/api.ts 파일의 컨텍스트 보여줘
   ```

3. **검증 항목**
   - [ ] target 기반 매칭
   - [ ] src/api.ctx.md 내용 로드
   - [ ] 관련 context 표시

### 결과
- [ ] **PASS** / **FAIL**

---

## Test 8: Hook 자동 로드와의 차이 (수동)

### 시나리오
> /ctx.load는 수동 검색, Hook은 자동 주입

### 비교

| 항목 | Hook 자동 로드 | /ctx.load Skill |
|-----|---------------|-----------------|
| 트리거 | Read tool 호출 | 사용자 요청 |
| 검색 방식 | target 필드 매칭 | 키워드 검색 |
| 결과 | additionalContext 주입 | 대화로 표시 |
| 대상 | target 있는 context만 | 모든 context |

### 결과
- [ ] 차이점 명확히 이해됨

---

## 전체 결과 요약

| 테스트 | 자동화 | 상태 |
|-------|--------|------|
| Test 1: 키워드 검색 | O | [ ] |
| Test 2: /ctx.load 명시적 | O | [ ] |
| Test 3: 자연어 검색 | △ | [ ] |
| Test 4: 3-Level 우선순위 | O | [ ] |
| Test 5: 결과 없음 | O | [ ] |
| Test 6: 전체 목록 | O | [ ] |
| Test 7: 특정 파일 | X | [ ] |
| Test 8: Hook 비교 | X | [ ] |

**전체 통과:** [ ] / 8

---

## 참고: SKILL.md 동작 확인

```bash
# Skill 파일 위치
cat plugin/skills/ctx-load/SKILL.md

# Skill 활성화 조건 (frontmatter)
# - name: ctx-load
# - description: 컨텍스트 조회, 검색, 로드 관련 키워드 반응
# - allowed-tools: Bash, Read

# 동작 흐름:
# 1. ctx status 호출 → context 목록
# 2. what 필드 분석 → 키워드 매칭
# 3. Read tool → context 내용 로드
# 4. 사용자에게 표시
```

---

## CLI 자동화 팁

```bash
# 여러 테스트 한 번에
for keyword in "auth" "API" "아키텍처"; do
  echo "=== Testing: $keyword ==="
  claude -p "/ctx.load $keyword" \
    --allowedTools "Bash(ctx:*),Read" \
    --dangerously-skip-permissions \
    --max-turns 3
done

# JSON으로 결과 파싱
claude -p "인증 컨텍스트 찾아줘" \
  --output-format json \
  --allowedTools "Bash(ctx:*),Read" | jq '.result'

# 세션 이어가기
session=$(claude -p "컨텍스트 검색해줘" --output-format json | jq -r '.session_id')
claude -p "더 자세히 보여줘" --resume "$session"
```
