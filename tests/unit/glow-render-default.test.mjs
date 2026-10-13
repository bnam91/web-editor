/* glow-render-default — 글로우 스티커 프리셋 기본 후광색의 «정본 값»을 잰다. 1013t2C5.
 *   GD1 별 반짝이 기본 = 무채색 #e0e0e0 (보라 #b06cff 아님) · GD2 플레어 #ff9a3c · 빛점 #ffffff 무접촉.
 * 음성대조: PRESETS.star.glowColor 를 '#b06cff' 로 되돌리면 GD1 빨강. ⛔앱 0 · DOM 0 (vm 안 window 대역). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const window = {};
const ctx = vm.createContext({ window, Math, Object, Number, String, Array, Error });
vm.runInContext(fs.readFileSync(path.join(REPO, 'js/fx/glow-render.js'), 'utf8'), ctx, { filename: 'glow-render.js' });
const P = window.GlowFx.PRESETS;

test('GD1 별 반짝이 기본 후광 = #e0e0e0 (무채색)', () => {
  assert.equal(P.star.glowColor, '#e0e0e0');
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(P.star.glowColor.slice(i, i + 2), 16));
  assert.ok(r === g && g === b, '무채색(r=g=b)');
});

test('GD2 다른 종류 무접촉', () => {
  assert.equal(P.flare.glowColor, '#ff9a3c');
  assert.equal(P.dot.glowColor, '#ffffff');
});
