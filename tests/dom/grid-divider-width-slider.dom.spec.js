/* grid-divider-width-slider.dom.spec.js — 현빈QA GRID-DIVIDER-SLIDER
 *   구분선 너비(%) #grd-divider-w → 「슬라이더 + 숫자」(굵기 #grd-border-w-slider/-number 와 같은 bindSlider).
 *   D1 마크업이 굵기 줄과 같은 꼴(prop-label · range.prop-slider · number.prop-number) · 진짜 마우스로 끌면 숫자·모델이 따라온다 ·
 *      ⌘Z 한 번 = 끌기 전(꽉 참)
 *   D2 숫자 입력 → 슬라이더 따라옴 · 확정 · 빈 칸 확정 = 꽉 참(widthPct 없음 · 예전 뜻 그대로)
 * ★양성대조: prop-grid.js 를 6c56d4620 판으로 되돌리면 D1·D2 빨강(슬라이더가 없다). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const COND_MS = 15000;
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const lines = [{ type: 'body', text: 'A' }, { type: 'divider', height: 4, color: '#000000' }, { type: 'body', text: 'C' }];
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
    window.selectBlock(g); window.showGridProperties(g, { r: 0, c: 0, li: 1 }); window.clearHistory?.();
  });
  await page.waitForFunction(() => !!document.getElementById('grd-divider-w-slider'), null, { timeout: COND_MS });
}
const st = (page) => page.evaluate(() => ({
  slider: document.getElementById('grd-divider-w-slider')?.value, number: document.getElementById('grd-divider-w')?.value,
  pct: JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[1].widthPct ?? null,
}));

test('D1 굵기 줄과 같은 꼴 · 끌면 숫자·모델이 따라온다 · ⌘Z 한 번 = 끌기 전', async ({ page }) => {
  await setup(page);
  const shape = await page.evaluate(() => [...document.getElementById('grd-divider-w').closest('.prop-row').children].map(e => e.tagName + '.' + e.className + (e.type ? ':' + e.type : '')));
  expect(shape).toEqual(['SPAN.prop-label', 'INPUT.prop-slider:range', 'INPUT.prop-number:number']);
  expect(await st(page)).toEqual({ slider: '100', number: '', pct: null });
  const r = await waitStableRect(page, '#grd-divider-w-slider');
  await page.mouse.move(r.left + r.width - 2, r.cy); await page.mouse.down();
  await page.mouse.move(r.left + r.width * 0.6, r.cy, { steps: 4 });
  await page.mouse.move(r.left + r.width * 0.5, r.cy, { steps: 4 });
  await page.mouse.up();
  const s = await st(page);
  expect(Number(s.slider)).toBeGreaterThan(5); expect(Number(s.slider)).toBeLessThan(80);
  expect(s.number).toBe(s.slider); expect(s.pct).toBe(Number(s.slider));
  await page.waitForFunction((p) => new RegExp(`width:${p}%`).test(document.querySelector('#gG .grd-divider')?.getAttribute('style') || ''), s.pct, { timeout: COND_MS });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[1])))
    .toMatchObject({ height: 4 });
  expect((await page.evaluate(() => JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[1])).widthPct, '⌘Z 한 번에 끌기 전체가 풀린다').toBeUndefined();
});

test('D2 숫자 → 슬라이더 따라옴 · 빈 칸 확정 = 꽉 참', async ({ page }) => {
  await setup(page);
  await page.locator('#grd-divider-w').fill('40');
  await page.locator('#grd-divider-w').press('Enter');
  expect(await st(page)).toEqual({ slider: '40', number: '40', pct: 40 });
  await page.locator('#grd-divider-w').fill('');
  await page.locator('#grd-divider-w').press('Enter');
  await page.locator('#grd-divider-w').blur();
  await expect.poll(() => st(page)).toMatchObject({ slider: '100', pct: null });
});
