/* refused-save-close-tab — 저장이 거절된 탭을 닫아도 그 편집이 마커·비상 사본으로 남는다 (REFUSED-SAVE-THEN-CLOSE-TAB-EDIT-LOST-01)
 * 왜: 거절된 본은 LS 에만 남았다. 탭을 닫으면 종료 flush·beforeunload 가 그 id 를 안 보고, 기획 id 는 목록에 없어
 *   다음 부팅의 고아 정리(cleanStaleAutosaveKeys)가 LS 를 지웠다 — 앱 L1 C17 ×1: 마커·비상본 없음 · 재시작 LS 0.
 * 자: 렌더러가 main 에 넘기는 recordRefusedSave 호출(가짜 API 기록). 마커·비상 사본 파일 쓰기는 main(_recordSyncSaveFailure) 몫 — 여기선 안 잰다.
 * 칸: R1 옆 탭으로 간 뒤 거절된 탭 닫기 · R2 활성 탭 닫기(떠나는 저장이 거절됨) · R3 사유 셋(깨진 원본·모르는 새 사유·예외) · R6 자동저장이 바로 거절된 활성 탭 닫기 · R7 닫고 종료 — 한 번만 남김 · R8 같은 실패 한 번만 · R9 사본 실패면 다시 · R10 던진 저장도 실패
 *     R4 [음성] 저장이 성공한 탭 닫기 — 남기지 않는다 · R5 [음성] 빈 캔버스 보호 스킵은 실패가 아니다.
 * 픽스처: 섹션 셋 · 글 블럭 · 그림 블럭 둘(서로 다른 PNG). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [A, B] = ['proj_rsa', 'proj_rsb'];
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const EDIT = 'RS-EDIT-몰래-쓴-줄';

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
    window.__files = files; window.__kept = []; window.__refuse = null;
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

async function refuseThenCloseInactive(page, reason) {
  await editA(page);
  await page.evaluate((r) => { window.__refuse = r; }, reason);
  await page.evaluate((B) => window.switchTab(B), B);   // 떠나는 A 저장이 거절된다
  await idle(page);
  await page.evaluate((A) => window.closeTab(A), A);
}

test('R1 옆 탭으로 간 뒤 거절된 탭을 닫으면 그 본이 남는다', async ({ page }) => {
  const errs = await setup(page);
  await refuseThenCloseInactive(page, 'planning_not_editor');
  await expect.poll(() => keptA(page).then(k => k.length), { message: '★거절된 편집이 남지 않았다(LS 뿐)' }).toBe(1);
  const [k] = await keptA(page);
  expect(k.reason).toBe('planning_not_editor');
  expect(k.name).toBe(A);
  expect(k.body, '★남긴 본에 그 편집이 없다').toContain(EDIT);
  expect(k.body, '★그림이 빠졌다').toContain(RED.slice(-24));
  expect(k.body, '★그림이 빠졌다').toContain(HALF.slice(-24));
  expect((k.body.match(/section-block/g) || []).length, '★섹션이 줄었다').toBeGreaterThanOrEqual(3);
  expect(errs).toEqual([]);
});

test('R2 활성 탭을 닫아 떠나는 저장이 거절돼도 그 본이 남는다', async ({ page }) => {
  const errs = await setup(page);
  await editA(page);
  await page.evaluate(() => { window.__refuse = 'planning_not_editor'; });
  await page.evaluate((A) => window.closeTab(A), A);
  await expect.poll(() => keptA(page).then(k => k.length), { message: '★거절된 편집이 남지 않았다' }).toBe(1);
  expect((await keptA(page))[0].body).toContain(EDIT);
  expect(await page.evaluate((A) => window.openTabs.some(t => t.id === A), A), '탭이 안 닫혔다').toBe(false);
  expect(errs).toEqual([]);
});

for (const reason of ['unreadable_not_preserved', 'ls_copy_folder_returned', 'throw']) {
  test(`R3 거절 사유와 상관없다 — ${reason}`, async ({ page }) => {
    await setup(page);
    await refuseThenCloseInactive(page, reason);
    await expect.poll(() => keptA(page).then(k => k.length), { message: `★${reason} 거절 뒤 남지 않았다` }).toBe(1);
    const [k] = await keptA(page);
    expect(k.body).toContain(EDIT);
    expect(k.reason).toBe(reason === 'throw' ? 'exception' : reason);
  });
}

test('R4 [음성] 저장이 성공한 탭을 닫으면 남기지 않는다', async ({ page }) => {
  const errs = await setup(page);
  await refuseThenCloseInactive(page, null);
  await page.waitForTimeout(300);
  expect(await keptA(page), '★성공한 저장에 비상 사본을 만들었다').toEqual([]);
  expect(await page.evaluate((A) => window.__files.get(A).pages[0].canvas.includes('RS-EDIT'), A)).toBe(true);
  expect(errs).toEqual([]);
});

test('R5 [음성] 빈 캔버스 보호 스킵은 실패가 아니다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.__refuse = 'planning_not_editor'; });
  await page.evaluate((A) => window.saveProjectToFile(JSON.stringify({ version: 2, currentPageId: 'x', pages: [{ id: 'x', name: 'P', pageSettings: {}, canvas: '' }] }), { skipThumbnail: true, projectId: A }), A);
  await page.evaluate((B) => window.switchTab(B), B);   // 무편집 — 떠나는 저장 없음
  await idle(page);
  await page.evaluate((A) => window.closeTab(A), A);
  await page.waitForTimeout(300);
  expect(await keptA(page)).toEqual([]);
});

/* eng-save 대조 spec(handoff/eng-save-refused-repro) 에서 가져온 두 칸 — 그쪽은 종료 flush 에서 내리는 길을 잰다 */
test('R6 활성 탭에서 자동저장이 바로 거절된 뒤 그 탭을 닫아도 남는다', async ({ page }) => {
  const errs = await setup(page);
  await editA(page);
  await page.evaluate(async (A) => {
    window.__refuse = 'planning_not_editor';
    await window.saveProjectToFile(JSON.parse(window.serializeProject()), { skipThumbnail: true });
    await window.closeTab(A);
  }, A);
  const k = await keptA(page);
  expect(k.length, '★거절된 편집이 남지 않았다').toBe(1);
  expect(k[0].body).toContain(EDIT);
  expect(errs).toEqual([]);
});

test('R7 거절된 탭을 닫고 종료 — 닫을 때 한 번만 남기고 종료는 그 프로젝트를 다시 안 쓴다', async ({ page }) => {
  const errs = await setup(page);
  await refuseThenCloseInactive(page, 'planning_not_editor');
  const sync = [];
  await page.exposeBinding('__sync', (_s, id) => { sync.push(id); });
  await page.evaluate(() => { window.__fake.saveProjectSync = (p) => { window.__sync(p.id); return { ok: true }; }; });
  const a = await page.evaluate(async () => { window.__quit(); await new Promise((r) => { const iv = setInterval(() => { if (window.__answer) { clearInterval(iv); r(); } }, 20); }); return window.__answer; });
  expect(await keptA(page).then(k => k.length), '★두 번 남겼거나 안 남겼다').toBe(1);
  expect(sync.filter(id => id === A), '닫은 탭을 종료가 다시 썼다').toEqual([]);
  expect(a.projectId ?? null, '종료 답이 닫은 탭을 말한다').not.toBe(A);
  expect(errs).toEqual([]);
});

/* 리뷰 1라운드 1번: 비상 사본은 5칸을 모든 프로젝트가 나눠 쓴다 — 같은 실패를 닫을 때마다 새로 남기면 남의 사본을 밀어낸다 */
test('R8 같은 실패는 한 번만 남긴다 — 무편집으로 다시 열고 닫으면 안 남기고, 새 편집이 또 거절되면 남긴다', async ({ page }) => {
  const errs = await setup(page);
  await refuseThenCloseInactive(page, 'planning_not_editor');
  await expect.poll(() => keptA(page).then(k => k.length)).toBe(1);
  await page.evaluate((A) => window.openTabForProject(A), A);
  await page.waitForFunction((A) => window.activeProjectId === A && !window.hasUnsavedChanges(), A);
  await page.evaluate((A) => window.closeTab(A), A);
  await idle(page);
  expect(await keptA(page).then(k => k.length), '★같은 실패를 또 남겼다').toBe(1);
  await page.evaluate((A) => window.openTabForProject(A), A);
  await page.waitForFunction((A) => window.activeProjectId === A, A);
  await editA(page);
  await page.evaluate((A) => window.closeTab(A), A);
  await expect.poll(() => keptA(page).then(k => k.length), { message: '★새로 거절된 편집을 안 남겼다' }).toBe(2);
  expect(errs).toEqual([]);
});

/* 리뷰 2라운드 1·2번 */
test('R9 사본을 못 남겼으면(답 ok:false) 남긴 것으로 치지 않는다 — 다음 닫기가 다시 한다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { const f = window.__fake.recordRefusedSave; let n = 0; window.__fake.recordRefusedSave = (p, r) => (++n === 1 ? (window.__kept.push({ id: p.id, failed: true }), { ok: false }) : f(p, r)); });
  await refuseThenCloseInactive(page, 'unreadable_not_preserved');
  await expect.poll(() => keptA(page).then(k => k.length)).toBe(1);
  await page.evaluate((A) => window.openTabForProject(A), A);
  await page.waitForFunction((A) => window.activeProjectId === A && !window.hasUnsavedChanges(), A);
  await page.evaluate((A) => window.closeTab(A), A);
  await expect.poll(() => keptA(page).then(k => k.filter(x => !x.failed).length), { message: '★사본 실패 뒤 다시 남기지 않았다' }).toBe(1);
});
test('R10 저장이 던져 결과가 없어도 실패로 친다(썸네일 앞 대기가 던짐)', async ({ page }) => {
  await setup(page);
  await page.evaluate((B) => window.switchTab(B), B);   // 무편집 — A 는 옆 탭 · 캐시 있음
  await idle(page);
  await page.evaluate(async (A) => {
    window.whenGridRatiosSettled = () => { throw new Error('던짐 흉내'); };
    await window.saveProjectToFile(window.openTabs.find(t => t.id === A)._cache, { projectId: A }).catch(() => {});
    delete window.whenGridRatiosSettled;
  }, A);
  expect(await page.evaluate((A) => window.projectSaveUnsettled(A), A), '★결과 없음을 미저장으로 안 센다(닫기 알림·beforeunload 가 같은 판정)').toBe(true);
  await page.evaluate((A) => window.closeTab(A), A);
  await expect.poll(() => keptA(page).then(k => k.length), { message: '★던진 저장 뒤 남지 않았다' }).toBe(1);
});
