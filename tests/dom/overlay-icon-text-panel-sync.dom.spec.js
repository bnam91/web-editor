/* overlay-icon-text-panel-sync.dom.spec.js — 「손잡이로 바꾼 폭을 우측 패널이 «아는가»」.
 *
 * ★신고의 뿌리 (2026-09-20 최종 통합 라운드, 아이콘+텍스트 손잡이 b1e51fc 의 «이음매»)
 *   b1e51fc 가 .icon-text-block 에 오버레이 모서리 손잡이를 달았다. 그런데 드래그가 끝난 뒤
 *   패널을 새로 그리는 자리가 «래퍼가 있는 타입»만 통과시키고 있었다:
 *     js/overlay-handles.js onUp — `if (tb && tb !== posEl) showTextProperties(tb)`
 *   .icon-text-block 은 text-frame 래퍼가 «없어» posElOf() 가 블럭 자신을 돌려준다
 *   ⇒ tb === posEl ⇒ 패널이 영영 안 새로 그려진다.
 *
 * ★실측 (고치기 전, 이 하네스)
 *   · 아이콘+텍스트 : se 를 150px → 블럭 733px / 패널 너비칸 «600» (거짓말)
 *   · 텍스트(래퍼)  : se 를 150px → 블럭 733px / 패널 너비칸 733   (원래부터 맞다)
 *   그리고 그 거짓말은 «보이기»에서 끝나지 않는다 — 그 뒤 너비 슬라이더를 한 칸만 건드리면
 *   패널이 쥐고 있던 600 이 «적용»돼 방금 키운 폭이 601 로 도로 줄어든다(P3 가 그걸 잰다).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(text-gradient.dom.spec.js 와 같은 부팅).
 *   ★패널은 스텁이 아니라 «진짜» js/props/prop-text.js 다. 스텁을 두면 이 검사가 재는 것
 *     (패널이 무엇을 읽어 무엇을 쓰는가)이 통째로 사라진다.
 * ⚠️변이 책임은 tests/unit/overlay-icon-text-handles.test.mjs 문④ 가 진다(tests/dom 은 `npm test` 밖).
 *
 * 실행: npm run test:dom -- overlay-icon-text-panel-sync
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<link rel="stylesheet" href="/css/editor-extra.css">
<style>#panel-right{position:fixed;right:0;top:0;width:260px;height:100%;overflow:auto;z-index:10000}</style>
</head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block" id="sec" style="width:860px;min-height:600px;position:relative">
      <div class="section-inner" id="host" style="width:600px;margin:0 auto"></div>
    </div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/feature-flags.js"></script>
<script src="/js/drag-history.js"></script>
<!-- ★2026-09-21(T-079): selectBlock 의 패널 디스패치가 js/panel-dispatch.js 로 빠졌다.
     block-edit.js 를 얹는 하네스는 이 줄을 «앞»에 같이 얹어야 한다(실제 index.html 과 같은 순서).
     빼면 openPanelForBlock 이 undefined 인데 호출이 옵셔널 체이닝이라 «예외도 없이» 패널만
     안 열린다 = 「패널을 못 열고도 초록」. 짝을 tests/unit/layer-panel-panel-table U-DISPATCH-6 이 센다. -->
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script src="/js/text-effect-transform.js"></script>
<script type="module">
  import '/js/block-factory.js';                       // makeIconTextBlock / makeTextBlock / _makeTextFrame
  import '/js/props/color-picker.js';                  // 패널 스와치가 이걸 부른다
  import { showTextProperties } from '/js/props/prop-text.js';
  import { showHandlesFor } from '/js/overlay-handles.js';
  window.currentZoom = 100;
  /* ★전역으로 «올려» 둔다 — onUp 이 window.showTextProperties 를 부른다(앱과 같은 경로). */
  window.showTextProperties = showTextProperties;
  window.showHandlesFor = showHandlesFor;
  window.scheduleAutoSave = () => {};
  window.triggerAutoSave  = () => {};
  window.getBlockBreadcrumb = () => '';
  window.pushHistory = () => {};
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

/** 아이콘+텍스트를 «진짜 팩토리»로 올리고 «진짜 패널»을 연다. */
async function mountIconText(page) {
  await page.evaluate(() => {
    const { row, block } = window.makeIconTextBlock();
    document.getElementById('host').appendChild(row);
    window.__target = block;                 // 폭을 쥔 요소 = 블럭 자신(래퍼가 없다)
    block.classList.add('selected');
    window.showTextProperties(block);
  });
  await raf(page);
}

/** 대조군 — 래퍼(text-frame)가 있는 흔한 텍스트. */
async function mountText(page) {
  await page.evaluate(() => {
    const tf = window._makeTextFrame();
    const { block: tb } = window.makeTextBlock('body');
    const c = tb.querySelector('[class^="tb-"]');
    c.textContent = '오버레이 텍스트'; c.style.fontSize = '20px';
    delete c.dataset.isPlaceholder;
    tf.appendChild(tb);
    document.getElementById('host').appendChild(tf);
    window.__target = tf;                    // 폭을 쥔 요소 = 래퍼
    tb.classList.add('selected');
    window.showTextProperties(tb);
  });
  await raf(page);
}

/** 패널의 오버레이 버튼을 «진짜로» 누른다(스텁 진입 금지 — 그 경로가 손잡이를 띄운다). */
async function enterOverlay(page) {
  await page.click('#txt-overlay-toggle');
  await raf(page);
}

async function dragSE(page, dx) {
  const box = await page.locator('#ss-handles-overlay .tfo-overlay-handle.se').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await raf(page);
}

const blockW = (page) => page.evaluate(() => window.__target.offsetWidth);
const panelW = (page) => page.evaluate(() => +document.getElementById('txt-width-number').value);

test('P1 ★아이콘+텍스트 — 손잡이로 키운 폭을 패널이 «안다» (고치기 전 733 vs 600)', async ({ page }) => {
  const errs = await boot(page);
  await mountIconText(page);
  await enterOverlay(page);
  expect(await page.locator('#ss-handles-overlay .tfo-overlay-handle').count(),
    '전제가 깨졌다 — 손잡이가 안 붙었다(b1e51fc 가 되돌려졌나)').toBe(4);
  await dragSE(page, 150);
  const w = await blockW(page), p = await panelW(page);
  expect(w, `폭이 안 커졌다(${w})`).toBeGreaterThan(700);
  expect(p, `★패널이 거짓말한다 — 블럭은 ${w}px 인데 너비칸은 ${p} 이다`).toBe(w);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('P2 대조 — 래퍼가 있는 텍스트는 «원래부터» 안다 (회귀 0 확인)', async ({ page }) => {
  await boot(page);
  await mountText(page);
  await enterOverlay(page);
  await dragSE(page, 150);
  const w = await blockW(page), p = await panelW(page);
  expect(p, `래퍼 있는 텍스트까지 어긋났다 — 블럭 ${w} / 패널 ${p}`).toBe(w);
});

test('P3 ★해악 — 드래그 뒤 슬라이더를 한 칸 건드려도 폭이 «도로 줄지» 않는다', async ({ page }) => {
  await boot(page);
  await mountIconText(page);
  await enterOverlay(page);
  await dragSE(page, 150);
  const grown = await blockW(page);
  /* 슬라이더를 «진짜로» 한 칸 민다(ArrowRight = input 이벤트 1회, step 1). */
  await page.locator('#txt-width-slider').focus();
  await page.keyboard.press('ArrowRight');
  await raf(page);
  const after = await blockW(page);
  expect(after, `★패널이 쥔 옛 값이 «적용»돼 ${grown}px → ${after}px 로 되돌아갔다`)
    .toBeGreaterThanOrEqual(grown);
});
