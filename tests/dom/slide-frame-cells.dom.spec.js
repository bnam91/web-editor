/* slide-frame-cells — SLIDE-CELL-AS-FRAME-01(현빈 261118 · handoff/PLAN-ty-slide-frame-cells-261118.md) · 커밋 1 = 데이터 두 갈래 + 비파괴 렌더 + 왕복.
 *   js/blocks/slide-block.js: data-cell-mode="frame" = 정본 DOM(.sld-track > .frame-block.sld-cell 자식) · renderSlideBlock 프레임 갈래 = 배치만(칸 자식 무접촉)
 * F0 ★프레임 모드 슬라이드 · 칸 2 에 들어가(_activeFrame = 칸) 진짜 addTextBlock → 그 칸 안 글자(같은 요소 = id 로 잰다 · addTextBlock 프레임 갈래는 content 를 안 받는다)
 *    → 패널 값 바꾸기 길(setSlideLayout · renderSlideBlock 탐) + pushHistory → 글자 «같은 요소» 그대로 · 칸 3 · 간격 반영
 *    → ⌘Z 한 번 = 간격 전(글자 있음) · ⌘Z 한 번 더 = 글자 넣기 전(칸 3 그대로 · 칸 비었음) · ⌘⇧Z = 글자 다시
 *    → 저장 → 다시 열기(serializeProject → applyProjectData · RERENDER_KINDS 가 renderSlideBlock 을 탄다) → 칸 2 안 글자 · 표식·칸 배치 모드 그대로
 * F0b [음성] 사진 모드(표식 없음) = 옛 렌더 그대로(.sld-card · 칸 프레임 0)
 * ── 커밋 2 ──
 * F1 추가 메뉴 입구(addSlideBlock) 새 블럭 = 프레임 칸 3 · 패널 «프레임 추가하기» → 4 · 칸 ✕ → 3 · ↓ 순서(칸 요소째) · 칸 폭 % → data-w · 그 칸 폭 · 12 상한에서 단추 꺼짐 · ⌘Z = 직전 하나
 * F2 빈 칸을 진짜 클릭 → 그 칸 고름(_activeFrame) · 패널 = 슬라이드(그 칸 줄 표시 · «사진 넣기(칸 2)») · 프레임 px 손잡이 0 · 프레임 패널 0
 *    → addTextBlock = 그 칸 안 · 칸 «사진 넣기»(진짜 파일창) → 그 칸 꽉 에셋 · 칸 dragstart = 막힘 · 칸 고른 채 ⌘G(groupSelectedBlocks) = 묶음 0(칸은 트랙 그대로)
 * 양성대조(CTL · _patches/slide-frame-CTL1-destructive.patch): renderSlideBlock 의 프레임 갈래 `if (isFrameSlide(block)) {…}` 를 지움(옛 replaceChildren 로 떨어짐) → F0 빨강(값 바꾸자 글자 사라짐) — 예측
 *   slide-frame-CTL2-no-cell-pick.patch(block-drag click 의 _pickSlideCell 줄 삭제) → F2 빨강(프레임 패널·px 손잡이) ·
 *   slide-frame-CTL3-group-cell.patch(⌘G 칸 거르기 줄 삭제) → F2 빨강(칸이 묶음으로 빠짐) — 예측
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

async function menuScene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    const made = window.addSlideBlock();   // 추가 메뉴 onclick 과 같은 입구
    made.block.scrollIntoView({ block: 'center' });
    return made.block.id;
  });
  return { errs, id };
}
const cellIds = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll(':scope > .sld-track > .sld-cell')].map((c) => c.id), id);

test('F1 새 블럭 = 프레임 칸 3 · 추가·빼기·순서·폭 · 12 상한 · ⌘Z', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const c0 = await cellIds(page, id);
  expect(c0.length, '★메뉴 새 블럭 = 프레임 칸 3').toBe(3);
  await expect(page.locator('#sld-add-cell'), '[전제] 패널 = 칸 줄').toHaveCount(1);
  await page.click('#sld-add-cell');
  await expect.poll(() => cellIds(page, id).then((a) => a.length)).toBe(4);
  await page.click('.sld-cell-row[data-idx="3"] .sld-cell-del');
  await expect.poll(() => cellIds(page, id)).toEqual(c0);
  await page.click('.sld-cell-row[data-idx="0"] .sld-cell-down');
  await expect.poll(() => cellIds(page, id), '↓ = 칸 요소째').toEqual([c0[1], c0[0], c0[2]]);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => cellIds(page, id), '⌘Z = 순서 전').toEqual(c0);
  await page.locator('.sld-cell-row[data-idx="1"] .sld-cw').fill('30'); await page.locator('.sld-cell-row[data-idx="1"] .sld-cw').dispatchEvent('change');
  const w = await page.evaluate((id) => { const b = document.getElementById(id), c = b.querySelectorAll('.sld-cell')[1]; return { dw: c.dataset.w, ratio: c.getBoundingClientRect().width / b.getBoundingClientRect().width }; }, id);
  expect(w.dw).toBe('30');
  expect(Math.abs(w.ratio - 0.3), `칸 2 폭 비 ${w.ratio}`).toBeLessThanOrEqual(0.01);
  for (let i = 3; i < 12; i++) await page.click('#sld-add-cell');
  await expect.poll(() => cellIds(page, id).then((a) => a.length)).toBe(12);
  await expect(page.locator('#sld-add-cell'), '12 상한').toBeDisabled();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F2 빈 칸 클릭 = 그 칸 고름(슬라이드 패널 · 손잡이 0) → 넣기·사진 넣기 = 그 칸 안 · 칸 끌기·⌘G 막힘', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const p = await page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[1].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  await page.mouse.click(p[0], p[1]);
  const pick = await page.evaluate((id) => {
    const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1];
    return { active: window._activeFrame === cell, sel: cell.classList.contains('selected'), row: document.querySelector('.sld-cell-row.active')?.dataset.idx ?? null,
      handles: document.querySelectorAll('.ss-resize-handle, .ss-radius-handle').length, framePanel: !!document.getElementById('ss-align-left') };   // 프레임 패널(prop-frame.js)에만 있는 id
  }, id);
  expect(pick, '★칸 고름 · 슬라이드 패널 그 칸 줄 · 프레임 px 손잡이 0 · 프레임 패널 0').toEqual({ active: true, sel: true, row: '1', handles: 0, framePanel: false });
  await expect(page.locator('#sld-cell-photo')).toHaveText(/칸 2/);
  /* 고른 칸에 넣기 = 그 칸 안(_insertToFlowFrame) */
  await page.evaluate(() => window.addTextBlock('body'));
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelectorAll('.text-block').length, id), '★글자 = 칸 2 안').toBe(1);
  /* 칸 «사진 넣기» — 진짜 파일창 */
  const q = await page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[1].getBoundingClientRect(); return [r.left + 8, r.top + 8]; }, id);
  await page.mouse.click(q[0], q[1]);   // 칸 빈 곳(왼위 모서리 · 글자는 가운데에 놓였다) — 칸 고름 + 패널
  await expect(page.locator('#sld-cell-photo')).toHaveCount(1);
  const png = await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 40, 30); return cv.toDataURL('image/png').split(',')[1]; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sld-cell-photo')]);
  await fc.setFiles([{ name: 'r.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }]);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelectorAll('.asset-block').length, id), '★사진 = 칸 2 안').toBe(1);
  const fill = await page.evaluate((id) => { const c = document.getElementById(id).querySelectorAll('.sld-cell')[1], a = c.querySelector('.asset-block'), r = c.getBoundingClientRect(), q = a.getBoundingClientRect(); return [q.left - r.left, q.top - r.top, q.width / r.width, q.height / r.height].map((v) => Math.round(v * 100) / 100); }, id);
  expect(fill, '칸 꽉(왼위 0 · 폭·높이 1)').toEqual([0, 0, 1, 1]);
  /* 막기 — 칸 자체 끌기 · ⌘G */
  const guard = await page.evaluate((id) => {
    const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1];
    const ev = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
    cell.dispatchEvent(ev);
    window.deselectAll(); cell.classList.add('selected'); window.groupSelectedBlocks?.();
    return { dragBlocked: ev.defaultPrevented, parentIsTrack: cell.parentElement?.classList.contains('sld-track'), groups: document.querySelectorAll('#canvas .frame-block[data-group="true"]').length };
  }, id);
  expect(guard, '★칸 끌기 막힘 · ⌘G 로 칸이 안 빠짐').toEqual({ dragBlocked: true, parentIsTrack: true, groups: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});
