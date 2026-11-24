/* layout-std-parts.dom.spec.js — 표준 Layout L1: 부품(js/props/_layout-section.js) + 첫 소비자 asset
 *   (정본 시안 8910 #mkp-layoutstd · PLAN-appearance-layout-std-261124 §2-b·§3·§4 L1 · 줄 높이 24 = --ui-input-h)
 *   작은 라벨 «Width | Height» · [↔ 숫자][↕ 숫자] + 끝 비율 사슬(dataset.ratioLock — 기본과 다를 때만 저장 · 에셋 기본 켬) · 슬라이더 걷음 · 라벨 끌기
 *   ⛔옛 숫자 칸 id(asset-w-number · asset-h-number) · 저장 키 · 몸 id(psec-size-body) 무변
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/layout-std-parts.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function assetScene(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    window.addAssetBlock();
  });
  await expect(page.locator('#asset-w-number')).toHaveCount(1);
  return errs;
}
const A = "[...document.querySelectorAll('#canvas .asset-block')].pop()";
const blockWH = (page) => page.evaluate((s) => { const b = (0, eval)(s); return { w: b.offsetWidth, h: parseInt(b.style.height) || b.offsetHeight, lock: b.dataset.ratioLock ?? null }; }, A);
const nums = (page) => page.evaluate(() => [document.getElementById('asset-w-number').value, document.getElementById('asset-h-number').value].map(Number));
const setNum = (page, id, v) => page.evaluate(([id, v]) => { const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const countHistory = (page) => page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });

test('AL1 asset Layout = 표준 꼴 — 슬라이더 0 · 작은 라벨 Width | Height(부품 안 · «Size» 작은 제목 걷힘) · 칸 24px · 끝 비율 사슬 켬(기본 · 키 없음)', async ({ page }) => {
  const errs = await assetScene(page);
  const o = await page.evaluate(() => {
    const size = document.getElementById('psec-size');
    const part = size?.querySelector('[data-part="layout"]');
    const chain = document.getElementById('asset-ratio');
    return {
      body: !!document.getElementById('psec-size-body'),
      sliders: [...document.querySelectorAll('#asset-w-slider, #asset-h-slider, #psec-size input[type=range]')].length,
      labels: [...(part?.querySelectorAll('.ui-s2-main > .ui-s2-cell > span') || [])].map((s) => s.textContent),
      w: !!document.getElementById('asset-w-number')?.closest('[data-part="layout"] [data-field="layout-w"]'),
      h: !!document.getElementById('asset-h-number')?.closest('[data-part="layout"] [data-field="layout-h"]'),
      sizeSub: !!size?.querySelector('.prop-sec-sub'),
      padSub: document.querySelector('#psec-padding .prop-sec-sub')?.textContent ?? null,
      chain: chain ? [chain.dataset.part, chain.getAttribute('aria-pressed'), chain.closest('.ui-s2-main') === document.getElementById('asset-w-number').closest('.ui-s2-main')] : null,
      cellH: Math.round(document.querySelector('[data-field="layout-w"]')?.getBoundingClientRect().height || 0),
    };
  });
  expect(o).toEqual({ body: true, sliders: 0, labels: ['Width', 'Height'], w: true, h: true, sizeSub: false, padSub: 'Padding', chain: ['end-slot', 'true', true], cellH: 24 });
  expect((await blockWH(page)).lock, '★기본(켬)이면 키를 안 쓴다 — 옛 저장본 바이트 무변').toBe(null);
  expect(errs).toEqual([]);
});

test('AL2 사슬 켬 — W 430 → H 가 비율대로 · 이력 1 · 끄면 ratioLock "0" · W 바꿔도 H 그대로 · 다시 켜면 키 지움', async ({ page }) => {
  const errs = await assetScene(page);
  const [w0, h0] = await nums(page);
  await countHistory(page);
  await setNum(page, 'asset-w-number', 430);
  const want = Math.round(430 * h0 / w0);
  expect(await nums(page)).toEqual([430, want]);
  expect(await blockWH(page)).toEqual({ w: 430, h: want, lock: null });
  expect(await page.evaluate(() => window.__ph), '★W 편집 한 번 = 이력 한 칸(H 따라가도)').toBe(1);
  await page.click('#asset-ratio');
  expect([await page.getAttribute('#asset-ratio', 'aria-pressed'), (await blockWH(page)).lock]).toEqual(['false', '0']);
  await setNum(page, 'asset-w-number', 300);
  expect(await nums(page)).toEqual([300, want]);
  await page.click('#asset-ratio');
  expect([await page.getAttribute('#asset-ratio', 'aria-pressed'), (await blockWH(page)).lock]).toEqual(['true', null]);
  /* 다시 켠 뒤 비율 = 지금 모양(300:want) */
  await setNum(page, 'asset-h-number', want * 2);
  expect(await nums(page)).toEqual([600, want * 2]);
  /* 껐을 때 키는 다시 그려도 산다 */
  await page.click('#asset-ratio');
  await page.evaluate((s) => window.showAssetProperties((0, eval)(s)), A);
  expect(await page.getAttribute('#asset-ratio', 'aria-pressed')).toBe('false');
  expect(errs).toEqual([]);
});

test('AL3 W 라벨 끌기 −10 = 칸·블럭 −10 · H 따라감 · 이력 1 · 빈 칸 change = 되돌림 · 이력 0', async ({ page }) => {
  const errs = await assetScene(page);
  await setNum(page, 'asset-w-number', 500);
  const [w0, h0] = await nums(page);
  await countHistory(page);
  const hd = page.locator('#asset-w-number-scrub'); await hd.scrollIntoViewIfNeeded(); const b = await hd.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 10, b.y + b.height / 2, { steps: 5 }); await page.mouse.up();
  await expect.poll(() => nums(page)).toEqual([w0 - 10, Math.round((w0 - 10) * h0 / w0)]);
  expect([(await blockWH(page)).w, await page.evaluate(() => window.__ph)]).toEqual([w0 - 10, 1]);
  await page.evaluate(() => { const n = document.getElementById('asset-w-number'); n.value = ''; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); });
  expect([(await nums(page))[0], (await blockWH(page)).w, await page.evaluate(() => window.__ph)]).toEqual([w0 - 10, w0 - 10, 1]);
  expect(errs).toEqual([]);
});

test('AL4 부품 조각 — 한 칸(one) · 높이 자동(칸 막힘 + 사슬 막힘) · 모드 줄(있는 축만) · 패딩 두 칸 · 간격 한 칸 · Mixed = data-empty', async ({ page }) => {
  const errs = await bootApp(page);
  const o = await page.evaluate(async () => {
    const m = await import('/js/props/_layout-section.js');
    const box = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
    const one = box(m.layoutSizeRowHTML({ prefix: 'q1', one: { id: 'q1-size', label: 'Size', value: 40, max: 200 } }));
    const auto = box(m.layoutSizeRowHTML({ prefix: 'q2', w: { id: 'q2-w', value: 300, max: 860 }, h: { id: 'q2-h', value: 0, max: 900, auto: true }, chain: { on: false } }));
    const mode = box(m.layoutSizeRowHTML({ prefix: 'q3', w: { id: 'q3-w', value: 640, max: 860, mixed: true }, h: { id: 'q3-h', value: 100, max: 900 }, mode: { w: { id: 'q3-wm', value: 'fill', options: [['fixed', '고정'], ['fill', '100%']] } } }));
    const pad = box(m.layoutPadSlotHTML({ xId: 'q4-px', yId: 'q4-py', x: 16, y: 12, max: 200 }));
    const gap = box(m.layoutGapSlotHTML({ id: 'q5-gap', value: 8, max: 100 }));
    return {
      one: [[...one.querySelectorAll('.ui-s2-cell > span')].map((s) => s.textContent), !!one.querySelector('#q1-size'), !!one.querySelector('.prop-chain-btn')],
      auto: [auto.querySelector('#q2-h').disabled, auto.querySelector('#q2-h').placeholder, auto.querySelector('#q2-ratio').getAttribute('aria-disabled')],
      mode: [mode.querySelector('#q3-wm')?.value, mode.querySelectorAll('[data-part="layout-mode"] select').length, mode.querySelector('#q3-w').placeholder, mode.querySelector('#q3-w').dataset.empty, !!mode.querySelector('#q3-ratio')],
      pad: [[...pad.querySelectorAll('.ui-s2-cell > span')].map((s) => s.textContent), pad.querySelector('#q4-px').value, pad.querySelector('#q4-py').value, !!pad.querySelector('#q4-px-scrub')],
      gap: [[...gap.querySelectorAll('.ui-s2-cell > span')].map((s) => s.textContent), gap.querySelector('#q5-gap').value],
    };
  });
  expect(o).toEqual({
    one: [['Size'], true, false],
    auto: [true, '자동', 'true'],
    mode: ['fill', 1, 'Mixed', 'invalid', true],
    pad: [['Padding', ''], '16', '12', true],
    gap: [['Gap'], '8'],
  });
  expect(errs).toEqual([]);
});
