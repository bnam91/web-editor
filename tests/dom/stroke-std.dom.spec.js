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
  const ui = await page.evaluate(() => { const u = document.querySelector('#panel-right .prop-section[data-sec="stroke"] .ui-stroke2[data-part="stroke"]'); return u && { fields: [...u.querySelectorAll('[data-field]')].map((e) => e.dataset.field), oldSlider: !!document.getElementById('shape-stroke-slider') }; });
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
