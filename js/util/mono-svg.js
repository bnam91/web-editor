/* mono-svg.js — «한 색» SVG 를 currentColor 로 (LIB-FIGMA · 261118).
 *   입력은 sanitizeSvgString 을 «지난» 글자(속성 값이 "…" 로 다시 적혀 있다)여야 한다 — 거르기는 부르는 쪽 몫.
 *   fill·stroke 속성 값 중 none·transparent·url(…)·currentColor 를 뺀 색이 «하나»면 그 색을 currentColor 로 바꾸고 원래 색을 돌려준다.
 *   둘 이상이면 손대지 않고 multi:true (다색은 그대로 두고 칸에 표시). 색 0 이면 color:null.
 *   그라데이션 등 url(#…) 칠이 하나라도 있으면 다색(stop-color 가 따로 있다 · 반만 바꾸면 그림이 깨진다).
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
/* <clipPath>·<mask> 안의 fill 은 «칠»이 아니라 자르기 꼴이다(두들 15장: <clipPath><rect fill="white"/></clipPath> — dev 9a724fb78 채점 ②).
   ⇒ 색 세기에서 빼고, 바꾸기에서도 손대지 않는다(흰 자르기 상자를 currentColor 로 바꾸면 자르기 뜻은 같지만 바이트가 괜히 바뀐다). */
const NOPAINT = /<(clipPath|mask)\b[\s\S]*?<\/\1>/g;
function _paintParts(s) { const out = []; let i = 0; for (const m of s.matchAll(NOPAINT)) { out.push([s.slice(i, m.index), true], [m[0], false]); i = m.index + m[0].length; } out.push([s.slice(i), true]); return out; }

export function normalizeMonoSvg(svg) {
  const s = String(svg || '');
  const colors = new Set();
  const parts = _paintParts(s);
  for (const [txt, paint] of parts) {
    if (!paint) continue;
    for (const [, , v] of txt.matchAll(ATTR)) {
      if (/^url\(/i.test(v.trim())) return { svg: s, color: null, multi: true };
      if (!SKIP.test(v.trim())) colors.add(_norm(v));
    }
  }
  if (colors.size !== 1) return { svg: s, color: null, multi: colors.size > 1 };
  const [color] = colors;
  return { svg: parts.map(([txt, paint]) => (paint ? txt.replace(ATTR, (all, k, v) => (SKIP.test(v.trim()) ? all : `${k}="currentColor"`)) : txt)).join(''), color, multi: false };
}
