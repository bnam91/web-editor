/* grad-layer-order-t305.dom.spec.js — t3-05 그라데이션 블럭 ⌘[ / ⌘] 로 다른 블럭과 레이어 순서
 *
 * 시트(p12) t3-05: 「그라데이션 블럭 > 커맨드 '[' , ']' 이걸로 다른 블럭 간에 레이어 순서 조절이 안되는듯?」
 * 수지맥 실측(ca702d40): 레이어 패널에서 grad 선택 → ⌘], ⌘[×2 ⇒ z-index 2 · 순서 index 4 그대로.
 * 층: 본문(.section-inner 안 · z 2)과 그라데이션(섹션 직속 · 인라인 z 2)은 동점 ⇒ DOM 뒤가 위(gradient-block.js 머리).
 * 칸
 *   P0  전제 — 그라데이션이 본문 «위»(겹친 점의 임자 = 그라데이션) · 진짜 클릭으로 그라데이션이 골라진다
 *   B   ⌘[ → 그라데이션이 .section-inner 앞으로 · 겹친 점의 임자 = 본문 글상자 · 이력 「뒤로 보내기」
 *   F   이어 ⌘] → 다시 위 · 임자 = 그라데이션 · 이력 「앞으로 가져오기」
 *   Z   ⌘[ 뒤 ⌘Z → 다시 위(한 걸음)
 * 양성대조: GD1001_ROOT=<핀 46d444b1 사본> ⇒ B·F·Z 빨강(순서·임자 그대로).
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
    window.addTextBlock('h1', { content: '그라데이션 밑 글자' });
    window.selectSection(sec);
    window.addGradientBlock();
    window.__sec = sec;
    window.__g = sec.querySelector(':scope > .gradient-block');
    window.__tb = [...sec.querySelectorAll('.text-block')].pop();
    window.deselectAll?.();
    window.__g.scrollIntoView({ block: 'center' });
  });
  await page.waitForFunction(() => !!window.__g && window.__g.getBoundingClientRect().height > 0);
  return errs;
}
/* 겹친 점 = 글상자 가운데(그라데이션 860×300 이 섹션 위를 덮는다) */
const st = (page) => page.evaluate(() => {
  const r = window.__tb.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const h = document.elementFromPoint(x, y);
  const kids = [...window.__sec.children].filter(c => c.classList.contains('section-inner') || c.classList.contains('gradient-block')).map(c => c.classList.contains('gradient-block') ? 'G' : 'I').join('');
  return { owner: h ? (h.closest('.gradient-block') ? 'grad' : h.closest('.text-block') ? 'text' : (h.id || h.className.toString().slice(0, 20))) : null, order: kids, sel: window.__g.classList.contains('selected'), tip: window.getHistoryTip?.()?.action ?? null };
});
async function pickGrad(page) {
  const p = await page.evaluate(() => { const r = window.__tb.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => window.__g.classList.contains('selected'));
}

test('P0 전제 — 그라데이션이 본문 위 · 진짜 클릭으로 골라진다', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await st(page);
  expect({ owner: s0.owner, order: s0.order }).toEqual({ owner: 'grad', order: 'IG' });
  await pickGrad(page);
  expect((await st(page)).sel).toBe(true);
  expect(errs).toEqual([]);
});

test('B ⌘[ → 그라데이션이 본문 뒤 · 임자 = 글상자 · 「뒤로 보내기」', async ({ page }) => {
  const errs = await setup(page);
  await pickGrad(page);
  await page.keyboard.press('Meta+BracketLeft');
  await page.waitForFunction(() => window.__sec.querySelector(':scope > .gradient-block') && window.__sec.children[[...window.__sec.children].indexOf(window.__g)].nextElementSibling?.classList.contains('section-inner') || [...window.__sec.children].indexOf(window.__g) < [...window.__sec.children].findIndex(c => c.classList.contains('section-inner')));
  const s = await st(page);
  expect({ owner: s.owner, order: s.order, tip: s.tip }).toEqual({ owner: 'text', order: 'GI', tip: '뒤로 보내기' });
  expect(errs).toEqual([]);
});

test('F ⌘[ 뒤 ⌘] → 다시 위 · 「앞으로 가져오기」', async ({ page }) => {
  const errs = await setup(page);
  await pickGrad(page);
  await page.keyboard.press('Meta+BracketLeft');
  await page.waitForFunction(() => [...window.__sec.children].indexOf(window.__g) < [...window.__sec.children].findIndex(c => c.classList.contains('section-inner')));
  await page.keyboard.press('Meta+BracketRight');
  await page.waitForFunction(() => [...window.__sec.children].indexOf(window.__g) > [...window.__sec.children].findIndex(c => c.classList.contains('section-inner')));
  const s = await st(page);
  expect({ owner: s.owner, order: s.order, tip: s.tip }).toEqual({ owner: 'grad', order: 'IG', tip: '앞으로 가져오기' });
  expect(errs).toEqual([]);
});

test('Z ⌘[ 뒤 ⌘Z → 다시 위(한 걸음)', async ({ page }) => {
  const errs = await setup(page);
  await pickGrad(page);
  await page.keyboard.press('Meta+BracketLeft');
  await page.waitForFunction(() => [...window.__sec.children].indexOf(window.__g) < [...window.__sec.children].findIndex(c => c.classList.contains('section-inner')));
  await page.keyboard.press('Meta+KeyZ');
  await page.waitForFunction(() => { const sec = document.querySelector('#canvas > .section-block'); const g = sec.querySelector(':scope > .gradient-block'); return !!g && [...sec.children].indexOf(g) > [...sec.children].findIndex(c => c.classList.contains('section-inner')); });
  expect(errs).toEqual([]);
});
