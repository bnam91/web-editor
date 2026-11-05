/* paste-foreign-asset.dom.spec.js — 저장할 때 다른 프로젝트 자산 주소를 이 프로젝트 것으로 바꾸는가.
 * 자산 IPC 는 스텁이다. 진짜 복사·붙여넣기·원본 삭제·재시작은 앱 측정값(회신)에 있다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const A = 'goya-asset://pA/h.png';
const run = (page, canvas, readOk, saveOk = true) => page.evaluate(async ([canvas, readOk, saveOk]) => {
  const m = await import('/js/io/asset-externalize.js');
  const calls = { read: 0, save: [], toast: [] };
  window.showToast = (t) => calls.toast.push(t);
  window.electronAPI = { ...(window.electronAPI || {}),
    assetsReadAsDataUri: async () => { calls.read++; return readOk ? { ok: true, dataUri: 'data:image/png;base64,AAAA' } : { ok: false, error: 'not found' }; },
    assetsSaveCanvasImage: async (a) => { calls.save.push(a); return saveOk ? { ok: true, url: `goya-asset://${a.projectId}/h.png` } : { ok: false }; } };
  const data = { pages: [{ canvas }, { canvas }] };
  await m.adoptForeignAssets(data, 'pB');
  await m.adoptForeignAssets(data, 'pB');
  const synced = { pages: [{ canvas }] };   // 동기 저장 길 — 라이브 DOM 의 옛 주소로 만든 스냅샷
  m.applyAdoptedAssets(synced, 'pB');
  const other = { pages: [{ canvas }] };
  m.applyAdoptedAssets(other, 'pC');
  return { pages: data.pages.map((p) => p.canvas), calls, synced: synced.pages[0].canvas, other: other.pages[0].canvas };
}, [canvas, readOk, saveOk]);

test('다른 프로젝트 주소는 어느 꼴이든 이 프로젝트 주소가 되고, 한 번만 읽는다', async ({ page }) => {
  const errs = await bootApp(page);
  const html = `<img src="${A}"><div style="background: url(&quot;${A}&quot;) center"></div><div data-cols="[{&quot;imgSrc&quot;:&quot;${A}&quot;}]"></div>`;
  const r = await run(page, html, true);
  const want = html.split('pA').join('pB');
  expect(r.pages).toEqual([want, want]);
  expect(r.calls.read).toBe(1);
  expect(r.calls.save).toEqual([{ projectId: 'pB', b64: 'AAAA', mime: 'image/png' }]);
  expect(r.calls.toast).toEqual([]);
  expect(r.synced).toBe(want);      // 동기 저장은 IPC 없이 옮겨 둔 짝을 쓴다
  expect(r.other).toBe(html);       // 그 짝은 그 프로젝트 것뿐이다
  expect(errs).toEqual([]);
});
test('[음성] 원본을 못 읽으면 주소를 그대로 두고 캔버스를 안 비운다', async ({ page }) => {
  const errs = await bootApp(page);
  const html = `<img src="${A}"><p>글</p>`;
  const r = await run(page, html, false);
  expect(r.pages).toEqual([html, html]);
  expect(r.calls.save).toEqual([]);
  expect(r.synced).toBe(html);      // 못 옮긴 칸은 동기 저장도 그대로
  expect(r.calls.toast.length).toBe(1);   // 저장 두 번에 말은 한 번
  expect(errs).toEqual([]);
});
test('[음성] 복사본을 못 쓰면 주소를 그대로 두고 저장 두 번에 한 번만 말한다', async ({ page }) => {
  const errs = await bootApp(page);
  const html = `<img src="${A}">`;
  const r = await run(page, html, true, false);
  expect(r.pages).toEqual([html, html]);
  expect(r.calls.toast.length).toBe(1);
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
test('종료 길: 멈추면 도는 저장도 지금 장까지만 읽고, 옮겨 둔 짝은 적용하고, 새로는 안 읽는다', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(async () => {
    const m = await import('/js/io/asset-externalize.js');
    let read = 0;
    window.electronAPI = { ...(window.electronAPI || {}),
      assetsReadAsDataUri: async () => { if (++read === 1) m.stopAdoptingForQuit(); return { ok: true, dataUri: 'data:image/png;base64,AAAA' }; },
      assetsSaveCanvasImage: async (a) => ({ ok: true, url: `goya-asset://${a.projectId}/n${read}.png` }) };
    const html = '<img src="goya-asset://pA/a.png"><img src="goya-asset://pA/b.png">';
    const inflight = { pages: [{ canvas: html }] };
    await m.adoptForeignAssets(inflight, 'pB');
    const after = { pages: [{ canvas: html }] };
    await m.adoptForeignAssets(after, 'pB');
    return { read, inflight: inflight.pages[0].canvas, after: after.pages[0].canvas };
  });
  const want = '<img src="goya-asset://pB/n1.png"><img src="goya-asset://pA/b.png">';
  expect(r.read).toBe(1);
  expect(r.inflight).toBe(want);
  expect(r.after).toBe(want);
  expect(errs).toEqual([]);
});
test('자동저장의 localStorage 본은 옮겨 둔 새 주소다 — 라이브 DOM 은 옛 주소여도 (즉시 저장도)', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(async () => {
    const m = await import('/js/io/asset-externalize.js');
    window.activeProjectId = 'pB'; history.replaceState(null, '', location.pathname + '?project=pB');
    window.electronAPI = { ...(window.electronAPI || {}),
      assetsReadAsDataUri: async () => ({ ok: true, dataUri: 'data:image/png;base64,AAAA' }),
      assetsSaveCanvasImage: async (a) => ({ ok: true, url: `goya-asset://${a.projectId}/h.png` }) };
    await m.adoptForeignAssets({ pages: [{ canvas: '<img src="goya-asset://pA/h.png">' }] }, 'pB');
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((x) => x.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="s1"><div class="section-hitzone"></div><div class="section-inner"><img src="goya-asset://pA/h.png"></div></div>');
    const k = 'web-editor-autosave__pB';
    localStorage.removeItem(k);
    window.scheduleAutoSave();
    for (let i = 0; i < 80 && !localStorage.getItem(k); i++) await new Promise((z) => setTimeout(z, 50));
    const auto = localStorage.getItem(k) || '';
    localStorage.removeItem(k);
    await window.flushSave();
    return { auto, flush: localStorage.getItem(k) || '', dom: c.innerHTML };
  });
  for (const v of [r.auto, r.flush]) { expect(v).toContain('goya-asset://pB/h.png'); expect(v).not.toContain('goya-asset://pA/'); }
  expect(r.dom).toContain('goya-asset://pA/h.png');
  expect(errs).toEqual([]);
});
