/* autosave-defer-cap-unsaved-250c.dom.spec.js — 미룸(deferAutoSave)이 저장 약속을 흔들던 둘.
 *
 * C — J354 상한(연속 편집 중에도 5초 안에 한 번 쓴다)이 짧은 제스처 반복에 무력화됐다: 누를 때 타이머가 지워지고 놓을 때 «새 기다림»이 시작.
 *     앱 실측 800ms 간격 30초: 편집 5회 · 손잡이 0회 · 팬 0회 · 거터 0회.
 * U — 저장 진행 중에 손잡이를 쥐고 고치면 그 저장이 끝나며 dirty 를 지운다 ⇒ 쥔 채 새로고침하면 beforeunload 가 조기 return. 앱 실측: 끌린 폭이 파일에 없음.
 * 시간은 page.clock 으로 넘긴다. ⛔못 보는 꼴: 파일 쓰기 자체(가짜 electronAPI) · 메뉴의 ⌘R(beforeunload 를 직접 쏜다) — 둘은 앱 탐침이 잰다.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN } = require('./_root-harness.js');
const PID = 'proj_1700000000250';
test.describe.configure({ timeout: 60000 });
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
const SEL = '#ss-handles-overlay .ss-resize-handle.se';

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.addInitScript(() => {
    window.__sync = []; window.__holdSave = false;
    window.electronAPI = new Proxy({}, { get: (_, k) => {
      if (k === 'saveProjectSync') return (proj) => { window.__sync.push(JSON.stringify(proj)); return { ok: true }; };
      if (k === 'saveProject') return () => { if (!window.__holdSave) return Promise.resolve({ ok: true }); window.__saving = true; return new Promise((r) => { window.__endSave = () => { window.__saving = false; r({ ok: true }); }; }); };
      return () => Promise.resolve(null);
    } });
  });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html?project=${PID}`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.deferAutoSave === 'function', null, { timeout: 20000 });
  const id = await page.evaluate(() => {
    document.getElementById('canvas').querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = document.querySelector('#canvas > .section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock();
    const f = sec.querySelector('.frame-block:not([data-text-frame])');
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 120 }, { height: 'auto' }] });
    g.id = 'dG'; (sec.querySelector('.row') || sec.querySelector('.section-inner')).appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
    return f.id;
  });
  await page.waitForFunction(() => !window.hasUnsavedChanges(), null, { timeout: 10000 });
  await page.evaluate((pid) => { window.__w = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === `web-editor-autosave__${pid}`) window.__w++; return o.call(this, k, v); }; }, PID);
  return id;
}
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50)))));   // 가짜 시계를 걸기 전에 오버레이가 제자리로
const selectFrame = async (page, id) => { await page.evaluate((id) => { const f = document.getElementById(id); window.deselectAll(); f._layerItem?.click(); if (!f.classList.contains('selected')) window.selectBlock(id); f.scrollIntoView({ block: 'center' }); }, id); await page.waitForSelector(SEL, { state: 'attached', timeout: 10000 }); await settle(page); expect(await page.evaluate((s) => { const q = document.querySelector(s); const r = q.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === q; }, SEL), '[전제] 손잡이가 눌리는 자리다').toBe(true); };
const centerOf = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, sel);
const writes = (page) => page.evaluate(() => window.__w);

/* 800ms 마다 제스처 하나, 8번(가짜 시계 6.4초) — 상한 5초면 쓰기가 나야 한다 */
async function repeat(page, gesture) {
  await page.clock.install();
  for (let i = 0; i < 8; i++) { await gesture(i); await page.clock.runFor(800); }
  return writes(page);
}
const edit = (page, id) => page.evaluate(([id]) => { document.getElementById(id).dataset.name = '편집 ' + performance.now(); window.pushHistory('편집'); }, [id]);

test('C0 [대조] 제스처 없는 연속 편집 — 상한으로 쓴다', async ({ page }) => {
  const id = await boot(page);
  expect(await repeat(page, () => edit(page, id))).toBeGreaterThan(0);
});

test('C1 손잡이 짧은 끌기 반복 — 상한 안에 쓴다', async ({ page }) => {
  const id = await boot(page);
  await selectFrame(page, id);
  expect(await repeat(page, async (i) => { const h = await centerOf(page, SEL); const d = i % 2 ? 40 : -40; await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x + d, h.y + d, { steps: 2 }); await page.mouse.up(); })).toBeGreaterThan(0);
});

test('C2 팬 반복 — 앞 편집이 상한 안에 쓰인다', async ({ page }) => {
  const id = await boot(page);
  const w = await page.evaluate(() => { const r = document.getElementById('canvas-wrap').getBoundingClientRect(); return { x: r.left + 30, y: r.top + 30 }; });
  await edit(page, id);
  await page.mouse.move(w.x, w.y); await page.keyboard.down('Space');
  const n = await repeat(page, async (i) => { const d = i % 2 ? 20 : -20; await page.mouse.move(w.x, w.y); await page.mouse.down(); await page.mouse.move(w.x + d, w.y + d, { steps: 2 }); await page.mouse.up(); });
  await page.keyboard.up('Space');
  expect(n).toBeGreaterThan(0);
});

test('C3 거터 짧은 끌기 반복 — 상한 안에 쓴다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { window.selectBlock('dG'); document.getElementById('dG').scrollIntoView({ block: 'center' }); });
  await page.waitForFunction(() => document.querySelectorAll('#ss-handles-overlay .grd-gutter').length > 0, null, { timeout: 8000 });
  await settle(page);
  const gut = () => page.evaluate(() => { const e = [...document.querySelectorAll('#ss-handles-overlay .grd-gutter')].find((x) => getComputedStyle(x).cursor === 'row-resize' && x.offsetParent); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  expect(await repeat(page, async (i) => { const g = await gut(); const d = i % 2 ? 6 : -6; await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x, g.y + d, { steps: 2 }); await page.mouse.up(); })).toBeGreaterThan(0);
});

test('C4 제스처 사이가 길면 평소처럼 1.5초 뒤 쓴다(상한이 앞당기지 않는다)', async ({ page }) => {
  const id = await boot(page);
  await selectFrame(page, id);
  await page.clock.install();
  const h = await centerOf(page, SEL);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 40, h.y - 40, { steps: 2 }); await page.mouse.up();
  await page.clock.runFor(1000);
  expect(await writes(page), '디바운스 안').toBe(0);
  await page.clock.runFor(800);
  await expect.poll(() => writes(page)).toBe(1);
});

test('U1 저장 진행 중 쥐고 고치면 — 저장이 끝나도 «미저장»이고 beforeunload 가 새 폭을 쓴다', async ({ page }) => {
  const id = await boot(page);
  await selectFrame(page, id);
  await page.clock.install();
  await page.evaluate(([id]) => { window.__holdSave = true; document.getElementById(id).dataset.name = '앞 편집'; window.pushHistory('앞 편집'); }, [id]);
  await page.clock.runFor(1600);
  await page.waitForFunction(() => window.__saving === true, null, { timeout: 5000 });
  const h = await centerOf(page, SEL);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 40, h.y - 40, { steps: 2 });
  const w = await page.evaluate((id) => document.getElementById(id).dataset.width, id);
  await page.evaluate(() => window.__endSave());
  await expect.poll(() => page.evaluate(() => window.__saving)).toBe(false);
  expect(await page.evaluate(() => window.__autoSaveDeferState()), '[전제] 쥔 채 예약이 기억돼 있다').toEqual({ deferred: true, pending: true });
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '미저장으로 안다').toBe(true);
  const sync = await page.evaluate(() => { window.dispatchEvent(new Event('beforeunload')); return window.__sync.at(-1) || ''; });
  expect(sync.includes(id) && (sync.includes(`data-width=\\"${w}\\"`) || sync.includes(`data-width=\\\\\\"${w}\\\\\\"`)), `종료 저장에 새 폭 ${w}`).toBe(true);
  await page.mouse.up();
});

test('U2 [지킴] 놓은 뒤 저장이 끝나면 미저장이 안 남는다(예약이 고착되지 않는다)', async ({ page }) => {
  const id = await boot(page);
  await selectFrame(page, id);
  await page.clock.install();
  const h = await centerOf(page, SEL);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 40, h.y - 40, { steps: 2 }); await page.mouse.up();
  await page.clock.runFor(2000);
  await expect.poll(() => page.evaluate(() => window.hasUnsavedChanges())).toBe(false);
  expect(await page.evaluate(() => window.__autoSaveDeferState())).toEqual({ deferred: false, pending: false });
});
