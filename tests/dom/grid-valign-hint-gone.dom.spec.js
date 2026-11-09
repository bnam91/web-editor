/* grid-valign-hint-gone.dom.spec.js — t2-05(0.9.11_t2 · 현빈): 그리드 패널의 「세로 정렬은 컬럼 높이가 서로 다를 때만 움직인다」
 *   안내 줄을 지웠다. 블록·칸·줄 세 상태에서 그 글이 «다시 안 뜬다»를 잰다.
 *   ★전제 줄: 같은 패널에 「세로 정렬」 라벨은 «있다» — 패널이 안 그려져서 초록인 게 아님을 막는다.
 *   하네스는 tests/dom/grid-panel-fold.dom.spec.js 를 그대로 베꼈다.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script>window.openIconifyModal = (cb) => cb({ svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', size: 64 });</script>
<script type="module">
  import { makeGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock; window.__model = getGridModel; window.__open = showGridProperties;
  window.__ready = true;
</script></body></html>`;

function installMount(page) {
  return page.addInitScript(() => {
    window.__mount = (fx, addr) => {
      const HOST = document.getElementById('host');
      HOST.innerHTML = ''; document.querySelector('#panel-right .panel-body').innerHTML = '';
      const { row, block } = window.__mk(JSON.parse(JSON.stringify(fx)));
      HOST.appendChild(row); block.classList.add('selected');
      window.__b = block; window.__open(block, addr);
      return block;
    };
  });
}

async function boot(page) {
  await installMount(page);
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
  await page.setViewportSize({ width: 1280, height: 900 });
  return errs;
}

const FIX = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: 'A' }, { type: 'h2', text: 'A1' }] }, { lines: [{ type: 'body', text: 'B' }] }],
    [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }],
  ],
};
const GONE = '세로 정렬은 컬럼 높이가 서로 다를 때만 움직인다';

for (const [name, addr] of [['block', null], ['cell', { r: 0, c: 1, li: null }], ['line', { r: 0, c: 0, li: 1 }]]) {
  test(`V1 ${name} 상태 — 「${GONE}」 안내가 없다`, async ({ page }) => {
    const errs = await boot(page);
    const txt = await page.evaluate(([fx, a]) => { window.__mount(fx, a); return document.querySelector('#panel-right .panel-body').textContent; }, [FIX, addr]);
    expect(errs).toEqual([]);
    expect(txt, '전제: 패널에 「세로 정렬」 라벨이 그려졌다').toContain('세로 정렬');
    expect(txt, 't2-05: 지운 안내 줄이 다시 떴다').not.toContain(GONE);
  });
}
