/* t13a-01-grid-img-paste.dom.spec.js — t13A-01(현빈 261118) 「그리드 그림 줄의 그림을 ⌘C/⌘X → ⌘V 하면 그림이 아니라 그리드 전체가 붙는다」
 * 재현(534a76177): 그림 줄을 고른 채 ⌘X → 줄은 지워지고 copySelected 가 «그리드째» 담아 ⌘V = 그리드 +1 · 에셋 0.
 *   ⌘C → 줄 클립(grdCopySelectedLines)만 담겨 그리드 밖 ⌘V = 에셋 0(블럭 클립이 남아 있었으면 그 옛 블럭).
 * 기대: 그림 줄 하나 ⌘C/⌘X → ⌘V = 그 그림의 에셋 블럭 1개(그리드 수 그대로).
 * ★양성대조: js/editor.js 의 _copyGridImgLineAsAsset 호출 두 줄을 빼면 I1 I2 I1b 빨강 / I3 초록(실측 534a76177+이 spec · _patches/wk4-ctl-t13a01-no-img-asset-copy.patch).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js --workers=1 t13a-01 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const q = (o) => JSON.stringify(o).replace(/"/g, '&quot;');
const COLS = q([{ width: 1, lines: [{ type: 'body', text: '가' }, { type: 'image', imgSrc: 'data:image/png;base64,' + PNG }] }, { width: 1, lines: [{ type: 'body', text: '다' }] }]);
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div></div>
<div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`;
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((h) => {
    window.__os = { text: null };
    window.electronAPI = new Proxy({}, { get: (_t, k) => k === 'clipboardWriteText'
      ? (txt) => { window.__os = { text: String(txt) }; return Promise.resolve({ ok: true }); } : () => Promise.resolve(null) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock?.(document.getElementById('gG'));
  }, SEC);
  await page.waitForTimeout(400);
}
const imgXY = (page) => page.evaluate(() => { const e = document.querySelector('#gG .grd-img-frame[data-line="1"]') || document.querySelector('#gG [data-r="0"][data-c="0"][data-line="1"]'); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
async function selectImg(page) {
  for (let i = 0; i < 2; i++) { const [x, y] = await imgXY(page); await page.mouse.click(x, y); await page.waitForTimeout(200); }
  await page.evaluate(() => document.activeElement?.blur?.());
}
async function pressPaste(page) {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true }));
    const dt = new DataTransfer(); if (window.__os.text !== null) dt.setData('text/plain', window.__os.text);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(600);
}
const snap = (page) => page.evaluate(() => ({
  grids: document.querySelectorAll('#canvas .grid-block').length,
  assets: document.querySelectorAll('#canvas .asset-block').length,
  imgLines: (() => { try { return window.getGridModel(document.getElementById('gG')).cells.flat().flatMap(c => c.lines).filter(l => l.type === 'image').length; } catch { return -1; } })(),
  sel: (() => { const b = document.getElementById('gG'); return b ? { blk: b.classList.contains('selected'), ls: window.grdGetLineSel?.(b), al: window.grdGetActiveLine?.(b) } : null; })(),
}));
const SRC = 'data:image/png;base64,' + PNG;
const assetSrcs = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .asset-block')].map(a => a.offsetHeight > 0 && a.dataset.imgSrc));
for (const [id, k] of [['I1', 'c'], ['I2', 'x']]) test(`${id} 그림 줄 ⌘${k.toUpperCase()} → (그리드 떠나) ⌘V = 그 그림의 에셋 1개 · 그리드 +0`, async ({ page }) => {
  await setup(page);
  await selectImg(page);
  const s0 = await snap(page);
  expect(s0.sel.ls).toEqual([{ r: 0, c: 0, li: 1 }]);                       // 전제: 그림 줄이 골라졌다
  await page.keyboard.press('Meta+' + k); await page.waitForTimeout(300);
  expect((await snap(page)).imgLines).toBe(k === 'x' ? 0 : 1);               // ⌘X = 그림 줄만 빠진다(그리드는 남음)
  await page.evaluate(() => window.deselectAll());
  await pressPaste(page);
  const s1 = await snap(page);
  expect({ grids: s1.grids, assets: s1.assets }).toEqual({ grids: 1, assets: 1 });
  expect(await assetSrcs(page)).toEqual([SRC]);
});
test('I1b 그림 줄 ⌘C → 그리드를 고른 채 ⌘V 도 에셋 1개(그리드 안 줄 +0)', async ({ page }) => {
  await setup(page);
  await selectImg(page);
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(300);
  await pressPaste(page);
  const s1 = await snap(page);
  expect({ grids: s1.grids, assets: s1.assets, imgLines: s1.imgLines }).toEqual({ grids: 1, assets: 1, imgLines: 1 });
});
test('I3 지키는 시험 — 그리드 «블럭»만 고른 ⌘C → ⌘V 는 그리드 +1(에셋 0) · 글 줄 ⌘C 는 줄 복사 그대로', async ({ page }) => {
  await setup(page);
  const [x, y] = await imgXY(page);
  await page.mouse.click(x, y); await page.waitForTimeout(250);              // 첫 클릭 = 블럭
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(300);
  await pressPaste(page);
  let s1 = await snap(page);
  expect({ grids: s1.grids, assets: s1.assets }).toEqual({ grids: 2, assets: 0 });
  await setup(page);
  for (let i = 0; i < 2; i++) {
    const [tx, ty] = await page.evaluate(() => { const r = document.querySelector('#gG [data-r="0"][data-c="0"][data-line="0"]').getBoundingClientRect(); return [r.left + 8, r.top + r.height / 2]; });
    await page.mouse.click(tx, ty); await page.waitForTimeout(200);
  }
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(300);
  await pressPaste(page);
  s1 = await snap(page);
  expect({ grids: s1.grids, assets: s1.assets }).toEqual({ grids: 1, assets: 0 });
  expect(await page.evaluate(() => window.getGridModel(document.getElementById('gG')).cells[0][0].lines.length)).toBe(3);
});
