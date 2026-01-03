# CTX E2E Test Cases (BDD)

> RFC: 3-Level Context System 기반 테스트 케이스
> 작성일: 2026-01-01
> 최종 수정: 2026-01-02 (간소화)
> 형식: Behavior Driven Development (Given-When-Then)

---

## 1. Load (컨텍스트 로드)

### 1.1 CLI (ctx status, ctx load)

```gherkin
Feature: Context 상태 확인 및 로드

# --- ctx status ---

Scenario: Project 내에서 status 확인
  Given ~/.ctx/registry.yaml이 존재하고
  And 현재 디렉토리에 .ctx/registry.yaml이 존재하고
  And .ctx/registry.yaml에 3개의 context가 등록되어 있을 때
  When ctx status를 실행하면
  Then Project 이름, context_paths, 등록된 context 3개가 표시된다

Scenario: Project 없는 곳에서 status 확인
  Given 현재 디렉토리에 .ctx/registry.yaml이 없을 때
  When ctx status를 실행하면
  Then "No project found" 경고와 함께 Global context만 표시된다

Scenario: 전체 status 확인 (--all)
  Given ~/.ctx/registry.yaml의 index에 3개의 프로젝트가 등록되어 있을 때
  When ctx status --all을 실행하면
  Then 모든 프로젝트의 context 요약이 표시된다

# --- ctx load --target (Hook용) ---

Scenario: ctx load --target로 target 매칭
  Given .ctx/registry.yaml에 target이 있는 context가 등록되어 있을 때
  When ctx load --target <path> --json을 실행하면
  Then 매칭된 context의 path, what 필드가 JSON 배열로 출력된다

Scenario: 매칭되는 context 없음
  Given 해당 파일에 매칭되는 target이 없을 때
  When ctx load --target <path>를 실행하면
  Then 빈 배열 []이 출력된다
```

---

### 1.2 Hook (자동 로드)

> PostToolUse(Read) Hook → `ctx load --target` → context 자동 주입

```gherkin
Feature: 파일 읽을 때 자동 Context 로드

Background:
  # target 필드가 있는 context만 autoload 대상
  # 우선순위: Project exact > Global exact > Project glob > Global glob

Scenario: Exact target 매칭
  Given src/api.ctx.md가 target: "src/api.ts"로 등록되어 있을 때
  When Claude가 Read tool로 src/api.ts를 읽으면
  Then src/api.ctx.md 내용이 자동으로 주입된다

Scenario: Glob pattern 매칭
  Given context가 target: "src/**/*.ts"로 등록되어 있을 때
  When Claude가 Read tool로 src/utils/helper.ts를 읽으면
  Then 해당 context가 자동으로 주입된다

Scenario: target 없는 context는 자동 로드 안 됨
  Given .ctx/contexts/architecture.md에 target이 없을 때
  When Claude가 Read tool로 아무 파일을 읽어도
  Then architecture.md는 자동 주입되지 않는다

Scenario: 우선순위 적용
  Given Project에 exact/glob context, Global에 exact/glob context가 있을 때
  When Claude가 Read tool로 해당 파일을 읽으면
  Then Project exact → Global exact → Project glob → Global glob 순으로 주입된다
```

---

### 1.3 Skill (/ctx.load)

> 키워드 기반 검색 및 수동 로드

```gherkin
Feature: 수동 Context 조회 (/ctx.load Skill)

Scenario: 키워드로 context 검색
  Given 여러 context가 등록되어 있을 때
  When 사용자가 "인증 관련 컨텍스트 보여줘"라고 말하면
  Then ctx-load Skill이 활성화되고
  And registry의 what/when 필드로 키워드 매칭하여 로드한다

Scenario: 명시적 호출
  When 사용자가 "/ctx.load auth"를 실행하면
  Then "auth" 키워드로 검색하여 매칭된 context를 로드한다

Scenario: 전체 context 확인
  When 사용자가 "/ctx.load --all"을 실행하면
  Then 모든 레벨(Global/Project/Local)의 context 요약이 표시된다
```

---

## 2. Save (컨텍스트 저장)

### 2.1 CLI (ctx create, ctx add, ctx remove)

```gherkin
Feature: Context 파일 생성 및 등록

# --- ctx create ---

Scenario: Local context 생성
  Given 프로젝트가 초기화되어 있을 때
  When ctx create src/utils.ts를 실행하면
  Then src/utils.ctx.md가 생성되고 registry에 target으로 등록된다

Scenario: Project context 생성
  When ctx create --project architecture를 실행하면
  Then .ctx/contexts/architecture.md가 생성되고 registry에 등록된다

Scenario: Global context 생성
  When ctx create --global typescript-rules를 실행하면
  Then ~/.ctx/contexts/typescript-rules.md가 생성되고 Global registry에 등록된다

# --- ctx add ---

Scenario: 기존 파일 등록
  Given docs/api.md 파일이 존재할 때
  When ctx add docs/api.md를 실행하면
  Then registry에 등록되고 checksum이 저장된다

Scenario: Glob 패턴으로 일괄 등록
  Given docs/ 폴더에 3개의 .md 파일이 있을 때
  When ctx add docs/**/*.md를 실행하면
  Then 3개 파일이 모두 registry에 등록된다

# --- ctx remove ---

Scenario: 등록 해제
  Given docs/old.md가 registry에 등록되어 있을 때
  When ctx remove docs/old.md를 실행하면
  Then registry에서 제거되고 (파일은 삭제 안 됨)
```

---

### 2.2 Skill (/ctx.save)

```gherkin
Feature: Context 저장 (/ctx.save Skill)

Scenario: 세션에서 저장 (Quick)
  Given Claude와 대화 중 유의미한 결정이 있었을 때
  When 사용자가 "이거 저장해줘"라고 말하면
  Then ctx-save Skill이 활성화되고
  And scope/위치를 자동 추천하고
  And 확인 후 ctx create + Edit으로 저장한다

Scenario: 외부 소스에서 추출 (Deliberate)
  When 사용자가 "Slack에서 추출해줘" 또는 URL을 제공하면
  Then 외부 소스에서 내용을 가져오고
  And 사용자가 리뷰/수정 후 저장한다

Scenario: 기존 context 업데이트
  Given src/api.ctx.md가 이미 존재할 때
  When 사용자가 "API 컨텍스트 업데이트해줘"라고 말하면
  Then 기존 내용과 비교하여 변경사항을 보여주고 업데이트한다
```

---

## 3. Sync & Check

```gherkin
Feature: Registry 동기화 및 헬스 체크

# --- ctx sync ---

Scenario: Project sync
  Given 등록된 context 중 2개 파일이 수정되었을 때
  When ctx sync를 실행하면
  Then checksum이 업데이트되고 Global index도 갱신된다

Scenario: 삭제된 파일 감지
  Given registry에 등록된 파일이 삭제되었을 때
  When ctx sync를 실행하면
  Then 경고가 표시되고 registry에서 제거된다

Scenario: Project 없는 곳에서 sync
  Given 현재 디렉토리에 .ctx/가 없을 때
  When ctx sync를 실행하면
  Then "No project found" 경고와 함께 Global만 동기화된다

# --- ctx check ---

Scenario: 헬스 체크
  When ctx check를 실행하면
  Then 파일 존재 여부, checksum 일치 여부를 확인하고 결과를 표시한다

Scenario: Strict 모드
  Given context 파일에 frontmatter가 없을 때
  When ctx check --strict를 실행하면
  Then "frontmatter 누락" 경고가 표시된다
```

---

## 4. Init (초기화)

```gherkin
Feature: CTX 초기화

# --- ctx init (Global) ---

Scenario: Global 초기화
  Given ~/.ctx/가 존재하지 않을 때
  When ctx init을 실행하면
  Then ~/.ctx/registry.yaml, ~/.ctx/contexts/가 생성되고
  And Claude Code plugin 설치 안내가 표시된다

Scenario: 이미 초기화된 경우
  Given ~/.ctx/registry.yaml이 이미 존재할 때
  When ctx init을 실행하면
  Then "이미 초기화되어 있습니다" 메시지가 표시된다

# --- ctx init . (Project) ---

Scenario: Project 초기화
  Given ~/.ctx/가 초기화되어 있고 현재 디렉토리에 .ctx/가 없을 때
  When ctx init .을 실행하면
  Then .ctx/registry.yaml, .ctx/contexts/가 생성되고
  And Global index에 이 프로젝트가 추가된다

Scenario: Global 미초기화 상태에서 Project init
  Given ~/.ctx/registry.yaml이 없을 때
  When ctx init .을 실행하면
  Then "먼저 ctx init으로 Global을 초기화하세요" 에러가 표시된다
```

---

## 5. 통합 시나리오

```gherkin
Feature: 신규 사용자 온보딩 플로우

Scenario: 처음부터 사용까지 전체 플로우
  Given CTX가 설치되어 있고 처음 사용할 때

  # 1. Global 초기화
  When ctx init을 실행하면
  Then ~/.ctx/가 생성된다

  # 2. Project 초기화
  When 프로젝트에서 ctx init .을 실행하면
  Then .ctx/가 생성된다

  # 3. 기존 문서 등록
  When ctx add docs/**/*.md를 실행하면
  Then 문서들이 registry에 등록된다

  # 4. 자동 로드 확인
  When Claude가 src/api.ts를 읽으면
  Then 매칭된 context가 자동 주입된다

  # 5. 새 context 저장
  When 사용자가 "이 내용 저장해줘"라고 말하면
  Then AI가 적절한 위치에 context를 저장한다
```

```gherkin
Feature: Context 소속 결정

Scenario: Project 내 파일은 Project 소속
  Given ~/projects/myapp/.ctx/registry.yaml이 존재할 때
  When ~/projects/myapp/src/api.ctx.md를 생성하면
  Then Project registry에 등록된다

Scenario: Project 없는 파일은 Global 소속
  Given ~/notes/에 .ctx/가 없을 때
  When ~/notes/tip.ctx.md를 생성하면
  Then Global registry에 등록된다
```

---

## 6. Edge Cases

```gherkin
Feature: 에러 및 충돌 처리

Scenario: registry.yaml 파싱 실패
  Given .ctx/registry.yaml이 잘못된 YAML 형식일 때
  When ctx status를 실행하면
  Then "registry.yaml 파싱 실패" 에러와 복구 방법이 표시된다

Scenario: context 중복 생성 시도
  Given src/api.ctx.md가 이미 존재할 때
  When ctx create src/api.ts를 실행하면
  Then "이미 존재합니다. 덮어쓰시겠습니까?" 확인이 표시된다
```
