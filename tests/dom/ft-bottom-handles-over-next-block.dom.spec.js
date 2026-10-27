/* ft-bottom-handles-over-next-block.dom.spec.js — FT-BOTTOM-CORNER-HANDLE-UNDER-GLYPH-01
 * 자유변형 글상자의 아래 손잡이(se·sw·s1·s2)가 «바로 아래 글상자»에 덮여 못 잡히던 것.
 * 미카사 앱 실측(261026 · d772f49e ×3): 그 점의 스택 = 아래 글상자 글자칸(0) · 그 .text-block z2(1) · FT 손잡이(2).
 *   까닭: 손잡이는 글상자 안(.tfh-layer)에 산다 · 아래 글상자는 같은 쌓임맥락에 z 2 · DOM 뒤 ⇒ 위에 그려진다.
 * 칸
 *   P0  전제 — 섹션에 글상자 둘(위·아래) · 위 글상자에 자유변형 · 아래 손잡이가 아래 글상자 상자와 «겹친다»(좌표)
 *   H   마우스를 아래 손잡이 넷(se·sw·s1·s2) 위에 올리면 그 점의 임자 = 그 손잡이
 *   D   se 를 진짜로 (+20,+15) 끌면 네 점의 se 가 바뀐다
 *   N   위 글상자를 안 고르면 그 글자 프레임은 z 무변(2 아님 · 원래 값 그대로)
 * 양성대조: GD1001_ROOT=<핀 d772f49e 사본> ⇒ H·D 빨강.
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec);
    window.addTextBlock('h1', { content: '아래 글상자' });
    window.applyZoom?.(40);
    const tbs = [...sec.querySelectorAll('.text-block')];
    window.__top = tbs[0]; window.__below = tbs[tbs.length - 1];
    window.__top.scrollIntoView({ block: 'center' });
    window.selectBlock(window.__top.id);
  });
  await page.waitForFunction(() => !!document.getElementById('txt-fx-add'));
  await page.selectOption('#txt-fx-add', 'freetransform');
  await page.waitForFunction(() => window.__top.querySelectorAll('.tfh-handle').length === 12);
  return errs;
}
const handleAt = (page, n) => page.evaluate((n) => { const h = window.__top.querySelector(`.tfh-handle[data-tfh="${n}"]`); const r = h.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, n);

test('P0 전제 — 위 글상자 아래 손잡이가 아래 글상자 상자와 겹친다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => { const b = window.__below.getBoundingClientRect(); const h = window.__top.querySelector('.tfh-handle[data-tfh="se"]').getBoundingClientRect(); return { overlap: h.bottom > b.top && h.top < b.bottom, below: window.__below !== window.__top }; });
  expect(r).toEqual({ overlap: true, below: true });
  expect(errs).toEqual([]);
});

test('H 아래 손잡이 넷 — 마우스를 올린 점의 임자 = 그 손잡이', async ({ page }) => {
  const errs = await setup(page);
  const out = [];
  for (const n of ['se', 'sw', 's1', 's2']) {
    const p = await handleAt(page, n);
    await page.mouse.move(p[0], p[1]);
    out.push(await page.evaluate(([n, x, y]) => document.elementFromPoint(x, y)?.dataset?.tfh || null, [n, p[0], p[1]]));
  }
  expect(out).toEqual(['se', 'sw', 's1', 's2']);
  expect(errs).toEqual([]);
});

test('D se 를 진짜로 끌면 네 점의 se 가 바뀐다', async ({ page }) => {
  const errs = await setup(page);
  const c0 = await page.evaluate(() => window.__top.dataset.tfCorners);
  const p = await handleAt(page, 'se');
  await page.mouse.move(p[0], p[1]); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(p[0] + 20 * i / 6, p[1] + 15 * i / 6);
  await page.mouse.up();
  await page.waitForFunction((c0) => window.__top.dataset.tfCorners !== c0, c0, { timeout: 5000 });
  const c1 = (await page.evaluate(() => window.__top.dataset.tfCorners)).split(',').map(Number);
  const c = c0.split(',').map(Number);
  expect(c1[4]).toBeGreaterThan(c[4] + 10);
  expect(errs).toEqual([]);
});

test('N 안 고르면 글자 프레임 z 는 원래 값', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.deselectAll?.());
  await page.waitForFunction(() => !window.__top.classList.contains('selected'));
  const z = await page.evaluate(() => getComputedStyle(window.__top.closest('.frame-block[data-text-frame]')).zIndex);
  expect(z).not.toBe('3');
  expect(errs).toEqual([]);
});
