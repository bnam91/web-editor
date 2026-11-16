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

/** 톱니 다각형 꼭짓점 — 바깥 50 · 안쪽 50×(1 − depth%) · 첫 꼭짓점은 12시 · round%(톱니 끝 둥글기 · 0 = 뾰족 = 옛 2×teeth 개). @returns {string} "x,y x,y …" */
export function burstPoints(opts) {
  const { teeth, depth } = clampBurst(opts);
  const R = 50, r = R * (1 - depth / 100), n = teeth * 2, pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / teeth;
    const rad = i % 2 === 0 ? R : r;
    pts.push([50 + rad * Math.cos(a), 50 + rad * Math.sin(a)]);
  }
  return roundPolyPoints(pts, opts && opts.round).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

/* ══ 꼭짓점 둥글기(현빈 QA 261116 «톱니 끝이 너무 뾰족 — 곡률» · «star 도 꼭짓점 곡률») ══
 *   꼭짓점마다 양옆 변을 따라 d = round% × (짧은 변의 반) 들어간 두 점을 그 꼭짓점을 조절점으로 한 2차 곡선으로 잇고 점 ROUND_SEG 개로 쪼갠다
 *   ⇒ 여전히 «점 목록»(<polygon>·CSS polygon()) — 읽는 쪽(별 고르기·별마다 색·이미지 clip·PNG·Figma generic svg)이 그대로.
 *   round 0(미설정) = 받은 점 그대로(옛 바이트). ⚠️같은 몸통이 js/blocks/burst-geometry.js · js/shape-star.js 두 곳 —
 *   둘 다 단위가 «파일 하나만» 불러 재서(import 0 단언 · 임시폴더 홀로 import) 묶지 못했다. tests/unit/poly-round-twin.test.mjs 가 같은 출력을 잠근다. */
export const ROUND_MIN = 0, ROUND_MAX = 100, ROUND_SEG = 6;
export function clampRound(v) { const k = Math.round(Number(v)); return Number.isFinite(k) ? Math.min(ROUND_MAX, Math.max(ROUND_MIN, k)) : 0; }
export function roundPolyPoints(pts, round) {
  const t = clampRound(round) / 100, n = pts.length;
  if (!t || n < 3) return pts;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), d = (t * Math.min(la, lb)) / 2;
    if (!d) { out.push(p); continue; }
    const p1 = [p[0] + ((a[0] - p[0]) * d) / la, p[1] + ((a[1] - p[1]) * d) / la], p2 = [p[0] + ((b[0] - p[0]) * d) / lb, p[1] + ((b[1] - p[1]) * d) / lb];
    for (let s = 0; s <= ROUND_SEG; s++) {
      const u = s / ROUND_SEG, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u;
      out.push([w0 * p1[0] + w1 * p[0] + w2 * p2[0], w0 * p1[1] + w1 * p[1] + w2 * p2[1]]);
    }
  }
  return out;
}

/** 안쪽 링 반지름(톱니 골보다 안) — 100 상자 기준. */
export function burstRingR(opts) {
  const { depth } = clampBurst(opts);
  return +(50 * (1 - depth / 100) * 0.84).toFixed(2);
}
