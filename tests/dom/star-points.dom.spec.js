/* star-points.dom.spec.js — B2 별 쉐이프 우측패널 「꼭짓점」(3~12). 앱 통째(bootApp)로 잰다.
 * S1 7 → polygon 14쌍 · 슬라이더/숫자칸 동기 · 별이 아니면 줄이 없다
 * S2 이미지 채우기 clip-path 도 같은 꼭짓점 수(_syncShapeImageClip 이 dataset.starPoints 를 읽는다)
 * S3 저장 왕복(getSerializedCanvas → restoreSnapshot) 뒤 points·dataset 그대로 + 5(기본)는 dataset 안 쓴다
 * S4 ★한 블럭에서 꼭짓점 값을 10번 바꾸고 ⌘Z 10번 — 끝까지(복원 때 다시 쓰면 비멱등 → R1 꼴로 깊이 1 에 갇힌다)
 * S5 그라데이션(색) 유지 — 꼭짓점을 바꿔도 svg style·shapeColor·shapeGradient 불변
 * 양성대조: GD1001_ROOT=<36cbe872 체크아웃> → 전부 빨강(패널에 줄이 없다). 변이: 가드 빼고 항상 다시 쓰기 → S4 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const GRAD = 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)';
const STAR = `<div class="section-block" id="sS1" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 32px; padding-right: 32px;"><div class="row" data-layout="stack"><div class="frame-block" id="ss_star1" data-free-layout="true" data-width="200" data-height="190" data-layer-name="star" style="width:200px;height:190px;min-height:190px;padding:0;margin:0 auto;align-self:center;background-color:transparent;"><div class="shape-block" data-type="shape" data-shape-type="star" data-shape-color="#cccccc" data-shape-stroke-width="0" id="shp_star1" style="position:absolute;left:0;top:0;"><svg class="shape-svg" viewBox="0 0 200 190" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="color:#cccccc;stroke-width:0;fill:currentColor;stroke:currentColor;"><polygon points="100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70"></polygon></svg></div></div></div></div></div>`;
const ID = 'shp_star1';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
  }, STAR);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.clearHistory());
  await page.evaluate((id) => window.selectBlock(id), ID);
  await expect(page.locator('#shape-w-num')).toBeVisible();
  return errs;
}
const pts = (page) => page.evaluate((id) => document.querySelector('#' + id + ' svg polygon').getAttribute('points'), ID);
const nPairs = async (page) => (await pts(page)).trim().split(/\s+/).length;
const ds = (page) => page.evaluate((id) => document.getElementById(id).dataset.starPoints ?? null, ID);
async function setStar(page, v) {
  await page.evaluate((id) => window.selectBlock(id), ID);
  const inp = page.locator('#shape-star-num');
  await inp.fill(String(v));
  await inp.press('Enter');
  await inp.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));   // Enter 가 commit 을 안 쏘는 판에서도 한 번 확정(같은 값이면 push 가 접힌다)
}

test('S0 전제 — 별 패널에 「꼭짓점」 줄이 있고 값은 5, 별이 아니면 줄이 없다', async ({ page }) => {
  const errs = await setup(page);
  expect(errs, errs.join(' | ')).toEqual([]);
  await expect(page.locator('#shape-star-num')).toHaveValue('5');
  await expect(page.locator('.prop-row:has(#shape-star-slider) .prop-label')).toHaveText('꼭짓점');
  await page.evaluate((id) => { const b = document.getElementById(id); b.dataset.shapeType = 'polygon'; window.selectBlock(id); }, ID);
  await expect(page.locator('#shape-w-num')).toBeVisible();
  expect(await page.locator('#shape-star-num').count()).toBe(0);
});
test('S1 7 입력 → polygon 14쌍 · dataset.starPoints=7 · 슬라이더 동기', async ({ page }) => {
  await setup(page);
  expect(await nPairs(page)).toBe(10);
  await setStar(page, 7);
  expect(await nPairs(page)).toBe(14);
  expect(await ds(page)).toBe('7');
  await expect(page.locator('#shape-star-slider')).toHaveValue('7');
  await setStar(page, 99);   // 범위 밖 → 12
  expect(await nPairs(page)).toBe(24);
  await setStar(page, 5);
  expect(await pts(page)).toBe('100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70');
});
test('S2 이미지 채우기 clip-path 가 꼭짓점 수를 따른다(7 → 14 꼭짓점)', async ({ page }) => {
  await setup(page);
  await page.evaluate((id) => {
    const b = document.getElementById(id);
    const img = document.createElement('div'); img.className = 'shape-img-fill'; b.insertBefore(img, b.firstChild);
    window._syncShapeImageClip(b);
  }, ID);
  const clip = () => page.evaluate((id) => document.querySelector('#' + id + ' > .shape-img-fill').style.clipPath, ID);
  expect((await clip()).split(',').length).toBe(10);
  await setStar(page, 7);
  expect((await clip()).split(',').length).toBe(14);
});
test('S3 저장 왕복 — 복원 뒤 points·dataset 그대로, 5 는 dataset 을 안 쓴다', async ({ page }) => {
  await setup(page);
  expect(await ds(page)).toBe(null);
  await setStar(page, 9);
  const before = await pts(page);
  const r = await page.evaluate(() => { const a = window.getSerializedCanvas(); window.restoreSnapshot({ canvas: a, settings: {}, selection: null }); return a === window.getSerializedCanvas(); });
  expect(r, '복원이 멱등이 아니다 — 꼭짓점이 복원 때 다시 만들어진다').toBe(true);
  expect(await pts(page)).toBe(before);
  expect(await ds(page)).toBe('9');
  await page.evaluate((id) => window.selectBlock(id), ID);
  await expect(page.locator('#shape-star-num')).toHaveValue('9');
});
test('S4 ★꼭짓점 10번 바꾸고 ⌘Z 10번 — 하나씩 끝까지', async ({ page }) => {
  await setup(page);
  const seq = [6, 7, 8, 9, 10, 11, 12, 3, 4, 8];
  for (const v of seq) await setStar(page, v);
  expect(await ds(page)).toBe('8');
  const trail = [];
  await page.evaluate(() => { document.activeElement?.blur?.(); });   // ★선택은 «유지» — 사용자는 별을 고른 채 ⌘Z 한다(패널이 복원 뒤 다시 그려지는 길을 지난다)
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Meta+z'); await page.waitForTimeout(150); trail.push(await nPairs(page) / 2); }
  expect(trail, '⌘Z 마다 꼭짓점 수 — 한 걸음씩 5 까지(깊이 1 에 갇히면 같은 값이 반복)').toEqual([4, 3, 12, 11, 10, 9, 8, 7, 6, 5]);
});
test('S5 그라데이션·색 유지 — 꼭짓점을 바꿔도 칠이 안 바뀐다', async ({ page }) => {
  await setup(page);
  await page.evaluate(([id, g]) => {
    const b = document.getElementById(id); b.dataset.shapeColor = g; b.dataset.shapeGradient = JSON.stringify({ stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 100 }] });
    const svg = b.querySelector('svg'); svg.style.fill = 'url(#g_test)'; svg.style.color = '#ff0000';
  }, [ID, GRAD]);
  const snap = () => page.evaluate((id) => { const b = document.getElementById(id); const s = b.querySelector('svg'); return [b.dataset.shapeColor, b.dataset.shapeGradient, s.style.fill, s.style.color, s.getAttribute('viewBox')]; }, ID);
  const a = await snap();
  await setStar(page, 8);
  expect(await nPairs(page)).toBe(16);
  expect(await snap()).toEqual(a);
});
