# CTX 3-Level Context System 리팩토링 플랜

> RFC-3-level-context-system.md 기반 전면 리팩토링
> 작성일: 2026-01-01

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

- [ ] `src/templates/ai-commands/work/` 전체 삭제 (7개 파일)
  - init.md, plan.md, commit.md, review.md, submit.md, extract.md, done.md
- [ ] `src/templates/hooks/ctx.track-session.sh` 삭제
- [ ] `src/templates/snippets/ctx-current.md` 삭제
- [ ] `src/commands/session.ts` 삭제

### 1.2 타입 정리 (`src/lib/types.ts`)

#### 체크리스트

- [ ] `IssueStoreType` 타입 삭제 (Line 14)
- [ ] `IssueStoreConfig` 인터페이스 삭제 (Lines 16-20)
- [ ] `Config.work` 필드 삭제 (Lines 34-37)
- [ ] 모든 import 정리

### 1.3 Init 커맨드 정리 (`src/commands/init.ts`)

#### 체크리스트

- [ ] Issue store 선택 prompt 제거 (Lines 97-128)
- [ ] `getGitHubRemoteUrl()` 함수 제거
- [ ] `getDefaultIssueStoreUrl()` 함수 제거
- [ ] Issues 디렉토리 생성 로직 제거
- [ ] `.ctx.current` gitignore 추가 로직 제거 (Lines 240-243)
- [ ] Work 디렉토리 gitignore 추가 로직 제거 (Lines 234-237)

### 1.4 Status 커맨드 정리 (`src/commands/status.ts`)

#### 체크리스트

- [ ] `StatusData.work` 필드 및 관련 타입 제거
- [ ] `collectWorkStatus()` 함수 전체 제거
- [ ] `generateSuggestions()`에서 work 관련 제안 제거
- [ ] `printStatusPretty()`에서 Work Session 섹션 제거

### 1.5 기타 정리

#### 체크리스트

- [ ] `src/lib/config.ts`: work 필드 처리 제거
- [ ] `src/commands/refresh.ts`: work 디렉토리 gitignore 항목 제거
- [ ] `src/lib/platforms/claudeCode.ts`: track-session hook 설정 제거
- [ ] `src/bin/ctx.ts`: session 커맨드 import/등록 제거
- [ ] `src/templates/ctx.config.yaml`: work 섹션 제거

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

- [ ] `UnifiedRegistry` 인터페이스 추가
- [ ] `ContextEntry` 타입에 `type: 'local' | 'project' | 'global'` 필드 추가
- [ ] `ProjectIndexEntry` 인터페이스 추가 (Global index용)
- [ ] 기존 `LocalContextRegistry`, `GlobalContextRegistry` 유지 (하위 호환)

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
  contexts: Array<{ path: string; what: string; when: string[]; }>;
}
```

### 2.2 Registry 모듈 재작성 (`src/lib/registry.ts`)

#### 체크리스트

- [ ] 상수 변경
  - `LOCAL_REGISTRY_FILE` → `REGISTRY_FILE = 'registry.yaml'`
  - `CTX_DIR = '.ctx'` (ctx → .ctx)
  - `GLOBAL_CTX_DIR = path.join(os.homedir(), '.ctx')`
- [ ] `findProjectRoot(startPath: string)` 함수 구현
  - 위로 탐색하며 `.ctx/registry.yaml` 찾기
- [ ] `getGlobalRegistryPath()` 함수 추가 (~/.ctx/registry.yaml)
- [ ] `getProjectRegistryPath(projectRoot)` 함수 수정 (.ctx/registry.yaml)
- [ ] `isGlobalInitialized()` 함수 추가
- [ ] `isProjectInitialized()` 마커 변경 (config.yaml → .ctx/registry.yaml)
- [ ] `updateGlobalIndex(projectRoot)` 함수 구현

### 2.3 FileUtils 수정 (`src/lib/fileUtils.ts`)

#### 체크리스트

- [ ] `isProjectInitialized()` 마커 변경
- [ ] `isGlobalInitialized()` 함수 추가
- [ ] `resolveGlobalContextPath()` 경로 수정 (ctx → .ctx)

### 2.4 Config 모듈 정리 (`src/lib/config.ts`)

#### 체크리스트

- [ ] `loadConfig()` 함수 → 하드코딩 기본값 반환으로 변경
- [ ] `createConfigFile()` 함수 제거
- [ ] `DEFAULT_PATTERNS` 상수 추가
  ```typescript
  export const DEFAULT_PATTERNS = {
    local: ['**/*.ctx.md', '**/ctx.md'],
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
  };
  ```

### 2.5 Scanner 수정 (`src/lib/scanner.ts`)

#### 체크리스트

- [ ] config 파라미터 제거, 하드코딩 패턴 사용
- [ ] `scanProjectContexts()` 함수 추가 (.ctx/contexts/ 스캔)
- [ ] `scanGlobalContexts()` 수정 (~/.ctx/contexts/ 스캔)
- [ ] 경로 수정 (ctx → .ctx)

### 2.6 Init 커맨드 분리 (`src/commands/init.ts`)

#### 체크리스트

- [ ] 인자 파싱 (`ctx init` vs `ctx init .`)
- [ ] `initGlobalContext()` 함수 구현
  - ~/.ctx/ 생성
  - ~/.ctx/registry.yaml 생성
  - ~/.ctx/contexts/ 생성
  - Plugin 설치 안내 출력
- [ ] `initProjectContext()` 함수 구현
  - Global 초기화 확인 (없으면 에러)
  - .ctx/ 생성
  - .ctx/registry.yaml 생성
  - .ctx/contexts/ 생성
  - AI commands 설치
- [ ] config.yaml 생성 로직 완전 제거

### 2.7 Sync 커맨드 수정 (`src/commands/sync.ts`)

#### 체크리스트

- [ ] `findProjectRoot()` 사용하여 프로젝트 탐색
- [ ] 스마트 fallback 로직 구현
  - Project 발견 → Project sync + Global index 갱신
  - Project 없음 → 경고 + Global sync
- [ ] `updateGlobalIndex()` 호출 추가
- [ ] `--rebuild-index` 옵션 추가
- [ ] config 의존성 제거

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

- [ ] 파일 생성
- [ ] glob 패턴 지원 구현
- [ ] `--global` 옵션으로 Global registry 등록
- [ ] 중복 등록 방지 로직
- [ ] 자동 Global index 갱신
- [ ] `bin/ctx.ts`에 커맨드 등록

```typescript
export async function addCommand(patterns: string[], options: { global?: boolean }) {
  // 1. glob 패턴 확장
  // 2. 각 파일: 존재 확인, frontmatter 검증, registry 등록
  // 3. Global index 갱신 (Project context인 경우)
}
```

### 3.2 Remove 커맨드 (`src/commands/remove.ts` - 신규)

#### 체크리스트

- [ ] 파일 생성
- [ ] glob 패턴 지원
- [ ] registry에서만 제거 (파일 삭제 안 함)
- [ ] Global index 갱신
- [ ] `bin/ctx.ts`에 커맨드 등록

### 3.3 Migrate 커맨드 (`src/commands/migrate.ts` - 신규)

#### 체크리스트

- [ ] 파일 생성
- [ ] Global 초기화 확인
- [ ] 기존 구조 감지 (ctx.config.yaml 존재 여부)
- [ ] 구조 변환:
  - ctx/ → .ctx/contexts/ 이동
  - local-context-registry.yml + global-context-registry.yml → .ctx/registry.yaml 병합
  - ctx.config.yaml 삭제
- [ ] work 관련 파일 정리 (.ctx.current 등)
- [ ] .gitignore 업데이트
- [ ] `bin/ctx.ts`에 커맨드 등록

### 3.4 CLI 등록 (`src/bin/ctx.ts`)

#### 체크리스트

- [ ] session 커맨드 제거 확인
- [ ] add 커맨드 등록
- [ ] remove 커맨드 등록
- [ ] migrate 커맨드 등록
- [ ] init 커맨드 인자 처리 수정

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
│   ├── save/
│   │   └── SKILL.md
│   └── load/
│       └── SKILL.md
├── commands/
│   ├── ctx.sync.md
│   └── ctx.status.md
└── hooks/
    ├── hooks.json
    └── auto-load.sh
```

### 4.2 체크리스트

- [ ] plugin/ 디렉토리 생성
- [ ] plugin.json 작성
- [ ] Save skill (SKILL.md) 작성
- [ ] Load skill (SKILL.md) 작성
- [ ] CLI wrapper commands 작성
- [ ] PostToolUse(Read) hook 구현
- [ ] Init 시 plugin 설치 안내 추가

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

### 신규 생성 (3개)

| 파일 | Phase |
|------|-------|
| `src/commands/add.ts` | P3 |
| `src/commands/remove.ts` | P3 |
| `src/commands/migrate.ts` | P3 |

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
- [ ] `npm run build` 성공
- [ ] `ctx init` work prompt 없음
- [ ] `ctx status` work 섹션 없음

Phase 2 완료:
- [ ] `ctx init` → ~/.ctx/ 생성
- [ ] `ctx init .` → .ctx/ 생성
- [ ] `ctx sync` 스마트 fallback 동작

Phase 3 완료:
- [ ] `ctx add/remove` 동작
- [ ] `ctx migrate` 기존 프로젝트 변환 성공

---

## Critical Files (구현 순서대로)

1. **`src/lib/types.ts`** - 타입 시스템의 중심, 모든 모듈에 영향
2. **`src/commands/init.ts`** - Global/Project 분리의 핵심
3. **`src/lib/registry.ts`** - 하이브리드 registry 로직
4. **`src/commands/sync.ts`** - 스마트 fallback + Global index
5. **`src/commands/add.ts`** - 명시적 등록 시스템 (신규)
