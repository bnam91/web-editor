/* ════════════════════════════════════════════════════════════════════════
   도형 원뿔형(conic) 칠 — FX-GRADIENT-GAZE-01 v2(현빈 261121 · 지디 ⓒ 결정)
   ────────────────────────────────────────────────────────────────────────
   ★SVG 에는 원뿔형 그라데이션이 없다 ⇒ 도형 위에 CSS conic 덮개 div(.shape-conic-ov)를 얹고, 도형 SVG 모양을 mask-image 로 써서
     도형 모양으로만 보이게 한다(하프톤 덮개와 같은 결). 덮개는 «파생»: 저장·이력 표본에선 뺀다(section-serialize) · 열기·undo(rebindAll →
     명부 watchAll) · 도형 모양이 바뀔 때(MutationObserver) 다시 그린다.
   ★SVG 아래 칠은 같은 정지점의 linear 로 두되 stop-opacity 0(prop-shape applyGradient) — 두 번 칠해 알파가 겹치지 않게 · 옛 defs·restore 길은 그대로.
   ★Figma 는 덮개가 아니라 모델(dataset.shapeGradient type 'conic')을 GRADIENT_ANGULAR 로(export-figma-json · figma-renderer gradient-paint).
   ════════════════════════════════════════════════════════════════════════ */
import { registerFxType } from './effects-registry.js';

const OV = 'shape-conic-ov';
function _model(block) { try { const g = JSON.parse(block?.dataset?.shapeGradient || 'null'); return g && g.type === 'conic' ? g : null; } catch (_) { return null; } }

/** 도형 SVG → 흰 실루엣 mask data URL(칠 있는 모양만 · 테두리 전용은 그대로 빠짐). */
function _maskUrl(svg) {
  const c = svg.cloneNode(true);
  c.querySelectorAll('defs').forEach((d) => d.remove());
  c.querySelectorAll('rect,ellipse,circle,polygon,path').forEach((el) => { if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#fff'); el.removeAttribute('stroke'); });
  c.removeAttribute('style'); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const r = svg.getBoundingClientRect();
  if (!c.getAttribute('viewBox') && r.width) c.setAttribute('viewBox', `0 0 ${svg.clientWidth || r.width} ${svg.clientHeight || r.height}`);
  return `url("data:image/svg+xml,${encodeURIComponent(c.outerHTML)}")`;
}

/** 그 도형의 덮개를 지금 상태로(원뿔형이면 만들거나 고치고 · 아니면 치움). 돌려주는 값 = 덮개 있음. */
export function syncShapeConic(block) {
  if (!block || !block.querySelector) return false;
  const g = _model(block), svg = block.querySelector(':scope > svg.shape-svg') || block.querySelector(':scope > svg');
  let ov = block.querySelector(`:scope > .${OV}`);
  if (!g || !svg) { ov?.remove(); return false; }
  const css = String(block.dataset.shapeColor || '');
  if (!/^conic-gradient\(/i.test(css)) { ov?.remove(); return false; }
  if (!ov) { ov = document.createElement('div'); ov.className = OV; ov.setAttribute('aria-hidden', 'true'); svg.after(ov); }
  /* 자리 = SVG 상자(블럭 안 · 배율 상쇄) */
  const br = block.getBoundingClientRect(), sr = svg.getBoundingClientRect(), k = br.width / (block.offsetWidth || 1) || 1;
  const m = _maskUrl(svg);
  ov.setAttribute('style', `position:absolute;left:${(sr.left - br.left) / k}px;top:${(sr.top - br.top) / k}px;width:${sr.width / k}px;height:${sr.height / k}px;pointer-events:none;`
    + `background:${css};-webkit-mask-image:${m};mask-image:${m};-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;`);
  _watch(block, svg);
  return true;
}

/* 도형 모양이 바뀌면(점·반지름·크기) 다시 — rAF 한 번에 모아서 */
let _mo = null, _ro = null; const _q = new Set(); let _raf = 0;
const _flush = () => { _raf = 0; const l = [..._q]; _q.clear(); l.forEach((b) => { if (b.isConnected) syncShapeConic(b); }); };
function _watch(block, svg) {
  if (typeof MutationObserver === 'undefined' || svg._conicWatched) return;
  _mo = _mo || new MutationObserver((ms) => {
    for (const m of ms) { const b = m.target.closest?.('.shape-block'); if (b && !(m.target.classList && m.target.classList.contains(OV))) _q.add(b); }
    if (_raf) return;
    _raf = requestAnimationFrame(_flush);
  });
  _mo.observe(svg, { attributes: true, subtree: true, childList: true });
  _mo.observe(block, { attributes: true, attributeFilter: ['style', 'data-shape-gradient', 'data-shape-color'] });
  /* 크기 = 부모 프레임 style 이 바꾸고 SVG 는 CSS 로 따라만 간다(실측: updateShapeBlock 뒤 svg·블럭 속성 무변) ⇒ 크기는 ResizeObserver 로 */
  if (typeof ResizeObserver !== 'undefined') { _ro = _ro || new ResizeObserver((es) => { es.forEach((e) => { const b = e.target.closest?.('.shape-block'); if (b) _q.add(b); }); if (!_raf) _raf = requestAnimationFrame(_flush); }); _ro.observe(svg); }
  svg._conicWatched = true;
}

/** 열기·undo 뒤(rebindAll → watchAllFx) — 원뿔형 도형마다 덮개 다시 · 남은 덮개 치움. */
export function watchAllShapeConic(root = document) {
  if (!root?.querySelectorAll) return 0;
  root.querySelectorAll(`.${OV}`).forEach((ov) => { const b = ov.parentElement; if (!b || !_model(b)) ov.remove(); });
  let n = 0; root.querySelectorAll('.shape-block[data-shape-gradient]').forEach((b) => { if (syncShapeConic(b)) n++; });
  return n;
}

/* 명부에는 «문만» 빌린다(파티클과 같은 결) — supports false = 목록·카드 0 · watchAll 만 */
registerFxType({ key: 'shapeconic', label: '원뿔형 칠', supports: () => false, has: () => false, watchAll: watchAllShapeConic });

if (typeof window !== 'undefined') Object.assign(window, { syncShapeConic, watchAllShapeConic });
