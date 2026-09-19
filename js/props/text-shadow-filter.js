/* text-shadow-filter.js — CSS text-shadow 목록 → filter: drop-shadow() 체인 (순수 함수, DOM 없음)
 *
 * ★0919r3 textshadow(T-059 확장 잔여): 글자 그라데이션(background-clip:text + 채움 transparent)에
 *   text-shadow 를 걸면 브라우저 페인트 순서(배경 → 글자[그림자 → 채움])상 그림자가 그라데이션 «위»에
 *   칠해지고, 채움이 투명이라 글자 안쪽까지 그림자색이 보인다 → 0% 쪽 페이드가 사라진다.
 *   filter: drop-shadow 는 «칠해진 결과»(그라데이션으로 잘린 글자)의 알파로 그림자를 만들어 그 «뒤»에
 *   깔므로 피그마 DROP_SHADOW 와 같은 모양이 된다.
 *
 * 변환 규칙
 *   · text-shadow 목록은 첫 항목이 맨 위. filter 체인은 뒤 함수가 앞 결과 «아래»에 깔리므로
 *     목록을 역순으로 넣는다(맨 위 그림자가 마지막에 = 가장 가까이).
 *   · blur: 크로미움 실측(2026-09-19, 같은 글자 text-shadow B px vs drop-shadow k·B px 픽셀 대조)
 *       B=4/10/20 에서 k=1 → 평균차 0.83/1.62/1.70·최대 61/91/57, k=0.5 → 평균차 0.10/0.10/0.12·최대 11/6/10.
 *     ⇒ drop-shadow 세 번째 값 = text-shadow blur × 0.5 (표준편차).
 *   · ★여러 겹(네온)은 drop-shadow 체인으로 옮기면 안 된다 — 뒤 함수가 앞 그림자까지 다시 그림자 내(누적)
 *     글로우가 크게 번진다. 실측(같은 네온 6겹, 단색 글자, text-shadow 대비 평균차/최대차):
 *       drop-shadow 체인 3.55/123 (그림자를 «아예 안 그린» 것 2.98/193 보다도 나쁨)
 *       SVG 필터(각 겹을 SourceAlpha 에서 따로 만들어 feMerge, 맨 위에 SourceGraphic) 0.16/41
 *     ⇒ 한 겹 = drop-shadow(정확·SVG 불필요), 두 겹 이상 = SVG 필터(url(#id)) — svgShadowFilterMarkup.
 */

export const DROP_SHADOW_BLUR_FACTOR = 0.5;

/** 괄호 안 쉼표(rgba(…))는 건너뛰고 최상위 쉼표로만 자른다. */
export function splitShadowList(ts) {
  const out = [];
  if (typeof ts !== 'string') return out;
  let depth = 0, cur = '';
  for (const ch of ts) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const _LEN = /^-?(?:\d+\.?\d*|\.\d+)(?:px)?$/i;

/** 한 항목 → {x,y,blur,color} | null. 색 위치(앞/뒤)는 가리지 않는다(computed=앞, 인라인=뒤). */
export function parseShadowItem(item) {
  if (typeof item !== 'string') return null;
  const s = item.trim();
  if (!s || s === 'none') return null;
  const toks = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) { if (cur) toks.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) toks.push(cur);
  const lens = [];
  let color = null;
  for (const t of toks) {
    if (_LEN.test(t)) lens.push(parseFloat(t));
    else if (!color) color = t;
    else return null;            // 알 수 없는 토큰 두 개 — 해석 불가
  }
  if (lens.length < 2 || lens.length > 3) return null;
  return { x: lens[0], y: lens[1], blur: lens[2] || 0, color: color || 'currentcolor' };
}

const _n = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return (Object.is(r, -0) ? 0 : r) + 'px';
};

/** text-shadow 목록 → [{x,y,blur,color}] (목록 순서 그대로 = 첫 항목이 맨 위). 없거나 해석 불가면 null. */
export function parseShadowList(ts) {
  if (typeof ts !== 'string' || !ts.trim() || ts.trim() === 'none') return null;
  const items = splitShadowList(ts).map(parseShadowItem);
  if (!items.length || items.some(i => !i)) return null;
  return items;
}

/** text-shadow(목록) → drop-shadow 체인 문자열. 그림자가 없거나 해석 불가면 ''. (여러 겹은 누적 근사 — 위 주석) */
export function textShadowToDropShadowFilter(ts) {
  const items = parseShadowList(ts);
  if (!items) return '';
  return items.slice().reverse()
    .map(i => `drop-shadow(${_n(i.x)} ${_n(i.y)} ${_n(i.blur * DROP_SHADOW_BLUR_FACTOR)} ${i.color})`)
    .join(' ');
}

/** 같은 그림자 목록 = 같은 필터 id (djb2 → base36). */
export function shadowFilterId(ts) {
  let h = 5381;
  const str = String(ts || '');
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return 'tgs-f-' + h.toString(36);
}

const _attr = (v) => String(v).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * 여러 겹 그림자 = text-shadow 와 같은 뜻의 SVG <filter> 마크업.
 *   각 겹: SourceAlpha → 흐림(std = blur × 0.5) → 이동 → 색(flood) ∩ 모양 → 결과 sᵢ
 *   feMerge: 맨 아래 겹부터 … 맨 위 겹, 마지막에 SourceGraphic(칠해진 글자) = 그림자는 전부 글자 «뒤».
 *   영역: userSpaceOnUse(요소 테두리 박스 좌상단 원점) — 퍼짐 E 만큼 왼쪽·위로 넉넉히, 오른쪽·아래는 크게.
 */
export function svgShadowFilterMarkup(id, items) {
  if (!Array.isArray(items) || !items.length) return '';
  const rev = items.slice().reverse();
  let E = 4;
  for (const i of rev) E = Math.max(E, Math.ceil(Math.max(Math.abs(i.x), Math.abs(i.y)) + 3 * i.blur * DROP_SHADOW_BLUR_FACTOR + 4));
  let prims = '', merge = '';
  rev.forEach((i, k) => {
    prims += `<feGaussianBlur in="SourceAlpha" stdDeviation="${_n(i.blur * DROP_SHADOW_BLUR_FACTOR).replace('px', '')}" result="b${k}"/>`
      + `<feOffset in="b${k}" dx="${_n(i.x).replace('px', '')}" dy="${_n(i.y).replace('px', '')}" result="o${k}"/>`
      + `<feFlood flood-color="${_attr(i.color)}" result="c${k}"/>`
      + `<feComposite in="c${k}" in2="o${k}" operator="in" result="s${k}"/>`;
    merge += `<feMergeNode in="s${k}"/>`;
  });
  return `<filter id="${_attr(id)}" filterUnits="userSpaceOnUse" x="-${E}" y="-${E}" width="100000" height="100000" color-interpolation-filters="sRGB">`
    + prims + `<feMerge>${merge}<feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}
