/* doodle-line-render — 선 형광펜 두들(js/fx/doodle-line-render.js DoodleLine)을 ★불러서 잰다. 1012t1J2.
 *
 * ★무엇을 잠그나
 *   DL1 다섯 스타일 모두 획이 있고 d 가 비어 있지 않다(모르는 스타일은 [] — 호출자가 line 으로 떨어진다).
 *   DL2 ★seed 결정성 — 같은 seed = 같은 글자 · 다른 seed = 다른 글자(흔들림은 FxSeed 에서만 · ⛔Math.random).
 *   DL3 ★잘림 없음 — 모든 꼭짓점·조절점의 |y−yMid| ≤ thickness/2 + extraPad (호출자는 svg 높이·bbox 를 이 값으로 넓힌다).
 *   DL4 획 수 — double 2 · brush 3 · 나머지 1.
 * 음성대조(보고에 수): rng 를 Math.random 으로 바꾸면 DL2 빨강 · extraPad 를 0 으로 바꾸면 DL3 빨강.
 * ⛔앱 0 · DOM 0 (vm 안에 window 대역 하나 · FxSeed 는 실물 js/fx/seeded-random.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

function load() {
  const window = {};
  const ctx = vm.createContext({ window, Math, Object, Number, String, Array, Error });
  vm.runInContext(read('js/fx/seeded-random.js'), ctx, { filename: 'seeded-random.js' });
  vm.runInContext(read('js/fx/doodle-line-render.js'), ctx, { filename: 'doodle-line-render.js' });
  return window;
}
const W = load();
const DL = W.DoodleLine;
const STYLES = ['scribble', 'brush', 'circle', 'double', 'scratch'];   // ★글자로 — 표에서 읽으면 항등식
const draw = (style, seed, over = {}) => {
  const pre = DL.PRESETS[style];
  const o = { length: 220, thickness: +pre.thickness, amplitude: +(pre.amplitude ?? 6), ...over };
  const extra = DL.extraPad(style, o);
  const yMid = (o.thickness + extra * 2) / 2;
  return { o, extra, yMid, strokes: DL.paths(style, { ...o, yMid, rng: W.FxSeed.mulberry32(seed) }) };
};
/* d 안의 숫자 쌍(x,y) 전부 — M/L/C/Q 의 꼭짓점·조절점 */
const pointsOf = (d) => [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => [+m[1], +m[2]]);

test('DL0 전제 — 실물 두 파일이 실렸고 스타일이 다섯이다', () => {
  assert.equal(typeof W.FxSeed?.mulberry32, 'function');
  assert.equal(typeof DL?.paths, 'function');
  assert.deepEqual([...DL.STYLES], STYLES);
});

test('DL1 다섯 스타일 모두 획이 있고 d 가 비어 있지 않다 · 모르는 스타일은 빈 목록', () => {
  for (const s of STYLES) {
    const { strokes } = draw(s, 12345);
    assert.ok(strokes.length >= 1, `${s}: 획 0`);
    for (const st of strokes) {
      assert.ok(typeof st.d === 'string' && /^M/.test(st.d) && pointsOf(st.d).length >= 2, `${s}: d 가 비었다 — ${st.d}`);
      assert.ok(st.width > 0, `${s}: 선폭 0`);
    }
  }
  assert.deepEqual([...DL.paths('zzz', { length: 100, thickness: 10, yMid: 10, rng: () => 0.5 })], []);
});

test('DL2 ★seed 결정성 — 같은 seed = 같은 글자 · 다른 seed = 다른 글자', () => {
  for (const s of STYLES) {
    const a = JSON.stringify(draw(s, 777).strokes), b = JSON.stringify(draw(s, 777).strokes), c = JSON.stringify(draw(s, 778).strokes);
    assert.equal(b, a, `${s}: 같은 seed 인데 그림이 다르다 — seed 아닌 난수가 섞였다`);
    assert.notEqual(c, a, `${s}: 다른 seed 인데 그림이 같다 — seed 가 그림에 안 닿는다`);
  }
});

test('DL3 ★잘림 없음 — 모든 점이 thickness/2 + extraPad 안 (여러 길이·두께·seed)', () => {
  let n = 0;
  for (const s of STYLES) for (const length of [40, 160, 600]) for (const thickness of [2, +DL.PRESETS[s].thickness, 60]) for (const seed of [1, 99, 4242]) {
    const { o, extra, yMid, strokes } = draw(s, seed, { length, thickness });
    const lim = o.thickness / 2 + extra + 1e-6;
    for (const st of strokes) for (const [, y] of pointsOf(st.d)) {
      n++;
      assert.ok(Math.abs(y - yMid) <= lim, `${s} L${length} t${thickness} seed${seed}: |y−yMid|=${Math.abs(y - yMid).toFixed(2)} > ${lim.toFixed(2)}`);
    }
  }
  assert.ok(n > 1000, `★전제: 잰 점이 너무 적다(${n})`);
});

test('DL4 획 수 — double 2 · brush 3 · 나머지 1', () => {
  const want = { scribble: 1, brush: 3, circle: 1, double: 2, scratch: 1 };
  for (const s of STYLES) assert.equal(draw(s, 5).strokes.length, want[s], s);
});

/* DL5 ★길이 방향 잘림 없음(1012t1J2 D1 — 이벨류에이터 실측: circle 이 L=600 에서 17.6px · L=2000 에서 103px 가로로 넘쳤다).
 *   모든 점이 −extraPadAlong ≤ x ≤ L + extraPadAlong 안. 호출자(sticker-block.js)가 이 값으로 bbox 를 넓힌다.
 *   음성대조: extraPadAlong 의 1.13 을 1 로 깨면(흔들림·두 바퀴째를 안 덮음) 빨강. */
test('DL5 ★길이 방향 잘림 없음 — 모든 점이 −extraPadAlong ≤ x ≤ L + extraPadAlong (L=1000 포함)', () => {
  let n = 0, circleOver = 0;
  for (const s of STYLES) for (const length of [40, 160, 600, 1000, 2000]) for (const seed of [1, 7, 99, 300, 4242]) {
    const { o, strokes } = draw(s, seed, { length });
    const along = DL.extraPadAlong(s, o);
    for (const st of strokes) for (const [x] of pointsOf(st.d)) {
      n++;
      if (s === 'circle' && (x < 0 || x > length)) circleOver++;
      assert.ok(x >= -along - 1e-6 && x <= length + along + 1e-6, `${s} L${length} seed${seed}: x=${x} 가 [${-along}, ${length + along}] 밖`);
    }
  }
  assert.ok(n > 2000, `★전제: 잰 점이 너무 적다(${n})`);
  assert.ok(circleOver > 0, '★전제: circle 은 실제로 선분 밖으로 나간다(0 이면 이 칸이 아무것도 안 잰다)');
  // ★L=1000 단독 — 이벨류에이터가 짚은 꼴 그대로(seed 1~300 전수)
  for (let seed = 1; seed <= 300; seed++) {
    const { o, strokes } = draw('circle', seed, { length: 1000 });
    const along = DL.extraPadAlong('circle', o);
    for (const st of strokes) for (const [x] of pointsOf(st.d)) assert.ok(x >= -along - 1e-6 && x <= 1000 + along + 1e-6, `circle L1000 seed${seed}: x=${x}`);
  }
  assert.equal(DL.extraPadAlong('line', { length: 1000 }), 0, '두들 아닌 스타일은 0 (bbox 옛 판 그대로)');
});
