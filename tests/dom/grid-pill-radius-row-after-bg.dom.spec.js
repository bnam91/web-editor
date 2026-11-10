/* grid-pill-radius-row-after-bg.dom.spec.js — PILL-RADIUS-ROW-NEEDS-RESELECT-AFTER-BG-01 (0.9.12 · 미카사 int-3 실앱)
 *   결함: 그리드 줄에 «알약 배경»을 넣은 직후 「알약 둥글기」 줄이 안 나오고, 줄을 다시 골라야 나왔다.
 *   까닭: 그 줄은 배경이 «있을 때만» 그려지는데(_grdLineSectionHtml) 배경 배선은 포커스를 지키려고 패널을 다시 안 그린다.
 *   고침: 배경을 켜거나 끈 «끝»(색상창 change · hex 확정)에서 줄 유무가 어긋나면 H.show(addr)(↺ 기본과 같은 문)로 그 줄을 다시 보인다.
 *   R1 hex 로 켬 → 둥글기 줄이 생긴다 · 같은 줄(배지·모델 bg) · 기준판 빨강
 *   R2 색상창 — input 동안엔 패널 그대로(같은 노드 · 줄 없음) · change 에서 줄이 생긴다 · 기준판 빨강
 *   R3 hex 비워 끔 → 둥글기 줄이 사라진다 · 기준판 빨강(줄이 남는다)
 *   N1 [대조] 이미 배경 있을 때 색만 바꿈 → 패널 다시 안 그림(hex 칸 같은 노드)
 * ★양성대조: js/props/prop-grid.js 의 end() 안 «PILL-RADIUS…» 세 줄(cur·hasBg·H.show)을 지우면 R1·R2·R3 빨강 · N1 초록.
 * 하네스 = grid-badge-radius.dom.spec.js 의 build 와 같은 꼴(앱 안 띄움).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function build(page, line) {
  await page.evaluate((line) => {
    document.getElementById('canvas').innerHTML =
      `<div class="section-block" id="s" data-section="1">
         <div class="section-hitzone"><span class="section-label">S</span></div>
         <div class="section-inner" id="in" style="padding-left:60px;padding-right:60px"></div></div>`;
    const { row, block } = window.makeGridBlock({});
    document.getElementById('in').appendChild(row);
    block.id = 'G';
    const m = window.getGridModel(block);
    m.cols[0].lines = [line, { type: 'body', text: '둘째 줄' }];
    block.dataset.cols = JSON.stringify(m.cols);
    window.renderGridBlock(block);
    window.showGridProperties?.(block, { r: 0, c: 0, li: 0 });
  }, line);
  await page.waitForSelector('#grd-badge-hex', { state: 'attached' });
}
const read = (page) => page.evaluate(() => {
  const b = document.getElementById('G');
  const l0 = window.getGridModel(b).cols[0].lines[0] || {};
  return { row: !!document.getElementById('grd-badge-radius'), slider: !!document.getElementById('grd-badge-radius-slider'),
           badge: !!b.querySelector('.grd-badge'), bg: l0.bg ? String(l0.bg).toLowerCase() : null, hexVal: document.getElementById('grd-badge-hex')?.value ?? null };
});
const tagHex = (page) => page.evaluate(() => { document.getElementById('grd-badge-hex').__keep = 1; });
const hexKept = (page) => page.evaluate(() => document.getElementById('grd-badge-hex')?.__keep === 1);

test('R1 hex 로 배경을 켜면 «알약 둥글기» 줄이 바로 생긴다(다시 고르지 않고)', async ({ page }) => {
  const errs = await bootApp(page);
  await build(page, { type: 'body', text: '알약' });
  expect(await read(page), '전제 — 배경 없음 = 둥글기 줄 없음').toMatchObject({ row: false, badge: false, bg: null });
  await page.fill('#grd-badge-hex', '2D6FE8');
  await page.press('#grd-badge-hex', 'Enter');
  await expect.poll(() => read(page)).toMatchObject({ badge: true, bg: '#2d6fe8' });
  expect((await read(page)).row, '★배경을 넣었는데 둥글기 줄이 안 나왔다 — 줄을 다시 골라야 나오던 결함').toBe(true);
  expect((await read(page)).slider).toBe(true);
  expect((await read(page)).hexVal, '다시 보인 패널이 같은 줄이다').toBe('2D6FE8');
  expect(errs).toEqual([]);
});

test('R2 색상창 — 고르는 동안엔 패널 그대로 · 닫을 때(change) 둥글기 줄이 생긴다', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'body', text: '알약' });
  await tagHex(page);
  await page.evaluate(() => { const p = document.getElementById('grd-badge-color'); p.value = '#e83a2d'; p.dispatchEvent(new Event('input', { bubbles: true })); });
  const mid = await read(page);
  expect(mid.bg, '전제 — input 이 모델에 썼다').toBe('#e83a2d');
  expect(await hexKept(page), '★고르는 도중 패널을 다시 그렸다 — 열린 색상창·포커스가 끊긴다').toBe(true);
  expect(mid.row, '고르는 도중엔 아직 안 그린다').toBe(false);
  await page.evaluate(() => document.getElementById('grd-badge-color').dispatchEvent(new Event('change', { bubbles: true })));
  await expect.poll(async () => (await read(page)).row, '★색상창을 닫았는데 둥글기 줄이 안 나왔다').toBe(true);
});

test('R3 hex 를 비워 배경을 끄면 둥글기 줄이 사라진다', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'body', text: '알약', bg: '#2d6fe8' });
  expect((await read(page)).row, '전제 — 배경 있음 = 둥글기 줄 있음').toBe(true);
  await page.fill('#grd-badge-hex', '');
  await page.press('#grd-badge-hex', 'Enter');
  await expect.poll(async () => (await read(page)).bg).toBe(null);
  await expect.poll(async () => (await read(page)).row, '★배경을 껐는데 둥글기 줄이 남았다(아무 일도 안 하는 칸)').toBe(false);
});

test('N1 [대조] 이미 배경 있을 때 색만 바꾸면 패널을 다시 안 그린다', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'body', text: '알약', bg: '#2d6fe8' });
  await tagHex(page);
  await page.fill('#grd-badge-hex', 'E83A2D');
  await page.press('#grd-badge-hex', 'Enter');
  await expect.poll(async () => (await read(page)).bg).toBe('#e83a2d');
  expect(await hexKept(page), '★유무가 안 바뀌었는데 패널을 다시 그렸다(포커스가 끊긴다)').toBe(true);
  expect((await read(page)).row).toBe(true);
});
