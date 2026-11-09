/* flush-empty-queue-inflight — FLUSH-EMPTY-QUEUE-SKIPS-INFLIGHT-01
 *   결함: 종료 flush 는 같은 id 가 줄에 서 있으면 준비 중(loadProject) 저장 본을 후보에서 뺐다. 줄의 본이 빈 본이면 빈 저장 보호로 건너뛰어
 *     둘 다 안 들어가고 파일이 그 이전 판에 머물렀다(잃는 것: 지우기 전 편집).
 *   장면: 실내용(섹션 3·텍스트·그림) A — 편집 FM1 → 자동저장이 파일을 읽는 중(붙잡음) → 전체 삭제 → 빈 본이 줄에 섬(탭 전환 저장) → 종료.
 *   Q1 종료 답 뒤 동기 저장에 FM1 이 실린 본이 들어간다 · 빈 본은 안 들어간다
 *   N1 [음성] 줄의 본이 비지 않았으면 그 본(새 본)만 쓴다 — 준비 중 옛 본으로 덮지 않는다
 * 양성대조: _flushUnfinishedSavesSync 의 대체 한 줄을 빼면 Q1 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const A = 'proj_fe';
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function setup(page) {
  await page.addInitScript(() => {
    const fake = { onForceSaveBeforeQuit: (f) => { window.__quit = f; }, quitReady: (r) => { window.__answer = r; } };
    window.__fake = fake;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  });
  const errs = await bootApp(page);
  await page.evaluate(([A, IMG]) => {
    const sec = (i) => `<div class="section-block" id="sec_${i}"><div class="section-inner"><div class="text-block" id="tb_${i}"><div contenteditable="true">본문${i}</div></div><div class="asset-block" id="ab_${i}"><img src="${IMG}"></div></div></div>`;
    const project = { ...window.buildEmptyProject(A, A), id: A, name: A, version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: sec(1) + sec(2) + sec(3) }] };
    window.__file = JSON.parse(JSON.stringify(project)); window.__syncs = []; window.__holdNext = null;
    Object.assign(window.__fake, {
      loadProject: async () => { const v = JSON.parse(JSON.stringify(window.__file)); if (window.__holdNext) { const h = window.__holdNext; window.__holdNext = null; window.__held = true; await h; } return v; },
      saveProject: async (p) => { window.__file = JSON.parse(JSON.stringify(p)); return { ok: true }; },
      saveProjectSync: (p) => { window.__syncs.push(p); window.__file = JSON.parse(JSON.stringify(p)); return { ok: true }; },
      saveProjectMeta: async () => ({ ok: true }),
    });
    window.openTabs = [{ id: A, name: A, _cache: JSON.stringify(project) }];
    window.activeProjectId = A; history.replaceState(null, '', '?project=' + A);
    window.applyProjectData(JSON.parse(JSON.stringify(project)));
  }, [A, IMG]);
  await page.waitForFunction(() => !window.hasUnsavedChanges?.());
  return errs;
}
/* FM1 편집 → 자동저장이 파일을 읽는 중에 붙잡힌다 */
async function editAndHold(page) {
  await page.evaluate(() => {
    let rel; window.__holdNext = new Promise((r) => { rel = r; }); window.__rel = rel; window.__held = false;
    document.querySelector('#tb_2 [contenteditable]').textContent = 'FM1';
    window.saveProjectToFile(JSON.parse(window.serializeProject()), { skipThumbnail: true });
  });
  await page.waitForFunction(() => window.__held, null, { timeout: 8000 });
}
const quit = (page) => page.evaluate(async () => { window.__quit(); await new Promise((r) => { const iv = setInterval(() => { if (window.__answer) { clearInterval(iv); r(); } }, 20); }); return window.__answer; });
const fileHas = (page, m) => page.evaluate((m) => JSON.stringify(window.__file).includes(m), m);

test('Q1 준비 중 실내용 저장 + 줄의 빈 본 → 종료: 실내용(FM1)이 파일에 들어간다', async ({ page }) => {
  test.setTimeout(30000);
  const errs = await setup(page);
  await editAndHold(page);
  await page.evaluate((A) => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());   // 전체 삭제
    window.saveProjectToFile(JSON.parse(window.serializeProject()), { projectId: A, skipThumbnail: true });   // 탭 전환 저장 — 줄에 선다
  }, A);
  expect(await page.evaluate(() => window._isAllCanvasEmpty?.(JSON.parse(window.serializeProject())) ?? !document.querySelector('#canvas .section-block')), '[전제] 화면이 비었다').toBe(true);
  const a = await quit(page);
  expect(a.ok).toBe(true);
  expect(await page.evaluate(() => window.__syncs.length), '★종료 flush 가 아무것도 안 썼다').toBe(1);
  expect(await fileHas(page, 'FM1'), '★지우기 전 편집을 잃었다').toBe(true);
  expect(await fileHas(page, 'sec_3'), '빈 본으로 덮지 않았다').toBe(true);
  await page.evaluate(() => window.__rel()); await page.waitForFunction(() => !window._isSavingToFile);
  expect(await fileHas(page, 'FM1'), '풀린 준비 중 저장이 뒤에 덮지 않는다').toBe(true);
  expect(errs).toEqual([]);
});

test('Q2 준비 중 FM1 · 줄에 FM2 · 그 위에 빈 본 → 종료: 더 새 FM2 가 파일에 들어간다', async ({ page }) => {
  test.setTimeout(30000);
  const errs = await setup(page);
  await editAndHold(page);
  await page.evaluate((A) => {
    document.querySelector('#tb_3 [contenteditable]').textContent = 'FM2';
    window.saveProjectToFile(JSON.parse(window.serializeProject()), { projectId: A, skipThumbnail: true });   // 자동저장 — 줄에 선다
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    window.saveProjectToFile(JSON.parse(window.serializeProject()), { projectId: A, skipThumbnail: true });   // 탭 전환 저장 — 같은 줄
  }, A);
  await quit(page);
  expect(await fileHas(page, 'FM2'), '★줄의 새 본을 빈 본이 밀어냈다').toBe(true);
  await page.evaluate(() => window.__rel()); await page.waitForFunction(() => !window._isSavingToFile);
  expect(await fileHas(page, 'FM2'), '풀린 준비 중 저장(FM1 만)이 뒤에 덮지 않는다').toBe(true);
  expect(errs).toEqual([]);
});

test('Q3 종료 flush 가 줄의 새 본(FM2)을 쓴 뒤 beforeunload flush 가 한 번 더 돌아도 준비 중 옛 본(FM1)으로 안 덮는다', async ({ page }) => {
  test.setTimeout(30000);
  const errs = await setup(page);
  await editAndHold(page);
  await page.evaluate((A) => {
    document.querySelector('#tb_3 [contenteditable]').textContent = 'FM2';
    window.saveProjectToFile(JSON.parse(window.serializeProject()), { projectId: A, skipThumbnail: true });
  }, A);
  await quit(page);
  expect(await fileHas(page, 'FM2'), '[전제] 종료 flush 가 새 본을 썼다').toBe(true);
  const n0 = await page.evaluate(() => window.__syncs.length);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  /* 마지막 sync 만 보면 활성 탭 저장(화면 본 FM2)이 옛 본 쓰기를 가린다 — 두 번째 flush 의 sync 전부를 본다 */
  const after = await page.evaluate((n0) => window.__syncs.slice(n0).map((p) => JSON.stringify(p).includes('FM2')), n0);
  expect(after.length, '[전제] 두 번째 flush 가 돌았다').toBeGreaterThan(0);
  expect(after.every(Boolean), '★두 번째 flush 가 옛 본(FM1)으로 덮었다').toBe(true);
  expect(await fileHas(page, 'FM2')).toBe(true);
  await page.evaluate(() => window.__rel()); await page.waitForFunction(() => !window._isSavingToFile);
  expect(errs).toEqual([]);
});

test('N1 [음성] 줄의 본이 비지 않았으면 그 본(새 본)만 쓴다', async ({ page }) => {
  test.setTimeout(30000);
  const errs = await setup(page);
  await editAndHold(page);
  await page.evaluate((A) => {
    document.querySelector('#tb_3 [contenteditable]').textContent = 'FM2';
    window.saveProjectToFile(JSON.parse(window.serializeProject()), { projectId: A, skipThumbnail: true });
  }, A);
  await page.evaluate(() => { document.querySelector('#tb_3 [contenteditable]').textContent = 'FM2'; });
  await quit(page);
  const syncs = await page.evaluate(() => window.__syncs.map((p) => JSON.stringify(p).includes('FM2')));
  expect(syncs.at(-1), '마지막 동기 저장은 새 본').toBe(true);
  await page.evaluate(() => window.__rel()); await page.waitForFunction(() => !window._isSavingToFile);
  expect(await fileHas(page, 'FM2'), '옛 본으로 덮지 않았다').toBe(true);
  expect(errs).toEqual([]);
});
