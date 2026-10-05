/* section-variation-bind.dom.spec.js — A/B 변형 사본이 «살아 있나» (lane-drag · 2026-10-06 · 지디 미리 승인 · 0.9.6)
 *
 * section-variation.js createVariation · addVariation 은 섹션을 cloneNode 한 뒤 bindBlock 을 손 명부 14 종에만 걸고,
 * 프레임에는 bindFrameDropZone 을 «한 번도» 안 걸었다.
 *   실앱 ㉠(격리 9370 · 사본 · A/B 버튼 진짜 클릭 → ▷B 진짜 클릭): B 사본의 도형 · 자유 프레임 · 오버레이 그룹 =
 *   _blockBound/_subSecBound/_overlayMoveBound 셋 다 false · 도형 클릭해도 안 골라짐 · 프레임 클릭해도 안 골라짐 · 그룹 끌기 165→165.
 *   같은 것을 A 원본에서: 셋 다 true · 골라짐 · 165→265.
 * 고침 = 사본에 «정본 명부»(js/block-bind-kinds.js)로 bindBlock + 프레임 전부 bindFrameDropZone (rebindAll · 섹션 템플릿 넣기와 같은 꼴).
 *
 * ⛔앱을 «안» 띄운다 — block-drag.js · section-variation.js 를 진짜 모듈로 얹고 createVariation / addVariation 을 부른다(A/B 버튼이 부르는 그것).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/section-variation-bind.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; }
  #canvas-wrap { position:relative; width:1000px; height:1400px; background:#555; }
  .section-block { position:relative; width:800px; height:600px; background:#fff; }
  .section-block[data-variation-active="0"] { display:none; }
  .frame-block { position:relative; overflow:hidden; }
  .shape-block { width:100%; height:100%; background:#99c; }
  .step-block { height:40px; background:#9c9; }
  .icon-circle-block { width:120px; height:120px; background:#c99; }
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0"><div id="canvas">
  <div class="section-block" id="secA"><div class="section-toolbar"></div><div class="section-inner" id="innerA">
    <div class="frame-block" id="sfA" data-free-layout="true" draggable="true" style="width:100px;height:100px;padding:0"><div class="shape-block" id="shpA" data-type="shape" style="position:absolute;left:0;top:0"></div></div>
    <div class="row" id="rowA" data-layout="stack"><div class="step-block" id="stpA" data-type="step"></div></div>
    <div class="frame-block" id="frA" data-free-layout="true" style="width:500px;height:200px;padding:0"></div>
  </div>
  <div class="frame-block" id="grpA" data-free-layout="true" data-group="true" data-overlay-block="true" data-sel-variant="sticker" data-offset-x="100" data-offset-y="60"
       style="position:absolute;left:100px;top:60px;width:150px;height:150px;padding:0;background:transparent"><div class="icon-circle-block" id="icbA" style="position:absolute;left:0;top:0"></div></div>
  </div>
</div></div></div>
<script src="/js/feature-flags.js"></script>
<script>
  window.currentZoom = 100;
  window.__pushes = [];
  window.pushHistory = (l) => window.__pushes.push(l || '');
  window.scheduleAutoSave = () => {}; window.triggerAutoSave = () => {}; window.buildLayerPanel = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  window._findSectionAt = () => null;
  window.deselectAll = () => document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  window.selectSection = () => {}; window.selectSectionWithModifier = () => {};
  window.bindSectionDelete = () => {}; window.bindSectionOrder = () => {}; window.bindSectionDrag = () => {}; window.bindSectionDropZone = () => {};
  window.genId = (p) => p + '_' + Math.random().toString(36).slice(2, 9);
</script>
<script type="module">
  import '/js/block-drag.js';
  import '/js/section-variation.js';
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true && typeof window.createVariation === 'function' && typeof window.bindFrameDropZone === 'function');
  // 원본(A)은 «로드 경로»처럼 묶어 둔다
  await page.evaluate(() => {
    ['sfA', 'frA', 'grpA'].forEach(id => window.bindFrameDropZone(document.getElementById(id)));
    ['shpA', 'stpA', 'icbA'].forEach(id => window.bindBlock(document.getElementById(id)));
  });
  return errs;
}

/** A/B 버튼이 하는 일 → 사본(B)을 «보이게» 바꾸고 사본 요소의 묶임 상태를 돌려준다. */
async function makeVariant(page, how) {
  return page.evaluate((how) => {
    const A = document.getElementById('secA');
    window.createVariation(A);
    if (how === 'add') window.addVariation(A);
    const all = [...document.querySelectorAll('.section-block')].filter(s => s.dataset.variationGroup === A.dataset.variationGroup);
    const C = all[all.length - 1];                       // 새로 만든 사본(B 또는 C)
    all.forEach(s => { s.dataset.variationActive = s === C ? '1' : '0'; });
    const q = (sel) => C.querySelector(sel);
    const shp = q('.shape-block'), stp = q('.step-block'), sf = shp.parentElement, fr = q('.section-inner > .frame-block:not([data-free-layout][style*="100px"])'), grp = C.querySelector(':scope > .frame-block[data-overlay-block="true"]');
    window.__C = { grp };
    return { n: all.length, shape: !!shp._blockBound, step: !!stp._blockBound, shapeWrap: !!sf._subSecBound, frame: !!fr._subSecBound, grpBound: !!grp._subSecBound, grpMove: !!grp._overlayMoveBound };
  }, how);
}

test('전제 — 두 모듈이 콘솔 오류 없이 얹힌다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

for (const how of ['create', 'add']) {
  test(`V1[${how}] ★A/B 사본의 블록·프레임·오버레이 그룹이 묶인다`, async ({ page }) => {
    await boot(page);
    const r = await makeVariant(page, how);
    expect(r, `사본 묶임=${JSON.stringify(r)} (고치기 전 실앱 B 사본 = 셋 다 false)`).toEqual({ n: how === 'add' ? 3 : 2, shape: true, step: true, shapeWrap: true, frame: true, grpBound: true, grpMove: true });
  });
}

test('V2 ★A/B 사본의 오버레이 그룹을 끌면 움직인다', async ({ page }) => {
  await boot(page);
  await makeVariant(page, 'create');
  const c = await page.evaluate(() => { const r = window.__C.grp.getBoundingClientRect(); return { x: Math.round(r.x + 60), y: Math.round(r.y + 60) }; });
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.mouse.move(c.x + 20, c.y + 10); await page.mouse.move(c.x + 40, c.y + 20); await page.mouse.up();
  const p = await page.evaluate(() => ({ L: parseFloat(window.__C.grp.style.left), T: parseFloat(window.__C.grp.style.top) }));
  expect(p, `사본 그룹 자리=${JSON.stringify(p)} (고치기 전 실앱 165→165)`).toEqual({ L: 140, T: 80 });
});
