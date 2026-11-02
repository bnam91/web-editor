/* first-load-exit-doors-361 — 첫 로드 중·로드 실패 뒤 나가는 입구가 그 프로젝트 파일을 앞 프로젝트 내용으로 안 덮는다 (J361A)
 * 왜: 그 창에서 캔버스는 비었고 state 는 앞 프로젝트다. 홈·앱 종료·로드 실패 뒤 편집이 그 스냅샷을 활성 id 로 썼다.
 *   앱 실측: ~/gd-lane/imac-gd-L1/361. A 가 한 페이지면 빈 캔버스 보호로 스킵되고 둘 이상이면 뚫렸다.
 * 자: 프로젝트별 저장 입구 기록(saveProject · saveProjectSync · 페이지를 넘어 살아남게 노드 쪽 기록). 파일은 앱이 잰다.
 * 칸: E1 로드 중 홈 — B 저장 0 · 이동함 · E2 [음성] 로드 끝난 뒤 홈 — B 저장(345 무편집 홈 재기록 값 그대로) · E3 로드 중 종료 — B 저장 0 · 답 ok
 *     E4 [음성] 로드 끝난 뒤 편집·종료 — B 저장 · E5 로드 실패 뒤 편집 — B 저장 0 · 표시 «저장됨» 아님 · E6 로드 중 saveProjectFile·flushSave·직접 저장 — B 쓰기 0
 *     E7 [양성] 그 탭 로드 전에 찍혀 큐에 선 진짜 저장은 통과한다 · E8 로드 실패 뒤 다른 탭으로 갔다 돌아와 읽히면 편집이 저장된다.
 * 변이: isTabFirstLoading 을 늘 거짓으로 하면 E1·E3·E5·E6 빨강 · 큐 표식을 빼면 E7 빨강 · E2·E4·E8 은 늘 초록.
 * ★처음 실행 기록: 2026-11-02 22:1x · 아이맥 · 판 3e051e96 · w1 · retries 0 · 고친 판 repeat-each 3 24/24 · 변이 각 ×1: 늘 거짓 E1·E3·E5·E6 빨강 · 큐 표식 뺌 E7 빨강 · 나머지 초록 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [A, B, C] = ['proj_361a', 'proj_361b', 'proj_361c'];

const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page) {
  const rec = [];
  await page.exposeBinding('__rec', (_s, kind, id, seeds) => { rec.push({ kind, id, seeds }); });
  /* 부팅 때 onForceSaveBeforeQuit 를 받아 두려고 하네스의 가짜 API 를 미리 고정한다(하네스의 대입은 무시된다) */
  await page.addInitScript(() => {
    const fake = { onForceSaveBeforeQuit: (f) => { window.__quit = f; }, quitReady: (r) => { window.__answer = r; } };
    window.__fake = fake;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  });
  const errs = await bootApp(page);
  await page.evaluate(([A, B, C]) => {
    const pg = (id, n) => ({ id: 'page_' + n, name: 'P' + n, pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}_${n}"><div class="section-inner"></div></div>` });
    const project = (id, pages) => ({ ...window.buildEmptyProject(id, id), id, name: id, version: 2, currentPageId: 'page_1', pages });
    const files = new Map([[A, project(A, [pg(A, 1), pg(A, 2)])], [B, project(B, [pg(B, 1)])], [C, project(C, [pg(C, 1)])]]);
    window.__files = files; window.__pending = {}; window.__ops = {};
    const seedsOf = (p) => (p.pages || []).map(x => x.canvas || '').join('').match(/sec_proj_361[abc]_\d/g) || [];
    Object.assign(window.__fake, {
      loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id) || null)),
      saveProject: async (p) => { await window.__rec('save', p.id, seedsOf(p)); if (window.__hold) await window.__hold; files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true }; },
      saveProjectSync: (p) => { window.__rec('sync', p.id, seedsOf(p)); return { ok: true }; },
    });
    window.loadProjectForOpen = (id) => new Promise((res, rej) => { window.__pending[id] = { done: () => res(JSON.parse(JSON.stringify(files.get(id)))), fail: () => rej(new Error('읽기 실패')) }; });
    window.openTabs = [{ id: A, name: A, _cache: JSON.stringify(files.get(A)) }, { id: B, name: B }, { id: C, name: C, _cache: JSON.stringify(files.get(C)) }];
    window.activeProjectId = A;
    history.replaceState(null, '', '?project=' + A);
    window.applyProjectData(JSON.parse(JSON.stringify(files.get(A))));
  }, [A, B, C]);
  await settle(page);
  await page.waitForFunction(() => !window.hasUnsavedChanges());
  rec.length = 0;
  return { errs, rec };
}
const go = (page, id) => page.evaluate((id) => { window.__ops[id] = window.switchTab(id).catch(e => { window.__swErr = String(e); }); }, id);
const opened = (page, id) => page.waitForFunction((id) => window.__pending[id], id);
const release = (page, id, how = 'done') => page.evaluate(async ([id, how]) => { const q = window.__pending[id]; delete window.__pending[id]; q[how](); await window.__ops[id]; }, [id, how]);
const edit = (page) => page.evaluate(() => { const s = document.querySelector('#canvas .section-block'); if (s) window.selectSection?.(s); else window.addSection(); window.addTextBlock('h2'); });
const toB = async (page, s) => { await go(page, B); await opened(page, B); s.rec.length = 0; };
const of = (s, id) => s.rec.filter(r => r.id === id);

test('E1 로드 중 홈 — B 저장 0 · 이동함', async ({ page }) => {
  const s = await setup(page);
  await toB(page, s);
  await page.evaluate(() => { window.goHome(); });
  await page.waitForURL(/projects\.html/);
  expect(of(s, B), '★앞 프로젝트 내용이 B 로 나갔다').toEqual([]);
});

test('E2 [음성] 로드 끝난 뒤 무편집 홈 — B 저장(345 값 그대로)', async ({ page }) => {
  const s = await setup(page);
  await toB(page, s); await release(page, B); await settle(page);
  await page.evaluate(() => { window.goHome(); });
  await page.waitForURL(/projects\.html/);
  expect(of(s, B).map(r => r.kind)).toContain('save');
  expect(of(s, B)[0].seeds).toEqual(['sec_' + B + '_1']);
});

test('E3 로드 중 종료 — B 저장 0 · 답 ok', async ({ page }) => {
  const s = await setup(page);
  await toB(page, s);
  await page.evaluate(() => window.__quit());
  await page.waitForFunction(() => window.__answer);
  expect(await page.evaluate(() => window.__answer.ok), '★종료 답이 실패다').toBe(true);
  expect(of(s, B), '★앞 프로젝트 내용이 B 로 나갔다').toEqual([]);
  expect(s.errs).toEqual([]);
});

test('E4 [음성] 로드 끝난 뒤 편집·종료 — B 저장', async ({ page }) => {
  const s = await setup(page);
  await toB(page, s); await release(page, B); await settle(page);
  await edit(page); await page.waitForFunction(() => window.hasUnsavedChanges());
  await page.evaluate(() => window.__quit());
  await page.waitForFunction(() => window.__answer);
  expect(await page.evaluate(() => window.__answer.ok)).toBe(true);
  expect(of(s, B).map(r => r.kind)).toContain('save');
  expect(of(s, B)[0].seeds).toContain('sec_' + B + '_1');
  expect(s.errs).toEqual([]);
});

test('E5 로드 실패 뒤 편집 — B 저장 0 · «저장됨»이라 안 한다', async ({ page }) => {
  const s = await setup(page);
  await toB(page, s); await release(page, B, 'fail'); await settle(page);
  await edit(page);
  const ind = page.locator('#autosave-indicator');
  await expect(ind, '★안 쓰고 저장됨이라 했다').toHaveClass(/error/, { timeout: 15000 });
  expect(of(s, B), '★앞 프로젝트 내용이 B 로 나갔다').toEqual([]);
  await page.evaluate(() => { window.dispatchEvent(new Event('beforeunload')); });
  expect(of(s, B), '★닫기가 B 를 썼다').toEqual([]);
  expect(s.errs).toEqual([]);
});

test('E6 로드 중 다른 저장 입구 — B 쓰기 0', async ({ page }) => {
  const s = await setup(page);
  await toB(page, s);
  const r = await page.evaluate(async () => { const x = await window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: window.activeProjectId }); await window.flushSave(); await window.saveProjectFile(); return x; });
  expect(r?.skipped).toBe(true);
  expect(of(s, B), '★앞 프로젝트 내용이 B 로 나갔다').toEqual([]);
  expect(s.errs).toEqual([]);
});

test('E7 [양성] 로드 전에 찍혀 큐에 선 진짜 저장은 통과한다', async ({ page }) => {
  const s = await setup(page);
  const real = await page.evaluate((B) => { const d = JSON.parse(JSON.stringify(window.__files.get(B))); d.pages[0].canvas += '<div class="section-block" id="sec_proj_361b_9"></div>'; return JSON.stringify(d); }, B);
  await page.evaluate(() => { window.__hold = new Promise(r => { window.__release = r; }); window.__p1 = window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: window.activeProjectId }); });
  await page.waitForFunction(() => window._isSavingToFile);
  await page.evaluate(([real, B]) => { window.__p2 = window.saveProjectToFile(real, { skipThumbnail: true, projectId: B }); }, [real, B]);
  await go(page, B); await opened(page, B);
  await page.evaluate(() => { window.__hold = null; window.__release(); return window.__p1; });
  await page.waitForFunction(() => !window._isSavingToFile);
  expect(of(s, B).map(r => r.seeds.join()), '★진짜 저장이 버려졌다').toContain(['sec_' + B + '_1', 'sec_' + B + '_9'].join());
  expect(s.errs).toEqual([]);
});

test('E8 로드 실패 뒤 다른 탭 갔다 돌아와 읽히면 편집이 저장된다', async ({ page }) => {
  const s = await setup(page);
  await toB(page, s); await release(page, B, 'fail'); await settle(page);
  await go(page, C); await page.evaluate((C) => window.__ops[C], C); await settle(page);
  await go(page, B); await opened(page, B); await release(page, B); await settle(page);
  await edit(page);
  await page.waitForFunction((B) => window.__files.get(B).pages[0].canvas.includes('text-block'), B, { timeout: 15000 });
  expect(of(s, B).at(-1).seeds).toEqual(['sec_' + B + '_1']);
  expect(s.errs).toEqual([]);
});
