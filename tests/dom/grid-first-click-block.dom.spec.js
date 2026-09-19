/* grid-first-click-block.dom.spec.js — 0918r2 T-058: 피그마식 «첫 클릭 = 블럭, 두 번째 클릭 = 줄». (2026-09-19)
 *
 * ★현빈 원 증상 잔존 — 캔버스에서 선택 안 된 그리드를 «한 번» 누르면 거의 항상 줄 선택이 됐다
 *   (그리드 면적 대부분이 줄). 그 상태에서 ⌫ → 한 줄 칸이면 「마지막 줄」 토스트만, 두 줄 이상이면
 *   줄 하나가 조용히 지워졌다(데이터 손실). 1라운드 스펙(grid-block-select-delete)은 showGridProperties 를
 *   «직접» 불러서 block-drag 의 «진짜 클릭 경로»를 한 번도 안 봤다 → 여기서는 bindBlock 을 걸고 진짜로 누른다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- grid-first-click-block
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');

function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}
const DEL_SRC = extractFn(EDITOR_SRC, 'deleteSelectedFromCanvas');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px"><div class="section-block"><div class="section-inner" id="host" style="width:860px"></div></div></div>
</div>
<div id="ss-handles-overlay"></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script src="/js/feature-flags.js"></script>
<script type="module">
  import { makeGridBlock, renderGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { grdGetActiveLine, grdClearAllActiveLines } from '/js/props/prop-grid.js';
  import { bindBlock } from '/js/drag-drop.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__getActive = grdGetActiveLine;
  window.__clearAll = grdClearAllActiveLines;
  window.__bind = bindBlock;
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
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  /* 클릭 핸들러가 옵셔널 체이닝 없이 부르는 앱 전역만 세운다. deselectAll 은 «진짜»와 같은 일
     (selected 해제 + 활성줄 모델 해제 — editor.js deselectAll 의 grdClearAllActiveLines). */
  await page.evaluate(() => {
    window.deselectAll = () => {
      document.querySelectorAll('#canvas .selected').forEach(e => e.classList.remove('selected'));
      document.querySelectorAll('.grd-line-selected,.grd-cell-selected').forEach(e => e.classList.remove('grd-line-selected', 'grd-cell-selected'));
      window.__clearAll(document.getElementById('canvas'));
    };
    for (const n of ['syncSection', 'highlightBlock', 'setBlockAnchor', 'buildLayerPanel', 'scheduleAutoSave'])
      if (!window[n]) window[n] = () => {};
  });
  return errs;
}

async function mount(page, fixture) {
  await page.evaluate((fx) => {
    const { row, block } = window.__mk(fx);
    document.getElementById('host').appendChild(row);
    block.id = block.id || 'grd_' + Math.random().toString(36).slice(2, 7);
    window.__bind(block);
    (window.__blocks = window.__blocks || []).push(block);
    window.__block = block;
  }, fixture);
}

async function runDelete(page) {
  return page.evaluate((delSrc) => {
    const calls = { showToast: [] };
    window.showToast = (msg) => calls.showToast.push(msg);
    const scope = {
      clearAssetImage: () => {},
      deselectAll: window.deselectAll,
      multiSel: { cols: new Set(), blocks: new Set(), sections: new Set() },
      clearMultiSel: () => {},
      showMultiSelPanel: () => {},
    };
    window.CANVAS_SEL_BLOCKS = '.grid-block.selected';
    window.pushHistory = () => {};
    window.ensureHistoryCheckpoint = () => {};
    window.isSectionProtected = () => false;
    const names = Object.keys(scope);
    const fn = new Function(...names, `${delSrc}; return deleteSelectedFromCanvas;`)(...names.map(n => scope[n]));
    return { consumed: fn(), calls };
  }, DEL_SRC);
}

const ONE_LINE = { cols: [
  { width: 1, lines: [{ type: 'body', text: 'A' }] },
  { width: 1, lines: [{ type: 'body', text: 'B' }] },
] };
const TWO_LINES = { cols: [
  { width: 1, lines: [{ type: 'body', text: 'A1' }, { type: 'body', text: 'A2' }] },
  { width: 1, lines: [{ type: 'body', text: 'B' }] },
] };
const lineLoc = (page, c, li, nth = 0) => page.locator(`#host .grid-block >> nth=${nth}`).locator(`[data-r="0"][data-c="${c}"][data-line="${li}"]`).first();
const state = (page) => page.evaluate(() => ({
  selected: window.__block.classList.contains('selected'),
  active: window.__getActive(window.__block),
  marks: document.querySelectorAll('.grd-line-selected').length,
  alive: document.body.contains(window.__block),
}));
/* 두 클릭 사이를 벌린다 — 붙이면 detail 2 + dblclick 이 되어 인라인 편집으로 간다(별개 흐름). */
const gap = (page) => page.waitForTimeout(600);

test('T-058-1 ★선택 안 된 그리드의 한 줄 칸을 «한 번» 클릭 → 블럭 선택(활성줄 없음) → ⌫ = 토스트 없이 블럭 삭제', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, ONE_LINE);
  await lineLoc(page, 0, 0).click();
  expect(await state(page)).toEqual({ selected: true, active: null, marks: 0, alive: true });
  const r = await runDelete(page);
  expect(r.calls.showToast, '★「마지막 줄」 토스트 — 현빈 원 증상').toEqual([]);
  expect(await page.evaluate(() => !!document.querySelector('.grid-block'))).toBe(false);
  expect(errs).toEqual([]);
});

test('T-058-2 ★줄 2개 칸을 한 번 클릭 → ⌫ = 줄이 조용히 지워지지 않고 블럭이 지워진다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, TWO_LINES);
  await lineLoc(page, 0, 1).click();
  expect((await state(page)).active, '첫 클릭이 줄을 골랐다').toBeNull();
  const linesBefore = await page.evaluate(() => window.__model(window.__block).cells[0][0].lines.length);
  expect(linesBefore).toBe(2);
  const r = await runDelete(page);
  expect(r.calls.showToast).toEqual([]);
  expect(await page.evaluate(() => document.body.contains(window.__block)), '블럭이 남았다(줄 삭제로 샜다)').toBe(false);
  expect(errs).toEqual([]);
});

test('T-058-3 ★두 번째 클릭(이미 선택된 그리드) = 줄 선택 → ⌫ = 그 줄만 삭제 (T-009 버그B 흐름 보존)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, TWO_LINES);
  await lineLoc(page, 0, 1).click();
  await gap(page);
  await lineLoc(page, 0, 1).click();
  const s = await state(page);
  expect(s.active).toEqual({ r: 0, c: 0, li: 1 });
  expect(s.marks, '줄 마커').toBe(1);
  const r = await runDelete(page);
  expect(r.calls.showToast).toEqual([]);
  expect(await page.evaluate(() => document.body.contains(window.__block)), '블럭 통삭제로 샜다').toBe(true);
  expect(await page.evaluate(() => window.__model(window.__block).cells[0][0].lines.map(l => l.text))).toEqual(['A1']);
  expect(errs).toEqual([]);
});

test('T-058-4 한 줄 칸을 두 번 클릭 → ⌫ = 마지막 줄 보호 토스트, 블럭 유지', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, ONE_LINE);
  await lineLoc(page, 1, 0).click();
  await gap(page);
  await lineLoc(page, 1, 0).click();
  expect((await state(page)).active).toEqual({ r: 0, c: 1, li: 0 });
  const r = await runDelete(page);
  expect(r.calls.showToast.length).toBe(1);
  expect(await page.evaluate(() => document.body.contains(window.__block))).toBe(true);
  expect(errs).toEqual([]);
});

test('T-058-5 ★그리드 A 선택 중 그리드 B 줄 클릭 → B 는 «블럭»으로 선택(줄 아님)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, ONE_LINE);
  await mount(page, TWO_LINES);
  const [a, b] = await page.evaluate(() => window.__blocks.map(x => x.id));
  await page.locator(`#${a} [data-r="0"][data-c="0"][data-line="0"]`).click();
  await gap(page);
  await page.locator(`#${a} [data-r="0"][data-c="0"][data-line="0"]`).click();
  expect(await page.evaluate((id) => window.__getActive(document.getElementById(id)), a)).toEqual({ r: 0, c: 0, li: 0 });
  await gap(page);
  await page.locator(`#${b} [data-r="0"][data-c="0"][data-line="1"]`).click();
  const out = await page.evaluate(([a, b]) => ({
    aSel: document.getElementById(a).classList.contains('selected'),
    bSel: document.getElementById(b).classList.contains('selected'),
    aActive: window.__getActive(document.getElementById(a)),
    bActive: window.__getActive(document.getElementById(b)),
  }), [a, b]);
  expect(out).toEqual({ aSel: false, bSel: true, aActive: null, bActive: null });
  expect(errs).toEqual([]);
});

test('T-058-6 ★다중선택 상태(다른 블럭도 selected)에서 그리드 줄 클릭 → 블럭 단일 선택(줄 아님)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, ONE_LINE);
  const other = await page.evaluate(() => {
    const d = document.createElement('div'); d.className = 'text-block selected'; d.id = 'other';
    document.getElementById('host').appendChild(d);
    window.__block.classList.add('selected');   // ⌘클릭으로 둘 다 골라 둔 상태
    return d.id;
  });
  await lineLoc(page, 0, 0).click();
  const s = await state(page);
  expect(s.active, '다중선택 중 클릭이 줄로 파고들었다').toBeNull();
  expect(s.selected).toBe(true);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), other)).toBe(false);
  expect(errs).toEqual([]);
});

test('T-058-7 ★프레임 안 그리드: 부모 프레임·섹션의 selected 는 «이미 선택됨»으로 치지 않는다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, ONE_LINE);
  await page.evaluate(() => {
    /* 프레임 안에 넣고, 프레임이 이미 활성(= _restoreParentFrameSelected 가 만드는 상태) */
    const fr = document.createElement('div'); fr.className = 'frame-block selected'; fr.id = 'fr';
    const row = window.__block.closest('.row') || window.__block.parentElement;
    row.parentElement.insertBefore(fr, row); fr.appendChild(row);
    document.querySelector('.section-block').classList.add('selected');
    window._activeFrame = fr;
  });
  await lineLoc(page, 0, 0).click();
  let s = await state(page);
  expect(s.active, '★프레임 selected 를 «이미 선택됨»으로 봐서 첫 클릭이 줄이 됐다').toBeNull();
  expect(s.selected).toBe(true);
  await gap(page);
  await lineLoc(page, 0, 0).click();
  s = await state(page);
  expect(s.active, '그리드가 선택된 뒤 클릭은 줄 선택').toEqual({ r: 0, c: 0, li: 0 });
  expect(errs).toEqual([]);
});

/* ── 픽스 라운드: 다중선택에서 블럭 삭제 의도가 줄 삭제로 새던 누수(이벨류 실측 9501) ──
 * ⌘클릭은 editor.js toggleBlockSelect 가 받는다 — «실물 소스»를 떠서 window 에 건다(앱과 같은 진입). */
const TOGGLE_SRC = extractFn(EDITOR_SRC, 'toggleBlockSelect');
async function installToggle(page) {
  await page.evaluate((src) => {
    const scope = {
      _getBlockLayerItem: () => null, _lastClickedBlock: null, _isInFreeLayout: () => false,
      _restoreFreeLayoutFrameSelected: () => {}, _updateFreeLayoutMultiSelPanel: () => {}, _updateMultiSelPanel: () => {},
      canvasEl: document.getElementById('canvas'),
    };
    const names = Object.keys(scope);
    window.toggleBlockSelect = new Function(...names, `${src}; return toggleBlockSelect;`)(...names.map(n => scope[n]));
  }, TOGGLE_SRC);
}
const THREE_LINES = { cols: [
  { width: 1, lines: [{ type: 'body', text: 'A1' }, { type: 'body', text: 'A2' }, { type: 'body', text: 'A3' }] },
  { width: 1, lines: [{ type: 'body', text: 'B' }] },
] };
const counts = (page) => page.evaluate(() => window.__blocks.map(b => document.body.contains(b)
  ? window.__model(b).cells[0].map(c => c.lines.length) : 'gone'));

test('T-058-8 ★A 줄 선택(2회 클릭) → B ⌘클릭 → ⌫ = 두 블럭 삭제, 줄 누수 0 (이벨류 repro)', async ({ page }) => {
  const errs = await boot(page);
  await installToggle(page);
  await mount(page, THREE_LINES);
  await mount(page, ONE_LINE);
  await lineLoc(page, 0, 1, 0).click();
  await gap(page);
  await lineLoc(page, 0, 1, 0).click();
  const [a, b] = await page.evaluate(() => window.__blocks);
  expect(await page.evaluate(() => window.__getActive(window.__blocks[0]))).toEqual({ r: 0, c: 0, li: 1 });
  await gap(page);
  await lineLoc(page, 0, 0, 1).click({ modifiers: ['Meta'] });
  const mid = await page.evaluate(() => ({
    sel: window.__blocks.map(b => b.classList.contains('selected')),
    aActive: window.__getActive(window.__blocks[0]),
    marks: document.querySelectorAll('.grd-line-selected').length,
  }));
  expect(mid, '⌘클릭 뒤에도 A 의 줄 선택이 남았다').toEqual({ sel: [true, true], aActive: null, marks: 0 });
  const r = await runDelete(page);
  expect(r.calls.showToast).toEqual([]);
  expect(await counts(page), '★두 블럭이 남고 A 의 줄만 줄었다 = 누수').toEqual(['gone', 'gone']);
  expect(errs).toEqual([]);
});

for (const order of ['A줄+B', 'B줄+A']) {
  test(`T-058-9 ★[줄 선택 그리드 + 다른 그리드] 가 함께 selected(붙여넣기 뒤 상태, ${order}) → ⌫ = 줄 삭제로 새지 않는다`, async ({ page }) => {
    const errs = await boot(page);
    await mount(page, THREE_LINES);
    await mount(page, THREE_LINES);
    const lineIdx = order === 'A줄+B' ? 0 : 1;
    await lineLoc(page, 0, 1, lineIdx).click();
    await gap(page);
    await lineLoc(page, 0, 1, lineIdx).click();
    /* 붙여넣기 사본은 «selected 가 붙은 채» 들어온다(copySelected 의 outerHTML) — 활성줄은 원본에 남은 채 */
    await page.evaluate((i) => window.__blocks[1 - i].classList.add('selected'), lineIdx);
    expect(await page.evaluate((i) => window.__getActive(window.__blocks[i]), lineIdx)).toEqual({ r: 0, c: 0, li: 1 });
    const r = await runDelete(page);
    expect(r.calls.showToast).toEqual([]);
    expect(await counts(page), '★블럭은 남고 원본 줄 하나만 사라졌다(DOM 순서에 따라 갈리던 누수)').toEqual(['gone', 'gone']);
    expect(errs).toEqual([]);
  });
}
