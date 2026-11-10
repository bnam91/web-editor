/* flush-r21b-save-delete-switch-quit — FLUSH-EMPTY-QUEUE-SKIPS-INFLIGHT-01 미카사 실앱 손순서(int-3 2b5ae01f8 · 2/2 ❌ · 261110)
 *   제목에 «R21b» 입력 → ⌘S → 섹션 전체 삭제 → 0.15초 뒤 옆 탭 → 0.4초 뒤 종료 = 파일은 그 이전 판 · R21b 는 파일·LS·비상 사본 어디에도 없음 · 콘솔 «빈 canvas … 건너뜀».
 *   뿌리(코드 읽기): ⌘S(editor.js)가 즉시 저장이 아니라 triggerAutoSave(= scheduleAutoSave 디바운스 «예약» 최대 1.5초)였고 토스트는 바로 «저장됨».
 *     예약이 서기 전 전체 삭제가 그 예약을 빈 본으로 바꿔 «빈 canvas 건너뜀» · 탭 전환은 지금(빈) 본이라 건너뜀 · 예약 타이머는 «탭 전환 감지»로 건너뜀 · 종료 flush 엔 줄 0.
 *   R1 ★손순서 그대로(진짜 ⌘S 키 · 0.15초 · 0.4초) → 종료 뒤 파일에 R21b 가 있다(⌘S 가 쓴 판)
 *   R2 ⌘S 의 «저장됨» 토스트는 파일에 쓴 «뒤»에만 — 저장 거절이면 안 뜬다(거짓 「저장됨」 0)
 *   R3 [리뷰 1 ⓐ] 큰 본(LS 가 못 받는 크기)이어도 ⌘S 가 파일까지 간다 — 옛 flushSave 의 날 setItem 이 던져 파일 저장 전에 끝났다
 *   R4 [리뷰 1 ⓑ] ⌘S 성공 뒤 gd:project-saved 한 번(협업 공유 — 타이머 길과 같은 꼴) · 실패면 0
 *   R5 [지디 ③] 되돌림 봉인 중 ⌘S = 안 쓴다 · «저장됨» 안 띄움
 *   R6 [FLUSH-SAVE-STATUS-STUCK-SAVING-01 · 미카사 실앱] 저장이 막힌(거절) ⌘S → 상태줄 «⚠️ 저장 실패»(타이머 길과 같음) — 이 가지 245e8b158~b9833e45d 는 «저장 중...»에 멈췄다
 *   R7 같은 꼴 · 빈 캔버스 ⌘S(빈 본 건너뜀) → «저장 중...»에 안 멈춤(타이머 길처럼 걷음)
 *   N1 [음성] ⌘S 없이 편집 → 전체 삭제 → 탭 → 종료: 파일은 그 이전 판(빈 본 보호 S11 그대로 — 이 고침 밖)
 *   ⚠️전체 삭제 = 섹션을 다 빼고 scheduleAutoSave(삭제 길이 끝에 하는 일) — deleteSection 은 마지막 하나를 안 지워 손 삭제를 그대로 못 탄다(실앱은 ⌘A·Delete).
 * 양성대조(지디 인텔): js/editor.js ⌘S 갈래의 `Promise.resolve(window.flushSave?.())` 를 옛 `window.triggerAutoSave?.(); Promise.resolve()` 로 → R1 빨강 · N1 초록.
 * 판 = 섹션 셋 · 글 · 그림 둘(trash-flush-stale-cache 와 같은 꼴). 교차(지디 매니저 요청): 워커1 MISSING 가지 판에서 이 R1 도 돌린다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [A, B] = ['proj_r21a', 'proj_r21b'];
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const MARK = 'R21b';

const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
const pause = (page, ms) => page.evaluate((ms) => new Promise(r => setTimeout(r, ms)), ms);   // 사람 손 간격(실앱 손순서의 0.15초·0.4초) — 기다림이 아니라 «재현 조건»이다
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
    for (const [id, f] of files) { f.updatedAt = '2026-11-01T00:00:00.000Z'; localStorage.setItem('web-editor-ls-base__' + id, f.updatedAt); }
    window.__files = files; window.__kept = []; window.__refuse = null;
    Object.assign(window.__fake, {
      loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id) || null)),
      /* 실앱처럼 쓰기에 시간이 든다(30ms) — 즉시 끝나는 가짜면 경합이 안 보인다 */
      saveProject: async (p) => { await new Promise(r => setTimeout(r, 30)); if (window.__refuse) return { ok: false, reason: window.__refuse };
        files.set(p.id, JSON.parse(JSON.stringify(p))); if (p.updatedAt != null) localStorage.setItem('web-editor-ls-base__' + p.id, String(p.updatedAt)); return { ok: true }; },
      saveProjectSync: (p) => { if (window.__refuse) return { ok: false, reason: window.__refuse }; files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true }; },
      recordRefusedSave: (p, reason) => { window.__kept.push({ id: p.id, reason, body: JSON.stringify(p) }); return { ok: true }; },
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
/* 제목에 R21b 입력 — 첫 글 블럭의 글을 바꾸고 편집 길이 하는 일(scheduleAutoSave) */
const typeTitle = (page) => page.evaluate((MARK) => { const t = document.querySelector('#canvas .tb-h2'); t.textContent = MARK + ' 제목'; window.scheduleAutoSave(); }, MARK);
const deleteAll = (page) => page.evaluate(() => { document.querySelectorAll('#canvas .section-block').forEach(s => s.remove()); window.scheduleAutoSave(); });
const quit = (page) => page.evaluate(async () => { window.__answer = null; window.__quit(); await new Promise((r) => { const iv = setInterval(() => { if (window.__answer) { clearInterval(iv); r(); } }, 20); }); return window.__answer; });
const where = (page) => page.evaluate(([A, MARK]) => ({
  file: JSON.stringify(window.__files.get(A)).includes(MARK),
  ls: (localStorage.getItem('web-editor-autosave__' + A) || '').includes(MARK),
  kept: window.__kept.some(k => k.id === A && k.body.includes(MARK)),
  toast: document.getElementById('editor-toast')?.textContent || '',
}), [A, MARK]);
async function cmdS(page) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+s'); }

test('R1 ★R21b 입력 → ⌘S → 전체 삭제 → 0.15초 탭 → 0.4초 종료 — 파일에 ⌘S 판(R21b)이 있다', async ({ page }) => {
  const errs = await setup(page);
  await typeTitle(page);
  await cmdS(page);
  await deleteAll(page);
  await pause(page, 150);
  await page.evaluate((B) => { window.switchTab(B); }, B);
  await pause(page, 400);
  await quit(page);
  const w = await where(page);
  console.log('R21BROW R1 ' + JSON.stringify(w));
  expect(w.file, `★⌘S 한 편집(R21b)이 파일에 없다 — LS ${w.ls} · 비상 사본 ${w.kept}`).toBe(true);
  expect(errs).toEqual([]);
});

test('R2 ⌘S «저장됨» 토스트는 쓴 뒤에만 — 거절이면 안 뜬다', async ({ page }) => {
  const errs = await setup(page);
  await typeTitle(page);
  await page.evaluate(() => { window.__refuse = 'disk_full'; const t = document.getElementById('editor-toast'); if (t) t.textContent = ''; });
  await cmdS(page);
  await page.waitForFunction((A) => window.projectLastSaveFailed?.(A), A);
  await settle(page);
  expect((await where(page)).toast, '거절됐는데 «저장됨»').not.toContain('저장됨');
  await page.evaluate(() => { window.__refuse = null; const t = document.getElementById('editor-toast'); if (t) t.textContent = ''; });
  await cmdS(page);
  await expect.poll(async () => (await where(page)).toast).toContain('저장됨');
  expect((await where(page)).file, '«저장됨» 이면 파일에 있다').toBe(true);
  expect(errs).toEqual([]);
});

test('N1 [음성] ⌘S 없이 편집 → 전체 삭제 → 탭 → 종료: 파일은 이전 판(빈 본 보호 그대로)', async ({ page }) => {
  const errs = await setup(page);
  await typeTitle(page);
  await deleteAll(page);
  await pause(page, 150);
  await page.evaluate((B) => { window.switchTab(B); }, B);
  await pause(page, 400);
  await quit(page);
  const w = await where(page);
  console.log('R21BROW N1 ' + JSON.stringify(w));
  expect(await page.evaluate((A) => JSON.stringify(window.__files.get(A)).includes(A + ' 제목'), A), '이전 판 그대로').toBe(true);
  expect(errs).toEqual([]);
});

test('R3 큰 본이어도 ⌘S 가 파일까지 — LS 쓰기가 던져도', async ({ page }) => {
  const errs = await setup(page);
  await typeTitle(page);
  /* LS 가 이 본을 못 받는 꼴 — setItem 이 «autosave 본»에만 던진다(실앱 quota 흉내) */
  await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('web-editor-autosave__') && !String(k).endsWith('_ts')) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; });
  await cmdS(page);
  await expect.poll(async () => (await where(page)).file, '★LS 가 못 받자 파일 저장까지 안 갔다').toBe(true);
  expect(errs).toEqual([]);
});

test('R4 ⌘S 성공 뒤 gd:project-saved 한 번 · 실패면 0', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.__saved = []; window.addEventListener('gd:project-saved', (e) => window.__saved.push(e.detail?.projectId)); });
  await typeTitle(page);
  await cmdS(page);
  await expect.poll(() => page.evaluate(() => window.__saved.length)).toBeGreaterThan(0);
  expect(await page.evaluate((A) => window.__saved.every(id => id === A), A)).toBe(true);
  await page.evaluate(() => { window.__saved = []; window.__refuse = 'disk_full'; });
  await typeTitle(page);
  await cmdS(page);
  await page.waitForFunction((A) => window.projectLastSaveFailed?.(A), A);
  expect(await page.evaluate(() => window.__saved.length), '실패인데 공유를 쐈다').toBe(0);
  expect(errs).toEqual([]);
});

test('R5 되돌림 봉인 중 ⌘S = 안 쓴다 · «저장됨» 안 띄움', async ({ page }) => {
  const errs = await setup(page);
  await typeTitle(page);
  await page.evaluate((A) => window.cancelPendingAutoSaveForReload(A), A);
  await page.evaluate(() => { const t = document.getElementById('editor-toast'); if (t) t.textContent = ''; });
  await cmdS(page);
  await settle(page); await settle(page);
  const w = await where(page);
  expect(w.file, '봉인 중인데 썼다').toBe(false);
  expect(w.toast).not.toContain('저장됨');
  expect(errs).toEqual([]);
});

const indicator = (page) => page.evaluate(() => document.getElementById('autosave-indicator')?.textContent || '');

test('R6 저장 막힌 ⌘S → 상태줄 «⚠️ 저장 실패»(«저장 중...»에 안 멈춤)', async ({ page }) => {
  const errs = await setup(page);
  await typeTitle(page);
  await expect.poll(() => indicator(page), '[전제] 편집 뒤 «저장 중...»').toContain('저장 중');
  await page.evaluate(() => { window.__refuse = 'disk_full'; });
  await cmdS(page);
  await page.waitForFunction((A) => window.projectLastSaveFailed?.(A), A);
  await expect.poll(() => indicator(page), '★저장이 막혔는데 상태줄이 «저장 중...»에 멈췄다').toContain('저장 실패');
  expect(errs).toEqual([]);
});

test('R7 빈 캔버스 ⌘S(빈 본 건너뜀) → «저장 중...»에 안 멈춤', async ({ page }) => {
  const errs = await setup(page);
  await deleteAll(page);
  await expect.poll(() => indicator(page), '[전제] «저장 중...»').toContain('저장 중');
  await cmdS(page);
  await expect.poll(() => indicator(page), '★빈 본 건너뜀인데 «저장 중...»에 멈췄다').not.toContain('저장 중');
  expect(errs).toEqual([]);
});
