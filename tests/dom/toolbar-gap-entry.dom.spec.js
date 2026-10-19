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
/* ★★261019 현빈 — 「★컴퍼넌트 패널에서 ★gap 블럭 버튼은 ★숨기기 해줘. ★주로 단축키로 눌러서 ★안보여도 될듯해.」
   ⇒ ★index.html 의 ★Gap 항목을 ★주석으로 ★숨겼다. ★★기능(g 키)은 ★그대로다.
   ⇒ ★★그래서 ★동작 검사(T1·T2)는 ★★«툴바 클릭»에서 ★★«g 키»로 ★갈았다 — ★잠그는 것은 ★같다.
   ⛔이 파일을 ★통째로 ★지우지 ★않았다: ★「글자 다음에 ★갭 하나」·「⌘Z ★한 번」은 ★여전히 ★값이 있다. */
async function pressGapKey(page) {
  await page.keyboard.press('g');
}


test('T0 ★Component 메뉴에 「Gap」 항목이 ★없다 — 단축키 G 로만 넣는다(261019 현빈)', async ({ page }) => {
  const errs = await setup(page);
  const items = await page.locator('#fp-component-menu .fp-menu-item').allTextContents();
  // ★★양성대조 — ★메뉴 자체는 ★살아 있다(★「0건」이 ★«메뉴를 못 찾아서»가 ★아님을 ★먼저 ★보인다)
  expect(items.length, `Component 메뉴가 비었다 — 선택자가 죽었나: ${JSON.stringify(items)}`).toBeGreaterThan(3);
  expect(items, 'Divider 는 있어야 한다(메뉴가 멀쩡하다는 증거)').toContain('Divider');
  // ★본 단언 — ★Gap 이 ★없다
  expect(items, `Gap 항목이 아직 있다: ${JSON.stringify(items)}`).not.toContain('Gap');
  await expect(page.locator('#fp-component-menu .fp-menu-item', { hasText: /^Gap$/ })).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('T1 ★글자를 고르고 ★g → 그 글자 «바로 다음»에 갭 하나', async ({ page }) => {
  const errs = await setup(page);
  await selectText(page);
  const before = await order(page);
  expect(before, '전제: 배치').toEqual(['g0', 'tfA', 'rowF', 'gEnd']);
  await pressGapKey(page);
  await expect.poll(() => order(page)).toEqual(['g0', 'tfA', 'NEWGAP', 'rowF', 'gEnd']);
  expect(errs).toEqual([]);
});

test('T2 ★g 한 번 = ⌘Z 한 번에 정확히 되돌아간다', async ({ page }) => {
  await setup(page);
  await selectText(page);
  await pressGapKey(page);
  await expect.poll(() => order(page)).toEqual(['g0', 'tfA', 'NEWGAP', 'rowF', 'gEnd']);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => order(page), { message: '⌘Z 한 번에 갭이 안 빠졌다(또는 더 빠졌다)' }).toEqual(['g0', 'tfA', 'rowF', 'gEnd']);
});

/* ⛔★★T3 삭제 (261019) — 「★프레임을 오브젝트로 골라 ★툴바 Gap → ★g 키와 ★같이 ★밖 다음 형제」
     ★이 검사의 값은 ★★«툴바가 ★g 키와 ★같은가»였다. ★★툴바 입구가 ★없어졌으므로 ★잴 대상이 ★사라졌다.
     ★g 키 자신의 ★그 규칙(F1)은 ★★`frame-insert-sibling.dom.spec.js` 가 ★잠근다 —
       ★이 파일 ★머리 주석이 ★처음부터 ★그렇게 적어 뒀다("여기 T3 이 ★툴바도 ★같은지 ★잰다").
     ⇒ ★★중복이라 ★지웠다. ⛔조용히 ★지우지 ★않고 ★이 비석을 ★남긴다. */
