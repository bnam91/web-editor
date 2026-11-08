/* banner02-hide-entry.dom.spec.js — BANNER02-HIDE-LEGACY-01 (현빈 0.9.10 QA): 컴포넌트 메뉴의 «Banner 2» 새로 넣기만 막는다.
 *   T0 메뉴에 Banner 2 항목이 없다(다른 항목은 그대로).
 *   T1 이미 문서에 든 배너2는 저장→다시 열기 뒤에도 보이고, 클릭하면 배너 패널이 뜬다(편집 가능).
 * ★양성대조: index.html 의 Banner 2 항목 주석을 풀면 T0 빨강.
 * 실행: NODE_PRESERVE_SYMLINKS=1 node --preserve-symlinks-main node_modules/@playwright/test/cli.js test --config=tests/dom/playwright.dom.config.js tests/dom/banner02-hide-entry.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const menuLabels = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#fp-component-dropdown .fp-menu-item')].map(b => b.textContent.trim()));

test('T0 컴포넌트 메뉴에 Banner 2 없음', async ({ page }) => {
  await bootApp(page);
  const labels = await menuLabels(page);
  expect(labels, '메뉴가 비지 않았다(전제)').toContain('Comparison');
  expect(labels, 'Banner 2 항목이 숨겨졌다').not.toContain('Banner 2');
});

test('T1 기존 배너2 — 저장→다시 열기 뒤 보이고 편집 패널이 뜬다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');   // 넣을 섹션 고르기(addBanner02Block 은 고른 섹션 필요)
  await expect.poll(() => page.evaluate(() => !!window.getSelectedSection?.())).toBe(true);
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('.banner02-block')].map(b => b.id));
    window.addBanner02Block();
    return [...document.querySelectorAll('.banner02-block')].find(b => !before.has(b.id))?.id;
  });
  expect(id, '배너2 블록이 만들어졌다(API 는 살아 있다)').toBeTruthy();
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); window.deselectAll?.(); }, snap);
  const el = page.locator(`[id="${id}"]`);
  await expect(el, '다시 열어도 배너2가 보인다').toBeVisible();
  await el.scrollIntoViewIfNeeded();
  await el.click();
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.classList.contains('selected'), id), { timeout: 4000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => !!document.getElementById('bn2-variant-group')), { timeout: 4000 }).toBe(true);
});
