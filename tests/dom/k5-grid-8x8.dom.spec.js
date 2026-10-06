/* k5-grid-8x8.dom.spec.js — K5 ⒜(지디 10-05 · lane-f-grid · 현빈 「8×8」): 상한 4×4 → 8×8 · 피커·캔버스 ＋ 가 따라온다 · 8×8 칸이 «누를 만한가».
 *
 * 머리표: [새 것] 571b78f2 에서 빨강 · [회귀 지킴] 571b78f2 에서도 초록.
 * 실측(BUNDLE-F/K-MEASURE.md ⒟ · 571b78f2): 4×4 피커 207×207 · 칸 49.5 / 같은 함수 8×8 = 칸 23.25 · 패널 넘침 0.
 * 누르기 = clickAt(누르기 직전 그 점의 맨 위 요소가 «노린 칸»인지 단언 — 맞힌 칸 == 노린 칸) · 패널 px 는 줌과 무관. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="vS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="vR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>');
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }] });
    g.id = 'vG'; document.getElementById('vR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100); g.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  return errs;
}
async function pickAndOpenPicker(page) {
  const p = await page.evaluate((id) => { const g = document.getElementById(id); g.scrollIntoView({ block: 'center' }); const r = g.getBoundingClientRect();
    const bad = (e) => !e || !g.contains(e) || e.closest('.grd-gutter, [data-grd-resize-dir], .grd-add-btn');
    for (const [fx, fy] of [[0.06, 0.5], [0.06, 0.3], [0.06, 0.7]])   /* 첫 열 안(8열이어도 열 폭 ≥ 1/8) — 열 경계 거터·모서리 손잡이·＋ 를 피한다 */ { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (!bad(document.elementFromPoint(x, y))) return [x, y]; }
    return [r.left + r.width * 0.06, r.top + r.height / 2]; }, 'vG');
  await clickAt(page, p[0], p[1], { sel: '[id="vG"]' }, { label: '그리드 고르기' });
  await expect.poll(() => page.evaluate(() => !!document.getElementById('grd-grid-picker')), { message: '[전제] 피커' }).toBe(true);
  if (await page.evaluate(() => getComputedStyle(document.getElementById('grd-size-body')).display === 'none')) {
    const t = await page.locator('#grd-size-toggle').boundingBox();
    await clickAt(page, t.x + t.width / 2, t.y + t.height / 2, { sel: '[id="grd-size-toggle"], [id="grd-size-toggle"] *' }, { label: '크기 절 펼침' });
  }
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('grd-size-body')).display !== 'none'), { message: '[전제] 피커 펼침' }).toBe(true);
}
const size = (page) => page.evaluate(() => { const g = document.getElementById('vG'); return { cols: JSON.parse(g.dataset.cols || '[]').length, rows: JSON.parse(g.dataset.rows || '[{}]').length }; });
/** 노린 칸(r,c)의 한 점 — dx,dy = 칸 가운데에서 벗어난 px */
const cellPt = (page, r, c, dx = 0, dy = 0) => page.evaluate(([r, c, dx, dy]) => { const e = document.querySelector(`#grd-grid-picker .grid-picker-cell[data-r="${r}"][data-c="${c}"]`); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2 + dx, y: q.top + q.height / 2 + dy, w: q.width }; }, [r, c, dx, dy]);

test('C1 [새 것] 피커 = 64칸(8×8) · 칸 한 변 ≥ 20px', async ({ page }) => {
  const errs = await setup(page); await pickAndOpenPicker(page);
  const r = await page.evaluate(() => { const cs = [...document.querySelectorAll('#grd-grid-picker .grid-picker-cell')]; return { n: cs.length, w: cs[0].getBoundingClientRect().width, last: Object.assign({}, cs[cs.length - 1].dataset) }; });
  expect({ n: r.n, last: r.last }, JSON.stringify(r)).toEqual({ n: 64, last: { r: '8', c: '8' } });
  expect(r.w >= 20, `칸 ${r.w}px`).toBe(true);
  expect(errs).toEqual([]);
});
test('C2 [새 것] 피커 (8,8) 진짜 클릭 → 8×8 그리드', async ({ page }) => {
  const errs = await setup(page); await pickAndOpenPicker(page);
  const p = await cellPt(page, 8, 8);
  await page.mouse.move(p.x, p.y); await page.waitForTimeout(100);
  await clickAt(page, p.x, p.y, { sel: '.grid-picker-cell[data-r="8"][data-c="8"]' }, { label: '(8,8)' });
  await expect.poll(() => size(page)).toEqual({ cols: 8, rows: 8 });
  expect(errs).toEqual([]);
});
/* C3 — 누를 만한가: 모서리 넷·가운데 둘·변 가운데 넷 + 가장자리(±9px). 맞힌 요소 == 노린 칸(clickAt 단언) · 결과 크기 == 노린 칸 */
const TARGETS = [[1, 1], [1, 8], [8, 1], [8, 8], [4, 4], [5, 5], [1, 4], [8, 5], [4, 1], [5, 8]];
for (const [dx, dy, tag] of [[0, 0, '가운데'], [9, 9, '가장자리 +9'], [-9, -9, '가장자리 −9']]) {
  test(`C3-${tag} [새 것] 8×8 칸 진짜 클릭 10곳(${tag}) — 맞힌 칸 == 노린 칸 · 결과 크기 == 노린 칸`, async ({ page }) => {
    const errs = await setup(page); await pickAndOpenPicker(page);
    const miss = [];
    for (const [r, c] of TARGETS) {
      const p = await cellPt(page, r, c, dx, dy);
      if (!p) { miss.push(`${r},${c}: 칸 없음`); continue; }
      await page.mouse.move(p.x, p.y); await page.waitForTimeout(60);
      try { await clickAt(page, p.x, p.y, { sel: `.grid-picker-cell[data-r="${r}"][data-c="${c}"]` }, { label: `(${r},${c}) ${tag}` }); }
      catch (e) { miss.push(`${r},${c}: 맞힌 요소 다름`); continue; }
      await page.waitForTimeout(250);
      const s = await size(page);
      if (s.cols !== c || s.rows !== r) miss.push(`${r},${c}: 결과 ${s.cols}×${s.rows}`);
      /* ★되고르기 없음 — 실앱 실측(F-GRID fg3): 피커 칸 클릭 뒤에도 그리드 .selected 유지 · 크기 절 펼친 채 · 피커는 새 노드로 다시 그려짐.
         ⇒ 사용자처럼 패널 연 채 연속 클릭. 칸 자리는 매번 다시 읽는다(cellPt). 그리드는 골라진 채여야 한다(전제). */
      await expect.poll(() => page.evaluate(() => document.getElementById('vG').classList.contains('selected') && !!document.querySelector('#grd-grid-picker .grid-picker-cell') && getComputedStyle(document.getElementById('grd-size-body')).display !== 'none'), { message: '[전제] 클릭 뒤에도 그리드 골라짐 · 피커 펼침' }).toBe(true);
    }
    expect(miss, `★빗나감 ${JSON.stringify(miss)}`).toEqual([]);
    expect(errs).toEqual([]);
  });
}
test('C4 [새 것] 캔버스 ＋(열) 2→8 · 8에서 흐림(disabled) · 눌러도 8', async ({ page }) => {
  const errs = await setup(page);
  /* ★＋ 는 «고른» 그리드에만 붙는다(H8 · grid-plus-g15 V2) — 매번 진짜 클릭으로 고르고 열 ＋(data-grd-add="col")를 찾는다 */
  const plusCol = async () => { await pickAndOpenPicker(page);
    await page.waitForFunction(() => document.querySelectorAll('#grd-plus-layer > .grd-add-btn[data-grd-for="vG"]').length === 2, null, { timeout: 3000 }).catch(() => {});
    return page.evaluate(() => { const b = document.querySelector('#grd-plus-layer > .grd-add-btn[data-grd-for="vG"][data-grd-add="col"]'); if (!b) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, disabled: b.disabled }; }); };
  for (let n = 2; n < 8; n++) {
    const b = await plusCol(); expect(b && !b.disabled, `[전제] ${n}열에서 ＋ 살아 있음`).toBe(true);
    await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300);
    expect((await size(page)).cols, `${n}→${n + 1}`).toBe(n + 1);
  }
  const b8 = await plusCol();
  expect(b8.disabled, '★8열에서 ＋ 흐림').toBe(true);
  await page.mouse.move(b8.x, b8.y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300);
  expect((await size(page)).cols, '눌러도 8').toBe(8);
  expect(errs).toEqual([]);
});
