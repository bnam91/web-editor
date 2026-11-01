/* tab-missing-project-history-336c — 탭의 프로젝트를 못 읽는 갈래(js/tab-system.js «프로젝트 없으면»)도 이력을 지운다 (J336C)
 * 왜: 그 갈래만 clearHistory 를 안 타서, 지운 프로젝트의 탭을 누른 뒤 ⌘Z 가 앞 탭의 글을 빈 화면에 되살렸다.
 *   앱 실측(2b7aec4d · ~/gd-lane/imac-gd-L1/336b): 폴더를 앱 밖에서 지운 탭 → ⌘Z 앞 글 3 → ⌘S 로 그 폴더에 앞 글이 써짐 3/3.
 * 장면: 읽기를 null 로 돌린다(window.loadProjectForOpen · 하네스의 가짜 API 라 폴더 지우기는 못 쓴다 · 앱 길은 위 실측이 잰다).
 * 칸: M1 이력 지움 · M2 [양성] 옮기기 전 ⌘Z 는 되돌린다(자가 ⌘Z 를 본다) · M3 [음성] 읽히는 프로젝트는 원래도 지운다.
 * 변이: 고침 두 줄만 빼면 M1 빨강 · M2·M3 초록.
 * ★처음 실행 기록: 2026-11-01 15:5x · 아이맥 · 판 2b7aec4d · w1 · retries 0 · repeat-each 3 · 고친 판 9/9 · 되돌린 판 M1 3/3 빨강(이력이 지워졌다) · M2·M3 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page) {
  const errs = await bootApp(page);
  return page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection?.(sec);
    window.addTextBlock('body');
    window.addTextBlock('body');
    window.deselectAll?.();
    return { ids: [...sec.querySelectorAll('.text-block')].map(b => b.id), tip: window.getHistoryTip() };
  }).then(s => ({ ...s, errs }));
}
const seen = (page, ids) => page.evaluate((ids) => ({ 화면: ids.filter(id => document.getElementById(id)).length, tip: window.getHistoryTip() }), ids);

test('M1 못 읽는 프로젝트 탭으로 옮기면 이력을 지운다 — ⌘Z 가 앞 글을 안 되살린다', async ({ page }) => {
  const s = await setup(page);
  expect(s.ids.length, '[전제] 앞 글이 있다').toBeGreaterThan(0);
  expect(s.tip.pos, '[전제] 앞 탭에 되돌릴 칸이 있다').toBeGreaterThan(0);
  await page.evaluate(() => { window.loadProjectForOpen = async () => null; });
  await page.evaluate(() => window.createNewProjectTab());
  await settle(page);
  const a = await seen(page, s.ids);
  expect(a.화면, '[전제] 옮긴 뒤 화면에 앞 글이 없다').toBe(0);
  expect([a.tip.pos, a.tip.len], '이력이 지워졌다').toEqual([0, 1]);
  await page.keyboard.press('Meta+z'); await settle(page);
  expect((await seen(page, s.ids)).화면, '★⌘Z 가 앞 글을 되살렸다').toBe(0);
  expect(s.errs).toEqual([]);
});

test('M2 [양성] 옮기기 전 ⌘Z 는 되돌린다', async ({ page }) => {
  const s = await setup(page);
  const before = (await seen(page, s.ids)).화면;
  await page.keyboard.press('Meta+z'); await settle(page);
  expect((await seen(page, s.ids)).화면, '⌘Z 가 글 하나를 되돌린다').toBe(before - 1);
  expect(s.errs).toEqual([]);
});

test('M3 [음성] 읽히는 프로젝트 탭은 원래도 지운다', async ({ page }) => {
  const s = await setup(page);
  await page.evaluate(() => { window.loadProjectForOpen = async (id) => window.buildEmptyProject(id, '읽힘'); });
  await page.evaluate(() => window.createNewProjectTab());
  await settle(page);
  const a = await seen(page, s.ids);
  expect([a.화면, a.tip.pos, a.tip.len]).toEqual([0, 0, 1]);
  await page.keyboard.press('Meta+z'); await settle(page);
  expect((await seen(page, s.ids)).화면).toBe(0);
  expect(s.errs).toEqual([]);
});
