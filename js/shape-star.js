// 별 쉐이프 꼭짓점 수(B2) — 순수 함수. viewBox 200×190 (block-factory.js SHAPE_DEFS.star 와 같은 틀).
// ★n=5 는 «옛 문자열 그대로» 돌려준다(저장된 별·내보내기와 바이트 동일 — 계산 결과로 바꾸지 마라).
export const STAR_VB_W = 200;
export const STAR_VB_H = 190;
export const STAR_MIN = 3;
export const STAR_MAX = 12;
export const STAR_DEFAULT = 5;

const OLD_POINTS = '100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70';
const OLD_CLIP = 'polygon(50% 4.21%, 61% 36.84%, 94% 36.84%, 67.5% 57.89%, 77.5% 90.53%, 50% 69.47%, 22.5% 90.53%, 32.5% 57.89%, 6% 36.84%, 39% 36.84%)';

const CX = 100, CY = 98.66, R_OUT = 90.66, R_IN = 36;   // 5각 옛 별의 바깥 반지름·중심을 따른다

export function clampStarN(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return STAR_DEFAULT;
  return Math.min(STAR_MAX, Math.max(STAR_MIN, v));
}

const r2 = (v) => Math.round(v * 100) / 100;

function _coords(n) {
  const out = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n;
    const r = i % 2 === 0 ? R_OUT : R_IN;
    out.push([r2(CX + r * Math.cos(a)), r2(CY + r * Math.sin(a))]);
  }
  return out;
}

export function starPoints(n) {
  const k = clampStarN(n);
  if (k === 5) return OLD_POINTS;
  return _coords(k).map(([x, y]) => x + ',' + y).join(' ');
}

export function starClipPath(n) {
  const k = clampStarN(n);
  if (k === 5) return OLD_CLIP;
  const p = (v, d) => r2(v / d * 100) + '%';
  return 'polygon(' + _coords(k).map(([x, y]) => p(x, STAR_VB_W) + ' ' + p(y, STAR_VB_H)).join(', ') + ')';
}

/* ══ 별 «갯수» (현빈 2026-10-06 「우측패널에 갯수추가하기하면 별 갯수가 여러개 추가되게 해줄래?」) ══
 * ★판정(지디가 현빈께 그림으로 여쭤 받음, 2026-10-06): «한 블록 안에 별 N개» ＋ 「늘리면 블록이
 *   옆으로 넓어진다(별 크기 유지)». ⛔블록을 N개로 복제하는 안은 아니다.
 * ★고치기 전 실측: 별 패널 라벨 전수 = 색상·외곽선·두께·W·H·꼭짓점·회전° ⇒ 「갯수」 0건.
 *   꼭짓점을 5→7 로 올리면 polygon 1개 그대로 · 좌표쌍 10→14 ⇒ «한 별의 뾰족한 끝»이 바뀌었다.
 * ★별 하나의 틀(200×190)을 가로로 N번 잇는다 ⇒ viewBox = (200·N) × 190.
 *   ⇒ 각 별의 «비율»이 N 과 무관하게 같다. 래퍼 프레임 폭을 N배로 키우면 별 크기가 유지된다.
 * ★count===1 은 ★옛 문자열을 그대로 돌려준다 — 저장된 별·내보내기와 바이트 동일(starPoints 의
 *   n===5 특례와 같은 규율). ⛔계산 결과로 바꾸지 마라.                                        */
export const STAR_COUNT_MIN = 1;
export const STAR_COUNT_MAX = 10;
export const STAR_COUNT_DEFAULT = 1;

export function clampStarCount(c) {
  const v = Math.round(Number(c));
  if (!Number.isFinite(v)) return STAR_COUNT_DEFAULT;
  return Math.min(STAR_COUNT_MAX, Math.max(STAR_COUNT_MIN, v));
}

/** 별 count 개를 담는 viewBox 문자열. count=1 이면 SHAPE_DEFS.star.vb 와 ★바이트 동일. */
export function starViewBox(count) {
  return `0 0 ${STAR_VB_W * clampStarCount(count)} ${STAR_VB_H}`;
}

/** i 번째(0부터) 별의 points — 별 하나의 좌표를 가로로 i·200 만큼 옮긴 것. */
export function starPointsAt(n, i = 0) {
  const base = starPoints(n);
  const dx = STAR_VB_W * Math.max(0, Math.round(Number(i)) || 0);
  if (!dx) return base;
  return base.trim().split(/\s+/)
    .map(pair => { const [x, y] = pair.split(','); return (r2(Number(x) + dx)) + ',' + y; })
    .join(' ');
}

/** 별 count 개의 polygon points 배열. count=1 이면 [starPoints(n)] — 옛 한 벌 그대로. */
export function starPointsList(n, count) {
  const k = clampStarCount(count);
  return Array.from({ length: k }, (_, i) => starPointsAt(n, i));
}
