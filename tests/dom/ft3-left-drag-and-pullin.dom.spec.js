/* ft3-left-drag-and-pullin.dom.spec.js — FT-3b 왼쪽 끌기 · FT-3a 섹션 밖 손잡이 되찾기
 *
 * 현빈 원문(자유변형 셋 ③ · from-gd-51): 「보라 아웃라인을 섹션 밖으로 끌면 안 보여서 나간 핸들을 못 찾는다」
 * 미카사 앱 실측(261025 · ca702d40 · 흐름 글상자 · 배율 40):
 *   3b `FT-LEFT-DRAG-ANCHORS-AT-TB-LEFT-01` — nw 를 누른 채 왼쪽 800px: 손잡이 cx 573.8 고정 · 데이터 x −1998.67
 *   3a — ne 를 섹션 오른 경계 밖 60px: 마지막 손잡이 맞음 cx 889(섹션 경계) · 그 너머 임자 `canvas-wrap` · 다시 잡기 0
 *
 * 칸
 *   P0  전제 — 흐름 글상자 · 자유변형 켜짐 · 손잡이 12 · nw/ne 중심의 임자가 그 손잡이
 *   L   nw 를 왼쪽으로 20 화면 px(섹션 안) → nw 손잡이가 따라 왼쪽으로 ≈20 · ne 손잡이는 제자리(±1)
 *   O   ne 를 섹션 오른 경계 밖으로 → ★좌표로 찍는다: 손잡이 중심 x > .section-inner 오른쪽 · 그 점의 임자가 손잡이 아님
 *   R   그 상태에서 카드 「밖 모서리 데려오기」 → ne 중심이 섹션 안 · 그 점의 임자가 ne 손잡이 · nw 는 제자리(±1)
 *   U   R 뒤 ⌘Z 한 번 → ne 가 다시 밖(한 걸음)
 * 양성대조: GD1001_ROOT=<핀 ca702d40 사본> 이면 L·R·U 빨강(P0·O 는 초록 = 장면은 선다).
 * ⛔고정 대기 없음 — waitForFunction / expect.poll 만. ⛔앱 무접촉(_root-harness.bootApp).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft3-left-drag-and-pullin
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
    sec.querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());
    window.selectSection(sec);
    window.addTextBlock('h1', { content: '온풍기 맥스' });
    window.applyZoom?.(40);
    window.__tb = sec.querySelector('.text-block');
    window.__sec = sec;
    window.__tb.scrollIntoView({ block: 'center' });
    window.selectBlock(window.__tb.id);
  });
  await page.waitForFunction(() => !!document.getElementById('txt-fx-add'));
  await page.selectOption('#txt-fx-add', 'freetransform');
  await page.waitForFunction(() => window.__tb.querySelectorAll('.tfh-handle').length === 12);
  return errs;
}
const H = (page, name) => page.evaluate((n) => {
  const h = window.__tb.querySelector(`.tfh-handle[data-tfh="${n}"]`);
  if (!h) return null;
  const r = h.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const at = document.elementFromPoint(x, y);
  const inner = (window.__sec.querySelector(':scope > .section-inner') || window.__sec).getBoundingClientRect();
  return { x, y, mine: !!(at && at.dataset && at.dataset.tfh === n), innerL: inner.left, innerR: inner.right };
}, name);
async function drag(page, name, dx, dy) {
  const h = await H(page, name);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(h.x + dx * i / 10, h.y + dy * i / 10);
  await page.mouse.up();
  await page.waitForFunction(() => window.__tb.querySelectorAll('.tfh-handle').length === 12);
}

test('P0 전제 — 흐름 글상자 · 손잡이 12 · nw/ne 중심의 임자가 그 손잡이', async ({ page }) => {
  const errs = await setup(page);
  const flow = await page.evaluate(() => getComputedStyle(window.__tb.closest('.frame-block[data-text-frame]')).position);
  expect(flow).toBe('relative');
  expect((await H(page, 'nw')).mine).toBe(true);
  expect((await H(page, 'ne')).mine).toBe(true);
  expect(errs).toEqual([]);
});

test('L nw 를 왼쪽으로(섹션 안 여유의 절반) → nw 가 따라가고 ne 는 제자리', async ({ page }) => {
  const errs = await setup(page);
  const nw0 = await H(page, 'nw'), ne0 = await H(page, 'ne');
  const dx = -Math.floor((nw0.x - nw0.innerL) / 2);   /* 섹션 안 여유의 절반 — 밖으로 안 나가게 */
  expect(dx, '전제: 왼쪽에 끌 여유가 있다').toBeLessThanOrEqual(-5);
  await drag(page, 'nw', dx, 0);
  await expect.poll(async () => Math.round((await H(page, 'nw')).x - nw0.x)).toBeLessThanOrEqual(dx + 2);
  const nw1 = await H(page, 'nw'), ne1 = await H(page, 'ne');
  expect(nw1.x - nw0.x).toBeGreaterThanOrEqual(dx - 2);
  expect(Math.abs(ne1.x - ne0.x)).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

/* 끌기를 놓은 뒤 패널이 한 번 다시 그려진다 — 그 전에 누르면 곧 바뀔 단추를 누른다(실측: 3번 중 1~2번 핸들러 0회).
   ⇒ «같은 단추 요소가 두 프레임 넘게 산다»를 조건으로 기다린다(⛔고정 대기 아님). */
async function clickPullIn(page) {
  await page.evaluate(() => document.getElementById('txt-fxft-body')?.removeAttribute('hidden'));
  await page.waitForFunction(() => new Promise((res) => {
    const b = document.getElementById('txt-fxft-pullin');
    if (!b) return res(false);
    b.__s5mk = (b.__s5mk || 0) + 1;
    requestAnimationFrame(() => requestAnimationFrame(() => res(document.getElementById('txt-fxft-pullin') === b && b.__s5mk >= 2)));
  }));
  await page.click('#txt-fxft-pullin');
}

async function pushNeOut(page) {
  const ne0 = await H(page, 'ne');
  await drag(page, 'ne', ne0.innerR - ne0.x + 60, 0);
  return H(page, 'ne');
}

test('O ne 를 섹션 밖으로 — 좌표로: 중심 x > 섹션 오른쪽 · 그 점의 임자가 손잡이 아님', async ({ page }) => {
  const errs = await setup(page);
  const ne = await pushNeOut(page);
  expect(ne.x).toBeGreaterThan(ne.innerR + 30);
  expect(ne.mine).toBe(false);
  expect(errs).toEqual([]);
});

test('R 「밖 모서리 데려오기」 → ne 가 섹션 안 · 그 점의 임자가 ne · nw 제자리', async ({ page }) => {
  const errs = await setup(page);
  const nw0 = await H(page, 'nw');
  const out = await pushNeOut(page);
  expect(out.x, '전제: 정말 밖이다').toBeGreaterThan(out.innerR + 30);
  await clickPullIn(page);
  await expect.poll(async () => (await H(page, 'ne')).x <= out.innerR).toBe(true);
  const ne1 = await H(page, 'ne'), nw1 = await H(page, 'nw');
  expect(ne1.mine).toBe(true);
  expect(Math.abs(nw1.x - nw0.x)).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('U 데려온 뒤 ⌘Z 한 번 → ne 가 다시 밖', async ({ page }) => {
  const errs = await setup(page);
  const out = await pushNeOut(page);
  await clickPullIn(page);
  await expect.poll(async () => (await H(page, 'ne')).x <= out.innerR).toBe(true);
  await page.evaluate(() => { document.activeElement?.blur?.(); window.undo(); });
  await page.waitForFunction(() => (window.__tb.dataset.tfCorners || '').split(',').length === 8);
  await expect.poll(async () => {
    const c = await page.evaluate(() => window.__tb.dataset.tfCorners.split(',').map(Number));
    return c[2] > 800;
  }).toBe(true);
  expect(errs).toEqual([]);
});
