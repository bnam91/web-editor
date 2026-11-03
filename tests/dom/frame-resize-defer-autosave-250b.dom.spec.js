/* frame-resize-defer-autosave-250b.dom.spec.js — 프레임 손잡이 끌기 중 자동저장이 안 밀리던 것(★156·★165 꼴로 미룸).
 *
 * 증상: 첫 이동의 시작 표본이 1.5s 타이머를 걸어, 놓지 않고 멈춰 있으면 끌기 «안»에서 프로젝트 통째 직렬화가 돈다.
 * 판정 = 자동저장 쓰기(localStorage web-editor-autosave__<pid> — 파일 쓰기와 같은 snap · save-load.js)의 시각이 눌림~놓음 안에 있나.
 * R1 은 고치기 전 판에서 빨강. ⛔못 보는 꼴: 파일 쓰기 · 큰 프로젝트의 멈춤 시간(앱 실측이 잰다).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN } = require('./_root-harness.js');
const PID = 'proj_1700000000778';
test.describe.configure({ timeout: 60000 });
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
const SEL = '#ss-handles-overlay .ss-resize-handle.se';

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html?project=${PID}`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.deferAutoSave === 'function', null, { timeout: 20000 });
  await page.evaluate(() => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); });
  await page.evaluate(() => window.addSection());
  const id = await page.evaluate(() => { const sec = document.querySelector('#canvas > .section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock(); const f = sec.querySelector('.frame-block:not([data-text-frame])'); window.deselectAll(); f._layerItem?.click(); if (!f.classList.contains('selected')) window.selectBlock(f.id); f.scrollIntoView({ block: 'center' }); return f.id; });
  await page.waitForSelector(SEL, { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(2200);   // 장면 세우며 걸린 저장이 끝나게
  await page.evaluate((pid) => { window.__saves = []; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === `web-editor-autosave__${pid}`) window.__saves.push({ t: performance.now(), v: String(v) }); return o.call(this, k, v); }; }, PID);
  return { errs, id };
}
const handle = (page) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, SEL);
const saves = (page) => page.evaluate(() => window.__saves.length);
const state = (page) => page.evaluate(() => window.__autoSaveDeferState());
const widthOf = (page, id) => page.evaluate((id) => document.getElementById(id).dataset.width, id);

test('R1 ★놓지 않고 2.2초 멈춰도 끌기 안에서 안 쓴다 · 놓으면 새 크기로 한 번 쓴다', async ({ page }) => {
  const { errs, id } = await boot(page);
  const h = await handle(page);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 40, h.y + 30, { steps: 4 });
  await page.waitForTimeout(2200);
  expect(await saves(page), '끌기 안 쓰기').toBe(0);
  expect((await state(page)).deferred).toBe(true);
  await page.mouse.up();
  expect((await state(page)).deferred).toBe(false);
  await expect.poll(() => saves(page), { timeout: 4000 }).toBeGreaterThan(0);
  const w = await widthOf(page, id);
  expect(await page.evaluate(([id, w]) => { const l = window.__saves.at(-1).v; return l.includes(id) && l.includes(`data-width=\\"${w}\\"`) || l.includes(`data-width="${w}"`); }, [id, w])).toBe(true);
  expect(errs).toEqual([]);
});

test('R2 안 끌고 눌렀다 놓기 — 유예가 안 남는다 · 먼저 있던 저장 예약도 안 잃는다', async ({ page }) => {
  const { errs, id } = await boot(page);
  await page.evaluate((id) => { document.getElementById(id).dataset.name = '앞 편집'; window.pushHistory('앞 편집'); }, id);
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '전제: 앞 편집의 예약이 걸렸다').toBe(true);
  const h = await handle(page);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.up();
  expect(await state(page)).toEqual({ deferred: false, pending: false });
  await expect.poll(() => saves(page), { timeout: 4000 }).toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('R3 끄는 중 창 blur — 유예가 풀려 고착되지 않는다', async ({ page }) => {
  const { errs } = await boot(page);
  const h = await handle(page);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 30, h.y + 20, { steps: 3 });
  expect((await state(page)).deferred).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect((await state(page)).deferred).toBe(false);
  await page.mouse.up();
  await expect.poll(() => saves(page), { timeout: 4000 }).toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('R4 ⌘Z 한 번이 끌기 한 번을 되돌린다', async ({ page }) => {
  const { id } = await boot(page);
  const w0 = await widthOf(page, id);
  const h = await handle(page);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 50, h.y + 30, { steps: 4 }); await page.mouse.up();
  expect(await widthOf(page, id)).not.toBe(w0);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => widthOf(page, id)).toBe(w0);
});
