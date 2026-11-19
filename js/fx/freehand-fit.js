/* freehand-fit.js — t13A-02 연필·붓의 순수 셈(DOM 0 · 단위 검사 tests/unit/freehand-fit.test.mjs).
 *   연필 = 포인터 점 → 가까운 점 걷기 → Schneider(1990) 베지어 맞춤(오차 = «보정 세기») → 펜 노드({x,y,type,hIn,hOut} · pen-tool 과 같은 꼴).
 *   붓   = 맞춘 곡선을 고르게 떠서 폭 꼴(양 끝 가늘게 · 서예 펜촉)로 좌우 외곽 → 채운 다각형(필압 없음 · BRUSH-PRESSURE-01 은 sometime).
 *   새 의존성 0(RESEARCH-t13A-02 안 ① · Paper.js PathFitter·fit-curve 와 같은 공개 알고리즘을 직접 씀 — 코드 복사 아님). */

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const len = (a) => Math.hypot(a.x, a.y);
const unit = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : { x: 0, y: 0 }; };

/** 가까운 점 걷기 — 앞 점에서 minDist 미만이면 버림(끝 점은 늘 남김) */
export function dedupePoints(pts, minDist = 1) {
  const out = [];
  for (const p of pts) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (!out.length || len(sub(p, out[out.length - 1])) >= minDist) out.push({ x: p.x, y: p.y });
  }
  const last = pts[pts.length - 1];
  if (out.length > 1 && last && len(sub(last, out[out.length - 1])) > 1e-9) out.push({ x: last.x, y: last.y });
  return out;
}

const bez = (b, t) => {
  const mt = 1 - t;
  return add(add(mul(b[0], mt * mt * mt), mul(b[1], 3 * mt * mt * t)), add(mul(b[2], 3 * mt * t * t), mul(b[3], t * t * t)));
};
const bez1 = (b, t) => {   // 1차 도함수
  const mt = 1 - t;
  return add(add(mul(sub(b[1], b[0]), 3 * mt * mt), mul(sub(b[2], b[1]), 6 * mt * t)), mul(sub(b[3], b[2]), 3 * t * t));
};
const bez2 = (b, t) => add(mul(add(sub(b[2], mul(b[1], 2)), b[0]), 6 * (1 - t)), mul(add(sub(b[3], mul(b[2], 2)), b[1]), 6 * t));

function chordParam(pts) {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = u[u.length - 1] || 1;
  return u.map((v) => v / L);
}
function generateBezier(pts, u, t1, t2) {
  const p0 = pts[0], p3 = pts[pts.length - 1];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i], mt = 1 - t;
    const a1 = mul(t1, 3 * t * mt * mt), a2 = mul(t2, 3 * t * t * mt);
    c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
    const tmp = sub(pts[i], bez([p0, p0, p3, p3], t));
    x0 += dot(a1, tmp); x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let al = Math.abs(det) > 1e-12 ? (x0 * c11 - x1 * c01) / det : 0;
  let ar = Math.abs(det) > 1e-12 ? (c00 * x1 - c01 * x0) / det : 0;
  const seg = len(sub(p3, p0)), eps = 1e-6 * seg;
  if (al < eps || ar < eps) { al = seg / 3; ar = seg / 3; }   // 쓸모없는 해 → 1/3 휴리스틱(Schneider 원문)
  return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
}
function maxError(pts, b, u) {
  let max = 0, split = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const d = len(sub(bez(b, u[i]), pts[i]));
    if (d > max) { max = d; split = i; }
  }
  return [max, split];
}
function reparam(b, pts, u) {
  return u.map((t, i) => {
    const d = sub(bez(b, t), pts[i]), q1 = bez1(b, t), q2 = bez2(b, t);
    const den = dot(q1, q1) + dot(d, q2);
    const nt = Math.abs(den) > 1e-12 ? t - dot(d, q1) / den : t;
    return Math.min(1, Math.max(0, nt));
  });
}
function fitCubic(pts, t1, t2, error, depth) {
  if (pts.length === 2) {
    const d = len(sub(pts[1], pts[0])) / 3;
    return [[pts[0], add(pts[0], mul(t1, d)), add(pts[1], mul(t2, d)), pts[1]]];
  }
  let u = chordParam(pts);
  let b = generateBezier(pts, u, t1, t2);
  let [err, split] = maxError(pts, b, u);
  if (err <= error) return [b];
  if (err <= error * 4) {
    for (let k = 0; k < 20; k++) {
      const up = reparam(b, pts, u);
      b = generateBezier(pts, up, t1, t2);
      [err, split] = maxError(pts, b, up);
      if (err <= error) return [b];
      u = up;
    }
  }
  if (depth > 40) return [b];   // 안전 바닥(이상한 입력에서 끝없이 쪼개지 않게)
  split = Math.min(pts.length - 2, Math.max(1, split));
  let tc = unit(sub(pts[split - 1], pts[split + 1]));
  if (!tc.x && !tc.y) tc = unit(sub(pts[split - 1], pts[split]));
  return [...fitCubic(pts.slice(0, split + 1), t1, tc, error, depth + 1), ...fitCubic(pts.slice(split), mul(tc, -1), t2, error, depth + 1)];
}

/** 점 → 3차 베지어 조각들 [[p0,c1,c2,p3], …]. error = 맞춤 오차(로컬 px · 클수록 매끈·점 적음). 점 < 2 면 []. */
export function fitCurve(points, error = 4) {
  const pts = dedupePoints(points, 1);
  if (pts.length < 2) return [];
  const t1 = unit(sub(pts[1], pts[0])), t2 = unit(sub(pts[pts.length - 2], pts[pts.length - 1]));
  return fitCubic(pts, t1, t2, Math.max(0.1, error), 0);
}

/** 베지어 조각 → 펜 노드(pen-tool nodesToSvgPath 가 그대로 그린다). 가운데 노드 = smooth · 양 끝 = corner. */
export function segmentsToPenNodes(segs) {
  if (!segs.length) return [];
  const r = (p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
  const nodes = [{ ...r(segs[0][0]), type: 'corner', hIn: null, hOut: r(segs[0][1]) }];
  segs.forEach((s, i) => {
    nodes.push({ ...r(s[3]), type: i < segs.length - 1 ? 'smooth' : 'corner', hIn: r(s[2]), hOut: i < segs.length - 1 ? r(segs[i + 1][1]) : null });
  });
  return nodes;
}

/** 보정 세기(0~100) → 맞춤 오차(화면 px). 기본 50 → 4px. ⚠️기본값은 마우스·트랙패드 실측 전 값(RESEARCH §5 «구현 때 재 봐야») */
export const SMOOTH_DEFAULT = 50;
export const smoothToError = (s) => 0.5 + (Math.min(100, Math.max(0, +s || 0)) / 100) * 7;

/** 붓 프리셋 — taper = 양 끝 가늘게(붓) · nib = 서예 펜촉(45° 납작 · 방향 따라 굵기) */
export const BRUSH_PRESETS = Object.freeze({ taper: { w: 10, label: '붓 — 양 끝 가늘게' }, nib: { w: 12, label: '서예 펜촉' } });

/** 맞춘 곡선 → 붓 외곽 다각형 점(닫힌 꼴). 조각마다 n 개 고르게 떠서 법선 방향 ± 폭/2. */
export function brushOutline(segs, preset = 'taper', n = 10) {
  const P = BRUSH_PRESETS[preset] ? preset : 'taper', W = BRUSH_PRESETS[P].w;
  const samp = [];
  segs.forEach((s, i) => { for (let k = i ? 1 : 0; k <= n; k++) { const t = k / n; samp.push({ p: bez(s, t), d: unit(bez1(s, t)) }); } });
  if (samp.length < 2) return [];
  const L = [0];
  for (let i = 1; i < samp.length; i++) L.push(L[i - 1] + len(sub(samp[i].p, samp[i - 1].p)));
  const total = L[L.length - 1] || 1;
  const left = [], right = [];
  samp.forEach(({ p, d }, i) => {
    const t = L[i] / total, end = Math.min(1, Math.sin(Math.PI * t) * 3);   // 끝 쪽 짧은 구간만 가늘어짐
    let w;
    if (P === 'nib') { const ang = Math.atan2(d.y, d.x); w = W * (0.2 + 0.8 * Math.abs(Math.sin(ang - Math.PI / 4))) * Math.max(0.35, end); }
    else w = W * Math.max(0.06, Math.pow(Math.sin(Math.PI * t), 0.6));
    const nrm = { x: -d.y, y: d.x }, h = w / 2;
    left.push(add(p, mul(nrm, h))); right.push(sub(p, mul(nrm, h)));
  });
  return [...left, ...right.reverse()];
}

/** 다각형 점 → SVG path d(닫힘 · 소수 1자리) */
export const polygonToPath = (poly) => poly.length ? 'M ' + poly.map((p) => `${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`).join(' L ') + ' Z' : '';
