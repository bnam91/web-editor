/* table-col-ratio-notice-239.dom.spec.js — 시트 239 ⒜ 「숫자 칸 회원이 아닌 비율 칸이 말없이 값을 고쳐 먹는다」의 자.
 * 칸 = #tbl-col-ratio(type=text · prop-number-commit-guard 회원 아님) · 고치는 자리 = js/props/prop-table.js 의 그 칸 change 처리기.
 * ⛔이 자가 안 재는 것: 칸 되돌리기(abc 가 있던 비율을 1:1 로 바꾸는 것은 그대로다 · 지디 물음) · 2 열 밖의 표.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec); window.addTableBlock();
    window.__t = sec.querySelector('.table-block');
  });
  const r = await page.evaluate(() => { const b = window.__t.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.mouse.click(r[0], r[1]);
  await expect(page.locator('#tbl-col-ratio'), '[전제] 비율 칸이 보인다').toBeVisible();
  return errs;
}
const toast = (page) => page.evaluate(() => { const t = document.getElementById('editor-toast'); return t && t.classList.contains('show') ? t.textContent : null; });
const put = async (page, v) => { const i = page.locator('#tbl-col-ratio'); await i.click(); await i.press('ControlOrMeta+a'); if (v) await page.keyboard.type(v); else await page.keyboard.press('Backspace'); await page.keyboard.press('Tab'); };
const ratio = (page) => page.evaluate(() => window.__t.dataset.colWidths ?? null);

for (const [bad, want] of [['abc', '1:1'], ['-1:2', '2:1'], ['1:2:3', '1:2']]) {
  test(`고쳐 먹으면(${bad} → ${want}) 말이 뜬다`, async ({ page }) => {
    const errs = await setup(page);
    await put(page, bad);
    await expect.poll(() => ratio(page), { message: '[전제] 고쳐 먹었다' }).toBe(want);
    await expect.poll(() => toast(page), { message: '값을 바꿨는데 말이 없다', timeout: 2500 }).toContain(`「${bad}」 를 「${want}」`);
    expect(errs).toEqual([]);
  });
}
for (const [ok, want] of [['1:2', '1:2'], ['3,1', '3:1'], ['', '1:1']]) {
  test(`[음성] 그대로 먹는 입력(${ok || '빈 칸'})엔 말이 안 뜬다`, async ({ page }) => {
    const errs = await setup(page);
    if (!ok) await put(page, '5:1');
    await expect.poll(async () => { await page.evaluate(() => document.getElementById('editor-toast')?.classList.remove('show')); return toast(page); }).toBeNull();
    await put(page, ok);
    await expect.poll(() => ratio(page), { message: '[전제] 먹었다' }).toBe(want);
    expect(await toast(page)).toBeNull();
    expect(errs).toEqual([]);
  });
}
