/* ft-scaleof-fractional-width.dom.spec.js
 *   ★114 — 자유변형 배율 자 `_scaleOf`(화면 폭 ÷ offsetWidth)의 ★분모가 정수다 ⇒ 소수 폭에서 배율 100 인데 z ≠ 1.
 *   ★앱 실측(S6 261029 · 판 333aa3d9 · p114snap ×1): ⌘Z 셋째 복원에서 tf 폭 338.344px · offsetWidth 338
 *     ⇒ z = 338.34375/338 = 1.0010170 ⇒ ftMeasure W·H 가 «같은 나눗셈 하나»로 338 × 42.956 ⇒ :356~359 refit 이
 *     338.34 × 43 칸을 338 × 42.96 으로 덮고 _restampRestored 가 그 칸에 구웠다(스냅샷은 338.34 × 43 이었다 = ㉣).
 *   ★정의가 둘이다 — ㉮ effects-freetransform.js `_scaleOf`(부름 :242 ftMeasure) · ㉯ effects-ft-handles.js 사본(부름 :154 · :225 · :301).
 *     ⇒ 한 쌍은 «1 ＋ 2» 로 갈라 건다(지디 13:2x ⑶ «1 ＋ 3» 에서 하나 뺌):
 *       ㉯ :154(ftHandlesSync)는 읽고 안 쓴다(:212 `void scale;`) ⇒ 그 부름은 무력화해도 바뀌는 출력이 없다 — ⛔빨강을 만들 수 없는 칸.
 *     S1 = ㉮ 소비자(ftMeasure → 바탕 네모 refit) · H1 = ㉯ :225(손잡이 끌기) · H2 = ㉯ :301(섹션 안으로 되찾기).
 *   ★전제(시험은 제 전제를 단언한다 · 지디 13:2x ⑤): ① currentZoom 100 ② #canvas-scaler 계산 배율 == currentZoom/100 · 멎음
 *     (waitZoomSettled — 맨 applyZoom 은 0.15s 보간 · fx-add 의 z 0.9157 은 그 보간으로 읽힌다 ㉡) ③ S1: 안 끌었다(tfTouched 없음) ∧ 네 점 = 바탕 네모
 *     ＋ 장면 전제: 재는 상자 폭이 소수다(|화면 폭 − offsetWidth| ≥ 0.25) — 이게 안 서면 이 장면은 정수 분모를 안 밟는다.
 *   ⛔z == 1 을 맨몸으로 걸지 않는다 — 주 단언은 «소수 폭에서 W·H·이동량 == 화면 날값 ÷ 참 배율».
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft-scaleof-fractional-width
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, bootApp, waitZoomSettled } = require('./_root-harness.js');

const TF_W = 300.5;        /* 재는 폭(소수 · .5 = 정수 반올림 오차가 가장 큰 꼴) */
const EDGE_IN = 8;         /* effects-ft-handles.js `const EDGE_IN = 8;` — H2 가 소스에서 같은지 먼저 본다 */

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((tfW) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    sec.querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());
    window.selectSection(sec);
    window.addTextBlock('body', { content: 'Scale ruler 배율 자' });
    window.applyZoom?.(100);
    const tb = sec.querySelector('.text-block');
    const tf = tb.closest('.frame-block[data-text-frame]');
    tf.style.width = tfW + 'px'; tf.dataset.width = String(tfW);
    window.__tb = tb; window.__sec = sec;
    tb.scrollIntoView({ block: 'center' });
    window.selectBlock(tb.id);
  }, TF_W);
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => !!document.getElementById('txt-fx-add'));
  await page.selectOption('#txt-fx-add', 'freetransform');
  await page.waitForFunction(() => window.__tb.querySelectorAll('.tfh-handle').length === 12);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return errs;
}

/* 전제 ①② — 배율 100 이고 scaler 가 그 배율에 멎었다 · 참 배율(a)을 돌려준다 */
async function premiseZoom(page) {
  const z = await page.evaluate(() => {
    const sc = document.getElementById('canvas-scaler'); const m = getComputedStyle(sc).transform;
    return { zoom: window.currentZoom, a: m === 'none' ? 1 : new DOMMatrix(m).a, moving: sc.getAnimations().some((x) => x.transitionProperty === 'transform') };
  });
  expect(z.zoom, '전제① 배율 100 이 아니다').toBe(100);
  expect(Math.abs(z.a - 1), `전제② scaler 계산 배율이 1 이 아니다(${z.a})`).toBeLessThan(1e-6);
  expect(z.moving, '전제② scaler 가 아직 보간 중이다').toBe(false);
  return z.a;
}

/* 장면 전제 — 이 상자 폭이 소수인가(정수 분모를 밟는 장면인가) */
const fracOf = (page, sel) => page.evaluate((sel) => { const el = sel === 'tb' ? window.__tb : window.__tb.closest('.frame-block[data-text-frame]'); return { rw: el.getBoundingClientRect().width, ow: el.offsetWidth }; }, sel);

const handle = (page, name) => page.evaluate((name) => {
  const h = window.__tb.querySelector(`:scope > .tfh-layer > [data-tfh="${name}"]`); const r = h.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}, name);
const corners = (page) => page.evaluate(() => window.__tb.dataset.tfCorners.split(',').map(Number));

test('S1 ㉮ ftMeasure — 소수 재는 폭에서 W·H 가 글자 날값과 같고 바탕 네모가 그 값으로 선다', async ({ page }) => {
  const errs = await setup(page);
  const a = await premiseZoom(page);
  const f = await fracOf(page, 'tf');
  expect(Math.abs(f.rw - f.ow), `장면 전제: 재는 폭(tf)이 소수가 아니다 (${f.rw} vs ${f.ow})`).toBeGreaterThanOrEqual(0.25);
  const r = await page.evaluate(async () => {
    const ft = await import('/js/effects-freetransform.js');
    const tb = window.__tb;
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    const rng = document.createRange(); rng.selectNodeContents(ce); const g = rng.getBoundingClientRect(); rng.detach?.();
    const st = ft.ftStateOf(tb);
    return { touched: tb.dataset.tfTouched ?? null, C: tb.dataset.tfCorners.split(',').map(Number), W: st && st.W, H: st && st.H, measW: st && st.tfMeasW, gW: g.width, gH: g.height };
  });
  /* 전제③ — 안 끌었다 ∧ 바탕 네모(refit 갈래를 탄 꼴) */
  expect(r.touched, '전제③ tfTouched 가 있다 — 끈 블록이다').toBeNull();
  const [x0, y0, x1, y1, x2, y2, x3, y3] = r.C;
  expect([x0, y0, y1, x3], '전제③ 네 점이 바탕 네모가 아니다').toEqual([0, 0, 0, 0]);
  expect([x2, y2], '전제③ 네 점이 바탕 네모가 아니다').toEqual([x1, y3]);
  expect(r.measW, '장면 전제: 재는 폭이 TF_W 가 아니다').toBe(TF_W + 'px');
  /* 주 단언 — 화면 날값 ÷ 참 배율 */
  expect(Math.abs(r.W - r.gW / a), `W ${r.W} ≠ 글자 ${r.gW / a}`).toBeLessThan(0.02);
  expect(Math.abs(r.H - r.gH / a), `H ${r.H} ≠ 글자 ${r.gH / a}`).toBeLessThan(0.02);
  expect(Math.abs(x2 - r.gW / a), `바탕 네모 폭 ${x2} ≠ 글자 ${r.gW / a}`).toBeLessThan(0.011);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('H1 ㉯ :225 손잡이 끌기 — 소수 폭 상자에서 모서리 이동량 == 마우스 이동량 ÷ 참 배율', async ({ page }) => {
  const errs = await setup(page);
  const a = await premiseZoom(page);
  await page.evaluate(() => { const tb = window.__tb; tb.style.width = (Math.floor(tb.getBoundingClientRect().width) + 0.5) + 'px'; });
  const f = await fracOf(page, 'tb');
  expect(Math.abs(f.rw - f.ow), `장면 전제: 글상자 폭이 소수가 아니다 (${f.rw} vs ${f.ow})`).toBeGreaterThanOrEqual(0.25);
  const C0 = await corners(page);
  const [sx, sy] = await handle(page, 'se');
  const DX = 150, DY = 90;
  await page.mouse.move(sx, sy); await page.mouse.down();
  await page.mouse.move(sx + DX, sy + DY, { steps: 6 }); await page.mouse.up();
  const C1 = await corners(page);
  expect(Math.abs((C1[4] - C0[4]) - DX / a), `se x 이동 ${C1[4] - C0[4]} ≠ ${DX / a}`).toBeLessThan(0.03);
  expect(Math.abs((C1[5] - C0[5]) - DY / a), `se y 이동 ${C1[5] - C0[5]} ≠ ${DY / a}`).toBeLessThan(0.03);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('H2 ㉯ :301 섹션 안으로 되찾기 — 소수 폭 상자에서 되찾은 손잡이가 정확히 안쪽 EDGE_IN 자리에 선다', async ({ page }) => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'effects-ft-handles.js'), 'utf8');
  expect(src.includes(`const EDGE_IN = ${EDGE_IN};`), '전제: 소스의 EDGE_IN 이 이 시험의 값과 다르다').toBe(true);
  const errs = await setup(page);
  const a = await premiseZoom(page);
  /* se 를 섹션 오른쪽 밖 200px 로 — 배율 1 이라 화면 px == 모델 px(전제②) */
  await page.evaluate(async (a) => {
    const ft = await import('/js/effects-freetransform.js');
    const tb = window.__tb, sec = window.__sec;
    const box = (sec.querySelector(':scope > .section-inner') || sec).getBoundingClientRect();
    const h = tb.querySelector(':scope > .tfh-layer > [data-tfh="se"]').getBoundingClientRect();
    const C = tb.dataset.tfCorners.split(',').map(Number);
    const q = [[C[0], C[1]], [C[2], C[3]], [C[4] + (box.right + 200 - (h.left + h.width / 2)) / a, C[5]], [C[6], C[7]]];
    ft.setFxFreeTransform(tb, q, { history: false, touched: true });
    window.ftHandlesSync?.(tb);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, a);
  const left0 = await page.evaluate(() => window.__tb.getBoundingClientRect().left);
  await page.evaluate(() => { const tb = window.__tb; tb.style.width = (Math.floor(tb.getBoundingClientRect().width) + 0.5) + 'px'; });
  const f = await fracOf(page, 'tb');
  expect(Math.abs(f.rw - f.ow), `장면 전제: 글상자 폭이 소수가 아니다 (${f.rw} vs ${f.ow})`).toBeGreaterThanOrEqual(0.25);
  expect(Math.abs(await page.evaluate(() => window.__tb.getBoundingClientRect().left) - left0), '장면 전제: 폭을 바꾸니 글상자 왼쪽이 움직였다').toBeLessThan(0.01);
  const boxR = await page.evaluate(() => { const sec = window.__sec; return (sec.querySelector(':scope > .section-inner') || sec).getBoundingClientRect().right; });
  const [x0] = await handle(page, 'se');
  expect(x0, '장면 전제: se 가 섹션 밖에 있지 않다').toBeGreaterThan(boxR + 100);
  const n = await page.evaluate(() => window.ftPullCornersIntoSection(window.__tb));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(n, '되찾은 모서리가 없다').toBeGreaterThanOrEqual(1);
  const [x1] = await handle(page, 'se');
  expect(Math.abs(x1 - (boxR - EDGE_IN)), `되찾은 se ${x1} ≠ 안쪽 자리 ${boxR - EDGE_IN}`).toBeLessThan(0.05);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});
