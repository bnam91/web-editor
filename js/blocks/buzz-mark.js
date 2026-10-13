/* 버즈(1012t1Z5) — 「이 프레임이 버즈 묶음인가」의 판정과 그 아이콘. 한 벌.
 * 버즈는 새 블럭이 아니다: 자유배치 프레임 + 진짜 모달 N개에 «표식» data-buzz="1" 이 붙은 것이다.
 * 세 곳(레이어 줄 · 우측 패널 머리 · Buzz 절을 그릴지)이 이 파일에서 같은 답을 읽는다 — 사본을 두지 않는다.
 * ★import 0 — 레이어 패널(js/panels/layer-panel-items.js)이 이 파일만 수입한다(선례 js/blocks/grid-circle-icon.js). */

/* 아이콘 = 엇갈린 둥근 상자 둘(흩어진 말풍선 묶음). 이웃 아이콘(레이어 줄의 modal · grid · speech-bubble)과
 * 같은 꼴이다: viewBox 12 · 선 1.3 · fill 없음. */
export const BUZZ_ICON_VIEWBOX = '0 0 12 12';
export const BUZZ_ICON_STROKE_WIDTH = '1.3';
export const BUZZ_ICON_INNER =
  '<rect x="1" y="1.5" width="6.5" height="4" rx="1.3"/><rect x="4.5" y="6.5" width="6.5" height="4" rx="1.3"/>';

/* 바깥 <svg> 껍데기만 자리마다 다르다(크기 · 색은 그 자리의 이웃 아이콘 규약을 따른다). 그림은 위 상수 그대로. */
export function buzzIconSvg({ cls = '', size = 0, stroke = 'currentColor' } = {}) {
  return `<svg${cls ? ` class="${cls}"` : ''}${size ? ` width="${size}" height="${size}"` : ''} viewBox="${BUZZ_ICON_VIEWBOX}" fill="none" stroke="${stroke}" stroke-width="${BUZZ_ICON_STROKE_WIDTH}" stroke-linejoin="round">${BUZZ_ICON_INNER}</svg>`;
}

/* 표식 + 자유배치 둘 다여야 버즈다. 「자유→스택 변환」을 누른 프레임은 data-free-layout 이 빠져 보통 프레임으로 보인다
 * (표식은 남는다 — ⌘Z 로 돌아오면 다시 버즈다). 모달 개수로 추정하지 않는다: 사용자가 모달 둘을 넣은 보통 프레임은 버즈가 아니다. */
export function isBuzzFrame(el) {
  return !!(el && el.classList && el.classList.contains('frame-block')
    && el.dataset.buzz === '1' && el.dataset.freeLayout === 'true');
}
