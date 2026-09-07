# F6 실기 픽스처 — MCP 캔버스 (2026-09-07 신설, U0)

「canned 를 손으로 지어낸 작은 값」으로 두면 응답 크기·잘림·허용목록 검사가 **전부 초록으로 지나간다**.
그래서 «실기» 픽스처를 둔다.

## 담긴 것 (계획서 §4-F6)

| 것 | 수 | 비고 |
|---|---|---|
| 섹션 | 2 | `sec_fixt_1`(히어로) · `sec_fixt_2`(스펙) |
| 텍스트 | 3 | 그중 1개는 **프레임 «안»** (`tb_fx_inframe`) — #1 결함이 삼키던 자리 |
| 사진 | 3 | 3,400B ×2 · **400,000B ×1** |
| 표 | 1 | 5행 × 4열 |
| 갭 | 2 | 48px · 24px |
| 프레임 | 1 | `ss_fx_frame_1` |
| 블록 합 | **10** | |

★사진 3장 중 **2장은 인라인 dataURL** 이다(`small-b` 3,400B · `big` 400,000B).
DOM 쪽에 `base64,` 가 **실제로 있어야** F4 의 「응답에 base64 0건」이 «자극 있는» 검사가 된다.
자극이 없으면 그 검사는 아무것도 증명하지 않는다.

## 파일

| 파일 | 무엇 |
|---|---|
| `make-fixture.mjs` | ★**생성기가 정본이다.** 손으로 고치지 마라 |
| `canvas.html` | 실기 DOM (`#canvas > .section-block > [id]`) |
| `img/small-a.png` `img/small-b.png` `img/big.png` | 결정적(seeded) PNG. 정확히 3,400 / 3,400 / 400,000 B |
| `canvas-state.json` | **렌더러 끝의 정본** — `js/canvas-state.js` 가 이 DOM 에서 내는 값 |
| `manifest.json` | 파일별 sha256 + 바이트. 다르면 **「비교 불가」** |

## 쓰는 곳

- `tests/unit/_mcp-canned.js` → F2 하네스의 가짜 렌더러가 `getCanvasState` 로 돌려준다
- `tests/unit/mcp-response-budget.test.js` (F4) · `tests/unit/mcp-two-ends.test.js` (F7)
- `tests/dom/canvas-state.dom.spec.js` (F7 렌더러 끝) — ★**진짜** `js/canvas-state.js` 를
  크로미움에 띄워 `canvas-state.json` 과 대조한다

## 검사·재생성

    node tests/fixtures/mcp-canvas-fixture/make-fixture.mjs --check   # 0=일치 1=불일치 2=검사불가
    node tests/fixtures/mcp-canvas-fixture/make-fixture.mjs           # 재생성(같은 해시가 나와야 한다)

## ★함정 기록 (실제로 겪은 것)

`canvas-state.json` 을 **손으로** 적었더니 `ab_fx_small_a` 에 `natural: "28x28"` 을 넣어 놨는데,
`tests/dom` 을 `page.setContent()` 로 띄우면 **base URL 이 없어** 상대경로 이미지(`img/small-a.png`)가
안 뜬다 → `naturalWidth = 0` → 진짜 렌더러는 `natural` 을 **안** 싣는다.
즉 픽스처가 «틀린 채로» 양끝 비교의 앞끝이 될 뻔했다.
⇒ DOM 검사는 `page.goto('file://…/canvas.html')` 로 **연다**. 이걸 잡아준 게 F7-DOM 이다.
**「앞끝이 옳다」를 재는 검사가 없으면, 양끝 비교 전체가 거짓 위에 선다.**
