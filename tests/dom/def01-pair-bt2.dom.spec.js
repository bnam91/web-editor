/* def01-pair-bt2.dom.spec.js — DEF-01 2단계 짝(BT2 묶음): 말풍선 줄 갱신 · 줄 글자 편집.
 *
 * B1 — 줄 추가·복사·종류·정렬·삭제 = host.commitLines → updateSpeechBubbleBlock: 앞 block-factory.js(updateSpeechBubbleBlock 안
 *   `lines: _lnNow, }; … window.pushHistory?.();`) + 끝 model-update-history.js 래퍼. 챗(updateChatBlock)도 같은 끝 래퍼 · 앞은 chat-block.js — 챗은 이 짝이 «안» 덮는다(아래 명부).
 * B3 — 줄 글자 크기(Typography) = line-host.js:279 grdLineUi.wireTypo(block, cur, host) → prop-grid.js _grdWireTypo numWire('grd-typo-size-number') change → commit → begin()
 *   `_gesture = true; window.pushHistory?.();`(앞 표본만 · 끝은 scheduleAutoSave 뿐) → beforeOnly. 그리드 칸 줄 Typography 도 «같은» begin(prop-grid.js:3368) — 이 짝이 덮는다.
 * B2 — 줄 글자 편집 = 줄 dblclick → line-host.js lnBeginEdit `window.pushHistory?.('줄 글자 편집')`(앞 표본만 — 설계) → beforeOnly. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="bS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60">
      <div class="gap-block" data-type="gap" id="bG" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.selectSection(document.getElementById('bS'));
    window.addSpeechBubbleBlock('left');
    const b = [...document.querySelectorAll('#bS .speech-bubble-block')].pop(); b.id = 'bB';
    window.updateSpeechBubbleBlock('bB', { lines: [{ type: 'body', text: '첫째 줄' }, { type: 'body', text: '둘째 줄' }] });
    window.deselectAll?.(); window.applyZoom?.(100); window.applyPageSettings?.(); window.clearHistory?.();
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => { const b = document.getElementById('bB'); return b && b.dataset.lines ? JSON.parse(b.dataset.lines).length : 0; }), '전제 — 줄 둘 말풍선').toBe(2);
  return errs;
}
const raw = (page, px) => page.evaluate((px) => { document.getElementById('bG').style.height = px + 'px'; }, px);
const addLine = (page) => page.evaluate(() => { const b = document.getElementById('bB'); const ls = JSON.parse(b.dataset.lines); ls.push({ type: 'body', text: '더한 줄' }); return window.updateSpeechBubbleBlock('bB', { lines: ls }); });

test('B1 말풍선 줄 갱신(updateSpeechBubbleBlock) — 끝 표본: 한 걸음 · 앞 표본: 날 변화 뒤 → ⌘Z 가 날 변화 «뒤»에서', async ({ page }) => {
  await setup(page);
  await expectOneUndoStep(page, async () => { const r = await addLine(page); expect(r && r.ok, JSON.stringify(r)).toBe(true); }, 'BT2 줄 갱신(끝)');
  await setup(page);
  await raw(page, 79);
  const r = await expectOneUndoStep(page, async () => { await addLine(page); }, 'BT2 줄 갱신(앞)');
  expect(r.dPos, '앞+끝 = 두 칸').toBe(2);
});

test('B2 줄 글자 편집(줄 dblclick → lnBeginEdit · 앞 표본만) — 날 변화 뒤 편집 → ⌘Z 가 날 변화 «뒤»에서(구제 한 번)', async ({ page }) => {
  await setup(page);
  await raw(page, 81);
  await expectOneUndoStep(page, async () => {
    const rr = await page.evaluate(() => { const e = document.querySelector('#bB .ln-row[data-ln="0"]'); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
    await page.mouse.dblclick(rr[0], rr[1]); await page.waitForTimeout(120);
    expect(await page.evaluate(() => !!document.querySelector('#bB [contenteditable="true"]')), '전제 — 줄 글자 편집 중').toBe(true);
    await page.keyboard.press('End'); await page.keyboard.type('Q'); await page.waitForTimeout(100);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(200);
  }, 'BT2 줄 글자 편집', { beforeOnly: true });
});

test('B3 줄 글자 크기(Typography · begin 앞 표본만) — 날 변화 뒤 크기 → ⌘Z 가 날 변화 «뒤»에서(구제 한 번)', async ({ page }) => {
  await setup(page);
  const pt = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, sel);
  let p = await pt('#bB .tb-bubble'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(150);
  p = await pt('#bB .ln-row[data-ln="1"]'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200);
  await expect(page.locator('#grd-typo-size-number'), '전제 — 줄 Typography 크기 칸').toBeVisible();
  await page.evaluate(() => window.clearHistory?.());               // 바닥 = 줄 고른 지금
  await raw(page, 83);
  await expectOneUndoStep(page, async () => {
    const f = page.locator('#grd-typo-size-number'); await f.fill('50'); await f.press('Enter'); await page.waitForTimeout(100);
  }, 'BT2 줄 글자 크기', { beforeOnly: true });
});
