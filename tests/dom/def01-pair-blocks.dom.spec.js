/* def01-pair-blocks.dom.spec.js — DEF-01 2단계 짝(블럭 묶음): 프레임 삭제(M1-del ⒝) 길 판정 · 글자 편집(앞 표본만) · G14 원 안 넣기.
 *
 * F1 — M1-del ⒝(프레임 «혼자» 고름 → Delete): 실측 꼭대기 「서브섹션 삭제」 = 공용 «블록 삭제» 길이 «아니다» — 제 갈래
 *   editor.js deleteSelectedFromCanvas 의 `.frame-block.selected` 갈래: 끝 표본 `pushHistory('서브섹션 삭제');` «하나뿐»(앞 ensureHistoryCheckpoint 없음).
 *   ⇒ 공용 H1·H2 가 대신 덮지 못한다 — 제 짝(F1)을 둔다.
 * F2 — 측정(soft): 앞 표본이 없는 그 갈래에서 «날 변화 뒤» 프레임 삭제 → ⌘Z 한 번이 어디까지 가나. 수만 남긴다(단언 없음 — 판정은 리드).
 * E1 — E1 R7⒝(반사 켠 에셋 고름 → Delete): 공용 «블록 삭제» 길을 타는지 «재서» 가른다(꼭대기 「블록 삭제」) — 타면 공용 짝의 변이(editor.js `pushHistory('블록 삭제')` 지움)로 빨강.
 * T1 — 글자 편집(E55 C · G14 K17c 의 편집 ⌫ · 텍스트블럭 공통): block-drag.js dblclick «편집 시작 전» pushHistory 하나뿐(끝 표본 없음 — 설계) → beforeOnly.
 * C1 — G14 K6 「＋ 블럭 넣기」 = addCircleChild → _insertToFlowFrame({into}) 의 `if (_into) { window.pushHistory();`(앞 · 실측으로 그 갈래) + 삽입 래퍼 끝 표본(insert-history.js). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

async function setup(page, build) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((src) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="qS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" id="qG" style="height:40px"></div><div class="row" id="qR" data-layout="stack"></div><div class="row" id="qR2" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    (new Function(src))();
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    window.applyPageSettings?.(); window.clearHistory?.();
  }, build);
  await page.waitForTimeout(250);
  return errs;
}
const raw = (page, px) => page.evaluate((px) => { document.getElementById('qG').style.height = px + 'px'; }, px);
/* M1-del ⒝ 의 «그» 장면 — modal-frameify-delete.dom.spec.js setup 과 같은 손(모달 → frameifyModal → 줄 둘 더함). 고름도 같은 손(프레임 오른쪽 위 모서리 클릭). */
const FRAME = `const { row, block } = window.makeModalBlock({ variant: 'titled', title: '제목', text: '첫 줄 본문' });
    document.getElementById('qR').appendChild(row); window.renderModalBlock(block); window.bindBlock?.(block);
    const f = window.frameifyModal(block); f.id = 'qF'; window.addTextBlock('body'); window.addTextBlock('body');`;
async function pickFrame(page) {
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  const p = await page.evaluate(() => { const e = document.getElementById('qF'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.right - 4, r.top + 4]; });
  await page.mouse.click(p[0], p[1]); await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.getElementById('qF').classList.contains('selected')), '전제 — 프레임을 골랐다').toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
}
const TEXT = `const { block: tb } = window.makeTextBlock('h2'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h2'); tf.appendChild(tb); tb.id = 'qT';
  tb.querySelector('[class^="tb-"]').textContent = '글자 편집'; document.getElementById('qR').appendChild(tf);`;

test('F1 M1-del ⒝ 길 판정 — 프레임(.frame-block) 고름 → Delete 의 꼭대기 이름 · 한 걸음', async ({ page }) => {
  await setup(page, FRAME);
  await pickFrame(page);
  const r = await expectOneUndoStep(page, async () => { await page.keyboard.press('Delete'); }, '프레임 삭제(M1-del ⒝)');
  expect(r.topAction, '제 갈래 — 끝 표본 이름').toBe('서브섹션 삭제');
});

test('F2 측정(soft) — 날 변화 뒤 프레임 «혼자» 삭제 → ⌘Z 한 번의 도착점(앞 표본 없는 갈래)', async ({ page }) => {
  await setup(page, FRAME);
  await pickFrame(page);
  await raw(page, 75);
  const r = await expectOneUndoStep(page, async () => { await page.keyboard.press('Delete'); }, '날 변화 뒤 프레임 삭제(측정)', { soft: true });
  const h = await page.evaluate(() => document.getElementById('qG').style.height);
  console.log(`[F2] dPos=${r.dPos} restored=${r.restored} ⌘Z 뒤 날 변화 높이=${h} (75px 면 날 변화 남음 · 40px 면 ⌘Z 가 날 변화까지 되돌림)`);
});

test('F3 측정(soft) — 실제 손: 프레임 안 줄 글자 편집(앞 표본만) → 프레임 «혼자» 삭제 → ⌘Z 한 번 뒤 편집 글자가 남는가', async ({ page }) => {
  await setup(page, FRAME);
  const tid = await page.evaluate(() => document.querySelector('#qF .text-block').id);
  const p = await page.evaluate((tid) => { const e = document.querySelector(`#${tid} [class^="tb-"]`); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.right - 4, q.top + q.height / 2]; }, tid);
  for (let n = 0; n < 3 && !(await page.evaluate(() => !!document.querySelector('#qF [contenteditable="true"]'))); n++) { await page.mouse.dblclick(p[0], p[1]); await page.waitForTimeout(150); }
  expect(await page.evaluate(() => !!document.querySelector('#qF [contenteditable="true"]')), '전제 — 줄 글자 편집 중').toBe(true);
  await page.keyboard.press('End'); await page.keyboard.type('EDIT'); await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(200);
  await pickFrame(page);
  const r = await expectOneUndoStep(page, async () => { await page.keyboard.press('Delete'); }, '글자 편집 뒤 프레임 삭제(측정)', { soft: true });
  const t = await page.evaluate((tid) => document.querySelector(`#${tid} [class^="tb-"]`)?.textContent ?? null, tid);
  console.log(`[F3] restored=${r.restored} ⌘Z 한 번 뒤 줄 글자=${JSON.stringify(t)} (EDIT 로 끝나면 편집 남음 · 아니면 ⌘Z 한 번이 편집까지 되돌림)`);
});

test('E1 R7⒝ 반사 켠 에셋 Delete — 공용 «블록 삭제» 길 · 한 걸음 · ⌘Z 로 효과까지', async ({ page }) => {
  await setup(page, `const r = window.makeAssetBlock(); const ab = r.block || r; ab.id = 'qA'; document.getElementById('qR').appendChild(r.row || ab);`);
  await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 120; const x = cv.getContext('2d'); x.fillStyle = '#ff6600'; x.fillRect(0, 0, 300, 120);
    window.updateAssetBlock('qA', { imgSrc: cv.toDataURL('image/png') }); window.setFxReflect(document.getElementById('qA'), { state: 'on' });
    window.deselectAll?.(); window.applyPageSettings?.(); window.clearHistory?.(); });
  await page.waitForTimeout(200);
  const p = await page.evaluate(() => { const e = document.getElementById('qA'); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + 10, q.top + 10]; });
  await page.mouse.click(p[0], p[1]); await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.getElementById('qA').classList.contains('selected')), '전제 — 에셋을 골랐다').toBe(true);
  const r = await expectOneUndoStep(page, async () => { await page.keyboard.press('Delete'); }, 'E1 반사 에셋 삭제');
  expect(r.topAction, '공용 블록 삭제 길').toBe('블록 삭제');
  expect(await page.evaluate(() => document.getElementById('qA')?.dataset.fxReflect), '⌘Z 로 효과까지').toBe('on');
});

test('T1 글자 편집(앞 표본만 · dblclick) — 날 변화 뒤 편집 → ⌘Z 가 날 변화 «뒤»(편집 전)에서 멈춘다', async ({ page }) => {
  await setup(page, TEXT);
  await raw(page, 71);
  const p = await page.evaluate(() => { const e = document.querySelector('#qT [class^="tb-"]'); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.right - 4, q.top + q.height / 2]; });
  await expectOneUndoStep(page, async () => {
    await page.mouse.dblclick(p[0], p[1]); await page.waitForTimeout(150);
    await page.keyboard.press('End'); await page.keyboard.type('XYZ'); await page.waitForTimeout(100);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(150);
  }, '글자 편집', { beforeOnly: true });
});

test('C1 G14 원 안 「＋ 블럭 넣기」(addCircleChild) — 끝 표본: 한 걸음 · 앞 표본: 날 변화 뒤 넣기 → ⌘Z 가 날 변화 «뒤»에서', async ({ page }) => {
  const MK = `const r = window.makeIconCircleBlock(); const b = r.block || r; b.id = 'qC'; document.getElementById('qR').appendChild(r.row || b);`;
  await setup(page, MK);
  expect(await page.evaluate(() => typeof window.addCircleChild), '전제 — addCircleChild').toBe('function');
  await expectOneUndoStep(page, async () => { await page.evaluate(() => window.addCircleChild(document.getElementById('qC'), 'body')); }, 'G14 원 안 넣기(끝)');
  await setup(page, MK);
  await raw(page, 73);
  const r = await expectOneUndoStep(page, async () => { await page.evaluate(() => window.addCircleChild(document.getElementById('qC'), 'body')); }, 'G14 원 안 넣기(앞)');
  expect(r.dPos, '앞+끝 = 두 칸').toBe(2);
});
