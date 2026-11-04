/* bracket-reorder-all-kinds-j4468.dom.spec.js — ⌘[ ⌘] 흐름 갈래가 흐름 블럭 전부를 옮긴다 (J4468A)
 * 뿌리: moveSelectedBlocks 의 BLOCK_SEL 손 명부 16종에 흐름 블럭 13종이 없어 고르고 눌러도 조용히 안 옮겨졌다.
 * 자: 진짜 클릭으로 고르고 진짜 키를 눌러 .row 의 형제 index 를 잰다.
 * 양성대조: 손 명부로 되돌리면 M(13종)·M-Z 빨강 · C(이미 되던 표)·N(음성) 은 초록.
 * ⛔고정 대기 없음. ⛔앱 무접촉(_root-harness.bootApp).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const KINDS = { 'icon-block': 'addIconifyBlock', 'banner02-block': 'addBanner02Block', 'comparison-block': 'addComparisonBlock', 'mockup-block': 'addMockupBlock', 'vector-block': 'addVectorBlock', 'step-block': 'addStepBlock', 'joker-block': 'addJokerBlock', 'canvas-block': 'addCanvasBlock', 'chat-block': 'addChatBlock', 'coupon-block': 'addCouponBlock', 'quote-block': 'addQuoteBlock', 'radial-block': 'addRadialBlock', 'laurel-block': 'addLaurelBlock' };

async function scene(page, kind, fn) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ([kind, fn]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    const add = async (name, cls) => {
      window.deselectAll(); window.selectSection(sec);
      const before = new Set(sec.querySelectorAll('.' + cls));
      await window[name]();
      const e = [...sec.querySelectorAll('.' + cls)].find((x) => !before.has(x));
      if (!e.id) e.id = 'k' + Math.random().toString(36).slice(2, 9);
      return e.id;
    };
    const d1 = await add('addDividerBlock', 'divider-block');
    const x = await add(fn, kind);
    const d2 = await add('addDividerBlock', 'divider-block');
    window.deselectAll();
    return { d1, x, d2 };
  }, [kind, fn]);
  return { errs, ...ids };
}
const idx = (page, id) => page.evaluate((id) => { const u = document.getElementById(id).closest('.row'); return [...u.parentElement.children].indexOf(u); }, id);
const pickByClick = async (page, id) => {
  const loc = page.locator('#' + id);
  await loc.scrollIntoViewIfNeeded();
  const r = await loc.boundingBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id);
};
const pressMoves = async (page, id, key, to) => {
  await page.keyboard.press(key);
  await expect.poll(() => idx(page, id), `${key} 뒤 index`).toBe(to);
};
const twoFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

for (const [kind, fn] of Object.entries(KINDS)) {
  test(`M ${kind} — ⌘[ 위로 · ⌘] 아래로 · 선택 유지 · 블럭 그대로`, async ({ page }) => {
    const { errs, x } = await scene(page, kind, fn);
    await pickByClick(page, x);
    const i0 = await idx(page, x);
    await pressMoves(page, x, 'Meta+BracketLeft', i0 - 1);
    await pressMoves(page, x, 'Meta+BracketRight', i0);
    await pressMoves(page, x, 'Meta+BracketRight', i0 + 1);
    expect(await page.evaluate((id) => [document.querySelectorAll('[id="' + id + '"]').length, document.getElementById(id).classList.contains('selected')], x)).toEqual([1, true]);
    // 가짜 electronAPI 의 깊은 호출(svgPresets.list)은 하네스 몫이라 뺀다 — 아이콘 블럭만 난다
    expect(errs.filter((e) => !e.includes('electronAPI'))).toEqual([]);
  });
}

test('M-Z ⌘Z 한 번이 ⌘[ 한 번을 되돌린다 (chat-block)', async ({ page }) => {
  const { x } = await scene(page, 'chat-block', 'addChatBlock');
  await pickByClick(page, x);
  const i0 = await idx(page, x);
  await pressMoves(page, x, 'Meta+BracketLeft', i0 - 1);
  await pressMoves(page, x, 'Meta+z', i0);
});

test('C 양성 — 이미 되던 표는 그대로 옮겨진다', async ({ page }) => {
  const { x } = await scene(page, 'table-block', 'addTableBlock');
  await pickByClick(page, x);
  const i0 = await idx(page, x);
  await pressMoves(page, x, 'Meta+BracketLeft', i0 - 1);
});

test('N 음성 — 아무것도 안 골랐으면 ⌘[ ⌘] 가 순서를 안 바꾼다', async ({ page }) => {
  await scene(page, 'chat-block', 'addChatBlock');
  const order = () => page.evaluate(() => [...document.querySelector('.section-inner').children].map((c) => c.id || c.className).join());
  const before = await order();
  await page.keyboard.press('Meta+BracketLeft');
  await page.keyboard.press('Meta+BracketRight');
  await twoFrames(page);
  expect(await order()).toBe(before);
});

test('N2 음성 — 맨 위 행에서 ⌘[ 를 거듭 눌러도 섹션 안에 있다', async ({ page }) => {
  const { d1 } = await scene(page, 'chat-block', 'addChatBlock');
  await pickByClick(page, d1);
  for (let k = 0; k < 6; k++) await page.keyboard.press('Meta+BracketLeft');
  await twoFrames(page);
  expect(await page.evaluate((id) => document.getElementById(id).closest('.row').parentElement.classList.contains('section-inner'), d1)).toBe(true);
});
