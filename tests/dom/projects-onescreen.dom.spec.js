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
  window.electronAPI = {
    isElectron: true,
    listProjects: async () => db.projects.map(p => ({ ...p })),
    trashList: async () => ({ ok: true, items: [] }),
    getAuthState: async () => ({ signedIn: false }),
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
