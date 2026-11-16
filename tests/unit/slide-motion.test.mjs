/* slide-motion — 0.9.13 MOTION-SLIDE-BLOCK-01 슬라이드 움직임 셈(js/fx/slide-motion.js · 순수).
 * S1 흐름: 한 바퀴 = 주기/속도 · t 0 과 1 이 같은 자리(끊김 0) · 한 방향으로만 늘어남
 * S2 스와이프: 장마다 머무름 동안 제자리(i × 한 칸) · 넘김 가운데는 사이 · 끝 = 처음
 * S3 GIF 60 상한: 짧은 바퀴 = 20fps 그대로 · 긴 바퀴(12초) = 60프레임 · 5fps 로 낮춤 + 안내 줄이 몇 fps 인지 말함(지디 결정 ⓑ)
 * S4 그림 자리: offset 0 = 카드 i 왼끝 i×(카드 폭+간격)×k(정적 첫 장면 flex 줄과 같은 자리) · 오른쪽 흐름 = 반대 부호 · 주기 끝에서도 화면 폭을 다 덮음
 * S5 소독: 범위 밖 값은 고정 · 기본값이면 저장 키 없음
 * 양성대조(예측 · CTL): slideOffset 첫 줄 `const tt = ((t % 1) + 1) % 1;` → `const tt = t;`(한 바퀴 감기 없앰) → S1 빨강(t 1 ≠ 0) · 스와이프 `: 1;` → `: 0;` → S2 빨강 · gifPlan 의 `Math.min(GIF_FRAMES_MAX, …)` 를 `Math.round(s * GIF_FPS_MAX)` 로 → S3 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { slideGeom, slideOffset, loopSec, gifPlan, slideInfoText, drawSlides, normLayout, normAnim, diffFromDefault,
  SLIDE_LAYOUT_DEFAULT, SLIDE_ANIM_DEFAULT, FLOW_PX_S, SWIPE_MOVE_S } from '../../js/fx/slide-motion.js';

const G = slideGeom(800, 4, { cardW: 50, gap: 20 });   // 카드 400 · 한 칸 420 · 주기 1680

test('S1 흐름 — 한 바퀴 · 끊김 0 · 한 방향', () => {
  assert.deepEqual([G.cw, G.step, G.period], [400, 420, 1680]);
  assert.equal(loopSec('slide-flow', G, { speed: 2 }), 1680 / (FLOW_PX_S * 2));
  assert.equal(slideOffset('slide-flow', G, {}, 0), 0);
  assert.equal(slideOffset('slide-flow', G, {}, 1), 0, '★끝 = 처음(GIF 첫·끝 프레임이 이어져야)');
  let prev = -1;
  for (let i = 0; i < 20; i++) { const s = slideOffset('slide-flow', G, {}, i / 20); assert.ok(s > prev, `t ${i / 20}`); prev = s; }
});

test('S2 스와이프 — 머무름 동안 제자리 · 넘김은 사이 · 끝 = 처음', () => {
  const A = { dwell: 1.5 }, per = SWIPE_MOVE_S + 1.5, T = 4 * per;   // 한 바퀴 8초
  assert.equal(loopSec('slide-swipe', G, A), T);
  const at = (sec) => slideOffset('slide-swipe', G, A, sec / T);
  for (let i = 0; i < 4; i++) {
    const still = [i * per + SWIPE_MOVE_S + 0.01, i * per + per - 0.01].map(at);
    assert.deepEqual(still, [((i + 1) * 420) % 1680, ((i + 1) * 420) % 1680], `★${i + 1}번째 머무름이 움직인다`);
  }
  const mid = at(SWIPE_MOVE_S / 2);
  assert.ok(mid > 0 && mid < 420, `넘김 가운데 ${mid}`);
  assert.equal(at(T), 0);
});

test('S3 GIF 60 상한 — 짧으면 20fps · 길면 fps 낮춤 + 안내', () => {
  assert.deepEqual(gifPlan(2), { fps: 20, frames: 40, delay: 50, capped: false });
  const g = gifPlan(12);
  assert.deepEqual([g.frames, g.fps, g.delay, g.capped], [60, 5, 200, true]);
  assert.ok(gifPlan(30).frames <= 60);
  const info = slideInfoText(12);
  assert.match(info, /GIF 60프레임\(상한 60\)/);
  assert.match(info, /초당 5\.0프레임 — 상한 때문에 20에서 낮춤/);
  assert.doesNotMatch(slideInfoText(2), /낮춤/);
});

function fakeCtx() {
  const calls = [];
  return { calls, fillStyle: '', fillRect: (x, y, w, h) => calls.push({ op: 'rect', x, w }), drawImage: (im, sx, sy, sw, sh, dx, dy, dw, dh) => calls.push({ op: 'img', id: im.id, x: dx, w: dw, h: dh }) };
}
const IM = [0, 1, 2, 3].map((id) => ({ id, width: 200, height: 100 }));

test('S4 그림 자리 — offset 0 = 정적 첫 장면 자리 · 오른쪽 = 반대 · 주기 끝도 화면을 다 덮음', () => {
  const k = 0.5, W = 400, H = 180;
  const c0 = fakeCtx(); drawSlides(c0, W, H, IM, G, 0, 'left', k);
  const first = c0.calls.filter((c) => c.op === 'img' && c.x > -1 && c.x < W).map((c) => [c.id, c.x, c.w, c.h]).sort((a, b) => a[1] - b[1]);
  assert.deepEqual(first, [[0, 0, 200, 180], [1, 210, 200, 180]], '★카드 i 왼끝 = i × 한 칸 × k');
  const l = fakeCtx(); drawSlides(l, W, H, IM, G, 100, 'left', k);
  const r = fakeCtx(); drawSlides(r, W, H, IM, G, 100, 'right', k);
  const x0 = (c) => c.calls.find((q) => q.op === 'img' && q.id === 1 && q.x > 0 && q.x < W).x;
  assert.deepEqual([x0(l), x0(r)], [210 - 50, 210 + 50], '방향 = 부호');
  for (const s of [0, 400, 1679]) {
    const c = fakeCtx(); drawSlides(c, W, H, IM, G, s, 'left', k);
    const spans = c.calls.filter((q) => q.op === 'img').map((q) => [Math.max(0, q.x), Math.min(W, q.x + q.w)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    let reach = 0; for (const [a, b] of spans) { if (a > reach + G.gap * k + 0.01) break; reach = Math.max(reach, b); }   // 카드 간격(gap × k)보다 큰 빈틈이 없어야
    assert.ok(reach >= W - 0.01, `★offset ${s} 에서 오른쪽이 비었다(${reach})`);
  }
  const e = fakeCtx(); drawSlides(e, W, H, [null, null, null, null], G, 0, 'left', k);
  assert.ok(e.calls.every((q) => q.op === 'rect'), '그림 없는 카드 = 빈 카드 색');
});

test('S5 소독 · 기본값 = 키 없음', () => {
  assert.deepEqual(normLayout({ cardW: 999, gap: -5, h: 'x' }), { cardW: 100, gap: 0, h: SLIDE_LAYOUT_DEFAULT.h });
  assert.deepEqual(normAnim({ dir: '<b>', dwell: 99, speed: 0 }), { dir: 'left', dwell: 4, speed: 0.25 });
  assert.deepEqual(diffFromDefault(normAnim({}), SLIDE_ANIM_DEFAULT), {});
  assert.deepEqual(diffFromDefault(normAnim({ dir: 'right' }), SLIDE_ANIM_DEFAULT), { dir: 'right' });
});
