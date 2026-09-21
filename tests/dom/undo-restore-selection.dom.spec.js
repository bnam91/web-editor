/* undo-restore-selection.dom.spec.js — 0920b «grad-alpha» C
 *
 * 현빈 원문 11번 후반부: 「블럭을 삭제한 뒤 ⌘Z 하면 되돌려지는데, 보라색 아웃라인이 안 보여서
 * 이게 다시 살아난 건지 확인하려면 클릭을 해봐야만 알 수 있다」.
 *
 * 원인(코드 대조): ① 스냅샷은 UI 상태 클래스를 «일부러» 세척한다(js/io/section-serialize.js
 * RUNTIME_MARKER_CLS 에 'selected', 그리고 .gradient-corner-handle 제거) → 복원 HTML 에 선택
 * 흔적이 없다. ② 그 위에 js/history.js 의 restoreSnapshot 이 deselectAll() 을 두 번 부른다.
 * ③ 히스토리 항목에 «선택 정보를 담는 필드»가 아예 없었다.
 *
 * ⛔앱을 «안» 띄운다. js/history.js · js/gradient-select.js · js/block-edit.js 원문을 그대로
 *   싣고, 앱 표면(getSerializedCanvas/rebindAll/deselectAll/패널)만 스텁한다.
 *   ★세척 스텁은 위 원문 두 자리를 흉내 낸다 — 그 자리가 바뀌면 조용히 거짓 그린이 되므로
 *   tests/unit/grad-stop-commit-wiring.test.mjs 가 원문에 'selected' 세척이 남아있는지 같이 잰다.
 * 실행: npm run test:dom -- undo-restore-selection
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://undosel.dom.test';
const EDITOR_JS = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');
// 실앱의 «캔버스 선택 블럭» 셀렉터 원문 — 하네스가 자기 복사본으로 거짓 그린을 내지 않게
const SEL_SRC = (EDITOR_JS.match(/const CANVAS_SEL_BLOCKS\s*=\s*([\s\S]*?);\n/) || [])[1];
if (!SEL_SRC || !/gradient-block\.selected/.test(SEL_SRC)) throw new Error('editor.js CANVAS_SEL_BLOCKS 를 못 찾음');

const SRC = {
  '/js/globals.js': 'export const state = { pageSettings: {}, currentPageId: "p1", pages: [] };\nexport const propPanel = null;\n',
  '/js/history.js': fs.readFileSync(path.join(REPO, 'js/history.js'), 'utf8'),
  '/js/gradient-select.js': fs.readFileSync(path.join(REPO, 'js/gradient-select.js'), 'utf8'),
  '/js/block-edit.js': fs.readFileSync(path.join(REPO, 'js/block-edit.js'), 'utf8'),
  /* ★2026-09-21(T-079): 우측 패널 디스패치 표가 여기로 이사했다. 이 줄을 빼면 404 라
     복원 뒤 패널이 «안 열리고» __panel 이 'page' 로 남는다(= 아래 네 검사의 빨강). */
  '/js/panel-dispatch.js': fs.readFileSync(path.join(REPO, 'js/panel-dispatch.js'), 'utf8'),
};

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}
  .gradient-block.selected { outline: 2px solid #9966ff; }
  .gradient-corner-handle { position:absolute;width:8px;height:8px;background:#9966ff; }
</style>
<script>
  window.currentZoom = 40;
  window.CANVAS_SEL_BLOCKS = ${SEL_SRC.replace(/\n\s*/g, ' ')};
  window.CANVAS_SEL_BLOCKS_AND_SHAPE = window.CANVAS_SEL_BLOCKS + ', .shape-block.selected';
  window.__panel = null;
  window.showGradientProperties = (b) => { window.__panel = 'gradient:' + b.id; };
  window.showTextProperties     = (b) => { window.__panel = 'text:' + b.id; };
  window.showShapeProperties    = (b) => { window.__panel = 'shape:' + b.id; };
  window.showPageProperties     = ()  => { window.__panel = 'page'; };
  /* ★픽스 라운드 — 실제 «클릭 경로»(js/block-drag.js)가 부르는 패널들. 1차 구현은 일반 타입을
     window.selectBlock 으로 흘려서 ⑴data-type 없는 타입(asset 등)은 아예 안 골라졌고
     ⑵패널 분기가 좁아 mockup 등은 showTextProperties 로 떨어졌다. */
  window.showAssetProperties    = (b) => { window.__panel = 'asset:' + b.id; };
  window.showMockupProperties   = (b) => { window.__panel = 'mockup:' + b.id; };
  window.__handles = null;
  window.showHandlesFor         = (b) => { window.__handles = b.id; };
  window.syncSection = () => {};
  window.highlightBlock = () => {};
  window.setBlockAnchor = () => {};
  window.applyPageSettings = () => {};
  window.buildLayerPanel = () => {};
  window.gdtFontPaintBadge = () => {};
  window.rebindAll = () => {};
  window.scheduleAutoSave = () => {};
  /* ★세척 스텁 — js/io/section-serialize.js 원문 두 자리를 흉내:
     RUNTIME_MARKER_CLS 의 'selected'/'editing' 제거 + .gradient-corner-handle 제거. */
  window.getSerializedCanvas = () => {
    const c = document.getElementById('canvas').cloneNode(true);
    c.querySelectorAll('.gradient-corner-handle, .sticker-corner-handle').forEach(h => h.remove());
    c.querySelectorAll('.selected, .editing').forEach(el => el.classList.remove('selected', 'editing'));
    return c.innerHTML;
  };
  window.getLastVideoPendingSidecar = () => null;
  /* deselectAll 스텁 — 실앱 js/editor.js 의 «끝부분 규율»만 흉내(클래스 해제 + 그라데이션 핸들
     정리 + 우측패널을 페이지 패널로). */
  window.deselectAll = () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    window._deselectAllGradients?.();
    window.showPageProperties();
  };
</script></head><body>
<div id="canvas">
  <div class="section-block" id="sec1" style="position:relative;width:860px;height:600px">
    <div class="gradient-block" id="grad_8ukztd" data-type="gradient" data-grad-width="860" data-grad-height="300" style="position:absolute;left:0;top:0;width:200px;height:100px"></div>
    <div class="text-block" id="tb_1" data-type="text" style="position:absolute;left:0;top:200px"><div class="tb-body">텍스트</div></div>
    <div class="shape-block" id="sh_1" data-type="shape" data-shape-type="ellipse" style="position:absolute;left:0;top:300px;width:80px;height:80px"></div>
    <!-- ★data-type 을 «일부러» 안 단다 — 실앱의 asset-block 속성은 class,id,data-align,data-overlay,style 뿐이다(실측).
         1차 구현은 getBlockById(js/block-edit.js:10)가 !!el.dataset.type 를 요구해 여기서 조용히 멈췄다. -->
    <div class="asset-block" id="ab_1" data-align="center" data-overlay="off" style="position:absolute;left:0;top:400px;width:120px;height:80px"></div>
    <div class="mockup-block" id="mkp_1" style="position:absolute;left:200px;top:400px;width:120px;height:80px"></div>
  </div>
</div>
<!-- ★2026-09-21(T-079): 우측 패널 디스패치 표가 js/panel-dispatch.js 로 이사했다.
     history.js 의 _restoreSelection 과 block-edit.js 의 selectBlock 이 «같은» 이 표를 쓴다.
     이 줄을 빼면 복원 뒤 패널이 «안 열리고» 아래 검사들이 빨개진다(실제 index.html 과 같은 순서). -->
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script type="module" src="/js/gradient-select.js"></script>
<script type="module">
  import './js/history.js';
  window.__ready = true;
</script>
</body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/h.html') return route.fulfill({ contentType: 'text/html', body: HTML });
    const key = u.pathname.replace(/^\/h\.html\//, '/');
    if (SRC[key]) return route.fulfill({ contentType: 'text/javascript', body: SRC[key] });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/h.html`);
  await page.waitForFunction(() => window.__ready && !!window.pushHistory && !!window._selectGradient);
  await page.evaluate(() => window.clearHistory());
  return errs;
}

/** 실앱 삭제 경로의 «순서»를 그대로: ensureHistoryCheckpoint('삭제 전') → remove → deselectAll → pushHistory */
const deleteSelected = (page, id) => page.evaluate((id) => {
  window.ensureHistoryCheckpoint('삭제 전');
  document.getElementById(id).remove();
  window.deselectAll();
  window.pushHistory('블록 삭제');
}, id);

const snap = (page) => page.evaluate(() => ({
  gradSel: document.querySelectorAll('.gradient-block.selected').length,
  gradHandles: document.querySelectorAll('.gradient-corner-handle').length,
  textSel: document.querySelectorAll('.text-block.selected').length,
  shapeSel: document.querySelectorAll('.shape-block.selected').length,
  assetSel: document.querySelectorAll('.asset-block.selected').length,
  mockupSel: document.querySelectorAll('.mockup-block.selected').length,
  panel: window.__panel,
  handles: window.__handles,
  anySel: document.querySelectorAll('#canvas .selected').length,
}));

test.describe('undo 복원 시 선택 상태 복원 (0920b grad-alpha C)', () => {
  test('그라데이션 — 삭제 후 ⌘Z 하면 보라 테두리 + 4모서리 핸들 + 그라데이션 패널이 돌아온다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window._selectGradient(document.getElementById('grad_8ukztd')));
    expect((await snap(page)).gradHandles).toBe(4);

    await deleteSelected(page, 'grad_8ukztd');
    expect((await snap(page)).gradSel).toBe(0);

    await page.evaluate(() => window.undo());
    const after = await snap(page);
    expect(await page.evaluate(() => !!document.getElementById('grad_8ukztd'))).toBe(true);
    expect(after.gradSel).toBe(1);        // ★dev: 0(빨강)
    expect(after.gradHandles).toBe(4);    // ★dev: 0(빨강)
    expect(after.panel).toBe('gradient:grad_8ukztd'); // ★dev: 'page'(빨강)
    expect(errs).toEqual([]);
  });

  test('텍스트 블럭 — 같은 케이스', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.selectBlock('tb_1'));
    await deleteSelected(page, 'tb_1');
    await page.evaluate(() => window.undo());
    const after = await snap(page);
    expect(after.textSel).toBe(1);        // ★dev: 0(빨강)
    expect(after.panel).toBe('text:tb_1');
  });

  test('도형 블럭 — 같은 케이스', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.selectBlock('sh_1'));
    await deleteSelected(page, 'sh_1');
    await page.evaluate(() => window.undo());
    const after = await snap(page);
    expect(after.shapeSel).toBe(1);       // ★dev: 0(빨강)
    expect(after.panel).toBe('shape:sh_1');
  });

  test('이미지(에셋) 블럭 — data-type 이 «없어도» 복원된다 + 에셋 패널·핸들', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => {
      const el = document.getElementById('ab_1');
      el.classList.add('selected');            // 실앱 클릭 경로가 하는 일(선택+패널)
      window.showAssetProperties(el);
    });
    await deleteSelected(page, 'ab_1');
    await page.evaluate(() => window.undo());
    const after = await snap(page);
    expect(await page.evaluate(() => !!document.getElementById('ab_1'))).toBe(true);
    expect(after.assetSel).toBe(1);            // ★1차 구현: 0(빨강 — selectBlock 이 false 로 빠짐)
    expect(after.panel).toBe('asset:ab_1');    // ★1차 구현: 'page'(빨강)
    expect(after.handles).toBe('ab_1');        // 모서리 핸들도 클릭 경로와 같은 입구로
    expect(errs).toEqual([]);
  });

  test('목업 블럭 — 복원된 «뒤» 우측 패널이 블럭과 어긋나지 않는다', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      const el = document.getElementById('mkp_1');
      el.classList.add('selected');
      window.showMockupProperties(el);
    });
    await deleteSelected(page, 'mkp_1');
    await page.evaluate(() => window.undo());
    const after = await snap(page);
    expect(after.mockupSel).toBe(1);
    expect(after.panel).toBe('mockup:mkp_1'); // ★1차 구현: 'page'(빨강 — showTextProperties 로 떨어짐)
  });

  test('선택이 없던 시점으로의 undo 는 아무것도 고르지 않는다 (회귀 방지)', async ({ page }) => {
    await boot(page);
    // 선택 없이 편집 → undo
    await page.evaluate(() => {
      window.ensureHistoryCheckpoint('편집 전');
      document.getElementById('tb_1').querySelector('.tb-body').textContent = '바뀜';
      window.pushHistory('텍스트 편집');
    });
    await page.evaluate(() => window.undo());
    const after = await snap(page);
    expect(after.anySel).toBe(0);
    expect(after.panel).toBe('page');
  });

  test('되살린 뒤 redo 하면 다시 지워지고 선택도 남지 않는다', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window._selectGradient(document.getElementById('grad_8ukztd')));
    await deleteSelected(page, 'grad_8ukztd');
    await page.evaluate(() => window.undo());
    expect((await snap(page)).gradSel).toBe(1);
    await page.evaluate(() => window.redo());
    const after = await snap(page);
    expect(await page.evaluate(() => !!document.getElementById('grad_8ukztd'))).toBe(false);
    expect(after.anySel).toBe(0);
  });
});
