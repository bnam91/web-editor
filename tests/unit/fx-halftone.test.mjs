/* fx-halftone — IMG-FX-HALFTONE-01(현빈 261121) 하프톤 셈(js/fx/halftone.js · 순수).
 * T1 소독 — 숫자 범위·정수 · 모양 허용 목록 · 색 'image'/#rrggbb · 바탕 'none'/'white'/#rrggbb · 깨진 JSON = null
 * T2 크기 = 밝기 — 검정 판은 점 반지름 = size/2 · 흰 판은 점 0 · 회색은 그 사이(넓이 비례 √)
 * T3 간격 — 같은 판에서 간격을 반으로 줄이면 점 수 ≈ 4배
 * T4 각도 — 0° 면 이웃 점이 같은 y(가로 줄) · 45° 면 이웃 점 방향이 45°
 * T5 판 덮기 — 네 모서리 근처에 점이 있다(돌린 격자가 가장자리를 비우지 않는다)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const H = await import(pathToFileURL(path.join(ROOT, 'js/fx/halftone.js')).href);   // js/fx = "type":"module"

test('T1 소독', () => {
  assert.deepEqual(H.normHalftone({}), { ...H.HT_DEFAULTS });
  const o = H.normHalftone({ size: 999, gap: -4, angle: 45.6, shape: 'star', color: '#AABBCC', bg: 'none' });
  assert.deepEqual(o, { size: 40, gap: 3, angle: 46, shape: 'circle', color: '#aabbcc', bg: 'none' });
  assert.equal(H.normHalftone({ color: 'red', bg: 'javascript:x' }).color, 'image');
  assert.equal(H.normHalftone({ bg: 'javascript:x' }).bg, 'white');
  assert.equal(H.normHalftone({ bg: '#00FF00' }).bg, '#00ff00');
  assert.equal(H.parseHalftone('{bad'), null);
  assert.equal(H.parseHalftone(''), null);
  assert.deepEqual(H.parseHalftone(H.serializeHalftone({ size: 12 })).size, 12);
});

test('T2 크기 = 밝기', () => {
  const o = { size: 10, gap: 10, angle: 0 };
  const black = H.halftoneDots(() => 0, 100, 100, o), white = H.halftoneDots(() => 1, 100, 100, o), gray = H.halftoneDots(() => 0.75, 100, 100, o);
  assert.ok(black.length > 50 && black.every((d) => Math.abs(d.r - 5) < 1e-9), '검정 = r 5');
  assert.equal(white.length, 0, '흰 판 = 점 0');
  assert.ok(gray.every((d) => Math.abs(d.r - 5 * Math.sqrt(0.25)) < 1e-9), '회색 0.75 = r 2.5');
  assert.equal(H.lumOf(0, 0, 0, 0), 1, '투명 = 흰 종이');
  assert.ok(Math.abs(H.lumOf(255, 255, 255) - 1) < 1e-12, '흰 = 1(부동소수)');
  assert.equal(H.lumOf(0, 0, 0), 0);
});

test('T3 간격 반 → 점 약 4배', () => {
  const a = H.halftoneDots(() => 0, 200, 200, { gap: 20, angle: 0 }).length, b = H.halftoneDots(() => 0, 200, 200, { gap: 10, angle: 0 }).length;
  assert.ok(b / a > 3.3 && b / a < 4.7, `비 ${b / a}`);
});

test('T4 각도', () => {
  const d0 = H.halftoneDots(() => 0, 100, 100, { gap: 10, angle: 0 });
  const p = d0[0], q = d0.find((d) => Math.abs(d.y - p.y) < 1e-9 && d !== p);
  assert.ok(q, '0° = 같은 y 줄');
  const d45 = H.halftoneDots(() => 0, 100, 100, { gap: 10, angle: 45 });
  const c = d45.reduce((m, d) => (Math.hypot(d.x - 50, d.y - 50) < Math.hypot(m.x - 50, m.y - 50) ? d : m));
  const nb = d45.filter((d) => Math.abs(Math.hypot(d.x - c.x, d.y - c.y) - 10) < 1e-6).map((d) => Math.round((Math.atan2(d.y - c.y, d.x - c.x) * 180) / Math.PI));
  assert.ok(nb.includes(45), `45° 이웃 ${nb}`);
});

test('T5 네 모서리 덮기', () => {
  const ds = H.halftoneDots(() => 0, 300, 200, { gap: 12, angle: 30 });
  for (const [x, y] of [[0, 0], [300, 0], [0, 200], [300, 200]]) assert.ok(ds.some((d) => Math.hypot(d.x - x, d.y - y) <= 12), `모서리 ${x},${y}`);
});
