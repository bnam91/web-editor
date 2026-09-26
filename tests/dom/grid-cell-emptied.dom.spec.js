/* grid-cell-emptied.dom.spec.js — 「그리드 칸을 «완전히»(줄 0개) 비운다」의 계약. (2026-09-26)
 *
 * ★현빈 2026-09-26 — 「여전히 빈칸으로 두고 싶은데 마지막 남은 줄은 삭제할 수 없다고 하네?」
 *   (같은 물음의 «네 번째»다. 0925 에는 「그림만 비우고 줄은 남긴다」로 답했는데, 현빈이
 *    원한 것은 «줄 자체»가 사라진 칸이었다 — tests/dom/grid-cell-empty-slot.dom.spec.js 머리말.)
 *
 * ★★범위 (현빈 2026-09-26 확정: 「②칸 하나만」)
 *     ✅칸 «하나»를 완전히 비우는 것 — 이 파일의 A~G
 *     ⛔「블럭의 «모든» 칸이 빈 상태」 — H 가 그것을 «막는다»
 *   ⇒ 옛 가드는 «없어진» 게 아니라 «옮겨졌다»: 「칸 하나라도 비면 거절」 → 「모든 칸이 비면 거절」.
 *     `EMPTY_CELL_LINES` 도 뜻만 바뀌어 살아 있다(`_gridRejectAllCellsEmpty`).
 *   ★까닭 — 「줄 0개 칸이 안 깨지나」와 「블럭이 통째로 비어도 되나」는 «다른 축»이고, 후자는
 *     저장·내보내기까지 번진다(F 가 재듯 내보낸 클론에선 빈 칸이 편집용 최소높이를 잃는다
 *     ⇒ 모든 칸이 비면 «높이 0의 보이지 않는 블럭»이 나간다).
 *
 * ★무엇을 옮겼나 — 막는 자리가 «다섯»이었다(문이 둘인 줄 알았는데 다섯이다):
 *     ⑴ js/blocks/grid-block.js `_gridRejectLinesLength` — 모델 입구의 0개 거부(EMPTY_CELL_LINES)
 *     ⑵ js/editor.js ⌫ — `lines.length <= 1` 토스트
 *     ⑶ js/props/prop-grid.js — [줄 삭제] 버튼 `disabled`
 *     ⑷ js/props/prop-grid.js — 그 버튼 «핸들러 안»의 `curLines.length <= 1` (⑶과 따로 앉아 있었다)
 *     ⑸ js/props/prop-grid.js `grdToastImgFail` — EMPTY_CELL_LINES 한국어 문구
 *   ⛔하나만 풀면 「눌리는데 아무 일도 안 난다」가 된다. 그래서 아래 A 가 다섯을 «지나는 길»로 잰다.
 *
 * ★★왜 가드를 «풀어도» 되는가 — 옛 까닭은 「줄 0개면 [data-line] 이 사라져 칸이 주소를 잃는다」
 *   였다. T-A(2026-09-16)가 그 자리를 메웠고(`.grd-cell-empty` ＋ `_gridAddrAt` 의 `{r,c,li:null}`),
 *   무엇보다 「줄 0개 칸」은 막던 동안에도 «이미 합법 상태»였다(새 그리드·새 행/열·cells 통째 경로).
 *   ⇒ 가드가 막던 것은 «상태»가 아니라 «그 상태로 가는 전이» 하나였다. B 가 그 대조를 잰다.
 *
 * 여기서 재는 것:
 *   A ★핵심 — 패널 [줄 삭제]로 마지막 줄까지 지운다. 다섯 문을 다 지나야 초록이다.
 *   B ★대조 — «비워서 만든 빈 칸»과 «처음부터 빈 칸»이 구별되지 않는다(가드의 옛 까닭이 무효).
 *   C 빈 칸이 «주소»를 갖는다 — 클릭 판정 · 행 거터 · 패널이 안 깨진다.
 *   D 되살릴 길이 있다 — 빈 칸에 줄을 다시 넣는다.
 *   E 저장·재열기 왕복에서 «빈 칸»이 머문다.
 *   F 내보내기 — 안내문(「+ 내용 추가」)이 «안 샌다» ＋ ★계측기 양성대조.
 *     ★곁수확 — `min-height:48px`(T-A) 이 인라인 `min-height:0` 에 늘 져서 «죽어 있다»는
 *       것을 실측해 기록한다(고치지 않았다 — 그 자리 주석에 까닭).
 *   G ★배열 계약은 남았다 — `lines:null` 은 여전히 거절이다(비우기 허용이 모양까지 풀면 안 된다).
 *   H ★★범위 — 「블럭의 «모든» 칸이 빈 상태」는 «막는다» ＋ 반응성 ＋ ⌫ 축(활성줄 원복).
 *
 * ⛔앱을 «안» 띄운다. 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-cell-emptied
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/** 함수 «전체»를 중괄호 균형으로 떠낸다(grid-line-delete.dom.spec.js 와 같은 함수). */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) { if (src[i] === '(') d++; else if (src[i] === ')') { d--; if (d === 0) { i++; break; } } }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) { if (src[i] === '{') b++; else if (src[i] === '}') { b--; if (b === 0) { i++; break; } } }
  return src.slice(m.index, i);
}
/* ★소스를 «떠서» 돌린다 — 이 둘은 export 가 아니다. 선례: grid-nested-line-select(_gridAddrAt) ·
   grid-gutter-hitarea(_rowContentEdge). ⛔손으로 베끼면 제품과 따로 늙는다. */
const ADDR_AT_SRC = extractFn(fs.readFileSync(path.join(REPO, 'js/block-drag.js'), 'utf8'), '_gridAddrAt');
const ROW_EDGE_SRC = extractFn(fs.readFileSync(path.join(REPO, 'js/overlay-handles.js'), 'utf8'), '_rowContentEdge');
const DEL_SRC = extractFn(fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8'), 'deleteSelectedFromCanvas');

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
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties, grdSetActiveLine, grdGetActiveLine, grdAddLine, grdToastImgFail } from '/js/props/prop-grid.js';
  window.grdToastImgFail = grdToastImgFail;   // ★code→한국어는 «한 벌»이다(제품이 쓰는 그 함수)
  window.__mk = makeGridBlock; window.__render = renderGridBlock;
  window.__upd = updateGridBlock; window.__model = getGridModel;
  window.__open = showGridProperties; window.__setActive = grdSetActiveLine; window.__getActive = grdGetActiveLine;
  window.__addLine = grdAddLine;
  window.grdSetActiveLine = grdSetActiveLine;   // ★editor.js 소스가 window 로 부른다
  window.grdGetActiveLine = grdGetActiveLine;
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
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  return errs;
}

const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** 칸 (0,0) 에 줄 `lines`, 칸 (0,1) 엔 이웃 내용. ★기본은 «마지막 한 줄»이다. */
async function mount(page, lines) {
  await page.evaluate(({ lines }) => {
    document.getElementById('host').innerHTML = '';
    const { row, block } = window.__mk({ cols: [
      { width: 1, lines },
      { width: 1, lines: [{ type: 'body', text: '이웃' }] },
    ] });
    document.getElementById('host').appendChild(row);
    block.classList.add('selected');
    window.__block = block;
  }, { lines });
}

/** 칸 (r,c) 의 «지금 모습»을 한 덩이로 찍어 낸다 — 정체(줄 수·표식·주소)로 잰다. */
const shotOf = (page, r, c) => page.evaluate(({ r, c }) => {
  const b = window.__block;
  const cell = b.querySelector(`.grd-cell[data-r="${r}"][data-c="${c}"]`);
  return {
    n: (window.__model(b).cells?.[r]?.[c]?.lines || []).length,
    emptyCls: !!cell && cell.classList.contains('grd-cell-empty'),
    lineEls: cell ? cell.querySelectorAll('[data-line]').length : -1,
    hint: cell ? getComputedStyle(cell, '::before').content : '(칸 없음)',
    active: JSON.stringify(window.__getActive(b)),
  };
}, { r, c });

/* ═══ A ★핵심 — 다섯 문을 «다» 지나야 초록이다 ═══════════════════════════════ */
test('A ★패널 [줄 삭제]로 «마지막 줄»까지 지운다 — 칸이 줄 0개가 된다 (현빈 0926)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, [{ type: 'image', imgSrc: IMG, height: 40 }]);
  await page.evaluate(() => window.__open(window.__block, { r: 0, c: 0, li: 0 }));

  // 전제 — 정말 «한 줄»이다. 2줄이면 이 검사는 마지막 줄을 안 잰다.
  expect((await shotOf(page, 0, 0)).n, '픽스처가 한 줄이 아니다 — 이 검사가 마지막 줄을 안 잰다').toBe(1);

  /* 문 ⑶ — 버튼이 열렸나. ⛔이것만 보고 넘어가지 마라(⑷가 따로 앉아 있었다). */
  const btn = await page.evaluate(() => {
    const b = document.getElementById('grd-line-del-btn');
    return b ? { disabled: b.disabled, title: b.title } : null;
  });
  expect(btn, '★줄바의 「줄 삭제」가 안 떴다 — 손잡이가 하나도 없다').not.toBeNull();
  expect(btn.disabled, '★마지막 한 줄이라고 버튼이 잠겼다 — 문 ⑶(prop-grid 버튼 disabled)이 남았다').toBe(false);
  expect(btn.title, '★title 이 아직 「지울 수 없습니다」라고 말한다 — 화면이 거짓을 말한다')
    .not.toMatch(/지울 수 없/);

  await page.click('#grd-line-del-btn');

  /* 문 ⑷⑴ — 눌렸는데 수가 안 줄면 핸들러 안 가드나 모델 입구가 남은 것이다. */
  const shot = await shotOf(page, 0, 0);
  expect(shot.n, '★눌렸는데 줄이 안 지워졌다 — 문 ⑷(핸들러 안 `curLines.length<=1`)나 ⑴(모델 입구)이 남았다').toBe(0);
  expect(shot.lineEls, '★모델은 비었는데 [data-line] 이 남았다 — 렌더가 안 따라왔다').toBe(0);
  expect(shot.emptyCls, '★빈 칸 표식(.grd-cell-empty)이 안 찍혔다').toBe(true);
  expect(shot.active, '★지운 줄을 «아직 선택»하고 있다 — 없는 줄을 가리킨 채면 패널이 유령을 그린다').toBe('null');

  /* 이웃 칸은 «안 건드려졌다» — 비우기가 옆으로 새지 않는다. */
  expect((await shotOf(page, 0, 1)).n, '★옆 칸의 줄까지 사라졌다').toBe(1);
  expect(errs, '★빈 칸을 만드는 동안 콘솔 예외가 났다').toEqual([]);
});

/* ═══ B ★대조 — 옛 가드의 «까닭»이 무효라는 증거 ═════════════════════════════ */
test('B ★«비워서 만든 빈 칸»과 «처음부터 빈 칸»이 구별되지 않는다 — 가드는 «상태»가 아니라 «전이»만 막고 있었다', async ({ page }) => {
  const errs = await boot(page);

  // ㉠ 비워서 만든 빈 칸
  await mount(page, [{ type: 'body', text: '지워질 줄' }]);
  await page.evaluate(() => window.__upd(window.__block.id, { patchCell: { r: 0, c: 0, lines: [] } }));
  const emptied = await shotOf(page, 0, 0);

  // ㉡ 처음부터 빈 칸 — makeGridBlock 이 «가드가 살아 있던 동안에도» 만들 수 있던 상태다
  await mount(page, []);
  const born = await shotOf(page, 0, 0);

  /* ★활성줄만 뺀다 — 그건 «어떻게 왔나»의 흔적이지 «칸의 상태»가 아니다. */
  const strip = (o) => ({ n: o.n, emptyCls: o.emptyCls, lineEls: o.lineEls, hint: o.hint });
  expect(strip(emptied), '★두 빈 칸이 «다르게» 생겼다 — 그러면 하나는 반쪽 상태다(옛 가드의 까닭이 되살아난다)')
    .toEqual(strip(born));
  expect(born.n, '★makeGridBlock 이 빈 칸을 못 만든다 — 이 대조의 전제가 무너졌다(검사가 아무것도 안 잰다)').toBe(0);
  expect(errs).toEqual([]);
});

/* ═══ C 빈 칸이 «주소»를 갖는다 ═══════════════════════════════════════════════ */
test('C ★줄 0개 칸도 «주소»를 갖는다 — 클릭 판정 {li:null} · 행 거터 · 패널이 안 깨진다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, [{ type: 'body', text: '지워질 줄' }]);
  await page.evaluate(() => window.__upd(window.__block.id, { patchCell: { r: 0, c: 0, lines: [] } }));

  const r = await page.evaluate(({ addrSrc, edgeSrc }) => {
    const b = window.__block;
    const cell = b.querySelector('.grd-cell[data-r="0"][data-c="0"]');
    const out = {};
    /* ⑴ 클릭 주소 — 「진짜 빈 칸」만 셀 모드({li:null})로 내려간다(block-drag.js 머리말). */
    const addrAt = new Function('window', `${addrSrc}; return _gridAddrAt;`)(window);
    out.addr = JSON.stringify(addrAt(cell, b));
    /* ⑵ 행 거터 y — 줄 0개 칸을 «건너뛰고» 다른 열에서 집어야 한다(0개면 예외가 나던 자리인가?). */
    const edge = new Function('GUT_CONTENT_EPS', `${edgeSrc}; return _rowContentEdge;`)(0.75);
    try { out.edgeUp = edge(b, 0, 'up'); out.edgeDown = edge(b, 0, 'down'); }
    catch (e) { out.edgeThrew = String(e && e.message || e); }
    /* ⑶ 패널 — 빈 칸 주소로 열린다. 그리고 «없는 줄»(li:0)을 줘도 안 죽는다. */
    try { window.__open(b, { r: 0, c: 0, li: null }); out.panelNull = 'ok'; }
    catch (e) { out.panelNull = 'THROW: ' + String(e && e.message || e); }
    out.cellSelMark = document.querySelectorAll('.grd-cell-selected').length;
    try { window.__open(b, { r: 0, c: 0, li: 0 }); out.panelStale = 'ok'; }
    catch (e) { out.panelStale = 'THROW: ' + String(e && e.message || e); }
    return out;
  }, { addrSrc: ADDR_AT_SRC, edgeSrc: ROW_EDGE_SRC });

  expect(r.addr, '★빈 칸이 클릭 주소를 못 준다 — 손에 닿지 않는 칸이 된다(옛 가드가 걱정한 바로 그것)')
    .toBe(JSON.stringify({ r: 0, c: 0, li: null }));
  expect(r.edgeThrew, '★행 거터 계산이 줄 0개 칸에서 터졌다 — `[data-line]` 0개를 안 건너뛴다').toBeUndefined();
  expect(r.edgeUp, '★거터가 «이웃 열»의 글줄에서 y 를 못 집었다 — 빈 열 하나가 행 경계를 망친다')
    .toBeGreaterThan(0);
  expect(r.panelNull, '★빈 칸 주소로 패널이 안 열린다').toBe('ok');
  expect(r.cellSelMark, '★빈 칸 선택 표시(.grd-cell-selected)가 안 붙었다 — 어디가 골라졌는지 안 보인다').toBe(1);
  expect(r.panelStale, '★«없는 줄»(li:0) 주소로 패널이 터졌다 — 낡은 주소 하나가 패널을 죽인다').toBe('ok');
  expect(errs).toEqual([]);
});

/* ═══ D 되살릴 길 ════════════════════════════════════════════════════════════ */
test('D ★비운 칸을 «되살릴» 수 있다 — 빈 칸에 줄을 다시 넣는다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, [{ type: 'body', text: '지워질 줄' }]);
  await page.evaluate(() => window.__upd(window.__block.id, { patchCell: { r: 0, c: 0, lines: [] } }));
  expect((await shotOf(page, 0, 0)).n, '전제 — 비워져 있어야 한다').toBe(0);

  const res = await page.evaluate(() =>
    window.__addLine(window.__block, { r: 0, c: 0 }, null, { type: 'body', text: '되살림' }));
  expect(res.ok, '★빈 칸에 줄을 다시 넣을 수 없다 — 비우면 «돌아올 수 없는» 칸이 된다').toBe(true);

  const shot = await shotOf(page, 0, 0);
  expect(shot.n, '★되살렸다는데 줄이 없다').toBe(1);
  expect(shot.emptyCls, '★줄을 넣었는데 「빈 칸」 표식이 남았다 — 안내문이 글자 위에 겹쳐 뜬다').toBe(false);
  expect(shot.hint, '★줄을 넣었는데 안내문이 아직 그려진다').toBe('none');
  expect(errs).toEqual([]);
});

/* ═══ E 저장·재열기 왕복 ═════════════════════════════════════════════════════ */
test('E ★빈 칸이 «머문다» — 저장 자리(dataset)에 실리고 다시 열어도 빈 칸이다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, [{ type: 'body', text: '지워질 줄' }]);
  await page.evaluate(() => window.__upd(window.__block.id, { patchCell: { r: 0, c: 0, lines: [] } }));

  /* ㉠ 저장 — 행 0 칸의 줄은 `cols[c].lines` 가 갖는다(grid-block.js 단일 진실원). */
  const saved = await page.evaluate(() => {
    const cols = JSON.parse(window.__block.dataset.cols || '[]');
    return { c0: cols[0] && cols[0].lines, c1len: (cols[1] && cols[1].lines || []).length };
  });
  expect(saved.c0, '★저장 자리(dataset.cols)에 «빈 배열»이 안 실렸다 — 저장하면 옛 줄이 살아 돌아온다').toEqual([]);
  expect(saved.c1len, '★옆 칸의 줄이 저장본에서 사라졌다').toBe(1);

  /* ㉡ 재열기 — 저장본을 다시 여는 길과 같은 절차(editor.js: HTML 을 심고 renderGridBlock). */
  const after = await page.evaluate(() => {
    const html = window.__block.outerHTML;
    const host = document.getElementById('host');
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const b = wrap.firstElementChild;
    host.appendChild(b);
    window.__render(b);
    window.__block = b;
    const cell = b.querySelector('.grd-cell[data-r="0"][data-c="0"]');
    return {
      n: (window.__model(b).cells[0][0].lines || []).length,
      emptyCls: !!cell && cell.classList.contains('grd-cell-empty'),
      neighbor: (window.__model(b).cells[0][1].lines || []).length,
    };
  });
  expect(after.n, '★다시 여니 빈 칸이 아니다 — 비우기가 «안 머문다»').toBe(0);
  expect(after.emptyCls, '★다시 여니 빈 칸 표식이 안 찍힌다').toBe(true);
  expect(after.neighbor, '★다시 여니 옆 칸 줄이 사라졌다').toBe(1);
  expect(errs).toEqual([]);
});

/* ═══ F 내보내기 — 편집 전용 장식이 «안 샌다» ＋ ★계측기 양성대조 ═════════════
 * ★★여기서 «딴 결함»을 하나 실측해 못박는다 (2026-09-26, 이 카드의 곁수확):
 *     `css/editor-blocks.css:1489` 의 `#canvas .grid-block .grd-cell-empty { min-height: 48px; }`
 *     는 T-A(2026-09-16) 이후 «한 번도 효과가 없었다». 렌더러가 «모든 칸»에 인라인
 *     `style="min-width:0;min-height:0;…"` 를 찍기 때문이다(grid-block.js renderGridBlock) —
 *     인라인은 클래스 규칙을 언제나 이긴다. 실측 계산값 = `0px`(캔버스 안에서도).
 *   ⛔그래도 빈 칸은 «보인다» — `::before` 안내문(「+ 내용 추가 (T/G/K)」)이 글자 높이를 만들어
 *     칸이 ~35px 를 갖는다(빈 1행 그리드 실측). 즉 「손에 안 닿는다」는 아니다.
 *   ⛔이 카드에서 «고치지 않았다». 까닭 — 살리면 «모든» 빈 칸(새 그리드 4칸 전부 포함)이
 *     48px 최소높이를 갖게 되어 현빈 화면의 행 높이가 바뀐다. 그건 「마지막 줄을 지우게 해 달라」는
 *     지시 밖의 «화면 변화»이고, 되돌리기 어려운 쪽이라 판단을 위로 올린다.
 *   ★그래서 아래는 «실상»을 못박는다 — 고치면 이 단언이 빨개지고, 다음 사람이 이 주석을 읽는다.
 *     ⛔「0px 이어야 한다」가 아니다. 「지금 0px 이다 ＝ 그 CSS 줄이 죽어 있다」는 기록이다. */
test('F ★내보내기 — 「+ 내용 추가」 안내문이 «안 샌다» ＋ ★양성대조 ＋ 죽은 min-height 기록', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, [{ type: 'body', text: '지워질 줄' }]);
  await page.evaluate(() => window.__upd(window.__block.id, { patchCell: { r: 0, c: 0, lines: [] } }));

  const r = await page.evaluate(() => {
    const pick = (root) => {
      const cell = root.querySelector('.grd-cell[data-r="0"][data-c="0"]');
      return { hint: getComputedStyle(cell, '::before').content,
               minH: getComputedStyle(cell).minHeight,
               h: Math.round(cell.getBoundingClientRect().height) };
    };
    const inCanvas = pick(window.__block);
    /* 내보내기 클론은 #canvas «밖»에 붙는다 — 그래서 `#canvas …` 로 스코프된 규칙이 안 걸린다
       (css/editor-blocks.css 의 그 규칙 주석이 이 설계를 적고 있다). */
    const clone = window.__block.cloneNode(true);
    document.body.appendChild(clone);
    const outside = pick(clone);
    /* ★양성대조 ㉠ 안내문 — «무엇으로 새는가»를 흉내낸다: 같은 규칙을 스코프 «없이» 넣는다.
       이걸 넣어도 측정이 안 바뀌면 이 계측기는 아무것도 안 재고 있었다. */
    const st = document.createElement('style');
    st.textContent = '.grid-block .grd-cell-empty::before { content: "LEAKED"; }';
    document.head.appendChild(st);
    const leakedHint = pick(clone).hint;
    st.remove();
    /* ★양성대조 ㉡ min-height — 계측기가 min-height «변화»를 볼 수 있는지 따로 증명한다.
       ⛔스코프만 지우면 안 바뀐다(인라인이 이긴다) — 그래서 !important 로 «계측기 자체»를 잰다.
         이 갈라 재기가 없으면 「0px 이 나왔다」가 「계측기가 죽었다」와 구별되지 않는다. */
    const st2 = document.createElement('style');
    st2.textContent = '.grid-block .grd-cell-empty { min-height: 48px !important; }';
    document.head.appendChild(st2);
    const forcedMinH = pick(clone).minH;
    st2.remove(); clone.remove();
    return { inCanvas, outside, leakedHint, forcedMinH };
  });

  expect(r.inCanvas.hint, '★캔버스에서 안내문이 안 보인다 — 빈 칸이 손에 안 닿는다(전제 실패)')
    .toMatch(/내용 추가/);
  expect(r.inCanvas.h, '★빈 칸의 높이가 0 이다 — 안내문조차 자리를 못 만들면 누를 데가 없다')
    .toBeGreaterThan(10);
  expect(r.outside.hint, '★내보낸 결과물에 「+ 내용 추가」 안내문이 «샜다»').toBe('none');
  /* ★양성대조 ㉠ — 스코프를 잃으면 새는 것이 보여야 한다. */
  expect(r.leakedHint, '★안내문 계측기가 아무것도 안 잰다 — 스코프를 지웠는데 측정이 그대로다')
    .toMatch(/LEAKED/);

  /* ★★죽은 CSS 기록 — 위 머리말을 읽어라. 고쳤다면 이 두 줄이 빨개진다(그게 의도다). */
  expect(r.inCanvas.minH,
    '★`#canvas … .grd-cell-empty { min-height:48px }` 가 «살아났다». 살린 것이 뜻한 것이면 ' +
    '이 단언을 고치고, 새 그리드의 행 높이가 바뀌는 것(모든 빈 칸이 48px)을 같이 확인해라.')
    .toBe('0px');
  expect(r.forcedMinH, '★계측기가 min-height 를 아예 못 읽는다 — 위 「0px」은 «측정»이 아니라 «침묵»이었다')
    .toBe('48px');
  expect(errs).toEqual([]);
});

/* ═══ G ★배열 계약은 남았다 ══════════════════════════════════════════════════ */
test('G ★비우기 허용이 «모양 계약»까지 풀지 않았다 — lines:null 은 LINES_NOT_ARRAY 로 거절', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, [{ type: 'body', text: 'A' }, { type: 'body', text: 'B' }]);

  const r = await page.evaluate(() => {
    const b = window.__block;
    const res = window.__upd(b.id, { patchCell: { r: 0, c: 0, lines: null } });
    return { ok: res.ok, code: res.code, n: (window.__model(b).cells[0][0].lines || []).length,
             raw: JSON.parse(b.dataset.cols || '[]')[0] };
  });
  expect(r.ok, '★`lines:null` 이 통과했다 — 저장본이 {"lines":null} 이 되어 「비웠다」와 안 갈린다').toBe(false);
  expect(r.code).toBe('LINES_NOT_ARRAY');
  expect(r.n, '★거절했다면서 데이터는 이미 건드렸다').toBe(2);
  expect(Array.isArray(r.raw.lines), '★저장본의 lines 가 배열이 아니게 됐다').toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ H ★「블럭이 통째로 비는 것」도 된다 (현빈 0927 T-230) ══════════════════
 * ~~[폐기 · 2026-09-27] H1 막힌다 / H2 옆 칸 내용에 반응한다 / H3 ⌫ 도 같은 자에 걸린다~~
 *   ⇒ 그 셋이 잠근 계약이 «뒤집혔다». 막던 자(`_gridRejectAllCellsEmpty`)를 함수째 지웠다.
 * ★왜 — 0926 에 내가 「풀면 깨진다」고 올렸고 현빈이 그 전제 위에서 「②칸 하나만」으로 범위를
 *   좁히셨다. 그 전제가 틀렸다(11축 재니 0건). 다시 여쭈니 「t230 > 마지막 한칸도 비울 수 있게 해줘」.
 * ★새로 잠그는 것 둘:
 *     H  «마지막 내용 칸»도 비워지고, 화면·모델·⌫ 세 길이 같은 답을 준다
 *     I  ⚠️그 상태의 «대가» — 모든 칸이 비면 내보낸 결과물에서 높이가 0 이라 안 보인다
 *        ⛔이것은 결함이 아니라 «지금의 계약»이다. 바꾸려면 현빈 결정이 필요하다. */

test('H ★내용이 남은 «마지막 칸»도 비워진다 — 모델·화면 두 길 (⛔⌫ 는 여기서 «안» 잰다)', async ({ page }) => {
  /* ⛔제목에 ⌫ 를 넣지 않는다 — 이 검사는 `__upd`(모델 입구)만 부른다. ⌫ 경로(editor.js
     deleteSelectedFromCanvas)는 옛 H3 가 재던 자리인데, 그 가드가 없어져 «거절 뒤 원복»이라는
     잴 거리 자체가 사라졌다. ⇒ 지금 ⌫ 를 지키는 것은 tests/dom/grid-line-delete.dom.spec.js 다. */
  const errs = await boot(page);
  /* 칸 (0,1) 을 먼저 비워 «내용 있는 칸이 (0,0) 하나»인 블럭을 만든다. */
  await mount(page, [{ type: 'body', text: '유일한 내용' }]);
  await page.evaluate(() => window.__upd(window.__block.id, { patchCell: { r: 0, c: 1, lines: [] } }));

  const r = await page.evaluate(() => {
    const res = window.__upd(window.__block.id, { patchCell: { r: 0, c: 0, lines: [] } });
    const m = window.__model(window.__block);
    const cell = window.__block.querySelector('.grd-cell[data-r="0"][data-c="0"]');
    return {
      ok: res && res.ok,
      code: res && res.code,
      n00: (m.cells?.[0]?.[0]?.lines || []).length,
      n01: (m.cells?.[0]?.[1]?.lines || []).length,
      emptyCls: !!cell && cell.classList.contains('grd-cell-empty'),
      hint: cell ? getComputedStyle(cell, '::before').content : '(칸 없음)',
      alive: !!document.querySelector('.grid-block'),
    };
  });

  expect(r.ok, `★마지막 내용 칸이 아직 막힌다(code=${r.code}) — 현빈 0927 지시가 안 들어갔다`).toBe(true);
  expect(r.n00, '★ok:true 인데 데이터가 안 비었다').toBe(0);
  expect(r.n01, '★전제 — 옆 칸도 비어야 이 검사가 「통째로」를 잰다').toBe(0);
  expect(r.emptyCls, '★비웠는데 `.grd-cell-empty` 가 안 찍혔다 — 안내문·클릭 판정이 이 표식에 기댄다').toBe(true);
  expect(r.hint, '★빈 칸에 「+ 내용 추가」 안내문이 없다 — 되살릴 길이 손에 안 닿는다').toMatch(/내용 추가/);
  expect(r.alive, '★블럭이 «사라졌다» — 비우기는 삭제가 아니다').toBe(true);
  expect(errs).toEqual([]);
});

test('I ★대가 — 모든 칸이 비면 «내보낸 결과물»에서 높이가 0 이다 (계약)', async ({ page }) => {
  /* ⛔이것을 「고쳐야 할 버그」로 읽지 마라 — 2026-09-27 현재 «고르고 남긴» 계약이다.
     ★여기 적어 두는 까닭: 다음 사람이 「빈 격자를 내보냈는데 아무것도 안 나온다」를 만났을 때
       그것이 «알려진 것»인지 «새로 깨진 것»인지 한 번에 갈리게 하기 위해서다.
     ★고치기로 하면 이 검사가 빨개진다. 그게 의도다 — 그때 이 머리말과 T-230 을 같이 고쳐라. */
  const errs = await boot(page);
  await page.evaluate(() => {
    document.getElementById('host').innerHTML = '';
    const { row, block } = window.__mk({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
    document.getElementById('host').appendChild(row);
    window.__block = block;
  });

  const r = await page.evaluate(() => {
    const h = (el) => Math.round(el.getBoundingClientRect().height);
    const outsideH = (block) => {
      const clone = block.cloneNode(true);
      document.body.appendChild(clone);
      const v = h(clone);
      clone.remove();
      return v;
    };
    const empty = { inCanvas: h(window.__block), outside: outsideH(window.__block) };
    /* ★대조군 — 내용이 «하나라도» 있는 블럭은 내보내기에서 높이를 갖는다.
       이게 갈리지 않으면 위 0 은 「계측기가 죽었다」와 구별되지 않는다. */
    document.getElementById('host').innerHTML = '';
    const { row, block } = window.__mk({ cols: [
      { width: 1, lines: [{ type: 'body', text: '내용' }] }, { width: 1, lines: [] },
    ] });
    document.getElementById('host').appendChild(row);
    return { empty, ctrlOutside: outsideH(block) };
  });

  expect(r.empty.inCanvas, '★캔버스에서도 높이가 0 이다 — 편집 중에도 손에 안 닿는다(다른 결함)').toBeGreaterThan(10);
  expect(r.empty.outside, '★내보내기 높이가 0 이 «아니다» — 계약이 바뀌었다. 이 검사와 T-230 을 같이 고쳐라').toBe(0);
  expect(r.ctrlOutside, '★대조군마저 0 이다 — 이 계측기는 아무것도 안 재고 있다').toBeGreaterThan(10);
  expect(errs).toEqual([]);
});
