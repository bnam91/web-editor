/* laurel-grid-count — U5: 옛 절 제목 「Grid (c×r)」 이 틀 제목(Layout)으로 바뀌며 사라진 칸 수를 고르개 라벨이 «쉴 때» 보인다.
 * 양성대조: prop-laurel.js 의 라벨 초기값·mouseleave 값을 옛 '—' 로 되돌리면 L1 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('L1 월계관 Layout — 고르개 라벨 = 지금 c × r (처음 · 마우스 떠난 뒤)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const want = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = c.querySelector('.section-block'); window.deselectAll?.(); window.selectSection(sec);
    await window.addLaurelBlock();
    const b = sec.querySelector('.laurel-block'); window.selectBlock(b.id);
    return `${Math.max(1, parseInt(b.dataset.gridCols) || 1)} × ${Math.max(1, parseInt(b.dataset.gridRows) || 1)}`;
  });
  const label = page.locator('#lrl-grid-picker-label');
  await expect(label).toHaveText(want);
  await expect(page.locator('#lrl-grid-picker').locator('xpath=ancestor::*[@data-sec][1]'), '라벨은 Layout 절 안').toHaveAttribute('data-sec', 'layout');
  await page.locator('#lrl-grid-picker .grid-picker-cell[data-r="4"][data-c="4"]').hover();
  await expect(label, '[전제] 마우스 올리면 미리보기 수').toHaveText('4 × 4');
  await page.mouse.move(5, 5);
  await expect(label, '떠나면 지금 수로 돌아온다').toHaveText(want);
  expect(errs).toEqual([]);
});
