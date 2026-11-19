/* freehand-fit.test.mjs — t13A-02 연필·붓 순수 셈(js/fx/freehand-fit.js)
 * F1 사인 물결 200점 → 맞춘 곡선이 모든 점에서 오차(×1.5) 안 · 조각 수 < 점 수/10 · 노드 = 조각+1 · 끝 corner·가운데 smooth
 * F2 보정 세기 ↑ = 조각 수 ↓(매끈) · smoothToError 0/50/100 = 0.5/4/7.5
 * F3 직선 · 두 점 · 빈 입력 · NaN 점 — 안 터지고 꼴이 맞다
 * F4 붓 taper = 닫힌 다각형(좌·우 점 수 같음) · 끝 폭 ≈ 0 · 가운데 폭 ≈ 10 · nib = 가로(0°)와 대각(135°) 폭이 다르다
 * 양성대조: _patches/freehand-CTL-no-fit.patch(fitCurve 가 첫·끝 점 직선 한 조각만) → F1 빨강
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
