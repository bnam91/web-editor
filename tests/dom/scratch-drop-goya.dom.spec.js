/* scratch-drop-goya.dom.spec.js — BIG-IMAGE-INSERT-RENDERER-OOM-01 · 스크래치 장을 진짜 마우스로 캔버스에 놓을 때 data URL 대신 자산 URL 이 들어가는지의 자.
 * 자산 IPC 는 스텁 · 돌려주는 주소는 실제로 뜨는 /__asset/(asset-upload-goya 와 같은 까닭). 메모리·충돌은 앱 값(회신)에 있다.
 * ⛔이 자가 안 재는 것: 렌더러 메모리 · 배경/카드/그리드 칸으로 놓는 갈래(같은 commitScratchDropAt 이지만 여기선 insert 만).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const CARD = 'sp_goya';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');

async function setup(page, saved) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  await bootApp(page);
  await page.evaluate(() => { const c = window.confirm; window.confirm = () => true; window.unlockMainBranch(); window.confirm = c; });   // 하네스 브랜치가 main 이라 판에 따라 잠금이 걸려 캔버스 pointer-events 가 꺼진다(실측)
  await page.route('**/__asset/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));   // bootApp 뒤 — 나중 route 가 먼저 받는다
  await page.evaluate(async (saved) => {
    window.activeProjectId = 'p1'; window.__saves = 0;
    const save = async () => { window.__saves++; return saved ? { ok: true, url: `${location.origin}/__asset/h${window.__saves}.png` } : { ok: false }; };
    window.electronAPI = new Proxy(window.electronAPI, { get: (t, k) => (k === 'assetsSaveCanvasImage' ? save : t[k]) });   // ⛔{...} 로 펼치지 마라 — 하네스 가짜는 Proxy 라 다른 API 가 다 사라져 main 잠금으로 빠진다(실측)
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.selectSection([...c.querySelectorAll('.section-block')].pop()); await window.addTextBlock(); window.deselectAll?.(); window.applyZoom?.(50);
  }, saved);
  const src = await page.evaluate(() => { const v = document.createElement('canvas'); v.width = 240; v.height = 140; v.getContext('2d').fillRect(0, 0, 240, 140); return v.toDataURL('image/png'); });
  await page.evaluate(async ([src, id]) => { await window._scratchAddAndSaveFx(src, -320, 40, 200, undefined, id, undefined); }, [src, CARD]);
  await page.waitForFunction((id) => { const im = document.querySelector(`.scratch-item[data-scratch-id="${id}"] img`); return im && im.complete && im.naturalWidth > 0; }, CARD);
  await page.evaluate(() => window.clearHistory?.());
  // 화면이 멈춘 뒤 잰다(줌 전환 중엔 카드가 파일 패널 밑, 놓을 자리는 canvas-scaler 를 맞힌다 — 실측)
  await page.evaluate(() => { window.__s = null; });
  await page.waitForFunction((id) => { const cd = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`); const q = cd.getBoundingClientRect(); const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); const t = document.querySelector('#canvas .section-inner > .row, #canvas .section-inner > .gap-block'); const r = t.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2 + 2, r.top + r.height / 2 + 1); const key = top?.closest('.scratch-item') && hit && t.contains(hit) ? [q.left, q.top, q.width, r.left, r.top, r.width].map(Math.round).join() : null; const prev = window.__s; window.__s = key; return !!key && key === prev; }, CARD, { polling: 100 });
}
const center = (page, sel) => page.evaluate((sel) => { const q = document.querySelector(sel).getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, sel);
const CARD_SEL = `.scratch-item[data-scratch-id="${CARD}"]`;
async function dropOnCanvas(page) {
  const [cx, cy] = await center(page, CARD_SEL);
  const [dx, dy] = await center(page, '#canvas .section-inner > .row, #canvas .section-inner > .gap-block');
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 20, cy + 10, { steps: 4 }); await page.mouse.move(dx, dy, { steps: 20 }); await page.mouse.move(dx + 2, dy + 1, { steps: 2 });
  await expect(page.locator('.sp2c-insert-indicator'), '[전제] 놓기 전 아밍 가이드').toBeVisible();
  await page.mouse.up();
  await page.waitForFunction((sel) => !document.querySelector(sel) && document.querySelector('#canvas .asset-block img.asset-img')?.complete, CARD_SEL);
}
const look = (page) => page.evaluate(() => { const b = document.querySelector('#canvas .asset-block'); const i = b?.querySelector('img.asset-img'); return { src: b?.dataset.imgSrc || null, w: i?.naturalWidth || 0, inline: window.getSerializedCanvas().includes('data:image/png;base64') }; });

test('캔버스에 놓으면 자산 URL 로 들어가 직렬화에 base64 가 없다', async ({ page }) => {
  await setup(page, true);
  await dropOnCanvas(page);
  const v = await look(page);
  expect(v.src).toMatch(/\/__asset\/h1\.png$/);
  expect(v.w).toBeGreaterThan(0);
  expect(v.inline).toBe(false);
});
test('[음성] 자산 저장이 실패하면 data URL 로 넣어 그림을 잃지 않는다', async ({ page }) => {
  await setup(page, false);
  await dropOnCanvas(page);
  const v = await look(page);
  expect(v.src).toMatch(/^data:image\/png;base64,/);
  expect(v.w).toBeGreaterThan(0);
});
test('[음성] ⌘Z 로 장이 돌아오고 칸에서 빠진다 · 다시 실행으로 다시 들어간다', async ({ page }) => {
  await setup(page, true);
  await dropOnCanvas(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction((sel) => document.querySelector(`${sel} img`)?.complete && document.querySelector(`${sel} img`).naturalWidth > 0, CARD_SEL);
  expect((await look(page)).src).toBe(null);
  await page.keyboard.press('Meta+Shift+z');
  await page.waitForFunction((sel) => !document.querySelector(sel), CARD_SEL);
  expect((await look(page)).src).toMatch(/\/__asset\/h1\.png$/);
});
test('[음성] 스크래치 안 이동은 파일을 만들지 않는다', async ({ page }) => {
  await setup(page, true);
  const [cx, cy] = await center(page, CARD_SEL);
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx, cy + 40, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate((sel) => document.querySelector(sel).style.top, CARD_SEL)).not.toBe('40px');
  expect(await page.evaluate(() => window.__saves)).toBe(0);
  expect(await page.evaluate((sel) => document.querySelector(`${sel} img`).src.startsWith('data:'), CARD_SEL)).toBe(true);
});
