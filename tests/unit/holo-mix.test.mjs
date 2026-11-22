/* holo-mix — 미카사 채점 261121 ③(지디 승인): 홀로그램 세기 = «덮는 정도» 셈(js/fx/holo-palette.js holoMixStops · sampleStops · 순수).
 * M1 단색 바탕 — 0 = 바탕 색 그대로(불투명) · 100 = 홀로 그대로 · 50 = 반반 · 정지점 opacity 1
 * M2 바탕 모름(null) — 옛 셈(색 그대로 · opacity = a/100)
 * M3 반투명 바탕 — 알파 합성(out a = k + b·(1-k)) · rgb()/rgba()/#rgb 읽기
 * M4 그라데이션 바탕 — 홀로 정지점 offset 자리에서 표본(선형 보간 · opacity 곱)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const H = await import(pathToFileURL(path.join(ROOT, 'js/fx/holo-palette.js')).href);
const S = [['#00ff00', 0], ['#0000ff', 1]];

test('M1 단색 바탕', () => {
  assert.deepEqual(H.holoMixStops(S, 0, { solid: '#ff0000' }), [{ color: '#ff0000', offset: 0, opacity: 1 }, { color: '#ff0000', offset: 1, opacity: 1 }]);
  assert.deepEqual(H.holoMixStops(S, 100, { solid: '#ff0000' }), [{ color: '#00ff00', offset: 0, opacity: 1 }, { color: '#0000ff', offset: 1, opacity: 1 }]);
  assert.deepEqual(H.holoMixStops(S, 50, { solid: '#ff0000' }).map((x) => x.color), ['#808000', '#800080']);
});
test('M2 바탕 모름 = 옛 셈', () => {
  assert.deepEqual(H.holoMixStops(S, 30, null), [{ color: '#00ff00', offset: 0, opacity: 0.3 }, { color: '#0000ff', offset: 1, opacity: 0.3 }]);
});
test('M3 반투명 바탕 · 색 꼴', () => {
  const [x] = H.holoMixStops([['#ffffff', 0]], 50, { solid: 'rgba(0, 0, 0, 0.5)' });
  assert.equal(x.opacity, 0.75);
  assert.equal(x.color, '#aaaaaa', '(255·0.5 + 0·0.5·0.5)/0.75 = 170');
  assert.equal(H.holoMixStops([['#fff', 0]], 0, { solid: 'rgb(10, 20, 30)' })[0].color, '#0a141e');
});
test('M4 그라데이션 바탕 표본', () => {
  const base = { stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1, opacity: 1 }] };
  assert.deepEqual(H.sampleStops(base.stops, 0.5), [127.5, 0, 127.5, 1]);
  const [a, b] = H.holoMixStops([["#00ff00", 0.25], ["#00ff00", 0.75]], 0, base);
  assert.equal(a.color, '#bf0040'); assert.equal(b.color, '#4000bf');
  assert.deepEqual(H.sampleStops([{ color: '#000000', offset: 0, opacity: 0.5 }], 0.3), [0, 0, 0, 0.5]);
  assert.equal(H.sampleStops([], 0.3), null);
});
