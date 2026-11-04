/* home-waits-save-line — 홈으로 나가기는 저장 줄이 빈 뒤에 넘어간다(RENDERER-LOAD-SAVE-ROUNDTRIP-FIVE-LEFT-01).
 * 재현: 탭을 옮기자마자 홈 → 떠난 탭 저장이 도는 동안 목록의 글꼴 대체가 그 파일을 읽고 고쳐 써서 편집을 잃었다(앱 값 9/9).
 * 칸: H1 다른 탭 저장이 도는 중 · H2 지금 탭 저장이 도는 중에 편집 — 그 편집이 저장으로 나간 뒤 이동
 * 음성: N1 줄이 비었으면 곧바로 이동.
 * 양성대조: goHome 을 옛 줄로 되돌리면 H1·H2 빨강, N1 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const ID = 'proj_q';
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate((id) => {
    const project = { ...window.buildEmptyProject(id, id), id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P', pageSettings: {}, canvas: `<div class="section-block" id="sec_q"><div class="section-inner"></div></div>` }] };
    window.__file = JSON.parse(JSON.stringify(project)); window.__saves = []; window.__syncs = []; window.__holdNext = null; window.__failSave = false;
    const fake = {
      loadProject: async () => { const v = JSON.parse(JSON.stringify(window.__file)); if (window.__holdNext) { const h = window.__holdNext; window.__holdNext = null; window.__held = true; await h; } return v; },
      saveProject: async (p) => { window.__saves.push(JSON.stringify(p).match(/qm\d+/g) || []); if (window.__failSave) throw new Error('EPERM'); window.__file = JSON.parse(JSON.stringify(p)); return { ok: true }; },
      saveProjectSync: (p) => { window.__syncs.push(JSON.stringify(p).match(/qm\d+/g) || []); return { ok: true }; },
      saveProjectMeta: async () => ({ ok: true }),
    };
    window.electronAPI = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
    window.IS_ELECTRON = true;
    window.openTabs = [{ id, name: id }]; window.activeProjectId = id; history.replaceState(null, '', '?project=' + id);
    window.applyProjectData(JSON.parse(JSON.stringify(project)));
    window.__edit = (m) => { const sec = document.querySelector('#canvas .section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addTextBlock('body'); const t = [...sec.querySelectorAll('.text-block')].pop(); (t.querySelector('[contenteditable]') || t).textContent = m; window.deselectAll(); window.scheduleAutoSave?.(); };
    window.__hold = () => { let rel; window.__holdNext = new Promise((r) => { rel = r; }); window.__rel = rel; window.__held = false; };
  }, ID);
  await settle(page);
  await page.waitForFunction(() => !window.hasUnsavedChanges());
  return errs;
}

const startedHome = (page) => page.evaluate(() => { window.goHome(); });
const leftWithin = (page, ms) => page.waitForURL(/projects\.html/, { timeout: ms }).then(() => true).catch(() => false);

test('H1 다른 탭 저장이 도는 중 — 그 저장이 끝난 뒤에 넘어간다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.__hold(); window.__other = window.saveInLine(JSON.parse(JSON.stringify(window.__file)), 'proj_other', { skipThumbnail: true }); });
  await page.waitForFunction(() => window.__held, null, { timeout: 10000 });
  await startedHome(page);
  expect(await leftWithin(page, 1500), '★떠난 탭 저장이 도는데 목록으로 넘어갔다').toBe(false);
  await page.evaluate(() => window.__rel());
  expect(await leftWithin(page, 15000)).toBe(true);
});

test('H2 지금 탭 저장이 도는 중에 편집 — 그 편집이 저장으로 나간 뒤에 넘어간다', async ({ page }) => {
  await setup(page);
  const saved = []; await page.exposeFunction('__recSave', (m) => { saved.push(m); });
  await page.evaluate(() => { const o = window.electronAPI.saveProject; window.__origSave = o; const f = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'saveProject' ? async (p) => { await window.__recSave(JSON.stringify(p).match(/qm\d+/g) || []); return f.saveProject(p); } : f[k]) }); });
  await page.evaluate(() => { window.__hold(); window.__edit('qm1'); });
  await page.waitForFunction(() => window.__held, null, { timeout: 15000 });
  await page.evaluate(() => window.__edit('qm2'));
  await startedHome(page);
  expect(await leftWithin(page, 1500), '★저장이 도는데 넘어갔다').toBe(false);
  await page.evaluate(() => window.__rel());
  expect(await leftWithin(page, 15000)).toBe(true);
  expect(saved.flat(), '★편집이 줄에 선 채 버려졌다').toContain('qm2');
});

test('N1 [음성] 줄이 비었으면 곧바로 넘어간다', async ({ page }) => {
  await setup(page);
  await startedHome(page);
  expect(await leftWithin(page, 15000)).toBe(true);
});
