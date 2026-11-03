/* asset-upload-goya.dom.spec.js — BIG-IMAGE-INSERT-RENDERER-OOM-01 · loadImageToAsset 이 data URL 대신 자산 URL 을 넣는지의 자.
 * 자산 IPC 만 스텁이다(나머지는 하네스 가짜). 돌려주는 주소는 실제로 그림이 뜨는 /__asset/ — goya-asset:// 는 여기서 안 떠 onerror 가 DOM 을 바꾼다.
 * 실제 파일·충돌·저장·다시 열기는 앱 측정값(회신)에 있다.
 * ⛔이 자가 안 재는 것: 렌더러 메모리 · goya-asset 프로토콜로 실제 그림이 뜨는지.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');
const GIF = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64');

async function setup(page, saved) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.route('**/__asset/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));   // bootApp 뒤 — 나중 route 가 먼저 받는다
  await page.evaluate((saved) => {
    window.activeProjectId = 'p1';
    window.__saves = [];
    const save = async (a) => { window.__saves.push(a.mime); return saved ? { ok: true, url: `${location.origin}/__asset/h${window.__saves.length}.png` } : { ok: false }; };
    window.electronAPI = new Proxy(window.electronAPI, { get: (t, k) => (k === 'assetsSaveCanvasImage' ? save : t[k]) });   // ⛔{...} 로 펼치지 마라 — 하네스 가짜는 Proxy 라 다른 API 가 다 사라진다
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const i = document.createElement('input'); i.type = 'file'; i.id = 'f'; document.body.appendChild(i);
  }, saved);
  await page.evaluate(async () => { await window.addSection(); const sec = [...document.querySelectorAll('#canvas .section-block')].pop(); window.selectSection(sec); await window.addAssetBlock('img1'); window.__ab = sec.querySelector('.asset-block'); });
  return errs;
}
async function upload(page, name, mimeType, buffer) {
  await page.setInputFiles('#f', { name, mimeType, buffer });
  await page.evaluate(() => window.loadImageToAsset(window.__ab, document.getElementById('f').files[0]));
  await page.waitForFunction(() => window.__ab.classList.contains('has-image'));
}
const look = (page) => page.evaluate(() => { const b = document.querySelector('#canvas .asset-block'); return { src: b?.dataset.imgSrc || null, motion: b?.dataset.motion || null, gifSrc: b?.dataset.gifSrc || null, img: b?.querySelector('img.asset-img')?.getAttribute('src') || null, inline: window.getSerializedCanvas().includes('data:image/png;base64') }; });

test('PNG 는 자산 URL 로 들어가 직렬화에 base64 가 없다', async ({ page }) => {
  const errs = await setup(page, true);
  await upload(page, 'a.png', 'image/png', PNG);
  const v = await look(page);
  expect(v.src).toMatch(/\/__asset\/h1\.png$/);
  expect(v.img).toBe(v.src);
  expect(v.inline).toBe(false);
  expect(await page.evaluate(() => window.__saves)).toEqual(['image/png']);
  expect(errs).toEqual([]);
});
test('[음성] 자산 저장이 실패하면 data URL 로 넣어 그림을 잃지 않는다', async ({ page }) => {
  const errs = await setup(page, false);
  await upload(page, 'a.png', 'image/png', PNG);
  const v = await look(page);
  expect(v.src).toMatch(/^data:image\/png;base64,/);
  expect(v.img).toBe(v.src);
  expect(errs).toEqual([]);
});
test('[음성] GIF 는 움직임 표시를 잃지 않는다', async ({ page }) => {
  const errs = await setup(page, true);
  await upload(page, 'a.gif', 'image/gif', GIF);
  const v = await look(page);
  expect(v.motion).toBe('gif');
  expect(v.gifSrc).toMatch(/\/__asset\//);
  expect(v.src).toMatch(/\/__asset\//);
  expect(errs).toEqual([]);
});
test('[음성] ⌘Z 로 빠지고 다시 실행으로 같은 자산 URL 이 돌아온다', async ({ page }) => {
  const errs = await setup(page, true);
  await upload(page, 'a.png', 'image/png', PNG);
  const before = (await look(page)).src;
  await page.evaluate(() => window.undo());
  await expect.poll(async () => (await look(page)).src).toBe(null);
  await page.evaluate(() => window.redo());
  await expect.poll(async () => (await look(page)).src).toBe(before);
  expect(errs).toEqual([]);
});
