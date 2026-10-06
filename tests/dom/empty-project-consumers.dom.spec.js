/* empty-project-consumers — 빈 프로젝트 모양 «한 벌»(js/io/empty-project.js)을 소비자 셋이 «실제로» 거치는가 (2026-10-06 지디 ④).
 *
 * 소비자(정의 자리 grep · 행위 자리): ⑴ 편집기 새 탭 js/tab-system.js createNewProjectTab · ⑵ 초대 수락 js/collab/accept.js link
 *   · ⑶ 목록 새 프로젝트 pages/projects.html createProject. (tests/unit/page-bg-default 는 «소스» 검사라 행위 소비자 수에 안 넣는다.)
 * ★쌍(합격 기준): empty-project.js 본문을 무력화하면 E1·E2·E3 «셋 다» 빨강 = 소비자 수.
 * 기대 모양은 «글자로» 박는다(empty-project.js 에서 읽으면 항등식): bg #777777(PAGE_BG_DEFAULT) · page_1 · 브랜치 main·dev.
 * ⚠️목록 화면은 비면 «샘플 프로젝트»(proj_sample)를 스스로 만든다 — ⑶ 은 샘플을 빼고 «방금 만든 것»을 본다.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const shapeOf = (p) => ({ page: p?.pages?.[0]?.id, bg: p?.pages?.[0]?.pageSettings?.bg, branches: Object.keys(p?.branches || {}).sort(), cur: p?.currentBranch });
const WANT = { page: 'page_1', bg: '#777777', branches: ['dev', 'main'], cur: 'dev' };

test('E1 편집기 새 탭(createNewProjectTab) — 공용 모양으로 만든다', async ({ page }) => {
  await bootApp(page);
  const p = await page.evaluate(async () => {
    let saved = null;
    window.IS_ELECTRON = true;
    window.electronAPI = Object.assign({}, window.electronAPI, { saveProject: async (x) => { saved = x; return { ok: true }; } });
    /* 탭 이동(openTabForProject)은 모듈 지역이라 가로챌 수 없다 — 저장 «뒤»에 불리고 가짜 API 에 loadProject 가 없어 던진다.
       이 시험은 «저장된 모양»만 본다 ⇒ 그 예외는 받아 둔다(조용히 버리지 않고 값으로 돌려준다). */
    let tabErr = null;
    try { await window.createNewProjectTab(); } catch (e) { tabErr = String(e && e.message || e); }
    return saved ? Object.assign(saved, { __tabErr: tabErr }) : null;
  });
  expect(p, '★전제: 저장이 불렸다').toBeTruthy();
  expect(shapeOf(p)).toEqual(WANT);
});

test('E2 초대 수락(collabAccept.link) — 공용 모양으로 만든다', async ({ page }) => {
  await bootApp(page);
  const p = await page.evaluate(async () => {
    let saved = null; const metas = {};
    window.electronAPI = Object.assign({}, window.electronAPI, {
      listProjects: async () => [], saveProject: async (x) => { saved = x; return { ok: true }; },
      saveProjectMeta: async (id, m) => { metas[id] = { ...(metas[id] || {}), ...m }; return { ok: true }; },
      loadProjectMeta: async (id) => metas[id] || {},
    });
    const r = await window.collabAccept.link({ collabId: 'cb_e2', name: '수락 프로젝트' });
    return r.ok ? saved : { err: r.reason };
  });
  expect(p && !p.err, `★전제: 수락이 성공했다 (${p && p.err})`).toBe(true);
  expect(shapeOf(p)).toEqual(WANT);
});

test('E3 목록 새 프로젝트(createProject) — 공용 모양으로 만든다', async ({ page }) => {
  const REPO = path.join(__dirname, '..', '..'); const ORIGIN = 'http://goditor.dom.test';
  const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
  await page.route(`${ORIGIN}/**`, async (route) => {
    const f = path.join(REPO, decodeURIComponent(new URL(route.request().url()).pathname));
    if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(f)] || 'text/plain', body: fs.readFileSync(f) });
  });
  await page.addInitScript(() => {
    const saved = []; window.__saved = saved;
    window.electronAPI = { isElectron: true, listProjects: async () => saved.map(p => ({ id: p.id, name: p.name, updatedAt: p.updatedAt })),
      saveProject: async (p) => { saved.push(p); return { ok: true }; }, trashList: async () => ({ ok: true, items: [] }),
      getAuthState: async () => ({ signedIn: false }), folders: { list: async () => ({ ok: true, folders: [] }) } };
  });
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForFunction(() => typeof window.createProject === 'function');
  const p = await page.evaluate(async () => {
    window.openProject = () => {};               // 편집기로 이동은 이 시험 밖
    await window.createProject();
    return window.__saved.filter(x => x.id !== 'proj_sample').pop() || null;
  });
  expect(p, '★전제: 새 프로젝트가 저장됐다(샘플 제외)').toBeTruthy();
  expect(shapeOf(p)).toEqual(WANT);
});
