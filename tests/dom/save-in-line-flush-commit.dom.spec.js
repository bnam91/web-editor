/* save-in-line-flush-commit — flushSave·커밋 저장이 자동저장과 같은 줄에 선다. 앞 저장의 옛 본이 뒤 저장을 안 덮는다(RENDERER-LOAD-SAVE-ROUNDTRIP-FIVE-LEFT-01).
 * 자: 저장 입구(saveProject)에 넘어온 차례와 끝 파일의 표식. 파일은 앱이 잰다. 유료 호출 0.
 * 칸: Q1·Q2 앞 저장이 읽는 중에 편집 + flush/커밋 — 끝 파일에 편집 · Q3·Q4 flush/커밋이 읽는 중에 편집 + 자동저장 · Q5 flush 는 줄이 빌 때까지 기다린다.
 * 음성: N1 beforeunload 동기 저장은 앞 저장이 붙잡혀 있어도 곧바로 나간다 · N2 flush 실패면 저장됨 표시를 안 한다 · N3 프로젝트 읽는 중 flush 는 안 쓴다.
 * 양성대조: flush·커밋을 옛 load→save 로 되돌리면 Q1~Q5 빨강, N 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const ID = 'proj_q';
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate((id) => {
    const project = { ...window.buildEmptyProject(id, id), id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P', pageSettings: {}, canvas: `<div class="section-block" id="sec_q"><div class="section-inner"></div></div>` }] };
    window.__file = JSON.parse(JSON.stringify(project)); window.__saves = []; window.__syncs = []; window.__holdNext = null; window.__failSave = false;
    const fake = {
      loadProject: async () => { const v = JSON.parse(JSON.stringify(window.__file)); if (window.__holdNext) { const h = window.__holdNext; window.__holdNext = null; window.__held = true; await h; } return v; },
      saveProject: async (p) => { window.__saves.push(JSON.stringify(p).match(/qm\d+/g) || []); if (window.__failSave) throw new Error('EPERM'); window.__file = JSON.parse(JSON.stringify(p)); return { ok: true }; },
      saveProjectSync: (p) => { window.__syncs.push(JSON.stringify(p).match(/qm\d+/g) || []); return { ok: true }; },
      saveProjectMeta: async () => ({ ok: true }),
    };
    window.electronAPI = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
    window.IS_ELECTRON = true;
    window.openTabs = [{ id, name: id }]; window.activeProjectId = id; history.replaceState(null, '', '?project=' + id);
    window.applyProjectData(JSON.parse(JSON.stringify(project)));
    window.__edit = (m) => { const sec = document.querySelector('#canvas .section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addTextBlock('body'); const t = [...sec.querySelectorAll('.text-block')].pop(); (t.querySelector('[contenteditable]') || t).textContent = m; window.deselectAll(); window.scheduleAutoSave?.(); };
    window.__hold = () => { let rel; window.__holdNext = new Promise((r) => { rel = r; }); window.__rel = rel; window.__held = false; };
  }, ID);
  await settle(page);
  await page.waitForFunction(() => !window.hasUnsavedChanges());
  return errs;
}
const inFile = (page, m) => page.evaluate((m) => JSON.stringify(window.__file).includes(m), m);
const quiet = (page) => page.waitForFunction(() => !window.hasUnsavedChanges() && !window._isSavingToFile, null, { timeout: 15000 });
/* 앞 저장이 파일을 읽는 중인 때까지 간다 */
const startAutoHeld = async (page, m) => { await page.evaluate((m) => { window.__hold(); window.__edit(m); }, m); await page.waitForFunction(() => window.__held, null, { timeout: 8000 }); };

for (const [name, fn] of [['flush', 'flushSave'], ['커밋', 'saveProjectFile']]) {
  test(`Q ${name} — 자동저장이 읽는 중에 편집하고 ${name} 해도 끝 파일에 편집이 있다`, async ({ page }) => {
    const errs = await setup(page);
    await startAutoHeld(page, 'qm1');
    await page.evaluate((m) => window.__edit(m), 'qm2'); await settle(page);   // 편집이 자동저장 타이머까지 간 뒤에 부른다(앱 순서)
    await page.evaluate((fn) => { window.__y = window[fn](); }, fn);
    await settle(page);
    await page.evaluate(() => window.__rel());
    await page.evaluate(() => window.__y); await settle(page); await quiet(page);
    expect(await inFile(page, 'qm1')).toBe(true);
    expect(await inFile(page, 'qm2'), '★앞 저장의 옛 본이 덮었다').toBe(true);
    expect(errs).toEqual([]);
  });
  test(`Q ${name} 가 읽는 중에 편집 — 자동저장이 ${name} 의 옛 본에 안 덮인다`, async ({ page }) => {
    const errs = await setup(page);
    await page.evaluate(([fn]) => { window.__edit('qm1'); window.__hold(); window.__x = window[fn](); }, [fn]);
    await page.waitForFunction(() => window.__held, null, { timeout: 8000 });
    await page.evaluate(() => window.__edit('qm2'));
    await page.waitForFunction(() => { /* 대기 중인 자동저장이 돌 때까지 */ return window.__saves.length > 0 || window.hasUnsavedChanges(); });
    await page.waitForFunction(() => window.__saves.some((s) => s.includes('qm2')) || window._isSavingToFile, null, { timeout: 8000 });
    await page.evaluate(() => window.__rel());
    await page.evaluate(() => window.__x); await settle(page); await quiet(page);
    expect(await inFile(page, 'qm2'), '★옛 본이 덮었다').toBe(true);
    expect(errs).toEqual([]);
  });
}
test('Q5 flush 는 줄이 빌 때까지 기다린다 — 돌아오면 파일에 그 편집이 있다', async ({ page }) => {
  const errs = await setup(page);
  await startAutoHeld(page, 'qm1');
  await page.evaluate(() => { window.__edit('qm2'); window.__done = false; window.flushSave().then(() => { window.__done = true; }); });
  await settle(page);
  expect(await page.evaluate(() => window.__done), '앞 저장이 붙잡혀 있는 동안은 안 끝난다').toBe(false);
  await page.evaluate(() => window.__rel());
  await page.waitForFunction(() => window.__done);
  expect(await inFile(page, 'qm2')).toBe(true);
  expect(errs).toEqual([]);
});
test('N1 [음성] beforeunload 동기 저장은 앞 저장이 붙잡혀 있어도 곧바로 나간다', async ({ page }) => {
  const errs = await setup(page);
  await startAutoHeld(page, 'qm1');
  await page.evaluate(() => { window.__edit('qm2'); window.flushSave(); });
  await settle(page);
  await page.evaluate(() => { window.__edit('qm3'); window.dispatchEvent(new Event('beforeunload')); });
  expect(await page.evaluate(() => window.__syncs.at(-1)), '★동기 저장이 줄에 막혔다').toContain('qm3');
  await page.evaluate(() => window.__rel());
  expect(errs).toEqual([]);
});
test('N2 [음성] flush 저장 실패면 저장됨 표시를 안 하고 미저장으로 남는다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.__failSave = true; window.__edit('qm1'); });
  await page.evaluate(() => window.flushSave()); await settle(page);
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '★실패했는데 저장됨').toBe(true);
  expect(await inFile(page, 'qm1')).toBe(false);
  expect(errs).toEqual([]);
});
test('N3 [음성] 프로젝트 읽는 중 flush 는 파일에 안 쓴다', async ({ page }) => {
  const errs = await setup(page);
  const n = await page.evaluate(async (id) => { window.holdTabFirstLoading(id); await window.flushSave(); window.releaseTabFirstLoading(id); return window.__saves.length; }, ID);
  expect(n).toBe(0);
  expect(errs).toEqual([]);
});
