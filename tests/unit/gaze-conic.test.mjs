/* gaze-conic — FX-GRADIENT-GAZE-01 v2(현빈 261121 · 16종 · 원뿔형) 모델·팔레트·Figma 변환.
 * C1 gradient-model 원뿔형 — parse(from 각 · at 위치 건너뜀) · toCss 왕복 · strict(피커 꼴만 · 범위 밖 각 null · 머리 없는 꼴 = 0°) · 옛 linear/radial 무변
 * C2 GAZE_PRESETS 16 = linear 12 + conic 4 · key 겹침 0 · 정지점 오름차순 0..1 · conic 고리(끝 = 첫 색) · 색 #rrggbb
 * C3 원본 표 복제 0 — 검수 참고 표(MIKASA notes 4표)의 정지점 색 열(4~8색)과 같은 프리셋 없음(색 집합 같음 0)
 * C4 Figma — cssGradientToFigmaPaint(conic) = GRADIENT_ANGULAR · 시작각 0 이면 x 축 = 위(0,−1) 방향 · 90 이면 오른쪽
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const _tmp = path.join(mkTmpRoot('gaze-conic-'), 'gradient-model.mjs');
fs.writeFileSync(_tmp, readSrc(ROOT, 'js', 'props', 'gradient-model.js'));
const G = (await import(pathToFileURL(_tmp).href)).default;
const P = await import(pathToFileURL(path.join(ROOT, 'js/fx/holo-palette.js')).href);
const F = await import(pathToFileURL(path.join(ROOT, 'figma-renderer/gradient-paint.mjs')).href);

test('C1 원뿔형 모델', () => {
  const css = 'conic-gradient(from 30deg at 50% 50%, #ff0000 0%, #00ff00 50%, #ff0000 100%)';
  const g = G.parseGradient(css);
  assert.deepEqual([g.type, g.angle, g.stops.length], ['conic', 30, 3]);
  assert.equal(G.toCss(g), css);
  assert.ok(G.parseGradientStrict(css));
  assert.equal(G.parseGradientStrict('conic-gradient(from 30deg at 20% 40%, #ff0000 0%, #00ff00 100%)'), null, '가운데 아닌 위치 = 피커가 못 지킴');
  assert.equal(G.parseGradientStrict('conic-gradient(from 400deg at 50% 50%, #ff0000 0%, #00ff00 100%)'), null);
  assert.ok(G.parseGradientStrict('conic-gradient(from 30deg, #ff0000 0%, #00ff00 100%)'), '브라우저가 지운 꼴(at 50% 50% 없음)도 피커가 다시 연다');
  { const z = G.parseGradientStrict('conic-gradient(rgb(244, 240, 255) 0%, rgb(207, 232, 255) 50%, rgb(244, 240, 255) 100%)');   // 시작각 0 = 브라우저가 «from 0deg at 50% 50%» 를 통째로 지운 꼴(홀로그램 카드 글자 실측 · v3 261121)
    assert.deepEqual(z && [z.type, z.angle, z.stops.length], ['conic', 0, 3], '머리 없는 원뿔형 = 0° 로 다시 연다'); }
  assert.equal(G.parseGradientStrict('conic-gradient(at 20% 40%, #ff0000 0%, #00ff00 100%)'), null, '머리가 위치뿐이면 여전히 못 지킴');
  assert.equal(G.parseGradient('conic-gradient(at 50% 50%, #ff0000 0%, #00ff00 100%)').angle, 0);
  assert.equal(G.toCss(G.parseGradient('linear-gradient(90deg, #000000 0%, #ffffff 100%)')), 'linear-gradient(90deg, #000000 0%, #ffffff 100%)');
  assert.equal(G.toCss(G.parseGradient('radial-gradient(circle, #000000 0%, #ffffff 100%)')), 'radial-gradient(circle, #000000 0%, #ffffff 100%)');
});

test('C2 16종', () => {
  const L = P.GAZE_PRESETS;
  assert.equal(L.length, 16);
  assert.deepEqual([L.filter((p) => p.type === 'linear').length, L.filter((p) => p.type === 'conic').length], [12, 4]);
  assert.equal(new Set(L.map((p) => p.key)).size, 16);
  for (const p of L) {
    assert.ok(p.stops.length >= 3 && p.stops.length <= 8, p.key);
    assert.ok(p.stops.every(([c, o], i) => /^#[0-9a-f]{6}$/.test(c) && o >= 0 && o <= 1 && (i === 0 || o >= p.stops[i - 1][1])), p.key);
    assert.equal(p.stops[0][1], 0); assert.equal(p.stops.at(-1)[1], 1);
    if (p.type === 'conic') assert.equal(p.stops.at(-1)[0], p.stops[0][0], `${p.key} 고리`);
  }
});

test('C3 원본 표 복제 0', () => {
  const notes = fs.readFileSync(path.join(process.env.HOME, '.claude/skills/지디/handoff/MIKASA-plugin-check-1121/notes.md'), 'utf8');
  const rows = [...notes.matchAll(/정지점 \d개 ([^|]+)\|/g)].map((m) => [...m[1].matchAll(/([0-9A-F]{6})/g)].map((x) => '#' + x[1].toLowerCase()));
  assert.ok(rows.length >= 4, '[전제] 원본 4표를 읽었다');
  const key = (cs) => [...new Set(cs)].sort().join(',');
  const ours = new Set(P.GAZE_PRESETS.map((p) => key(p.stops.map(([c]) => c))));
  for (const r of rows) assert.ok(!ours.has(key(r)), `원본 색 집합 복제: ${r}`);
  const all = new Set(rows.flat()); const shared = P.GAZE_PRESETS.flatMap((p) => p.stops.map(([c]) => c)).filter((c) => all.has(c));
  assert.ok(shared.length <= 2, `원본과 같은 색 낱개 ${shared}`);   // 흰색 같은 우연 1~2 까지만
});

test('C4 Figma GRADIENT_ANGULAR', () => {
  const p = F.cssGradientToFigmaPaint({ type: 'conic', angle: 0, stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] }, 100, 100);
  assert.equal(p.type, 'GRADIENT_ANGULAR');
  assert.deepEqual(p.gradientTransform[0].map((v) => Math.round(v * 1000) / 1000 + 0), [0, -1, 1]);   // + 0 = −0 → 0
  const q = F.angularTransform(90, 100, 100);
  assert.deepEqual(q[0].map((v) => Math.round(v * 1000) / 1000 + 0), [1, 0, 0]);
});
