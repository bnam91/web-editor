/* todo-pin-over-blocks.dom.spec.js — 329 TODO-PIN 블럭 위에 안 찍힘 (S7 · 261031 · 지디 J329C)
 *   ★병: js/checklist-panel.js 의 핀 듣는 자가 #canvas-wrap «버블» 이라 블럭·섹션 click 처리기의 stopPropagation 에 막혔다 ⇒ 블럭 위 0/3 · 빈 자리만 3/3.
 *   ★처방: 듣는 자를 캡처로. stopPropagation 은 안 건드린다.
 *   한 쌍: P* = 블럭 위 핀 입력창이 뜨고 임시 핀이 누른 자리에 선다(캡처를 버블로 되돌리면 빨강 · 회신에 실측) · F = 빈 자리 그대로 뜬다(있던 것을 안 껐나) ·
 *   O* = 핀 모드를 켰다 끈 뒤(듣는 자는 걸린 채) 평소 클릭은 블럭을 고르고 입력창이 안 뜬다 · D = 평소 끌기가 된다(빈칸 — 끌기 자가 선 칸만).
 *   ⚠️자 한계: 하네스 · 줌 40 · addSection 으로 만든 섹션 · 사람 클릭 안 잼 · 저장본 로드 길 안 잼. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const BLOCKS = {
  '빈칸': { sel: '.gap-block' },
  '글상자': { sel: '.text-block' },
  '에셋': { add: 'addAssetBlock', sel: '.asset-block' },
  '프레임': { add: 'addFrameBlock', sel: '.frame-block:not([data-text-frame])' },
  '표': { add: 'addTableBlock', sel: '.table-block' },
  '도형': { add: 'addShapeBlock', sel: '.shape-block' },
  '그라데이션': { add: 'addGradientBlock', sel: '.gradient-block' },
};

async function scene(page, add) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.waitForFunction(() => typeof window.addSection === 'function');
  await page.evaluate(async (add) => {
    const cv = document.getElementById('canvas');
    cv.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection([...cv.querySelectorAll('.section-block')].pop());
    if (add) window[add]();
    window.deselectAll?.();
  }, add || null);
  await page.click('.panel-tab[data-tab="checklist"]');
  await page.waitForSelector('#ck-add-pin-btn');
  await page.click('#ck-add-pin-btn');
  expect(await page.evaluate(() => document.getElementById('canvas-wrap').classList.contains('pin-mode-active')), '★전제: 핀 모드').toBe(true);
  await waitStableRect(page, '.section-block');   // 안 멎으면 던진다
}
const centre = (page, sel) => page.evaluate((sel) => {
  const q = [...document.querySelectorAll('.section-block')].pop().querySelector(sel).getBoundingClientRect();
  return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
}, sel);
const pinAt = (page) => page.evaluate(() => { const r = document.querySelector('.todo-pin--pending').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });

for (const [name, c] of Object.entries(BLOCKS)) {
  test(`P ${name} 위 — 핀 모드 click 에 입력창 · 임시 핀이 누른 자리`, async ({ page }) => {
    await scene(page, c.add);
    const p = await centre(page, c.sel);
    await clickAt(page, p.x, p.y, { sel: c.sel }, { label: name });
    await page.waitForSelector('.todo-pin-input', { timeout: 5000 });
    const r = await pinAt(page);
    expect(Math.abs(r.x + r.w / 2 - p.x) <= r.w && Math.abs(r.y + r.h / 2 - p.y) <= r.h, `임시 핀이 누른 자리에 없다 ${JSON.stringify({ r, p })}`).toBe(true);
  });
  test(`O ${name} — 핀 모드를 켰다 끈 뒤 평소 click 은 고르고 입력창이 안 뜬다`, async ({ page }) => {
    await scene(page, c.add);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => { const w = document.getElementById('canvas-wrap'); return [w.classList.contains('pin-mode-active'), !!w._ckBound]; }), '★전제: 꺼졌고 듣는 자는 걸렸다').toEqual([false, true]);
    const p = await centre(page, c.sel);
    await clickAt(page, p.x, p.y, { sel: c.sel }, { label: name });
    await page.waitForFunction((sel) => { const e = [...document.querySelectorAll('.section-block')].pop().querySelector(sel); return e.classList.contains('selected') || !!e.closest('.selected:not(.section-block)'); }, c.sel, { timeout: 5000 });
    expect(await page.locator('.todo-pin-input').count()).toBe(0);
  });
}
test('F 빈 자리(캔버스 바닥) — 그대로 뜬다', async ({ page }) => {
  await scene(page);
  const p = await page.evaluate(() => { const r = [...document.querySelectorAll('.section-block')].pop().getBoundingClientRect(), w = document.getElementById('canvas-wrap').getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.min(w.bottom - 10, r.bottom + 40) }; });
  await clickAt(page, p.x, p.y, { sel: '#canvas-wrap' }, { label: '바닥' });
  await page.waitForSelector('.todo-pin-input', { timeout: 5000 });
});
/* ⚠️끌기 칸은 빈칸 하나다 — 프레임은 ×3 에 1 번 안 끌렸고 고치기 전 판도 같았다(329 · 까닭 안 쟀다) ⇒ 흔들리는 칸을 넣지 않았다. */
for (const [name, sel, add] of [['빈칸', '.gap-block', null]]) {
  test(`D ${name} — 핀 모드를 켰다 끈 뒤 끌기가 된다`, async ({ page }) => {
    await scene(page, add);
    await page.keyboard.press('Escape');
    const rel = () => page.evaluate((sel) => { const s = [...document.querySelectorAll('.section-block')].pop(), e = s.querySelector(sel); const a = e.getBoundingClientRect(), b = s.getBoundingClientRect(); return { top: a.top - b.top, x: a.left + a.width / 2, y: a.top + a.height / 2 }; }, sel);
    const r0 = await rel();
    await page.mouse.move(r0.x, r0.y); await page.mouse.down();
    await page.mouse.move(r0.x + 20, r0.y + 15, { steps: 4 }); await page.mouse.move(r0.x + 40, r0.y + 30, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    const r1 = await rel();
    expect(r1.top, '안 끌렸다').not.toBe(r0.top);
  });
}
