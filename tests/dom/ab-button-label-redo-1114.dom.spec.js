/* ab-button-label-redo-1114.dom.spec.js — T906-AB-BUTTON-LABEL-AFTER-REDO-01 (0.9.13 당김 · 현빈 GO · 261114)
 *   증상(S7 t906 · 56칸 · 한 원인): A/B 만들기 → ⌘Z → ⌘⇧Z 뒤 원래 섹션(A) 단추 글자·title 이 «만든 직후»와 다르다(▷ A ↔ ▷ B) · data-* 상태는 같다.
 *   뿌리(읽기): 틀린 쪽은 redo 가 아니라 «만든 직후»다. js/section-variation.js createVariation 이 A 단추를 그룹이 «하나»일 때
 *     묶어 (0+1)%1 = ▷ A 가 남고, 사본만 다시 묶었다. ⌘Z·⌘⇧Z 는 rebindAll 로 둘 다 다시 묶어 맞는 «▷ B» 가 된다 ⇒ 차이 = redo 빨강.
 *   고침: 사본을 넣은 뒤 sec 도 다시 묶는다(addVariation·toggleVariation 은 이미 그룹 전부를 다시 묶는다).
 * 칸
 *   C1 만든 직후 — A 단추 «▷ B»·title «B안으로 전환» · B 단추 «▷ A»
 *   C2 ⌘Z → ⌘⇧Z 뒤 두 단추 글자·title 이 만든 직후와 같다(t906 의 판정 축)
 *   N1 음성 — ⌘Z 뒤 원래 섹션 단추는 «A/B»(베리에이션 없음)
 * 양성대조: section-variation.js createVariation 의 새 줄 `bindVariationToolbarBtn(sec);`(사본 묶기 다음 줄)을 지우면 C1·C2 빨강 · N1 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    document.getElementById('canvas').querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();                         // 앱 입구 — 툴바(A/B 단추)까지 붙은 섹션
    window.clearHistory?.(); window.applyZoom?.(100); window.deselectAll?.();
  });
  return errs;
}
const btns = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas > .section-block')].map(s => {
  const b = s.querySelector('.section-toolbar .st-ab-btn');
  return { v: s.dataset.variation || null, text: b?.textContent ?? null, title: b?.title ?? null };
}));
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

test('C1·C2 만든 직후 A=▷ B · B=▷ A · ⌘Z→⌘⇧Z 뒤에도 같다', async ({ page }) => {
  const errs = await setup(page);
  expect((await btns(page))[0].text, '[전제] 베리에이션 없는 단추').toBe('A/B');
  await page.evaluate(() => { const s = document.querySelector('#canvas > .section-block'); window.selectSection?.(s); window.createVariation(s); });
  await settle(page);
  const made = await btns(page);
  expect(made, '★만든 직후 A 단추가 틀렸다(그룹 하나일 때 묶임)').toEqual([
    { v: 'A', text: '▷ B', title: 'B안으로 전환' },
    { v: 'B', text: '▷ A', title: 'A안으로 전환' },
  ]);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => btns(page).then(b => b.length), '[전제] ⌘Z = 섹션 하나').toBe(1);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => btns(page), '★⌘⇧Z 뒤 단추가 만든 직후와 다르다').toEqual(made);
  expect(errs).toEqual([]);
});

test('N1 음성 — ⌘Z 뒤 원래 섹션 단추는 «A/B»', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const s = document.querySelector('#canvas > .section-block'); window.selectSection?.(s); window.createVariation(s); });
  await settle(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => btns(page)).toEqual([{ v: null, text: 'A/B', title: 'A/B 베리에이션 생성' }]);
  expect(errs).toEqual([]);
});
