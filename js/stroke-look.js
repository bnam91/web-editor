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

/* ══ 단계 4-2 — 면별 굵기(§4c ②b «사용자» · 어댑터 perSideWidth) ══
 * 키 strokeWidthTop/Right/Bottom/Left = «면별»일 때만(넷 다 표준과 같으면 키 0 = 옛 바이트) · 키 없는 변 = 표준 굵기 */
export const SIDES = ['top', 'right', 'bottom', 'left'];
const SIDE_KEY = { top: 'strokeWidthTop', right: 'strokeWidthRight', bottom: 'strokeWidthBottom', left: 'strokeWidthLeft' };
export function hasSides(ds) { return SIDES.some((s) => ds[SIDE_KEY[s]] != null); }
/** 변마다 굵기 { top, right, bottom, left } — 키 없으면 표준 */
export function readSides(ds, std) { const o = {}; for (const s of SIDES) o[s] = ds[SIDE_KEY[s]] != null ? Math.max(0, num(ds[SIDE_KEY[s]], std)) : std; return o; }
/** null = 면별 끔(키 다 지움) · 넷 다 표준과 같아도 키 다 지움 */
export function writeSides(ds, w, std) {
  const same = !w || SIDES.every((s) => num(w[s], std) === std);
  for (const s of SIDES) { if (same) delete ds[SIDE_KEY[s]]; else ds[SIDE_KEY[s]] = String(Math.max(0, num(w[s], std))); }
}
/** CSS border-width 4값(키 없으면 '') */
export function cssSideWidths(ds, std) { if (!hasSides(ds)) return ''; const w = readSides(ds, std); return SIDES.map((s) => `${w[s]}px`).join(' '); }
/** 넷이 다르면 null(Mixed · §1) */
export function sidesMixed(ds, std) { if (!hasSides(ds)) return false; const w = readSides(ds, std); return !SIDES.every((s) => w[s] === w.top); }
/* 프레임 보더를 dataset 에서 «다시 쓰는» 곳 셋(save-load 복원 · MCP updateFrame · 템플릿 적용)이 import 없이 부른다 — 하네스가 그 파일들을 단독으로 올리므로 의존을 늘리지 않는다(없으면 ?. 로 옛 동작) */
if (typeof window !== 'undefined') window.__strokeSideWidthsCss = cssSideWidths;
