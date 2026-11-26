/* offset-path-geom.js — 0.9.13 77 t13B-04 Offset Path 1차 셈(순수 · DOM 0). 현빈 261119 ⓑ = 일러스트레이터 꼴(원본 두고 새 도형 · ⌘Z 쉬움).
 * 1차 범위(지디 261125 R3): 사각·원 × Round / Miter · Bevel 은 2차(사각 Bevel = 다각형 도형으로 바뀜).
 * 입력은 «도형 상자 px»(포장 프레임 크기) — svg 가 preserveAspectRatio="none" 이라 viewBox 로 재면 축마다 d 가 달라진다(PLAN U1) ⇒ 상자 px 로만 잰다.
 *   사각: 새 상자 = (w + 2d) × (h + 2d) · 모서리 반경 r' = Round 면 max(0, r + d)(뾰족한 사각 + 바깥 d = 반경 d) · Miter 면 r > 0 일 때만 max(0, r + d)(뾰족은 뾰족 그대로)
 *   원(타원): 새 상자 = (w + 2d) × (h + 2d) — 타원의 참 오프셋 곡선은 타원이 아니다 · rx+d·ry+d 근사(PLAN · 오차 작음) · 모서리 종류 무관
 *   자리: 원본 왼위에서 (−d, −d) · 안쪽(음수 d)으로 상자가 0 이하가 되면 null(거부)
 * @param {{type:'rectangle'|'ellipse', w:number, h:number, r?:number, d:number, join?:'round'|'miter'}} o
 * @returns {{w:number,h:number,r:number,dx:number,dy:number}|null} */
export function offsetBox({ type, w, h, r = 0, d, join = 'round' }) {
  if (!['rectangle', 'ellipse'].includes(type)) return null;
  if (![w, h, r, d].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  const nw = w + 2 * d, nh = h + 2 * d;
  if (nw < 1 || nh < 1) return null;
  let nr = 0;
  if (type === 'rectangle') nr = join === 'miter' ? (r > 0 ? Math.max(0, r + d) : 0) : Math.max(0, r + d);
  const k = (v) => Math.round(v * 100) / 100 || 0;   // || 0 = −0 을 0 으로(d = 0 이면 dx = −0)
  return { w: k(nw), h: k(nh), r: k(nr), dx: k(-d), dy: k(-d) };
}
if (typeof window !== 'undefined') window.offsetBox = offsetBox;
