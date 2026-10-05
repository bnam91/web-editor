/* template-section-insert-frame-bind.dom.spec.js — R7 (lane-drag · 2026-10-05 · D2 census 의 «다시 태어나는 길» 한 줄)
 *
 * 섹션 템플릿 넣기(js/panels/template-system.js insertTemplate «section 갈래»)는 넣은 섹션의 프레임에 bindFrameDropZone 을
 * «한 번도» 안 불렀다. 실앱 실측(격리 9370 · 사본 · 0f572e2a+D1·D2): 넣은 섹션 프레임 12 중 12 가 _subSecBound false ·
 * 오버레이 그룹 둘 다 _overlayMoveBound false · 끌기 Δ0 (원본 섹션은 12 중 2).
 * ⇒ 그 갈래에 sec.querySelectorAll('.frame-block').forEach(bindFrameDropZone) 한 줄(block-factory.js 섹션 바인딩과 같은 꼴).
 * ⚠️section 갈래만 — block 갈래(:407)는 0.9.7(새 id 필요) · subsection 갈래(:446)는 이미 건다.
 *
 * ⛔앱을 «안» 띄운다 — template-system.js · block-drag.js 를 진짜 ES 모듈로 얹고 insertTemplate 을 부른다(템플릿 HTML 은
 *   electronAPI.loadTemplateCanvas 자리에 꽂는다). 마우스는 page.mouse.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/template-section-insert-frame-bind.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 사본의 꼴 그대로 — 섹션 직속 오버레이 그룹(absolute · group · free · overlay) + 흐름 자유 프레임 하나 + 그 안 글자 프레임 */
const TPL_SECTION = '<div class="section-block" id="sec_tpl" data-section="1">' +
  '<div class="section-inner" id="anchor_tpl">' +
  '<div class="frame-block" id="ss_flow" data-free-layout="true" style="width:300px;height:200px;padding:0">' +
  '<div class="frame-block" id="ss_tf" data-text-frame="true" style="position:absolute;left:0;top:20px;width:100%"><div class="text-block" id="tb_1"><div class="tb-body">글</div></div></div>' +
  '</div></div>' +
  '<div class="frame-block" id="ss_grp" data-free-layout="true" data-group="true" data-overlay-block="true" data-sel-variant="sticker" ' +
  'data-offset-x="100" data-offset-y="60" style="position:absolute;left:100px;top:60px;width:150px;height:150px;padding:0;background:transparent">' +
  '<div class="icon-circle-block" id="icb_1" style="position:absolute;left:0;top:0;width:120px;height:120px;background:#c99"></div></div>' +
  '</div>';
/* R7b — 같은 섹션 템플릿에 «section 갈래 손 명부가 빠뜨린» 종류 둘(도형 래퍼 안 도형 · 스텝)을 넣은 꼴. 정본 명부(block-bind-kinds.js)로 걸면 bindBlock 이 붙는다. */
const TPL_SECTION_KINDS = TPL_SECTION.replace('</div></div>' + '<div class="frame-block" id="ss_grp"',
  '</div><div class="frame-block" id="ss_shpw" data-free-layout="true" style="width:100px;height:100px;padding:0"><div class="shape-block" id="shp_k" data-type="shape" style="position:absolute;left:0;top:0"></div></div>' +
  '<div class="row" id="row_st" data-layout="stack"><div class="step-block" id="stp_k" data-type="step"></div></div></div>' + '<div class="frame-block" id="ss_grp"');

/* ② — 제 바인더를 쓰는 셋(그라데이션 · 스티커 · 어노테이션)이 든 섹션 템플릿. bindBlock 명부 밖이라 «제 바인더»를 따로 불러야 한다(rebindAll 과 같은 꼴). */
const TPL_SECTION_OWN = TPL_SECTION.replace('<div class="frame-block" id="ss_grp"',
  '<div class="gradient-block" id="grad_k" style="position:absolute;left:0;top:300px;width:200px;height:80px"></div>' +
  '<div class="sticker-block" id="stk_k" style="position:absolute;left:300px;top:300px;width:60px;height:60px"></div>' +
  '<div class="annotation-block" id="ant_k" style="position:absolute;left:0;top:0;width:100%;height:100%"></div>' +
  '<div class="frame-block" id="ss_grp"');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; }
  #canvas-wrap { position:relative; width:1000px; height:900px; background:#555; }
  .section-block { position:relative; width:800px; min-height:500px; background:#fff; }
  .frame-block { position:relative; overflow:hidden; }
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0"><div id="canvas"></div></div></div>
<div id="ss-handles-overlay"></div>
<script src="/js/feature-flags.js"></script>
<script>
  window.currentZoom = 100;
  window.__pushes = [];
  window.pushHistory = (label) => window.__pushes.push(label || '');
  window.scheduleAutoSave = () => {}; window.triggerAutoSave = () => {};
  window.buildLayerPanel = () => {}; window.applyPageSettings = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  window._findSectionAt = () => null;
  window.deselectAll = () => document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  window.selectSection = () => {}; window.getSelectedSection = () => null;
  window.bindSectionDelete = () => {}; window.bindSectionOrder = () => {};
  window.bindSectionDrag = () => {}; window.bindSectionDropZone = () => {};
  window.bindGroupDrag = () => {}; window.showToast = (m) => { window.__toast = m; };
  window.__own = [];
  window.bindGradientSelect = (b) => window.__own.push('gradient:' + b.className);
  window.bindStickerSelect = (b) => window.__own.push('sticker:' + b.className);
  window.bindAnnotationSelect = (b) => window.__own.push('annotation:' + b.className);
  window.electronAPI = { loadTemplateCanvas: async () => (window.__tplHtml || ${JSON.stringify(TPL_SECTION)}) };
</script>
<script type="module">
  import '/js/block-drag.js';                 // window.bindBlock · window.bindFrameDropZone
  import '/js/panels/template-system.js';     // window.insertTemplate
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
  await page.waitForFunction(() => window.__ready === true && typeof window.insertTemplate === 'function' && typeof window.bindFrameDropZone === 'function');
  return errs;
}

async function insertSection(page) {
  return page.evaluate(async () => {
    await window.insertTemplate({ id: 'tpl_r7', name: 'R7', type: 'section', tags: [] });
    const sec = document.querySelector('#canvas > .section-block');
    const frames = [...sec.querySelectorAll('.frame-block')];
    const grp = sec.querySelector('.frame-block[data-overlay-block="true"]');
    return { secId: sec.id, frames: frames.length, bound: frames.filter(f => f._subSecBound).length,
             grpId: grp.id, grpMove: !!grp._overlayMoveBound, toast: window.__toast || null };
  });
}

test('전제 — 두 모듈이 콘솔 오류 없이 얹힌다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('R7a ★섹션 템플릿으로 넣은 섹션의 프레임이 «전부» 바인딩된다', async ({ page }) => {
  await boot(page);
  const r = await insertSection(page);
  expect(r.toast, '넣기가 실패했다').toBeNull();
  expect(r, `넣은 섹션 프레임 바인딩 ${r.bound}/${r.frames} (고치기 전 실앱 실측 = 0/12)`).toMatchObject({ frames: 3, bound: 3 });
  expect(r.grpMove, `오버레이 그룹 _overlayMoveBound=${r.grpMove} (고치기 전 = false)`).toBe(true);
});

test('R7b ★넣은 섹션의 오버레이 그룹을 끌면 움직인다', async ({ page }) => {
  await boot(page);
  const r = await insertSection(page);
  const c = await page.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(b.x + 60), y: Math.round(b.y + 60) }; }, r.grpId);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 20, c.y + 10);
  await page.mouse.move(c.x + 40, c.y + 20);
  await page.mouse.up();
  const p = await page.evaluate((id) => { const g = document.getElementById(id); return { L: parseFloat(g.style.left), T: parseFloat(g.style.top), pushes: window.__pushes.slice() }; }, r.grpId);
  expect({ L: p.L, T: p.T }, `그룹 자리=${JSON.stringify(p)} (고치기 전 = 100,60 그대로)`).toEqual({ L: 140, T: 80 });
  expect(p.pushes, `push 라벨=${JSON.stringify(p.pushes)}`).toContain('오버레이 이동');
});

test('R7c ★섹션 템플릿으로 넣은 도형 · 스텝에도 bindBlock 이 걸린다(정본 명부 · R7b)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async (html) => {
    window.__tplHtml = html;
    await window.insertTemplate({ id: 'tpl_r7b', name: 'R7b', type: 'section', tags: [] });
    const sec = document.querySelector('#canvas > .section-block');
    const shp = sec.querySelector('.shape-block'), stp = sec.querySelector('.step-block');
    return { shape: !!shp?._blockBound, step: !!stp?._blockBound, toast: window.__toast || null };
  }, TPL_SECTION_KINDS);
  expect(r.toast, '넣기 실패').toBeNull();
  expect(r, `bindBlock 걸림=${JSON.stringify(r)} (손 명부 15 종엔 shape·step 이 없다)`).toMatchObject({ shape: true, step: true });
});

test('R7d ★섹션 템플릿으로 넣은 그라데이션 · 스티커 · 어노테이션은 «제 바인더»로 묶인다(②)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async (html) => {
    window.__tplHtml = html; window.__own = [];
    await window.insertTemplate({ id: 'tpl_own', name: 'own', type: 'section', tags: [] });
    return { own: window.__own.slice().sort(), toast: window.__toast || null };
  }, TPL_SECTION_OWN);
  expect(r.toast, '넣기 실패').toBeNull();
  expect(r.own, `제 바인더 부름=${JSON.stringify(r.own)} (고치기 전 실앱: 셋 다 안 묶여 클릭해도 안 골라짐)`).toEqual(['annotation:annotation-block', 'gradient:gradient-block', 'sticker:sticker-block']);
});
