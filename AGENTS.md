# AGENTS.md

AI 에이전트를 위한 CTX 프로젝트 가이드.

---

## 프로젝트 개요

**CTX**는 AI의 persistent memory 시스템. 컨텍스트가 자동으로 로드되고, 시간이 지나면서 성장하며, 코드와 함께 이동한다.

**핵심 철학:**
> Context is the bottleneck, not AI capability.

```
Human insight  →  Saved as context  →  Auto-loaded when needed
     ↑                                          │
     └──────────── Feedback loop ───────────────┘
```

---

## 3-Level Context System

| Level | Location | 용도 | 공유 범위 |
|-------|----------|------|----------|
| **Global** | `~/.ctx/` | 개인 패턴, 도구 설정 | 개인 (모든 프로젝트) |
| **Project** | `.ctx/` | 팀 지식, 아키텍처 | 팀 (Git으로 공유) |
| **Local** | `*.ctx.md` | 파일별 컨텍스트 | 팀 (코드 옆에) |

**우선순위:** Local > Project > Global (더 구체적인 것이 우선)

---

## CLI 명령어

```bash
# 초기화
ctx init              # Global 초기화 (~/.ctx/)
ctx init .            # Project 초기화 (.ctx/)

# 컨텍스트 생성
ctx create src/api.ts                    # Local (src/api.ctx.md)
ctx create --global typescript-tips      # Global
ctx create --project architecture        # Project

# 동기화
ctx sync              # 레지스트리 동기화 (체크섬, 프리뷰 업데이트)
ctx sync --local      # Local만
ctx sync --global     # Global만

# 상태 확인
ctx status            # JSON 출력
ctx status --pretty   # 읽기 쉬운 형식
ctx status --target src/api.ts   # 특정 파일의 컨텍스트 찾기

# 헬스체크
ctx check             # 컨텍스트 상태 검사
ctx check --fix       # 문제 자동 수정
```

---

## 프로젝트 구조

```
ctx/
├── src/
│   ├── bin/              # CLI 엔트리포인트
│   ├── commands/         # CLI 명령어 구현
│   │   ├── init.ts       # ctx init
│   │   ├── create.ts     # ctx create
│   │   ├── sync.ts       # ctx sync
│   │   ├── status.ts     # ctx status
│   │   ├── check.ts      # ctx check
│   │   ├── load.ts       # ctx load
│   │   ├── save.ts       # ctx save
│   │   └── ...
│   ├── lib/              # 핵심 라이브러리
│   └── templates/        # 컨텍스트 템플릿
├── plugin/               # Claude Code 플러그인
│   ├── .claude-plugin/
│   │   └── plugin.json   # 플러그인 설정
│   ├── skills/           # AI Skills
│   │   ├── ctx-load/     # 컨텍스트 로드 스킬
│   │   └── ctx-save/     # 컨텍스트 저장 스킬
│   ├── hooks/            # PostToolUse 등 훅
│   ├── commands/         # /ctx.* 명령어
│   └── shared/           # 스킬 간 공유 리소스
├── tests/
├── docs/
└── dist/                 # 빌드 결과물
```

---

## 개발 컨벤션

### TypeScript

- **Strict mode** 사용
- **ESM** 모듈 시스템 (`type: "module"`)
- **pnpm** 패키지 매니저

### 명령어

```bash
pnpm build            # TypeScript 컴파일
pnpm test             # Jest 테스트
pnpm lint             # ESLint
```

### 로컬 테스트

```bash
# 빌드 후 로컬에서 실행
pnpm build
npx ctx status

# 또는 ts-node로 직접
pnpm tsx src/bin/ctx.ts status
```

---

## Registry 구조

### Project Registry (`.ctx/registry.yaml`)

```yaml
version: 2
contexts:
  '.ctx/contexts/architecture.md':
    checksum: 'abc123'
    preview:
      what: "시스템 아키텍처 개요"
      when: ["architecture", "structure", "design"]
  'src/api.ctx.md':
    target: 'src/api.ts'
    checksum: 'def456'
    preview:
      what: "API 라우팅 패턴"
      when: ["api", "routing", "endpoint"]
```

### Global Registry (`~/.ctx/registry.yaml`)

```yaml
version: 2
contexts:
  '~/.ctx/contexts/coding-style.md':
    checksum: 'xyz789'
    preview:
      what: "개인 코딩 스타일"
      when: ["style", "convention"]

index:
  'projects/myapp':
    contexts:
      - path: 'src/api.ctx.md'
        what: "API 패턴"
        when: ["api"]
```

---

## Plugin 개발

### Skill 구조

```
skills/skill-name/
├── SKILL.md              # 필수: Frontmatter + 가이드
├── references/           # 상세 문서
├── scripts/              # 유틸리티 스크립트
└── assets/               # 템플릿, 이미지 등
```

### SKILL.md Frontmatter

```yaml
---
name: skill-name
description: This skill should be used when... (3rd person, trigger phrases)
allowed-tools: Read, Write, Edit, Bash
---
```

### 작성 스타일

- **Description**: Third-person ("This skill should be used when...")
- **Body**: Imperative form ("Execute...", "Check...", not "You should...")
- **크기**: 1,500-2,000 words 권장, 상세한 건 references/로

---

## 자주 하는 실수

### 1. sync 빼먹기

컨텍스트 생성/수정 후 반드시:
```bash
ctx sync
```

### 2. Registry 직접 수정

Registry는 `ctx sync`가 자동 생성. 직접 수정하지 말 것.

### 3. Local vs Project 혼동

- **Local** (`*.ctx.md`): 특정 파일에 붙음, `target` 필드 있음
- **Project** (`.ctx/contexts/*.md`): 프로젝트 전체 지식, `target` 없음

---

## 디버깅

```bash
# 현재 상태 확인
npx ctx status --pretty

# Registry 직접 확인
cat .ctx/registry.yaml
cat ~/.ctx/registry.yaml

# 헬스체크
npx ctx check --pretty

# 특정 파일의 컨텍스트 찾기
npx ctx status --target src/api.ts
```

---

## 관련 문서

- `README.md` - 사용자 가이드
- `docs/RFC-3-level-context-system.md` - 설계 문서
- `docs/REFACTORING-PLAN.md` - 리팩토링 계획
- `plugin/skills/*/SKILL.md` - 개별 스킬 가이드
