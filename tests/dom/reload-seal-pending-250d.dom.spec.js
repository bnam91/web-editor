/* reload-seal-pending-250d.dom.spec.js — 되돌리기 봉인이 미룸 예약(_autoSavePending)을 안 지워 복원본을 덮던 것(★250D ②).
 *
 * mouseup 을 놓쳐 미룸이 산 채(최대 30초) 되돌리기 → 봉인이 dirty·타이머만 지움 → 새로고침의 beforeunload 가 pending 을 «미저장»으로 읽어 DOM 을 동기 저장.
 * 판정 = beforeunload 를 직접 쏘고 saveProjectSync 호출 수. ⛔못 보는 꼴: 진짜 파일 복원(앱 탐침이 잰다).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN } = require('./_root-harness.js');
const PID = 'proj_1700000000253';
test.describe.configure({ timeout: 60000 });
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
const SEL = '#ss-handles-overlay .ss-resize-handle.se';

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: (_, k) => (k === "saveProjectSync" ? (proj) => { (window.__sync ||= []).push(JSON.stringify(proj)); return { ok: true }; } : () => Promise.resolve(null)) }); });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ contentType: MIME[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html?project=${PID}`);
  await page.waitForFunction(() => typeof window.rebindAll === "function" && typeof window.exportHTMLFile === "function", null, { timeout: 20000 });
  const id = await page.evaluate(() => {
    document.getElementById('canvas').querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = document.querySelector('#canvas > .section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock();
    const f = sec.querySelector('.frame-block:not([data-text-frame])'); window.deselectAll(); f._layerItem?.click(); if (!f.classList.contains('selected')) window.selectBlock(f.id); f.scrollIntoView({ block: 'center' });
    return f.id;
  });
  await page.waitForSelector(SEL, { state: 'attached', timeout: 10000 });
  await page.waitForFunction(() => !window.hasUnsavedChanges(), null, { timeout: 10000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50)))));
  return id;
}
const hold = async (page) => { const h = await page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, SEL); await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 40, h.y - 40, { steps: 2 }); expect(await page.evaluate(() => window.__autoSaveDeferState()), '[전제] 쥔 채 예약 기억').toEqual({ deferred: true, pending: true }); };
const unload = (page) => page.evaluate(() => { window.__sync = []; window.dispatchEvent(new Event('beforeunload')); return window.__sync.length; });

test('S1 쥔 채 봉인 — beforeunload 가 복원본을 덮지 않는다', async ({ page }) => {
  await boot(page);
  await hold(page);
  expect(await page.evaluate(() => window.cancelPendingAutoSaveForReload(window.activeProjectId)), '봉인 성공').toBe(true);
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '봉인 뒤 미저장 없음').toBe(false);
  expect(await unload(page), 'saveProjectSync 호출').toBe(0);
  await page.mouse.up();
});

test('S2 [지킴] 되돌리기 실패로 봉인 해제 — 쥔 채 고친 편집을 잃지 않는다', async ({ page }) => {
  await boot(page);
  await hold(page);
  await page.evaluate(() => window.cancelPendingAutoSaveForReload(window.activeProjectId));
  await page.evaluate(() => window.resumeAutoSaveAfterAbortedReload());
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '다시 미저장').toBe(true);
  expect(await unload(page), '그때 닫으면 쓴다').toBe(1);
  await page.mouse.up();
});

test('S3 [지킴] 봉인 중 mouseup — 자동저장이 다시 걸리지 않는다', async ({ page }) => {
  await boot(page);
  await hold(page);
  await page.evaluate(() => window.cancelPendingAutoSaveForReload(window.activeProjectId));
  await page.mouse.up();
  expect(await page.evaluate(() => window.__autoSaveDeferState())).toEqual({ deferred: false, pending: false });
  expect(await unload(page)).toBe(0);
});

test('S4 [지킴] 안 쥔 편집 뒤 봉인 — beforeunload 안 쓴다', async ({ page }) => {
  const id = await boot(page);
  await page.evaluate((id) => { document.getElementById(id).dataset.name = '앞 편집'; window.pushHistory('앞 편집'); }, id);
  await page.evaluate(() => window.cancelPendingAutoSaveForReload(window.activeProjectId));
  expect(await unload(page)).toBe(0);
});
