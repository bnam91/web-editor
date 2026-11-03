/* corrupt-open — 깨진 파일을 못 읽음으로 답하면: 빈 프로젝트로 안 열고, 말하고, 저장을 거절한다 (CORRUPT · 지디 결정)
 * 자: 대역 electronAPI 의 saveProject 호출 수 + 토스트 + 진짜 클릭. 진짜 파일 값은 앱 탐침 ~/gd-lane/imac-gd-L1/363d GXZ.
 * 칸: C1 부트 못 읽음 · C2 탭 못 읽음 · C3 [음성] 없음(null)은 그대로 빈 판·저장 된다 · C4 [음성] 백업 복구 길 그대로
 */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');
const [A, B] = ['proj_corrupta', 'proj_corruptb'];
const ADD = 'button.fp-btn.primary[onclick="addSection()"]';

async function setup(page, answers) {
  await page.addInitScript(([A, B, answers]) => {
    const project = (id) => ({ id, name: id, version: 2, currentPageId: 'page_1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}_1"><div class="section-inner"></div></div>` }] });
    window.__saves = 0; window.__toasts = [];
    new MutationObserver(() => { const t = document.getElementById('editor-toast')?.textContent; if (t && window.__toasts[window.__toasts.length - 1] !== t) window.__toasts.push(t); }).observe(document, { subtree: true, childList: true, characterData: true });
    const fake = {
      isElectron: true,
      onForceSaveBeforeQuit: () => {}, quitReady: () => {},
      listProjects: async () => [A, B].map(id => ({ id, name: id })),
      loadProject: async (id, opts) => {
        if (!(opts && opts.open === true)) return id in answers ? null : project(id);
        if (!(id in answers)) return project(id);
        return answers[id] === 'null' ? null : { ...(answers[id].recovered ? project(id) : {}), ...answers[id].mark };
      },
      saveProject: async () => { window.__saves++; return { ok: true }; },
      saveProjectSync: () => { window.__saves++; return { ok: true }; },
    };
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
    localStorage.setItem('web-editor-open-tabs', JSON.stringify({ tabs: [{ id: A, name: A }, { id: B, name: B }], activeId: B }));
  }, [A, B, answers]);
  const errs = await bootApp(page);
  errs.length = 0;
  await page.goto(`${ORIGIN}/index.html?project=${B}`);
  await page.waitForFunction(() => typeof window.addSection === 'function' && window.gdtProjectReady?.get().phase !== 'loading' && !window.LoadInputGate.isOn(), null, { timeout: 20000 });
  return errs;
}
const toasts = (page) => expect.poll(() => page.evaluate(() => window.__toasts.join('\n')));   // 토스트 칸은 하나라 뒤 말에 덮인다 — 지나간 말까지 본다
const UNREADABLE = { mark: { _unreadable: true, preservedAs: 'proj_corrupt_1.json' } };

test('C1 부트 못 읽음 — 말하고 보존 이름을 대고, 편집해도 저장을 안 부른다', async ({ page }) => {
  await setup(page, { [B]: UNREADABLE });
  await toasts(page).toContain('proj_corrupt_1.json');
  await page.locator(ADD).click();
  await expect(page.locator('#autosave-indicator'), '★저장 거절을 말하지 않았다').toContainText('저장 실패', { timeout: 15000 });
  expect(await page.evaluate(() => window.__saves)).toBe(0);
  const r = await page.evaluate(() => window.saveProjectToFile(window.serializeProject()));
  expect(r.reason).toBe('tab-not-loaded');
  expect(await page.evaluate(() => window.__saves)).toBe(0);
});

test('C2 탭 못 읽음 — 말하고 저장을 안 부른다', async ({ page }) => {
  await setup(page, { [A]: UNREADABLE });
  await page.locator(`#tab-bar .proj-tab[data-id="${A}"]`).click();
  await toasts(page).toContain('proj_corrupt_1.json');
  expect(await page.evaluate(() => window.gdtProjectReady.get().phase)).toBe('error');
  const r = await page.evaluate((A) => window.saveProjectToFile(window.serializeProject(), { projectId: A }), A);
  expect(r.reason).toBe('tab-not-loaded');
});

test('C3 [음성] 없음(null) — 그대로 빈 판 · 말 없음 · 저장 된다', async ({ page }) => {
  await setup(page, { [B]: 'null' });
  expect(await page.evaluate(() => window.gdtProjectReady.get().phase)).toBe('ready');
  await page.locator(ADD).click();
  await expect.poll(() => page.evaluate(() => window.__saves), { timeout: 15000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__toasts.join('\n'))).not.toContain('읽지 못했습니다');
});

test('C4 [음성] 백업 복구 길 — 그대로 복구로 열리고 저장 된다', async ({ page }) => {
  await setup(page, { [B]: { recovered: true, mark: { _recovered: 'backup', _healed: true, _recoveredAtLabel: '11-03 10:00' } } });
  await expect(page.locator(`#sec_${B}_1`)).toHaveCount(1);
  await toasts(page).toContain('복구');
  expect(await page.evaluate(() => window.__toasts.join('\n'))).not.toContain('읽지 못했습니다');
  expect(await page.evaluate(() => window.gdtProjectReady.get().phase)).toBe('ready');
  await page.locator(ADD).click();
  await expect.poll(() => page.evaluate(() => window.__saves), { timeout: 15000 }).toBeGreaterThan(0);
});
