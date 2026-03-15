# CTX — Project Context Graph Tool

> PRD v1.0 | 2026-03-15

## Problem

프로젝트의 비즈니스 규칙/컨텍스트(.md)를 AI가 **필요한 시점에 정확히** 찾아 읽게 하고 싶다.
현재는 전부 읽거나(CLAUDE.md) 사람이 판단하는데, 이걸 **programmatic + semantic 두 모드로 조회 가능한 그래프**로 만들고 싶다.

### Evidence

- contents-hub 온톨로지 벤치마크: flat rules only (A) = rules+ontology (B) = **12/12**
- flat 체크리스트가 이미 강력하지만, **추론 구조 차이 관찰됨** — 같은 점수라도 그래프 기반이 더 체계적으로 reasoning
- 진짜 필요 시점: 규칙 30개+ (현재 규모에서는 CLAUDE.md + rules/로 충분)
- 벤치마크 보고서: `contents-hub/.dev/specs/ontology-benchmark/report.md`

## Identity

- **What**: 프로젝트 컨텍스트(.md)의 그래프 검색 엔진
- **Not**: 코드 인덱서 (qmd가 그 역할). ctx는 코드 위의 비즈니스 관계/규칙을 다룸
- **Scope**: Project only (`.ctx/` 디렉토리). Global scope 없음
- **Language**: Rust (single binary, zero dependencies, sub-ms parsing)

## Core Value — 두 가지 조회 모드

### 1. Programmatic: `ctx match --diff`

- glob 매칭 + 그래프 순회 (결정론적)
- 사후 검증: "코드 바꿨다 → 뭘 놓쳤나?"
- `git diff --name-only` → triggers 매칭 → depends_on 1-level 순회

### 2. Semantic: `ctx query "자연어"`

- Native BM25 (keywords + what + body 전문 검색)
- 사전 탐색: "코드 바꾸기 전에 → 뭘 고려해야 하나?"
- 외부 의존 없음, zero setup

## Key Decisions

- ctx 이름 유지, "context graph" 용어 사용
- 콘텐츠는 **사람이 agent를 활용해서 작성** — agent가 작성하지만 사용자 의도를 통해서만 관리. ctx 노드를 AI가 임의로 생성/수정하지 않음
- 기존 유저 없으므로 하위호환 무시 (완전 재작성)
- `ctx status` 커맨드 제거 — `ctx check`(건강 상태)와 `ctx list`(노드 목록)로 역할 분리 충분

## Non-Goals

- Global scope (~/.ctx/) 지원
- 코드 자체 인덱싱 (qmd/LLM 영역)
- 기존 ctx 하위호환 (유저 없음, 완전 재작성)
- *.ctx.md 로컬 컨텍스트 파일 (제거)
- Registry 파일 (런타임 파싱으로 대체)

---

## Context Node Schema

```yaml
---
ctx: true                 # 노드 마커 — 이 필드가 있어야 컨텍스트 노드로 인식
name: billing             # 노드 ID — 프로젝트 내 유일, depends_on에서 참조
what: "Billing 도메인 변경 시 동기화 체크리스트"
keywords: ["billing", "payment", "coupon", "plan"]
category: domain          # domain | concern | pipeline
triggers:                 # glob patterns (코드 변경 시 매칭)
  - "**/billing/**"
  - "**/payment/**"
depends_on: [ux, infra]   # 그래프 엣지 (노드 ID = 파일명)
actions: []               # AI에게 전달할 자연어 디렉션
                           # e.g., "Run /check skill", "Call billing-validator agent"
---

Billing 관련 변경 시 확인사항:
- [ ] 결제 로직 변경 시 쿠폰 할인 로직 확인
- [ ] plan 변경 시 기존 구독자 마이그레이션 확인
...
```

### 필드 정의

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ctx` | bool | Yes | 노드 마커. `true`여야 컨텍스트 노드로 인식. 없거나 false면 무시 |
| `name` | string | Yes | 노드 ID. `[a-z0-9-]` charset, 최대 64자. 프로젝트 내 유일. `depends_on`에서 참조 |
| `what` | string | Yes | 이 노드가 뭔지 한 줄 설명 |
| `keywords` | string[] | Yes | 검색용 키워드 (semantic fallback에도 사용) |
| `category` | enum | Yes | `domain` \| `concern` \| `pipeline` |
| `triggers` | string[] | No | glob 패턴. 매칭되면 이 노드 활성화 |
| `depends_on` | string[] | No | 다른 노드 ID. 활성화 시 1-level 순회 |
| `actions` | string[] | No | AI에게 전달할 자연어 디렉션 |

### 삭제된 필드 (기존 ctx 대비)

- `target` → triggers로 통합
- `version` → 불필요
- `agents` / `commands` → actions로 통합 (자연어)
- `scope` → project only, 필드 불필요

### Parsing Rules

1. Frontmatter 없는 .md → 무시 (silent skip)
2. `ctx` 필드가 boolean `true`가 아님 → 무시 (`ctx: "yes"`, `ctx: 1` 포함)
3. Invalid YAML frontmatter → skip + stderr warning
4. Required 필드(name, what, keywords, category) 누락 → 노드로 로드되지만 `ctx check`에서 warning
5. Unknown 필드 → 무시 (향후 확장 가능)
6. `triggers` 패턴은 프로젝트 루트 기준 상대 경로에 대해 매칭 (globset 문법)

### 노드 배치

컨텍스트 노드는 **프로젝트 어디든** 배치 가능. `ctx: true` frontmatter가 있는 .md 파일이면 노드로 인식.

```
project/
├── .ctx/                     # 관례적 위치 (강제 아님)
│   ├── billing.md            # domain
│   ├── ux.md                 # concern
│   └── api-codegen.md        # pipeline
├── src/
│   └── billing/
│       └── CONTEXT.md        # 코드 옆에 배치도 가능
├── docs/
│   └── infra.md              # ctx: true 있으면 노드
└── .ctxconfig                # 스캔 설정
```

### .ctxconfig

프로젝트 루트에 위치하는 설정 파일. `ctx init`으로 생성.

```yaml
# .ctxconfig
ignore:
  - node_modules/**
  - dist/**
  - .git/**
  - vendor/**
  - "*.min.js"
```

- `ctx init`이 `.ctxconfig` 생성 (기본 ignore 패턴 포함)
- `.ctxconfig` 없으면 기본 ignore 적용 (node_modules, dist, .git, vendor, build, target)
- 프로젝트 전체 `**/*.md` 스캔 → `ctx: true` frontmatter 확인 → 노드 수집

### 노드 ID 규칙

- **노드 ID = frontmatter `name` 필드** (파일 위치 무관)
  - `.ctx/billing.md`에 `name: billing` → ID는 `"billing"`
  - `src/billing/CONTEXT.md`에 `name: billing-context` → ID는 `"billing-context"`
- `depends_on`에서 name으로 참조: `depends_on: ["ux", "infra"]`
- `ctx check`에서 name 중복 검출 + 깨진 depends_on 참조 경고
- No registry — 런타임에 프로젝트 전체 스캔
- No sync 필요 — 파일이 곧 source of truth
- **노드 판별**: `ctx: true` frontmatter가 있는 .md만 노드로 인식
- `ctx check`에서 warning: frontmatter 불완전한 .md, 깨진 depends_on 참조

---

## CLI Interface

```
CORE (매일 쓰는 것)
  ctx match <file...>      명시적 파일 → 관련 컨텍스트 (programmatic)
  ctx match --diff         git diff 기반 → 관련 컨텍스트 (programmatic)
  ctx match --body         매칭 결과 + 각 노드 본문 출력 (--diff와 조합 가능)
  ctx query "<text>"       자연어 → 관련 컨텍스트 (native BM25, keywords+what+body)
  ctx show <node>          노드 내용 출력

MANAGEMENT
  ctx init                 .ctxconfig 생성 + .ctx/ 디렉토리 초기화
  ctx create <name>        새 노드 생성 (flags로 필드 지정)
  ctx list                 전체 노드 목록 + 메타데이터
  ctx check                건강 상태 (깨진 참조, 중복 name, 불완전 frontmatter)

GRAPH
  ctx graph                전체 그래프 시각화 (ASCII DAG)
  ctx graph <node>         특정 노드의 연결 관계 (incoming + outgoing)

INTEGRATION
  ctx migrate --from <dir> 기존 .md 파일 → .ctx/ 마이그레이션
```

### `ctx create` Flow

```bash
ctx create <name> [--category domain|concern|pipeline] [--triggers "glob,..."] [--depends-on "a,b"]
```

- 기본 위치: `.ctx/<name>.md`
- `ctx: true`, `name`, `what` (name에서 생성) 자동 설정
- `--category` 미지정 시 `domain` (기본값)
- name 유효성 검증: `[a-z0-9-]` charset, 최대 64자
- 중복 name 발견 시 에러 + exit 1

### Output Format

- **기본**: JSON (machine-readable, AI 소비용)
- `--pretty`: 사람이 읽기 좋은 포맷
- `--paths`: 경로만 출력 (piping용)

### Project Root Detection

ctx는 다음 순서로 프로젝트 루트를 찾음:
1. `.ctxconfig` 파일이 있는 가장 가까운 상위 디렉토리
2. `.ctx/` 디렉토리가 있는 가장 가까운 상위 디렉토리
3. `.git/` 디렉토리가 있는 가장 가까운 상위 디렉토리
4. 모두 없으면 에러 + exit 1

모든 파일 경로는 프로젝트 루트 기준 상대 경로로 정규화.

### `git diff` Target

`ctx match --diff`의 기본 동작:
```bash
git diff --name-only HEAD        # 마지막 커밋 이후 변경
git ls-files --others --exclude-standard  # untracked 파일 포함
```

추가 플래그:
- `--staged`: staged 변경만 (`git diff --name-only --cached`)
- `--base <ref>`: 특정 ref 기준 (`git diff --name-only <ref>...HEAD`)

git 미초기화 시 에러 + exit 1 + "git repository not found" 메시지.

### Error Handling

| Condition | Behavior | Exit Code |
|-----------|----------|-----------|
| 정상 완료 (결과 없음 포함) | 정상 출력 (빈 배열 가능) | 0 |
| `.ctxconfig` 없음 | 기본 ignore 적용, 경고 없음 | 0 |
| 프로젝트 루트 못 찾음 | stderr: "No ctx project found" | 1 |
| git 미초기화 (`match --diff`) | stderr: "Not a git repository" | 1 |
| 잘못된 인자 | stderr: usage 출력 | 1 |
| 중복 name 발견 (runtime) | stderr: warning 출력, 첫 발견 노드 사용 (파일 경로 알파벳순) | 0 |
| 깨진 depends_on 참조 (match) | 해당 참조 무시, 나머지 결과 반환 | 0 |
| `ctx check` — 경고 발견 | 경고 목록 출력 | 2 |
| `ctx check` — 문제 없음 | 정상 | 0 |
| Invalid YAML frontmatter | 해당 파일 skip + stderr warning | 0 |
| `ctx create` 중복 name | stderr: "Node name already exists" | 1 |

### JSON Output Schema

**ctx match**
```json
[
  {"name": "billing", "path": ".ctx/billing.md", "type": "direct",
   "matched_triggers": ["**/billing/**"], "actions": ["Run /check"]},
  {"name": "ux", "path": ".ctx/ux.md", "type": "dependency",
   "via": "billing", "actions": []}
]
```

**ctx match --body** (match 결과 + 본문 포함)
```json
[
  {"name": "billing", "path": ".ctx/billing.md", "type": "direct",
   "matched_triggers": ["**/billing/**"], "actions": ["Run /check"],
   "body": "Billing 관련 변경 시 확인사항:\n- [ ] 결제 로직..."}
]
```

**ctx query**
```json
[
  {"name": "subscriptions", "path": ".ctx/subscriptions.md",
   "score": 0.92, "type": "direct", "actions": []},
  {"name": "ux", "path": ".ctx/ux.md",
   "score": null, "type": "dependency", "via": "subscriptions", "actions": []}
]
```

**ctx list**
```json
[
  {"name": "billing", "path": ".ctx/billing.md", "category": "domain",
   "what": "Billing 도메인 변경 시 동기화 체크리스트",
   "keywords": ["billing", "payment"], "triggers": ["**/billing/**"],
   "depends_on": ["ux", "infra"]}
]
```

**ctx check**
```json
{
  "status": "warnings",
  "node_count": 5,
  "warnings": [
    {"type": "broken_dep", "node": "billing", "detail": "depends_on 'auth' not found"},
    {"type": "duplicate_name", "name": "ux", "paths": [".ctx/ux.md", "docs/ux.md"]},
    {"type": "missing_field", "node": "infra", "field": "keywords"}
  ]
}
```

---

## Core Flows

### Flow 1: 코드 변경 후 확인 (가장 빈번)

```bash
$ ctx match --diff
# billing (direct) ← **/billing/** matched
#   → ux (dependency)
#   → infra (dependency)

$ ctx match --diff --body
# match 결과 + 각 노드의 체크리스트 본문 → stdout (LLM에 주입)
```

### Flow 2: 작업 시작 전 탐색

```bash
$ ctx query "구독 추가할 때 뭘 확인해야 해?"
# subscriptions (0.92) → ux, infra
# billing (0.71)
```

### Flow 3: 그래프 확인

```bash
$ ctx graph
# billing ──→ ux ──→ term
#        └──→ infra
# subscriptions ──→ ux, infra
```

---

## Graph Traversal Algorithm

```
Input:
  ctx match <file...>  → 명시적 파일 목록
  ctx match --diff     → git diff --name-only → 변경 파일 목록

1. 프로젝트 전체 *.md 스캔 (ctx: true 필터) → 노드 목록 (triggers, depends_on 포함)
2. 각 파일 × 각 노드의 triggers → glob match → DIRECT matches
3. DIRECT matches의 depends_on → 1-level 순회 → DEPENDENCY matches
4. 중복 제거
5. 출력 (direct/dependency 구분)
```

**1-level only**: billing → ux → term에서 billing 트리거 시 ux만, term은 안 가져옴.

---

## Search — Native BM25

`ctx query`는 외부 의존 없이 내장 BM25 알고리즘으로 검색.

### 검색 대상

| 필드 | 가중치 | 설명 |
|------|--------|------|
| `keywords` | 2x (double-indexed) | 검색 키워드 |
| `what` | 1x | 노드 설명 |
| `body` | 1x | 본문 전체 (체크리스트 등) |

### BM25 파라미터

- k1 = 1.2, b = 0.75 (standard BM25 defaults)
- IDF = ln((N - df + 0.5) / (df + 0.5) + 1)
- Substring matching 지원 (한국어 등 비공백 토큰 매칭)

### ctx query 내부 동작

```
1. 프로젝트 전체 *.md 스캔 (ctx: true 필터) → 노드 목록
2. BM25 scoring: query 토큰화 → 각 노드의 keywords+what+body에 대해 TF-IDF 계산
3. score > 0 인 노드만 반환 (score 내림차순)
4. 결과 노드들의 depends_on 1-level 순회 → 확장
5. 출력 (score + dependency 구분)
```

### 향후 확장

Vector/embedding 검색이 필요해지면 (노드 100개+) 별도 결정. 현재 규모에서 BM25로 충분.

---

## Claude Code Plugin 통합 (다음 스코프)

Plugin 통합 (hook, skill)은 CLI 완성 후 별도 스코프로 진행.

**예정 구성:**
| Component | Trigger | Action |
|-----------|---------|--------|
| **Hook** (PreToolUse/Read) | AI가 파일 읽을 때 | `ctx match <file>` → 관련 컨텍스트 자동 주입 |
| **Skill** (/ctx.match) | 사용자 요청 | `ctx match --diff --body` → 체크리스트 출력 |
| **Skill** (/ctx) | 사용자 요청 | 통합 인터페이스 |

---

## Migration Path

`ctx migrate --from <dir>`

1. 대상 디렉토리의 .md 파일 스캔
2. 기존 frontmatter에서 triggers/depends_on/category 추출 (있으면)
3. what = 첫 `#` 제목에서 추출, keywords = triggers에서 도메인 키워드 추출
4. .ctx/에 복사
5. `--dry-run` (기본): 변경 사항 미리보기만
6. `--apply`: 실제 실행

---

## Phase Plan

```
Phase 0: Foundation
  - Rust 프로젝트 초기화 (cargo init)
  - Context node parser (YAML frontmatter + markdown body)
  - Project-wide scanner (ctx: true 필터 + .ctxconfig ignore)
  - ctx init (.ctxconfig 생성), ctx create, ctx list, ctx show
  - ctx check (health check: 깨진 depends_on, 불완전 frontmatter)

Phase 1: Programmatic Core
  - glob matcher (triggers 매칭)
  - graph.rs (depends_on 기반 1-level traversal)
  - ctx match <file...> + ctx match --diff + ctx match --body
  - ctx graph (전체 + 개별 노드)
  - ctx migrate --from

Phase 2: Search
  - Native BM25 search (keywords + what + body)
  - ctx query (BM25 scoring, zero external deps)
  - Substring matching for non-English text
```

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Rust | Sub-ms parsing, single binary, zero deps |
| Registry | 없음 (런타임 파싱) | .md 파일이 SoT. sync 불필요, 복잡도 제거 |
| YAML parser | `serde_yaml` | Rust 표준 YAML 파서 |
| Markdown parser | `pulldown-cmark` + frontmatter 분리 | 가볍고 빠름 |
| Glob matching | `globset` (BurntSushi) | ripgrep과 동일 엔진, 빠름 |
| Git diff | `git diff --name-only HEAD` + untracked | 기본: HEAD 이후 변경. `--staged`, `--base <ref>` 지원 |
| Search | Native BM25 (zero deps) | 외부 의존 없음, sub-ms, 노드 수십 개에 충분 |
| Graph storage | In-memory (HashMap) | 노드 수십 개 수준, DB 불필요 |
| Output | JSON default, --pretty | AI 소비 + 사람 모두 커버 |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Scope creep — 1인 개발 치고 넓음 | High | Phase 분리 (0→1→2), 각 Phase 독립 동작 가능하게 설계. Phase 0만으로도 가치 있음 |
| "뭘 넣어야 하는지" 불명확 | Medium | 카테고리(domain/concern/pipeline)로 가이드, 템플릿 제공 |
| 현재 규모에서 불필요 | Medium | 규칙 3개부터 시작해도 유용한 구조로 설계 |
| Rust 학습 곡선 | Low | CLI 도구는 Rust의 sweet spot |

---

## Success Criteria

1. `ctx match --diff` → 변경 파일에 관련된 모든 컨텍스트 노드를 1초 내 반환
2. `ctx query "..."` → native BM25로 관련 노드 반환 (외부 의존 없음)
3. depends_on 그래프로 연관 노드 자동 확장
4. 파일 추가/수정만으로 동작 (sync/registry 불필요)
5. 모든 커맨드의 exit code가 정의되어 스크립트/자동화에 활용 가능

---

## References

- [qmd](https://github.com/tobi/qmd) — 로컬 마크다운 하이브리드 검색 엔진 (BM25 + Vector + LLM reranking, 15.1k stars)
- [LoreLang](https://github.com/lorelang/lore) — 코드베이스 온톨로지 도구
- [[코드베이스 온톨로지 — LLM이 도메인을 이해하게 만드는 방법]] — 설계 영감
- Agent Council 결과 (2026-03-14): Codex "thin overlay만", Gemini "하이브리드 지지"
- 벤치마크 보고서: `contents-hub/.dev/specs/ontology-benchmark/report.md`
