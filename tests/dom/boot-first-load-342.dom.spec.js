/* boot-first-load-342 — 앱 시작 때 첫 로드 중·로드 실패 뒤의 빈 캔버스가 그 프로젝트 파일을 안 덮는다 (J342A)
 * 왜: 부트 길(initLoad)은 탭 길과 달리 «아직 안 읽힘» 표식을 안 세웠다. 빈 화면이 탭 캐시로 남거나 편집과 함께 파일로 나갔다.
 *   앱 실측: ~/gd-lane/imac-gd-L1/342d. 탭 갔다 돌아와 편집 · 로드 중 편집 · 로드 실패 뒤 편집에서 B 씨앗 0.
 * 자: 프로젝트별 저장 입구 기록(saveProject · saveProjectSync · 페이지를 넘어 살아남게 노드 쪽 기록). 파일은 앱이 잰다.
 * 칸: B1 로드 중 탭 갔다 돌아옴 — 돌아온 B 가 파일에서 읽혀 씨앗 있음 · 편집 저장에 씨앗 · B2 로드 중 편집 — B 저장 0 · 읽힌 뒤 씨앗
 *     B3 로드 실패 뒤 편집 — B 저장 0 · «저장됨» 아님 · B4 [음성] 로드 끝난 뒤 편집 — 저장에 씨앗과 편집 · B5 실패 뒤 탭 갔다 돌아와 읽히면 편집 저장
 *     B6 [음성] 파일 없는 프로젝트(null) — 편집이 저장된다(쥐지 않는다) · B7 실패 + localStorage 사본 — 사본을 파일로 안 쓴다 · B8 [음성] 로드 중 홈 — B 저장 0(빈 캔버스 보호)
 * 변이: holdTabFirstLoading 을 빈 손으로 하면 B1·B2·B3·B5·B7 빨강 · 실패 때 쥔 채 두는 표식을 빼면 B3·B5·B7 빨강 · B4·B6·B8 은 늘 초록.
 * ★처음 실행 기록(2026-11-03 · 아이맥): ×3 24/24 · 변이 hold 5빨강 3초록 · 변이 unread 3빨강 5초록. 값 ~/srvty-relay/reply/imac-gd-L1-J342A-*. */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');
const [A, B] = ['proj_342a', 'proj_342b'];
const seed = (id) => `sec_${id}_1`;

const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page, { noFile = false } = {}) {
  const rec = [];
  await page.exposeBinding('__rec', (_s, kind, id, seeds) => { rec.push({ kind, id, seeds }); });
  await page.addInitScript(([A, B, noFile]) => {
    const project = (id) => ({ id, name: id, version: 2, currentPageId: 'page_1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}_1"><div class="section-inner"></div></div>` }] });
    const files = new Map([[A, project(A)]]); if (!noFile) files.set(B, project(B));
    window.__files = files; window.__pending = {};
    const seedsOf = (p) => (p.pages || []).map(x => x.canvas || '').join('').match(/sec_proj_342[ab]_\d/g) || [];
    const fake = {
      isElectron: true,
      onForceSaveBeforeQuit: () => {}, quitReady: () => {},
      listProjects: async () => [...files.keys()].map(id => ({ id, name: id })),
      loadProject: (id, opts) => {
        const read = () => JSON.parse(JSON.stringify(files.get(id) || null));
        if (!(opts && opts.open === true)) return Promise.resolve(read());
        return new Promise((res, rej) => { window.__pending[id] = { done: () => res(read()), fail: () => rej(new Error('읽기 실패')) }; });
      },
      saveProject: async (p) => { await window.__rec('save', p.id, seedsOf(p)); files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true }; },
      saveProjectSync: (p) => { window.__rec('sync', p.id, seedsOf(p)); return { ok: true }; },
    };
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
    localStorage.setItem('web-editor-open-tabs', JSON.stringify({ tabs: [{ id: A, name: A }, { id: B, name: B }], activeId: B }));
  }, [A, B, noFile]);
  const errs = await bootApp(page);
  errs.length = 0; rec.length = 0;
  return { errs, rec };
}
const open = async (page, s) => {
  await page.goto(`${ORIGIN}/index.html?project=${B}`);
  await page.waitForFunction((B) => window.__pending[B] && typeof window.addSection === 'function' && !!document.querySelector('#tab-bar .proj-tab'), B, { timeout: 20000 });
  s.rec.length = 0;
};
const finish = (page, id, how = 'done') => page.evaluate(([id, how]) => { const q = window.__pending[id]; delete window.__pending[id]; q[how](); }, [id, how]);
const opened = (page, id) => page.waitForFunction((id) => window.__pending[id], id);
const loaded = async (page, id) => { await page.waitForFunction((id) => !!document.getElementById(`sec_${id}_1`), id, { timeout: 10000 }); await settle(page); };
const armed = (page) => page.waitForFunction(() => !window.state._suppressAutoSave);
const edit = (page) => page.evaluate(() => { const s = document.querySelector('#canvas .section-block'); if (s) window.selectSection?.(s); else window.addSection(); window.addTextBlock('h2'); });
const tab = (page, id) => page.locator(`#tab-bar .proj-tab[data-id="${id}"]`).first();
const of = (s, id) => s.rec.filter(r => r.id === id);
const indErr = (page) => expect(page.locator('#autosave-indicator'), '★안 쓰고 저장됨이라 했다').toHaveClass(/error/, { timeout: 15000 });

test('B1 로드 중 탭 갔다 돌아옴 — 돌아온 B 가 파일에서 읽힌다 · 편집 저장에 씨앗', async ({ page }) => {
  const s = await setup(page); await open(page, s);
  await tab(page, A).click();
  await opened(page, A); await finish(page, A); await loaded(page, A);
  await finish(page, B);                          // 늦게 끝난 부트 로드 — 버려진다
  await settle(page);
  await tab(page, B).click();
  await opened(page, B); await finish(page, B); await loaded(page, B); await armed(page);
  await edit(page);
  await page.waitForFunction((B) => window.__files.get(B).pages[0].canvas.includes('text-block'), B, { timeout: 15000 });
  expect(of(s, B).at(-1).seeds, '★빈 화면이 B 로 나갔다').toEqual([seed(B)]);
  expect(s.errs).toEqual([]);
});

test('B2 로드 중 편집 — B 저장 0 · 읽힌 뒤 씨앗', async ({ page }) => {
  const s = await setup(page); await open(page, s);
  await page.evaluate(() => window.addSection());
  await indErr(page);
  expect(of(s, B), '★읽기 전 화면이 B 로 나갔다').toEqual([]);
  await finish(page, B); await loaded(page, B);
  expect(s.errs).toEqual([]);
});

test('B3 로드 실패 뒤 편집 — B 저장 0 · «저장됨» 아님', async ({ page }) => {
  const s = await setup(page); await open(page, s);
  await finish(page, B, 'fail'); await settle(page);
  await page.evaluate(() => window.addSection());
  await indErr(page);
  expect(of(s, B), '★읽기 전 화면이 B 로 나갔다').toEqual([]);
  await page.evaluate(() => { window.dispatchEvent(new Event('beforeunload')); });
  expect(of(s, B), '★닫기가 B 를 썼다').toEqual([]);
  expect(s.errs).toEqual([]);
});

test('B4 [음성] 로드 끝난 뒤 편집 — 저장에 씨앗과 편집', async ({ page }) => {
  const s = await setup(page); await open(page, s);
  await finish(page, B); await loaded(page, B); await armed(page);
  await edit(page);
  await page.waitForFunction((B) => window.__files.get(B).pages[0].canvas.includes('text-block'), B, { timeout: 15000 });
  expect(of(s, B).at(-1).seeds).toEqual([seed(B)]);
  expect(s.errs).toEqual([]);
});

test('B5 실패 뒤 탭 갔다 돌아와 읽히면 편집이 저장된다', async ({ page }) => {
  const s = await setup(page); await open(page, s);
  await finish(page, B, 'fail'); await settle(page);
  await tab(page, A).click(); await opened(page, A); await finish(page, A); await loaded(page, A);
  await tab(page, B).click(); await opened(page, B); await finish(page, B); await loaded(page, B); await armed(page);
  await edit(page);
  await page.waitForFunction((B) => window.__files.get(B).pages[0].canvas.includes('text-block'), B, { timeout: 15000 });
  expect(of(s, B).at(-1).seeds).toEqual([seed(B)]);
  expect(s.errs).toEqual([]);
});

test('B6 [음성] 파일 없는 프로젝트 — 편집이 저장된다', async ({ page }) => {
  const s = await setup(page, { noFile: true }); await open(page, s);
  await finish(page, B); await settle(page); await armed(page);
  await page.evaluate(() => window.addSection());
  await page.waitForFunction((B) => window.__files.has(B), B, { timeout: 15000 });
  expect(of(s, B).length).toBeGreaterThan(0);
  expect(s.errs).toEqual([]);
});

test('B7 실패 + localStorage 사본 — 사본을 파일로 안 쓴다', async ({ page }) => {
  const s = await setup(page); await open(page, s);
  await page.evaluate((B) => {
    localStorage.setItem(`web-editor-autosave__${B}`, JSON.stringify({ version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: '<div class="section-block" id="ls_old"><div class="section-inner"></div></div>' }] }));
  }, B);
  await finish(page, B, 'fail'); await settle(page);
  await page.evaluate(() => { const s = document.querySelector('#canvas .section-block'); if (s) window.selectSection?.(s); else window.addSection(); window.addTextBlock('h2'); });
  await indErr(page);
  expect(of(s, B), '★읽기 실패 때 사본이 파일을 덮었다').toEqual([]);
  expect(s.errs).toEqual([]);
});

test('B8 [음성] 로드 중 홈 — B 저장 0', async ({ page }) => {
  const s = await setup(page); await open(page, s);
  await page.evaluate(() => { window.goHome(); });
  await page.waitForURL(/projects\.html/);
  expect(of(s, B)).toEqual([]);
});
