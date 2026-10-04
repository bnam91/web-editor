/* grid-plus-g15-leak.dom.spec.js — E65: ＋ 가 «떠 있는 동안»(그리드 호버) 제품의 읽기·내보내기 길로 새는가
 *
 * ★까닭(integ7 전수 2026-10-04): ＋ 가 블럭 «안»의 <button>+</button> 이라, 호버 중엔 블럭 textContent 에 '+' 가 끼었다
 *   (grid-children-delete 의 서명이 「자식둘++」). ⛔시험에서 호버를 피해 가리는 것으로 덮지 않는다 — 제품 길을 잰다.
 * 재는 길(모두 «＋ 가 떠 있는 채로» — 전제 단언):
 *   L1 저장 문자열(serializeProject)           L2 히스토리 스냅숏(getSerializedCanvas)
 *   L3 HTML 내보내기(진짜 exportHTMLFile, Blob 가로채기 — export-deliverable-leak 수법)
 *   L4 PNG 클론(prepareCloneForCapture)        L5 피그마 JSON(flushCurrentPage → buildFigmaExportJSON)
 *   L6 AI 채우기 읽기면(collectSectionTextBlocks)
 *   L7 MCP get_canvas_state·read_section(렌더러 getCanvasState — read_section 은 같은 길: mcp-server.js read_section)
 *   L8 검색(search_sections 는 블럭 innerText 를 읽는다 — main.js _invokeRendererSearchSections «code-read» ⇒ 블럭 innerText 를 잰다)
 * 새는 표지: 'grd-add-btn' 문자열 · 그리드 글(AAA·BBB)에 없는 '+' 글자.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sL" data-section="1" data-name="sL"><div class="section-hitzone"></div><div class="section-inner" id="innerL">
  <div class="gap-block" data-type="gap" style="height:80px"></div><div id="slot"></div>
  <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    const { row, block } = window.makeGridBlock({});
    document.getElementById('slot').replaceWith(row); window.bindBlock(block); window.rebindAll?.();
    window.updateGridBlock(block.id, { cols: [{ width: 1, lines: [{ type: 'body', text: 'AAA' }] }, { width: 1, lines: [{ type: 'body', text: 'BBB' }] }] });
    block.scrollIntoView({ block: 'center' });
    return block.id;
  }, SEC);
  await page.waitForTimeout(200);
  const [x, y] = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * 0.25, r.top + r.height / 2]; }, id);
  await page.mouse.move(x, y, { steps: 4 }); await page.waitForTimeout(120);
  expect(await page.evaluate(() => document.querySelectorAll('.grd-add-btn').length), '전제 — 호버로 ＋ 가 떠 있다(문서 어딘가에 둘)').toBe(2);
  return { errs, id };
}

const leak = (s) => ({ markup: /grd-add-btn/.test(s || ''), plus: /\+/.test(s || '') });

test('L1~L8 ★＋ 가 떠 있는 동안 제품의 읽기·내보내기 길 어디에도 ＋ 가 없다', async ({ page }) => {
  test.setTimeout(120000);
  const { errs, id } = await setup(page);
  const r = await page.evaluate(async (id) => {
    const g = document.getElementById(id), sec = g.closest('.section-block');
    const gridOnly = (html) => { const d = document.createElement('div'); d.innerHTML = html; const x = d.querySelector('#' + id); return x ? x.outerHTML + '\u0001' + x.textContent : '(그리드 없음)'; };
    const out = {};
    // L1 저장 문자열
    const proj = window.serializeProject();
    out.L1 = { markup: /grd-add-btn/.test(proj), gridText: (() => { const p = JSON.parse(proj); return gridOnly(p.pages[0].canvas).split('\u0001')[1]; })() };
    // L2 히스토리
    out.L2 = { markup: /grd-add-btn/.test(window.getSerializedCanvas()), gridText: gridOnly(window.getSerializedCanvas()).split('\u0001')[1] };
    // L3 HTML 내보내기(진짜 exportHTMLFile, 내려받기 대신 Blob 가로채기)
    let blob = null;
    const oC = URL.createObjectURL, oR = URL.revokeObjectURL, oClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b) => { blob = b; return 'blob:__stub__'; }; URL.revokeObjectURL = () => {}; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oC; URL.revokeObjectURL = oR; HTMLAnchorElement.prototype.click = oClick; }
    const html = blob ? await blob.text() : '';
    const body = html.replace(/<style[\s\S]*?<\/style>/gi, '');   // 숨김 CSS 줄(.grd-add-btn{display:none})은 «노드»가 아니다 — 본문만 본다
    out.L3 = { got: !!html, markup: /class="[^"]*grd-add-btn/.test(body), gridText: gridOnly(body.slice(body.indexOf('<body'))).split('\u0001')[1] };
    // L4 PNG 클론
    const { prepareCloneForCapture } = await import('/js/io/export-image.js');
    let clone = null;
    try { clone = await prepareCloneForCapture(sec, 860, false); } catch (e) { out.L4err = String(e); }
    const cr = clone && (clone.root || clone.clone || clone);
    const cg = cr && cr.querySelector ? cr.querySelector('#' + id) || cr.querySelector('.grid-block') : null;
    out.L4 = { got: !!cg, markup: !!(cr && cr.querySelector && cr.querySelector('.grd-add-btn')), gridText: cg ? cg.textContent : '' };
    try { clone?.remove?.(); } catch (_) {}   // prepareCloneForCapture 는 클론을 body 에 붙인다(export-image.js) — 재고 걷는다
    // L5 피그마 JSON — 제품 길(flushCurrentPage → state.pages canvas → build)
    window.flushCurrentPage?.();
    const fj = JSON.stringify(window.buildFigmaExportJSON(null));
    out.L5 = { markup: /grd-add-btn/.test(fj), plusInJson: /"\+"|\+"/.test(fj) };
    // L6 AI 채우기 읽기면
    const items = window.collectSectionTextBlocks(sec) || [];
    out.L6 = { n: items.length, plus: items.some(it => /\+/.test(JSON.stringify(it))) };
    // L7 MCP get_canvas_state / read_section
    const cs = window.getCanvasState(sec.id);
    const csStr = JSON.stringify(cs);
    out.L7 = { markup: /grd-add-btn/.test(csStr), plus: /\+/.test(csStr) };
    // L8 검색 — 블럭 innerText
    out.L8 = { innerText: g.innerText };
    out.btnsInBlock = g.querySelectorAll('.grd-add-btn').length;
    out.btnsDoc = document.querySelectorAll('.grd-add-btn').length;
    return out;
  }, id);
  const msg = JSON.stringify(r);
  console.log('E65', msg);
  expect(r.btnsDoc, `전제 — 재는 내내 ＋ 가 떠 있다 ${msg}`).toBe(2);
  expect(r.L1.markup || /\+/.test(r.L1.gridText), `★L1 저장 문자열 ${msg}`).toBe(false);
  expect(r.L2.markup || /\+/.test(r.L2.gridText), `★L2 히스토리 ${msg}`).toBe(false);
  expect(r.L3.got, '전제 — HTML 내보내기가 문자열을 냈다').toBe(true);
  expect(r.L3.markup || /\+/.test(r.L3.gridText), `★L3 HTML 내보내기 ${msg}`).toBe(false);
  expect(r.L4.got, `전제 — PNG 클론에 그리드가 있다 ${msg}`).toBe(true);
  expect(r.L4.markup || /\+/.test(r.L4.gridText), `★L4 PNG 클론 ${msg}`).toBe(false);
  expect(r.L5.markup || r.L5.plusInJson, `★L5 피그마 JSON ${msg}`).toBe(false);
  expect(r.L6.plus, `★L6 AI 채우기 읽기면 ${msg}`).toBe(false);
  expect(r.L7.markup || r.L7.plus, `★L7 MCP get_canvas_state ${msg}`).toBe(false);
  expect(/\+/.test(r.L8.innerText), `★L8 검색(블럭 innerText) ${msg}`).toBe(false);
  expect(errs).toEqual([]);
});
