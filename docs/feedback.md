## 1. 컨텍스트를 저장시켜달라고 했을 때 따로 묻지 않고 바로 저장시켜 버림
### 개선안1: 바로 저장해달라는 뉘앙스가 아니면 물어보기
### 개선안2: 이 대화내용이라고 하면 claude code session을 읽어서 처리해야 하는데 그게 잘 안되는듯? 

> 이 대화내용에서 내가 생각하는 이 프로덕트 방향성을 컨텍스트로 저장시켜줄래?
  ⎿  UserPromptSubmit hook error

⏺ /ctx:ctx-save

⏺ 먼저 기존 컨텍스트를 확인할게.

⏺ Bash(ctx list --pretty 2>/dev/null || echo "No contexts found")
  ⎿  Contexts (0)

     No contexts found.

⏺ 관련 컨텍스트가 없으니 새로 만들게. 대화 내용에서 핵심 방향성을 정리해서 저장할게.

⏺ Bash(ctx save --path .ctx/contexts/product-vision.md --what "Contents Hub 프로덕트 비전과 방향성" --keywords
      "product,vision,contents-hub,구독,digest" --content "# Contents Hub…)
  ⎿  ✓ Saved: /Users/hoyeonlee/team-attention/contents-hub/.ctx/contexts/product-vision.md
       Registered in project registry

⏺ Bash(ctx sync)
  ⎿  Syncing project contexts...

     Scanning contexts...
     … +6 lines (ctrl+o to expand)


## 2. session capture가 상황에 맞게 잘 호출이 안되는듯?
### 개선안1: session capture 스킬을 잘 호출되게 뭔가 수정해보기

## 3. 저장하는 거 물어볼 때 뭔가 더 보기 쉽게 할 수 없나? 
### 개선안: 저장할 경로, 저장할 내용을 물어보고 checkbox 형태로? 선택할 수 있게? (interactive-review를 같이?)
오늘 이 프로젝트에서 있었던 대화 내용들 바탕으로 컨텍스트 저장할 거 해줄래? 바로 말고 물어봐 나한테 저장하기 전에
  ⎿  UserPromptSubmit hook error

⏺ 오늘 대화 내용을 보면 저장할 만한 컨텍스트가 몇 가지 있어:

  1. 프로젝트 아키텍처 (추천)
  - 전체 구조 (server/client/extension)
  - 핵심 모듈들 (subscriptions, fetcher, digester, orchestrator)
  - 데이터 흐름 및 상태 전이
  - 기술 스택 (NestJS, Playwright, Drizzle, Gemini 등)

  2. 기술적 도전과 해결책
  - 봇 탐지 우회 (stealth script, browser pool)
  - 동적 콘텐츠 처리 (4단계 fallback 전략)
  - 다양한 HTML 구조 대응 (selector/structural/url-based lookup)

  3. 프로덕트 비전 ✅ 이미 저장함

  어떤 것들을 저장할까? 1번만, 2번만, 아니면 둘 다?

> 방금 오늘 대화 내용을 어떻게 확인했어?
  ⎿  UserPromptSubmit hook error

⏺ 솔직히 말하면, 별도로 조회한 게 아니라 이 대화 세션의 맥락을 그냥 기억하고 있는 거야.

  1. 처음에 Task tool로 프로젝트 탐색 → 아키텍처 분석 결과를 받음
  2. 링크드인 글 작성
  3. 프로덕트 비전 저장

  이 흐름이 대화에 다 있어서 그걸 바탕으로 정리한 거지.

만약 Claude Code 세션 히스토리를 체계적으로 캡처하고 싶으면 /ctx.capture 스킬이 있어. 이걸 쓰면 세션에서 있었던 작업들을 추출해서 컨텍스트로 저장할 수 있어.

## 4. 초기화할 때 SKILL 권한을 안물어보게 할 수는 없나~? 

## 5. session capture 할 때 inbox 잘 저장이 안되는듯 + source에 대해서 명시가 잘 되면 좋을듯?
### 개선안1: context template에 source에 대한 명시 추가하기 + 가져온 source를 metadata와 실제 source data 분리할 수는 없나? (metadata에 source에 대한 명시가 들어가있게 하기..?) (drizzle orm migration 같이?). 이렇게 하면 source data는 용량이크니까 gitignore 하더라도 metadata 정도는 체크인이 가능하지 않을까 싶어서 


## 6. session capture에서 너무 긴 경우들이 잇다.. 어케하누ㅠ
⏺ Read(~/.claude/projects/-Users-hoyeonlee-team-attention-terraform/a684194e-c3b
      7-4714-93d0-fbffc10eedbd.jsonl)
  ⎿  Error: File content (48231 tokens) exceeds maximum allowed tokens (25000).
     Please use offset and limit parameters to read specific portions of the
     file, or use the GrepTool to search for specific content.

## 7. 
