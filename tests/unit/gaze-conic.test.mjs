/* gaze-conic — FX-GRADIENT-GAZE-01 v2(현빈 261121 · 16종 · 원뿔형) 모델·팔레트·Figma 변환.
 * C1 gradient-model 원뿔형 — parse(from 각 · at 위치 건너뜀) · toCss 왕복 · strict(피커 꼴만 · 범위 밖 각 null · 머리 없는 꼴 = 0°) · 옛 linear/radial 무변
 * C2 GAZE_PRESETS 16 = linear 8 + conic 8(★261123 GradientGaze 재현) · key 겹침 0 · 정지점 오름차순 0..1 · conic 고리(끝 = 첫 색) · 색 #rrggbb
 * C3 ★GradientGaze 16 재현(현빈 261123 · 앞 판 «복제 0» 뒤집음) — 미카사 261123 표 ① 값 그대로 · key 무변 · 이름 Holo NN · 원뿔 3시 시작
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
  assert.deepEqual([L.filter((p) => p.type === 'linear').length, L.filter((p) => p.type === 'conic').length], [8, 8]);   // ★기대 바뀜(현빈 261123 GradientGaze 재현 — 홀수 Linear · 짝수 Angular)
  assert.equal(new Set(L.map((p) => p.key)).size, 16);
  for (const p of L) {
    assert.ok(p.stops.length >= 3 && p.stops.length <= 8, p.key);
    assert.ok(p.stops.every(([c, o], i) => /^#[0-9a-f]{6}$/.test(c) && o >= 0 && o <= 1 && (i === 0 || o >= p.stops[i - 1][1])), p.key);
    assert.equal(p.stops[0][1], 0); assert.equal(p.stops.at(-1)[1], 1);
    if (p.type === 'conic') assert.equal(p.stops.at(-1)[0], p.stops[0][0], `${p.key} 고리`);
  }
});

/* ★기대 바뀜(현빈 261123 «처음엔 똑같이» — 앞 판 «IP 라 안 옮김 · 원본 표 복제 0» 을 뒤집음): GradientGaze 16 = 미카사 261123 실측 표 ①(MIKASA-holo-noise-261123/notes.md) 그대로 ·
   순서 = 플러그인 격자 1~16 · key = 옛 이름 그대로(블럭 data-fx-holo 저장 키) · 보이는 이름 Holo 01~16 · 원뿔 시작 3시(90°) */
test('C3 GradientGaze 16 재현 = 미카사 261123 표 · key 무변 · 이름 Holo NN · 원뿔 90°', () => {
  const notes = fs.readFileSync(path.join(process.env.HOME, '.claude/skills/지디/handoff/MIKASA-holo-noise-261123/notes.md'), 'utf8');
  const rows = [...notes.matchAll(/^\| (\d+) \| (Linear|Angular) \| ([^|]+)\|/gm)].map((m) => ({ n: +m[1], type: m[2] === 'Angular' ? 'conic' : 'linear',
    stops: m[3].replace(/\(전부 100\)/, '').split('·').map((x) => x.trim().split(/\s+/)).filter((a) => a.length >= 2).map(([pos, hex]) => [`#${hex.toLowerCase()}`, +pos / 100]) }));
  assert.equal(rows.length, 16, '[전제] 표 16줄을 읽었다');
  const L = P.GAZE_PRESETS;
  rows.forEach((r, i) => assert.deepEqual({ type: L[i].type, stops: L[i].stops }, { type: r.type, stops: r.stops }, `#${r.n} 값이 표와 다르다`));
  assert.deepEqual(L.map((p) => p.key), ['silver', 'gold', 'rose', 'pearl', 'aurora', 'oil', 'mist', 'sunset', 'mint', 'chrome', 'neon', 'pastel', 'prism', 'slick', 'opal', 'goldswirl'], '★key = 옛 이름 그대로(저장 키)');
  assert.deepEqual(L.map((p) => p.name), Array.from({ length: 16 }, (_, i) => `Holo ${String(i + 1).padStart(2, '0')}`), '★보이는 이름 Holo 01~16');
  assert.equal(P.GAZE_CONIC_FROM, 90);
  assert.match(P.gazeSwatchCss(L[1]), /^conic-gradient\(from 90deg at 50% 50%, #b6d0f7 0%/, '★스와치 원뿔 = 3시 시작');
  assert.match(P.gazeSwatchCss(L[0]), /^linear-gradient\(90deg, #b6d0f7 0%/, '★스와치 선형 = 90°(0% 왼쪽)');
});

test('C4 Figma GRADIENT_ANGULAR', () => {
  const p = F.cssGradientToFigmaPaint({ type: 'conic', angle: 0, stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] }, 100, 100);
  assert.equal(p.type, 'GRADIENT_ANGULAR');
  assert.deepEqual(p.gradientTransform[0].map((v) => Math.round(v * 1000) / 1000 + 0), [0, -1, 1]);   // + 0 = −0 → 0
  const q = F.angularTransform(90, 100, 100);
  assert.deepEqual(q[0].map((v) => Math.round(v * 1000) / 1000 + 0), [1, 0, 0]);
});
