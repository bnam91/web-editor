/* grid-band-delete.dom.spec.js — GRID-RIGHTCLICK-DELETE-ROW-COL-01 (현빈 0.9.10 QA): 그리드 행/열 «머리띠»(.grd-headband) 기준 지우기.
 *   ⓐ 머리띠 우클릭 → 「행 N 삭제」/「열 X 삭제」 → 그 행/열이 빠진다
 *   ⓑ 머리띠 클릭 → 그 행/열 고름(범위 rect) → Delete·Backspace → 그 행/열이 빠진다
 *   확인창 없음 · ⌘Z 한 번에 dataset 바이트 그대로 복원 · 마지막 한 행/열은 막는다(메뉴 흐림 + Delete 무변).
 *   행 0 을 지우면 다음 행 글자가 첫 행으로 오른다(cols[c].lines 승격) · 저장→다시 열기 뒤에도 유지.
 * ★장면 = 실제 새 섹션처럼 좌우 여백 32px(행 머리띠 밑 = 섹션 안 바탕). 머리띠 밑이 «내용 블럭 이웃»·캔버스 바깥이면 탭은 D1 대로 넘긴다(grid-range-clip D1·R4).
 * ★N1(현빈 7112): 새 섹션 기본 모양(제목 바로 아래 그리드 · 열 띠 밑 = 제목 글 블럭)에서도 띠 탭이 이긴다 — 열 고르기 → ⌫ 삭제.
 *   양성대조: overlay-handles.js _grdBandForwardTap 을 옛 «이웃 넘기기» 판으로 되돌리면 N1 빨강(제목이 골라진다).
 * ★양성대조: overlay-handles.js 의 pick() 을 빼면 ⓑ 빨강 · block-factory.js 의 _targetGridBand 판정을 null 로 두면 ⓐ 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SCENE = {
  cols: [{ width: 1, lines: [{ type: 'body', text: 'A1' }] }, { width: 1, lines: [{ type: 'body', text: 'B1' }] }, { width: 1, lines: [{ type: 'body', text: 'C1' }] }],
  rows: [{ height: 'auto' }, { height: 'auto' }, { height: 'auto' }],
  cells: [[{}, {}, {}],
    [{ lines: [{ type: 'body', text: 'A2' }] }, { lines: [{ type: 'body', text: 'B2' }] }, { lines: [{ type: 'body', text: 'C2' }] }],
    [{ lines: [{ type: 'body', text: 'A3' }] }, { lines: [{ type: 'body', text: 'B3' }] }, { lines: [{ type: 'body', text: 'C3' }] }]],
};
const SEC = `<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;">
<div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24"></div></div>
<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`;

async function setup(page, scene = SCENE) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(([h, sc]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    const g = document.getElementById('gG');
    g.dataset.cols = JSON.stringify(sc.cols);
    if (sc.rows) g.dataset.rows = JSON.stringify(sc.rows);
    if (sc.cells) g.dataset.cells = JSON.stringify(sc.cells);
    window.rebindAll?.(); window.deselectAll?.(); window.renderGridBlock?.(g);
    g.scrollIntoView({ block: 'center' });
    window.clearHistory?.();
  }, [SEC, scene]);
  await waitStableRect(page, '#gG');
  const c = await waitStableRect(page, '#gG .grd-cell[data-r="0"][data-c="0"]');
  await clickAt(page, c.cx, c.cy, { sel: 'div#gG' }, { label: '그리드 고르기' });
  await page.waitForFunction(() => document.getElementById('gG').classList.contains('selected'));
  await page.waitForSelector('#ss-handles-overlay > .grd-headband');
  return errs;
}
const BAND = (axis, i) => `#ss-handles-overlay > .grd-headband[data-axis="${axis}"][data-i="${i}"]`;
const grid = (page) => page.evaluate(() => {
  const g = document.getElementById('gG'); const m = window.getGridModel(g);
  return { R: m.rows.length, C: m.cols.length, text: m.cells.map(r => r.map(c => (c.lines || []).map(l => l.text).join('')).join(',')),
    raw: JSON.stringify({ cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null }) };
});
async function tapBand(page, axis, i) {
  const b = await waitStableRect(page, BAND(axis, i));
  await page.mouse.click(b.cx, b.cy);
}
async function rightBand(page, axis, i) {
  const b = await waitStableRect(page, BAND(axis, i));
  await page.mouse.click(b.cx, b.cy, { button: 'right' });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('bcm-grid-band-del')).display !== 'none', null, { timeout: 3000 });
}

test('ⓑ 열 머리띠 클릭 → Delete → 그 열 빠짐 · ⌘Z 한 번 복원 · 확인창 없음', async ({ page }) => {
  await setup(page);
  let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
  const before = await grid(page);
  await tapBand(page, 'col', 1);
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG')))).toEqual({ r0: 0, c0: 1, r1: 2, c1: 1, axis: 'col' });
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await grid(page)).text).toEqual(['A1,C1', 'A2,C2', 'A3,C3']);
  expect(await page.evaluate(() => document.querySelectorAll('#gG').length), '블럭 자체는 남는다').toBe(1);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await grid(page)).raw).toBe(before.raw);
  expect(dialogs).toBe(0);
});

test('ⓑ 행 0 머리띠 클릭 → Backspace → 다음 행 글자가 첫 행으로 · 저장→다시 열기 유지', async ({ page }) => {
  await setup(page);
  await tapBand(page, 'row', 0);
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG'))?.axis)).toBe('row');
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await grid(page)).text).toEqual(['A2,B2,C2', 'A3,B3,C3']);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  await expect.poll(async () => (await grid(page)).text).toEqual(['A2,B2,C2', 'A3,B3,C3']);
});

test('ⓐ 행 머리띠 우클릭 → 「행 3 삭제」 → 그 행 빠짐 · ⌘Z 한 번 복원', async ({ page }) => {
  await setup(page);
  const before = await grid(page);
  await rightBand(page, 'row', 2);
  await expect(page.locator('#bcm-grid-band-del-label')).toHaveText('행 3 삭제');
  await page.click('#bcm-grid-band-del');
  await expect.poll(async () => (await grid(page)).text).toEqual(['A1,B1,C1', 'A2,B2,C2']);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await grid(page)).raw).toBe(before.raw);
});

test('ⓐ 열 머리띠 우클릭 → 「열 A 삭제」 · 칸 우클릭엔 그 항목이 안 보인다', async ({ page }) => {
  await setup(page);
  await rightBand(page, 'col', 0);
  await expect(page.locator('#bcm-grid-band-del-label')).toHaveText('열 A 삭제');
  await page.click('#bcm-grid-band-del');
  await expect.poll(async () => (await grid(page)).text).toEqual(['B1,C1', 'B2,C2', 'B3,C3']);
  const c = await waitStableRect(page, '#gG .grd-cell[data-r="1"][data-c="0"]');
  await page.mouse.click(c.cx, c.cy, { button: 'right' });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('block-context-menu') || document.body).display)).not.toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('bcm-grid-band-del')).display)).toBe('none');
});

test('마지막 한 열 — 메뉴 흐림·눌러도 무변 · Delete 도 무변', async ({ page }) => {
  await setup(page, { cols: [{ width: 1, lines: [{ type: 'body', text: 'A1' }] }], rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [[{}], [{ lines: [{ type: 'body', text: 'A2' }] }]] });
  const before = await grid(page);
  await rightBand(page, 'col', 0);
  expect(await page.getAttribute('#bcm-grid-band-del', 'aria-disabled')).toBe('true');
  await page.click('#bcm-grid-band-del');
  await tapBand(page, 'col', 0);
  await page.keyboard.press('Delete');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));   // 지우기가 돌았으면 이 틱 안에 끝났다(동기 · 고정 대기 대신)
  expect((await grid(page)).raw, '마지막 열은 안 지워진다').toBe(before.raw);
  expect(await page.evaluate(() => !!document.getElementById('gG')), '블럭도 안 지워진다').toBe(true);
  // 행 하나는 지울 수 있다(2행 → 1행)
  await tapBand(page, 'row', 1);
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await grid(page)).R).toBe(1);
});

test('N1 새 섹션 기본 모양 — 제목 바로 아래 그리드에서 열 띠 클릭 → 열 선택 → ⌫ 삭제(제목이 안 골라진다)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await expect.poll(() => page.evaluate(() => !!window.getSelectedSection?.())).toBe(true);
  await page.evaluate(() => window.addGridBlock());
  const id = await page.evaluate(() => document.querySelector('#canvas .grid-block').id);
  const C0 = await page.evaluate((id) => window.getGridModel(document.getElementById(id)).cols.length, id);
  expect(C0, '[전제] 기본 그리드 2열 이상').toBeGreaterThanOrEqual(2);
  const g = await waitStableRect(page, `[id="${id}"]`);
  await page.mouse.click(g.cx, g.cy);
  await page.waitForSelector(BAND('col', 1));
  const b = await waitStableRect(page, BAND('col', 1));
  const under = await page.evaluate(([x, y]) => { const ovl = document.getElementById('ss-handles-overlay');
    const u = document.elementsFromPoint(x, y).find(el => !ovl.contains(el)); return u ? (u.closest('.text-block,[class*="tb-"]') ? 'text' : (u.id || u.className)) : null; }, [b.cx, b.cy]);
  expect(under, '[전제] 열 띠 밑 = 그리드 위 제목 글 블럭(새 섹션 기본 모양)').toBe('text');
  await page.mouse.click(b.cx, b.cy);
  await expect.poll(() => page.evaluate((id) => window.grdGetRange(document.getElementById(id))?.axis, id), '열이 골라졌다').toBe('col');
  expect(await page.evaluate(() => [...document.querySelectorAll('#canvas .text-block.selected')].length), '제목은 안 골라진다').toBe(0);
  await page.keyboard.press('Backspace');
  await expect.poll(() => page.evaluate((id) => window.getGridModel(document.getElementById(id)).cols.length, id)).toBe(C0 - 1);
});
