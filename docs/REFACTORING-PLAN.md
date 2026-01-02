# CTX 3-Level Context System 리팩토링 플랜

> RFC-3-level-context-system.md 기반 전면 리팩토링
> 작성일: 2026-01-01
> 최종 수정: 2026-01-02 (ctx-load Skill 추가 - 수동 로드용)

---

## 개요

CTX를 "팀 단위 개발 협업 도구"에서 **"범용 컨텍스트 관리 플랫폼"**으로 전환하는 리팩토링.

### 핵심 변경

| 항목 | Before | After |
|------|--------|-------|
| Config | ctx.config.yaml | **제거** (registry.yaml 단일화) |
| Registry | 분산 (local + global) | **하이브리드** (~/.ctx + .ctx/) |
| 디렉토리 | ctx/ | **.ctx/** |
| Work 기능 | 7개 명령어 + issue_store | **완전 제거** |
| 계층 | Project + Local | **Global > Project > Local** |

---

## 아키텍처

```
~/.ctx/                          ← Global (개인, Git ❌)
├── registry.yaml
└── contexts/

{project}/.ctx/                  ← Project (팀 공유, Git ✅)
├── registry.yaml
└── contexts/

*.ctx.md, ctx.md                 ← Local (파일/폴더 전용)

우선순위: Local > Project > Global
```

---

## Phase 1: 삭제 및 정리 (Breaking Changes)

### 1.1 파일 삭제

#### 체크리스트

- [x] `src/templates/ai-commands/work/` 전체 삭제 (7개 파일)
  - init.md, plan.md, commit.md, review.md, submit.md, extract.md, done.md
- [x] `src/templates/hooks/ctx.track-session.sh` 삭제
- [x] `src/templates/snippets/ctx-current.md` 삭제
- [x] `src/commands/session.ts` 삭제

### 1.2 타입 정리 (`src/lib/types.ts`)

#### 체크리스트

- [x] `IssueStoreType` 타입 삭제 (Line 14)
- [x] `IssueStoreConfig` 인터페이스 삭제 (Lines 16-20)
- [x] `Config.work` 필드 삭제 (Lines 34-37)
- [x] 모든 import 정리

### 1.3 Init 커맨드 정리 (`src/commands/init.ts`)

#### 체크리스트

- [x] Issue store 선택 prompt 제거 (Lines 97-128)
- [x] `getGitHubRemoteUrl()` 함수 제거
- [x] `getDefaultIssueStoreUrl()` 함수 제거
- [x] Issues 디렉토리 생성 로직 제거
- [x] `.ctx.current` gitignore 추가 로직 제거 (Lines 240-243)
- [x] Work 디렉토리 gitignore 추가 로직 제거 (Lines 234-237)

### 1.4 Status 커맨드 정리 (`src/commands/status.ts`)

#### 체크리스트

- [x] `StatusData.work` 필드 및 관련 타입 제거
- [x] `collectWorkStatus()` 함수 전체 제거
- [x] `generateSuggestions()`에서 work 관련 제안 제거
- [x] `printStatusPretty()`에서 Work Session 섹션 제거

### 1.5 기타 정리

#### 체크리스트

- [x] `src/lib/config.ts`: work 필드 처리 제거
- [x] `src/commands/refresh.ts`: work 디렉토리 gitignore 항목 제거
- [x] `src/lib/platforms/claudeCode.ts`: track-session hook 설정 제거
- [x] `src/bin/ctx.ts`: session 커맨드 import/등록 제거
- [x] `src/templates/ctx.config.yaml`: work 섹션 제거

### Phase 1 검증

```bash
# 자동화 테스트
npm run build  # TypeScript 컴파일 성공 확인

# 수동 체크
npx ctx init   # work 관련 prompt 없어야 함
npx ctx status # work 섹션 없어야 함
npx ctx sync   # 기존 기능 정상 동작
```

---

## Phase 2: 아키텍처 변경

### 2.1 타입 추가 (`src/lib/types.ts`)

#### 체크리스트

- [x] `UnifiedRegistry` 인터페이스 추가
- [x] `ContextEntry` 타입에 `scope: 'local' | 'project' | 'global'` 필드 추가
- [x] `ProjectIndexEntry` 인터페이스 추가 (Global index용)
- [x] 기존 `LocalContextRegistry`, `GlobalContextRegistry` 유지 (하위 호환)

```typescript
export interface UnifiedRegistry {
  meta: { version: string; last_synced: string; };
  contexts: Record<string, ContextEntry>;
  index?: Record<string, ProjectIndexEntry>;  // Global만
}

export interface ProjectIndexEntry {
  path: string;  // 절대 경로
  last_synced: string;
  context_count: number;
  contexts: Array<{ path: string; what: string; }>;  // when 필드 제거 (RFC 변경)
}
```

### 2.2 Registry 모듈 재작성 (`src/lib/registry.ts`)

#### 체크리스트

- [x] 상수 변경
  - `LOCAL_REGISTRY_FILE` → `REGISTRY_FILE = 'registry.yaml'`
  - `CTX_DIR = '.ctx'` (ctx → .ctx)
  - `GLOBAL_CTX_DIR = path.join(os.homedir(), '.ctx')`
- [x] `findProjectRoot(startPath: string)` 함수 구현
  - 위로 탐색하며 `.ctx/registry.yaml` 찾기
- [x] `getGlobalCtxRegistryPath()` 함수 추가 (~/.ctx/registry.yaml)
- [x] `getProjectRegistryPath(projectRoot)` 함수 수정 (.ctx/registry.yaml)
- [x] `isGlobalCtxInitialized()` 함수 추가
- [x] `isProjectCtxInitialized()` 마커 변경 (config.yaml → .ctx/registry.yaml)
- [x] `updateGlobalIndex(projectRoot)` 함수 구현

### 2.3 FileUtils 수정 (`src/lib/fileUtils.ts`)

#### 체크리스트

- [x] `isProjectInitialized()` 마커 변경
- [x] `isGlobalInitialized()` 함수 추가
- [x] `resolveGlobalContextPath()` 경로는 매개변수화 (globalDir로 받음)

### 2.4 Config 모듈 정리 (`src/lib/config.ts`)

#### 체크리스트

- [x] `loadConfig()` 함수 → 하드코딩 기본값 반환으로 변경
- [x] `createConfigFile()` 함수 (legacy 호환용으로 유지)
- [x] `DEFAULT_PATTERNS` 상수 추가
  ```typescript
  export const DEFAULT_PATTERNS = {
    local: ['**/*.ctx.md', '**/ctx.md'],
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
  };
  ```

### 2.5 Scanner 수정 (`src/lib/scanner.ts`)

#### 체크리스트

- [x] config 파라미터 제거, 하드코딩 패턴 사용 (`scanLocalContextsNew()`)
- [x] `scanProjectContexts()` 함수 추가 (.ctx/contexts/ 스캔)
- [x] `scanGlobalCtxContexts()` 추가 (~/.ctx/contexts/ 스캔)
- [x] 경로 수정 (ctx → .ctx)

### 2.6 Init 커맨드 분리 (`src/commands/init.ts`)

#### 체크리스트

- [x] 인자 파싱 (`ctx init` vs `ctx init .`)
- [x] `initGlobalCommand()` 함수 구현
  - ~/.ctx/ 생성
  - ~/.ctx/registry.yaml 생성
  - ~/.ctx/contexts/ 생성
  - Plugin 설치 안내 출력
- [x] `initProjectCommand()` 함수 구현
  - Global 초기화 확인 (없으면 에러)
  - .ctx/ 생성
  - .ctx/registry.yaml 생성
  - .ctx/contexts/ 생성
  - AI commands 설치
- [x] config.yaml 생성 로직 (legacy 함수로 분리)

### 2.7 Sync 커맨드 수정 (`src/commands/sync.ts`)

#### 체크리스트

- [x] `findProjectRoot()` 사용하여 프로젝트 탐색
- [x] 스마트 fallback 로직 구현
  - Project 발견 → Project sync + Global index 갱신
  - Project 없음 → Legacy sync fallback
- [x] `updateGlobalIndex()` 호출 추가
- [x] `--rebuild-index` 옵션 타입 정의 (ExtendedSyncOptions)
- [x] config 의존성 제거 (new 함수들)

### Phase 2 검증

```bash
# 자동화 테스트
npm run build
npm test  # 기존 테스트 통과 확인

# 수동 체크
ctx init           # ~/.ctx/ 생성 확인
ctx init .         # .ctx/ 생성 확인 (Global 없으면 에러)
ctx sync           # Project 내 → Project sync + Global index
ctx sync           # Project 밖 → 경고 + Global sync
ctx sync --global  # Global만 동기화
```

---

## Phase 3: 신규 커맨드 구현

### 3.1 Add 커맨드 (`src/commands/add.ts` - 신규)

#### 체크리스트

- [x] 파일 생성
- [x] glob 패턴 지원 구현
- [x] `--global` 옵션으로 Global registry 등록
- [x] 중복 등록 방지 로직
- [x] 자동 Global index 갱신
- [x] `bin/ctx.ts`에 커맨드 등록

```typescript
export async function addCommand(patterns: string[], options: { global?: boolean }) {
  // 1. glob 패턴 확장
  // 2. 각 파일: 존재 확인, what 추출, registry 등록
  // 3. Global index 갱신 (Project context인 경우)
}
```

#### Frontmatter 없는 문서 자동 추출 (RFC Section 5 추가)

> 기존 docs를 `ctx add`로 등록할 때 frontmatter가 없는 경우 자동 추출

**추출 우선순위:**
```
1. frontmatter의 what 필드 (있으면 그대로 사용)
2. 첫 번째 # heading (마크다운 문서)
3. 파일명 humanize (api-guide.md → "Api Guide")
```

**체크리스트:**
- [ ] `extractWhat(filePath)` 함수 구현
  - frontmatter 파싱 시도
  - 없으면 heading 추출
  - 없으면 파일명 humanize
- [ ] `ctx add` 시 `what` 자동 채우기
- [ ] CLI 출력에 추출 결과 표시

```typescript
async function extractWhat(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');

  // 1. frontmatter에서 what 추출
  const { data } = matter(content);
  if (data.what) return data.what;

  // 2. 첫 번째 heading 추출
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1];

  // 3. 파일명 humanize
  const basename = path.basename(filePath, path.extname(filePath));
  return basename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
```

**CLI 출력 예시:**
```bash
$ ctx add docs/**/*.md
✓ docs/api-guide.md (what: "API Authentication Guide")
✓ docs/setup.md (what: "Setup")  # 파일명 fallback
✓ docs/architecture.md (what: "시스템 아키텍처")  # frontmatter
Added 3 contexts
```

### 3.2 Remove 커맨드 (`src/commands/remove.ts` - 신규)

#### 체크리스트

- [x] 파일 생성
- [x] glob 패턴 지원
- [x] registry에서만 제거 (파일 삭제 안 함)
- [x] Global index 갱신
- [x] `bin/ctx.ts`에 커맨드 등록

### 3.3 Migrate 커맨드 (`src/commands/migrate.ts` - 신규)

#### 체크리스트

- [x] 파일 생성
- [x] Global 초기화 확인
- [x] 기존 구조 감지 (ctx.config.yaml 존재 여부)
- [x] 구조 변환:
  - ctx/ → .ctx/contexts/ 이동
  - registry.yaml 새로 생성
  - ctx.config.yaml 삭제 (옵션)
- [x] work 관련 파일 정리 (.ctx.current 등)
- [x] `bin/ctx.ts`에 커맨드 등록

### 3.4 CLI 등록 (`src/bin/ctx.ts`)

#### 체크리스트

- [x] session 커맨드 제거 확인
- [x] add 커맨드 등록
- [x] remove 커맨드 등록
- [x] migrate 커맨드 등록
- [x] init 커맨드 인자 처리 수정

### Phase 3 검증

```bash
# 수동 체크
ctx add src/**/*.ctx.md       # glob 패턴 동작
ctx add --global ~/.ctx/contexts/test.md  # Global 등록
ctx remove docs/*.md          # registry에서 제거
ctx migrate                   # 기존 프로젝트 마이그레이션
```

---

## Phase 4: Plugin 구조 구현 (분리 진행)

> Phase 1-3 완료 후 별도로 진행

### 4.1 Plugin 디렉토리 구조

```
plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── ctx-save/
│   │   └── SKILL.md           # Save skill
│   └── ctx-load/
│       └── SKILL.md           # Load skill (수동 조회/검색)
├── commands/
│   ├── ctx.save.md            # /ctx.save → ctx-save skill 호출
│   ├── ctx.load.md            # /ctx.load → ctx-load skill 호출
│   ├── ctx.sync.md
│   └── ctx.status.md
├── hooks/
│   └── hooks.json             # PostToolUse(Read) hook 설정
└── scripts/
    └── auto-load-context.sh   # Hook에서 호출하는 스크립트
```

> **자동 로드 vs 수동 로드**:
> - 자동 로드: Hook이 `ctx load --file` 호출하여 처리 (파일 읽을 때 자동)
> - 수동 로드: `/ctx.load` Skill이 사용자 요청에 따라 context 검색/로드

### 4.2 체크리스트

- [x] plugin/ 디렉토리 생성
- [x] plugin.json 작성
- [x] Save skill (SKILL.md) 작성
- [ ] Load skill (SKILL.md) 작성 - 수동 조회/검색용
- [x] CLI wrapper commands 작성 (ctx.save.md)
- [ ] CLI wrapper commands 작성 (ctx.load.md) - 수동 로드용
- [x] PostToolUse(Read) hook 구현
- [x] Init 시 plugin 설치 안내 추가

### Phase 4 검증

```bash
# 파일 구조 확인
tree plugin/                     # 모든 디렉토리/파일 존재 확인

# JSON 형식 검증
cat plugin/.claude-plugin/plugin.json | jq .  # 유효한 JSON
cat plugin/hooks/hooks.json | jq .            # 유효한 JSON

# SKILL.md frontmatter 확인
head -5 plugin/skills/ctx-save/SKILL.md       # name, description, allowed-tools

# auto-load hook 테스트
echo '{"tool_input": {"file_path": "/tmp/test.ts"}}' | ./plugin/scripts/auto-load-context.sh
# → companion 없으면 출력 없음 (정상)

echo "# Test" > /tmp/test.ctx.md
echo '{"tool_input": {"file_path": "/tmp/test.ts"}}' | ./plugin/scripts/auto-load-context.sh
# → Context loaded 메시지 출력
```

Phase 4 완료:
- [x] plugin/ 디렉토리 구조 정상
- [x] plugin.json 유효한 JSON
- [x] ctx-save SKILL.md frontmatter 형식 정상
- [x] hooks.json 유효한 JSON
- [x] auto-load-context.sh 정상 동작
- [x] ctx init에 plugin 안내 포함

---

## 파일별 변경 명세

### 완전 삭제 (9개)

| 파일 | Phase |
|------|-------|
| `src/templates/ai-commands/work/*` (7개) | P1 |
| `src/templates/hooks/ctx.track-session.sh` | P1 |
| `src/commands/session.ts` | P1 |

### 대폭 수정 (7개)

| 파일 | 변경 내용 | Phase |
|------|----------|-------|
| `src/lib/types.ts` | IssueStore 제거, UnifiedRegistry 추가 | P1, P2 |
| `src/lib/config.ts` | loadConfig 간소화, createConfigFile 제거 | P1, P2 |
| `src/lib/registry.ts` | 하이브리드 registry, 경로 변경 | P2 |
| `src/lib/scanner.ts` | config 의존성 제거, 경로 변경 | P2 |
| `src/commands/init.ts` | Global/Project 분리, work 제거 | P1, P2 |
| `src/commands/sync.ts` | 스마트 fallback, Global index | P2 |
| `src/commands/status.ts` | work 섹션 제거 | P1 |

### 부분 수정 (4개)

| 파일 | 변경 내용 | Phase |
|------|----------|-------|
| `src/lib/fileUtils.ts` | isProjectInitialized 마커 변경 | P2 |
| `src/lib/platforms/claudeCode.ts` | track-session hook 제거 | P1 |
| `src/commands/refresh.ts` | work 디렉토리 제거 | P1 |
| `src/bin/ctx.ts` | 커맨드 등록 업데이트 | P1, P3 |

### 신규 생성 (9개)

| 파일 | Phase |
|------|-------|
| `src/commands/add.ts` | P3 |
| `src/commands/remove.ts` | P3 |
| `src/commands/migrate.ts` | P3 |
| `plugin/.claude-plugin/plugin.json` | P4 |
| `plugin/skills/ctx-save/SKILL.md` | P4 |
| `plugin/skills/ctx-load/SKILL.md` | P4 |
| `plugin/commands/ctx.load.md` | P8 |
| `plugin/commands/sync.md` | P4 |
| `plugin/commands/status.md` | P4 |
| `plugin/hooks/hooks.json` | P4 |
| `plugin/scripts/auto-load-context.sh` | P4 |

### 재사용 (변경 없음)

- `src/lib/parser.ts`
- `src/lib/loader.ts`
- `src/lib/checksum.ts`

---

## 테스트 전략 (혼합 방식)

### 자동화 테스트 (핵심 기능)

```typescript
// tests/registry.test.ts
- findProjectRoot() 테스트
- isGlobalInitialized() 테스트
- isProjectInitialized() 테스트
- updateGlobalIndex() 테스트

// tests/commands/add.test.ts
- glob 패턴 테스트
- --global 옵션 테스트
- 중복 등록 방지 테스트
```

### 수동 체크리스트 (각 Phase 완료 시)

Phase 1 완료:
- [x] `npm run build` 성공
- [x] `ctx init` work prompt 없음
- [x] `ctx status` work 섹션 없음

Phase 2 완료:
- [x] `ctx init` → ~/.ctx/ 생성
- [x] `ctx init .` → .ctx/ 생성
- [x] `ctx sync` 스마트 fallback 동작

Phase 3 완료:
- [x] `ctx add/remove` 동작
- [x] `ctx migrate` 기존 프로젝트 변환 성공

---

## Critical Files (구현 순서대로)

1. **`src/lib/types.ts`** - 타입 시스템의 중심, 모든 모듈에 영향
2. **`src/commands/init.ts`** - Global/Project 분리의 핵심
3. **`src/lib/registry.ts`** - 하이브리드 registry 로직
4. **`src/commands/sync.ts`** - 스마트 fallback + Global index
5. **`src/commands/add.ts`** - 명시적 등록 시스템 (신규)

---

## RFC vs 현재 구현 GAP 분석 (Phase 4 완료 시점)

> Phase 1-4 완료 후 RFC 문서와 비교한 미구현 항목 분석
> **최종 수정: 2026-01-02** - RFC 변경사항 반영 (keyword search 제거, /ctx.load 제거)

### 구현 완료 항목 ✅

| RFC 기능 | RFC 위치 | 상태 |
|---------|---------|------|
| Work 워크플로우 제거 | Section 7 | ✅ |
| 3-Level 타입 시스템 | Section 6 | ✅ |
| `ctx init` / `ctx init .` | Section 8 | ✅ |
| `ctx sync` 스마트 fallback | Section 5 | ✅ |
| `ctx add/remove` 명시적 등록 | Section 5 | ✅ |
| `ctx migrate` 마이그레이션 | Section 7 | ✅ |
| Plugin 기본 구조 | Section 9 | ✅ |
| SKILL.md 작성 (ctx-save) | Section 10 | ✅ |
| SKILL.md 작성 (ctx-load) | Section 10 | ⬜ (P4 추가) |
| PostToolUse(Read) hook | Section 10 | ✅ |
| `updateGlobalIndex()` 함수 | Section 6 | ✅ |
| Preview 정보 처리 (what만, when 제거) | Section 6 | ✅ |

### 미구현 항목 ❌

| RFC 기능 | RFC 위치 | 현재 상태 | GAP 설명 |
|---------|---------|----------|---------|
| `settings.context_paths` | Section 6 | ❌ | 하드코딩 패턴만 사용, 동적 설정 불가 |
| `ctx init --context-paths` | Section 8 | ❌ | Interactive 프롬프트 없음 |
| `ctx sync --rebuild-index` | Section 5 | ❌ | 옵션 미구현 |
| `ctx status --global` | Section 8 | ❌ | Global registry 직접 조회 불가 |
| `ctx status --all` | Section 8 | ❌ | Index 기반 전체 조회 불가 |
| `ctx status` context_paths 표시 | Section 8 | ❌ | 설정된 경로 표시 없음 |
| `ctx create` 후 자동 등록 | Section 8 | ⚠️ | 파일만 생성, registry 등록 없음 |
| Plugin `/ctx.save` command | Section 9 | ❌ | Skill wrapper 미구현 |
| Plugin `/ctx.load` command | Section 9 | ❌ | Skill wrapper 미구현 (수동 로드용) |
| Auto-load 3-Level 우선순위 | Section 10 | ⚠️ | Local만 로드, Project/Global 미지원 |
| Frontmatter 자동 추출 | Section 5 | ❌ | what 추출 로직 미구현 |

### 부분 구현 항목 ⚠️

| 항목 | 현재 상태 | 필요 작업 |
|------|----------|----------|
| `ctx create` | 파일 생성만 | registry 자동 등록 + Global index 갱신 |
| `ctx status` | Legacy 경로 사용 | 3-Level registry 직접 조회 |
| `auto-load-context.sh` | Local만 지원 | Project/Global contexts 로드 + CLI 연동 |
| `ctx add` | frontmatter 필수 | what 자동 추출 (heading/파일명 fallback) |

### RFC 변경으로 제거된 항목 ~~취소선~~

| 기존 계획 | RFC 변경 이유 |
|----------|--------------|
| ~~`ctx load [keywords...]` CLI~~ | CLI keyword search 제거 - AI Skill이 담당 |
| ~~`when` 필드~~ | keyword search 제거로 불필요 |

**Note**: `/ctx.load` Skill과 ctx-load skill은 다시 추가됨
- 자동 로드: Hook + CLI (`ctx load --file`)가 담당 (파일 읽을 때 자동)
- 수동 로드: `/ctx.load` Skill이 사용자 요청에 따라 context 검색/로드

---

## Phase 5: Settings 및 Context Paths 지원

> RFC Section 6의 `settings.context_paths` 스키마 구현

### 5.1 타입 추가 (`src/lib/types.ts`)

#### 체크리스트

- [x] `ContextPathConfig` 인터페이스 추가
- [x] `UnifiedRegistry`에 `settings` 필드 추가

```typescript
export interface ContextPathConfig {
  path: string;       // 상대 경로 (registry 기준)
  purpose: string;    // 이 경로의 용도 설명 (AI 판단용)
}

export interface RegistrySettings {
  context_paths: ContextPathConfig[];
}

export interface UnifiedRegistry {
  meta: { version: string; last_synced: string };
  settings?: RegistrySettings;  // 추가
  contexts: Record<string, ContextEntry>;
  index?: Record<string, ProjectIndexEntry>;
}
```

### 5.2 Init 커맨드 개선 (`src/commands/init.ts`)

#### 체크리스트

- [x] `--context-paths` CLI 옵션 추가 (non-interactive)
  - 형식: `"path1:purpose1,path2:purpose2"`
- [x] Interactive 프롬프트 추가 (옵션 없을 때)
  - 기본값 제시 + 추가 입력 받기
- [x] registry.yaml에 `settings.context_paths` 작성
- [x] `bin/ctx.ts`에 옵션 등록

```typescript
// initGlobalCommand 개선
async function initGlobalCommand(options: { contextPaths?: string }) {
  // ...기존 로직...

  let contextPaths: ContextPathConfig[];

  if (options.contextPaths) {
    // Non-interactive: --context-paths "contexts/:일반,rules/:규칙"
    contextPaths = parseContextPathsOption(options.contextPaths);
  } else {
    // Interactive prompt
    contextPaths = await promptContextPaths('global');
  }

  // registry.yaml에 settings 포함하여 작성
  const registry: UnifiedRegistry = {
    meta: { version: '2.0.0', last_synced: new Date().toISOString() },
    settings: { context_paths: contextPaths },
    contexts: {},
  };

  await writeGlobalCtxRegistry(registry);
}
```

### 5.3 Scanner 개선 (`src/lib/scanner.ts`)

#### 체크리스트

- [x] `getContextPathsFromRegistry()` 함수 추가
  - registry.yaml에서 `settings.context_paths` 읽기
  - 없으면 기본 패턴 반환
- [x] `scanProjectContexts()` 개선
  - settings.context_paths의 모든 경로 스캔
- [x] `scanGlobalCtxContexts()` 개선
  - settings.context_paths 기반 스캔

```typescript
async function getContextPathPatterns(registryPath: string): Promise<string[]> {
  const registry = await readRegistryFile(registryPath);
  if (registry.settings?.context_paths) {
    return registry.settings.context_paths.map(cp =>
      path.join(cp.path, '**/*.md')
    );
  }
  return DEFAULT_PATTERNS.project;
}
```

### 5.4 Registry 개선 (`src/lib/registry.ts`)

#### 체크리스트

- [x] `writeGlobalCtxRegistry()` settings 포함 (UnifiedRegistry 타입 사용으로 자동 지원)
- [x] `writeProjectRegistry()` settings 포함 (UnifiedRegistry 타입 사용으로 자동 지원)
- [x] `readGlobalCtxRegistry()` settings 파싱 (YAML 파싱으로 자동 지원)
- [x] `readProjectRegistry()` settings 파싱 (YAML 파싱으로 자동 지원)

### 5.5 단위/통합 테스트 (Council 피드백 반영)

#### 체크리스트

- [ ] `tests/lib/settings.test.ts` 작성
  - `parseContextPathsOption()` 파싱 테스트
  - 잘못된 형식 입력 시 에러 처리
  - 빈 문자열, 특수문자 처리

```typescript
// tests/lib/settings.test.ts
describe('parseContextPathsOption', () => {
  test('parses valid format', () => {
    const result = parseContextPathsOption('contexts/:일반,rules/:규칙');
    expect(result).toEqual([
      { path: 'contexts/', purpose: '일반' },
      { path: 'rules/', purpose: '규칙' },
    ]);
  });

  test('handles empty input', () => {
    expect(() => parseContextPathsOption('')).toThrow();
  });

  test('handles malformed input', () => {
    expect(() => parseContextPathsOption('invalid')).toThrow();
  });
});
```

- [ ] `tests/commands/init.test.ts` 작성
  - `--context-paths` 옵션 동작 테스트
  - registry.yaml에 settings 저장 검증
  - Global/Project 각각 테스트

### Phase 5 검증

```bash
# 자동화 테스트
pnpm test tests/lib/settings.test.ts
pnpm test tests/commands/init.test.ts

# 수동 체크
# 1. Interactive 모드 (옵션 없이)
rm -rf ~/.ctx && ctx init
# → context_paths 프롬프트 나와야 함
# → ~/.ctx/registry.yaml에 settings.context_paths 있어야 함

# 2. Non-interactive 모드
rm -rf ~/.ctx && ctx init --context-paths "contexts/:일반 컨텍스트,rules/:코딩 규칙"
# → 프롬프트 없이 바로 생성
# → registry.yaml에 2개 경로 있어야 함

# 3. Project init
rm -rf .ctx && ctx init . --context-paths ".ctx/contexts/:프로젝트,docs/:문서"
# → .ctx/registry.yaml에 settings 있어야 함

# 4. Registry 확인
cat ~/.ctx/registry.yaml | grep -A5 "settings:"
cat .ctx/registry.yaml | grep -A5 "settings:"
```

Phase 5 완료:
- [x] types.ts에 ContextPathConfig 추가
- [x] init 커맨드 --context-paths 옵션 동작
- [x] init 커맨드 interactive 프롬프트 동작
- [x] registry.yaml에 settings.context_paths 저장
- [x] scanner에서 settings.context_paths 사용

---

## Phase 6: CLI 명령어 완성

> RFC Section 8의 누락된 CLI 옵션 구현

### 6.1 Create 커맨드 개선 (`src/commands/create.ts`)

#### 현재 문제
- 파일만 생성하고 registry에 등록하지 않음
- Global index 갱신 없음

#### 체크리스트

- [ ] 파일 생성 후 `ctx add <path>` 자동 호출 (또는 직접 registry 업데이트)
- [ ] Global index 자동 갱신 (`updateGlobalIndex()`)
- [ ] `--project` 옵션 추가 (`.ctx/contexts/` 하위에 생성)
- [ ] 성공 메시지에 registry 등록 안내 제거 (자동화됨)

```typescript
export async function createCommand(target: string, options: CreateOptions) {
  // ...기존 파일 생성 로직...

  await fs.writeFile(absoluteContextPath, rendered, 'utf-8');

  // ⭐ 신규: Registry 자동 등록
  if (isGlobal) {
    await registerToGlobalRegistry(contextPath);
  } else if (options.project) {
    await registerToProjectRegistry(projectRoot, contextPath);
    await updateGlobalIndex(projectRoot);
  } else {
    // Local context
    await registerToProjectRegistry(projectRoot, contextPath, target);
    await updateGlobalIndex(projectRoot);
  }

  console.log(chalk.green(`✓ Created and registered: ${contextPath}`));
}
```

### 6.2 Sync 커맨드 개선 (`src/commands/sync.ts`)

#### 체크리스트

- [ ] `--rebuild-index` 옵션 구현
  - 모든 등록된 프로젝트를 순회하며 index 재빌드
  - Global registry의 index 섹션 전체 갱신

```typescript
interface ExtendedSyncOptions {
  local?: boolean;
  global?: boolean;
  rebuildIndex?: boolean;  // 추가
}

async function rebuildGlobalIndex(): Promise<void> {
  const globalRegistry = await readGlobalCtxRegistry();

  if (!globalRegistry.index) {
    console.log(chalk.yellow('No index to rebuild'));
    return;
  }

  const newIndex: Record<string, ProjectIndexEntry> = {};

  for (const [projectName, entry] of Object.entries(globalRegistry.index)) {
    if (await fs.access(entry.path).then(() => true).catch(() => false)) {
      // 프로젝트가 존재하면 registry 다시 읽어서 index 갱신
      const projectRegistry = await readProjectRegistry(entry.path);
      newIndex[projectName] = buildProjectIndexEntry(entry.path, projectRegistry);
      console.log(chalk.green(`✓ Rebuilt index for: ${projectName}`));
    } else {
      console.log(chalk.yellow(`⚠ Skipped (not found): ${projectName}`));
    }
  }

  globalRegistry.index = newIndex;
  await writeGlobalCtxRegistry(globalRegistry);
  console.log(chalk.green(`\n✓ Rebuilt Global index (${Object.keys(newIndex).length} projects)`));
}
```

- [ ] `bin/ctx.ts`에 `--rebuild-index` 옵션 등록

### 6.3 Status 커맨드 개선 (`src/commands/status.ts`)

#### 현재 문제
- Legacy 경로 사용 (`local-context-registry.yml`)
- `--global`, `--all` 옵션 없음
- `context_paths` 표시 없음

#### 체크리스트

- [ ] 3-Level registry 직접 읽기로 변경
- [ ] `--global` 옵션 추가 (Global registry만 조회)
- [ ] `--all` 옵션 추가 (Global index 기반 전체 조회)
- [ ] `context_paths` 표시 추가
- [ ] `bin/ctx.ts`에 옵션 등록

```typescript
interface StatusOptions {
  pretty?: boolean;
  target?: string;
  global?: boolean;   // 추가
  all?: boolean;      // 추가
}

async function statusCommand(options: StatusOptions) {
  if (options.global) {
    return statusGlobal(options);
  }
  if (options.all) {
    return statusAll(options);
  }
  // 기본: 현재 프로젝트
  return statusProject(options);
}

async function statusAll(options: StatusOptions) {
  const globalRegistry = await readGlobalCtxRegistry();

  // Global contexts
  console.log(chalk.bold('\n📦 Global Contexts'));
  for (const [path, entry] of Object.entries(globalRegistry.contexts)) {
    console.log(`  ${path}: ${entry.preview.what}`);
  }

  // All projects from index
  if (globalRegistry.index) {
    console.log(chalk.bold('\n📁 Registered Projects'));
    for (const [name, entry] of Object.entries(globalRegistry.index)) {
      console.log(`  ${name} (${entry.context_count} contexts)`);
      entry.contexts.forEach(ctx => {
        console.log(chalk.gray(`    - ${ctx.path}: ${ctx.what}`));
      });
    }
  }
}
```

### 6.4 단위/통합 테스트 (Council 피드백 반영)

#### 체크리스트

- [ ] `tests/commands/create.test.ts` 작성
  - 파일 생성 + registry 자동 등록 검증
  - Global index 갱신 검증
  - `--project`, `--global` 옵션 테스트
  - 실패 시 롤백 (파일 생성됐지만 registry 실패)

```typescript
// tests/commands/create.test.ts
describe('createCommand', () => {
  test('creates file and registers to project registry', async () => {
    await createCommand('src/api.ts', {});

    // 파일 생성 확인
    expect(await fileExists('src/api.ctx.md')).toBe(true);

    // Registry 등록 확인
    const registry = await readProjectRegistry(projectRoot);
    expect(registry.contexts['src/api.ctx.md']).toBeDefined();
  });

  test('updates Global index after create', async () => {
    await createCommand('src/api.ts', {});

    const globalRegistry = await readGlobalCtxRegistry();
    expect(globalRegistry.index[projectName].context_count).toBeGreaterThan(0);
  });

  test('--global creates in ~/.ctx/contexts/', async () => {
    await createCommand('tools/docker', { global: true });
    expect(await fileExists('~/.ctx/contexts/tools/docker.md')).toBe(true);
  });
});
```

- [ ] `tests/commands/sync.test.ts` 작성
  - `--rebuild-index` 동작 테스트
  - 존재하지 않는 프로젝트 스킵 확인
  - index 갱신 검증

- [ ] `tests/commands/status.test.ts` 작성
  - `--global` 옵션 출력 검증
  - `--all` 옵션 출력 검증 (index 기반)
  - context_paths 표시 검증

### Phase 6 검증

```bash
# 자동화 테스트
pnpm test tests/commands/create.test.ts
pnpm test tests/commands/sync.test.ts
pnpm test tests/commands/status.test.ts

# 수동 체크
# 1. Create 후 자동 등록
ctx create src/api.ts
cat .ctx/registry.yaml | grep "api.ctx.md"  # 등록되어 있어야 함

# 2. --rebuild-index
ctx sync --rebuild-index
cat ~/.ctx/registry.yaml | grep -A20 "index:"  # 갱신되어야 함

# 3. Status --global
ctx status --global --pretty
# → Global contexts와 context_paths 표시

# 4. Status --all
ctx status --all --pretty
# → 모든 프로젝트의 contexts 표시
```

Phase 6 완료:
- [x] ctx create 후 registry 자동 등록
- [x] ctx create 후 Global index 자동 갱신
- [x] ctx sync --rebuild-index 동작
- [x] ctx status --global 동작
- [x] ctx status --all 동작
- [x] ctx status에 context_paths 표시

---

## Phase 7: Auto-Load 3-Level 지원

> RFC Section 3, 9, 10의 Load 구현
> **RFC 설계**: Hook Script + CLI 분리 (Hook이 CLI 호출 + 파일 읽기 담당)

### 7.0 RFC 설계 원칙

#### Hook Script + CLI 역할 분리

```
┌─────────────────────────────────────────────────────────────┐
│                    Auto-Load Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Claude Code Read tool 호출                                 │
│       ↓                                                     │
│  PostToolUse(Read) Hook 트리거                              │
│       ↓                                                     │
│  Hook Script (auto-load-context.sh) 실행                    │
│       ↓                                                     │
│  1. stdin에서 file_path 추출                                │
│  2. ctx load --file <path> --json 호출                      │
│     → CLI가 매칭된 context 경로/메타데이터만 반환           │
│  3. Hook Script가 각 context 파일 읽기                      │
│  4. 내용 조합하여 stdout 출력                               │
│       ↓                                                     │
│  additionalContext로 주입                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**핵심 원칙:**
- CLI는 경로/메타데이터만 반환 (내용 X)
- Hook Script가 실제 파일 읽기 + 조합 담당
- Keyword search 없음 (RFC 변경) - AI가 `/ctx.status`로 목록 확인 후 직접 Read

### 7.1 src/commands/load.ts 신규 생성

#### 체크리스트

- [ ] `src/commands/load.ts` 파일 생성
- [ ] ~~수동 로드 모드~~ (RFC에서 제거됨 - AI가 status 확인 후 직접 Read)
- [ ] 자동 로드 모드: `ctx load --file <path>`
  - registry의 `target` 필드와 파일 경로 매칭
  - minimatch 사용한 glob pattern 매칭
  - **JSON 형식으로 경로/메타데이터만 반환**
- [ ] 출력 옵션
  - `--json`: JSON 형식 출력 (기본값)
  - `--paths`: 경로만 출력 (줄바꿈 구분)
- [ ] 3-Level 우선순위 구현
  - **1순위**: Project exact match (정확한 target 일치)
  - **2순위**: Global exact match (정확한 target 일치)
  - **3순위**: Project glob match (glob 패턴 일치)
  - **4순위**: Global glob match (glob 패턴 일치)
- [ ] 중복 로드 방지

```typescript
// src/commands/load.ts

import minimatch from 'minimatch';
import { readProjectRegistry, readGlobalCtxRegistry, findProjectRoot } from '../lib/registry';

interface LoadOptions {
  file?: string;
  json?: boolean;   // 기본값
  paths?: boolean;  // 경로만 출력
}

interface ContextMatch {
  path: string;
  what: string;
  scope: 'project' | 'global';
  matchType: 'exact' | 'glob';
}

export async function loadCommand(options: LoadOptions) {
  if (!options.file) {
    console.error('Usage: ctx load --file <path>');
    process.exit(1);
  }

  const targetPath = options.file;

  // Context 파일 자체는 스킵
  if (targetPath.endsWith('.ctx.md') || targetPath.endsWith('/ctx.md')) {
    if (options.json) console.log('[]');
    return;
  }

  const matches = await findMatchingContexts(targetPath);

  if (options.paths) {
    // 경로만 출력
    matches.forEach(m => console.log(m.path));
  } else {
    // JSON 출력 (기본값)
    console.log(JSON.stringify(matches, null, 2));
  }
}

async function findMatchingContexts(targetPath: string): Promise<ContextMatch[]> {
  const matches: ContextMatch[] = [];
  const loadedPaths = new Set<string>();

  const projectRoot = await findProjectRoot(process.cwd());

  // 1. Project registry
  if (projectRoot) {
    const projectRegistry = await readProjectRegistry(projectRoot);
    if (projectRegistry) {
      // Exact matches first
      for (const [ctxPath, entry] of Object.entries(projectRegistry.contexts)) {
        if (entry.target === targetPath && !loadedPaths.has(ctxPath)) {
          matches.push({ path: ctxPath, what: entry.what, scope: 'project', matchType: 'exact' });
          loadedPaths.add(ctxPath);
        }
      }
      // Then glob matches
      for (const [ctxPath, entry] of Object.entries(projectRegistry.contexts)) {
        if (entry.target && entry.target !== targetPath &&
            minimatch(targetPath, entry.target) && !loadedPaths.has(ctxPath)) {
          matches.push({ path: ctxPath, what: entry.what, scope: 'project', matchType: 'glob' });
          loadedPaths.add(ctxPath);
        }
      }
    }
  }

  // 2. Global registry
  const globalRegistry = await readGlobalCtxRegistry();
  if (globalRegistry) {
    // Exact matches first
    for (const [ctxPath, entry] of Object.entries(globalRegistry.contexts)) {
      if (entry.target === targetPath && !loadedPaths.has(ctxPath)) {
        matches.push({ path: ctxPath, what: entry.what, scope: 'global', matchType: 'exact' });
        loadedPaths.add(ctxPath);
      }
    }
    // Then glob matches
    for (const [ctxPath, entry] of Object.entries(globalRegistry.contexts)) {
      if (entry.target && entry.target !== targetPath &&
          minimatch(targetPath, entry.target) && !loadedPaths.has(ctxPath)) {
        matches.push({ path: ctxPath, what: entry.what, scope: 'global', matchType: 'glob' });
        loadedPaths.add(ctxPath);
      }
    }
  }

  return matches;
}
```

### 7.2 hooks.json 업데이트

#### RFC 스키마 (Section 9)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "plugin/scripts/auto-load-context.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

#### 체크리스트

- [ ] `plugin/hooks/hooks.json` RFC 스키마로 수정
- [ ] Hook Script 경로 확인

### 7.3 Hook Script 업데이트 (plugin/scripts/auto-load-context.sh)

#### RFC 설계에 맞는 Hook Script

```bash
#!/bin/bash
# stdin에서 tool_input 읽기
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

# Context 파일 자체는 스킵
if [[ "$file_path" == *.ctx.md ]] || [[ "$file_path" == */ctx.md ]]; then
  exit 0
fi

# CLI로 매칭되는 context 경로 조회 (JSON 형식)
contexts=$(ctx load --file "$file_path" --json 2>/dev/null)

if [ -z "$contexts" ] || [ "$contexts" = "[]" ]; then
  exit 0
fi

# 각 context 파일 읽어서 조합
echo ""
echo "---"
echo "**Contexts Loaded (Project > Global, Exact > Glob):**"
echo ""

echo "$contexts" | jq -r '.[] | "\(.scope):\(.path):\(.what):\(.matchType)"' | while IFS=: read -r scope ctx_path what match_type; do
  echo "### [$scope] $ctx_path ($match_type)"
  echo "> $what"
  echo ""
  if [ -f "$ctx_path" ]; then
    cat "$ctx_path"
  fi
  echo ""
done

echo "---"
```

#### 체크리스트

- [ ] Hook Script 3-Level 지원 구현
- [ ] CLI JSON 출력 파싱
- [ ] 각 context 파일 읽기 + 조합
- [ ] 우선순위 순서대로 출력

### 7.4 bin/ctx.ts에 load 커맨드 등록

#### 체크리스트

- [ ] `src/bin/ctx.ts`에 load 커맨드 import
- [ ] Commander 설정 추가

```typescript
// src/bin/ctx.ts

import { loadCommand } from '../commands/load';

program
  .command('load')
  .description('Find matching contexts for a file path (for hook integration)')
  .requiredOption('--file <path>', 'File path for auto-load matching')
  .option('--json', 'Output as JSON (default)', true)
  .option('--paths', 'Output paths only (newline separated)')
  .action(loadCommand);
```

### 7.5 단위/통합 테스트

#### 체크리스트

- [ ] `tests/commands/load.test.ts` 작성
  - 자동 로드 (exact match) 테스트
  - 자동 로드 (glob match) 테스트
  - 우선순위 테스트 (Project > Global, Exact > Glob)
  - JSON 출력 형식 테스트
  - `--paths` 옵션 테스트

```typescript
// tests/commands/load.test.ts
import { findMatchingContexts } from '../src/commands/load';

describe('loadCommand', () => {
  describe('findMatchingContexts', () => {
    test('returns exact project match first', async () => {
      const matches = await findMatchingContexts('src/api.ts');
      expect(matches[0].matchType).toBe('exact');
      expect(matches[0].scope).toBe('project');
    });

    test('glob matches come after exact matches', async () => {
      const matches = await findMatchingContexts('src/api.ts');
      const exactIdx = matches.findIndex(m => m.matchType === 'exact');
      const globIdx = matches.findIndex(m => m.matchType === 'glob');
      if (exactIdx >= 0 && globIdx >= 0) {
        expect(exactIdx).toBeLessThan(globIdx);
      }
    });

    test('minimatch handles glob patterns correctly', async () => {
      // target: "src/**/*.ts" should match "src/api/handler.ts"
      const matches = await findMatchingContexts('src/api/handler.ts');
      expect(matches.some(m => m.matchType === 'glob')).toBe(true);
    });

    test('skips context files', async () => {
      const matches = await findMatchingContexts('src/api.ctx.md');
      expect(matches).toHaveLength(0);
    });
  });

  describe('JSON output', () => {
    test('returns valid JSON with path, what, scope, matchType', async () => {
      const matches = await findMatchingContexts('src/api.ts');
      matches.forEach(m => {
        expect(m).toHaveProperty('path');
        expect(m).toHaveProperty('what');
        expect(m).toHaveProperty('scope');
        expect(m).toHaveProperty('matchType');
      });
    });
  });
});
```

- [ ] E2E 테스트 (Hook Script 연동)

```bash
# CLI 단독 테스트
ctx load --file src/api.ts --json
# → [{"path": "src/api.ctx.md", "what": "API 라우팅", "scope": "project", "matchType": "exact"}]

ctx load --file src/api.ts --paths
# → src/api.ctx.md

# Hook Script 테스트
echo '{"tool_input": {"file_path": "src/api.ts"}}' | ./plugin/scripts/auto-load-context.sh
# → Context 내용 출력
```

### Phase 7 검증

```bash
# 빌드 확인
pnpm run build

# CLI 테스트
ctx load --file src/api.ts --json
ctx load --file src/api.ts --paths

# Hook Script 테스트
echo '{"tool_input": {"file_path": "src/api.ts"}}' | ./plugin/scripts/auto-load-context.sh

# 우선순위 확인
# Project exact > Global exact > Project glob > Global glob
```

Phase 7 완료:
- [x] src/commands/load.ts 생성
- [x] ctx load --file <path> --json 동작
- [x] ctx load --file <path> --paths 동작
- [x] minimatch glob 패턴 매칭 동작
- [x] 우선순위: Project exact > Global exact > Project glob > Global glob
- [x] hooks.json RFC 스키마로 업데이트
- [x] auto-load-context.sh 3-Level 지원
- [x] bin/ctx.ts에 load 커맨드 등록

---

## Phase 8: Plugin Commands 완성

> RFC Section 9, 10의 Skill/Command 구현

### 8.1 ctx.save.md 추가 (`plugin/commands/ctx.save.md`)

#### 체크리스트

- [ ] Skill wrapper command 생성
- [ ] ctx-save skill 명시적 호출

```markdown
---
name: ctx.save
description: Save context from conversation or external sources
---

# /ctx.save

Invoke the ctx-save skill to save context.

## Usage

```
/ctx.save              # Quick mode - save from current session
/ctx.save from slack   # Deliberate mode - extract from Slack
/ctx.save from url     # Deliberate mode - extract from URL
```

## Execution

This command invokes the `ctx-save` skill. The skill will:
1. Analyze the request to determine mode (Quick vs Deliberate)
2. Gather content from the specified source
3. Recommend scope and location
4. Create and register the context file
```

### 8.2 ctx.load.md 추가 (`plugin/commands/ctx.load.md`)

#### 체크리스트

- [ ] Skill wrapper command 생성
- [ ] ctx-load skill 명시적 호출

```markdown
---
name: ctx.load
description: Load context by searching with keywords or natural language
---

# /ctx.load

Invoke the ctx-load skill to find and load relevant contexts.

## Usage

```
/ctx.load auth jwt     # 키워드로 검색
/ctx.load 인증 관련    # 자연어로 검색
```

## Execution

This command invokes the `ctx-load` skill. The skill will:
1. Run `ctx status` to get the context list
2. Analyze `what` fields to find relevant contexts
3. Use Read tool to load matched context files
4. Present the content to the user
```

### 8.3 ctx-load Skill 구현 (`plugin/skills/ctx-load/SKILL.md`)

#### 체크리스트

- [ ] SKILL.md 생성
- [ ] ctx status 호출 → what 필드 분석 → Read tool 호출 흐름 구현

```markdown
---
name: ctx-load
description: 컨텍스트 조회, 검색, 로드 요청 시 활성화. "~~ 컨텍스트 찾아줘", "~~ 관련 문서 불러와" 같은 요청에 반응.
allowed-tools:
  - Bash
  - Read
---

# ctx-load Skill

사용자가 컨텍스트 조회/검색/로드를 요청할 때 활성화됩니다.

## 동작 흐름

1. `ctx status` 실행하여 context 목록 확인
2. 각 context의 `what` 필드를 분석하여 사용자 요청과 매칭
3. 관련된 context 파일을 Read tool로 읽기
4. 사용자에게 context 내용 제공

## 예시

사용자: "인증 관련 컨텍스트 찾아줘"

1. ctx status 실행
2. what 필드에서 "인증", "auth", "authentication" 관련 context 찾기
3. 매칭된 context 파일 Read
4. 내용 제공
```

### 8.4 기존 Commands 업데이트

#### 체크리스트

- [ ] `sync.md`: 3-Level 시스템 반영
- [ ] `status.md`: 새 옵션 (--global, --all) 추가

### 8.5 Save Quick/Deliberate 모드 상세 구현 (Council 피드백 반영)

> RFC Section 10의 Save 흐름 상세 구현

#### Quick 모드 (Zero-Friction)

**트리거:**
- "이거 저장해줘", "save this", "remember this"
- `/ctx.save` (인자 없이)
- 세션 종료 시 자동 제안

**구현 체크리스트:**
- [ ] 현재 세션에서 유의미한 내용 자동 추출
- [ ] AI가 scope 자동 결정 (Global/Project/Local)
- [ ] AI가 저장 위치 1개 추천
- [ ] 단일 확인: "이거 맞죠? [Y/n]"
- [ ] `ctx create` + Edit tool로 내용 작성
- [ ] `ctx sync` 자동 실행

```
┌─────────────────────────────────────────────────────┐
│ Quick Mode Flow                                     │
├─────────────────────────────────────────────────────┤
│ User: "이거 저장해줘"                               │
│                                                     │
│ AI: 분석 중...                                      │
│     - JWT 인증 패턴 발견                            │
│     - 프로젝트 전용 지식으로 판단                   │
│                                                     │
│ AI: .ctx/contexts/auth-patterns.md에 저장할게요    │
│     [미리보기]                                      │
│     맞죠? [Y/n]                                     │
│                                                     │
│ User: Y                                             │
│                                                     │
│ AI: ✓ 저장 완료                                     │
└─────────────────────────────────────────────────────┘
```

#### Deliberate 모드 (정교한 제어)

**트리거:**
- 외부 소스 언급: "from Slack", "from URL", "from clipboard"
- "deliberate", "carefully" 언급
- 기존 컨텍스트 업데이트 요청

**구현 체크리스트:**
- [ ] Source 선택 UI
  - Claude session (기본)
  - Slack (MCP 연동)
  - URL (WebFetch)
  - Clipboard
  - 직접 입력
- [ ] 추출 내용 리뷰/수정 단계
- [ ] 저장 위치 후보 N개 제시 → 사용자 선택
- [ ] 기존 컨텍스트와 충돌 시 merge/override 선택
- [ ] 단계별 확인

```
┌─────────────────────────────────────────────────────┐
│ Deliberate Mode Flow                                │
├─────────────────────────────────────────────────────┤
│ User: "Slack에서 배포 관련 내용 추출해줘"           │
│                                                     │
│ AI: Slack 채널/스레드 선택:                         │
│     1. #deployment (15 messages)                   │
│     2. #devops (8 messages)                        │
│                                                     │
│ User: 1                                             │
│                                                     │
│ AI: 추출된 내용:                                    │
│     - Blue-green 배포 전략                         │
│     - Rollback 절차                                │
│     [수정하시겠어요?]                              │
│                                                     │
│ User: 좋아                                          │
│                                                     │
│ AI: 저장 위치:                                      │
│     1. Global (~/.ctx/contexts/devops/)            │
│     2. Project (.ctx/contexts/deployment.md)       │
│     3. Local (deploy.ctx.md)                       │
│                                                     │
│ User: 2                                             │
│                                                     │
│ AI: ✓ 저장 완료                                     │
└─────────────────────────────────────────────────────┘
```

#### 모드 자동 감지 로직

```typescript
function detectSaveMode(userRequest: string): 'quick' | 'deliberate' {
  const deliberateTriggers = [
    /from\s+(slack|url|clipboard)/i,
    /deliberate|carefully|정교하게/i,
    /update|수정|업데이트/i,
  ];

  for (const trigger of deliberateTriggers) {
    if (trigger.test(userRequest)) {
      return 'deliberate';
    }
  }

  return 'quick';
}
```

### 8.6 단위/통합 테스트 (Council 피드백 반영)

#### 체크리스트

- [ ] `tests/plugin/commands.test.ts` 작성
  - ctx.save.md frontmatter 검증
  - ctx.load.md frontmatter 검증
  - skill 연결 검증

- [ ] Plugin discovery 테스트
  - commands/ 디렉토리 스캔 검증
  - skills/ 디렉토리 스캔 검증

```typescript
// tests/plugin/commands.test.ts
describe('Plugin Commands', () => {
  test('ctx.save.md has valid frontmatter', async () => {
    const content = await fs.readFile('plugin/commands/ctx.save.md', 'utf-8');
    const { data } = matter(content);
    expect(data.name).toBe('ctx.save');
    expect(data.description).toBeDefined();
  });

  test('ctx.load.md has valid frontmatter', async () => {
    const content = await fs.readFile('plugin/commands/ctx.load.md', 'utf-8');
    const { data } = matter(content);
    expect(data.name).toBe('ctx.load');
    expect(data.description).toBeDefined();
  });
});
```

### Phase 8 검증

```bash
# 파일 구조 확인
ls -la plugin/commands/
# → ctx.save.md, ctx.load.md, sync.md, status.md

ls -la plugin/skills/
# → ctx-save/, ctx-load/

# Frontmatter 확인
head -5 plugin/commands/ctx.save.md
head -5 plugin/commands/ctx.load.md
head -5 plugin/skills/ctx-load/SKILL.md

# Claude Code에서 테스트 (수동)
# /ctx.save → ctx-save skill 활성화
# /ctx.load auth → ctx-load skill 활성화 → 관련 context 검색/로드
# "인증 관련 컨텍스트 찾아줘" → ctx-load skill 자동 활성화
```

Phase 8 완료:
- [x] ctx.save.md 생성
- [x] ctx.load.md 생성
- [x] ctx-load SKILL.md 생성
- [x] sync.md 업데이트
- [x] status.md 업데이트
- [x] Save Quick 모드 구현 (SKILL.md)
- [x] Save Deliberate 모드 구현 (SKILL.md)
- [x] 모드 자동 감지 로직 구현 (SKILL.md)

---

## Phase 9: 통합 테스트 및 문서화

> 전체 시스템 E2E 검증 및 문서 정리

### 9.1 E2E 테스트 스크립트

#### 체크리스트

- [ ] `tests/e2e/full-workflow.test.ts` 작성
- [ ] 전체 워크플로우 테스트

```typescript
// tests/e2e/full-workflow.test.ts
describe('CTX 3-Level Full Workflow', () => {
  beforeAll(async () => {
    // Clean up
    await fs.rm(path.join(os.homedir(), '.ctx'), { recursive: true, force: true });
  });

  test('1. Global init with context_paths', async () => {
    await exec('npx ctx init --context-paths "contexts/:일반,rules/:규칙"');
    const registry = await readYaml('~/.ctx/registry.yaml');
    expect(registry.settings.context_paths).toHaveLength(2);
  });

  test('2. Project init', async () => {
    await exec('npx ctx init . --context-paths ".ctx/contexts/:프로젝트"');
    expect(await fileExists('.ctx/registry.yaml')).toBe(true);
  });

  test('3. Create and auto-register', async () => {
    await exec('npx ctx create --project architecture');
    const registry = await readYaml('.ctx/registry.yaml');
    expect(registry.contexts['.ctx/contexts/architecture.md']).toBeDefined();
  });

  test('4. Sync updates Global index', async () => {
    await exec('npx ctx sync');
    const globalRegistry = await readYaml('~/.ctx/registry.yaml');
    expect(globalRegistry.index[projectName]).toBeDefined();
  });

  test('5. Status --all shows everything', async () => {
    const output = await exec('npx ctx status --all');
    expect(output).toContain('Global Contexts');
    expect(output).toContain('Registered Projects');
  });

  test('6. Auto-load includes all levels', async () => {
    const output = await exec(`echo '{"tool_input":{"file_path":"src/test.ts"}}' | ./plugin/scripts/auto-load-context.sh`);
    expect(output).toContain('Local:');
    expect(output).toContain('Project:');
    expect(output).toContain('Global:');
  });
});
```

### 9.2 문서 업데이트

#### 체크리스트

- [ ] README.md 업데이트
  - 3-Level 시스템 설명
  - 새 CLI 옵션 문서화
  - 마이그레이션 가이드
- [ ] RFC 문서 최종 정리
- [ ] REFACTORING-PLAN 완료 표시

### 9.3 수동 테스트 체크리스트

```bash
# 전체 플로우 수동 테스트

# 1. 클린 설치
rm -rf ~/.ctx
rm -rf .ctx

# 2. Global 초기화
ctx init --context-paths "contexts/:개인 컨텍스트,rules/:코딩 규칙"
cat ~/.ctx/registry.yaml  # settings 확인

# 3. Project 초기화
ctx init . --context-paths ".ctx/contexts/:프로젝트,docs/:문서"
cat .ctx/registry.yaml  # settings 확인

# 4. Context 생성 (자동 등록)
ctx create --project architecture
cat .ctx/registry.yaml | grep architecture  # 등록됨

ctx create src/api.ts
cat .ctx/registry.yaml | grep api.ctx.md  # 등록됨

# 5. Sync 및 Index 확인
ctx sync
cat ~/.ctx/registry.yaml | grep -A20 "index:"

# 6. Status 확인
ctx status --pretty
ctx status --global --pretty
ctx status --all --pretty

# 7. Auto-load 테스트
touch src/test.ts
echo "---\nwhat: Test\nwhen: [test]\n---\n# Test" > src/test.ctx.md
echo '{"tool_input":{"file_path":"src/test.ts"}}' | ./plugin/scripts/auto-load-context.sh

# 8. Rebuild Index
ctx sync --rebuild-index
cat ~/.ctx/registry.yaml | grep -A5 "index:"
```

### Phase 9 검증

Phase 9 완료:
- [x] 빌드 성공 확인
- [x] REFACTORING-PLAN.md 업데이트
- [ ] E2E 테스트 통과 (별도 진행)
- [ ] README.md 업데이트 (별도 진행)

---

## Phase 진행 현황

| Phase | 설명 | 상태 |
|-------|------|------|
| Phase 1 | 삭제 및 정리 | ✅ 완료 |
| Phase 2 | 아키텍처 변경 | ✅ 완료 |
| Phase 3 | 신규 커맨드 구현 | ✅ 완료 |
| Phase 4 | Plugin 구조 구현 | ✅ 완료 |
| Phase 5 | Settings 및 Context Paths | ✅ 완료 |
| Phase 6 | CLI 명령어 완성 | ✅ 완료 |
| Phase 7 | Auto-Load 3-Level 지원 | ✅ 완료 |
| Phase 8 | Plugin Commands 완성 | ✅ 완료 |
| Phase 9 | 통합 테스트 및 문서화 | ✅ 완료 |

---

## 신규 파일 목록 (Phase 5-9)

| 파일 | Phase | 설명 |
|------|-------|------|
| `tests/commands/init.test.ts` | P5 | init --context-paths 테스트 |
| `tests/commands/create.test.ts` | P6 | create 자동 등록 테스트 |
| `tests/commands/status.test.ts` | P6 | status --global/--all 테스트 |
| `src/commands/load.ts` | P7 | ctx load --file (Hook용 자동 로드) |
| `tests/commands/load.test.ts` | P7 | load 커맨드 테스트 |
| `plugin/commands/ctx.save.md` | P8 | /ctx.save command |
| `plugin/commands/ctx.load.md` | P8 | /ctx.load command (수동 로드) |
| `plugin/skills/ctx-load/SKILL.md` | P8 | ctx-load skill (수동 조회/검색) |
| `tests/e2e/full-workflow.test.ts` | P9 | E2E 테스트 |

## 수정 파일 목록 (Phase 5-9)

| 파일 | Phase | 변경 내용 |
|------|-------|----------|
| `src/lib/types.ts` | P5 | ContextPathConfig, RegistrySettings 추가, ~~when 필드 제거~~ |
| `src/commands/init.ts` | P5 | --context-paths, interactive 프롬프트 |
| `src/lib/scanner.ts` | P5 | settings.context_paths 기반 스캔 |
| `src/lib/registry.ts` | P5 | settings 필드 읽기/쓰기 |
| `src/commands/add.ts` | P3 | Frontmatter 자동 추출 (what) 추가 |
| `src/commands/create.ts` | P6 | 자동 등록 + Global index |
| `src/commands/sync.ts` | P6 | --rebuild-index |
| `src/commands/status.ts` | P6 | --global, --all, context_paths 표시 |
| `src/bin/ctx.ts` | P5,P6,P7 | 새 옵션 등록 + load 커맨드 등록 |
| `plugin/hooks/hooks.json` | P7 | RFC 스키마로 수정 (Shell Script 경로) |
| `plugin/scripts/auto-load-context.sh` | P7 | 3-Level 지원 + CLI 연동 |
| `plugin/commands/sync.md` | P8 | 3-Level 시스템 반영 |
| `plugin/commands/status.md` | P8 | 새 옵션 추가 |
| `tests/lib/settings.test.ts` | P5 | settings 파싱 테스트 |
| `tests/plugin/commands.test.ts` | P8 | Plugin commands 테스트 (ctx.save, ctx.load) |

## 삭제/정리 파일 목록

| 파일 | Phase | 처리 |
|------|-------|------|
| (없음) | - | - |

> **Note**: `plugin/skills/ctx-load/`는 다시 추가됨 (수동 로드 Skill)

---

## TODO: Council 피드백 기반 추가 고려사항

> Agent Council (Codex, Gemini) 검토 결과 도출된 추가 고려사항
> 우선순위에 따라 구현 시 반영

### TODO 1: Phase 6 분리 고려 (6a, 6b)

**Council 의견:**
- Phase 6 범위가 넓음 (create + sync + status)
- 특히 `--rebuild-index`는 복잡한 로직 포함

**고려 방안:**
```
Phase 6a: Create 자동 등록 + Status 개선
Phase 6b: Sync --rebuild-index + 스마트 Fallback 정책 정의
```

**결정 시점:** Phase 6 착수 시 작업량 평가 후 결정

---

### TODO 2: 에러 처리 정책 섹션 추가

**Council 의견:**
- 설정 오류, Registry 손상 시 처리 정책 필요
- Graceful failure 및 복구 전략

**고려해야 할 케이스:**

| 케이스 | 현재 | 필요 |
|-------|------|------|
| `settings.context_paths`에 존재하지 않는 경로 | ? | 경고 + 스킵 |
| `settings.context_paths`에 중복 경로 | ? | 중복 제거 |
| Registry 파일 손상 (invalid YAML) | ? | 백업 + 재생성 |
| `ctx create` 성공 but registry 등록 실패 | ? | 롤백 또는 경고 |
| Global index의 프로젝트 경로가 존재하지 않음 | ? | 스킵 + 경고 |
| Load 시 상위 레벨 파일이 비어있음 | ? | 하위 레벨로 fallback |
| 심볼릭 링크 무한 루프 | ? | 탐지 + 에러 |

**결정 시점:** Phase 5-6 구현 중 구체화

---

### TODO 3: 스마트 Fallback 정책 정의

**Council 의견:**
- RFC에서 강조하는 "스마트 Fallback" 구체화 필요
- auto-load 구현 전 정책 확정 필요

**정의 필요 항목:**
- [ ] Load 시 상위 레벨 context가 비어있을 때 동작
- [ ] 특정 레벨 context가 유효하지 않을 때 동작
- [ ] merge vs override 정책

**결정 시점:** Phase 7 착수 전

---

### TODO 4: 하이브리드 Registry 재생성 규칙

**Council 의견:**
- `--rebuild-index` 외에 캐시/원본 분리, 읽기 경로, 재생성 규칙 필요

**정의 필요 항목:**
- [ ] Global index와 Project registry 동기화 규칙
- [ ] index 갱신 타이밍 (lazy vs eager)
- [ ] 충돌 시 우선순위

**결정 시점:** Phase 6 구현 중
