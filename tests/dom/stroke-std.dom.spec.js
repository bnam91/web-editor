/* stroke-std — 표준 Stroke 절 부품(js/props/_stroke-section.js · 현빈 261123 GO · 정본 시안 8910 strokestd2 · 계약 §4c ②b) · 단계 1 = 부품 + 어댑터 + 첫 소비자(도형)
 * S1 도형 패널 Stroke 절 = 부품(.ui-stroke2[data-part=stroke]) · 칸 셋(stroke-color · stroke-align · stroke-width)
 * S2 머리 ＋ 로 켬 → 굵기 칸 입력 → 저장 키 shapeStrokeWidth(옛 키 그대로) · svg stroke-width · change = ⌘Z 한 칸
 * S4 머리 ＋/− (에셋·프레임·모달 — 블럭 묶음 이관 단계 2) — 켬 = 지난 굵기 · 없으면 블럭 기본 · 끔 = 그 블럭의 «없음»(실측 표: 셋 다 굵기 0 · 옛 키) · 몸 숨김 · 각 ⌘Z 한 칸
 * S3 위치 = 막힘(도형은 아직 위치를 못 그림 · §4c «칸만 + 막힘») — aria-disabled · 까닭 툴팁 · 값 = 지금 그려지는 쪽(사각형 = 안쪽) · 화살표 키로 안 바뀜
 * 양성대조: _patches/stroke-std-CTL.patch(어댑터 width 를 안 부름) ⇒ S2 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addShapeBlock('rectangle'); const b = sec.querySelector('.shape-block'); b.id = b.id || 'shS'; window.selectBlock(b.id); window.showShapeProperties?.(b); window.clearHistory?.(); return b.id; });
  await page.waitForSelector('#panel-right [data-part="stroke"]', { state: 'attached' });   // 새 도형 = 테두리 없음 → 부품 몸 숨김(머리 ＋ 로 켬)
  return { errs, id };
}

test('S1·S2 도형 Stroke = 표준 부품 · 굵기 입력 = 옛 키 · svg · ⌘Z 한 칸', async ({ page }) => {
  const { errs, id } = await scene(page);
  const ui = await page.evaluate(() => { const u = document.querySelector('#panel-right .prop-section[data-sec="stroke"] .ui-stroke2[data-part="stroke"]'); return u && { fields: [...u.querySelectorAll('[data-field]')].filter((e) => !e.closest('.ui-stroke-pop, .ui-stroke-slot')).map((e) => e.dataset.field), oldSlider: !!document.getElementById('shape-stroke-slider') }; });
  expect(ui, '★Stroke 절 = 표준 부품 · 칸 셋 · 옛 슬라이더 없음').toEqual({ fields: ['stroke-color', 'stroke-align', 'stroke-width'], oldSlider: false });
  const w0 = await page.evaluate((id) => document.getElementById(id).dataset.shapeStrokeWidth ?? null, id);
  await page.click('#panel-right label:has(#shape-stroke-on)'); await page.waitForSelector('#shape-stroke-width', { state: 'visible' });   // 새 도형 = 테두리 없음(굵기 0) → 머리 ＋ 로 켬
  await page.fill('#shape-stroke-width', '7'); await page.locator('#shape-stroke-width').dispatchEvent('change'); await raf(page);
  const w1 = await page.evaluate((id) => { const b = document.getElementById(id); return { ds: b.dataset.shapeStrokeWidth, svg: b.querySelector('svg')?.style.strokeWidth ?? null }; }, id);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page);
  const w2 = await page.evaluate((id) => document.getElementById(id)?.dataset.shapeStrokeWidth ?? null, id);
  console.log('[S2 실측]', JSON.stringify({ w0, w1, w2 }));
  expect(w1, '★굵기 7 = 옛 키 shapeStrokeWidth · svg stroke-width').toEqual({ ds: '7', svg: '7' });
  expect(w2, '★⌘Z 한 칸 = 굵기 7 전(켠 직후 = 기본 2)').toBe('2');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S3 위치 = 막힘(칸만) · 까닭 툴팁 · 값 = 지금 그려지는 쪽 · 키로 안 바뀜', async ({ page }) => {
  const { errs } = await scene(page);
  await page.click('#panel-right label:has(#shape-stroke-on)'); await page.waitForSelector('#shape-stroke-align', { state: 'visible' });
  const a0 = await page.evaluate(() => { const a = document.getElementById('shape-stroke-align'); return { v: a.value, dis: a.getAttribute('aria-disabled'), why: !!a.title, tab: a.tabIndex }; });
  await page.focus('#shape-stroke-align'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await raf(page);
  const v1 = await page.evaluate(() => document.getElementById('shape-stroke-align').value);
  expect([a0.v, a0.dis, a0.why, a0.tab >= 0], '★사각형 = 안쪽 · 막힘 · 까닭 툴팁 · 초점 받음').toEqual(['inside', 'true', true, true]);
  expect(v1, '★막힘 = 화살표 키로 안 바뀜').toBe('inside');
  expect(errs, errs.join(' | ')).toEqual([]);
});

const KINDS = {
  asset: { make: "window.addAssetBlock()", sel: '.asset-block', show: 'showAssetProperties', on: '#asset-stroke-on', key: 'strokeWidth', onW: '2', width: '#asset-stroke-num' },
  frame: { make: "window.addFrameBlock()", sel: '.frame-block:not([data-text-frame])', show: 'showFrameProperties', on: '#ss-stroke-on', key: 'borderWidth', onW: '1', width: '#ss-border-w-num' },
  modal: { make: "window.addModalBlock()", sel: '.modal-block', show: 'showModalProperties', on: '#mdl-stroke-on', key: 'borderW', onW: null, width: '#mdl-bw-number' },
};
for (const [kind, K] of Object.entries(KINDS)) {
  test(`S4 ${kind} — 머리 ＋/− · 켬 = 기본 · 끔 = 없음(굵기 0 · 옛 키 ${K.key}) · 몸 숨김 · ⌘Z 한 칸씩`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    const id = await page.evaluate(async ([make, sel, show]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll(sel)); eval(make); const b = [...sec.querySelectorAll(sel)].find((x) => !before.has(x)); b.id = b.id || 'kS'; window.deselectAll(); window.selectBlock?.(b.id); window[show]?.(b); window.clearHistory?.(); return b.id; }, [K.make, K.sel, K.show]);   // eslint-disable-line no-eval
    await page.waitForSelector('#panel-right [data-part="stroke"]', { state: 'attached' });
    const st = () => page.evaluate(([id, key, on, width]) => { const b = document.getElementById(id), u = document.querySelector('#panel-right [data-part="stroke"]'); return { w: b.dataset[key] ?? null, on: document.querySelector(on)?.checked ?? null, hidden: u.hidden, fieldW: document.querySelector(width)?.value ?? null }; }, [id, K.key, K.on, K.width]);
    const s0 = await st();
    if (s0.on) { await page.click(`#panel-right label:has(${K.on})`); }   // 켜진 채 시작하는 변형(모달 기본 테두리 등)은 먼저 끔 → 아래에서 켬
    const sOff0 = await st();
    await page.click(`#panel-right label:has(${K.on})`);
    const sOn = await st();
    await page.click(`#panel-right label:has(${K.on})`);
    const sOff = await st();
    await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
    const sU = await page.evaluate(([id, key]) => document.getElementById(id)?.dataset[key] ?? null, [id, K.key]);
    console.log(`[S4 ${kind} 실측]`, JSON.stringify({ s0, sOff0, sOn, sOff, sU }));
    expect([sOn.on, sOn.hidden, Number(sOn.w) > 0], `★${kind} 켬 = 체크 · 몸 보임 · 굵기 > 0`).toEqual([true, false, true]);
    if (K.onW) expect(sOn.w, `★${kind} 처음 켬 = 블럭 기본 굵기(${K.onW})`).toBe(K.onW);
    expect([sOff.on, sOff.hidden, sOff.w], `★${kind} 끔 = 없음(${K.key} 0) · 몸 숨김`).toEqual([false, true, '0']);
    expect(sU, `★${kind} ⌘Z 한 칸 = 끄기 전(켠 굵기)`).toBe(sOn.w);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/* S5 단계 2-2 (지디 261123 판정) — 블럭마다 «없음 = 무엇»·켬/끔 정본이 다르다:
 *   sticker-text = 머리 ＋/− · 없음 = strokeWidth 0 · 0.5 걸음 | icon-circle = 머리 ＋/− · 없음 = data-border none · 새 키 2(기본과 다를 때만)
 *   zoom = 머리 없음(켬/끔 = 옛 라디오 bd) | radial = 머리 없음(켬/끔 = 연결선 select · 0.5 걸음 · 하한 0.5) | 구분선·형광펜 = Special 이사 */
async function openNew(page, make, sel, show) {
  return page.evaluate(async ([make, sel, show]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll(sel)); eval(make); const b = [...sec.querySelectorAll(sel)].find((x) => !before.has(x)); b.id = b.id || 'kS5'; window.deselectAll(); window.selectBlock?.(b.id); window[show]?.(b); window.clearHistory?.(); return b.id; }, [make, sel, show]);   // eslint-disable-line no-eval
}
const fillChange = (page, sel, v) => page.evaluate(([sel, v]) => { const n = document.querySelector(sel); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);

test('S5a sticker-text — 머리 ＋ = 2 · 0.5 걸음(2.5 그대로) · − = strokeWidth 0 · 위치 = 바깥 막힘 · ⌘Z 한 칸', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, "window.addStickerBlock({ shape: 'text' })", '.sticker-block', 'showStickerProperties');
  await page.waitForSelector('#stk-t-stk-on', { state: 'attached' });
  const k = () => page.evaluate((id) => document.getElementById(id).dataset.strokeWidth ?? null, id);
  const k0 = await k();
  await page.click('#panel-right label:has(#stk-t-stk-on)');
  const kOn = await k();
  await fillChange(page, '#stk-t-stk-w-num', '2.5');
  const k25 = await k();
  const align = await page.evaluate(() => { const a = document.getElementById('stk-t-stk-align'); return [a.value, a.getAttribute('aria-disabled')]; });
  await page.click('#panel-right label:has(#stk-t-stk-on)');
  const kOff = await k();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  const kU = await k();
  console.log('[S5a 실측]', JSON.stringify({ k0, kOn, k25, align, kOff, kU }));
  expect([kOn, k25, kOff, kU], '★켬 2 · 2.5 그대로(parseInt 로 2 안 됨) · 끔 0 · ⌘Z = 2.5').toEqual(['2', '2.5', '0', '2.5']);
  expect(align, '★바깥 막힘(paint-order 로 안쪽 절반이 묻힘)').toEqual(['outside', 'true']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S5b icon-circle — ★옛 저장본(키 없음·solid) 그대로 = 3px·옛 색 · 굵기 5 = 키+변수 · 3 으로 되돌리면 키·변수 둘 다 사라짐 · − = data-border none', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.icon-circle-block')); window.addIconCircleBlock(); const b = [...sec.querySelectorAll('.icon-circle-block')].find((x) => !before.has(x));
    b.dataset.border = 'solid'; b.querySelector('.icb-circle').dataset.border = 'solid';   // ★전제: 옛 저장본 = 스타일만(굵기·색 키 없음)
    window.deselectAll(); window.selectBlock?.(b.id); window.showIconCircleProperties(b); window.clearHistory?.(); return b.id; });
  const st = () => page.evaluate((id) => { const b = document.getElementById(id), c = b.querySelector('.icb-circle'), cs = getComputedStyle(c); return { border: b.dataset.border, bw: b.dataset.borderW ?? null, bc: b.dataset.borderColor ?? null, cw: cs.borderTopWidth, cc: cs.borderTopColor, cst: cs.borderTopStyle, style: c.getAttribute('style') || '' }; }, id);
  const s0 = await st();
  const tok = await page.evaluate((id) => { const c = document.querySelector(`#${id} .icb-circle`); const p = document.createElement('i'); p.style.color = getComputedStyle(c).getPropertyValue('--ui-border'); document.body.append(p); const v = getComputedStyle(p).color; p.remove(); return v; }, id);
  const panel0 = await page.evaluate(() => [document.getElementById('icb-stroke-on').checked, document.getElementById('icb-stroke-width').value]);
  await fillChange(page, '#icb-stroke-width', '5');
  const s5 = await st();
  await fillChange(page, '#icb-stroke-width', '3');
  const s3 = await st();
  await page.click('#panel-right label:has(#icb-stroke-on)');
  const sOff = await st();
  console.log('[S5b 실측]', JSON.stringify({ s0, tok, panel0, s5, s3, sOff }));
  expect([s0.bw, s0.bc, s0.cw, s0.cc, s0.cst, s0.style.includes('--icb')], '★옛 저장본 그대로 열면 3px · 옛 색(--ui-border) · 키·변수 없음').toEqual([null, null, '3px', tok, 'solid', false]);
  expect(panel0, '★패널 = 켬 · 굵기 3(옛 고정값)').toEqual([true, '3']);
  expect([s5.bw, s5.cw, s5.style.includes('--icb-bw')], '★굵기 5 = 키 + 변수 → 5px').toEqual(['5', '5px', true]);
  expect([s3.bw, s3.cw, s3.style.includes('--icb')], '★기본(3)으로 되돌리면 키·변수 둘 다 사라짐(옛 저장본 바이트)').toEqual([null, '3px', false]);
  expect([sOff.border, sOff.cst], '★− = data-border none(옛 «없음»)').toEqual(['none', 'none']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S5c zoom — 머리 ＋/− 없음 · 켬/끔 = 옛 라디오(bd) · 끄면 표준 몸 흐림 · 굵기 칸 = bdw · 위치 = 바깥 막힘', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addZoomBlock()', '.zoom-block', 'showZoomProperties');
  await page.waitForSelector('#zm-bdw-num', { state: 'attached' });
  const r = await page.evaluate(() => ({ head: !!document.getElementById('zm-bd-on'), radios: document.querySelectorAll('input[name="zm-bd"]').length, align: [document.getElementById('zm-bd-align').value, document.getElementById('zm-bd-align').getAttribute('aria-disabled')] }));
  await page.check('input[name="zm-bd"][value="on"]');
  await page.waitForFunction(() => document.getElementById('zm-bd-fields')?.style.opacity === '');
  await fillChange(page, '#zm-bdw-num', '9');
  const bdw = await page.evaluate((id) => document.getElementById(id).dataset.bdw, id);
  await page.check('input[name="zm-bd"][value="off"]');
  const off = await page.evaluate((id) => [document.getElementById(id).dataset.bd, document.getElementById(id).dataset.bdw, document.getElementById('zm-bd-fields').style.opacity], id);
  console.log('[S5c 실측]', JSON.stringify({ r, bdw, off }));
  expect(r, '★머리 없음 · 라디오 둘 · 위치 바깥 막힘').toEqual({ head: false, radios: 2, align: ['outside', 'true'] });
  expect(bdw).toBe('9');
  expect(off, '★없음 = bd off · 굵기 값 보존 · 몸 흐림').toEqual(['off', '9', '0.4']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S5d radial — 머리 없음 · 연결선 none = 표준 몸 숨김 · 굵기 0.5 걸음 · 하한 0.5', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addRadialBlock()', '.radial-block', 'showRadialProperties');
  await page.waitForSelector('#rdl-line-width', { state: 'attached' });
  const head = await page.evaluate(() => !!document.getElementById('rdl-stroke-on'));
  await fillChange(page, '#rdl-line-width', '2.5');
  const w25 = await page.evaluate((id) => document.getElementById(id).dataset.lineWidth, id);
  await fillChange(page, '#rdl-line-width', '0');
  const wMin = await page.evaluate((id) => document.getElementById(id).dataset.lineWidth, id);
  await page.selectOption('#rdl-line-select', 'none');
  await page.waitForFunction(() => document.querySelector('#panel-right [data-part="stroke"]')?.hidden === true);
  console.log('[S5d 실측]', JSON.stringify({ head, w25, wMin }));
  expect([head, w25, wMin], '★머리 없음 · 2.5 그대로 · 0 → 하한 0.5').toEqual([false, '2.5', '0.5']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S5e 구분선·형광펜 — Stroke 절 없음 · 몸은 Special «Line»/«Highlight» · 옛 id 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const where = (ids) => page.evaluate((ids) => ({ stroke: !!document.querySelector('#panel-right .prop-section[data-sec="stroke"]'), secs: ids.map((i) => { const s = document.getElementById(i)?.closest('.prop-section'); return s ? `${s.dataset.sec}:${s.querySelector('.prop-section-title, .prop-sec-title, h3, h4')?.textContent?.trim() || ''}` : null; }) }), ids);
  await openNew(page, 'window.addDividerBlock()', '.divider-block', 'showDividerProperties');
  await page.waitForSelector('#dvd-weight-number', { state: 'attached' });
  const dv = await where(['dvd-style', 'dvd-weight-number']);
  await openNew(page, "window.addStickerBlock({ shape: 'highlightB' })", '.sticker-block', 'showStickerProperties');
  await page.waitForSelector('#stk-hlb-thick-num', { state: 'attached' });
  const hl = await where(['stk-hlb-section', 'stk-hlb-thick-num']);
  console.log('[S5e 실측]', JSON.stringify({ dv, hl }));
  expect(dv.stroke, '★구분선 = Stroke 절 없음').toBe(false);
  expect(dv.secs.every((s) => /^special:/.test(s) && /Line/.test(s)), `★구분선 몸 = Special «Line» ${dv.secs}`).toBe(true);
  expect(hl.stroke, '★형광펜 = Stroke 절 없음').toBe(false);
  expect(hl.secs.every((s) => /^special:/.test(s) && /Highlight/.test(s)), `★형광펜 몸 = Special «Highlight» ${hl.secs}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* S6 단계 2-4 (지디 261123 판정) — 그리드 = «모든 칸 테두리»가 표준(머리 ＋/− · 없음 = 굵기 0) · 색 = 옛 swatch+hex(알파 칸 없음)
 *   표 = 머리 없음 · 켬/끔 정본 = 선 토글 넷(edge-select 슬롯) · 굵기 = 외곽두께 1~6 · 위치 가운데 막힘 */
test('S6a grid — 머리 ＋ = 굵기 1 · 색·꼴 줄 나옴 · 알파 칸 없음 · − = cellBorderWidth 0 · ⌘Z 한 칸', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addGridBlock()', '.grid-block', 'showGridProperties');
  await page.waitForSelector('#grd-stroke-on', { state: 'attached' });
  const k = () => page.evaluate((id) => document.getElementById(id).dataset.cellBorderWidth ?? null, id);
  const p0 = await page.evaluate(() => ({ on: document.getElementById('grd-stroke-on').checked, hidden: document.querySelector('#panel-right [data-part="stroke"]').hidden }));
  await page.click('#panel-right label:has(#grd-stroke-on)');
  await page.waitForSelector('#grd-stroke-more', { state: 'visible' });   // ★전제 바뀜(단계 3-1): «선 꼴» = ⫶ 팝오버 안 · 켜짐 = ⫶ 단추가 보인다
  const kOn = await k();
  const p1 = await page.evaluate(() => ({ hex: !!document.getElementById('grd-border-color-hex'), alpha: !!document.querySelector('#panel-right [data-part="stroke"] [id$="-alpha"]'), align: [document.getElementById('grd-stroke-align').value, document.getElementById('grd-stroke-align').getAttribute('aria-disabled')], outline: !!document.getElementById('grd-outline-group') }));
  await page.click('#panel-right label:has(#grd-stroke-on)');
  await page.waitForFunction(() => document.querySelector('#panel-right [data-part="stroke"]')?.hidden === true);
  const kOff = await k();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  const kU = await k();
  console.log('[S6a 실측]', JSON.stringify({ p0, kOn, p1, kOff, kU }));
  expect(p0, '★새 그리드 = 테두리 없음 · 몸 숨김').toEqual({ on: false, hidden: true });
  expect([kOn, kOff, kU], '★켬 1 · 끔 0 · ⌘Z = 1').toEqual(['1', '0', '1']);
  expect(p1, '★hex 칸 · 알파 칸 없음 · 위치 안쪽 막힘 · 블럭 외곽선 슬롯 그대로').toEqual({ hex: true, alpha: false, align: ['inside', 'true'], outline: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S6b table — 머리 없음 · 선 토글 넷 = 슬롯 · 굵기 = 외곽두께(0 → 하한 1) · 위치 가운데 막힘', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addTableBlock()', '.table-block', 'showTableProperties');
  await page.waitForSelector('#tbl-outerw-number', { state: 'attached' });
  const r = await page.evaluate(() => ({ head: !!document.getElementById('tbl-stroke-on'), toggles: [...document.querySelectorAll('#panel-right [data-slot-kind="edge-select"] .ui-edge-btn')].length === 10 ? [true, true, true, true] : [false]   /* ★기대 바뀜(단계 4 · 시안 12): 옛 토글 넷 → edge-select 단추 10(묶음 4 + 변 6) */, align: [document.getElementById('tbl-stroke-align').value, document.getElementById('tbl-stroke-align').getAttribute('aria-disabled')] }));
  await fillChange(page, '#tbl-outerw-number', '4');
  const w4 = await page.evaluate((id) => [document.getElementById(id).dataset.outerWidth, document.getElementById(id).style.getPropertyValue('--tbl-outer-w')], id);
  await fillChange(page, '#tbl-outerw-number', '0');
  const wMin = await page.evaluate((id) => document.getElementById(id).dataset.outerWidth, id);
  console.log('[S6b 실측]', JSON.stringify({ r, w4, wMin }));
  expect(r, '★머리 없음 · 토글 넷 = edge-select 슬롯 · 위치 가운데 막힘').toEqual({ head: false, toggles: [true, true, true, true], align: ['center', 'true'] });
  expect([w4, wMin], '★굵기 4 = 옛 키·변수 · 0 → 하한 1').toEqual([['4', '4px'], '1']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* S7 단계 3-1 — ⫶ «Stroke 설정» 팝오버(§4c ②b · 시안 strokestd2 21·22): 단추 button.ui-stroke-more[aria-haspopup=dialog] · div.ui-stroke-pop[role=dialog]
 *   스타일 = 그 블럭 옛 값 그대로 살아 있음(CSS 블럭 «점» 유지 — 지디 261124 (가)) · 수치·끝·꼭짓점 = 막힘(까닭) · 열기/닫기(⫶ · × · Esc · 바깥) */
const popState = (page, prefix) => page.evaluate((prefix) => { const b = document.getElementById(`${prefix}-more`), p = document.getElementById(`${prefix}-pop`); return { btn: !!b && [b.getAttribute('aria-haspopup'), b.getAttribute('aria-expanded')], open: !!p && !p.hidden, role: p?.getAttribute('role'), label: p?.getAttribute('aria-label') }; }, prefix);
test('S7a frame — ⫶ 열면 스타일 = 실선·점선·점(값 그대로) · 점 고르면 옛 키 borderStyle + CSS · 수치·끝·꼭짓점 막힘(CSS 까닭) · ⌘Z 한 칸 · Esc/바깥 닫힘', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addFrameBlock()', '.frame-block:not([data-text-frame])', 'showFrameProperties');
  await page.click('#panel-right label:has(#ss-stroke-on)');
  const p0 = await popState(page, 'ss-stroke');
  await page.click('#ss-stroke-more');
  const p1 = await popState(page, 'ss-stroke');
  const f = await page.evaluate(() => { const pop = document.getElementById('ss-stroke-pop'), sel = pop.querySelector('[data-field="stroke-style"]'); return { selId: sel.id, opts: [...sel.options].map((o) => o.value), dis: ['stroke-dash', 'stroke-gap', 'stroke-cap', 'stroke-join', 'stroke-miter'].map((k) => { const e = pop.querySelector(`[data-field="${k}"]`); const t = e?.matches('[aria-disabled]') ? e : e?.querySelector('[aria-disabled]'); return t ? t.getAttribute('title') : null; }) }; });
  await page.selectOption('#ss-border-style', 'dotted');
  const s1 = await page.evaluate((id) => { const b = document.getElementById(id); return { key: b.dataset.borderStyle, css: b.style.borderStyle || getComputedStyle(b).borderTopStyle, dashRows: [...document.querySelectorAll('#ss-stroke-pop [data-when="dashed"]')].map((r) => r.hidden) }; }, id);
  await page.keyboard.press('Escape');
  const p2 = await popState(page, 'ss-stroke');
  await page.click('#ss-stroke-more'); await page.mouse.click(5, 5);
  const p3 = await popState(page, 'ss-stroke');
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  const sU = await page.evaluate((id) => document.getElementById(id).dataset.borderStyle, id);
  console.log('[S7a 실측]', JSON.stringify({ p0, p1, f, s1, p2, p3, sU }));
  expect(p0, '★⫶ 단추 aria · 처음 닫힘').toEqual({ btn: ['dialog', 'false'], open: false, role: 'dialog', label: 'Stroke 설정' });
  expect([p1.open, p1.btn[1]], '★⫶ = 열림 · aria-expanded').toEqual([true, 'true']);
  expect(f, '★스타일 = 옛 id · 실선·점선·점 · 수치·끝·꼭짓점 = 막힘(CSS 까닭)').toEqual({ selId: 'ss-border-style', opts: ['solid', 'dashed', 'dotted'], dis: Array(5).fill('이 블럭은 아직 점선 길이를 못 그려요') });
  expect(s1, '★점 = 옛 키 dotted · CSS dotted · 점선 칸 보임').toEqual({ key: 'dotted', css: 'dotted', dashRows: [false, false, false] });
  expect([p2.open, p3.open], '★Esc · 바깥 누름 = 닫힘').toEqual([false, false]);
  expect(sU, '★⌘Z 한 칸 = 점 전(실선)').toBe('solid');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S7b modal — 옛 «스타일» 단추 셋 → ⫶ 팝오버 select(값 그대로) · 점선 고르면 borderStyle', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addModalBlock()', '.modal-block', 'showModalProperties');
  await page.click('#panel-right label:has(#mdl-stroke-on)');
  const r = await page.evaluate(() => ({ oldBtns: document.querySelectorAll('#panel-right [data-bs]').length, opts: [...document.getElementById('mdl-border-style').options].map((o) => o.value) }));
  await page.click('#mdl-stroke-more'); await page.selectOption('#mdl-border-style', 'dashed');
  const k = await page.evaluate((id) => document.getElementById(id).dataset.borderStyle, id);
  console.log('[S7b 실측]', JSON.stringify({ r, k }));
  expect(r, '★옛 단추 0 · select 값 = 실선·점선·점').toEqual({ oldBtns: 0, opts: ['solid', 'dashed', 'dotted'] });
  expect(k).toBe('dashed');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S7c asset — ⫶ 팝오버 열림 · 칸 전부 막힘(스타일 키 없는 블럭) · 팝오버가 패널 밖으로 안 나감', async ({ page }) => {   // ★전제 바뀜(단계 3-2): 도형은 이제 산다(S8) → «다 막힌 블럭» 대표 = 에셋
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await openNew(page, 'window.addAssetBlock()', '.asset-block', 'showAssetProperties');
  await page.click('#panel-right label:has(#asset-stroke-on)');
  await page.click('#asset-stroke-more');
  const r = await page.evaluate(() => { const pop = document.getElementById('asset-stroke-pop'), panel = document.getElementById('panel-right').getBoundingClientRect(), pr = pop.getBoundingClientRect(); return { open: !pop.hidden, styleDis: pop.querySelector('[data-field="stroke-style"]').getAttribute('aria-disabled'), inside: pr.left >= panel.left - 1 && pr.right <= panel.right + 1 && pr.top >= panel.top - 1 && pr.bottom <= panel.bottom + 1, h: Math.round(pr.height) }; });
  const v0 = await page.evaluate(() => document.querySelector('#asset-stroke-pop [data-field="stroke-style"]').value);
  await page.focus('#asset-stroke-pop [data-field="stroke-style"]'); await page.keyboard.press('ArrowDown');
  const v1 = await page.evaluate(() => document.querySelector('#asset-stroke-pop [data-field="stroke-style"]').value);
  console.log('[S7c 실측]', JSON.stringify({ r, v0, v1 }));
  expect([r.open, r.styleDis, r.inside], '★열림 · 스타일 막힘 · 패널 안').toEqual([true, 'true', true]);
  expect(v1, '★막힌 칸은 키로 안 바뀜').toBe(v0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S7d 자리 — ⫶ 를 패널 아래쪽에서 열고 «점»을 골라 줄이 늘어도 팝오버가 패널 안(아래로 넘치면 위로 뒤집힘)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await openNew(page, 'window.addFrameBlock()', '.frame-block:not([data-text-frame])', 'showFrameProperties');
  await page.click('#panel-right label:has(#ss-stroke-on)');
  await page.evaluate(() => document.querySelector('#ss-stroke-more').scrollIntoView({ block: 'start' }));   // ★전제: 단추가 패널 위쪽 → 아래 자리 ≈ 패널 끝까지(실측 878 → 1114 > 1100 이 났던 장면)
  await page.click('#ss-stroke-more'); await page.selectOption('#ss-border-style', 'dotted');
  const r = await page.evaluate(() => { const pop = document.getElementById('ss-stroke-pop').getBoundingClientRect(), box = document.querySelector('#panel-right .panel-body').getBoundingClientRect(); return { top: Math.round(pop.top), bottom: Math.round(pop.bottom), boxTop: Math.round(box.top), boxBottom: Math.round(box.bottom), up: document.getElementById('ss-stroke-pop').classList.contains('ui-stroke-pop--up') }; });
  console.log('[S7d 실측]', JSON.stringify(r));
  expect(r.bottom <= r.boxBottom && r.top >= r.boxTop, `★팝오버가 패널 안 ${JSON.stringify(r)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* S8 단계 3-2 도형 — ⫶ 팝오버가 «산다»(스타일 실선·점선·사용자 · 길이/간격 · 점선 끝 · 꼭짓점 · Miter) · 새 키는 기본과 다를 때만(stroke-look.js) · 그림 = svg 인라인 style
 *   내보내기 3경로(지디 261124): PNG = 위 변을 따라 어두운 토막 수(점선 > 3 · 실선 = 1) · HTML = 내보낸 문자열에 stroke-dasharray · Figma JSON = strokeDasharray(키 없는 도형은 안 실음) */
async function shapeScene(page, type = 'rectangle') {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (type) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sS8'; sec.style.backgroundColor = '#ffffff'; window.deselectAll(); window.selectSection(sec);
    window.addShapeBlock(type); const b = [...sec.querySelectorAll('.shape-block')].pop();
    b.dataset.shapeColor = '#ffffff'; b.dataset.shapeStrokeColor = '#000000'; b.dataset.shapeStrokeWidth = '8';
    const sv = b.querySelector('svg'); sv.style.stroke = '#000000'; sv.style.strokeWidth = '8'; window.refreshShapeInnerSVG?.(b);
    b.querySelectorAll('svg :is(rect,ellipse,polygon)').forEach((e) => e.setAttribute('fill', '#ffffff'));
    window.deselectAll(); window.selectBlock(b.id); window.showShapeProperties?.(b); window.clearHistory?.(); return b.id;
  }, type);
  await page.waitForSelector('#shape-stroke-more', { state: 'attached' });
  return { errs, id };
}
test('S8a 도형 — 팝오버 산다: 점선 = strokeStyle 하나 + svg 3w·2w · 꼭짓점 bevel · ⌘Z 한 칸 · 실선·뾰족 되돌리면 키 0', async ({ page }) => {
  const { errs, id } = await shapeScene(page);
  await page.click('#shape-stroke-more');
  const live = await page.evaluate(() => { const p = document.getElementById('shape-stroke-pop'); return ['stroke-style', 'stroke-cap', 'stroke-join', 'stroke-miter'].map((f) => { const e = p.querySelector(`[data-field="${f}"]`); return !(e.matches('[aria-disabled="true"]') || e.querySelector('[aria-disabled="true"]')); }); });
  await page.selectOption('#shape-stroke-pop [data-field="stroke-style"]', 'dashed');
  const st = () => page.evaluate((id) => { const b = document.getElementById(id), s = b.querySelector('svg').style; return { keys: Object.keys(b.dataset).filter((k) => /^stroke(Style|DashLen|GapLen|Cap|Join|Miter)$/.test(k)).sort(), dash: s.strokeDasharray, join: s.strokeLinejoin }; }, id);
  const s1 = await st();
  await page.click('#shape-stroke-pop [data-field="stroke-join"] [data-value="bevel"]');
  const s2 = await st();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  const s3 = await st();
  await page.evaluate((id) => { window.deselectAll(); window.selectBlock(id); window.showShapeProperties(document.getElementById(id)); }, id);
  await page.click('#shape-stroke-more'); await page.selectOption('#shape-stroke-pop [data-field="stroke-style"]', 'solid');
  const s4 = await st();
  console.log('[S8a 실측]', JSON.stringify({ live, s1, s2, s3, s4 }));
  expect(live, '★사각 = 스타일·끝·꼭짓점·Miter 산다').toEqual([true, true, true, true]);
  expect(s1, '★점선 = 키 strokeStyle 하나 · svg 24 16(굵기 8 의 3w·2w)').toEqual({ keys: ['strokeStyle'], dash: '24, 16', join: '' });
  expect(s2, '★bevel = 키 + svg').toEqual({ keys: ['strokeJoin', 'strokeStyle'], dash: '24, 16', join: 'bevel' });
  expect(s3, '★⌘Z 한 칸 = bevel 전').toEqual({ keys: ['strokeStyle'], dash: '24, 16', join: '' });
  expect(s4, '★실선으로 되돌리면 키 0 · svg 속성 0(옛 바이트)').toEqual({ keys: [], dash: '', join: '' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S8b 원·선 — 꼭짓점·Miter 막힘(꼭짓점이 없는 블럭) · 점선은 산다', async ({ page }) => {
  const { errs } = await shapeScene(page, 'ellipse');
  await page.click('#shape-stroke-more');
  const r = await page.evaluate(() => { const p = document.getElementById('shape-stroke-pop'); const t = (f) => { const e = p.querySelector(`[data-field="${f}"]`); const d = e.matches('[aria-disabled]') ? e : e.querySelector('[aria-disabled]'); return d ? d.getAttribute('title') : null; }; return { style: t('stroke-style'), join: t('stroke-join'), miter: t('stroke-miter') }; });
  console.log('[S8b 실측]', JSON.stringify(r));
  expect(r).toEqual({ style: null, join: '꼭짓점이 없는 블럭이에요', miter: '꼭짓점이 없는 블럭이에요' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S8c 도형 점선(사용자 4·4) — 내보내기 3경로: PNG 위 변 토막 > 5(실선 대조 = 1) · HTML stroke-dasharray · Figma JSON strokeDasharray(대조: 실선은 안 실음)', async ({ page }) => {
  const { errs, id } = await shapeScene(page);
  await installCdpCapture(page);
  const runs = () => page.evaluate(async (id) => {
    const sec = document.getElementById('sS8'), b = document.getElementById(id);
    const url = await window.exportSection(sec, 'png', 860, { returnDataUrl: true });
    if (typeof url !== 'string' || !url.startsWith('data:image/png')) return { err: 'not png' };
    const i = new Image(); i.src = url; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const sr = sec.getBoundingClientRect(), br = b.querySelector('svg').getBoundingClientRect(), k = i.width / sr.width;
    const y = Math.round((br.top - sr.top + 2 * (br.height / 100)) * k);   // 위 변 띠 안(굵기 8/100 의 가운데쯤)
    const x0 = Math.round((br.left - sr.left + 0.1 * br.width) * k), x1 = Math.round((br.right - sr.left - 0.1 * br.width) * k);
    const d = g.getImageData(x0, y, x1 - x0, 1).data; let n = 0, prev = false;
    for (let p = 0; p < d.length; p += 4) { const dark = d[p] < 80 && d[p + 1] < 80 && d[p + 2] < 80; if (dark && !prev) n++; prev = dark; }
    return { n, w: x1 - x0 };
  }, id);
  const solid = await runs();
  await page.click('#shape-stroke-more'); await page.selectOption('#shape-stroke-pop [data-field="stroke-style"]', 'custom');
  for (const f of ['stroke-dash', 'stroke-gap']) { await page.fill(`#shape-stroke-pop [data-field="${f}"] input`, '4'); await page.locator(`#shape-stroke-pop [data-field="${f}"] input`).dispatchEvent('change'); }   // 사용자 4·4 — 파생 3w·2w 는 위 변에 토막 2~3 뿐(굵기 8 · 상자 크기와 무관) → 자가 무디다
  await page.keyboard.press('Escape');
  const dashed = await runs();
  const figma = await page.evaluate((id) => { const find = (o) => { if (!o || typeof o !== 'object') return null; if (o.id === id && o.type === 'shape') return o; for (const v of Object.values(o)) { const f = find(v); if (f) return f; } return null; }; const s = find(window.buildFigmaExportJSON(null)); return s && { dash: s.strokeDasharray ?? null, join: s.strokeLinejoin ?? null }; }, id);
  const [dh] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => { window.exportHTMLFile(); return null; })]);
  const html = require('fs').readFileSync(await dh.path(), 'utf8');
  const htmlDash = new RegExp(`id="${id}"[\\s\\S]{0,2000}?stroke-dasharray:\\s*4(px)?,?\\s*4`).test(html);
  console.log('[S8c 실측]', JSON.stringify({ solid, dashed, figma, htmlDash }));
  expect(solid, '★대조 — 실선 위 변 = 어두운 토막 1').toMatchObject({ n: 1 });
  expect(dashed.n, `★PNG 점선 — 위 변 토막 ${dashed.n}`).toBeGreaterThan(5);
  expect(figma, '★Figma JSON = 캔버스 svg 값(공백 숫자 꼴 · 렌더러 꼴 검사 통과) · 꼭짓점 키 없으면 안 실음').toEqual({ dash: '4 4', join: null });
  expect(htmlDash, '★HTML 내보내기에 도형 svg stroke-dasharray').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 실앱 PNG = main.js 'capture-section-cdp' — 하네스 electronAPI 는 null ⇒ 같은 CDP 명령을 흉내(checker-asset-tone T8 과 같은 손 · 메모 «DOM 캡처는 wireCdp») */
async function installCdpCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height }) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: 1 }, captureBeyondViewport: true, fromSurface: true });
    return r.data;
  });
  await page.evaluate(() => {
    const old = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : old?.[k]) });
  });
}

/* S9 단계 3-2 radial — 연결선 «Stroke 설정»: 스타일 키 = 옛 lineStyle · «사용자» = dashed + strokeDashLen/GapLen · 끝/꼭짓점/Miter = 새 키(기본과 다를 때만)
 *   렌더 = path 속성(_paintRadial) → PNG·HTML·Figma(generic svg 그대로) 3경로가 같은 속성을 든다 */
async function radialScene(page, line) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (line) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sS9'; sec.style.backgroundColor = '#ffffff'; window.deselectAll(); window.selectSection(sec);
    const before = new Set(sec.querySelectorAll('.radial-block')); window.addRadialBlock(); const b = [...sec.querySelectorAll('.radial-block')].find((x) => !before.has(x));
    b.dataset.lineColor = '#ff00aa'; b.dataset.lineWidth = '4'; b.dataset.lineStyle = 'solid'; if (line) b.dataset.line = line; window.renderRadialBlock?.(b);
    window.deselectAll(); window.selectBlock(b.id); window.showRadialProperties(b); window.clearHistory?.(); return b.id;
  }, line);
  await page.waitForSelector('#rdl-stroke-more', { state: 'attached' });
  return { errs, id };
}
const rdlPath = (page, id) => page.evaluate((id) => { const p = document.querySelector(`#${id} path.rdl-line`); const b = document.getElementById(id); return { dash: p?.getAttribute('stroke-dasharray') ?? null, cap: p?.getAttribute('stroke-linecap') ?? null, join: p?.getAttribute('stroke-linejoin') ?? null, keys: Object.keys(b.dataset).filter((k) => /^stroke(Style|DashLen|GapLen|Cap|Join|Miter)$/.test(k)).sort(), ls: b.dataset.lineStyle }; }, id);
test('S9a radial — 사용자 2·10 = lineStyle dashed + 길이 키 · path dasharray · 끝 네모 = 키 · ⌘Z 한 칸 · 실선 되돌리면 새 키 0', async ({ page }) => {
  const { errs, id } = await radialScene(page);
  const p0 = await rdlPath(page, id);
  await page.click('#rdl-stroke-more'); await page.selectOption('#rdl-line-style', 'custom');
  for (const [f, v] of [['stroke-dash', '2'], ['stroke-gap', '10']]) { await page.fill(`#rdl-stroke-pop [data-field="${f}"] input`, v); await page.locator(`#rdl-stroke-pop [data-field="${f}"] input`).dispatchEvent('change'); }
  const p1 = await rdlPath(page, id);
  if (!(await page.locator('#rdl-stroke-pop').isVisible())) await page.click('#rdl-stroke-more');
  await page.click('#rdl-stroke-pop [data-field="stroke-cap"] [data-value="square"]');
  const p2 = await rdlPath(page, id);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  const p3 = await rdlPath(page, id);
  await page.evaluate((id) => { window.deselectAll(); window.selectBlock(id); window.showRadialProperties(document.getElementById(id)); }, id);
  await page.click('#rdl-stroke-more'); await page.selectOption('#rdl-line-style', 'solid');
  const p4 = await rdlPath(page, id);
  console.log('[S9a 실측]', JSON.stringify({ p0, p1, p2, p3, p4 }));
  expect(p0, '[전제] 실선 · 옛 끝 round · 새 키 0').toEqual({ dash: null, cap: 'round', join: null, keys: [], ls: 'solid' });
  expect(p1, '★사용자 2·10').toEqual({ dash: '2 10', cap: 'round', join: null, keys: ['strokeDashLen', 'strokeGapLen'], ls: 'dashed' });
  expect(p2, '★끝 네모 = 키 + path').toEqual({ dash: '2 10', cap: 'square', join: null, keys: ['strokeCap', 'strokeDashLen', 'strokeGapLen'], ls: 'dashed' });
  expect(p3, '★⌘Z 한 칸 = 네모 전').toEqual(p1);
  expect(p4, '★실선 = 길이 키 지움 · 새 키 0(옛 바이트)').toEqual({ dash: null, cap: 'round', join: null, keys: [], ls: 'solid' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S9b radial — 꼭짓점 = 외곽선(다각형)만 산다 · 궤도(원)는 막힘(꼭짓점 없음)', async ({ page }) => {
  const r = {};
  for (const line of ['orbit', 'outline']) {
    const { errs } = await radialScene(page, line);
    await page.click('#rdl-stroke-more');
    r[line] = await page.evaluate(() => { const e = document.querySelector('#rdl-stroke-pop [data-field="stroke-join"] [aria-disabled]'); return e ? e.getAttribute('title') : 'live'; });
    expect(errs, errs.join(' | ')).toEqual([]);
  }
  console.log('[S9b 실측]', JSON.stringify(r));
  expect(r).toEqual({ orbit: '꼭짓점이 없는 블럭이에요', outline: 'live' });
});

test('S9c radial 사용자 점선 — 내보내기 3경로: PNG 선 색 픽셀 실선 대비 < 60% · HTML path dasharray · Figma JSON(generic svg) dasharray', async ({ page }) => {
  const { errs, id } = await radialScene(page);
  await installCdpCapture(page);
  const pink = () => page.evaluate(async () => {
    const url = await window.exportSection(document.getElementById('sS9'), 'png', 860, { returnDataUrl: true });
    if (typeof url !== 'string' || !url.startsWith('data:image/png')) return { err: 'not png' };
    const i = new Image(); i.src = url; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let k = 0; k < d.length; k += 4) if (d[k] > 200 && d[k + 1] < 90 && d[k + 2] > 120) n++;
    return { n };
  });
  const solid = await pink();
  await page.click('#rdl-stroke-more'); await page.selectOption('#rdl-line-style', 'custom');
  for (const [f, v] of [['stroke-dash', '2'], ['stroke-gap', '10']]) { await page.fill(`#rdl-stroke-pop [data-field="${f}"] input`, v); await page.locator(`#rdl-stroke-pop [data-field="${f}"] input`).dispatchEvent('change'); }
  await page.keyboard.press('Escape');
  const dashed = await pink();
  const figma = await page.evaluate((id) => { const find = (o) => { if (!o || typeof o !== 'object') return null; if (o.id === id) return o; for (const v of Object.values(o)) { const f = find(v); if (f) return f; } return null; }; const b = find(window.buildFigmaExportJSON(null)); return b ? /stroke-dasharray="2 10"/.test(b.svg || '') : null; }, id);
  const [dh] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => { window.exportHTMLFile(); return null; })]);
  const html = require('fs').readFileSync(await dh.path(), 'utf8');
  const htmlDash = new RegExp(`id="${id}"[\\s\\S]{0,4000}?class="rdl-line"[^>]*stroke-dasharray="2 10"`).test(html);
  console.log('[S9c 실측]', JSON.stringify({ solid, dashed, figma, htmlDash }));
  expect(solid.n, '[전제] 실선 선 색 픽셀이 있다').toBeGreaterThan(200);
  expect(dashed.n / solid.n, `★PNG 점선(2·10) 선 색 픽셀 ${dashed.n}/${solid.n}`).toBeLessThan(0.6);
  expect(figma, '★Figma JSON generic svg 에 dasharray 2 10').toBe(true);
  expect(htmlDash, '★HTML 내보내기 path dasharray 2 10').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S9d radial 호 — 점선 + 점선 끝 «둥글게»여도 선 끝이 상자 안(상자 계산 = 같은 끝 · AG13 · 키 없으면 옛 butt)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec);
    const before = new Set(sec.querySelectorAll('.radial-block')); window.addRadialBlock({ shape: 'arc' }); const b = [...sec.querySelectorAll('.radial-block')].find((x) => !before.has(x));
    b.dataset.lineWidth = '6'; b.dataset.lineStyle = 'solid'; b.dataset.line = 'orbit'; window.renderRadialBlock?.(b);
    window.deselectAll(); window.selectBlock(b.id); window.showRadialProperties(b); return b.id;
  });
  const box = () => page.evaluate((id) => { const st = document.querySelector(`#${id} .rdl-stage`).getBoundingClientRect(), p = document.querySelector(`#${id} path.rdl-line`); const r = p.getBoundingClientRect(), w = +p.getAttribute('stroke-width'), k = st.width / +document.querySelector(`#${id} svg.rdl-lines`).viewBox.baseVal.width; return { cap: p.getAttribute('stroke-linecap'), out: Math.round((st.left - (r.left - (w * k) / 2)) * 10) / 10 }; }, id);
  const b0 = await box();
  await page.click('#rdl-stroke-more'); await page.selectOption('#rdl-line-style', 'dashed'); await page.click('#rdl-stroke-pop [data-field="stroke-cap"] [data-value="round"]');   // «점선 끝» 줄은 점선일 때만 보인다(§4c ②b)
  const b1 = await box();
  console.log('[S9d 실측]', JSON.stringify({ b0, b1 }));
  expect(b0.cap, '[전제] 키 없음 = 옛 butt').toBe('butt');
  expect(b1.cap, '★둥글게 = round').toBe('round');
  expect(b1.out, `★둥근 끝이 상자 왼쪽 밖으로 ${b1.out}px`).toBeLessThanOrEqual(0.5);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* S10 단계 4 — edge-select(«변 선택 테두리» · §4c ②b · 시안 strokestd2 9·12): 표 = 변 6 · 좌우/상하 같이 · 바뀐 키만 씀 · 묶음 · ⌘Z 한 칸 / 그리드 = 바깥 넷 + 모두/없음(옛 속성 지킴) */
test('S10a 표 — 왼쪽 누르면 좌우 같이(showOuterX 하나만 바뀜) · «없음» = 넷 다 false · ⌘Z 한 칸 · 다시 열어도 같은 변', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addTableBlock()', '.table-block', 'showTableProperties');
  await page.waitForSelector('#tbl-stroke-edges');
  const ks = () => page.evaluate((id) => { const d = document.getElementById(id).dataset, g = document.getElementById('tbl-stroke-edges'); return { keys: ['showVLines', 'showHLines', 'showOuterX', 'showOuterY'].map((k) => d[k] ?? null), value: g.dataset.value, active: [...g.querySelectorAll('.ui-edge-btn.active')].map((b) => b.dataset.strokeEdge || `p:${b.dataset.edgePreset}`) }; }, id);
  const k0 = await ks();
  await page.click('#tbl-stroke-edges [data-stroke-edge="left"]');
  const k1 = await ks();
  await page.click('#tbl-stroke-edges [data-edge-preset="none"]');
  const k2 = await ks();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  const k3 = await page.evaluate((id) => ['showVLines', 'showHLines', 'showOuterX', 'showOuterY'].map((k) => document.getElementById(id).dataset[k] ?? null), id);
  await page.evaluate((id) => { window.deselectAll(); window.selectBlock(id); window.showTableProperties(document.getElementById(id)); }, id);
  const k4 = await ks();
  console.log('[S10a 실측]', JSON.stringify({ k0, k1, k2, k3, k4 }));
  expect(k0, '[전제] 새 표(실측: addTableBlock 이 키를 씀 · 바깥 좌우 끔) = 위·아래·안쪽 둘').toEqual({ keys: ['true', 'true', 'false', 'true'], value: 'top,bottom,inner-h,inner-v', active: ['top', 'bottom', 'inner-h', 'inner-v'] });
  expect(k1, '★왼쪽 = 좌우 같이 켬 · showOuterX 하나만 바뀜 · 모두 활성').toEqual({ keys: ['true', 'true', 'true', 'true'], value: 'top,right,bottom,left,inner-h,inner-v', active: ['p:all', 'top', 'right', 'bottom', 'left', 'inner-h', 'inner-v'] });
  expect(k2.keys, '★없음 = 넷 다 false').toEqual(['false', 'false', 'false', 'false']);
  expect(k2.active, '★없음 활성').toEqual(['p:none']);
  expect(k3, '★⌘Z 한 칸 = 없음 전').toEqual(['true', 'true', 'true', 'true']);
  expect(k4.value, '★다시 열어도 같은 변').toBe('top,right,bottom,left,inner-h,inner-v');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S10b 그리드 블럭 외곽선 — edge-select(바깥 넷 + 모두/없음 = 단추 6 · 옛 data-outline-* 지킴) · 위 = blockOutline top · 없음 = 빈 목록', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addGridBlock()', '.grid-block', 'showGridProperties');
  await page.waitForSelector('#grd-outline-group');
  const r0 = await page.evaluate(() => { const g = document.getElementById('grd-outline-group'); return { n: g.querySelectorAll('.ui-edge-btn').length, sides: [...g.querySelectorAll('[data-outline-side]')].map((b) => b.dataset.outlineSide), all: [...g.querySelectorAll('[data-outline-all]')].map((b) => b.dataset.outlineAll), field: g.dataset.field }; });
  await page.click('#grd-outline-group [data-outline-side="top"]');
  const o1 = await page.evaluate((id) => document.getElementById(id).dataset.blockOutline ?? null, id);
  await page.click('#grd-outline-group [data-outline-all="0"]');
  const o2 = await page.evaluate((id) => document.getElementById(id).dataset.blockOutline ?? null, id);
  console.log('[S10b 실측]', JSON.stringify({ r0, o1, o2 }));
  expect(r0, '★단추 6 · 옛 속성').toEqual({ n: 6, sides: ['top', 'right', 'bottom', 'left'], all: ['1', '0'], field: 'stroke-edges' });
  expect(o1, '★위 켬').toBe('top');
  expect(o2 === '' || o2 === 'none' || o2 === null, `★없음 = 빈 목록(${o2})`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* S11 단계 4-2 — 면별 굵기(□ · §4c ②b «사용자» · 시안 strokestd2 23): 키 strokeWidthTop/Right/Bottom/Left = 넷이 표준과 다를 때만 · CSS border-width 4값 · 표준 칸 Mixed · 표준 칸에 치면 넷 다 */
const sidesOf = (page, sel) => page.evaluate((sel) => { const b = document.querySelector(sel), cs = getComputedStyle(b); return { keys: ['strokeWidthTop', 'strokeWidthRight', 'strokeWidthBottom', 'strokeWidthLeft'].map((k) => b.dataset[k] ?? null), css: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth] }; }, sel);
test('S11a 프레임 — □ 열기 · 왼쪽 끔 = 키 넷 + CSS · 표준 칸 Mixed · 사용자 위 4 · 표준 3 치면 넷 다 3(키 0) · ⌘Z 한 칸 · HTML 에 4값', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addFrameBlock()', '.frame-block:not([data-text-frame])', 'showFrameProperties');
  await page.click('#panel-right label:has(#ss-stroke-on)');   // 켬 = 1px
  const sel = `#${id}`;
  const slot0 = await page.evaluate(() => document.getElementById('ss-stroke-sides').hidden);
  await page.click('#ss-stroke-sides-btn');
  const slot1 = await page.evaluate(() => document.getElementById('ss-stroke-sides').hidden);
  await page.click('#ss-stroke-sides-edges [data-stroke-edge="left"]');
  const s1 = await sidesOf(page, sel);
  const mix1 = await page.evaluate(() => { const i = document.getElementById('ss-border-w-num'); return [i.value, i.placeholder]; });
  await page.fill('#ss-stroke-w-top', '4'); await page.locator('#ss-stroke-w-top').dispatchEvent('change');
  const s2 = await sidesOf(page, sel);
  const [dh] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => { window.exportHTMLFile(); return null; })]);
  const html = require('fs').readFileSync(await dh.path(), 'utf8');
  const htmlSides = new RegExp(`id="${id}"[^>]*style="[^"]*border-width:\\s*4px 1px 1px 0px`).test(html) || new RegExp(`style="[^"]*border-width:\\s*4px 1px 1px 0px[^"]*"[^>]*id="${id}"`).test(html);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  const s3 = await sidesOf(page, sel);
  await page.evaluate((id) => { window.deselectAll(); window.selectBlock(id); window.showFrameProperties(document.getElementById(id)); }, id);
  await page.fill('#ss-border-w-num', '3'); await page.locator('#ss-border-w-num').dispatchEvent('change');
  const s4 = await sidesOf(page, sel);
  console.log('[S11a 실측]', JSON.stringify({ slot0, slot1, s1, mix1, s2, htmlSides, s3, s4 }));
  expect([slot0, slot1], '★□ = 슬롯 열기(키 0)').toEqual([true, false]);
  expect(s1, '★왼쪽 끔 = 키 넷 · CSS 1 1 1 0').toEqual({ keys: ['1', '1', '1', '0'], css: ['1px', '1px', '1px', '0px'] });
  expect(mix1, '★표준 칸 Mixed').toEqual(['', 'Mixed']);
  expect(s2.css, '★사용자 위 4').toEqual(['4px', '1px', '1px', '0px']);
  expect(htmlSides, '★HTML 내보내기에 border-width 4값').toBe(true);
  expect(s3.css, '★⌘Z 한 칸 = 위 4 전').toEqual(['1px', '1px', '1px', '0px']);
  expect(s4, '★표준 3 = 넷 다 3 · 면별 키 0(옛 바이트)').toEqual({ keys: [null, null, null, null], css: ['3px', '3px', '3px', '3px'] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S11b 모달·에셋 — 사용자 굵기 넷 = 렌더 border-width 4값(모달 = renderModalBlock · 에셋 = 패널 쓰기)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const out = {};
  for (const [k, make, selq, show, pfx, sel] of [['modal', 'window.addModalBlock()', '.modal-block', 'showModalProperties', 'mdl-stroke', (id) => `#${id} .modal-box, #${id} > div`], ['asset', 'window.addAssetBlock()', '.asset-block', 'showAssetProperties', 'asset-stroke', (id) => `#${id}`]]) {
    const id = await openNew(page, make, selq, show);
    await page.click(`#panel-right label:has(#${pfx}-on)`);
    await page.click(`#${pfx}-sides-btn`); await page.click(`#${pfx}-sides-edges [data-edge-preset="custom"]`);
    for (const [s, v] of [['top', '5'], ['right', '0'], ['bottom', '2'], ['left', '0']]) { await page.fill(`#${pfx}-w-${s}`, v); await page.locator(`#${pfx}-w-${s}`).dispatchEvent('change'); }
    out[k] = await page.evaluate(([id, k]) => { const b = document.getElementById(id); const el = k === 'modal' ? ([...b.querySelectorAll('*')].find((e) => parseFloat(getComputedStyle(e).borderTopWidth) === 5) || b) : b; const cs = getComputedStyle(el); return { keys: ['strokeWidthTop', 'strokeWidthRight', 'strokeWidthBottom', 'strokeWidthLeft'].map((x) => b.dataset[x] ?? null), css: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth] }; }, [id, k]);
  }
  console.log('[S11b 실측]', JSON.stringify(out));
  expect(out.modal, '★모달 사용자 5 0 2 0').toEqual({ keys: ['5', '0', '2', '0'], css: ['5px', '0px', '2px', '0px'] });
  expect(out.asset, '★에셋 사용자 5 0 2 0').toEqual({ keys: ['5', '0', '2', '0'], css: ['5px', '0px', '2px', '0px'] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S11c 프레임 면별 — 저장 → 다시 열기(applyProjectData · save-load 보더 복원)에도 border-width 4값 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await openNew(page, 'window.addFrameBlock()', '.frame-block:not([data-text-frame])', 'showFrameProperties');
  await page.click('#panel-right label:has(#ss-stroke-on)');
  await page.click('#ss-stroke-sides-btn'); await page.click('#ss-stroke-sides-edges [data-edge-preset="custom"]');
  for (const [s, v] of [['top', '6'], ['right', '0'], ['bottom', '3'], ['left', '0']]) { await page.fill(`#ss-stroke-w-${s}`, v); await page.locator(`#ss-stroke-w-${s}`).dispatchEvent('change'); }
  const before = await sidesOf(page, `#${id}`);
  await page.evaluate(async () => { const snap = window.serializeProject(); await window.applyProjectData(typeof snap === 'string' ? JSON.parse(snap) : snap); });
  await page.waitForFunction((id) => !!document.getElementById(id), id);
  const after = await sidesOf(page, `#${id}`);
  console.log('[S11c 실측]', JSON.stringify({ before, after }));
  expect(before.css, '[전제] 6 0 3 0').toEqual(['6px', '0px', '3px', '0px']);
  expect(after, '★다시 열어도 키·CSS 그대로').toEqual(before);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* S12 단계 4-2b — 도형 사각형 면별(변마다 선 · block-factory _shapeInnerSVG opts.sides) · 원·선 등은 □ 없음 */
test('S12 도형 사각형 — 사용자 6 0 3 0 = 선 둘(위 6 · 아래 3) + 면 · PNG 위 변 어둡고 왼 변 밝음 · 저장→다시 열기 그대로 · 원엔 □ 없음', async ({ page }) => {
  const { errs, id } = await shapeScene(page);
  await installCdpCapture(page);
  await page.click('#shape-stroke-sides-btn'); await page.click('#shape-stroke-sides-edges [data-edge-preset="custom"]');
  for (const [s, v] of [['top', '6'], ['right', '0'], ['bottom', '3'], ['left', '0']]) { await page.fill(`#shape-stroke-w-${s}`, v); await page.locator(`#shape-stroke-w-${s}`).dispatchEvent('change'); }
  const lines = () => page.evaluate((id) => [...document.querySelectorAll(`#${id} svg line`)].map((l) => `${l.getAttribute('y1')}:${l.getAttribute('stroke-width')}`), id);
  const l1 = await lines();
  const px = await page.evaluate(async (id) => {
    const sec = document.getElementById('sS8'), b = document.getElementById(id);
    const url = await window.exportSection(sec, 'png', 860, { returnDataUrl: true }); const i = new Image(); i.src = url; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const sr = sec.getBoundingClientRect(), br = b.querySelector('svg').getBoundingClientRect(), k = i.width / sr.width;
    const at = (x, y) => { const d = g.getImageData(Math.round((x - sr.left) * k), Math.round((y - sr.top) * k), 1, 1).data; return d[0] < 80 ? 'dark' : 'light'; };
    return { top: at(br.left + br.width / 2, br.top + 1.5 * br.height / 100), left: at(br.left + 1.5 * br.width / 100, br.top + br.height / 2) };
  }, id);
  await page.evaluate(async () => { const snap = window.serializeProject(); await window.applyProjectData(typeof snap === 'string' ? JSON.parse(snap) : snap); });
  await page.waitForFunction((id) => !!document.getElementById(id), id);
  const l2 = await lines();
  const ell = await (async () => { const e = await shapeScene(page, 'ellipse'); return page.evaluate(() => !!document.getElementById('shape-stroke-sides-btn')); })();
  console.log('[S12 실측]', JSON.stringify({ l1, px, l2, ell }));
  expect(l1, '★선 둘 = 위(y 3 · 굵기 6) · 아래(y 98.5 · 굵기 3)').toEqual(['3:6', '98.5:3']);
  expect(px, '★PNG 위 변 어둡고 왼 변 밝음').toEqual({ top: 'dark', left: 'light' });
  expect(l2, '★다시 열어도 같은 선').toEqual(l1);
  expect(ell, '★원 = □ 없음').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* S13 단계 4-3 — 보내는 쪽(Figma JSON): 프레임 border(면별 sides) · 테두리 없는 프레임 = 키 없음(옛 바이트) · 모달 옛 꼴 그대로 · 에셋 border · 표 outer · 도형 사각형 strokeSides */
test('S13 Figma JSON — 프레임 border/sides · 없음 = 키 없음 · 모달 옛 꼴 · 에셋 · 표 outer · 도형 strokeSides', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const mk = (fn, sel) => { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll(sel)); fn(); return [...sec.querySelectorAll(sel)].find((x) => !before.has(x)); };
    const f1 = mk(() => window.addFrameBlock(), '.frame-block:not([data-text-frame])'); f1.id = 'xF1';
    Object.assign(f1.dataset, { borderWidth: '2', borderColor: '#ff0000', borderStyle: 'solid', strokeWidthTop: '6', strokeWidthRight: '0', strokeWidthBottom: '3', strokeWidthLeft: '0' });
    const f2 = mk(() => window.addFrameBlock(), '.frame-block:not([data-text-frame])'); f2.id = 'xF2';
    const m = mk(() => window.addModalBlock(), '.modal-block'); m.id = 'xM'; Object.assign(m.dataset, { borderW: '2', borderColor: '#c3c3ca', borderStyle: 'solid' });
    const a = mk(() => window.addAssetBlock(), '.asset-block'); a.id = 'xA'; Object.assign(a.dataset, { strokeWidth: '4', strokeColor: '#000000' });
    const t = mk(() => window.addTableBlock(), '.table-block'); t.id = 'xT'; Object.assign(t.dataset, { showOuterX: 'false', showOuterY: 'true', outerWidth: '3' });
    const s = mk(() => window.addShapeBlock('rectangle'), '.shape-block'); s.id = 'xS'; Object.assign(s.dataset, { shapeStrokeWidth: '2', strokeWidthTop: '6', strokeWidthRight: '0', strokeWidthBottom: '3', strokeWidthLeft: '0' });
    return true;
  });
  const j = await page.evaluate(() => { const all = []; const walk = (o) => { if (!o || typeof o !== 'object') return; if (typeof o.id === 'string' && /^x[A-Z]/.test(o.id)) all.push(o); Object.values(o).forEach(walk); }; walk(window.buildFigmaExportJSON(null)); const by = (id) => all.find((o) => o.id === id); return {
    f1: by('xF1')?.border ?? null, f2: by('xF2') ? ('border' in by('xF2')) : 'missing', m: by('xM')?.border ?? null, a: by('xA')?.border ?? null, t: by('xT')?.outer ?? null, s: by('xS')?.strokeSides ?? null }; });
  console.log('[S13 실측]', JSON.stringify({ ids, j }));
  expect(j.f1, '★프레임 면별').toEqual({ width: 2, style: 'solid', color: '#ff0000', sides: { top: 6, right: 0, bottom: 3, left: 0 } });
  expect(j.f2, '★테두리 없는 프레임 = border 키 없음(옛 바이트)').toBe(false);
  expect(JSON.stringify(j.m), '★모달 = 옛 꼴 글자 그대로(면별 없음)').toBe('{"width":2,"style":"solid","color":"#c3c3ca"}');
  expect(j.a, '★에셋').toEqual({ width: 4, style: 'solid', color: '#000000' });
  expect(j.t, '★표 바깥 변').toEqual({ x: false, y: true, width: 3 });
  expect(j.s, '★도형 사각형 면별').toEqual([6, 0, 3, 0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S11d ⫶·□ 둘 다 있는 Stroke 절 — 잘림 0(줄 끝 = 팝오버 div · 옵션 칼럼 규칙 안 걸림 · redact-toggle-label-clip ③ 회귀의 같은 자)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const out = {};
  for (const [k, make, sel, show, on] of [['frame', 'window.addFrameBlock()', '.frame-block:not([data-text-frame])', 'showFrameProperties', '#ss-stroke-on'], ['modal', 'window.addModalBlock()', '.modal-block', 'showModalProperties', '#mdl-stroke-on'], ['asset', 'window.addAssetBlock()', '.asset-block', 'showAssetProperties', '#asset-stroke-on'], ['shape', "window.addShapeBlock('rectangle')", '.shape-block', 'showShapeProperties', '#shape-stroke-on']]) {
    await openNew(page, make, sel, show);
    if (!(await page.locator(on).isChecked())) await page.click(`#panel-right label:has(${on})`);
    out[k] = await page.evaluate(() => { const s = document.querySelector('#panel-right .prop-section[data-sec="stroke"]'); return [s, ...s.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth && e.clientWidth > 0 && !e.closest('[hidden]')).map((e) => `${String(e.className).slice(0, 30)}:${e.scrollWidth}>${e.clientWidth}`); });
  }
  console.log('[S11d 실측]', JSON.stringify(out));
  expect(out, '★잘림 0').toEqual({ frame: [], modal: [], asset: [], shape: [] });
  expect(errs, errs.join(' | ')).toEqual([]);
});
