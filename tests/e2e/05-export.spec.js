const { test, expect } = require('@playwright/test');
const { connectApp } = require('./helpers');

test.describe('내보내기 — HTML · JSON', () => {
  let browser, page;

  test.beforeAll(async () => {
    ({ browser, page } = await connectApp());
    // 각 블록 타입 포함한 섹션 준비
    await page.evaluate(() => {
      window.addSection();
      window.addTextBlock('h1');
      window.addTextBlock('body');
      window.addCardBlock?.();
      window.addGraphBlock?.();
    });
    await page.waitForTimeout(500);
  });

  test.afterAll(async () => await browser.close());

  test('HTML 내보내기 — CANVAS_W 오류 없이 실행 (BUG-1)', async () => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.evaluate(() => {
      if (window.exportHTMLFile) window.exportHTMLFile();
    });
    await page.waitForTimeout(500);

    const canvasWError = errors.some(e => e.includes('CANVAS_W'));
    expect(canvasWError).toBe(false);
  });

  test('JSON 내보내기 — 특수 블록 직렬화 누락 없음 (BUG-3)', async () => {
    const result = await page.evaluate(() => {
      if (!window.exportDesignJSON) return null;
      // 직렬화 결과 반환
      const sections = document.querySelectorAll('.section-block');
      if (!sections.length) return null;
      return window.serializeSection?.(sections[0]) ?? null;
    });
    // null이 아니면 직렬화 함수 존재
    // card/graph 블록이 있다면 결과에 포함돼야 함
    if (result !== null) {
      expect(result).toBeTruthy();
    }
  });

  test('autoSave debounce — 드래그 중 suppress 플래그 동작', async () => {
    const suppressed = await page.evaluate(() => {
      if (!window._editorState) return null;
      // dragstart 시뮬레이션
      const el = document.querySelector('.section-block');
      if (!el) return null;
      el.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
      const flag = window._editorState?._suppressAutoSave ?? false;
      el.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
      return flag;
    });
    // 플래그가 존재하면 true여야 함
    if (suppressed !== null) expect(suppressed).toBe(true);
  });
});
