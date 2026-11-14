/* burst-geometry.test.mjs — js/blocks/burst-geometry.js (B2 톱니 스탬프 · 261114) · 글을 읽어 export 만 걷고 돌린다
 *   B1 꼭짓점 = 2×톱니 · 첫 점 12시(50,0) · 바깥/안쪽 반지름이 번갈아
 *   B2 깊이 — 안쪽 반지름 = 50×(1−깊이%) · 링은 톱니 골보다 안
 *   B3 범위 — 톱니 8~48 · 깊이 4~30 · 숫자 아니면 기본값
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const src = readSrc(REPO, 'js/blocks/burst-geometry.js');
assert.doesNotMatch(src, /^\s*import\s/m);
const names = [...src.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
const M = new Function(src.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)();
const pts = (o) => M.burstPoints(o).split(' ').map((p) => p.split(',').map(Number));
const dist = ([x, y]) => Math.hypot(x - 50, y - 50);

test('B1 꼭짓점 수·첫 점·번갈아', () => {
  const p = pts({ teeth: 24, depth: 14 });
  assert.equal(p.length, 48);
  assert.deepEqual(p[0], [50, 0]);
  p.forEach((q, i) => assert.ok(Math.abs(dist(q) - (i % 2 ? 43 : 50)) < 0.02, `${i}: ${dist(q)}`));
  assert.equal(pts({ teeth: 12 }).length, 24);
});

test('B2 깊이·링', () => {
  assert.ok(Math.abs(dist(pts({ teeth: 16, depth: 30 })[1]) - 35) < 0.02);
  assert.ok(M.burstRingR({ depth: 14 }) < 43);
  assert.ok(M.burstRingR({ depth: 30 }) < M.burstRingR({ depth: 4 }));
});

test('B3 범위', () => {
  assert.deepEqual(M.clampBurst({ teeth: 3, depth: 99 }), { teeth: 8, depth: 30 });
  assert.deepEqual(M.clampBurst({ teeth: 'x', depth: null }), { teeth: 24, depth: 14 });
  assert.deepEqual(M.clampBurst({ teeth: 100, depth: 1 }), { teeth: 48, depth: 4 });
});
