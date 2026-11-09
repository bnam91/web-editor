/* missing-folder-returns-while-viewing — 폴더 없는 탭을 남은 본으로 보는 중 폴더가 돌아오면, 그 탭의 편집이 돌아온 파일을 안 덮는다(MISSING-FOLDER-RETURNS-WHILE-VIEWING-OVERWRITES-01).
 * 앱 값(MPT-리뷰8-203500 · L3 3/3): 탭을 안 옮기고 편집하면 돌아온 파일을 덮고 proj_backup 한 칸에만 남는다. 옆 탭을 다녀오면 파일로 다시 열린다(T1 · tab-missing-project-notice).
 * 장면: 폴더 상태·읽기·쓰기를 가짜 API 로 돌린다 — 쓰기는 main 의 약속(남은 본 표시 + 폴더 있음 ⇒ folder_returned · kept)을 흉내 낸다. main 쪽은 tests/unit/missing-folder-returned-save.
 * 칸: V1 자동저장 길 — 안 덮고, 알리고, 파일로 다시 연다 · V2 종료·새로고침 동기 길도 표시를 단다 · V3 다시 연 뒤 편집은 평소대로 파일에 간다.
 * 칸(인텔 1): V4 닫는 탭 — 표시는 저장이 들어올 때 잡는다(보낼 때 찾으면 탭이 목록에 없어 덮었다 · Expected −1 / Received +3).
 * 칸(리뷰 1): V5 줄 선 저장도 표시를 단 채 나가 거절된다 — 첫 거절 뒤 다시 열기가 표시를 먼저 걷으면 그 저장이 덮었다.
 * 칸(리뷰 2): V6 남긴 거절 뒤 LS 본을 지운다(남으면 다시 열기·다음 부팅이 그 본으로 덮는다) · V7 거절된 저장이 도는 사이 친 편집도 남긴다(다시 열기가 화면을 비우기 전에).
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
    const write = (x) => { window.__sent.push({ id: x.id, gone: !!x._goneBase }); if (x._goneBase && window.__state === 'ok') { (window.__refused ||= []).push(JSON.stringify(x.pages)); return { ok: false, reason: 'folder_returned', kept: 'history' }; } if (x.id === 'proj_b') window.__state = 'ok'; const { _goneBase, ...kept } = x; window.__written.push(kept); return { ok: true }; };   // main 처럼 표시를 떼고 «쓴다» — 붙은 채 두면 다음 저장이 읽어 합친 본에 표시가 따라 들어간다(인텔 N1 2≠1 · main 은 유닛 N1)
    /* __hold: proj_b 의 첫 비동기 저장을 붙든다 — 그사이 폴더가 돌아오고 다음 저장이 줄에 선다(적대 리뷰 ①). 판정은 풀린 뒤에 한다. */
    window.electronAPI = new Proxy(real || {}, { get: (t, k) => k === 'saveProject' ? async (x) => { if (window.__hold && x.id === 'proj_b' && !window.__held) { window.__held = true; window.__sent.push({ id: 'held' }); await new Promise((r) => { window.__rel = r; }); window.__sent.pop(); } return write(x); }
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
/* 다른 저장이 돌면 saveProjectToFile 은 줄에만 세우고 곧장 돌아오고, 같은 id 의 줄은 최신 하나로 합쳐진다(인텔 cbef8dea4 N1 «2≠1») — 줄이 빠질 때까지 기다린다(고정 대기 아님 · 앱의 waitSavesFor). */
const save = (page, t, id = 'proj_b') => page.evaluate(async ([t, id]) => { document.querySelector('#canvas .text-block p').textContent = t; await window.saveProjectToFile(window.serializeProject(), { projectId: id, skipThumbnail: true }); return window.waitSavesFor(id, 15000); }, [t, id]);
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
  /* 저장을 곧장 부른다 — 1.5초 자동저장 타이머는 이 하네스에서 뒤따른 편집에 안 온다(인텔 N1·N2 시간 초과, 고치기 전 판도 같음). 자동저장 길은 V1 이 잰다. */
  await save(page, '첫편집');
  await save(page, '둘째편집');
  const s = await page.evaluate(() => ({ sent: window.__sent.filter(s => s.id === 'proj_b'), tab: window.openTabs.find(t => t.id === 'proj_b')._goneCopy }));
  expect(await wroteB(page).then(w => w.length), '[전제] 두 저장이 다 들어갔다').toBe(2);
  expect(s.sent[0].gone).toBe(true);
  expect(s.sent.at(-1).gone, '★다시 만든 뒤에도 남은 본 표시 — 다음 저장이 거절된다').toBe(false);
  expect(s.tab).toBe(false);
  expect(errs).toEqual([]);
});
test('N2 [대조] 평범한 탭의 저장은 표시가 없다', async ({ page }) => {
  const errs = await setup(page);
  /* 처음 proj_b 로 갈 때 나가는 탭 캐시에 하네스 부팅 화면이 찍혀 s_A1 이 안 돌아온다(인텔 N2 시간 초과 · 고치기 전 판도 같음) — 캐시를 다시 놓는다. */
  await page.evaluate((A) => { window.openTabs.find((t) => t.id === 'proj_a')._cache = JSON.stringify(A); }, doc('proj_a', 'A'));
  await page.evaluate(() => window.switchTab('proj_a'));
  await page.waitForFunction(() => !!document.getElementById('s_A1') && window.gdtProjectReady?.get?.()?.phase !== 'loading');
  await save(page, 'A편집', 'proj_a');
  const a = await page.evaluate(() => window.__sent.filter(s => s.id === 'proj_a'));
  expect(a.length, '[전제] 저장이 나갔다').toBeGreaterThan(0);
  expect(a.some(s => s.gone)).toBe(false);
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
test('V5 줄 선 저장 — 첫 저장이 거절된 뒤 줄에서 나오는 저장도 돌아온 파일을 안 덮는다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.__hold = true; document.querySelector('#canvas .text-block p').textContent = '첫편집'; window.saveProjectToFile(window.serializeProject(), { projectId: 'proj_b', skipThumbnail: true }); });
  await page.waitForFunction(() => typeof window.__rel === 'function', null, { timeout: 15000 });
  await ret(page);
  await page.evaluate(() => { document.querySelector('#canvas .text-block p').textContent = '줄선편집'; window.saveProjectToFile(window.serializeProject(), { projectId: 'proj_b', skipThumbnail: true }); });
  expect(await page.evaluate(() => window.projectSaveUnsettled('proj_b')), '[전제] 둘째 저장이 줄에 섰다').toBe(true);
  await page.evaluate(() => window.__rel());
  await page.waitForFunction(() => !!document.getElementById('s_돌아온1') && window.gdtProjectReady?.get?.()?.phase !== 'loading', null, { timeout: 15000 }).catch(() => {});
  expect(await wroteB(page), '★줄 선 저장이 돌아온 파일을 덮었다').toEqual([]);
  expect(await page.evaluate(() => window.__sent.filter(s => s.id === 'proj_b').length), '[전제] 두 저장이 다 나갔다').toBe(2);
  expect(await page.evaluate(() => !!document.getElementById('s_돌아온1')), '★파일로 다시 안 열었다').toBe(true);
  expect((await page.evaluate(() => window.__toasts)).filter(t => t.includes('폴더가 돌아와')).length, '안내는 한 번').toBe(1);
  expect(errs).toEqual([]);
});
test('V6 남긴 거절 뒤 LS 본은 지운다 — 다시 열기·다음 부팅이 그 본을 못 고른다', async ({ page }) => {
  const errs = await setup(page);
  await ret(page);
  await save(page, '남은본편집');
  await page.waitForFunction(() => !!document.getElementById('s_돌아온1') && window.gdtProjectReady?.get?.()?.phase !== 'loading', null, { timeout: 15000 }).catch(() => {});
  const ls = await page.evaluate(() => localStorage.getItem('web-editor-autosave__proj_b') || '');
  expect(ls, '★거절한 남은 본이 LS 에 남았다').not.toContain('남은본편집');
  expect(ls).not.toContain('남은 몸');
  expect(await wroteB(page)).toEqual([]);
  expect(errs).toEqual([]);
});
test('V7 거절된 저장이 도는 사이 친 편집도 남긴다 — 다시 열기가 화면을 비우기 전에', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.__hold = true; document.querySelector('#canvas .text-block p').textContent = '첫편집'; window.saveProjectToFile(window.serializeProject(), { projectId: 'proj_b', skipThumbnail: true }); });
  await page.waitForFunction(() => typeof window.__rel === 'function', null, { timeout: 15000 });
  await ret(page);
  await page.evaluate(() => { document.querySelector('#canvas .text-block p').textContent = '도는사이편집'; window.scheduleAutoSave(); window.__rel(); });
  await page.waitForFunction(() => !!document.getElementById('s_돌아온1') && window.gdtProjectReady?.get?.()?.phase !== 'loading', null, { timeout: 15000 }).catch(() => {});
  expect((await page.evaluate(() => window.__refused || [])).some(p => p.includes('도는사이편집')), '★도는 사이 친 편집이 어디에도 안 남았다').toBe(true);
  expect(await wroteB(page)).toEqual([]);
  expect(errs).toEqual([]);
});
