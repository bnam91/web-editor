/* sec-pad-dblclick-bgedit-t5-06 — 섹션 패딩 영역 더블클릭 = 배경이미지 편집모드 (t5-06 · 9dbe6185 의 검사 · 같은 커밋에 못 실어 뒤따라 싣는다).
 *
 * 현빈 원문: 「섹션에서 패딩영역을 더블클릭하면 배경이미지 편집모드로 들어가게 해줘.」
 * 바닥(d772f49e · 68ba1f1b) 실앱: 진입 = 패널 「배경이미지 편집」 단추 하나뿐 · 좌우 패딩 더블클릭 → _secBgEditing false.
 * P1 왼·오른 패딩 더블클릭 → 편집모드(고스트 1) · P2 (음성) 안쪽 글 블럭 더블클릭은 안 들어간다 · P3 (음성) 배경 그림 없는 섹션은 무동작
 * P4 (음성 · 지디 정밀) 위 패딩 띠 더블클릭은 안 탄다 — 위아래는 현빈 물음
 * P0 (양성대조 · 자가 산다) 패널 단추 길(window.enterSectionBgEditMode)로는 바닥에서도 들어간다
 * ⛔waitForTimeout 금지. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
async function setup(page, { img = true } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(([img, PNG]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sP" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="iP" style="padding-left:72px;padding-right:72px"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(40);
    const S = document.getElementById('sP'); window.selectSection(S); window.addTextBlock('body');
    if (img) { S.dataset.bgImg = PNG; window.applySectionBg(S); }
    window.deselectAll?.();
    S.scrollIntoView({ block: 'center' });
  }, [img, PNG]);
  return errs;
}
const editing = (page) => page.evaluate(() => ({ on: !!document.getElementById('sP')._secBgEditing, ghost: document.querySelectorAll('.sec-bg-ghost').length }));
async function padPoint(page, side) {
  const r = await waitStableRect(page, '#iP');
  return page.evaluate(([side]) => { const i = document.getElementById('iP'); const b = i.getBoundingClientRect(); const k = b.width / i.offsetWidth; const cs = getComputedStyle(i);
    const x = side === 'L' ? b.left + parseFloat(cs.paddingLeft) * k / 2 : b.right - parseFloat(cs.paddingRight) * k / 2; const y = b.top + b.height / 2;
    return { x, y, hit: document.elementFromPoint(x, y)?.id || null }; }, [side, r]);
}

test('P0 (양성대조) 패널 단추 길로는 들어간다 — 자가 «모드»를 잰다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.enterSectionBgEditMode(document.getElementById('sP')));
  await expect.poll(() => editing(page)).toEqual({ on: true, ghost: 1 });
  expect(errs).toEqual([]);
});
for (const side of ['L', 'R']) {
  test(`P1-${side} ${side === 'L' ? '왼' : '오른'} 패딩 더블클릭 → 배경이미지 편집모드`, async ({ page }) => {
    const errs = await setup(page);
    const pt = await padPoint(page, side);
    expect(pt.hit, '★전제: 그 점 맨 위 = section-inner(패딩 띠)').toBe('iP');
    expect(await editing(page), '★전제: 아직 편집모드 아님').toEqual({ on: false, ghost: 0 });
    await page.mouse.dblclick(pt.x, pt.y);
    await expect.poll(() => editing(page)).toEqual({ on: true, ghost: 1 });
    expect(errs).toEqual([]);
  });
}
test('P2 (음성) 안쪽 글 블럭 더블클릭은 편집모드로 안 간다(그 블럭 것)', async ({ page }) => {
  const errs = await setup(page);
  const r = await waitStableRect(page, '#sP .text-block');
  await page.mouse.dblclick(r.cx, r.cy);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('#sP .text-block [contenteditable="true"], #sP .text-block.editing'))).toBe(true);
  expect(await editing(page)).toEqual({ on: false, ghost: 0 });
  expect(errs).toEqual([]);
});
test('P3 (음성) 배경 그림 없는 섹션 — 패딩 더블클릭 무동작', async ({ page }) => {
  const errs = await setup(page, { img: false });
  const pt = await padPoint(page, 'L');
  await page.mouse.dblclick(pt.x, pt.y);
  await expect.poll(() => page.evaluate(() => document.getElementById('sP').classList.contains('selected'))).toBe(true);
  expect(await editing(page)).toEqual({ on: false, ghost: 0 });
  expect(errs).toEqual([]);
});
test('P4 (음성 · 지디 정밀) 위 패딩 더블클릭은 안 탄다 — 좌우 띠만(위아래는 현빈 물음)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { document.getElementById('iP').style.paddingTop = '60px'; });
  const pt = await page.evaluate(() => { const i = document.getElementById('iP'); const b = i.getBoundingClientRect(); const k = b.width / i.offsetWidth; return { x: b.left + b.width / 2, y: b.top + 30 * k, hit: document.elementFromPoint(b.left + b.width / 2, b.top + 30 * k)?.id }; });
  expect(pt.hit, '★전제: 그 점 맨 위 = section-inner(위 패딩)').toBe('iP');
  await page.mouse.dblclick(pt.x, pt.y);
  await expect.poll(() => page.evaluate(() => document.getElementById('sP').classList.contains('selected'))).toBe(true);
  expect(await editing(page)).toEqual({ on: false, ghost: 0 });
  expect(errs).toEqual([]);
});
