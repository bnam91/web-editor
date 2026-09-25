/* grid-line-delete.dom.spec.js — T-009 두 버그의 회귀 그물. (2026-09-16)
 *
 * ★버그A — 이미지 줄을 지울 때 imgSrc만 비워 line.type==='image' 줄을 그대로 남기면
 *   렌더러(grid-block.js:_gridLineHtml)가 빈 이미지 placeholder(회색 배경 grd-img-empty)를
 *   «영구히» 그린다. 이미지 줄을 지우는 길은 «전부» 같은 결과(줄 자체가 사라짐)여야 한다 —
 *   지금 그 길은 둘이다: 줄바 「줄 삭제」(prop-grid.js grd-line-del-btn ← 이 파일이 재는 대상)와
 *   우클릭 「이미지 삭제」(block-factory.js bcm-grid-img-del). 아래 버그A 머리말에 까닭.
 *
 * ★버그B — 그리드 셀 안 «줄»을 캔버스에서 클릭해도 DOM 선택은 여전히 .grid-block «전체»다
 *   (줄 선택은 WeakMap(grdActiveLine)에만 산다, 클래스가 안 붙는다). 그 상태에서 Backspace를
 *   누르면 editor.js 의 전역 삭제 핸들러(deleteSelectedFromCanvas)가 CANVAS_SEL_BLOCKS 로
 *   .grid-block.selected 를 주워가 «블록 통째로» 지웠다 — 데이터손실급. 고친 코드는 활성
 *   줄이 있으면 그 줄 하나만 지우고 블록은 건드리지 않는다(마지막 한 줄은 보호).
 *
 * ⛔앱을 «안» 띄운다. 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-line-delete
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
  import { showGridProperties, grdSetActiveLine, grdGetActiveLine } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__setActive = grdSetActiveLine;
  window.__getActive = grdGetActiveLine;
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

const IMG_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/* 셀 (0,0)에 2줄(텍스트 + 이미지) — 「마지막 한 줄」 보호에 안 걸리는 기본 픽스처. */
const FIXTURE_2LINES = {
  cols: [
    { width: 1, lines: [{ type: 'body', text: 'hello' }, { type: 'image', imgSrc: IMG_SRC, height: 100 }] },
    { width: 1, lines: [{ type: 'body', text: '내용을 입력하세요.' }] },
  ],
};
/* 셀 (0,0)에 이미지 «한 줄만» — 「마지막 한 줄」 보호 검증용. */
const FIXTURE_1LINE = {
  cols: [
    { width: 1, lines: [{ type: 'image', imgSrc: IMG_SRC, height: 100 }] },
    { width: 1, lines: [{ type: 'body', text: '내용을 입력하세요.' }] },
  ],
};

async function mount(page, fixture) {
  await page.evaluate((fx) => {
    const { row, block } = window.__mk(fx);
    document.getElementById('host').appendChild(row);
    block.classList.add('selected');
    window.__block = block;
  }, fixture);
}

/* ══ 버그A — 이미지 줄 지우기 = 줄 삭제(같은 결과), 회색 placeholder 를 남기지 않는다 ══
 *
 * ★2026-09-25 «대상이 옮겨졌다» — Image 절의 「이미지 제거」(grd-img-remove-btn)를 현빈
 *   지시로 없앴다. ⛔그런데 버그A 는 «단추»의 버그가 아니라 «지우는 방식»의 버그다
 *   (imgSrc만 비우면 type:'image' 줄이 남아 회색 placeholder 가 영구히 그려진다).
 *   ⇒ 그물을 걷지 «않고» 살아남은 손잡이로 옮겨 단다:
 *     · 줄바의 「줄 삭제」(grd-line-del-btn) — 같은 패널·같은 칸. 지운 핸들러와 «한 글자도
 *       안 다른» 같은 코드였다(prop-grid.js _grdWireLineBar ↔ 옛 _grdWireImageSection).
 *     · 우클릭 「이미지 삭제」(bcm-grid-img-del, block-factory.js) — 같은 patchCell{lines} 경로.
 *       ⚠️그 길은 이 하네스가 «안» 띄운다(우클릭 메뉴는 index.html+block-factory 배선) —
 *         못 잰 축으로 적어 둔다. 여기서 재는 것은 패널 쪽 한 벌이다.
 *   ★즉 이 파일은 «대상»만 바꿨지 «묻는 것»은 그대로다. */

test('버그A ★이미지 줄을 「줄 삭제」로 지우면 그 줄이 통째로 사라진다(imgSrc만 비우지 않는다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, FIXTURE_2LINES);
  await page.evaluate(() => window.__open(window.__block, { r: 0, c: 0, li: 1 }));   // 이미지 줄을 연다

  const before = await page.evaluate(() => window.__model(window.__block).cells[0][0].lines.length);
  expect(before, '픽스처가 2줄이 아니다 — 이 검사가 아무것도 안 본다').toBe(2);

  const btnState = await page.evaluate(() => {
    const b = document.getElementById('grd-line-del-btn');
    /* ⛔없앤 단추가 «되살아났는지»도 같은 자리에서 본다 — 되살아나면 한 기능에 손잡이가
       두 벌이 되고, 그때부터 이 검사는 «남은 한 벌»만 재게 된다. */
    return b ? { disabled: b.disabled, revived: !!document.getElementById('grd-img-remove-btn') } : null;
  });
  expect(btnState, '★줄바의 「줄 삭제」가 안 떴다 — 이미지 줄을 지울 손잡이가 패널에 하나도 없다').not.toBeNull();
  expect(btnState.revived, '★없앤 「이미지 제거」가 되살아났다 — 지우는 손잡이가 두 벌이면 둘이 따로 늙는다').toBe(false);
  expect(btnState.disabled, '줄이 2개인데 버튼이 비활성 상태다').toBe(false);

  await page.click('#grd-line-del-btn');

  const model = await page.evaluate(() => window.__model(window.__block));
  expect(model.cells[0][0].lines.length, '★줄이 안 지워졌다 — imgSrc만 비운 옛 버그가 재발했다').toBe(1);
  expect(model.cells[0][0].lines[0].type, '남은 줄이 엉뚱한 줄이다').toBe('body');

  const emptyPh = await page.evaluate(() =>
    window.__block.querySelectorAll('.grd-img-empty').length);
  expect(emptyPh, '★회색 빈 이미지 placeholder(grd-img-empty)가 남아 있다 — T-009 버그A 재발').toBe(0);
  expect(errs).toEqual([]);
});

test('버그A-보호 ★칸에 남은 마지막 줄(이미지 1개뿐)은 「줄 삭제」가 비활성이고 지워지지 않는다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, FIXTURE_1LINE);
  await page.evaluate(() => window.__open(window.__block, { r: 0, c: 0, li: 0 }));

  const btn = await page.evaluate(() => {
    const b = document.getElementById('grd-line-del-btn');
    return b ? { disabled: b.disabled } : null;
  });
  expect(btn, '★줄바의 「줄 삭제」가 안 떴다').not.toBeNull();
  expect(btn.disabled, '★마지막 한 줄인데 「줄 삭제」가 활성 상태다 — EMPTY_CELL_LINES 보호가 없다').toBe(true);

  // 비활성 버튼을 강제로 눌러도(방어적 클릭) 데이터가 안 바뀐다 — 핸들러 자체의 disabled 가드도 검증.
  await page.evaluate(() => document.getElementById('grd-line-del-btn').click());
  const model = await page.evaluate(() => window.__model(window.__block));
  expect(model.cells[0][0].lines.length, '비활성 버튼 클릭으로 마지막 줄이 지워졌다').toBe(1);
  expect(errs).toEqual([]);
});

/* ══ 버그B — 그리드 셀 줄 선택 상태에서 Backspace가 «그 줄만» 지운다 ══ */

/** deleteSelectedFromCanvas 를 «진짜 소스 그대로» 돌리되, editor.js 바깥 의존은 최소 스텁으로. */
async function runDelete(page) {
  return page.evaluate((delSrc) => {
    const calls = { showToast: [] };
    const scope = {
      clearAssetImage: () => {},
    };
    window.showToast = (msg) => calls.showToast.push(msg);
    const names = Object.keys(scope);
    const fn = new Function(...names, `${delSrc}; return deleteSelectedFromCanvas;`)(...names.map(n => scope[n]));
    const consumed = fn();
    return { consumed, calls };
  }, DEL_SRC);
}

test('버그B ★줄이 선택된 상태에서 Backspace(삭제) → 그 줄만 지워지고 그리드 블록은 남는다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, FIXTURE_2LINES);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 1 }));   // 이미지 줄 「선택」

  const r = await runDelete(page);
  expect(r.consumed, '삭제 핸들러가 이 입력을 소비하지 않았다').toBe(true);

  const stillThere = await page.evaluate(() => document.body.contains(window.__block));
  expect(stillThere, '★그리드 블록 전체가 삭제됐다 — T-009 버그B 재발(데이터손실)').toBe(true);

  const model = await page.evaluate(() => window.__model(window.__block));
  expect(model.cells[0][0].lines.length, '선택한 줄 하나만 지워져야 한다').toBe(1);
  expect(model.cells[0][0].lines[0].type, '엉뚱한 줄이 지워졌다').toBe('body');
  expect(errs).toEqual([]);
});

test('버그B-보호 ★칸에 남은 마지막 줄이 선택된 채 Backspace → 아무 것도 안 지워진다(블록도 안전)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, FIXTURE_1LINE);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const r = await runDelete(page);
  expect(r.consumed, '삭제 핸들러가 이 입력을 소비하지 않았다').toBe(true);
  expect(r.calls.showToast.length, '마지막 줄 보호 토스트가 안 떴다').toBeGreaterThan(0);

  const stillThere = await page.evaluate(() => document.body.contains(window.__block));
  expect(stillThere, '★마지막 한 줄 보호 상태에서도 그리드 블록이 삭제됐다').toBe(true);

  const model = await page.evaluate(() => window.__model(window.__block));
  expect(model.cells[0][0].lines.length, '★마지막 줄이 지워졌다 — 보호가 안 걸렸다').toBe(1);
  expect(errs).toEqual([]);
});

test('버그B-회귀 ★활성 줄이 «없으면»(li:null) 기존처럼 블록/행 전체가 삭제된다(정상 경로 보존)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, FIXTURE_2LINES);
  // grdSetActiveLine 을 한 번도 안 불렀다 — grdGetActiveLine(block) === null(WeakMap 미설정).
  const activeBefore = await page.evaluate(() => window.__getActive(window.__block));
  expect(activeBefore, '전제가 틀렸다 — 활성 줄이 이미 있다').toBeNull();

  const row = await page.evaluate(() => window.__block.closest('.row'));
  expect(row, '픽스처에 .row 가 없다').not.toBeNull();

  const r = await page.evaluate((delSrc) => {
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
    return { consumed: fn() };
  }, DEL_SRC);

  expect(r.consumed, '삭제가 소비되지 않았다 — 정상 경로가 죽었다').toBe(true);
  const rowGone = await page.evaluate(() => !document.body.contains(document.querySelector('.grid-block')));
  expect(rowGone, '★활성 줄이 없을 때도 그리드 블록이 안 지워진다 — 버그B 수정이 정상 삭제 경로를 막았다').toBe(true);
  expect(errs).toEqual([]);
});
