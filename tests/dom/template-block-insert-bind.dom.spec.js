/* template-block-insert-bind.dom.spec.js — insertTemplate «block 갈래» (lane-drag · 2026-10-06 · 지디/태양 승인 · 이번 판)
 *
 * 블록 템플릿으로 저장한 것을 넣으면(실앱 base ㉠ · 격리 9370 · 사본):
 *   · 글자 블록: id 가 원본과 겹친다(1).
 *   · 글자 프레임 / 자유 프레임: id 겹침 · 프레임에 bindBlock(틀린 바인더) · bindFrameDropZone 없음 · 안 블록 안 묶임 → 클릭하면 섹션만 골라짐.
 * 고침 = 넣는 블록과 안의 [id] 전부 새 id + section 갈래와 «같은» 묶기 도우미(_bindInsertedTree: 정본 명부 bindBlock · 프레임 bindFrameDropZone · 제 바인더 셋).
 *
 * ⛔앱을 «안» 띄운다 — block-drag.js · template-system.js 를 진짜 모듈로 얹고 insertTemplate({type:'block'}) 을 부른다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/template-block-insert-bind.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 원본(문서에 이미 있는 것) — 템플릿은 이것의 outerHTML 이라 넣으면 같은 id 가 둘이 된다(base) */
const TEXT = '<div class="text-block" id="tb_o1" data-type="body"><div class="tb-body">본문</div></div>';
const TFRAME = '<div class="frame-block" id="tf_o1" data-text-frame="true" style="width:100%"><div class="text-block" id="tb_o2" data-type="body"><div class="tb-body">글 프레임</div></div></div>';
const FFRAME = '<div class="frame-block" id="fr_o1" data-free-layout="true" style="width:400px;height:200px;padding:0">' +
  '<div class="frame-block" id="tf_o3" data-text-frame="true" style="position:absolute;left:0;top:20px;width:100%"><div class="text-block" id="tb_o3"><div class="tb-body">안 글</div></div></div>' +
  '<div class="frame-block" id="sf_o1" data-free-layout="true" style="position:absolute;left:200px;top:80px;width:80px;height:80px;padding:0"><div class="shape-block" id="shp_o1" data-type="shape" style="position:absolute;left:0;top:0"></div></div>' +
  '</div>';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; }
  #canvas-wrap { position:relative; width:1000px; height:1200px; background:#555; }
  .section-block { position:relative; width:800px; min-height:600px; background:#fff; }
  .frame-block { position:relative; overflow:hidden; }
  .shape-block { width:100%; height:100%; background:#99c; }
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0"><div id="canvas">
  <div class="section-block" id="sec1"><div class="section-inner" id="inner1">
    <div class="row" data-layout="stack">${TEXT}</div>${TFRAME}${FFRAME}
  </div></div>
</div></div></div>
<script src="/js/feature-flags.js"></script>
<script>
  window.currentZoom = 100;
  window.pushHistory = () => {}; window.scheduleAutoSave = () => {}; window.triggerAutoSave = () => {};
  window.buildLayerPanel = () => {}; window.applyPageSettings = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  window._findSectionAt = () => null;
  window.deselectAll = () => document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  window.selectSection = () => {}; window.getSelectedSection = () => document.getElementById('sec1');
  window.showToast = (m) => { window.__toast = m; };
  window.genId = (p) => p + '_' + Math.random().toString(36).slice(2, 9);
  window.electronAPI = { loadTemplateCanvas: async () => window.__tplHtml };
</script>
<script type="module">
  import '/js/block-drag.js';
  import '/js/panels/template-system.js';
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
  await page.waitForFunction(() => window.__ready === true && typeof window.insertTemplate === 'function');
  return errs;
}

/** 블록 템플릿 넣기 → 문서 id 겹침 수 · 넣은 것(새 row 안)의 묶임 */
async function insertBlock(page, html) {
  return page.evaluate(async (html) => {
    window.__tplHtml = html;
    const rows0 = new Set(document.querySelectorAll('.row'));
    await window.insertTemplate({ id: 'tpl_b', name: 'b', type: 'block' });
    const row = [...document.querySelectorAll('.row')].find(r => !rows0.has(r));
    const top = row && row.firstElementChild;
    const cnt = {}; document.querySelectorAll('[id]').forEach(e => { cnt[e.id] = (cnt[e.id] || 0) + 1; });
    const dups = Object.keys(cnt).filter(k => cnt[k] > 1);
    const frames = top ? [top, ...top.querySelectorAll('.frame-block')].filter(e => e.classList.contains('frame-block') && !e.dataset.textFrame) : [];
    const blocks = top ? [top, ...top.querySelectorAll('.text-block, .shape-block')].filter(e => e.matches('.text-block, .shape-block')) : [];
    return {
      toast: window.__toast || null, dups,
      framesBound: frames.map(f => !!f._subSecBound), frameGotBindBlock: frames.some(f => !!f._blockBound),
      blocksBound: blocks.map(b => !!b._blockBound),
    };
  }, html);
}

test('전제 — 두 모듈이 콘솔 오류 없이 얹힌다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('B1 ★글자 블록 템플릿 — 넣어도 id 가 안 겹치고 묶인다', async ({ page }) => {
  await boot(page);
  const r = await insertBlock(page, TEXT);
  expect({ dups: r.dups, blocks: r.blocksBound }, `결과=${JSON.stringify(r)} (base 실앱: id 겹침 1)`).toEqual({ dups: [], blocks: [true] });
});

test('B2 ★글자 프레임 템플릿 — id 안 겹침 · 안 글자 묶임 · 프레임에 bindBlock 안 걸림', async ({ page }) => {
  await boot(page);
  const r = await insertBlock(page, TFRAME);
  expect({ dups: r.dups, blocks: r.blocksBound, wrong: r.frameGotBindBlock }, `결과=${JSON.stringify(r)}`).toEqual({ dups: [], blocks: [true], wrong: false });
});

test('B3 ★자유 프레임 템플릿 — id 안 겹침 · 프레임 bindFrameDropZone · 안 글자 · 도형 묶임', async ({ page }) => {
  await boot(page);
  const r = await insertBlock(page, FFRAME);
  expect({ dups: r.dups, frames: r.framesBound, wrong: r.frameGotBindBlock, blocks: r.blocksBound }, `결과=${JSON.stringify(r)} (base 실앱: 클릭하면 섹션만 골라짐)`)
    .toEqual({ dups: [], frames: [true, true], wrong: false, blocks: [true, true] });
});
