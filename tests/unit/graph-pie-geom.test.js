/* graph-pie-geom — 원형·도넛 조각 기하(js/graph-pie-geom.js piePaths)의 가드와 식 (1012t1G1 · 2026-10-12)
 * 재는 자리 = 순수 함수 그대로(require). DOM 은 tests/dom/graph-pie-donut.dom.spec.js 가 «그려진» 채움으로 따로 잰다.
 *   U1 합 0·빈 배열 → d 전부 '' · empty        U2 항목 하나 → 온 원(반원 둘) · 도넛이면 안쪽 고리
 *   U3 음수·NaN·글자·null → 0 으로             U4 산출 문자열에 NaN·Infinity 0건(험한 입력 묶음)
 *   U5 각도 합 360 · 이어 붙음                  U6 large-arc: 180° 초과만 1
 *   U7 구멍: 0 이면 중심에서 시작 · >0 이면 고리  U8 한계 상수가 graph-limits 에 있다(패널·렌더가 같이 읽는 자리)
 *   U9 틈: 변을 평행하게 민다(폭 일정) · 값 있는 조각 하나면 0 · 실조각이 안 사라진다   U10 비율 %: 최대 잔여법 — 합 100
 * 전제 단언: 칸마다 «조각 수 = 입력 수»를 먼저 본다 — 빈 배열이 통과로 읽히지 않게. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { piePaths, piePercents, CENTER, RADIUS } = require('../../js/graph-pie-geom.js');
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
  /* 넘침 가드 — 유한한 값 둘의 합이 Infinity 여도 «빈 그림»이 아니라 반반 두 조각(가드가 빠지면 share 가 0 이 돼 d 가 비고, 그래도 위 정규식은 지난다) */
  const big = piePaths([1e308, 1e308], 0);
  assert.equal(big.paths.length, 2, '전제');
  assert.equal(big.empty, false);
  assert.deepEqual(big.shares, [0.5, 0.5]);
  assert.deepEqual(big.paths, piePaths([1, 1], 0).paths);
  assert.ok(big.paths.every(d => d.length > 0), '두 조각 다 그려진다');
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

const nums = (d) => (d.match(/-?\d+\.\d\d/g) || []).map(Number);
test('U9 틈 — 변을 평행하게 민다(폭이 안팎에서 같다) · 값 있는 조각 하나면 0 · 틈보다 좁은 조각도 남는다', () => {
  const V = [30, 20, 15, 15, 10, 10], GAP = LIM.PIE_GAP;
  assert.equal(GAP, 10, '틈 상수는 graph-limits 한 자리');
  const p0 = piePaths(V, 0), p = piePaths(V, 0, GAP), dn = piePaths(V, 55, GAP);
  assert.equal(p.paths.length, 6, '전제'); assert.equal(dn.paths.length, 6, '전제');
  assert.deepEqual(piePaths(V, 0, 0), p0, '틈 0 = 옛 산출 그대로');
  assert.deepEqual(p.angles, p0.angles, '경계각·점유율은 틈과 무관'); assert.deepEqual(p.shares, p0.shares);
  assert.equal(p.gap, GAP); assert.equal(p0.gap, 0);
  for (const d of p.paths) assert.doesNotMatch(d, /^M 500\.00 500\.00/, '어느 조각도 중심에서 떠나지 않는다');
  /* 12시 경계(첫 조각의 시작 · 끝 조각의 끝): 변이 x = 500 ± 틈/2 인 «세로선» — 바깥 끝도 안쪽 끝도 같은 x ⇒ 폭 일정 */
  assert.match(p.paths[0], /^M 505\.00 [\d.]+ L 505\.00 0\.03 A /);
  assert.match(p.paths[5], / 495\.00 0\.03 Z$/); assert.match(p.paths[5], /^M 495\.00 /);
  assert.match(dn.paths[0], /^M 505\.00 0\.03 A .* 505\.00 225\.05 Z$/);
  assert.match(dn.paths[5], / 495\.00 0\.03 L 495\.00 225\.05 A /);
  /* 값 있는 조각이 하나뿐이면 틈 없음 — 온 원 그대로 */
  assert.deepEqual(piePaths([7], 0, GAP), piePaths([7], 0));
  assert.deepEqual(piePaths([0, 3, 0], 55, GAP), piePaths([0, 3, 0], 55));
  /* 틈보다 좁은 조각(0.36°) — 바깥 호가 남는다(양 끝점이 다르다) · 큰 쪽(오목)은 중심 둘레를 작은 호로 돈다 */
  for (const hole of [0, 55]) {
    const t = piePaths([999, 1], hole, GAP);
    assert.equal(t.paths.length, 2, '전제');
    const a = arcs(t.paths[1])[0], m = nums(t.paths[1]);
    assert.ok(t.paths[1].length > 0 && a, '좁은 조각이 그려진다');
    const start = hole ? [m[0], m[1]] : [m[2], m[3]];
    assert.ok(Math.hypot(a.x - start[0], a.y - start[1]) > 1, `좁은 조각의 바깥 호 길이 > 1 (구멍 ${hole})`);
    assert.deepEqual(arcs(t.paths[0])[0].large, 1);
  }
  assert.match(piePaths([3, 1], 0, GAP).paths[0], / A 5\.00 5\.00 0 0 0 505\.00 500\.00 Z$/, '오목 조각: 중심 둘레 반지름 = 틈/2');
  /* 험한 입력 × 험한 틈 — NaN 0건 · 조각 수 유지 */
  for (const v of [[], [0, 0], [NaN, 1], [1e-12, 1], [1e308, 1e308], [1, 1, 2], [1, 1e9]]) for (const h of [0, 1, 55, 95]) for (const g of [GAP, NaN, -1, 1e9, '10', null, Infinity]) {
    const r = piePaths(v, h, g);
    assert.equal(r.paths.length, v.length);
    assert.doesNotMatch(r.paths.join('|') + '|' + r.gap, /NaN|Infinity|undefined|null/, `${JSON.stringify(v)} · 구멍 ${h} · 틈 ${String(g)}`);
  }
});

test('U10 비율 % — 최대 잔여법: 합이 정확히 100 · 동률은 앞 항목 우선 · 합 0 이면 전부 0', () => {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  assert.deepEqual(piePercents([1, 1, 1]), [34, 33, 33]);
  const six = piePercents([1, 1, 1, 1, 1, 1]);
  assert.equal(six.length, 6, '전제');
  assert.deepEqual(six, [17, 17, 17, 17, 16, 16]);
  assert.equal(sum(six), 100);
  assert.deepEqual(piePercents([1, 1, 2]), [25, 25, 50]);
  assert.deepEqual(piePercents([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(piePercents([]), []);
  assert.deepEqual(piePercents(undefined), []);
  assert.deepEqual(piePercents([-5, 10, 'x', null]), [0, 100, 0, 0], '값 가드는 piePaths 와 같다');
  assert.deepEqual(piePercents([9999, 1]), [100, 0], '0% 로 찍히는 작은 조각을 따로 올려 주지 않는다(합 100 만 지킨다)');
  assert.deepEqual(piePercents([1e308, 1e308]), [50, 50]);
  assert.deepEqual(piePercents([30, 20, 15, 15, 10, 10]), [30, 20, 15, 15, 10, 10]);
  assert.deepEqual(piePercents([3, 7]), [30, 70]);
  let n = 0;
  for (const v of [[1, 2, 3, 4, 5, 6, 7], [0.1, 0.2, 0.3], [1, 1, 1, 1, 1, 1, 1], [5, 0, 5, 0, 3], [1e-12, 1], [12.5, 37.5, 50], Array.from({ length: 23 }, (_, i) => i + 1)]) {
    const p = piePercents(v);
    assert.equal(p.length, v.length);
    assert.ok(p.every(x => Number.isInteger(x) && x >= 0), JSON.stringify(v));
    assert.equal(sum(p), 100, JSON.stringify(v));
    n++;
  }
  assert.equal(n, 7, '전제: 묶음을 다 돌았다');
});

/* ── 1013t1C 원형·도너츠 7건 ──────────────────────────────────────────────
 *   U11 골든 핀: 새 인자(opts)를 «안 준» 산출이 1012 판과 바이트가 같다(옛 저장본을 만져도 같은 그림) — 1013t1C0 에서 «고치기 전 판» 위에 박았다. */
const sha = (s) => require('node:crypto').createHash('sha256').update(s).digest('hex');
const GOLD = [
  [[[30, 20, 15, 15, 10, 10], 0, 10], 'a5d84213c783230e084155b4a8d8332c97a0c2c244d0cfd3557f4749090f6bed'],
  [[[30, 20, 15, 15, 10, 10], 55, 10], '7b99c098f908616f49f0c0f70fab4732657387e5990cb91d5ae3262aa2079568'],
  [[[1, 1, 2], 0, 10], '2cf12b345950f4954aac01e3722e242e2f36e7433c5d8fd0908da0d8331d8b3a'],
  [[[1, 1, 2], 55, 10], '9cead1c0f1bb19d1d3a76e4ebf3b6444f2e5289ae690989fee3db02c4c17efb4'],
  [[[5], 55, 10], '277be82afdbc8a9330dd9208bc77b2ad42d972f8b3c287cb864d2ab500c07370'],
  [[[], 0, 10], '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  [[[-5, 10, NaN, 'abc', null, '30', Infinity, 999, 1], 20, 10], '5a69e1bc3b53e7d17c7cc6a70ea2c0ba49ddeada1828e330d5a31a64b60f2e22'],
  [[[30, 20, 15, 15, 10, 10], 0], '68405be88f6242d4ee4c24630560d04dde287356c61d49710a0ebe618498108d'],
];
test('U11 골든 핀 — 새 인자를 안 주면 조각 path 가 1012 판과 바이트가 같다(여덟 표본)', () => {
  let n = 0;
  for (const [args, want] of GOLD) {
    const r = piePaths(...args);
    assert.equal(r.paths.length, args[0].length, '전제: 조각 수 = 입력 수');
    assert.equal(sha(JSON.stringify(r.paths)), want, `표본 ${n} ${JSON.stringify(args)}`);
    n++;
  }
  assert.equal(n, 8, '전제: 표본을 다 돌았다');
  assert.equal(piePaths([1, 1, 2], 0, 10).paths[0], 'M 505.00 495.00 L 505.00 0.03 A 500.00 500.00 0 0 1 999.97 495.00 Z', '해시가 재는 글자의 꼴(눈으로 읽는 한 줄)');
});

test('U12 조각 간격 한계 — graph-limits 한 자리 · 틈 0 이면 조각이 중심에서 맞닿고 · 위 끝(40)에서도 조각이 남는다', () => {
  assert.equal(LIM.PIE_GAP, 10, '기본 틈은 그대로(옛 저장본)');
  assert.equal(LIM.PIE_GAP_MIN, 0);
  assert.equal(LIM.PIE_GAP_MAX, 40);
  assert.ok(LIM.PIE_GAP_MIN <= LIM.PIE_GAP && LIM.PIE_GAP <= LIM.PIE_GAP_MAX, '기본값이 한계 안');
  const V = [30, 20, 15, 15, 10, 10];
  const g0 = piePaths(V, 0, LIM.PIE_GAP_MIN), gd = piePaths(V, 0, LIM.PIE_GAP), gx = piePaths(V, 0, LIM.PIE_GAP_MAX);
  assert.equal(g0.paths.length, 6, '전제'); assert.equal(gx.paths.length, 6, '전제');
  assert.equal(g0.gap, 0); assert.equal(gd.gap, 10); assert.equal(gx.gap, 40);
  for (const d of g0.paths) assert.match(d, /^M 500\.00 500\.00 L /, '틈 0: 모든 조각이 중심에서 떠난다(맞닿는다)');
  assert.match(g0.paths[0], /^M 500\.00 500\.00 L 500\.00 0\.00 A /, '틈 0: 첫 변은 x = 500 세로선');
  assert.match(gd.paths[0], /^M 505\.00 [\d.]+ L 505\.00 0\.03 A /, '기본 10: 첫 변이 5 만큼 밀린다');
  assert.match(gx.paths[0], /^M 520\.00 [\d.]+ L 520\.00 0\.40 A /, '40: 첫 변이 20 만큼 밀린다');
  assert.ok(gx.paths.every(d => d.length > 0 && arcs(d).length >= 1), '40 에서도 여섯 조각이 다 그려진다');
  assert.deepEqual(gx.angles, g0.angles, '경계각은 틈과 무관');
});

test('U13 시작 각도 — start 90 이면 첫 조각이 3시에서 떠난다 · 0/미지정은 옛 산출 그대로 · 360 으로 접는다 · 험한 값은 0', () => {
  const V = [1, 1, 2];
  const p0 = piePaths(V, 0, 0), p90 = piePaths(V, 0, 0, { start: 90 });
  assert.equal(p90.paths.length, 3, '전제');
  assert.equal(p0.start, 0); assert.equal(p90.start, 90);
  assert.deepEqual(piePaths(V, 0, 0, { start: 0 }), p0, 'start 0 = 미지정');
  assert.deepEqual(piePaths(V, 0, 0, {}), p0); assert.deepEqual(piePaths(V, 0, 0, null), p0);
  assert.deepEqual(piePaths(V, 55, 10, { start: 0 }).paths, piePaths(V, 55, 10).paths, '도넛·틈에서도 start 0 은 바이트가 같다');
  assert.equal(p90.angles[0][0], 90, '첫 조각의 시작각');
  assert.deepEqual(p90.angles, [[90, 180], [180, 270], [270, 450]]);
  assert.deepEqual(p90.shares, p0.shares, '점유율은 시작 각도와 무관');
  assert.match(p90.paths[0], /^M 500\.00 500\.00 L 1000\.00 500\.00 A 500\.00 500\.00 0 0 1 500\.00 1000\.00 Z$/, '첫 점 = 3시(1000,500) · 시계 방향으로 90° 돌아 6시');
  assert.notDeepEqual(p90.paths, p0.paths, '전제: 90 은 다른 그림');
  assert.deepEqual(piePaths(V, 0, 0, { start: 450 }).paths, p90.paths, '450 ≡ 90');
  assert.deepEqual(piePaths(V, 0, 0, { start: -270 }).paths, p90.paths, '−270 ≡ 90');
  assert.deepEqual(piePaths(V, 0, 0, { start: '90' }).paths, p90.paths, '글자 수도 받는다');
  for (const bad of [NaN, Infinity, 'x', null, undefined, {}]) assert.deepEqual(piePaths(V, 0, 0, { start: bad }).paths, p0.paths, `험한 start ${String(bad)} = 0`);
  /* 틈·도넛에서도 통째로 돈다 — 조각마다 호의 수·반지름이 같다 */
  const d0 = piePaths(V, 55, 10), d90 = piePaths(V, 55, 10, { start: 90 });
  assert.deepEqual(d90.paths.map(d => arcs(d).map(a => [a.r, a.large, a.sweep])), d0.paths.map(d => arcs(d).map(a => [a.r, a.large, a.sweep])));
  assert.match(d90.paths[0], /^M 999\.97 505\.00 A /, '도넛·틈 10: 첫 변이 3시 방향 가로선(y = 505)');
  /* 온 원(항목 하나)은 시작 각도와 무관 */
  assert.deepEqual(piePaths([7], 0, 10, { start: 90 }).paths, piePaths([7], 0, 10).paths);
  assert.doesNotMatch(piePaths([1e308, 1e308, 0, 'x'], 55, 10, { start: 123 }).paths.join('|'), /NaN|Infinity|undefined/);
});

test('U14 조각 크기 — grow 20 이면 그 조각의 바깥 반지름만 600 · 다른 조각 d 무변 · extent 100 · grow 0 은 옛 산출 그대로', () => {
  const V = [30, 20, 15, 15, 10, 10];
  assert.equal(LIM.PIE_GROW_MAX, 30, '위 끝은 graph-limits 한 자리');
  for (const [hole, gap] of [[0, 10], [55, 10], [0, 0], [55, 0]]) {
    const b = piePaths(V, hole, gap), g = piePaths(V, hole, gap, { grow: [20] });
    assert.equal(g.paths.length, 6, '전제');
    assert.deepEqual(piePaths(V, hole, gap, { grow: [0, 0, 0, 0, 0, 0] }), b, `grow 0 = 미지정 (구멍 ${hole} · 틈 ${gap})`);
    assert.deepEqual(piePaths(V, hole, gap, { grow: [] }), b);
    assert.deepEqual(g.outer, [600, 500, 500, 500, 500, 500], '바깥 반지름은 그 조각만');
    assert.equal(g.extent, 100, 'viewBox 밖으로 나간 길이');
    assert.equal(b.extent, 0); assert.deepEqual(b.outer, [500, 500, 500, 500, 500, 500]);
    assert.notEqual(g.paths[0], b.paths[0], '전제: 키운 조각의 d 는 다르다');
    assert.deepEqual(g.paths.slice(1), b.paths.slice(1), '다른 조각의 d 는 한 글자도 안 변한다');
    assert.deepEqual(g.angles, b.angles, '경계각은 크기와 무관'); assert.deepEqual(g.shares, b.shares);
    const a = arcs(g.paths[0].replace(/-/g, ''));   // 바깥 호 반지름 600 · 구멍 호는 그대로(부호는 반지름과 무관)
    assert.equal(a[0].r, 600);
    if (hole) assert.equal(a[1].r, 275, '구멍 반지름은 모든 조각이 같다');
  }
  assert.deepEqual(piePaths(V, 0, 10).mids, [54, 144, 207, 261, 306, 342], '이등분각(도)');
  assert.deepEqual(piePaths(V, 0, 10, { start: 90 }).mids[0], 144, '이등분각은 시작 각도를 따라 돈다');
  assert.match(piePaths(V, 0, 10, { grow: [20] }).paths[0], /^M 505\.00 [\d.]+ L 505\.00 -99\.98 A 600\.00 600\.00 0 0 1 /, '12시 변은 같은 세로선(x = 505) 위에서 600 까지');
  /* 여럿을 키우면 extent = 가장 큰 것 · 값 0 조각의 grow 는 안 센다 · 온 원도 커진다 */
  assert.equal(piePaths(V, 0, 10, { grow: [10, 0, 30] }).extent, 150);
  const z = piePaths([0, 3, 1], 0, 10, { grow: [30, 0, 0] });
  assert.equal(z.extent, 0, '값 0 조각은 안 키운다'); assert.deepEqual(z.outer, [500, 500, 500]); assert.equal(z.paths[0], '');
  const one = piePaths([7], 50, 10, { grow: [20] });
  assert.equal(one.extent, 100);
  assert.deepEqual(arcs(one.paths[0].replace(/-/g, '')).map(x => x.r), [600, 600, 250, 250], '온 원: 바깥만 커지고 구멍은 그대로');
  assert.equal(piePaths([0, 0], 0, 10, { grow: [20, 20] }).extent, 0, '합 0 이면 0');
  /* 험한 grow — 0 으로(음수·글자·NaN) · 100 에서 잘린다 · 문자열에 NaN 0건 */
  const base = piePaths(V, 0, 10);
  for (const bad of [[-5], ['x'], [NaN], [null], [Infinity], 'nope', null, 7]) assert.deepEqual(piePaths(V, 0, 10, { grow: bad }).paths, base.paths, `험한 grow ${JSON.stringify(bad)}`);
  assert.equal(piePaths(V, 0, 10, { grow: [999] }).outer[0], 1000);
  assert.equal(piePaths(V, 0, 10, { grow: ['20'] }).outer[0], 600, '글자 수도 받는다');
  assert.doesNotMatch(piePaths([1e308, 1e308, 1], 55, 40, { start: 77, grow: [30, 'x', 30] }).paths.join('|'), /NaN|Infinity|undefined/);
  /* 점유율은 양수인데 각 폭이 0 으로 접힌 조각(값 비 1e17 : 1) — 틈이 있으면 꼭짓점 식이 0/0 이 됐다(1012 판도 'M NaN NaN'). 그릴 폭이 없으니 d 는 빈 글자 */
  for (const [v, k] of [[[1e17, 1], 1], [[1e308, 1e308, 1], 2]]) for (const hole of [0, 55]) {
    const t = piePaths(v, hole, 10);
    assert.equal(t.paths.length, v.length, '전제');
    assert.ok(t.shares[k] > 0 && t.angles[k][1] === t.angles[k][0], `전제: 조각 ${k} 는 점유율 양수 · 각 폭 0 (${JSON.stringify(v)})`);
    assert.equal(t.paths[k], '', '폭 0 조각은 안 그린다');
    assert.doesNotMatch(t.paths.join('|'), /NaN|Infinity|undefined/);
    assert.ok(t.paths.slice(0, k).every(d => d.length > 0), '나머지 조각은 그대로 그려진다');
  }
});

test('U15 밀어내기 — pull 10 이면 offsets = 50 × (sin mid, −cos mid) · d 는 한 글자도 안 변한다 · extent 는 민 만큼 · 온 원·값 0 은 안 민다', () => {
  const V = [1, 1, 2];
  assert.equal(LIM.PIE_PULL_MAX, 30, '위 끝은 graph-limits 한 자리');
  for (const [hole, gap] of [[0, 10], [55, 10], [0, 0]]) {
    const b = piePaths(V, hole, gap), g = piePaths(V, hole, gap, { pull: [10] });
    assert.equal(g.paths.length, 3, '전제');
    assert.deepEqual(b.offsets, [['0.00', '0.00'], ['0.00', '0.00'], ['0.00', '0.00']], '전제: 안 밀면 전부 0');
    assert.deepEqual(g.paths, b.paths, `d 는 그대로 — 옮길 양만 따로 (구멍 ${hole} · 틈 ${gap})`);
    assert.equal(g.mids[0], 45, '전제: 조각0 의 이등분각');
    const want = [(50 * Math.sin(Math.PI / 4)).toFixed(2), (-50 * Math.cos(Math.PI / 4)).toFixed(2)];
    assert.deepEqual(g.offsets, [want, ['0.00', '0.00'], ['0.00', '0.00']], '그 조각만 · R × 10 % = 50 을 이등분각 방향으로');
    assert.deepEqual(want, ['35.36', '-35.36'], '눈으로 읽는 한 줄(1시 반 방향 = 오른쪽 위)');
    assert.equal(g.extent, 50, 'viewBox 밖으로 나간 길이 = 민 길이');
    assert.deepEqual(g.outer, b.outer, '바깥 반지름은 밀어내기와 무관');
    assert.deepEqual(piePaths(V, hole, gap, { pull: [0, 0, 0] }), b, 'pull 0 = 미지정');
    assert.deepEqual(piePaths(V, hole, gap, { pull: [] }), b);
  }
  /* 방향은 시작 각도를 따라 돈다 · 12시/6시 방향은 x 가 '0.00'(−0.00 이 아니다) */
  assert.deepEqual(piePaths([1, 1], 0, 10, { pull: [10, 10] }).offsets, [['50.00', '0.00'], ['-50.00', '0.00']]);
  assert.deepEqual(piePaths([1, 1], 0, 10, { pull: [10, 10], start: 90 }).offsets, [['0.00', '50.00'], ['0.00', '-50.00']]);
  assert.doesNotMatch(JSON.stringify(piePaths([1, 1], 0, 10, { pull: [10, 10], start: 270 }).offsets), /-0\.00/);
  /* 크기와 같이 주면 extent 는 더해진다(그 조각의 Ro + 민 길이) · 여럿이면 가장 먼 것 */
  assert.equal(piePaths(V, 0, 10, { grow: [20], pull: [10] }).extent, 150);
  assert.equal(piePaths(V, 0, 10, { grow: [20], pull: [0, 30] }).extent, 150, 'max(600, 500 + 150) − 500');
  /* 안 미는 것들 — 온 원(방향이 없다) · 값 0 · 합 0 */
  const one = piePaths([7], 0, 10, { pull: [30] });
  assert.deepEqual(one.offsets, [['0.00', '0.00']]); assert.equal(one.extent, 0);
  const z = piePaths([0, 3, 1], 0, 10, { pull: [30, 0, 0] });
  assert.deepEqual(z.offsets[0], ['0.00', '0.00']); assert.equal(z.extent, 0);
  assert.equal(piePaths([0, 0], 0, 10, { pull: [30, 30] }).extent, 0);
  /* 험한 pull — 0 으로(음수·글자·NaN·Infinity) · 100 에서 잘린다 · 글자 수도 받는다 · NaN 0건 */
  const none = piePaths(V, 0, 10).offsets;
  for (const bad of [[-5], ['x'], [NaN], [null], [Infinity], 'nope', null, 7]) assert.deepEqual(piePaths(V, 0, 10, { pull: bad }).offsets, none, `험한 pull ${JSON.stringify(bad)}`);
  assert.equal(piePaths(V, 0, 10, { pull: [999] }).extent, 500);
  assert.deepEqual(piePaths(V, 0, 10, { pull: ['10'] }).offsets[0], ['35.36', '-35.36']);
  const wild = piePaths([1e308, 1e308, 1, 1e17], 55, 40, { start: 77, grow: [30, 'x', 30], pull: [30, 30, 30, 30] });
  assert.equal(wild.offsets.length, 4, '전제');
  assert.doesNotMatch(JSON.stringify(wild.offsets) + wild.paths.join('|'), /NaN|Infinity|undefined/);
  assert.deepEqual(wild.offsets[2], ['0.00', '0.00'], '각 폭이 0 으로 접힌 조각은 안 민다');
});
