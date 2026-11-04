/* market-carry-images — 받는 쪽: 올린 본에 실려 온 패널·갤러리 그림을 새 프로젝트의 파일로 풀어 보통 항목으로 만든다. electronAPI 대역, 클릭은 진짜 마우스. 올리는 쪽은 tests/unit/market-carry-images.test.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const D = 'data:image/png;base64,AQID';
const remote = { version: 2, currentPageId: 'p1', pages: [{ id: 'p1', name: 'p', canvas: '' }], checklistItems: [], checklistSections: [],
  imageGallery: [{ id: 'aig_1', prompt: 'p', mime: 'image/png', src: D, carried: true }],
  assetsTree: [{ id: 'f', type: 'folder', children: [{ id: 'ast_1', type: 'image', name: 'a.png', src: D, carried: true }] }, { id: 'ast_notebg_01', type: 'image', src: D }] };

async function pull(page, failCh) {
  await bootApp(page);
  await page.evaluate(({ remote, failCh }) => {
    window.__saved = []; window.__files = []; window.__toasts = [];
    window.showToast = (t) => window.__toasts.push(String(t));
    const save = (ch, dir) => async (a) => { window.__files.push({ ch, projectId: a.projectId, b64: a.b64, mime: a.mime }); return ch === failCh ? { ok: false, error: '대역' } : { ok: true, id: 'n', blobPath: `${dir}/n_${window.__files.length}.png`, mime: a.mime }; };
    const fake = { ...(window.electronAPI || {}),
      saveProject: async (p) => { window.__saved.push(JSON.parse(JSON.stringify(p))); return { ok: true }; },
      listProjects: async () => [],
      assetsSaveFile: save('assets', 'assets'), aiSaveImage: save('ai', 'images'),
      market: { auth: async () => ({ ok: true }), list: async () => ({ ok: true, items: [{ account: 'acc', id: 'M', name: '원격', version: 'v2' }] }), pull: async () => ({ ok: true, project: { name: '원격', version: 'v2', data: JSON.stringify(remote), scratch: '[]' } }) } };
    Object.defineProperty(window, 'electronAPI', { value: fake, configurable: true, writable: true });
    const d = document.createElement('div'); d.id = 'mk-pane'; d.style.cssText = 'position:fixed;left:400px;top:100px;width:700px;height:500px;background:#111;z-index:99998;overflow:auto'; document.body.appendChild(d);
    window.renderMarketPane(d);
  }, { remote, failCh });
  await page.locator('.market-pull-btn').first().click();
  await expect.poll(() => page.evaluate(() => window.__saved.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__toasts.filter((t) => !t.startsWith('⏳')).length)).toBe(1);
  return page.evaluate(() => ({ p: window.__saved[0], files: window.__files, toast: window.__toasts.filter((t) => !t.startsWith('⏳'))[0] }));
}

test('받기: 실려 온 그림이 새 프로젝트의 파일이 되고 항목은 보통 꼴이다', async ({ page }) => {
  const { p, files, toast } = await pull(page);
  expect(files.map((f) => [f.ch, f.projectId, f.b64, f.mime])).toEqual([['assets', p.id, 'AQID', 'image/png'], ['ai', p.id, 'AQID', 'image/png']]);
  const node = p.assetsTree[0].children[0];
  expect(node.blobPath).toMatch(/^assets\//); expect(node.src).toBeUndefined(); expect(node.carried).toBeUndefined(); expect(node.id).toBe('ast_1');
  const g = p.imageGallery[0];
  expect(g.blobPath).toMatch(/^images\//); expect(g.src).toBeUndefined(); expect(g.carried).toBeUndefined(); expect(g.prompt).toBe('p');
  expect(toast).toMatch(/^✅ 받기 완료/);
});
test('음성 받기: 표식 없는 인라인 노드(앱 동봉 무늬)는 파일로 안 푼다', async ({ page }) => {
  const { p, files } = await pull(page);
  expect(files.length).toBe(2);
  expect(p.assetsTree[1]).toEqual(remote.assetsTree[1]);
});
test('받기: 파일로 못 풀면 말없이 넘기지 않는다, 패널 항목은 인라인으로 남아 그림을 안 잃는다', async ({ page }) => {
  const { p, toast } = await pull(page, 'assets');
  expect(toast).toMatch(/^⚠️ 받기 완료.*그림 1장/);
  const node = p.assetsTree[0].children[0];
  expect(node.src).toBe(D); expect(node.blobPath).toBeUndefined(); expect(node.carried).toBeUndefined();
});
