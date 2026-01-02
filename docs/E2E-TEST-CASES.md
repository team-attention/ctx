# CTX E2E Test Cases (BDD)

> RFC: 3-Level Context System 기반 테스트 케이스
> 작성일: 2026-01-01
> 최종 수정: 2026-01-02 (Load 단순화 반영)
> 형식: Behavior Driven Development (Given-When-Then)

---

## 1. Load (컨텍스트 로드)

### 1.1 CLI

#### `ctx status`

```gherkin
Feature: Context Status 확인

Scenario: Project 내에서 status 확인
  Given ~/.ctx/registry.yaml이 존재하고
  And 현재 디렉토리에 .ctx/registry.yaml이 존재하고
  And .ctx/registry.yaml에 3개의 context가 등록되어 있을 때
  When ctx status를 실행하면
  Then Project 이름이 표시되고
  And context_paths 목록이 표시되고
  And 등록된 context 3개의 상태가 표시된다

Scenario: Project 없는 곳에서 status 확인
  Given ~/.ctx/registry.yaml이 존재하고
  And 현재 디렉토리에 .ctx/registry.yaml이 없을 때
  When ctx status를 실행하면
  Then "No project found" 경고가 표시되고
  And Global context 상태만 표시된다

Scenario: Global status 확인
  Given ~/.ctx/registry.yaml에 5개의 context가 등록되어 있을 때
  When ctx status --global을 실행하면
  Then Global context_paths가 표시되고
  And 등록된 Global context 5개가 표시된다

Scenario: 전체 status 확인 (index 기반)
  Given ~/.ctx/registry.yaml의 index에 3개의 프로젝트가 등록되어 있을 때
  When ctx status --all을 실행하면
  Then 모든 프로젝트의 context 요약이 표시된다
```

#### `ctx load`

> **Note**: `ctx load`는 매칭된 context의 **경로/메타데이터만 반환**합니다.
> 실제 파일 읽기는 Hook Script가 담당합니다.

```gherkin
Feature: Context 로드 (CLI - Hook용)

Scenario: ctx load --file로 exact target 매칭 (JSON 출력)
  Given .ctx/registry.yaml에 target: "src/api.ts"인 context가 있을 때
  When ctx load --file src/api.ts --json를 실행하면
  Then JSON 배열로 매칭된 context 정보가 출력된다
  And 각 항목에 path, what 필드가 포함된다

Scenario: ctx load --file로 glob target 매칭
  Given .ctx/registry.yaml에 target: "src/**/*.ts"인 context가 있을 때
  When ctx load --file src/utils/helper.ts를 실행하면
  Then 해당 context의 경로가 JSON으로 출력된다

Scenario: ctx load --file --paths로 경로만 출력
  Given 2개의 context가 target에 매칭될 때
  When ctx load --file src/api.ts --paths를 실행하면
  Then 줄바꿈으로 구분된 경로 목록이 출력된다

Scenario: ctx load --file에서 target 없는 context 제외
  Given .ctx/contexts/architecture.md에 target이 없을 때
  When ctx load --file src/api.ts를 실행하면
  Then architecture.md는 결과에 포함되지 않는다

Scenario: 매칭되는 context 없음
  Given src/random.ts에 매칭되는 target이 없을 때
  When ctx load --file src/random.ts를 실행하면
  Then 빈 배열 []이 출력된다
```

---

### 1.2 Hook (자동 로드)

#### PostToolUse(Read) → Hook Script → ctx load

> **Note**: target 필드가 있는 context만 autoload 대상입니다.
> Hook Script가 `ctx load --file`을 호출하고, 반환된 경로의 파일들을 읽어 주입합니다.

```gherkin
Feature: 파일 읽을 때 자동 Context 로드

Background:
  # 동작 흐름:
  #   1. PostToolUse(Read) hook 트리거
  #   2. Hook Script가 stdin에서 file_path 추출
  #   3. ctx load --file 호출 → JSON으로 매칭된 context 경로 반환
  #   4. Hook Script가 각 경로의 파일을 읽어서 조합
  #   5. stdout으로 출력 → additionalContext로 주입
  #
  # Autoload 대상: target 필드가 있는 context만
  # 우선순위: Project exact > Global exact > Project glob > Global glob

Scenario: Exact target 매칭 (Project)
  Given 프로젝트에 src/api.ts 파일이 있고
  And src/api.ctx.md 파일이 존재하고
  And .ctx/registry.yaml에 src/api.ctx.md가 target: "src/api.ts"로 등록되어 있을 때
  When Claude가 Read tool로 src/api.ts를 읽으면
  Then src/api.ctx.md 내용이 자동으로 주입된다

Scenario: Glob pattern target 매칭 (Project)
  Given .ctx/registry.yaml에 target: "src/**/*.ts"인 context가 있을 때
  When Claude가 Read tool로 src/utils/helper.ts를 읽으면
  Then 해당 context가 자동으로 주입된다

Scenario: Exact target 매칭 (Global)
  Given ~/.ctx/contexts/api-guide.md가 있고
  And ~/.ctx/registry.yaml에 target: "src/api.ts"로 등록되어 있을 때
  When Claude가 Read tool로 src/api.ts를 읽으면
  Then api-guide.md 내용이 자동으로 주입된다

Scenario: Glob pattern target 매칭 (Global)
  Given ~/.ctx/contexts/typescript-rules.md가 있고
  And ~/.ctx/registry.yaml에 target: "**/*.ts"로 등록되어 있을 때
  When Claude가 Read tool로 src/utils/helper.ts를 읽으면
  Then typescript-rules.md 내용이 자동으로 주입된다

Scenario: target 없는 context는 자동 로드 안 됨
  Given .ctx/contexts/architecture.md에 target이 없을 때
  When Claude가 Read tool로 아무 파일을 읽어도
  Then architecture.md는 자동 주입되지 않는다

Scenario: 우선순위 (Project exact > Global exact > Project glob > Global glob)
  Given Project에 target: "src/api.ts" (exact) context가 있고
  And Global에 target: "src/api.ts" (exact) context가 있고
  And Project에 target: "src/**/*.ts" (glob) context가 있고
  And Global에 target: "**/*.ts" (glob) context가 있을 때
  When Claude가 Read tool로 src/api.ts를 읽으면
  Then Project exact context가 가장 먼저 표시되고
  And Global exact context가 그 다음 표시되고
  And Project glob context가 그 다음 표시되고
  And Global glob context가 마지막으로 표시된다

Scenario: Project가 없는 경우
  Given 현재 디렉토리에 .ctx/registry.yaml이 없고
  And ~/.ctx/contexts/global.md가 target: "**/*.ts"로 등록되어 있을 때
  When Claude가 Read tool로 src/app.ts를 읽으면
  Then Global context만 주입된다

Scenario: target이 매칭되지 않는 경우
  Given .ctx/registry.yaml에 target: "src/api.ts"인 context만 있을 때
  When Claude가 Read tool로 src/utils.ts를 읽으면
  Then 아무 context도 주입되지 않는다
```

#### Hook Script 동작

```gherkin
Feature: Hook Script (auto-load-context.sh)

Scenario: stdin에서 file_path 추출
  Given Hook이 트리거되어 stdin으로 JSON이 전달될 때
  When Hook Script가 실행되면
  Then tool_input.file_path를 추출하고
  And ctx load --file을 호출한다

Scenario: 여러 context 조합
  Given ctx load --file이 2개의 context를 반환할 때
  When Hook Script가 각 파일을 읽으면
  Then "--- path ---" 구분자로 내용을 조합하고
  And stdout으로 출력한다

Scenario: 매칭되는 context 없음
  Given ctx load --file이 빈 배열을 반환할 때
  When Hook Script가 실행되면
  Then 아무것도 출력하지 않고 종료한다

Scenario: file_path 없음
  Given stdin에 file_path가 없을 때
  When Hook Script가 실행되면
  Then 아무것도 출력하지 않고 종료한다
```

---

### 1.3 수동 조회

> **Note**: `/ctx.load` Skill은 제거되었습니다.
> 수동 조회는 `/ctx.status`로 목록 확인 후 AI가 직접 Read합니다.

```gherkin
Feature: 수동 Context 조회

Scenario: status로 목록 확인 후 AI가 읽기
  Given 여러 context가 등록되어 있을 때
  When 사용자가 "인증 관련 컨텍스트 보여줘"라고 말하면
  Then AI가 ctx status를 실행하여 목록을 확인하고
  And what 필드를 보고 관련 context를 판단하고
  And Read tool로 해당 파일을 직접 읽어서 보여준다

Scenario: 전체 context 목록 확인
  Given Project에 5개, Global에 3개의 context가 있을 때
  When 사용자가 "어떤 컨텍스트들이 있어?"라고 물으면
  Then AI가 ctx status --all을 실행하고
  And 모든 context 목록을 요약해서 보여준다
```

---

## 2. Save (컨텍스트 저장)

### 2.1 CLI

#### `ctx create`

```gherkin
Feature: Context 파일 생성

Scenario: Local context 생성
  Given 프로젝트가 초기화되어 있고 (.ctx/registry.yaml 존재)
  When ctx create src/utils.ts를 실행하면
  Then src/utils.ctx.md 파일이 생성되고
  And .ctx/registry.yaml에 target: src/utils.ts로 등록되고
  And ~/.ctx/registry.yaml의 index가 업데이트된다

Scenario: Project context 생성
  Given 프로젝트가 초기화되어 있고
  And settings.context_paths에 .ctx/contexts/가 있을 때
  When ctx create --project architecture를 실행하면
  Then .ctx/contexts/architecture.md 파일이 생성되고
  And .ctx/registry.yaml에 등록된다

Scenario: Global context 생성
  Given ~/.ctx/가 초기화되어 있을 때
  When ctx create --global typescript-rules를 실행하면
  Then ~/.ctx/contexts/typescript-rules.md 파일이 생성되고
  And ~/.ctx/registry.yaml에 등록된다

Scenario: 특정 경로에 생성
  Given settings.context_paths에 docs/가 있을 때
  When ctx create --path docs/ api-guide를 실행하면
  Then docs/api-guide.md 파일이 생성되고
  And registry에 등록된다

Scenario: 프로젝트 없이 생성 시 Global 소속
  Given 현재 디렉토리에 .ctx/registry.yaml이 없을 때
  When ctx create some-note를 실행하면
  Then ~/.ctx/registry.yaml에 등록된다
```

#### `ctx add`

```gherkin
Feature: 기존 파일을 Registry에 등록

Scenario: 단일 파일 등록
  Given docs/api.md 파일이 존재할 때
  When ctx add docs/api.md를 실행하면
  Then .ctx/registry.yaml에 docs/api.md가 등록되고
  And checksum이 계산되어 저장되고
  And ~/.ctx/registry.yaml의 index가 업데이트된다

Scenario: Glob 패턴으로 일괄 등록
  Given docs/ 폴더에 3개의 .md 파일이 있을 때
  When ctx add docs/**/*.md를 실행하면
  Then 3개의 파일이 모두 registry에 등록된다

Scenario: Global registry에 등록
  Given ~/notes/tip.md 파일이 존재할 때
  When ctx add --global ~/notes/tip.md를 실행하면
  Then ~/.ctx/registry.yaml에 등록된다

Scenario: 이미 등록된 파일
  Given docs/api.md가 이미 등록되어 있을 때
  When ctx add docs/api.md를 실행하면
  Then "이미 등록되어 있습니다" 메시지가 표시된다
```

#### `ctx remove`

```gherkin
Feature: Registry에서 등록 해제

Scenario: 단일 파일 해제
  Given docs/old.md가 registry에 등록되어 있을 때
  When ctx remove docs/old.md를 실행하면
  Then registry에서 해당 항목이 제거되고
  And 파일 자체는 삭제되지 않고
  And ~/.ctx/registry.yaml의 index가 업데이트된다

Scenario: Glob 패턴으로 일괄 해제
  Given test/ 폴더의 5개 파일이 등록되어 있을 때
  When ctx remove test/**/*.ctx.md를 실행하면
  Then 5개 파일이 모두 registry에서 제거된다
```

---

### 2.2 AI Command (Skill)

#### /ctx.save - Quick Mode

```gherkin
Feature: Quick Save (Zero-Friction)

Scenario: 세션에서 자동 추출하여 저장
  Given Claude와 대화 중 유의미한 결정이 있었을 때
  When 사용자가 "이거 저장해줘"라고 말하면
  Then ctx-save Skill이 활성화되고
  And AI가 세션에서 유의미한 내용을 자동 추출하고
  And scope(Global/Project/Local)를 자동 판단하고
  And settings.context_paths를 참조하여 저장 위치를 추천하고
  And "이거 맞죠?" 한 번 확인 후
  And ctx create를 호출하여 파일 생성하고
  And Edit tool로 내용을 작성한다

Scenario: 저장 위치 자동 추천
  Given settings.context_paths에 rules/: "코딩 규칙"이 있을 때
  When 사용자가 "typescript 컨벤션 저장해줘"라고 말하면
  Then AI가 "rules/" 경로를 추천한다

Scenario: Local context로 저장
  Given src/api.ts를 수정하면서 대화 중일 때
  When 사용자가 "이 파일 컨텍스트로 저장해"라고 말하면
  Then AI가 Local scope를 제안하고
  And src/api.ctx.md를 생성한다
```

#### /ctx.save - Deliberate Mode

```gherkin
Feature: Deliberate Save (정교한 제어)

Scenario: Slack에서 추출
  Given Slack MCP가 연결되어 있을 때
  When 사용자가 "Slack #dev 채널에서 컨텍스트 추출해줘"라고 말하면
  Then AI가 Deliberate 모드로 전환하고
  And Slack 채널 내용을 가져오고
  And 사용자에게 추출 내용을 리뷰하게 하고
  And 저장 위치 후보 N개를 제시하고
  And 사용자가 선택한 위치에 저장한다

Scenario: URL에서 추출
  Given 웹페이지 URL이 주어졌을 때
  When 사용자가 "이 문서에서 컨텍스트 추출해줘 [URL]"라고 말하면
  Then AI가 WebFetch로 내용을 가져오고
  And 유의미한 정보를 추출하여 보여주고
  And 사용자 확인 후 저장한다

Scenario: 기존 context 업데이트
  Given src/api.ctx.md가 이미 존재할 때
  When 사용자가 "API 컨텍스트 업데이트해줘"라고 말하면
  Then AI가 기존 내용과 새 내용을 비교하고
  And 변경사항을 보여주고
  And 사용자 확인 후 업데이트한다
```

---

## 3. Sync (동기화)

### 3.1 CLI

#### `ctx sync`

```gherkin
Feature: Registry 동기화

Scenario: Project sync 기본 동작
  Given 프로젝트가 초기화되어 있고
  And .ctx/registry.yaml에 5개의 context가 등록되어 있고
  And 그 중 2개 파일이 수정되었을 때
  When ctx sync를 실행하면
  Then 2개 파일의 checksum이 업데이트되고
  And ~/.ctx/registry.yaml의 index가 자동 갱신된다

Scenario: 삭제된 파일 감지
  Given registry에 등록된 파일이 삭제되었을 때
  When ctx sync를 실행하면
  Then "파일이 삭제됨" 경고가 표시되고
  And registry에서 해당 항목이 제거된다

Scenario: Project 없는 곳에서 sync (스마트 Fallback)
  Given 현재 디렉토리에 .ctx/registry.yaml이 없을 때
  When ctx sync를 실행하면
  Then "⚠️ No project found, syncing global..." 메시지가 표시되고
  And ~/.ctx/registry.yaml만 동기화된다

Scenario: Global sync 명시적 실행
  Given ~/.ctx/에 여러 context가 있을 때
  When ctx sync --global을 실행하면
  Then Global registry만 동기화되고
  And index는 업데이트하지 않는다

Scenario: Index 강제 재빌드
  Given ~/.ctx/registry.yaml의 index가 손상되었을 때
  When ctx sync --rebuild-index를 실행하면
  Then 모든 프로젝트를 스캔하여
  And index를 처음부터 재구축한다
```

#### `ctx check`

```gherkin
Feature: 헬스 체크

Scenario: 기본 헬스 체크
  Given registry에 10개의 context가 등록되어 있을 때
  When ctx check를 실행하면
  Then 각 파일의 존재 여부를 확인하고
  And checksum 일치 여부를 확인하고
  And 결과를 요약하여 표시한다

Scenario: Strict 모드 (frontmatter 검증)
  Given context 파일에 frontmatter가 없을 때
  When ctx check --strict를 실행하면
  Then "frontmatter 누락" 경고가 표시된다

Scenario: 모든 검사 통과
  Given 모든 파일이 정상일 때
  When ctx check를 실행하면
  Then "✓ All contexts healthy" 메시지가 표시된다
```

---

## 4. Init (초기화)

### 4.1 CLI

#### `ctx init`

```gherkin
Feature: Global 초기화

Scenario: 최초 Global 초기화 (interactive)
  Given ~/.ctx/가 존재하지 않을 때
  When ctx init을 실행하면
  Then context_paths 설정을 물어보고 (interactive)
  And ~/.ctx/ 디렉토리가 생성되고
  And ~/.ctx/registry.yaml이 생성되고
  And ~/.ctx/contexts/ 디렉토리가 생성되고
  And Claude Code plugin 설치 안내가 표시된다

Scenario: Global 초기화 (non-interactive)
  Given ~/.ctx/가 존재하지 않을 때
  When ctx init --context-paths "contexts/:일반,rules/:코딩 규칙"을 실행하면
  Then 물어보지 않고 바로 생성되고
  And settings.context_paths에 2개가 등록된다

Scenario: 이미 초기화된 경우
  Given ~/.ctx/registry.yaml이 이미 존재할 때
  When ctx init을 실행하면
  Then "이미 초기화되어 있습니다" 메시지가 표시된다
```

#### `ctx init .`

```gherkin
Feature: Project 초기화

Scenario: Project 초기화 (interactive)
  Given ~/.ctx/가 초기화되어 있고
  And 현재 디렉토리에 .ctx/가 없을 때
  When ctx init .을 실행하면
  Then context_paths 설정을 물어보고
  And .ctx/ 디렉토리가 생성되고
  And .ctx/registry.yaml이 생성되고
  And .ctx/contexts/ 디렉토리가 생성되고
  And ~/.ctx/registry.yaml의 index에 이 프로젝트가 추가된다

Scenario: Project 초기화 (non-interactive)
  When ctx init . --context-paths ".ctx/contexts/:프로젝트,docs/:API 문서"를 실행하면
  Then 물어보지 않고 바로 생성되고
  And settings.context_paths에 2개가 등록된다

Scenario: Global 미초기화 상태에서 Project init
  Given ~/.ctx/registry.yaml이 없을 때
  When ctx init .을 실행하면
  Then "먼저 ctx init으로 Global을 초기화하세요" 에러가 표시된다
```

---

## 5. 통합 시나리오

### 5.1 신규 사용자 온보딩

```gherkin
Feature: 신규 사용자 온보딩 플로우

Scenario: 처음부터 사용까지 전체 플로우
  Given CTX가 설치되어 있고 처음 사용할 때

  # Global 초기화
  When ctx init을 실행하면
  Then ~/.ctx/가 생성되고

  # Project 초기화
  When 프로젝트 디렉토리에서 ctx init .을 실행하면
  Then .ctx/가 생성되고

  # Context 등록
  When ctx add docs/**/*.md를 실행하면
  Then 기존 문서들이 registry에 등록되고

  # 자동 로드 확인
  When Claude가 src/api.ts를 읽으면
  Then 등록된 context가 자동 주입되고

  # 새 context 저장
  When 사용자가 "이 내용 저장해줘"라고 말하면
  Then AI가 적절한 위치에 context를 저장한다
```

### 5.2 팀 협업 시나리오

```gherkin
Feature: 팀 협업

Scenario: 새 팀원이 프로젝트 clone
  Given 팀원 A가 프로젝트에 context를 저장하고 push했을 때
  When 새 팀원 B가 프로젝트를 clone하면
  Then .ctx/registry.yaml이 함께 clone되고
  And .ctx/contexts/의 모든 context가 clone되고
  And Claude가 파일을 읽을 때 context가 자동 로드된다

Scenario: Context 변경 후 공유
  Given 팀원 A가 .ctx/contexts/architecture.md를 수정했을 때
  When ctx sync && git commit && git push를 실행하면
  Then registry의 checksum이 업데이트되고
  And 팀원 B가 pull하면 변경된 context를 사용할 수 있다
```

### 5.3 소속 결정 시나리오

```gherkin
Feature: Context 소속 결정

Scenario: Project 내 파일은 Project 소속
  Given ~/projects/myapp/.ctx/registry.yaml이 존재할 때
  When ~/projects/myapp/src/api.ctx.md를 생성하면
  Then ~/projects/myapp/.ctx/registry.yaml에 등록된다

Scenario: Project 없는 파일은 Global 소속
  Given ~/notes/에 .ctx/registry.yaml이 없을 때
  When ~/notes/tip.ctx.md를 생성하면
  Then ~/.ctx/registry.yaml에 등록된다
```

---

## 6. Edge Cases

### 6.1 에러 처리

```gherkin
Feature: 에러 처리

Scenario: registry.yaml 파싱 실패
  Given .ctx/registry.yaml이 잘못된 YAML 형식일 때
  When ctx status를 실행하면
  Then "registry.yaml 파싱 실패" 에러가 표시되고
  And 복구 방법이 안내된다

Scenario: 권한 없는 파일 접근
  Given context 파일에 읽기 권한이 없을 때
  When ctx sync를 실행하면
  Then 해당 파일에 대한 경고가 표시되고
  And 나머지 파일은 정상 처리된다

Scenario: 네트워크 없이 Slack 추출 시도
  Given 네트워크 연결이 없을 때
  When 사용자가 "Slack에서 추출해줘"라고 말하면
  Then "네트워크 연결을 확인하세요" 메시지가 표시된다
```

### 6.2 충돌 처리

```gherkin
Feature: 충돌 처리

Scenario: 같은 파일에 대한 context 중복 생성 시도
  Given src/api.ctx.md가 이미 존재할 때
  When ctx create src/api.ts를 실행하면
  Then "이미 존재합니다. 덮어쓰시겠습니까?" 확인이 표시된다

Scenario: Git merge 후 registry 충돌
  Given 두 브랜치에서 다른 context를 추가했을 때
  When git merge 후 ctx sync를 실행하면
  Then 충돌된 항목이 표시되고
  And 수동 해결 방법이 안내된다
```
