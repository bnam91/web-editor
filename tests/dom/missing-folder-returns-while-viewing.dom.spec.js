/* missing-folder-returns-while-viewing — 폴더 없는 탭을 남은 본으로 보는 중 폴더가 돌아오면, 그 탭의 편집이 돌아온 파일을 안 덮는다(MISSING-FOLDER-RETURNS-WHILE-VIEWING-OVERWRITES-01).
 * 앱 값(MPT-리뷰8-203500 · L3 3/3): 탭을 안 옮기고 편집하면 돌아온 파일을 덮고 proj_backup 한 칸에만 남는다. 옆 탭을 다녀오면 파일로 다시 열린다(T1 · tab-missing-project-notice).
 * 장면: 폴더 상태·읽기·쓰기를 가짜 API 로 돌린다 — 쓰기는 main 의 약속(남은 본 표시 + 폴더 있음 ⇒ folder_returned · kept)을 흉내 낸다. main 쪽은 tests/unit/missing-folder-returned-save.
 * 칸: V1 자동저장 길 — 안 덮고, 알리고, 파일로 다시 연다 · V2 종료·새로고침 동기 길도 표시를 단다 · V3 다시 연 뒤 편집은 평소대로 파일에 간다.
 * 대조: N1 폴더가 아직 없으면 그 본으로 폴더를 다시 만들고 그 뒤 저장도 막지 않는다 · N2 평범한 탭은 표시가 없다.
 * 변이: 회신의 값. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sec = (k, t) => `<div class="section-block" id="s_${k}" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="text-block" id="tb_${k}"><p>${t}</p></div><div class="asset-block" id="ab_${k}" data-img-src="${IMG}"></div></div></div>`;
const doc = (id, tag) => ({ id, name: id + '이름', version: 2, currentPageId: 'page_1', updatedAt: tag === '돌아온' ? '2026-11-10T00:00:00.000Z' : '2026-11-01T00:00:00.000Z',
  pages: [{ id: 'page_1', name: 'P', canvas: sec(tag + '1', tag + ' 머리') + sec(tag + '2', tag + ' 몸') + sec(tag + '3', tag + ' 끝') }] });

async function setup(page, { cached = false } = {}) {
  const errs = await bootApp(page);
  await page.evaluate(({ A, B, R, cached }) => {
    window.__state = 'missing'; window.__written = []; window.__sent = []; window.__toasts = [];
    const real = window.electronAPI;
    const write = (x) => { window.__sent.push({ id: x.id, gone: !!x._goneBase }); if (x._goneBase && window.__state === 'ok') return { ok: false, reason: 'folder_returned', kept: true }; if (x.id === 'proj_b') window.__state = 'ok'; window.__written.push(x); return { ok: true }; };
    window.electronAPI = new Proxy(real || {}, { get: (t, k) => k === 'saveProject' ? async (x) => write(x)
      : k === 'saveProjectSync' ? (x) => write(x)
      : k === 'saveProjectMeta' ? async () => ({ ok: true })
      : k === 'loadProject' ? async (id) => (id === 'proj_b' ? (window.__state === 'ok' ? (window.__written.filter(w => w.id === 'proj_b').at(-1) || R) : null) : A)
      : k === 'projectFolderState' ? async (id) => (id === 'proj_b' ? window.__state : 'ok')
      : k === 'projectsRootKey' ? async () => 'acct_me' : t[k] });
    const f = window.showStatusToast; window.showStatusToast = (m) => { window.__toasts.push(m); f(m); };
    localStorage.setItem('web-editor-autosave__proj_b', JSON.stringify(B));
    localStorage.setItem('web-editor-ls-root__proj_b', 'acct_me');
    window.openTabs = [{ id: 'proj_a', name: 'proj_a이름', _cache: JSON.stringify(A) }, { id: 'proj_b', name: 'proj_b이름' }];
    window.activeProjectId = 'proj_a';
    window.renderTabBar();
  }, { A: doc('proj_a', 'A'), B: doc('proj_b', '남은'), R: doc('proj_b', '돌아온'), cached });
  await page.evaluate(() => window.switchTab('proj_b'));
  await page.waitForFunction(() => !!document.getElementById('s_남은1') && window.gdtProjectReady?.get?.()?.phase !== 'loading');
  return errs;
}
const ret = (page) => page.evaluate(() => { window.__state = 'ok'; });   // 앱 밖에서 폴더가 돌아왔다
const edit = (page, t) => page.evaluate((t) => { document.querySelector('#canvas .text-block p').textContent = t; window.scheduleAutoSave(); }, t);
const wroteB = (page) => page.evaluate(() => window.__written.filter(w => w.id === 'proj_b').map(w => JSON.stringify(w.pages)));

test('V1 자동저장 길 — 돌아온 파일을 안 덮고, 알리고, 파일로 다시 연다', async ({ page }) => {
  const errs = await setup(page);
  await ret(page);
  await edit(page, '남은본편집');
  await page.waitForFunction(() => window.__sent.some(s => s.id === 'proj_b'), null, { timeout: 15000 });
  await page.waitForFunction(() => !!document.getElementById('s_돌아온1'), null, { timeout: 15000 }).catch(() => {});
  expect(await wroteB(page), '★돌아온 파일을 남은 본으로 덮었다').toEqual([]);
  expect(await page.evaluate(() => window.__sent.filter(s => s.id === 'proj_b').every(s => s.gone)), '남은 본 표시').toBe(true);
  expect(await page.evaluate(() => !!document.getElementById('s_돌아온1')), '★파일로 다시 안 열었다').toBe(true);
  expect((await page.evaluate(() => window.__toasts)).join(), '★안내 없음').toContain('폴더가 돌아와');
  expect(await page.evaluate(() => window.activeProjectId)).toBe('proj_b');
  expect(errs).toEqual([]);
});
test('V2 종료·새로고침 동기 길도 표시를 단다 — main 이 거절한다', async ({ page }) => {
  const errs = await setup(page);
  await ret(page);
  await page.evaluate(() => { document.querySelector('#canvas .text-block p').textContent = '닫기직전'; window.scheduleAutoSave(); window.dispatchEvent(new Event('beforeunload')); });
  const sent = await page.evaluate(() => window.__sent.filter(s => s.id === 'proj_b'));
  expect(sent.length, '[전제] 동기 저장이 나갔다').toBeGreaterThan(0);
  expect(sent.every(s => s.gone), '★동기 저장에 남은 본 표시가 없다').toBe(true);
  expect(await wroteB(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('web-editor-autosave__proj_b')), 'LS 본은 그대로 남는다').toContain('닫기직전');
  expect(errs).toEqual([]);
});
test('V3 다시 연 뒤 편집은 평소대로 파일에 간다', async ({ page }) => {
  const errs = await setup(page);
  await ret(page);
  await edit(page, '남은본편집');
  await page.waitForFunction(() => !!document.getElementById('s_돌아온1') && window.gdtProjectReady?.get?.()?.phase !== 'loading', null, { timeout: 15000 });
  await page.waitForFunction(() => !window.AutoSaveSuppress?.inspect?.()?.holders?.length, null, { timeout: 15000 }).catch(() => {});
  await edit(page, '다시연뒤편집');
  await page.waitForFunction(() => window.__written.some(w => w.id === 'proj_b'), null, { timeout: 15000 });
  const w = await wroteB(page);
  expect(w.at(-1)).toContain('다시연뒤편집');
  expect(w.at(-1), '다시 연 판은 돌아온 파일 위다').toContain('돌아온 몸');
  expect(errs).toEqual([]);
});
test('N1 [대조] 폴더가 아직 없으면 그 본으로 다시 만들고, 그 뒤 저장도 안 막는다', async ({ page }) => {
  const errs = await setup(page);
  await edit(page, '첫편집');
  await page.waitForFunction(() => window.__written.some(w => w.id === 'proj_b'), null, { timeout: 15000 });
  await edit(page, '둘째편집');
  await page.waitForFunction(() => window.__written.filter(w => w.id === 'proj_b').some(w => JSON.stringify(w.pages).includes('둘째편집')), null, { timeout: 15000 });
  const s = await page.evaluate(() => ({ sent: window.__sent.filter(s => s.id === 'proj_b'), tab: window.openTabs.find(t => t.id === 'proj_b')._goneCopy }));
  expect(s.sent[0].gone).toBe(true);
  expect(s.sent.at(-1).gone, '★다시 만든 뒤에도 남은 본 표시 — 다음 저장이 거절된다').toBe(false);
  expect(s.tab).toBe(false);
  expect(errs).toEqual([]);
});
test('N2 [대조] 평범한 탭의 저장은 표시가 없다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.switchTab('proj_a'));
  await page.waitForFunction(() => !!document.getElementById('s_A1') && window.gdtProjectReady?.get?.()?.phase !== 'loading');
  await edit(page, 'A편집');
  await page.waitForFunction(() => window.__sent.some(s => s.id === 'proj_a'), null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__sent.filter(s => s.id === 'proj_a').some(s => s.gone))).toBe(false);
  expect(errs).toEqual([]);
});
test('V4 남은 본 탭을 닫으며 나간 저장이 거절돼도 알린다 — 다시 열 탭이 없다', async ({ page }) => {
  const errs = await setup(page);
  await ret(page);
  await page.evaluate(() => { document.querySelector('#canvas .text-block p').textContent = '닫기전편집'; });
  await page.evaluate(() => window.closeTab('proj_b'));
  await page.waitForFunction(() => window.__toasts.some(t => t.includes('폴더가 돌아와')), null, { timeout: 15000 }).catch(() => {});
  expect(await wroteB(page), '★닫으며 나간 저장이 돌아온 파일을 덮었다').toEqual([]);
  expect((await page.evaluate(() => window.__toasts)).join(), '★거절했는데 말이 없다').toContain('버전 기록');
  expect(errs).toEqual([]);
});
