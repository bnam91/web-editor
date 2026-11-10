/* trash-gallery-failed-edit — NEW-TRASH-FROM-GALLERY-DROPS-FAILED-EDIT-01 (미카사 int-3 2b5ae01f8 실앱 · 지디 261110)
 *   증상: 저장 실패로 남은 편집이 있는 프로젝트를 휴지통에 보내면 비상 사본 0 · LS 도 지워져 다음 실행 복구 제안에 없음 = 편집 소실.
 *   길 둘을 다 잰다(지디 발주 ①):
 *   ── 편집기 창 길(save-load.js flushProjectBeforeTrash · main 이 옮기기 전에 부른다) ──
 *     옛: «보는 탭»이면 판 검사 없이 지금 본으로 다시 썼다 — TRASH-FLUSH 의 «실패 편집은 비상 사본» 갈래가 옆 탭에만 있었다.
 *     E1 ★보는 탭 · 마지막 저장 실패 · 파일이 밖에서 새로워짐 → 새 파일 안 덮음 + 실패 편집은 비상 사본 1
 *     E2 [대조] 보는 탭 · 실패 · 밖에서 안 바뀜 → 다시 써서 편집이 파일(휴지통 묶음)로 · 사본 0 (옛 동작과 같음)
 *     E3 ★그 다시 쓰기도 실패 → 비상 사본 1
 *     N1 [음성] 보는 탭 · 저장 실패 없음(밀린 편집만) → 옛대로 파일로 내림 · 사본 0
 *     U1 [적대 리뷰 2] 떠날 때 sync 저장이 실패(main 이 그 자리에서 사본·기록 at 을 씀) → LS 본 시각(_ts) ≤ 그 at — 옛 판은 LS 시각을 «뒤에» 찍어 at < _ts 라
 *        «사본 ≥ LS 본» 규칙(부팅 정리 · G4)이 같은 편집을 또 남겼다
 *   ── 갤러리 ✕ 길(pages/projects.html — 진짜 페이지 · 진짜 ✕ 클릭 · main 은 가짜: 진짜 main 처럼 «옮기기 전 flushProjectBeforeTrash → 옮김 → closeDeletedProjectTab») ──
 *     옛: 갤러리엔 flushProjectBeforeTrash 가 없어 아무도 사본을 안 남겼고, closeDeletedProjectTab 이 LS 를 지웠다.
 *     G1 ★실패 표지(web-editor-failed-save-ids)에 있는 프로젝트 → 비상 사본 1(LS 본 그대로 · 이름·사유) · 옮긴 뒤 LS 는 지워짐(사본이 있으니 잃음 0)
 *     G2 [음성] 실패 표지에 없는 프로젝트(저장 잘 된 LS 본) → 사본 0
 *     G3 사본도 못 남김(record ok:false) → 말한다(상태 토스트)
 *     G4 [적대 리뷰 1] 그 편집의 사본이 이미 있다(복구 대기 · LS 본보다 새롭거나 같음) → 또 안 남긴다(5칸을 나눠 쓰는 남의 사본을 안 민다) · 사본이 LS 보다 낡았으면 남긴다
 * 판 = 섹션 셋 · 글 · 그림 둘(trash-flush-stale-cache 와 같은 꼴). 휴지통 «옮기기»는 main 몫이라 가짜 표로만.
 * 양성대조(지디 인텔): ⒜ js/io/save-load.js flushProjectBeforeTrash 의 `if (_active && !_lastSaveFailed(id)) {` 를 `if (_active) {` 로 → E1·E3 빨강 · E2·N1 초록
 *   ⒝ pages/projects.html window.flushProjectBeforeTrash 첫 줄 `return;` → G1·G3 빨강 · G2 초록 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const A = 'proj_tga', B = 'proj_tgb';
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const EDIT = 'TG-EDIT-실패한-편집';
const NEWER = 'TG-NEWER-밖에서-새로';

/* ═════════ 편집기 창 길 ═════════ */
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setupEditor(page) {
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
    for (const [id, f] of files) { f.updatedAt = f.updatedAt || '2026-11-01T00:00:00.000Z'; localStorage.setItem('web-editor-ls-base__' + id, String(f.updatedAt)); }
    window.__files = files; window.__kept = []; window.__refuse = null;
    Object.assign(window.__fake, {
      loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id) || null)),
      saveProject: async (p) => {
        if (window.__refuse) return { ok: false, reason: window.__refuse };
        files.set(p.id, JSON.parse(JSON.stringify(p))); if (p.updatedAt != null) localStorage.setItem('web-editor-ls-base__' + p.id, String(p.updatedAt)); return { ok: true };   // preload _noteFileVersion 흉내
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
const editA = (page) => page.evaluate((EDIT) => { const s = document.querySelector('#canvas .section-block'); window.selectSection?.(s); window.addTextBlock('h2', { content: EDIT }); }, EDIT);
const keptA = (page) => page.evaluate((A) => window.__kept.filter(k => k.id === A), A);
const fileA = (page) => page.evaluate((A) => JSON.stringify(window.__files.get(A)), A);
/* 보는 탭 A 를 편집 → 그 저장이 거절(실패로 끝남) */
async function failActive(page) {
  await editA(page);
  await page.evaluate(() => { window.__refuse = 'disk_full'; });
  await page.evaluate((A) => window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: A }), A);
  await page.waitForFunction((A) => window.projectLastSaveFailed(A), A);
  expect(await page.evaluate(() => window.activeProjectId), '[전제] A 가 보는 탭').toBe(A);
}
const outsideNewer = (page) => page.evaluate(([A, NEWER]) => {
  const f = JSON.parse(JSON.stringify(window.__files.get(A)));
  f.pages[0].canvas = f.pages[0].canvas.replace(A + ' 제목', NEWER); f.updatedAt = new Date(Date.now() + 60000).toISOString();
  window.__files.set(A, f);
}, [A, NEWER]);

test('E1 ★보는 탭 · 저장 실패 · 밖에서 새로워짐 → 새 파일 안 덮음 + 실패 편집은 비상 사본', async ({ page }) => {
  const errs = await setupEditor(page);
  await failActive(page);
  await page.evaluate(() => { window.__refuse = null; });
  await outsideNewer(page);
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  const f = await fileA(page);
  expect(f, '★보는 탭 본이 밖에서 새로워진 파일을 덮었다').toContain(NEWER);
  expect(f).not.toContain(EDIT);
  const k = await keptA(page);
  expect(k.length, '★실패한 편집이 어디에도 안 남았다').toBe(1);
  expect(k[0].body).toContain(EDIT);
  expect(errs).toEqual([]);
});
test('E2 [대조] 보는 탭 · 실패 · 밖에서 안 바뀜 → 다시 써서 편집이 파일로 · 사본 0', async ({ page }) => {
  const errs = await setupEditor(page);
  await failActive(page);
  await page.evaluate(() => { window.__refuse = null; });
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  expect(await fileA(page)).toContain(EDIT);
  expect(await keptA(page)).toEqual([]);
  expect(errs).toEqual([]);
});
test('E3 ★보는 탭 · 실패 · 다시 쓰기도 실패 → 비상 사본', async ({ page }) => {
  const errs = await setupEditor(page);
  await failActive(page);   // __refuse 그대로 — 다시 쓰기도 거절
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  const k = await keptA(page);
  expect(k.length, '★다시 쓰기 실패인데 사본이 없다').toBe(1);
  expect(k[0].body).toContain(EDIT);
  expect(errs).toEqual([]);
});
test('N1 [음성] 보는 탭 · 저장 실패 없음(밀린 편집만) → 파일로 내림 · 사본 0', async ({ page }) => {
  const errs = await setupEditor(page);
  await editA(page);
  await page.evaluate((A) => window.flushProjectBeforeTrash(A), A);
  expect(await fileA(page)).toContain(EDIT);
  expect(await keptA(page)).toEqual([]);
  expect(errs).toEqual([]);
});

test('U1 떠날 때 sync 저장 실패 — LS 본 시각이 main 의 사본 기록 시각보다 늦지 않다(같은 본을 «더 새 LS»로 안 읽게)', async ({ page }) => {
  const errs = await setupEditor(page);
  await editA(page);
  const r = await page.evaluate((A) => {
    /* main _recordSyncSaveFailure 흉내 — 실패한 그 자리에서 기록 시각을 찍는다 */
    window.__fake.saveProjectSync = (p) => { window.__syncAt = Date.now(); const t = Date.now(); while (Date.now() - t < 5) {} return { ok: false, reason: 'disk_full' }; };
    window.dispatchEvent(new Event('beforeunload'));
    return { at: window.__syncAt, ts: parseInt(localStorage.getItem('web-editor-autosave__' + A + '_ts') || '0'), hasBody: !!localStorage.getItem('web-editor-autosave__' + A) };
  }, A);
  expect(r.hasBody, '[전제] LS 본이 남았다').toBe(true);
  expect(r.at, '[전제] sync 저장이 불렸다').toBeTruthy();
  expect(r.ts <= r.at, `★LS 시각 ${r.ts} 가 사본 기록 ${r.at} 보다 늦다 — 같은 본을 «사본보다 새 LS»로 읽어 또 남긴다`).toBe(true);
  expect(errs).toEqual([]);
});

/* ═════════ 갤러리 ✕ 길 ═════════ */
const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function installGalleryMock({ A, recordOk, pending }) {
  window.__kept = []; window.__trashed = []; window.__closed = [];
  const db = { projects: [{ id: A, name: '갤러리 지울 것', updatedAt: new Date().toISOString(), folderId: null }, { id: 'proj_keep', name: '남길 것', updatedAt: new Date().toISOString(), folderId: null }] };
  const api = {
    isElectron: true,
    listProjects: async () => db.projects.map(p => ({ ...p })),
    trashList: async () => ({ ok: true, items: [] }),
    getAuthState: async () => ({ signedIn: false }),
    folders: { list: async () => ({ ok: true, folders: [] }) },
    recovery: { pending: async () => ({ ok: true, items: pending || [] }), ack: async () => ({ ok: true }) },
    recordRefusedSave: async (p, reason) => { window.__kept.push({ id: p.id, name: p.name, reason, body: JSON.stringify(p) }); return recordOk ? { ok: true } : { ok: false, reason: 'exception' }; },
    /* 진짜 main(projects:delete · 휴지통 갈래)의 순서 그대로: 모든 창에 flushProjectBeforeTrash → 옮김 → 모든 창에 closeDeletedProjectTab */
    deleteProject: async (id) => {
      await window.flushProjectBeforeTrash?.(id);
      db.projects = db.projects.filter(p => p.id !== id); window.__trashed.push(id);
      window.__closed.push(await window.closeDeletedProjectTab?.(id));
      return { ok: true, trashed: true, appTrash: true, projectId: id };
    },
  };
  window.electronAPI = new Proxy(api, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
}
async function bootGallery(page, { failed = true, recordOk = true, pending = [], lsTs = Date.now() } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('dialog', (d) => d.accept());   // 「휴지통으로 보낼까요?」 확인
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.addInitScript(installGalleryMock, { A, recordOk, pending });
  /* 편집기가 남긴 상태 — 저장 실패로 LS 에만 있는 본(섹션 셋 · 글 · 그림 둘) + 실패 표지 + 열린 탭 목록 */
  const body = { id: A, name: '갤러리 지울 것', version: 2, currentPageId: 'page_1', updatedAt: '2026-11-10T00:00:00.000Z',
    pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas:
      `<div class="section-block" data-section="1"><div class="section-inner"><div class="text-block"><div class="tb-h2">${EDIT}</div></div></div></div>`
      + `<div class="section-block" data-section="2"><div class="section-inner"><div class="asset-block has-image" data-img-src="${RED}"><img class="asset-img" src="${RED}"></div></div></div>`
      + `<div class="section-block" data-section="3"><div class="section-inner"><div class="text-block"><div class="tb-body">본문</div></div><div class="asset-block has-image" data-img-src="${HALF}"><img class="asset-img" src="${HALF}"></div></div></div>` }] };
  const kv = {
    [`web-editor-autosave__${A}`]: JSON.stringify(body), [`web-editor-autosave__${A}_ts`]: String(lsTs),
    'web-editor-open-tabs': JSON.stringify({ tabs: [{ id: A, name: '갤러리 지울 것' }], activeId: A }),
    ...(failed ? { 'web-editor-failed-save-ids': JSON.stringify([A]) } : {}),
  };
  await page.addInitScript((kv) => { if (!sessionStorage.getItem('__lsinit')) { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); sessionStorage.setItem('__lsinit', '1'); } }, kv);
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForSelector(`#project-grid .project-card[data-id="${A}"]`);
  return errs;
}
async function clickX(page) {
  const card = page.locator(`#project-grid .project-card[data-id="${A}"]`);
  await card.hover();
  await card.locator('.card-delete').click();
  await page.waitForFunction((A) => window.__trashed.includes(A), A);
}
const gstate = (page) => page.evaluate((A) => ({ kept: window.__kept, ls: localStorage.getItem('web-editor-autosave__' + A), closed: window.__closed, toast: document.body.innerText.includes('비상 사본으로 남기지 못했습니다') }), A);

test('G1 ★갤러리 ✕ — 저장 실패로 LS 에만 남은 편집이 비상 사본으로 남는다(옮긴 뒤 LS 는 지워져도 잃음 0)', async ({ page }) => {
  const errs = await bootGallery(page);
  await clickX(page);
  const s = await gstate(page);
  expect(s.kept.length, '★실패한 편집이 사본 없이 휴지통으로 갔다').toBe(1);
  expect(s.kept[0].id).toBe(A);
  expect(s.kept[0].body).toContain(EDIT);
  expect(s.kept[0].name).toBe('갤러리 지울 것');
  expect(s.kept[0].reason).toBe('save-failed');
  expect(s.closed, '[전제] main 처럼 탭 닫기까지 돌았다').toEqual([true]);
  expect(s.ls, '옮긴 뒤 LS 는 지워진다(옛 동작 그대로 — 사본이 있으니 괜찮다)').toBeNull();
  expect(errs).toEqual([]);
});
test('G2 [음성] 실패 표지에 없는 프로젝트 → 사본 0', async ({ page }) => {
  const errs = await bootGallery(page, { failed: false });
  await clickX(page);
  expect((await gstate(page)).kept).toEqual([]);
  expect(errs).toEqual([]);
});
test('G3 사본도 못 남기면 말한다', async ({ page }) => {
  const errs = await bootGallery(page, { recordOk: false });
  await clickX(page);
  await expect.poll(async () => (await gstate(page)).toast, '★사본을 못 남겼는데 말이 없다').toBe(true);
  expect(errs).toEqual([]);
});

test('G4 이미 남은 사본(LS 본보다 새롭거나 같음)이면 또 안 남긴다 · 사본이 LS 보다 낡았으면 남긴다', async ({ page, browser }) => {
  const lsTs = Date.parse('2026-11-10T09:00:00.000Z');
  const item = (at) => ({ id: 'rec1', kind: 'save-failure', projectId: A, projectName: '갤러리 지울 것', at, emergencyExists: true, emergencyPath: '/tmp/x.json' });
  const errs = await bootGallery(page, { lsTs, pending: [item('2026-11-10T09:00:05.000Z')] });
  await clickX(page);
  expect((await gstate(page)).kept, '★이미 사본이 있는데 또 남겨 5칸을 민다').toEqual([]);
  expect(errs).toEqual([]);
  /* 반대쪽 — 사본이 LS 본보다 낡았다(그 뒤 편집이 더 있다) → 남긴다 */
  const ctx = await browser.newContext(); const p2 = await ctx.newPage();
  const errs2 = await bootGallery(p2, { lsTs, pending: [item('2026-11-10T08:00:00.000Z')] });
  await clickX(p2);
  expect((await gstate(p2)).kept.length).toBe(1);
  expect(errs2).toEqual([]);
  await ctx.close();
});
