/* collab-inbox — SIX ①(2026-10-06 · 현빈 「종모양 svg 같은 데서 초대받았다는 노티 — 수락할지 거절할지」).
 *
 * ★양성대조 장면(지디 지정): «프로젝트 0 개 + 초대 1 건» — 옛 판은 편집기를 못 열어 초대를 볼 길이 0 이었다.
 *   진짜 pages/projects.html 을 띄우고(electronAPI 는 메모리 가짜) 종이 보이고 · 칸에서 수락 → 로컬 프로젝트가 만들어지고 · [열기] 가 그 프로젝트를 연다.
 * ⚠️실측(2026-10-06): 목록이 비면 이 페이지가 «샘플 프로젝트»(proj_sample)를 스스로 하나 만든다(initSampleProject) —
 *   그러니 「프로젝트 0 개」는 실제로는 «내 프로젝트 0 · 샘플만 · 편집기를 연 적 없음»이다. 수락으로 생긴 것은 샘플을 빼고 센다.
 * ★옛 판 대조: dev e7444dd3 의 projects.html 에는 종 자리(#collab-invite-badge)도 invites-badge.js 도 없다 — 보고에 판 sha 와 함께.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function serve(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
}

function installMock() {
  const saved = []; const metas = {}; const responds = [];
  window.__inbox = { saved, metas, responds, opened: [] };
  let invites = [{ inviteId: 'iv_1', collabId: 'cb_1', name: '같이 만드는 상세', invitedBy: 'owner@x.com' }];
  window.electronAPI = {
    isElectron: true,
    listProjects: async () => saved.map(p => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, folderId: null, collabRef: metas[p.id]?.collabRef || null })),
    saveProject: async (p) => { saved.push(p); return { ok: true }; },
    saveProjectMeta: async (id, m) => { metas[id] = { ...(metas[id] || {}), ...m }; return { ok: true }; },
    loadProjectMeta: async (id) => metas[id] || {},
    trashList: async () => ({ ok: true, items: [] }),
    getAuthState: async () => ({ signedIn: true, email: 'me@x.com' }),
    folders: { list: async () => ({ ok: true, folders: [] }) },
    collab: {
      invites: async () => ({ ok: true, invites, projects: [] }),
      respond: async (p) => { responds.push(p); invites = []; return p.action === 'accept' ? { ok: true, collabId: 'cb_1', name: '같이 만드는 상세', owner: 'owner@x.com', seq: 3 } : { ok: true }; },
    },
  };
}

test('IB1 ★프로젝트 0 개 + 초대 1 건 — 목록 화면에 종이 보이고 · 칸에서 수락하면 로컬 프로젝트가 생기고 · [열기] 가 그걸 연다', async ({ page }) => {
  await serve(page);
  await page.addInitScript(installMock);
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('collab-invite-badge') || document.body).display !== 'none'
    && !!document.querySelector('#collab-invite-badge svg'), null, { timeout: 15000 });
  const pre = await page.evaluate(() => ({
    mine: window.__inbox.saved.filter(p => p.id !== 'proj_sample').length,
    editorLoaded: typeof window.collabSync !== 'undefined',
    svg: !!document.querySelector('#collab-invite-badge svg'),
    emoji: /✉/.test(document.getElementById('collab-invite-badge').textContent),
    count: document.querySelector('#collab-invite-badge .collab-bell-count')?.textContent,
  }));
  expect(pre.mine, '★전제: 내 프로젝트 0 개(샘플 제외)').toBe(0);
  expect(pre.editorLoaded, '★전제: 편집기가 아니라 목록 화면이다').toBe(false);
  expect(pre.svg, '종이 SVG 가 아니다').toBe(true);
  expect(pre.emoji, '이모지 글자를 쓴다').toBe(false);
  expect(pre.count).toBe('1');
  await page.click('#collab-invite-badge');
  await page.waitForSelector('#collab-inbox-pop .collab-inbox-row');
  const row = await page.evaluate(() => document.querySelector('#collab-inbox-pop .collab-inbox-row').textContent);
  expect(row).toContain('같이 만드는 상세');
  expect(row).toContain('owner@x.com');
  // 진짜 사람이 하듯 openProject 를 가로채 «무엇을 여나»만 본다(페이지 이동은 하지 않게)
  await page.evaluate(() => { window.openProject = (id) => window.__inbox.opened.push(id); });
  await page.click('#collab-inbox-pop [data-accept="iv_1"]');
  await page.waitForSelector('#collab-inbox-open', { timeout: 10000 });
  const mid = await page.evaluate(() => ({ responds: window.__inbox.responds, saved: window.__inbox.saved.filter(p => p.id !== 'proj_sample').map(p => ({ id: p.id, name: p.name })),
    ref: Object.values(window.__inbox.metas)[0]?.collabRef, status: document.querySelector('#collab-inbox-pop .collab-inbox-status')?.textContent }));
  expect(mid.responds).toEqual([{ inviteId: 'iv_1', action: 'accept' }]);
  expect(mid.saved.length, '수락했는데 로컬 프로젝트가 안 생겼다(목록 화면엔 공장이 없었다)').toBe(1);
  expect(mid.ref && mid.ref.collabId).toBe('cb_1');
  expect(mid.status).toContain('참여했습니다');
  await page.click('#collab-inbox-open');
  const opened = await page.evaluate(() => window.__inbox.opened);
  expect(opened).toEqual([mid.saved[0].id]);
});

test('IB2 거절 — 서버에 decline 을 보내고 줄이 사라진다', async ({ page }) => {
  await serve(page);
  await page.addInitScript(installMock);
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForFunction(() => !!document.querySelector('#collab-invite-badge svg'), null, { timeout: 15000 });
  await page.click('#collab-invite-badge');
  await page.click('#collab-inbox-pop [data-decline="iv_1"]');
  await page.waitForFunction(() => !document.querySelector('#collab-inbox-pop .collab-inbox-row'));
  const r = await page.evaluate(() => ({ responds: window.__inbox.responds, saved: window.__inbox.saved.filter(p => p.id !== 'proj_sample').length }));
  expect(r.responds).toEqual([{ inviteId: 'iv_1', action: 'decline' }]);
  expect(r.saved).toBe(0);
});
