/* grid-line-delete.dom.spec.js — T-009 두 버그의 회귀 그물. (2026-09-16)
 *
 * ★버그A — 「줄 삭제」가 imgSrc만 비우고 line.type==='image' 줄을 그대로 남기면, 렌더러
 *   (grid-block.js:_gridLineHtml)가 빈 이미지 슬롯(grd-img-empty)을 남긴 채 «줄이 안 지워진다».
 *   ⇒ 「줄 삭제」라는 이름이 하는 일은 «줄이 사라지는 것»이어야 한다.
 *
 * ★★2026-09-25 «계약이 갈렸다» — 이 머리말이 원래 적고 있던 것은 「이미지 줄을 지우는 길은
 *   «전부» 같은 결과(줄 자체가 사라짐)여야 한다」였고, 우클릭 「이미지 삭제」를 그 길에 넣었다.
 *   현빈이 그 «전부»를 무르셨다(세 번 물으신 것):
 *     「빈 슬롯이 들어갈 수 있어야지. … 칸의 마지막 줄은 그리고 왜 삭제가 안 되니?
 *      빈 셀로도 두고 싶을 수도 있잖아?」
 *   ⇒ 그때 «버그»로 본 빈 placeholder 가 지금은 주문받은 «기능»이다. 이제 손잡이 이름대로 갈린다:
 *     · 줄바 「줄 삭제」(grd-line-del-btn) · Backspace  → 줄을 «뺀다»   ← ★이 파일이 재는 것
 *     · 우클릭 「이미지 삭제」(bcm-grid-img-del)        → 그림만 «비운다». 줄(자리)은 남는다
 *   ⛔아래 단언은 한 줄도 안 바꿨다 — 이 파일은 «줄바 쪽»만 재고, 그쪽 계약은 그대로다.
 *     우클릭 쪽의 새 계약은 tests/dom/grid-cell-empty-slot.dom.spec.js 가 «따로» 맡는다.
 *     (까닭을 여기 적어 두는 이유: 머리말과 제품이 따로 늙으면 다음 사람이 이 파일을 근거로
 *      「우클릭도 줄을 빼야 한다」고 되돌린다.)
 *
 * ★버그B — 그리드 셀 안 «줄»을 캔버스에서 클릭해도 DOM 선택은 여전히 .grid-block «전체»다
 *   (줄 선택은 WeakMap(grdActiveLine)에만 산다, 클래스가 안 붙는다). 그 상태에서 Backspace를
 *   누르면 editor.js 의 전역 삭제 핸들러(deleteSelectedFromCanvas)가 CANVAS_SEL_BLOCKS 로
 *   .grid-block.selected 를 주워가 «블록 통째로» 지웠다 — 데이터손실급. 고친 코드는 활성
 *   줄이 있으면 그 줄 하나만 지우고 블록은 건드리지 않는다.
 *   ~~[폐기 · 2026-09-26] 「(마지막 한 줄은 보호)」~~ → 마지막 줄도 지운다(위 버그A-해제).
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
 *   ⛔우클릭 「이미지 삭제」는 2026-09-25 부터 «여기 안 든다» — 그 길은 줄을 빼지 않고
 *     그림만 비운다(위 머리말의 계약 갈림). 그쪽은 grid-cell-empty-slot.dom.spec.js 가 잰다.
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

/* ~~[폐기 · 2026-09-26] 「버그A-보호 ★칸에 남은 마지막 줄(이미지 1개뿐)은 「줄 삭제」가
 *   비활성이고 지워지지 않는다」 — `btn.disabled === true` ＋ 「강제 클릭해도 1줄 그대로」~~
 * ⛔그 보호는 «그날까지 참이었다». 2026-09-26 현빈 지시로 걷었다:
 *     「여전히 빈칸으로 두고 싶은데 마지막 남은 줄은 삭제할 수 없다고 하네?」
 *   까닭 전부는 js/blocks/grid-block.js `_gridRejectLinesLength` 머리말에 있다.
 * ★그 자리를 «비워 두지 않는다» — 같은 픽스처로 «반대 방향»을 잰다. 그리고 옛 보호가 서 있던
 *   자리가 «셋»이었음을 여기서 못박는다(버튼 disabled · 핸들러 안 `curLines.length<=1` ·
 *   모델 입구). 하나만 풀면 「눌리는데 아무 일도 안 난다」가 된다 — 이 레포의 고질이다. */
test('버그A-해제 ★칸에 남은 마지막 줄도 「줄 삭제」로 지워진다 — 칸이 «빈 칸»이 된다 (0926 현빈)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, FIXTURE_1LINE);
  await page.evaluate(() => window.__open(window.__block, { r: 0, c: 0, li: 0 }));

  const btn = await page.evaluate(() => {
    const b = document.getElementById('grd-line-del-btn');
    return b ? { disabled: b.disabled } : null;
  });
  expect(btn, '★줄바의 「줄 삭제」가 안 떴다').not.toBeNull();
  /* 문 ① — 버튼이 열렸나. ⛔이것만 초록이어도 아래가 빨갈 수 있다(문이 셋이다). */
  expect(btn.disabled, '★마지막 한 줄이라고 「줄 삭제」가 아직 잠겨 있다 — 옛 보호가 남았다(문 ①)').toBe(false);

  await page.click('#grd-line-del-btn');

  /* 문 ②③ — 핸들러 안 가드와 모델 입구. 눌렸는데 수가 안 줄면 그 둘 중 하나가 남은 것이다. */
  const after = await page.evaluate(() => ({
    lines: window.__model(window.__block).cells[0][0].lines.length,
    emptyCell: window.__block.querySelectorAll('.grd-cell-empty').length,
    lineEls: window.__block.querySelectorAll('[data-r="0"][data-c="0"][data-line]').length,
    active: JSON.stringify(window.__getActive(window.__block)),
  }));
  expect(after.lines, '★눌렸는데 줄이 안 지워졌다 — 핸들러 안 가드나 모델 입구가 남아 있다(문 ②③)').toBe(0);
  expect(after.lineEls, '★모델은 비었는데 [data-line] 이 남아 있다 — 렌더가 안 따라왔다').toBe(0);
  expect(after.emptyCell, '★빈 칸 표식(.grd-cell-empty)이 안 찍혔다 — 안내문·클릭 판정이 이 표식에 기댄다').toBe(1);
  expect(after.active, '★지운 줄을 «아직 선택»하고 있다 — 없는 줄을 가리킨 채로 남으면 패널이 유령을 그린다').toBe('null');
  expect(errs).toEqual([]);
});

/* ══ 버그B — 그리드 셀 줄 선택 상태에서 Backspace가 «그 줄만» 지운다 ══ */

/** deleteSelectedFromCanvas 를 «진짜 소스 그대로» 돌리되, editor.js 바깥 의존은 최소 스텁으로.
 *  ★2026-09-26 — 스텁을 «블럭 삭제 분기까지» 넓혔다. 까닭: 마지막 줄 보호가 걷힌 뒤로 ⌫ 는
 *    「줄을 지운다 → (빈 칸) → 다음 ⌫ 가 블럭을 지운다」 두 걸음이 됐고, 옛 스텁(clearAssetImage
 *    하나)은 둘째 걸음에서 `multiSel is not defined` 로 죽었다. ⛔그 죽음을 「보호가 살아 있다」로
 *    읽으면 거짓 초록이 된다 — 스텁이 못 지나는 것과 제품이 막는 것은 «다른 일»이다.
 *  ★스텁 목록은 grid-block-select-delete.dom.spec.js 의 runDeleteFull 과 같다(따로 늙지 않게). */
async function runDelete(page) {
  return page.evaluate((delSrc) => {
    const calls = { showToast: [] };
    const scope = {
      clearAssetImage: () => {},
      deselectAll: () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')),
      multiSel: { cols: new Set(), blocks: new Set(), sections: new Set() },
      clearMultiSel: () => {},
      showMultiSelPanel: () => {},
    };
    window.showToast = (msg) => calls.showToast.push(msg);
    window.CANVAS_SEL_BLOCKS = '.grid-block.selected';
    window.pushHistory = () => {};
    window.buildLayerPanel = () => {};
    window.ensureHistoryCheckpoint = () => {};
    window.isSectionProtected = () => false;
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

/* ~~[폐기 · 2026-09-26] 「버그B-보호 ★칸에 남은 마지막 줄이 선택된 채 Backspace → 아무 것도
 *   안 지워진다(블록도 안전)」 — 토스트 ≥1 ＋ 줄 1개 유지~~
 * ⛔그 보호는 «그날까지 참이었다». 0926 현빈 지시로 걷었다(위 버그A-해제와 같은 까닭).
 * ★«블록이 안 지워진다»는 참뜻은 여기서 계속 지킨다 — 그것이 버그B 의 데이터손실 방어선이고
 *   보호 해제와 «독립된 축»이다. ⛔둘을 한 단언에 묶지 마라: 옛 판은 「토스트가 떴다」로 그
 *   방어선을 대신 재고 있었는데, 토스트가 사라지는 순간 방어선도 같이 안 재진다.
 * ★그리고 ⌫ 를 «두 번 연달아» 누른다 — 한 번만 하면 「비운 뒤 다음 ⌫ 가 블럭을 지우는지」를
 *   못 본다. 그게 옛 토스트가 안내하던 「블럭을 지우려면 Esc 후 삭제」의 대체 경로다. */
test('버그B-해제 ★마지막 줄이 선택된 채 ⌫ → 칸이 비고 «블록은 남는다». 한 번 더 ⌫ 면 블록이 지워진다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, FIXTURE_1LINE);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const r1 = await runDelete(page);
  expect(r1.consumed, '삭제 핸들러가 이 입력을 소비하지 않았다').toBe(true);
  expect(r1.calls.showToast, '★옛 「마지막 줄은 지울 수 없습니다」 토스트가 아직 뜬다').toEqual([]);

  /* ★첫 ⌫ 는 «줄»을 지운다 — 블록은 남아야 한다(버그B 방어선). */
  expect(await page.evaluate(() => document.body.contains(window.__block)),
    '★줄 하나를 지우려는 ⌫ 가 «블록 통째»를 지웠다 — T-009 버그B 재발(데이터손실급)').toBe(true);
  const m1 = await page.evaluate(() => ({
    lines: window.__model(window.__block).cells[0][0].lines.length,
    active: JSON.stringify(window.__getActive(window.__block)),
  }));
  expect(m1.lines, '★마지막 줄이 안 지워졌다 — 옛 보호가 남았다').toBe(0);
  expect(m1.active, '★지운 줄을 아직 선택하고 있다 — 다음 ⌫ 가 «없는 줄»을 지우려 든다').toBe('null');

  /* ★두 번째 ⌫ — 활성줄이 없으니 «블록 삭제»로 흐른다(옛 「Esc 후 삭제」의 대체 경로). */
  const r2 = await runDelete(page);
  expect(r2.consumed, '두 번째 ⌫ 를 아무도 소비하지 않았다 — 빈 칸에서 ⌫ 가 먹통이다').toBe(true);
  expect(await page.evaluate(() => !!document.querySelector('.grid-block')),
    '★칸을 비운 뒤 ⌫ 를 또 눌렀는데 블록이 안 지워진다 — 빈 칸이 «블록을 지울 수 없는 상태»가 됐다').toBe(false);
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
