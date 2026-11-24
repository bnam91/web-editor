/* block-opacity.js — 블럭(레이어) 불투명도 A4 (지디 261124 · PLAN-appearance-layout-std-261124 §4 A4)
 * 키 = data-opacity(정수 0~100) · 100 = 키 없음(옛 바이트 그대로) · 그림 = 그 블럭 요소의 인라인 CSS opacity.
 *   ⇒ 저장·되돌리기·HTML·PNG(html2canvas) 는 인라인 style 을 그대로 싣는다 — 따로 가르칠 곳 0.
 *   ⇒ Figma = export-figma-json.js 가 노드에 opacity(0~1)를 싣고 렌더러가 set_node_properties(플러그인에 이미 있음)로 건다.
 * ★«블럭 요소» = 패널이 고르는 콘텐츠 블럭. 투명 래퍼(text-frame · 도형 래퍼)를 받으면 안쪽 블럭으로 내려가 «한 번만» 건다.
 * ⛔Fill 눈(data-fill-hidden)과 다른 키 — 서로 안 건드린다.
 * ⛔import 없음(순수 DOM).
 */
function _target(el) {
  if (!el?.classList?.contains('frame-block')) return el;
  const ds = el.dataset || {};
  if (ds.group || ds.bannerPreset) return el;
  const inner = ds.textFrame === 'true'
    ? el.querySelector(':scope > .text-block')
    : el.querySelector(':scope > .shape-block');   // 도형 래퍼 판정 = shape-frame.js isShapeFrame 과 같은 «직속»
  return inner || el;
}

/** 0~100 정수(키 없으면 100). */
export function readBlockOpacity(block) {
  const raw = _target(block)?.dataset?.opacity;
  const n = Math.round(Number(raw));
  return raw == null || raw === '' || !Number.isFinite(n) ? 100 : Math.max(0, Math.min(100, n));
}

/** v 를 0~100 정수로 · 100 = 키·인라인 지움. */
export function setBlockOpacity(block, v) {
  const el = _target(block);
  if (!el) return;
  let n = Math.round(Number(v));
  n = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 100;
  if (n === 100) { delete el.dataset.opacity; el.style.removeProperty('opacity'); }
  else { el.dataset.opacity = String(n); el.style.opacity = String(n / 100); }
}

if (typeof window !== 'undefined') {
  window.setBlockOpacity = setBlockOpacity;
  window.readBlockOpacity = readBlockOpacity;
}
