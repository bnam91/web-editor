/* bridge-wave-path.test.mjs — t13C-02 브릿지 물결 path(순수 · js/block-factory.js _buildBridgeWavePath 를 소스에서 떠 돌림)
 * W1 둥근·마루로 시작 = 첫 y 0(색이 맨 위) · 끝 꼬리 L860 90 L0 90 Z(V 와 같은 채움 꼴) · y 범위 0~높이 · 마루 수 = 반복 횟수+1(양 끝 포함)
 * W2 골로 시작 = 첫 y = 높이 · 뾰족 = 꼭짓점만(L 2n 개) · 범위 밖 값은 조임(높이 4~80 · 반복 1~24)
 * W3 V 무변 — renderBridgeBlock 은 bridgeShape 가 round/sharp 일 때만 물결(모르는 값·없음 = 옛 V)
 * 양성대조: _patches/bridge-wave-CTL-flat.patch(물결 y 가 늘 0) → W1·W2 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../js/block-factory.js', import.meta.url), 'utf8');
const a = src.indexOf('const BRIDGE_WAVE_DEFAULTS'), b = src.indexOf('\n}\n', src.indexOf('function _buildBridgeWavePath', a)) + 3;
const { _buildBridgeWavePath: P } = await import('data:text/javascript,' + encodeURIComponent(src.slice(a, b) + '\nexport { _buildBridgeWavePath };'));
const ys = (d) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);

test('W1 둥근 · 마루로 시작 · V 와 같은 꼬리', () => {
  const d = P({ shape: 'round', amp: 30, count: 3 });
  assert.ok(d.endsWith(' L860 90 L0 90 Z'), d.slice(-30));
  const pts = ys(d).slice(0, -2);   // 꼬리 두 점 빼고 물결 윗변
  assert.equal(pts[0][1], 0, '첫 점 = 마루(y 0)');
  assert.equal(pts.at(-1)[0], 860, '윗변 끝 x 860');
  assert.ok(pts.every(([, y]) => y >= 0 && y <= 30), 'y 0~높이');
  const crests = pts.filter(([, y]) => y === 0).length;
  assert.equal(crests, 4, `마루 수 ${crests}(반복 3 + 끝)`);
});

test('W2 골로 시작 · 뾰족 꼭짓점 · 조임', () => {
  const t = ys(P({ shape: 'round', amp: 30, count: 3, phase: 'trough' }));
  assert.equal(t[0][1], 30, '골로 시작 = 첫 y 높이');
  const s = P({ shape: 'sharp', amp: 24, count: 8 });
  assert.equal((s.match(/ L/g) || []).length, 2 * 8 + 2, '뾰족 = 꼭짓점 2n + 꼬리 2');
  const big = ys(P({ shape: 'round', amp: 999, count: 999 })).slice(0, -2);
  assert.ok(Math.max(...big.map(([, y]) => y)) <= 80, '높이 상한 80');
  const one = P({ shape: 'sharp', amp: 1, count: 0 });
  assert.equal((one.match(/ L/g) || []).length, 2 + 2, '반복 하한 1 · 높이 하한 4');
  assert.ok(ys(one).some(([, y]) => y === 4));
});

test('W3 V 무변 — 물결은 round/sharp 일 때만', () => {
  const body = src.slice(src.indexOf('function renderBridgeBlock'), src.indexOf('function applyBridgeFullBleed'));
  assert.match(body, /bridgeShape === 'round' \|\| block\.dataset\.bridgeShape === 'sharp' \? block\.dataset\.bridgeShape : 'v'/);
  assert.match(body, /shape === 'v' \? _buildBridgePath\(\{ width, depth, arc \}\)/);
});
