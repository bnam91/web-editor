/* card-text-fold-a11y-undo.dom.spec.js — 심플카드 «카드 글» 접기(U3: 자작 머리 → 공용 disclosureSectionHtml + discSec).
 * K1 [평가 F7] 머리는 role=button·tabindex=0 — Enter 로 펼치고 Space 로 접는다 · 다시 그린 뒤에도 포커스가 그 머리에 남는다.
 *   양성대조: prop-simple-card.js 의 cardItemsEl keydown 위임을 지우면 K1 빨강(Enter 가 아무것도 안 한다).
 * U1 [평가 추가] 카드 1 펼침 → 다른 칸 편집(이력 한 걸음) → ⌘Z — 블록이 «같은 id 새 요소»로 갈려도 카드 1 펼침 · 카드 0 접힘 그대로.
 *   양성대조: 접기 상태를 옛 요소 키 WeakMap(_cvbExpandedCards)으로 되돌리면 U1 빨강(⌘Z 뒤 카드 1 이 도로 접힌다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sK" data-section="1" data-name="sK"><div class="section-hitzone"></div><div class="section-inner"><div id="slotK"></div></div></div>`;

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate((sec) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    const made = window.makeCanvasBlock({ cardMode: 'simple' });
    made.block.id = 'cvb_fold1';
    made.block.dataset.cards = JSON.stringify([{ title: '하나', desc: '일' }, { title: '둘', desc: '이' }]);
    document.getElementById('slotK').replaceWith(made.row);
    window.rebindAll?.(); window.renderCanvas?.(made.block); window.deselectAll?.();
    window.selectBlock?.(made.block.id);
    window.showSimpleCardProperties(made.block);
    return made.block.id;
  }, SEC);
  await expect(page.locator('#cvb-card-text-head-1'), '전제: 카드 1 글 접기 머리').toHaveCount(1);
  return { errs, id };
}
const open = (page) => page.evaluate(() => [0, 1].map((i) => !!document.querySelector(`.cvb-card-item[data-card-index="${i}"] textarea`)));

test('K1 키보드 — Enter 로 펼치고 Space 로 접는다 · 포커스는 머리에 남는다', async ({ page }) => {
  const s = await scene(page);
  expect(await open(page), '전제: 글 있는 카드는 기본 접힘').toEqual([false, false]);
  await page.focus('#cvb-card-text-head-1');
  await page.keyboard.press('Enter');
  expect(await open(page), 'Enter → 카드 1 만 펼침').toEqual([false, true]);
  expect(await page.evaluate(() => document.activeElement?.id), '다시 그린 뒤 포커스').toBe('cvb-card-text-head-1');
  await page.keyboard.press(' ');
  expect(await open(page), 'Space → 다시 접힘').toEqual([false, false]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('U1 카드 1 펼침 → 간격 편집 → ⌘Z — 카드 1 펼침 · 카드 0 접힘 그대로', async ({ page }) => {
  const s = await scene(page);
  await page.locator('#cvb-card-text-head-1').click();
  expect(await open(page), '전제: 카드 1 펼침').toEqual([false, true]);
  const gap0 = await page.evaluate((id) => document.getElementById(id).dataset.cardGap ?? '', s.id);
  const el0 = await page.evaluateHandle((id) => document.getElementById(id), s.id);
  await page.locator('#cvb-gap-number').fill('30');
  await page.locator('#cvb-gap-number').press('Enter');
  await page.evaluate(() => document.activeElement?.blur?.());
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.cardGap, s.id)).toBe('30');
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.dataset.cardGap ?? '', s.id)).toBe(gap0);
  const replaced = await page.evaluate(([el, id]) => el !== document.getElementById(id), [el0, s.id]);
  expect(replaced, '전제: ⌘Z 가 블록을 같은 id 새 요소로 갈았다(갈지 않으면 이 검사는 공짜 초록)').toBe(true);
  /* 새 요소로 패널을 다시 연다 — 재는 것은 접기 «저장소»(블록 id 별)지 ⌘Z 의 재렌더 여부가 아니다 */
  await page.evaluate((id) => window.showSimpleCardProperties(document.getElementById(id)), s.id);
  expect(await open(page), '★⌘Z 뒤 카드 1 펼침 · 카드 0 접힘').toEqual([false, true]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
