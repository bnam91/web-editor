/* slide-motion — 0.9.13 MOTION-SLIDE-BLOCK-01 슬라이드 움직임 셈(js/fx/slide-motion.js · 순수).
 * S1 흐름: 한 바퀴 = 주기/속도 · t 0 과 1 이 같은 자리(끊김 0) · 한 방향으로만 늘어남
 * S2 스와이프: 장마다 머무름 동안 제자리(i × 한 칸) · 넘김 가운데는 사이 · 끝 = 처음
 * S3 GIF 60 상한: 짧은 바퀴 = 20fps 그대로 · 긴 바퀴(12초) = 60프레임 · 5fps 로 낮춤 + 안내 줄이 몇 fps 인지 말함(지디 결정 ⓑ)
 * S4 그림 자리: offset 0 = 카드 i 왼끝 i×(카드 폭+간격)×k(정적 첫 장면 flex 줄과 같은 자리) · 오른쪽 흐름 = 반대 부호 · 주기 끝에서도 화면 폭을 다 덮음
 * S5 소독: 범위 밖 값은 고정 · 기본값이면 저장 키 없음
 * S6 세로(2단계 · ② 세로 스크롤): 세로 흐름 = 흐름 셈 · 세로 넘김 = 스와이프 셈 · 그림은 y 축(카드 i 위끝 = i × 한 칸 × k · 폭 = 캔버스 폭) · 주기 끝에도 높이를 다 덮음
 *   양성대조(CTL2): drawSlides 의 `const y = axis === 'y'` → `const y = false` → S6 빨강
 * S7 칸별 폭(SLIDE-CELL-SIZE-EACH-01): ws 없음/전부 빈 값 = uniform(옛 셈 그대로 · starts = i×한 칸) · ws 있음 = 카드 왼끝 = 앞 카드 (폭+간격) 누적합 ·
 *    주기 = 합 · 스와이프 머무름 = 다음 카드 왼끝 · 그림 = 그 자리·그 폭 · 소독 20~100
 *   양성대조(CTL3 · _patches/slide-fb-CTL3-uniform-draw.patch): drawSlides 의 `const uni = geom.uniform !== false;` → `const uni = true;` → S7 빨강(그림이 균일 자리)
 * 양성대조(예측 · CTL): slideOffset 첫 줄 `const tt = ((t % 1) + 1) % 1;` → `const tt = t;`(한 바퀴 감기 없앰) → S1 빨강(t 1 ≠ 0) · 스와이프 `: 1;` → `: 0;` → S2 빨강 · gifPlan 의 `Math.min(GIF_FRAMES_MAX, …)` 를 `Math.round(s * GIF_FPS_MAX)` 로 → S3 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normCardW, slideGeom, slideOffset, loopSec, gifPlan, slideInfoText, drawSlides, normLayout, normAnim, diffFromDefault, slideAxis,
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

test('S6 세로 — 흐름·넘김 셈은 가로와 같고 그림은 y 축', () => {
  assert.deepEqual(['slide-flow', 'slide-swipe', 'slide-vflow', 'slide-vstep'].map(slideAxis), ['x', 'x', 'y', 'y']);
  const A = { dwell: 1.5, speed: 1 };
  assert.equal(loopSec('slide-vflow', G, A), loopSec('slide-flow', G, A));
  assert.equal(loopSec('slide-vstep', G, A), loopSec('slide-swipe', G, A));
  for (const t of [0, 0.1, 0.37, 0.8]) {
    assert.equal(slideOffset('slide-vflow', G, A, t), slideOffset('slide-flow', G, A, t));
    assert.equal(slideOffset('slide-vstep', G, A, t), slideOffset('slide-swipe', G, A, t), `넘김 t ${t}`);
  }
  const k = 0.5, W = 180, H = 400;   // 세로: 움직임 축 = H
  const c0 = fakeCtx(); c0.fillRect = (x, y, w, h) => c0.calls.push({ op: 'rect', x, y, w, h });
  c0.drawImage = (im, sx, sy, sw, sh, dx, dy, dw, dh) => c0.calls.push({ op: 'img', id: im.id, x: dx, y: dy, w: dw, h: dh });
  drawSlides(c0, W, H, IM, G, 0, 'left', k, undefined, 'y');
  const first = c0.calls.filter((c) => c.op === 'img' && c.y > -1 && c.y < H).map((c) => [c.id, c.x, c.y, c.w, c.h]).sort((a, b) => a[2] - b[2]);
  assert.deepEqual(first, [[0, 0, 0, 180, 200], [1, 0, 210, 180, 200]], '★카드 i 위끝 = i × 한 칸 × k · 폭 = 캔버스 폭');
  for (const off of [0, 400, 1679]) {
    const c = fakeCtx(); c.drawImage = (im, sx, sy, sw, sh, dx, dy, dw, dh) => c.calls.push({ op: 'img', y: dy, h: dh });
    drawSlides(c, W, H, IM, G, off, 'right', k, undefined, 'y');
    const spans = c.calls.map((q) => [Math.max(0, q.y), Math.min(H, q.y + q.h)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    let reach = 0; for (const [a, b] of spans) { if (a > reach + G.gap * k + 0.01) break; reach = Math.max(reach, b); }
    assert.ok(reach >= H - 0.01, `★offset ${off} 에서 아래가 비었다(${reach})`);
  }
});

test('S7 칸별 폭 — 없으면 옛 셈 그대로 · 있으면 누적합 · 그림도 그 자리', () => {
  const U = slideGeom(800, 4, { cardW: 50, gap: 20 }, [undefined, null, '', undefined]);
  assert.deepEqual([U.uniform, U.cw, U.step, U.period, U.starts], [true, 400, 420, 1680, [0, 420, 840, 1260]], '★칸별 폭 없음 = 옛 기하(무변)');
  const V = slideGeom(800, 3, { cardW: 50, gap: 20 }, [25, undefined, 75]);   // 200 · 400 · 600
  assert.deepEqual([V.uniform, V.cws, V.starts, V.period], [false, [200, 400, 600], [0, 220, 640], 1260]);
  const A = { dwell: 1.5 }, per = SWIPE_MOVE_S + 1.5, T = 3 * per;
  const at = (sec) => slideOffset('slide-swipe', V, A, sec / T);
  assert.deepEqual([0, 1, 2].map((i) => at(i * per + SWIPE_MOVE_S + 0.01)), [220, 640, 0], '★머무름 = 다음 카드 왼끝(마지막 뒤 = 처음)');
  const c = fakeCtx(); drawSlides(c, 1000, 100, IM, V, 0, 'left', 1);
  const vis = c.calls.filter((q) => q.op === 'img' && q.x >= 0 && q.x < 1000).map((q) => [q.id, q.x, q.w]).sort((a, b) => a[1] - b[1]);
  assert.deepEqual(vis, [[0, 0, 200], [1, 220, 400], [2, 640, 600]], '★그림 자리·폭 = 칸별');
  assert.deepEqual([normCardW(5), normCardW(150), normCardW('33'), normCardW(undefined), normCardW('x')], [20, 100, 33, undefined, undefined]);
});
