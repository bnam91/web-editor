/* bezier-split.js — PEN-EDIT-ADD-POINT-ON-SEGMENT-01(133 · 현빈 «이번 판») 펜 편집에서 선분 눌러 점 더하기의 순수 셈(DOM 0).
 *   펜 노드 = { x, y, type, hIn, hOut }(pen-tool 과 같은 꼴) · 선분 i = 노드 i → i+1(닫힌 패스면 마지막 → 0 도).
 *   곡선이면 de Casteljau 로 t 에서 나눠 «모양 무변»(두 조각을 이으면 옛 곡선과 같은 점) · 두 핸들이 다 없는 직선이면 핸들 없는 꼭짓점 하나.
 *   단위 검사 tests/unit/bezier-split.test.mjs. */

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const P = (n) => ({ x: n.x, y: n.y });

/** 선분 i 의 네 점 [P0,P1,P2,P3] — 없는 핸들은 그 끝점(펜 nodesToSvgPath _seg 와 같은 규칙) */
export function segmentPoints(nodes, i, closed = false) {
  const n = nodes.length, j = i + 1 < n ? i + 1 : (closed ? 0 : -1);
  if (i < 0 || i >= n || j < 0) return null;
  const a = nodes[i], b = nodes[j];
  return [P(a), a.hOut ? P(a.hOut) : P(a), b.hIn ? P(b.hIn) : P(b), P(b)];
}

export const bezierAt = (s, t) => { const a = lerp(s[0], s[1], t), b = lerp(s[1], s[2], t), c = lerp(s[2], s[3], t); return lerp(lerp(a, b, t), lerp(b, c, t), t); };

/** 선분 i 를 t(0~1 · 양 끝 1e-3 안쪽으로 조임)에서 나눈 새 노드 배열과 새 노드 자리. 선분이 없으면 null. 원본 배열은 안 바꾼다. */
export function splitSegment(nodes, i, t, closed = false) {
  const s = segmentPoints(nodes, i, closed);
  if (!s) return null;
  t = Math.min(1 - 1e-3, Math.max(1e-3, +t || 0.5));
  const n = nodes.length, j = i + 1 < n ? i + 1 : 0;
  const out = nodes.map((q) => ({ ...q, hIn: q.hIn ? { ...q.hIn } : null, hOut: q.hOut ? { ...q.hOut } : null }));
  const straight = !nodes[i].hOut && !nodes[j].hIn;
  let mid;
  if (straight) {
    const p = lerp(s[0], s[3], t);
    mid = { x: p.x, y: p.y, type: 'corner', hIn: null, hOut: null };
  } else {
    const p01 = lerp(s[0], s[1], t), p12 = lerp(s[1], s[2], t), p23 = lerp(s[2], s[3], t);
    const p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t), p = lerp(p012, p123, t);
    out[i].hOut = p01;
    out[j].hIn = p23;
    mid = { x: p.x, y: p.y, type: 'smooth', hIn: p012, hOut: p123 };
  }
  const at = i + 1;   // 닫는 선분(i = n−1)이면 끝에 붙는다(그 뒤 닫는 선분 = 새 노드 → 0)
  out.splice(at, 0, mid);
  return { nodes: out, index: at };
}

/** 화면에서 가장 가까운 t — toScreen(점) 으로 옮긴 곡선을 고르게 떠서 찾고 둘레를 한 번 더 좁힌다. { t, dist } */
export function nearestT(seg, toScreen, px, py, n = 64) {
  const d = (t) => { const q = toScreen(bezierAt(seg, t)); return Math.hypot(q.x - px, q.y - py); };
  let best = 0, bd = Infinity;
  for (let k = 0; k <= n; k++) { const t = k / n, v = d(t); if (v < bd) { bd = v; best = t; } }
  const lo = Math.max(0, best - 1 / n), hi = Math.min(1, best + 1 / n);
  for (let k = 0; k <= 16; k++) { const t = lo + (hi - lo) * k / 16, v = d(t); if (v < bd) { bd = v; best = t; } }
  return { t: best, dist: bd };
}
