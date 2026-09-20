/* projects-onescreen.dom.spec.js — 프로젝트 목록 폴더 «한 화면»(시안 B, 2026-09-19)의 «진짜 끝».
 *
 * ★왜 필요한가
 *   tests/unit/project-folders-onescreen.test.js 는 소스 문자열과 떼어낸 순수 함수만 잰다.
 *   「타일을 누르면 진짜 경로가 뜨나」·「검색하면 진짜 구역이 사라지나」·「드롭하면 진짜 카드가 빠지나」·
 *   「폴더 이름에 심은 onerror 가 진짜 안 도나」는 «렌더러가 그린 뒤»에만 답이 나온다.
 *
 * ★하네스 = «진짜 pages/projects.html» 그대로(스크립트까지). window.electronAPI 만 메모리 목으로 갈아 끼운다
 *   (IS_ELECTRON 이 참이 되도록 isElectron:true). ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js projects-onescreen
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();

/** 폴더 3 · 프로젝트 7(미분류 3). */
function seed() {
  return {
    folders: [
      { id: 'fold_a', name: '파테나', order: 0, updatedAt: iso(30) },
      { id: 'fold_b', name: '고디터 QA', order: 1, updatedAt: iso(30) },
      { id: 'fold_c', name: '보관', order: 2, updatedAt: iso(30) },
    ],
    projects: [
      { id: 'proj_1', name: '루트 하나', updatedAt: iso(1), folderId: null },
      { id: 'proj_2', name: '루트 둘', updatedAt: iso(2), folderId: null },
      { id: 'proj_3', name: '루트 셋', updatedAt: iso(3), folderId: null },
      { id: 'proj_4', name: '파테나 상세', updatedAt: iso(2), folderId: 'fold_a' },
      { id: 'proj_5', name: '파테나 썸네일', updatedAt: iso(9), folderId: 'fold_a' },
      { id: 'proj_6', name: 'QA 회귀', updatedAt: iso(0), folderId: 'fold_b' },
      { id: 'proj_7', name: '옛 시안', updatedAt: iso(21), folderId: 'fold_c' },
    ],
  };
}

/* 목 — 페이지 안에서 돈다(addInitScript). 상태는 sessionStorage 에 둬서 새로고침에도 남긴다. */
function installMock(initial) {
  const KEY = '__mockdb';
  let db;
  try { db = JSON.parse(sessionStorage.getItem(KEY)); } catch (_) { db = null; }
  if (!db) { db = initial; sessionStorage.setItem(KEY, JSON.stringify(db)); }
  const save = () => sessionStorage.setItem(KEY, JSON.stringify(db));
  window.__calls = [];
  const log = (name, arg) => { window.__calls.push({ name, arg: JSON.parse(JSON.stringify(arg == null ? null : arg)) }); };
  let seq = 0;
  // ★2라운드(T-062 후속) — 가져오기(.gdt) 결과가 «디스크에 생긴 것»을 흉내 낸다(목의 db 에 직접 넣기).
  window.__mockAddProject = (p) => { db.projects.push({ folderId: null, ...p }); save(); };
  window.electronAPI = {
    isElectron: true,
    listProjects: async () => db.projects.map(p => ({ ...p })),
    trashList: async () => ({ ok: true, items: [] }),
    getAuthState: async () => ({ signedIn: false }),
    // 복제 — ★일부러 «소속을 잃은» 사본을 만든다(folderId:null). 실제 main 은 원본 meta 를 복사해 소속이 살아남지만(9370 실측),
    //   목록 페이지의 방어선(_adoptIntoCurrentFolder)이 «그것에 기대지 않고» 지금 보는 폴더로 넣는지를 잰다.
    duplicateProject: async ({ sourceProjectId, newName }) => {
      log('duplicateProject', { sourceProjectId });
      const id = 'proj_dup' + (++seq);
      db.projects.push({ id, name: newName, updatedAt: new Date().toISOString(), folderId: null }); save();
      return { ok: true, newProjectId: id };
    },
    saveProject: async (p) => { log('saveProject', { id: p.id }); db.projects.push({ id: p.id, name: p.name, updatedAt: p.updatedAt, folderId: null }); save(); return { ok: true }; },
    folders: {
      list: async () => ({ ok: true, folders: db.folders.map(f => ({ ...f })) }),
      create: async ({ name }) => {
        log('create', { name });
        const f = { id: 'fold_new' + (++seq), name, order: db.folders.length, updatedAt: new Date().toISOString() };
        db.folders.push(f); save(); return { ok: true, folder: f };
      },
      rename: async ({ id, name }) => { log('rename', { id, name }); const f = db.folders.find(x => x.id === id); if (f) f.name = name; save(); return { ok: !!f }; },
      delete: async ({ id }) => {
        log('delete', { id });
        db.folders = db.folders.filter(f => f.id !== id);
        db.projects.forEach(p => { if (p.folderId === id) p.folderId = null; });
        save(); return { ok: true };
      },
      assign: async ({ projectIds, folderId }) => {
        log('assign', { projectIds, folderId });
        let moved = 0;
        for (const id of projectIds) { const p = db.projects.find(x => x.id === id); if (p && /^proj_/.test(id)) { p.folderId = folderId || null; moved++; } }
        save(); return { ok: true, moved, folderId: folderId || null };
      },
    },
  };
}

async function boot(page, data, opts = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('dialog', (d) => (opts.onDialog ? opts.onDialog(d) : d.accept()));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.addInitScript(installMock, data);
  if (opts.localStorage) {
    await page.addInitScript((kv) => { if (!sessionStorage.getItem('__lsinit')) { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); sessionStorage.setItem('__lsinit', '1'); } }, opts.localStorage);
  }
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForFunction(() => document.querySelectorAll('#folder-tiles .ft-tile').length > 0);
  return errs;
}

const cardIds = (page) => page.$$eval('#project-grid .project-card', els => els.map(e => e.dataset.id).sort());
const shown = (page, sel) => page.$eval(sel, el => getComputedStyle(el).display !== 'none' && el.offsetParent !== null);

test('ⓐ 루트 — 타일 4(폴더 3 + 새 폴더) · 「폴더 밖 프로젝트 3」 · 카드 3', async ({ page }) => {
  const errs = await boot(page, seed());
  await expect(page.locator('#folder-tiles .ft-tile')).toHaveCount(4);
  await expect(page.locator('#folder-tiles .ft-add')).toHaveCount(1);
  await expect(page.locator('#fz-label .fz-count')).toHaveText('3');
  await expect(page.locator('#loose-label')).toBeVisible();
  await expect(page.locator('#loose-label')).toHaveText(/폴더 밖 프로젝트\s*3/);
  expect(await cardIds(page)).toEqual(['proj_1', 'proj_2', 'proj_3']);
  // 「N개 · 언제」 — 파테나: 2개, 가장 최근 소속 프로젝트 2일 전
  await expect(page.locator('.ft-tile[data-folder-key="fold_a"] .ft-sub')).toHaveText('2개 · 2일 전');
  await expect(page.locator('.ft-tile[data-folder-key="fold_b"] .ft-sub')).toHaveText('1개 · 오늘');
  await expect(page.locator('#folder-rail')).toHaveCount(0);
  await expect(page.locator('#gal-crumb')).toBeHidden();
  expect(errs, errs.join('\n')).toEqual([]);
});

test('ⓑ 타일 클릭 → 폴더 안(경로·타일 줄 숨김·그 폴더만) · 「Projects」 → 루트', async ({ page }) => {
  await boot(page, seed());
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  await expect(page.locator('#gal-crumb')).toBeVisible();
  await expect(page.locator('#gal-crumb-name')).toHaveText('파테나');
  await expect(page.locator('#folder-zone')).toBeHidden();
  await expect(page.locator('#loose-label')).toBeHidden();
  expect(await cardIds(page)).toEqual(['proj_4', 'proj_5']);
  expect(await page.evaluate(() => localStorage.getItem('goditor_projects_folder'))).toBe('fold_a');
  await page.click('#gal-tab-projects');
  await expect(page.locator('#gal-crumb')).toBeHidden();
  await expect(page.locator('#folder-zone')).toBeVisible();
  expect(await cardIds(page)).toEqual(['proj_1', 'proj_2', 'proj_3']);
  expect(await page.evaluate(() => localStorage.getItem('goditor_projects_folder'))).toBe(null);
});

test('ⓒ 새로고침 뒤 기억한 폴더로 복원 · 옛 \'__unassigned__\' 값은 루트로 이주', async ({ page }) => {
  await boot(page, seed());
  await page.click('.ft-tile[data-folder-key="fold_b"]');
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#project-grid .project-card').length > 0);
  await expect(page.locator('#gal-crumb-name')).toHaveText('고디터 QA');
  expect(await cardIds(page)).toEqual(['proj_6']);
});
test('ⓒ-2 옛 저장값 \'__unassigned__\' → 루트', async ({ page }) => {
  await boot(page, seed(), { localStorage: { goditor_projects_folder: '__unassigned__' } });
  await expect(page.locator('#folder-zone')).toBeVisible();
  expect(await cardIds(page)).toEqual(['proj_1', 'proj_2', 'proj_3']);
  expect(await page.evaluate(() => localStorage.getItem('goditor_projects_folder'))).toBe(null);
});

test('ⓓ 검색 «파테» — 구역·경로 숨김, 칩 1·배지, 칩 클릭 → 폴더 진입 + 검색어 비움', async ({ page }) => {
  await boot(page, seed());
  await page.click('.ft-tile[data-folder-key="fold_b"]');          // 폴더 안에서 검색해도 전체 범위여야 한다
  await page.fill('#proj-search-input', '파테');
  await expect(page.locator('#search-folder-hits .sfc-chip')).toHaveCount(1);
  await expect(page.locator('#folder-zone')).toBeHidden();
  await expect(page.locator('#gal-crumb')).toBeHidden();
  expect(await cardIds(page)).toEqual(['proj_4', 'proj_5']);
  await expect(page.locator('#project-grid .folder-badge').first()).toHaveText(/파테나/);
  await page.click('#search-folder-hits .sfc-chip');
  await expect(page.locator('#proj-search-input')).toHaveValue('');
  await expect(page.locator('#gal-crumb-name')).toHaveText('파테나');
  expect(await cardIds(page)).toEqual(['proj_4', 'proj_5']);
});

test('ⓔ 휴지통 탭 → 구역·경로·라벨·검색 display:none · 돌아오면 기억한 폴더로 복원', async ({ page }) => {
  await boot(page, seed());
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  await page.click('#gal-tab-trash');
  for (const id of ['folder-zone', 'loose-label', 'gal-crumb', 'proj-search']) {
    expect(await page.$eval('#' + id, el => el.style.display), id).toBe('none');
  }
  await page.click('#gal-tab-projects');
  await expect(page.locator('#gal-crumb-name')).toHaveText('파테나');   // 휴지통에서 돌아오면 «기억» 복귀(R4)
  await expect(page.locator('#proj-search')).toBeVisible();
  await page.waitForFunction(() => document.querySelectorAll('#project-grid .project-card').length === 2);
  // 루트에서 휴지통 → 돌아오기
  await page.click('#gal-tab-projects');
  await page.click('#gal-tab-trash');
  await page.click('#gal-tab-projects');
  await expect(page.locator('#folder-zone')).toBeVisible();
  await expect(page.locator('#gal-crumb')).toBeHidden();
});

async function dragCardTo(page, cardId, targetSel) {
  return page.evaluate(({ cardId, targetSel }) => {
    const dt = new DataTransfer();
    const card = document.querySelector(`.project-card[data-id="${cardId}"]`);
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const t = document.querySelector(targetSel);
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
    t.dispatchEvent(over);
    const hl = t.classList.contains('is-drop-target');
    t.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return { key: dt.getData('text/x-goditor-project-id'), accepted: over.defaultPrevented, hl };
  }, { cardId, targetSel });
}

test('ⓕ 카드를 타일로 드래그 → assign 호출·카드가 루트에서 사라짐 · 「+ 새 폴더」엔 못 놓음 · 경로 「Projects」 드롭=미분류로', async ({ page }) => {
  await boot(page, seed());
  const r = await dragCardTo(page, 'proj_1', '.ft-tile[data-folder-key="fold_c"]');
  expect(r).toEqual({ key: 'proj_1', accepted: true, hl: true });
  await page.waitForFunction(() => !document.querySelector('.project-card[data-id="proj_1"]'));
  const calls = await page.evaluate(() => window.__calls.filter(c => c.name === 'assign'));
  expect(calls).toEqual([{ name: 'assign', arg: { projectIds: ['proj_1'], folderId: 'fold_c' } }]);
  await expect(page.locator('.ft-tile[data-folder-key="fold_c"] .ft-sub')).toHaveText(/^2개/);

  const bad = await dragCardTo(page, 'proj_2', '#ft-add-folder');
  expect(bad.accepted, '「+ 새 폴더」 타일이 드롭을 받았다').toBe(false);

  // 폴더 안 → 경로의 「Projects」에 드롭 = 미분류로 빼기
  await page.click('.ft-tile[data-folder-key="fold_c"]');
  const up = await dragCardTo(page, 'proj_7', '#gal-tab-projects');
  expect(up.accepted).toBe(true);
  await page.waitForFunction(() => !document.querySelector('.project-card[data-id="proj_7"]'));
  const last = await page.evaluate(() => window.__calls.filter(c => c.name === 'assign').pop());
  expect(last.arg).toEqual({ projectIds: ['proj_7'], folderId: null });
  // 루트에선 「Projects」가 드롭 대상이 아니다
  await page.click('#gal-tab-projects');
  const rootUp = await dragCardTo(page, 'proj_2', '#gal-tab-projects');
  expect(rootUp.accepted).toBe(false);
});

test('ⓖ ★XSS — 폴더 이름 <img onerror> 가 타일·경로·메뉴·칩 어디서도 안 돈다', async ({ page }) => {
  const d = seed();
  d.folders[0].name = '<img src=x onerror=window.__x=1>';
  const errs = await boot(page, d);
  await expect(page.locator('.ft-tile[data-folder-key="fold_a"] .ft-name')).toHaveText('<img src=x onerror=window.__x=1>');
  await page.click('.ft-tile[data-folder-key="fold_a"]');                         // 경로
  await expect(page.locator('#gal-crumb-name')).toHaveText('<img src=x onerror=window.__x=1>');
  await page.click('#gal-tab-projects');
  await page.hover('.project-card[data-id="proj_1"]');
  await page.click('.project-card[data-id="proj_1"] .card-folder-move');           // 카드 📁 메뉴
  await expect(page.locator('.card-folder-menu')).toHaveText(/<img src=x onerror=window\.__x=1>/);
  await page.mouse.click(5, 300);
  await page.fill('#proj-search-input', 'img');                                    // 칩
  await expect(page.locator('#search-folder-hits .sfc-chip')).toHaveCount(1);
  await page.fill('#proj-search-input', '');
  await page.waitForTimeout(300);
  await page.hover('.ft-cell:first-child'); await page.click('.ft-cell:first-child .ft-more'); // ⋯ 메뉴
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  expect(await page.locator('#folder-tiles img, #gal-crumb img, .card-folder-menu img, #search-folder-hits img').count()).toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('ⓗ 목록 보기에서도 #folder-tiles 가 보인다(압축형)', async ({ page }) => {
  await boot(page, seed());
  const before = await page.$eval('.ft-tile[data-folder-key="fold_a"]', el => el.getBoundingClientRect().height);
  await page.click('#view-toggle label[title="목록으로 보기"]');
  await expect(page.locator('#folder-tiles')).toBeVisible();
  await expect(page.locator('#gallery-col')).toHaveClass(/is-list-mode/);
  const after = await page.$eval('.ft-tile[data-folder-key="fold_a"]', el => el.getBoundingClientRect().height);
  expect(after).toBeLessThan(before);
  await expect(page.locator('#folder-tiles .ft-tile')).toHaveCount(4);
});

test('ⓘ 폴더 0개 → 타일 1(+새 폴더) · 큰 빈 화면 없음', async ({ page }) => {
  const d = seed(); d.folders = []; d.projects.forEach(p => { p.folderId = null; });
  await boot(page, d);
  await expect(page.locator('#folder-tiles .ft-tile')).toHaveCount(1);
  await expect(page.locator('#ft-add-folder')).toBeVisible();
  await expect(page.locator('#fz-label .fz-count')).toHaveText('');
  await expect(page.locator('#folder-zone')).toHaveClass(/is-empty/);
  await expect(page.locator('#empty-state')).toBeHidden();
  await expect(page.locator('#loose-label')).toHaveText(/프로젝트\s*7/);
});
test('ⓘ-2 폴더는 있는데 폴더 밖 0개 → compact 안내(큰 빈 화면 아님)', async ({ page }) => {
  const d = seed(); d.projects = d.projects.filter(p => p.folderId);
  await boot(page, d);
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#empty-state')).toHaveClass(/is-compact/);
  expect(await page.$eval('#empty-state', el => parseFloat(getComputedStyle(el).paddingTop))).toBeLessThan(30);
  await expect(page.locator('#loose-label')).toHaveText(/폴더 밖 프로젝트\s*0/);
});

test('ⓙ 「+ 새 폴더」 → 인라인 입력 → Enter = create · 루트에 머묾 · Esc = 취소', async ({ page }) => {
  await boot(page, seed());
  await page.click('#ft-add-folder');
  await expect(page.locator('#folder-tiles .ft-editing .fr-name-input')).toBeFocused();
  await page.keyboard.type('새 기획');
  await page.keyboard.press('Enter');
  await expect(page.locator('#folder-tiles .ft-tile[data-folder-key]')).toHaveCount(4);
  const created = await page.evaluate(() => window.__calls.filter(c => c.name === 'create'));
  expect(created).toEqual([{ name: 'create', arg: { name: '새 기획' } }]);
  await expect(page.locator('#folder-zone')).toBeVisible();                       // 루트 유지
  await expect(page.locator('.ft-tile.is-fresh .ft-name')).toHaveText('새 기획');   // 방금 만든 타일 강조

  await page.click('#ft-add-folder');
  await page.keyboard.type('취소될 것');
  await page.keyboard.press('Escape');
  await expect(page.locator('#folder-tiles .ft-editing')).toHaveCount(0);
  await expect(page.locator('#ft-add-folder')).toBeVisible();
  expect(await page.evaluate(() => window.__calls.filter(c => c.name === 'create').length)).toBe(1);
});

test('ⓚ ⋯ 메뉴 이름 바꾸기 · 삭제(confirm 수락) → 보던 폴더면 루트 · 우클릭도 같은 메뉴', async ({ page }) => {
  let confirmMsg = '';
  await boot(page, seed(), { onDialog: (d) => { confirmMsg = d.message(); d.accept(); } });
  // 우클릭 → 이름 바꾸기
  await page.click('.ft-tile[data-folder-key="fold_c"]', { button: 'right' });
  await page.click('.card-folder-menu [data-ft-act="rename"]');
  const input = page.locator('#folder-tiles .ft-editing .fr-name-input');
  await expect(input).toHaveValue('보관');
  await input.fill('보관함');
  await page.keyboard.press('Enter');
  await expect(page.locator('.ft-tile[data-folder-key="fold_c"] .ft-name')).toHaveText('보관함');

  // 폴더 안에서 삭제 — 경로 폴더명 더블클릭으로도 이름변경 가능
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  await page.dblclick('#gal-crumb-name');
  await expect(page.locator('#gal-crumb .fr-name-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#gal-crumb-name')).toHaveText('파테나');
  // 폴더 안에선 타일이 없으니 루트로 나가 ⋯ 로 지우는 대신 — 삭제는 루트 ⋯ 메뉴 경로다. 보던 폴더 기억을 남긴 채 루트로
  await page.evaluate(() => deleteFolderUI('fold_a'));
  expect(confirmMsg).toContain('안에 있는 프로젝트는 지워지지 않고 «폴더 밖»으로 갑니다.');
  await expect(page.locator('#gal-crumb')).toBeHidden();
  await expect(page.locator('#folder-zone')).toBeVisible();
  expect(await cardIds(page)).toEqual(['proj_1', 'proj_2', 'proj_3', 'proj_4', 'proj_5']);

  // ⋯ 버튼 경로
  await page.hover('.ft-cell:has([data-folder-key="fold_b"])');
  await page.click('.ft-cell:has([data-folder-key="fold_b"]) .ft-more');
  await page.click('.card-folder-menu [data-ft-act="delete"]');
  await expect(page.locator('.ft-tile[data-folder-key="fold_b"]')).toHaveCount(0);
});

test('ⓛ 폴더 안에서 새 프로젝트 → 그 폴더로 배정(열기 전) · Esc 로 폴더 밖', async ({ page }) => {
  await boot(page, seed());
  await page.click('.ft-tile[data-folder-key="fold_b"]');
  // openProject 가 페이지를 떠나므로 이동을 막고 호출 순서만 본다
  await page.evaluate(() => { window.openProject = (id) => { window.__opened = id; }; });
  await page.evaluate(() => createProject());
  const calls = await page.evaluate(() => window.__calls.map(c => c.name + ':' + JSON.stringify(c.arg)));
  const a = calls.findIndex(c => c.startsWith('assign:') && c.includes('"folderId":"fold_b"'));
  expect(a, calls.join('\n')).toBeGreaterThan(calls.findIndex(c => c.startsWith('saveProject:')));
  // Esc(포커스가 입력칸 밖) → 폴더 밖으로
  await page.evaluate(() => { window.openProject = undefined; });
  await page.mouse.click(5, 400);
  await page.keyboard.press('Escape');
  await expect(page.locator('#folder-zone')).toBeVisible();
  await expect(page.locator('#gal-crumb')).toBeHidden();
});

/* ── 픽스 라운드(09-19 이벨류) 회귀 ── */

test('ⓜ ★경로 폴더명 더블클릭 이름변경을 «확정»(Enter·blur·실패)해도 경로 이름 자리가 살아 있다 · 다른 폴더 이름이 제대로 뜬다', async ({ page }) => {
  const errs = await boot(page, seed(), { onDialog: (d) => d.accept() });
  // Enter 확정
  await page.click('.ft-tile[data-folder-key="fold_c"]');
  await page.dblclick('#gal-crumb-name');
  await page.locator('#gal-crumb .fr-name-input').fill('보관2');
  await page.keyboard.press('Enter');
  await expect(page.locator('#gal-crumb-name')).toHaveText('보관2');
  await expect(page.locator('#gal-crumb .fr-name-input')).toHaveCount(0);
  await expect(page.locator('#gallery-title .fr-name-input')).toHaveCount(0);
  // 다른 폴더로 — 경로가 옛 이름에 굳지 않는다
  await page.click('#gal-tab-projects');
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  await expect(page.locator('#gal-crumb-name')).toHaveText('파테나');
  expect(await cardIds(page)).toEqual(['proj_4', 'proj_5']);
  // blur 확정 + 재차 더블클릭 동작
  await page.dblclick('#gal-crumb-name');
  await page.locator('#gal-crumb .fr-name-input').fill('파테나2');
  await page.mouse.click(5, 500);
  await expect(page.locator('#gal-crumb-name')).toHaveText('파테나2');
  await expect(page.locator('#gal-crumb .fr-name-input')).toHaveCount(0);
  // 실패 갈래 — rename 이 ok:false 여도 이름 자리는 원래대로
  await page.evaluate(() => { window.electronAPI.folders.rename = async () => ({ ok: false, error: 'x' }); });
  await page.dblclick('#gal-crumb-name');
  await page.locator('#gal-crumb .fr-name-input').fill('실패할 이름');
  await page.keyboard.press('Enter');
  await expect(page.locator('#gal-crumb-name')).toHaveText('파테나2');
  await expect(page.locator('#gal-crumb .fr-name-input')).toHaveCount(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('ⓝ 폴더 안에서 보기전환 radio 를 누른 뒤 Esc → 폴더 밖(radio 는 입력칸이 아니다) · 검색칸 Esc 는 여전히 검색만', async ({ page }) => {
  await boot(page, seed());
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  await page.click('label.vt-item:has([data-view="list"])');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.type)).toBe('radio');
  await page.keyboard.press('Escape');
  await expect(page.locator('#gal-crumb')).toBeHidden();
  await expect(page.locator('#folder-zone')).toBeVisible();
  // 검색칸 포커스 Esc 는 폴더를 안 나간다(검색만 지운다)
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  await page.click('#proj-search-input');
  await page.keyboard.press('Escape');
  await expect(page.locator('#gal-crumb')).toBeVisible();
});

test('ⓞ 폴더 안에 들어가도(긴 이름 포함) 헤더 검색칸 자리가 안 출렁인다', async ({ page }) => {
  const d = seed();
  d.folders[1].name = '아주 길고 긴 폴더 이름입니다 정말 길어요 끝까지';
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, d);
  const x = () => page.$eval('#proj-search', el => Math.round(el.getBoundingClientRect().left));
  const root = await x();
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  expect(await x()).toBe(root);
  await page.click('#gal-tab-projects');
  await page.click('.ft-tile[data-folder-key="fold_b"]');
  expect(await x()).toBe(root);
  await page.dblclick('#gal-crumb-name');   // 이름 입력 중에도
  expect(await x()).toBe(root);
});

test('ⓟ 키보드 — Tab 으로 타일 ⋯ 에 닿고 Enter 로 폴더 메뉴가 열린다 · 카드 📁 메뉴 첫 항목은 「폴더에서 빼기」', async ({ page }) => {
  await boot(page, seed());
  await page.focus('.ft-tile[data-folder-key="fold_a"]');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.dataset.folderMenu);
  expect(focused).toBe('fold_a');
  expect(await page.$eval('.ft-cell:has([data-folder-key="fold_a"]) .ft-more', el => getComputedStyle(el).opacity)).toBe('1');
  await page.keyboard.press('Enter');
  await expect(page.locator('.card-folder-menu [data-ft-act="rename"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.card-folder-menu')).toHaveCount(0);
  // 평소(포커스·hover 없음)엔 안 보인다
  await page.mouse.move(5, 790);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  expect(await page.$eval('.ft-cell:has([data-folder-key="fold_b"]) .ft-more', el => getComputedStyle(el).opacity)).toBe('0');
  // 카드 📁 메뉴 문구
  await page.hover('#project-grid .project-card[data-id="proj_1"]');
  await page.click('#project-grid .project-card[data-id="proj_1"] .card-folder-move');
  const items = await page.$$eval('.card-folder-menu .tab-add-item-name', els => els.map(e => e.textContent.trim()));
  expect(items[0]).toBe('폴더에서 빼기');
  expect(items).not.toContain('미분류로 빼기');
});

/* ── 2라운드(T-062 후속, 09-19 오후) — ① 이름변경 Esc 뒤 ⋯ · ② 목록 보기 이름 우선 · ③ 카드 📁 Esc · ④ 폴더 안 가져오기/복제 소속 · R1 기획 ── */

const moreSel = (key) => `.ft-cell:has([data-folder-key="${key}"]) .ft-more`;
async function renameViaMenu(page, key) {
  await page.hover(`.ft-cell:has([data-folder-key="${key}"])`);
  await page.click(moreSel(key));
  await page.click('.card-folder-menu [data-ft-act="rename"]');
  await expect(page.locator('#folder-tiles .ft-editing .fr-name-input')).toBeFocused();
}
async function expectMoreAlive(page, key) {
  // 인라인 display:none 이 남으면 hover·Tab 어느 쪽으로도 메뉴에 못 간다(09-19 이벨류 ①)
  expect(await page.$eval(moreSel(key), el => getComputedStyle(el).display)).not.toBe('none');
  expect(await page.$eval(moreSel(key), el => el.style.display)).toBe('');
  await page.hover(`.ft-cell:has([data-folder-key="${key}"])`);
  await expect.poll(() => page.$eval(moreSel(key), el => getComputedStyle(el).opacity)).toBe('1');
  await page.mouse.move(5, 790);
  await page.focus(`.ft-tile[data-folder-key="${key}"]`);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.dataset.folderMenu)).toBe(key);
  await page.keyboard.press('Enter');
  await expect(page.locator('.card-folder-menu [data-ft-act="rename"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.card-folder-menu')).toHaveCount(0);
}

test('ⓠ ① 타일 ⋯ → 이름 바꾸기 → Esc(취소)·Enter(같은 이름·다른 이름) 뒤에도 그 타일 ⋯ 가 살아 있다(hover·Tab·Enter)', async ({ page }) => {
  const errs = await boot(page, seed());
  // 편집 중엔 ⋯ 가 안 보인다(입력칸과 겹치지 않게) — CSS :has 로만
  await renameViaMenu(page, 'fold_a');
  expect(await page.$eval('.ft-cell:has(.ft-editing) .ft-more', el => getComputedStyle(el).display)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(page.locator('#folder-tiles .ft-editing')).toHaveCount(0);
  await expectMoreAlive(page, 'fold_a');
  // Enter — 같은 이름
  await renameViaMenu(page, 'fold_b');
  await page.keyboard.press('Enter');
  await expectMoreAlive(page, 'fold_b');
  // Enter — 다른 이름
  await renameViaMenu(page, 'fold_c');
  await page.locator('#folder-tiles .ft-editing .fr-name-input').fill('보관함');
  await page.keyboard.press('Enter');
  await expect(page.locator('.ft-tile[data-folder-key="fold_c"] .ft-name')).toHaveText('보관함');
  await expectMoreAlive(page, 'fold_c');
  expect(await page.evaluate(() => window.__calls.filter(c => c.name === 'rename').map(c => c.arg))).toEqual([{ id: 'fold_c', name: '보관함' }]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('ⓡ ② 목록 보기 압축형 — 긴 이름이 「N개·언제」보다 먼저 잘리지 않는다(이름 우선) · 격자 보기 크기는 그대로', async ({ page }) => {
  const d = seed();
  d.folders[1].name = '고디터 QA 아주 긴 폴더이름 열네';   // 한글 위주 14자 남짓
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, d);
  const box = (sel) => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  const gridBefore = await box('.ft-tile[data-folder-key="fold_b"]');
  await page.click('#view-toggle label[title="목록으로 보기"]');
  await expect(page.locator('#gallery-col')).toHaveClass(/is-list-mode/);
  const m = await page.$eval('.ft-cell:has([data-folder-key="fold_b"])', c => {
    const n = c.querySelector('.ft-name'), s = c.querySelector('.ft-sub'), t = c.querySelector('.ft-text');
    return { nameW: n.clientWidth, nameSW: n.scrollWidth, subW: s.clientWidth, textW: t.clientWidth };
  });
  // 이름은 «자기 글자 폭» 또는 «글자 칸 전체» 중 작은 쪽까지 다 쓴다 — 「N개·언제」에 자리를 뺏기지 않는다
  expect(m.nameW, JSON.stringify(m)).toBeGreaterThanOrEqual(Math.min(m.nameSW, m.textW) - 1);
  expect(m.nameW, JSON.stringify(m)).toBeGreaterThanOrEqual(m.subW);
  // 짧은 이름 타일은 「N개·언제」까지 온전히 보인다(공간이 있으면 줄이지 않는다)
  const short = await page.$eval('.ft-cell:has([data-folder-key="fold_c"])', c => {
    const n = c.querySelector('.ft-name'), s = c.querySelector('.ft-sub');
    return { n: n.scrollWidth <= n.clientWidth, s: s.scrollWidth <= s.clientWidth };
  });
  expect(short).toEqual({ n: true, s: true });
  // 격자 보기로 돌아오면 타일 크기 전후 동일(목록 보기 한정 규칙)
  await page.click('#view-toggle label[title="바둑판으로 보기"]');
  await expect(page.locator('#gallery-col')).not.toHaveClass(/is-list-mode/);
  expect(await box('.ft-tile[data-folder-key="fold_b"]')).toEqual(gridBefore);
});

test('ⓢ ③ 카드 📁 메뉴 Esc — 루트·폴더 안(경로 유지)에서 닫힘 · 새 폴더 입력칸 Esc 는 입력만 취소, 두 번째 Esc 에 메뉴 닫힘', async ({ page }) => {
  const errs = await boot(page, seed());
  const openCardMenu = async (id) => {
    await page.hover(`#project-grid .project-card[data-id="${id}"]`);
    await page.click(`#project-grid .project-card[data-id="${id}"] .card-folder-move`);
    await expect(page.locator('.card-folder-menu')).toHaveCount(1);
  };
  // 루트
  await openCardMenu('proj_1');
  expect(await page.$eval('.project-card[data-id="proj_1"] .card-folder-move', el => el.getAttribute('aria-expanded'))).toBe('true');
  await page.keyboard.press('Escape');
  await expect(page.locator('.card-folder-menu')).toHaveCount(0);
  expect(await page.$eval('.project-card[data-id="proj_1"] .card-folder-move', el => el.getAttribute('aria-expanded'))).toBe(null);
  // 폴더 안 — Esc 는 메뉴만 닫고 폴더 밖으로 나가지 않는다(우선순위: 메뉴 → 폴더 밖)
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  await openCardMenu('proj_4');
  await page.keyboard.press('Escape');
  await expect(page.locator('.card-folder-menu')).toHaveCount(0);
  await expect(page.locator('#gal-crumb')).toBeVisible();
  await expect(page.locator('#gal-crumb-name')).toHaveText('파테나');
  // 새 폴더 입력칸 — 첫 Esc = 입력 취소(메뉴 유지), 두 번째 Esc = 메뉴 닫기, 폴더는 안 만들어진다
  await openCardMenu('proj_4');
  await page.click('.card-folder-menu #cfm-new-folder');
  await expect(page.locator('.card-folder-menu .fr-name-input')).toBeFocused();
  await page.keyboard.type('만들지 않을 폴더');
  await page.keyboard.press('Escape');
  await expect(page.locator('.card-folder-menu')).toHaveCount(1);
  await expect(page.locator('.card-folder-menu .fr-name-input')).toHaveCount(0);
  await expect(page.locator('.card-folder-menu #cfm-new-folder')).toBeVisible();
  await expect(page.locator('#gal-crumb')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.card-folder-menu')).toHaveCount(0);
  await expect(page.locator('#gal-crumb')).toBeVisible();
  expect(await page.evaluate(() => window.__calls.filter(c => c.name === 'create').length)).toBe(0);
  // 메뉴가 닫힌 뒤의 Esc 는 다시 «폴더 밖으로»(닫힌 메뉴의 키 리스너가 남아 Esc 를 삼키지 않는다)
  await page.mouse.click(5, 500);
  await page.keyboard.press('Escape');
  await expect(page.locator('#gal-crumb')).toBeHidden();
  await expect(page.locator('#folder-zone')).toBeVisible();
  expect(errs, errs.join('\n')).toEqual([]);
});

test('ⓣ ④ 폴더 안에서 복제·가져오기 → 지금 보는 폴더 소속 · 루트·검색 중엔 배정 안 함', async ({ page }) => {
  const errs = await boot(page, seed());
  const assigns = () => page.evaluate(() => window.__calls.filter(c => c.name === 'assign').map(c => c.arg));
  // 폴더 안 — 복제
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  await page.evaluate(() => duplicateProjectUI({ stopPropagation() {} }, 'proj_4'));
  await page.waitForFunction(() => document.querySelector('.project-card[data-id="proj_dup1"]'));
  expect(await assigns()).toEqual([{ projectIds: ['proj_dup1'], folderId: 'fold_a' }]);
  expect(await cardIds(page)).toEqual(['proj_4', 'proj_5', 'proj_dup1']);
  // 폴더 안 — 가져오기(.gdt) 완료 훅이 결과를 받아 지금 폴더로
  await page.evaluate(() => window.__mockAddProject({ id: 'proj_9', name: '가져온 것', updatedAt: new Date().toISOString() }));
  await page.evaluate(() => window.__gdtOnImported({ ok: true, projectId: 'proj_9' }));
  await page.waitForFunction(() => document.querySelector('.project-card[data-id="proj_9"]'));
  expect((await assigns()).pop()).toEqual({ projectIds: ['proj_9'], folderId: 'fold_a' });
  // 결과 없이 불리는 옛 호출(글꼴 대체 뒤 새로고침)도 안 깨진다
  await page.evaluate(() => window.__gdtOnImported());
  const n = (await assigns()).length;
  // 루트 — 배정 없음
  await page.click('#gal-tab-projects');
  await page.evaluate(() => duplicateProjectUI({ stopPropagation() {} }, 'proj_1'));
  await page.waitForFunction(() => document.querySelector('.project-card[data-id="proj_dup2"]'));
  await page.evaluate(() => window.__mockAddProject({ id: 'proj_10', name: '루트로 가져옴', updatedAt: new Date().toISOString() }));
  await page.evaluate(() => window.__gdtOnImported({ ok: true, projectId: 'proj_10' }));
  // 검색 중(폴더 안에서 검색해도 전체 범위) — 배정 없음
  await page.click('.ft-tile[data-folder-key="fold_b"]');
  await page.fill('#proj-search-input', 'QA');
  await page.waitForTimeout(300);
  await page.evaluate(() => duplicateProjectUI({ stopPropagation() {} }, 'proj_6'));
  await page.evaluate(() => window.__mockAddProject({ id: 'proj_11', name: '검색 중 가져옴', updatedAt: new Date().toISOString() }));
  await page.evaluate(() => window.__gdtOnImported({ ok: true, projectId: 'proj_11' }));
  // 실패 결과(ok:false)도 배정 안 함
  await page.fill('#proj-search-input', '');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__gdtOnImported({ ok: false, projectId: 'proj_12' }));
  expect((await assigns()).length).toBe(n);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('ⓤ R1 기획(plan_*) 카드 — 📁 는 보이되 비활성(aria-disabled·이유 툴팁·메뉴 안 열림) · 타일/경로로 끌어도 안 받는다', async ({ page }) => {
  const d = seed();
  d.projects.push({ id: 'plan_1', name: '기획 하나', type: 'planning', updatedAt: iso(1), folderId: null });
  const errs = await boot(page, d);
  const btn = '#project-grid .project-card[data-id="plan_1"] .card-folder-move';
  await expect(page.locator(btn)).toHaveCount(1);
  expect(await page.$eval(btn, el => ({ dis: el.getAttribute('aria-disabled'), cls: el.classList.contains('is-disabled'), title: el.title, onclick: el.getAttribute('onclick'), disabledAttr: el.hasAttribute('disabled') })))
    .toEqual({ dis: 'true', cls: true, title: '기획 프로젝트는 아직 폴더에 넣을 수 없습니다', onclick: null, disabledAttr: false });
  await page.hover('#project-grid .project-card[data-id="plan_1"]');
  // page.click 은 aria-disabled 를 «못 누름»으로 보고 기다린다 — 사용자처럼 그 좌표를 진짜로 누른다
  const bb = await page.locator(btn).boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(150);
  await expect(page.locator('.card-folder-menu')).toHaveCount(0);
  expect(page.url()).toContain('projects.html');   // 카드 열기로 번지지 않았다
  // 드래그 — 타일이 받지 않는다(드롭 표시도 없음)
  const r = await dragCardTo(page, 'plan_1', '.ft-tile[data-folder-key="fold_a"]');
  expect(r.accepted).toBe(false);
  expect(r.hl).toBe(false);
  expect(await page.evaluate(() => window.__calls.filter(c => c.name === 'assign').length)).toBe(0);
  // 일반 카드 📁 는 그대로
  expect(await page.$eval('#project-grid .project-card[data-id="proj_1"] .card-folder-move', el => el.getAttribute('aria-disabled'))).toBe(null);
  const ok = await dragCardTo(page, 'proj_1', '.ft-tile[data-folder-key="fold_a"]');
  expect(ok.accepted).toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

/* ── 5라운드 마무리 polish3(T-062) — 폴더 밖 프로젝트의 「폴더에서 빼기」는 비활성 ── */
test('ⓥ polish3 카드 📁 — 폴더 밖 프로젝트(없는 폴더 가리키는 것 포함)의 「폴더에서 빼기」는 비활성(눌러도 아무 일 없음) · 폴더 안 프로젝트에선 그대로 동작', async ({ page }) => {
  const d = seed();
  d.projects.push({ id: 'proj_8', name: '없어진 폴더 소속', updatedAt: iso(4), folderId: 'fold_gone' });   // 화면상 「폴더 밖」
  const errs = await boot(page, d);
  const openCardMenu = async (id) => {
    await page.hover(`#project-grid .project-card[data-id="${id}"]`);
    await page.click(`#project-grid .project-card[data-id="${id}"] .card-folder-move`);
    await expect(page.locator('.card-folder-menu')).toHaveCount(1);
  };
  const firstItem = '.card-folder-menu .tab-add-item:first-child';
  const state = () => page.$eval(firstItem, el => ({
    text: el.textContent.trim(),
    dis: el.getAttribute('aria-disabled'),
    cls: el.classList.contains('is-disabled'),
    cur: el.classList.contains('is-current'),
    title: el.title,
    disabledAttr: el.hasAttribute('disabled'),
    cursor: getComputedStyle(el).cursor,
    opacity: Number(getComputedStyle(el).opacity),
  }));

  // ① 폴더 밖 카드 — 첫 항목이 흐리고 aria-disabled
  await openCardMenu('proj_1');
  const s1 = await state();
  expect(s1.text).toBe('폴더에서 빼기');
  expect({ dis: s1.dis, cls: s1.cls, cur: s1.cur, title: s1.title, disabledAttr: s1.disabledAttr, cursor: s1.cursor })
    .toEqual({ dis: 'true', cls: true, cur: true, title: '이미 폴더 밖에 있습니다', disabledAttr: false, cursor: 'not-allowed' });
  expect(s1.opacity).toBeLessThan(1);
  // 폴더 항목들은 멀쩡하다
  expect(await page.$$eval('.card-folder-menu .tab-add-item[data-goto]:not(:first-child)', els => els.map(e => e.getAttribute('aria-disabled'))))
    .toEqual([null, null, null]);
  // 사용자처럼 그 좌표를 진짜로 누른다 — 배정 없음, 메뉴도 안 닫힌다
  const bb = await page.locator(firstItem).boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(150);
  await expect(page.locator('.card-folder-menu')).toHaveCount(1);
  expect(await page.evaluate(() => window.__calls.filter(c => c.name === 'assign').length)).toBe(0);
  await page.keyboard.press('Escape');

  // ② 없는 폴더를 가리키는 카드도 화면상 「폴더 밖」 — 같은 규칙으로 비활성
  await openCardMenu('proj_8');
  expect((await state()).dis).toBe('true');
  await page.keyboard.press('Escape');

  // ③ 폴더 «안» 프로젝트 — 활성이고 누르면 진짜 빠진다
  await page.click('.ft-tile[data-folder-key="fold_a"]');
  await openCardMenu('proj_4');
  const s3 = await state();
  expect({ dis: s3.dis, cls: s3.cls, cur: s3.cur, cursor: s3.cursor }).toEqual({ dis: null, cls: false, cur: false, cursor: 'pointer' });
  await page.click(firstItem);
  await expect(page.locator('.card-folder-menu')).toHaveCount(0);
  await expect.poll(() => cardIds(page)).toEqual(['proj_5']);
  expect(await page.evaluate(() => window.__calls.filter(c => c.name === 'assign').map(c => c.arg)))
    .toEqual([{ projectIds: ['proj_4'], folderId: null }]);
  // 빠져나온 카드는 이제 폴더 밖 — 다시 열면 비활성
  await page.click('#gal-tab-projects');
  await openCardMenu('proj_4');
  expect((await state()).dis).toBe('true');
  expect(errs, errs.join('\n')).toEqual([]);
});

/* ── 5라운드 마무리(polish5, T-062) ── */
test('ⓥ polish5 목록 보기 타일이 가용 폭을 쓴다 — 긴 이름이 고정폭(~185px) 칸에 갇혀 잘리지 않는다', async ({ page }) => {
  const d = seed();
  d.folders[1].name = '2026년 9월 상세페이지 기획 보관함 — 아주 긴 폴더 이름';
  await page.setViewportSize({ width: 1400, height: 900 });
  const errs = await boot(page, d);
  await page.click('#view-toggle label[title="목록으로 보기"]');
  await expect(page.locator('#gallery-col')).toHaveClass(/is-list-mode/);
  const m = await page.$eval('.ft-cell:has([data-folder-key="fold_b"])', (c) => {
    const n = c.querySelector('.ft-name');
    const tiles = document.getElementById('folder-tiles');
    return {
      cut: n.scrollWidth > n.clientWidth + 1,
      tileW: Math.round(c.getBoundingClientRect().width),
      rowW: tiles.clientWidth,
      addW: Math.round(document.getElementById('ft-add-folder').getBoundingClientRect().width),
      shortW: Math.round(document.querySelector('.ft-cell:has([data-folder-key="fold_c"])').getBoundingClientRect().width),
    };
  });
  expect(m.cut, JSON.stringify(m)).toBe(false);                 // ★긴 이름이 안 잘린다
  expect(m.tileW, JSON.stringify(m)).toBeGreaterThan(200);      // 고정폭 칸(~185px)을 벗어나 제 폭을 쓴다
  expect(m.tileW, JSON.stringify(m)).toBeLessThanOrEqual(m.rowW + 1);   // 줄 폭은 안 넘는다
  expect(m.addW, JSON.stringify(m)).toBeLessThan(200);          // 「+ 새 폴더」는 제 내용만큼만(줄 통째로 차지 금지)
  expect(m.shortW, JSON.stringify(m)).toBeLessThan(m.tileW);    // 짧은 이름 타일은 그만큼만
  // 창이 좁아지면 이름만 말줄임되고 타일은 줄 폭 안에 머문다
  await page.setViewportSize({ width: 520, height: 900 });
  await page.waitForTimeout(120);
  const narrow = await page.$eval('.ft-cell:has([data-folder-key="fold_b"])', (c) => {
    const tiles = document.getElementById('folder-tiles');
    return { tileW: Math.round(c.getBoundingClientRect().width), rowW: tiles.clientWidth };
  });
  expect(narrow.tileW, JSON.stringify(narrow)).toBeLessThanOrEqual(narrow.rowW + 1);
  expect(errs, errs.join('\n')).toEqual([]);
});
