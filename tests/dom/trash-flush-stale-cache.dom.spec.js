/* trash-flush-stale-cache — 휴지통 직전 저장(flushProjectBeforeTrash)이 옆 탭의 낡은 캐시로 «밖에서 새로워진 파일»을 덮나 (TRASH-FLUSH-STALE-CACHE-OVERWRITES-NEWER-FILE-01)
 * 장면: A 에서 편집 → 옆 탭 B 로 가며 A 저장이 거절(A 캐시 = 그 편집) → 다른 창·MCP·버전 복원 흉내로 A 파일을 새 내용으로 → main 이 휴지통으로 옮기기 전에 부르는 flushProjectBeforeTrash(A).
 * 자: 가짜 API 의 파일 표(window.__files)와 recordRefusedSave 기록(window.__kept). 휴지통 «옮기기»는 main 몫 — 옮겨지는 것은 그 순간의 proj.json 이다.
 * 칸: K1 ★밖에서 새로워진 파일을 안 덮는다(옮겨지는 proj.json = 새 내용) · K2 ★실패한 편집은 비상 사본으로 남는다(잃지 않는다) · K3 같은 실패는 한 번만(닫기·종료와 같은 표지)
 *     N1 [음성] 보는 탭의 밀린 편집은 그대로 파일로 내린다(이 고침 밖 · 동작 무변) · N2 [음성] 저장이 성공한 옆 탭은 아무것도 안 쓴다.
 * 양성대조: js/io/save-load.js 만 고치기 전 판으로 되돌리면 K1·K2 빨강 · N1·N2 초록. 픽스처: 섹션 셋 · 글 · 그림 둘(refused-save-close-tab 과 같은 꼴). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [A, B] = ['proj_tfa', 'proj_tfb'];
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const EDIT = 'TF-EDIT-실패한-편집';
const NEWER = 'TF-NEWER-밖에서-새로';

const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page) {
  await page.addInitScript(() => {
    const fake = { onForceSaveBeforeQuit: (f) => { window.__quit = f; }, quitReady: (r) => { window.__answer = r; } };
    window.__fake = fake;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  });
  const errs = await bootApp(page);
  await page.evaluate(([A, B, RED, HALF]) => {
    const img = (n, src) => `<div class="asset-block has-image" id="ab_${n}" data-img-src="${src}" style="height:200px;"><div class="asset-img-clip"><img class="asset-img" src="${src}" style="width:100%;height:100%"></div></div>`;
    const txt = (n, s) => `<div class="text-block" id="tb_${n}" data-type="text"><div class="tb-h2" contenteditable="false">${s}</div></div>`;
    const sec = (id, n, inner) => `<div class="section-block" id="sec_${id}_${n}" data-section="${n}" data-name="S${n}"><div class="section-inner">${inner}</div></div>`;
    const canvas = (id) => sec(id, 1, txt(id + '1', id + ' 제목')) + sec(id, 2, img(id + '2', RED)) + sec(id, 3, txt(id + '3', '본문') + img(id + '3', HALF));
    const project = (id) => ({ ...window.buildEmptyProject(id, id), id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: canvas(id) }] });
    const files = new Map([[A, project(A)], [B, project(B)]]);
    window.__files = files; window.__kept = []; window.__refuse = null; window.__EDIT = 'TF-EDIT-실패한-편집';
    Object.assign(window.__fake, {
      loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id) || null)),
      saveProject: async (p) => {
        if (window.__refuse === 'throw') throw new Error('EPERM 흉내');
        if (window.__refuse) return { ok: false, reason: window.__refuse };
        files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true };
      },
      saveProjectSync: () => ({ ok: true }),
      recordRefusedSave: (p, reason) => { window.__kept.push({ id: p.id, name: p.name, reason, body: JSON.stringify(p) }); return { ok: true }; },
    });
    window.loadProjectForOpen = async (id) => JSON.parse(JSON.stringify(files.get(id)));
    window.openTabs = [{ id: A, name: A }, { id: B, name: B, _cache: JSON.stringify(files.get(B)) }];
    window.activeProjectId = A;
    history.replaceState(null, '', '?project=' + A);
    window.applyProjectData(JSON.parse(JSON.stringify(files.get(A))));
  }, [A, B, RED, HALF]);
  await settle(page);
  await page.waitForFunction(() => !window.hasUnsavedChanges());
  return errs;
}
/* A 에 글 한 줄을 더한다 — 파일엔 없고 저장만 담을 수 있는 내용 */
const editA = (page) => page.evaluate((EDIT) => { const s = document.querySelector('#canvas .section-block'); window.selectSection?.(s); window.addTextBlock('h2', { content: EDIT }); }, EDIT);
const keptA = (page) => page.evaluate((A) => window.__kept.filter(k => k.id === A), A);
const idle = (page) => page.waitForFunction(() => !window._isSavingToFile);

/* A 편집 → B 로 가며 A 저장 거절 → 거절 풂 → A 파일을 밖에서 새 내용으로 */
async function staleSideTab(page) {
  await editA(page);
  await page.evaluate(() => { window.__refuse = 'disk_full'; });
  await page.evaluate((B) => window.switchTab(B), B);
  await idle(page);
  await page.waitForFunction((A) => window.projectSaveUnsettled(A), A);
  expect(await page.evaluate((A) => window.openTabs.find(t => t.id === A)._cache.includes(window.__EDIT), A), '[전제] A 캐시에 실패한 편집').toBe(true);
  await page.evaluate(([A, NEWER]) => {
    window.__refuse = null;
    const f = JSON.parse(JSON.stringify(window.__files.get(A)));
    f.pages[0].canvas = f.pages[0].canvas.replace(A + ' 제목', NEWER); f.updatedAt = new Date(Date.now() + 60000).toISOString();
    window.__files.set(A, f);
  }, [A, NEWER]);
}
const fileA = (page) => page.evaluate((A) => JSON.stringify(window.__files.get(A)), A);

test('K1 ★휴지통 직전 저장이 밖에서 새로워진 파일을 안 덮는다', async ({ page }) => {
  const errs = await setup(page);
  await staleSideTab(page);
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  const f = await fileA(page);
  expect(f, '★옆 탭 낡은 캐시가 새 파일을 덮었다 — 휴지통에 들어가는 proj.json 이 옛 본').toContain(NEWER);
  expect(f).not.toContain(EDIT);
  expect(errs).toEqual([]);
});
test('K2 ★실패한 편집은 비상 사본으로 남는다', async ({ page }) => {
  const errs = await setup(page);
  await staleSideTab(page);
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  const k = await keptA(page);
  expect(k.length, '★실패한 편집이 어디에도 안 남았다').toBe(1);
  expect(k[0].body).toContain(EDIT);
  expect(k[0].reason).toBe('disk_full');
  expect(errs).toEqual([]);
});
test('K3 같은 실패는 한 번만 — 휴지통 직전에 남겼으면 닫기·다시 부르기가 또 안 남긴다', async ({ page }) => {
  const errs = await setup(page);
  await staleSideTab(page);
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  await page.evaluate((A) => window.keepFailedCopyOnClose(A, A, window.openTabs.find(t => t.id === A)?._cache), A);
  expect((await keptA(page)).length).toBe(1);
  expect(errs).toEqual([]);
});
test('N1 [음성] 보는 탭의 밀린 편집은 그대로 파일로 내린다', async ({ page }) => {
  const errs = await setup(page);
  await editA(page);
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  expect(await fileA(page)).toContain(EDIT);
  expect(await keptA(page)).toEqual([]);
  expect(errs).toEqual([]);
});
test('N2 [음성] 저장이 성공한 옆 탭은 아무것도 안 쓴다', async ({ page }) => {
  const errs = await setup(page);
  await editA(page);
  await page.evaluate((B) => window.switchTab(B), B);
  await idle(page);
  await page.evaluate(([A, NEWER]) => { const f = JSON.parse(JSON.stringify(window.__files.get(A))); f.pages[0].canvas = f.pages[0].canvas.replace(A + ' 제목', NEWER); window.__files.set(A, f); }, [A, NEWER]);
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  expect(await fileA(page)).toContain(NEWER);
  expect(await keptA(page)).toEqual([]);
  expect(errs).toEqual([]);
});
