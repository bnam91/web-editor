/* 그리드 칸 「원형 이미지」 아이콘 — 한 벌. (현빈 2026-10-04 S2: 서클블럭의 좌 레이어패널·우 프로퍼티패널 아이콘을
 *   그리드 칸에 들어가는 이 svg 로 바꾼다.)
 * ★원래 index.html #bcm-grid-img-circle(칸 우클릭 「원형 이미지 추가」)에 인라인으로 있던 그림이다.
 *   세 곳(그 메뉴 · 레이어 행 · 우측 헤더)이 «이 상수에서 파생»한다 — 사본을 두 벌 두지 마라. */
export const GRID_CIRCLE_ICON_VIEWBOX = '0 0 14 14';
/* ★선 굵기 — 이웃 아이콘과 «렌더 두께»를 맞춘다(실측 2026-10-04). 이웃은 viewBox 12 + stroke 1.3 이라 레이어 행(14px)에선 1.3×14/12=1.517px,
 *   우측 헤더(CSS 16px)에선 1.3×16/12=1.733px 로 그려진다. 이 그림은 viewBox 14(요구 svg 그대로)라 같은 1.3 을 쓰면 1.3 / 1.486px 로 가늘다.
 *   ⇒ viewBox 단위로 1.3×14/12 = 1.517 을 쓰면 레이어 1.517px · 헤더 1.733px 로 이웃과 같다. viewBox 는 건드리지 않는다. */
export const GRID_CIRCLE_ICON_STROKE_WIDTH = '1.517';
export const GRID_CIRCLE_ICON_INNER =
  '<circle cx="7" cy="7" r="5.5"/><circle cx="5.5" cy="5.5" r="0.9"/><path d="M11.8 9.2L9.5 7.2 4.6 11.4"/>';

/* 바깥 <svg> 껍데기만 패널마다 다르다(크기·색은 각 패널의 이웃 아이콘 규약을 따른다). 그림은 위 상수 그대로. */
export function gridCircleIconSvg({ cls = '', size = 0, stroke = 'currentColor' } = {}) {
  return `<svg${cls ? ` class="${cls}"` : ''}${size ? ` width="${size}" height="${size}"` : ''} viewBox="${GRID_CIRCLE_ICON_VIEWBOX}" fill="none" stroke="${stroke}" stroke-width="${GRID_CIRCLE_ICON_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${GRID_CIRCLE_ICON_INNER}</svg>`;
}
