/* quote-to-text-back.dom.spec.js — 1017t1m1ⓑ Quote → 텍스트 «되돌림» 단추
 *
 * 현빈 원문 「👉 되돌리기도 가능하게 해줄래? 그럴순 없나?」 (T0-NOTE-ORIGINAL-261025 · 1017t1m1)
 * 미카사 앱 실측(261025 · f62653ce): ⌘Z 는 되돌린다 · Quote 패널에 텍스트로 가는 단추 0.
 *
 * 칸
 *   P0  전제 — 텍스트 블럭 패널의 「Quote」로 정말 인용구가 된다(글 그대로) · 그때 패널이 인용구 패널이다
 *   B   인용구 패널의 「Text」 → 텍스트 블럭 하나로 돌아오고 글(두 줄)이 그대로 · 인용구 0 · 새 블럭이 골라진다
 *   U   그 뒤 ⌘Z → 인용구로 돌아온다(push-before 한 칸)
 * 양성대조: GD1001_ROOT=<핀 ca702d40 사본> 이면 B 가 빨강(단추가 없다).
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js quote-to-text-back
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TEXT = '되돌리기 글\n둘째 줄';

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((text) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    sec.querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());   /* 새 섹션의 기본 제목 — 이 칸의 셈 밖 */
    window.selectSection(sec);
    window.addTextBlock('body', { content: text });
    window.__sec = sec;
  }, TEXT);
  await page.waitForFunction(() => !!document.querySelector('.section-block .text-block'));
  return errs;
}
const count = (page) => page.evaluate(() => {
  const sec = window.__sec;
  const tb = sec.querySelector('.text-block');
  const ce = tb && (tb.querySelector('[contenteditable]') || tb.querySelector('[class^="tb-"]'));
  return {
    text: sec.querySelectorAll('.text-block').length,
    quote: sec.querySelectorAll('.quote-block').length,
    tbText: ce ? ce.innerText.replace(/\r\n?/g, '\n') : null,
    quoteText: sec.querySelector('.quote-block')?.dataset.text ?? null,
    selectedText: !!(tb && tb.classList.contains('selected')),
  };
});

async function toQuote(page) {
  await page.evaluate(() => { const tb = window.__sec.querySelector('.text-block'); window.selectBlock(tb.id); });
  await page.waitForFunction(() => !!document.getElementById('txt-to-quote'));
  await page.click('#txt-to-quote');
  await page.waitForFunction(() => window.__sec.querySelectorAll('.quote-block').length === 1);
}

test('P0 전제 — 「Quote」로 인용구가 되고 패널이 인용구 패널이다', async ({ page }) => {
  const errs = await setup(page);
  const before = await count(page);
  expect(before).toMatchObject({ text: 1, quote: 0, tbText: TEXT });
  await toQuote(page);
  const after = await count(page);
  expect(after).toMatchObject({ text: 0, quote: 1, quoteText: TEXT });
  expect(await page.evaluate(() => !!document.getElementById('qt-shape-group'))).toBe(true);
  expect(errs).toEqual([]);
});

test('B 인용구 패널 「Text」 → 텍스트 블럭 하나 · 글 두 줄 그대로 · 인용구 0 · 새 블럭이 골라진다', async ({ page }) => {
  const errs = await setup(page);
  await toQuote(page);
  await page.waitForFunction(() => !!document.getElementById('qt-shape-group'));
  expect(await page.locator('#qt-to-text').count()).toBe(1);
  await page.click('#qt-to-text');
  await page.waitForFunction(() => window.__sec.querySelectorAll('.text-block').length === 1);
  const r = await count(page);
  expect(r).toMatchObject({ text: 1, quote: 0, tbText: TEXT, selectedText: true });
  expect(errs).toEqual([]);
});

test('U 그 뒤 ⌘Z → 인용구로 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  await toQuote(page);
  await page.waitForFunction(() => !!document.getElementById('qt-shape-group'));
  await page.click('#qt-to-text');
  await page.waitForFunction(() => window.__sec.querySelectorAll('.text-block').length === 1);
  await page.evaluate(() => { document.activeElement?.blur?.(); window.undo(); });
  await page.waitForFunction(() => document.querySelectorAll('.section-block .quote-block').length === 1);
  const r = await page.evaluate(() => ({ quote: document.querySelectorAll('.section-block .quote-block').length, text: document.querySelectorAll('.section-block .text-block').length, quoteText: document.querySelector('.section-block .quote-block').dataset.text }));
  expect(r).toEqual({ quote: 1, text: 0, quoteText: TEXT });
  expect(errs).toEqual([]);
});
