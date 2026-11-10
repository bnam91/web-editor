/* unreadable-projects-zone.dom.spec.js — 깨진 프로젝트를 «목록 밖 관리자 자리»에서 찾는다 (CORRUPT-PROJECT-NOT-FINDABLE-IN-APP-01)
 *
 * 현빈 2026-11-10: 목록과 분리 · 관리자만 보임 · 시작 토스트 없음 · 디스크 무이동.
 * ★관리자가 아니면 그 자리가 DOM 에 «아예» 없어야 한다(숨김이 아니라 없음).
 * 하네스 = 진짜 pages/projects.html · window.electronAPI 만 목(card-thumb-empty 와 같은 꼴). 앱 안 띄움.
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

function installMock({ admin, unreadable }) {
  const now = new Date().toISOString();
  window.__revealed = [];
  window.__unreadAsked = 0;
  const deny = { ok: false, code: 'not_admin', items: [] };
  window.electronAPI = {
    isElectron: true,
    listProjects: async () => [
      { id: 'proj_1', name: '원목 식탁 상세', updatedAt: now, folderId: null, thumbnail: null },
      { id: 'proj_2', name: '캠핑 의자 상세', updatedAt: now, folderId: null, thumbnail: null },
    ],
    listProjectBackups: async () => (admin ? { ok: true, items: [] } : deny),
    listUnreadableProjects: async () => { window.__unreadAsked++; return admin ? { ok: true, items: unreadable } : deny; },
    revealUnreadableProject: async (id) => { window.__revealed.push(id); return { ok: true }; },
    trashList: async () => ({ ok: true, items: [] }),
    getAuthState: async () => ({ signedIn: false }),
    folders: { list: async () => ({ ok: true, folders: [] }) },
  };
}
const BAD = { id: 'proj_1700000000001', name: '<img src=x onerror="window.__xss=1">깨진 상페', updatedAt: null, bytes: 15700000 };

async function boot(page, opts) {
  await serve(page);
  await page.addInitScript(installMock, opts);
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForFunction(() => document.querySelectorAll('#project-grid .project-card').length === 2);
  await page.waitForFunction(() => window.__unreadAsked > 0);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 100)));   // 물은 뒤 그리기까지 한 박자
}

test('G1 관리자 + 깨진 1개 → 목록 밖 자리에 1행 · 이름은 글자 그대로 · Finder 버튼이 그 id 로', async ({ page }) => {
  await boot(page, { admin: true, unreadable: [BAD] });
  const zone = page.locator('#unreadable-zone');
  await expect(zone).toHaveCount(1);
  expect(await zone.evaluate((z) => !!z.closest('#project-grid')), '목록(그리드) 안이면 안 된다').toBe(false);
  await expect(page.locator('#project-grid .project-card')).toHaveCount(2);   // 목록은 그대로
  const row = zone.locator('.unreadable-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(BAD.name);
  expect(await zone.locator('img').count(), '이름이 마크업으로 들어갔다(T-049)').toBe(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await row.locator('button').click();
  expect(await page.evaluate(() => window.__revealed)).toEqual([BAD.id]);
});

test('G2 관리자 아님 → 자리가 DOM 에 아예 없다', async ({ page }) => {
  await boot(page, { admin: false, unreadable: [BAD] });
  expect(await page.locator('#unreadable-zone').count()).toBe(0);
  expect(await page.locator('.unreadable-row').count()).toBe(0);
  expect(await page.evaluate(() => document.body.textContent.includes('열 수 없는 프로젝트'))).toBe(false);
});

test('G3 관리자 + 0개 → 자리가 없다', async ({ page }) => {
  await boot(page, { admin: true, unreadable: [] });
  expect(await page.locator('#unreadable-zone').count()).toBe(0);
});
