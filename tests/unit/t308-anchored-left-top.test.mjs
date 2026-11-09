/* t3-08 — anchoredLeftTop: 잡은 꼭지의 «맞은편»이 화면에서 안 움직인다 (deg 0·90·45 × 4꼭지).
 * 기대값은 독립 유도 — 박스를 중심 기준으로 회전시킨 «화면 꼭지점»을 전/후 비교한다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const alias = path.join(os.tmpdir(), `t308-alias-${process.pid}.mjs`);
fs.copyFileSync(path.join(ROOT, 'js/frame-geometry.js'), alias);
const { anchoredLeftTop } = await import(pathToFileURL(alias).href);
fs.unlinkSync(alias);

const OPP = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
function screenCorner(L, T, W, H, deg, d) {
  const t = deg * Math.PI / 180, cx = L + W / 2, cy = T + H / 2;
  const ox = (d.includes('e') ? 1 : -1) * W / 2, oy = (d.includes('s') ? 1 : -1) * H / 2;
  return [cx + ox * Math.cos(t) - oy * Math.sin(t), cy + ox * Math.sin(t) + oy * Math.cos(t)];
}

for (const deg of [0, 90, 45]) for (const dir of ['nw', 'ne', 'sw', 'se']) {
  test(`deg ${deg} · ${dir}: 맞은편 ${OPP[dir]} 고정`, () => {
    const L0 = 180, T0 = 120, W0 = 200, H0 = 150, W1 = 240, H1 = 110;
    const p = anchoredLeftTop(L0, T0, W0, H0, W1, H1, dir, deg);
    const a = screenCorner(L0, T0, W0, H0, deg, OPP[dir]);
    const b = screenCorner(p.left, p.top, W1, H1, deg, OPP[dir]);
    assert.ok(Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1, `${a} → ${b}`);
  });
}

test('deg 0 꼴: w 쪽 left −ΔW · n 쪽 top −ΔH · se 무변화', () => {
  assert.deepEqual(anchoredLeftTop(10, 20, 100, 50, 140, 80, 'nw'), { left: -30, top: -10 });
  assert.deepEqual(anchoredLeftTop(10, 20, 100, 50, 140, 80, 'se'), { left: 10, top: 20 });
  assert.deepEqual(anchoredLeftTop(10, 20, 100, 50, 140, 80, 'ne'), { left: 10, top: -10 });
  assert.deepEqual(anchoredLeftTop(10, 20, 100, 50, 140, 80, 'sw'), { left: -30, top: 20 });
});
