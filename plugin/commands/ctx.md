---
name: ctx
description: Central command for all context operations - load, save, capture, status, sync
---

# /ctx

Single entry point for all CTX operations. Invoke the `ctx` agent with the user's request.

## Usage

```
/ctx <description>
```

## Examples

```
/ctx api 컨텍스트 로드해줘
/ctx 오늘 세션 저장해줘
/ctx 현재 상태 확인
/ctx auth 관련 문서 찾아줘
/ctx 이 대화 내용 정리해서 저장
```

## Behavior

Pass the user's description to the ctx agent. The agent will:
1. Analyze the intent (load, save, capture, status, etc.)
2. Route to appropriate skill(s)
3. Execute and report results
