/* drop-indicator-no-grow-351 — 끌기 중 놓기 표시선이 흐름 높이를 차지해 섹션이 «9 × 배율» px 자라던 것(시트 351).
 * 자 = offsetHeight·offsetTop(레이아웃 px — 배율 무관) · 시간 = requestAnimationFrame 두 번.
 * 음성: 표시선은 그대로 보이고(높이 5) · 놓기는 그 자리로 간다 · 놓은 뒤 표시선이 안 남는다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block');
    const add = () => { window.deselectAll(); window.selectSection(sec); window._activeFrame = null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f; };
    const A = add(), B = add();
    window.updateFrameBlock(A.id, { width: 400, height: 100 }); window.updateFrameBlock(B.id, { width: 400, height: 100 });
    A.scrollIntoView({ block: 'center' });
    return { A: A.id, B: B.id };
  }, FR);
  await raf(page);
  return { errs, ...ids };
}
const box = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const lastGapY = (page) => page.evaluate(() => { const g = [...document.querySelector('#canvas .section-inner').children].filter((e) => e.classList.contains('gap-block')).pop().getBoundingClientRect(); return g.top + g.height / 2; });
const layout = (page) => page.evaluate(() => { const s = document.querySelector('#canvas .section-block'), i = s.querySelector('.drop-indicator'); return { sec: s.offsetHeight, inner: s.querySelector('.section-inner').offsetHeight, indH: i?.offsetHeight ?? null, indPar: i?.parentElement.classList.contains('section-inner') ?? null }; });

test('섹션 위로 끄는 동안 표시선이 보이되 섹션 높이가 그대로고, 놓으면 그 자리로 간다', async ({ page }) => {
  const { errs, A, B } = await scene(page);
  const a = await box(page, A); await page.mouse.click(a.x, a.y); await raf(page);
  const before = await layout(page);
  expect(before.indH, '[전제] 끌기 전 표시선 없음').toBeNull();
  const y = await lastGapY(page);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(a.x, a.y + (y - a.y) * i / 12); await raf(page); }
  await raf(page);
  const during = await layout(page);
  expect(during.indH, '[전제·음성] 표시선이 제 높이로 떠 있다').toBe(5);
  expect(during.indPar, '[전제] 섹션 흐름 안의 표시선').toBe(true);
  expect(during.sec, '섹션 높이가 그대로').toBe(before.sec);
  expect(during.inner, '섹션 안쪽 높이가 그대로').toBe(before.inner);
  await page.mouse.up(); await raf(page);
  const order = await page.evaluate(([A, B]) => { const k = [...document.querySelector('#canvas .section-inner').children]; return k.indexOf(document.getElementById(A)) > k.indexOf(document.getElementById(B)); }, [A, B]);
  expect(order, '음성 — 놓기는 표시선 자리(B 뒤)로 간다').toBe(true);
  const after = await layout(page);
  expect(after.indH, '음성 — 놓은 뒤 표시선이 안 남는다').toBeNull();
  expect(after.sec, '놓은 뒤 높이도 그대로').toBe(before.sec);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('노트패널 미리보기 안내선(.sp2c-insert-indicator)도 섹션을 안 키운다', async ({ page }) => {
  const { errs } = await scene(page);
  const before = await layout(page);
  const y = await lastGapY(page);
  const h = await page.evaluate((y) => { const r = document.querySelector('#canvas .section-inner').getBoundingClientRect(); const kind = window.previewScratchDropAt(r.left + r.width / 2, y); const i = document.querySelector('.sp2c-insert-indicator'); const out = { kind: kind?.kind ?? kind, indH: i?.offsetHeight ?? null }; return out; }, y);
  expect(h.indH, '[전제·음성] 안내선이 제 높이로 떠 있다').toBe(5);
  expect((await layout(page)).sec, '섹션 높이가 그대로').toBe(before.sec);
  await page.evaluate(() => window.clearScratchDropGuides?.());
  expect(errs, errs.join(' | ')).toEqual([]);
});
