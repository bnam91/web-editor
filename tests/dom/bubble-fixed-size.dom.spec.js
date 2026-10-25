/* bubble-fixed-size.dom.spec.js — 1017t1m3ⓐ 말풍선 크기 «고정» 모드 (모달 너비 고정·높이 최소 이식)
 *
 * 현빈 원문 「버블 텍스트 블럭 추가시 현재는 텍스트 길이에 따라 동적으로 … 해당 기능을 끄면 모달처럼 배경사이즈를
 *   고정해두고 조절가능하게 해줘. 👉 이거 반영이 됐는지? …」 (T0-NOTE-ORIGINAL-261025 · 1017t1m3)
 * 미카사 앱 실측(261025 · f62653ce): 버블 패널 폭 모드 칸 0 · 같은 자로 모달 패널은 「풀폭·고정·자동」 3.
 *
 * 칸
 *   P0  전제 — 말풍선이 서고 몸통 너비가 글 길이를 따른다(짧은 글 < 긴 글)
 *   F   패널 「고정」 → 몸통 너비가 지금 크기로 굳고, 긴 글을 넣어도 그 너비 그대로 · 너비 칸 400 → 몸통 400
 *   A   「자동」 → 인라인 너비가 걷히고 다시 글 길이를 따른다
 * 양성대조: GD1001_ROOT=<핀 ca702d40 사본> 이면 F 가 빨강(#bubble-size-group 0).
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js bubble-fixed-size
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SHORT = '짧은 말';
const LONG = '이 말풍선은 아주 길게 이어지는 글을 담고 있어서 자동이면 몸통이 옆으로 넓어진다';

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.applyZoom?.(100);
    window.selectSection(sec);
    window.addSpeechBubbleBlock('left');
    window.__sb = sec.querySelector('.speech-bubble-block');
  });
  await page.waitForFunction(() => !!window.__sb && !!window.__sb.querySelector('.tb-bubble'));
  return errs;
}
const setText = (page, t) => page.evaluate((t) => {
  const b = window.__sb.querySelector('.tb-bubble');
  const host = b.querySelector('[contenteditable]') || b;
  host.textContent = t; delete host.dataset.isPlaceholder;
}, t);
const bodyW = (page) => page.evaluate(() => window.__sb.querySelector('.tb-bubble').offsetWidth);
const bodyH = (page) => page.evaluate(() => window.__sb.querySelector('.tb-bubble').offsetHeight);
const openPanel = async (page) => {
  await page.evaluate(() => window.selectBlock(window.__sb.id));
  await page.waitForFunction(() => !!document.getElementById('bubble-style-section'));
};

test('P0 전제 — 자동이면 몸통 너비가 글 길이를 따른다', async ({ page }) => {
  const errs = await setup(page);
  await setText(page, SHORT); const w1 = await bodyW(page);
  await setText(page, LONG); const w2 = await bodyW(page);
  expect(w2).toBeGreaterThan(w1 + 50);
  expect(errs).toEqual([]);
});

test('F 「고정」 → 지금 너비로 굳고 긴 글에도 그대로 · 너비 칸 400 → 몸통 400', async ({ page }) => {
  const errs = await setup(page);
  /* ★앱 실측 장면 그대로 — 기본 안내문구 · 앱 기본 배율 40 (그 장면에서 실폭이 348.445 로 소수였다) */
  await page.evaluate(() => window.applyZoom?.(40));
  const frac = await page.evaluate(() => { const b = window.__sb.querySelector('.tb-bubble'); const cs = getComputedStyle(b); return parseFloat(cs.width) % 1; });
  expect(frac, '전제: 실폭이 정수가 아닌 장면이어야 이 칸이 «깎기» 를 잡는다').toBeGreaterThan(0.01);
  await openPanel(page);
  const w0 = await bodyW(page);
  const h0 = await bodyH(page);
  expect(await page.locator('#bubble-size-group [data-bsz="fixed"]').count()).toBe(1);
  await page.click('#bubble-size-group [data-bsz="fixed"]');
  await page.waitForFunction(() => window.__sb.dataset.bubbleSize === 'fixed');
  expect(Math.abs((await bodyW(page)) - w0)).toBeLessThanOrEqual(1);
  /* ★누르는 순간 모양이 안 튄다 — 높이도 그대로(앱 실측 261026: 정수로 깎은 너비 348 < 실폭 348.445 ⇒ 줄이 꺾여 70→112 로 튀었다) */
  expect(Math.abs((await bodyH(page)) - h0)).toBeLessThanOrEqual(1);
  await setText(page, LONG);
  expect(Math.abs((await bodyW(page)) - w0)).toBeLessThanOrEqual(1);
  await page.fill('#bubble-w-number', '400');
  await page.dispatchEvent('#bubble-w-number', 'change');
  await page.waitForFunction(() => window.__sb.querySelector('.tb-bubble').offsetWidth === 400);
  const r = await page.evaluate(() => ({ ds: window.__sb.dataset.bubbleW, minH: parseInt(window.__sb.querySelector('.tb-bubble').style.minHeight, 10) > 0 }));
  expect(r).toEqual({ ds: '400', minH: true });
  expect(errs).toEqual([]);
});

test('A 「자동」 → 인라인 너비가 걷히고 다시 글 길이를 따른다', async ({ page }) => {
  const errs = await setup(page);
  await setText(page, SHORT);
  await openPanel(page);
  await page.click('#bubble-size-group [data-bsz="fixed"]');
  await page.waitForFunction(() => window.__sb.dataset.bubbleSize === 'fixed');
  await page.click('#bubble-size-group [data-bsz="auto"]');
  await page.waitForFunction(() => window.__sb.dataset.bubbleSize === undefined);
  const inline = await page.evaluate(() => window.__sb.querySelector('.tb-bubble').style.width);
  expect(inline).toBe('');
  const w1 = await bodyW(page);
  await setText(page, LONG);
  expect(await bodyW(page)).toBeGreaterThan(w1 + 50);
  expect(errs).toEqual([]);
});
