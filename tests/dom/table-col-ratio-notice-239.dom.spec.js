/* table-col-ratio-notice-239.dom.spec.js — 시트 239 ⒜ · 비율 칸의 잘못된 입력은 거절하고 값을 지킨다(현빈 결정 11-03)의 자.
 * 칸 = #tbl-col-ratio(type=text · prop-number-commit-guard 회원 아님) · 고치는 자리 = js/props/prop-table.js 의 그 칸 change 처리기.
 * ⛔이 자가 안 재는 것: 2 열 밖의 표.
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

const tip = (page) => page.evaluate(() => { const t = window.getHistoryTip(); return [t.pos, t.len]; });
for (const bad of ['abc', '-1', '-1:2', '1:2:3', '4', '1e999']) {
  test(`잘못된 입력(${bad})은 거절 — 값·칸·이력 그대로, 말한다`, async ({ page }) => {
    const errs = await setup(page);
    await put(page, '3:1');
    await expect.poll(() => ratio(page), { message: '[전제] 있던 비율' }).toBe('3:1');
    await page.evaluate(() => document.getElementById('editor-toast')?.classList.remove('show'));
    const t0 = await tip(page);
    await put(page, bad);
    await expect.poll(() => toast(page), { timeout: 2500 }).toContain(`「${bad}」: 쓸 수 없는 값이에요`);
    expect(await ratio(page)).toBe('3:1');
    await expect(page.locator('#tbl-col-ratio')).toHaveValue('3:1');
    expect(await tip(page)).toEqual(t0);
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
