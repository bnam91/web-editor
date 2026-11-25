/* offset-path.js — 0.9.13 77 t13B-04 Offset Path 1차(DOM). 셈 = offset-path-geom.js(순수).
 * 꼴(현빈 261119 ⓑ 일러 꼴 · 지디 261125 R2·R3): 고른 사각·원 → «새 도형» 하나(원본 무변) = 같은 칠·선 · 상자 ±2d · 자리 −d ·
 *   원본 «바로 아래 층»(같은 부모 안에서 원본 바로 앞 = 겹친 떠 있는 것끼리는 DOM 순서가 층) · 새 것이 골라짐 · 이력 한 칸(push-after).
 * 1차 = «떠 있는» 원본만(IAL 섹션 오버레이 · 자유 프레임 안 절대 자리) — 흐름 원본은 떠 있는 새 도형을 그 아래 층에 둘 수 없다
 *   (IAL = 섹션 직속 z 80 · 흐름 = section-inner 안) ⇒ «먼저 Ignore Auto Layout» 알림만(지디 판정 ⓐ).
 * FigCraft 와 갈린 점: FigCraft vector.offset 은 그 도형을 제자리에서 벡터로 바꾼다(파괴 · crates/engine/src/vector_offset_tests.rs:41-49) — 현빈 결정(새 도형)이 우선. */
import { offsetBox } from './offset-path-geom.js';
import { posElOf, isFloat, _applyOverlayPos } from './overlay-float.js';

const _wrapOf = (block) => (block?.parentElement?.matches?.('.frame-block') && block.parentElement.querySelector(':scope > .shape-block') === block) ? block.parentElement : block;
/** 좌표를 가진 단위인가 — IAL(섹션·프레임 직속 떠 있음) 또는 자유 프레임 안 절대 자리 */
function _isPositioned(unit) {
  if (!unit) return false;
  if (unit.dataset.overlayBlock === 'true') return true;
  return !!unit.parentElement?.matches?.('.frame-block[data-free-layout="true"]') && getComputedStyle(unit).position === 'absolute';
}

/** @returns {{ok:true, block:Element}|{ok:false, why:string}} */
export function applyOffsetPath(block, d, join = 'round') {
  if (!block?.classList?.contains('shape-block')) return { ok: false, why: '도형이 아니에요' };
  const type = block.dataset.shapeType || 'rectangle';
  if (type !== 'rectangle' && type !== 'ellipse') return { ok: false, why: 'Offset Path 1차는 사각·원만 돼요' };
  const unit = posElOf(block) || _wrapOf(block);
  if (!_isPositioned(unit)) return { ok: false, why: '흐름 안 도형이에요 — 먼저 Ignore Auto Layout 으로 띄운 뒤 다시 해 주세요' };
  const w = unit.offsetWidth, h = unit.offsetHeight, r = parseFloat(unit.dataset.radius) || 0;
  const box = offsetBox({ type, w, h, r, d: Number(d), join });
  if (!box) return { ok: false, why: '안쪽으로 그만큼 줄이면 도형이 없어져요' };
  const x0 = Number(unit.dataset.offsetX ?? parseFloat(unit.style.left)) || 0, y0 = Number(unit.dataset.offsetY ?? parseFloat(unit.style.top)) || 0;
  const c = window.duplicateUnitBefore?.(unit);   // editor.js — 새 id · 원본 «바로 앞»(= 아래 층) · 고름 없음
  if (!c) return { ok: false, why: '복제에 실패했어요' };
  c.style.width = box.w + 'px'; c.style.height = box.h + 'px'; c.style.minHeight = box.h + 'px';
  if (c.dataset.width != null || c.dataset.height != null) { c.dataset.width = String(box.w); c.dataset.height = String(box.h); }
  if (type === 'rectangle') {
    if (box.r > 0) { c.dataset.radius = String(box.r); c.style.borderRadius = box.r + 'px'; c.style.overflow = 'hidden'; }
    else { delete c.dataset.radius; c.style.borderRadius = ''; }
  }
  if (isFloat(c) || c.dataset.overlayBlock === 'true') _applyOverlayPos(c, Math.round(x0 + box.dx), Math.round(y0 + box.dy));
  else { const nx = Math.round(x0 + box.dx), ny = Math.round(y0 + box.dy); c.style.left = nx + 'px'; c.style.top = ny + 'px'; c.dataset.offsetX = String(nx); c.dataset.offsetY = String(ny); }
  const nb = c.querySelector(':scope > .shape-block') || c;
  window.refreshShapeInnerSVG?.(nb);
  window.buildLayerPanel?.();
  window.deselectAll?.(); window.selectBlock?.(nb.id); window.showShapeProperties?.(nb);
  window.pushHistory?.('Offset Path');
  window.scheduleAutoSave?.();
  return { ok: true, block: nb };
}
if (typeof window !== 'undefined') window.applyOffsetPath = applyOffsetPath;
