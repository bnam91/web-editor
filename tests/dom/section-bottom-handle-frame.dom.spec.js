/* 프레임 바닥이 섹션 바닥에 닿으면 바닥 띠가 프레임을 먹던 것 — 틈이 있으면 손잡이가 비킨다(#326 과 같은 길).
   변이: js/section-bottom-handle.js 의 '.frame-block' 줄을 빼면 F1 빨강 · roomBelow 를 늘 참으로 두면 F3 빨강.
   장면 준비만 evaluate — 클릭·끌기는 진짜 마우스. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect, waitZoomSettled } = require('./_root-harness.js');
const raf2 = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, { gap = 100, touch = true } = {}) {
  await page.setViewportSize({ width: 1500, height: 1400 });   // 아래 떠 있는 도구막대가 바닥 점을 안 가리게
  const errs = await bootApp(page);
  await page.evaluate(({ gap, touch }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const mk = (id, h) => `<div class="section-block" id="${id}" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:${h}px"></div></div></div>`;
    c.insertAdjacentHTML('beforeend', mk('sA', 40) + mk('sB', 300));
    window.rebindAll?.(); window.applyZoom?.(100);
    const s = document.getElementById('sA');
    window.deselectAll?.(); window.selectSection?.(s);
    window.addFrameBlock();
    const F = s.querySelector('.frame-block'); F.id = 'fA';
    const row = F.closest('.row') || F;
    if (touch) { for (let n = row.nextElementSibling; n; n = row.nextElementSibling) n.remove(); s.style.paddingBottom = '0px'; s.querySelector(':scope > .section-inner').style.paddingBottom = '0px'; }
    c.style.gap = gap + 'px';
    window.deselectAll?.(); s.scrollIntoView({ block: 'center' });
  }, { gap, touch });
  await waitZoomSettled(page, 100);
  await waitStableRect(page, '#sA');
  return errs;
}
const rect = async (page, sel) => { const q = await waitStableRect(page, sel); return { x: q.left + q.width / 2, r: q.left + q.width, top: q.top, bottom: q.top + q.height }; };
const handle = (page) => page.evaluate(() => { const h = document.querySelector('#sA > .section-bottom-handle'); const b = h.getBoundingClientRect(); return { out: h.classList.contains('sbh-out'), cy: b.top + b.height / 2, shown: b.height > 0 }; });

async function dragHandle(page) {
  const s = await rect(page, '#sA');
  await page.mouse.move(s.x, s.bottom - 60); await page.mouse.move(s.x, s.bottom - 4); await raf2(page);
  await expect.poll(async () => (await handle(page)).shown, { message: '전제 — 손잡이가 떴다' }).toBe(true);
  const h = await handle(page);
  await page.mouse.move(s.x, h.cy); await raf2(page);
  expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('#sA > .section-bottom-handle'), [s.x, h.cy]), '★그 자리 임자가 손잡이').toBe(true);
  const h0 = await page.evaluate(() => document.getElementById('sA').offsetHeight);
  await page.mouse.down(); await page.mouse.move(s.x, h.cy + 40, { steps: 3 }); await page.mouse.move(s.x, h.cy + 80, { steps: 3 }); await page.mouse.up();
  await raf2(page);
  const s1 = await page.evaluate(() => { const e = document.getElementById('sA'); return { h: e.offsetHeight, mh: e.style.minHeight }; });
  expect(s1.mh, '★끌면 바닥 높이가 생긴다').not.toBe('');
  expect(s1.h - h0).toBe(80);
  return h;
}

test('F1 프레임 바닥이 닿으면 바닥 10px 를 눌러도 프레임이 골라진다', async ({ page }) => {
  const errs = await scene(page);
  const f = await rect(page, '#fA');
  const s = await rect(page, '#sA');
  expect(Math.round(s.bottom - f.bottom), '전제 — 프레임 바닥 = 섹션 바닥').toBe(0);
  await page.mouse.move(f.r - 8, f.bottom - 60); await page.mouse.move(f.r - 8, f.bottom - 4); await raf2(page);
  await page.mouse.down(); await page.mouse.up();
  await expect.poll(() => page.evaluate(() => document.getElementById('fA').classList.contains('selected'))).toBe(true);
  expect(errs).toEqual([]);
});

test('F2 비켜도 손잡이가 잡히고 끌린다', async ({ page }) => {
  await scene(page);
  expect((await dragHandle(page)).out).toBe(true);
});

test('F3 틈이 좁으면(화면 30px) 안 비키고 제자리에서 끌린다', async ({ page }) => {
  await scene(page, { gap: 30 });
  expect((await dragHandle(page)).out).toBe(false);
});

test('N1 [음성] 프레임이 안 닿으면 손잡이는 제자리', async ({ page }) => {
  await scene(page, { touch: false });
  expect((await dragHandle(page)).out).toBe(false);
});
