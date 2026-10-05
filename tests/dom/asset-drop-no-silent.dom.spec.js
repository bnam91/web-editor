/* asset-drop-no-silent.dom.spec.js — D6 ⒡3 (lane-drag · 2026-10-05 · 지디 「조용한 무동작을 남기지 마라」)
 *
 * 노트패널 이미지를 놓았을 때 «아무 말 없이» 끝나는 갈래가 둘 있었다(실앱 계측 z40·z100):
 *   ⑴ 블록 사이 여백(section-inner 패딩 · 글자 회전 핫존)에 놓으면 «섹션 배경»으로 갔다 — 그림 블록 0 · 토스트 0
 *      (1px 그림이면 화면에선 «안 생김»으로 보임 = esweep 「B|C 경계 → 아무 데도 안 생김」).
 *   ⑵ 캔버스 밖(패널 위 등)에 놓으면 null — 토스트 0.
 * ⒡3 = 섹션 배경으로 갔으면 「섹션 배경으로 넣었어요」 · 넣을 데가 없으면 「여기엔 놓을 수 없습니다」.
 *
 * ⛔앱을 «안» 띄운다 — scratch-pad.js(dropAssetImageAt) · canvas-scratch-drop.js · section-drag.js 를 진짜 모듈로 얹는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/asset-drop-no-silent.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; display:flex; font: 20px/1.5 sans-serif; }
  #side { width:200px; height:800px; background:#ddd; }
  #canvas-wrap { position:relative; width:900px; height:800px; background:#555; }
  .section-block { position:relative; width:800px; background:#fff; }
  .section-inner { padding: 0 72px; display:flex; flex-direction:column; }
  .gap-block { height: 24px; }
</style></head><body>
<div id="side">패널</div>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0"><div id="canvas">
  <div class="section-block" id="sec"><div class="section-inner" id="inner">
    <div class="gap-block"></div><div class="frame-block" id="tfA" data-text-frame="true"><div class="text-block"><div class="tb-body">A A A A</div></div></div>
    <div class="gap-block"></div><div class="frame-block" id="tfB" data-text-frame="true"><div class="text-block"><div class="tb-body">B B B B</div></div></div><div class="gap-block"></div>
  </div></div>
</div></div></div>
<script>
  window.state = { pageSettings: { padX: 72 } };
  window.__toasts = []; window.showToast = (m) => window.__toasts.push(String(m));
  window.pushHistory = () => {}; window.scheduleAutoSave = () => {};
  window.setSectionBgImage = (sec, src) => { sec.dataset.bgImg = 'set'; return true; };
  window._scratchAddAndSave = async () => { window.__scratch = (window.__scratch || 0) + 1; };
  window.makeAssetBlock = () => { const row = document.createElement('div'); row.className = 'row'; const block = document.createElement('div'); block.className = 'asset-block'; row.appendChild(block); return { row, block }; };
  window.applyPadXToSection = () => {}; window.setAssetImageFromSrc = () => {}; window.buildLayerPanel = () => {}; window.bindBlock = () => {};
</script>
<script type="module">
  import '/js/section-drag.js';
  import '/js/canvas-scratch-drop.js';
  import '/js/scratch-pad.js';
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
  await page.waitForFunction(() => window.__ready === true && typeof window.dropAssetImageAt === 'function', null, { timeout: 10000 });
  return errs;
}

test('T3a ★블록 사이 «여백»(section-inner 패딩)에 놓아 섹션 배경으로 갔으면 말한다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async (PX) => {
    const A = document.getElementById('tfA').getBoundingClientRect(), B = document.getElementById('tfB').getBoundingClientRect();
    const sec = document.getElementById('sec').getBoundingClientRect();
    const x = Math.round((sec.left + A.left) / 2), y = Math.round((A.bottom + B.top) / 2);   // 왼쪽 패딩 · A·B 사이
    const hit = document.elementFromPoint(x, y);
    const kind = await window.dropAssetImageAt(x, y, PX, { naturalWidth: 1, naturalHeight: 1 });
    return { hit: hit.id || hit.className, kind, bg: document.getElementById('sec').dataset.bgImg || null, toasts: window.__toasts.slice() };
  }, PX);
  expect(r.toasts.length, `토스트=${JSON.stringify(r.toasts)} · 결과=${JSON.stringify(r)} (고치기 전 실앱 = 섹션 배경 바뀜 · 토스트 0)`).toBeGreaterThan(0);
});

test('T3b ★캔버스 밖(패널 위)에 놓으면 «여기엔 놓을 수 없습니다»', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async (PX) => {
    const kind = await window.dropAssetImageAt(100, 300, PX, { naturalWidth: 1, naturalHeight: 1 });
    return { kind, toasts: window.__toasts.slice() };
  }, PX);
  expect(r.kind, '캔버스 밖은 아무것도 안 넣는다(그대로)').toBeNull();
  expect(r.toasts, `토스트=${JSON.stringify(r.toasts)} (고치기 전 = 0)`).toContain('여기엔 놓을 수 없습니다');
});
