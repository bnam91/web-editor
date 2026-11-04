/* 섹션 바닥 손잡이 — 섹션이 들어오는 즉시 붙는다(1.2s 주기 훑기를 없앴다).
   변이: js/section-bottom-handle.js 의 관찰을 setInterval(sweep, 1200) 으로 되돌리면 H1·H2·H3 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const missingNextTask = (page, act) => page.evaluate(async (act) => {
  const c = document.getElementById('canvas');
  new Function('c', act)(c);
  await new Promise((r) => setTimeout(r, 0));
  const all = [...c.querySelectorAll('.section-block:not([data-ghost])')];
  return { total: all.length, missing: all.filter((s) => !s.querySelector(':scope > .section-bottom-handle')).length };
}, act);

test('H1 addSection — 다음 작업에 이미 손잡이', async ({ page }) => {
  await bootApp(page);
  const r = await missingNextTask(page, 'window.addSection({ skipDefaultBlock: true });');
  expect(r.total).toBeGreaterThan(0);
  expect(r.missing).toBe(0);
});

test('H2 HTML 로 통째 넣기(다시 열기·⌘Z·페이지 전환과 같은 꼴) — 전부 손잡이', async ({ page }) => {
  await bootApp(page);
  const sec = (id) => `<div class="section-block" id="${id}" data-section="1"><div class="section-hitzone"></div><div class="section-inner"></div></div>`;
  const r = await missingNextTask(page, `c.innerHTML = ${JSON.stringify(sec('a1') + sec('a2') + sec('a3'))};`);
  expect(r).toEqual({ total: 3, missing: 0 });
});

test('H3 있던 섹션의 손잡이가 지워져도 다시 붙는다 · 두 벌이 안 된다', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => { window.addSection({ skipDefaultBlock: true }); });
  const r = await missingNextTask(page, `c.querySelectorAll('.section-bottom-handle').forEach((h) => h.remove());`);
  expect(r.missing).toBe(0);
  const n = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block')].map((s) => s.querySelectorAll(':scope > .section-bottom-handle').length));
  expect(new Set(n)).toEqual(new Set([1]));
});

test('N1 [음성] 손잡이는 저장본에 안 실린다', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => { window.addSection({ skipDefaultBlock: true }); });
  const saved = await page.evaluate(() => window.serializeProject());
  expect(saved).not.toContain('section-bottom-handle');
});
