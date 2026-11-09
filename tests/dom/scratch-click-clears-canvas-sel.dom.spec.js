/* scratch-click-clears-canvas-sel — 글이 선택된 채 스크래치 장을 진짜 클릭하면 글 선택이 풀린다 · Backspace 는 장만 지운다
 *   (SCRATCH-CLICK-KEEPS-TEXT-SELECTION-BACKSPACE-BOTH-01 · 옛: 글 6→5 · 이력 +2 · J190 곁값 · 판 2b7aec4d)
 * 왜: 장 mousedown 이 stopPropagation 이라 캔버스의 «빈 곳 클릭 = deselectAll» 이 안 닿았다.
 * 칸: C1 글 고름 → 장 클릭 → 글 선택 0 · Backspace → 글 수 그대로 · 장만 사라짐 · ⌘Z 한 번 = 장 돌아옴
 *     C2 [대조] Shift 클릭은 캔버스 선택을 안 푼다(섞어 고르기 유지 — 바꾸지 않은 길)
 * ★양성대조: js/scratch-pad.js 를 기준판(c1588d839)으로 되돌리면 C1 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
const st = (page) => page.evaluate(() => ({
  texts: document.querySelectorAll('#canvas .text-block').length,
  textSel: document.querySelectorAll('#canvas .text-block.selected, #canvas [data-text-frame].selected').length,
  item: !!window._scratchItemById('sp_c'),
  itemSel: !!window._scratchItemById('sp_c')?.el.classList.contains('scratch-selected'),
}));
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (src) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection?.(sec); window.addTextBlock('h2'); window.addTextBlock('body');
    window.initScratchPad && await window.initScratchPad(window.state?.projectId || 'proj_c', window.state?.currentPageId);
    await window._scratchAddAndSave(src, 700, sec.offsetTop + 40, 120, undefined, 'sp_c');
    window.clearHistory?.();
    window.selectSection?.(sec); window.addTextBlock('h2');   // 마지막에 넣은 글이 고른 채 남는다(실앱: 글 고름)
  }, PNG);
  await settle(page);
  const s = await st(page);
  expect(s.textSel, '[전제] 글이 선택돼 있다').toBeGreaterThan(0);
  return errs;
}
async function clickItem(page, mod) {
  const c = await page.evaluate(() => { const el = window._scratchItemById('sp_c').el; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 6 }; });
  await waitStableRect(page, '.scratch-item[data-scratch-id="sp_c"]');
  if (mod) await page.keyboard.down(mod);
  await page.mouse.click(c.x, c.y);
  if (mod) await page.keyboard.up(mod);
  await settle(page);
}

test('C1 글 선택 중 장 클릭 → 글 선택 풀림 · Backspace 는 장만 · ⌘Z 한 번에 장 돌아옴', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await st(page);
  await clickItem(page);
  const s1 = await st(page);
  expect(s1.itemSel, '[전제] 장을 골랐다').toBe(true);
  expect(s1.textSel, '★글 선택이 안 풀렸다(옛 결함)').toBe(0);
  await page.keyboard.press('Backspace'); await settle(page);
  const s2 = await st(page);
  expect(s2.item, '장은 지워졌다').toBe(false);
  expect(s2.texts, '★글도 같이 지워졌다(옛 결함)').toBe(s0.texts);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => st(page).then(s => [s.item, s.texts])).toEqual([true, s0.texts]);
  expect(errs).toEqual([]);
});

test('C2 [대조] Shift 클릭은 캔버스 선택을 그대로 둔다', async ({ page }) => {
  await setup(page);
  await clickItem(page, 'Shift');
  const s = await st(page);
  expect(s.itemSel).toBe(true);
  expect(s.textSel).toBeGreaterThan(0);
});
