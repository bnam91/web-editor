/* grid-img-crop.dom.spec.js — 그리드 칸 이미지의 «프레임 안 크롭»을 «화면»으로 잰다.
 *   (2026-09-25 커밋 ② · 현빈 「에셋블럭과 구조가 같아야 된다」)
 *
 * ★단위검사(tests/unit/grid-img-crop.test.js)가 못 재는 칸이 여기다:
 *   E  더블클릭 편집기가 «실제로» 뜨고, 끌면 움직이고, 끝나면 ％로 커밋되는가
 *   S  ★저장 → 다시 열기 — 제품의 세척(serializeCleanRoot)을 지나도 크롭이 살아 있는가
 *   X  ★내보내기 — 폭이 860→780 으로 줄어도 «같은 그림»인가 (그게 ％로 저장한 까닭이다)
 *   T  ★썸네일(html2canvas 경로) — capture-safety 가 object-position 을 따라가는가
 *      (그 자리의 주석이 「이 레포는 그 속성을 한 군데도 안 쓴다」고 «틀리게» 적혀 있었다)
 *
 * ★자가점검이 본 측정 «앞»에 선다 — D0. 크롭이 애초에 «다른 그림»을 만들지 못하면
 *   아래 S·X 의 「같다」는 전부 「빈 것끼리 견주기」다.
 *
 * ⛔앱을 «안» 띄운다 — page.route 로 레포를 가짜 origin 에 얹고 진짜 모듈을 import 한다.
 * ⚠️못 재는 축: 앱의 «파일» 저장 왕복(proj.json)과 실기 더블클릭은 여기서 안 지난다.
 *   여기가 지나는 것은 제품이 저장 «직전»에 쓰는 세척 함수와 편집기 함수 자신이다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-img-crop
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* 네 귀퉁이가 서로 다른 그림 — 한 톨의 어긋남도 픽셀로 드러난다. */
const NAT_W = 400, NAT_H = 250;
const IMG = 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${NAT_W}" height="${NAT_H}">` +
  `<rect width="400" height="250" fill="#204080"/>` +
  `<rect x="0" y="0" width="200" height="125" fill="#e03030"/>` +
  `<rect x="200" y="125" width="200" height="125" fill="#30c060"/>` +
  `<circle cx="200" cy="125" r="60" fill="#f0d000"/>` +
  `<rect x="0" y="120" width="400" height="10" fill="#ffffff"/>` +
  `<rect x="195" y="0" width="10" height="250" fill="#000000"/></svg>`
).toString('base64');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>
  body{margin:0;background:#fff;}
  #canvas{width:860px;}
  .section-block{position:relative;background:#fff;}
  .section-inner{padding-left:32px;padding-right:32px;display:block;}
</style></head><body>
<div id="canvas-wrap"><div id="canvas">
  <div class="section-block" id="sec" data-pad-x="32"><div class="section-inner" id="host"></div></div>
</div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<div id="ss-handles-overlay" style="position:fixed;inset:0;pointer-events:none;z-index:9999;"></div>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { prepareCloneForCapture } from '/js/io/export-image.js';
  import { neutralizeObjectFitForH2C } from '/js/io/capture-safety.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  window.__open = showGridProperties;
  import '/js/image-handling.js';
  import { bindBlock } from '/js/drag-drop.js';   // ★더블클릭 «배선»을 재려면 진짜 바인더가 필요하다
  import { showGridImageResizeHandle } from '/js/overlay-handles.js';
  window.__bind = bindBlock; window.__handles = showGridImageResizeHandle;
  window.__mk = makeGridBlock; window.__render = renderGridBlock;
  window.__upd = updateGridBlock; window.__model = getGridModel;
  window.__prep = prepareCloneForCapture; window.__neut = neutralizeObjectFitForH2C;
  /* 편집기가 부르는 전역들 — 앱에만 있는 것은 «세는» 대역으로 둔다(불렸는지 E4 가 잰다). */
  window.__hist = 0; window.pushHistory = () => { window.__hist++; };
  window.__save = 0; window.scheduleAutoSave = () => { window.__save++; };
  window.__toast = []; window.showToast = (m) => { window.__toast.push(String(m)); };
  window.updateGridBlock = updateGridBlock; window.getGridModel = getGridModel;
  window.showGridProperties = showGridProperties;
  /* ★앱 «껍데기»의 대역 — 선택·하이라이트·레이어 패널은 이 파일이 재는 축이 아니다.
     ⛔그런데 없으면 캔버스 click 핸들러가 throw 하고, 그 throw 가 뒤따르는 dblclick 을
       «가린다»(그러면 W1 이 「배선이 끊겼다」고 거짓 고발한다).
     ⛔크롭에 닿는 것은 하나도 대역으로 두지 않는다 — updateGridBlock·getGridModel·
       showGridProperties·enterGridImageEditMode 는 전부 «진짜»다. */
  window.__shell = 0;
  for (const k of ['deselectAll', 'syncSection', 'highlightBlock', 'setBlockAnchor',
                   'showHandlesFor', 'grdMarkCanvasDrill', 'restoreFrameSelectionFor',
                   'suppressAncestorDrag', 'hideGridGutters', 'showGridGutters']) {
    if (typeof window[k] !== 'function') window[k] = () => { window.__shell++; return () => {}; };
  }
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
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 이미지 줄 하나짜리 그리드를 심는다. 반환 = 블록 id. */
async function plant(page, line) {
  return page.evaluate((ln) => {
    document.getElementById('host').innerHTML = '';
    const { block } = window.__mk({ cols: [{ width: 1, lines: [] }] });
    document.getElementById('host').appendChild(block);
    window.__upd(block.id, { rows: [{ height: 'auto' }] });
    const r = window.__upd(block.id, { patchCell: { r: 0, c: 0, lines: [ln] } });
    if (!r.ok) throw new Error('판 깔기 실패: ' + r.message);
    window.__render(block);
    window.__ID = block.id;
    return block.id;
  }, line);
}

/** 그림이 다 떠야 크기가 정해진다 — 안 기다리면 «둘 다 0» 이라 공짜 초록이 난다. */
const settle = (page) => page.waitForFunction(() =>
  [...document.querySelectorAll('#canvas img')].every(i => i.complete && i.naturalWidth > 0));

/** 프레임을 찍는다(스크린샷 PNG). */
const shotFrame = (page) => page.locator('#host .grd-img-frame').screenshot();

/** 두 PNG 를 브라우저에 도로 넣어 «점마다» 견준다. ⛔새 의존성 없이 — 디코더는 브라우저에 있다. */
const diffPng = (page, a, b) => page.evaluate(async ([x, y]) => {
  const load = (b64) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data:image/png;base64,' + b64;
  });
  const [ia, ib] = [await load(x), await load(y)];
  if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height], n: -1, max: -1 };
  const px = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    return g.getImageData(0, 0, im.width, im.height).data; };
  const [pa, pb] = [px(ia), px(ib)];
  let n = 0, max = 0;
  for (let i = 0; i < pa.length; i += 4) {
    let d = 0; for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(pa[i + k] - pb[i + k]));
    if (d > 0) { n++; if (d > max) max = d; }
  }
  return { n, max, total: pa.length / 4, w: ia.width, h: ia.height };
}, [a.toString('base64'), b.toString('base64')]);

const PLAIN = { type: 'image', imgSrc: IMG, height: 200 };
const CROPPED = { type: 'image', imgSrc: IMG, height: 200, imgSizePct: 180, imgPosX: -40, imgPosY: -25 };

/* ══════════════════════════════════════════════════════════════════════
 * D0 — 계측기. ⛔이게 빨갛다면 아래 「같다」는 전부 빈 것끼리 견주기다.
 * ════════════════════════════════════════════════════════════════════ */

test('D0 ★계측기 — 크롭이 «실제로 다른 그림»을 만든다', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, PLAIN); await settle(page);
  const a = await shotFrame(page);
  await plant(page, CROPPED); await settle(page);
  const b = await shotFrame(page);
  expect(errs).toEqual([]);
  const d = await diffPng(page, a, b);
  expect(d.size, '★크롭이 프레임 «크기»를 바꿨다 — 프레임은 그대로고 안쪽만 바뀌어야 한다').toBeUndefined();
  expect(d.max, `★크롭을 줬는데 그림이 그대로다 — 이 파일 전체가 헛돈다 (다른 점 ${d.n}/${d.total})`)
    .toBeGreaterThan(64);
});

/* ══════════════════════════════════════════════════════════════════════
 * E — 더블클릭 편집기(enterGridImageEditMode). 에셋 편집기를 빌려 쓴다.
 * ════════════════════════════════════════════════════════════════════ */

test('E1 ★편집기가 «뜬다» — 프록시와 코너 핸들이 생기고, 그리는 그림은 한 장뿐이다', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, PLAIN); await settle(page);
  const st = await page.evaluate(() => {
    window.enterGridImageEditMode(document.getElementById(window.__ID), { r: 0, c: 0, li: 0 });
    return null;
  });
  await page.waitForFunction(() => document.querySelectorAll('.img-corner-handle').length > 0, null, { timeout: 5000 });
  const seen = await page.evaluate(() => ({
    proxy: document.querySelectorAll('.grd-img-edit-proxy').length,
    assetImg: document.querySelectorAll('.grd-img-edit-proxy img.asset-img').length,
    corners: document.querySelectorAll('.img-corner-handle').length,
    edges: document.querySelectorAll('.img-edge-handle').length,
    realHidden: document.querySelector('#host img.grd-img').style.opacity,
    /* ⛔`.asset-block` 을 달면 editor.js 의 Delete 핸들러·inspector 가 «진짜 에셋»으로 오인한다
       (js/image-handling.js:1090~1092 가 적어 둔 함정). 한 개도 없어야 한다. */
    fakeAsset: document.querySelectorAll('#host .asset-block').length,
    panelTitle: (document.querySelector('#panel-right .prop-block-name') || {}).textContent || '',
    doneBtn: !!document.getElementById('grd-img-crop-done'),
  }));
  expect(errs).toEqual([]);
  expect(seen.proxy, '★프록시가 안 떴다').toBe(1);
  expect(seen.assetImg, '★프록시 안에 .asset-img 가 없다 — 공용 편집기가 요구하는 단 하나다').toBe(1);
  expect(seen.corners, '★코너 핸들 4개가 안 생겼다 — 에셋과 «같은 편집기»가 아니다').toBe(4);
  expect(seen.edges, '★변 핸들 4개가 안 생겼다').toBe(4);
  expect(seen.realHidden, '★진짜 그림을 안 숨겼다 — 프록시와 겹쳐 두 장이 보인다').toBe('0');
  expect(seen.fakeAsset, '★⛔프록시가 .asset-block 으로 잡힌다 — Delete 키가 이미지를 지워 버린다').toBe(0);
  expect(seen.panelTitle, '★우측 패널이 «이미지 편집»으로 안 바뀌었다').toContain('이미지 편집');
  expect(seen.doneBtn, '★「크롭 완료」 단추가 없다 — 끝낼 길이 하나뿐이면 갇힌다').toBe(true);
});

test('E2 ★끌면 움직이고, 끝나면 «％»로 커밋된다 (px→％ 통역)', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, PLAIN); await settle(page);
  const before = await shotFrame(page);
  await page.evaluate(() => window.enterGridImageEditMode(document.getElementById(window.__ID), { r: 0, c: 0, li: 0 }));
  await page.waitForFunction(() => document.querySelectorAll('.img-corner-handle').length > 0);

  /* 프록시 그림을 «잡아 끈다» — 편집기는 <img> 의 mousedown 에 걸려 있고 이후엔 document 에서 듣는다. */
  const box = await page.locator('.grd-img-edit-proxy img.asset-img').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 24, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-edit-proxy').length === 0, null, { timeout: 5000 });
  await settle(page);

  const out = await page.evaluate(() => {
    const line = window.__model(document.getElementById(window.__ID)).cells[0][0].lines[0];
    const img = document.querySelector('#host img.grd-img');
    return { line, inline: img.getAttribute('style'), hist: window.__hist, save: window.__save,
             leftover: document.querySelectorAll('.grd-img-edit-proxy, .img-corner-handle, .img-edge-handle, .img-boundary, .img-edit-hint').length };
  });
  expect(errs).toEqual([]);
  for (const k of ['imgSizePct', 'imgPosX', 'imgPosY']) {
    expect(Number.isFinite(Number(out.line[k])), `★모델에 ${k} 가 안 들어왔다 — 편집은 됐는데 저장이 안 된 것이다`).toBe(true);
  }
  expect(out.line.imgPosX, '★왼쪽으로 60px 끌었는데 가로 자리가 안 줄었다').toBeLessThan(0);
  expect(out.line.imgPosY, '★위로 24px 끌었는데 세로 자리가 안 줄었다').toBeLessThan(0);
  expect(out.inline, '★화면이 크롭을 안 따라간다(절대배치로 안 갔다)').toContain('position:absolute');
  expect(out.inline, '★크롭 값이 px 로 샜다 — ％라야 폭이 바뀌어도 같은 그림이 된다').not.toMatch(/left:[^;]*px/);
  expect(out.hist, '★되돌리기 표를 한 번도 안 찍었다 — ⌘Z 가 이 편집을 못 되돌린다').toBeGreaterThan(0);
  expect(out.save, '★자동저장을 안 깨웠다').toBeGreaterThan(0);
  expect(out.leftover, '★임시 DOM 이 남았다 — 저장본·내보내기에 편집 잔여가 실린다').toBe(0);
  const after = await shotFrame(page);
  const d = await diffPng(page, before, after);
  expect(d.max, `★끌었는데 «그림»은 그대로다 (다른 점 ${d.n}/${d.total})`).toBeGreaterThan(64);
});

test('E3 ★높이가 auto 인 줄 — 편집을 열면 «프레임 높이»를 먼저 못박고 그걸 말한다', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, { type: 'image', imgSrc: IMG });     // height 없음
  await settle(page);
  const h0 = await page.evaluate(() => document.querySelector('#host .grd-img-frame').getBoundingClientRect().height);
  await page.evaluate(() => window.enterGridImageEditMode(document.getElementById(window.__ID), { r: 0, c: 0, li: 0 }));
  await page.waitForFunction(() => document.querySelectorAll('.img-corner-handle').length > 0);
  const out = await page.evaluate(() => ({
    height: window.__model(document.getElementById(window.__ID)).cells[0][0].lines[0].height,
    toast: window.__toast.slice(),
  }));
  expect(errs).toEqual([]);
  expect(Number(out.height), '★프레임 높이를 안 못박았다 — 크롭 세 값이 렌더러에 «안 읽히고» 끝난다')
    .toBeGreaterThan(0);
  expect(Math.abs(Number(out.height) - h0), '★못박은 높이가 지금 보이던 높이와 다르다 — 여는 순간 그림이 튄다')
    .toBeLessThanOrEqual(1);
  expect(out.toast.join(' '), '★말없이 모델을 바꿨다 — 「프레임 높이를 고정했다」를 사용자에게 알려야 한다')
    .toContain('프레임 높이');
});

/* ══════════════════════════════════════════════════════════════════════
 * W — ★«배선». 위 E 축은 enterGridImageEditMode 를 «직접» 불렀다. 그 함수가 멀쩡해도
 *     더블클릭이 거기까지 안 닿으면 사용자에겐 없는 기능이다 — 그 칸을 여기서 닫는다.
 * ════════════════════════════════════════════════════════════════════ */

/** ★진짜 리스너에 더블클릭을 «흘린다».
 *  ⚠️한계를 먼저 적는다 — 여기서 `page.dblclick()`(OS 히트테스트)을 «못» 쓴다.
 *    이 하네스에는 앱의 레이아웃 껍데기가 없어 `#panel-right`(position:fixed)가 캔버스 위를
 *    덮는다(실측: elementFromPoint(100,100) 이 .prop-block-name 을 준다). 그건 제품 결함이
 *    아니라 «내 판이 만든 것»이라, 그걸로 빨갛게 하면 거짓 고발이 된다.
 *  ⇒ 대신 «진짜 좌표»를 실은 MouseEvent 를 프레임에 흘린다. 이러면 제품 핸들러가 쓰는 두 길
 *    (elementFromPoint 우선 → e.target 폴백)을 그대로 지난다. 재는 양은 「bindBlock 이 건
 *    dblclick 리스너가 크롭 편집기까지 닿는가」다.
 *  ⛔못 재는 것: 실제 마우스가 그 픽셀에 «닿는가»(겹침·pointer-events). 그 축은 실기다. */
const dblAt = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) throw new Error('대상이 없다: ' + s);
  const r = el.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
}, sel);

test('W1 ★★더블클릭이 «실제로» 크롭 편집기까지 닿는다 (배선 축)', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, PLAIN);
  await page.evaluate(() => window.__bind(document.getElementById(window.__ID)));
  await settle(page);
  await dblAt(page, '#host .grd-img-frame');
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-edit-proxy').length === 1, null, { timeout: 5000 });
  const seen = await page.evaluate(() => ({
    proxy: document.querySelectorAll('.grd-img-edit-proxy').length,
    corners: document.querySelectorAll('.img-corner-handle').length,
    /* ⛔이미지 줄에 contenteditable 이 붙으면 안 된다 — `_gridEditable` 을 넓히지 «않은» 까닭이
       그것이다(js/block-drag.js 134~136행의 경고). 붙었다면 글자 입력이 그림 위에서 열린다. */
    editable: document.querySelectorAll('#host [contenteditable="true"]').length,
  }));
  expect(errs).toEqual([]);
  expect(seen.proxy, '★더블클릭이 크롭 편집기를 못 열었다 — 함수는 멀쩡한데 «배선»이 끊겼다').toBe(1);
  expect(seen.corners, '★편집기는 열렸는데 핸들이 없다').toBe(4);
  expect(seen.editable, '★이미지 줄에 contenteditable 이 붙었다 — 글자 편집이 그림 위에서 열린다').toBe(0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-edit-proxy').length === 0);
});

test('W2 ★음성대조 — «글자 줄» 더블클릭은 크롭 편집기를 열지 않는다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => {
    document.getElementById('host').innerHTML = '';
    const { block } = window.__mk({ cols: [{ width: 1, lines: [] }] });
    document.getElementById('host').appendChild(block);
    window.__upd(block.id, { rows: [{ height: 'auto' }] });
    window.__upd(block.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'body', text: '글자 줄' }] } });
    window.__render(block);
    window.__ID = block.id;
    window.__bind(block);
  });
  await dblAt(page, '#host .grd-line');
  await page.waitForTimeout(150);
  const n = await page.evaluate(() => document.querySelectorAll('.grd-img-edit-proxy').length);
  expect(errs).toEqual([]);
  expect(n, '★글자 줄을 더블클릭했는데 «크롭 편집기»가 열렸다 — 새 가지가 남의 줄까지 삼킨다').toBe(0);
});

test('W3 ★음성대조 — «빈 이미지 슬롯» 더블클릭은 옛 가지(파일 고르기)로 간다', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, { type: 'image', height: 160 });      // imgSrc 없음 = 빈 슬롯
  await page.evaluate(() => window.__bind(document.getElementById(window.__ID)));
  /* 파일 대화상자를 실제로 띄우지 않고 «불렸는가»만 센다 — input.click() 을 가로챈다. */
  await page.evaluate(() => {
    window.__filePick = 0;
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () { if (this.type === 'file') { window.__filePick++; return; } return orig.call(this); };
  });
  await dblAt(page, '#host .grd-img-empty');
  await page.waitForTimeout(150);
  const out = await page.evaluate(() => ({ pick: window.__filePick, proxy: document.querySelectorAll('.grd-img-edit-proxy').length }));
  expect(errs).toEqual([]);
  expect(out.proxy, '★빈 슬롯에서 크롭 편집기가 열렸다 — 잘라 넣을 그림이 애초에 없다').toBe(0);
  expect(out.pick, '★빈 슬롯의 «파일 고르기» 가지가 죽었다 — 새 가지가 그 앞을 가로챘다').toBe(1);
});

/* ══════════════════════════════════════════════════════════════════════
 * C — ★코너 핸들의 «뜻». 현빈 확정: 「코너 핸들로 정하는 그 상자가 맞겠어.
 *     코너를 끌면 «통째로 작아지면» 안 되는 거지.」
 * ════════════════════════════════════════════════════════════════════ */

/** se 코너를 (dx,dy) 만큼 끈다. 핸들은 #ss-handles-overlay 에 있고 좌표는 화면 기준이다. */
async function dragCorner(page, dir, dx, dy) {
  const h = page.locator(`.grd-img-overlay-handle.${dir}`);
  const b = await h.boundingBox();
  expect(b, `★${dir} 코너 핸들이 화면에 없다`).not.toBeNull();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await page.evaluate(([x, y, ex, ey]) => {
    const el = document.querySelector('.grd-img-overlay-handle.se, .grd-img-overlay-handle.nw');
    const target = document.elementFromPoint(x, y) || el;
    const fire = (t, type, px, py) => t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: px, clientY: py }));
    fire(target, 'mousedown', x, y);
    fire(document, 'mousemove', x + ex, y + ey);
    fire(document, 'mousemove', x + ex, y + ey);
    fire(document, 'mouseup', x + ex, y + ey);
  }, [cx, cy, dx, dy]);
}

test('C1 ★★코너를 끌면 «프레임»만 줄고 그림은 «제자리»다 (통째로 작아지지 않는다)', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, PLAIN); await settle(page);
  await page.evaluate(() => {
    const b = document.getElementById(window.__ID);
    window.grdSetActiveLine(b, { r: 0, c: 0, li: 0 });
    window.__handles(b);
  });
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-overlay-handle').length === 4, null, { timeout: 5000 });

  /* ★«그림이 제자리인가»를 무엇으로 재나 — 두 자를 겹쳐 쓴다.
   *   ⑴ 기하 : 브라우저가 «실제로 그리는» 그림의 (x, y, 폭)을 프레임 기준으로 잰다.
   *            크롭이 없을 땐 그 값이 요소 rect 가 «아니다» — object-fit:cover 는 상자를
   *            넘겨 그린다. 그래서 CSS 의 cover 규약(k = max(W/nw, H/nh), 가운데 정렬)으로
   *            푼다. ⛔이건 «구현을 베낀 것»이 아니라 공표된 CSS 규칙이다 — 그 규칙을
   *            제품이 어기면 여기서 빨개지는 게 맞다.
   *   ⑵ 색   : 겹치는 조각 안 여러 점의 색이 그대로인가. 블록 «안쪽»을 찍는다 —
   *            가장자리는 서브픽셀 재표본화로 늘 조금 달라진다(실측: 기하가 0.02px 밖에
   *            안 달라도 SVG 를 다시 래스터화하면 경계선에서 2697/83580 점이 달라진다.
   *            그걸 결함으로 읽으면 «거짓 빨강»이다).
   *   ⇒ 통째로 작아지거나 밀리면 ⑴이 수십 px, ⑵가 색깔째로 운다. */
  const drawn = () => page.evaluate(() => {
    const f = document.querySelector('#host .grd-img-frame').getBoundingClientRect();
    const i = document.querySelector('#host img.grd-img');
    const r = i.getBoundingClientRect();
    const cs = getComputedStyle(i);
    const fit = (cs.objectFit || '').trim();
    const nw = i.naturalWidth, nh = i.naturalHeight;
    let box;
    if ((fit === 'cover' || fit === 'contain') && nw > 0 && nh > 0) {
      const k = fit === 'cover' ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
      const dw = nw * k, dh = nh * k;
      box = { x: (r.left - f.left) + (r.width - dw) / 2, y: (r.top - f.top) + (r.height - dh) / 2, w: dw };
    } else {
      box = { x: r.left - f.left, y: r.top - f.top, w: r.width };
    }
    return { frame: { w: f.width, h: f.height },
             pic: { x: +box.x.toFixed(2), y: +box.y.toFixed(2), w: +box.w.toFixed(2) } };
  });
  /** 겹치는 조각 안쪽 여러 점의 색 — 가장자리를 피해 «블록 안»을 찍는다. */
  const swatch = (page, w, h) => page.evaluate(([W, H]) => {
    const f = document.querySelector('#host .grd-img-frame').getBoundingClientRect();
    const pts = [];
    for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.2, 0.55, 0.85]) {
      pts.push([Math.round(f.left + W * fx), Math.round(f.top + H * fy)]);
    }
    return pts;
  }, [w, h]);

  const before = await drawn();
  const beforePng = await shotFrame(page);
  await dragCorner(page, 'se', -200, -60);
  await settle(page);
  const after = await drawn();
  const afterPng = await shotFrame(page);
  const line = await page.evaluate(() => {
    const l = window.__model(document.getElementById(window.__ID)).cells[0][0].lines[0];
    return { widthPct: l.widthPct, height: l.height, imgSizePct: l.imgSizePct, imgPosX: l.imgPosX, imgPosY: l.imgPosY };
  });
  expect(errs).toEqual([]);

  // ⑴ 전제 — 프레임이 «실제로» 줄었다(안 줄었으면 이 검사는 아무것도 안 본다)
  expect(after.frame.w, `★프레임 폭이 안 줄었다 (${before.frame.w} → ${after.frame.w})`).toBeLessThan(before.frame.w - 20);
  expect(after.frame.h, `★프레임 높이가 안 줄었다 (${before.frame.h} → ${after.frame.h})`).toBeLessThan(before.frame.h - 10);

  // ⑵ ★본 단언 ㉠ 기하 — 그림의 크기도 자리도 그대로다
  const why = `\n   프레임 ${Math.round(before.frame.w)}×${Math.round(before.frame.h)} → ${Math.round(after.frame.w)}×${Math.round(after.frame.h)}`
    + `\n   그림 ${JSON.stringify(before.pic)} → ${JSON.stringify(after.pic)}  모델 ${JSON.stringify(line)}`;
  expect(Math.abs(after.pic.w - before.pic.w),
    `★★그림이 «통째로» 작아졌다 — 현빈이 「코너를 끌면 통째로 작아지면 안 되는 거지」라 한 그 동작이다.${why}`)
    .toBeLessThanOrEqual(0.5);
  expect(Math.abs(after.pic.x - before.pic.x), `★그림이 가로로 밀렸다 — 잘리는 자리가 달라졌다.${why}`).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after.pic.y - before.pic.y), `★그림이 세로로 밀렸다 — 잘리는 자리가 달라졌다.${why}`).toBeLessThanOrEqual(0.5);

  // ⑵ ★본 단언 ㉡ 색 — 겹치는 조각 안쪽 아홉 점의 «색»이 그대로다
  const ov = await page.evaluate(async ([a, b]) => {
    const load = (x) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data:image/png;base64,' + x; });
    const [ia, ib] = [await load(a), await load(b)];
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const px = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);   // 왼쪽 위 기준
      return g.getImageData(0, 0, w, h).data; };
    const [pa, pb] = [px(ia), px(ib)];
    const out = [];
    for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.2, 0.55, 0.85]) {
      const x = Math.round(w * fx), y = Math.round(h * fy), i = (y * w + x) * 4;
      let d = 0; for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(pa[i + k] - pb[i + k]));
      out.push({ x, y, d, a: [pa[i], pa[i + 1], pa[i + 2]], b: [pb[i], pb[i + 1], pb[i + 2]] });
    }
    return { w, h, pts: out, worst: Math.max(...out.map(p => p.d)) };
  }, [beforePng.toString('base64'), afterPng.toString('base64')]);
  expect(ov.w * ov.h, '★겹치는 조각이 없다 — 이 대조는 아무것도 안 본다').toBeGreaterThan(1000);
  expect(ov.worst,
    `★겹치는 ${ov.w}×${ov.h} 조각의 «색»이 달라졌다 — 그림이 움직였다는 뜻이다.${why}\n   ${JSON.stringify(ov.pts)}`)
    .toBeLessThanOrEqual(8);

  // ⑶ 그 결과가 «모델»에도 ％로 남았다(저장·내보내기가 따라가려면 필요하다)
  for (const k of ['imgSizePct', 'imgPosX', 'imgPosY']) {
    expect(Number.isFinite(Number(line[k])), `★코너를 끌었는데 모델에 ${k} 가 안 생겼다 — 화면만 그렇고 저장은 안 됐다`).toBe(true);
  }
  expect(Number(line.imgSizePct), '★그림이 프레임보다 «작다» — 그러면 빈자리가 생긴다(잘려야 한다)').toBeGreaterThan(100);
});

test('C1-b ★★양성대조 — 되환산을 «빼면» 그림이 통째로 작아진다(그 구멍이 실재했다)', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  let injected = false;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    let body = fs.readFileSync(file);
    if (url.pathname === '/js/overlay-handles.js') {
      const src = body.toString('utf8');
      /* 되환산을 통째로 끈다 = 2026-09-25 «이전»의 동작(프레임만 바꾸고 크롭은 안 만든다). */
      const hacked = src.replace('      if (imgPin) {\n        const newW', '      if (false) {\n        const newW');
      injected = hacked !== src;
      body = Buffer.from(hacked, 'utf8');
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  expect(injected, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다').toBe(true);

  await plant(page, PLAIN); await settle(page);
  await page.evaluate(() => {
    const b = document.getElementById(window.__ID);
    window.grdSetActiveLine(b, { r: 0, c: 0, li: 0 });
    window.__handles(b);
  });
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-overlay-handle').length === 4, null, { timeout: 5000 });
  const pic = () => page.evaluate(() => {
    const f = document.querySelector('#host .grd-img-frame').getBoundingClientRect();
    const i = document.querySelector('#host img.grd-img');
    const r = i.getBoundingClientRect();
    const cs = getComputedStyle(i); const fit = (cs.objectFit || '').trim();
    const nw = i.naturalWidth, nh = i.naturalHeight;
    if ((fit === 'cover' || fit === 'contain') && nw > 0 && nh > 0) {
      const k = fit === 'cover' ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
      return +(nw * k).toFixed(2);
    }
    return +r.width.toFixed(2);
  });
  const w0 = await pic();
  await dragCorner(page, 'se', -200, -60);
  await settle(page);
  const w1 = await pic();
  expect(errs).toEqual([]);
  expect(w1, `★되환산을 뺐는데도 그림 폭이 그대로다(${w0} → ${w1}) — C1 이 재는 것은 «그 코드»가 아니다`)
    .toBeLessThan(w0 - 20);
});

/* ══════════════════════════════════════════════════════════════════════
 * C2 — 캔버스에서 끈 뒤 «패널이 같은 말을 하는가». (2026-09-25 실기 QA 가 잡은 건)
 *
 * ★무엇이 있었나 — overlay-handles.js 의 onMove 주석이 「이미지 절에는 폭 입력이 없어
 *   높이만 동기화한다」고 적어 뒀는데, 그 전제가 74eb3c9(「폭(%)」 칸 신설)로 거짓이 됐다.
 *   코드는 안 따라와서 실기 실측: 모델 widthPct=76 · 패널 칸 100 (높이는 159=159 로 맞음).
 *   저장값은 옳고 «화면만» 거짓말한다 — 패널을 다시 그리면 맞는 수가 나온다.
 *
 * ⛔★그래서 이 검사는 «두 축을 같이» 잰다. 높이만 재면 바로 이 버그가 또 새 나간다
 *   (지금까지 정확히 그 꼴이었다 — 높이 쪽은 처음부터 맞아서 아무도 안 걸렸다).
 * ★재는 것은 «모델 ↔ 패널 칸»의 일치다. 어느 한쪽의 «절대값»이 아니다 — 절대값을 박으면
 *   드래그 산식(grid-cell-resize.js)이 바뀔 때마다 이 검사가 남의 일로 빨개진다.
 * ⛔패널을 다시 그리지 «않고» 잰다 — 다시 그리면 모델에서 값을 새로 읽어 와 «항상» 맞는다.
 *   그게 바로 이 버그가 사람 눈에 안 띄던 까닭이다. 재렌더는 이 검사를 거짓 통과시킨다.
 * ════════════════════════════════════════════════════════════════════ */

test('C2 ★코너를 끌면 패널의 «폭»과 «높이»가 «둘 다» 모델과 같아진다 (재렌더 없이)', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, PLAIN); await settle(page);
  await page.evaluate(() => {
    const b = document.getElementById(window.__ID);
    window.__open(b, { r: 0, c: 0, li: 0 });       // ★끌기 «전»에 패널을 연다 — 칸이 있어야 갱신된다
    window.grdSetActiveLine(b, { r: 0, c: 0, li: 0 });
    window.__handles(b);
  });
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-overlay-handle').length === 4, null, { timeout: 5000 });

  const before = await page.evaluate(() => ({
    w: document.getElementById('grd-img-width-pct')?.value,
    h: document.getElementById('grd-img-height')?.value,
  }));
  expect(before.w, '★「폭(%)」 칸이 패널에 없다 — 이 검사가 잴 대상이 없다').not.toBeUndefined();

  await dragCorner(page, 'se', -200, -60);
  await settle(page);

  const seen = await page.evaluate(() => {
    const line = window.__model(document.getElementById(window.__ID)).cells[0][0].lines[0];
    const wNum = document.getElementById('grd-img-width-pct');
    const hNum = document.getElementById('grd-img-height');
    return {
      modelW: Number(line.widthPct), modelH: Number(line.height),
      panelW: wNum ? Number(wNum.value) : null, panelH: hNum ? Number(hNum.value) : null,
    };
  });
  expect(errs).toEqual([]);
  /* ⑴ 자가점검 — 드래그가 «실제로» 폭을 줄였나. 안 줄었으면 아래 「같다」는 빈 것끼리 견주기다
     (100 == 100 으로 공짜 통과한다). ⛔이 줄이 이 검사의 양성대조다. */
  expect(seen.modelW, `★드래그가 모델 폭을 «안» 바꿨다(${before.w} → ${seen.modelW}) — ` +
    '아래 일치 검사가 「둘 다 안 변함」으로 공짜 통과한다').toBeLessThan(100);
  // ⑵ 두 축이 «둘 다» 모델과 같다.
  expect(seen.panelW, `★패널 「폭(%)」이 모델과 어긋난다 — 모델 ${seen.modelW} · 패널 ${seen.panelW}. ` +
    '저장값은 옳은데 화면만 거짓말한다(overlay-handles.js onMove 가 폭을 안 갱신).').toBe(seen.modelW);
  expect(seen.panelH, `★패널 「높이(px)」가 모델과 어긋난다 — 모델 ${seen.modelH} · 패널 ${seen.panelH}`)
    .toBe(seen.modelH);
});

/* ══════════════════════════════════════════════════════════════════════
 * P — 우측 패널의 손잡이. ⛔슬라이더를 따로 두지 «않는다» — 편집기와 두 벌이 되면 따로 늙는다.
 *
 * ★2026-09-25 «뒤집혔다» — 현빈 지시로 Image 절의 단추 «셋»을 없앴다
 *   (「캔버스에서 다 직관적으로 조작이 가능한거잖아?」). 그래서 P1 의 물음이 뒤집힌다:
 *     옛 P1 「패널에 크롭 손잡이가 «있다»」  →  새 P1 「패널에 그 셋이 «없다»」.
 *   ⛔제목이 «조건»을 말하면 제목째 거짓이 될 수 있다 — 그래서 제목도 같이 뒤집었다.
 *
 * ★무엇이 이 검사를 대신하나 — 「맞추기」가 열던 편집기는 «W1»이 이미 «배선까지» 잰다
 *   (더블클릭 → enterGridImageEditMode). 즉 이 파일은 손잡이를 잃었지 «기능»을 잃지 않았다.
 *   W2·W3 가 음성대조까지 들고 있다. ⇒ 옛 P1 의 「맞추기」 몫은 «전부» W1 이 받는다.
 *
 * ⚠️★잃은 축을 정직하게 적는다 — 「크롭 초기화」는 «대체가 없다».
 *   · UI: 크롭을 지우는 손잡이가 이제 어디에도 없다(캔버스에도 없었다 — 편집기는
 *     image-handling.js beforeCommit 에서 세 값을 «항상 쓰기»만 한다). 되돌리기는 ⌘Z 뿐이다.
 *   · ⇒ 옛 P1 이 재던 「초기화하면 cover 로 돌아간다」의 «화면» 축은 여기서 사라졌다.
 *     남은 것은 «모델» 축이다: tests/unit/grid-img-crop.test.js 가 세 값을 지운 줄이
 *     cover 로 읽히는지를 계속 잰다(그 파일 「패널 「크롭 초기화」와 같은 뜻」 주석).
 *   · 되살릴 일이 생기면 현빈 조건대로 «편집모드 안»에 넣고, 이 검사를 다시 뒤집어라.
 * ════════════════════════════════════════════════════════════════════ */

test('P1 ★패널 Image 절에 단추가 «이미지 선택/교체» 하나뿐이다 — 셋은 캔버스로 갔다(2026-09-25 현빈)', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, CROPPED); await settle(page);

  const seen = await page.evaluate(() => {
    window.__open(document.getElementById(window.__ID), { r: 0, c: 0, li: 0 });
    const body = document.querySelector('#panel-right .panel-body');
    const secs = [...body.querySelectorAll('.prop-section')];
    const img = secs.find(s => (s.querySelector('.prop-section-title')?.textContent || '').trim() === 'Image');
    return {
      /* ★★「절이 통째로 안 떴다」와 「단추만 빠졌다」를 «갈라서» 잰다 —
         아래 gone 셋이 0 인 것만으로는 그 둘이 구별되지 않는다(절이 없어도 0 이다). */
      imgSectionThere: !!img,
      btnIds: img ? [...img.querySelectorAll('button')].map(b => b.id) : null,
      rowN: img ? img.querySelectorAll('.prop-row').length : -1,
      gone: ['grd-img-crop-btn', 'grd-img-crop-reset', 'grd-img-remove-btn']
        .filter(id => !!document.getElementById(id)),
      /* 남기기로 한 손잡이 셋 — 「지웠다」가 이웃까지 쓸어 가지 않았는지 */
      kept: ['grd-img-pick-btn', 'grd-img-width-pct', 'grd-img-height', 'grd-img-radius']
        .filter(id => !document.getElementById(id)),
    };
  });
  expect(errs).toEqual([]);
  expect(seen.imgSectionThere, '★Image 절이 «통째로» 안 떴다 — 단추를 지운 게 아니라 절을 깨뜨렸다').toBe(true);
  expect(seen.gone, `★없앴어야 할 단추가 살아 있다: ${seen.gone.join(', ')} — 되살리기 전에 ` +
    'prop-grid.js _grdImageSectionHtml 의 주석(어디로 갔는지)을 먼저 읽어라').toEqual([]);
  expect(seen.kept, `★남겼어야 할 손잡이가 사라졌다: ${seen.kept.join(', ')} — 지우기가 이웃까지 쓸어 갔다`).toEqual([]);
  expect(seen.btnIds, '★Image 절의 단추는 「이미지 선택/교체」 하나뿐이어야 한다').toEqual(['grd-img-pick-btn']);
  expect(seen.rowN, '★Image 절의 줄 수가 4(선택·폭·높이·반경)가 아니다').toBe(4);
});

test('P1-b ★양성대조 — 「맞추기」를 잃어도 «기능»은 산다: 더블클릭이 여전히 같은 편집기를 연다', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, CROPPED); await settle(page);
  await page.evaluate(() => window.__bind(document.getElementById(window.__ID)));
  await dblAt(page, '#host .grd-img-frame');
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-edit-proxy').length === 1, null, { timeout: 5000 });
  const n = await page.evaluate(() => document.querySelectorAll('.grd-img-edit-proxy').length);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-edit-proxy').length === 0);
  expect(errs).toEqual([]);
  expect(n, '★패널 단추를 지웠더니 크롭에 «닿을 길»이 하나도 안 남았다 — 그러면 지운 게 아니라 잃은 것이다').toBe(1);
});

/* ══════════════════════════════════════════════════════════════════════
 * S — 저장 → 다시 열기. ★제품의 세척(serializeCleanRoot)을 지난다.
 * ════════════════════════════════════════════════════════════════════ */

test('S1 ★★저장 → 다시 열기 — 세척을 지나도 크롭이 «같은 그림»으로 살아 있다', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, CROPPED); await settle(page);
  const before = await shotFrame(page);
  const meta = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const clone = canvas.cloneNode(true);
    window.serializeCleanRoot(clone);
    const saved = clone.innerHTML;
    canvas.innerHTML = saved;                       // 「다시 열기」
    const re = canvas.querySelector('.grid-block');
    window.__ID = re.id;
    window.__render(re);                            // 제품도 열 때 모델에서 다시 그린다
    return { savedHasCells: /data-cells=/.test(saved), savedHasCrop: /imgSizePct/.test(saved),
             savedHasProxy: /grd-img-edit-proxy/.test(saved),
             line: window.__model(re).cells[0][0].lines[0] };
  });
  await settle(page);
  const after = await shotFrame(page);
  expect(errs).toEqual([]);
  expect(meta.savedHasCells, '★저장본에 data-cells 가 없다 — 아래 견줌은 «빈 것끼리»다').toBe(true);
  expect(meta.savedHasCrop, '★저장본에 크롭 값이 «안 실렸다» — 다시 열면 사라진다').toBe(true);
  expect(meta.savedHasProxy, '★저장본에 편집용 임시 DOM 이 실렸다').toBe(false);
  expect({ s: meta.line.imgSizePct, x: meta.line.imgPosX, y: meta.line.imgPosY },
    '★다시 읽은 모델의 크롭이 다르다')
    .toEqual({ s: CROPPED.imgSizePct, x: CROPPED.imgPosX, y: CROPPED.imgPosY });
  const d = await diffPng(page, before, after);
  expect(d.size, '★다시 연 프레임의 «크기»가 다르다').toBeUndefined();
  expect(d.max, `★저장하고 다시 열었더니 «다른 그림»이다 (다른 점 ${d.n}/${d.total})`).toBe(0);
});

/* ══════════════════════════════════════════════════════════════════════
 * X — 내보내기. ★％로 저장한 까닭을 여기서 갚는다.
 * ════════════════════════════════════════════════════════════════════ */

test('X1 ★★내보내기 폭 780 — 크기만 작아지고 «잘리는 자리»는 그대로다', async ({ page }) => {
  const errs = await boot(page);
  await plant(page, CROPPED); await settle(page);
  const out = await page.evaluate(async () => {
    const sec = document.getElementById('sec');
    const liveFrame = sec.querySelector('.grd-img-frame');
    const liveImg = sec.querySelector('img.grd-img');
    const lf = liveFrame.getBoundingClientRect();
    const li = liveImg.getBoundingClientRect();
    const live = { frameW: lf.width, imgW: li.width,
                   relW: li.width / lf.width, relX: (li.left - lf.left) / lf.width, relY: (li.top - lf.top) / lf.height };
    const clone = await window.__prep(sec, 780, false);
    const cf = clone.querySelector('.grd-img-frame').getBoundingClientRect();
    const ci = clone.querySelector('img.grd-img').getBoundingClientRect();
    const exp = { frameW: cf.width, imgW: ci.width,
                  relW: ci.width / cf.width, relX: (ci.left - cf.left) / cf.width, relY: (ci.top - cf.top) / cf.height };
    clone.remove();
    return { live, exp };
  });
  expect(errs).toEqual([]);
  // ⑴ 전제 — 폭이 실제로 줄었다(안 줄었으면 이 검사는 아무것도 안 본다)
  expect(out.exp.frameW, `★내보내기 폭이 화면과 같다(${out.exp.frameW}) — 축소가 안 일어났다`)
    .toBeLessThan(out.live.frameW - 1);
  // ⑵ ★본 단언 — 프레임 대비 «비율»이 같다 = 같은 자리가 잘린다
  expect(out.exp.relW, `★그림 폭 비율이 갈렸다 (화면 ${out.live.relW} · 내보내기 ${out.exp.relW})`).toBeCloseTo(out.live.relW, 3);
  expect(out.exp.relX, `★가로로 잘리는 자리가 갈렸다 (화면 ${out.live.relX} · 내보내기 ${out.exp.relX})`).toBeCloseTo(out.live.relX, 3);
  expect(out.exp.relY, `★세로로 잘리는 자리가 갈렸다 (화면 ${out.live.relY} · 내보내기 ${out.exp.relY})`).toBeCloseTo(out.live.relY, 3);
});

/* ══════════════════════════════════════════════════════════════════════
 * T — 썸네일/html2canvas 경로. capture-safety 의 «가운데 고정»을 닫는다.
 * ════════════════════════════════════════════════════════════════════ */

/* ★상자를 «두 벌» 쓴다 — 어느 축이 잘리는지가 상자 비율로 정해지기 때문이다.
   그림은 400×250(비 1.6).
     · 넓은 상자 200×100(비 2.0 > 1.6) → 폭에 맞춰 키우고 «세로»를 깎는다 ⇒ 세로 자리만 뜻이 있다
     · 좁은 상자 100×100(비 1.0 < 1.6) → 높이에 맞춰 키우고 «가로»를 깎는다 ⇒ 가로 자리만 뜻이 있다
   ⛔이걸 안 가르면 「가로 0% 와 가운데가 같다」를 결함으로 읽는다 — 깎을 여백이 0 이라
     같은 게 «맞다». (초판에서 내가 정확히 그 거짓 빨강을 만들었다.) */
const H2C_BOX = (w, h) => `<div id="h2c" style="width:${w}px;height:${h}px;">
  <img id="h2cimg" src="${IMG}" style="display:block;width:100%;height:100%;object-fit:cover;">
</div>`;
const H2C_WIDE = H2C_BOX(200, 100);    // 세로가 잘린다
const H2C_TALL = H2C_BOX(100, 100);    // 가로가 잘린다

const bakeWith = (page, box, poss) => page.evaluate(async ([b, ps]) => {
  const out = {};
  for (const [name, pos] of ps) {
    const host = document.getElementById('host');
    host.innerHTML = b;
    const img = document.getElementById('h2cimg');
    if (pos) img.style.objectPosition = pos;
    await img.decode();
    const n = await window.__neut(host);            // ← 제품이 썸네일 직전에 부르는 바로 그 함수
    out[name] = { n, src: document.getElementById('h2cimg').src };
  }
  return out;
}, [box, poss]);

for (const [axis, box, poss] of [
  ['세로', H2C_WIDE, [['a', '50% 0%'], ['mid', null], ['b', '50% 100%']]],
  ['가로', H2C_TALL, [['a', '0% 50%'], ['mid', null], ['b', '100% 50%']]],
]) {
  test(`T1[${axis}] ★썸네일 경로가 object-position 을 «따라간다» (거짓 주석이 가린 자리)`, async ({ page }) => {
    const errs = await boot(page);
    const out = await bakeWith(page, box, poss);
    expect(errs).toEqual([]);
    expect(out.mid.n, '★중화 함수가 그림을 한 장도 안 바꿨다 — 아래 대조는 헛것이다(비율이 이미 같았나?)').toBe(1);
    expect(out.a.n, '★한쪽 끝 정렬 그림을 안 구웠다').toBe(1);
    expect(out.a.src === out.mid.src,
      `★★${axis} object-position 한쪽 끝과 기본값(가운데)이 «같은 그림»으로 구워졌다 —\n`
      + '   capture-safety 가 그 속성을 안 읽는다.\n'
      + '   (js/io/capture-safety.js 의 옛 주석이 「이 레포는 그 속성을 한 군데도 안 쓴다」고 틀리게 적어 둔 자리다.\n'
      + '    실제로는 js/image-handling.js:31·825 가 2026-03-24부터 쓰고 있었다.)').toBe(false);
    expect(out.b.src === out.mid.src, `★${axis} 반대쪽 끝도 가운데와 같은 그림이다`).toBe(false);
    expect(out.a.src === out.b.src, `★${axis} 양 끝이 «같은 그림»이다 — 읽기는 하는데 방향을 못 쓴다`).toBe(false);
  });
}

test('T1-c ★음성대조 — «깎을 여백이 없는» 축은 자리를 줘도 같은 그림이다(그게 맞다)', async ({ page }) => {
  const errs = await boot(page);
  /* 넓은 상자(비 2.0 > 1.6)는 폭이 딱 맞고 세로만 깎는다 ⇒ «가로» 자리는 뜻이 없다.
     여기서 「달라져야 한다」고 우기면 그 자는 CSS 를 모르는 채로 빨개진다. */
  const out = await bakeWith(page, H2C_WIDE, [['a', '0% 50%'], ['mid', '50% 50%'], ['b', '100% 50%']]);
  expect(errs).toEqual([]);
  expect(out.a.src, '★깎을 여백이 0 인 축에서 그림이 갈렸다 — 셈이 틀렸다').toBe(out.mid.src);
  expect(out.b.src, '★깎을 여백이 0 인 축에서 그림이 갈렸다 — 셈이 틀렸다').toBe(out.mid.src);
});

test('T1-b ★양성대조 — object-position 읽기를 «가운데 고정»으로 되돌리면 T1 이 빨개진다', async ({ page }) => {
  /* 레포 파일을 서빙 «직전»에 한 군데만 비튼다 — grid-cell-panel-handles 의 mutate 수법. */
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  let injected = false;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    let body = fs.readFileSync(file);
    if (url.pathname === '/js/io/capture-safety.js') {
      const src = body.toString('utf8');
      const hacked = src.replace(
        'const pos = _objectPositionOffsets(cs, cvs.width - dw, cvs.height - dh);',
        'const pos = { x: (cvs.width - dw) / 2, y: (cvs.height - dh) / 2 };');
      injected = hacked !== src;
      body = Buffer.from(hacked, 'utf8');
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  expect(injected, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다').toBe(true);
  const out = await page.evaluate(async ([box]) => {
    const mk = async (pos) => {
      const host = document.getElementById('host');
      host.innerHTML = box;
      const img = document.getElementById('h2cimg');
      if (pos) img.style.objectPosition = pos;
      await img.decode();
      await window.__neut(host);
      return document.getElementById('h2cimg').src;
    };
    return { top: await mk('50% 0%'), center: await mk(null) };
  }, [H2C_WIDE]);
  expect(errs).toEqual([]);
  expect(out.top, '★«가운데 고정»으로 되돌렸는데도 위/가운데가 다르다 — T1 이 재는 것은 그 줄이 아니다')
    .toBe(out.center);
});
