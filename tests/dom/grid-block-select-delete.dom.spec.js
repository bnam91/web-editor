/* grid-block-select-delete.dom.spec.js — 0918 grid 「버그C」 회귀 그물. (2026-09-19)
 *
 * ★버그C — 그리드 줄을 한 번 클릭하면 활성줄(WeakMap)이 영영 null 로 안 돌아왔다. 블럭을 떠났다가
 *   «블럭 전체»로 다시 골라도(레이어 패널·테두리·Esc 후 재클릭) showGridProperties(block) 1-인자가
 *   옛 {r,c,li} 를 되살려, Backspace 가 줄 삭제 분기로 새고 한 줄짜리 칸이면
 *   「칸에 남은 마지막 줄은 지울 수 없습니다」 토스트만 뜨고 블럭이 영영 안 지워졌다.
 *   고침: deselectAll → grdClearAllActiveLines, 블럭 선택 경로는 null 명시.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- grid-block-select-delete
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');

/** 함수 «전체»를 중괄호 균형으로 떠낸다(매개변수 괄호를 먼저 닫는다). duplicate-zoom.dom.spec.js 선례. */
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
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties, grdSetActiveLine, grdGetActiveLine, grdClearAllActiveLines } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__setActive = grdSetActiveLine;
  window.__getActive = grdGetActiveLine;
  window.__clearAll = grdClearAllActiveLines;
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
  return errs;
}

/* 한 줄짜리 칸만 있는 3칸 그리드 — 현빈 재현 구조(모든 칸이 줄 1개). */
const FIXTURE_3x1 = {
  cols: [
    { width: 1, lines: [{ type: 'body', text: 'A' }] },
    { width: 1, lines: [{ type: 'body', text: 'B' }] },
    { width: 1, lines: [{ type: 'body', text: 'C' }] },
  ],
};

async function mountC(page, fixture) {
  await page.evaluate((fx) => {
    const { row, block } = window.__mk(fx);
    document.getElementById('host').appendChild(row);
    block.id = block.id || 'grd_test';
    window.__block = block;
  }, fixture);
}

/** deleteSelectedFromCanvas «진짜 소스»를 블럭 삭제 경로까지 돌 수 있게 스텁을 채워 실행. */
async function runDeleteFull(page) {
  return page.evaluate((delSrc) => {
    const calls = { showToast: [] };
    window.showToast = (msg) => calls.showToast.push(msg);
    const scope = {
      clearAssetImage: () => {},
      deselectAll: () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')),
      multiSel: { cols: new Set(), blocks: new Set(), sections: new Set() },
      clearMultiSel: () => {},
      showMultiSelPanel: () => {},
    };
    window.CANVAS_SEL_BLOCKS = '.grid-block.selected';
    window.pushHistory = () => {};
    window.buildLayerPanel = () => {};
    window.ensureHistoryCheckpoint = () => {};
    window.isSectionProtected = () => false;
    const names = Object.keys(scope);
    const fn = new Function(...names, `${delSrc}; return deleteSelectedFromCanvas;`)(...names.map(n => scope[n]));
    return { consumed: fn(), calls };
  }, DEL_SRC);
}

test('버그C-음성대조 ★(고치기 전 상태 재현) 활성줄이 남은 채 블럭으로 고르면 → 토스트만, 블럭 잔존', async ({ page }) => {
  const errs = await boot(page);
  await mountC(page, FIXTURE_3x1);
  await page.evaluate(() => {
    window.__setActive(window.__block, { r: 0, c: 0, li: 0 });   // 줄 클릭
    window.__block.classList.add('selected');                     // 해제 없이 다시 «블럭으로» 선택
  });
  /* ~~[폐기 · 2026-09-26] `expect(r.calls.showToast.length).toBe(1)` — 「마지막 줄 보호」 토스트로
       버그 재현을 쟀다. 그 토스트가 0926 에 사라졌다(grid-block.js `_gridRejectLinesLength` 머리말).~~
     ★이 대조가 «재현하는 버그»는 「블럭을 지우려는데 «줄 분기»로 샌다」다. 그 증거를 토스트가
       아니라 «줄이 하나 지워졌다»로 잰다 — 토스트보다 곧고, 문구가 바뀌어도 안 늙는다. */
  const before = await page.evaluate(() => window.__model(window.__block).cells[0][0].lines.length);
  const r = await runDeleteFull(page);
  expect(r.calls.showToast, '★옛 「마지막 줄」 토스트가 아직 뜬다').toEqual([]);
  expect(await page.evaluate(() => window.__model(window.__block).cells[0][0].lines.length),
    '★이 대조가 버그를 재현하지 못한다 — 줄 분기로 새지 않았다(검사가 아무것도 안 본다)').toBe(before - 1);
  expect(await page.evaluate(() => document.body.contains(window.__block))).toBe(true);
  expect(errs).toEqual([]);
});

test('버그C-핵심 ★줄 클릭 → 블럭 떠남(grdClearAllActiveLines) → 다시 블럭 선택 → 삭제 = 토스트 없이 블럭이 사라진다', async ({ page }) => {
  const errs = await boot(page);
  await mountC(page, FIXTURE_3x1);
  await page.evaluate(() => window.__open(window.__block, { r: 0, c: 0, li: 0 }));   // 줄 클릭(패널 줄 모드)
  expect(await page.evaluate(() => window.__getActive(window.__block))).toEqual({ r: 0, c: 0, li: 0 });

  await page.evaluate(() => window.__clearAll(document.getElementById('canvas')));   // deselectAll 이 부르는 것
  expect(await page.evaluate(() => window.__getActive(window.__block)), '블럭을 떠났는데 활성줄이 남았다').toBeNull();

  await page.evaluate(() => { window.__block.classList.add('selected'); window.__open(window.__block); });   // 재선택(1-인자)
  expect(await page.evaluate(() => window.__getActive(window.__block)), '★1-인자 재선택이 옛 줄을 되살렸다').toBeNull();

  const r = await runDeleteFull(page);
  expect(r.consumed).toBe(true);
  expect(r.calls.showToast, '★「마지막 줄」 토스트가 떴다 — 버그C 재발').toEqual([]);
  expect(await page.evaluate(() => !!document.querySelector('.grid-block')), '★그리드 블럭이 안 지워졌다').toBe(false);
  expect(errs).toEqual([]);
});

test('버그C-레이어패널 경로 ★활성줄을 둔 채 showGridProperties(block, null) → 활성줄 null, 마커 0개', async ({ page }) => {
  const errs = await boot(page);
  await mountC(page, FIXTURE_3x1);
  await page.evaluate(() => { window.__block.classList.add('selected'); window.__open(window.__block, { r: 0, c: 1, li: 0 }); });
  expect(await page.evaluate(() => document.querySelectorAll('.grd-line-selected').length), '전제: 줄 마커가 붙어야 한다').toBe(1);
  await page.evaluate(() => window.__open(window.__block, null));
  expect(await page.evaluate(() => window.__getActive(window.__block))).toBeNull();
  expect(await page.evaluate(() => document.querySelectorAll('.grd-line-selected, .grd-cell-selected').length)).toBe(0);
  const r = await runDeleteFull(page);
  expect(r.calls.showToast).toEqual([]);
  expect(await page.evaluate(() => !!document.querySelector('.grid-block'))).toBe(false);
  expect(errs).toEqual([]);
});

test('버그C-D5 보존 ★활성줄이 있는 블럭에 1-인자 showGridProperties(updateGridBlock 재표시) → 주소 유지', async ({ page }) => {
  const errs = await boot(page);
  await mountC(page, FIXTURE_3x1);
  await page.evaluate(() => { window.__block.classList.add('selected'); window.__open(window.__block, { r: 0, c: 2, li: 0 }); });
  await page.evaluate(() => window.__open(window.__block));
  expect(await page.evaluate(() => window.__getActive(window.__block))).toEqual({ r: 0, c: 2, li: 0 });
  /* 줄이 선택된 채 삭제 = 줄 삭제 분기 — 블럭은 남는다(T-009 버그B 방어선 그대로).
     ~~[폐기 · 2026-09-26] `expect(r.calls.showToast.length).toBe(1)`(「마지막 줄 보호」 토스트)~~
     ⛔그 토스트는 0926 에 사라졌다(js/blocks/grid-block.js `_gridRejectLinesLength` 머리말).
     ★이 검사가 «재려던 것»은 토스트가 아니라 「주소가 유지돼 줄 분기로 갔다」다 — 그걸 토스트로
       대신 재고 있었다. 이제 «줄이 실제로 줄었다»로 잰다(토스트보다 곧은 계측이다). */
  const before = await page.evaluate(() => window.__model(window.__block).cells[0][2].lines.length);
  const r = await runDeleteFull(page);
  expect(r.calls.showToast, '★옛 「마지막 줄」 토스트가 아직 뜬다').toEqual([]);
  expect(await page.evaluate(() => window.__model(window.__block).cells[0][2].lines.length),
    '★주소가 유지되지 않아 «줄 분기»로 안 갔다 — 블럭 삭제로 샜거나 아무 일도 안 났다').toBe(before - 1);
  expect(await page.evaluate(() => document.body.contains(window.__block))).toBe(true);
  expect(errs).toEqual([]);
});

test('grdClearAllActiveLines ★root 안의 «모든» 그리드 블럭을 해제한다', async ({ page }) => {
  const errs = await boot(page);
  await mountC(page, FIXTURE_3x1);
  const n = await page.evaluate(() => {
    const a = window.__block;
    const { row, block: b } = window.__mk({ cols: [{ width: 1, lines: [{ type: 'body', text: 'x' }] }] });
    document.getElementById('host').appendChild(row);
    window.__setActive(a, { r: 0, c: 0, li: 0 });
    window.__setActive(b, { r: 0, c: 0, li: 0 });
    window.__clearAll(document.getElementById('canvas'));
    return [window.__getActive(a), window.__getActive(b)];
  });
  expect(n).toEqual([null, null]);
  expect(errs).toEqual([]);
});
