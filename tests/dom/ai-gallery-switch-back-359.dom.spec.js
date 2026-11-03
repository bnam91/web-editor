/* ai-gallery-switch-back-359 — 생성 중 다른 탭으로 옮겼다 돌아와 편집해도 갤러리 항목이 안 지워진다 (J359A)
 * 왜: 전환 길이 항목을 파일에만 붙이고 탭 캐시를 안 고쳐, 돌아오면 옛 캐시가 복원되고 다음 저장이 항목 없는 갤러리로 파일을 덮었다.
 *   앱 실측: ~/gd-lane/imac-gd-L1/359. 유료 호출 0 — electronAPI 가 가짜다.
 * 자: 저장 입구(saveProject)에 넘어온 프로젝트별 imageGallery 길이와 window.state.imageGallery. 파일은 앱이 잰다.
 * 칸: G1 돌아와 편집 — 화면 1 · 저장 1 · G2 [음성] 전환 없음 — 저장 1 · G3 저장 중 전환 — 떠날 때 저장 뒤에 항목이 쓰인다
 *     G4 파일 쓰기 실패 — 돌아온 화면엔 남고 다음 저장에 들어간다 · G5 이미지 저장 중 돌아옴 — 화면 1 · 저장 1.
 *     G6 이미지 저장 중 옮김 — 원 프로젝트 파일에 들어가고 옮겨 간 쪽 화면·파일에 안 들어간다 · G7 G6 뒤 돌아와 편집해도 남는다 · G8 여러 장 중간에 옮김 — 전부 원 프로젝트에.
 * 변이(G6~G8): 응답 직후 한 번만 재는 옛 판으로 되돌리면 빨강.
 * 변이: 탭 캐시 갱신을 빼면 G1·G4 빨강 · 저장 기다림을 빼면 G3 빨강 · 돌아옴 갈래를 빼면 G5 빨강 · G2 는 늘 초록.
 * ★처음 실행 기록: 2026-11-02 20:1x · 아이맥 · 판 0541078b · w1 · retries 0 · 고친 판 repeat-each 3 15/15 · 변이 각 ×1: 캐시 G1·G4 빨강 · 기다림 G3 빨강 · 돌아옴 G5 빨강 · 나머지 초록 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [X, Y] = ['proj_359x', 'proj_359y'];

const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate((ids) => {
    const project = (id) => ({ ...window.buildEmptyProject(id, id), id, name: id, version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'P', pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}"><div class="section-inner"></div></div>` }] });
    const files = new Map(ids.map(id => [id, project(id)]));
    window.__files = files; window.__fail = new Set(); window.__hold = null; window.__holdImg = null;
    window.__gen = {}; window.__genStarted = new Promise(r => { window.__genStart = r; });
    const fake = {
      loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id) || null)),
      saveProject: async (p) => { if (window.__hold && !(p.imageGallery || []).length) await window.__hold; if (window.__fail.has(p.id)) throw new Error('EPERM'); files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true }; },
      saveProjectSync: () => ({ ok: true }),
      aiGenerateImage: () => { window.__genStart(); return new Promise(r => { window.__gen.done = () => r({ ok: true, items: [{ b64: 'AAAA', mime: 'image/png' }], cost: { tokens: 0, krwApprox: 0 } }); }); },
      aiSaveImage: async () => { if (window.__holdImg) await window.__holdImg; return { ok: true, id: 'img_359', blobPath: 'ai/img_359.png', mime: 'image/png' }; },
    };
    window.electronAPI = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
    window.openTabs = ids.map(id => ({ id, name: id, _cache: JSON.stringify(files.get(id)) }));
    window.activeProjectId = ids[0];
    history.replaceState(null, '', '?project=' + ids[0]);   // 생성 입구는 프로젝트 id 를 주소에서 읽는다
    window.applyProjectData(JSON.parse(window.openTabs[0]._cache));
  }, [X, Y]);
  await settle(page);
  await page.waitForFunction(() => !window.hasUnsavedChanges());
  return errs;
}
const go = (page, id) => page.evaluate((id) => window.switchTab(id), id);
const startGen = (page) => page.evaluate(async () => { window.__genP = window.generateAIImage({ prompt: 'p', model: 'gemini-2.5-flash-image', count: 1 }); await window.__genStarted; });
const finishGen = (page) => page.evaluate(async () => { window.__gen.done(); await window.__genP; });
const live = (page) => page.evaluate(() => (window.state.imageGallery || []).length);
const onFile = (page, id) => page.evaluate((id) => (window.__files.get(id).imageGallery || []).length, id);
const editAndSaved = async (page, id) => {
  await page.evaluate((id) => { const f = window.__files.get(id); window.__before = f.pages[0].canvas; window.selectSection?.(document.querySelector('#canvas .section-block')); window.addTextBlock('h2'); }, id);
  await page.waitForFunction((id) => window.__files.get(id).pages[0].canvas !== window.__before && !window.hasUnsavedChanges(), id, { timeout: 15000 });
};

test('G1 생성 중 옮겼다 돌아와 편집 — 항목이 안 지워진다', async ({ page }) => {
  const errs = await setup(page);
  await startGen(page); await go(page, Y); await finishGen(page);
  expect(await onFile(page, X), '[전제] 파일에 붙었다').toBe(1);
  expect(await onFile(page, Y), '옮겨 간 프로젝트는 안 더럽힌다').toBe(0);
  await go(page, X); await settle(page);
  expect(await live(page), '★돌아온 화면에 항목이 없다').toBe(1);
  await editAndSaved(page, X);
  expect(await onFile(page, X), '★편집 저장이 항목을 지웠다').toBe(1);
  expect(errs).toEqual([]);
});

test('G2 [음성] 전환 없음 — 항목이 저장된다', async ({ page }) => {
  const errs = await setup(page);
  await startGen(page); await finishGen(page);
  expect(await live(page)).toBe(1);
  await editAndSaved(page, X);
  expect(await onFile(page, X)).toBe(1);
  expect(errs).toEqual([]);
});

test('G3 떠날 때 저장이 도는 중 끝남 — 그 저장이 항목을 덮지 않는다', async ({ page }) => {
  const errs = await setup(page);
  await startGen(page);
  await page.evaluate(() => { window.selectSection?.(document.querySelector('#canvas .section-block')); window.addTextBlock('h2'); window.__hold = new Promise(r => { window.__release = r; }); });
  await page.waitForFunction(() => window.hasUnsavedChanges());
  await go(page, Y);
  await page.waitForFunction(() => window._isSavingToFile);
  await page.evaluate(() => { window.__gen.done(); window.__genP.then(() => { window.__genDone = true; }); });
  await settle(page);   // 기다림을 빼면 이 사이에 항목이 파일에 먼저 쓰이고, 아래 풀린 저장이 그것을 덮는다
  await page.evaluate(() => { window.__hold = null; window.__release(); });
  await page.waitForFunction(() => !window._isSavingToFile && window.__genDone);
  expect(await onFile(page, X), '★떠날 때 저장이 항목을 덮었다').toBe(1);
  expect(errs).toEqual([]);
});

test('G4 파일 쓰기 실패 — 돌아온 화면엔 남고 다음 저장에 들어간다', async ({ page }) => {
  const errs = await setup(page);
  await startGen(page); await go(page, Y);
  await page.evaluate((X) => window.__fail.add(X), X);
  await finishGen(page);
  expect(await onFile(page, X), '[전제] 파일 쓰기가 실패했다').toBe(0);
  await page.evaluate((X) => window.__fail.delete(X), X);
  await go(page, X); await settle(page);
  expect(await live(page), '★쓰기 실패한 항목이 화면에서도 사라졌다').toBe(1);
  await editAndSaved(page, X);
  expect(await onFile(page, X)).toBe(1);
  expect(errs).toEqual([]);
});

test('G5 이미지 저장 중 돌아옴 — 화면에 들어가고 저장된다', async ({ page }) => {
  const errs = await setup(page);
  await startGen(page); await go(page, Y);
  await page.evaluate(() => { window.__holdImg = new Promise(r => { window.__relImg = r; }); window.__gen.done(); });
  await settle(page);
  await go(page, X); await settle(page);
  await page.evaluate(async () => { window.__relImg(); await window.__genP; });
  expect(await live(page), '★돌아온 화면에 항목이 없다').toBe(1);
  await editAndSaved(page, X);
  expect(await onFile(page, X), '★저장에 항목이 없다').toBe(1);
  expect(await onFile(page, Y)).toBe(0);
  expect(errs).toEqual([]);
});

const holdImage = (page) => page.evaluate(() => { window.__holdImg = new Promise(r => { window.__releaseImg = () => { window.__holdImg = null; r(); }; }); });
const releaseImage = (page) => page.evaluate(() => window.__releaseImg());
const inFlight = (page) => page.evaluate(async () => { window.__gen.done(); await new Promise(r => setTimeout(r, 0)); });
const saved = (page) => page.waitForFunction(() => !window.hasUnsavedChanges() && !window._isSavingToFile, null, { timeout: 15000 });

test('G6 이미지 저장 중 옮김 — 원 프로젝트 파일에 들어가고 옮겨 간 쪽엔 안 들어간다', async ({ page }) => {
  const errs = await setup(page);
  await holdImage(page); await startGen(page); await inFlight(page);
  await go(page, Y); await releaseImage(page); await page.evaluate(() => window.__genP); await settle(page); await saved(page);
  expect(await onFile(page, X), '★원 프로젝트에서 빠졌다').toBe(1);
  expect(await live(page), '★옮겨 간 프로젝트 화면에 들어갔다').toBe(0);
  expect(await onFile(page, Y), '★옮겨 간 프로젝트 파일에 들어갔다').toBe(0);
  expect(errs).toEqual([]);
});
test('G7 G6 뒤 돌아와 편집해도 남는다', async ({ page }) => {
  const errs = await setup(page);
  await holdImage(page); await startGen(page); await inFlight(page);
  await go(page, Y); await releaseImage(page); await page.evaluate(() => window.__genP); await settle(page); await saved(page);
  await go(page, X); await settle(page);
  expect(await live(page), '★돌아온 화면에 없다').toBe(1);
  await editAndSaved(page, X);
  expect(await onFile(page, X), '★편집 저장이 지웠다').toBe(1);
  expect(await onFile(page, Y)).toBe(0);
  expect(errs).toEqual([]);
});
test('G8 여러 장 중간에 옮김 — 전부 원 프로젝트에', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.__imgN = 0; const old = window.electronAPI; const hold = new Promise(r => { window.__releaseImg = r; }); window.electronAPI = new Proxy(old, { get: (t, k) => {
    if (k === 'aiSaveImage') return async () => { const n = ++window.__imgN; if (n === 2) await hold; return { ok: true, id: 'img_m' + n, blobPath: 'ai/img_m' + n + '.png', mime: 'image/png' }; };
    if (k === 'aiGenerateImage') return () => { window.__genStart(); return new Promise(r => { window.__gen.done = () => r({ ok: true, items: [{ b64: 'AAAA', mime: 'image/png' }, { b64: 'BBBB', mime: 'image/png' }], cost: { tokens: 0, krwApprox: 0 } }); }); };
    return t[k]; } }); });
  await page.evaluate(async () => { window.__genP = window.generateAIImage({ prompt: 'p', model: 'gemini-2.5-flash-image', count: 2 }); await window.__genStarted; window.__gen.done(); });
  await page.waitForFunction(() => window.__imgN === 2);
  await go(page, Y); await page.evaluate(() => window.__releaseImg()); await page.evaluate(() => window.__genP); await settle(page); await saved(page);
  expect(await onFile(page, X), '★둘 다 원 프로젝트에').toBe(2);
  expect(await live(page)).toBe(0); expect(await onFile(page, Y)).toBe(0);
  expect(errs).toEqual([]);
});
test('G9 둘째 장 저장이 던져도 첫 장은 남는다', async ({ page }) => {
  const errs = await setup(page);
  const out = await page.evaluate(async () => { window.__imgN = 0; const old = window.electronAPI; window.electronAPI = new Proxy(old, { get: (t, k) => {
    if (k === 'aiSaveImage') return async () => { const n = ++window.__imgN; if (n === 2) throw new Error('EPERM'); return { ok: true, id: 'img_t' + n, blobPath: 'ai/img_t' + n + '.png', mime: 'image/png' }; };
    if (k === 'aiGenerateImage') return async () => ({ ok: true, items: [{ b64: 'AAAA', mime: 'image/png' }, { b64: 'BBBB', mime: 'image/png' }], cost: { tokens: 0, krwApprox: 0 } });
    return t[k]; } });
    const r = await window.generateAIImage({ prompt: 'p', model: 'gemini-2.5-flash-image', count: 2 }); return { ok: r.ok, n: r.items.length }; });
  expect(out).toEqual({ ok: true, n: 1 });
  expect(await live(page), '★첫 장이 화면 갤러리에 없다').toBe(1);
  await settle(page); await saved(page);
  expect(await onFile(page, X)).toBe(1);
  expect(errs).toEqual([]);
});
