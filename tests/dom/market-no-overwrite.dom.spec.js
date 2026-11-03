/* market-no-overwrite — 마켓 받기·머지가 로컬 프로젝트를 안 덮는다. gh·네트워크 없음: electronAPI 를 페이지에서 대역으로 둔다, 클릭은 진짜 마우스.
 * 자: saveProject 에 넘어간 객체의 id·name · 내용. 앱 값은 격리 앱에서 쟀다(회신 S3-market). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const LOCAL = 'proj_1000000000001'; const M = 'mk_M';
const sec = (t) => `<div class="section-block" id="sec_a" data-section="1"><div class="section-inner"><div class="text-block" id="t_a"><div class="tb-body">${t}</div></div></div></div>`;
const data = (t, extra = {}) => ({ version: 2, currentPageId: 'p1', pages: [{ id: 'p1', name: 'p', canvas: sec(t) }], checklistItems: [], checklistSections: [], imageGallery: [], assetsTree: [], ...extra });

async function open(page, remote) {
  await bootApp(page);
  await page.evaluate(async ({ LOCAL, M, local, remote }) => {
    window.__saved = [];
    const api = window.electronAPI || {};
    const fake = { ...api,
      saveProject: async (p) => { window.__saved.push(JSON.parse(JSON.stringify(p))); return { ok: true }; },
      loadProject: async (id) => (id === LOCAL ? JSON.parse(JSON.stringify(local)) : null),
      listProjects: async () => [{ id: LOCAL, name: local.name, marketRef: local.marketRef }],
      market: { auth: async () => ({ ok: true }), list: async () => ({ ok: true, items: [{ account: 'acc', id: M, name: '원격 이름', version: 'v2', updatedAt: '2026-02-02' }] }), pull: async () => ({ ok: true, project: { id: M, name: '원격 이름', account: 'acc', version: 'v2', updatedAt: '2026-02-02', data: JSON.stringify(remote), scratch: '[]' } }), push: async () => ({ ok: false }) } };
    Object.defineProperty(window, 'electronAPI', { value: fake, configurable: true, writable: true });
    const d = document.createElement('div'); d.id = 'mk-pane'; d.style.cssText = 'position:fixed;left:400px;top:100px;width:700px;height:500px;background:#111;z-index:99998;overflow:auto'; document.body.appendChild(d);
    window.renderMarketPane(d);
  }, { LOCAL, M, remote, local: { id: LOCAL, name: '내 복사본', createdAt: '2020-01-02', ...data('내 글'), marketRef: { account: 'acc', id: M, version: 'v1', pulledAt: '2026-01-01' } } });
}
const saved = async (page) => { await expect.poll(() => page.evaluate(() => window.__saved.length)).toBe(1); return page.evaluate(() => window.__saved[0]); };
const body = (p) => p.pages[0].canvas;

test('받기: 받은 data 에 로컬 id·name 이 들어 있어도 새 id 로 저장한다', async ({ page }) => {
  await open(page, data('원격 글', { id: LOCAL, name: '원격이 심은 이름' }));
  await page.locator('.market-pull-btn').first().click();
  const p = await saved(page);
  expect(p.id).not.toBe(LOCAL); expect(p.id).toMatch(/^proj_\d+$/); expect(p.name).toBe('원격 이름 (받음)'); expect(body(p)).toContain('원격 글');
});
test('음성 받기: 올리는 꼴 그대로면 새 프로젝트, marketRef 박힘', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.locator('.market-pull-btn').first().click();
  const p = await saved(page);
  expect(p.id).not.toBe(LOCAL); expect(p.name).toBe('원격 이름 (받음)'); expect(p.marketRef.version).toBe('v2'); expect(p.pages.length).toBe(1);
});
test('머지 기본(내것): 내 복사본 id 로 저장하지 않는다', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  expect(p.id).not.toBe(LOCAL); expect(p.name).toBe('원격 이름 (머지)'); expect(body(p)).toContain('내 글'); expect(p.marketRef.version).toBe('v2');
});
test('머지 원격 고름: 새 프로젝트에 원격 글이 들어가고 내 복사본 id 로 안 간다', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-list input[type=radio][value=theirs]').first().click();
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  expect(p.id).not.toBe(LOCAL); expect(body(p)).toContain('원격 글');
});
