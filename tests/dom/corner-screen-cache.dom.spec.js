/* corner-screen-cache.dom.spec.js — 대성 P1.5(261125 · 인텔 trace S8: 끄는 중 selection-overlay _frame → _cornerScreen 강제 재계산 15회·113ms)
 *   js/overlay-handles.js _cornerRect: HTML5 끌기 동안만 블럭마다 상자 사각형을 한 번 재고 다시 씀 · 끌기 밖 = 매번 잼(회귀 0)
 *   CC1 끄는 동안 같은 el 에 getBoundingClientRect 1번 · CC2 dragend 뒤 다시 매번 · CC3 끄는 중 scroll 뒤 새로 잼
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/corner-screen-cache.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    /* 앱이 «안» 재는 우리 요소 — 고른 블럭을 쓰면 선택 오버레이가 제 박자로 getBCR 을 불러 셈이 섞인다(실측 CC0 = 51) */
    const el = document.createElement('div'); el.style.cssText = 'position:fixed;left:40px;top:40px;width:100px;height:60px'; document.body.appendChild(el);
    let n = 0; const orig = el.getBoundingClientRect.bind(el);
    el.getBoundingClientRect = () => { n++; return orig(); };
    window.__cc = { el, n: () => n, mod: await import('/js/overlay-handles.js') };
  });
  return errs;
}
const calls = (page, k) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__cc.mod._cornerScreen(window.__cc.el, 'nw'); return window.__cc.n(); }, k);
const fire = (page, type) => page.evaluate((t) => document.dispatchEvent(new Event(t, { bubbles: true })), type);

test('CC0 끌기 밖 = 부를 때마다 잰다(회귀 0)', async ({ page }) => {
  const errs = await scene(page);
  expect(await calls(page, 3)).toBe(3);
  expect(errs).toEqual([]);
});

test('CC1 끄는 동안(dragstart 뒤) 같은 el 은 한 번만 잰다', async ({ page }) => {
  const errs = await scene(page);
  await fire(page, 'dragstart');
  expect(await calls(page, 5)).toBe(1);
  expect(errs).toEqual([]);
});

test('CC2 dragend 뒤엔 다시 매번 잰다', async ({ page }) => {
  const errs = await scene(page);
  await fire(page, 'dragstart');
  await calls(page, 3);
  await fire(page, 'dragend');
  expect(await calls(page, 2)).toBe(1 + 2);
  expect(errs).toEqual([]);
});

test('CC3 끄는 중 scroll 뒤엔 새로 잰다(가장자리 자동 스크롤이 화면 자리를 옮김)', async ({ page }) => {
  const errs = await scene(page);
  await fire(page, 'dragstart');
  await calls(page, 2);
  await fire(page, 'scroll');
  expect(await calls(page, 2)).toBe(1 + 1);
  await fire(page, 'dragend');
  expect(errs).toEqual([]);
});
