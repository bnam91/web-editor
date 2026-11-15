/* frame-width-field-clamped.dom.spec.js — FRAME-WIDTH-FIELD-SHOWS-UNCLAMPED-01 (0.9.12 · 지디 261116)
 * 섹션 직속 프레임을 끌기 «전» 고르면 우측 패널 너비 칸 860(dataset.width) · 화면 실제 716(섹션 안쪽 폭 상한).
 * 0.9.11 FRAME-HEIGHT-FIELD-SHOWS-UNCLAMPED-01(높이 칸 · frame-height-field-clamped.dom.spec.js)과 같은 꼴 — 칸 = 실제로 먹은 값.
 * ★고친 자리 = js/props/prop-frame.js _renderAutoPanel 의 폭 칸·슬라이더 value = 그려진 폭(panelRenderedPx 'width').
 *   W1 ★섹션 직속 기본 프레임(dataset 860 > 그려진 폭) — 칸·슬라이더 = 그려진 폭
 *   W2 [지킴] 상한 안 프레임(400) — 칸 = 400 = dataset = 그려진 폭(바뀌지 않는다)
 * 양성대조(srv 미실행): prop-frame.js 의 두 value="${shownW}" 를 value="${width}" 로 되돌리면 W1 빨강(칸 860) · W2 초록.
 * ⛔고정 대기 0 · 앱 = bootApp.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, w) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const pre = await page.evaluate(async (w) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const S = [...c.querySelectorAll('.section-block')].pop();
    window.deselectAll(); window._activeFrame = null; window.selectSection(S); window.addFrameBlock();
    const F = [...S.querySelectorAll('.frame-block:not([data-text-frame])')].pop(); F.id = 'wF';
    if (w) window.updateFrameBlock?.('wF', { width: w });
    window.deselectAll?.();
    return { dw: parseInt(F.dataset.width), drawn: Math.round(parseFloat(getComputedStyle(F).width)) };
  }, w);
  await page.click('#wF', { timeout: 2500, position: { x: 5, y: 5 } });
  await expect(page.locator('#ss-width-num'), '[전제] 프레임 패널(폭 칸)').toHaveCount(1);
  return { errs, pre };
}
const field = (page) => page.evaluate(() => ({ num: document.getElementById('ss-width-num').value, slider: document.getElementById('ss-width-slider').value }));

test('W1 ★섹션 직속 기본 프레임 — 끌기 전 칸 = 그려진 폭(섹션 안쪽 상한) · dataset 860 아님', async ({ page }) => {
  const { errs, pre } = await scene(page, 0);
  console.log('  W1:', JSON.stringify(pre));
  expect(pre.dw, '[전제] dataset 은 860').toBe(860);
  expect(pre.drawn, `[전제] 그려진 폭은 상한에 조여 860 보다 작다 ${JSON.stringify(pre)}`).toBeLessThan(860);
  expect(await field(page), '칸·슬라이더 = 실제 폭').toEqual({ num: String(pre.drawn), slider: String(pre.drawn) });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('W2 [지킴] 상한 안 프레임(400) — 칸 = 400 = dataset = 그려진 폭', async ({ page }) => {
  const { errs, pre } = await scene(page, 400);
  expect(pre, '[전제] 400 은 조이지 않는다').toEqual({ dw: 400, drawn: 400 });
  expect(await field(page)).toEqual({ num: '400', slider: '400' });
  expect(errs, errs.join('\n')).toEqual([]);
});
