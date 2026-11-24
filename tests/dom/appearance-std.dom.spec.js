/* appearance-std.dom.spec.js — 표준 Appearance 절(정본 시안 8910 #mkp-appstd gdragon 88f5aa9 · 현빈 확정 261124 10:47·10:59·14:39·18:38 · 계획 handoff/PLAN-appearance-layout-std-261124 · 지디 GO A1)
 *   A1 = 부품(js/props/_appearance-section.js) + 첫 소비자 frame — 슬라이더 걷음(숫자 + 라벨 끌기) · 머리 [눈](7-2 보류 표식) · 끝 Individual corners(7-3 보류 표식)
 *   ⛔저장 키(dataset.radius)·숫자 칸 id(ss-radius-num) 무변.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/appearance-std.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function frameScene(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    window.addFrameBlock();
  });
  await expect(page.locator('#ss-radius-num')).toHaveCount(1);
  return errs;
}
const frameEl = (page) => page.evaluate(() => { const f = document.querySelector('#canvas .frame-block.selected'); return { r: f.dataset.radius ?? null, css: f.style.borderRadius }; });   // 고른 것 = 방금 더한 프레임(새 섹션엔 기본 프레임이 따로 하나 있다)
const setNum = (page, v) => page.evaluate((v) => { const n = document.getElementById('ss-radius-num'); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, v);

test('AS1 frame Appearance = 표준 꼴 — 슬라이더 없음 · 숫자 칸(옛 id)은 부품 안 · 머리 눈/끝 모서리 단추 = 보류 표식(aria-disabled + 까닭)', async ({ page }) => {
  const errs = await frameScene(page);
  const o = await page.evaluate(() => {
    const sec = document.querySelector('#panel-right .prop-section[data-sec="appearance"]');
    const eye = sec?.querySelector('.prop-sec-head #ss-app-eye'), cor = document.getElementById('ss-corners');
    return {
      slider: !!document.getElementById('ss-radius-slider'),
      inPart: !!document.getElementById('ss-radius-num')?.closest('[data-part="appearance"] [data-field="appearance-radius"]'),   // data-field 이름 = 시안 #mkp-appstd 마크업 줄(appearance-radius)
      label: sec?.querySelector('[data-part="appearance"] .ui-s2-cell > span')?.textContent,
      eye: eye ? [eye.getAttribute('aria-disabled'), /보류/.test(eye.title)] : null,
      corners: cor ? [cor.getAttribute('aria-disabled'), /보류/.test(cor.title), cor.closest('[data-part="appearance"]') === document.getElementById('ss-radius-num')?.closest('[data-part="appearance"]')] : null,
      clip: !!document.getElementById('ss-clip-toggle'),
    };
  });
  expect(o).toEqual({ slider: false, inPart: true, label: 'Corner radius', eye: ['true', true], corners: ['true', true, true], clip: true });
  expect(errs).toEqual([]);
});

test('AS2 frame 모서리 숫자 칸 — 20 → dataset.radius 20 · borderRadius 20px · 이력 1 · 200 → 80 으로 잘림(옛 0~80)', async ({ page }) => {
  const errs = await frameScene(page);
  await page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
  await setNum(page, 20);
  expect(await frameEl(page)).toEqual({ r: '20', css: '20px' });
  expect(await page.evaluate(() => window.__ph)).toBe(1);
  await setNum(page, 200);
  expect([await page.inputValue('#ss-radius-num'), (await frameEl(page)).r]).toEqual(['80', '80']);
  expect(errs).toEqual([]);
});

test('AS3 frame 모서리 라벨 끌기 — 아이콘을 오른쪽으로 15px 끌면 +15 · 놓을 때 이력 1(슬라이더 대신)', async ({ page }) => {
  const errs = await frameScene(page);
  await setNum(page, 10);
  await page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
  const h = page.locator('#ss-radius-num-scrub');
  await expect(h).toHaveCount(1);
  const b = await h.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 15, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => frameEl(page)).toEqual({ r: '25', css: '25px' });
  expect([await page.inputValue('#ss-radius-num'), await page.evaluate(() => window.__ph)]).toEqual(['25', 1]);
  expect(errs).toEqual([]);
});

/* ── A2 — dataset.radius 무리(겹침 없는 넷 먼저 · 지디 261124): modal · banner02 · canvas(card) · innercard ── */
async function blockScene(page, add, numId) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (add) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    (0, eval)(add);
  }, add);
  await expect(page.locator('#' + numId)).toHaveCount(1);
  return errs;
}
for (const [name, add, cls, pfx, numId, max] of [
  ['modal', 'window.addModalBlock({})', 'modal-block', 'mdl', 'mdl-radius-number', 60],
  ['banner02', 'window.addBanner02Block()', 'banner02-block', 'bn2', 'bn2-radius-num', 60],
  ['canvas', "window.addCanvasBlock(); { const b = [...document.querySelectorAll('#canvas .canvas-block')].pop(); delete b.dataset.cardMode; window.showCanvasProperties(b); }", 'canvas-block', 'cvb', 'cvb-radius-number', 60],   // 새 카드 = simple 꼴(심플카드 패널 · ⑵) → 옛 카드 패널(prop-canvas)은 cardMode 없을 때
  ['innercard', 'window.addInnerCardBlock()', 'innercard-block', 'icd', 'icd-radius-number', 60],
]) {
  test(`AS4 ${name} Appearance = 표준 꼴 + 숫자 칸 → dataset.radius · 라벨 끌기 · 이력(change 1 · 끌기 1)`, async ({ page }) => {
    const errs = await blockScene(page, add, numId);
    const part = await page.evaluate(([numId, pfx]) => {
      const sec = document.querySelector('#panel-right .prop-section[data-sec="appearance"]');
      return { slider: !!sec?.querySelector('input[type=range]'), inPart: !!document.getElementById(numId)?.closest('[data-part="appearance"] [data-field="appearance-radius"]'),
        eye: document.querySelector(`#panel-right .prop-sec-head #${pfx}-app-eye`)?.getAttribute('aria-disabled'), corners: document.getElementById(`${pfx}-corners`)?.getAttribute('aria-disabled') };
    }, [numId, pfx]);
    expect(part).toEqual({ slider: false, inPart: true, eye: 'true', corners: 'true' });
    const blockR = () => page.evaluate((cls) => [...document.querySelectorAll('#canvas .' + cls)].pop()?.dataset.radius ?? null, cls);
    await page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
    await page.evaluate((id) => { const n = document.getElementById(id); n.value = '20'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, numId);
    await expect.poll(blockR).toBe('20');
    const h = page.locator(`#${numId}-scrub`); const b = await h.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 7, b.y + b.height / 2, { steps: 4 }); await page.mouse.up();
    await expect.poll(blockR).toBe('27');
    expect([await page.inputValue('#' + numId), await page.evaluate(() => window.__ph)]).toEqual(['27', 2]);
    await page.evaluate((id) => { const n = document.getElementById(id); n.value = '999'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, numId);
    await expect.poll(blockR).toBe(String(max));
    expect(errs).toEqual([]);
  });
}
