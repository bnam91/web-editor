/* switchtab-first-load-race-360 — 새 탭 첫 로드 중 다른 탭을 눌러도 그 탭 파일이 앞 프로젝트 내용으로 안 덮인다 (J359A)
 * 왜: switchTab 에 세대 검사가 없어 늦게 끝난 B 로드가 활성 C 캔버스에 B 를 올렸고, 다음 편집 저장이 C 파일을 B 내용으로 덮었다.
 *   로드 중 떠날 때 빈 캔버스를 직렬화해 B 의 탭 캐시도 망가졌다. 앱 실측: ~/gd-lane/imac-gd-L1/359.
 * 자: 프로젝트별 가짜 파일(electronAPI.saveProject 가 받은 것)의 씨앗 섹션 id · 화면의 씨앗 id. 파일은 앱이 잰다.
 * 칸: R1 B 로드 중 C — 화면 C · 편집이 C 파일에 · B 파일 무변 · R2 [음성] 로드 끝난 뒤 C · R3 B 로드 중 C 로 갔다 B 로 돌아옴 — B 는 파일에서 다시 읽는다
 *     R4 둘 다 첫 로드 · 먼저 부른 B 가 늦게 끝남 · R5 B 로드가 실패해도 C 편집이 저장된다.
 * 변이: 세대 검사를 빼면 R1·R4 빨강 · 로드 중 떠남 갈래를 빼면 R3 빨강 · R2 는 늘 초록.
 * ★처음 실행 기록: 2026-11-02 20:3x · 아이맥 · 판 0541078b+359 · w1 · retries 0 · 고친 판 repeat-each 3 15/15 · 변이 각 ×1: 세대 검사 R1·R4 빨강 · 떠남 갈래 R3 빨강 · 나머지 초록 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [A, B, C] = ['proj_360a', 'proj_360b', 'proj_360c'];

const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page, cached) {
  const errs = await bootApp(page);
  await page.evaluate(([ids, cached]) => {
    const project = (id) => ({ ...window.buildEmptyProject(id, id), id, name: id, version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'P', pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}"><div class="section-inner"></div></div>` }] });
    const files = new Map(ids.map(id => [id, project(id)]));
    window.__files = files; window.__pending = {}; window.__ops = {};
    const fake = {
      loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id) || null)),
      saveProject: async (p) => { files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true }; },
      saveProjectSync: () => ({ ok: true }),
    };
    window.electronAPI = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
    /* 첫 로드를 시험이 푼다 */
    window.loadProjectForOpen = (id) => new Promise((res, rej) => { window.__pending[id] = { done: () => res(JSON.parse(JSON.stringify(files.get(id)))), fail: () => rej(new Error('읽기 실패')) }; });
    window.openTabs = ids.map(id => ({ id, name: id, ...(cached.includes(id) ? { _cache: JSON.stringify(files.get(id)) } : {}) }));
    window.activeProjectId = ids[0];
    window.applyProjectData(JSON.parse(JSON.stringify(files.get(ids[0]))));
  }, [[A, B, C], cached]);
  await settle(page);
  await page.waitForFunction(() => !window.hasUnsavedChanges());
  return errs;
}
const go = (page, id) => page.evaluate((id) => { window.__ops[id] = window.switchTab(id).catch(e => { window.__swErr = String(e); }); }, id);
const opened = (page, id) => page.waitForFunction((id) => window.__pending[id], id);
const release = (page, id, how = 'done') => page.evaluate(async ([id, how]) => { const q = window.__pending[id]; delete window.__pending[id]; q[how](); await window.__ops[id]; }, [id, how]);
const seeds = (page) => page.evaluate((ids) => ids.filter(id => document.getElementById('sec_' + id)), [A, B, C]);
const fileOf = (page, id) => page.evaluate((id) => window.__files.get(id).pages.map(p => p.canvas).join(''), id);
const editSaved = async (page, id) => {
  const mark = await page.evaluate(() => { const s = document.querySelector('#canvas .section-block'); window.selectSection?.(s); const n0 = new Set([...document.querySelectorAll('#canvas .text-block')].map(b => b.id)); window.addTextBlock('h2'); return [...document.querySelectorAll('#canvas .text-block')].map(b => b.id).find(x => !n0.has(x)); });
  await page.waitForFunction(([id, mark]) => window.__files.get(id).pages.some(p => (p.canvas || '').includes(mark)) || [...window.__files.keys()].some(k => k !== id && window.__files.get(k).pages.some(p => (p.canvas || '').includes(mark))), [id, mark], { timeout: 15000 });
  return mark;
};

test('R1 B 첫 로드 중 C — 화면은 C · 편집은 C 파일에 · B 파일 무변', async ({ page }) => {
  const errs = await setup(page, [A, C]);
  const b0 = await fileOf(page, B);
  await go(page, B); await opened(page, B);
  await go(page, C); await page.evaluate((C) => window.__ops[C], C);
  await release(page, B); await settle(page);
  expect(await seeds(page), '★늦은 B 로드가 C 화면에 올랐다').toEqual([C]);
  const mark = await editSaved(page, C);
  const c1 = await fileOf(page, C);
  expect(c1, '★C 파일에 C 내용이 없다').toContain('sec_' + C);
  expect(c1, '★C 파일이 B 내용으로 덮였다').not.toContain('sec_' + B);
  expect(c1, '편집이 C 파일에 있다').toContain(mark);
  expect(await fileOf(page, B)).toBe(b0);
  expect(errs).toEqual([]);
});

test('R2 [음성] 로드 끝난 뒤 C — 그대로', async ({ page }) => {
  const errs = await setup(page, [A, C]);
  await go(page, B); await opened(page, B); await release(page, B); await settle(page);
  expect(await seeds(page), '[전제] B 가 떴다').toEqual([B]);
  await go(page, C); await page.evaluate((C) => window.__ops[C], C); await settle(page);
  expect(await seeds(page)).toEqual([C]);
  const mark = await editSaved(page, C);
  expect(await fileOf(page, C)).toContain(mark);
  expect(errs).toEqual([]);
});

test('R3 B 로드 중 C 로 갔다 돌아옴 — B 는 파일에서 다시 읽고, 앞 프로젝트 내용을 안 쓴다', async ({ page }) => {
  const errs = await setup(page, [A, C]);
  await go(page, B); await opened(page, B);
  await page.evaluate((B) => { window.__first = window.__pending[B]; }, B);
  await go(page, C); await page.evaluate((C) => window.__ops[C], C); await settle(page);
  await go(page, B);
  await page.evaluate((B) => { window.__ops[B].then(() => { window.__backDone = true; }); }, B);
  await page.waitForFunction((B) => window.__pending[B] !== window.__first || window.__backDone, B);
  expect(await page.evaluate((B) => window.__pending[B] !== window.__first, B), '★돌아온 B 가 파일에서 안 읽었다(떠날 때 망가진 캐시)').toBe(true);
  await release(page, B); await settle(page);
  await page.evaluate(() => window.__first.done()); await settle(page);   // 앞선 로드는 뒤늦게 끝나도 버려진다
  expect(await seeds(page), '★돌아온 B 화면이 B 가 아니다').toEqual([B]);
  await editSaved(page, B);
  const b1 = await fileOf(page, B);
  expect(b1, '★B 파일에 B 내용이 없다').toContain('sec_' + B);
  expect(b1, '★B 파일에 앞 프로젝트가 들어갔다').not.toContain('sec_' + A);
  expect(errs).toEqual([]);
});

test('R4 둘 다 첫 로드 · 먼저 부른 B 가 늦게 끝남 — 화면은 C', async ({ page }) => {
  const errs = await setup(page, [A]);
  await go(page, B); await opened(page, B);
  await go(page, C); await opened(page, C);
  await release(page, C); await settle(page);
  expect(await seeds(page), '[전제] C 가 떴다').toEqual([C]);
  await release(page, B); await settle(page);
  expect(await seeds(page), '★늦은 B 로드가 C 화면을 덮었다').toEqual([C]);
  const mark = await editSaved(page, C);
  const c1 = await fileOf(page, C);
  expect(c1).toContain('sec_' + C); expect(c1).toContain(mark); expect(c1).not.toContain('sec_' + B);
  expect(errs).toEqual([]);
});

test('R5 B 로드가 실패해도 C 편집이 저장된다', async ({ page }) => {
  const errs = await setup(page, [A, C]);
  await go(page, B); await opened(page, B);
  await go(page, C); await page.evaluate((C) => window.__ops[C], C);
  await release(page, B, 'fail'); await settle(page);
  expect(await seeds(page)).toEqual([C]);
  const mark = await editSaved(page, C);
  expect(await fileOf(page, C)).toContain(mark);
  expect(errs).toEqual([]);
});
