const { test, expect } = require('@playwright/test');
const { connectApp } = require('./helpers');

test.describe('블록 추가 · 편집 · 삭제', () => {
  let browser, page;

  test.beforeAll(async () => {
    ({ browser, page } = await connectApp());
    await page.evaluate(() => window.addSection());
  });

  test.afterAll(async () => await browser.close());

  test('텍스트 블록 h1~caption 모두 추가 가능', async () => {
    for (const type of ['h1', 'h2', 'h3', 'body', 'caption']) {
      await page.evaluate((t) => window.addTextBlock(t), type);
    }
    const blocks = await page.evaluate(
      () => document.querySelectorAll('.text-block').length
    );
    expect(blocks).toBeGreaterThanOrEqual(5);
  });

  test('Gap 블록 추가', async () => {
    await page.evaluate(() => window.addGapBlock());
    const gap = await page.evaluate(
      () => !!document.querySelector('.gap-block')
    );
    expect(gap).toBe(true);
  });

  test('Asset 블록 추가', async () => {
    await page.evaluate(() => window.addAssetBlock());
    const asset = await page.evaluate(
      () => !!document.querySelector('.asset-block')
    );
    expect(asset).toBe(true);
  });

  test('Card 블록 추가', async () => {
    await page.evaluate(() => window.addCardBlock());
    const card = await page.evaluate(
      () => !!document.querySelector('.card-block')
    );
    expect(card).toBe(true);
  });

  test('Graph 블록 추가', async () => {
    await page.evaluate(() => window.addGraphBlock());
    const graph = await page.evaluate(
      () => !!document.querySelector('.graph-block')
    );
    expect(graph).toBe(true);
  });
});
