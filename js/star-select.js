/* star-select.js — ★별 ★«한 개»를 고르는 모드 (현빈 2026-10-10 · 1010t1b2)
 *
 * ★현빈 원문: 「캔버스에서 별모양의 쉐이프블럭을 ★더블클릭하면, ★개별 별모양 블럭을 선택하고
 *               ★색 지정 및 ★모서리 핸들로 크기조절이 ★개별로 가능하게 해줄 것」
 * ★★이 파일은 ★그 중 ★«고르기»다 — ★색은 ★`js/props/prop-shape.js` 의 ★패널 줄이 쓴다.
 *   ★★«모서리 핸들»은 ★★아직 ★없다(Phase B · 지디 순서 ⑶).
 *
 * ★★꼴을 ★새로 ★짓지 않았다 — ★`js/scratch-pad.js` 의 ★⑦ ★그룹 진입 모드를 ★본떴다
 *   (`_enterGroupMode`/`_exitGroupMode`/`_markGroupMode` · ★진입 배타 ★양방향 · Esc ＋ 밖 클릭 capture).
 *   ⛔둘을 ★따로 고치지 마라 — ★같은 관용구다.
 *
 * ★★★«고른 별»은 ★★DOM 속성이 ★아니라 ★★JS 프로퍼티에 ★산다 — ★`block._starSel`.
 *   ★까닭: ★속성(`data-…`)은 ★★직렬화된다 ⇒ ★저장본·⌘C 재료·협업 비교 키로 ★샌다.
 *     ★실측 선례: ★`grd-cell-selected` 가 ★다섯 세척 명부에서 빠져 ★★HTML 배송본에 ★그려졌다(2026-10-10 A4).
 *   ⇒ ★★프로퍼티는 ★복제·직렬화를 ★타지 않는다. ★★그래서 ★벗길 자가 ★필요 없다.
 *   ★선례 = `sec._secBgEditing` · `ab._exitImgEsc`(이 레포가 ★이미 ★그렇게 쓴다).
 *
 * ★★★«표시»는 ★클래스다 — ★그건 ★벗겨야 한다. ★이름을 ★★규칙에 ★맞췄다:
 *   ★`star-cell-selected` ⇒ ★`js/io/section-serialize.js` 의
 *     ★`RUNTIME_MARKER_RE = /(?:^|-)(?:line|cell)-selected$/` 가 ★★이미 ★잡는다(★명부를 ★안 늘린다).
 *   ★★그 규칙이 ★«앞으로 생길 xxx-cell-selected»를 ★자동으로 덮게 ★설계돼 있다
 *     (★`selected-marker-census` 의 ★A4-C3 이 ★`zzz-cell-selected` 로 ★그것을 ★단언한다).
 *   ⚠️★`star-mode`(모드 표시)는 ★그 규칙 ★밖이다 ⇒ ★★`RUNTIME_MARKER_CLS` 에 ★손으로 ★등록했다.
 *     ★★선례이자 ★경고: ★`stb-step-selected` 가 ★「규칙 밖 이름」이라 ★★저장본에 ★샜다(2026-09-15).
 *   ★★그리고 ★`js/io/export-html.js` 는 ★★제 명부를 ★따로 든다(★`runtimeMarkers` 를 ★안 쓴다)
 *     ⇒ ★★거기도 ★등록했다. ⛔«명부 둘을 합치기»는 ★범위 밖이다(★지디 판정 · 티켓은 ★지디가 든다).
 */
import { clampStarCount } from './shape-star.js';

let _mode = null;        // 모드가 선 .shape-block (또는 null)
let _handlers = null;

/** 별이 여러 개인 ★별 도형인가 — ★한 개면 ★고를 것이 ★없다(모드가 ★뜻이 없다). */
export function starModeEligible(block) {
  return !!block && block.classList?.contains('shape-block')
    && block.dataset?.shapeType === 'star'
    && clampStarCount(block.dataset.starCount) > 1;
}

export function starModeBlock() { return _mode; }
export function starSelectedIndex(block) {
  const b = block || _mode;
  return (b && Number.isInteger(b._starSel)) ? b._starSel : null;
}

function _polys(block) { return [...(block.querySelectorAll('svg polygon') || [])]; }

/** 표시를 ★다시 칠한다 — ★모드 클래스 ＋ ★고른 별 클래스. */
function _mark(block) {
  if (!block) return;
  block.classList.toggle('star-mode', _mode === block);
  const sel = starSelectedIndex(block);
  _polys(block).forEach((p, i) => {
    p.classList.toggle('star-cell-selected', _mode === block && i === sel);
  });
}

/** i 번째 별을 ★고른다. ⛔모드 밖에서는 ★아무 일도 안 한다. */
export function selectStar(block, i) {
  if (!block || _mode !== block) return false;
  const n = _polys(block).length;
  const k = Math.round(Number(i));
  if (!Number.isInteger(k) || k < 0 || k >= n) return false;
  block._starSel = k;
  _mark(block);
  /* ★패널을 ★다시 그린다 — ★«고른 별»의 ★색 줄이 ★거기서 ★뜬다(그 줄이 ★입구다) */
  window.showShapeProperties?.(block);
  return true;
}

export function enterStarMode(block, i) {
  if (!starModeEligible(block)) return false;
  /* ★★진입 배타 ★양방향 ⒜ — ★남의 편집 모드를 ★내린다.
     ⛔반대쪽(★남이 ★나를 내리는 줄)은 ★`js/image-handling.js` 의 ★`enterImageEditMode` ★머리에 있다.
     ★★한 방향만 두면 ★반대쪽 줄을 ★지워도 ★초록이다(★t2cmdl ㉠ 의 그 실측). */
  /* ⛔★`null` 을 ★넘기면 ★★던진다 — ★실측(2026-10-10 · DOM E1~E3·D8 ★네 칸이 ★이것 ★하나로 ★빨갰다):
       ★`exitImageEditMode(ab)` 머리가 ★`if (!ab._imgEditing) return;` 라 ★★null 가드가 ★없다
       ⇒ ★`TypeError: Cannot read properties of null (reading '_imgEditing')`
       ⇒ ★그 예외가 ★★이 dblclick 핸들러를 ★죽여 ★모드가 ★★한 번도 ★안 섰다.
     ★★그래서 ★★«있을 때만» 부른다. ⛔그 함수에 ★가드를 ★더하지 ★않았다 — ★남의 함수고 ★범위 밖이다
       (★그 null 비안전성은 ★지디에 ★올렸다). */
  const _imgEditing = document.querySelector('.asset-block.img-editing');
  if (_imgEditing) window.exitImageEditMode?.(_imgEditing);
  if (_mode && _mode !== block) exitStarMode();
  _mode = block;
  block._starSel = Number.isInteger(i) ? i : 0;
  _mark(block);
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); exitStarMode(); } };
  /* ★밖 클릭 = 나가기. ★capture 로 건다 — ★선택이 바뀌기 «전»에 모드가 풀려야
     ★모드 중 선택이 ★이 블록 밖으로 ★샐 길이 없다(★⑦ 선례와 같은 꼴). */
  const onDown = (e) => {
    const b = e.target.closest && e.target.closest('.shape-block');
    if (b !== _mode) exitStarMode();
  };
  _handlers = { onKey, onDown };
  setTimeout(() => document.addEventListener('mousedown', onDown, true), 0);
  document.addEventListener('keydown', onKey);
  window.showShapeProperties?.(block);
  return true;
}

export function exitStarMode() {
  if (!_mode) return;
  const b = _mode;
  _mode = null;
  delete b._starSel;
  _mark(b);
  const h = _handlers;
  if (h) {
    document.removeEventListener('mousedown', h.onDown, true);
    document.removeEventListener('keydown', h.onKey);
  }
  _handlers = null;
  window.showShapeProperties?.(b);
}

/* ★더블클릭 진입 — ★문서에 ★한 번만 건다(★블록마다 걸면 ★rebindAll 때 ★겹친다).
 * ★★D8(2026-10-10 · DOM)이 ★이 제스처에 ★임자가 ★0 임을 ★행위로 쟀다 —
 *   ⛔그 0 에 ★기대지 ★않는다. ★그래서 ★위 ★진입 배타를 ★양방향으로 ★세웠다. */
if (typeof document !== 'undefined') {
  document.addEventListener('dblclick', (e) => {
    const poly = e.target.closest && e.target.closest('svg polygon');
    const block = e.target.closest && e.target.closest('.shape-block');
    if (!block || !starModeEligible(block)) return;
    const idx = poly ? [...block.querySelectorAll('svg polygon')].indexOf(poly) : -1;
    if (idx < 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (_mode === block) selectStar(block, idx);
    else enterStarMode(block, idx);
  });
}

window.enterStarMode = enterStarMode;
window.exitStarMode = exitStarMode;
window.selectStar = selectStar;
window.starSelectedIndex = starSelectedIndex;
window.starModeEligible = starModeEligible;
