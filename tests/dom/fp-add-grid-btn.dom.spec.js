/* fp-add-grid-btn.dom.spec.js — FLOATING-PANEL-ADD-GRID-01 (현빈 0.9.10 QA): 중앙 플로팅 패널 프레임 단추 옆 그리드 단추, 컴포넌트 메뉴 Grid 항목 삭제.
 *   T0 그리드 단추가 프레임 단추 바로 다음에 있고 같은 클래스·같은 크기다 · 메뉴엔 Grid 가 없다(Infographic 은 남음).
 *   T1 섹션 고르고 단추 누르면 그리드 블럭이 하나 생긴다 · ⌘Z 한 번에 빠진다.
 * ★양성대조: 단추를 지우면 T0·T1 빨강 · 메뉴 항목을 되살리면 T0 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('T0 프레임 옆 같은 크기 Grid 단추 · 메뉴 Grid 없음', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(() => {
    const f = document.querySelector('#floating-panel .fp-btn[onclick="addFrameBlock()"], .fp-btn[onclick="addFrameBlock()"]');
    const g = document.getElementById('fp-grid-btn');
    const box = (e) => e && (({ width, height }) => ({ w: Math.round(width), h: Math.round(height) }))(e.getBoundingClientRect());
    const cs = (e) => e && (({ color, backgroundColor, padding, borderRadius }) => ({ color, backgroundColor, padding, borderRadius }))(getComputedStyle(e));
    return { next: f?.nextElementSibling === g, cls: g?.className, fb: box(f), gb: box(g), fs: cs(f), gs: cs(g),
      menu: [...document.querySelectorAll('#fp-component-dropdown .fp-menu-item')].map(b => b.textContent.trim()) };
  });
  expect(r.next, 'Grid 단추가 프레임 단추 바로 다음').toBe(true);
  expect(r.cls).toBe('fp-btn');
  expect(r.gb, '프레임 단추와 같은 크기').toEqual(r.fb);
  expect(r.gs, '프레임 단추와 같은 색·여백·모서리').toEqual(r.fs);
  expect(r.menu).toContain('Infographic');
  expect(r.menu, '메뉴 Grid 항목 삭제').not.toContain('Grid');
});

test('T1 단추 → 그리드 블럭 하나 · ⌘Z 한 번에 복원', async ({ page }) => {
  await bootApp(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await expect.poll(() => page.evaluate(() => !!window.getSelectedSection?.())).toBe(true);
  await page.evaluate(() => window.clearHistory?.());
  const n = () => page.evaluate(() => document.querySelectorAll('#canvas .grid-block').length);
  const n0 = await n();
  await page.click('#fp-grid-btn');
  await expect.poll(n).toBe(n0 + 1);
  await page.evaluate(() => window.deselectAll?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(n).toBe(n0);
});
