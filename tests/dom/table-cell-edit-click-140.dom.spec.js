/* table-cell-edit-click-140.dom.spec.js — ★140 TABLE-TH-PLAIN-CLICK-DIFFERS-FROM-16-01 (제목이 좁다: TH 만이 아니라 표 칸 전체 · TH·TD 한 핸들러)
 * 고침: 표의 «클릭 → 선택»을 제 핸들러 대신 공용 루프(js/block-drag.js grid·infocard·… 줄)에 얹고, 칸 편집 진입에 block.editing · blur 에 걷기.
 * 자: T1 TH · T2 TD — 칸 편집 중 그 칸 안을 누르고 떼도 편집이 «안» 끝난다(contenteditable 그대로) · TD 는 캐럿이 누른 자리로 옮겨진다.
 *     T3 (반대방향 · :2533 「클래스만 믿지 마」) .editing 만 남고 편집 칸이 없으면 다음 클릭이 표를 고른다(고착 0).
 *     T4 (반대방향) 편집 중 그 행이 빠지면(blur 없는 제거) · :img 로 그림 행이 되면 — 표가 다시 눌린다.
 * 기다림은 전부 조건 — 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="tS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('tS')); window.addTableBlock();
    const b = [...document.querySelectorAll('#tS table')].pop().closest('[id]'); window.deselectAll?.(); b.scrollIntoView({ block: 'center' }); return b.id;
  });
  await waitStableRect(page, '#' + id);
  return { errs, id };
}
const corner = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + 6, r.top + 4]; }, id);
const ctr = (page, id, sel) => page.evaluate(([id, sel]) => { const r = document.getElementById(id).querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, [id, sel]);
const st = (page, id, sel) => page.evaluate(([id, sel]) => { const b = document.getElementById(id); const c = sel ? b.querySelector(sel) : null; const pr = document.querySelector('#panel-right .prop-block-label');
  return { ce: c ? c.getAttribute('contenteditable') : null, sel: b.classList.contains('selected'), editing: b.classList.contains('editing'), panelTable: !!(pr && /Table/.test(pr.textContent)) }; }, [id, sel]);
async function pickAndEdit(page, id, sel) {
  const [x, y] = await corner(page, id); await page.mouse.click(x, y);
  await expect.poll(() => st(page, id, sel).then(s => s.sel), { message: '[전제] 표가 골라졌다' }).toBe(true);
  const [cx, cy] = await ctr(page, id, sel); await page.mouse.dblclick(cx, cy);
  await expect.poll(() => st(page, id, sel).then(s => s.ce), { message: '[전제] 칸 편집이 켜졌다' }).toBe('true');
}

test('T1 TH — 칸 편집 중 그 칸을 누르고 떼도 편집이 안 끝난다 · 표 고름·패널 그대로', async ({ page }) => {
  const { errs, id } = await setup(page);
  const TH = 'th';
  await pickAndEdit(page, id, TH);
  const [cx, cy] = await ctr(page, id, TH);
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.up();
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  expect(await st(page, id, TH), '고치기 전 판: ce false(편집 끝남)').toEqual({ ce: 'true', sel: true, editing: true, panelTable: true });
  expect(errs).toEqual([]);
});

test('T2 TD — 칸 편집 중 같은 칸 다른 자리 클릭 = 캐럿이 그리로 옮겨진다(순수 클릭은 캐럿 이동 — table-cell-select.js 주석)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const TD = 'tbody tr:nth-child(1) td:nth-child(1)';
  await pickAndEdit(page, id, TD);
  await page.keyboard.press('Meta+a'); await page.keyboard.type('abcdefghij'); await page.keyboard.press('Meta+ArrowLeft');
  await expect.poll(() => page.evaluate(() => getSelection().anchorOffset), { message: '[전제] 캐럿 0' }).toBe(0);
  const end = await page.evaluate(([id, TD]) => { const c = document.getElementById(id).querySelector(TD); const r = document.createRange(); r.selectNodeContents(c); const rs = [...r.getClientRects()]; const l = rs[rs.length - 1]; return [l.right - 2, l.top + l.height / 2]; }, [id, TD]);
  await page.mouse.move(end[0], end[1]); await page.mouse.down(); await page.mouse.up();
  await expect.poll(() => page.evaluate(([id, TD]) => { const s = getSelection(); const c = document.getElementById(id).querySelector(TD); return !!(s.anchorNode && c.contains(s.anchorNode)) && s.anchorOffset > 5; }, [id, TD]), { message: '캐럿이 칸 «안»에서 누른 자리(끝 근처)로 — 고치기 전 판: 칸 밖·0' }).toBe(true);
  expect(await st(page, id, TD)).toEqual({ ce: 'true', sel: true, editing: true, panelTable: true });
  expect(errs).toEqual([]);
});

test('T3 (반대방향) .editing 만 남고 편집 칸이 없으면 — 다음 클릭이 표를 고르고 표식을 걷는다(고착 0)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await page.evaluate((id) => document.getElementById(id).classList.add('editing'), id);
  const [x, y] = await corner(page, id); await page.mouse.click(x, y);
  await expect.poll(() => st(page, id, null)).toEqual({ ce: null, sel: true, editing: false, panelTable: true });
  expect(errs).toEqual([]);
});

test('T4 (반대방향) 편집 중 그 행이 빠진 뒤 · :img 로 그림 행이 된 뒤 — 표가 다시 눌린다', async ({ page }) => {
  const { errs, id } = await setup(page);
  const LAST = 'tbody tr:last-child td:first-child';
  await pickAndEdit(page, id, LAST);
  await page.evaluate(([id, LAST]) => document.getElementById(id).querySelector(LAST).closest('tr').remove(), [id, LAST]);   // blur 없는 제거 꼴(원격·재렌더)
  await page.evaluate(() => window.deselectAll?.());
  let [x, y] = await corner(page, id); await page.mouse.click(x, y);
  await expect.poll(() => st(page, id, null)).toEqual({ ce: null, sel: true, editing: false, panelTable: true });
  await pickAndEdit(page, id, LAST);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(':img'); await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).querySelectorAll('tr[data-row-img="true"]').length, id), { message: '[전제] :img 로 그림 행' }).toBe(1);
  await page.evaluate(() => window.deselectAll?.());
  [x, y] = await corner(page, id); await page.mouse.click(x, y);
  await expect.poll(() => st(page, id, null)).toEqual({ ce: null, sel: true, editing: false, panelTable: true });
  expect(errs).toEqual([]);
});
