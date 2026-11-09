/* grid-rowheight-fold-undo.dom.spec.js — t2-06 재검(QA): 「행 높이 (N행)」 을 펼친 뒤 ⌘Z/⌘⇧Z 가 패널을 다시 그리면 도로 접혔다.
 *   원인: 접힘 상태가 «블럭 요소» 키 WeakMap(js/props/_helpers.js) — history.js restoreSnapshot 이 블럭을 «같은 id 의 새 요소»로
 *   갈아끼워 상태가 비었다(열 간격은 요소를 안 바꿔 유지됐다). ⇒ id 로 든다.
 *   F0 새 그리드는 접힌 채 · F1 펼침 → 열 간격 변경 → ⌘Z → 펼침 유지 → ⌘⇧Z → 펼침 유지.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sF"><div class="section-inner" id="siF"></div></div>');
    window.rebindAll?.();
    window.selectSection(document.getElementById('sF'));
    window.addGridBlock?.({ cols: 2 });
    const g = document.querySelector('.grid-block');
    const cell = () => ({ lines: [{ type: 'body', text: 'x' }] });
    window.updateGridBlock(g.id, { rows: [0, 1, 2].map(() => ({ height: 'auto' })), cells: [0, 1, 2].map(() => [cell(), cell()]) });
    window.selectBlock?.(g);
    window.showGridProperties?.(g);
    return g.id;
  });
  return { errs, id };
}
const bodyDisplay = (page) => page.evaluate(() => {
  const b = document.getElementById('grd-rowh-body');
  return b ? getComputedStyle(b).display : null;
});
const clickAt = async (page, sel) => {
  const loc = page.locator(sel);
  await loc.scrollIntoViewIfNeeded();
  const r = await loc.boundingBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
};
const blur = (page) => page.evaluate(() => document.activeElement?.blur?.());

test('F0 새 그리드 — 「행 높이」 는 기본 접힘', async ({ page }) => {
  const s = await scene(page);
  await expect(page.locator('#grd-rowh-toggle')).toContainText('행 높이 (3행)');
  expect(await bodyDisplay(page)).toBe('none');
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('F1 펼침 → 열 간격 변경 → ⌘Z → 펼침 유지 → ⌘⇧Z → 펼침 유지', async ({ page }) => {
  const s = await scene(page);
  await clickAt(page, '#grd-rowh-toggle');
  expect(await bodyDisplay(page)).toBe('block');

  const gap0 = await page.evaluate((id) => document.getElementById(id).dataset.colGap, s.id);
  await clickAt(page, '#grd-col-gap-number');
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('31');
  await page.keyboard.press('Enter');
  await blur(page);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.colGap, s.id)).toBe('31');
  expect(await bodyDisplay(page), '전제: 열 간격 재렌더는 펼침을 지킨다').toBe('block');

  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.dataset.colGap, s.id)).toBe(gap0);
  await expect(page.locator('#grd-rowh-toggle')).toBeVisible();
  expect(await bodyDisplay(page), '★⌘Z 뒤 「행 높이」 가 도로 접혔다').toBe('block');

  await blur(page);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.dataset.colGap, s.id)).toBe('31');
  await expect(page.locator('#grd-rowh-toggle')).toBeVisible();
  expect(await bodyDisplay(page), '★⌘⇧Z 뒤 「행 높이」 가 도로 접혔다').toBe('block');
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
