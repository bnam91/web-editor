/* freehand-fit.test.mjs — t13A-02 연필·붓 순수 셈(js/fx/freehand-fit.js)
 * F1 사인 물결 200점 → 맞춘 곡선이 모든 점에서 오차(×1.5) 안 · 조각 수 < 점 수/10 · 노드 = 조각+1 · 끝 corner·가운데 smooth
 * F2 보정 세기 ↑ = 조각 수 ↓(매끈) · smoothToError 0/50/100 = 0.5/4/7.5
 * F3 직선 · 두 점 · 빈 입력 · NaN 점 — 안 터지고 꼴이 맞다
 * F4 붓 taper = 닫힌 다각형(좌·우 점 수 같음) · 끝 폭 ≈ 0 · 가운데 폭 ≈ 10 · nib = 가로(0°)와 대각(135°) 폭이 다르다
 * F5 (t13A-02 채점 261120 — 같은 자리 연필 4번 · 상자 224×164→6490×6588) 배율 80% · ① 정수 화면 좌표 지그재그(되돌아오는) 획 ZIG 을
 *    같은 자리에 보정 20→10→5→0 으로 4번 ② 거의 곧은 떨린 획 4개 × 100 판(보정 20/50/80/5) → 노드+핸들 상자 ≤ 그린 폭 + ½ 긴 변 + 2×오차 · 첫 노드 = 첫 점
 *    (옛 셈: ZIG 4번 모두 상자 ≥ 2100 로컬 px — 3점 조각의 t1·t2 가 거의 맞서 det 7e-10 > 1e-12 → α 수천)
 * 양성대조: _patches/freehand-CTL-no-fit.patch(fitCurve 가 첫·끝 점 직선 한 조각만) → F1 빨강
 *          _patches/freehand-CTL-handle-blowup.patch(generateBezier 조절점 상자 검사 되돌림) → F5 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCurve, segmentsToPenNodes, smoothToError, brushOutline, polygonToPath, dedupePoints } from '../../js/fx/freehand-fit.js';

const bz = (b, t) => { const m = 1 - t; return { x: m * m * m * b[0].x + 3 * m * m * t * b[1].x + 3 * m * t * t * b[2].x + t * t * t * b[3].x, y: m * m * m * b[0].y + 3 * m * m * t * b[1].y + 3 * m * t * t * b[2].y + t * t * t * b[3].y }; };
const distToCurve = (p, segs) => { let best = Infinity; for (const s of segs) for (let k = 0; k <= 200; k++) { const q = bz(s, k / 200); best = Math.min(best, Math.hypot(q.x - p.x, q.y - p.y)); } return best; };
const wave = Array.from({ length: 200 }, (_, i) => ({ x: i * 2, y: 40 * Math.sin(i / 20) }));

test('F1 사인 물결 — 오차 안 · 조각 적음 · 노드 꼴', () => {
  const segs = fitCurve(wave, 4);
  assert.ok(segs.length >= 2 && segs.length < wave.length / 10, `조각 ${segs.length}`);
  const worst = Math.max(...wave.map((p) => distToCurve(p, segs)));
  assert.ok(worst <= 4 * 1.5, `최대 벗어남 ${worst.toFixed(2)}`);
  const nodes = segmentsToPenNodes(segs);
  assert.equal(nodes.length, segs.length + 1);
  assert.equal(nodes[0].type, 'corner'); assert.equal(nodes.at(-1).type, 'corner');
  assert.ok(nodes.slice(1, -1).every((n) => n.type === 'smooth' && n.hIn && n.hOut));
  assert.equal(nodes[0].hIn, null); assert.equal(nodes.at(-1).hOut, null);
  assert.deepEqual([nodes[0].x, nodes[0].y], [0, 0]);
});

test('F2 보정 세기 — 클수록 조각 적다 · 사상', () => {
  const few = fitCurve(wave, smoothToError(100)).length, many = fitCurve(wave, smoothToError(0)).length;
  assert.ok(few < many, `세기 100 = ${few} · 0 = ${many}`);
  assert.deepEqual([smoothToError(0), smoothToError(50), smoothToError(100)], [0.5, 4, 7.5]);
});

test('F3 가장자리 입력', () => {
  assert.deepEqual(fitCurve([], 4), []);
  assert.deepEqual(fitCurve([{ x: 1, y: 1 }], 4), []);
  assert.equal(fitCurve([{ x: 0, y: 0 }, { x: 10, y: 0 }], 4).length, 1);
  const line = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }));
  assert.equal(fitCurve(line, 1).length, 1, '직선 = 한 조각');
  assert.equal(dedupePoints([{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 0.2, y: 0 }, { x: 5, y: 0 }], 1).length, 2);
});

test('F4 붓 외곽 — taper 끝 가늘고 가운데 굵다 · nib 방향 따라 굵기', () => {
  const segs = fitCurve(Array.from({ length: 60 }, (_, i) => ({ x: i * 3, y: 0 })), 2);
  const poly = brushOutline(segs, 'taper', 10);
  assert.ok(poly.length >= 4 && poly.length % 2 === 0);
  const half = poly.length / 2, width = (i) => Math.hypot(poly[i].x - poly[poly.length - 1 - i].x, poly[i].y - poly[poly.length - 1 - i].y);
  assert.ok(width(0) < 1.5, `끝 폭 ${width(0)}`);
  assert.ok(Math.abs(width(Math.floor(half / 2)) - 10) < 1.5, `가운데 폭 ${width(Math.floor(half / 2))}`);
  assert.match(polygonToPath(poly), /^M [\d.-]+ [\d.-]+ L .* Z$/);
  const across = brushOutline(fitCurve([{ x: 0, y: 0 }, { x: 100, y: 0 }], 1), 'nib', 10);
  const diag = brushOutline(fitCurve([{ x: 0, y: 0 }, { x: -70, y: 70 }], 1), 'nib', 10);
  const mid = (p) => { const k = Math.floor(p.length / 4); return Math.hypot(p[k].x - p[p.length - 1 - k].x, p[k].y - p[p.length - 1 - k].y); };
  assert.ok(Math.abs(mid(across) - mid(diag)) > 2, `nib 가로 ${mid(across).toFixed(1)} · 대각 ${mid(diag).toFixed(1)}`);
});

/* 정수 화면 좌표(첫 점 기준) — 가로로 갔다 오는 지그재그 156×8. DOM H6 와 같은 획. */
const ZIG = [[10,0],[17,0],[24,0],[34,1],[40,1],[47,2],[53,2],[57,2],[66,1],[73,4],[75,4],[81,4],[82,1],[86,2],[87,2],[87,4],[84,3],[85,4],[82,2],[78,1],[76,3],[71,2],[66,3],[56,1],[50,0],[42,1],[37,1],[31,0],[22,-1],[19,0],[12,2],[10,1],[2,-1],[-8,0],[-20,-1],[-25,-1],[-33,-1],[-37,0],[-40,0],[-44,-3],[-49,-3],[-54,-3],[-58,-2],[-62,-4],[-64,-2],[-66,-3],[-69,-4],[-68,-2],[-67,-4],[-67,-1],[-65,-4],[-64,-1],[-60,-1],[-54,-3],[-46,-1],[-42,-2],[-39,-2],[-35,-1],[-30,-1],[-23,-1],[-16,0],[-7,-1],[-3,-2],[6,0],[13,0],[21,1],[32,2],[42,1],[53,1],[60,0],[69,0],[73,3]];
const box = (ps) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of ps) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); } return { w: c - a, h: d - b }; };
/** 화면 점 → 섹션 로컬(freehand-tool _local 과 같은 셈 · 섹션 왼·위가 소수인 것까지) → 맞춤 → 노드+핸들 상자가 그린 폭 + 여유 안인가 */
function fitBox(screenPts, smooth, Z = 0.8, left = 300.4, top = 200.6) {
  const pts = screenPts.map((p) => ({ x: (p.x - left) / Z, y: (p.y - top) / Z }));
  const err = smoothToError(smooth) / Z, nodes = segmentsToPenNodes(fitCurve(pts, err));
  const E = box(pts), N = box(nodes.flatMap((q) => [q, q.hIn, q.hOut].filter(Boolean))), slack = Math.max(E.w, E.h) / 2 + 2 * err;
  return { ok: N.w <= E.w + slack && N.h <= E.h + slack, first: Math.hypot(nodes[0].x - pts[0].x, nodes[0].y - pts[0].y), msg: `보정${smooth}: 그린 ${E.w.toFixed(0)}×${E.h.toFixed(0)} → 상자 ${N.w.toFixed(0)}×${N.h.toFixed(0)}` };
}

test('F5 같은 자리 4획 · 배율 80% · 보정 바꿔 가며 — 조절점이 상자를 터뜨리지 않는다', () => {
  for (const sm of [20, 10, 5, 0]) {
    const r = fitBox(ZIG.map(([dx, dy]) => ({ x: 820 + dx, y: 470 + dy })), sm);
    assert.ok(r.ok, `★지그재그 ${r.msg}`);
    assert.ok(r.first < 0.01, `★첫 노드 = 첫 점 (${r.first})`);
  }
  let seed = 20261120; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const bad = [];
  for (let k = 0; k < 100; k++) for (const [s, sm] of [20, 50, 80, 5].entries()) {
    const pts = []; let x = 820, y = [470, 520, 560, 600][s]; const n = 20 + Math.floor(rnd() * 30);
    for (let i = 0; i < n; i++) { x += 6 + (rnd() * 2 - 1) * 1.5; y += (rnd() * 2 - 1) * 1.5; pts.push({ x, y }); }
    const r = fitBox(pts, sm);
    if (!r.ok || r.first >= 0.01) bad.push(`판${k}·획${s} ${r.msg} · 첫 노드 ${r.first.toFixed(3)}`);
  }
  assert.deepEqual(bad, [], bad.join(' | '));
});
