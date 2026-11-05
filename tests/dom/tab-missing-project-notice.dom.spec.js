/* tab-missing-project-notice — 폴더가 앱 밖에서 없어진 탭이 말없는 빈 탭이 안 되고 남은 내용을 안 잃는다(MISSING-PROJECT-TAB-NO-NOTICE-01).
 * 앱 실측(78746dbc · ~/gd-lane/imac-gd-L3/MPT/b0 · 3/3): 첫 로드 탭은 LS 본이 있어도 빈 화면 · 거기서 편집하면 LS 본까지 빈 판으로 덮임 · 캐시 탭은 말없이 옛 화면.
 * 장면: 폴더 상태와 읽기를 가짜 API 로 돌린다(하네스라 폴더 지우기는 못 쓴다 · 앱 길은 위 탐침이 잰다).
 * 칸: M1 LS 본이 있으면 그 본으로 열고 알린다 · M2 본이 없으면 닫고 알린다 · M3 앱 휴지통의 것은 본이 있어도 안 연다 · M4 캐시 탭도 알린다 · M5 다시 만들었으면 알린다.
 * 대조: N1 폴더가 있으면 말 없음(캐시) · N2 폴더가 있으면 말 없음(읽기) · N3 없는 탭의 다시 만듦은 말 없음.
 * 칸(부팅 길 — 앱을 다시 띄워 탭을 누른 길): B1 보던 탭 LS 본으로 연다 · B2 본 없으면 닫는다 · B3 옆 탭은 본이 있으면 남고 없으면 알리고 빠진다 · B4 앱 휴지통의 것은 본으로 안 연다.
 * 칸(리뷰): U1~U3 못 읽음 · A1~A5 계정 전환 · 그 뒤 칸은 커밋마다 더한다.
 * 변이: 회신의 값(커밋마다 그 고침만 되돌린 판). */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');

const doc = (id) => ({ id, name: id + '이름', version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P', canvas: '<div class="section-block" id="s_' + id + '" data-section="1"><div class="section-hitzone"></div><div class="section-inner"></div></div>' }] });
async function setup(page, { state, ls, cached, owner = 'acct_me' }) {
  const errs = await bootApp(page);
  await page.evaluate(({ state, ls, cached, owner, A, B }) => {
    window.__saved = [];
    const real = window.electronAPI;
    window.electronAPI = new Proxy(real || {}, { get: (t, k) => k === 'saveProject' ? async (x) => { window.__saved.push(x.id); (window.__savedDocs ||= []).push(x); return window.__saveRefuse ? { ok: false, reason: 'x' } : { ok: true }; }
      : k === 'loadProject' ? async (id) => (id === 'proj_b' && state !== 'ok' ? null : (id === 'proj_b' ? B : A))
      : k === 'projectFolderState' ? async (id) => (id === 'proj_b' ? state : 'ok')
      : k === 'projectsRootKey' ? async () => 'acct_me' : t[k] });
    window.__toasts = []; const f = window.showStatusToast; window.showStatusToast = (m) => { window.__toasts.push(m); f(m); };
    if (ls) localStorage.setItem('web-editor-autosave__proj_b', JSON.stringify(B));
    if (ls && owner) localStorage.setItem('web-editor-ls-root__proj_b', owner);
    window.openTabs = [{ id: 'proj_a', name: 'proj_a이름', _cache: JSON.stringify(A) }, { id: 'proj_b', name: 'proj_b이름', ...(cached ? { _cache: JSON.stringify(B) } : {}) }];
    window.activeProjectId = 'proj_a';
    window.renderTabBar();
  }, { state, ls, cached, owner, A: doc('proj_a'), B: doc('proj_b') });
  return errs;
}
const go = (page) => page.evaluate(() => window.switchTab('proj_b'));
const settled = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))));
const st = (page) => page.evaluate(() => ({ tabs: window.openTabs.map(t => t.id), active: window.activeProjectId, screenB: !!document.getElementById('s_proj_b'), saved: window.__saved, toasts: window.__toasts, ls: localStorage.getItem('web-editor-autosave__proj_b') }));

test('M1 LS 본이 있으면 그 본으로 열고 알린다 — 빈 화면이 아니다', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', ls: true });
  await go(page); await settled(page);
  const s = await st(page);
  expect(s.tabs).toEqual(['proj_a', 'proj_b']);
  expect(s.active).toBe('proj_b');
  expect(s.screenB, '★남은 본이 있는데 빈 화면').toBe(true);
  expect(s.toasts.length).toBe(1);
  expect(s.toasts[0]).toContain('proj_b이름');
  expect(s.toasts[0]).toContain('폴더를 찾을 수 없습니다');
  expect(s.saved, '열기만으로 폴더를 되살리지 않는다').not.toContain('proj_b');
  expect(errs).toEqual([]);
});
test('M2 본이 없으면 지운 프로젝트와 같이 닫고 알린다', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', ls: false });
  await go(page);
  await page.waitForFunction(() => window.openTabs.length === 1);
  const s = await st(page);
  expect(s.tabs).toEqual(['proj_a']);
  expect(s.active).toBe('proj_a');
  expect(s.saved).not.toContain('proj_b');
  expect(s.toasts).toEqual(['「proj_b이름」 프로젝트가 삭제되어 탭을 닫았습니다.']);
  expect(errs).toEqual([]);
});
test('M3 앱 휴지통의 프로젝트는 본이 있어도 안 연다', async ({ page }) => {
  const errs = await setup(page, { state: 'trashed', ls: true });
  await go(page);
  await page.waitForFunction(() => window.openTabs.length === 1);
  const s = await st(page);
  expect(s.tabs).toEqual(['proj_a']);
  expect(s.screenB, '★지운 프로젝트를 본으로 열었다').toBe(false);
  expect(s.saved).not.toContain('proj_b');
  expect(errs).toEqual([]);
});
test('M4 캐시 탭도 알린다 — 화면은 그대로', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', cached: true });
  await go(page);
  await page.waitForFunction(() => window.__toasts.length > 0);
  const s = await st(page);
  expect(s.screenB).toBe(true);
  expect(s.toasts[0]).toContain('폴더를 찾을 수 없습니다');
  expect(errs).toEqual([]);
});
test('M5 저장이 폴더를 다시 만들면 알린다', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', cached: true });
  await page.evaluate(() => window.noteProjectFolderRecreated('proj_b'));
  const s = await st(page);
  expect(s.toasts.length).toBe(1);
  expect(s.toasts[0]).toContain('proj_b이름');
  expect(s.toasts[0]).toContain('다시 만들었습니다');
  expect(errs).toEqual([]);
});
test('N1 [대조] 폴더가 있으면 캐시 탭은 말이 없다', async ({ page }) => {
  const errs = await setup(page, { state: 'ok', cached: true });
  await go(page); await settled(page);
  const s = await st(page);
  expect(s.screenB).toBe(true);
  expect(s.toasts).toEqual([]);
  expect(errs).toEqual([]);
});
test('N2 [대조] 폴더가 있으면 첫 로드 탭은 말이 없다', async ({ page }) => {
  const errs = await setup(page, { state: 'ok' });
  await go(page); await settled(page);
  const s = await st(page);
  expect(s.screenB).toBe(true);
  expect(s.tabs).toEqual(['proj_a', 'proj_b']);
  expect(s.toasts).toEqual([]);
  expect(errs).toEqual([]);
});
test('N3 [대조] 탭이 없는 프로젝트를 다시 만들어도 말이 없다', async ({ page }) => {
  const errs = await setup(page, { state: 'ok' });
  await page.evaluate(() => window.noteProjectFolderRecreated('proj_없음'));
  expect((await st(page)).toasts).toEqual([]);
  expect(errs).toEqual([]);
});

/* 부팅 길: 저장된 탭과 LS 를 놓고 다시 싣는다. 가짜 API 는 init 스크립트라 새 문서에도 남는다. */
async function bootWith(page, { url, listed, states, ls, tabs, owners = {}, away, hold, root = 'acct_me' }) {
  const errs = await bootApp(page);
  await page.addInitScript(({ listed, states, doc, hold, root }) => {
    const mk = (id) => JSON.parse(JSON.stringify(doc).split('@ID').join(id));
    const real = window.electronAPI;
    window.electronAPI = new Proxy(real, { get: (t, k) => k === 'listProjects' ? async () => listed.map((id) => ({ id, name: id + '이름', updatedAt: 0 }))
      : k === 'loadProject' ? async (id, o) => { if (hold && o?.open && id === hold) await new Promise((r) => { window.__release = r; }); return listed.includes(id) ? mk(id) : null; }
      : k === 'projectFolderState' ? async (id) => states[id] || 'ok'
      : k === 'projectsRootKey' ? async () => root : t[k] });
  }, { listed, states, doc: doc('@ID'), hold, root });
  await page.evaluate(({ ls, tabs, doc, owners, away }) => {
    localStorage.clear();
    for (const id of ls) { localStorage.setItem('web-editor-autosave__' + id, JSON.stringify(doc).split('@ID').join(id)); localStorage.setItem('web-editor-ls-root__' + id, owners[id] || 'acct_me'); }
    if (away) localStorage.setItem('web-editor-open-tabs-away', JSON.stringify(away));
    localStorage.setItem('web-editor-open-tabs', JSON.stringify({ tabs: tabs.map((id) => ({ id, name: id + '이름' })), activeId: tabs[0] }));
  }, { ls, tabs, doc: doc('@ID'), owners, away });
  await page.goto(`${ORIGIN}/${url}`);
  if (hold) return errs;
  await page.waitForFunction(() => { const g = window.gdtProjectReady?.get?.(); return g && g.phase !== 'loading'; }, null, { timeout: 20000 });
  return errs;
}
const bs = (page) => page.evaluate(() => ({ tabs: JSON.parse(localStorage.getItem('web-editor-open-tabs') || '{}').tabs?.map(t => t.id), tabNames: JSON.parse(localStorage.getItem('web-editor-open-tabs') || '{}').tabs?.map(t => t.name), active: window.activeProjectId, screenB: !!document.getElementById('s_proj_b'), toasts: [...document.querySelectorAll('.settings-toast')].map(x => x.textContent), lsB: !!localStorage.getItem('web-editor-autosave__proj_b') }));

test('B1 보던 탭의 폴더가 없어졌으면 LS 본으로 열고 알린다 — 부팅의 고아 정리가 그 본을 안 지운다', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_b', listed: ['proj_a'], states: { proj_b: 'missing' }, ls: ['proj_b'], tabs: ['proj_b', 'proj_a'] });
  await page.waitForSelector('#s_proj_b', { state: 'attached', timeout: 10000 });
  const s = await bs(page);
  expect(s.lsB, '★고아 정리가 남은 본을 지웠다').toBe(true);
  expect(s.toasts.join()).toContain('proj_b이름');
  expect(s.toasts.join()).toContain('폴더를 찾을 수 없습니다');
  expect(s.tabNames, '이름을 Untitled 로 안 덮는다').toContain('proj_b이름');
  expect(errs).toEqual([]);
});
test('B2 보던 탭에 본도 없으면 말없는 빈 탭 대신 닫고 알린다', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_b', listed: ['proj_a'], states: { proj_b: 'missing' }, ls: [], tabs: ['proj_b', 'proj_a'] });
  await page.waitForFunction(() => window.activeProjectId === 'proj_a', null, { timeout: 10000 });
  const s = await bs(page);
  expect(s.tabs).toEqual(['proj_a']);
  expect(s.toasts.join()).toContain('「proj_b이름」 프로젝트가 삭제되어 탭을 닫았습니다.');
  expect(errs).toEqual([]);
});
test('B3 옆 탭 — 본이 있으면 남고, 없으면 알리고 빠진다', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_a', listed: ['proj_a'], states: { proj_b: 'missing', proj_c: 'missing' }, ls: ['proj_b'], tabs: ['proj_a', 'proj_b', 'proj_c'] });
  await page.waitForFunction(() => document.querySelectorAll('.settings-toast').length > 0, null, { timeout: 10000 });
  const s = await bs(page);
  expect(s.tabs).toEqual(['proj_a', 'proj_b']);
  expect(s.lsB).toBe(true);
  expect(s.toasts.join()).toContain('proj_c이름');
  expect(errs).toEqual([]);
});
test('B4 앱 휴지통의 프로젝트는 본이 있어도 안 연다 — 탭 목록이 낡아도', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_b', listed: ['proj_a'], states: { proj_b: 'trashed' }, ls: ['proj_b'], tabs: ['proj_b', 'proj_a'] });
  await page.waitForFunction(() => window.activeProjectId === 'proj_a', null, { timeout: 10000 });
  const s = await bs(page);
  expect(s.screenB, '★지운 프로젝트를 본으로 열었다').toBe(false);
  expect(s.lsB).toBe(false);
  expect(s.tabs).toEqual(['proj_a']);
  expect(errs).toEqual([]);
});

/* 리뷰 ⑥⑦ — 못 읽은 것은 없어진 게 아니다 */
test('U1 폴더를 못 읽으면 탭을 안 닫고 빈 판으로 안 연다 — 읽기 실패 길', async ({ page }) => {
  const errs = await setup(page, { state: 'unknown', ls: true });
  await page.evaluate(() => window.switchTab('proj_b')).catch(() => {});
  await settled(page);
  const s = await st(page);
  expect(s.tabs, '★못 읽은 탭을 닫았다').toEqual(['proj_a', 'proj_b']);
  expect(s.screenB, '★못 읽었는데 LS 본으로 열었다').toBe(false);
  expect(s.ls, '본은 그대로').toBeTruthy();
  expect(await page.evaluate(() => window.isTabFirstLoading('proj_b')), '저장 막는 표식').toBe(true);
  expect(s.toasts.join(), '「찾을 수 없습니다」 거짓말 없음').not.toContain('찾을 수 없습니다');
  expect(errs).toEqual([]);
});
test('U2 부팅 — 못 읽은 옆 탭과 본을 안 지운다', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_a', listed: ['proj_a'], states: { proj_b: 'unknown' }, ls: ['proj_b'], tabs: ['proj_a', 'proj_b'] });
  const s = await bs(page);
  expect(s.tabs).toEqual(['proj_a', 'proj_b']);
  expect(s.lsB).toBe(true);
  expect(s.toasts).toEqual([]);
  expect(errs).toEqual([]);
});
test('U3 부팅 — 뿌리를 못 읽으면 고아 정리를 안 한다(탭에 없는 본도)', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_a', listed: ['proj_a'], states: { '': 'unknown' }, ls: ['proj_b'], tabs: ['proj_a'] });
  expect((await bs(page)).lsB, '★뿌리를 못 읽었는데 본을 지웠다').toBe(true);
  expect(errs).toEqual([]);
});
test('N4 [대조] 뿌리가 성하면 탭에 없는 본은 지운다', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_a', listed: ['proj_a'], states: {}, ls: ['proj_b'], tabs: ['proj_a'] });
  expect((await bs(page)).lsB).toBe(false);
  expect(errs).toEqual([]);
});

/* 리뷰 ① — 계정 전환: 다른 계정의 본을 안 주고, 그 계정으로 돌아오면 탭과 본이 있다 */
const away = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('web-editor-open-tabs-away') || '[]').map(t => t.id));
test('A1 다른 계정의 본은 안 연다 — 닫고 알리되 본은 남기고 탭은 맡긴다', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', ls: true, owner: 'acct_other' });
  await go(page);
  await page.waitForFunction(() => window.openTabs.length === 1);
  const s = await st(page);
  expect(s.screenB, '★B 화면에 A 내용').toBe(false);
  expect(s.saved).not.toContain('proj_b');
  expect(s.ls, '★A 의 본을 지웠다').toBeTruthy();
  expect(s.toasts.join()).toContain('다른 계정');
  expect(await away(page)).toEqual(['proj_b']);
  expect(errs).toEqual([]);
});
test('A2 부팅 — 보던 탭이 다른 계정 것이면 안 열고 닫는다 · 본은 남는다', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_b', listed: ['proj_a'], states: { proj_b: 'missing' }, ls: ['proj_b'], owners: { proj_b: 'acct_other' }, tabs: ['proj_b', 'proj_a'] });
  await page.waitForFunction(() => window.activeProjectId === 'proj_a', null, { timeout: 10000 });
  const s = await bs(page);
  expect(s.screenB, '★B 화면에 A 내용').toBe(false);
  expect(s.lsB, '★A 의 본을 지웠다').toBe(true);
  expect(s.tabs).toEqual(['proj_a']);
  expect(await away(page)).toEqual(['proj_b']);
  expect(errs).toEqual([]);
});
test('A3 부팅 — 옆 탭이 다른 계정 것이면 말없이 맡기고 본을 남긴다 · 탭에 없는 그 계정 본도', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_a', listed: ['proj_a'], states: { proj_b: 'missing' }, ls: ['proj_b', 'proj_c'], owners: { proj_b: 'acct_other', proj_c: 'acct_other' }, tabs: ['proj_a', 'proj_b'] });
  const s = await bs(page);
  expect(s.tabs).toEqual(['proj_a']);
  expect(s.lsB).toBe(true);
  expect(await page.evaluate(() => !!localStorage.getItem('web-editor-autosave__proj_c')), '★탭에 없는 A 본을 지웠다').toBe(true);
  expect(s.toasts).toEqual([]);
  expect(await away(page)).toEqual(['proj_b']);
  expect(errs).toEqual([]);
});
test('A4 그 계정으로 돌아오면 맡긴 탭을 돌려받는다', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_a', listed: ['proj_a', 'proj_b'], states: {}, ls: ['proj_b'], tabs: ['proj_a'], away: [{ id: 'proj_b', name: 'proj_b이름' }] });
  const s = await bs(page);
  expect(s.tabs).toEqual(['proj_a', 'proj_b']);
  expect(s.lsB).toBe(true);
  expect(await away(page)).toEqual([]);
  expect(errs).toEqual([]);
});
test('A5 어느 계정 것인지 모르는 본은 안 준다', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', ls: true, owner: null });
  await go(page);
  await page.waitForFunction(() => window.openTabs.length === 1);
  expect((await st(page)).screenB).toBe(false);
  expect(errs).toEqual([]);
});

/* 리뷰 ② — 폴더가 돌아온 뒤 */
test('T1 남은 본으로 연 탭은 폴더가 돌아오면 파일로 다시 연다 — 낡은 캐시를 안 쓴다', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', ls: true });
  await go(page); await settled(page);
  expect((await st(page)).screenB, '[전제] 본으로 열렸다').toBe(true);
  await page.evaluate(() => window.switchTab('proj_a')); await settled(page);
  /* 폴더가 돌아왔다 — 파일 쪽 내용이 다르다 */
  await page.evaluate(() => { const real = window.electronAPI; window.__fileRead = 0; window.electronAPI = new Proxy(real, { get: (t, k) => k === 'projectFolderState' ? async () => 'ok' : k === 'loadProject' ? async (id) => { window.__fileRead++; return { id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P', canvas: '<div class="section-block" id="s_returned" data-section="1"><div class="section-hitzone"></div><div class="section-inner"></div></div>' }] }; } : t[k] }); });
  await go(page); await settled(page);
  expect(await page.evaluate(() => !!document.getElementById('s_returned')), '★돌아온 파일을 안 읽고 낡은 본을 띄웠다').toBe(true);
  expect(errs).toEqual([]);
});
test('T2 [대조] 평범한 캐시 탭은 파일을 다시 안 읽는다', async ({ page }) => {
  const errs = await setup(page, { state: 'ok', cached: true });
  await page.evaluate(() => { window.__fileRead = 0; const real = window.electronAPI; window.electronAPI = new Proxy(real, { get: (t, k) => k === 'loadProject' ? async (id, o) => { if (o?.open) window.__fileRead++; return null; } : t[k] }); });
  await go(page); await settled(page);
  expect(await page.evaluate(() => window.__fileRead)).toBe(0);
  expect((await st(page)).screenB).toBe(true);
  expect(errs).toEqual([]);
});

/* 리뷰 ③ — 이름 */
test('Y1 폴더를 다시 만드는 저장은 탭 이름을 쓴다 — Untitled 가 안 된다', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', ls: true });
  await go(page); await settled(page);
  await page.evaluate(() => window.saveProjectToFile(window.serializeProject(), { projectId: 'proj_b', skipThumbnail: true }));
  expect(await page.evaluate(() => window.__savedDocs.at(-1).name)).toBe('proj_b이름');
  expect(errs).toEqual([]);
});
test('Y2 [대조] 파일이 있으면 파일 이름이 이긴다', async ({ page }) => {
  const errs = await setup(page, { state: 'ok', cached: true });
  await go(page); await settled(page);
  await page.evaluate(() => { const t = window.openTabs.find(x => x.id === 'proj_b'); t.name = '낡은 탭 이름'; });
  await page.evaluate(() => window.saveProjectToFile(window.serializeProject(), { projectId: 'proj_b', skipThumbnail: true }));
  expect(await page.evaluate(() => window.__savedDocs.at(-1).name)).toBe('proj_b이름');
  expect(errs).toEqual([]);
});

/* 리뷰 ⑤ — 본만 남은 탭을 닫을 때 */
test('C1 본만 남은 탭을 닫으면 파일로 내린 뒤 닫고 알린다 — 이름 그대로', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', ls: true });
  await page.evaluate(() => window.closeTab('proj_b')); await settled(page);
  const s = await st(page);
  expect(s.saved, '★하나뿐인 내용을 안 내리고 닫았다').toContain('proj_b');
  expect(await page.evaluate(() => window.__savedDocs.at(-1).name)).toBe('proj_b이름');
  expect(s.tabs).toEqual(['proj_a']);
  expect(s.toasts.join()).toContain('다시 만들었습니다');
  expect(errs).toEqual([]);
});
test('C2 못 내리면 안 닫는다', async ({ page }) => {
  const errs = await setup(page, { state: 'missing', ls: true });
  await page.evaluate(() => { window.__saveRefuse = true; });
  await page.evaluate(() => window.closeTab('proj_b')); await settled(page);
  expect((await st(page)).tabs).toEqual(['proj_a', 'proj_b']);
  expect(errs).toEqual([]);
});
test('C3 [대조] 폴더가 있거나 앱 휴지통·다른 계정이면 닫을 때 안 쓴다', async ({ page }) => {
  for (const [state, owner] of [['ok', 'acct_me'], ['trashed', 'acct_me'], ['missing', 'acct_other']]) {
    const p2 = await page.context().newPage();
    const errs = await setup(p2, { state, ls: true, owner });
    await p2.evaluate(() => window.closeTab('proj_b')); await settled(p2);
    expect((await st(p2)).saved, state + ' ' + owner).toEqual([]);
    expect(errs).toEqual([]);
    await p2.close();
  }
});

/* 리뷰 ④ — 부팅을 기다리는 사이 탭 이동 */
test('D1 부팅을 기다리는 사이 다른 탭으로 가면 없어진 탭만 닫는다 — 멀쩡한 탭을 안 닫는다', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_b', listed: ['proj_a', 'proj_c'], states: { proj_b: 'missing' }, ls: [], tabs: ['proj_b', 'proj_a', 'proj_c'], hold: 'proj_b' });
  await page.waitForFunction(() => typeof window.__release === 'function', null, { timeout: 15000 });
  await page.evaluate(() => { window.switchTab('proj_c'); });
  await page.waitForFunction(() => window.activeProjectId === 'proj_c' && window.gdtProjectReady?.get?.()?.phase !== 'loading', null, { timeout: 10000 });
  await page.evaluate(() => window.__release());
  await page.waitForFunction(() => document.querySelectorAll('.settings-toast').length > 0, null, { timeout: 10000 });
  const s = await bs(page);
  expect(s.active, '★활성 탭이 바뀌었다').toBe('proj_c');
  expect(s.tabs, '★멀쩡한 탭을 닫았다').toEqual(['proj_a', 'proj_c']);
  expect(s.toasts.join()).toContain('proj_b이름');
  expect(errs).toEqual([]);
});

/* 리뷰 ⑥ — 계정 파일이 깨져 어느 계정인지 모를 때 */
test('U4 어느 계정인지 모르면 LS 본을 화면에 안 올리고 탭과 본을 그대로 둔다', async ({ page }) => {
  const errs = await bootWith(page, { url: 'index.html?project=proj_b', listed: [], states: { proj_b: 'unknown', '': 'unknown' }, ls: ['proj_b'], tabs: ['proj_b'], root: null });
  const s = await bs(page);
  expect(s.screenB, '★주인 모르는 본을 띄웠다').toBe(false);
  expect(s.lsB, '★본을 지웠다').toBe(true);
  expect(s.tabs).toEqual(['proj_b']);
  expect(await page.evaluate(() => window.isTabFirstLoading('proj_b')), '저장 막는 표식').toBe(true);
  expect(errs).toEqual([]);
});
