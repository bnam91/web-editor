/* table-merge-one-notice.dom.spec.js — 현빈 결정 11-03 ② · 병합 있는 표에 0:1 → 병합이 풀리기 전에 말한다(지우는 동작은 유지)의 자.
 * ⛔이 자가 안 재는 것: 2 열 밖의 표 · 병합 여럿 중 일부만 푸는 입력(앱 값 없음).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec); window.addTableBlock();
    window.__id = sec.querySelector('.table-block').id;
    window.selectBlock(window.__id);
  });
  await expect(page.locator('#tbl-merge-headers'), '[전제] 병합 칸이 보인다').toBeVisible();
  return errs;
}
const toast = (page) => page.evaluate(() => { const t = document.getElementById('editor-toast'); return t && t.classList.contains('show') ? t.textContent : null; });
const hide = (page) => page.evaluate(() => document.getElementById('editor-toast')?.classList.remove('show'));
const put = async (page, v) => { const i = page.locator('#tbl-merge-headers'); await i.click(); await i.press('ControlOrMeta+a'); if (v) await page.keyboard.type(v); else await page.keyboard.press('Backspace'); await page.keyboard.press('Enter'); };
const merged = (page) => page.evaluate(() => document.getElementById(window.__id).dataset.mergedHeaderCols ?? null);
const merge = async (page) => { await put(page, '0:2'); await expect.poll(() => merged(page), { message: '[전제] 병합' }).toBe('[[0,2]]'); await hide(page); };

test('병합 있는 표에 0:1 — 말하고 푼다 · ⌘Z 로 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  await merge(page);
  await put(page, '0:1');
  await expect.poll(() => toast(page), { timeout: 2500 }).toContain('「0:1」 는 한 칸이라 병합이 아니에요');
  expect(await merged(page)).toBe(null);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => merged(page)).toBe('[[0,2]]');
  expect(errs).toEqual([]);
});
test('[음성] 병합 없는 표의 0:1 은 말이 없다', async ({ page }) => {
  const errs = await setup(page);
  await put(page, '0:1');
  await expect.poll(() => page.locator('#tbl-merge-headers').inputValue()).toBe('');
  expect(await toast(page)).toBeNull();
  expect(errs).toEqual([]);
});
test('[음성] 지우기 단추 · 빈 칸은 말없이 푼다', async ({ page }) => {
  const errs = await setup(page);
  await merge(page);
  await page.click('#tbl-merge-headers-clear');
  await expect.poll(() => merged(page)).toBe(null);
  expect(await toast(page)).toBeNull();
  await merge(page);
  await put(page, '');
  await expect.poll(() => merged(page)).toBe(null);
  expect(await toast(page)).toBeNull();
  expect(errs).toEqual([]);
});
test('[음성] 정상 병합 0:2 는 말이 없다', async ({ page }) => {
  const errs = await setup(page);
  await merge(page);
  expect(await toast(page)).toBeNull();
  expect(errs).toEqual([]);
});
