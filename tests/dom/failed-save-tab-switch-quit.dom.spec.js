/* failed-save-tab-switch-quit — 저장이 실패한 탭을 닫지 않고 옆 탭으로만 옮긴 채 종료해도 그 편집을 잃지 않는다 (FAILED-SAVE-TAB-SWITCH-THEN-QUIT-ORPHAN-LS-01)
 * 왜: 종료 flush 는 줄(_pendingSaves)·진행 중 저장만 봐서 옆 탭의 실패 본을 안 내렸고, 기획 id 는 목록에 없어
 *   다음 부팅 고아 정리(cleanStaleAutosaveKeys)가 LS 본을 지웠다 — DOM 재기 1회(인텔 9e1f79d6 · [M1] LS 319 → 0 · 탭 [B] 만).
 * 자: 렌더러가 부르는 recordRefusedSave·saveProjectSync(가짜 API 기록 — 비상 사본·마커 파일은 main 몫) · 종료 답 · LS 키.
 * 칸: T1 옆 탭 실패 본이 종료 때 비상 사본으로 남고 파일엔 안 씀(지디 결정 ②) · T2 권한이 돌아와도 파일엔 안 쓰고 사본(복구 제안 몫) · T11 밖에서 바뀐 파일을 안 덮음
 *     T3 종료 답 뒤 beforeunload 의 두 번째 flush 는 같은 본을 다시 안 남긴다 · T4 [음성] 저장이 성공한 옆 탭은 안 쓴다
 *     T5 부팅 고아 정리가 실패 표지 id 의 LS 본을 남긴다 · T6 [음성] 표지 없는 목록 밖 id 는 그대로 지운다(다른 갈래 무접촉)
 *     T7 지운 프로젝트는 표지가 있어도 정리·표지 걷힘(지디 ㉠) · T8 표지 목록이 깨졌으면 옛 동작(지디 ㉡)
 *     T9 다른 계정 본의 표지는 안 걷음 · T10 연 채 지운 탭 닫기가 표지를 걷음
 *     T12 LS 보다 새 비상 사본 있으면 보호 풂(⒝) · T13 못 물으면 보호 유지 · T14 낡은 사본이면 보호 유지
 * 픽스처: 섹션 셋 · 글 블럭 · 그림 블럭 둘. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [A, B] = ['proj_tsa', 'proj_tsb'];
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const EDIT = 'TS-EDIT-옆탭-편집';
const FAILED_KEY = 'web-editor-failed-save-ids';

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
    window.__files = files; window.__syncs = []; window.__refuse = null; window.__syncRefuse = null;
    Object.assign(window.__fake, {
      loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id) || null)),
      saveProject: async (p) => { if (window.__refuse && p.id === A) return { ok: false, reason: window.__refuse }; files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true }; },
      saveProjectSync: (p) => { window.__syncs.push({ id: p.id, body: JSON.stringify(p) }); if (window.__syncRefuse && p.id === A) return { ok: false, reason: window.__syncRefuse }; files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true }; },
      saveProjectMeta: async () => ({ ok: true }),
      recordRefusedSave: async (p, reason) => { window.__kept.push({ id: p.id, reason, body: JSON.stringify(p) }); return { ok: true }; },
    });
    window.__kept = [];
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
/* A 를 편집하고 떠난다 — 떠나는 저장의 끝을 직접 기다린다 */
async function editThenLeaveA(page, refuse) {
  await editA(page);
  await page.evaluate(async ([B, A, r]) => { window.__refuse = r; await window.switchTab(B); await window.waitSavesFor(A); }, [B, A, refuse]);
}
const quit = (page) => page.evaluate(async () => { window.__quit(); await new Promise((r) => { const iv = setInterval(() => { if (window.__answer) { clearInterval(iv); r(); } }, 20); }); return window.__answer; });
const syncA = (page) => page.evaluate((A) => window.__syncs.filter(s => s.id === A).map(s => s.body), A);
const failedIds = (page) => page.evaluate((K) => { try { return JSON.parse(localStorage.getItem(K)) || []; } catch { return null; } }, FAILED_KEY);

const keptA = (page) => page.evaluate((A) => window.__kept.filter(k => k.id === A), A);

test('T1 옆 탭의 실패 본이 종료 때 비상 사본으로 남고 파일에는 안 쓴다', async ({ page }) => {
  const errs = await setup(page);
  await editThenLeaveA(page, 'planning_not_editor');
  expect(await page.evaluate((A) => [window.activeProjectId, window.openTabs.some(t => t.id === A)], A), '[전제] A 는 옆 탭으로 열려 있다').toEqual([B, true]);
  const a = await quit(page);
  const k = await keptA(page);
  expect(k.length, '★옆 탭의 실패 본이 종료 때 어디에도 안 남았다').toBe(1);
  expect(k[0].reason).toBe('planning_not_editor');
  expect(k[0].body, '★남긴 본에 그 편집이 없다').toContain(EDIT);
  expect(k[0].body).toContain(RED.slice(-24));
  expect(k[0].body).toContain(HALF.slice(-24));
  expect(await syncA(page), '★옆 탭 캐시를 파일에 썼다(덮는 길)').toEqual([]);
  expect(a.ok, '활성 탭은 들어갔다 — 종료 답은 그 탭 몫').toBe(true);
  expect(errs).toEqual([]);
});

/* 옛 T2 는 «권한이 돌아오면 종료 때 파일로 들어감»이었다 — 지디 결정 ②(파일 안 씀)로 그 길은 다음 실행 복구 제안으로 옮겼다. 복구 제안은 main 이 마커를 읽어 띄운다. */
test('T2 권한이 돌아왔어도 종료는 파일에 안 쓰고 사본으로 — 복구 제안 몫', async ({ page }) => {
  const errs = await setup(page);
  await editThenLeaveA(page, 'exception');
  expect(await failedIds(page), '[전제] 실패 표지').toContain(A);
  await quit(page);
  expect((await keptA(page)).map(k => k.reason), '★사본이 안 남았다').toEqual(['exception']);
  expect(await syncA(page)).toEqual([]);
  expect(await page.evaluate((A) => JSON.stringify(window.__files.get(A)).includes('TS-EDIT'), A), '파일이 바뀌었다').toBe(false);
  expect(await failedIds(page), '사본만 남겼으니 표지는 그대로(다음 부팅이 사본 보고 푼다)').toContain(A);
  expect(errs).toEqual([]);
});

test('T3 종료 답 뒤 beforeunload 의 두 번째 flush 는 같은 본을 다시 안 남긴다', async ({ page }) => {
  await setup(page);
  await editThenLeaveA(page, 'planning_not_editor');
  await quit(page);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  expect((await keptA(page)).length, '★같은 실패 본을 두 번 남겨 비상 사본이 둘').toBe(1);
});

test('T4 [음성] 저장이 성공한 옆 탭은 종료 때 안 남긴다', async ({ page }) => {
  const errs = await setup(page);
  await editThenLeaveA(page, null);
  const a = await quit(page);
  expect(await keptA(page)).toEqual([]);
  expect(await syncA(page)).toEqual([]);
  expect(a.ok).toBe(true);
  expect(await failedIds(page)).not.toContain(A);
  expect(errs).toEqual([]);
});

test('T11 실패 뒤 파일이 밖에서 바뀌어도(다른 창·MCP·복원) 종료가 그 파일을 덮지 않는다 · 사본은 남는다', async ({ page }) => {
  const errs = await setup(page);
  await editThenLeaveA(page, 'exception');
  const outside = await page.evaluate((A) => { const f = JSON.parse(JSON.stringify(window.__files.get(A))); f.pages[0].canvas += '<div class="section-block" id="sec_outside"></div>'; f.updatedAt = new Date(Date.now() + 1000).toISOString(); window.__files.set(A, f); return JSON.stringify(f); }, A);
  await quit(page);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  expect(await page.evaluate((A) => JSON.stringify(window.__files.get(A)), A), '★밖에서 새로워진 파일을 덮었다').toBe(outside);
  expect(await syncA(page)).toEqual([]);
  expect((await keptA(page)).length, '★사본이 안 남았다').toBe(1);
  expect((await keptA(page))[0].body).toContain(EDIT);
  expect(errs).toEqual([]);
});

/* 부팅 고아 정리 — 다시 부팅(reload)해 실제 부팅 길로 잰다. 정리가 돌았다는 신호 = 목록에도 표지에도 없는 고아 Z 의 LS 가 지워짐(고정 대기 없음). */
const Z = 'proj_tsz';
async function bootWith(page, { failed, state = 'ok', corrupt = false, ownerA = 'legacy', pending = null }) {
  await page.addInitScript(([A, B, Z, K, failed, state, corrupt, ownerA, pending]) => {
    const proj = (id) => ({ id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}"><div class="section-inner"><div class="text-block" data-type="text"><div class="tb-h2">${id} 본문</div></div></div></div>` }] });
    const fake = {
      listProjects: async () => [{ id: B, name: B, type: null, updatedAt: new Date().toISOString() }],
      projectsRootKey: async () => 'legacy',
      projectFolderState: async (id) => (id === A ? state : 'ok'),   // A: ok = 폴더는 있고 목록에만 없음(기획) · trashed = 지움
      loadProject: async (id, o) => (id === B ? proj(B) : (o && o.open ? { _planning: true } : null)),
      /* 다음 실행 복구 제안(main recovery:pending) — copyNew: LS 보다 새 사본 · copyOld: LS 보다 낡은 사본 · throw: 못 물음 */
      recovery: { pending: async () => {
        if (pending === 'throw') throw new Error('IPC 실패 흉내');
        const lsTs = parseInt(localStorage.getItem('web-editor-autosave__' + A + '_ts') || '0');
        const at = pending === 'copyNew' ? lsTs + 5000 : pending === 'copyOld' ? lsTs - 60000 : null;
        return { ok: true, items: at ? [{ kind: 'save-failure', projectId: A, emergencyExists: true, at: new Date(at).toISOString() }] : [] };
      } },
    };
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
    if (!sessionStorage.getItem('__seeded')) {   // 첫 부팅은 씨만 — reload 뒤 부팅이 잰다
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('web-editor-open-tabs', JSON.stringify({ tabs: [{ id: A, name: A }, { id: B, name: B }], activeId: B }));
      for (const id of [A, Z]) {
        localStorage.setItem('web-editor-autosave__' + id, JSON.stringify(proj(id)));
        localStorage.setItem('web-editor-autosave__' + id + '_ts', String(Date.now()));
        localStorage.setItem('web-editor-ls-root__' + id, id === A ? ownerA : 'legacy');
      }
      if (corrupt) localStorage.setItem(K, '{깨짐');
      else if (failed) localStorage.setItem(K, JSON.stringify([A]));
    }
  }, [A, B, Z, FAILED_KEY, failed, state, corrupt, ownerA, pending]);
  await bootApp(page);
  await page.evaluate((B) => { history.replaceState(null, '', '?project=' + B); }, B);
  await page.reload();
  await page.waitForFunction((Z) => typeof window.rebindAll === 'function' && localStorage.getItem('web-editor-autosave__' + Z) === null, Z, { timeout: 15000 });
  return page.evaluate(([A, K]) => ({ ls: (localStorage.getItem('web-editor-autosave__' + A) || '').length, ids: localStorage.getItem(K) }), [A, FAILED_KEY]);
}
test('T5 부팅 고아 정리가 실패 표지 id 의 LS 본을 남긴다(폴더는 있고 목록에만 없음)', async ({ page }) => {
  const r = await bootWith(page, { failed: true });
  expect(r.ls, '★실패 표지 id 의 LS 본을 지웠다(편집을 잃음)').toBeGreaterThan(0);
  expect(JSON.parse(r.ids || '[]'), '표지가 걷혔다').toContain(A);
});
test('T6 [음성] 표지 없는 목록 밖 id 는 그대로 지운다(다른 갈래 무접촉)', async ({ page }) => {
  const r = await bootWith(page, { failed: false });
  expect(r.ls).toBe(0);
});
test('T7 지운 프로젝트(휴지통)는 표지가 있어도 정리되고 표지도 걷힌다', async ({ page }) => {
  const r = await bootWith(page, { failed: true, state: 'trashed' });
  expect(r.ls, '★지운 프로젝트의 본을 보호했다(목록이 쌓인다)').toBe(0);
  expect(r.ids, '★지운 프로젝트 표지가 남았다').toBe(null);
});
test('T8 표지 목록이 깨졌으면 옛 동작 — 보호 없이 정리', async ({ page }) => {
  const r = await bootWith(page, { failed: true, corrupt: true });
  expect(r.ls).toBe(0);
});
test('T9 다른 계정의 본은 이 계정 폴더 상태로 표지를 걷지 않는다(X→Y→X 에서 잃음 · 리뷰 1)', async ({ page }) => {
  const r = await bootWith(page, { failed: true, state: 'missing', ownerA: 'acct_x' });
  expect(r.ls, '다른 계정 본을 지웠다').toBeGreaterThan(0);
  expect(JSON.parse(r.ids || '[]'), '★다른 계정 본의 표지를 걷었다 — 그 계정으로 돌아가면 정리가 지운다').toContain(A);
});
test('T10 연 채 지운 프로젝트 탭을 닫으면 표지를 걷는다(지디 ㉠)', async ({ page }) => {
  await setup(page);
  await editThenLeaveA(page, 'planning_not_editor');
  expect(await failedIds(page), '[전제] 실패 표지').toContain(A);
  await page.evaluate((A) => window.closeDeletedProjectTab(A), A);
  expect(await failedIds(page), '★지운 프로젝트 표지가 남았다(목록이 쌓인다)').not.toContain(A);
});
test('T12 LS 본보다 새 비상 사본이 있으면 다음 부팅에 보호를 푼다(지디 결정 ⒝)', async ({ page }) => {
  const r = await bootWith(page, { failed: true, pending: 'copyNew' });
  expect(r.ls, '★사본이 있는데 LS 를 계속 잡았다').toBe(0);
  expect(r.ids, '★표지가 남아 쌓인다').toBe(null);
});
test('T13 복구 제안을 못 물으면 보호 유지(안전 쪽)', async ({ page }) => {
  const r = await bootWith(page, { failed: true, pending: 'throw' });
  expect(r.ls, '★못 물었는데 LS 를 지웠다').toBeGreaterThan(0);
  expect(JSON.parse(r.ids || '[]')).toContain(A);
});
test('T14 사본이 LS 본보다 낡았으면 보호 유지 — 새 편집은 LS 에만 있다', async ({ page }) => {
  const r = await bootWith(page, { failed: true, pending: 'copyOld' });
  expect(r.ls, '★낡은 사본만 보고 새 편집이 든 LS 를 지웠다').toBeGreaterThan(0);
});
