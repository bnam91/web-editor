// 원(ellipse) 쉐이프 «갯수·간격·원마다 색·이너 그림자» — 순수 함수 (1013t2A1 · DOM 없음).
// 현빈 원문: 「Ellipse 블럭 : 별모양 블럭처럼 갯수 선택하면 늘릴 수 있고, 각 원 모양마다 각각의 색을
//            입력할 수 있다. 살짝 이너 그림자 느낌도 줄 수 있다.」
// ★꼴은 별(js/shape-star.js)과 같다 — 원 하나의 틀(100×100)을 가로로 N번 잇는다.
// ★★그리는 자는 하나다: block-factory.js refreshShapeInnerSVG 가 이 파일의 ellipseInnerSVG 를 부른다.
//   ellipse 는 SHAPE_DEFS 에서 dynamic 이라 로드·⌘Z·페이지 전환·두께 변경 때마다 안쪽을 다시 쓴다
//   ⇒ 패널에 따로 그리개를 두면 저장→다시 열기 한 번에 원이 1개로 주저앉는다.
// ★count≤1 · 그림자 없음이면 옛 `_shapeInnerSVG('ellipse')` 와 같은 글자를 돌려준다(저장본 바이트 보존).
import { STAR_COUNT_MIN, STAR_COUNT_MAX, STAR_COUNT_DEFAULT, clampStarCount,
         starColorList, starColorsAttr } from './shape-star.js';

export const ELLIPSE_VB = 100;   // 원 하나의 틀(옛 viewBox 0 0 100 100)

/* 갯수 — 범위를 «별과 같게» 구조로 잠근다(같은 상수를 다시 내보낸다). */
export const ELLIPSE_COUNT_MIN = STAR_COUNT_MIN;
export const ELLIPSE_COUNT_MAX = STAR_COUNT_MAX;
export const ELLIPSE_COUNT_DEFAULT = STAR_COUNT_DEFAULT;
export const clampEllipseCount = clampStarCount;

/* 간격 — viewBox 단위(지름 100 기준 %). 음수는 겹치는 «아바타 줄». 기본 20 = 그림(ref 1013t2-img01)의 띄운 줄.
   ★c=1 이면 간격이 viewBox 에 안 든다 ⇒ 옛 바이트에 영향 없음. */
export const ELLIPSE_GAP_MIN = -50;
export const ELLIPSE_GAP_MAX = 100;
export const ELLIPSE_GAP_DEFAULT = 20;

export function clampEllipseGap(g) {
  if (g === undefined || g === null || String(g).trim() === '') return ELLIPSE_GAP_DEFAULT;
  const v = Math.round(Number(g));
  if (!Number.isFinite(v)) return ELLIPSE_GAP_DEFAULT;
  return Math.min(ELLIPSE_GAP_MAX, Math.max(ELLIPSE_GAP_MIN, v));
}

export function ellipseViewBoxWidth(count, gap) {
  const c = clampEllipseCount(count);
  return ELLIPSE_VB * c + clampEllipseGap(gap) * (c - 1);
}

/** count=1 이면 SHAPE_DEFS.ellipse.vb('0 0 100 100')와 바이트 동일. */
export function ellipseViewBox(count, gap) {
  return `0 0 ${ellipseViewBoxWidth(count, gap)} ${ELLIPSE_VB}`;
}

/** 원 하나의 비를 지키는 프레임 폭 — starFrameWidthFor 와 같은 식(W·vb'/vb). 클램프는 부르는 쪽. */
export function ellipseFrameWidthFor(curW, prevCount, prevGap, nextCount, nextGap) {
  const w = Number(curW);
  const prevVb = ellipseViewBoxWidth(prevCount, prevGap);
  const nextVb = ellipseViewBoxWidth(nextCount, nextGap);
  if (!Number.isFinite(w) || w <= 0 || prevVb <= 0 || nextVb <= 0) return null;
  return w * nextVb / prevVb;
}

/* 원마다 색 — 별의 명부를 그대로 쓴다(키만 data-ellipse-colors). */
export const ellipseColorList = starColorList;
export const ellipseColorsAttr = starColorsAttr;

/* 이너 그림자 — 세기 1~100(미설정·0·빈 값 = 꺼짐 = null).
   ⚠️CSS 토큰이 아니라 JS 상수: SVG 필터 속성은 PNG(html2canvas 의 SVG 직렬화)·내보낸 HTML 에서
   var(--…) 가 풀리지 않는다. «UI 색»이 아니라 «도형 내용»의 값이다(선례 STAR_FILL_ON · 쿠폰 S.shCol). */
export const ELLIPSE_SHADOW_MIN = 1;
export const ELLIPSE_SHADOW_MAX = 100;
export const ELLIPSE_SHADOW_ON_DEFAULT = 35;
export const ELL_SH_COLOR = '#000000';
export const ELL_SH_BLUR = 5;        // 지름 100 기준
export const ELL_SH_DY = 3;          // 지름 100 기준
export const ELL_SH_OPA_MAX = 0.6;

export function clampEllipseShadow(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(ELLIPSE_SHADOW_MAX, Math.max(ELLIPSE_SHADOW_MIN, n));
}

export function ellipseShadowOpacity(s) {
  const v = clampEllipseShadow(s);
  if (v === null) return 0;
  return Math.round(v / 100 * ELL_SH_OPA_MAX * 1000) / 1000;
}

export function ellipseFilterId(id) {
  return `eish-${id || 'shp_anon'}`;
}

/* 속성 글자로 들어가므로 따옴표·꺾쇠가 섞인 값은 버린다(물려받기로). */
function _safePaint(v) {
  return (v && /^[#a-zA-Z0-9(),.\s%-]+$/.test(String(v))) ? String(v).trim() : null;
}

/** i 번째 원의 중심 x. */
export function ellipseCx(i, gap) {
  return ELLIPSE_VB / 2 + (Math.max(0, Math.round(Number(i)) || 0)) * (ELLIPSE_VB + clampEllipseGap(gap));
}

/**
 * 원 N개의 inner SVG 문자열.
 * @param {{sw?:number, count?:any, gap?:any, colors?:string, shadow?:any, id?:string}} o
 * ★count≤1 · shadow 없음 → 옛 글자 `<ellipse cx="50" cy="50" rx="r" ry="r"/>` 그대로.
 * ★개별 색은 count>1 일 때만 칠한다(count=1 이면 키가 있어도 무시 — 다시 늘리면 돌아온다).
 * ★그림자 필터는 `<defs>` 밖 svg 직속 `<filter>` 로 둔다 — 그라데이션 `:scope > defs` 와 안 섞이게.
 */
export function ellipseInnerSVG({ sw = 0, count, gap, colors, shadow, id } = {}) {
  const half = Math.max(0, Number(sw) || 0) / 2;
  const r = Math.max(0, 50 - half);
  const c = clampEllipseCount(count);
  const s = clampEllipseShadow(shadow);
  if (c <= 1 && s === null) return `<ellipse cx="50" cy="50" rx="${r}" ry="${r}"/>`;
  const fid = ellipseFilterId(id);
  const cols = c > 1 ? ellipseColorList(colors, c) : null;
  let out = '';
  if (s !== null) {
    out += `<filter id="${fid}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">`
      + `<feComponentTransfer in="SourceAlpha" result="inv"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>`
      + `<feGaussianBlur in="inv" stdDeviation="${ELL_SH_BLUR}" result="blur"/>`
      + `<feOffset in="blur" dx="0" dy="${ELL_SH_DY}" result="off"/>`
      + `<feFlood flood-color="${ELL_SH_COLOR}" flood-opacity="${ellipseShadowOpacity(s)}" result="col"/>`
      + `<feComposite in="col" in2="off" operator="in" result="sh"/>`
      + `<feComposite in="sh" in2="SourceAlpha" operator="in" result="inner"/>`
      + `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="inner"/></feMerge>`
      + `</filter>`;
  }
  for (let i = 0; i < c; i++) {
    const own = cols ? _safePaint(cols[i]) : null;
    const fill = own ? ` fill="${own}" data-ell-own="1"` : '';
    const flt = s !== null ? ` filter="url(#${fid})"` : '';
    out += `<ellipse cx="${ellipseCx(i, gap)}" cy="50" rx="${r}" ry="${r}"${fill}${flt}/>`;
  }
  return out;
}
