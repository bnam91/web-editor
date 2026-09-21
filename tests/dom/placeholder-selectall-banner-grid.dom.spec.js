/* placeholder-selectall-banner-grid.dom.spec.js — 「안내문구 더블클릭 = 전체선택」 회귀 그물. (2026-09-21)
 *
 * ★사용자 관점 훑기(0920) U-26 «placeholder»:
 *   안내문구를 더블클릭하고 바로 타이핑하면 텍스트·모달·비교 블럭은 «교체»되는데
 *   배너(banner02)·그리드(grid)만 «이어붙는다» → 「강아지 간식제목을 입력합니다.」
 *   뿌리 = 두 편집진입 지점이 «이게 안내문구인가»를 판단조차 하지 않는다.
 *     - banner02-block.js  dblclick → focus() 만(Range/Selection 조작 0)
 *     - block-drag.js _gridBeginEdit → caretRangeFromPoint 로 «캐럿만»
 *   고침 = 값-비교(comparison-block.js 선례)로 안내문구를 식별해 selectAllEditableContents() 로 전체선택.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- placeholder-selectall
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const BANNER_TITLE_DEFAULT = '제목을 입력합니다.';
const GRID_CELL_DEFAULT    = '내용을 입력하세요.';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script>
  /* 앱(editor.js)이 window 에 걸어두는 전역 중, bindBlock 의 «선택» 경로가 부르는 것만 no-op 으로 세운다.
     ⚠️편집진입(_gridBeginEdit / banner dblclick)에 쓰이는 것은 하나도 대체하지 않는다 — 재는 대상이다. */
  // 목록 근거: grep -o "window\.[A-Za-z_][A-Za-z0-9_]*(" js/block-drag.js (옵셔널체이닝 «아닌» 호출 전수)
  ['_clampTextFrameWidth','_openBlockContextMenu','applyImageTransform','buildLayerPanel','clearAssetImage',
   'clearCircleImage','deselectAll','enterCircleImageEditMode','enterImageEditMode','grdIsSoleSelected',
   'highlightBlock','loadImageToAsset','loadImageToCircle','loadVideoToAsset','pushHistory',
   'showAssetProperties','showCanvasProperties','showDividerProperties','showGapProperties','showGraphProperties',
   'showIconCircleProperties','showLabelGroupProperties','showSimpleCardProperties','showTableProperties',
   'showTextProperties','showVectorProperties','syncSection','toggleAssetGifPlayback','triggerAssetUpload',
   'triggerCircleUpload','selectBlock','scheduleAutoSave','triggerAutoSave','showToast']
    .forEach(k => { if (typeof window[k] !== 'function') window[k] = function () {}; });
</script>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeBanner02Block } from '/js/blocks/banner02-block.js';
  import { makeGridBlock } from '/js/blocks/grid-block.js';
  import { bindBlock } from '/js/drag-drop.js';
  // 앱 없이 블록 하나만 세운다 — add*Block 이 하는 일 중 «DOM 삽입 + bindBlock» 만 재현.
  window.__putBanner = (opts) => {
    const { row, block } = makeBanner02Block(opts || {});
    document.getElementById('host').appendChild(row);
    bindBlock(block);
    return block.id;
  };
  window.__putGrid = (opts) => {
    const { row, block } = makeGridBlock(opts || {});
    document.getElementById('host').appendChild(row);
    bindBlock(block);
    return block.id;
  };
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

test.describe('안내문구 더블클릭 = 전체선택 (배너·그리드)', () => {

  test('배너 제목줄: 더블클릭하면 안내문구가 «전체선택»된다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putBanner({}));
    const title = page.locator('[data-kind="title"]').first();
    await expect(title).toHaveText(BANNER_TITLE_DEFAULT);
    await title.dblclick();
    const sel = await page.evaluate(() => (window.getSelection() || '').toString());
    expect(sel).toBe(BANNER_TITLE_DEFAULT);          // ← 고치기 전엔 '' (캐럿만)
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('배너 제목줄: 더블클릭 후 타이핑하면 안내문구가 «남지 않는다»', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putBanner({}));
    const title = page.locator('[data-kind="title"]').first();
    await title.dblclick();
    await page.keyboard.insertText('강아지 간식');
    const text = await title.textContent();
    expect(text).toBe('강아지 간식');                 // ← 고치기 전엔 '강아지 간식제목을 입력합니다.'
    expect(text).not.toContain(BANNER_TITLE_DEFAULT);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('배너: 사용자가 쓴 «본문»을 더블클릭하면 전체선택하지 «않는다»(기존 동작 보존)', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putBanner({ title: '우리 브랜드 이야기' }));
    const title = page.locator('[data-kind="title"]').first();
    await expect(title).toHaveText('우리 브랜드 이야기');
    await title.dblclick();
    const sel = await page.evaluate(() => (window.getSelection() || '').toString());
    expect(sel).not.toBe('우리 브랜드 이야기');
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('그리드 셀: 더블클릭하면 안내문구가 «전체선택»된다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putGrid({}));
    const cell = page.locator('.grd-line').first();
    await expect(cell).toHaveText(GRID_CELL_DEFAULT);
    await cell.dblclick();
    const sel = await page.evaluate(() => (window.getSelection() || '').toString());
    expect(sel).toBe(GRID_CELL_DEFAULT);             // ← 고치기 전엔 '' (캐럿만)
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('그리드 셀: 더블클릭 후 타이핑하면 안내문구가 «남지 않는다»', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putGrid({}));
    const cell = page.locator('.grd-line').first();
    await cell.dblclick();
    await page.keyboard.insertText('강아지 간식');
    const text = await cell.textContent();
    expect(text).toBe('강아지 간식');                 // ← 고치기 전엔 '내용을 입력하세요.강아지 간식'
    expect(text).not.toContain(GRID_CELL_DEFAULT);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('그리드: 사용자가 쓴 «본문» 셀은 전체선택하지 «않는다»(기존 caret 동작 보존)', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putGrid({
      cols: [
        { width: 1, lines: [{ type: 'body', text: '사용자가 쓴 내용' }] },
        { width: 1, lines: [{ type: 'body', text: '사용자가 쓴 내용' }] },
      ],
    }));
    const cell = page.locator('.grd-line').first();
    await cell.dblclick();
    const sel = await page.evaluate(() => (window.getSelection() || '').toString());
    expect(sel).not.toBe('사용자가 쓴 내용');
    expect(errs, errs.join('\n')).toEqual([]);
  });
});
