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
