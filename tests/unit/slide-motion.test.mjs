/* slide-motion — 0.9.13 MOTION-SLIDE-BLOCK-01 슬라이드 움직임 셈(js/fx/slide-motion.js · 순수).
 * S1 흐름: 한 바퀴 = 주기/속도 · t 0 과 1 이 같은 자리(끊김 0) · 한 방향으로만 늘어남
 * S2 스와이프: 장마다 머무름 동안 제자리(i × 한 칸) · 넘김 가운데는 사이 · 끝 = 처음
 * S3 GIF 60 상한: 짧은 바퀴 = 20fps 그대로 · 긴 바퀴(12초) = 60프레임 · 5fps 로 낮춤 + 안내 줄이 몇 fps 인지 말함(지디 결정 ⓑ)
 * S4 그림 자리: offset 0 = 카드 i 왼끝 i×(카드 폭+간격)×k(정적 첫 장면 flex 줄과 같은 자리) · 오른쪽 흐름 = 반대 부호 · 주기 끝에서도 화면 폭을 다 덮음
 * S5 소독: 범위 밖 값은 고정 · 기본값이면 저장 키 없음
 * S6 세로(2단계 · ② 세로 스크롤): 세로 흐름 = 흐름 셈 · 세로 넘김 = 스와이프 셈 · 그림은 y 축(카드 i 위끝 = i × 한 칸 × k · 폭 = 캔버스 폭) · 주기 끝에도 높이를 다 덮음
 *   양성대조(CTL2): drawSlides 의 `const y = axis === 'y'` → `const y = false` → S6 빨강
 * S13 격자 줌아웃(SLIDE-FX-GRID-ZOOMOUT-01): t=0 = 히어로 한 장(첫 장면 크기 · 가운데) · 둘레 들어오는 중 알파 0~1 · 끝 = 7×7(고리 ≤3 49장 전부 알파 1 · 그 밖 고리 = GZ_OUTER_A) · 나선 순번 · 한 바퀴 GZ_S÷속도
 * S12 겹침 간격(SLIDE-FX-OVERLAP-GAP-01): 간격 −80 까지(−99 → −80) · 한 칸 = 카드 + 간격 · ★그림 = 자리 순서(감긴 마지막 카드가 첫 카드 밑 · 뒤 카드 위)
 * S11 전후 비교(SLIDE-FX-BEFORE-AFTER-WIPE-01): 나눔선 t=0 = 0.5(첫 장면) · ¼ = 0.8 · ¾ = 0.2 · 한 바퀴 = WIPE_S ÷ 속도 · 그리기 = 후 꽉 → 전 clip(0..p·W) → 선 → 손잡이
 * S10 가운데 캐러셀(SLIDE-FX-CENTER-CAROUSEL-01): t=0 = 둘째 카드 가운데(s = 시작₁ − (bw−cw)/2) · 머무름 = 셋째 가운데 · 마지막 → 첫째(주기 끝) · 앞 번호 · 첫 장면 밀기 글자
 * S9 제자리(SLIDE-FX-SINGLE-FRAME-MULTI-01): 넘김과 같은 박자(loopSec 같음) · 바뀜 중 f 0→1 · 머무름 f 1 · 마지막 → 처음 · 페이드 = to 알파 f · 컷 = f<1 from / 1 to · 보이는 번호
 * S8 점 표시(SLIDE-INDICATOR-DOTS-01): slideActiveIndex = 왼끝이 지난 마지막 카드(균일·칸별) · drawDots = n 점 · active 만 DOT_ON · 위/아래 띠 가운데 y · 'none' 이면 안 그림
 *   양성대조(CTL · _patches/slide-fx-CTL1-no-gif-dots.patch — DOM 쪽): slidePlan 의 drawDots 줄 삭제 → slide-fx D1 GIF 점 빨강 — 예측
 * S7 칸별 폭(SLIDE-CELL-SIZE-EACH-01): ws 없음/전부 빈 값 = uniform(옛 셈 그대로 · starts = i×한 칸) · ws 있음 = 카드 왼끝 = 앞 카드 (폭+간격) 누적합 ·
 *    주기 = 합 · 스와이프 머무름 = 다음 카드 왼끝 · 그림 = 그 자리·그 폭 · 소독 20~100
 *   양성대조(CTL3 · _patches/slide-fb-CTL3-uniform-draw.patch): drawSlides 의 `const uni = geom.uniform !== false;` → `const uni = true;` → S7 빨강(그림이 균일 자리)
 * 양성대조(예측 · CTL): slideOffset 첫 줄 `const tt = ((t % 1) + 1) % 1;` → `const tt = t;`(한 바퀴 감기 없앰) → S1 빨강(t 1 ≠ 0) · 스와이프 `: 1;` → `: 0;` → S2 빨강 · gifPlan 의 `Math.min(GIF_FRAMES_MAX, …)` 를 `Math.round(s * GIF_FPS_MAX)` 로 → S3 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { gridZoomFrame, gridSpiralIndex, slideGridZoom, GZ_S, GZ_OUTER_A, slideWipe, wipePos, drawWipe, WIPE_S, centerState, centerTrackShift, slideCentered, inPlaceState, drawInPlace, slideInPlace, slideActiveIndex, drawDots, DOT_ON, DOT_OFF, DOT_BAND, normCardW, slideGeom, slideOffset, loopSec, gifPlan, slideInfoText, drawSlides, normLayout, normAnim, diffFromDefault, slideAxis,
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
  assert.deepEqual(normLayout({ cardW: 999, gap: -5, h: 'x' }), { cardW: 100, gap: 0, h: SLIDE_LAYOUT_DEFAULT.h, dots: 'none' });   // dots = SLIDE-INDICATOR-DOTS-01 새 칸(기본 none)
  assert.equal(normLayout({ dots: '<x>' }).dots, 'none', '점 표시 소독');
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

test('S8 점 표시 — 앞 카드 번호 · 점 그리기', () => {
  const U = slideGeom(800, 4, { cardW: 50, gap: 20 });   // 한 칸 420
  assert.deepEqual([0, 419, 420, 1300, 1679].map((x) => slideActiveIndex(U, x)), [0, 0, 1, 3, 3]);
  const V = slideGeom(800, 3, { cardW: 50, gap: 20 }, [25, undefined, 75]);   // starts 0·220·640
  assert.deepEqual([0, 219, 220, 640, 1259].map((x) => slideActiveIndex(V, x)), [0, 0, 1, 2, 2]);
  const calls = []; const ctx = { set fillStyle(v) { calls.push({ c: v }); }, beginPath() {}, arc(x, y, r) { calls[calls.length - 1].x = x; calls[calls.length - 1].y = y; calls[calls.length - 1].r = r; }, fill() {} };
  drawDots(ctx, 400, 300, 3, 1, 'top', 1);
  assert.deepEqual(calls.map((q) => q.c), [DOT_OFF, DOT_ON, DOT_OFF]);
  assert.ok(calls.every((q) => q.y === DOT_BAND / 2), '위 띠 가운데');
  assert.ok(calls[0].x < calls[1].x && calls[1].x < calls[2].x && Math.abs(calls[1].x - 200) < 0.01, '가운데 정렬');
  const b = []; drawDots({ set fillStyle(v) { b.push(v); }, beginPath() {}, arc(x, y) { b.push(y); }, fill() {} }, 400, 300, 2, 0, 'bottom', 2);
  assert.equal(b[1], 300 - DOT_BAND, '아래 띠 가운데(k 2)');
  const n = []; drawDots({ set fillStyle(v) { n.push(v); }, beginPath() {}, arc() {}, fill() {} }, 400, 300, 3, 0, 'none', 1);
  assert.equal(n.length, 0);
});

test('S9 제자리 — 박자 · 바뀜 진행 · 페이드 알파 · 컷', () => {
  const A = { dwell: 1.5 }, per = SWIPE_MOVE_S + 1.5, T = 3 * per, G3 = slideGeom(800, 3, { cardW: 50, gap: 20 });
  assert.equal(slideInPlace('slide-fade') && slideInPlace('slide-cut') && !slideInPlace('slide-swipe'), true);
  assert.equal(loopSec('slide-fade', G3, A), loopSec('slide-swipe', G3, A));
  const at = (sec) => inPlaceState(3, A, sec / T);
  assert.deepEqual(at(0), { from: 0, to: 1, f: 0 });
  const mid = at(SWIPE_MOVE_S / 2); assert.ok(mid.f > 0.4 && mid.f < 0.6, `바뀜 가운데 f ${mid.f}`);
  assert.deepEqual(at(SWIPE_MOVE_S + 0.1), { from: 0, to: 1, f: 1 }, '머무름 = 다음 장 다 들어옴');
  assert.deepEqual([at(2 * per + 0.1).from, at(2 * per + 0.1).to], [2, 0], '마지막 → 처음');
  const log = []; const ctx = { save() {}, restore() {}, set globalAlpha(v) { log.push(['a', v]); }, set fillStyle(v) {}, fillRect() {}, drawImage(im) { log.push(['img', im.id]); } };
  const IM2 = [{ id: 'r', width: 10, height: 10 }, { id: 'b', width: 10, height: 10 }];
  assert.equal(drawInPlace(ctx, 100, 50, IM2, { from: 0, to: 1, f: 0.3 }, 'slide-fade'), 0);
  assert.deepEqual(log, [['a', 1], ['img', 'r'], ['a', 0.3], ['img', 'b']], '페이드 = from 위에 to 알파 f');
  log.length = 0;
  assert.equal(drawInPlace(ctx, 100, 50, IM2, { from: 0, to: 1, f: 0.3 }, 'slide-cut'), 0); assert.deepEqual(log, [['a', 1], ['img', 'r']]);
  log.length = 0;
  assert.equal(drawInPlace(ctx, 100, 50, IM2, { from: 0, to: 1, f: 1 }, 'slide-cut'), 1); assert.deepEqual(log, [['a', 1], ['img', 'b']]);
});

test('S10 가운데 캐러셀 — 둘째부터 · 가운데 맞춤 · 앞 번호 · 첫 장면 밀기', () => {
  const G4 = slideGeom(800, 4, { cardW: 50, gap: 20 }), A = { dwell: 1.5 }, per = SWIPE_MOVE_S + 1.5, T = 4 * per;
  assert.equal(slideCentered('slide-center'), true);
  assert.equal(loopSec('slide-center', G4, A), loopSec('slide-swipe', G4, A));
  const at = (sec) => centerState(G4, A, sec / T);
  assert.deepEqual(at(0), { s: 420 - 200, active: 1 }, '★t=0 = 둘째 카드 가운데');
  assert.deepEqual(at(SWIPE_MOVE_S + 0.1), { s: 840 - 200, active: 2 }, '머무름 = 셋째 가운데');
  assert.deepEqual(at(2 * per + SWIPE_MOVE_S + 0.1), { s: 1680 - 200, active: 0 }, '넷째 → 첫째(주기 끝으로 앞으로만)');
  assert.equal(centerTrackShift([50, 50, 50], 20), 'calc(-25% - 20px)', '첫 장면 = 둘째 가운데((100−50)/2 − 50 % · − 간격)');
  assert.equal(centerTrackShift([60], 16), 'calc(20% - 0px)', '한 장이면 첫째 가운데');
});

test('S11 전후 비교 — 나눔선 자리 · 한 바퀴 · 그리기 순서', () => {
  assert.equal(slideWipe('slide-wipe'), true);
  assert.ok(Math.abs(wipePos(0) - 0.5) < 1e-9 && Math.abs(wipePos(0.25) - 0.8) < 1e-9 && Math.abs(wipePos(0.75) - 0.2) < 1e-9 && Math.abs(wipePos(1) - 0.5) < 1e-9);
  assert.equal(loopSec('slide-wipe', slideGeom(800, 2, {}), { speed: 2 }), WIPE_S / 2);
  const log = []; const ctx = { save() {}, restore() {}, beginPath() {}, clip() { log.push('clip'); }, rect(x, y, w) { log.push(['rect', w]); }, set fillStyle(v) {}, fillRect(x) { log.push(['line', Math.round(x)]); }, arc(x) { log.push(['knob', x]); }, fill() {}, drawImage(im) { log.push(['img', im.id]); } };
  drawWipe(ctx, 200, 100, [{ id: 'before', width: 10, height: 10 }, { id: 'after', width: 10, height: 10 }], 0.3, 1);
  assert.deepEqual(log, [['img', 'after'], ['rect', 60], 'clip', ['img', 'before'], ['line', 59], ['knob', 60]]);
});

test('S12 겹침 간격 — 소독 · 한 칸 · 그림 순서', () => {
  assert.equal(normLayout({ gap: -99 }).gap, -80);
  assert.equal(normLayout({ gap: -30 }).gap, -30);
  const O = slideGeom(800, 3, { cardW: 50, gap: -40 });   // 카드 400 · 한 칸 360
  assert.deepEqual([O.step, O.period, O.starts], [360, 1080, [0, 360, 720]]);
  const c = fakeCtx(); drawSlides(c, 1000, 100, IM, O, 0, 'left', 1);
  assert.deepEqual(c.calls.filter((q) => q.op === 'img').map((q) => [q.id, q.x]), [[2, -360], [0, 0], [1, 360], [2, 720]],
    '★자리 순서로 그림(왼→오) — 감긴 셋째(−360)가 첫째 «밑» · 뒤 카드가 위 = 첫 장면 DOM 과 같음');
});

test('S13 격자 줌아웃 — 히어로 · 들어옴 · 7×7 · 나선', () => {
  assert.equal(slideGridZoom('slide-gridzoom'), true);
  assert.equal(loopSec('slide-gridzoom', slideGeom(800, 3, {}), { speed: 2 }), GZ_S / 2);
  const f0 = gridZoomFrame(0, 800, 400, 60, 16);
  assert.deepEqual(f0.tiles.map((t) => [t.x, t.y, t.w, t.h, t.idx, t.a]), [[160, 0, 480, 400, 0, 1]], '★t=0 = 히어로 한 장(가운데 · 카드 폭 60% × 블럭 높이)');
  const mid = gridZoomFrame(1.0 / GZ_S, 800, 400, 60, 16);   // u = 1.0(작아지는 중)
  const ring1 = mid.tiles.filter((t) => t.idx >= 1 && t.idx <= 8);
  assert.ok(ring1.length === 8 && ring1.every((t) => t.a > 0 && t.a < 1), '둘레 3×3 이 옅게 들어오는 중');
  const end = gridZoomFrame(0.9, 800, 400, 60, 16);
  const inner = end.tiles.filter((t) => t.idx <= 48), outer = end.tiles.filter((t) => t.idx > 48);
  assert.equal(inner.length, 49, '★7×7 전부'); assert.ok(inner.every((t) => t.a === 1));
  assert.ok(outer.every((t) => t.a === GZ_OUTER_A), '7×7 밖 한 바퀴 = 옅게');
  const h = inner.find((t) => t.idx === 0); assert.ok(Math.abs(h.x + h.w / 2 - 400) < 1e-6 && Math.abs(h.y + h.h / 2 - 200) < 1e-6, '가운데 = 첫째');
  assert.ok(h.h * 7 <= 400 + 1e-6, '7 장이 블럭 높이 안');
  assert.deepEqual([gridSpiralIndex(0, 0), gridSpiralIndex(-1, 0), gridSpiralIndex(-1, 1), gridSpiralIndex(0, 1), gridSpiralIndex(1, 0)], [0, 1, 2, 3, 5], '나선 = 위부터 시계 방향');
});
