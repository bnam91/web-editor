/* toolbar-gap-entry.dom.spec.js — U17 ① (UserLens 0.9.6 ⑷3 · 지디 결정 2026-10-05): 갭 추가가 «g 키로만» 됐다(찾느라 5곳 헤맴).
 *   새: 하단 툴바 Component ▸ Divider 바로 아래 「Gap」 · 툴팁 「여백(갭) 추가 — 단축키 G」 · g 와 같은 동작(addGapBlock(undefined,{asSibling:true})).
 *   짝: U17 ② 오른클릭 「바로 아래에 여백 넣기 (G)」는 frame-drill-in.dom.spec.js(레인 E93) 쪽.
 *   g 키의 «프레임을 오브젝트로 골랐으면 다음 형제» 규칙(F1)은 frame-insert-sibling.dom.spec.js 가 잠근다 — 여기 T3 이 툴바도 같은지 잰다.
 * ★양성대조: 고치기 전 판(origin/dev 772ccadc)에선 T0 이 «Gap 항목 없음»으로 빨강 · T1~T3 은 전제에서 진다(약한 빨강 — 항목이 없어서).
 *   ⇒ «동작» 쪽 빨강은 변이로 잰다: index.html 의 Gap 항목 onclick 에서 {asSibling:true} 를 빼면 T3 만 빨강, T1·T2 초록이어야 한다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/toolbar-gap-entry.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = `
<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="inG" style="padding-left:0;padding-right:0;">
  <div class="gap-block" id="g0" data-type="gap" style="height:30px;"></div>
  <div class="frame-block" id="tfA" data-text-frame="true"><div class="text-block" id="tA" data-type="body"><div class="tb-body" contenteditable="false">가나다라마바사</div></div></div>
  <div class="row" id="rowF" data-layout="stack"><div class="frame-block" id="FR" data-full-width="true" style="width:600px;min-height:200px;"><div class="gap-block" id="kid" data-type="gap" style="height:40px;"></div></div></div>
  <div class="gap-block" id="gEnd" data-type="gap" style="height:30px;"></div>
</div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('tA').scrollIntoView({ block: 'center' });
  }, SEC);
  await waitStableRect(page, '#tA');
  await page.evaluate(() => window.clearHistory?.());
  return errs;
}
/* 섹션 직속 순서 — 처음 심은 id 는 그대로, 새로 생긴 갭은 «NEWGAP»(새 갭도 자기 id 를 받는다 — gb_…). */
const KNOWN = ['g0', 'tfA', 'rowF', 'gEnd'];
const order = (page) => page.evaluate((known) => [...document.getElementById('inG').children]
  .map(e => known.includes(e.id) ? e.id : (e.classList.contains('gap-block') ? 'NEWGAP' : `?${e.id || e.className}`)), KNOWN);
const histLen = (page) => page.evaluate(() => (window.historyStack || window.state?.historyStack || []).length);

async function selectText(page) {
  const r = await waitStableRect(page, '#tA');
  await clickAt(page, r.cx, r.cy, { sel: '[id="tA"]' }, { label: '글자 고르기' });   // 맞힌 요소는 .tb-body — 조상 tA 로 단언
  await expect.poll(() => page.evaluate(() => document.getElementById('tA').classList.contains('selected'))).toBe(true);
}
async function pickFrame(page) {
  const r = await waitStableRect(page, '#FR');
  const x = r.left + r.width * 0.85, y = r.top + r.height * 0.85;   // 자식(kid · 40px)이 없는 구석
  await clickAt(page, x, y, { sel: '[id="FR"]', not: '[id="kid"]' }, { label: '프레임 고르기' });
  await expect.poll(() => page.evaluate(() => document.getElementById('FR').classList.contains('selected'))).toBe(true);
}
async function clickToolbarGap(page) {
  const t = await waitStableRect(page, '#fp-component-dropdown .fp-dropdown-trigger');
  await clickAt(page, t.cx, t.cy, { sel: '#fp-component-dropdown .fp-dropdown-trigger' }, { label: 'Component 펼치기' });
  await expect(page.locator('#fp-component-dropdown')).toHaveClass(/open/);
  const item = page.locator('#fp-component-menu .fp-menu-item', { hasText: /^Gap$/ });
  await expect(item).toBeVisible();
  const b = await item.boundingBox();
  await clickAt(page, b.x + b.width / 2, b.y + b.height / 2, { sel: '#fp-component-menu .fp-menu-item' }, { label: 'Gap 누르기' });
}

test('T0 ★Component 메뉴에 「Gap」이 Divider 바로 아래에 있고 툴팁이 단축키 G 를 말한다', async ({ page }) => {
  const errs = await setup(page);
  const items = await page.locator('#fp-component-menu .fp-menu-item').allTextContents();
  const i = items.indexOf('Divider');
  expect(i, `Divider 가 없다: ${JSON.stringify(items)}`).toBeGreaterThanOrEqual(0);
  expect(items[i + 1], `Divider 다음이 Gap 이 아니다: ${JSON.stringify(items)}`).toBe('Gap');
  await expect(page.locator('#fp-component-menu .fp-menu-item', { hasText: /^Gap$/ })).toHaveAttribute('title', '여백(갭) 추가 — 단축키 G');
  expect(errs).toEqual([]);
});

test('T1 ★글자를 고르고 툴바 Gap → 그 글자 «바로 다음»에 갭 하나 · 메뉴 닫힘', async ({ page }) => {
  const errs = await setup(page);
  await selectText(page);
  const before = await order(page);
  expect(before, '전제: 배치').toEqual(['g0', 'tfA', 'rowF', 'gEnd']);
  await clickToolbarGap(page);
  await expect.poll(() => order(page)).toEqual(['g0', 'tfA', 'NEWGAP', 'rowF', 'gEnd']);
  await expect(page.locator('#fp-component-dropdown')).not.toHaveClass(/open/);
  expect(errs).toEqual([]);
});

test('T2 ★툴바 Gap 한 번 = ⌘Z 한 번에 정확히 되돌아간다', async ({ page }) => {
  await setup(page);
  await selectText(page);
  await clickToolbarGap(page);
  await expect.poll(() => order(page)).toEqual(['g0', 'tfA', 'NEWGAP', 'rowF', 'gEnd']);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => order(page), { message: '⌘Z 한 번에 갭이 안 빠졌다(또는 더 빠졌다)' }).toEqual(['g0', 'tfA', 'rowF', 'gEnd']);
});

test('T3 ★프레임을 오브젝트로 골라 툴바 Gap → g 키와 같이 프레임 «밖 다음 형제»(안에 안 들어감)', async ({ page }) => {
  await setup(page);
  await pickFrame(page);
  const kidsBefore = await page.evaluate(() => document.getElementById('FR').children.length);
  await clickToolbarGap(page);
  await expect.poll(() => order(page)).toEqual(['g0', 'tfA', 'rowF', 'NEWGAP', 'gEnd']);
  expect(await page.evaluate(() => document.getElementById('FR').children.length), '프레임 안으로 들어갔다').toBe(kidsBefore);
});
