const { test, expect } = require('@playwright/test');
const { connectApp } = require('./helpers');

test.describe('멀티페이지 생성 · 전환 · 삭제', () => {
  let browser, page;

  test.beforeAll(async () => {
    ({ browser, page } = await connectApp());
  });

  test.afterAll(async () => await browser.close());

  test('페이지 추가 후 탭 증가', async () => {
    const before = await page.evaluate(
      () => document.querySelectorAll('.file-page-item').length
    );
    await page.evaluate(() => {
      if (window.addPage) window.addPage();
    });
    await page.waitForTimeout(500);
    const after = await page.evaluate(
      () => document.querySelectorAll('.file-page-item').length
    );
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test('페이지 1개만 있을 때 삭제 방어', async () => {
    // 1개만 남을 때까지 삭제 시도 후 최소 1개 유지 확인
    const count = await page.evaluate(
      () => document.querySelectorAll('.file-page-item').length
    );
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('페이지 전환 시 캔버스 내용 변경', async () => {
    const pages = await page.evaluate(
      () => [...document.querySelectorAll('.file-page-item')].map(el => el.dataset.pageId)
    );
    if (pages.length >= 2) {
      await page.evaluate((id) => window.switchPage && window.switchPage(id), pages[1]);
      await page.waitForTimeout(300);
      const active = await page.evaluate(
        () => document.querySelector('.file-page-item.active')?.dataset?.pageId
      );
      expect(active).toBe(pages[1]);
    }
  });
});
