/* asset-drop-content-column.dom.spec.js — D6 ⒡2 = ⒠ (lane-drag · 2026-10-05 · 지디 승인 23:19)
 *
 * 노트패널/스크래치 이미지를 섹션 본문(section-inner) «블록 사이 빈자리»에 놓으면 섹션 «배경»으로 갔다(실앱 계측: 블록 사이 여백 ·
 * z100 B|C 경계 · 내용 칼럼 맨 위 — 끄는 동안 elementFromPoint 가 gap ↔ section-inner 를 오갔다).
 * ⒠ = x 가 «내용 칼럼»(section-inner 의 좌우 패딩 안쪽)이면 넣기(블록 사이 자리) · 좌우 패딩이면 배경(⒡3 토스트와 함께).
 * 조건(지디): ⒞(배경 그대로) 기각 — B|C 경계에 놓은 것이 배경이 되면 «놓은 자리에 추가» 가 안 된다.
 *
 * ⛔앱을 «안» 띄운다 — section-drag.js · canvas-scratch-drop.js · scratch-pad.js 를 진짜 모듈로 얹고 dropAssetImageAt 을 부른다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/asset-drop-content-column.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* section-inner 에 위·아래 패딩 12 · 좌우 72 — A 와 B 사이엔 gap 없이 A 의 margin 으로 «빈자리»(hit = section-inner)를 둔다 */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; font: 20px/1.5 sans-serif; }
  #canvas-wrap { position:relative; width:900px; height:800px; background:#555; }
  .section-block { position:relative; width:860px; background:#fff; }
  .section-inner { padding: 12px 72px; display:flex; flex-direction:column; }
  .gap-block { height: 24px; }
  #tfA { margin-bottom: 30px; }
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0"><div id="canvas">
  <div class="section-block" id="sec"><div class="section-inner" id="inner">
    <div class="frame-block" id="tfA" data-text-frame="true"><div class="text-block"><div class="tb-body">A A A A A</div></div></div>
    <div class="frame-block" id="tfB" data-text-frame="true"><div class="text-block"><div class="tb-body">B B B B B</div></div></div>
    <div class="gap-block" id="g9"></div>
  </div></div>
</div></div></div>
<script>
  window.state = { pageSettings: { padX: 72 } };
  window.__toasts = []; window.showToast = (m) => window.__toasts.push(String(m));
  window.pushHistory = () => {}; window.scheduleAutoSave = () => {};
  window.setSectionBgImage = (sec) => { sec.dataset.bgImg = 'set'; return true; };
  window._scratchAddAndSave = async () => {};
  window.makeAssetBlock = () => { const row = document.createElement('div'); row.className = 'row'; row.id = 'row_new'; const block = document.createElement('div'); block.className = 'asset-block'; block.style.height = '20px'; row.appendChild(block); return { row, block }; };
  window.applyPadXToSection = () => {}; window.setAssetImageFromSrc = () => {}; window.buildLayerPanel = () => {}; window.bindBlock = () => {};
</script>
<script type="module">
  import '/js/section-drag.js';
  import '/js/canvas-scratch-drop.js';
  import '/js/scratch-pad.js';
  /* ⚠️drag-utils.js 가 얹히면서 window.showToast 를 «제 것»으로 덮는다 — 기록기는 모듈 «뒤»에 감싼다(첫 판이 이것 때문에 무효였다). */
  { const _orig = window.showToast; window.showToast = (m, ...a) => { window.__toasts.push(String(m)); try { return _orig?.(m, ...a); } catch (_) {} }; }
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
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true && typeof window.dropAssetImageAt === 'function', null, { timeout: 10000 });
}

async function drop(page, where) {
  return page.evaluate(async ({ where, PX }) => {
    const inner = document.getElementById('inner').getBoundingClientRect();
    const A = document.getElementById('tfA').getBoundingClientRect(), B = document.getElementById('tfB').getBoundingClientRect();
    const colX = inner.left + 72 + 40, padX = inner.left + 36;
    const p = where === 'col-between' ? { x: colX, y: (A.bottom + B.top) / 2 }
            : where === 'col-top' ? { x: colX, y: inner.top + 4 }
            : { x: padX, y: (A.bottom + B.top) / 2 };            // 'pad-between'
    const hit = document.elementFromPoint(p.x, p.y);
    const kind = await window.dropAssetImageAt(p.x, p.y, PX, { naturalWidth: 1, naturalHeight: 1 });
    const order = [...document.getElementById('inner').children].map(e => e.id).filter(Boolean).join(' ');
    return { hit: hit.id || hit.className, kind, order, bg: document.getElementById('sec').dataset.bgImg || null, toasts: window.__toasts.slice() };
  }, { where, PX });
}

test('E-a ★내용 칼럼 «블록 사이 빈자리»(hit = section-inner)에 놓으면 그 자리에 넣는다 — 배경 아님', async ({ page }) => {
  await boot(page);
  const r = await drop(page, 'col-between');
  expect(r.hit, '장면: 빈자리를 맞혔다').toBe('inner');
  expect({ order: r.order, bg: r.bg }, `결과=${JSON.stringify(r)} (고치기 전 = 배경)`).toEqual({ order: 'tfA row_new tfB g9', bg: null });
});

test('E-b ★내용 칼럼 «맨 위»(위 패딩 · hit = section-inner)에 놓으면 맨 앞에 넣는다', async ({ page }) => {
  await boot(page);
  const r = await drop(page, 'col-top');
  expect(r.hit, '장면').toBe('inner');
  expect({ order: r.order, bg: r.bg }, `결과=${JSON.stringify(r)}`).toEqual({ order: 'row_new tfA tfB g9', bg: null });
});

test('E-c 대조 · 좌우 «패딩»에 놓으면 지금처럼 배경 + 토스트(⒡3)', async ({ page }) => {
  await boot(page);
  const r = await drop(page, 'pad-between');
  expect({ bg: r.bg, toasted: r.toasts.length > 0, order: r.order }, `결과=${JSON.stringify(r)}`).toEqual({ bg: 'set', toasted: true, order: 'tfA tfB g9' });
});
