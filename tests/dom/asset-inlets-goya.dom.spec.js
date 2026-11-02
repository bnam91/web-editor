/* asset-inlets-goya.dom.spec.js — BIG-IMAGE-INSERT-RENDERER-OOM-01 · 에셋 패널·AI 갤러리·addAssetBlock 이 data URL 을 캔버스에 쌓지 않는지의 자.
 * 자산 IPC 만 스텁 · 그 주소는 /__asset/ 로 뜬다. 메모리·충돌·실파일은 앱 값(회신)에 있다.
 * ⛔이 자가 안 재는 것: 렌더러 메모리 · 패널에서 끌어 넣기(같은 _assetsCanvasSrc) · goya-asset 프로토콜 실제 응답(Image 를 대역한다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');
const DATA = 'data:image/png;base64,' + PNG.toString('base64');

async function setup(page, saved = true) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.route('**/__asset/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));   // bootApp 뒤 — 나중 route 가 먼저 받는다
  await page.evaluate(async (saved) => {
    window.activeProjectId = 'p1'; history.replaceState(null, '', location.pathname + '?project=p1'); window.__calls = { save: 0, read: 0, del: 0 };
    const over = {
      assetsSaveCanvasImage: async () => { window.__calls.save++; return saved ? { ok: true, url: `${location.origin}/__asset/h${window.__calls.save}.png` } : { ok: false }; },
      assetsReadFile: async () => { window.__calls.read++; return { ok: false }; },
      assetsDeleteFile: async () => { window.__calls.del++; return { ok: true }; },
    };
    window.electronAPI = new Proxy(window.electronAPI, { get: (t, k) => (k in over ? over[k] : t[k]) });   // ⛔{...} 로 펼치지 마라 — 하네스 가짜는 Proxy 다
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.__sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(window.__sec);
  }, saved);
  return errs;
}
const look = (page) => page.evaluate(() => { const all = document.querySelectorAll('#canvas .asset-block'); const b = [...all].pop(); return { n: all.length, src: b?.dataset.imgSrc || null, img: b?.querySelector('img.asset-img')?.getAttribute('src') || null, inline: window.getSerializedCanvas().includes('data:image/png;base64'), calls: window.__calls }; });
// goya-asset 는 이 하네스에서 안 뜬다 — 패널의 확인용 Image 만 대역한다(칸 <img> 는 그대로).
const fakeProbe = (page, ok) => page.evaluate((ok) => { const R = window.Image; window.Image = class { set src(v) { if (String(v).startsWith('goya-asset:')) setTimeout(() => (ok ? this.onload?.() : this.onerror?.())); else { const i = new R(); i.onload = () => this.onload?.(); i.onerror = () => this.onerror?.(); i.src = v; } } }; }, ok);
const addNode = (page, node) => page.evaluate((node) => { window.assetsAddNode(null, node); }, node);
const FILE_NODE = { id: 'ast_a', type: 'image', name: 'a.png', blobPath: 'assets/ast_a.png', mime: 'image/png' };

test.describe('에셋 패널', () => {
  test('파일 있는 항목은 다시 읽지도 새로 만들지도 않고 그 주소를 쓴다', async ({ page }) => {
    await setup(page); await fakeProbe(page, true); await addNode(page, FILE_NODE);
    expect(await page.evaluate(() => window.assetsSendToCanvas('ast_a'))).toBe(true);
    const v = await look(page);
    expect(v.src).toBe('goya-asset://p1/ast_a.png');
    expect(v.inline).toBe(false);
    expect(v.calls).toEqual({ save: 0, read: 0, del: 0 });
  });
  test('[음성] 캔버스에 쓴 항목을 패널에서 지워도 파일은 남고, 안 쓴 항목은 파일까지 지운다', async ({ page }) => {
    await setup(page); await fakeProbe(page, true); await addNode(page, FILE_NODE); await addNode(page, { ...FILE_NODE, id: 'ast_b', blobPath: 'assets/ast_b.png' });
    await page.evaluate(() => { window.confirm = () => true; return window.assetsSendToCanvas('ast_a'); });
    await page.evaluate(() => window.assetsDeleteNode('ast_a'));
    expect((await look(page)).calls.del).toBe(0);
    await page.evaluate(() => window.assetsDeleteNode('ast_b'));
    expect((await look(page)).calls.del).toBe(1);
    expect(await page.evaluate(() => [window.assetsFindNode('ast_a'), window.assetsFindNode('ast_b')])).toEqual([null, null]);
  });
  test('[음성] 파일이 없으면 블럭을 안 만들고 말한다', async ({ page }) => {
    await setup(page); await fakeProbe(page, false); await addNode(page, FILE_NODE);
    expect(await page.evaluate(() => window.assetsSendToCanvas('ast_a'))).toBe(false);
    expect((await look(page)).n).toBe(0);
    expect(await page.evaluate(() => document.getElementById('editor-toast')?.textContent)).toContain('이미지 로드 실패');
  });
  test('파일 없는 인라인 항목은 자산으로 빼서 넣는다', async ({ page }) => {
    await setup(page); await addNode(page, { id: 'ast_i', type: 'image', name: 'i.png', src: DATA });
    expect(await page.evaluate(() => window.assetsSendToCanvas('ast_i'))).toBe(true);
    const v = await look(page);
    expect(v.src).toMatch(/\/__asset\/h1\.png$/);
    expect(v.inline).toBe(false);
  });
});

