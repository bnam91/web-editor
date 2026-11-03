/* tab-deleted-project — 연 프로젝트가 지워지면 저장 없이 탭을 닫고 알린다(현빈 결정 2026-11-03 · 쓰기 거절은 tests/unit/project-deleted-save-guard).
 * 칸: A 보는 탭(옆 탭으로) · B 옆 탭 · C 마지막 탭(갤러리 · 알림 넘김) · D 저장 거절이 탭을 닫는다 · N 대조.
 * 칸(머지 전 보완): F 휴지통 전 내림 · F2 옆 탭 저장 실패분 · L2 옆 탭 문구 · Q 저장 거절 중 종료.
 * 변이: 목록에서 먼저 빼는 줄을 switchTab 뒤로 미루면 A·C 빨강(나가는 탭을 저장) · save-load 의 project_deleted 갈래를 빼면 D 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, ids) {
  const errs = await bootApp(page);
  await page.evaluate((ids) => {
    window.__saved = [];
    const real = window.electronAPI;
    const p = (id) => ({ id, name: id + '이름', version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P', canvas: '<div class="section-block" id="s_' + id + '" data-section="1"><div class="section-hitzone"></div><div class="section-inner"></div></div>' }] });
    window.electronAPI = new Proxy(real || {}, { get: (t, k) => k === 'saveProject' ? async (x) => { window.__saved.push(x.id); return window.__refuse ? { ok: false, reason: 'project_deleted' } : { ok: true }; }
      : k === 'loadProject' ? async (id) => p(id) : t[k] });
    window.IS_ELECTRON = window.IS_ELECTRON;
    window.__toasts = []; const f = window.showStatusToast; window.showStatusToast = (m) => { window.__toasts.push(m); f(m); };
    window.openTabs = ids.map((id) => ({ id, name: id + '이름', _cache: JSON.stringify(p(id)) }));
    window.activeProjectId = ids[0];
    window.renderTabBar();
  }, ids);
  return errs;
}
const st = (page) => page.evaluate(() => ({ tabs: window.openTabs.map(t => t.id), active: window.activeProjectId, saved: window.__saved, toasts: window.__toasts }));
const dirty = (page) => page.evaluate(() => { window.addSection?.(); window.__dirtyNow = window.hasUnsavedChanges?.(); return window.__dirtyNow; });

test('A 보는 탭 — 옆 탭으로 · 지운 것 저장 0 · 저장 안 된 편집을 알린다', async ({ page }) => {
  const errs = await setup(page, ['proj_a', 'proj_b']);
  expect(await dirty(page), '[전제] 저장 안 된 편집이 있다').toBe(true);
  expect(await page.evaluate(() => window.closeDeletedProjectTab('proj_a'))).toBe(true);
  const s = await st(page);
  expect(s.tabs).toEqual(['proj_b']);
  expect(s.active).toBe('proj_b');
  expect(s.saved, '★지운 프로젝트를 저장했다').not.toContain('proj_a');
  expect(s.toasts.length).toBe(1);
  expect(s.toasts[0]).toContain('proj_a이름');
  expect(s.toasts[0]).toContain('저장되지 않은 편집');
  expect(errs).toEqual([]);
});
test('B 옆 탭 — 보던 화면 그대로 · 잃은 내용 문구 없음', async ({ page }) => {
  const errs = await setup(page, ['proj_a', 'proj_b']);
  await page.evaluate(() => window.closeDeletedProjectTab('proj_b'));
  const s = await st(page);
  expect(s.tabs).toEqual(['proj_a']);
  expect(s.active).toBe('proj_a');
  expect(s.saved).toEqual([]);
  expect(s.toasts[0]).not.toContain('저장되지 않은 편집');
  expect(errs).toEqual([]);
});
test('C 마지막 탭 — 저장 없이 갤러리로 · 알림을 넘긴다', async ({ page }) => {
  const errs = await setup(page, ['proj_a']);
  await dirty(page);
  await page.route('**/pages/projects.html*', (r) => r.fulfill({ contentType: 'text/html', body: '<title>갤러리</title>' }));
  const saved = page.evaluate(() => window.closeDeletedProjectTab('proj_a'));
  await saved;
  await page.waitForURL('**/pages/projects.html*');
  const v = await page.evaluate(() => ({ n: localStorage.getItem('gd-deleted-tab-notice'), t: JSON.parse(localStorage.getItem('web-editor-open-tabs')) }));
  expect(v.n).toContain('proj_a이름');
  expect(v.n).toContain('저장되지 않은 편집');
  expect(v.t.tabs).toEqual([]);
  expect(v.t.activeId).toBe(null);
  expect(errs).toEqual([]);
});
test('D 저장이 거절되면 탭을 닫는다 · 실패 알림 없음', async ({ page }) => {
  const errs = await setup(page, ['proj_a', 'proj_b']);
  await dirty(page);
  await page.evaluate(() => { window.__refuse = true; });
  const r = await page.evaluate(() => window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: 'proj_a' }));
  expect(r.reason).toBe('project_deleted');
  expect(r.skipped).toBe(true);
  const s = await st(page);
  expect(s.tabs).toEqual(['proj_b']);
  expect(await page.evaluate(() => document.getElementById('editor-toast')?.textContent || '')).not.toContain('저장 거부');
  expect(errs).toEqual([]);
});
test('N [음성] 탭에 없는 id · 안 지운 프로젝트 저장', async ({ page }) => {
  const errs = await setup(page, ['proj_a', 'proj_b']);
  expect(await page.evaluate(() => window.closeDeletedProjectTab('proj_z'))).toBe(false);
  await dirty(page);
  const r = await page.evaluate(() => window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: 'proj_a' }));
  expect(r.ok).toBe(true);
  const s = await st(page);
  expect(s.tabs).toEqual(['proj_a', 'proj_b']);
  expect(s.saved).toContain('proj_a');
  expect(s.toasts).toEqual([]);
  expect(errs).toEqual([]);
});

test('F 휴지통 전 내림 — 밀린 편집을 저장한다 · 그 뒤 닫으면 잃은 내용 문구 없음', async ({ page }) => {
  const errs = await setup(page, ['proj_a', 'proj_b']);
  await dirty(page);
  await page.evaluate(() => window.flushProjectBeforeTrash('proj_a'));
  expect((await st(page)).saved).toEqual(['proj_a']);
  await page.evaluate(() => window.closeDeletedProjectTab('proj_a'));
  expect((await st(page)).toasts[0]).not.toContain('저장되지 않은 편집');
  expect(errs).toEqual([]);
});
test('F2 [음성] 내림 — 탭에 없는 id · 편집 없는 보는 탭은 안 쓴다', async ({ page }) => {
  const errs = await setup(page, ['proj_a', 'proj_b']);
  await page.evaluate(() => window.flushProjectBeforeTrash('proj_z'));
  await page.evaluate(() => window.flushProjectBeforeTrash('proj_b'));
  expect((await st(page)).saved).toEqual([]);
  expect(errs).toEqual([]);
});
test('L2 옆 탭 — 저장이 실패로 끝났으면 잃은 내용 문구를 붙이고, 휴지통 내림이 다시 쓴다', async ({ page }) => {
  const errs = await setup(page, ['proj_a', 'proj_b']);
  await dirty(page);
  await page.evaluate(async () => { const f = window.electronAPI; window.electronAPI = new Proxy(f, { get: (t, k) => k === 'saveProject' ? async () => { throw new Error('EACCES'); } : t[k] }); await window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: 'proj_b' }); window.electronAPI = f; });
  await page.evaluate(() => { window.openTabs.find(t => t.id === 'proj_b')._cache = window.serializeProject(); });
  await page.evaluate(() => window.flushProjectBeforeTrash('proj_b'));
  expect((await st(page)).saved, '★실패분을 다시 안 썼다').toEqual(['proj_b']);
  await page.evaluate(async () => { const f = window.electronAPI; window.electronAPI = new Proxy(f, { get: (t, k) => k === 'saveProject' ? async () => { throw new Error('EACCES'); } : t[k] }); await window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: 'proj_b' }); window.electronAPI = f; });
  await page.evaluate(() => window.closeDeletedProjectTab('proj_b'));
  expect((await st(page)).toasts[0]).toContain('저장되지 않은 편집');
  expect(errs.filter(e => !/EACCES/.test(e))).toEqual([]);
});
test('Q 저장 중 종료 · 그 저장이 거절되면 «저장 못 함»으로 답하지 않는다', async ({ page }) => {
  await page.addInitScript(() => { let real; Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => real, set(v) { real = new Proxy(v, { get: (t, k) => {
    if (k === 'onForceSaveBeforeQuit') return (cb) => { window.__quit = cb; };
    if (k === 'quitReady') return (r) => { window.__ans = r; };
    return t[k]; } }); } }); });
  const errs = await setup(page, ['proj_a', 'proj_b']);
  const a = await page.evaluate(async () => {
    window.addSection?.();
    const f = window.electronAPI; let rel; const hold = new Promise(r => { rel = r; });
    window.electronAPI = new Proxy(f, { get: (t, k) => k === 'saveProject' ? async () => { await hold; return { ok: false, reason: 'project_deleted' }; } : t[k] });
    const s = window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: 'proj_a' });
    await new Promise(r => requestAnimationFrame(r));
    const q = window.__quit();
    await new Promise(r => requestAnimationFrame(r));
    rel(); await s; await q;
    return window.__ans;
  });
  expect(a.ok, JSON.stringify({ ok: a.ok, reason: a.reason })).toBe(true);
  expect(a.reason).toBe('project_deleted');
  expect(errs).toEqual([]);
});
