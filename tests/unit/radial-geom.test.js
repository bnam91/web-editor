/* radial-geom — 방사형 배치 기하(js/radial-geom.js)와 샘플 그림 표(js/radial-samples.js) (프로토 Z6 · 1012t1Z6 · 2026-10-13)
 * 재는 자리 = 순수 함수 그대로(require). 기댓값 좌표는 S5 시안의 좌표표(원 6개 R250 · 5각 R240).
 *   U1 원 6개 좌표표          U2 5각 좌표표              U3 각도: 등분 · 시작 각도 · 시계 방향
 *   U4 clamp · clampCount     U5 연결선 4종의 d 꼴       U6 chord = 2R·sin(π/n)
 *   U7 바깥 라벨 자리·정렬    U8 험한 입력 → NaN·Infinity 0건
 *   S1 샘플 8종 · 표 밖 키 '' S2 SVG 는 외부 참조 0 · dataUri 왕복
 * 전제 단언: 좌표를 보기 전에 «점 수 = n»을 먼저 본다 — 빈 배열이 통과로 읽히지 않게. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../../js/radial-geom.js');
const S = require('../../js/radial-samples.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} 기대 ${b} ± ${tol} · 실제 ${a}`);
const xy = (pts) => pts.map(p => [p.x, p.y]);
const sameTable = (pts, want, tol) => {
  assert.equal(pts.length, want.length, '점 수');
  want.forEach(([x, y], i) => { near(pts[i].x, x, tol, `점 ${i} x`); near(pts[i].y, y, tol, `점 ${i} y`); });
};

test('U1 원 6개 · R250 · 중심 (430,360) — 12시에서 시계 방향', () => {
  const pts = G.points(6, 250, -90, 430, 360);
  sameTable(pts, [[430, 110], [646.5, 235], [646.5, 485], [430, 610], [213.5, 485], [213.5, 235]], 0.05);
  pts.forEach(p => near(Math.hypot(p.x - 430, p.y - 360), 250, 0.02, '반지름'));
});

test('U2 5각 · R240 · 중심 (430,350)', () => {
  sameTable(G.points(5, 240, -90, 430, 350), [[430, 110], [658.3, 275.8], [571.1, 544.2], [288.9, 544.2], [201.7, 275.8]], 0.06);
});

test('U3 각도 — 등분 · 시작 각도 기본 −90 · 0° 는 오른쪽 · 값이 늘면 시계 방향', () => {
  assert.deepEqual(G.angles(4, -90), [-90, 0, 90, 180]);
  assert.deepEqual(G.angles(3), [-90, 30, 150]);
  assert.deepEqual(G.angles(0, -90), []);
  assert.deepEqual(G.angles('x', -90), []);
  const p = G.points(4, 100, 0, 0, 0);
  assert.equal(p.length, 4);
  assert.deepEqual(xy(p), [[100, 0], [0, 100], [-100, 0], [0, -100]]);   // 오른쪽 → 아래 → 왼쪽 → 위 (y 아래로 자람)
  assert.deepEqual(p.map(q => q.deg), [0, 90, 180, 270]);
});

test('U4 clamp · clampCount', () => {
  assert.equal(G.clamp(5, 0, 10, 3), 5);
  assert.equal(G.clamp(-5, 0, 10, 3), 0);
  assert.equal(G.clamp(50, 0, 10, 3), 10);
  for (const bad of [NaN, 'abc', undefined, null, '', Infinity, {}]) assert.equal(G.clamp(bad, 0, 10, 3), 3, String(bad));
  assert.equal(G.clamp('7', 0, 10, 3), 7);
  assert.equal(G.clamp(undefined, 2, 10), 2);
  assert.deepEqual(G.LIMITS, { COUNT_MIN: 3, COUNT_MAX: 10, POLY_MIN: 3, POLY_MAX: 8, START_MIN: -180, START_MAX: 180 });
  assert.equal(G.clampCount('circle', 12), 10);
  assert.equal(G.clampCount('poly', 12), 8);
  assert.equal(G.clampCount('poly', 1), 3);
  assert.equal(G.clampCount('circle', 4.6), 5);
  assert.equal(G.clampCount('circle', 'x'), 6);
  assert.equal(G.clampCount('poly', undefined, 9), 8);
});

test('U5 연결선 — none · orbit(반원 둘) · outline(L n−1개 + Z) · spoke(M n개)', () => {
  const pts = G.points(5, 240, -90, 430, 350);
  assert.equal(pts.length, 5);
  const g = { cx: 430, cy: 350, r: 240, pts };
  assert.equal(G.connectorPath('none', g), '');
  assert.equal(G.connectorPath('whatever', g), '');
  assert.equal(G.connectorPath('orbit'), '');
  const orbit = G.connectorPath('orbit', g);
  assert.equal(orbit, 'M 430 110 A 240 240 0 1 1 430 590 A 240 240 0 1 1 430 110 Z');
  assert.equal(orbit, G.orbitPath(430, 350, 240));
  assert.equal(G.orbitPath(0, 0, 0), '');
  const outline = G.connectorPath('outline', g);
  assert.match(outline, /^M 430 110 L /);
  assert.equal((outline.match(/L /g) || []).length, 4);
  assert.ok(outline.endsWith(' Z'));
  assert.equal(G.polygonPath([]), '');
  assert.equal(G.polygonPath([{ x: 1, y: 2 }]), '');
  const spoke = G.connectorPath('spoke', g);
  assert.equal((spoke.match(/M 430 350 L /g) || []).length, 5);
  assert.ok(!spoke.includes('Z'));
  assert.equal(G.spokePath(0, 0, null), '');
});

test('U6 chord — 이웃 칸 중심 거리 = 2R·sin(π/n) = 실제 이웃 점 거리', () => {
  near(G.chord(6, 250), 250, 0.01, '6등분은 R');
  near(G.chord(4, 100), 141.42, 0.01, '4등분');
  for (const n of [3, 5, 8, 10]) {
    const p = G.points(n, 200, -90, 0, 0);
    assert.equal(p.length, n);
    near(Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y), G.chord(n, 200), 0.03, `n=${n}`);
  }
  assert.equal(G.chord(1, 100), 0);
  assert.equal(G.chord('x', 100), 0);
});

test('U7 바깥 라벨 자리 — 중심 반대쪽으로 dist · 붙이는 변', () => {
  const p = G.points(4, 100, -90, 0, 0);
  assert.equal(p.length, 4);
  assert.deepEqual(G.labelAnchor(p[0], 0, 0, 20), { x: 0, y: -120, align: 'center', v: 'bottom' });   // 위
  assert.deepEqual(G.labelAnchor(p[1], 0, 0, 20), { x: 120, y: 0, align: 'left', v: 'middle' });      // 오른쪽
  assert.deepEqual(G.labelAnchor(p[2], 0, 0, 20), { x: 0, y: 120, align: 'center', v: 'top' });       // 아래
  assert.deepEqual(G.labelAnchor(p[3], 0, 0, 20), { x: -120, y: 0, align: 'right', v: 'middle' });    // 왼쪽
  const d = G.labelAnchor({ x: 70.71, y: -70.71 }, 0, 0, 10);
  assert.equal(d.align, 'left'); assert.equal(d.v, 'bottom');
  assert.deepEqual(G.labelAnchor({ x: 5, y: 5 }, 5, 5, 10), { x: 5, y: -5, align: 'center', v: 'bottom' });   // 중심과 겹침 → 위로
});

test('U8 험한 입력 — 산출에 NaN·Infinity 0건 · 던지지 않는다', () => {
  const bads = [NaN, Infinity, -Infinity, 'abc', null, undefined, {}, [], -5];
  const BAD = /NaN|Infinity|undefined/;
  for (const b of bads) {
    const pts = G.points(4, b, b, b, b);
    assert.equal(pts.length, 4);
    for (const p of pts) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.deg), `points(${String(b)})`);
    assert.doesNotMatch(G.orbitPath(b, b, 100), BAD);
    assert.doesNotMatch(G.orbitPath(0, 0, b), BAD);
    assert.doesNotMatch(G.polygonPath([{ x: b, y: b }, { x: 1, y: b }, b]), BAD);
    assert.doesNotMatch(G.spokePath(b, b, [{ x: b, y: 2 }]), BAD);
    assert.doesNotMatch(G.connectorPath('outline', { pts: b }), BAD);
    const a = G.labelAnchor({ x: b, y: b }, b, b, b);
    assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y));
    assert.ok(Number.isFinite(G.chord(b, b)));
    assert.ok(Array.isArray(G.points(b, 100, 0, 0, 0)));
  }
});

test('S1 샘플 표 — 8종 · 이름 · 표 밖 키는 빈 글자', () => {
  assert.deepEqual([...S.KEYS], ['leaf', 'drop', 'molecule', 'pill', 'shield', 'moon', 'bottle', 'sun']);
  for (const k of S.KEYS) {
    assert.ok(S.has(k), k);
    assert.ok(S.LABELS[k] && S.LABELS[k] === S.label(k), `${k} 이름`);
    assert.match(S.color(k), /^#[0-9a-f]{6}$/);
  }
  for (const bad of ['', 'nope', 'constructor', '__proto__', 'toString', null, undefined, 3, {}]) {
    assert.equal(S.has(bad), false, String(bad));
    assert.equal(S.svg(bad), '');
    assert.equal(S.dataUri(bad), '');
    assert.equal(S.label(bad), '');
  }
});

test('S2 샘플 SVG — 인라인 · 외부 참조 0 · 키마다 다른 그림 · dataUri 왕복', () => {
  const seen = new Set();
  for (const k of S.KEYS) {
    const s = S.svg(k);
    assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64"/);
    assert.ok(s.endsWith('</svg>'));
    assert.ok(s.length < 1200, `${k} 는 작아야 한다(${s.length})`);
    assert.doesNotMatch(s.replace('xmlns="http://www.w3.org/2000/svg"', ''), /https?:|href|url\(|<image|<script|<use|<style|\bid=|\{c\}|on\w+=/i, `${k} 외부 참조·정의`);
    assert.ok(!seen.has(s), `${k} 중복 그림`); seen.add(s);
    const u = S.dataUri(k);
    assert.ok(u.startsWith('data:image/svg+xml;utf8,'));
    assert.equal(decodeURIComponent(u.slice('data:image/svg+xml;utf8,'.length)), s);
  }
});
