/* itb-icon-popover.dom.spec.js — 1017t1m2 아이콘 텍스트 블럭: 아이콘 클릭 → #grd-ifg-iconpop
 *
 * 현빈 원문 「👉 해결안된듯? grd-ifg-iconpop 해당 패널이 뜨게 하란거였는데」 (T0-NOTE-ORIGINAL-261025 · 1017t1m2)
 * 미카사 앱 실측(261025 · f62653ce): .itb-icon 클릭 → 팝오버 없음 · 파일 선택창 1회.
 *   같은 자로 인포그래픽 칸 더블클릭은 팝오버가 뜬다(그 선례를 이식).
 *
 * 칸
 *   P0  전제 — 아이콘 텍스트 블럭이 서고 .itb-icon 가운데를 누르면 그 점의 임자가 .itb-icon 이다
 *   O   진짜 마우스 클릭 → #grd-ifg-iconpop 이 뜨고(보임) 파일 선택창 0
 *   K   팝오버 첫 아이콘 클릭 → 아이콘 칸에 svg 그림(data:image/svg+xml) · dataset.imgSrc 같은 값 · 팝오버 닫힘
 * 양성대조: GD1001_ROOT=<핀 ca702d40 사본> 이면 O 가 빨강(팝오버 0 · 파일 선택창 1).
 * ⛔고정 대기 없음 — waitForFunction / expect.poll 만. ⛔앱 무접촉(_root-harness.bootApp).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js itb-icon-popover
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
    window.addIconTextBlock();
    window.deselectAll?.();
    window.__itb = sec.querySelector('.icon-text-block');
    window.__itb.scrollIntoView({ block: 'center' });
  });
  await page.waitForFunction(() => !!window.__itb && window.__itb.querySelector('.itb-icon').getBoundingClientRect().width > 0);
  return errs;
}
const iconCenter = (page) => page.evaluate(() => {
  const r = window.__itb.querySelector('.itb-icon').getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const at = document.elementFromPoint(x, y);
  return { x, y, ownerIsIcon: !!(at && at.closest('.itb-icon') === window.__itb.querySelector('.itb-icon')) };
});
const popState = (page) => page.evaluate(() => {
  const p = document.getElementById('grd-ifg-iconpop');
  return { pop: !!p, shown: !!(p && getComputedStyle(p).display !== 'none' && p.getBoundingClientRect().width > 0) };
});

test('P0 전제 — 아이콘 칸 가운데의 임자가 .itb-icon 이다', async ({ page }) => {
  const errs = await setup(page);
  const c = await iconCenter(page);
  expect(c.ownerIsIcon).toBe(true);
  expect(await popState(page)).toEqual({ pop: false, shown: false });
  expect(errs).toEqual([]);
});

test('O 아이콘 클릭 → #grd-ifg-iconpop 이 뜨고 파일 선택창 0', async ({ page }) => {
  const errs = await setup(page);
  let chooser = 0; page.on('filechooser', () => { chooser++; });
  const c = await iconCenter(page);
  await page.mouse.click(c.x, c.y);
  await expect.poll(() => popState(page)).toEqual({ pop: true, shown: true });
  expect(chooser).toBe(0);
  expect(errs).toEqual([]);
});

test('K 팝오버 첫 아이콘 → 아이콘 칸에 svg 그림 · dataset.imgSrc 같은 값 · 팝오버 닫힘', async ({ page }) => {
  const errs = await setup(page);
  const c = await iconCenter(page);
  await page.mouse.click(c.x, c.y);
  await page.waitForFunction(() => !!document.querySelector('#grd-ifg-iconpop .grd-ifg-iconpop-grid button'));
  await page.click('#grd-ifg-iconpop .grd-ifg-iconpop-grid button');
  await page.waitForFunction(() => !!window.__itb.querySelector('.itb-icon img'));
  const r = await page.evaluate(() => ({ src: window.__itb.querySelector('.itb-icon img').getAttribute('src').slice(0, 26), same: window.__itb.querySelector('.itb-icon img').getAttribute('src') === window.__itb.dataset.imgSrc }));
  expect(r).toEqual({ src: 'data:image/svg+xml;base64,', same: true });
  expect(await popState(page)).toEqual({ pop: false, shown: false });
  expect(errs).toEqual([]);
});
