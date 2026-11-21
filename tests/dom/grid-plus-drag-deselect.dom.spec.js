/* grid-plus-drag-deselect.dom.spec.js — GRID-PLUS-DRAG-DESELECT-01 (2026-11-21 · 제니)
 *
 * ★병 — 그리드 ＋ 를 누른 채 살짝 끌어 다른 곳(글줄 등)에서 놓으면 선택이 풀렸다.
 *   실측(태양 · 이 spec D1 이 다시 잰다): mouseup 임자 .grd-line · click 임자 #canvas-scaler(누른 곳·놓은 곳 공통 조상)
 *   → js/editor.js «캔버스 빈 곳 클릭» 갈래가 deselectAll.
 * ★고침(공용 한 자리) — 그 갈래가 «누른 곳도 빈 곳이었나»를 본다(capture mousedown 기록).
 * ★같은 병 훑기(2026-11-21 프로브) — #canvas-scaler 층 단추: 그리드 ＋(열·행) · 캔버스블럭 ＋ = 병 있음 → D1~D3.
 *   덮개 손잡이(.ss-resize/.ss-radius/.ss-rotate/.asset-overlay/.asset-radius)·섹션 아래 손잡이 = 병 없음
 *   (손잡이 층이 #canvas-wrap 밖이라 click 이 빈 곳 갈래에 안 닿는다).
 * 지킴: N1 빈 곳 클릭 해제 · N2 섹션 고르기 · N3 프로그램 click(누른 기록 없음) = 옛 동작.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/grid-plus-drag-deselect.dom.spec.js */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const OUT = process.env.DRAGDESELECT_PNG_DIR || path.join(os.homedir(), 'gd-team-261121', 'jn-dragdeselect-png');
const SEC = `<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
  <div class="gap-block" data-type="gap" style="height:80px"></div><div id="slotA"></div>
  <div class="gap-block" data-type="gap" style="height:120px"></div><div id="slotT"></div>
  <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  const g = await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    const { row, block } = window.makeGridBlock({}); document.getElementById('slotA').replaceWith(row); window.bindBlock(block);
    const { block: tb } = window.makeTextBlock('h2'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h2'); tf.appendChild(tb); tb.id = 'pT'; tf.id = 'pTF';
    tb.querySelector('[class^="tb-"]').textContent = '글자 블럭';
    const r2 = document.createElement('div'); r2.className = 'row'; r2.dataset.layout = 'stack'; r2.appendChild(tf); document.getElementById('slotT').replaceWith(r2);
    window.rebindAll?.(); window.deselectAll?.();
    document.getElementById(block.id).scrollIntoView({ block: 'center' });
    return block.id;
  }, SEC);
  return { errs, g };
}
const isSel = (page, id) => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id);
async function pickBlock(page, sel, id) {
  const r = await waitStableRect(page, sel);
  await page.mouse.click(r.left + r.width * 0.25, r.top + r.height / 2);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id, { timeout: 3000 });
}
const center = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
/** 진짜 마우스 — from 에서 누르고 to 로 끌어 놓는다. 누른 곳 임자 · click 임자를 같이 돌려준다. */
async function pressDragRelease(page, fromSel, toSel) {
  await page.waitForFunction((s) => !!document.querySelector(s), fromSel, { timeout: 3000 });
  const f = await center(page, fromSel), t = await center(page, toSel);
  const down = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? String(e.className || e.id) : null; }, [f.x, f.y]);
  await page.evaluate(() => { window.__clk = null; document.addEventListener('click', (e) => { window.__clk = e.target.id || String(e.target.className); }, { capture: true, once: true }); });
  await page.mouse.move(f.x, f.y); await page.mouse.down();
  await page.mouse.move((f.x + t.x) / 2, (f.y + t.y) / 2, { steps: 3 }); await page.mouse.move(t.x, t.y, { steps: 3 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__clk !== null, null, { timeout: 3000 });
  return { down, click: await page.evaluate(() => window.__clk) };
}
const plusSel = (g, axis) => `#grd-plus-layer > .grd-add-btn[data-grd-for="${g}"][data-grd-add="${axis}"]`;
const cols = (page, g) => page.evaluate((id) => document.getElementById(id).dataset.cols, g);

test('D1 ★그리드 ＋(열)을 눌러 글줄에서 놓아도 — 그리드 선택 유지 · 열 수 그대로(＋ 가 눌린 게 아니다)', async ({ page }) => {
  const { errs, g } = await setup(page);
  await pickBlock(page, `#${g} > .grd-inner`, g);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, 'before-drag.png') });
  const c0 = await cols(page, g);
  const ev = await pressDragRelease(page, plusSel(g, 'col'), `#${g} .grd-line`);
  expect(ev.down, '전제 — 누른 곳 = ＋').toContain('grd-add-btn');
  expect(ev.click, '전제(태양 실측) — click 임자 = 공통 조상 scaler').toBe('canvas-scaler');
  expect(await isSel(page, g), '★선택 유지').toBe(true);
  expect(await cols(page, g), '열 수 그대로').toBe(c0);
  await page.screenshot({ path: path.join(OUT, 'after-drag.png') });
  expect(errs).toEqual([]);
});

test('D2 ★그리드 ＋(행)을 눌러 글자 블럭에서 놓아도 — 그리드 선택 유지', async ({ page }) => {
  const { errs, g } = await setup(page);
  await pickBlock(page, `#${g} > .grd-inner`, g);
  const ev = await pressDragRelease(page, plusSel(g, 'row'), '#pT [class^="tb-"]');
  expect(ev.click).toBe('canvas-scaler');
  expect(await isSel(page, g), '★선택 유지').toBe(true);
  expect(errs).toEqual([]);
});

test('D3 ★같은 병 — 캔버스블럭 ＋ 를 눌러 글자 블럭에서 놓아도 선택 유지', async ({ page }) => {
  const { errs } = await setup(page);
  const id = await page.evaluate(() => { window.selectSection(document.getElementById('sG')); window.addCanvasBlock(); const b = [...document.querySelectorAll('#sG .canvas-block')].pop(); window.deselectAll(); b.scrollIntoView({ block: 'center' }); return b.id; });
  await pickBlock(page, `#${id}`, id);
  const ev = await pressDragRelease(page, '.cvb-grid-add-btn', '#pT [class^="tb-"]');
  expect(ev.down).toContain('cvb-grid-add-btn');
  expect(ev.click).toBe('canvas-scaler');
  expect(await isSel(page, id), '★선택 유지').toBe(true);
  expect(errs).toEqual([]);
});

test('D4 지킴 — ＋ 를 «그냥 클릭»하면 열이 하나 는다(누른 곳 = 놓은 곳 · 해제 갈래와 무관)', async ({ page }) => {
  const { errs, g } = await setup(page);
  await pickBlock(page, `#${g} > .grd-inner`, g);
  const c0 = Number(await cols(page, g));
  const p = await center(page, plusSel(g, 'col'));
  await page.mouse.click(p.x, p.y);
  await expect.poll(async () => Number(await cols(page, g))).toBe(c0 + 1);
  expect(errs).toEqual([]);
});

test('N1 지킴 — 캔버스 빈 곳을 누르고 놓으면(진짜 마우스) 선택이 풀린다', async ({ page }) => {
  const { errs, g } = await setup(page);
  await pickBlock(page, `#${g} > .grd-inner`, g);
  const pt = await page.evaluate(() => { const r = document.getElementById('sG').getBoundingClientRect(); return { x: r.right + 60, y: r.top + 40 }; });
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [pt.x, pt.y]), '전제 — 빈 곳').toMatch(/^canvas(-wrap|-scaler)?$/);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('selected'), g, { timeout: 3000 });
  expect(errs).toEqual([]);
});

test('N2 지킴 — 빈 곳에서 눌러 빈 곳에서 놓으면(끌기) 역시 풀린다', async ({ page }) => {
  const { errs, g } = await setup(page);
  await pickBlock(page, `#${g} > .grd-inner`, g);
  const pt = await page.evaluate(() => { const r = document.getElementById('sG').getBoundingClientRect(); return { x: r.right + 60, y: r.top + 40 }; });
  await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.mouse.move(pt.x + 4, pt.y + 4, { steps: 2 }); await page.mouse.up();
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('selected'), g, { timeout: 3000 });
  expect(errs).toEqual([]);
});

test('N3 지킴 — 프로그램 click(누른 기록 없음)은 옛 동작 그대로 해제 · 섹션 히트존 클릭은 섹션 고르기', async ({ page }) => {
  const { errs, g } = await setup(page);
  await pickBlock(page, `#${g} > .grd-inner`, g);
  await page.evaluate(() => document.getElementById('canvas-scaler').click());
  expect(await isSel(page, g), '프로그램 click → 해제').toBe(false);
  await page.evaluate(() => document.getElementById('sG').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(await page.evaluate(() => window.getSelectedSection?.()?.id || document.querySelector('.section-block.selected')?.id), '섹션 고르기').toBe('sG');
  expect(errs).toEqual([]);
});
