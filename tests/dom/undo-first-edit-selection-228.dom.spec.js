/* undo-first-edit-selection-228.dom.spec.js — 시트 228(S6 222 곁 관찰 · 지디 «222 와 따로 · 한 쌍»)
 *   증상: 블록을 고른 뒤 «첫» 바꿈(패널 칸 · 바꾼 «뒤» 쌓는 꼴 push-after) → ⌘Z ⇒ 값은 돌아오는데 고름이 풀린다. 일반 블록 공통.
 *   읽은 뿌리(js/history.js): ⌘Z 가 되살리는 고름은 «돌아가는 칸»에 적힌 고름(_restoreSelection(snap.selection))이다 —
 *     첫 바꿈의 돌아가는 칸은 «고르기 전»에 쌓인 칸이라 selection 이 비어 있다. 둘째 바꿈부터는 돌아가는 칸이 고른 채 쌓여 고름이 남는다.
 * 칸(지디 «한 쌍» — 둘 같이)
 *   P1 ★고른 뒤 첫 바꿈(갭 높이 칸) → ⌘Z — 고름·패널(#gap-number)이 남는다
 *   N1 [음성대조] 같은 ⌘Z 뒤 값이 «참으로» 고르기 전 값이다(높이 = 처음 높이 · 꼭대기 = 처음 칸) — 고름을 지키려다 값 되돌림을 깨면 빨강
 *   G1 (지킴) 둘째 바꿈 → ⌘Z — 고름이 남는다(돌아가는 칸이 고른 채 쌓였다 · 고치기 전에도 초록)
 * 고르기 = 갭 실클릭 · 칸 = 실제 입력 + change · ⌘Z = 실제 키. ⛔고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="uS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" id="uG" style="height:80px"></div></div></div>');
    window.rebindAll?.(); window.deselectAll?.(); window.clearHistory?.();
    document.getElementById('uS').scrollIntoView({ block: 'center' });
  });
  return errs;
}
const state = (page) => page.evaluate(() => {
  const g = document.getElementById('uG');
  return { h: g ? g.style.height : null, sel: !!(g && g.classList.contains('selected')), panel: !!document.getElementById('gap-number'), tip: window.getHistoryTip?.() };
});
async function pick(page) {
  const r = await waitStableRect(page, '#uG');
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(() => state(page).then(s => s.sel && s.panel), '[전제] 갭을 골랐고 패널이 열렸다').toBe(true);
}
async function setH(page, v) {
  await page.fill('#gap-number', String(v));
  await page.dispatchEvent('#gap-number', 'change');
  await expect.poll(() => state(page).then(s => s.h), `[전제] 높이 ${v}`).toBe(v + 'px');
}
async function undo(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
}

test('P1 ★고른 뒤 첫 바꿈 → ⌘Z — 고름·패널이 남는다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page);
  await setH(page, 120);
  await undo(page);
  await expect.poll(() => state(page).then(s => s.h), '[전제] ⌘Z 로 높이가 돌아왔다').toBe('80px');
  const s = await state(page);
  console.log('[P1] ' + JSON.stringify(s));
  expect({ sel: s.sel, panel: s.panel }, `★첫 바꿈 ⌘Z 뒤 고름·패널 ${JSON.stringify(s)}`).toEqual({ sel: true, panel: true });
  expect(errs).toEqual([]);
});

test('N1 [음성대조] 같은 ⌘Z 뒤 값이 참으로 고르기 전 값이다 — 높이 · 꼭대기', async ({ page }) => {
  const errs = await setup(page);
  const tip0 = (await state(page)).tip;
  await pick(page);
  await setH(page, 120);
  await undo(page);
  await expect.poll(() => state(page).then(s => s.h), '⌘Z 로 높이가 처음 값').toBe('80px');
  const s = await state(page);
  console.log('[N1] ' + JSON.stringify({ tip0, s }));
  expect({ pos: s.tip.pos, action: s.tip.action }, '꼭대기 = 고르기 전 처음 칸').toEqual({ pos: tip0.pos, action: tip0.action });
  expect(await page.evaluate(() => document.querySelectorAll('#uS .gap-block').length), '블록 수 그대로').toBe(1);
  expect(errs).toEqual([]);
});

test('G1 (지킴) 둘째 바꿈 → ⌘Z — 고름이 남는다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page);
  await setH(page, 120);
  await setH(page, 160);
  await undo(page);
  await expect.poll(() => state(page).then(s => s.h), '[전제] ⌘Z 로 120').toBe('120px');
  const s = await state(page);
  console.log('[G1] ' + JSON.stringify(s));
  expect({ sel: s.sel, panel: s.panel }).toEqual({ sel: true, panel: true });
  expect(errs).toEqual([]);
});
