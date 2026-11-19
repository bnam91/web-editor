/* shape-shadow-wrapper-clip.dom.spec.js — t13B-01 프레임 안 원형 도형 그림자가 잘림
 *   실행: npx playwright test tests/dom/shape-shadow-wrapper-clip.dom.spec.js
 *   원인(코드): 도형은 «래퍼 frame-block > shape-block» 이고 frame-block 기본 = overflow hidden.
 *     래퍼를 푸는 규칙은 «도형 선택 중»뿐이라, 선택을 풀면 drop-shadow 가 도형 상자에서 잘렸다.
 *   W1 [대조] 그림자 없음 · 선택 없음 → 래퍼 hidden(옛 그대로)
 *   W2 그림자 켬 · 선택 없음 → 래퍼 visible
 *   W3 바깥 «사용자» 프레임(기본 자름 / 켬) 은 그대로 hidden · 끔(false)이면 visible — 피그마 Clip content 와 같은 뜻
 *   양성대조: _patches/T13B01-CTL-drop-css.patch(새 CSS 규칙 삭제) → W2 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="wS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">'
      + '<div class="row" id="wR1" data-layout="stack"></div><div class="row" id="wR2" data-layout="stack"></div></div></div>');
    const wrap = (id) => {
      const { block: sb } = window.makeShapeBlock('ellipse'); sb.id = id;
      const f = document.createElement('div'); f.className = 'frame-block'; f.id = id + 'F';
      f.dataset.width = '100'; f.dataset.height = '100'; f.style.width = '100px'; f.style.height = '100px';
      f.appendChild(sb); return f;
    };
    document.getElementById('wR1').appendChild(wrap('wA'));                    // 섹션 직속 도형
    const user = document.createElement('div'); user.className = 'frame-block'; user.id = 'wU';
    user.style.width = '300px'; user.style.height = '200px';
    user.appendChild(wrap('wB')); document.getElementById('wR2').appendChild(user);   // 사용자 프레임 안 도형
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  });
  return errs;
}
const ov = (page, id) => page.evaluate((id) => getComputedStyle(document.getElementById(id)).overflowY, id);
const shadowOn = (page, id) => page.evaluate((id) => {
  window.setFxShadow(document.getElementById(id), { state: 'on', x: 20, y: 0, blur: 0, op: 100 }, { history: false });
  window.deselectAll?.();
}, id);

test('W1 [대조] 그림자 없는 도형 래퍼 = 옛대로 자른다', async ({ page }) => {
  const errs = await scene(page);
  expect(await page.evaluate(() => !!document.querySelector('#wAF > .shape-block.selected')), '[전제] 선택 없음').toBe(false);
  expect(await ov(page, 'wAF')).toBe('hidden');
  expect(errs).toEqual([]);
});

test('W2 그림자 켠 도형 — 선택을 풀어도 래퍼가 안 자른다', async ({ page }) => {
  const errs = await scene(page);
  await shadowOn(page, 'wA');
  await expect.poll(() => page.evaluate(() => document.getElementById('wA').dataset.fxShadow)).toBe('on');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('wA')).filter), '[전제] drop-shadow 가 걸렸다').toMatch(/drop-shadow/);
  expect(await ov(page, 'wAF'), '★선택 없는 그림자 도형의 래퍼가 그림자를 자른다').toBe('visible');
  expect(errs).toEqual([]);
});

test('W3 바깥 사용자 프레임 — 자르기 기본/켬은 그대로 자르고, 끔이면 안 자른다', async ({ page }) => {
  const errs = await scene(page);
  await shadowOn(page, 'wB');
  await expect.poll(() => ov(page, 'wBF')).toBe('visible');
  expect(await ov(page, 'wU'), '★래퍼를 풀면서 바깥 사용자 프레임(기본 자름)까지 풀렸다').toBe('hidden');
  await page.evaluate(() => { document.getElementById('wU').dataset.clipContent = 'true'; });
  await expect.poll(() => ov(page, 'wU')).toBe('hidden');
  await page.evaluate(() => { document.getElementById('wU').dataset.clipContent = 'false'; });
  await expect.poll(() => ov(page, 'wU')).toBe('visible');
  expect(errs).toEqual([]);
});
