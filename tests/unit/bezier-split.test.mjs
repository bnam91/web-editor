/* bezier-split.test.mjs — 133 펜 편집 선분 눌러 점 더하기(js/fx/bezier-split.js 순수)
 * S1 곡선 선분 t=0.3 나눔 → 두 조각의 점들이 옛 곡선 위(모양 무변 · 1e-9) · 새 노드 smooth · 이웃 핸들 갱신 · 원본 무변
 * S2 직선(핸들 둘 다 없음) → 핸들 없는 corner 하나 · 선 위
 * S3 닫는 선분(마지막 → 0) · 열린 패스 끝 선분 없음 → null · nearestT 가 화면 점에 가장 가까운 t
 * 양성대조: _patches/pen-addpt-CTL-midpoint-only.patch(곡선도 핸들 없이 꼭짓점만) → S1 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSegment, segmentPoints, bezierAt, nearestT } from '../../js/fx/bezier-split.js';

const near = (a, b, e = 1e-9) => Math.abs(a.x - b.x) <= e && Math.abs(a.y - b.y) <= e;
const curve = [{ x: 0, y: 0, type: 'corner', hIn: null, hOut: { x: 30, y: -40 } }, { x: 100, y: 0, type: 'corner', hIn: { x: 70, y: 40 }, hOut: null }];

test('S1 곡선 나눔 = 모양 무변', () => {
  const before = JSON.stringify(curve);
  const r = splitSegment(curve, 0, 0.3);
  assert.equal(JSON.stringify(curve), before, '원본 무변');
  assert.equal(r.index, 1); assert.equal(r.nodes.length, 3);
  const old = segmentPoints(curve, 0), a = segmentPoints(r.nodes, 0), b = segmentPoints(r.nodes, 1);
  for (let k = 0; k <= 20; k++) {
    const u = k / 20;
    assert.ok(near(bezierAt(a, u), bezierAt(old, 0.3 * u)), `앞 조각 u=${u}`);
    assert.ok(near(bezierAt(b, u), bezierAt(old, 0.3 + 0.7 * u)), `뒤 조각 u=${u}`);
  }
  assert.equal(r.nodes[1].type, 'smooth');
  assert.ok(r.nodes[1].hIn && r.nodes[1].hOut);
});

test('S2 직선 = 핸들 없는 꼭짓점', () => {
  const line = [{ x: 0, y: 0, type: 'corner', hIn: null, hOut: null }, { x: 10, y: 20, type: 'corner', hIn: null, hOut: null }];
  const r = splitSegment(line, 0, 0.5);
  assert.deepEqual(r.nodes[1], { x: 5, y: 10, type: 'corner', hIn: null, hOut: null });
  assert.equal(r.nodes[0].hOut, null); assert.equal(r.nodes[2].hIn, null);
});

test('S3 닫는 선분 · 없는 선분 · nearestT', () => {
  const tri = [{ x: 0, y: 0, hIn: null, hOut: null }, { x: 10, y: 0, hIn: null, hOut: null }, { x: 0, y: 10, hIn: null, hOut: null }];
  const r = splitSegment(tri, 2, 0.5, true);
  assert.equal(r.index, 3); assert.deepEqual([r.nodes[3].x, r.nodes[3].y], [0, 5]);
  assert.equal(splitSegment(tri, 2, 0.5, false), null, '열린 패스 끝 = 선분 없음');
  const seg = segmentPoints(curve, 0), id = (p) => p;
  const target = bezierAt(seg, 0.62);
  const { t, dist } = nearestT(seg, id, target.x, target.y);
  assert.ok(Math.abs(t - 0.62) < 0.01 && dist < 0.5, `t ${t} dist ${dist}`);
});
