/* grid-col-ratio-notice-239.dom.spec.js — 시트 239 꼴 · #grd-col-ratio(Grid·Duo·Infographic 같은 칸)가 있던 비율을 말없이 덮던 자.
 * ⛔이 자가 안 재는 것: 덮는 것 자체(abc → 균등은 그대로다 · 지디 물음 ③ · ⌘Z 로 돌아오는 것만 잠근다) · 열 수 2 밖의 그리드.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec); await window.addGridBlock();
    window.__id = sec.querySelector('.grid-block').id;
  });
  await page.evaluate(() => window.selectBlock(window.__id));
  await expect(page.locator('#grd-col-ratio'), '[전제] 비율 칸이 보인다').toBeVisible();
  await put(page, '3:1');
  await expect.poll(() => ratio(page), { message: '[전제] 있던 비율' }).toBe('3:1');
  await page.evaluate(() => document.getElementById('editor-toast')?.classList.remove('show'));
  return errs;
}
const toast = (page) => page.evaluate(() => { const t = document.getElementById('editor-toast'); return t && t.classList.contains('show') ? t.textContent : null; });
const put = async (page, v) => { const i = page.locator('#grd-col-ratio'); await i.click(); await i.press('ControlOrMeta+a'); if (v) await page.keyboard.type(v); else await page.keyboard.press('Backspace'); await page.keyboard.press('Enter'); };
const ratio = (page) => page.evaluate(() => JSON.parse(document.getElementById(window.__id).dataset.cols || '[]').map((c) => c.width).join(':'));

for (const [bad, want] of [['abc', '1:1'], ['-1', '1:1'], ['1:2:3', '1:2']]) {
  test(`덮으면(${bad} → ${want}) 말이 뜬다`, async ({ page }) => {
    const errs = await setup(page);
    await put(page, bad);
    await expect.poll(() => ratio(page), { message: '[전제] 고쳐 먹었다' }).toBe(want);
    await expect.poll(() => toast(page), { message: '값을 바꿨는데 말이 없다', timeout: 2500 }).toContain(`「${bad}」 를 「${want}」`);
    expect(errs).toEqual([]);
  });
}
for (const [ok, want] of [['1:2', '1:2'], ['4,1', '4:1'], ['', '1:1']]) {
  test(`[음성] 그대로 먹는 입력(${ok || '빈 칸'})엔 말이 안 뜬다`, async ({ page }) => {
    const errs = await setup(page);
    await put(page, ok);
    await expect.poll(() => ratio(page), { message: '[전제] 먹었다' }).toBe(want);
    expect(await toast(page)).toBeNull();
    expect(errs).toEqual([]);
  });
}
test('[대조] 덮인 비율은 ⌘Z 로 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  await put(page, 'abc');
  await expect.poll(() => ratio(page)).toBe('1:1');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => ratio(page)).toBe('3:1');
  expect(errs).toEqual([]);
});
