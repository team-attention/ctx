# E2E Test Cases

사용자의 실제 행동 패턴을 기반으로 한 핵심 테스트 케이스.

---

## 1. 프로젝트에 CTX 도입하기

### Scenario: 새 프로젝트에서 ctx 시작

```gherkin
Given 빈 프로젝트 디렉토리가 있다
When `ctx init .` 실행
Then .ctx/ 디렉토리가 생성된다
And .ctx/registry.yaml이 생성된다
And .ctx/contexts/ 디렉토리가 생성된다
```

### Scenario: 이미 초기화된 프로젝트에서 재초기화 시도

```gherkin
Given .ctx/ 디렉토리가 이미 존재한다
When `ctx init .` 실행
Then 에러 메시지가 표시된다
And 기존 .ctx/ 내용이 보존된다
```

---

## 2. 컨텍스트 생성하기

### Scenario: 팀 지식을 standalone 컨텍스트로 저장

```gherkin
Given ctx가 초기화된 프로젝트가 있다
When `ctx create .ctx/contexts/architecture.md` 실행
Then 파일이 생성된다
And frontmatter에 what, when 필드가 포함된다
And target 필드는 없다 (standalone)
```

### Scenario: 특정 파일에 바인딩된 컨텍스트 생성

```gherkin
Given src/api.ts 파일이 존재한다
When `ctx create src/api.ctx.md --target src/api.ts` 실행
Then src/api.ctx.md 파일이 생성된다
And frontmatter에 target: src/api.ts가 있다
```

---

## 3. 기존 문서를 컨텍스트로 활용하기

### Scenario: 이미 있는 markdown 파일들을 컨텍스트로 등록

```gherkin
Given docs/guide.md 파일이 존재한다 (frontmatter 없음)
When `ctx adopt docs/guide.md` 실행
Then docs/guide.md에 ctx frontmatter가 추가된다
And registry에 등록된다
```

### Scenario: glob 패턴으로 여러 파일 한번에 등록

```gherkin
Given docs/ 아래 여러 .md 파일이 있다
When `ctx add docs/**/*.md` 실행
Then 모든 매칭된 파일이 registry에 등록된다
```

---

## 4. 컨텍스트 로드하기

### Scenario: 키워드로 관련 컨텍스트 검색

```gherkin
Given keywords: ["api", "routing"] 가진 컨텍스트가 있다
When `ctx load api` 실행
Then 해당 컨텍스트 내용이 출력된다
```

### Scenario: 특정 파일 작업 시 바인딩된 컨텍스트 로드

```gherkin
Given src/api.ctx.md가 target: src/api.ts로 바인딩되어 있다
When `ctx load --target src/api.ts` 실행
Then src/api.ctx.md 내용이 출력된다
```

### Scenario: 여러 키워드로 복합 검색

```gherkin
Given "api" 키워드 가진 컨텍스트 2개
And "auth" 키워드 가진 컨텍스트 1개
When `ctx load api auth` 실행
Then 3개 컨텍스트 모두 로드된다 (중복 제거)
```

---

## 5. 컨텍스트 저장하기 (AI 학습 내용 저장)

### Scenario: 새로운 컨텍스트를 프로젝트에 저장

```gherkin
Given ctx가 초기화된 프로젝트가 있다
When `ctx save --project --path "api-patterns" --content "..."` 실행
Then .ctx/contexts/api-patterns.md 파일이 생성된다
And registry에 자동 등록된다
```

### Scenario: 기존 컨텍스트 내용 업데이트

```gherkin
Given .ctx/contexts/tips.md 파일이 존재한다
When `ctx save --path .ctx/contexts/tips.md --content "새 내용"` 실행
Then 파일 내용이 업데이트된다
And checksum이 갱신된다
```

---

## 6. 동기화하기

### Scenario: 수동으로 추가한 파일을 registry에 반영

```gherkin
Given .ctx/contexts/new-context.md를 직접 생성했다 (에디터로)
When `ctx sync` 실행
Then registry에 해당 파일이 등록된다
And preview가 frontmatter에서 추출된다
```

### Scenario: 삭제된 파일을 registry에서 정리

```gherkin
Given registry에 old.md가 등록되어 있다
And old.md 파일이 삭제되었다
When `ctx sync` 실행
Then registry에서 old.md 항목이 제거된다
```

### Scenario: context_paths 패턴과 일치하지 않는 항목 정리

```gherkin
Given context_paths: ["**/*.ctx.md", ".ctx/contexts/**/*.md"]
And registry에 docs/random.md가 등록되어 있다
When `ctx sync --prune` 실행
Then docs/random.md가 registry에서 제거된다
```

---

## 7. 상태 확인하기

### Scenario: 현재 프로젝트 상태 확인

```gherkin
Given 여러 컨텍스트가 등록되어 있다
When `ctx status --pretty` 실행
Then 등록된 컨텍스트 목록이 표시된다
And 각 컨텍스트의 what, when 정보가 표시된다
```

### Scenario: 특정 파일의 컨텍스트 확인

```gherkin
Given src/api.ts에 바인딩된 컨텍스트가 있다
When `ctx status --target src/api.ts` 실행
Then 해당 바인딩된 컨텍스트 정보가 표시된다
```

---

## 8. 에러 핸들링

### Scenario: 존재하지 않는 파일 추가 시도

```gherkin
Given nonexistent.md 파일이 없다
When `ctx add nonexistent.md` 실행
Then 에러 메시지가 표시된다
And registry는 변경되지 않는다
```

### Scenario: 잘못된 frontmatter가 있는 파일

```gherkin
Given broken.md에 잘못된 YAML frontmatter가 있다
When `ctx sync` 실행
Then 경고 메시지가 표시된다
And 다른 정상 파일들은 처리된다
```

---

## 9. Global vs Project 컨텍스트

### Scenario: 글로벌 컨텍스트 초기화

```gherkin
Given ~/.ctx/ 디렉토리가 없다
When `ctx init` 실행 (인자 없이)
Then ~/.ctx/ 디렉토리가 생성된다
And ~/.ctx/registry.yaml이 생성된다
```

### Scenario: 글로벌 컨텍스트 로드 시 프로젝트와 병합

```gherkin
Given 글로벌에 "coding-style" 컨텍스트가 있다
And 프로젝트에 "api" 컨텍스트가 있다
When `ctx load coding-style api` 실행
Then 두 컨텍스트 모두 로드된다
```

---

## 10. 패턴 관리

### Scenario: context_paths에 새 패턴 추가

```gherkin
Given context_paths: ["**/*.ctx.md"]
When `ctx add-pattern "docs/**/*.md" "문서화 파일"` 실행
Then context_paths에 "docs/**/*.md" 패턴이 추가된다
And 해당 패턴과 매칭되는 파일들이 registry에 등록된다
```
