/* frame-height-field-clamped.dom.spec.js — FRAME-HEIGHT-FIELD-SHOWS-UNCLAMPED-01
 * 프레임 높이 칸에 30 을 치면 실제 높이는 100(하한)인데 칸엔 30 이 남았다.
 * ★고친 자리 = js/props/_helpers.js bindSlider 의 number change — 확정(Enter·블러) 때 조인 값을 칸에 다시 쓴다.
 * ★누름 꼴: page.fill(=input) → Enter(=change). 치는 «도중»(input)에는 칸을 안 건드린다(F2).
 * 양성대조: _helpers.js 의 그 한 줄을 빼면 F1 빨강(칸 30). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sS"><div class="section-hitzone"></div>' +
      '<div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.();
    const S = document.getElementById('sS');
    window.selectSection(S); window.addFrameBlock();
    [...S.querySelectorAll('.frame-block:not([data-text-frame])')].pop().id = 'sF';
    window.deselectAll?.();
  });
  await page.click('#sF', { timeout: 2500, position: { x: 5, y: 5 } });
  expect(await page.locator('#ss-height-num').count(), '전제: 프레임 패널이 떴다(높이칸 있다)').toBe(1);
  expect(await page.locator('#ss-height-num').getAttribute('min'), '전제: 하한 100').toBe('100');
}
const H = (page) => page.evaluate(() => document.getElementById('sF').style.height);

test('F1 ★30 을 치고 확정하면 칸에 100 이 보이고 실제도 100', async ({ page }) => {
  await scene(page);
  await page.fill('#ss-height-num', '30');
  await page.press('#ss-height-num', 'Enter');
  expect(await H(page), '실제 높이').toBe('100px');
  expect(await page.inputValue('#ss-height-num'), '칸 = 실제').toBe('100');
  expect(await page.inputValue('#ss-height-slider'), '슬라이더 = 실제').toBe('100');
});
test('F2 치는 도중(input)엔 칸을 안 덮는다 — 300 을 한 자씩 쳐도 300', async ({ page }) => {
  await scene(page);
  await page.fill('#ss-height-num', '');
  await page.type('#ss-height-num', '300');
  expect(await page.inputValue('#ss-height-num')).toBe('300');
  await page.press('#ss-height-num', 'Enter');
  expect(await H(page)).toBe('300px');
  expect(await page.inputValue('#ss-height-num')).toBe('300');
});
test('F3 상한도 같다 — 5000 → 1200', async ({ page }) => {
  await scene(page);
  await page.fill('#ss-height-num', '5000');
  await page.press('#ss-height-num', 'Enter');
  expect(await H(page)).toBe('1200px');
  expect(await page.inputValue('#ss-height-num')).toBe('1200');
});
