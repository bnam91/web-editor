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
