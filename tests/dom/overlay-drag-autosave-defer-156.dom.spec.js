/* overlay-drag-autosave-defer-156.dom.spec.js — ★156 F4-SECOND-HITCH(지디 처방 ⓑ): 오버레이 끌기 동안 자동저장을 «미룬다»(deferAutoSave) · 놓을 때 «한 번» 다시 건다(resumeAutoSave).
 * 까닭(실앱 실측 · 21943f57 · 수지 저장본 · 인텔): 끌기 첫 이동 ≈4.2s 뒤 자동저장 직렬화(serializeProject · getSerializedCanvas)가 끌기 «도중» 1.6~2.4s 정지.
 * 고침: js/overlay-float.js bindFloatMoveDrag — 끌기가 열릴 때(moved=true) window.deferAutoSave · onUp 끝에 window.resumeAutoSave(팬 제스처 editor.js 와 같은 기전).
 *   ⛔AutoSaveSuppress.begin(«버림») 아님 — 미룬 동안의 예약은 _autoSavePending 에 기억(save-load.js).
 * 자: window.__autoSaveDeferState() · localStorage 자동저장본 쓰기 수(web-editor-autosave__<pid> · electronAPI 가짜 — drag-move-autosave 와 같은 판정).
 * 판정: D1 [새 것] 끄는 동안 deferred · 쓰기 0 → 놓은 뒤 deferred 풀림 · 3초 안 쓰기 정확히 1 · 저장본에 새 자리 / D2 [지킴] 제자리 클릭 = 미룸 0
 *   D3 [지킴 · 음성대조 (가)] 팬(스페이스+밀기)의 미룸·풀림 그대로.  기다림은 전부 조건(남은 고정 대기 = 부팅 직후 늦은 저장 흡수 · drag-move-autosave 와 같은 꼴). */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN } = require('./_root-harness.js');
const PID = 'proj_1700000000156';
test.describe.configure({ timeout: 60000 });
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };

async function boot(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html?project=${PID}`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.hasUnsavedChanges === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(2500);   // 열기 뒤 늦게 오는 저장(있으면)이 끝나게
  return errs;
}

async function scene(page) {
  const id = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="dS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(50);
    window.selectSection(document.getElementById('dS')); window.addModalBlock();
    const m = [...document.querySelectorAll('#dS .modal-block')].pop(); window.OverlayFloat.enterFloat(m); window.deselectAll?.();
    m.scrollIntoView({ block: 'center' }); return m.id;
  });
  await page.waitForFunction((id) => { const b = document.getElementById(id); return !!(b && (b.closest('[data-overlay-block="true"]') || b.dataset.overlayBlock === 'true')); }, id);
  await page.evaluate((pid) => { window.__lsKey = 'web-editor-autosave__' + pid; window.__lsWrites = []; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k) === window.__lsKey) window.__lsWrites.push([Math.round(performance.now()), String(v).length]); return o.call(this, k, v); }; }, PID);   /* ★본 저장본 키 «하나»만 센다 — 한 번의 저장이 같은 머리의 작은 키(13자)도 함께 쓴다(실측: 같은 ms 에 두 줄) */
  return id;
}
const st = (page) => page.evaluate(() => window.__autoSaveDeferState());
const writes = (page) => page.evaluate(() => window.__lsWrites.length);
const posOf = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }, id);

test('D1 [새 것] 오버레이 모달 끌기 — 끄는 동안 미룸(저장 쓰기 0) · 놓으면 풀려 «한 번» 저장 · 저장본에 새 자리', async ({ page }) => {
  const errs = await boot(page); const id = await scene(page);
  const c = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + Math.min(20, r.height / 2)]; }, id);
  await page.mouse.click(c[0], c[1]); await page.waitForTimeout(800);   // 클릭 바로 뒤 누르면 더블클릭으로 간다(drag-move-autosave 실측)
  await expect.poll(() => st(page), { message: '[전제] 끌기 전 미룸 없음' }).toEqual({ deferred: false, pending: false });
  const p0 = await posOf(page, id);
  await page.mouse.move(c[0], c[1]); await page.mouse.down();
  await page.mouse.move(c[0] + 20, c[1] + 12, { steps: 4 });
  await expect.poll(() => posOf(page, id), { message: '[전제] 상자가 따라왔다' }).not.toEqual(p0);
  expect((await st(page)).deferred, '끄는 동안 = 미룸').toBe(true);
  const w0 = await writes(page);
  await page.mouse.move(c[0] + 60, c[1] + 30, { steps: 6 });
  await page.waitForTimeout(2200);   // ★디바운스(1.5s)를 «넘겨» 쥔다 — 미룸이 없으면 이 사이 저장이 터진다(고치기 전 판)
  expect(await writes(page) - w0, '끄는 동안 자동저장 쓰기 0(미룸)').toBe(0);
  expect(await st(page), '끄는 동안 예약은 기억된다').toEqual({ deferred: true, pending: true });
  await page.mouse.up();
  await expect.poll(() => st(page).then(s => s.deferred), { message: '놓으면 미룸 풀림' }).toBe(false);
  await expect.poll(() => writes(page), { timeout: 5000, message: '놓은 뒤 저장이 걸린다' }).toBeGreaterThan(w0);
  await page.waitForTimeout(2000);
  expect(await writes(page) - w0, '놓은 뒤 저장 «한 번»').toBe(1);
  const left = await page.evaluate((id) => document.getElementById(id).closest('[data-overlay-block="true"]')?.style.left || document.getElementById(id).style.left, id);
  expect(await page.evaluate(([pid, left]) => (localStorage.getItem('web-editor-autosave__' + pid) || '').includes(left), [PID, left]), `저장본에 새 자리(${left})`).toBe(true);
  expect(errs).toEqual([]);
});

test('D2 [지킴] 제자리 클릭(안 끎) — 미룸이 안 생긴다', async ({ page }) => {
  const errs = await boot(page); const id = await scene(page);
  const c = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + Math.min(20, r.height / 2)]; }, id);
  await page.mouse.move(c[0], c[1]); await page.mouse.down(); await page.mouse.move(c[0] + 1, c[1] + 1); 
  expect((await st(page)).deferred, '3px 안 = 끌기 아님 = 미룸 0').toBe(false);
  await page.mouse.up();
  expect(await st(page)).toEqual({ deferred: false, pending: false });
  expect(errs).toEqual([]);
});

test('D3 [지킴 · 음성대조 (가)] 팬(스페이스+밀기)의 미룸·풀림은 그대로', async ({ page }) => {
  const errs = await boot(page); await scene(page);
  const w = await page.evaluate(() => { const r = document.getElementById('canvas-wrap').getBoundingClientRect(); return [r.left + 30, r.top + 30]; });
  await page.mouse.move(w[0], w[1]); await page.keyboard.down('Space');
  await page.mouse.down(); await page.mouse.move(w[0] + 40, w[1] + 40, { steps: 4 });
  expect((await st(page)).deferred, '팬 중 미룸').toBe(true);
  await page.mouse.up(); await page.keyboard.up('Space');
  await expect.poll(() => st(page).then(s => s.deferred), { message: '팬 끝 = 풀림' }).toBe(false);
  expect(errs).toEqual([]);
});
