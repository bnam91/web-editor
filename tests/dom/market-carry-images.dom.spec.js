/* market-carry-images — 받는 쪽: 올린 본에 실려 온 패널·갤러리 그림을 새 프로젝트의 파일로 풀어 보통 항목으로 만든다. electronAPI 대역, 클릭은 진짜 마우스. 올리는 쪽은 tests/unit/market-carry-images.test.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const D = 'data:image/png;base64,' + B64;
const remote = { version: 2, currentPageId: 'p1', pages: [{ id: 'p1', name: 'p', canvas: '' }], checklistItems: [], checklistSections: [],
  imageGallery: [{ id: 'aig_1', prompt: 'p', mime: 'image/png', src: D, carried: true }],
  assetsTree: [{ id: 'f', type: 'folder', children: [{ id: 'ast_1', type: 'image', name: 'a.png', src: D, carried: true }] }, { id: 'ast_notebg_01', type: 'image', src: D }] };

async function pull(page, failCh, data = remote, { saveFail = null, scratch = '[]' } = {}) {
  await bootApp(page);
  await page.evaluate(({ remote, failCh, saveFail, scratch }) => {
    window.__saved = []; window.__files = []; window.__toasts = [];
    window.showToast = (t) => window.__toasts.push(String(t));
    const save = (ch, dir) => async (a) => { window.__files.push({ ch, projectId: a.projectId, b64: a.b64, mime: a.mime }); return ch === failCh ? { ok: false, error: '대역' } : { ok: true, id: 'n', blobPath: `${dir}/n_${window.__files.length}.png`, mime: a.mime }; };
    const fake = { ...(window.electronAPI || {}),
      saveProject: async (p) => { window.__saved.push(JSON.parse(JSON.stringify(p))); const n = window.__saved.length; if (saveFail?.at === n) { if (saveFail.how === 'throw') throw new Error('대역'); return { ok: false }; } return { ok: true }; },
      listProjects: async () => [],
      assetsSaveFile: save('assets', 'assets'), aiSaveImage: save('ai', 'images'),
      market: { auth: async () => ({ ok: true }), list: async () => ({ ok: true, items: [{ account: 'acc', id: 'M', name: '원격', version: 'v2' }] }), pull: async () => ({ ok: true, project: { name: '원격', version: 'v2', data: JSON.stringify(remote), scratch } }) } };
    Object.defineProperty(window, 'electronAPI', { value: fake, configurable: true, writable: true });
    const d = document.createElement('div'); d.id = 'mk-pane'; d.style.cssText = 'position:fixed;left:400px;top:100px;width:700px;height:500px;background:#111;z-index:99998;overflow:auto'; document.body.appendChild(d);
    window.renderMarketPane(d);
  }, { remote: data, failCh, saveFail, scratch });
  await page.locator('.market-pull-btn').first().click();
  await expect.poll(() => page.evaluate(() => window.__toasts.filter((t) => !t.startsWith('⏳')).length)).toBe(1);
  return page.evaluate(() => ({ p: window.__saved[window.__saved.length - 1], saves: window.__saved.length, files: window.__files, toast: window.__toasts.filter((t) => !t.startsWith('⏳'))[0], first: window.__saved[0] }));
}

test('받기: 실려 온 그림이 새 프로젝트의 파일이 되고 항목은 보통 꼴이다', async ({ page }) => {
  const { p, files, toast } = await pull(page);
  expect(files.map((f) => [f.ch, f.projectId, f.b64, f.mime])).toEqual([['assets', p.id, B64, 'image/png'], ['ai', p.id, B64, 'image/png']]);
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

/* 받은 값 검사(S3 MKT3). 앱 값: 회신의 ①칸 */
const X = 'x" onerror="window.__xss=1';
const box = (tree, gallery = []) => ({ ...remote, assetsTree: tree, imageGallery: gallery });
for (const [이름, n] of [
  ['주입 표식 있음', { id: 'a', type: 'image', carried: true, src: X }],
  ['주입 표식 없음', { id: 'a', type: 'image', src: X }],
  ['https', { id: 'a', type: 'image', src: 'https://evil.invalid/a.png' }],
  ['svg', { id: 'a', type: 'image', src: 'data:image/svg+xml;base64,PHN2Zz4=' }],
  ['시그니처 아님', { id: 'a', type: 'image', carried: true, src: 'data:image/png;base64,QUJDRA==' }],
  ['mime 과 시그니처가 다름', { id: 'a', type: 'image', carried: true, src: 'data:image/gif;base64,' + B64 }],
]) test('받기: 안 맞는 src 는 지우고 알린다, 파일을 안 만든다 — ' + 이름, async ({ page }) => {
  const { p, files, toast } = await pull(page, null, box([n]));
  expect(p.assetsTree[0].src).toBeUndefined(); expect(p.assetsTree[0].carried).toBeUndefined();
  expect(files.length).toBe(0);
  expect(toast).toMatch(/^⚠️ 받기 완료.*그림 1장/);
});
test('받기: https thumbSrc 는 말없이 지운다, 멀쩡한 src 는 남는다', async ({ page }) => {
  const { p, toast } = await pull(page, null, box([{ id: 'a', type: 'image', src: D, thumbSrc: 'https://evil.invalid/t.png' }]));
  expect(p.assetsTree[0].thumbSrc).toBeUndefined(); expect(p.assetsTree[0].src).toBe(D); expect(toast).toMatch(/^✅/);
});
for (const bp of ['proj.json', '../x/proj.json', 'images/../proj.json', 'images/..', 'assets/a.png']) test('받기: 갤러리 blobPath 는 images/ 바로 아래만 — ' + bp, async ({ page }) => {
  const { p, toast } = await pull(page, null, box([], [{ id: 'g', blobPath: bp }]));
  expect(p.imageGallery[0].blobPath).toBeUndefined(); expect(toast).toMatch(/^⚠️ 받기 완료.*그림 1장/);
});
test('받기: 패널 blobPath 는 assets/ 바로 아래만, 음성 맞는 값은 남는다', async ({ page }) => {
  const { p, toast } = await pull(page, null, box([{ id: 'a', type: 'image', blobPath: 'proj.json' }, { id: 'b', type: 'image', blobPath: 'assets/b.png' }], [{ id: 'g', blobPath: 'images/g.png' }]));
  expect(p.assetsTree[0].blobPath).toBeUndefined(); expect(p.assetsTree[1].blobPath).toBe('assets/b.png'); expect(p.imageGallery[0].blobPath).toBe('images/g.png');
  expect(toast).toMatch(/^⚠️ 받기 완료.*그림 1장/);
});
test('음성 받기: 동봉 무늬 svg 는 알림을 안 낸다(열 때 시드가 되채운다)', async ({ page }) => {
  const { toast } = await pull(page, null, box([{ id: 'ast_notebg_01', type: 'image', src: 'data:image/svg+xml;base64,PHN2Zz4=' }]));
  expect(toast).toMatch(/^✅/);
});
test('setAssetImageFromSrc: 주소의 따옴표가 속성을 못 빠져나간다, 음성 data 주소는 그대로', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(async ({ X, D }) => {
    const ab = document.createElement('div'); ab.className = 'asset-block'; document.body.appendChild(ab);
    window.setAssetImageFromSrc(ab, X); const bad = ab.querySelector('img');
    await new Promise((res) => { bad.addEventListener('error', res, { once: true }); setTimeout(res, 3000); });
    const out = { onerror: bad.hasAttribute('onerror'), xss: window.__xss || null, attr: bad.getAttribute('src') };
    window.setAssetImageFromSrc(ab, D); out.good = ab.querySelector('img').getAttribute('src'); ab.remove(); return out;
  }, { X, D });
  expect(r.onerror).toBe(false); expect(r.xss).toBe(null); expect(r.attr).toBe(X); expect(r.good).toBe(D);
});

/* 저장·토스트(S3 MKT3 ⑦) */
for (const how of ['ok', 'throw']) test('받기 저장 실패(' + how + '): ❌ 만, 파일을 안 푼다(고아 폴더 없음), 다시 안 저장한다', async ({ page }) => {
  const { files, toast, saves } = await pull(page, null, remote, { saveFail: { at: 1, how } });
  expect(toast).toBe('❌ 저장 실패'); expect(files.length).toBe(0); expect(saves).toBe(1);
});
test('받기: 처음 저장 뒤에 파일을 풀고 다시 저장한다, 처음 저장본엔 표식이 있다', async ({ page }) => {
  const { first, p, saves } = await pull(page);
  expect(saves).toBe(2); expect(first.imageGallery[0].carried).toBe(true); expect(p.imageGallery[0].carried).toBeUndefined(); expect(p.imageGallery[0].blobPath).toMatch(/^images\//);
});
test('음성 받기: 풀 것이 없으면 한 번만 저장한다', async ({ page }) => {
  const { saves, toast } = await pull(page, null, box([{ id: 'a', type: 'image', src: D }]));
  expect(saves).toBe(1); expect(toast).toMatch(/^✅/);
});
test('받기: 두 번째 저장이 실패하면 못 옮긴 장수를 말한다', async ({ page }) => {
  const { toast } = await pull(page, null, remote, { saveFail: { at: 2, how: 'throw' } });
  expect(toast).toMatch(/^⚠️ 받기 완료.*그림 2장/);
});
test('받기: 스크래치 실패와 그림 실패를 같이 말한다, 하나가 다른 하나를 안 가린다', async ({ page }) => {
  const { toast } = await pull(page, null, box([{ id: 'a', type: 'image', carried: true, src: 'nope' }]), { scratch: '{깨진' });
  expect(toast).toMatch(/^⚠️ 받기 완료, 스크래치·에셋·갤러리 그림 1장은 못 옮겼습니다/);
});
