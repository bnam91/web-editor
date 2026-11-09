/* scratch-x-flush-now — SCRATCH-X-THEN-CRASH-WITHIN-SAVE-WINDOW-01: 스크래치 ✕·⌘Z·⌘⇧Z 뒤 «파일» 매니페스트가 1.5초 자동저장을 안 기다리고 바로 맞는다
 *   결함(원문 ×3 · J214 K판): ✕ 는 IndexedDB 만 바로 쓰고 proj.json pages[].scratchpad 는 1.5초 미룬 자동저장 때 갈렸다 ⇒ 그 창 안 비정상 종료면
 *     파일에 지운 장이 남아 IndexedDB 없는 곳(다른 맥)에서 매니페스트로 되살아났다.
 *   자: 가짜 electronAPI.saveProject 가 받은 proj(= 디스크) 의 pages[0].scratchpad. «1초 안»(자동저장 1.5초보다 짧게) 맞는지 잰다.
 *   X1 ✕ → 1초 안 파일에 그 장 없음 · X2 ⌘Z → 1초 안 다시 있음 · X3 ⌘⇧Z → 1초 안 다시 없음 · X4 연달아 ✕ 5번 → 저장 수 기록 + 끝 파일 = 0장
 * 양성대조: js/scratch-pad.js 를 기준판(5cebeb139)으로 되돌리면 X1·X2·X3 빨강(1.5초 미룬 저장). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const A = 'proj_xc';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
/* 파일이 맞을 때까지 잰 시간(ms) — «1초 안» 단언은 잰 값으로 한다(자동저장 1.5초보다 짧게). poll 의 timeout 을 1초로 조이면 술어 대기까지 그 안에 넣어 흔들렸다(인텔 2/3) */
const until = async (page, want) => { const t0 = Date.now(); await expect.poll(() => onDisk(page), { timeout: 6000, intervals: [25] }).toEqual(want); return Date.now() - t0; };

async function setup(page, n = 1) {
  await page.addInitScript(() => {
    let k = 0;
    const fake = { onForceSaveBeforeQuit: () => {}, quitReady: () => {},
      assetsSaveCanvasImage: async ({ projectId, mime }) => ({ ok: true, url: `goya-asset://${projectId}/h${++k}.${(mime || 'image/png').split('/')[1]}` }) };
    window.__fake = fake;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  });
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([A, PNG, n]) => {
    const project = { ...window.buildEmptyProject(A, A), id: A, name: A, version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: '<div class="section-block" id="sec_1" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>' }] };
    window.__file = JSON.parse(JSON.stringify(project)); window.__writes = 0;
    Object.assign(window.__fake, {
      loadProject: async () => JSON.parse(JSON.stringify(window.__file)),
      saveProject: async (p) => { window.__writes++; window.__file = JSON.parse(JSON.stringify(p)); return { ok: true }; },
      saveProjectSync: (p) => { window.__file = JSON.parse(JSON.stringify(p)); return { ok: true }; },
      saveProjectMeta: async () => ({ ok: true }),
    });
    window.openTabs = [{ id: A, name: A, _cache: JSON.stringify(project) }];
    window.activeProjectId = A; history.replaceState(null, '', '?project=' + A);
    window.applyProjectData(JSON.parse(JSON.stringify(project)));
    await window.switchScratch(A, 'page_1');
    for (let i = 0; i < n; i++) await window._scratchAddAndSave(PNG, 700, 200 + i * 10, 300, undefined, 'sp_' + i);
    window.clearHistory?.();
    await window.flushSave();   // 파일 매니페스트에 장이 실린 판에서 시작
  }, [A, PNG, n]);
  await page.waitForFunction(() => !window.hasUnsavedChanges?.());
  return errs;
}
const onDisk = (page) => page.evaluate(() => (window.__file.pages?.[0]?.scratchpad || []).map(i => i.id).sort());
const present = (page, id) => page.evaluate((id) => !!document.querySelector(`.scratch-item[data-scratch-id="${id}"]`), id);
async function pressX(page, id) {
  const c = await page.evaluate((id) => { const el = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 6 }; }, id);
  await waitStableRect(page, `.scratch-item[data-scratch-id="${id}"]`); await page.mouse.click(c.x, c.y); await settle(page);   // 골라야 ✕ 가 선다
  const b = await page.evaluate((id) => { const r = document.querySelector(`.scratch-item[data-scratch-id="${id}"] .scratch-close`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  await page.mouse.move(b.x, b.y); await page.mouse.click(b.x, b.y);
  await expect.poll(() => present(page, id), { message: '[전제] 지워졌다' }).toBe(false);
}

test('X1 ✕ → 1초 안에 파일 매니페스트에서 그 장이 빠진다', async ({ page }) => {
  const errs = await setup(page);
  expect(await onDisk(page), '[전제] 파일에 장이 실렸다').toEqual(['sp_0']);
  await pressX(page, 'sp_0');
  expect(await until(page, []), '★1초 안 파일에 지운 장이 남았다(1.5초 미룬 저장)').toBeLessThan(1000);
  expect(errs).toEqual([]);
});
test('X2 ✕ 뒤 ⌘Z → 1초 안에 파일에 다시 실린다 · X3 ⌘⇧Z → 다시 빠진다', async ({ page }) => {
  const errs = await setup(page);
  await pressX(page, 'sp_0');
  await expect.poll(() => onDisk(page)).toEqual([]);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => present(page, 'sp_0'), { message: '[전제] 되살아났다' }).toBe(true);
  expect(await until(page, ['sp_0']), '★X2 ⌘Z 뒤 1초 안 파일에 안 실렸다').toBeLessThan(1000);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => present(page, 'sp_0'), { message: '[전제] 다시 지워졌다' }).toBe(false);
  expect(await until(page, []), '★X3 ⌘⇧Z 뒤 1초 안 파일에 남았다').toBeLessThan(1000);
  expect(errs).toEqual([]);
});
test('X4 연달아 ✕ 5번 → 끝 파일 0장 · 저장 수 기록', async ({ page }) => {
  const errs = await setup(page, 5);
  expect(await onDisk(page)).toHaveLength(5);
  const w0 = await page.evaluate(() => window.__writes);
  for (let i = 4; i >= 0; i--) await pressX(page, 'sp_' + i);   // 겹쳐 놓였다 — 맨 위(나중 것)부터
  await expect.poll(() => onDisk(page), { timeout: 5000 }).toEqual([]);
  await page.waitForFunction(() => !window.hasUnsavedChanges?.() && !window._isSavingToFile);
  console.log('X4 saveProject 수(✕ 5번):', await page.evaluate((w0) => window.__writes - w0, w0));
  expect(errs).toEqual([]);
});
