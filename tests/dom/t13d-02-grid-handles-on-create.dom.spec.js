/* t13d-02 — 0.9.13 t13D-02 그리드 블록 최초 생성 직후 일부 핸들 미표시
 * 원인: addGridBlock 이 selectBlock(MCP 진입점)만 불러 showHandlesFor 가 안 돌았다 → 모서리·변 손잡이 8개(.grd-overlay-handle)가 0개.
 *   클릭해야 서던 것(block-drag.js 클릭 경로만 showHandlesFor 호출) — zoom/modal/coupon 추가 경로가 같은 병을 같은 식으로 고쳤다.
 * A1 Grid 버튼(onclick=addGridBlock) 직후 = 선택됨 · 손잡이 8개 · 보임 · 클릭 경로와 같은 수
 * 양성대조: _patches/t13d-02-CTL.patch(showHandlesFor 줄 뺌) → A1 빨강(0개).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const handles = (page) => page.evaluate(() => [...document.querySelectorAll('#ss-handles-overlay [data-grd-resize-dir]')]
  .filter((h) => getComputedStyle(h).display !== 'none').map((h) => h.dataset.grdResizeDir).sort().join(','));

test('A1 Grid 추가 직후 모서리·변 손잡이 8개가 선다(클릭 전)', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  const made = await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = document.querySelector('#canvas .section-block');
    if (!window.getSelectedSection?.()) { window.deselectAll?.(); sec.classList.add('selected'); }
    document.getElementById('fp-grid-btn').click();
    const g = document.querySelector('#canvas .grid-block');
    if (g) g.id = 'grdT';
    return { grid: !!g, selected: !!g && g.classList.contains('selected') };
  });
  expect(made, '[전제] 그리드가 서고 골라졌다').toEqual({ grid: true, selected: true });
  /* ＋ 버튼과 겹치는 손잡이는 숨긴다(P4 ⒜) — 그래서 «보이는 것» 대신 «붙은 것» 8개를 판정하고, 보이는 것은 1개 이상 */
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#ss-handles-overlay [data-grd-resize-dir]').length), '★생성 직후 손잡이 8개').toBe(8);
  await expect.poll(async () => (await handles(page)).split(',').filter(Boolean).length, '★생성 직후 보이는 손잡이').toBeGreaterThan(0);
  const afterCreate = await handles(page);
  /* 대조: 클릭 경로(먼저 선택 풀고 누름)와 같은 손잡이 */
  await page.evaluate(() => window.deselectAll?.());
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#ss-handles-overlay [data-grd-resize-dir]').length), '[전제] 선택 해제 → 손잡이 걷힘').toBe(0);
  await page.locator('#grdT .grd-cell').first().click({ force: true });   // 첫 클릭 = 블럭 선택(드릴다운 규약)
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#ss-handles-overlay [data-grd-resize-dir]').length), '[전제] 클릭 경로 손잡이 8개').toBe(8);
  expect(await handles(page), '★생성 직후 = 클릭 뒤와 같은 손잡이').toBe(afterCreate);
  expect(errs).toEqual([]);
});
