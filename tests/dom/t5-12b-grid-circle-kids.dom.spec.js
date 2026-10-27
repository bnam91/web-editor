/* t5-12b-grid-circle-kids.dom.spec.js — t5-12ⓑ ㉮ 「원형이미지에 글자는 어떻게 추가 삽입하는지? 현재는 우측패널에서만 한줄만 가능한데 블럭추가가 필요함」
 *
 * ★잰 값(S3 · 8608bb13 소스): 그리드 원 줄 패널에 「＋ 블럭 넣기」 0 · 원 안 블럭 그릇 0 — 글자는 패널 한 칸(cText)뿐.
 * ★처방(지디 ㉮ GO) — 원 줄에 «변하지 않는 이름» line.id(처음 얹을 때 매김) · 그릇 .grd-circle-kids 가 그 이름으로 다시 그리기 뒤 제 원에 붙는다.
 *   담는 몫 = block-factory _addCircleKid 한 벌(G14 addCircleChild 와 공용).
 *
 * ★칸
 *   P  전제 — 그리드 0행 0열 원 줄 · 사람 길로 그 줄을 골랐다 · 패널에 「＋ 블럭 넣기 (원 위)」
 *   K1 「텍스트」 ⇒ 원 위 그릇에 블럭 1 · 줄 모델에 id 생김
 *   K2 「제목」 하나 더 ⇒ 2 · 첫 블럭에 두 줄(Enter) 글
 *   K3 ⑴★ 다시 그리기 두 번 ⇒ id 그대로 · 블럭 둘 그대로 제 원 위
 *   K4 ⑶ 행 옮기기(0→1) ⇒ 그릇이 원을 따라간다 · 행 수 줄이기(원 행 지움) ⇒ 그릇·블럭 같이 사라진다 · 줄 지우기도 같다(따로 판)
 *   K5 ⑷ 저장→다시 열기(getSerializedCanvas → innerHTML → rebindAll) ⇒ id·블럭 둘 그대로
 *   K6 원 위 글 블럭 하나 지우기(Delete) ⇒ 그 블럭만 · 그리드는 남는다
 *   K0 (지키는 칸) 블럭을 안 얹은 원은 data-line-id 가 없다(옛 렌더 그대로)
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page, rows = 1) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((rows) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({
      cols: [{ width: 1, lines: [{ type: 'image', imgSrc: '', imgShape: 'circle', height: 360 }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
      rows: Array.from({ length: rows }, () => ({ height: 'auto' })),
    });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  }, rows);
  const sel = '#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-circle';
  const r = await waitStableRect(page, sel);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => document.getElementById('gG')?.classList.contains('selected'), null, { timeout: 3000 });
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => !!document.getElementById('grd-circle-kid-add'), null, { timeout: 3000 });
  return { errs };
}
const S = (page) => page.evaluate(() => {
  const g = document.getElementById('gG');
  const m = window.getGridModel(g);
  const ids = []; m.cells.forEach((row, r) => row.forEach((cell, c) => (cell.lines || []).forEach((l, li) => { if (l.id) ids.push(`${r},${c},${li}:${l.id}`); })));
  const boxes = [...g.querySelectorAll('.grd-circle-kids')].map((b) => ({ lid: b.dataset.lineId, host: b.parentElement?.dataset.lineId || null, r: b.closest('.grd-cell')?.dataset.r ?? null, n: b.childElementCount }));
  return { ids, boxes, kidsText: [...g.querySelectorAll('.grd-circle-kids .text-block')].map((t) => t.innerText.trim()) };
});
const selLine = async (page) => {
  for (let k = 0; k < 3; k++) {
    if (await page.evaluate(() => !!document.getElementById('grd-circle-kid-add'))) return;
    await page.evaluate(() => window.deselectAll?.());
    const r = await waitStableRect(page, '#gG .grd-img-circle');
    await page.mouse.click(r.left + 6, r.cy);
    await page.waitForFunction(() => document.getElementById('gG')?.classList.contains('selected'), null, { timeout: 3000 });
    await page.mouse.click(r.left + 6, r.cy);
    await page.waitForFunction(() => !!document.getElementById('grd-circle-kid-add'), null, { timeout: 3000 }).catch(() => {});
  }
  expect(await page.evaluate(() => !!document.getElementById('grd-circle-kid-add')), '전제: 원 줄 패널').toBe(true);
};
const addKid = async (page, kind) => {
  await selLine(page);
  const before = (await S(page)).boxes.reduce((a, b) => a + b.n, 0);
  await page.selectOption('#grd-circle-kid-add', kind);
  await page.waitForFunction((n) => [...document.querySelectorAll('#gG .grd-circle-kids')].reduce((a, b) => a + b.childElementCount, 0) > n, before, { timeout: 3000 });
};

test('P·K0·K1·K2 ★원 위에 블럭 둘 · 여러 줄', async ({ page }) => {
  const { errs } = await setup(page);
  expect(await page.evaluate(() => document.querySelectorAll('#gG [data-line-id]').length), 'K0 얹기 전 이름 0').toBe(0);
  await addKid(page, 'body');
  const s1 = await S(page);
  expect(s1.ids.length, 'K1 줄 모델 id 하나').toBe(1);
  expect(s1.boxes, 'K1 그릇 하나 · 제 원 위 · 블럭 1').toEqual([{ lid: s1.ids[0].split(':')[1], host: s1.ids[0].split(':')[1], r: '0', n: 1 }]);
  await addKid(page, 'h2');
  const s2 = await S(page);
  expect(s2.boxes[0].n, 'K2 블럭 2').toBe(2);
  /* 첫 블럭 글 두 줄 — 더블클릭 → 전체 고르고 입력 → Enter → 입력 → Esc */
  /* 누를 자리 = 첫 블럭 ∩ 원(원이 넘친 몫을 잘라 그 밖은 섹션이 받는다) */
  const t = await page.evaluate(() => { const k = document.querySelector('#gG .grd-circle-kids .text-block').getBoundingClientRect(); const c = document.querySelector('#gG .grd-img-circle').getBoundingClientRect();
    const l = Math.max(k.left, c.left), r = Math.min(k.right, c.right), tp = Math.max(k.top, c.top), b = Math.min(k.bottom, c.bottom); return { cx: (l + r) / 2, cy: (tp + b) / 2 }; });
  await page.mouse.click(t.cx, t.cy);   /* 사람처럼 — 먼저 골라 두고 */
  await page.waitForFunction(() => !!document.querySelector('#gG .grd-circle-kids .text-block.selected'), null, { timeout: 3000 });
  await page.mouse.dblclick(t.cx, t.cy);
  await page.waitForFunction(() => !!document.querySelector('#gG .grd-circle-kids [contenteditable="true"]'), null, { timeout: 3000 });
  await page.keyboard.press('Meta+a'); await page.keyboard.type('첫째'); await page.keyboard.press('Enter'); await page.keyboard.type('둘째'); await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#gG .grd-circle-kids [contenteditable="true"]'), null, { timeout: 3000 }).catch(() => {});
  const s3 = await S(page);
  expect(s3.kidsText[0].split('\n').filter(Boolean), 'K2 두 줄').toEqual(['첫째', '둘째']);
  expect(errs).toEqual([]);
});

test('K3 ⑴★ 다시 그리기 두 번 — id 그대로 · 블럭 그대로', async ({ page }) => {
  const { errs } = await setup(page);
  await addKid(page, 'body');
  const s0 = await S(page);
  await page.evaluate(() => { const g = document.getElementById('gG'); window.renderGridBlock(g); window.renderGridBlock(g); });
  const s1 = await S(page);
  expect(s1.ids, 'K3 id').toEqual(s0.ids);
  expect(s1.boxes, 'K3 그릇').toEqual(s0.boxes);
  expect(errs).toEqual([]);
});

test('K4 ⑶ 행 옮기기 ⇒ 따라감 · 행 줄이기 ⇒ 같이 사라짐', async ({ page }) => {
  const { errs } = await setup(page, 2);
  await addKid(page, 'body');
  const s0 = await S(page);
  expect(s0.boxes.map((b) => b.r), '전제: 0행').toEqual(['0']);
  await page.evaluate(() => window.moveGridRow(document.getElementById('gG'), 0, 1));
  const s1 = await S(page);
  expect(s1.boxes.map((b) => [b.r, b.host === b.lid, b.n]), 'K4 옮긴 뒤 1행 · 제 원 · 블럭 1').toEqual([['1', true, 1]]);
  expect(s1.ids.map((x) => x.split(':')[1]), 'K4 id 그대로').toEqual(s0.ids.map((x) => x.split(':')[1]));
  /* 원이 있는 행(이제 1행)을 줄여 없앤다 */
  /* 사람 길 — 그리드를 다시 골라(블럭 패널) 피커에서 2×1 */
  await page.evaluate(() => window.deselectAll?.());
  const gr = await waitStableRect(page, '#gG .grd-cell[data-r="0"][data-c="1"]');
  await page.mouse.click(gr.cx, gr.cy);
  await page.waitForFunction(() => !!document.querySelector('#grd-grid-picker .grid-picker-cell'), null, { timeout: 3000 });
  /* 칸 수 절은 기본 접힘 — 펼친다(사람 길) */
  if (await page.evaluate(() => (document.querySelector('#grd-grid-picker .grid-picker-cell')?.getBoundingClientRect().width || 0) === 0)) {
    await page.click('#grd-size-toggle');
    await page.waitForFunction(() => (document.querySelector('#grd-grid-picker .grid-picker-cell')?.getBoundingClientRect().width || 0) > 0, null, { timeout: 3000 });
  }
  const pc = await waitStableRect(page, '#grd-grid-picker .grid-picker-cell[data-r="1"][data-c="2"]');   /* 피커는 1부터 — 2열 × 1행 */
  await page.mouse.click(pc.cx, pc.cy);
  await page.waitForFunction(() => window.getGridModel(document.getElementById('gG')).cells.length === 1, null, { timeout: 3000 });
  const s2 = await S(page);
  expect(s2.boxes, 'K4 행 줄인 뒤 그릇 0').toEqual([]);
  expect(await page.evaluate(() => document.querySelectorAll('#gG .text-block').length), 'K4 남은 블럭 0').toBe(0);
  expect(errs).toEqual([]);
});

test('K5 ⑷ 저장→다시 열기 — id·블럭 그대로', async ({ page }) => {
  const { errs } = await setup(page);
  await addKid(page, 'body');
  await addKid(page, 'h2');
  const s0 = await S(page);
  await page.evaluate(() => { const h = window.getSerializedCanvas(); document.getElementById('canvas').innerHTML = h; window.rebindAll?.(); window.renderGridBlock(document.getElementById('gG')); });
  await page.waitForFunction(() => !!document.querySelector('#gG .grd-img-circle'), null, { timeout: 3000 });
  const s1 = await S(page);
  expect(s1.ids, 'K5 id').toEqual(s0.ids);
  expect(s1.boxes, 'K5 그릇').toEqual(s0.boxes);
  expect(errs).toEqual([]);
});

test('K6 원 위 글 블럭 지우기 ⇒ 그 블럭만 · 그리드 남음', async ({ page }) => {
  const { errs } = await setup(page);
  await addKid(page, 'body');
  const t = await waitStableRect(page, '#gG .grd-circle-kids .text-block');
  await page.mouse.click(t.cx, t.cy);
  await page.waitForFunction(() => !!document.querySelector('#gG .grd-circle-kids .text-block.selected'), null, { timeout: 3000 });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => !document.querySelector('#gG .grd-circle-kids .text-block'), null, { timeout: 3000 });
  expect(await page.evaluate(() => !!document.getElementById('gG')), 'K6 그리드 남음').toBe(true);
  expect(errs).toEqual([]);
});
