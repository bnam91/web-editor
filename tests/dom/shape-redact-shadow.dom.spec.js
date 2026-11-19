/* shape-redact-shadow.dom.spec.js — t13B-02 원형 도형 「블러로 가리기」 와 그림자 효과 충돌
 *   실행: npx playwright test tests/dom/shape-redact-shadow.dom.spec.js
 *   원인(코드): 가림막(.shape-redact)은 칠을 비운다(fill:none !important · 배경 α 0.001) → 그림자 = filter drop-shadow 가
 *     따라 그릴 실루엣이 없어 «새 그림자도, 있던 그림자도» 안 보였다. 값(dataset fx*)은 남아 있었다.
 *   처방: 가림막일 때만 상자 그림자(box-shadow · 원은 border-radius 50%) · 끄면 drop-shadow 로 돌아간다.
 *   R1 [대조] 가림막 없음 = drop-shadow 그대로(옛 바이트 · box-shadow 없음)
 *   R2 그림자 → 가림막 켬: 있던 그림자 값 유지 + box-shadow 로 보임 · filter 비움 · 블러(backdrop-filter) 그대로
 *   R3 가림막 → 그림자 추가: box-shadow · 원은 둥근 모서리
 *   R4 가림막 끔: drop-shadow 로 돌아오고 box-shadow 없음
 *   양성대조: _patches/T13B02-CTL-no-box-branch.patch(가림막 갈래 삭제) → R2·R3 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="rS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="row" id="rR" data-layout="stack"></div></div></div>');
    const { block: sb } = window.makeShapeBlock('ellipse'); sb.id = 'rE';
    const f = document.createElement('div'); f.className = 'frame-block'; f.id = 'rEF';
    f.dataset.width = '120'; f.dataset.height = '120'; f.style.width = '120px'; f.style.height = '120px';
    f.appendChild(sb); document.getElementById('rR').appendChild(f);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  });
  return errs;
}
const st = (page) => page.evaluate(() => {
  const el = document.getElementById('rE'); const cs = getComputedStyle(el);
  return { redact: el.classList.contains('shape-redact'), fx: el.dataset.fxShadow || null,
    filter: el.style.filter || '', box: el.style.boxShadow || '', radius: cs.borderTopLeftRadius,
    backdrop: cs.backdropFilter || cs.webkitBackdropFilter || '' };
});
const shadow = (page) => page.evaluate(() => window.setFxShadow(document.getElementById('rE'), { state: 'on', x: 10, y: 10, blur: 0, op: 100 }, { history: false }).ok);
/* 크롬은 계산된 filter 의 색을 «앞»에 쓴다(지혜맥 실측 "drop-shadow(rgb(0, 0, 0) 10px 10px 0px)") — 색 자리 무관 · 뜻(오프셋 10·10 · 흐림 0 drop-shadow) 그대로 */
const DROP_10 = /^drop-shadow\((?:rgba?\([^)]*\) )?10px 10px 0px(?: |\))/;
const redact = (page, on) => page.evaluate((on) => window.updateShapeBlock('rE', { shapeRedact: on }).ok, on);

test('R1 [대조] 가림막 없음 — drop-shadow 그대로', async ({ page }) => {
  const errs = await scene(page);
  expect(await shadow(page)).toBe(true);
  const s = await st(page);
  expect(s.filter).toMatch(DROP_10);
  expect(s.box, '★가림막이 아닌데 상자 그림자가 생겼다').toBe('');
  expect(errs).toEqual([]);
});

test('R2 그림자 → 가림막 켬 — 있던 그림자가 사라지지 않는다', async ({ page }) => {
  const errs = await scene(page);
  await shadow(page);
  expect(await redact(page, true)).toBe(true);
  await expect.poll(() => st(page).then(s => s.redact)).toBe(true);
  const s = await st(page);
  expect(s.fx, '★가림막을 켜자 그림자 값이 지워졌다').toBe('on');
  expect(s.box, '★가림막 도형의 그림자가 안 그려진다').toMatch(/10px 10px 0px/);
  expect(s.filter, '★실루엣 없는 drop-shadow 가 남았다').toBe('');
  expect(s.backdrop, '[전제] 블러 가림은 그대로').toMatch(/blur/);
  expect(errs).toEqual([]);
});

test('R3 가림막 → 그림자 추가 — 상자 그림자 · 원은 둥글게', async ({ page }) => {
  const errs = await scene(page);
  await redact(page, true);
  await expect.poll(() => st(page).then(s => s.redact)).toBe(true);
  await shadow(page);
  const s = await st(page);
  expect(s.box).toMatch(/10px 10px 0px/);
  expect(s.filter).toBe('');
  expect(s.radius, '[전제] 원 가림막은 border-radius 50% — 상자 그림자가 원을 따른다').toBe('50%');
  expect(errs).toEqual([]);
});

test('R4 가림막 끔 — drop-shadow 로 돌아온다', async ({ page }) => {
  const errs = await scene(page);
  await shadow(page);
  await redact(page, true);
  await expect.poll(() => st(page).then(s => s.box)).toMatch(/10px/);
  expect(await redact(page, false)).toBe(true);
  await expect.poll(() => st(page).then(s => s.redact)).toBe(false);
  const s = await st(page);
  expect(s.filter).toMatch(DROP_10);
  expect(s.box).toBe('');
  expect(errs).toEqual([]);
});
