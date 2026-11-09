/* open-null-empty-board — 열기가 null 인데 proj.json 이 «없음»이 아니면 빈 판을 편집 가능하게 열지 않는다(OPEN-NULL-EMPTY-BOARD-EDITABLE-01)
 * 티켓(워커2 리뷰 · 코드): ① 열기 null 사이 다른 창·MCP 가 성한 파일을 쓰면(read-state ok) 빈 판이 편집 가능 ② read-state unknown 도 null 로 빈 판 ③ MCP open_project 가 빈 폴백을 ready 로 확정.
 * 손실(코드 읽기): 빈 판 첫 편집의 저장이 _doSaveProjectToFile → buildProjForSave(existing=성한 파일, data=빈 판+편집) 로 성한 proj.json 의 섹션을 지운다
 *   (_emptySaveBlocked 는 «다 빈 캔버스»만 막는다 · 편집이 들어가면 통과).
 * 장면: 가짜 API — 첫 «열기» 읽기만 null(그 순간 못 읽음) · 그 뒤 읽기는 성한 파일(섹션 셋 · 글 · 그림 둘) · read-state 는 칸마다.
 * 칸: O1 탭 · read-state ok — 성한 파일을 안 덮는다(저장 막힘 · 못 읽음 쥠) · O2 탭 · read-state unknown — 같다 · O3 부팅 · read-state ok — 확정이 ready 가 아니라 error(MCP open_project 가 load_error 로 받는다 · main _waitProjectReady)
 * 대조: N1 열기가 성하면 평소대로 열리고 저장된다.
 * 양성대조: js/io/save-load.js 만 4e87be799 로 되돌리면 O1·O2·O3 빨강 · N1 초록. 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const EDIT = 'ON-빈판에-친-편집';

/* 성한 프로젝트 — 섹션 셋 · 글 · 그림 둘 */
const good = (id) => {
  const img = (n, src) => `<div class="asset-block has-image" id="ab_${id}${n}" data-img-src="${src}" style="height:200px;"><div class="asset-img-clip"><img class="asset-img" src="${src}" style="width:100%;height:100%"></div></div>`;
  const txt = (n, s) => `<div class="text-block" id="tb_${id}${n}" data-type="text"><div class="tb-h2" contenteditable="false">${s}</div></div>`;
  const sec = (n, inner) => `<div class="section-block" id="s_${id}_${n}" data-section="${n}" data-name="S${n}"><div class="section-hitzone"></div><div class="section-inner">${inner}</div></div>`;
  return { id, name: id + '이름', version: 2, currentPageId: 'page_1', updatedAt: '2026-11-10T00:00:00.000Z',
    pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: sec(1, txt(1, id + ' 제목')) + sec(2, img(2, RED)) + sec(3, txt(3, '본문') + img(3, HALF)) }] };
};
const settled = (page) => page.waitForFunction(() => { const g = window.gdtProjectReady?.get?.(); return g && g.phase !== 'loading'; }, null, { timeout: 20000 });
const fileB = (page) => page.evaluate(() => window.__fileB);
const editAndSave = (page) => page.evaluate(async (EDIT) => {
  if (!document.querySelector('#canvas .section-block')) await window.addSection?.();
  const s = document.querySelector('#canvas .section-block'); window.selectSection?.(s); window.addTextBlock?.('h2', { content: EDIT });
  await window.saveProjectToFile(window.serializeProject(), { projectId: 'proj_b', skipThumbnail: true });
  await window.waitSavesFor?.('proj_b', 10000);
}, EDIT);

/* 탭 길 — A 를 보다 B 로 간다 */
async function tabSetup(page, rs, openNull = true) {
  const errs = await bootApp(page);
  await page.evaluate(({ A, B, rs, openNull }) => {
    window.__fileB = JSON.stringify(B); window.__opened = !openNull;
    const real = window.electronAPI;
    window.electronAPI = new Proxy(real || {}, { get: (t, k) => k === 'loadProject' ? async (id, o) => {
        if (id !== 'proj_b') return JSON.parse(JSON.stringify(A));
        if (o?.open && !window.__opened) { window.__opened = true; return null; }   // 그 순간 못 읽음(다른 창·MCP 가 쓰는 중) — 그 뒤엔 성한 파일
        return JSON.parse(window.__fileB);
      }
      : k === 'saveProject' ? async (x) => { if (x.id === 'proj_b') window.__fileB = JSON.stringify(x); return { ok: true }; }
      : k === 'saveProjectMeta' ? async () => ({ ok: true })
      : k === 'projectFolderState' ? async () => 'ok'
      : k === 'projectReadState' ? async () => rs
      : k === 'projectsRootKey' ? async () => 'acct_me' : t[k] });
    window.openTabs = [{ id: 'proj_a', name: 'proj_a이름', _cache: JSON.stringify(A) }, { id: 'proj_b', name: 'proj_b이름' }];
    window.activeProjectId = 'proj_a'; window.renderTabBar();
  }, { A: good('proj_a'), B: good('proj_b'), rs, openNull });
  await page.evaluate(() => window.switchTab('proj_b')).catch(() => {});
  await settled(page);
  return errs;
}

for (const [n, rs] of [[1, 'ok'], [2, 'unknown']]) {
  test(`O${n} 탭 · 열기 null · read-state ${rs} — 빈 판 편집이 성한 파일을 안 덮는다`, async ({ page }) => {
    const errs = await tabSetup(page, rs);
    await editAndSave(page).catch(() => {});
    const f = await fileB(page);
    expect(f, '★빈 판 편집이 성한 proj.json 을 덮었다(섹션 셋이 사라짐)').toContain('s_proj_b_3');
    expect(f).not.toContain(EDIT);
    expect(await page.evaluate(() => window.isTabFirstLoading('proj_b')), '못 읽음 쥠(저장 막는 표식)').toBe(true);
    expect(await page.evaluate(() => window.gdtProjectReady.get().phase), '확정은 error').toBe('error');
    expect(errs).toEqual([]);
  });
}

test('O3 부팅 · 열기 null · read-state ok — 빈 판을 ready 로 확정하지 않는다(MCP open_project 가 load_error 로 받는다)', async ({ page }) => {
  const errs = await bootApp(page);
  await page.addInitScript((B) => {
    window.__fileB = JSON.stringify(B); window.__opened = false;
    const real = window.electronAPI;
    window.electronAPI = new Proxy(real, { get: (t, k) => k === 'listProjects' ? async () => [{ id: 'proj_b', name: 'proj_b이름', updatedAt: 0 }]
      : k === 'loadProject' ? async (id, o) => { if (o?.open && !window.__opened) { window.__opened = true; return null; } return JSON.parse(window.__fileB); }
      : k === 'saveProject' ? async (x) => { if (x.id === 'proj_b') window.__fileB = JSON.stringify(x); return { ok: true }; }
      : k === 'projectFolderState' ? async () => 'ok'
      : k === 'projectReadState' ? async () => 'ok'
      : k === 'projectsRootKey' ? async () => 'acct_me' : t[k] });
  }, good('proj_b'));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('web-editor-open-tabs', JSON.stringify({ tabs: [{ id: 'proj_b', name: 'proj_b이름' }], activeId: 'proj_b' })); });
  await page.goto(`${ORIGIN}/index.html?project=proj_b`);
  await settled(page);
  const s = await page.evaluate(() => ({ phase: window.gdtProjectReady.get().phase, detail: window.gdtProjectReady.get().detail, held: window.isTabFirstLoading('proj_b') }));
  expect(s.phase, `★빈 폴백을 ready 로 확정 — MCP open_project 가 ok 로 받는다 (${s.detail})`).toBe('error');
  expect(s.held, '못 읽음 쥠').toBe(true);
  await editAndSave(page).catch(() => {});
  expect(await fileB(page), '★부팅 빈 판 편집이 성한 파일을 덮었다').toContain('s_proj_b_3');
  expect(errs).toEqual([]);
});

test('N1 [대조] 열기가 성하면 평소대로 열리고 편집이 저장된다', async ({ page }) => {
  const errs = await tabSetup(page, 'ok', false);
  expect(await page.evaluate(() => !!document.getElementById('s_proj_b_3')), '[전제] 성한 판이 열렸다').toBe(true);
  await editAndSave(page);
  const f = await fileB(page);
  expect(f).toContain(EDIT);
  expect(f).toContain('s_proj_b_3');
  expect(await page.evaluate(() => window.gdtProjectReady.get().phase)).toBe('ready');
  expect(errs).toEqual([]);
});
