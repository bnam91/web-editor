/* stroke-look.js — 표준 Stroke «Stroke 설정» 팝오버의 값(스타일·점선 길이/간격·점선 끝·꼭짓점·Miter) ↔ 저장 키 ↔ SVG 값 (§4c ②b · 단계 3-2)
 * ⛔import 0 · DOM 0(순수) — 패널(prop-*.js)·내보내기(export-figma-json.js)가 같이 쓴다.
 *
 * 저장 키(블럭 dataset · ★기본과 다를 때만 쓴다 = 옛 저장본 바이트 무변):
 *   strokeStyle 'dashed'|'custom'(없으면 solid) · strokeDashLen/strokeGapLen(custom 만) · strokeCap 'none'|'square'|'round' · strokeJoin 'miter'|'bevel'|'round' · strokeMiter(°)
 * 기본(= 그 블럭이 «지금» 그리는 값)은 부르는 쪽이 준다 — 예: 도형 선·화살표 끝 = round(<line stroke-linecap="round">) · 그 밖 = none(SVG 기본 butt) · 꼭짓점 = miter(SVG 기본).
 */
export const MITER_DEG_DEFAULT = 28.96;   // SVG 기본 miterlimit 4 ↔ 1/sin(θ/2) = 4 ⇒ θ ≈ 28.955°(Figma 기본과 같음)
export const STROKE_CAPS = ['none', 'square', 'round'];
export const STROKE_JOINS = ['miter', 'bevel', 'round'];
const CAP_SVG = { none: 'butt', square: 'square', round: 'round' };
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** 점선 «사용자»가 아닐 때 길이·간격 = 굵기에서 파생(vector-block.js _dashArray 의 dashed 식 3w·2w 그대로 = 화면 무변) */
export function derivedDash(w) { const x = Math.max(1, num(w, 1)); return { dash: 3 * x, gap: 2 * x }; }

/** dataset → 보이는 값(기본 채움) */
export function readLook(ds, def = {}) {
  const d = { cap: 'none', join: 'miter', ...def };
  const style = ds.strokeStyle === 'dashed' || ds.strokeStyle === 'custom' ? ds.strokeStyle : 'solid';
  return {
    style,
    dash: style === 'custom' ? num(ds.strokeDashLen, 4) : null,
    gap: style === 'custom' ? num(ds.strokeGapLen, 4) : null,
    cap: STROKE_CAPS.includes(ds.strokeCap) ? ds.strokeCap : d.cap,
    join: STROKE_JOINS.includes(ds.strokeJoin) ? ds.strokeJoin : d.join,
    miter: Math.min(180, Math.max(1, num(ds.strokeMiter, MITER_DEG_DEFAULT))),
  };
}

/** 보이는 값 → dataset(기본과 같으면 키를 지운다) */
export function writeLook(ds, look, def = {}) {
  const d = { cap: 'none', join: 'miter', ...def };
  const put = (k, v, isDef) => { if (isDef) delete ds[k]; else ds[k] = String(v); };
  put('strokeStyle', look.style, look.style === 'solid');
  put('strokeDashLen', look.dash, look.style !== 'custom');
  put('strokeGapLen', look.gap, look.style !== 'custom');
  put('strokeCap', look.cap, look.cap === d.cap);
  put('strokeJoin', look.join, look.join === d.join);
  put('strokeMiter', look.miter, Math.abs(num(look.miter, MITER_DEG_DEFAULT) - MITER_DEG_DEFAULT) < 0.005);
}

/** 보이는 값 + 굵기 → SVG 표현값(빈 문자열 = 그 속성 안 씀) */
export function svgLook(look, w) {
  const dash = look.style === 'solid' ? null : (look.style === 'custom' ? { dash: look.dash, gap: look.gap } : derivedDash(w));
  const rad = num(look.miter, MITER_DEG_DEFAULT) * Math.PI / 180;
  return {
    dasharray: dash ? `${+dash.dash.toFixed(3)} ${+dash.gap.toFixed(3)}` : '',
    linecap: CAP_SVG[look.cap] || 'butt',
    linejoin: look.join,
    miterlimit: +(1 / Math.sin(rad / 2)).toFixed(2),   // 28.96° → 4.0006 → 4(SVG 기본과 같은 수)
  };
}
