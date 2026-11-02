/* scratch-x-autosave-214 — 스크래치 ✕·⌘Z·⌘⇧Z 가 파일 저장을 예약한다 (J214)
 * 왜: 지우기는 캔버스를 안 건드려 저장이 안 잡혔다 ⇒ proj.json 매니페스트에 지운 장이 남아, 비정상 종료 뒤 · 다른 맥에서 되살아났다.
 *   앱 실측(2b7aec4d · ~/gd-lane/imac-gd-L1/214): 마지막 한 장 ✕ · 30초 뒤에도 파일에 남음 · SIGTERM 뒤 다시 열면 돌아옴 3/3.
 * 자: scheduleAutoSave 호출 수(window.triggerAutoSave 를 감싼다). 파일 쓰기는 하네스 가짜 API 라 못 재서 앱이 잰다.
 * 칸: X1 ✕ · X2 ⌘Z · X3 ⌘⇧Z · X4 [음성] 고르기만은 예약 안 함.
 * 변이: 고침만 되돌리면 X1·X2·X3 빨강 · X4 초록.
 * ★처음 실행 기록: 2026-11-01 17:2x · 아이맥 · 판 2b7aec4d · w1 · retries 0 · repeat-each 3 · 고친 판 12/12 · 되돌린 판 X1·X2·X3 각 3/3 빨강 · X4 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
const count = (page) => page.evaluate(() => window.__saves);
const present = (page) => page.evaluate(() => !!document.querySelector('.scratch-item[data-scratch-id="sp_x"]'));
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (src) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection(); window.deselectAll?.();
    await window._scratchAddAndSave(src, 700, 200, 120, undefined, 'sp_x');
    window.clearHistory?.();
  }, PNG);
  await page.waitForFunction(() => !!document.querySelector('.scratch-item[data-scratch-id="sp_x"]')); await settle(page);
  await page.evaluate(() => { const o = window.triggerAutoSave; window.__saves = 0; window.triggerAutoSave = function (...a) { window.__saves++; return o.apply(this, a); }; });
  return errs;
}
async function pick(page) {
  const c = await page.evaluate(() => { const el = document.querySelector('.scratch-item[data-scratch-id="sp_x"]'); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 6 }; });
  await waitStableRect(page, '.scratch-item[data-scratch-id="sp_x"]'); await page.mouse.click(c.x, c.y); await settle(page);
}
async function pressX(page) {
  const b = await page.evaluate(() => { const r = document.querySelector('.scratch-item[data-scratch-id="sp_x"] .scratch-close').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(b.x, b.y); await page.mouse.click(b.x, b.y);
  await expect.poll(() => present(page), { message: '[전제] 지워졌다' }).toBe(false);
}

test('X1 ✕ 가 저장을 예약한다', async ({ page }) => {
  const errs = await setup(page); await pick(page);
  const n0 = await count(page); await pressX(page);
  await expect.poll(() => count(page), { message: '★✕ 뒤 저장 예약 없음' }).toBeGreaterThan(n0);
  expect(errs).toEqual([]);
});
test('X2 ⌘Z 가 저장을 예약한다', async ({ page }) => {
  const errs = await setup(page); await pick(page); await pressX(page);
  const n0 = await count(page);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => present(page), { message: '[전제] 되살아났다' }).toBe(true);
  await expect.poll(() => count(page), { message: '★⌘Z 뒤 저장 예약 없음' }).toBeGreaterThan(n0);
  expect(errs).toEqual([]);
});
test('X3 ⌘⇧Z 가 저장을 예약한다', async ({ page }) => {
  const errs = await setup(page); await pick(page); await pressX(page);
  const before = await count(page); await page.keyboard.press('Meta+z'); await expect.poll(() => present(page)).toBe(true); await expect.poll(() => count(page)).toBeGreaterThan(before);
  const n0 = await count(page);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => present(page), { message: '[전제] 다시 지워졌다' }).toBe(false);
  await expect.poll(() => count(page), { message: '★⌘⇧Z 뒤 저장 예약 없음' }).toBeGreaterThan(n0);
  expect(errs).toEqual([]);
});
test('X4 [음성] 고르기만은 예약 안 함', async ({ page }) => {
  const errs = await setup(page); const n0 = await count(page); await pick(page);
  expect(await count(page)).toBe(n0);
  expect(errs).toEqual([]);
});
