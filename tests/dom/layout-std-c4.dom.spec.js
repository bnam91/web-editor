/* layout-std-c4.dom.spec.js — 표준 Layout L2~L4 갈래 C4(탑 261125 · PLAN-appearance-layout-std-261124 §2·§2-b·§4 · 정본 시안 8910 #mkp-layoutstd · 줄 높이 24 = --ui-input-h)
 *   shape · grid · frame · modal · banner02 · radial · icon-circle · gradient · vector — Size/Layout/Padding 슬라이더 0 · 숫자 칸(옛 id) = 부품 안 + 라벨 끌기
 *   모드 = 그 블럭에 이미 있는 것만 드롭다운(모달 너비 풀폭/고정 · 높이 자동/최소 · 그리드 너비 고정/100%) · 꽉참 = 사슬 막힘(LAY_FULLW_WHY)
 *   ⛔숫자 칸 id · 저장 키 · 범위 무변
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/layout-std-c4.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
const FULLW = '너비가 줄 폭에 맞춰져 있어 비율을 묶을 수 없어요';
/* [이름, 더하기, 고르기, 패널 함수, 숫자 칸 id 들, [편집 칸, 값, 읽기 식]] */
const BLOCKS = [
  ['frame', 'window.addFrameBlock()', "document.querySelector('#canvas .frame-block.selected')", 'showFrameProperties',
    ['ss-width-num', 'ss-height-num', 'ss-padx-num', 'ss-pady-num'], ['ss-padx-num', 30, 'b.dataset.padX']],
  ['modal', 'window.addModalBlock({})', "[...document.querySelectorAll('#canvas .modal-block')].pop()", 'showModalProperties',
    ['mdl-w-number', 'mdl-h-number', 'mdl-padx-number', 'mdl-pady-number'], ['mdl-padx-number', 30, 'b.dataset.padX']],
  ['banner02', 'window.addBanner02Block()', "[...document.querySelectorAll('#canvas .banner02-block')].pop()", 'showBanner02Properties',
    ['bn2-w', 'bn2-h'], ['bn2-w', 600, 'b.dataset.bannerW']],
  ['radial', 'window.addRadialBlock()', "[...document.querySelectorAll('#canvas .radial-block')].pop()", 'showRadialProperties',
    ['rdl-cell-number', 'rdl-radius-number', 'rdl-start-number', 'rdl-padx-number'], ['rdl-start-number', 30, 'b.dataset.startDeg']],
  ['shape', "window.addShapeBlock('rectangle')", "[...document.querySelectorAll('#canvas .shape-block')].pop()", 'showShapeProperties',
    ['shape-w-num', 'shape-h-num'], ['shape-w-num', 200, 'String(b.offsetWidth)']],
  ['icon-circle', 'window.addIconCircleBlock()', "[...document.querySelectorAll('#canvas .icon-circle-block')].pop()", 'showIconCircleProperties',
    ['icb-size-number', 'icb-padx-number'], ['icb-size-number', 120, 'b.dataset.size']],
  ['gradient', 'window.addGradientBlock()', "[...document.querySelectorAll('#canvas .gradient-block')].pop()", 'showGradientProperties',
    ['grad-width-num', 'grad-height-num'], ['grad-width-num', 400, 'b.dataset.gradWidth']],
  ['vector', `window.addVectorBlock(${JSON.stringify(SVG)}, { w: 80, h: 80 })`, "[...document.querySelectorAll('#canvas .vector-block')].pop()", 'showVectorProperties',
    ['vb-w', 'vb-h'], ['vb-w', 150, 'b.dataset.w']],
];
const GRID2 = `(() => { const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }], rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [[{ lines: [{ type: 'body', text: 'A' }] }, { lines: [{ type: 'body', text: 'B' }] }], [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }]], rowGap: 20, colGap: 24 });
  g.id = 'gC4'; document.querySelector('#canvas .section-inner').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); })()`;

async function scene(page, add, pick, show) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([add, pick, show]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    await (0, eval)(add);
    window.__b = (0, eval)(pick);
    window[show](window.__b);
  }, [add, pick, show]);
  return errs;
}
const setNum = (page, id, v) => page.evaluate(([id, v]) => { const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const countHistory = (page) => page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
const read = (page, expr) => page.evaluate((expr) => { const b = window.__b; return (0, eval)(`(b) => ${expr}`)(b) ?? null; }, expr);
const LAYOUT_SECS = '#panel-right .prop-section[data-sec="size"], #panel-right .prop-section[data-sec="layout"], #panel-right .prop-section[data-sec="padding"]';

for (const [name, add, pick, show, ids, [eid, ev, rexpr]] of BLOCKS) {
  test(`LC1 ${name} Layout = 슬라이더 0 · 숫자 칸(${ids.join(' · ')}) = 부품 안(24px) + 라벨 끌기 · ${eid} ${ev} → 블럭 · 이력 1 · 끌기 +5 = 이력 1`, async ({ page }) => {
    const errs = await scene(page, add, pick, show);
    const o = await page.evaluate(([ids, sel]) => ({
      sliders: [...document.querySelectorAll(sel)].reduce((n, s) => n + s.querySelectorAll('input[type=range]').length, 0),
      inPart: ids.map((id) => !!document.getElementById(id)?.closest('[data-part="layout"] .prop-icon-input[data-part="number"]')),
      scrub: ids.map((id) => !!document.getElementById(`${id}-scrub`)),
      h: Math.round(document.getElementById(ids[0])?.closest('.prop-icon-input')?.getBoundingClientRect().height || 0),
    }), [ids, LAYOUT_SECS]);
    expect(o).toEqual({ sliders: 0, inPart: ids.map(() => true), scrub: ids.map(() => true), h: 24 });
    await countHistory(page);
    await setNum(page, eid, ev);
    await expect.poll(() => read(page, rexpr)).toBe(String(ev));
    expect(await page.evaluate(() => window.__ph), '★편집 한 번 = 이력 한 칸').toBe(1);
    const hd = page.locator(`#${eid}-scrub`); await hd.scrollIntoViewIfNeeded(); const b = await hd.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 5, b.y + b.height / 2, { steps: 5 }); await page.mouse.up();
    await expect.poll(() => read(page, rexpr)).toBe(String(ev + 5));
    expect(await page.evaluate(() => window.__ph), '★끌기 한 번 = 이력 한 칸').toBe(2);
    expect(errs).toEqual([]);
  });
}

test('LC2 modal 모드 = 드롭다운(옛 세그먼트 data-wm/data-hm 걷음) — 너비 풀폭/고정 · 높이 자동/최소 · 풀폭 = 사슬 막힘 · 자동 = H 칸 막힘 «자동»', async ({ page }) => {
  const errs = await scene(page, BLOCKS[1][1], BLOCKS[1][2], BLOCKS[1][3]);
  const st = () => page.evaluate(() => ({
    seg: document.querySelectorAll('#panel-right [data-wm], #panel-right [data-hm]').length,
    wm: [...(document.getElementById('mdl-wm')?.options || [])].map((o) => o.value), wmV: document.getElementById('mdl-wm')?.value,
    hm: [...(document.getElementById('mdl-hm')?.options || [])].map((o) => o.value), hmV: document.getElementById('mdl-hm')?.value,
    wDis: document.getElementById('mdl-w-number').disabled, hDis: document.getElementById('mdl-h-number').disabled, hPh: document.getElementById('mdl-h-number').placeholder,
    chain: [document.getElementById('mdl-ratio')?.getAttribute('aria-disabled') ?? null, document.getElementById('mdl-ratio')?.title],
    key: [window.__b.dataset.wMode ?? null, window.__b.dataset.hMode ?? null],
  }));
  const s0 = await st();
  expect(s0).toMatchObject({ seg: 0, wm: ['full', 'fixed'], wmV: 'full', hm: ['auto', 'fixed'], hmV: 'auto', wDis: true, hDis: true, hPh: '자동' });
  expect(s0.chain[0]).toBe('true');
  await page.selectOption('#mdl-wm', 'fixed');
  await page.selectOption('#mdl-hm', 'fixed');
  const s1 = await st();
  expect(s1).toMatchObject({ wmV: 'fixed', hmV: 'fixed', wDis: false, hDis: false, key: ['fixed', 'fixed'], chain: [null, '비율 사슬 — 켜면 W 를 바꿀 때 H 가 비율대로(H 도 같다)'] });
  await setNum(page, 'mdl-w-number', 400);
  expect(await page.evaluate(() => window.__b.dataset.width)).toBe('400');
  await page.selectOption('#mdl-wm', 'full');
  expect((await st()).chain).toEqual(['true', FULLW]);
  expect(errs).toEqual([]);
});

test('LC3 grid 너비 = 표준 W 칸(옛 id · 비우면 자동 placeholder 그대로) + 모드 드롭다운 고정/100%(옛 «100%» 단추·슬라이더 걷음) · 높이 칸 없음 = 사슬 막힘', async ({ page }) => {
  const errs = await scene(page, GRID2, "document.getElementById('gC4')", 'showGridProperties');
  const st = () => page.evaluate(() => ({
    old: ['grd-width-slider', 'grd-width-auto'].map((id) => !!document.getElementById(id)),
    inPart: !!document.getElementById('grd-width-number')?.closest('[data-part="layout"] [data-field="layout-w"]'),
    ph: document.getElementById('grd-width-number')?.placeholder, v: document.getElementById('grd-width-number')?.value,
    mode: [...(document.getElementById('grd-width-mode')?.options || [])].map((o) => o.value), modeV: document.getElementById('grd-width-mode')?.value,
    chain: document.getElementById('grd-ratio')?.getAttribute('aria-disabled') ?? null,
    key: window.getGridWidth?.(window.__b) ?? null,
  }));
  expect(await st()).toEqual({ old: [false, false], inPart: true, ph: '자동', v: '', mode: ['fixed', 'fill'], modeV: 'fill', chain: 'true', key: null });
  await page.selectOption('#grd-width-mode', 'fixed');
  await expect.poll(async () => (await st()).modeV).toBe('fixed');
  expect((await st()).key, '고정 = 지금 그려진 폭을 키로').toBeGreaterThan(0);
  await setNum(page, 'grd-width-number', 300);
  await expect.poll(async () => (await st()).key).toBe(300);
  await page.selectOption('#grd-width-mode', 'fill');
  await expect.poll(async () => (await st()).key).toBe(null);
  expect(errs).toEqual([]);
});

test('LC4 grid 열·행 간격 = 간격 슬롯 두 칸(↔ 열 · ↕ 행 · 옛 id · 범위 −50 무변) · 슬라이더 0 · 열 40 → colGap 40', async ({ page }) => {
  const errs = await scene(page, GRID2, "document.getElementById('gC4')", 'showGridProperties');
  const o = await page.evaluate(() => ({
    sl: ['grd-col-gap-slider', 'grd-row-gap-slider'].map((id) => !!document.getElementById(id)),
    x: !!document.getElementById('grd-col-gap-number')?.closest('[data-part="layout"][data-slot="gap-xy"] [data-field="layout-gap-x"]'),
    y: !!document.getElementById('grd-row-gap-number')?.closest('[data-part="layout"][data-slot="gap-xy"] [data-field="layout-gap-y"]'),
    min: [document.getElementById('grd-col-gap-number')?.min, document.getElementById('grd-row-gap-number')?.min],
  }));
  expect(o).toEqual({ sl: [false, false], x: true, y: true, min: ['-50', '-50'] });
  await setNum(page, 'grd-col-gap-number', 40);
  expect(await page.evaluate(() => window.__b.dataset.colGap)).toBe('40');
  expect(errs).toEqual([]);
});

test('LC5 frame 비율 사슬 — 기본 끔(키 없음) · 켜면 ratioLock "1" · W 바꾸면 H 비율대로 · 꽉참(패딩 제외 켬) = 막힘(까닭)', async ({ page }) => {
  const errs = await scene(page, BLOCKS[0][1], BLOCKS[0][2], BLOCKS[0][3]);
  await page.evaluate(() => { delete window.__b.dataset.fullBleed; window.showFrameProperties(window.__b); });   // 전제 — 고정 폭 프레임
  expect(await page.evaluate(() => [document.getElementById('ss-ratio')?.getAttribute('aria-pressed'), window.__b.dataset.ratioLock ?? null])).toEqual(['false', null]);
  await setNum(page, 'ss-width-num', 400); await setNum(page, 'ss-height-num', 200);
  await page.click('#ss-ratio');
  expect(await page.evaluate(() => window.__b.dataset.ratioLock ?? null)).toBe('1');
  await setNum(page, 'ss-width-num', 600);
  expect(await page.evaluate(() => [document.getElementById('ss-height-num').value, window.__b.dataset.height])).toEqual(['300', '300']);
  await page.evaluate(() => { window.__b.dataset.fullBleed = 'true'; window.showFrameProperties(window.__b); });
  expect(await page.evaluate(() => [document.getElementById('ss-ratio').getAttribute('aria-disabled'), document.getElementById('ss-ratio').title])).toEqual(['true', FULLW]);
  expect(errs).toEqual([]);
});

test('LC6 shape 별 갯수·간격 = 블럭 슬롯 숫자 + 간격 슬롯(옛 id · 슬라이더 걷음) · 갯수 3 → starCount 3 · 별점 켜면 갯수 칸 막힘', async ({ page }) => {
  const errs = await scene(page, "window.addShapeBlock('star')", BLOCKS[4][2], BLOCKS[4][3]);
  await setNum(page, 'shape-star-count-num', 3);
  expect(await page.evaluate(() => window.__b.dataset.starCount)).toBe('3');
  const o = await page.evaluate(() => ({
    sl: ['shape-star-count-slider', 'shape-star-gap-slider'].map((id) => !!document.getElementById(id)),
    count: !!document.getElementById('shape-star-count-num')?.closest('[data-part="layout"][data-slot="number"]'),
    gap: !!document.getElementById('shape-star-gap-num')?.closest('[data-part="layout"][data-slot="gap"]'),
    scrub: ['shape-star-count-num-scrub', 'shape-star-gap-num-scrub'].map((id) => !!document.getElementById(id)),
  }));
  expect(o).toEqual({ sl: [false, false], count: true, gap: true, scrub: [true, true] });
  await page.click('#shape-star-rating-toggle');
  await expect.poll(() => page.evaluate(() => document.getElementById('shape-star-count-num')?.disabled)).toBe(true);
  expect(errs).toEqual([]);
});
