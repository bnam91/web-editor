/* grad-h9a-short-section.dom.spec.js — 1017t1h9ⓐ 짧은 섹션에서 그라데이션 둘이 완전히 겹친다
 *
 * 현빈 원문 「👉 개선됐니?」 (T0-NOTE-ORIGINAL-261025 · 1017t1h9)
 * 미카사 앱 실측(261025 · f62653ce): 새 빈 섹션(높이 283)에서 스티커 패널 Gradient ×2 ⇒ 둘 다 x0 y0 860×300 (완전 겹침).
 *   까닭: 오프셋 y(40·64) + 기본 높이 300 > 섹션 높이 ⇒ 섹션 안 clamp 가 y 를 0 으로 되돌린다.
 *
 * 칸
 *   P0  전제 — 섹션 높이가 정말 «오프셋 + 기본 높이» 보다 짧다 · 기본 높이 300 이 소스에 그대로 있다
 *   A   짧은 섹션(283) — 둘의 y 가 갈리고(40·64) 둘 다 섹션 안에 든다(y + 높이 ≤ 섹션 높이)
 *   T   긴 섹션(600) — 고침 전과 같다(높이 300 · y 40·64) ⇒ 짧을 때만 손댔다
 *   PIN 양성대조 — 핀 ca702d40 의 원본 소스로 같은 장면 ⇒ y 둘이 같다(=겹침이 실제로 난다)
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grad-h9a-short-section
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://gradh9a.dom.test';
const MIME = { '.css': 'text/css' };
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').replace(/\r\n/g, '\n');
const PIN = 'ca702d40';
const pinned = (p) => execFileSync('git', ['-C', REPO, 'show', `${PIN}:${p}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');

const GB_SRC = process.env.H9A_PIN ? pinned('js/blocks/gradient-block.js') : read('js/blocks/gradient-block.js');   /* H9A_PIN=1 = 양성대조(핀 원본으로 A 가 빨강인지) */
const GB_PIN = pinned('js/blocks/gradient-block.js');
const GS_SRC = read('js/gradient-select.js');
const SS_SRC = read('js/sticker-select.js');
const IH_SRC = read('js/insert-history.js');
const IS_SRC = read('js/insert-select.js');
const BE_SRC = read('js/block-edit.js');
const PD_SRC = read('js/panel-dispatch.js');

function harness({ gb = GB_SRC, ih = IH_SRC, textH = 150, secH = 600 } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<style>body{margin:0}</style>
<script>
  window.currentZoom = 40;
  window.__hist = 0;
  window.pushHistory = (a) => { window.__hist = (window.__hist||0) + 1; window.__lastAction = a; };
  window.scheduleAutoSave = () => {};
  window.buildLayerPanel = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  /* ★window.showGradientProperties — 제품 정의 자리는 js/props/prop-gradient.js. DOM 하네스에서는
     ★스텁이다(선례 tests/dom/undo-restore-selection.dom.spec.js:52). */
  window.showGradientProperties = (el) => { window.__panelFor = el && el.id; };
  window.getSelectedSection = () => document.querySelector('.section-block');
  window.showNoSelectionHint = () => { window.__hint = (window.__hint || 0) + 1; };
  window.deselectAll = () => {};
  window.clearSelectionMarks = () => { document.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected')); };
  window.highlightBlock = () => {};
</script>
</head><body>
<!-- ★js/editor.js:368 _applyScalerTransform 의 그 꼴(scale(currentZoom/100)) — origin 만 top left 로
     단순화(production 은 top center. 드래그 산식(/zoom)을 «진짜로» 밟으려면 scaler 가 있어야 한다). -->
<div id="canvas-scaler" style="transform:scale(0.4);transform-origin:top left;">
<div id="canvas">
  <div class="section-block" id="sec1" style="width:860px;height:${secH}px">
    <div class="section-inner">
      <div class="row">
        <div class="text-block tb-h1" id="txt1" style="height:${textH}px;margin:0;background:rgba(0,0,255,0.35)">본문 글자 — G-N0 쌓임 실측용</div>
      </div>
    </div>
  </div>
</div>
</div>
<div id="ss-handles-overlay" style="position:fixed;inset:0;pointer-events:none;z-index:9000"></div>
<script>${SS_SRC}</script>
<script>${ih}</script>
<script>${IS_SRC}</script>
<script>${BE_SRC}</script>
<script>${PD_SRC}</script>
<script type="module">
${gb}
window.__gbReady = true;
</script>
<script type="module">
${GS_SRC}
window.__gsReady = true;
</script>
</body></html>`;
}

async function boot(page, opts) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/h.html') return route.fulfill({ contentType: 'text/html', body: harness(opts) });
    const file = path.join(REPO, u.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`${ORIGIN}/h.html`);
  await page.waitForFunction(() => window.__gbReady && window.__gsReady && window.addGradientBlock && window.renderGradientBlock);
  return errs;
}




const addTwo = (page) => page.evaluate(() => {
  window.addGradientBlock(); window.addGradientBlock();
  const sec = document.getElementById('sec1');
  return { secH: sec.clientHeight, g: [...sec.querySelectorAll('.gradient-block')].map((g) => ({ y: Number(g.dataset.y), h: Number(g.dataset.gradHeight) })) };
});

test('P0 전제 — 섹션 283 은 오프셋 40 + 기본 높이 300 보다 짧다 · 기본 높이 300 이 소스에 있다', async ({ page }) => {
  await boot(page, { secH: 283, textH: 20 });
  const secH = await page.evaluate(() => document.getElementById('sec1').clientHeight);
  expect(secH).toBe(283);
  expect(secH).toBeLessThan(40 + 300);
  expect(/height:\s*300,/.test(GB_SRC)).toBe(true);
  expect(GB_SRC).not.toBe(GB_PIN);
});

test('A 짧은 섹션 — 둘의 y 가 갈리고 둘 다 섹션 안에 든다', async ({ page }) => {
  const errs = await boot(page, { secH: 283, textH: 20 });
  const r = await addTwo(page);
  expect(r.g.length).toBe(2);
  expect(r.g.map((x) => x.y)).toEqual([40, 64]);
  for (const x of r.g) { expect(x.h).toBeGreaterThanOrEqual(50); expect(x.y + x.h).toBeLessThanOrEqual(r.secH); }
  expect(errs).toEqual([]);
});

test('T 긴 섹션 — 고침 전과 같다(높이 300 · y 40·64)', async ({ page }) => {
  const errs = await boot(page, { secH: 600, textH: 20 });
  const r = await addTwo(page);
  expect(r.g).toEqual([{ y: 40, h: 300 }, { y: 64, h: 300 }]);
  expect(errs).toEqual([]);
});

test(`PIN 양성대조 — 핀 ${PIN} 원본이면 짧은 섹션에서 y 둘이 같다(겹침 재현)`, async ({ page }) => {
  const errs = await boot(page, { secH: 283, textH: 20, gb: GB_PIN });
  const r = await addTwo(page);
  expect(r.g.length).toBe(2);
  expect(r.g[0].y).toBe(r.g[1].y);
  expect(r.g[0].h).toBe(300);
  expect(errs).toEqual([]);
});
