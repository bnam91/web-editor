/* layout-std-c1.dom.spec.js — 표준 Layout L2~L4 갈래 C1(graph · comparison · chat · divider · table · bridge · quote · gap)
 *   (정본 시안 8910 #mkp-layoutstd · PLAN-appearance-layout-std-261124 §2·§4 · 탑 발주 tp0914-c1 · 현빈 261124 L-4 슬라이더 걷음)
 *   Layout 묶음(size·layout·padding) 안 슬라이더 0 · 옛 숫자 칸 id 가 부품([data-part="layout"]) 안 + 라벨 끌기 손잡이 ·
 *   숫자 change = 저장 키 + 이력 1 · 빈 칸 change = 옛 값 되돌림(이력 0) · 패딩 축마다 제 상한 · divider 너비 끌기로 max = 전폭(키 지움 · 탑 판정 261125)
 *   ⛔옛 숫자 칸 id · 저장 키 · 범위 무변
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/layout-std-c1.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, add, cls, show) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([add, cls, show]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    (0, eval)(add);
    window[show]([...document.querySelectorAll('#canvas .' + cls)].pop());
  }, [add, cls, show]);
  return errs;
}
const setNum = (page, id, v) => page.evaluate(([id, v]) => { const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const countHistory = (page) => page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
const key = (page, cls, k) => page.evaluate(([cls, k]) => { const b = [...document.querySelectorAll('#canvas .' + cls)].pop(); return k === 'height' ? b.style.height : (b.dataset[k] ?? null); }, [cls, k]);

/* [이름, 만들기, 블럭 class, 패널 함수, Layout 숫자 칸 id 들, 편집 { id, v, 키, 기대 }] */
const CASES = [
  ['gap', 'window.addGapBlock()', 'gap-block', 'showGapProperties', ['gap-number'], { id: 'gap-number', v: 120, k: 'height', want: '120px' }],
  ['bridge', 'window.addBridgeBlock()', 'bridge-block', 'showBridgeProperties', ['brg-h-number'], { id: 'brg-h-number', v: 120, k: 'bridgeHeight', want: '120' }],
  ['divider', 'window.addDividerBlock()', 'divider-block', 'showDividerProperties', ['dvd-width-number', 'dvd-length-number', 'dvd-padx-number', 'dvd-pady-number'], { id: 'dvd-pady-number', v: 40, k: 'padV', want: '40' }],
  ['graph', 'window.addGraphBlock()', 'graph-block', 'showGraphProperties', ['grb-h-number', 'grb-bar-thickness-number', 'grb-padx-number', 'grb-item-gap-number'], { id: 'grb-h-number', v: 400, k: 'chartHeight', want: '400' }],
  ['table', 'window.addTableBlock()', 'table-block', 'showTableProperties', ['tbl-rowh-number', 'tbl-pad-number', 'tbl-padx-number'], { id: 'tbl-padx-number', v: 40, k: 'tablePadX', want: '40' }],
  ['quote', 'window.addQuoteBlock()', 'quote-block', 'showQuoteProperties', ['qt-gap-number'], { id: 'qt-gap-number', v: 20, k: 'gap', want: '20' }],
  ['chat', 'window.addChatBlock()', 'chat-block', 'showChatProperties', ['chb-bubble-maxw-val', 'chb-tail-val', 'chb-profile-size-num', 'chb-gap', 'chb-profile-gap-num', 'chb-padding-val', 'chb-bubble-padding-val'], { id: 'chb-gap', v: 12, k: 'gap', want: '12' }],
  ['comparison', 'window.addComparisonBlock()', 'comparison-block', 'showComparisonProperties', ['cmp-ovl-num', 'cmp-rowh-num', 'cmp-rowgap-num', 'cmp-padx-num', 'cmp-pady-num'], { id: 'cmp-padx-num', v: 40, k: 'padX', want: '40' }],
];

for (const [name, add, cls, show, ids, ed] of CASES) {
  test(`LC1 ${name} Layout = 표준 부품 — 슬라이더 0 · 옛 숫자 칸 id 가 부품 안 + 끌기 손잡이 · change = 키 + 이력 1 · 빈 칸 = 되돌림(이력 0)`, async ({ page }) => {
    const errs = await scene(page, add, cls, show);
    const o = await page.evaluate((ids) => {
      const grp = [...document.querySelectorAll('#panel-right .prop-section[data-sec="size"], #panel-right .prop-section[data-sec="layout"], #panel-right .prop-section[data-sec="padding"]')];
      return {
        sliders: grp.reduce((n, s) => n + s.querySelectorAll('input[type=range]').length, 0),
        inPart: ids.filter((id) => !document.getElementById(id)?.closest('[data-part="layout"]')),
        scrub: ids.filter((id) => !document.getElementById(id + '-scrub')),
      };
    }, ids);
    expect(o).toEqual({ sliders: 0, inPart: [], scrub: [] });
    await countHistory(page);
    await setNum(page, ed.id, ed.v);
    await expect.poll(() => key(page, cls, ed.k)).toBe(ed.want);
    expect(await page.evaluate(() => window.__ph), '★편집 한 번 = 이력 한 칸').toBe(1);
    await setNum(page, ed.id, '');
    expect([await page.inputValue('#' + ed.id), await key(page, cls, ed.k), await page.evaluate(() => window.__ph)], '★빈 칸 = 아무 일도 없었다').toEqual([String(ed.v), ed.want, 1]);
    expect(errs).toEqual([]);
  });
}

test('LC2 패딩 축마다 제 상한 — comparison 좌우 160 · 상하 80 · divider 좌우 2000 · 상하 120', async ({ page }) => {
  const errs = await scene(page, 'window.addComparisonBlock()', 'comparison-block', 'showComparisonProperties');
  await setNum(page, 'cmp-padx-num', 999); await setNum(page, 'cmp-pady-num', 999);
  expect([await key(page, 'comparison-block', 'padX'), await key(page, 'comparison-block', 'padY')]).toEqual(['160', '80']);
  await page.evaluate(() => { window.addDividerBlock(); window.showDividerProperties([...document.querySelectorAll('#canvas .divider-block')].pop()); });
  await setNum(page, 'dvd-pady-number', 999); await setNum(page, 'dvd-padx-number', 2500);
  expect([await key(page, 'divider-block', 'padV'), await key(page, 'divider-block', 'padH')]).toEqual(['120', '2000']);
  expect(errs).toEqual([]);
});

test('LC3 divider 너비 — 숫자 100 = 키 100 · 라벨 끌기로 max(전폭)에 닿으면 키 지움(=전폭 · 새 모드 0)', async ({ page }) => {
  const errs = await scene(page, 'window.addDividerBlock()', 'divider-block', 'showDividerProperties');
  const max = Number(await page.getAttribute('#dvd-width-number', 'max'));
  await setNum(page, 'dvd-width-number', 100);
  expect(await key(page, 'divider-block', 'lineWidth')).toBe('100');
  await setNum(page, 'dvd-width-number', max - 5);
  expect(await key(page, 'divider-block', 'lineWidth')).toBe(String(max - 5));
  await countHistory(page);
  const h = page.locator('#dvd-width-number-scrub'); await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2, { steps: 6 }); await page.mouse.up();
  await expect.poll(() => page.inputValue('#dvd-width-number')).toBe(String(max));
  expect([await key(page, 'divider-block', 'lineWidth'), await page.evaluate(() => window.__ph)], '★끌기 끝 = 전폭(키 없음) · 이력 1').toEqual([null, 1]);
  expect(errs).toEqual([]);
});
