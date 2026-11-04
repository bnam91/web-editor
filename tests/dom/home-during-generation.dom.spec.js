/* home-during-generation — AI 생성 중 프로젝트 목록으로 나가면 묻는다(현빈 결정 6524). 유료 호출 0: electronAPI 가짜.
 * 칸: H1 홈 단추 머무름 — 결과가 들어온다 · H2 홈 단추 나감 — 나간다 · H3 마지막 탭 닫기 머무름 — 탭이 남고 결과가 들어온다 · H4 마지막 탭 닫기 나감.
 * 음성: N1·N2 생성 안 돌 때(끝난 뒤 포함) 안 묻고 나간다 · N3 탭이 둘이면 닫기에 안 묻는다.
 * 양성대조: goHome·closeTab 의 확인을 빼면 H1·H3 빨강, N 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [X, Y] = ['proj_hx', 'proj_hy'];
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page, tabs = [X]) {
  const errs = await bootApp(page);
  await page.evaluate(({ ids, tabs }) => {
    const project = (id) => ({ ...window.buildEmptyProject(id, id), id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P', pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}"><div class="section-inner"></div></div>` }] });
    const files = new Map(ids.map((id) => [id, project(id)])); window.__gen = {}; window.__started = new Promise((r) => { window.__start = r; });
    const fake = { loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id))), saveProject: async (p) => { files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true }; }, saveProjectSync: () => ({ ok: true }),
      aiGenerateImage: () => { window.__start(); return new Promise((r) => { window.__gen.done = () => r({ ok: true, items: [{ b64: 'AAAA', mime: 'image/png' }], cost: { tokens: 0, krwApprox: 0 } }); }); },
      aiSaveImage: async () => ({ ok: true, id: 'img_h', blobPath: 'images/h.png', mime: 'image/png' }) };
    window.electronAPI = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
    window.openTabs = tabs.map((id) => ({ id, name: id, _cache: JSON.stringify(files.get(id)) })); window.activeProjectId = ids[0]; history.replaceState(null, '', '?project=' + ids[0]);
    window.applyProjectData(JSON.parse(window.openTabs[0]._cache));
  }, { ids: [X, Y], tabs });
  await settle(page);
  return errs;
}
const startGen = (page) => page.evaluate(async () => { window.__p = window.generateAIImage({ prompt: 'p', model: 'gemini-2.5-flash-image', count: 1 }); await window.__started; });
const finish = (page) => page.evaluate(async () => { window.__gen.done(); await window.__p; });
const answer = (page, ok) => { const seen = []; page.on('dialog', (d) => { seen.push(d.message()); return ok ? d.accept() : d.dismiss(); }); return seen; };
const live = (page) => page.evaluate(() => (window.state.imageGallery || []).length);
const left = (page) => page.waitForURL(/projects\.html/, { timeout: 10000 });

test('H1 홈 단추 머무름 — 안 나가고 결과가 들어온다', async ({ page }) => {
  const errs = await setup(page); const seen = answer(page, false);
  await startGen(page); await page.click('#home-btn'); await settle(page);
  expect(seen.length, '★안 물었다').toBe(1); expect(seen[0]).toContain('결과를 잃습니다');
  expect(page.url()).not.toContain('projects.html');
  await finish(page);
  expect(await live(page)).toBe(1);
  expect(errs).toEqual([]);
});
test('H2 홈 단추 나감 — 나간다', async ({ page }) => {
  await setup(page); const seen = answer(page, true);
  await startGen(page); await page.click('#home-btn'); await left(page);
  expect(seen.length).toBe(1);
});
test('H3 마지막 탭 닫기 머무름 — 탭이 남고 결과가 들어온다', async ({ page }) => {
  const errs = await setup(page); const seen = answer(page, false);
  await startGen(page); await page.evaluate((X) => window.closeTab(X), X); await settle(page);
  expect(seen.length, '★안 물었다').toBe(1);
  expect(await page.evaluate(() => window.openTabs.map((t) => t.id))).toEqual([X]);
  await finish(page);
  expect(await live(page)).toBe(1);
  expect(errs).toEqual([]);
});
test('H4 마지막 탭 닫기 나감 — 한 번만 묻고 나간다', async ({ page }) => {
  await setup(page); const seen = answer(page, true);
  await startGen(page); await page.evaluate((X) => { window.closeTab(X); }, X); await left(page);
  expect(seen.length, '★두 번 물었다').toBe(1);
});
test('N1 [음성] 생성 안 돌면 안 묻고 나간다', async ({ page }) => {
  await setup(page); const seen = answer(page, false);
  await page.click('#home-btn'); await left(page);
  expect(seen).toEqual([]);
});
test('N2 [음성] 생성이 끝난 뒤엔 안 묻는다', async ({ page }) => {
  await setup(page); const seen = answer(page, false);
  await startGen(page); await finish(page);
  await page.click('#home-btn'); await left(page);
  expect(seen).toEqual([]);
});
test('N3 [음성] 탭이 둘이면 닫기에 안 묻는다', async ({ page }) => {
  await setup(page, [X, Y]); const seen = answer(page, false);
  await startGen(page); await page.evaluate((X) => window.closeTab(X), X); await settle(page);
  expect(seen).toEqual([]);
  expect(await page.evaluate(() => window.openTabs.map((t) => t.id))).toEqual([Y]);
});
