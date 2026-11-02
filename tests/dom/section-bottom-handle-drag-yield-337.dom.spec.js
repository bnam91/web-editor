/* 337 — 블럭을 끄는 동안 섹션 바닥 띠가 드롭을 먹지 않는다. 띠에서 난 dragover 는 inner 로 안 가 drop 이 안 났다.
 * 자: 진짜 마우스 끌기(D1) · 끌기 끝 신호별 복원(R1~R4) · 손잡이 끌기(H1) · 326 비킴과 공존(O1).
 * 변이: js/section-bottom-handle.js 의 dragstart 줄을 빼면 D1·P1 빨강 · 끝 신호 목록에서 하나를 빼면 그 칸 빨강 · H1·O1 은 늘 초록.
 * ⚠️놓는 점 임자는 끌기 전 전제로 잰다(띠에 닿는 장면인가). 끌기 중 evaluate 는 D1 에 없다. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const SEC = (extra = '') => `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:40px"></div>
<div class="row" id="A"><div class="text-block" data-type="heading" id="tA"><div class="tb-h2">끌 글</div></div></div>
<div class="frame-block" id="B" data-type="frame" style="min-height:150px"></div>
<div class="gap-block" id="g1" data-type="gap" style="height:80px"></div>${extra}</div></div>`;
const raf2 = (p) => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const R = (p, q) => p.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top + r.height / 2, top: r.top, bottom: r.bottom }; }, q);
const owner = (p, x, y) => p.evaluate(([x, y]) => String(document.elementFromPoint(x, y)?.className).split(' ')[0], [x, y]);
const yielded = (p) => p.evaluate(() => getComputedStyle(document.querySelector('#sG > .section-bottom-handle')).pointerEvents === 'none');
async function setup(page, extra) {
  await page.setViewportSize({ width: 1500, height: 950 });
  await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100); window.sectionBottomHandleSweep?.(); document.getElementById('sG').scrollIntoView({ block: 'start' }); }, SEC(extra));
  await page.waitForFunction(() => document.querySelector('#sG > .section-bottom-handle'));
  await waitZoomSettled(page, 100);
  await page.evaluate(() => document.getElementById('sG').scrollIntoView({ block: 'start' }));
  await raf2(page);
}
async function bandPoint(page) {
  const s = await R(page, '#sG');
  await page.mouse.move(s.x, s.top + 30); await page.mouse.move(s.x, s.bottom - 5); await raf2(page);
  expect(await owner(page, s.x, s.bottom - 5), '전제: 놓는 점의 임자가 띠다').toBe('section-bottom-handle');
  return { x: s.x, y: s.bottom - 5 };
}
async function startDrag(page) {
  const a = await R(page, '#tA');
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 10, { steps: 3 });
}
const order = (p) => p.evaluate(() => [...document.querySelector('#sG .section-inner').children].map(e => e.id).filter(i => ['A', 'B', 'g1'].includes(i)));

test('D1 블럭을 띠 위에 놓으면 옮겨진다', async ({ page }) => {
  await setup(page);
  const pt = await bandPoint(page);
  await startDrag(page);
  await page.mouse.move(pt.x, pt.y, { steps: 12 });
  await page.mouse.up(); await raf2(page);
  expect(await order(page)).toEqual(['B', 'g1', 'A']);
});
test('P1 끄는 동안만 띠가 비킨다', async ({ page }) => {
  await setup(page);
  expect(await yielded(page), '끌기 전').toBe(false);
  await startDrag(page);
  expect(await yielded(page), '끄는 중').toBe(true);
  await page.mouse.up(); await raf2(page);
  expect(await yielded(page), '끝난 뒤').toBe(false);
});
test('R1 Esc 로 취소해도 띠가 돌아온다 · 순서 그대로', async ({ page }) => {
  await setup(page);
  await startDrag(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#sG > .section-bottom-handle')).pointerEvents !== 'none', null, { timeout: 3000 });   // 버튼을 떼기 전(pointerup 몫이 아니다)
  await page.mouse.up(); await raf2(page);
  expect(await order(page)).toEqual(['A', 'B', 'g1']);
});
test('R2 창 밖에 놓아도 띠가 돌아온다 · 순서 그대로', async ({ page }) => {
  await setup(page);
  await startDrag(page);
  await page.mouse.move(-60, 200, { steps: 6 });
  await page.mouse.up(); await raf2(page);
  expect(await yielded(page)).toBe(false);
  expect(await order(page)).toEqual(['A', 'B', 'g1']);
});
test('R3 놓는 중 원본이 사라져 dragend 가 없어도 drop 으로 돌아온다', async ({ page }) => {
  await setup(page);
  const g = await page.evaluate(() => { const row = document.getElementById('A'); const dataTransfer = new DataTransfer(); row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer })); const during = getComputedStyle(document.querySelector('#sG > .section-bottom-handle')).pointerEvents; document.getElementById('g1').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })); return { during, after: getComputedStyle(document.querySelector('#sG > .section-bottom-handle')).pointerEvents }; });
  expect(g).toEqual({ during: 'none', after: 'auto' });
});
test('R4 dragstart 가 취소된 뒤 포인터를 떼면 돌아온다', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => { const b = document.createElement('div'); document.body.appendChild(b); b.addEventListener('dragstart', e => e.preventDefault()); b.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true })); const pe = () => getComputedStyle(document.querySelector('#sG > .section-bottom-handle')).pointerEvents; const during = pe(); document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); const after = pe(); b.remove(); return { during, after }; });
  expect(r).toEqual({ during: 'none', after: 'auto' });
});
test('H1 [음성] 블럭을 끈 뒤에도 손잡이를 끌면 바닥이 늘어난다', async ({ page }) => {
  await setup(page);
  const g = await R(page, '#g1');
  await startDrag(page);
  await page.mouse.move(g.x, g.top + 8, { steps: 12 });
  await page.mouse.up(); await raf2(page);
  const pt = await bandPoint(page);
  await page.mouse.down(); await page.mouse.move(pt.x, pt.y + 120, { steps: 6 }); await page.mouse.up(); await raf2(page);
  expect(await page.evaluate(() => parseFloat(document.getElementById('sG').style.minHeight))).toBeGreaterThan(0);
});
test('O1 [음성] 326 — 글자가 닿아 비킨 띠도 끌기 뒤 임자가 글자 · 비킨 자리에서 끌린다', async ({ page }) => {
  await setup(page, '<div class="row" id="rZ"><div class="text-block" data-type="body" id="tZ"><div class="tb-body">바닥 글자</div></div></div>');
  const g = await R(page, '#g1');
  await startDrag(page);
  await page.mouse.move(g.x, g.top + 8, { steps: 12 });
  await page.mouse.up(); await raf2(page);
  const t = await R(page, '#tZ');
  await page.mouse.move(t.x, t.bottom - 26); await page.mouse.move(t.x, t.bottom - 6); await raf2(page);
  expect(await owner(page, t.x, t.bottom - 6), '임자가 글자').toBe('tb-body');
  const h = await R(page, '#sG > .section-bottom-handle');
  expect(await page.evaluate(() => document.querySelector('#sG > .section-bottom-handle').classList.contains('sbh-out'))).toBe(true);
  await page.mouse.move(h.x, h.y); await raf2(page);
  expect(await owner(page, h.x, h.y)).toBe('section-bottom-handle');
  await page.mouse.down(); await page.mouse.move(h.x, h.y + 100, { steps: 6 }); await page.mouse.up(); await raf2(page);
  expect(await page.evaluate(() => parseFloat(document.getElementById('sG').style.minHeight))).toBeGreaterThan(0);
});
