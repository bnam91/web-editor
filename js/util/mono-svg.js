/* mono-svg.js — «한 색» SVG 를 currentColor 로 (LIB-FIGMA · 261118).
 *   입력은 sanitizeSvgString 을 «지난» 글자(속성 값이 "…" 로 다시 적혀 있다)여야 한다 — 거르기는 부르는 쪽 몫.
 *   fill·stroke 속성 값 중 none·transparent·url(…)·currentColor 를 뺀 색이 «하나»면 그 색을 currentColor 로 바꾸고 원래 색을 돌려준다.
 *   둘 이상이면 손대지 않고 multi:true (다색은 그대로 두고 칸에 표시). 색 0 이면 color:null.
 *   ★DOM 0 · import 0 — 단위(tests/unit/admin-library.test.mjs)가 Node 에서 그대로 싣는다.
 */
const ATTR = /\b(fill|stroke)="([^"]*)"/g;
const NAMED = { black: '#000000', white: '#ffffff' };
const SKIP = /^(none|transparent|currentcolor|inherit)$|^url\(/i;

function _norm(c) {
  const v = c.trim().toLowerCase();
  if (NAMED[v]) return NAMED[v];   // 색 고르개(input type=color)는 #rrggbb 만 받는다
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : v;
}

/** svg → { svg, color, multi } */
export function normalizeMonoSvg(svg) {
  const s = String(svg || '');
  const colors = new Set();
  for (const [, , v] of s.matchAll(ATTR)) if (!SKIP.test(v.trim())) colors.add(_norm(v));
  if (colors.size !== 1) return { svg: s, color: null, multi: colors.size > 1 };
  const [color] = colors;
  return { svg: s.replace(ATTR, (all, k, v) => (SKIP.test(v.trim()) ? all : `${k}="currentColor"`)), color, multi: false };
}
