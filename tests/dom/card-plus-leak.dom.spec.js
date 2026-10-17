/* card-plus-leak.dom.spec.js — E65 짝(카드블럭): ＋ 가 «떠 있는 동안»(카드 선택) 제품의 읽기·내보내기 길로 새는가
 *
 * ★까닭(지디 2026-10-18 지시 — d3 ②) — 첫 독해 「cvb-plus-layer 는 블럭 밖 층이라 안 샌다」를 지디가 반증했다:
 *   .grd-add-btn(그리드 ＋)도 똑같이 #canvas-scaler 에 붙는 «밖» 층(grid-block.js:3843 #grd-plus-layer)인데,
 *   거기는 cleanup 4자리(save-load.js:646 · export-css-collect.js:46 · export-html.js:125/270/299 ·
 *   section-serialize.js:356)가 있고 누수를 재는 이 시험의 선례(grid-plus-g15-leak.dom.spec.js)까지 있다.
 *   ⇒ «밖 층에 살아도 샌다»(그 네 자리가 증거) — .cvb-add-btn(카드 ＋, canvas-block.js:375,385)은 그 네 자리
 *   어디에도 없다 — ★★«진짜 새는지»를 고치기 전에 먼저 잰다(양성대조 — 그래야 고침이 무엇을 막았는지 증명된다).
 *
 * ★261018 — 소스로 다시 가렸다(지디 재지시: 이 맥 swap 95%+ 라 Playwright 금지 ⇒ 행위 대신 소스 읽기):
 *   L1·L2(serializeProject/getSerializedCanvas)·L3(exportHTMLFile) 는 전부 **`canvasEl.cloneNode(true)`**
 *   (save-load.js:616-623 · export-html.js:97, canvasEl = `#canvas`). L4(prepareCloneForCapture)는
 *   `sec.cloneNode(true)`(export-image.js:250, sec = 전달된 `.section-block`). L5(buildFigmaExportJSON)는
 *   `state.pages[].canvas`(= L1/L2 와 같은 캐시된 `#canvas` 문자열)를 detached div 로 되살려 읽는다
 *   (export-figma-json.js). L6(collectSectionTextBlocks)은 `sec.querySelectorAll(...)`(ai-section-fill.js:51).
 *   L7(getCanvasState)은 섹션id 가 있으면 `document.getElementById(sectionId)`, 없으면 `_getCanvasRoot()`=`#canvas`
 *   (canvas-state.js:25,266-281). L8 은 블럭 엘리먼트 자신의 innerText.
 *   ⇒ ★★여덜 뿌리 전부 `#canvas` 자신 또는 그 **후손**(특정 section/block)이다. `#cvb-plus-layer`는
 *   index.html:543-545·canvas-block.js:380-386 이 보여주듯 `#canvas-scaler`의 **형제**(`#canvas`의 자식이 아님)다
 *   ⇒ ★★구조상 L1~L8 어느 뿌리도 `#cvb-plus-layer`를 품을 수 없다 — **소스로 「안 샌다」가 선다**(실행 불필요).
 *   grid-block.js:3848 자신의 주석도 이미 그렇게 적어 뒀다("cleanup 의 .grd-add-btn 줄은 «혹시 섞이면» 걷는
 *   방어" — 지금 막고 있는 구멍이 아니라 미래 회귀 보험이라는 뜻).
 * ★그래서 `.cvb-add-btn`을 cleanup 명부 4곳(save-load.js:646 등)에 «안 넣었다» — 지금 넣어도 무력화(그 줄을
 *   빼 봐도 이 시험이 안 빨개진다)가 0이라 보험이 아니라 장식이 된다. ★★이 시험이 빨개지는 날 = 누가
 *   `.cvb-add-btn`을 블럭 «안»으로 옮긴 날이다 — 그때는 버튼 위치를 되돌리거나, 그럴 수 없다면 그제서야
 *   cleanup 4곳에 추가해라(그때는 무력화가 선다 — 뺐을 때 이 시험이 실제로 빨개진다).
 * ★행위 확인(실제로 1회 돌렸던 기록, 솔직히 남긴다) — 이 소스 재가름 «전»에, 이 맥의 memory_pressure 가
 *   "free 41~44%"로 거짓 안심을 준 상태에서 이 파일을 1회 실행했다(2026-10-18, 1 passed, 아래 L1~L8 전부
 *   markup=false·plus 없음). 그 뒤 vm_stat/vm.swapusage 로 다시 재니 swap 가 95%+(이 메시지 작성 시점 98%)였다 —
 *   ★★그 실행 결과를 "증명"으로 쓰지 않는다(위 소스 가름이 독립된 증거다). ★★이 노트 이후로는 이 맥에서
 *   다시 돌리지 않았다 — 처음 다시 돌리는 사람은 vm_stat Pages free·`sysctl vm.swapusage` 를 먼저 재고
 *   (memory_pressure 금지 — macOS 가 회수가능분을 "여유"로 쳐서 거짓 안심을 준다), 돌린 뒤 초록/빨강을
 *   결과에 적어라.
 * 재는 길(모두 «＋ 가 떠 있는 채로» — 전제 단언) — grid-plus-g15-leak.dom.spec.js 와 같은 L1~L8:
 *   L1 저장 문자열(serializeProject)           L2 히스토리 스냅숏(getSerializedCanvas)
 *   L3 HTML 내보내기(진짜 exportHTMLFile, Blob 가로채기)
 *   L4 PNG 클론(prepareCloneForCapture)        L5 피그마 JSON(flushCurrentPage → buildFigmaExportJSON)
 *   L6 AI 채우기 읽기면(collectSectionTextBlocks — ai-section-fill.js 가 canvas-block simple 카드를
 *      dataset.cards 에서 직접 읽어 item 을 만든다. DOM 의 .cvb-add-btn 과는 다른 길이라 따로 잰다)
 *   L7 MCP get_canvas_state·read_section        L8 검색(블럭 innerText)
 * 새는 표지: 'cvb-add-btn'/'cvb-grid-add-btn'(1017t1d3 열·행 성장 ＋, 아래) 문자열 · 카드 글(기본값 '카드 제목')에 없는 '+' 글자.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sM" data-section="1" data-name="sM"><div class="section-hitzone"></div><div class="section-inner" id="innerM">
  <div class="gap-block" data-type="gap" style="height:60px"></div><div id="slotM"></div>
  <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    const { row, block } = window.makeCanvasBlock({ cardMode: 'simple' });   // 기본 카드: title='카드 제목' · desc='' (전제 — 설명이 비어 ＋ 가 뜬다)
    document.getElementById('slotM').replaceWith(row); window.bindBlock(block); window.rebindAll?.();
    window.renderCanvas(block);
    block.scrollIntoView({ block: 'center' });
    return block.id;
  }, SEC);
  /* ★261018 — grid-plus-g15-leak.dom.spec.js:33 의 고정 대기(waitForTimeout(200))를 그대로 안 베꼈다 —
   * ★이 저장소는 고정 대기 0건이 규율(W3 래칫·dom-fixed-wait-census) ⇒ «무엇을» 기다리는지로 바꿨다:
   * 블럭 크기(canvas-block.js renderCanvas 의 ResizeObserver applyScale)가 settle 했는가. */
  await page.waitForFunction((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.height > 0; }, id);
  const [x, y] = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.3]; }, id);
  /* ＋ 는 «고르면» 뜬다(grid 의 H8 과 같은 결) — 진짜 클릭으로 고른다. */
  await page.mouse.click(x, y);
  await page.waitForFunction(() => document.querySelectorAll('.cvb-add-btn').length === 1
    && document.querySelectorAll('.cvb-grid-add-btn').length === 2, null, { timeout: 3000 });
  /* ★1017t1d3 — 열·행 성장 ＋(.cvb-grid-add-btn)도 같은 층에 같이 뜬다(d3 재확인 ⒋: 같은 조건 _cvbPlusShown).
   * 이 누수시험이 새 ＋ 도 재는지 물었던 지시(지디) — 아래 전제를 둘 다 걸어 L1~L8 정규식을 두 클래스 다 본다. */
  expect(await page.evaluate(() => document.querySelectorAll('.cvb-add-btn').length), '전제 — 빈칸채우기 ＋ 하나(카드 1장·빈 필드 1개)').toBe(1);
  expect(await page.evaluate(() => document.querySelectorAll('.cvb-grid-add-btn').length), '전제 — 성장 ＋ 둘(열+행)').toBe(2);
  return { errs, id };
}

test('L1~L8 ★카드 ＋(빈칸채우기·성장 둘 다) 가 떠 있는 동안 제품의 읽기·내보내기 길 어디에도 ＋ 가 없다', async ({ page }) => {
  test.setTimeout(120000);
  const { errs, id } = await setup(page);
  const r = await page.evaluate(async (id) => {
    const g = document.getElementById(id), sec = g.closest('.section-block');
    const cardOnly = (html) => { const d = document.createElement('div'); d.innerHTML = html; const x = d.querySelector('#' + id); return x ? x.outerHTML + '' + x.textContent : '(카드 없음)'; };
    const out = {};
    // L1 저장 문자열
    const proj = window.serializeProject();
    // star note: /cvb-(?:grid-)?add-btn/ also partial-matches 'cvb-grid-add-btn' (shared prefix) -- one regex covers both classes
    out.L1 = { markup: /cvb-(?:grid-)?add-btn/.test(proj), cardText: (() => { const p = JSON.parse(proj); return cardOnly(p.pages[0].canvas).split('')[1]; })() };
    // L2 히스토리
    out.L2 = { markup: /cvb-(?:grid-)?add-btn/.test(window.getSerializedCanvas()), cardText: cardOnly(window.getSerializedCanvas()).split('')[1] };
    // L3 HTML 내보내기(진짜 exportHTMLFile, 내려받기 대신 Blob 가로채기)
    let blob = null;
    const oC = URL.createObjectURL, oR = URL.revokeObjectURL, oClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b) => { blob = b; return 'blob:__stub__'; }; URL.revokeObjectURL = () => {}; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oC; URL.revokeObjectURL = oR; HTMLAnchorElement.prototype.click = oClick; }
    const html = blob ? await blob.text() : '';
    const body = html.replace(/<style[\s\S]*?<\/style>/gi, '');   // 숨김 CSS 줄(만약 있다면 .cvb-add-btn{display:none})은 «노드»가 아니다 — 본문만 본다
    // star note: same reason as L1 -- plain substring match would miss .cvb-grid-add-btn, so the pattern above is /cvb-(?:grid-)?add-btn/
    out.L3 = { got: !!html, markup: /class="[^"]*cvb-(?:grid-)?add-btn/.test(body), cardText: cardOnly(body.slice(body.indexOf('<body'))).split('')[1] };
    // L4 PNG 클론
    const { prepareCloneForCapture } = await import('/js/io/export-image.js');
    let clone = null;
    try { clone = await prepareCloneForCapture(sec, 860, false); } catch (e) { out.L4err = String(e); }
    const cr = clone && (clone.root || clone.clone || clone);
    const cg = cr && cr.querySelector ? cr.querySelector('#' + id) || cr.querySelector('.canvas-block') : null;
    out.L4 = { got: !!cg, markup: !!(cr && cr.querySelector && cr.querySelector('.cvb-add-btn, .cvb-grid-add-btn')), cardText: cg ? cg.textContent : '' };
    try { clone?.remove?.(); } catch (_) {}   // prepareCloneForCapture 는 클론을 body 에 붙인다 — 재고 걷는다
    // L5 피그마 JSON — 제품 길(flushCurrentPage → state.pages canvas → build)
    window.flushCurrentPage?.();
    const fj = JSON.stringify(window.buildFigmaExportJSON(null));
    out.L5 = { markup: /cvb-(?:grid-)?add-btn/.test(fj), plusInJson: /"\+"|\+"/.test(fj) };
    // L6 AI 채우기 읽기면 — ai-section-fill.js 가 canvas-block simple 카드를 dataset.cards 에서 직접 읽는다(DOM 과 다른 길)
    const items = window.collectSectionTextBlocks(sec) || [];
    out.L6 = { n: items.length, plus: items.some(it => /\+/.test(JSON.stringify(it))),
               blockText: g.textContent };
    // L7 MCP get_canvas_state / read_section
    const cs = window.getCanvasState(sec.id);
    const csStr = JSON.stringify(cs);
    out.L7 = { markup: /cvb-(?:grid-)?add-btn/.test(csStr), plus: /\+/.test(csStr) };
    // L8 검색 — 블럭 innerText
    out.L8 = { innerText: g.innerText };
    out.btnsInBlock = g.querySelectorAll('.cvb-add-btn, .cvb-grid-add-btn').length;
    out.btnsDoc = document.querySelectorAll('.cvb-add-btn').length;
    out.gridBtnsDoc = document.querySelectorAll('.cvb-grid-add-btn').length;
    return out;
  }, id);
  const msg = JSON.stringify(r);
  console.log('E65-card', msg);
  expect(r.btnsDoc, `전제 — 빈칸채우기 ＋ 가 재는 내내 떠 있다 ${msg}`).toBe(1);
  expect(r.gridBtnsDoc, `전제 — 성장 ＋ 둘이 재는 내내 떠 있다 ${msg}`).toBe(2);
  expect(r.L1.markup || /\+/.test(r.L1.cardText), `★L1 저장 문자열 ${msg}`).toBe(false);
  expect(r.L2.markup || /\+/.test(r.L2.cardText), `★L2 히스토리 ${msg}`).toBe(false);
  expect(r.L3.got, '전제 — HTML 내보내기가 문자열을 냈다').toBe(true);
  expect(r.L3.markup || /\+/.test(r.L3.cardText), `★L3 HTML 내보내기 ${msg}`).toBe(false);
  expect(r.L4.got, `전제 — PNG 클론에 카드가 있다 ${msg}`).toBe(true);
  expect(r.L4.markup || /\+/.test(r.L4.cardText), `★L4 PNG 클론 ${msg}`).toBe(false);
  expect(r.L5.markup || r.L5.plusInJson, `★L5 피그마 JSON ${msg}`).toBe(false);
  expect(r.L6.plus, `★L6 AI 채우기 읽기면 ${msg}`).toBe(false);
  expect(/\+/.test(r.L6.blockText), `★L6b 선택 중에도 카드 textContent(수집 함수가 읽을 글자)에 '+' 0 ${msg}`).toBe(false);
  expect(r.L7.markup || r.L7.plus, `★L7 MCP get_canvas_state ${msg}`).toBe(false);
  expect(/\+/.test(r.L8.innerText), `★L8 검색(블럭 innerText) ${msg}`).toBe(false);
  expect(errs).toEqual([]);
});
