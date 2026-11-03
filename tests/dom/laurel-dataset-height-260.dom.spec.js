/* laurel-dataset-height-260.dom.spec.js — 시트 260 LAUREL-RENDER-LEAVES-STALE-DATASET-HEIGHT-01 의 자 (imac-gd-L3 · 261031 · JQ-RULER-A3 ⑴)
 * 원문: 「renderLaurelBlock 이 cells 를 쓴 뒤 block.dataset.height 를 안 지워, 한 블럭이 «높이»를 두 자리에 어긋나게 든다」 · 첫 일 ⑵ 「그 둘이 어긋나면 빨강인 단언 하나」.
 * 정본 = cells[i].height (렌더가 읽는 자리 · js/blocks/laurel-block.js _renderLaurelCellHtml). dataset.height 는 옛 단일 데이터 → cells[0] 이주(:73)만 읽는다.
 *   L0 [전제] 그 장면이 선다(화면은 정본 200 을 그린다) — 없으면 L1 의 빨강이 «장면이 안 섬» 과 안 갈린다.
 *   L1 옛 키를 심고 렌더 ⇒ 옛 키가 안 남는다(cells 로 옮긴 뒤 지운다 — prop-laurel.js 의 cells 쓰기와 같은 규약).
 *   L2 옛 저장본(cells 없음) ⇒ 그 높이가 cells 로 옮겨 산다 — 지우기가 값을 잃지 않는다.
 *   H1 사람 길 ⇒ 만들기 → ⌘클릭 → ⌘G → 더블클릭 → ⇧클릭 → 패널 H 칸(옛 키를 안 심는다 · 어긋남을 «새로 쓰는» 그 길).
 *   N  [음성] 옛 키가 없는 평소 장면 ⇒ 어긋남 0. N2 [음성] 같은 패널 W 칸은 원래 높이 키를 안 쓴다.
 *    F1~F5 [현빈 결정 261103] H 칸을 칸이 따른다(겉 상자 = 줄 높이 합 + 행 간격 + 패딩) · ⌘Z 한 걸음 · 줄임 · 여러 행 비율 · 옛 저장본(cells 200 + 겉 333)은 열어도 값이 그대로.
 * ⛔이 자가 안 재는 것: dataset.height 를 읽는 소비자 전수(원문 ⑴ · :73 하나는 읽어 봄 · 블럭 공통 길은 안 셌다) · 저장본·다시 열기 뒤(앱으로 쟀다) · prop-laurel.js:20 이 지우는 패널 길 · 손잡이 끌기(칸을 안 따른다 · 범위 밖).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '<div class="section-block" data-section="1" id="sL"><div class="section-hitzone"></div><div class="section-inner"></div></div>';
async function render(page, legacyHeight, { dropCells = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  return page.evaluate(([sec, legacy, drop]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', sec); window.rebindAll?.(); window.deselectAll?.(); window.selectSection(document.getElementById('sL'));
    window.addLaurelBlock({ gridCols: 1, gridRows: 1, cells: [{ lines: [{ text: 'x' }], leafColor: '#1a1a1a', gap: 24, height: 200 }] });
    const b = [...document.querySelectorAll('#sL .laurel-block')].pop();
    if (legacy !== null) b.dataset.height = legacy; else delete b.dataset.height;
    if (drop) delete b.dataset.cells;
    window.renderLaurelBlock(b);
    const inner = b.querySelector('.laurel-inner');
    return { ds: b.dataset.height ?? null, cells: JSON.parse(b.dataset.cells).map((x) => x.height), minH: inner?.style.minHeight ?? null };
  }, [SEC, legacyHeight, dropCells]);
}
/** 어긋남 = 옛 키가 남아 있고 정본과 다르다 */
const stale = (r) => r.ds !== null && r.cells.some((h) => String(h) !== String(r.ds));

test('L0 [전제] 옛 키 90 + 셀 200 을 심고 렌더 — 정본 cells 200 이 그대로다', async ({ page }) => {
  const r = await render(page, '90');
  expect(r.cells).toEqual([200]);
  expect(r.minH, '[전제] 렌더가 돌았다').not.toBeNull();
});
test('L1 렌더 뒤 dataset.height 가 남아 cells[].height 와 어긋나면 안 된다', async ({ page }) => {
  const r = await render(page, '90');
  expect(stale(r), `높이가 두 자리에 어긋난다 ${JSON.stringify(r)}`).toBe(false);
});
test('L2 옛 저장본(cells 없음) — 옛 높이 90 을 cells 로 옮긴 뒤 지운다(값을 안 잃는다)', async ({ page }) => {
  const r = await render(page, '90', { dropCells: true });
  expect(r.cells).toEqual([90]);
  expect(r.minH).toBe('90px');
  expect(r.ds).toBeNull();
});
test('N [음성] 옛 키가 없는 평소 장면 — 어긋남 0', async ({ page }) => {
  const r = await render(page, null);
  expect(r.ds).toBeNull();
  expect(stale(r)).toBe(false);
});

/** 사람 길 — 자유배치 프레임 안 월계수 둘을 고르고 여러 개 패널을 띄운다(코드로 absolute 를 안 심는다) */
async function panelOnTwoGrouped(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const ids = await page.evaluate((sec) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', sec); window.rebindAll?.();
    const s = document.getElementById('sL');
    const out = ['lA', 'lB'].map((id) => {
      window.selectSection(s);
      window.addLaurelBlock({ gridCols: 1, gridRows: 1, cells: [{ lines: [{ text: 'x' }], leafColor: '#1a1a1a', gap: 24, height: 200 }] });
      const l = [...s.querySelectorAll('.laurel-block')].pop(); l.id = id; return id;
    });
    window.deselectAll?.();
    return out;
  }, SEC);
  const mid = (id) => page.evaluate((i) => { const q = document.getElementById(i).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, id);
  const LAUREL = { sel: '.laurel-block' };
  let [ax, ay] = await mid(ids[0]); let [bx, by] = await mid(ids[1]);
  await clickAt(page, ax, ay, LAUREL);
  await page.keyboard.down('Meta'); await clickAt(page, bx, by, LAUREL); await page.keyboard.up('Meta');
  await page.keyboard.press('Meta+g');
  await page.waitForFunction(() => document.getElementById('lA').parentElement.dataset.freeLayout === 'true');
  [ax, ay] = await mid(ids[0]); [bx, by] = await mid(ids[1]);
  await clickAt(page, ax, ay, LAUREL, { dbl: true });
  await page.keyboard.down('Shift'); await clickAt(page, bx, by, LAUREL); await page.keyboard.up('Shift');
  await page.waitForFunction(() => !!document.getElementById('msp-h'));
  expect(await page.evaluate(() => document.getElementById('lA').style.position), '[전제] 묶기가 자유배치로 띄웠다').toBe('absolute');
  return ids;
}
async function typeInto(page, field, v) {
  const [x, y] = await page.evaluate((f) => { const i = document.getElementById('msp-' + f); const q = i.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, field);
  await clickAt(page, x, y, { sel: '#msp-' + field });
  await page.keyboard.press('Meta+a'); await page.keyboard.type(String(v)); await page.keyboard.press('Enter');
  await page.waitForFunction(([f, val]) => document.getElementById('msp-' + f)?.value === String(val), [field, v]);
}
const readLaurel = (page, ids) => page.evaluate((list) => list.map((id) => {
  const b = document.getElementById(id);
  return { ds: b.dataset.height ?? null, dw: b.dataset.width ?? null, cells: JSON.parse(b.dataset.cells).map((x) => x.height), styleH: b.style.height };
}), ids);

test('H1 사람 길 — 패널 H 칸이 칸과 겉 상자를 함께 바꾸고 옛 키를 안 쓴다', async ({ page }) => {
  const ids = await panelOnTwoGrouped(page);
  await typeInto(page, 'h', 333);
  for (const r of await readLaurel(page, ids)) {
    expect(r.styleH, '[전제] H 칸이 먹었다').toBe('333px');
    expect(r.cells, '칸이 겉 상자를 따른다(333 − 위아래 패딩 16)').toEqual([317]);
    expect(stale(r), `높이가 두 자리에 어긋난다 ${JSON.stringify(r)}`).toBe(false);
  }
});
test('N2 [음성] 같은 패널 W 칸 — 높이 키를 안 쓴다', async ({ page }) => {
  const ids = await panelOnTwoGrouped(page);
  await typeInto(page, 'w', 250);
  for (const r of await readLaurel(page, ids)) {
    expect(r.dw, '[전제] W 칸이 먹었다').toBe('250');
    expect(r.ds).toBeNull();
  }
});
test('N3 [음성] W 칸은 칸 높이를 안 바꾼다', async ({ page }) => {
  const ids = await panelOnTwoGrouped(page);
  await typeInto(page, 'w', 250);
  for (const r of await readLaurel(page, ids)) expect(r.cells).toEqual([200]);
});
const leaf = (page, id) => page.evaluate((i) => {
  const s = document.getElementById(i).querySelector('.laurel-leaf');
  return { h: s.style.height, maxW: s.style.maxWidth };
}, id);
test('F1 잎이 칸 높이 × 170/324 로 함께 큰다', async ({ page }) => {
  const ids = await panelOnTwoGrouped(page);
  await typeInto(page, 'h', 333);
  expect(await leaf(page, ids[0])).toEqual({ h: '317px', maxW: `${Math.round(317 * 170 / 324)}px` });
});
test('F2 줄임 — H 100 ⇒ 칸 84', async ({ page }) => {
  const ids = await panelOnTwoGrouped(page);
  await typeInto(page, 'h', 100);
  for (const r of await readLaurel(page, ids)) { expect(r.cells).toEqual([84]); expect(r.styleH).toBe('100px'); }
});
test('F3 ⌘Z 한 걸음이 칸과 겉 상자를 함께 되돌린다', async ({ page }) => {
  const ids = await panelOnTwoGrouped(page);
  await typeInto(page, 'h', 333);
  expect((await readLaurel(page, ids))[0].cells, '[전제] 칸이 따랐다').toEqual([317]);
  await page.keyboard.press('Meta+z');
  await page.waitForFunction((i) => document.getElementById(i)?.style.height === '', ids[0]);
  for (const r of await readLaurel(page, ids)) expect(r.cells).toEqual([200]);
});
test('F4 여러 행 — 칸끼리 비율을 지켜 합이 겉 상자에 맞는다 · 계약 [20,600] 안', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const r = await page.evaluate((sec) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', sec); window.rebindAll?.(); window.selectSection(document.getElementById('sL'));
    const cell = (height) => ({ lines: [{ text: 'x' }], leafColor: '#1a1a1a', gap: 24, height });
    window.addLaurelBlock({ gridCols: 1, gridRows: 2, cells: [cell(200), cell(100)] });
    const b = [...document.querySelectorAll('#sL .laurel-block')].pop();
    const hs = () => JSON.parse(b.dataset.cells).map((x) => x.height);
    const out = {};
    window.fitLaurelCellsToBoxHeight(b, 333); out.h333 = hs();
    window.fitLaurelCellsToBoxHeight(b, 333); out.again = hs();
    window.fitLaurelCellsToBoxHeight(b, 5000); out.big = hs();
    window.fitLaurelCellsToBoxHeight(b, 5); out.tiny = hs();
    return out;
  }, SEC);
  expect(r.h333).toEqual([195, 98]);   // (333 − 패딩 16 − 행 간격 24) × 2:1
  expect(r.again, '같은 값을 다시 넣어도 안 밀린다').toEqual([195, 98]);
  expect(r.big).toEqual([600, 600]);
  expect(r.tiny).toEqual([20, 20]);
});
test('F5 옛 저장본 — 겉 333 + 칸 200 + 옛 키 333 은 열어도 칸·겉 상자 값이 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const r = await page.evaluate((sec) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', sec); window.rebindAll?.(); window.selectSection(document.getElementById('sL'));
    window.addLaurelBlock({ gridCols: 1, gridRows: 1, cells: [{ lines: [{ text: 'x' }], leafColor: '#1a1a1a', gap: 24, height: 200 }] });
    const b = [...document.querySelectorAll('#sL .laurel-block')].pop();
    b.style.height = '333px'; b.dataset.height = '333';
    window.rebindAll?.();
    return { cells: JSON.parse(b.dataset.cells).map((x) => x.height), style: b.style.height, ds: b.dataset.height ?? null };
  }, SEC);
  expect(r).toEqual({ cells: [200], style: '333px', ds: null });
});
