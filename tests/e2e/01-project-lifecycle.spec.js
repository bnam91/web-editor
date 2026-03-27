const { test, expect } = require('@playwright/test');
const { connectApp } = require('./helpers');

test.describe('프로젝트 생성 → 편집 → 저장', () => {
  let browser, page;

  test.beforeAll(async () => {
    ({ browser, page } = await connectApp());
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('섹션 추가 후 자동저장 인디케이터 표시', async () => {
    // 섹션 추가
    await page.evaluate(() => window.addSection());
    // autoSave 인디케이터 대기 (최대 3s)
    await expect(page.locator('#autosave-indicator')).toBeVisible({ timeout: 3000 });
  });

  test('텍스트 블록 추가 후 내용 변경', async () => {
    await page.evaluate(() => window.addSection());
    await page.evaluate(() => window.addTextBlock('h1'));
    const block = page.locator('.text-block').first();
    await expect(block).toBeVisible();
  });

  test('autoSave 호출 후 섹션 데이터 소실 없음', async () => {
    // 먼저 섹션 추가
    await page.evaluate(() => window.addSection && window.addSection());
    await page.waitForTimeout(300);
    const before = await page.evaluate(
      () => document.querySelectorAll('.section-block').length
    );
    // triggerAutoSave 호출
    await page.evaluate(() => window.triggerAutoSave && window.triggerAutoSave());
    await page.waitForTimeout(2000);
    const after = await page.evaluate(
      () => document.querySelectorAll('.section-block').length
    );
    // 저장 후 섹션이 사라지면 안 됨
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
