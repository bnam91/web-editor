/* t13c-01-asset-corner-radius-alt — t13C-01: 에셋 모서리 반경 손잡이를 ⌥(Alt)를 누른 채 끌면 «그 모서리 하나»만 바뀐다.
 *   ⌥ 없이 끌면 지금 그대로 네 모서리가 같이 바뀐다 · 우측 패널 숫자(#asset-r-number)는 끄는 값을 따라간다 · ⌘Z 한 걸음.
 *   장면: has-image 에셋(클릭 = 고르기 · 빈 에셋은 파일 고르기로 샌다) → 손잡이 nw 를 ⌥ 끌기 → nw 만 >0 · 나머지 0 ·
 *         ⌘Z 한 번 = 끌기 전(_history-step) → 다시 ⌥ nw 끌기 → 이번엔 ⌥ 없이 sw 끌기 → 네 모서리 같음.
 *   자 = 계산된 border-*-radius(px) · 패널 input 값. ⛔고정 대기 0(조건 대기 — expectOneUndoStep 내부 settle 은 공용 헬퍼).
 * 양성대조(CTL _patches/t13c-01-asset-corner-ctl.patch): oneCorner 를 false 로 고정하면 → «nw 만 바뀜» 단언 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = `<div class="section-block" id="sR" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 32px; padding-right: 32px;">
  <div class="gap-block" data-type="gap" id="gR0" style="height:40px;"></div>
  <div class="row" id="rowR"><div class="asset-block has-image" id="abR" data-img-src="${PX}" data-fit="cover" style="height:300px;">
    <div class="asset-img-clip"><img class="asset-img" src="${PX}" draggable="false" style="object-fit:cover;"></div>
    <button class="asset-overlay-clear" title="이미지 제거">✕</button><div class="asset-overlay"></div></div></div>
  <div class="gap-block" data-type="gap" id="gR1" style="height:200px;"></div></div></div>`;

const radii = (page) => page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('abR'));
  return [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(v => parseFloat(v) || 0);
});
/* 손잡이를 안쪽(블럭 가운데 쪽)으로 40px 대각 끌기 — 반경이 커지는 방향(overlay-handles.js delta 식). */
async function dragHandle(page, dir, { alt }) {
  const h = await waitStableRect(page, `.asset-radius-handle.${dir}`);
  const sx = dir.includes('w') ? 1 : -1, sy = dir.includes('n') ? 1 : -1;
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.move(h.cx, h.cy);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(h.cx + sx * 10 * i, h.cy + sy * 10 * i);
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
}

async function select(page) {
  const b = await waitStableRect(page, '#abR');
  await page.mouse.click(b.left + b.width / 2, b.top + b.height / 2);
  await expect.poll(() => page.evaluate(() => document.getElementById('abR').classList.contains('selected'))).toBe(true);
  await expect(page.locator('.asset-radius-handle.nw')).toHaveCount(1);
  await expect(page.locator('#asset-r-number')).toHaveCount(1);
}

test('R1 ⌥ 끌기 = 그 모서리만 · 패널 숫자 따라감 · ⌘Z 한 걸음 → ⌥ 없이 = 네 모서리 같이', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); }, SEC);
  await page.evaluate(() => document.getElementById('abR').scrollIntoView({ block: 'center' }));
  await select(page);
  expect(await radii(page), '전제 — 처음엔 네 모서리 0').toEqual([0, 0, 0, 0]);

  /* ⌥ + nw — nw 하나만 · ⌘Z 한 걸음 */
  await expectOneUndoStep(page, async () => {
    await dragHandle(page, 'nw', { alt: true });
    const [tl, tr, br, bl] = await radii(page);
    expect(tl, 'nw 가 커졌다').toBeGreaterThan(0);
    expect([tr, br, bl], '⌥ 끌기 — 다른 세 모서리는 그대로 0').toEqual([0, 0, 0]);
    expect(Number(await page.locator('#asset-r-number').inputValue()), '패널 숫자 = 끈 모서리 값').toBe(tl);
  }, '에셋 ⌥ 한 모서리');
  expect(await radii(page), '⌘Z 한 번 뒤 = 끌기 전').toEqual([0, 0, 0, 0]);

  /* ⌥ 없이 sw — 네 모서리 같이(지금 동작 그대로) · ⌘Z 가 캔버스를 다시 그렸을 수 있어 다시 고른다 */
  await page.evaluate(() => window.deselectAll?.());
  await select(page);
  await dragHandle(page, 'sw', { alt: false });
  const r = await radii(page);
  expect(r[0], 'sw 끌기로 반경이 생겼다').toBeGreaterThan(0);
  expect(new Set(r).size, `⌥ 없음 — 네 모서리가 같은 값(${r})`).toBe(1);
  expect(Number(await page.locator('#asset-r-number').inputValue())).toBe(r[0]);
  expect(errs).toEqual([]);
});
