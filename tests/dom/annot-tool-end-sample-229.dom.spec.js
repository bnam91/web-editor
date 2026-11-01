/* annot-tool-end-sample-229.dom.spec.js — 시트 229 TOOL-PATH-FIRST-EDIT-UNDO-DELETES-BLOCK-01
 *   증상(앱 ×3 · 2b7aec4d): 두 점+Esc·V 로 끝낸 치수선·펜 어노테이션 → 패널 첫 바꿈 → ⌘Z ⇒ 블럭이 통째로 사라진다 · 그 뒤 새 편집이면 redo 도 끊긴다.
 *   뿌리: js/annotation-tool.js _finalizeAnnotation 은 만들기 «전»만 찍었다. 세 클릭 길은 annotBeginLabelEdit 의 체크포인트가 대신 찍어 안 잼.
 *   칸: E1 치수 두 점+Esc · E2 치수 두 점+V · E3 펜 두 점+Esc — 첫 ⌘Z 는 바꿈만 · 다음 ⌘Z 는 만들기 · ⌘⇧Z 로 돌아옴
 *       E4 치수 두 점+Esc → 바꿈 → ⌘Z → 새 섹션 → 블럭이 남아 있다
 *       E5 치수 두 점+Esc → 곧바로 ⌘Z 한 번 — 블럭이 사라진다(먹통 한 칸 금지 · 앱에서 잡은 첫 고침의 흠)
 *         ⚠️안 잠근 것: 그 칸에 미리보기(.annot-preview)가 찍혀 ⌘Z 뒤 캔버스에 남는다 — 고치기 전에도 같다(앱 ×3) · 이 줄 몫 아님
 *       N1 [음성대조] 세 클릭 치수선 — 고치기 전에도 초록
 *   양성대조: 끝 표본 한 줄을 걷으면 E1·E2·E3·E4 빨강 · E5·N1 초록(E5 는 표본을 미리보기 앞으로 옮기면 빨강).
 *   장면 준비만 evaluate — 만들기·고르기·바꾸기·⌘Z 는 진짜 마우스·키. ⛔고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const B = '#canvas .annotation-block';
const state = (page) => page.evaluate((B) => { const a = document.querySelector(B); return { n: document.querySelectorAll(B).length, sw: a ? a.dataset.strokeWidth || null : null, secs: document.querySelectorAll('#canvas > .section-block').length }; }, B);

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = '<div class="section-block" id="secA" style="position:relative;height:520px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.(); window.clearHistory?.(); window.applyZoom?.(100); window.deselectAll?.();
    document.getElementById('secA').scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  return { errs, sr: await waitStableRect(page, '#secA') };
}
/* 끝내기: 'Escape' | 'v' | 'three' */
async function make(page, sr, tool, end) {
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click(`#fp-pen-menu .fp-menu-item[onclick*="${tool}"]`);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), '[전제] 펜 모드').toBe(true);
  const y = sr.top + sr.height * 0.6, P = [[sr.left + sr.width * 0.25, y], [sr.left + sr.width * 0.75, y]];
  for (const [k, q] of P.entries()) {
    await page.mouse.click(q[0], q[1]);
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.annot-preview .annot-preview-dot').length), `[전제] 점 ${k + 1}`).toBeGreaterThanOrEqual(k + 1);
  }
  const label = () => page.evaluate((B) => { const l = document.querySelector(B + ' .annot-label'); return !!l && l.getAttribute('contenteditable') === 'true' && document.activeElement === l; }, B);
  if (end === 'three') {
    await page.mouse.click(sr.left + sr.width * 0.5, sr.top + sr.height * 0.3);
    await expect.poll(label, '[전제] 라벨 편집').toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(label, '[전제] 라벨 편집 나옴').toBe(false);
  }
  await page.keyboard.press(end === 'three' ? 'Escape' : end);
  await expect.poll(() => state(page).then(s => s.n), '[전제] 블럭 생김').toBe(1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), '[전제] 펜 꺼짐').toBe(false);
}
async function pickAndEdit(page) {
  const r = await waitStableRect(page, B + ' .annot-label');
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(() => page.evaluate(() => !!document.getElementById('annot-stroke-w-num')), '[전제] 패널').toBe(true);
  const sw0 = (await state(page)).sw;
  await page.click('#annot-stroke-w-num', { clickCount: 3 });
  await page.keyboard.press('Meta+A'); await page.keyboard.type('5'); await page.keyboard.press('Tab');
  await expect.poll(() => state(page).then(s => s.sw), '[전제] 두께 5').toBe('5');
  return sw0;
}
const key = async (page, k) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press(k); };

for (const [name, tool, end] of [['E1 치수 두 점+Esc', 'toggleDimMode', 'Escape'], ['E2 치수 두 점+V', 'toggleDimMode', 'v'], ['E3 펜 두 점+Esc', 'togglePenMode', 'Escape'], ['N1 [음성대조] 치수 세 클릭', 'toggleDimMode', 'three']]) {
  test(`${name} — 첫 ⌘Z 는 바꿈만 · 다음 ⌘Z 는 만들기 · ⌘⇧Z 로 돌아온다`, async ({ page }) => {
    const { errs, sr } = await setup(page);
    await make(page, sr, tool, end);
    const sw0 = await pickAndEdit(page);
    await key(page, 'Meta+z');
    await expect.poll(() => state(page).then(s => s.sw), '★첫 ⌘Z 뒤 블럭이 남고 값만 돌아온다').toBe(sw0);
    expect((await state(page)).n).toBe(1);
    await key(page, 'Meta+z');
    await expect.poll(() => state(page).then(s => s.n), '★다음 ⌘Z 가 만들기를 되돌린다').toBe(0);
    await key(page, 'Meta+Shift+z');
    await expect.poll(() => state(page).then(s => s.n), '★⌘⇧Z 로 돌아온다').toBe(1);
    expect(errs).toEqual([]);
  });
}
test('E4 치수 두 점+Esc → 바꿈 → ⌘Z → 새 섹션 — 블럭이 남는다(redo 끊겨 영구 손실이던 길)', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await make(page, sr, 'toggleDimMode', 'Escape');
  const sw0 = await pickAndEdit(page);
  await key(page, 'Meta+z');
  await expect.poll(() => state(page).then(s => s.sw), '★첫 ⌘Z 뒤 값').toBe(sw0);
  const secs = (await state(page)).secs;
  await page.click('button.fp-btn.primary[onclick="addSection()"]');
  await expect.poll(() => state(page).then(s => s.secs), '[전제] 새 편집').toBe(secs + 1);
  expect((await state(page)).n, '★새 편집 뒤에도 블럭').toBe(1);
  expect(errs).toEqual([]);
});
test('E5 치수 두 점+Esc → 곧바로 ⌘Z 한 번 — 블럭이 사라진다(먹통 한 칸 금지)', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await make(page, sr, 'toggleDimMode', 'Escape');
  await key(page, 'Meta+z');
  await expect.poll(() => state(page).then(s => s.n), '★⌘Z 한 번에 만들기가 되돌아간다').toBe(0);
  await key(page, 'Meta+Shift+z');
  await expect.poll(() => state(page).then(s => s.n), '★⌘⇧Z 로 돌아온다').toBe(1);
  expect(errs).toEqual([]);
});
