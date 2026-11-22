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

/* stroke-width 를 든 요소 — 뿌리 svg 와 그 안(Iconify 가 주는 Feather·Lucide 는 뿌리가 아니라 path/g 에 둔다 · 미카사 채점 261121 ②).
   shortcut: 두께가 요소마다 다른 아이콘도 한 값으로 맞춘다 — 비율 유지가 필요해지면 첫 값 대비 배율로. */
const _strokeEls = (svg) => {
  if (!svg || typeof svg.getAttribute !== 'function') return [];
  const kids = typeof svg.querySelectorAll === 'function' ? [...svg.querySelectorAll('[stroke-width]')] : [];
  return (svg.getAttribute('stroke-width') != null ? [svg] : []).concat(kids);
};
/** 선으로 그린 아이콘인가 — 뿌리나 그 안에 stroke-width 가 있다(Feather·Lucide·Tabler 등 선 아이콘의 꼴). */
export const isStrokeIcon = (svg) => _strokeEls(svg).length > 0;
/** 지금 선 두께(첫 stroke-width) · 없으면 null. */
export const iconStrokeOf = (svg) => { const e = _strokeEls(svg)[0]; return e ? e.getAttribute('stroke-width') : null; };

/** 블럭에 저장된 선 두께를 stroke-width 를 든 요소 전부에 입힌다(멱등 · 선 아이콘이 아니면 손 안 댐). 돌려주는 값 = 입힌 두께 또는 null. */
export function applyIconStroke(block) {
  const svg = block?.querySelector?.(':scope > svg');
  const w = normIconStroke(block?.dataset?.iconStroke);
  const els = _strokeEls(svg);
  if (!svg || w == null || !els.length) return null;
  for (const e of els) if (e.getAttribute('stroke-width') !== String(w)) e.setAttribute('stroke-width', String(w));
  _fitStrokeViewBox(svg, w);
  return w;
}

/** 굵은 선이 viewBox 밖으로 나가면(획 끝이 평평하게 잘림 · 미카사 재채점 261122 · Feather sun 4 = 밖 잉크 3.5%) 네 변을 같은 폭으로 넓힌 viewBox · 안 나가면 원래 viewBox 그대로.
 *  vb0 = 원래 viewBox 문자열 · bb = 그림 기하 상자 {x,y,width,height}(획 뺀 것) · w = 선 두께. 순수 함수.
 *  shortcut: 획 반폭(w/2)만 본다 — round 끝·이음(Feather·Lucide 꼴) 기준 · miter 이음 아이콘이 잘리면 miterlimit 배를 더해라. */
export function iconStrokeViewBox(vb0, bb, w) {
  const v = String(vb0 || '').trim().split(/[\s,]+/).map(Number);
  if (v.length !== 4 || v.some((n) => !Number.isFinite(n)) || !bb || !(bb.width > 0 || bb.height > 0) || !(w > 0)) return vb0;
  const h = w / 2, pad = Math.max(0, v[0] - (bb.x - h), v[1] - (bb.y - h), (bb.x + bb.width + h) - (v[0] + v[2]), (bb.y + bb.height + h) - (v[1] + v[3]));
  if (!(pad > 0.01)) return vb0;
  const p = Math.ceil(pad * 100) / 100, r = (n) => +n.toFixed(2);
  return `${r(v[0] - p)} ${r(v[1] - p)} ${r(v[2] + 2 * p)} ${r(v[3] + 2 * p)}`;
}
/* 원래 viewBox 는 data-vb0 에 한 번 적어 둔다(두께를 다시 줄이면 되돌림 · 저장본에 함께 남아 다시 열어도 같은 꼴). 화면에 없어 상자를 못 재면 손 안 댐. */
function _fitStrokeViewBox(svg, w) {
  if (typeof svg.getBBox !== 'function') return;
  const vb0 = svg.getAttribute('data-vb0') || svg.getAttribute('viewBox');
  if (!vb0) return;
  let bb = null; try { bb = svg.getBBox(); } catch (_) { bb = null; }
  if (!bb || !(bb.width > 0 || bb.height > 0)) return;
  const next = iconStrokeViewBox(vb0, bb, w);
  if (next === vb0) { if (svg.hasAttribute('data-vb0')) { svg.setAttribute('viewBox', vb0); svg.removeAttribute('data-vb0'); } return; }
  if (!svg.hasAttribute('data-vb0')) svg.setAttribute('data-vb0', vb0);
  if (svg.getAttribute('viewBox') !== next) svg.setAttribute('viewBox', next);
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
