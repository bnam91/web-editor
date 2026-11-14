/* burst-geometry.js — 톱니(버스트) 스탬프 모양 «한 벌» (B2 · 현빈 261114 «BEST 처럼 톱니모양 마크도 필요»)
 *   ★자체 제작 도형 — 코드로 짓는 별꼴 다각형(바깥 반지름·안쪽 반지름을 번갈아). ⛔특정 서비스·브랜드 배지의 꼴을 베끼지 않는다(톱니 수·깊이·링은 사용자가 정한다).
 *   ★순수 함수 — window·DOM 0 · 단위(tests/unit/burst-geometry.test.mjs)가 글을 읽어 돌린다. 좌표 = 100×100 상자(svg viewBox 0 0 100 100).
 */
export const BURST_DEFAULTS = Object.freeze({ teeth: 24, depth: 14, ring: 'on' });
export const BURST_LIMITS = Object.freeze({ teeth: { min: 8, max: 48 }, depth: { min: 4, max: 30 } });

export function clampBurst({ teeth, depth } = {}) {
  const num = (v) => (v == null || v === '' ? NaN : Math.round(Number(v)));   // 빈 값 = 기본값(Number(null)=0 이 하한으로 새지 않게)
  const t = num(teeth);
  const d = num(depth);
  return {
    teeth: Number.isFinite(t) ? Math.max(BURST_LIMITS.teeth.min, Math.min(BURST_LIMITS.teeth.max, t)) : BURST_DEFAULTS.teeth,
    depth: Number.isFinite(d) ? Math.max(BURST_LIMITS.depth.min, Math.min(BURST_LIMITS.depth.max, d)) : BURST_DEFAULTS.depth,
  };
}

/** 톱니 다각형 꼭짓점 — 바깥 50 · 안쪽 50×(1 − depth%) · 첫 꼭짓점은 12시. @returns {string} "x,y x,y …" (2×teeth 개) */
export function burstPoints(opts) {
  const { teeth, depth } = clampBurst(opts);
  const R = 50, r = R * (1 - depth / 100), n = teeth * 2, pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / teeth;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(50 + rad * Math.cos(a)).toFixed(2)},${(50 + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** 안쪽 링 반지름(톱니 골보다 안) — 100 상자 기준. */
export function burstRingR(opts) {
  const { depth } = clampBurst(opts);
  return +(50 * (1 - depth / 100) * 0.84).toFixed(2);
}
