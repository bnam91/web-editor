/* scratch-undo-linkdy-190 — 연결된 스크래치를 지웠다 ⌘Z 로 되살려도 앵커(linkDy)가 그대로다 (J190)
 * 왜: 지우기 스냅샷이 linkDy 를 빼고 되살림 함수(_scratchAddAndSaveFx)도 그 칸을 안 받아, ⌘Z 뒤 추종이 «지금 자리»에서 앵커를 새로 유도했다.
 *   앱 실측(2b7aec4d · ~/gd-lane/imac-gd-L1/190): 겹침으로 밀린 장 d49.8→171.8 · 글과 함께 지운 뒤 ⌘Z 두 번 y 753.8→836.6(82.8 어긋남 · 저장에 남음) 각 3/3.
 * 칸: L1 겹침으로 밀린 장 · L2 글과 함께 지운 장(⌘Z 두 번) · L3 [음성] 혼자·섹션 안 움직임 = 고치기 전에도 같다 · L4 [음성] 섹션 지우기 ⌘Z 길은 원래 linkDy 를 나른다.
 * 변이: 고침만 되돌리면 L1·L2 빨강 · L3·L4 초록.
 * ★처음 실행 기록: 2026-11-01 16:0x · 아이맥 · 판 2b7aec4d · w1 · retries 0 · repeat-each 3 · 고친 판 12/12 · 되돌린 판 L1·L2 각 3/3 빨강 · L3·L4 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
const frames = async (page) => { for (let i = 0; i < 6; i++) await settle(page); await page.waitForFunction(() => { const s = [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId + '|' + e.style.left + '|' + e.style.top).join(); window.__fn = s === window.__fs ? (window.__fn || 0) + 1 : 0; window.__fs = s; return window.__fn >= 3; }, null, { polling: 100 }); };   // 장들이 세 번 연달아 같은 자리
const item = (page, id) => page.evaluate((id) => { const it = window._scratchItemById(id); return it ? { y: it.y, linkDy: it.linkDy } : null; }, id);
async function setup(page, two) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const sec = await page.evaluate(async ([src, two]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection(); window.addSection();
    const secs = [...c.querySelectorAll('.section-block')];
    window.__secs = secs.map(s => s.id);
    window.selectSection?.(secs[0]); window.addTextBlock('h2'); window.deselectAll?.();
    window.initScratchPad && await window.initScratchPad(window.state?.projectId || 'proj_190', window.state?.currentPageId);
    const y = secs[1].offsetTop + 40;
    await window._scratchAddAndSave(src, 700, y, 120, undefined, 'sp_a');
    if (two) await window._scratchAddAndSave(src, 700, y + 10, 120, undefined, 'sp_b');
    window.SPLink.addLink(secs[1].id, 'sp_a'); if (two) window.SPLink.addLink(secs[1].id, 'sp_b');
    return secs[1].id;
  }, [PNG, two]);
  await frames(page);
  return { sec, errs };
}
async function clickItem(page, id) {
  const c = await page.evaluate((id) => { const el = window._scratchItemById(id).el; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 6 }; }, id);
  await waitStableRect(page, `.scratch-item[data-scratch-id="${id}"]`);
  await page.mouse.click(c.x, c.y); await settle(page);
  expect(await page.evaluate((id) => window._scratchItemById(id).el.classList.contains('scratch-selected'), id), `[전제] ${id} 를 골랐다`).toBe(true);
}

test('L1 겹침으로 밀린 장을 지웠다 ⌘Z — 앵커가 그대로다', async ({ page }) => {
  const { errs } = await setup(page, true);
  const b0 = await item(page, 'sp_b');
  expect(typeof b0.linkDy, '[전제] 앵커가 섰다').toBe('number');
  await clickItem(page, 'sp_b'); await page.keyboard.press('Backspace'); await frames(page);
  expect(await item(page, 'sp_b'), '[전제] 지워졌다').toBeNull();
  await page.keyboard.press('Meta+z'); await frames(page);
  const b1 = await item(page, 'sp_b');
  expect(b1.linkDy, '★앵커가 새로 유도됐다').toBeCloseTo(b0.linkDy, 1);
  expect(b1.y).toBeCloseTo(b0.y, 1);
  expect(errs).toEqual([]);
});

test('L2 글과 함께 지운 장 — ⌘Z 두 번이면 처음 자리다', async ({ page }) => {
  const { sec, errs } = await setup(page, false);
  await page.evaluate(() => { const s = document.getElementById(window.__secs[0]); window.selectSection?.(s); window.addTextBlock('h2'); });
  await frames(page);
  const a0 = await item(page, 'sp_a'); const glyphs = await page.evaluate(() => document.querySelectorAll('#canvas .text-block').length);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .text-block.selected, #canvas [data-text-frame].selected').length), '[전제] 글이 선택돼 있다').toBeGreaterThan(0);
  await clickItem(page, 'sp_a'); await page.keyboard.press('Backspace'); await frames(page);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .text-block').length), '[전제] 글도 같이 지워졌다').toBe(glyphs - 1);
  await page.keyboard.press('Meta+z'); await frames(page);
  await page.keyboard.press('Meta+z'); await frames(page);
  const a1 = await item(page, 'sp_a');
  expect(a1.linkDy, '★앵커가 어긋났다').toBeCloseTo(a0.linkDy, 1);
  expect(a1.y, '★자리가 어긋났다').toBeCloseTo(a0.y, 1);
  expect(sec).toBeTruthy(); expect(errs).toEqual([]);
});

test('L3 [음성] 혼자·섹션 안 움직임', async ({ page }) => {
  const { errs } = await setup(page, false);
  const a0 = await item(page, 'sp_a');
  await clickItem(page, 'sp_a'); await page.keyboard.press('Backspace'); await frames(page);
  await page.keyboard.press('Meta+z'); await frames(page);
  const a1 = await item(page, 'sp_a');
  expect([a1.y, a1.linkDy].map(v => Math.round(v * 10))).toEqual([a0.y, a0.linkDy].map(v => Math.round(v * 10)));
  expect(errs).toEqual([]);
});

test('L4 [음성] 섹션 지우기 ⌘Z 길은 linkDy 를 나른다', async ({ page }) => {
  const { sec, errs } = await setup(page, false);
  const a0 = await item(page, 'sp_a');
  await page.evaluate((s) => window.deleteSection(s), sec); await frames(page);
  expect(await page.evaluate((s) => !!document.getElementById(s), sec), '[전제] 섹션이 지워졌다').toBe(false);
  await page.keyboard.press('Meta+z'); await frames(page);
  expect((await item(page, 'sp_a')).linkDy).toBeCloseTo(a0.linkDy, 1);
  expect(errs).toEqual([]);
});
