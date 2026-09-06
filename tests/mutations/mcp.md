# MCP 검사 변이 목록 (F5) — 2026-09-07 신설, U0

## 왜 이 파일이 있나

**초록은 「검사가 있다」는 뜻이 아니다.** 검사가 아무것도 안 재도 초록이다.
2026-09-07 실측: MCP 도구 **84개 중 79개가 단위검사에 «이름조차» 없었다.**
단위검사 81파일 중 MCP 디스패처를 부르는 것은 **0개**였다 —
`tests/unit/_ipc-harness.js` 가 `whenReady` 를 pending 으로 묶어 MCP 등록까지 안 닿기 때문이다.
그 상태에서도 전체 스위트는 **1081 pass / 0 fail** 이었다.

그래서 **일부러 망가뜨리고 빨강이 나는지**를 기계로 확인한다.
빨강이 안 나면 그 검사는 검사가 아니다 → **반려**.

    node tools/mcp-mutation-sweep.mjs          # 전부 (exit 0=전부 빨강 / 1=샌 게 있다 / 2=못 돌았다)
    node tools/mcp-mutation-sweep.mjs --list   # 목록만
    node tools/mcp-mutation-sweep.mjs --only M6-allowlist-summary

스윕은 변이마다 ⑴원본 백업 ⑵치환 ⑶대상 검사 실행 ⑷판정 ⑸복원을 하고,
끝에 **원본과 sha256 동일**을 다시 확인한다. ⛔git stash/checkout 을 안 쓴다(남의 worktree 와 얽힌다).

## 실행 결과 — 2026-09-07 @ `6dc2385` (+ U0 신규 검사)

기준선: `unit 21 pass / 0 fail` · `mcp-contract-snapshot --check` exit 0
스윕 종료코드 **0** · 원본 복원 sha256 `fe55fac6e00aa0aa…` 동일 확인

| # | 변이 | 무엇을 망가뜨리나 | 기대 빨강 | **실제 빨강** | 판정 |
|---|---|---|---|---|---|
| M1 | `add_text_block` 의 `_rendererInvoker.addTextBlock(...)` 호출을 `{ok:true}` 로 대체 | ★**배선 삭제** — 도구는 답하는데 렌더러를 안 부른다 | F3-2 | F3-2 F3-5 | 빨강 |
| M2 | `_rendererInvoker.getCanvasState` → `getCanvasStateV2` (키 오타) | ★**배선 삭제(키)** — 조용히 「없는 함수」가 된다 | F3-2 F4-1 F7-1 | F3-2 F4-1 F4-2 F4-3 F7-1 F7-2 F7-3 F7-5 | 빨강 |
| M3 | `registerTool` 이 `add_gap_block` 을 등록하지 않게 | ★**배선 삭제(등록 줄)** — 도구가 목록에서 사라진다 | F3-0 | F3-0 F3-0b F3-6 | 빨강 |
| M4 | `_serializeCall` 의 체인을 `Promise.resolve().then(run)` 으로 | **직렬화 제거** — 병렬 편집이 겹쳐 옛 문서에 떨어진다 | F3-5 | F3-5 | 빨강 |
| M5 | `if (!_tokenOk(tok))` → `if (false)` | **헤더 삭제** — 로컬 포트에 아무나 붙어 캔버스를 고친다 | F3-3 | F3-3 | 빨강 |
| M6 | `_slimCanvasState` 허용목록에서 `o.summary = b.summary` 줄 삭제 | ★**허용목록 누락** — #1 결함 그 자체 | F7-2 F7-3 F4-1 | F4-1 F7-2 F7-3 | 빨강 |
| M7 | `raw.sections.map` → `raw.sections.slice(-1).map` | ★**「전부」→「마지막」** — #1 결함의 모양 | F4-1 F7-1 | F4-1 F7-1 F7-2 F7-3 | 빨강 |
| M8 | `_CANVAS_AUTO_SUMMARY_CHARS` 24000 → 999999999 | **기본값 되돌리기** — 85MB 캔버스가 통째로 나간다 | F4-3 F1 | F4-3 F1 | 빨강 |
| M9 | `get_canvas_state` 응답에 `data:image/png;base64,…` 를 얹음 | **금지 문자열 유출** | F4-1 F4-7 | F4-1 F4-2 F4-7 | 빨강 |
| M10 | `tools/list` 가 `includeHidden` 을 무시 | **숨김이 「제거」가 됨** — 별칭 51개가 죽는다 | F3-0 F1 | F3-0 F3-0b F3-6 F1 | 빨강 |

**10/10 빨강.**

## ★스윕이 «내 검사»에서 잡아낸 것 (이게 스윕의 값이다)

1. **M4 가 처음엔 초록으로 샜다.** F3-5 를 「호출 «순서»(seq 간격)」로 쟀는데,
   순서는 직렬화가 없어도 자주 맞는다 → **직렬화를 안 재고 있었다.**
   ⇒ 「편집이 실제로 시간을 쓰게」 하고 **동시 진행 최대치(peak concurrency)가 1인가**로 바꿨다.
   그 뒤 M4 가 빨강으로 전환됐다.
2. **M1 이 처음엔 「검사불가」였다.** 치환 대상 문자열이 소스에 없었다(내가 코드를 잘못 옮겨 적었다).
   ⇒ 스윕은 「대상을 못 찾음」을 **초록이 아니라 실패**로 센다. 안 그러면 「변이를 넣었는데
   아무 일도 안 일어났다」가 「검사가 훌륭하다」로 읽힌다.

## ★변이가 «못 닿는» 곳 (추정 아님 — 구조상 못 닿는다)

- `main.js` 의 렌더러측 `add*` 구현. 특히 **결함 #2(같은 blockId 반환, `main.js:3215` 부근의
  「문서순 마지막」/차집합 도출)** 은 이 하네스의 사정거리 **밖**이다.
  이 하네스는 `main/claude-pm/mcp-server.js` 를 Electron 없이 적재하고 렌더러를 **Proxy 로 가짜**로
  세우므로, 「렌더러가 어떤 id 를 만들어 돌려주는가」는 **canned 가 정한다** — 즉 잴 수 없다.
  ⇒ #2 의 검사는 `_ipc-harness`(main.js 적재) 또는 실기 앱 쪽에서 따로 세워야 한다.
- `js/*.js` 렌더러 파일. `js/canvas-state.js` 만 `tests/dom/` 에서 크로미움으로 재고 있다.

## 변이를 늘릴 때

`tools/mcp-mutation-sweep.mjs` 의 `MUTATIONS` 배열에 `{id, why, file, find, replace, expectRed}` 를 넣는다.
`find` 는 소스에 **그대로 있어야** 한다(없으면 「검사불가」로 실패 처리된다).
`expectRed` 에는 「이 변이를 넣으면 빨강이어야 할 검사 이름의 접두사」를 적는다.

## ⚠️겹침 고지 — 팀 표준 변이 스윕이 «이미 있다»

`tools/mutation-sweep.js` + `tools/mutations.json` (45건, **MCP 관련 0건**).

이 파일과 `tools/mcp-mutation-sweep.mjs` 가 «따로» 있는 이유는 하나다:
표준 러너는 「**몇 개** 테스트가 죽었나」를 세는데, 여기선 「**어느** 검사가 죽어야 하는가」
(`expectRed`)를 못박고 **안 죽으면 실패**로 센다. 안 그러면 「엉뚱한 검사가 죽어서 초록이 아닌 것」을
「그 검사가 산다」로 읽는다.

**통합 후보다.** 안 합친 이유: `mutations.json` 에 10건을 더하면 표준 스윕이 변이마다
단위 스위트 **전체(1,102개)** 를 돌려 실행시간이 크게 는다. 그 비용은 팀 결정 사항이라 혼자 물리지 않았다.
합칠 거면 표준 러너에 `expectRed` 개념을 넣는 쪽을 권한다.
