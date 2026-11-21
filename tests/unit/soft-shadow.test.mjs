/* soft-shadow — TEXT-FX-BEAUTIFUL-SHADOW-01(현빈 261121) 부드러운 그림자 겹 셈(js/fx/soft-shadow.js).
 * S1 소독(범위·정수·색) · S2 겹 꼴(5겹 · 거리 1/16…1 × 높이 · 흐림 = 거리×2 · 알파 줄어듦) · S3 각도 방향(0°=오른쪽 · 90°=아래 · 180°=왼쪽)
 * S4 css 글(세기 0 = '' · rgba 5개) · S5 합성 문 순서 — effects-glow fxComposedTextShadowCss 가 [글로우, 사용자, 부드러운] 맨 뒤에 붙이고 없으면 '' 라 옛 글 그대로
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const S = await import(pathToFileURL(path.join(ROOT, 'js/fx/soft-shadow.js')).href);   // js/fx = module

test('S1 소독', () => {
  assert.deepEqual(S.normSoft({}), { ...S.SOFT_DEFAULTS });
  assert.deepEqual(S.normSoft({ angle: 999, height: -3, strength: '70.4', color: '#ABCDEF' }), { angle: 360, height: 0, strength: 70, color: '#abcdef' });
  assert.equal(S.normSoft({ color: 'red' }).color, S.SOFT_DEFAULTS.color);
  assert.equal(S.normSoft({ height: '' }).height, S.SOFT_DEFAULTS.height);
});

test('S2 겹 꼴', () => {
  const L = S.softLayers({ angle: 90, height: 16, strength: 100 });
  assert.equal(L.length, S.SOFT_LAYERS);
  assert.deepEqual(L.map((l) => l.y), [1, 2, 4, 8, 16]);
  assert.deepEqual(L.map((l) => l.blur), [2, 4, 8, 16, 32]);
  for (let i = 1; i < L.length; i++) assert.ok(L[i].a < L[i - 1].a, '먼 겹일수록 옅다');
  assert.equal(L[0].a, 0.35);
});

test('S3 각도 방향', () => {
  const last = (a) => S.softLayers({ angle: a, height: 10, strength: 50 }).at(-1);
  assert.deepEqual([last(0).x, last(0).y], [10, 0]);
  assert.deepEqual([last(90).x, last(90).y], [0, 10]);
  assert.deepEqual([last(180).x, last(180).y], [-10, 0]);
});

test('S4 css 글', () => {
  assert.equal(S.softShadowCss({ strength: 0 }), '');
  const css = S.softShadowCss({ angle: 90, height: 16, strength: 60, color: '#102030' });
  assert.equal((css.match(/rgba\(16,32,48,/g) || []).length, 5);
  assert.match(css, /^0px 1px 2px rgba\(16,32,48,0\.21\), /);
});

test('S5 합성 문 순서·옛 글', () => {
  const glow = readSrc(ROOT, 'js', 'effects-glow.js');
  assert.match(glow, /return \[tb \? fxGlowLayers\(tb\) : '', u, soft\]\.filter\(Boolean\)\.join\(', '\);/);
  assert.match(glow, /const soft = tb && typeof window !== 'undefined' && typeof window\.fxSoftShadowLayers === 'function' \? window\.fxSoftShadowLayers\(tb\) : '';/);
});
