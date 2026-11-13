/* anim-gif-rich-warn — GIF-V1 RICHTEXT(⑸ · DONE40): 글 안 조각 꾸밈은 GIF 에 안 실린다 ⇒ 지금은 모달에 한 줄 경고(지디 결정 C · 본 고침 V2).
 * R1 조각 꾸밈(색 span · 굵게 b · 형광 background-color)이 있으면 경고가 보인다
 * R2 [지킴] 꾸밈 없는 글 — 경고 없음
 * R3 [지킴] 글 요소 «자체» 색만(조각 꾸밈 아님 · GIF 에 실린다) — 경고 없음
 * 양성대조: js/animation-engine.js 만 부모 판으로 → R1 빨강 · R2·R3 초록 → git checkout HEAD -- js/animation-engine.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function openWith(page, html, ceColor) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ({ html, ceColor }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.innerHTML = html;
    if (ceColor) ce.style.color = ceColor;
    window.openAnimModal(tb);
  }, { html, ceColor });
  return errs;
}
const warn = (page) => page.locator('#anim-rich-warn');

test('R1 조각 꾸밈이 있으면 경고', async ({ page }) => {
  const errs = await openWith(page, '보통 <span style="color:#ff0000">빨강</span> <b>굵게</b> <span style="background-color:#ffff00">형광</span>');
  await expect(warn(page), '★꾸밈이 사라지는데 말이 없다').toBeVisible();
  await expect(warn(page)).toContainText('꾸밈');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R2 [지킴] 꾸밈 없는 글 — 경고 없음', async ({ page }) => {
  const errs = await openWith(page, '그냥 글자');
  await expect(page.locator('#anim-gif-modal')).toBeVisible();
  await expect(warn(page)).toBeHidden();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R3 [지킴] 글 요소 자체 색만 — 경고 없음', async ({ page }) => {
  const errs = await openWith(page, '한 색 글자', 'rgb(204, 34, 68)');
  await expect(page.locator('#anim-gif-modal')).toBeVisible();
  await expect(warn(page)).toBeHidden();
  expect(errs, errs.join(' | ')).toEqual([]);
});
