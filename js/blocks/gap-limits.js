/* gap-limits.js — 갭블럭 «높이»의 상·하한. 단 하나의 자리. (2026-09-09 신설)
 *
 * ⚠️왜 파일까지 만드나: 400 이 «여섯 군데»에 흩어져 있었다 —
 *   패널 슬라이더 max · 패널 숫자칸 max · 패널 커밋 clamp ·
 *   키보드 넉지(+/-) · 화살표 이동 · MCP updateGapBlock 검증.
 *   하나만 고치면 «다른 다섯»이 조용히 막는다(슬라이더는 1000까지 가는데 숫자칸이 400에서 자른다).
 *
 * ⛔여기 값은 «갭블럭 높이» 전용이다. 아래 400 들과 헷갈리지 마라 — 다른 것이다:
 *   · js/editor.js 의 글자 크기 상한 400 (텍스트블록)
 *   · js/block-factory.js updateFrameBlock 의 `gap` 0~400 (프레임의 CSS gap 속성)
 */
export const GAP_MIN = 0;
export const GAP_MAX = 1000;   // ★현빈 2026-09-09: 「갭블럭이 최대 400 밖에 높이가 안되는데, 1000까지 가능하게」

if (typeof window !== 'undefined') { window.GAP_MIN = GAP_MIN; window.GAP_MAX = GAP_MAX; }
