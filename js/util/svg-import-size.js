/* svg-import-size — 들여온 SVG(거르개를 지난 글자)의 «처음 크기». t3-06 P1(현빈 #19 ②) 벡터로 넣기 한 벌(vector-block.js addVectorFromSvgText).
 *   뿌리 <svg> 의 width·height(숫자·px) → 없으면 viewBox 넓이·높이 → 없으면 120×120.
 *   긴 변이 MAX 를 넘으면 비율 그대로 줄인다 · 짧은 변은 MIN 밑으로 안 간다(패널 W·H 하한 10).
 *   순수 함수(DOM 0) — tests/unit/svg-import-size.test.mjs. */
export const SVG_IMPORT_MAX = 400;
const MIN = 10;

function _attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3]) : null;
}
function _len(v) {
  if (v == null) return 0;
  const m = String(v).trim().match(/^(\d+(?:\.\d+)?)(px)?$/i);   // %·em 등은 크기로 안 친다 → viewBox 로
  return m ? parseFloat(m[1]) : 0;
}

export function svgImportSize(svg) {
  const tag = (String(svg || '').match(/<svg\b[^>]*>/i) || [''])[0];
  let w = _len(_attr(tag, 'width')), h = _len(_attr(tag, 'height'));
  const vb = String(_attr(tag, 'viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const vw = vb.length === 4 && vb[2] > 0 ? vb[2] : 0, vh = vb.length === 4 && vb[3] > 0 ? vb[3] : 0;
  if (!w && h && vw && vh) w = h * vw / vh;
  if (!h && w && vw && vh) h = w * vh / vw;
  if (!w || !h) { w = vw; h = vh; }
  if (!w || !h) return { w: 120, h: 120 };
  const k = Math.min(1, SVG_IMPORT_MAX / Math.max(w, h));
  return { w: Math.max(MIN, Math.round(w * k)), h: Math.max(MIN, Math.round(h * k)) };
}
