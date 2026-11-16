/* step-motion — 0.9.13 MOTION-STEP-HIGHLIGHT-01 신호등 셈·그림(js/fx/step-motion.js · 순수).
 * T1 차례: 한 바퀴 = n × 한 칸 시간 ÷ 속도 · t → 켜진 칸(끝 = 처음)
 * T2 지난 칸: off = 지금 칸만 · stack = 0..지금 칸
 * T3 그림: 바탕 통째 · 꺼진 칸 = 바탕색 흐림 · 채움/테두리 = 강조 색이 칸 자리(×k) · 켜지는 순간 0 에서 서서히 · 튀어나옴 = 바탕 조각을 키워 다시 그림 · 쌓임 = 흐림 칸 줄어듦
 * T4 소독 · 기본값 = 키 없음
 * 양성대조(예측 · CTL): CTL1 stepAt `Math.floor(x)` 자리를 0 으로 → T1 빨강(T3 은 켜진 칸을 직접 줌) · CTL5 stepLit 를 늘 [i] 로 → T2·T3 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepAt, stepLit, stepLoopSec, drawStep, normStep, STEP_ANIM_DEFAULT, STEP_DIM, STEP_FADE } from '../../js/fx/step-motion.js';
import { diffFromDefault } from '../../js/fx/slide-motion.js';

test('T1 차례 — 한 바퀴 · 칸 넘김 · 끝 = 처음', () => {
  assert.equal(stepLoopSec(4, { dwell: 0.8, speed: 2 }), 1.6);
  assert.deepEqual([0, 0.26, 0.5, 0.99, 1].map((t) => stepAt(4, t).i), [0, 1, 2, 3, 0]);
  assert.ok(Math.abs(stepAt(4, 0.375).local - 0.5) < 1e-9);
});

test('T2 지난 칸 — 꺼짐 / 쌓임', () => {
  assert.deepEqual(stepLit(2, 'off'), [2]);
  assert.deepEqual(stepLit(2, 'stack'), [0, 1, 2]);
});

function fake() {
  const calls = [];
  const ctx = { calls, globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    drawImage: (im, ...a) => calls.push({ op: 'img', a }), fillRect: (x, y, w, h) => calls.push({ op: 'fill', x, y, w, h, c: ctx.fillStyle, al: ctx.globalAlpha }),
    strokeRect: (x, y, w, h) => calls.push({ op: 'stroke', x, y, w, h, c: ctx.strokeStyle, al: ctx.globalAlpha }), save() {}, restore() {} };
  return ctx;
}
const CELLS = [0, 1, 2].map((i) => ({ x: i * 100, y: 0, w: 100, h: 50 }));
const BASE = { width: 600, height: 100 };

test('T3 그림 — 바탕 · 흐림 · 강조 자리 · 서서히 · 튀어나옴 · 쌓임', () => {
  const k = 2, W = 600, H = 100;
  const f = fake(); drawStep(f, W, H, BASE, CELLS, 'step-fill', { i: 1, local: 0.5 }, 'off', '#00ff00', '#ffffff', k);
  assert.deepEqual(f.calls[0], { op: 'img', a: [0, 0, W, H] }, '바탕 통째');
  const dims = f.calls.filter((c) => c.op === 'fill' && c.c === '#ffffff');
  assert.deepEqual(dims.map((c) => [c.x, c.al]), [[0, STEP_DIM], [400, STEP_DIM]], '꺼진 칸 = 0·2');
  assert.deepEqual(f.calls.filter((c) => c.c === '#00ff00').map((c) => [c.x, c.w, c.al]), [[200, 200, 0.22]], '★강조 색이 칸 1 자리(×k)');
  const z = fake(); drawStep(z, W, H, BASE, CELLS, 'step-fill', { i: 1, local: 0 }, 'off', '#00ff00', '#fff', k);
  assert.equal(z.calls.find((c) => c.c === '#00ff00').al, 0, '켜지는 순간 = 0');
  const h = fake(); drawStep(h, W, H, BASE, CELLS, 'step-fill', { i: 1, local: STEP_FADE / 2 }, 'off', '#00ff00', '#fff', k);
  assert.ok(Math.abs(h.calls.find((c) => c.c === '#00ff00').al - 0.11) < 1e-9, '반쯤');
  const o = fake(); drawStep(o, W, H, BASE, CELLS, 'step-outline', { i: 2, local: 1 }, 'off', '#00ff00', '#fff', k);
  const st = o.calls.find((c) => c.op === 'stroke');
  assert.ok(st && st.c === '#00ff00' && st.x > 400 && st.x < 410, `테두리 = 칸 2 · ${JSON.stringify(st)}`);
  const p = fake(); drawStep(p, W, H, BASE, CELLS, 'step-pop', { i: 0, local: 1 }, 'off', '#00ff00', '#fff', k);
  const pop = p.calls.filter((c) => c.op === 'img')[1];
  assert.ok(pop && pop.a[6] > 200 && pop.a[4] < 0, `★튀어나옴 = 칸 0 조각을 키움 · ${JSON.stringify(pop)}`);
  const s = fake(); drawStep(s, W, H, BASE, CELLS, 'step-outline', { i: 1, local: 1 }, 'stack', '#00ff00', '#fff', k);
  assert.deepEqual([s.calls.filter((c) => c.op === 'stroke').length, s.calls.filter((c) => c.op === 'fill').length], [2, 1], '★쌓임 = 칸 0·1 켜짐 · 2 만 흐림');
});

test('T4 소독 · 기본값 = 키 없음', () => {
  assert.deepEqual(normStep({ dwell: 99, past: '<b>', speed: 0 }), { dwell: 4, past: 'off', speed: 0.25 });
  assert.deepEqual(diffFromDefault(normStep({}), STEP_ANIM_DEFAULT), {});
  assert.deepEqual(diffFromDefault(normStep({ past: 'stack' }), STEP_ANIM_DEFAULT), { past: 'stack' });
});
