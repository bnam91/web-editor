/* chat-bounds — 챗 블럭 «숫자 값의 경계» 명부. ★이 파일의 전부가 그 표 하나다. (2026-10-06 ⒝)
 *
 * ★왜 ★별 파일인가 — ⛔처음엔 이 표를 chat-block.js 에 두고 prop-chat.js 가 그걸 import 했다.
 *   그러자 tests/dom/number-field-contract.dom.spec.js 가 ★전부 타임아웃했다(실측 14/14, `waitForFunction` 30s).
 *   까닭: 그 하네스는 모듈을 ★여섯 개만 골라 싣고(prop-number-commit-guard·gap·page·sticker·chat·shape)
 *     globals.js 를 ★스텁한다. prop-chat → chat-block 간선 하나가 그 그래프를 통째로 키웠다
 *     (chat-block → line-host → prop-grid·grid-block → …) ⇒ 평가가 죽어 window.__ready 가 영영 안 켜졌다.
 *     ★그 spec 머리주석이 이미 적어 둔 그 함정이다: 「모듈 그래프가 통째로 안 떠 __ready 가 영영 안 켜진다」.
 *   ⇒ ★표만 «의존 0» 인 파일로 뽑는다. 그러면 ㉠명부는 여전히 ★하나고 ㉡하네스가 끌어오는 그래프는 ★이 파일에서 끝난다.
 *   ⛔표를 양쪽에 베끼는 길로 되돌리지 마라 — 그게 ⒝ 의 결함(패널 상한이 모델보다 좁음) 그 자체였다.
 *
 * ★모델(chat-block.js updateChatBlock)과 패널(prop-chat.js: 속성 min/max ＋ 핸들러 클램프)이 ★셋 다 여기서 파생한다.
 *   ⛔숫자를 다른 자리에 손으로 적지 마라. 2026-10-06 에 그 셋이 갈려 있었고 ★패널이 모델의 340 을 가렸다.
 * ⛔이 표를 늘리면 ★패널에 손잡이가 있는지도 같이 세라 — 값은 사는데 누를 데가 없으면 MCP 전용 필드다.
 * ★지키는 자: tests/unit/typo-section-ssot.test.mjs T2-c(패널에 «맨 숫자» min/max 0건) ·
 *            tests/dom/chat-slider-number-bound.dom.spec.js S0~S2(슬라이더·숫자칸·모델 셋이 같은 값).
 */
export const CHAT_NUM_BOUNDS = Object.freeze({
  gap:            { min: 0,    max: 400 },
  fontSize:       { min: 4,    max: 400 },
  radius:         { min: 0,    max: 400 },
  padding:        { min: 0,    max: 400 },
  profileOffsetY: { min: -400, max: 400 },
  profileGap:     { min: 0,    max: 400 },
  tailScale:      { min: 0,    max: 600 },
  bubbleMaxW:     { min: 10,   max: 100 },
  bubblePadding:  { min: 0,    max: 120 },
  profileSize:    { min: 24,   max: 400 },
});

/* ★DOM 시험이 상한을 «손으로 적지 않고» 읽는 자리 — 적으면 그 시험이 둘째 명부가 되어 표가 바뀔 때 조용히 낡는다. */
if (typeof window !== 'undefined') window.__CHAT_NUM_BOUNDS = CHAT_NUM_BOUNDS;
