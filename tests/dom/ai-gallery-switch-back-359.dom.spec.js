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

/* ── 리뷰 칸(앱 값 S6-gallery2): G10 다시 여는 로드 중 완료 · G11 파일 실패 3종 · G12 떠날 때 저장이 길 때 · G13 쓰는 틈에 재열기 · G14 0장·부분 ── */
const wrapApi = (page, body) => page.evaluate(body);
const toastsOn = (page) => page.evaluate(() => { window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); }; });
const lastToast = (page) => page.evaluate(() => window.__t[window.__t.length - 1] || '');
const holdLoadOf = (page, id, nth = 1) => page.evaluate(({ id, nth }) => { window.IS_ELECTRON = true;   /* 첫 로드 갈래는 앱에서만 탄다 */ const old = window.electronAPI; let rel; const hold = new Promise(r => { rel = r; }); window.__relLoad = rel; let n = 0; window.electronAPI = new Proxy(old, { get: (t, k) => k === 'loadProject' ? async (i, o) => { const v = await t.loadProject(i, o); if (i === id && ++n === nth) { window.__loadHeld = true; await hold; } return v; } : t[k] }); }, { id, nth });

test('G10 생성 중 닫았다 다시 여는 로드 중 완료 — 안 잃고 화면·파일에 들어간다', async ({ page }) => {
  const errs = await setup(page); await toastsOn(page);
  await startGen(page); await page.evaluate((X) => window.closeTab(X), X); await settle(page);
  await holdLoadOf(page, X, 2);   // 첫 읽기는 탭 이름용, 둘째가 탭 첫 로드다
  await page.evaluate((X) => { window.__open = window.openTabForProject(X); }, X); await settle(page);
  expect(await page.evaluate((X) => window.isTabFirstLoading(X), X), '[전제] 읽는 중').toBe(true);
  await page.evaluate(() => { window.__gen.done(); });
  await settle(page);
  await page.evaluate(() => window.__relLoad());
  await page.evaluate(async () => { await window.__open; await window.__genP; }); await settle(page); await saved(page);
  expect(await live(page), '★화면 갤러리에 없다').toBe(1);
  await editAndSaved(page, X);
  expect(await onFile(page, X), '★파일에 없다').toBe(1);
  expect(errs).toEqual([]);
});
for (const how of ['읽기 null', '쓰기 ok:false', '쓰기 throw']) test(`G11 파일 추가 실패(${how}) — 알린다, 무편집으로 돌아오면 파일에 들어간다`, async ({ page }) => {
  const errs = await setup(page); await toastsOn(page);
  await startGen(page); await go(page, Y); await settle(page);
  await page.evaluate(({ id, how }) => { window.__okApi = window.electronAPI; window.electronAPI = new Proxy(window.__okApi, { get: (t, k) => {
    if (how === '읽기 null' && k === 'loadProject') return async (i, o) => (i === id ? null : t.loadProject(i, o));
    if (how === '쓰기 ok:false' && k === 'saveProject') return async (p) => (p.id === id ? { ok: false, reason: 'x' } : t.saveProject(p));
    if (how === '쓰기 throw' && k === 'saveProject') return async (p) => { if (p.id === id) throw new Error('EPERM'); return t.saveProject(p); };
    return t[k]; } }); }, { id: X, how });
  await page.evaluate(async () => { window.__gen.done(); await window.__genP; });
  const t = await lastToast(page);
  expect(t, '★저장됨이라고 말한다').not.toContain('저장됨');
  expect(t).toContain('넣지 못했습니다');
  expect(await onFile(page, X), '[전제] 파일에 없다').toBe(0);
  await page.evaluate(() => { window.electronAPI = window.__okApi; });
  await go(page, X); await settle(page);
  expect(await live(page)).toBe(1);
  await expect.poll(() => onFile(page, X), { message: '★무편집 복귀에 파일에 안 들어갔다', timeout: 10000 }).toBe(1);
  expect(errs).toEqual([]);
});
test('G12 떠날 때 저장이 5초 넘어도 항목이 안 덮인다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.selectSection?.(document.querySelector('#canvas .section-block')); window.addTextBlock?.('body'); window.deselectAll(); });
  await page.evaluate(() => { let rel; window.__hold = new Promise(r => { rel = r; }); window.__relHold = rel; });
  await startGen(page); await go(page, Y);
  await page.evaluate((X) => { const old = window.electronAPI; window.electronAPI = new Proxy(old, { get: (t, k) => k === 'loadProject' ? async (i, o) => { if (i === X) window.__readX = true; return t.loadProject(i, o); } : t[k] }); }, X);
  await page.evaluate(() => { window.__gen.done(); });
  /* 옛 판은 5초 뒤 저장이 안 끝나도 읽고 쓴다. 고친 판은 저장이 가라앉기 전에 안 읽어 여기서 시한을 넘긴다. */
  await page.waitForFunction(() => window.__readX, null, { timeout: 6000 }).catch(() => {});
  await page.evaluate(() => { window.__hold = null; window.__relHold(); });
  await page.evaluate(() => window.__genP); await settle(page); await saved(page);
  expect(await onFile(page, X), '★떠날 때 저장이 항목을 덮었다').toBe(1);
  expect(errs).toEqual([]);
});
test('G13 파일에 쓰는 틈에 다시 열어도 화면에 들어가고 다음 저장에 안 지워진다', async ({ page }) => {
  const errs = await setup(page); await toastsOn(page);
  await startGen(page); await page.evaluate((X) => window.closeTab(X), X); await settle(page);
  await holdLoadOf(page, X);
  await page.evaluate(() => { window.__gen.done(); }); await page.waitForFunction(() => window.__loadHeld);   // 추가의 첫 읽기가 붙잡힌다
  await page.evaluate((X) => window.__okOpen = (async () => { const api = window.electronAPI; await window.openTabForProject(X); })(), X);
  await settle(page);
  await page.evaluate(() => window.__relLoad());
  await page.evaluate(async () => { await window.__okOpen; await window.__genP; }); await settle(page); await saved(page);
  expect(await live(page), '★다시 연 화면에 없다').toBe(1);
  await editAndSaved(page, X);
  expect(await onFile(page, X), '★다음 저장이 지웠다').toBe(1);
  expect(errs).toEqual([]);
});
for (const [name, fail, want, n] of [['전부 실패', 'all', '저장하지 못했습니다', 0], ['둘 중 하나', 'second', '2장 중 1장', 1]]) test(`G14 이미지 저장 ${name} — 토스트가 맞다`, async ({ page }) => {
  const errs = await setup(page); await toastsOn(page);
  const out = await page.evaluate(async (fail) => { window.__imgN = 0; const old = window.electronAPI; window.electronAPI = new Proxy(old, { get: (t, k) => {
    if (k === 'aiSaveImage') return async () => { const n = ++window.__imgN; if (fail === 'all' || n === 2) return { ok: false }; return { ok: true, id: 'img_z' + n, blobPath: 'ai/z' + n + '.png', mime: 'image/png' }; };
    if (k === 'aiGenerateImage') return async () => ({ ok: true, items: [{ b64: 'AAAA', mime: 'image/png' }, { b64: 'BBBB', mime: 'image/png' }], cost: { tokens: 0, krwApprox: 0 } });
    return t[k]; } });
    const r = await window.generateAIImage({ prompt: 'p', model: 'gemini-2.5-flash-image', count: 2 }); return { ok: r.ok, n: (r.items || []).length }; }, fail);
  expect(out).toEqual({ ok: n > 0, n });
  expect(await lastToast(page)).toContain(want);
  expect(await live(page)).toBe(n);
  expect(errs).toEqual([]);
});

/* ── 2차 리뷰 칸: G15 쓰는 중 돌아와 편집 · G16 저장이 못 가라앉음 · G17 닫힌 탭 실패 안내 · G18 이미 걸린 고리 · G19 창 안에서 지움 ── */
test('G15 파일에 쓰는 중 돌아와 편집해도 편집이 안 덮이고 항목도 남는다', async ({ page }) => {
  const errs = await setup(page);
  await startGen(page); await go(page, Y); await settle(page);
  await holdLoadOf(page, X);
  await page.evaluate(() => { window.__gen.done(); }); await page.waitForFunction(() => window.__loadHeld);
  await go(page, X); await settle(page);
  await editAndSaved(page, X);
  const mark = await page.evaluate((X) => window.__files.get(X).pages[0].canvas.length, X);
  await page.evaluate(() => window.__relLoad());
  await page.evaluate(() => window.__genP); await settle(page); await saved(page);
  expect(await page.evaluate((X) => window.__files.get(X).pages[0].canvas.length, X), '★옛 existing 이 편집을 덮었다').toBeGreaterThanOrEqual(mark);
  expect(await onFile(page, X), '항목').toBe(1);
  expect(await live(page)).toBe(1);
  expect(errs).toEqual([]);
});
test('G16 저장이 못 가라앉으면 쓰지도 저장됐다고 하지도 않는다', async ({ page }) => {
  const errs = await setup(page); await toastsOn(page);
  await startGen(page); await go(page, Y); await settle(page);
  await page.evaluate(() => { window.__okWait = window.waitSavesFor; window.waitSavesFor = async () => false; });
  await page.evaluate(async () => { window.__gen.done(); await window.__genP; });
  expect(await lastToast(page), '★근거 없이 저장됨').toContain('넣지 못했습니다');
  expect(await onFile(page, X), '★옛 저장이 덮을 자리에 썼다').toBe(0);
  await page.evaluate(() => { window.waitSavesFor = window.__okWait; });
  await go(page, X); await settle(page);
  await expect.poll(() => onFile(page, X), { message: '돌아오면 들어간다', timeout: 10000 }).toBe(1);
  expect(errs).toEqual([]);
});
test('G17 닫힌 탭의 파일 추가 실패 — 돌아가면 저장한다고 말하지 않는다', async ({ page }) => {
  const errs = await setup(page); await toastsOn(page);
  await startGen(page); await page.evaluate((X) => window.closeTab(X), X); await settle(page);
  await page.evaluate((id) => { const old = window.electronAPI; window.electronAPI = new Proxy(old, { get: (t, k) => k === 'loadProject' ? async (i, o) => (i === id ? null : t.loadProject(i, o)) : t[k] }); }, X);
  await page.evaluate(async () => { window.__gen.done(); await window.__genP; });
  const t = await lastToast(page);
  expect(t).toContain('넣지 못했습니다');
  expect(t, '★탭이 없는데 돌아가면 저장한다고 한다').not.toContain('돌아가면');
  expect(errs).toEqual([]);
});
test('G18 이미 걸린 복구 고리가 저장 없이 끝나도 돌아오면 파일에 들어간다', async ({ page }) => {
  const errs = await setup(page); await toastsOn(page);
  await startGen(page); await go(page, Y); await settle(page);
  await page.evaluate((X) => { window.openTabs.find((t) => t.id === X)._afterLs = async () => true; }, X);
  await page.evaluate((id) => { window.__okApi = window.electronAPI; window.electronAPI = new Proxy(window.__okApi, { get: (t, k) => k === 'saveProject' ? async (p) => (p.id === id ? { ok: false, reason: 'x' } : t.saveProject(p)) : t[k] }); }, X);
  await page.evaluate(async () => { window.__gen.done(); await window.__genP; });
  await page.evaluate(() => { window.electronAPI = window.__okApi; });
  await go(page, X); await settle(page);
  await expect.poll(() => onFile(page, X), { message: '★고리가 있으면 저장을 안 걸었다', timeout: 10000 }).toBe(1);
  expect(errs).toEqual([]);
});
test('G19 쓰는 창 안에서 지운 항목은 되살아나지 않는다', async ({ page }) => {
  const errs = await setup(page);
  page.on('dialog', (d) => d.accept());
  await startGen(page); await go(page, Y); await settle(page);
  await holdLoadOf(page, X);
  await page.evaluate(() => { window.__gen.done(); }); await page.waitForFunction(() => window.__loadHeld);
  await go(page, X); await settle(page);
  expect(await live(page), '[전제] 돌아온 화면에 있다').toBe(1);
  await page.evaluate(async () => { const id = window.state.imageGallery[0].id; await window.galleryDeleteImage(id); });
  await settle(page); await saved(page);
  await page.evaluate(() => window.__relLoad());
  await page.evaluate(() => window.__genP); await settle(page); await saved(page);
  expect(await live(page), '★화면에 되살았다').toBe(0);
  expect(await onFile(page, X), '★파일에 되살았다').toBe(0);
  expect(errs).toEqual([]);
});
