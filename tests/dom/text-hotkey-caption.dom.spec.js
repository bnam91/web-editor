/* text-hotkey-caption.dom.spec.js — TEXT-HOTKEY-5-CAPTION-01: 텍스트 블럭 선택(편집 아님) + 숫자 5 = 캡션
 *   C1  텍스트 블럭 + 5 → 내용 칸 tb-caption · 블럭 dataset.type = 'caption'(패널 Cap 토글과 같은 값)
 *   C2  [지킴] 갭 블럭 + 5 → 높이 160px(갭 프리셋 분기가 먼저 먹고 끝난다)
 * 양성대조: git apply _patches/TXT5-CTL-no-digit5.patch → C1 빨강 · C2 초록 → git checkout -- js/editor.js
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/text-hotkey-caption.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sL"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60"></div></div>`;

async function fresh(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sL'));
  }, SEC);
  return errs;
}
/** 사용자처럼 한 번 눌러 고른다(편집 진입 아님) — 키는 문서 keydown 으로 가야 하니 포커스도 비운다 */
async function pick(page, sel) {
  await page.evaluate(() => window.deselectAll?.());
  const r = await waitStableRect(page, sel);
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(() => page.evaluate((sel) => !!document.querySelector(sel)?.classList.contains('selected'), sel), '[pick] 골라짐').toBe(true);   // 고정 대기 0(cand7 t11 W3·W4)
  await page.evaluate(() => document.activeElement?.blur?.());
}

test('C1 텍스트 블럭 선택 + 5 → tb-caption · dataset.type caption', async ({ page }) => {
  const errs = await fresh(page);
  await page.evaluate(() => window.addTextBlock('body'));
  const id = await page.evaluate(() => document.querySelector('#sL .text-block').id);
  await pick(page, `#${id}`);
  const pre = await page.evaluate((id) => { const tb = document.getElementById(id); return { sel: tb.classList.contains('selected'), editing: !!document.querySelector('.text-block.editing') }; }, id);
  expect(pre, '★전제: 골랐고 편집 중이 아니다').toEqual({ sel: true, editing: false });
  await page.keyboard.press('Digit5');
  /* 고정 대기 0 — 같은 단언을 «될 때까지» 잰다(뜻 무변) */
  await expect.poll(() => page.evaluate((id) => {
    const tb = document.getElementById(id);
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-caption,.tb-body');
    return { caption: ce.classList.contains('tb-caption'), body: ce.classList.contains('tb-body'), type: tb.dataset.type };
  }, id)).toEqual({ caption: true, body: false, type: 'caption' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C2 [지킴] 갭 블럭 선택 + 5 → 높이 160px', async ({ page }) => {
  const errs = await fresh(page);
  await page.evaluate(() => window.addGapBlock(40));
  const id = await page.evaluate(() => document.querySelector('#sL .gap-block').id);
  await pick(page, `#${id}`);
  const pre = await page.evaluate((id) => { const g = document.getElementById(id); return { sel: g.classList.contains('selected'), h: g.style.height }; }, id);
  expect(pre.sel, '★전제: 갭이 골라졌다').toBe(true);
  expect(pre.h, '★전제: 160 이 아닌 데서 시작').not.toBe('160px');
  await page.keyboard.press('Digit5');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).style.height, id)).toBe('160px');
  expect(errs, errs.join(' | ')).toEqual([]);
});
