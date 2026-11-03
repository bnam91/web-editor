/* 스택 프레임을 안 고른 채 빈 데(gap)를 눌러 끌어도 프레임이 끌린다 · 그냥 누르면 프레임 패널이 뜬다.
   목업을 넣은 직후에는 프레임이 안 골라졌는데 그 자리 임자가 gap 이다.
   변이: js/block-drag.js dragstart 의 _gapSurfacePress 줄을 빼면 D1 빨강 · pointerdown 의 !_gapAsSurface 를 빼면 C1 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function insertMockup(page) {
  if (!(await page.isVisible('#plugin-mockup'))) await page.click('#fp-plugin-btn');
  await page.click('#plugin-mockup');
  await page.click('.mkp-device-card[data-device="iphone"]');
  await page.click('#mkp-insert-btn');
}
async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  page.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.evaluate(() => { document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove()); });
  await page.click('.fp-btn.primary[onclick="addSection()"]');
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .frame-block')].map((e) => e.id));
  await page.click('.fp-btn[onclick="addFrameBlock()"]');
  const fid = await page.evaluate((b) => [...document.querySelectorAll('#canvas .frame-block')].map((e) => e.id).find((id) => !b.includes(id)), before);
  await insertMockup(page);
  const aId = await page.evaluate(() => document.querySelector('#canvas .mockup-block').id);
  let fr = await waitStableRect(page, '#' + fid);
  await page.mouse.click(fr.left + 5, fr.top + 5);
  await page.click('#ss-to-stack-btn');
  await page.waitForFunction((id) => document.getElementById(id).dataset.freeLayout !== 'true', fid);
  const a = await waitStableRect(page, '#' + aId);
  await page.mouse.click(a.cx, a.cy);
  if (!(await page.evaluate((i) => document.getElementById(i).classList.contains('selected'), aId))) await page.mouse.click(a.cx, a.cy);
  await insertMockup(page);
  fr = await waitStableRect(page, '#' + fid);
  const pt = [fr.left + 5, fr.top + 5];
  const pre = await page.evaluate(([x, y, f]) => ({ gap: !!document.elementFromPoint(x, y)?.classList.contains('gap-block'), frameSel: document.getElementById(f).classList.contains('selected') }), [...pt, fid]);
  expect(pre, '전제 — 프레임은 안 골라졌고 그 자리 임자가 gap 이다').toEqual({ gap: true, frameSel: false });
  return { errs, fid, pt };
}

test('C1 그냥 누르면 프레임 패널이 뜬다(gap 까지 안 내려간다)', async ({ page }) => {
  const { errs, fid, pt } = await scene(page);
  await page.mouse.click(pt[0], pt[1]);
  await expect.poll(() => page.evaluate((f) => document.getElementById(f).classList.contains('selected'), fid)).toBe(true);
  await page.waitForSelector('#ss-flip-h');
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .gap-block.selected').length)).toBe(0);
  expect(errs).toEqual([]);
});

test('D1 안 고른 채 끌면 프레임이 끌린다(gap 아님 · 취소 안 됨)', async ({ page }) => {
  const { errs, fid, pt } = await scene(page);
  await page.evaluate(() => { window.__ds = []; window.addEventListener('dragstart', (e) => { const t = e.target; const c = t.id; setTimeout(() => window.__ds.push({ c, cancelled: e.defaultPrevented, gap: t.classList.contains('gap-block') }), 0); }, true); });
  await page.mouse.move(pt[0], pt[1]); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(pt[0] + i * 6, pt[1] + i * 8);
  await expect.poll(() => page.evaluate(() => window.__ds.length)).toBeGreaterThan(0);
  const ds = await page.evaluate(() => window.__ds);
  const sel = await page.evaluate((f) => document.getElementById(f).classList.contains('selected'), fid);
  await page.mouse.up();
  expect(ds[0], '★끌기 임자 = 프레임 · 취소 안 됨').toEqual({ c: fid, cancelled: false, gap: false });
  expect(sel, '★끄는 동안 프레임이 골라져 있다').toBe(true);
  expect(errs).toEqual([]);
});
