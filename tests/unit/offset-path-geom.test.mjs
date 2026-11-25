/* offset-path-geom — 0.9.13 77 t13B-04 Offset Path 1차 셈(순수) · 사각·원 × Round/Miter · 거부 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';
/* 루트 package.json = commonjs ⇒ .js 의 export 를 Node 가 못 읽는다 — 임시 .mjs 로 옮겨 file:// 로(text-lorem 과 같은 손) */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TMP = path.join(mkTmpRoot('offset-'), 'offset-path-geom.mjs');
fs.copyFileSync(path.join(ROOT, 'js/offset-path-geom.js'), TMP);
const { offsetBox } = await import(pathToFileURL(TMP).href);

test('G1 뾰족한 사각 + 바깥 10 · Round = 상자 +20 · 반경 10 · 자리 −10', () => {
  assert.deepEqual(offsetBox({ type: 'rectangle', w: 100, h: 60, d: 10, join: 'round' }), { w: 120, h: 80, r: 10, dx: -10, dy: -10 });
});
test('G2 뾰족한 사각 + 바깥 10 · Miter = 뾰족 그대로(반경 0)', () => {
  assert.equal(offsetBox({ type: 'rectangle', w: 100, h: 60, d: 10, join: 'miter' }).r, 0);
});
test('G3 둥근 사각(r 8) · 안쪽 −3 = 반경 5 · 상자 −6 · 자리 +3', () => {
  assert.deepEqual(offsetBox({ type: 'rectangle', w: 100, h: 60, r: 8, d: -3, join: 'miter' }), { w: 94, h: 54, r: 5, dx: 3, dy: 3 });
  assert.equal(offsetBox({ type: 'rectangle', w: 100, h: 60, r: 8, d: -10, join: 'round' }).r, 0, '반경은 0 아래로 안 감');
});
test('G4 원 = 상자 ±2d · 반경 키 0 · 모서리 종류 무관', () => {
  assert.deepEqual(offsetBox({ type: 'ellipse', w: 80, h: 50, d: 5, join: 'miter' }), { w: 90, h: 60, r: 0, dx: -5, dy: -5 });
});
test('G5 d = 0 = 같은 상자 · 사라지는 안쪽·모르는 종류·잘못된 값 = null', () => {
  assert.deepEqual(offsetBox({ type: 'rectangle', w: 40, h: 40, d: 0 }), { w: 40, h: 40, r: 0, dx: 0, dy: 0 });
  assert.equal(offsetBox({ type: 'rectangle', w: 40, h: 40, d: -20 }), null);
  assert.equal(offsetBox({ type: 'star', w: 40, h: 40, d: 5 }), null);
  assert.equal(offsetBox({ type: 'ellipse', w: NaN, h: 40, d: 5 }), null);
});
