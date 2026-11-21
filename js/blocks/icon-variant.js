/* icon-variant.js — 아이콘 블럭 «선 두께 · 채움» 셈(ICON-FEATHER-MATERIAL-RESEARCH-01 · 현빈 261121 발주2 #3).
 *   선 두께 = 그림 뿌리 <svg> 의 stroke-width(Feather 처럼 선으로 그린 아이콘 · 뿌리에 stroke-width 가 있을 때만) · 값 = 블럭 data-icon-stroke.
 *   채움 = Material Symbols 이름 꼴 — 'material-symbols:home'(채움) ↔ 'material-symbols:home-outline'(선) · 꼬리 -rounded/-sharp 는 그대로 둔다.
 *   import 0 · 최상위 DOM 0 — 단위가 .mjs 사본으로 싣는다.
 */
export const ICON_STROKE_MIN = 0.5, ICON_STROKE_MAX = 4, ICON_STROKE_STEP = 0.25;

/** 선 두께 소독 — 0.25 눈금 · 0.5..4 · 숫자 아님 = null(없음). */
export function normIconStroke(v) {
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n)) return null;
  return Math.min(ICON_STROKE_MAX, Math.max(ICON_STROKE_MIN, Math.round(n / ICON_STROKE_STEP) * ICON_STROKE_STEP));
}

/** 선으로 그린 아이콘인가 — 뿌리 svg 에 stroke-width 가 있다(Feather·Lucide·Tabler 등 선 아이콘의 꼴). */
export const isStrokeIcon = (svg) => !!(svg && typeof svg.getAttribute === 'function' && svg.getAttribute('stroke-width') != null);

/** 블럭에 저장된 선 두께를 뿌리 svg 에 입힌다(멱등 · 선 아이콘이 아니면 손 안 댐). 돌려주는 값 = 입힌 두께 또는 null. */
export function applyIconStroke(block) {
  const svg = block?.querySelector?.(':scope > svg');
  const w = normIconStroke(block?.dataset?.iconStroke);
  if (!svg || w == null || !isStrokeIcon(svg)) return null;
  if (svg.getAttribute('stroke-width') !== String(w)) svg.setAttribute('stroke-width', String(w));
  return w;
}

const MS_RE = /^material-symbols:([a-z0-9-]+?)(-outline)?(-rounded|-sharp)?$/;
/** Material Symbols 이름 → { base, outline, style } · 아니면 null. */
export function parseMsName(name) {
  const m = MS_RE.exec(String(name || ''));
  return m ? { base: m[1], outline: !!m[2], style: m[3] || '' } : null;
}
/** 채움 상태 — 'fill' | 'outline' | null(Material Symbols 아님). */
export const msFillState = (name) => { const p = parseMsName(name); return p ? (p.outline ? 'outline' : 'fill') : null; };
/** 원하는 채움 상태의 이름(이미 그 상태면 같은 이름 · Material Symbols 아니면 null). */
export function msNameFor(name, want) {
  const p = parseMsName(name);
  if (!p || (want !== 'fill' && want !== 'outline')) return null;
  return `material-symbols:${p.base}${want === 'outline' ? '-outline' : ''}${p.style}`;
}
