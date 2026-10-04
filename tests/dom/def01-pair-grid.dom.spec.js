/* def01-pair-grid.dom.spec.js — DEF-01 2단계 짝(그리드 묶음): 공용 길 updateGridBlock · G15 ＋ · G12 슬라이더.
 *
 * ★공용 길 updateGridBlock = 앞 grid-block.js `if (opts.noHistory !== true) window.pushHistory?.();` + 끝 model-update-history.js 래퍼
 *   `window.pushHistory(LABELS[name] || DEFAULT_LABEL)`. 이 길을 타는 레인 조작(코드 근거):
 *     G12 토글·여백 외 버튼 = prop-grid.js _grdWireBlockBgSection commit → window.updateGridBlock
 *     G17 외곽선 단추     = prop-grid.js _grdWireOutlineSection commit → window.updateGridBlock
 *     G4 칸 패치(C4·C6)  = 시험 upd → window.updateGridBlock(patchCell)
 *   ⇒ U1·U2 가 세 레인을 «대신» 덮는다.
 * ★G15 ＋ = gridAddAtEnd → gridResizeTo: 앞 표본만 `window.pushHistory?.();  // ★변경 «전»에`(끝 표본 없음 — 설계) → beforeOnly.
 * ★G12 여백 슬라이더 = _helpers.js bindSlider: 앞 표본만 mousedown `window.pushHistory?.()` → beforeOnly.
 * 앞 표본을 재는 꼴: 조작 «앞»에 날 변화(표본 없음)를 두고 ⌘Z 가 거기서 멈추나(A3). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="pS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" id="pG" style="height:40px"></div><div class="row" id="pR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }] });
    g.id = 'pGrid'; document.getElementById('pR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100);
    window.applyPageSettings?.(); window.clearHistory?.();
  });
  await page.waitForTimeout(250);
  return errs;
}
const raw = (page, px) => page.evaluate((px) => { document.getElementById('pG').style.height = px + 'px'; }, px);   // 날 변화 — 표본 없음

test('U1 공용 길 updateGridBlock(끝 표본) — patchCell 한 번 = ⌘Z 한 걸음 (G12 토글·G17·G4 를 대신 덮는다)', async ({ page }) => {
  await setup(page);
  const r = await expectOneUndoStep(page, async () => { await page.evaluate(() => window.updateGridBlock('pGrid', { patchCell: { r: 0, c: 0, bg: '#ff0000' } })); }, 'updateGridBlock patchCell');
  expect(r.topAction).toBeTruthy();
});

test('U2 공용 길 updateGridBlock(앞 표본) — 날 변화 뒤 patchCell → ⌘Z 한 번이 날 변화 «뒤»에서 멈춘다', async ({ page }) => {
  await setup(page);
  await raw(page, 61);
  const r = await expectOneUndoStep(page, async () => { await page.evaluate(() => window.updateGridBlock('pGrid', { patchCell: { r: 0, c: 1, bg: '#00ff00' } })); }, 'updateGridBlock 앞 표본');
  expect(r.dPos, '앞+끝 = 두 칸').toBe(2);
});

test('R1 G15 ＋ 열 더하기(앞 표본만) — 날 변화 뒤 gridAddAtEnd → ⌘Z 가 날 변화 «뒤»에서 멈춘다(구제 한 번)', async ({ page }) => {
  await setup(page);
  await raw(page, 63);
  await expectOneUndoStep(page, async () => { await page.evaluate(() => window.gridAddAtEnd(document.getElementById('pGrid'), 'col')); }, 'G15 ＋ 열', { beforeOnly: true });
});

test('S1 G12 배경 여백 슬라이더(앞 표본만 · bindSlider mousedown) — 날 변화 뒤 끌기 → ⌘Z 가 날 변화 «뒤»에서 멈춘다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.updateGridBlock('pGrid', { blockBg: { on: true } }));
  const [gx, gy] = await page.evaluate(() => { const g = document.getElementById('pGrid'); g.scrollIntoView({ block: 'center' }); const q = g.getBoundingClientRect(); return [q.left + 6, q.top + 6]; });
  await page.mouse.click(gx, gy); await page.waitForTimeout(300);
  const s = await page.evaluate(() => { const e = document.getElementById('grd-bbg-padx-slider'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return { l: q.left, r: q.right, y: q.top + q.height / 2 }; });
  expect(s, '전제 — 「블럭 배경」 좌우 여백 슬라이더').not.toBeNull();
  await page.evaluate(() => { window.clearHistory?.(); });        // 바닥을 지금으로(토글은 앞 걸음 — 이 짝의 대상이 아니다)
  await raw(page, 67);
  await expectOneUndoStep(page, async () => {
    await page.mouse.move(s.l + 2, s.y); await page.mouse.down(); await page.mouse.move(s.l + (s.r - s.l) * 0.6, s.y, { steps: 5 }); await page.mouse.up();
  }, 'G12 여백 슬라이더', { beforeOnly: true });
});
