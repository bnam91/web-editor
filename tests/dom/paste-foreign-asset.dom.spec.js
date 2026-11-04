/* paste-foreign-asset.dom.spec.js — 저장할 때 다른 프로젝트 자산 주소를 이 프로젝트 것으로 바꾸는가.
 * 자산 IPC 는 스텁이다. 진짜 복사·붙여넣기·원본 삭제·재시작은 앱 측정값(회신)에 있다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const A = 'goya-asset://pA/h.png';
const run = (page, canvas, readOk) => page.evaluate(async ([canvas, readOk]) => {
  const m = await import('/js/io/asset-externalize.js');
  const calls = { read: 0, save: [] };
  window.electronAPI = { ...(window.electronAPI || {}),
    assetsReadAsDataUri: async () => { calls.read++; return readOk ? { ok: true, dataUri: 'data:image/png;base64,AAAA' } : { ok: false, error: 'not found' }; },
    assetsSaveCanvasImage: async (a) => { calls.save.push(a); return { ok: true, url: `goya-asset://${a.projectId}/h.png` }; } };
  const data = { pages: [{ canvas }, { canvas }] };
  await m.adoptForeignAssets(data, 'pB');
  await m.adoptForeignAssets(data, 'pB');
  return { pages: data.pages.map((p) => p.canvas), calls };
}, [canvas, readOk]);

test('다른 프로젝트 주소는 어느 꼴이든 이 프로젝트 주소가 되고, 한 번만 읽는다', async ({ page }) => {
  const errs = await bootApp(page);
  const html = `<img src="${A}"><div style="background: url(&quot;${A}&quot;) center"></div><div data-cols="[{&quot;imgSrc&quot;:&quot;${A}&quot;}]"></div>`;
  const r = await run(page, html, true);
  const want = html.split('pA').join('pB');
  expect(r.pages).toEqual([want, want]);
  expect(r.calls.read).toBe(1);
  expect(r.calls.save).toEqual([{ projectId: 'pB', b64: 'AAAA', mime: 'image/png' }]);
  expect(errs).toEqual([]);
});
test('[음성] 원본을 못 읽으면 주소를 그대로 두고 캔버스를 안 비운다', async ({ page }) => {
  const errs = await bootApp(page);
  const html = `<img src="${A}"><p>글</p>`;
  const r = await run(page, html, false);
  expect(r.pages).toEqual([html, html]);
  expect(r.calls.save).toEqual([]);
  expect(errs).toEqual([]);
});
test('[음성] 같은 프로젝트 주소는 안 읽고 안 바꾼다', async ({ page }) => {
  const errs = await bootApp(page);
  const html = '<img src="goya-asset://pB/h.png">';
  const r = await run(page, html, true);
  expect(r.pages).toEqual([html, html]);
  expect(r.calls.read).toBe(0);
  expect(errs).toEqual([]);
});
test('[음성] 영상 자산은 안 건드린다', async ({ page }) => {
  const errs = await bootApp(page);
  const html = '<video src="goya-asset://pA/v.mp4"></video>';
  const r = await run(page, html, true);
  expect(r.pages).toEqual([html, html]);
  expect(r.calls.read).toBe(0);
  expect(errs).toEqual([]);
});
