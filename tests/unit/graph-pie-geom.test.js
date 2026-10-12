/* graph-pie-geom — 원형·도넛 조각 기하(js/graph-pie-geom.js piePaths)의 가드와 식 (1012t1G1 · 2026-10-12)
 * 재는 자리 = 순수 함수 그대로(require). DOM 은 tests/dom/graph-pie-donut.dom.spec.js 가 «그려진» 채움으로 따로 잰다.
 *   U1 합 0·빈 배열 → d 전부 '' · empty        U2 항목 하나 → 온 원(반원 둘) · 도넛이면 안쪽 고리
 *   U3 음수·NaN·글자·null → 0 으로             U4 산출 문자열에 NaN·Infinity 0건(험한 입력 묶음)
 *   U5 각도 합 360 · 이어 붙음                  U6 large-arc: 180° 초과만 1
 *   U7 구멍: 0 이면 중심에서 시작 · >0 이면 고리  U8 한계 상수가 graph-limits 에 있다(패널·렌더가 같이 읽는 자리)
 * 전제 단언: 칸마다 «조각 수 = 입력 수»를 먼저 본다 — 빈 배열이 통과로 읽히지 않게. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { piePaths, CENTER, RADIUS } = require('../../js/graph-pie-geom.js');
const LIM = require('../../js/graph-limits.js');

const arcs = (d) => [...d.matchAll(/A ([\d.]+) ([\d.]+) 0 ([01]) ([01]) ([\d.]+) ([\d.]+)/g)].map(m => ({ r: +m[1], large: +m[3], sweep: +m[4], x: +m[5], y: +m[6] }));

test('U1 합 0 · 빈 배열 — d 전부 빈 글자 · empty', () => {
  const z = piePaths([0, 0, 0], 0);
  assert.equal(z.paths.length, 3, '전제: 조각 수 = 입력 수');
  assert.deepEqual(z.paths, ['', '', '']);
  assert.equal(z.empty, true);
  assert.deepEqual(z.shares, [0, 0, 0]);
  const e = piePaths([], 55);
  assert.deepEqual(e.paths, []);
  assert.equal(e.empty, true);
  assert.equal(piePaths(undefined, 0).empty, true, '배열이 아니어도 안 죽는다');
});

test('U2 항목 하나 — 온 원은 반원 둘(호 하나로는 안 그려진다) · 도넛이면 안쪽 고리가 반대 방향', () => {
  const p = piePaths([7], 0);
  assert.equal(p.paths.length, 1, '전제');
  const a = arcs(p.paths[0]);
  assert.equal(a.length, 2, '반원 둘');
  assert.deepEqual(a.map(x => x.sweep), [1, 1]);
  assert.deepEqual([a[0].x, a[0].y, a[1].x, a[1].y], [CENTER, CENTER + RADIUS, CENTER, CENTER - RADIUS]);
  const d = piePaths([7], 50);
  const b = arcs(d.paths[0]);
  assert.equal(b.length, 4, '바깥 반원 둘 + 안 반원 둘');
  assert.deepEqual(b.map(x => x.sweep), [1, 1, 0, 0], '안쪽은 반시계 — nonzero 채움에서 구멍');
  assert.deepEqual(b.map(x => x.r), [500, 500, 250, 250]);
  /* 한 항목만 양수인 여럿도 같은 길(0.9999 이상) */
  const q = piePaths([0, 3, 0], 0);
  assert.deepEqual(q.paths.map(s => s === ''), [true, false, true]);
  assert.equal(arcs(q.paths[1]).length, 2);
});

test('U3 음수 · NaN · 글자 · null — 0 으로 본다(조각 수는 그대로)', () => {
  const p = piePaths([-5, 10, NaN, 'abc', null, '30', Infinity], 0);
  assert.equal(p.paths.length, 7, '전제');
  assert.deepEqual(p.paths.map(s => s === ''), [true, false, true, true, true, false, true]);
  assert.equal(p.total, 40);
  assert.deepEqual(p.shares, [0, 0.25, 0, 0, 0, 0.75, 0]);
});

test('U4 산출 문자열에 NaN · Infinity · undefined 0건 — 험한 입력 묶음', () => {
  const inputs = [[], [0], [0, 0], [NaN], [Infinity, 1], [-1, -2], ['x', undefined, {}], [1e-12, 1], [1e308, 1e308], [1, 1, 2], [5]];
  const holes = [0, 20, 55, 80, NaN, -3, 999, '55', null, undefined, Infinity];
  let n = 0;
  for (const v of inputs) for (const h of holes) {
    const r = piePaths(v, h);
    assert.equal(r.paths.length, v.length);
    const s = r.paths.join('|') + '|' + JSON.stringify(r.angles) + '|' + JSON.stringify(r.shares);
    assert.doesNotMatch(s, /NaN|Infinity|undefined|null/, `${JSON.stringify(v)} · 구멍 ${String(h)}`);
    n++;
  }
  assert.equal(n, inputs.length * holes.length, '전제: 묶음을 다 돌았다');
});

test('U5 각도 — 합 360 · 앞 조각의 끝 = 뒤 조각의 시작 · 12시에서 시작', () => {
  const p = piePaths([1, 1, 2, 0, 4], 0);
  assert.equal(p.angles.length, 5, '전제');
  assert.equal(p.angles[0][0], 0);
  for (let i = 1; i < p.angles.length; i++) assert.equal(p.angles[i][0], p.angles[i - 1][1], `조각 ${i} 가 앞 조각에 이어 붙는다`);
  assert.ok(Math.abs(p.angles.at(-1)[1] - 360) < 1e-9, '끝 = 360');
  assert.ok(Math.abs(p.angles.reduce((a, [s, e]) => a + (e - s), 0) - 360) < 1e-9);
  assert.deepEqual(p.angles.slice(0, 3), [[0, 45], [45, 90], [90, 180]]);
  /* 첫 조각은 (500,0) 에서 떠나 시계 방향 — 45° 끝점은 오른쪽 위 */
  assert.match(p.paths[0], /^M 500\.00 500\.00 L 500\.00 0\.00 A 500\.00 500\.00 0 0 1 853\.55 146\.45 Z$/);
});

test('U6 large-arc — 180° 초과만 1 (정확히 180° 는 0)', () => {
  const p = piePaths([3, 1], 0);   // 270° · 90°
  assert.equal(p.paths.length, 2, '전제');
  assert.deepEqual(arcs(p.paths[0]).map(a => a.large), [1]);
  assert.deepEqual(arcs(p.paths[1]).map(a => a.large), [0]);
  const h = piePaths([1, 1], 0);   // 180° · 180°
  assert.deepEqual(h.paths.map(d => arcs(d)[0].large), [0, 0]);
  const dn = piePaths([3, 1], 40);   // 도넛: 바깥·안 호가 같은 large 를 쓴다
  assert.deepEqual(arcs(dn.paths[0]).map(a => [a.large, a.sweep, a.r]), [[1, 1, 500], [1, 0, 200]]);
});

test('U7 구멍 — 0 이면 중심에서 시작(꽉 참) · 양수면 중심을 안 지난다 · 95 에서 잘린다', () => {
  const pie = piePaths([1, 1, 2], 0), dn = piePaths([1, 1, 2], 55);
  assert.equal(pie.paths.length, 3, '전제'); assert.equal(dn.paths.length, 3, '전제');
  for (const d of pie.paths) assert.match(d, /^M 500\.00 500\.00 L /);
  for (const d of dn.paths) { assert.doesNotMatch(d, /M 500\.00 500\.00/); assert.equal(arcs(d).length, 2); assert.equal(arcs(d)[1].r, 275); }
  assert.equal(dn.hole, 55);
  assert.equal(piePaths([1], 999).hole, 95);
  assert.equal(piePaths([1], -10).hole, 0);
  assert.equal(piePaths([1], 'x').hole, 0);
});

test('U8 구멍 한계 — graph-limits 한 자리(패널·렌더가 같이 읽는다)', () => {
  assert.equal(LIM.PIE_HOLE_MIN, 20);
  assert.equal(LIM.PIE_HOLE_MAX, 80);
  assert.equal(LIM.PIE_HOLE_DEFAULT, 55);
  assert.ok(LIM.PIE_HOLE_MIN < LIM.PIE_HOLE_DEFAULT && LIM.PIE_HOLE_DEFAULT < LIM.PIE_HOLE_MAX);
});
