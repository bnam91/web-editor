/* slide-frame-cells — SLIDE-CELL-AS-FRAME-01(현빈 261118 · handoff/PLAN-ty-slide-frame-cells-261118.md) · 커밋 1 = 데이터 두 갈래 + 비파괴 렌더 + 왕복.
 *   js/blocks/slide-block.js: data-cell-mode="frame" = 정본 DOM(.sld-track > .frame-block.sld-cell 자식) · renderSlideBlock 프레임 갈래 = 배치만(칸 자식 무접촉)
 * F0 ★프레임 모드 슬라이드 · 칸 2 에 들어가(_activeFrame = 칸) 진짜 addTextBlock → 그 칸 안 글자(같은 요소 = id 로 잰다 · addTextBlock 프레임 갈래는 content 를 안 받는다)
 *    → 패널 값 바꾸기 길(setSlideLayout · renderSlideBlock 탐) + pushHistory → 글자 «같은 요소» 그대로 · 칸 3 · 간격 반영
 *    → ⌘Z 한 번 = 간격 전(글자 있음) · ⌘Z 한 번 더 = 글자 넣기 전(칸 3 그대로 · 칸 비었음) · ⌘⇧Z = 글자 다시
 *    → 저장 → 다시 열기(serializeProject → applyProjectData · RERENDER_KINDS 가 renderSlideBlock 을 탄다) → 칸 2 안 글자 · 표식·칸 배치 모드 그대로
 * F0b [음성] 사진 모드(표식 없음) = 옛 렌더 그대로(.sld-card · 칸 프레임 0)
 * 양성대조(CTL · _patches/slide-frame-CTL1-destructive.patch): renderSlideBlock 의 프레임 갈래 `if (isFrameSlide(block)) {…}` 를 지움(옛 replaceChildren 로 떨어짐) → F0 빨강(값 바꾸자 글자 사라짐) — 예측
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, opts) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (opts) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'); window.selectSection(sec);
    const { row, block } = window.makeSlideBlock(opts);
    (sec.querySelector('.section-inner') || sec).appendChild(row); window.bindBlock?.(block);
    window.pushHistory?.();   // 놓은 뒤 표본(이 장면의 «처음»)
    return block.id;
  }, opts);
  return { errs, id };
}
const st = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); if (!b) return null;
  const cells = [...b.querySelectorAll(':scope > .sld-track > .sld-cell')];
  return {
    mode: b.dataset.cellMode || null, cells: cells.length, layouts: cells.map((c) => c.dataset.cellLayout),
    kids: cells.map((c) => [...c.querySelectorAll('.text-block')].map((t) => t.id)),
    text: cells.map((c) => c.textContent.trim()),
    gap: b.querySelector(':scope > .sld-track')?.style.gap || '',
  };
}, id);
async function key(page, k) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press(k); }

test('F0 ★칸 안 글자 — 값 바꿈·⌘Z·⌘⇧Z·저장 왕복에도 그대로(비파괴 렌더)', async ({ page }) => {
  const { errs, id } = await scene(page, { cellMode: 'frame' });
  const s0 = await st(page, id);
  expect({ mode: s0.mode, cells: s0.cells, layouts: s0.layouts }).toEqual({ mode: 'frame', cells: 3, layouts: ['free', 'free', 'free'] });
  /* 칸 2 에 들어가 진짜 넣기 길(addTextBlock → _insertToFlowFrame B 모드) */
  await page.evaluate((id) => { const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1]; window._activeFrame = cell; window.addTextBlock('body'); }, id);
  const s1 = await st(page, id);
  expect(s1.kids[1].length, '[전제] 칸 2 안에 글자 블럭').toBe(1);
  const tid = s1.kids[1][0];
  /* 패널 값 바꾸기 길 — renderSlideBlock 을 탄다 */
  await page.evaluate((id) => { window._activeFrame = null; window.setSlideLayout(document.getElementById(id), { gap: 30 }); window.pushHistory?.(); }, id);
  const s2 = await st(page, id);
  expect({ cells: s2.cells, kid: s2.kids[1], gap: s2.gap }, '★값 바꿔도 칸 안 글자 «같은 요소» 그대로').toEqual({ cells: 3, kid: [tid], gap: '30px' });
  await key(page, 'Meta+z');
  await expect.poll(async () => (await st(page, id))?.gap, '⌘Z 1 = 간격 전').toBe('16px');
  expect((await st(page, id)).kids[1], '간격만 되돌림 · 글자 있음').toEqual([tid]);
  await key(page, 'Meta+z');
  await expect.poll(async () => (await st(page, id))?.kids[1].length, '⌘Z 2 = 글자 넣기 전').toBe(0);
  expect((await st(page, id)).cells, '칸 3 그대로').toBe(3);
  await key(page, 'Meta+Shift+z');
  await expect.poll(async () => (await st(page, id))?.kids[1], '⌘⇧Z = 글자 다시').toEqual([tid]);
  /* 저장 → 다시 열기 */
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  const s3 = await st(page, id);
  expect({ mode: s3?.mode, cells: s3?.cells, layouts: s3?.layouts, kid: s3?.kids[1] }, '★다시 열어도 칸 2 안 글자').toEqual({ mode: 'frame', cells: 3, layouts: ['free', 'free', 'free'], kid: [tid] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F0b [음성] 사진 모드 = 옛 렌더 그대로', async ({ page }) => {
  const { errs, id } = await scene(page, {});
  const r = await page.evaluate((id) => { const b = document.getElementById(id); return { mode: b.dataset.cellMode || null, cards: b.querySelectorAll('.sld-card').length, cells: b.querySelectorAll('.sld-cell').length }; }, id);
  expect(r).toEqual({ mode: null, cards: 3, cells: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});
