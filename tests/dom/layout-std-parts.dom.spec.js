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

test('AL1 asset Layout = 표준 꼴 — 슬라이더 0 · 작은 라벨 Width | Height(부품 안 · «Size» 작은 제목 걷힘) · 칸 24px · 끝 비율 사슬(새 에셋 = 꽉참 → 막힘 · 키 없음)', async ({ page }) => {
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
      chain: chain ? [chain.dataset.part, chain.getAttribute('aria-pressed'), chain.getAttribute('aria-disabled'), chain.title, chain.closest('.ui-s2-main') === document.getElementById('asset-w-number').closest('.ui-s2-main')] : null,
      cellH: Math.round(document.querySelector('[data-field="layout-w"]')?.getBoundingClientRect().height || 0),
    };
  });
  expect(o).toEqual({ body: true, sliders: 0, labels: ['Width', 'Height'], w: true, h: true, sizeSub: false, padSub: 'Padding', chain: ['end-slot', 'false', 'true', '너비가 줄 폭에 맞춰져 있어 비율을 묶을 수 없어요', true], cellH: 24 });
  expect((await blockWH(page)).lock, '★기본(켬)이면 키를 안 쓴다 — 옛 저장본 바이트 무변').toBe(null);
  expect(errs).toEqual([]);
});

/* 지디 261125 ⒜ — 꽉참(너비 = 줄 폭) 에셋 = 사슬 막힘(aria-disabled + 까닭) · H 를 바꿔도 W 그대로 · 고정 폭이면 사슬 켬(L-3) · 막힘은 저장 안 함 */
test('AL2 꽉참 = 사슬 막힘 · H 바꿔도 W 그대로 → 고정 폭(430)이 되면 사슬 다시 켬 · W 215 → H 비율대로 · 이력 1 · 끄면 ratioLock "0" · 다시 켜면 키 지움', async ({ page }) => {
  const errs = await assetScene(page);
  const [w0, h0] = await nums(page);
  expect(w0, '전제 — 새 에셋 = 꽉참').toBe(860);
  const chain = () => page.evaluate(() => { const b = document.getElementById('asset-ratio'); return [b.getAttribute('aria-pressed'), b.getAttribute('aria-disabled'), b.title]; });
  expect(await chain()).toEqual(['false', 'true', '너비가 줄 폭에 맞춰져 있어 비율을 묶을 수 없어요']);
  const wcss0 = await page.evaluate((s) => (0, eval)(s).style.width, A);
  await setNum(page, 'asset-h-number', 500);
  expect(await nums(page), '★꽉참이면 H 만 바뀐다').toEqual([860, 500]);
  expect([await page.evaluate((s) => (0, eval)(s).style.width, A), (await blockWH(page)).lock]).toEqual([wcss0, null]);
  await page.click('#asset-ratio', { force: true });   // 막힘 = 눌러도 아무 일 없음 · force = Playwright 는 aria-disabled 단추를 «안 누른다»(사람 클릭은 닿는다)
  expect((await blockWH(page)).lock).toBe(null);
  await setNum(page, 'asset-w-number', 430);
  expect(await nums(page), '꽉참에서 시작한 편집은 안 따라감').toEqual([430, 500]);
  expect(await chain(), '★고정 폭 = 사슬 다시 켬(기본)').toEqual(['true', null, '비율 사슬 — 켜면 W 를 바꿀 때 H 가 비율대로(H 도 같다)']);
  await countHistory(page);
  await setNum(page, 'asset-w-number', 215);
  expect(await nums(page)).toEqual([215, 250]);
  expect(await blockWH(page)).toEqual({ w: 215, h: 250, lock: null });
  expect(await page.evaluate(() => window.__ph), '★W 편집 한 번 = 이력 한 칸(H 따라가도)').toBe(1);
  await page.click('#asset-ratio');
  expect([await page.getAttribute('#asset-ratio', 'aria-pressed'), (await blockWH(page)).lock]).toEqual(['false', '0']);
  await setNum(page, 'asset-w-number', 300);
  expect(await nums(page)).toEqual([300, 250]);
  await page.click('#asset-ratio');
  expect([await page.getAttribute('#asset-ratio', 'aria-pressed'), (await blockWH(page)).lock]).toEqual(['true', null]);
  await setNum(page, 'asset-h-number', 500);
  expect(await nums(page)).toEqual([600, 500]);
  /* 껐을 때 키는 다시 그려도 산다 */
  await page.click('#asset-ratio');
  await page.evaluate((s) => window.showAssetProperties((0, eval)(s)), A);
  expect(await page.getAttribute('#asset-ratio', 'aria-pressed')).toBe('false');
  expect(h0).toBeGreaterThan(0);
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

/* 탑 261125 — 소비자 C1·C2 꼴(마크업은 tests/unit/layout-section-shapes) · 여기선 배선: 축마다 제 범위로 자름 · 블럭 슬롯 숫자(소수 눈금) · 끌기 */
test('AL5 배선 — 패딩 x/y 가 제 범위(xMax 160 · yMax 80)로 잘림 · 이력 축마다 1 · 블럭 슬롯 숫자 step 0.1 = 소수 그대로 · 라벨 끌기 +3', async ({ page }) => {
  const errs = await bootApp(page);
  const o = await page.evaluate(async () => {
    const m = await import('/js/props/_layout-section.js');
    const box = document.createElement('div'); document.body.appendChild(box);
    box.innerHTML = m.layoutPadSlotHTML({ xId: 'z-px', yId: 'z-py', x: 10, y: 5, max: 999, xMax: 160, yMax: 80 })
      + m.layoutSlotNumberHTML({ id: 'z-dim', label: '치수', value: 1, min: 0, max: 10, step: 0.1 });
    const got = { x: null, y: null, d: null }; let commits = 0;
    m.wireLayoutSection({ commit: () => commits++, w: { numberId: 'z-px', max: 160, apply: (v) => { got.x = v; } }, h: { numberId: 'z-py', max: 80, apply: (v) => { got.y = v; } } });
    m.wireLayoutSection({ commit: () => commits++, w: { numberId: 'z-dim', max: 10, step: 0.1, apply: (v) => { got.d = v; } } });
    const set = (id, v) => { const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); };
    set('z-px', 500); set('z-py', 500); set('z-dim', 1.55);
    return { got: { ...got }, vals: ['z-px', 'z-py', 'z-dim'].map((id) => document.getElementById(id).value), commits };
  });
  expect(o).toEqual({ got: { x: 160, y: 80, d: 1.55 }, vals: ['160', '80', '1.55'], commits: 3 });
  const h = page.locator('#z-px-scrub'); await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 3, b.y + b.height / 2, { steps: 3 }); await page.mouse.up();
  await expect.poll(() => page.inputValue('#z-px')).toBe('157');
  expect(errs).toEqual([]);
});
