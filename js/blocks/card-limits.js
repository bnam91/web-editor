/* card-limits.js — 카드(canvas-block) «높이»(dataset.canvasH)의 하한·상한. 단 하나의 자리. (2026-10-26 신설 · t5-16)
 *
 * ⚠️왜 파일까지 만드나 — asset-width-limits.js 와 같은 이유다. 40~2000 이 될 자리가 넷이었다:
 *   ⑴ updateCanvasBlock 의 자        (blocks/canvas-block.js _setIntField('canvasH', …))
 *   ⑵ 카드 행 경계 끌기 clamp         (overlay-handles.js _onCvbRowMouseDown)
 *   ⑶ 패널 「높이」 숫자칸 #cvb-h min/max (props/prop-simple-card.js · props/prop-canvas.js)
 *   하나만 고치면 다른 하나가 조용히 막는다.
 *
 * ⛔그리드 «행 높이»(grid-block.js ROW_H_MIN/ROW_H_MAX · 상한 4000)와 다른 물건이다 — 섞지 마라.
 *   카드는 높이 «하나»를 모든 행이 되풀이하고, 그리드는 행마다 제 높이다.
 * import 가 없는 «잎» 모듈 — 순환 걱정 없다. */
export const CVB_H_MIN = 40;
export const CVB_H_MAX = 2000;
