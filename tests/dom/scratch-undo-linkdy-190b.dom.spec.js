/* scratch-undo-linkdy-190b — 연결된 스크래치를 칸으로 끌어 변환했다 ⌘Z 해도 앵커(linkDy)가 그대로다 (J190B)
 * 왜: 변환 길이 linkDy 를 빼 와 ⌘Z 뒤 지금 자리에서 새로 유도했다. 겹쳐 밀린 장은 앵커가 바뀐다.
 *   앱 실측(57573737 · ~/gd-lane/imac-gd-L1/190b): 겹친 장 d176→298 3/3 · 혼자 장·슬라이스 ⌘Z 는 안 어긋남.
 * 칸: V1 겹친 장 변환 ⌘Z · V2 [음성] 혼자 장 · V3 [음성] 겹친 장 슬라이스 ⌘Z(이 길은 안 고쳤고 원래 같다).
 * 변이: 이 고침만 되돌리면 V1 빨강 · V2·V3 초록. ⚠️화면 앵커 단언만으로는 되돌린 판이 1/3 만 빨강이었다(타이밍) ⇒ 되살림 함수로 넘어가는 값을 직접 잰다.
 * ★처음 실행 기록: 2026-11-01 16:5x · 아이맥 · 판 57573737 위 · w1 · retries 0 · repeat-each 3. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
const frames = async (page) => { for (let i = 0; i < 6; i++) await settle(page); await page.waitForTimeout(300); };
const item = (page, id) => page.evaluate((id) => { const it = window._scratchItemById(id); return it ? { y: it.y, linkDy: it.linkDy } : null; }, id);
async function setup(page, two) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (two) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection(); window.addSection();
    const secs = [...c.querySelectorAll('.section-block')];
    const cv = document.createElement('canvas'); cv.width = 60; cv.height = 60; const x = cv.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 60, 30); x.fillStyle = '#33c'; x.fillRect(0, 30, 60, 30); const src = cv.toDataURL('image/png');
    const row = document.createElement('div'); row.className = 'row'; row.id = 'r190b'; row.dataset.layout = 'stack'; secs[0].querySelector('.section-inner').appendChild(row);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: '칸 A' }] }, { width: 1, lines: [{ type: 'body', text: '칸 B' }] }] }); g.id = 'g190b'; row.appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(50);
    const y = secs[1].offsetTop + 40;
    await window._scratchAddAndSave(src, 900, y, 120, undefined, 'sp_a'); if (two) await window._scratchAddAndSave(src, 900, y + 10, 120, undefined, 'sp_b');
    window.SPLink.addLink(secs[1].id, 'sp_a'); if (two) window.SPLink.addLink(secs[1].id, 'sp_b');
    window.clearHistory?.();
  }, two);
  await frames(page); await page.waitForTimeout(500);
  return errs;
}
const rect = (page, id) => page.evaluate((id) => { const r = window._scratchItemById(id).el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; }, id);
async function dropOnCell(page, id) {
  await page.evaluate(() => document.querySelector('#g190b .grd-cell').scrollIntoView({ block: 'nearest' })); await page.waitForTimeout(250);
  await page.evaluate((id) => window._scratchItemById(id).el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }), id); await page.waitForTimeout(250);
  const c = await rect(page, id); const d = await page.evaluate(() => { const q = document.querySelector('#g190b .grd-cell').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x - 20, c.y + 10, { steps: 4 }); await page.mouse.move(d[0], d[1], { steps: 20 }); await page.mouse.move(d[0] + 2, d[1] + 1, { steps: 2 });
  await expect(page.locator('.sp2c-insert-indicator').first(), '[전제] 놓기 전 아밍 가이드').toBeVisible({ timeout: 5000 });
  await page.mouse.up(); await frames(page);
  expect(await item(page, id), '[전제] 변환돼 장이 사라졌다').toBeNull();
}

test('V1 겹친 장을 변환했다 ⌘Z — 앵커가 그대로다', async ({ page }) => {
  const errs = await setup(page, true);
  const b0 = await item(page, 'sp_b');
  expect(typeof b0.linkDy, '[전제] 앵커가 섰다').toBe('number');
  await page.evaluate(() => { const o = window._scratchAddAndSaveFx; window.__restored = []; window._scratchAddAndSaveFx = function (...a) { window.__restored.push({ id: a[5], linkDy: a[8] }); return o.apply(this, a); }; });
  await dropOnCell(page, 'sp_b');
  await page.keyboard.press('Meta+z'); await frames(page); await page.waitForTimeout(400);
  const rec = (await page.evaluate(() => window.__restored)).find(r => r.id === 'sp_b');
  expect(rec, '[전제] ⌘Z 가 되살림 함수를 불렀다').toBeTruthy();
  expect(typeof rec?.linkDy, '★되살림 함수에 끌기 전 앵커가 안 넘어갔다').toBe('number');
  expect(Math.abs(rec.linkDy - b0.linkDy), '★넘어간 앵커가 끌기 전 값이 아니다(끄는 동안 바뀐 값)').toBeLessThan(1);
  const b1 = await item(page, 'sp_b');
  expect(Math.abs(b1.linkDy - b0.linkDy), `★앵커가 어긋났다 ${b0.linkDy}→${b1.linkDy}`).toBeLessThan(1);
  expect(Math.abs(b1.y - b0.y), '자리').toBeLessThan(1);
  expect(errs).toEqual([]);
});

test('V2 [음성] 혼자 장 변환 ⌘Z', async ({ page }) => {
  const errs = await setup(page, false);
  const a0 = await item(page, 'sp_a');
  await dropOnCell(page, 'sp_a');
  await page.keyboard.press('Meta+z'); await frames(page); await page.waitForTimeout(400);
  const a1 = await item(page, 'sp_a');
  expect(Math.abs(a1.linkDy - a0.linkDy)).toBeLessThan(1);
  expect(errs).toEqual([]);
});

test('V3 [음성] 겹친 장 슬라이스 ⌘Z', async ({ page }) => {
  const errs = await setup(page, true);
  const b0 = await item(page, 'sp_b');
  await page.evaluate(() => window._scratchItemById('sp_b').el.scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(250);
  const c = await rect(page, 'sp_b'); await page.mouse.click(c.x, c.y + c.h / 2 - 6); await settle(page);
  await page.evaluate(() => window._scratchItemById('sp_b').el.querySelector('.scratch-slice-btn').click()); await page.waitForTimeout(250);
  const c2 = await rect(page, 'sp_b'); await page.mouse.move(c2.x, c2.y); await page.waitForTimeout(80); await page.mouse.click(c2.x, c2.y);
  await expect.poll(() => item(page, 'sp_b'), { message: '[전제] 잘렸다' }).toBeNull();
  await frames(page);
  await page.keyboard.press('Meta+z'); await frames(page); await page.waitForTimeout(400);
  const b1 = await item(page, 'sp_b');
  expect(Math.abs(b1.linkDy - b0.linkDy)).toBeLessThan(1);
  expect(errs).toEqual([]);
});
