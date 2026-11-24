/* fill-std — 표준 Fill 절 부품(js/props/_fill-section.js · 현빈 261124 GO · 시트 0.9.14 DS-FILL-STD-SECTION-01 · 시안 8910 #mkp-fillstd) · F1 = 부품 + 첫 소비자(도형)
 * D1 도형 Fill = .ui-fill[data-part=fill] › .ui-fill-layer[data-fill-index="0"] 하나 · 옛 색 칸 id(shape-color-*) 그대로 · 눈 막힘(F6 전) · 머리 ＋ 없음 · 옛 «색상» 라벨 없음
 * D2 − = 칠 없음(shapeColor 'transparent' · 지디 (ㄱ)) · 선 색이 면 색을 따르던 도형 = 선 색을 박음(선이 같이 안 사라짐) · 패널 = «칠 없음» + 머리 ＋ · ⌘Z 한 칸 = 옛 색
 * D3 ＋ = 지난 색 · D4 [음성] 옛 알파 0 도형 = «켬·0%» · 내보내기 color 바이트 그대로(지디 단언)
 * 양성대조: _patches/fill-f1-CTL.patch(어댑터 none 이 shapeColor 를 안 씀) ⇒ D2 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, color) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (color) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addShapeBlock('rectangle'); const b = sec.querySelector('.shape-block'); b.id = b.id || 'shF'; if (color) { b.dataset.shapeColor = color; b.querySelector('svg').style.color = color; } window.selectBlock(b.id); window.showShapeProperties?.(b); window.clearHistory?.(); return b.id; }, color);
  await page.waitForSelector('#panel-right .prop-section[data-sec="fill"]', { state: 'attached' });
  return { errs, id };
}
const st = (page, id) => page.evaluate((id) => { const b = document.getElementById(id), f = document.querySelector('#panel-right .prop-section[data-sec="fill"]');
  return { color: b.dataset.shapeColor ?? null, svg: b.querySelector('svg')?.style.color ?? null, strokeKey: b.dataset.shapeStrokeColor ?? null,
    layers: f ? (f.querySelector('.ui-fill[data-part="fill"]')?.querySelectorAll(':scope > .ui-fill-layer[data-fill-index="0"]').length ?? 0) : -1, empty: !!f?.querySelector('.ui-fill[data-empty="1"]'),
    add: !!document.getElementById('shape-fill-add'), hex: document.getElementById('shape-color-hex')?.value ?? null, alpha: document.getElementById('shape-color-alpha')?.value ?? null }; }, id);

test('D1 도형 Fill = 표준 부품 · 겹 줄 하나 · 옛 id · 눈 산다(F6-1b) · 머리 ＋ 없음', async ({ page }) => {
  const { errs, id } = await scene(page);
  const ui = await page.evaluate(() => { const f = document.querySelector('#panel-right .prop-section[data-sec="fill"]'); const eye = document.getElementById('shape-fill-eye');
    return { ids: ['shape-color-color', 'shape-color-hex', 'shape-color-alpha', 'shape-fill-remove'].every((i) => f.contains(document.getElementById(i))), eye: eye?.getAttribute('aria-disabled'), why: !!eye?.title,
      oldLabel: [...f.querySelectorAll('.prop-label')].some((l) => l.textContent.trim() === '색상') }; });
  const s = await st(page, id);
  expect([s.layers, s.empty, s.add], '★겹 줄 하나 · 칠 있음 · 머리 ＋ 없음').toEqual([1, false, false]);
  /* ★기대 바뀜(F6-1b · 지디 (가) 261124): 옛 «눈 = 막힘(aria-disabled · 까닭 툴팁)» → 눈 산다(막힘 속성·까닭 없음) — 뒤집히면 F6-1b 와 이 줄을 같이 되돌림 */
  expect(ui, '★옛 색 칸 id 그대로 · 눈 = 산다 · 옛 «색상» 라벨 없음').toEqual({ ids: true, eye: null, why: false, oldLabel: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D2·D3 − = 칠 없음(transparent · 선 색 박음) · ⌘Z 한 칸 · ＋ = 지난 색', async ({ page }) => {
  const { errs, id } = await scene(page, '#ff0000');
  const s0 = await st(page, id);
  await page.click('#shape-fill-remove'); await raf(page);
  const s1 = await st(page, id);
  console.log('[D2 실측]', JSON.stringify({ s0, s1 }));
  expect([s1.color, s1.svg, s1.layers, s1.empty, s1.add], '★− = shapeColor transparent · svg 색 투명 · 패널 «칠 없음» + 머리 ＋').toEqual(['transparent', 'transparent', 0, true, true]);
  expect(s1.strokeKey, '★선 색이 면 색을 따르던 도형 = 지운 색을 선 색으로 박음(선이 같이 안 사라짐)').toBe(s0.strokeKey ?? '#ff0000');
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page);
  const s2 = await page.evaluate((id) => document.getElementById(id)?.dataset.shapeColor ?? null, id);
  expect(s2, '★⌘Z 한 칸 = 지우기 전 색').toBe('#ff0000');
  await page.keyboard.press('Meta+Shift+z'); await raf(page);
  await page.evaluate((id) => { const b = document.getElementById(id); window.selectBlock(id); window.showShapeProperties?.(b); }, id);
  await page.click('#shape-fill-add'); await raf(page);
  const s3 = await st(page, id);
  expect([s3.color, s3.layers, s3.add, s3.hex], '★＋ = 지난 색(#ff0000) · 겹 줄 돌아옴 · 머리 ＋ 사라짐').toEqual(['#ff0000', 1, false, 'FF0000']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D4 [음성] 옛 알파 0 도형 = «켬·0%» · 내보내기 color 바이트 그대로', async ({ page }) => {
  const { errs, id } = await scene(page, 'rgba(255, 0, 0, 0)');
  const s = await st(page, id);
  const out = await page.evaluate((id) => { const j = window.buildFigmaExportJSON(null); let hit = null; (function walk(o) { if (!o || typeof o !== 'object' || hit) return; if (o.type === 'shape' && o.id === id) { hit = o; return; } Object.values(o).forEach(walk); })(j); return hit && hit.color; }, id);
  expect([s.layers, s.empty, s.alpha], '★알파 0 = 칠 켬 · 0%(«칠 없음» 아님)').toEqual([1, false, '0']);
  expect(out, '★내보내기 color = 저장값 그대로').toBe('rgba(255, 0, 0, 0)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F2-1 — 단색 블럭 묶음(프레임·모달·인너카드·브릿지) · 없음 = 그 블럭 색 키 'transparent'(도형 (ㄱ)과 같은 결 · 각 블럭 색 검사가 이미 받는 값) · 옛 id 그대로
 * D5 − = 키 transparent · 패널 «칠 없음» + 머리 ＋ · ⌘Z 한 칸 = 옛 색 · ＋ = 지난 색 · D6 새 프레임 = 칠 켬(#EFEFEF · 실측 — block-factory 의 bg transparent 는 텍스트 프레임만) · 저장 bg transparent = 칠 없음 · 알파 0 rgba 프레임 = 켬·0%
 * 양성대조: _patches/fill-f2-1-CTL.patch(프레임 어댑터 none 이 bg 를 안 씀) ⇒ D5 frame 빨강 */
const F2 = {
  frame:     { make: 'window.addFrameBlock()', sel: '.frame-block:not([data-text-frame])', show: 'showFrameProperties', p: 'ss-fill', hex: 'ss-bg-hex', key: 'bg', seed: '#ff0000' },
  modal:     { make: 'window.addModalBlock()', sel: '.modal-block', show: 'showModalProperties', p: 'mdl-fill', hex: 'mdl-bg-hex', key: 'bg', seed: '#ff0000' },
  innercard: { make: 'window.addInnerCardBlock()', sel: '.innercard-block', show: 'showInnerCardProperties', p: 'icd-fill', hex: 'icd-bg-hex', key: 'bg', seed: '#ff0000' },
  bridge:    { make: 'window.addBridgeBlock()', sel: '.bridge-block', show: 'showBridgeProperties', p: 'brg-fill', hex: 'brg-hex', key: 'bridgeColor', seed: '#ff0000' },
};
async function scene2(page, K, seed) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async ([make, sel, show, key, seed]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make); const b = sec.querySelector(sel); b.id = b.id || 'f2B'; if (seed) { b.dataset[key] = seed; if (key === 'bg' && b.classList.contains('frame-block')) { b.style.backgroundColor = seed; } window.renderModalBlock?.(b); window.renderInnerCardBlock?.(b); } window.selectBlock?.(b.id); window[show](b); window.clearHistory?.(); return b.id; }, [K.make, K.sel, K.show, K.key, seed]);
  await page.waitForSelector('#panel-right .prop-section[data-sec="fill"] [data-part="fill"]', { state: 'attached' });
  return { errs, id };
}
const st2 = (page, id, K) => page.evaluate(([id, key, p, hex]) => { const b = document.getElementById(id), f = document.querySelector('#panel-right .prop-section[data-sec="fill"]');
  return { v: b.dataset[key] ?? null, layers: f ? (f.querySelector('.ui-fill[data-part="fill"]')?.querySelectorAll(':scope > .ui-fill-layer[data-fill-index="0"]').length ?? 0) : -1, add: !!document.getElementById(`${p}-add`), hex: document.getElementById(hex)?.value ?? null }; }, [id, K.key, K.p, K.hex]);
for (const [kind, K] of Object.entries(F2)) {
  test(`D5 ${kind} — − = ${K.key} transparent · ⌘Z 한 칸 · ＋ = 지난 색 · 옛 id`, async ({ page }) => {
    const { errs, id } = await scene2(page, K, K.seed);
    const s0 = await st2(page, id, K);
    expect([s0.layers, s0.add, s0.hex], '[전제] 칠 있음 · 옛 색 칸 id(HEX) 그대로').toEqual([1, false, 'FF0000']);
    await page.click(`#${K.p}-remove`); await raf(page);
    const s1 = await st2(page, id, K);
    expect([s1.v, s1.layers, s1.add], '★− = 키 transparent · «칠 없음» · 머리 ＋').toEqual(['transparent', 0, true]);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page);
    const v2 = await page.evaluate(([id, key]) => document.getElementById(id)?.dataset[key] ?? null, [id, K.key]);
    expect(v2, '★⌘Z 한 칸 = 지우기 전 색').toBe('#ff0000');
    await page.keyboard.press('Meta+Shift+z'); await raf(page);
    await page.evaluate(([id, show]) => { const b = document.getElementById(id); window.selectBlock?.(id); window[show](b); }, [id, K.show]);
    await page.click(`#${K.p}-add`); await raf(page);
    const s3 = await st2(page, id, K);
    expect([s3.v, s3.layers, s3.add], '★＋ = 지난 색 · 겹 줄 돌아옴').toEqual(['#ff0000', 1, false]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('D6 새 프레임 = 칠 켬 · 저장 bg transparent = 칠 없음 · 알파 0 rgba 프레임 = 켬·0%', async ({ page }) => {
  const K = F2.frame;
  const { errs, id } = await scene2(page, K, null);
  const s0 = await st2(page, id, K);
  expect([s0.v, s0.layers, s0.add], '[전제] 새 프레임 = 칠 켬(#EFEFEF · 머리 ＋ 없음)').toEqual(['#EFEFEF', 1, false]);
  await page.evaluate(([id, show]) => { const b = document.getElementById(id); b.dataset.bg = 'transparent'; b.style.backgroundColor = 'transparent'; window[show](b); }, [id, K.show]);
  const sT = await st2(page, id, K);
  expect([sT.layers, sT.add], '★저장 bg transparent(옛 프레임 · 텍스트 프레임 기본 값) = «칠 없음» + 머리 ＋').toEqual([0, true]);
  await page.evaluate(([id, show]) => { const b = document.getElementById(id); b.dataset.bg = 'rgba(255, 0, 0, 0)'; b.style.backgroundColor = 'rgba(255, 0, 0, 0)'; window[show](b); }, [id, K.show]);
  const s1 = await st2(page, id, K);
  const a1 = await page.evaluate(() => document.getElementById('ss-bg-alpha')?.value ?? null);
  expect([s1.layers, s1.add, a1, s1.v], '★알파 0 = 켬·0% · 키 바이트 그대로').toEqual([1, false, '0', 'rgba(255, 0, 0, 0)']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F2-2 — 에셋(없음 = bgColor 'transparent' · 지디 (ㄴ) 261124 · 키 없음 = 옛 그대로 «켬·A0A0A0») · 레이어 캔버스 canvas(prop-canvas · 없음 = 'transparent' = 옛 기본 · ★심플카드는 prop-simple-card = F5) · banner02(없음 = 'transparent') · 옛 id 그대로
 * D7 − = 그 «없음» · 패널 «칠 없음» + 머리 ＋ · ⌘Z 한 칸 = 옛 색 · ＋ = 지난 색 · D8 새 에셋(키 없음) = 옛 그대로 «켬·A0A0A0»((ㄴ) · 바이트 무변) · 체커 줄 = 슬롯 ·  새 레이어 캔버스 = «칠 없음»
 * 양성대조: _patches/fill-f2-2-CTL.patch(에셋 어댑터 none 이 키를 안 지움) ⇒ D7 asset 빨강 */
const F22 = {
  asset:    { make: 'window.addAssetBlock()', sel: '.asset-block', show: 'showAssetProperties', p: 'asset-fill', hex: 'asset-bg-hex', key: 'bgColor', none: 'transparent' },
  canvas:   { make: "window.addCanvasBlock({ layers: [{ type: 'image', src: '', x: 0, y: 0, w: 300, h: 200 }] })", sel: '.canvas-block', show: 'showCanvasProperties', p: 'cvb-fill', hex: 'cvb-bg-hex', key: 'bg', none: 'transparent' },
  banner02: { make: 'window.addBanner02Block()', sel: '.banner02-block', show: 'showBanner02Properties', p: 'bn2-fill', hex: 'bn2-bg-hex', key: 'bg', none: 'transparent' },
};
for (const [kind, K] of Object.entries(F22)) {
  test(`D7 ${kind} — − = ${K.none === null ? `${K.key} 키 지움` : `${K.key} transparent`} · ⌘Z 한 칸 · ＋ = 지난 색 · 옛 id`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    const id = await page.evaluate(async ([make, sel, show, key]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make); const b = [...sec.querySelectorAll(sel)].pop(); b.id = b.id || 'f22B'; b.dataset[key] = '#ff0000'; if (key === 'bgColor') b.style.backgroundColor = '#ff0000'; if (b.classList.contains('canvas-block')) window.renderCanvas(b); if (b.classList.contains('banner02-block')) window.renderBanner02(b); window.selectBlock?.(b.id);   window[show](b); window.clearHistory?.(); return b.id; }, [K.make, K.sel, K.show, K.key]);
    await page.waitForSelector('#panel-right .prop-section[data-sec="fill"] [data-part="fill"]', { state: 'attached' });
    const s0 = await st2(page, id, K);
    expect([s0.layers, s0.add, s0.hex], '[전제] 칠 있음 · 옛 색 칸 id(HEX) 그대로').toEqual([1, false, 'FF0000']);
    await page.click(`#${K.p}-remove`); await raf(page);
    const s1 = await st2(page, id, K);
    expect([s1.v, s1.layers, s1.add], '★− = 그 블럭 «없음» · «칠 없음» · 머리 ＋').toEqual([K.none, 0, true]);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page);
    await expect.poll(() => page.evaluate(([id, key]) => document.getElementById(id)?.dataset[key] ?? null, [id, K.key]), { message: '★⌘Z 한 칸 = 지우기 전 색(캔버스 되돌리기는 두 프레임보다 늦게 옴 · 실측 = 300ms 안)' }).toBe('#ff0000');
    await page.keyboard.press('Meta+Shift+z'); await expect.poll(() => page.evaluate(([id, key]) => document.getElementById(id)?.dataset[key] ?? null, [id, K.key])).toBe(K.none);
    await page.evaluate(([id, show]) => { const b = document.getElementById(id); window.selectBlock?.(id); window[show](b); }, [id, K.show]);
    await page.click(`#${K.p}-add`); await raf(page);
    const s3 = await st2(page, id, K);
    expect([s3.v, s3.layers, s3.add], '★＋ = 지난 색 · 겹 줄 돌아옴').toEqual(['#ff0000', 1, false]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('D8 새 에셋(키 없음) = 옛 그대로 켬·A0A0A0 · 체커 줄 = 슬롯 · 새 레이어 캔버스 = «칠 없음»', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const out = {};
  for (const [kind, K] of [['asset', F22.asset], ['canvas', F22.canvas]]) {
    const id = await page.evaluate(async ([make, sel, show]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make); const b = [...sec.querySelectorAll(sel)].pop(); b.id = b.id || 'f22N'; window.selectBlock?.(b.id); window[show](b); return b.id; }, [K.make, K.sel, K.show]);
    const s = await st2(page, id, K);
    out[kind] = [s.v, s.layers, s.add];
  }
  // ★기대 바뀜(74행 ASSET-BG-NOKEY-FALSE-ON-DISPLAY-01 · 지디 261125): 키 없음 = 캔버스 체커(칠 없음)라 패널도 «칠 없음» + 머리 ＋(옛 기대 «켬·A0A0A0» = 거짓 표시) · 값 검사 = D39
  expect(out.asset, '★새 에셋 = 키 없음 · «칠 없음» + 머리 ＋(캔버스 체커와 같음)').toEqual([null, 0, true]);
  expect(out.canvas, '★새 레이어 캔버스 = bg transparent(옛 기본) · «칠 없음» + 머리 ＋').toEqual(['transparent', 0, true]);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addAssetBlock(); const b = [...sec.querySelectorAll('.asset-block')].pop(); window.selectBlock?.(b.id); window.showAssetProperties(b); });
  const slot = await page.evaluate(() => !!document.querySelector('#panel-right .prop-section[data-sec="fill"] .ui-fill-slot[data-slot="below"][data-slot-kind="checker"] #asset-checker-tone-on'));
  expect(slot, '★체커 어둡게 = 슬롯(data-slot-kind=checker) · 옛 id 그대로').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F2-3 — 방사형 radial(없음 = bg '' = 옛 «배경 지우기 (투명)» 값 · 옛 기본) · 확대 zoom(없음 = fill 'checker' = 옛 «체크패턴» 라디오 값 · 옛 기본) · 부위 색(점·칸·가운데·라벨 / 글자) 그대로
 * D9 − = 그 «없음» · «칠 없음» + 머리 ＋ · ⌘Z 한 칸 = 옛 색 · ＋ = 지난 색 · D10 새 radial·zoom = «칠 없음»(옛 기본값 그대로) · 옛 «배경 지우기» 단추·체크패턴 라디오 없음
 * 양성대조: _patches/fill-f2-3-CTL.patch(zoom 어댑터 none 이 fill 을 안 씀) ⇒ D9 zoom 빨강 */
const F23 = {
  radial: { make: 'window.addRadialBlock()', sel: '.radial-block', show: 'showRadialProperties', p: 'rdl-fill', hex: 'rdl-bg-hex', key: 'bg', none: '', fresh: '' },
  zoom:   { make: 'window.addZoomBlock()', sel: '.zoom-block', show: 'showZoomProperties', p: 'zm-fillstd', hex: 'zm-fill-hex', key: 'fill', none: 'checker', fresh: 'checker' },
};
const mk23 = (page, K, seed) => page.evaluate(async ([make, sel, show, key, seed]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make); const b = [...sec.querySelectorAll(sel)].pop(); b.id = b.id || 'f23B'; if (seed) { b.dataset[key] = seed; if (b.classList.contains('radial-block')) window.renderRadialBlock(b); else window.renderZoomBlock(b); } window.selectBlock?.(b.id); window[show](b); window.clearHistory?.(); return b.id; }, [K.make, K.sel, K.show, K.key, seed]);
for (const [kind, K] of Object.entries(F23)) {
  test(`D9 ${kind} — − = ${K.key} ${JSON.stringify(K.none)} · ⌘Z 한 칸 · ＋ = 지난 색 · 옛 id`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    const id = await mk23(page, K, '#ff0000');
    await page.waitForSelector('#panel-right .prop-section[data-sec="fill"] [data-part="fill"]', { state: 'attached' });
    const s0 = await st2(page, id, K);
    expect([s0.layers, s0.add, s0.hex], '[전제] 칠 있음 · 옛 색 칸 id(HEX) 그대로').toEqual([1, false, 'FF0000']);
    await page.click(`#${K.p}-remove`); await raf(page);
    const s1 = await st2(page, id, K);
    expect([s1.v, s1.layers, s1.add], '★− = 그 블럭 «없음» · «칠 없음» · 머리 ＋').toEqual([K.none, 0, true]);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
    await expect.poll(() => page.evaluate(([id, key]) => document.getElementById(id)?.dataset[key] ?? null, [id, K.key]), { message: '★⌘Z 한 칸 = 지우기 전 색' }).toBe('#ff0000');
    await page.keyboard.press('Meta+Shift+z'); await expect.poll(() => page.evaluate(([id, key]) => document.getElementById(id)?.dataset[key] ?? null, [id, K.key])).toBe(K.none);
    await page.evaluate(([id, show]) => { const b = document.getElementById(id); window.selectBlock?.(id); window[show](b); }, [id, K.show]);
    await page.click(`#${K.p}-add`); await raf(page);
    const s3 = await st2(page, id, K);
    expect([s3.v, s3.layers, s3.add], '★＋ = 지난 색 · 겹 줄 돌아옴').toEqual(['#ff0000', 1, false]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('D10 새 radial·zoom = «칠 없음»(옛 기본값) · 옛 «배경 지우기» 단추·체크패턴 라디오 없음', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const out = {};
  for (const [kind, K] of Object.entries(F23)) {
    const id = await mk23(page, K, null);
    const s = await st2(page, id, K);
    out[kind] = [s.v ?? '', s.layers, s.add, await page.evaluate(() => !!document.querySelector('#rdl-bg-clear, input[name="zm-bg"]'))];
  }
  expect(out, '★새 블럭 = 옛 기본(radial bg 없음 · zoom checker) = «칠 없음» + 머리 ＋ · 옛 단추·라디오 0').toEqual({ radial: ['', 0, true, false], zoom: ['checker', 0, true, false] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F3ⓐ — 그라데이션 블럭 Fill = 표준 겹 줄(이름칸 Linear/Radial · 견본 = goya-cp 그라데이션 탭만 · − 막힘) + 옛 정지점 바·목록 = 슬롯(옛 id)
 * D11 탭 방출(goya-cp:gradient) → 정지점 키 gradStops · 종류 · 방향 = 가까운 프리셋(지디 (가) · 100° → «to right») · 견본 툴팁에 맞춘 이름·각도(조용히 안 바뀜) · commit = ⌘Z 한 칸
 * D12 옛 손잡이(종류 select)를 바꾸면 견본 이름칸·시드가 따라온다 · − 막힘(까닭) · 단색/이미지 탭 막힘 표식(cpModes)
 * 양성대조: _patches/fill-f3-CTL.patch(탭 방출이 방향을 안 맞춤) ⇒ D11 빨강 */
async function gradScene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); const b = window.addGradientBlock(); const el = (b && b.id && document.getElementById(b.id)) || [...document.querySelectorAll('.gradient-block')].pop(); window.selectBlock?.(el.id); window.showGradientProperties(el); window.clearHistory?.(); return el.id; });
  await page.waitForSelector('#panel-right .prop-section[data-sec="fill"] [data-part="fill"]', { state: 'attached' });
  return { errs, id };
}
test('D11 그라데이션 블럭 — 탭 방출 → 정지점·종류·방향(가까운 프리셋) · 툴팁 = 맞춘 이름 · ⌘Z 한 칸', async ({ page }) => {
  const { errs, id } = await gradScene(page);
  const g0 = await page.evaluate((id) => ({ ds: { ...document.getElementById(id).dataset }, name: document.getElementById('grad-fill-hex')?.value, ro: document.getElementById('grad-fill-hex')?.dataset.fillKind, modes: document.getElementById('grad-fill-color')?.dataset.cpModes, slot: !!document.querySelector('[data-slot-kind="gradient-stops"] #grad-stops-bar') }), id);
  expect([g0.name, g0.ro, g0.modes, g0.slot], '[전제] 이름칸 Linear(종류 표식 · 포커스 = HEX) · 탭 = 그라데이션만 · 옛 정지점 바 = 슬롯').toEqual(['Linear', 'linear', 'gradient', true]);
  await page.evaluate(() => { const i = document.getElementById('grad-fill-color'); const detail = { type: 'linear', angle: 100, stops: [{ color: '#ff0000', offset: 0, opacity: 1 }, { color: '#0000ff', offset: 1, opacity: 0.5 }], commit: true };
    i.dispatchEvent(new CustomEvent('goya-cp:gradient', { bubbles: true, detail })); i.dispatchEvent(new CustomEvent('goya-cp:gradient-commit', { bubbles: true, detail })); });
  const g1 = await page.evaluate((id) => { const b = document.getElementById(id); return { dir: b.dataset.gradDirection, style: b.dataset.gradStyle, stops: JSON.parse(b.dataset.gradStops || '[]'), sel: document.getElementById('grad-direction')?.value, tip: document.getElementById('grad-fill-color')?.closest('.prop-color-swatch')?.title || '' }; }, id);
  expect([g1.dir, g1.style, g1.sel], '★100° → 가까운 프리셋 «to right»(키 gradDirection 그대로) · 방향 select 도').toEqual(['to right', 'linear', 'to right']);
  expect(g1.stops, '★정지점 = 탭 값(키 gradStops · alpha = opacity)').toEqual([{ color: '#ff0000', alpha: 1, offset: 0 }, { color: '#0000ff', alpha: 0.5, offset: 1 }]);
  expect(g1.tip, '★툴팁 = 맞춘 방향 이름 + 탭 각도(조용히 안 바뀜)').toMatch(/좌→우.*100°/);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.dataset.gradDirection ?? null, id), { message: '★⌘Z 한 칸 = 옛 방향' }).toBe(g0.ds.gradDirection ?? null);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('D12 옛 종류 select → 이름칸·시드 따라옴 · − 막힘(까닭)', async ({ page }) => {
  const { errs, id } = await gradScene(page);
  await page.selectOption('#grad-style', 'radial');
  const r = await page.evaluate(() => ({ name: document.getElementById('grad-fill-hex')?.value, seed: JSON.parse(document.getElementById('grad-fill-color')?.dataset.cpGradient || '{}').type, rm: document.getElementById('grad-fill-remove')?.getAttribute('aria-disabled'), why: document.getElementById('grad-fill-remove')?.title || '' }));
  expect([r.name, r.seed], '★종류 select = Radial → 이름칸·탭 시드 Radial').toEqual(['Radial', 'radial']);
  expect([r.rm, /지울 수 없/.test(r.why)], '★− 막힘 + 까닭').toEqual(['true', true]);
  await page.click('#grad-fill-remove', { force: true });
  expect(await page.evaluate((id) => !!document.getElementById(id)?.dataset.gradStops || !!document.getElementById(id)?.dataset.gradStart, id), '★막힌 − = 칠 그대로').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F4 — 텍스트류 Fill(이름 «Fill» = 글자색 · 현빈 GO 261124) = 공용 빌더 buildFillSectionHtml 한 곳 → 표준 겹 줄(옛 색 칸 id txt-color/-hex/-alpha 그대로 · 이름 = 칸 aria-label «글자색» · 눈·− 막힘)
 * D13 텍스트 패널 Fill = 부품 · 겹 줄 하나 · 옛 id · 옛 «글자색» 라벨 줄 없음 · 눈·− 막힘(까닭) · 글자색 칸 입력 = 옛 배선 그대로 글자에 칠함 */
test('D13 텍스트 Fill = 표준 겹 줄 · 옛 id · 눈·− 막힘 · 글자색 칸 = 옛 배선', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addTextBlock('body'); const b = [...sec.querySelectorAll('.text-block')].pop(); b.id = b.id || 'txtF'; window.selectBlock?.(b.id); window.showTextProperties?.(b); return b.id; });
  await page.waitForSelector('#panel-right .prop-section[data-sec="fill"] [data-part="fill"]', { state: 'attached' });
  const ui = await page.evaluate(() => { const f = document.querySelector('#panel-right .prop-section[data-sec="fill"]'); const ok = (i) => !!f.querySelector('.ui-fill-layer[data-fill-index="0"] #' + i);
    return { layers: f.querySelectorAll('.ui-fill-layer').length, ids: ['txt-color', 'txt-color-hex', 'txt-color-alpha'].every(ok), aria: document.getElementById('txt-color')?.getAttribute('aria-label'),
      oldLabel: [...f.querySelectorAll('.prop-label')].some((l) => l.textContent.trim() === '글자색'), eye: document.getElementById('txt-fill-eye')?.getAttribute('aria-disabled'), rm: document.getElementById('txt-fill-remove')?.getAttribute('aria-disabled') }; });
  expect(ui, '★겹 줄 하나 · 옛 id · 이름 = aria «글자색» · 옛 라벨 줄 없음 · 눈·− 막힘').toEqual({ layers: 1, ids: true, aria: '글자색', oldLabel: false, eye: 'true', rm: 'true' });
  await page.fill('#txt-color-hex', 'FF0000'); await page.locator('#txt-color-hex').press('Enter'); await raf(page);
  const col = await page.evaluate((id) => { const b = document.getElementById(id); const t = b.querySelector('[class^="tb-"]') || b; return getComputedStyle(t).color; }, id);
  expect(col, '★글자색 칸 = 옛 배선 그대로 글자에 칠함').toBe('rgb(255, 0, 0)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F4 나머지 — 글자 그라데이션 이름칸(Linear/Radial · 읽기 전용 · 단색 복귀 = HEX) · 태그 배경 = Fill 슬롯(tag-bg · id 무변) · − 막힘 까닭 = 사실(지디 (가))
 * D14 텍스트 그라데이션(goya-cp:gradient) → 이름칸 «Linear»(패널 다시 열어도) · 라벨 = tag-bg 슬롯 안 label-bg-* · − 까닭 «지금은 못 지워요»
 * 양성대조: _patches/fill-f4b-CTL.patch(_syncGradUi 이름칸 줄 뺌) ⇒ D14 빨강 */
test('D14 글자 그라데이션 이름칸 · 태그 배경 슬롯 · − 까닭', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addTextBlock('body'); const b = [...sec.querySelectorAll('.text-block')].pop(); window.selectBlock?.(b.id); window.showTextProperties?.(b); return b.id; });
  await page.waitForSelector('#txt-color', { state: 'attached' });
  expect(await page.evaluate(() => document.getElementById('txt-fill-remove')?.title), '★− 막힘 까닭 = 사실(약속 아님)').toBe('글자가 안 보이게 되는 길이라 지금은 못 지워요');
  await page.evaluate(() => { const i = document.getElementById('txt-color'); const detail = { css: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)', type: 'linear', angle: 90, stops: [{ color: '#ff0000', offset: 0, opacity: 1 }, { color: '#0000ff', offset: 1, opacity: 1 }], commit: true };
    i.dispatchEvent(new CustomEvent('goya-cp:gradient', { bubbles: true, detail })); i.dispatchEvent(new CustomEvent('goya-cp:gradient-commit', { bubbles: true, detail })); });
  const g = await page.evaluate(() => { const h = document.getElementById('txt-color-hex'); return [h.value, h.dataset.fillKind]; });
  expect(g, '★글자 그라데이션 = 이름칸 «Linear»(종류 표식)').toEqual(['Linear', 'linear']);
  await page.evaluate((id) => { const b = document.getElementById(id); window.selectBlock?.(id); window.showTextProperties?.(b); }, id);
  const g2 = await page.evaluate(() => { const h = document.getElementById('txt-color-hex'); return [h.value, h.dataset.fillKind]; });
  expect(g2, '★패널 다시 열어도 «Linear»').toEqual(['Linear', 'linear']);
  const lid = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addTextBlock('label'); const b = [...sec.querySelectorAll('.text-block')].pop(); window.selectBlock?.(b.id); window.showTextProperties?.(b); return b.id; });
  await page.waitForSelector('#label-bg-color', { state: 'attached' });
  const slot = await page.evaluate(() => ['label-bg-color', 'label-bg-hex', 'label-bg-none'].every((i) => !!document.querySelector('#panel-right .prop-section[data-sec="fill"] .ui-fill-slot[data-slot="below"][data-slot-kind="tag-bg"] #' + i)));
  expect(slot, '★태그 배경 = Fill 슬롯(tag-bg) 안 · 옛 id 셋 그대로').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* D15 이름칸 = 읽기 전용 아님(text-gradient G6 옛 길) — 포커스 = 첫 정지점 HEX · 안 치고 나가면 «Linear» · HEX 치면 단색(이름 표식 걷힘) */
test('D15 그라데이션 이름칸 포커스 = HEX · 나가면 이름 · HEX 치면 단색', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addTextBlock('body'); const b = [...sec.querySelectorAll('.text-block')].pop(); window.selectBlock?.(b.id); window.showTextProperties?.(b); });
  await page.waitForSelector('#txt-color', { state: 'attached' });
  await page.evaluate(() => { const i = document.getElementById('txt-color'); const detail = { css: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)', type: 'linear', angle: 90, stops: [{ color: '#ff0000', offset: 0, opacity: 1 }, { color: '#0000ff', offset: 1, opacity: 1 }], commit: true };
    i.dispatchEvent(new CustomEvent('goya-cp:gradient', { bubbles: true, detail })); i.dispatchEvent(new CustomEvent('goya-cp:gradient-commit', { bubbles: true, detail })); });
  await page.focus('#txt-color-hex');
  const onFocus = await page.evaluate(() => document.getElementById('txt-color-hex').value);
  await page.evaluate(() => document.activeElement?.blur?.());
  const onBlur = await page.evaluate(() => document.getElementById('txt-color-hex').value);
  expect([onFocus, onBlur], '★포커스 = 첫 정지점 HEX · 나가면 «Linear»').toEqual(['FF0000', 'Linear']);
  await page.fill('#txt-color-hex', '112233'); await page.locator('#txt-color-hex').press('Enter');
  const after = await page.evaluate(() => { const h = document.getElementById('txt-color-hex'); return [h.value, h.dataset.fillKind ?? null]; });
  expect(after, '★HEX 치면 단색 · 이름 표식 걷힘').toEqual(['112233', null]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F5-1 — 쿠폰(본체 = 표준 · 없음 'transparent' · 스텁 = 부위 색) · 스텝(카드 꼴일 때 카드 배경 = 표준 · 없음 'transparent' · 배지·제목·설명 = 부위 색) · 월계수(일괄 색 = 표준 · − 막힘 = 잎이 안 보임 · «일괄 채움» 프리셋 = 슬롯)
 * D16 쿠폰·스텝 − = 키 transparent · ⌘Z 한 칸 · ＋ = 지난 색 · 월계수 − 막힘(까닭) · 프리셋 select = 슬롯(leaf-fill-preset) 안
 * 양성대조: _patches/fill-f5-1-CTL.patch(쿠폰 어댑터 none 이 bodyCol 을 안 씀) ⇒ D16 coupon 빨강 */
const F51 = {
  coupon: { make: 'window.addCouponBlock()', sel: '.coupon-block', show: 'showCouponProperties', p: 'cpn-fill', hex: 'cpn-body-hex', key: 'bodyCol', none: 'transparent', pre: {} },
  step:   { make: 'window.addStepBlock()', sel: '.step-block', show: 'showStepProperties', p: 'stb-fill', hex: 'stb-card-bg-hex', key: 'stepCardBg', none: 'transparent', pre: { stepStyle: 'card' } },
};
for (const [kind, K] of Object.entries(F51)) {
  test(`D16 ${kind} — − = ${K.key} transparent · ⌘Z 한 칸 · ＋ = 지난 색 · 옛 id`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    const id = await page.evaluate(async ([make, sel, show, key, pre]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make); const b = [...sec.querySelectorAll(sel)].pop(); b.id = b.id || 'f51B'; Object.assign(b.dataset, pre); b.dataset[key] = '#ff0000'; window.selectBlock?.(b.id); window[show](b); window.clearHistory?.(); return b.id; }, [K.make, K.sel, K.show, K.key, K.pre]);
    await page.waitForSelector('#panel-right .prop-section[data-sec="fill"] [data-part="fill"]', { state: 'attached' });
    const s0 = await st2(page, id, K);
    expect([s0.layers, s0.add, s0.hex], '[전제] 칠 있음 · 옛 색 칸 id(HEX) 그대로').toEqual([1, false, 'FF0000']);
    await page.click(`#${K.p}-remove`); await raf(page);
    const s1 = await st2(page, id, K);
    expect([s1.v, s1.layers, s1.add], '★− = 키 transparent · «칠 없음» · 머리 ＋').toEqual([K.none, 0, true]);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
    await expect.poll(() => page.evaluate(([id, key]) => document.getElementById(id)?.dataset[key] ?? null, [id, K.key]), { message: '★⌘Z 한 칸 = 지우기 전 색' }).toBe('#ff0000');
    await page.keyboard.press('Meta+Shift+z'); await expect.poll(() => page.evaluate(([id, key]) => document.getElementById(id)?.dataset[key] ?? null, [id, K.key])).toBe(K.none);
    await page.evaluate(([id, show]) => { const b = document.getElementById(id); window.selectBlock?.(id); window[show](b); }, [id, K.show]);
    await page.click(`#${K.p}-add`); await raf(page);
    const s3 = await st2(page, id, K);
    expect([s3.v, s3.layers, s3.add], '★＋ = 지난 색 · 겹 줄 돌아옴').toEqual(['#ff0000', 1, false]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('D16 laurel — 일괄 색 = 표준 줄 · − 막힘(잎이 안 보임) · «일괄 채움» 프리셋 = 슬롯', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addLaurelBlock(); const b = [...sec.querySelectorAll('.laurel-block')].pop(); window.selectBlock?.(b.id); window.showLaurelProperties(b); });
  await page.waitForSelector('#lrl-all-leaf-color', { state: 'attached' });
  const r = await page.evaluate(() => ({ inLayer: !!document.querySelector('.ui-fill-layer #lrl-all-leaf-hex'), rm: document.getElementById('lrl-fill-remove')?.getAttribute('aria-disabled'), why: document.getElementById('lrl-fill-remove')?.title,
    preset: !!document.querySelector('.ui-fill-slot[data-slot-kind="leaf-fill-preset"] #lrl-all-fill') }));
  expect(r, '★일괄 색 = 겹 줄 · − 막힘 까닭 · 프리셋 = 슬롯').toEqual({ inLayer: true, rm: 'true', why: '잎이 안 보이게 되는 길이라 지금은 못 지워요', preset: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F5-1b — iconify: 아이콘 색 = 표준 줄(− 막힘 = 아이콘이 안 보임) · «채움/선»(Material Symbols) = 슬롯(ms-fill) · 이미지 아이콘 = 옛 까닭 줄(막힘)
 * D17 아이콘 색 = 겹 줄 · 옛 id icn-color-* · − 막힘 까닭 · «채움/선» 무리가 있으면 슬롯 안 */
test('D17 iconify — 아이콘 색 = 표준 줄 · − 막힘 · 채움/선 = 슬롯', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addIconifyBlock(); const b = [...sec.querySelectorAll('.icon-block')].pop(); window.selectBlock?.(b.id); window.showIconifyProperties(b); });
  await page.waitForSelector('#icn-color-color', { state: 'attached' });
  const r = await page.evaluate(() => { const g = document.getElementById('icn-ms-fill-group');
    return { inLayer: ['icn-color-color', 'icn-color-hex', 'icn-color-alpha'].every((i) => !!document.querySelector('.ui-fill-layer #' + i)), rm: document.getElementById('icn-fill-remove')?.getAttribute('aria-disabled'), why: document.getElementById('icn-fill-remove')?.title,
      msOk: !g || !!g.closest('.ui-fill-slot[data-slot-kind="ms-fill"]') }; });
  expect(r, '★아이콘 색 = 겹 줄 · − 막힘 까닭 · 채움/선 = 슬롯').toEqual({ inLayer: true, rm: 'true', why: '아이콘이 안 보이게 되는 길이라 지금은 못 지워요', msOk: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F5-2a — 그리드 블럭 배경: 켬/끔 정본 = 옛 토글(지디 (가) · Stroke 그리드와 같게 · 키 무변) · 배경색 = 표준 줄(옛 id grd-bbg-*) · − 막힘(까닭 = 토글로 끄기)
 * D18 토글 켬 → 블럭 배경 절 안 표준 겹 줄 · 옛 id 셋 · − 막힘 까닭 · 머리 ＋ 없음(토글이 정본)
 * 양성대조: _patches/fill-f5-2a-CTL.patch(옛 판 prop-grid.js) ⇒ D18 빨강 */
test('D18 그리드 블럭 배경 — 토글 정본 · 배경색 = 표준 줄 · − 막힘(토글로 끄기)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addGridBlock(); const g = [...sec.querySelectorAll('.grid-block')].pop(); window.selectBlock?.(g.id); window.showGridProperties?.(g); });
  await page.waitForSelector('#grd-bbg-section .prop-toggle', { state: 'attached' });
  await page.locator('#grd-bbg-section .prop-toggle').scrollIntoViewIfNeeded(); await page.click('#grd-bbg-section .prop-toggle');
  await page.waitForSelector('#grd-bbg-color', { state: 'attached' });
  const r = await page.evaluate(() => { const s = document.getElementById('grd-bbg-section');
    return { inLayer: ['grd-bbg-color', 'grd-bbg-hex', 'grd-bbg-alpha'].every((i) => !!s.querySelector('.ui-fill-layer #' + i)), rm: document.getElementById('grd-bbg-fill-remove')?.getAttribute('aria-disabled'),
      why: document.getElementById('grd-bbg-fill-remove')?.title, add: !!document.getElementById('grd-bbg-fill-add'), toggle: !!document.getElementById('grd-bbg-toggle')?.checked }; });
  expect(r, '★표준 줄 · 옛 id · − 막힘(토글로 끄기) · 머리 ＋ 없음 · 토글 켜짐').toEqual({ inLayer: true, rm: 'true', why: '블럭 배경 끄기 = 제목 옆 토글', add: false, toggle: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F5-2b — 스티커: 아이콘·형광펜·선 형광펜 색 = 표준 줄(− 막힘 · 사실) · 원/버스트 바탕 = 표준 줄(− 막힘 «바탕이 곧 모양») · 글 스티커 = 배경 표준 줄(− = 'transparent' · 옛 «알파 0» 값) + 글자색 = 부위 색
 * D19 글 스티커 − = bgColor transparent · ⌘Z 한 칸 · ＋ = 지난 색 · 다른 넷 = 막힘 까닭
 * 양성대조: _patches/fill-f5-2b-CTL.patch(글 스티커 − 가 bgColor 안 씀) ⇒ D19 text 빨강 */
test('D19 글 스티커 배경 − / ⌘Z / ＋ · 아이콘·형광펜·원 = − 막힘', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const mk = (shape, seed) => page.evaluate(async ([shape, seed]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addStickerBlock({ shape }); const b = [...document.querySelectorAll('.sticker-block')].pop(); if (seed) b.dataset.bgColor = seed; window.renderStickerBlock?.(b); window.selectBlock?.(b.id); window.showStickerProperties(b); window.clearHistory?.(); return b.id; }, [shape, seed]);
  const why = {};
  for (const [shape, p] of [['icon', 'stk-icon-fill'], ['highlight', 'stk-hl-fill'], ['highlightB', 'stk-hlb-fill'], ['circle', 'stk-bg-fill']]) {
    await mk(shape);
    why[shape] = await page.evaluate((p) => { const r = document.getElementById(p + '-remove'); return r ? [r.getAttribute('aria-disabled'), /지금은 못 지워요$/.test(r.title)] : null; }, p);
  }
  expect(why, '★아이콘·형광펜·선 형광펜·원 = − 막힘 + 사실 까닭').toEqual({ icon: ['true', true], highlight: ['true', true], highlightB: ['true', true], circle: ['true', true] });
  const id = await mk('text', '#ff0000');
  const K = { p: 'stk-t-fill', hex: 'stk-t-bg-hex', key: 'bgColor' };
  const s0 = await st2(page, id, K);
  expect([s0.layers, s0.add, s0.hex], '[전제] 글 스티커 배경 = 칠 있음 · 옛 id').toEqual([1, false, 'FF0000']);
  await page.click('#stk-t-fill-remove'); await raf(page);
  const s1 = await st2(page, id, K);
  expect([s1.v, s1.layers, s1.add], '★− = bgColor transparent · «칠 없음» · 머리 ＋').toEqual(['transparent', 0, true]);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.dataset.bgColor ?? null, id), { message: '★⌘Z 한 칸 = 지우기 전 색' }).toBe('#ff0000');
  await page.keyboard.press('Meta+Shift+z'); await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.dataset.bgColor ?? null, id)).toBe('transparent');
  await page.evaluate((id) => { const b = document.getElementById(id); window.selectBlock?.(id); window.showStickerProperties(b); }, id);
  await page.click('#stk-t-fill-add'); await raf(page);
  expect((await st2(page, id, K)).v, '★＋ = 지난 색').toBe('#ff0000');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F5-2c — 심플카드: 글 영역 배경(일괄) = 표준 줄(옛 «투명» 단추 = −/＋ · 같은 몸 setTextBgNone = 밝은 글자 자동 어둡게 그대로) · 어둠 그라데이션 = 슬롯(card-overlay) · 라벨 배경·제목·설명·아이콘 = 부위 색
 * D20 − = textBg transparent + 흰 제목 자동 어둡게(옛 몸) · ⌘Z 한 칸 · ＋ = 지난 색 · 슬롯 card-overlay 안 cvb-grad-op-row
 * 양성대조: _patches/fill-f5-2c-CTL.patch(− 어댑터가 몸을 안 부름) ⇒ D20 빨강 */
test('D20 심플카드 글 영역 배경 − / ⌘Z / ＋ · 옛 «투명» 몸 · 어둠 그라데이션 슬롯', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addCanvasBlock({ cardMode: 'simple' }); const b = [...sec.querySelectorAll('.canvas-block')].pop(); b.dataset.textBg = '#ff0000'; b.dataset.titleColor = '#ffffff'; window.renderCanvas?.(b); window.selectBlock?.(b.id); window.showSimpleCardProperties(b); window.clearHistory?.(); return b.id; });
  await page.waitForSelector('#cvb-textbg-hex', { state: 'attached' });
  const pre = await page.evaluate(() => ({ slot: !!document.querySelector('.ui-fill-slot[data-slot-kind="card-overlay"] #cvb-grad-op-row'), layer: !!document.querySelector('.ui-fill-layer #cvb-textbg-hex'), hex: document.getElementById('cvb-textbg-hex')?.value }));
  expect(pre, '[전제] 겹 줄 · 옛 id · 어둠 그라데이션 = 슬롯').toEqual({ slot: true, layer: true, hex: 'FF0000' });
  await page.click('#cvb-textbg-fill-remove'); await raf(page);
  const s1 = await page.evaluate((id) => { const b = document.getElementById(id); return { bg: b.dataset.textBg, title: b.dataset.titleColor, add: !!document.getElementById('cvb-textbg-fill-add') }; }, id);
  expect(s1, '★− = transparent · 흰 제목 자동 어둡게(옛 몸) · 머리 ＋').toEqual({ bg: 'transparent', title: '#222222', add: true });
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.dataset.textBg ?? null, id), { message: '★⌘Z 한 칸 = 지우기 전 색' }).toBe('#ff0000');
  await page.keyboard.press('Meta+Shift+z'); await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.dataset.textBg ?? null, id)).toBe('transparent');
  await page.evaluate((id) => { const b = document.getElementById(id); window.selectBlock?.(id); window.showSimpleCardProperties(b); }, id);
  await page.click('#cvb-textbg-fill-add'); await raf(page);
  const s3 = await page.evaluate((id) => { const b = document.getElementById(id); return { bg: b.dataset.textBg, title: b.dataset.titleColor }; }, id);
  expect(s3, '★＋ = 지난 색 · 제목 색 되돌림(옛 몸)').toEqual({ bg: '#ff0000', title: '#ffffff' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F5-3(현빈 «표준 줄 없이 부위 색만» · 구분선 = Special «Line» · Stroke 2-2 이사와 같게)
 * D21 구분선 — Fill 절 없음 · 색 칸(dvd-* 옛 id) = Special «Line» 첫 줄 · 색 바꾸면 lineColor 그대로 씀
 * D22 채팅·인포카드·그래프·비교표 — Fill 절 = 부위 색만(표준 부품 0 · 머리 ＋ 0) · 부위 색 칸 옛 id 그대로
 * 양성대조: 구분선 이사 전 판(e98cb4310)에서 D21 빨강 · D22 초록(넷은 손 0 = 지키는 칸) */
async function bootBlk(page, add, cls) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ({ add, cls }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec); await window[add]();
    window.__b = sec.querySelector('.' + cls); window.selectBlock(window.__b.id); }, { add, cls });
  await page.waitForSelector('#panel-right .prop-section', { state: 'attached' });
  return errs;
}
test('D21 구분선 — 색 = Special «Line» 첫 줄 · Fill 절 없음 · 색 쓰기 그대로', async ({ page }) => {
  const errs = await bootBlk(page, 'addDividerBlock', 'divider-block');
  const ui = await page.evaluate(() => { const sp = document.querySelector('#panel-right .prop-section[data-sec="special"]'); const first = sp?.querySelector('.prop-section-body, .prop-section-content')?.firstElementChild || sp?.querySelector('.prop-row, .prop-color-row');
    return { fill: !!document.querySelector('#panel-right .prop-section[data-sec="fill"]'), title: sp?.querySelector('.prop-section-title, .prop-section-header')?.textContent.trim().slice(0, 8) ?? null,
      inLine: ['dvd-color', 'dvd-hex', 'dvd-alpha'].every((i) => sp?.contains(document.getElementById(i))), firstIsColor: !!first?.querySelector('#dvd-hex') }; });
  expect(ui, '★Fill 절 0 · 색 칸 = Line 절 안 첫 줄 · 옛 id').toEqual({ fill: false, title: expect.stringContaining('Line'), inLine: true, firstIsColor: true });
  await page.fill('#dvd-hex', '#ff0000'); await page.press('#dvd-hex', 'Enter');
  await expect.poll(() => page.evaluate(() => window.__b.dataset.lineColor), { message: '★색 쓰기 = 옛 배선 그대로' }).toBe('#ff0000');
  expect(errs, errs.join(' | ')).toEqual([]);
});
for (const [add, cls, part] of [['addChatBlock', 'chat-block', 'chb-bg-left-hex'], ['addInfoCardBlock', 'infocard-block', 'ifc-accent-hex'], ['addGraphBlock', 'graph-block', 'grb-label-hex'], ['addComparisonBlock', 'comparison-block', 'cmp-c0HdBg-hex']]) {
  test(`D22 ${cls} — Fill = 부위 색만 · 표준 부품 0 · ＋ 0 · 옛 id`, async ({ page }) => {
    const errs = await bootBlk(page, add, cls);
    const ui = await page.evaluate((part) => { const f = document.querySelector('#panel-right .prop-section[data-sec="fill"]');
      return { fill: !!f, std: !!f?.querySelector('[data-part="fill"]'), add: !!f?.querySelector('[id$="-fill-add"]') || !!f?.closest('.prop-section')?.querySelector('.prop-section-header [id$="-fill-add"]'), part: !!f?.contains(document.getElementById(part)) }; }, part);
    expect(ui, '★Fill 절 있음 · 표준 부품 0 · ＋ 0 · 부위 색 칸 옛 id').toEqual({ fill: true, std: false, add: false, part: true });
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/* F6-1(현빈 GO 261124 · 지디 (가) 눈 = v1) — 숨김(눈) · 새 키 data-fill-hidden="1" 은 숨길 때만(보이면 키 없음 = 옛 바이트) · 색 값은 안 지움
 * D23 도형 눈 — 누름 = 키 1 · svg fill-opacity 0(면만 · 선은 그대로 · PNG 가 쓰는 SVG 직렬화에도 실리게 인라인) · 색 그대로 · 눈 눌림 · 줄 흐림 · ⌘Z/⇧⌘Z 한 칸 · 다시 누름 = 키 없음 · 숨긴 채 − = 숨김도 걷힘
 * 양성대조: _patches/fill-f6-1-CTL.patch(도형이 눈을 안 켬 = hiddenWhy 기본 «곧 지원») ⇒ D23 빨강 */
test('D23 도형 눈 = 숨김 키 · 면만 투명 · 색 지킴 · ⌘Z · 다시 누름 = 키 없음 · − 가 숨김도 걷음', async ({ page }) => {
  const { errs, id } = await scene(page, '#ff0000');
  const hs = () => page.evaluate((id) => { const b = document.getElementById(id), eye = document.getElementById('shape-fill-eye'), svg = b.querySelector('svg');
    return { key: b.getAttribute('data-fill-hidden'), fo: svg?.style.fillOpacity ?? null, color: b.dataset.shapeColor ?? null, dis: eye?.getAttribute('aria-disabled') ?? null,
      pressed: eye?.getAttribute('aria-pressed') ?? null, dim: document.querySelector('#panel-right .ui-fill-layer')?.getAttribute('data-hidden') ?? null }; }, id);
  const reopen = () => page.evaluate((id) => { const b = document.getElementById(id); window.selectBlock(id); window.showShapeProperties?.(b); }, id);
  expect(await hs(), '★처음 = 눈 산다 · 키 없음').toEqual({ key: null, fo: '', color: '#ff0000', dis: null, pressed: 'false', dim: null });
  await page.click('#shape-fill-eye'); await raf(page);
  expect(await hs(), '★누름 = 키 1 · 면 투명 · 색 그대로 · 눈 눌림 · 줄 흐림').toEqual({ key: '1', fo: '0', color: '#ff0000', dis: null, pressed: 'true', dim: '1' });
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page); await reopen();
  expect((await hs()).key, '★⌘Z 한 칸 = 보임').toBe(null);
  await page.keyboard.press('Meta+Shift+z'); await raf(page); await reopen();
  expect(await hs(), '★⇧⌘Z = 다시 숨김(DOM 복원 · 패널도 눌림)').toEqual({ key: '1', fo: '0', color: '#ff0000', dis: null, pressed: 'true', dim: '1' });
  await page.click('#shape-fill-eye'); await raf(page);
  expect(await hs(), '★다시 누름 = 키 «없음»(빈 값 아님) · 면 돌아옴').toEqual({ key: null, fo: '', color: '#ff0000', dis: null, pressed: 'false', dim: null });
  await page.click('#shape-fill-eye'); await raf(page); await page.click('#shape-fill-remove'); await raf(page);
  await page.click('#shape-fill-add'); await raf(page);
  const s = await hs();
  expect([s.key, s.fo, s.color], '★숨긴 채 − → ＋ = 숨김 안 남음 · 지난 색').toEqual([null, '', '#ff0000']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* D24 파일 왕복(지디 261124) — serializeProject → 캔버스 비움 → applyProjectData(big-block-dragout 의 reopen 꼴)
 *   ① 숨긴 도형 = 다시 열어도 data-fill-hidden="1" · 면 fill-opacity 0 · 색 키 그대로 · 패널 눈 눌림
 *   ② [음성] 옛 저장본(키 없음 · 안 숨긴 도형) = 다시 열어도 키·fill-opacity 없음 · 색 그대로 · 저장 문자열에 두 낱말 0
 * 양성대조: _patches/fill-f6-1-save-CTL.patch(serializeCleanRoot 가 data-fill-hidden 을 뺌) ⇒ ① 빨강 */
const reopenFile = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
const fileSt = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); if (!b) return null; window.selectBlock(id); window.showShapeProperties?.(b);
  return { key: b.getAttribute('data-fill-hidden'), fo: b.querySelector('svg')?.style.fillOpacity ?? null, color: b.dataset.shapeColor ?? null, pressed: document.getElementById('shape-fill-eye')?.getAttribute('aria-pressed') ?? null }; }, id);
test('D24 파일 왕복 — 숨김 유지 · 색 그대로 · [음성] 키 없는 옛 저장본 무변', async ({ page }) => {
  const { errs, id } = await scene(page, '#ff0000');
  await reopenFile(page); await raf(page);
  const old = await fileSt(page, id);
  const oldTxt = await page.evaluate(() => window.serializeProject());
  expect(old, '★[음성] 키 없는 저장본 = 다시 열어도 키·면 투명 없음 · 색 그대로').toEqual({ key: null, fo: '', color: '#ff0000', pressed: 'false' });
  expect([/data-fill-hidden/.test(oldTxt), /fill-opacity/.test(oldTxt)], '★안 숨기면 저장 문자열에 숨김 흔적 0(옛 바이트)').toEqual([false, false]);
  await page.click('#shape-fill-eye'); await raf(page);
  await reopenFile(page); await raf(page);
  expect(await fileSt(page, id), '★숨긴 채 저장 → 다시 열기 = 키 1 · 면 투명 · 색 그대로 · 눈 눌림').toEqual({ key: '1', fo: '0', color: '#ff0000', pressed: 'true' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F6-2 렌더러 9(지디 261124 «증상 그 자체를 고정») — 패널에서 끈 칠이 «다른 값 하나 바꾼 rerender» 뒤 되살아나지 않는다
 * D25 블럭마다 1칸: 유일 색(#12ab34)으로 칠 → [전제] 그 색이 그림에 있다 → 눈 → 없다 · 키 1 → radius 바꿔 렌더러 다시 부름 → 여전히 없다 · 색 키 그대로
 *   «그림에 있다» = 블럭 하위 인라인/SVG 속성 문자열(data-* 저장 키 뺌) + 계산된 background·fill·stop-color 어디에든 그 색
 * 양성대조: _patches/fill-f6-2-CTL-<블럭>.patch(그 렌더러 한 줄만 뺌) ⇒ 그 블럭 칸만 빨강 */
const F62 = [
  ['canvas', "window.addCanvasBlock()", '.canvas-block', 'showCanvasProperties', 'renderCanvas', 'bg', 'cvb-fill', { cardMode: 'layers', layers: JSON.stringify([{ type: 'text', content: 'T', color: '#000000', fontSize: 16 }]) }],   // 심플 모드는 심플카드 패널(글 배경 = 패널 직접칠 5 쪽)
  ['modal', "window.addModalBlock()", '.modal-block', 'showModalProperties', 'renderModalBlock', 'bg', 'mdl-fill', {}],
  ['innercard', "window.addInnerCardBlock()", '.innercard-block', 'showInnerCardProperties', 'renderInnerCardBlock', 'bg', 'icd-fill', {}],
  ['banner02', "window.addBanner02Block()", '.banner02-block', 'showBanner02Properties', 'renderBanner02', 'bg', 'bn2-fill', {}],
  ['step', "window.addStepBlock()", '.step-block', 'showStepProperties', 'renderStepBlock', 'stepCardBg', 'stb-fill', { stepStyle: 'card' }],
  ['sticker-text', "window.addStickerBlock({ shape: 'text' })", '.sticker-block', 'showStickerProperties', 'renderStickerBlock', 'bgColor', 'stk-t-fill', {}],
  ['radial', "window.addRadialBlock()", '.radial-block', 'showRadialProperties', 'renderRadialBlock', 'bg', 'rdl-fill', {}],
  ['coupon', "window.addCouponBlock()", '.coupon-block', 'showCouponProperties', 'renderCouponBlock', 'bodyCol', 'cpn-fill', {}],
  ['zoom', "window.addZoomBlock()", '.zoom-block', 'showZoomProperties', 'renderZoomBlock', 'fill', 'zm-fillstd', {}],
];
for (const [name, make, sel, show, render, key, px, prep] of F62) {
  test(`D25 ${name} — 숨김 → 다른 값 rerender → 여전히 숨김 · 색 키 그대로`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    const id = await page.evaluate(async ([make, sel, show, render, key, prep]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
      const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make); const b = sec.querySelector(sel);
      Object.assign(b.dataset, prep, { [key]: '#12ab34' }); window[render](b); window.selectBlock(b.id); window[show](b); return b.id; }, [make, sel, show, render, key, prep]);
    const has = () => page.evaluate((id) => { const b = document.getElementById(id), all = [b, ...b.querySelectorAll('*')];
      const cl = b.cloneNode(true); [cl, ...cl.querySelectorAll('*')].forEach((e) => [...e.attributes].forEach((at) => { if (at.name.startsWith('data-')) e.removeAttribute(at.name); }));   // 저장 키(data-*)는 «그림»이 아니다
      if (/12ab34|rgb\(18, ?171, ?52\)/i.test(cl.outerHTML)) return true;
      return all.some((e) => { const cs = getComputedStyle(e); return [cs.backgroundColor, cs.backgroundImage, cs.fill, cs.stopColor].some((v) => /rgb\(18, 171, 52\)/.test(v || '')); }); }, id);
    const k = () => page.evaluate(([id, key]) => { const b = document.getElementById(id); return [b.getAttribute('data-fill-hidden'), b.dataset[key]]; }, [id, key]);
    expect(await has(), '[전제] 유일 색이 그림에 있다(없으면 «숨김»이 공짜로 참)').toBe(true);
    await page.click(`#${px}-eye`); await raf(page);
    expect([await has(), ...(await k())], '★눈 = 그림에서 그 색 0 · 키 1 · 색 키 그대로').toEqual([false, '1', '#12ab34']);
    await page.evaluate(([id, render]) => { const b = document.getElementById(id); b.dataset.radius = '9'; window[render](b); }, [id, render]); await raf(page);
    expect([await has(), ...(await k())], '★다른 값 바꿔 rerender 뒤에도 숨김(렌더러가 키를 본다)').toEqual([false, '1', '#12ab34']);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/* F6-2b 패널 직접칠 5(지디 261124) — 칠 style 을 쓰는 자리가 여럿 ⇒ 그리기 = 프레임·에셋·아이콘원은 css/editor-blocks.css 규칙 한 벌(!important) · 브리지·심플카드 글 배경은 렌더러 한 줄
 * D26 블럭마다: 유일 색 칠 → [전제] «계산된» 그림에 보임 → 눈 → 안 보임·키 1 → ⑴ 선택 풀고 다시 고름 → 유지·눈 눌림 → ⑵ 색을 다른 유일 색으로 다시 씀(그 블럭의 style 쓰는 자리를 다시 탐) → 유지 → ⑶ 저장·다시 열기(D24 꼴) → 유지
 *   ★계산값은 expect.poll 로 잰다 — 에셋은 배경 transition 이 있어 한 번 읽으면 칠하는 도중(투명)을 읽는다(첫 판 [전제] 빨강의 까닭)
 *   «보임» = 계산된 background-color/-image 에 그 색 · 또는 SVG 계산 fill 에 그 색이고 계산 fill-opacity ≠ 0 — ★인라인 문자열은 안 본다(숨김은 색·인라인을 «그대로 두는» 꼴이라 문자열엔 늘 있다)
 * 양성대조: _patches/fill-f6-2b-CTL-<블럭>.patch(그 블럭의 CSS 규칙 / 렌더러 한 줄만 뺌) ⇒ 그 블럭 칸만 빨강 */
const F62B = [
  ['frame', 'window.addFrameBlock()', '.frame-block:not([data-text-frame])', 'showFrameProperties', 'ss-fill', 'ss-bg-hex'],
  ['asset', 'window.addAssetBlock()', '.asset-block', 'showAssetProperties', 'asset-fill', 'asset-bg-hex'],
  ['icon-circle', 'window.addIconCircleBlock()', '.icon-circle-block', 'showIconCircleProperties', 'icb-fill', 'icb-bg-hex'],
  ['bridge', 'window.addBridgeBlock()', '.bridge-block', 'showBridgeProperties', 'brg-fill', 'brg-hex'],
  ['simple-card', 'window.addCanvasBlock()', '.canvas-block', 'showCanvasProperties', 'cvb-textbg-fill', 'cvb-textbg-hex'],
];
for (const [name, make, sel, show, px, hex] of F62B) {
  test(`D26 ${name} — 숨김 유지: ⑴ 다시 고름 ⑵ 색 다시 씀 ⑶ 저장·다시 열기`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    const id = await page.evaluate(async ([make, sel, show]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
      const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make); const b = sec.querySelector(sel); window.selectBlock(b.id); window[show](b); return b.id; }, [make, sel, show]);
    const reopenPanel = () => page.evaluate(([id, show]) => { window.deselectAll(); const b = document.getElementById(id); window.selectBlock(id); window[show](b); }, [id, show]);
    const setHex = async (v) => { if (!(await page.$(`#${hex}`)) && (await page.$(`#${px}-add`))) { await page.click(`#${px}-add`); await raf(page); }
      await page.fill(`#${hex}`, v); await page.press(`#${hex}`, 'Enter'); await raf(page); await reopenPanel(); };
    const vis = () => page.evaluate(async (id) => { await Promise.all(document.getAnimations().map((an) => an.finished.catch(() => {})));   // transition 끝난 값만(«안 보임»이 칠하는 도중의 투명으로 공짜로 참이 되지 않게)
      const b = document.getElementById(id); const re = /rgb\(18, 171, 5[23]\)/;
      return [b, ...b.querySelectorAll('*')].some((e) => { const cs = getComputedStyle(e);
        if (re.test(cs.backgroundColor) || re.test(cs.backgroundImage)) return true;
        return e instanceof SVGElement && re.test(cs.fill) && parseFloat(cs.fillOpacity) !== 0; }); }, id);
    const k = () => page.evaluate(([id, px]) => [document.getElementById(id)?.getAttribute('data-fill-hidden') ?? null, document.getElementById(`${px}-eye`)?.getAttribute('aria-pressed') ?? null], [id, px]);
    await setHex('#12ab34');
    await expect.poll(vis, { message: '[전제] 유일 색이 계산된 그림에 보인다(배경 transition 이 있는 블럭 = 다 칠할 때까지 기다림)' }).toBe(true);
    await page.click(`#${px}-eye`); await raf(page);
    await expect.poll(async () => [await vis(), ...(await k())], { message: '★눈 = 안 보임 · 키 1 · 눈 눌림' }).toEqual([false, '1', 'true']);
    await reopenPanel(); await raf(page);
    await expect.poll(async () => [await vis(), ...(await k())], { message: '★⑴ 선택 풀고 다시 고름 → 유지 · 눈 눌림' }).toEqual([false, '1', 'true']);
    await setHex('#12ab35');
    await expect.poll(async () => [await vis(), ...(await k())], { message: '★⑵ 색을 다시 씀(그 블럭의 style 쓰는 자리) → 유지' }).toEqual([false, '1', 'true']);
    await reopenFile(page); await raf(page); await reopenPanel(); await raf(page);
    await expect.poll(async () => [await vis(), ...(await k())], { message: '★⑶ 저장·다시 열기 → 유지 · 눈 눌림' }).toEqual([false, '1', 'true']);
    await page.click(`#${px}-eye`); await raf(page);
    await expect.poll(async () => [await vis(), (await k())[0]], { message: '★눈 다시 = 다시 보임(⑵ 색) · 키 없음' }).toEqual([true, null]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/* D27 내보내기 경로마다 1칸(지디 261124 «산출물 경로 하나 = 검사 하나») — 프레임·에셋·아이콘원(CSS 규칙) · 브리지·심플카드(렌더러)
 *   PNG = 섹션 «이 섹션 내보내기»(png) 진짜 다운로드 파일을 풀어 유일 색 화소 수 — ★두 갈래 따로: native(앱 = Electron 이면 늘 이것 · isNativeCapture · captureSectionCdp 를 main.js 와 같은 CDP Page.captureScreenshot 로 · annot-export-show 선례) · h2c(electronAPI.captureSection 없을 때 = 브라우저) · HTML = exportHTMLFile 진짜 다운로드 파일을 «따로 연 페이지»(망 끊음)에서 그 블럭 계산된 그림
 *   [전제] 보일 때 내보내면 그 색이 «있다» → 눈 → 다시 내보내면 «없다»
 * 양성대조: D26 CTL 패치(_patches/fill-f6-2b-CTL-<블럭>.patch)를 걸면 그 블럭 숨김 내보내기에 색이 다시 나와 빨강 */
const fsx = require('fs');
for (const [name, make, sel, show, px, hex] of F62B) {
  test(`D27 ${name} — 숨김이 PNG·HTML 내보내기에도 · [전제] 보일 땐 실림`, async ({ page, context }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    const cdp = await context.newCDPSession(page);
    await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height }) => (await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: 1 }, captureBeyondViewport: true, fromSurface: true })).data);
    const lane = (native) => page.evaluate((native) => { window.electronAPI = new Proxy({}, { get: (t, k) => k === 'captureSection' ? (native ? (() => Promise.resolve(null)) : undefined) : k === 'captureSectionCdp' ? ((o) => window.__cdpShot(o)) : (() => Promise.resolve(null)) }); }, native);
    const ids = await page.evaluate(async ([make, sel, show]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
      const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make); const b = sec.querySelector(sel); window.selectBlock(b.id); window[show](b); return { id: b.id, sec: sec.id }; }, [make, sel, show]);
    if (!(await page.$(`#${hex}`)) && (await page.$(`#${px}-add`))) { await page.click(`#${px}-add`); await raf(page); }
    await page.fill(`#${hex}`, '#12ab34'); await page.press(`#${hex}`, 'Enter'); await raf(page);
    const png = async (native) => { await lane(native); await page.evaluate((s) => { window.deselectAll(); const sec = document.getElementById(s); window.selectSection(sec); window.showSectionProperties?.(sec); }, ids.sec);
      await page.waitForSelector('#sec-export-btn'); await page.selectOption('#sec-export-format', 'png');
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => document.getElementById('sec-export-btn').click())]);   // 단추가 창 아래끝(y≈1041)이라 page.click 은 «누를 수 있나» 기다리다 멈춤(실측) — 단추 동작 그대로 부름
      const b64 = fsx.readFileSync(await dl.path()).toString('base64');
      await page.evaluate(() => document.querySelector('#exres-modal [data-act="close"]')?.click());   // 내보내기 결과 창(#exres-modal)이 패널을 덮어 다음 눈 누름이 멈춤(실측) — 그 창의 닫기 단추로 닫음
      return page.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 18) < 6 && Math.abs(d[i + 1] - 171) < 6 && Math.abs(d[i + 2] - 52) < 6 && d[i + 3] > 200) n++; return n; }, b64); };
    const html = async () => { const [dh] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => { window.exportHTMLFile(); return null; })]);
      const body = fsx.readFileSync(await dh.path(), 'utf8'); const xp = await context.newPage(); await xp.setViewportSize({ width: 1500, height: 1100 });
      await xp.route('**/*', (rq) => { const u = rq.request().url(); if (u === 'http://fx.test/export.html') return rq.fulfill({ contentType: 'text/html', body }); if (u.startsWith('data:') || u.startsWith('blob:')) return rq.continue(); return rq.abort(); });
      await xp.goto('http://fx.test/export.html');
      const r = await xp.evaluate(async (id) => { await Promise.all(document.getAnimations().map((an) => an.finished.catch(() => {}))); const b = document.getElementById(id); if (!b) return 'no-block'; const re = /rgb\(18, 171, 52\)/;
        return [b, ...b.querySelectorAll('*')].some((e) => { const cs = getComputedStyle(e); if (re.test(cs.backgroundColor) || re.test(cs.backgroundImage)) return true; return e instanceof SVGElement && re.test(cs.fill) && parseFloat(cs.fillOpacity) !== 0; }); }, ids.id);
      await xp.close(); return r; };
    const shown = { native: await png(true), h2c: await png(false), html: await html() };
    expect([shown.native > 0, shown.h2c > 0, shown.html], `[전제] 보일 때 내보내면 실린다 ${JSON.stringify(shown)}`).toEqual([true, true, true]);
    await page.evaluate(([id, show]) => { window.deselectAll(); const b = document.getElementById(id); window.selectBlock(id); window[show](b); }, [ids.id, show]);
    await page.click(`#${px}-eye`); await raf(page);
    const hidden = { native: await png(true), h2c: await png(false), html: await html() };
    console.log(`[D27 ${name} 실측]`, JSON.stringify({ shown, hidden }));
    expect(hidden, '★숨기면 PNG(native·h2c) 화소 0 · 따로 연 HTML 에서 안 보임').toEqual({ native: 0, h2c: 0, html: false });
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/* F6-3 여러 고름 Fill(지디 261124) — 종류 표(_fill-section FILL_KINDS)
 * D28 «두 길 같은 결과»(지디 조건) — 종류 15(캔버스 = 레이어/심플 두 모드 = 16칸): 같은 꼴 블럭 둘 · (가) 단일 패널 색 칸(hex Enter = 그 패널 onApply) (나) 표 paint
 *   → 두 블럭 outerHTML 바이트 같음(블럭 id → BID · .selected 뺌) · 한 칸이라도 다르면 = 표가 키·렌더러를 잘못 앎
 * 양성대조: _patches/fill-f6-3-CTL-parity.patch(표 한 종류(modal)의 색 키를 틀리게) ⇒ D28 modal 만 빨강 */
const F63 = [
  ['shape', "window.addShapeBlock('rectangle')", '.shape-block', 'showShapeProperties', 'shape-fill', 'shape-color-hex', {}],
  ['frame', 'window.addFrameBlock()', '.frame-block:not([data-text-frame])', 'showFrameProperties', 'ss-fill', 'ss-bg-hex', {}],
  ['asset', 'window.addAssetBlock()', '.asset-block', 'showAssetProperties', 'asset-fill', 'asset-bg-hex', {}],
  ['icon-circle', 'window.addIconCircleBlock()', '.icon-circle-block', 'showIconCircleProperties', 'icb-fill', 'icb-bg-hex', {}],
  ['bridge', 'window.addBridgeBlock()', '.bridge-block', 'showBridgeProperties', 'brg-fill', 'brg-hex', {}],
  ['canvas', 'window.addCanvasBlock()', '.canvas-block', 'showCanvasProperties', 'cvb-fill', 'cvb-bg-hex', { cardMode: 'layers', layers: JSON.stringify([{ type: 'text', content: 'T', color: '#000000', fontSize: 16 }]) }],
  ['simple-card', 'window.addCanvasBlock()', '.canvas-block', 'showCanvasProperties', 'cvb-textbg-fill', 'cvb-textbg-hex', {}],
  ['modal', 'window.addModalBlock()', '.modal-block', 'showModalProperties', 'mdl-fill', 'mdl-bg-hex', {}],
  ['innercard', 'window.addInnerCardBlock()', '.innercard-block', 'showInnerCardProperties', 'icd-fill', 'icd-bg-hex', {}],
  ['banner02', 'window.addBanner02Block()', '.banner02-block', 'showBanner02Properties', 'bn2-fill', 'bn2-bg-hex', {}],
  ['step', 'window.addStepBlock()', '.step-block', 'showStepProperties', 'stb-fill', 'stb-card-bg-hex', { stepStyle: 'card' }],
  ['sticker-text', "window.addStickerBlock({ shape: 'text' })", '.sticker-block', 'showStickerProperties', 'stk-t-fill', 'stk-t-bg-hex', {}],
  ['radial', 'window.addRadialBlock()', '.radial-block', 'showRadialProperties', 'rdl-fill', 'rdl-bg-hex', {}],
  ['coupon', 'window.addCouponBlock()', '.coupon-block', 'showCouponProperties', 'cpn-fill', 'cpn-body-hex', {}],
  ['zoom', 'window.addZoomBlock()', '.zoom-block', 'showZoomProperties', 'zm-fillstd', 'zm-fill-hex', {}],
];
const RENDER_OF = { canvas: 'renderCanvas', 'simple-card': 'renderCanvas', modal: 'renderModalBlock', innercard: 'renderInnerCardBlock', banner02: 'renderBanner02', step: 'renderStepBlock', 'sticker-text': 'renderStickerBlock', radial: 'renderRadialBlock', coupon: 'renderCouponBlock', zoom: 'renderZoomBlock', bridge: 'renderBridgeBlock' };
async function twoBlocks(page, make, sel, prep, render) {
  return page.evaluate(async ([make, sel, prep, render]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make);
    const a = sec.querySelector(sel); Object.assign(a.dataset, prep); if (render) window[render]?.(a);
    /* B = A 의 «복제본»(지디 «같은 블럭 복제본 둘») — 섹션 바로 아래 단위째 복제 · id 는 앞에 q(블럭 id 로 접두하는 속 id 는 paint 가 다시 그림) */
    const unit = [...sec.querySelectorAll('*')].find((e) => e.contains(a) && e.parentElement?.classList.contains('section-inner')) || a;
    const dup = unit.cloneNode(true); [dup, ...dup.querySelectorAll('[id]')].forEach((e) => { if (e.id) e.id = 'q' + e.id; }); unit.after(dup); window.rebindAll?.();
    return { ids: [a.id, 'q' + a.id], sec: sec.id }; }, [make, sel, prep, render]);
}
const openPanel = (page, id, show) => page.evaluate(([id, show]) => { window.deselectAll(); const b = document.getElementById(id); window.selectBlock(id); window[show](b); }, [id, show]);
for (const [name, make, sel, show, px, hex, prep] of F63) {
  test(`D28 ${name} — 두 길(단일 패널 / 여러 고름 표) 같은 바이트`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    const { ids } = await twoBlocks(page, make, sel, prep, RENDER_OF[name]);
    for (const id of ids) { await openPanel(page, id, show); if (!(await page.$(`#${hex}`)) && (await page.$(`#${px}-add`))) { await page.click(`#${px}-add`); await raf(page); } }
    await openPanel(page, ids[0], show);
    await page.fill(`#${hex}`, '#12ab34'); await page.press(`#${hex}`, 'Enter'); await raf(page);
    await page.evaluate(async ([id]) => { const m = await import('/js/props/_fill-section.js'); const b = document.getElementById(id); const it = m.fillKindOf(b); it.k.paint(it.block, '#12ab34'); }, [ids[1]]);
    await page.evaluate(() => window.deselectAll()); await raf(page);
    const [a, b] = await page.evaluate((ids) => ids.map((id) => { const el = document.getElementById(id).cloneNode(true); [el, ...el.querySelectorAll('*')].forEach((e) => e.classList?.remove('selected'));
      return el.outerHTML.split(id).join('BID').replace(/ class=""/g, ''); }), ids);   // 빈 class="" = 패널 선택 표식(스텝 고른 칸)을 뗀 자국 · 그림 아님
    expect(a.includes('12ab34') || a.includes('18, 171, 52') || /12AB34/.test(a), '[전제] 단일 패널 길이 실제로 그 색을 썼다').toBe(true);
    expect(b, `★두 길 같은 바이트(${name})`).toBe(a);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/* D29 여러 고름 Fill 동작(흐름 여러 고름 패널 · 프레임 둘 + 에셋 하나 = 종류 섞임)
 *   색 같음 = 그 색 · 다름 = Mix(빈 값·placeholder Mix·빗금) · 색 고름 = 셋 다 · ⌘Z «한 번» = 셋 다 되돌림 · 눈 = 일부 숨김 mixed → 누름 = 다 숨김 → 누름 = 다 보임
 *   그라데이션 섞임 = 색 칸 막힘 · 표 밖(글)이 섞이면 Fill 절 없음
 * 양성대조: _patches/fill-f6-3-CTL-multi.patch(여러 고름 색 onApply 가 첫 블럭만 칠함) ⇒ D29 빨강 */
test('D29 여러 고름 Fill — Mix · 색 일괄 · ⌘Z 한 번 전부 · 눈 세 상태 · 그라데이션 막힘 · 글 섞이면 절 없음', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    for (const mk of ['addFrameBlock', 'addFrameBlock', 'addAssetBlock']) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.frame-block:not([data-text-frame]), .asset-block')); await window[mk]();
      out.push([...sec.querySelectorAll('.frame-block:not([data-text-frame]), .asset-block')].find((x) => !before.has(x)).id); }
    return out; });
  const paint = (cols) => page.evaluate(async ([ids, cols]) => { const m = await import('/js/props/_fill-section.js'); ids.forEach((id, i) => { const it = m.fillKindOf(document.getElementById(id)); it.k.paint(it.block, cols[i]); }); }, [ids, cols]);
  const open = (extra) => page.evaluate(([ids, extra]) => { window.deselectAll(); ids.forEach((id) => document.getElementById(id).classList.add('selected')); if (extra) extra.forEach((id) => document.getElementById(id).classList.add('selected')); window.showFlowMultiSelPanel(); }, [ids, extra || null]);
  const ui = () => page.evaluate(() => { const f = document.querySelector('#panel-right .prop-section[data-sec="fill"]'), hx = document.getElementById('msp-fill-hex'), eye = document.getElementById('msp-fill-eye');
    return { fill: !!f, mixed: !!f?.querySelector('.ui-fill-mixed'), hex: hx?.value ?? null, ph: hx?.getAttribute('placeholder') ?? null, eye: eye?.getAttribute('aria-pressed') ?? null, dis: f?.querySelector('.prop-color-field')?.getAttribute('aria-disabled') ?? null }; });
  const cols = () => page.evaluate(async (ids) => { const m = await import('/js/props/_fill-section.js'); return ids.map((id) => { const it = m.fillKindOf(document.getElementById(id)); return it.k.get(it.block); }); }, ids);
  const keys = () => page.evaluate((ids) => ids.map((id) => document.getElementById(id).getAttribute('data-fill-hidden')), ids);
  await paint(['#111111', '#111111', '#111111']); await open();
  expect(await ui(), '★색 같음 = 그 색 · Mix 아님 · 눈 안 눌림').toEqual({ fill: true, mixed: false, hex: '111111', ph: null, eye: 'false', dis: null });
  await paint(['#111111', '#111111', '#222222']); await open();
  expect(await ui(), '★색 다름 = Mix(빈 값 · placeholder Mix · 빗금)').toEqual({ fill: true, mixed: true, hex: '', ph: 'Mix', eye: 'false', dis: null });
  await page.evaluate(() => window.pushHistory?.());
  await page.fill('#msp-fill-hex', '#12ab34'); await page.press('#msp-fill-hex', 'Enter'); await raf(page);
  expect((await cols()).map((c) => String(c).toLowerCase()), '★색 고름 = 셋 다 그 색(종류 섞여도)').toEqual(['#12ab34', '#12ab34', '#12ab34']);
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); }); await page.keyboard.press('Meta+z'); await raf(page);
  expect(await cols(), '★⌘Z «한 번» = 셋 다 되돌림').toEqual(['#111111', '#111111', '#222222']);
  await page.evaluate(async (id) => { const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(document.getElementById(id)); m.fillSetHidden(it.block, it.k, true); }, ids[2]);
  await open();
  expect((await ui()).eye, '★일부 숨김 = 눈 mixed').toBe('mixed');
  await page.click('#msp-fill-eye'); await raf(page);
  expect([await keys(), (await ui()).eye], '★mixed 에서 누름 = 다 숨김').toEqual([['1', '1', '1'], 'true']);
  await page.click('#msp-fill-eye'); await raf(page);
  expect([await keys(), (await ui()).eye], '★다 숨김에서 누름 = 다 보임(키 없음)').toEqual([[null, null, null], 'false']);
  await page.evaluate((id) => { const b = document.getElementById(id); b.dataset.bg = 'linear-gradient(90deg, #ff0000, #0000ff)'; }, ids[0]); await open();
  expect((await ui()).dis, '★그라데이션 섞임 = 색 칸 막힘').toBe('true');
  const tid = await page.evaluate(async () => { const sec = document.querySelector('.section-block'); window.deselectAll(); window.selectSection(sec); await window.addTextBlock('body'); return [...sec.querySelectorAll('.text-block')].pop().id; });
  await open([tid]);
  expect((await ui()).fill, '★표 밖(글)이 섞이면 Fill 절 없음').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F7 내보내기(지디 261124) — D30 Figma JSON(buildFigmaExportJSON): 숨기면 그 블럭 항목에 fillHidden:true · 색 키 그대로 · 안 숨기면 키 0(옛 바이트)
 *   종류 = Figma 로 칠이 실제로 가는 것(실측 · 프레임 빼고 7: 도형·아이콘원·스텝 카드·배너02·모달·이너카드·방사 + 심플카드 글 배경) · 아이콘원은 숨기면 null(→ 빈 원 체커) 대신 원래 색
 *   ⛔프레임은 자유 배치 프레임만 bg 가 Figma 로 간다(흐름 프레임은 펴서 bg 안 실음 · 옛 꼴) — 장면 세우기를 srv 에서 못 돌려 이 칸 밖 · 렌더러 쪽은 유닛 figma-fill-hidden-f7 R1 frame
 *   ⛔옛 결손 6종(에셋 배경·캔버스 레이어 배경·브리지·글 스티커 배경·쿠폰·줌)은 Figma 로 Fill 이 «아예» 안 감 = F8 후보(지디) · 이 칸 밖
 * 양성대조: _patches/fill-f7-CTL-export.patch(_fh 가 늘 {}) → D30 빨강 */
const F7X = [
  ['shape', "window.addShapeBlock('rectangle')", '.shape-block', 'color', {}],
  ['icon-circle', 'window.addIconCircleBlock()', '.icon-circle-block', 'bgColor', {}],
  ['step', 'window.addStepBlock()', '.step-block', 'cardBg', { stepStyle: 'card' }],
  ['banner02', 'window.addBanner02Block()', '.banner02-block', 'bg', {}],
  ['modal', 'window.addModalBlock()', '.modal-block', 'bg', {}],
  ['innercard', 'window.addInnerCardBlock()', '.innercard-block', 'bg', {}],
  ['radial', 'window.addRadialBlock()', '.radial-block', 'bg', {}],
  ['simple-card', 'window.addCanvasBlock()', '.canvas-block', 'textBg', {}],
];
for (const [name, make, sel, key, prep] of F7X) {
  test(`D30 ${name} — Figma JSON: 숨김 = fillHidden:true · 색 그대로 · 아니면 키 0`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    const id = await page.evaluate(async ([make, sel, prep]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
      const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); await eval(make); const b = sec.querySelector(sel); Object.assign(b.dataset, prep);
      const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(b); it.k.paint(it.block, '#12ab34'); return b.id; }, [make, sel, prep]);
    const entry = () => page.evaluate((id) => { const j = window.buildFigmaExportJSON(null); let hit = null;
      (function walk(o) { if (!o || typeof o !== 'object' || hit) return; if (o.id === id && o.type) { hit = o; return; } Object.values(o).forEach(walk); })(j);
      return hit ? JSON.parse(JSON.stringify(hit)) : null; }, id);
    const e0 = await entry();
    expect(e0, '[전제] 그 블럭 항목이 Figma JSON 에 있다').not.toBeNull();
    expect(String(e0[key] || '').toLowerCase(), `[전제] 칠 색이 ${key} 로 간다`).toMatch(/12ab34|18, ?171, ?52/);
    expect('fillHidden' in e0, '[지킴] 안 숨기면 fillHidden 키 0(옛 바이트)').toBe(false);
    await page.evaluate(async (id) => { const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(document.getElementById(id)); m.fillSetHidden(it.block, it.k, true); }, id);
    const e1 = await entry();
    expect(e1.fillHidden, '★숨기면 fillHidden:true').toBe(true);
    expect(String(e1[key] || '').toLowerCase(), '★색 키 그대로(숨김은 색을 안 지움 · 아이콘원도 null 아님)').toMatch(/12ab34|18, ?171, ?52/);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

/* F8 ④(시트 81행 FIGMA-FILL-NOT-EXPORTED-6-BLOCKS-01 · 지디 261125) — D31 글 스티커 배경이 Figma JSON 으로 간다
 *   generic(kind sticker) 항목 bg = 글 스티커 bgColor(예전 = ds.bg = 늘 빈 값 → Figma 칠 0) · 숨기면 fillHidden:true · 색 그대로 · [지킴] 모양 스티커(원 등)는 bg 옛 그대로
 * 양성대조 = 고치기 전 판(70f325a69)에서 D31 빨강(bg 빈 값) */
test('D31 글 스티커 배경 — Figma JSON bg = bgColor · 숨김 키 · [지킴] 모양 스티커 무변', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    for (const o of [{ shape: 'text' }, { shape: 'circle' }]) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.sticker-block')); window.addStickerBlock(o);
      out.push([...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x)).id); }
    const t = document.getElementById(out[0]); t.dataset.bgColor = '#12ab34'; window.renderStickerBlock(t); return out; });
  const entry = (id) => page.evaluate((id) => { const j = window.buildFigmaExportJSON(null); let hit = null;
    (function walk(o) { if (!o || typeof o !== 'object' || hit) return; if (o.id === id && o.type) { hit = o; return; } Object.values(o).forEach(walk); })(j); return hit ? JSON.parse(JSON.stringify(hit)) : null; }, id);
  const t0 = await entry(ids[0]), c0 = await entry(ids[1]);
  expect([t0?.type, t0?.kind], '[전제] 글 스티커 = generic sticker 항목').toEqual(['generic', 'sticker']);
  expect(String(t0.bg).toLowerCase(), '★글 스티커 배경 = bgColor 가 Figma JSON bg 로').toBe('#12ab34');
  expect('fillHidden' in t0, '[지킴] 안 숨기면 키 0').toBe(false);
  // ★기대 바뀜(F8b 261125): 모양(원) 스티커 bg 는 이제 화면 배경색이 실린다(예전 빈 값 = Figma 빈 프레임) — 값 검사는 D35 · 여기선 «글 스티커 갈래가 원에 새지 않음»만
  expect(c0 ? String(c0.bg ?? '').toLowerCase() : 'no-entry', '[지킴] 원 스티커가 글 스티커 bgColor(#12ab34)를 받지 않는다').not.toBe('#12ab34');
  await page.evaluate(async (id) => { const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(document.getElementById(id)); m.fillSetHidden(it.block, it.k, true); }, ids[0]);
  const t1 = await entry(ids[0]);
  expect([t1.fillHidden, String(t1.bg).toLowerCase()], '★숨기면 fillHidden · 색 그대로').toEqual([true, '#12ab34']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F8 탐침 + ③(지디 261125) — D32 쿠폰·줌·브리지·캔버스 레이어 모드 블럭의 Figma JSON 실측(로그 [D32 실측]: svg 길이 · cards 수)
 *   단언: 쿠폰·줌·브리지 항목에 svg 가 «실린다»(렌더러가 그리게 된 것의 전제) · 브리지 숨김 = fillHidden + svg 뿌리 fill-opacity:0 «뺌»(Figma 에서 칠 눈을 켜면 색이 돌아오게)
 *   레이어 모드 cards 수는 «재기만»(0 이면 지디 판단 · 손 0) */
test('D32 F8 탐침 — 쿠폰·줌·브리지 svg 실림 · 브리지 숨김 svg 에 fill-opacity:0 없음 · 레이어 모드 cards 수(재기만)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = {};
    for (const [k, mk, sel] of [['coupon', () => window.addCouponBlock(), '.coupon-block'], ['zoom', () => window.addZoomBlock(), '.zoom-block'], ['bridge', () => window.addBridgeBlock(), '.bridge-block'], ['layers', () => window.addCanvasBlock(), '.canvas-block']]) {
      window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll(sel)); await mk(); out[k] = [...sec.querySelectorAll(sel)].find((x) => !before.has(x)).id; }
    const L = document.getElementById(out.layers); L.dataset.cardMode = 'layers'; L.dataset.layers = JSON.stringify([{ type: 'text', content: 'T', color: '#000000', fontSize: 16 }]); window.renderCanvas(L);
    return out; });
  const entries = () => page.evaluate((ids) => { const j = window.buildFigmaExportJSON(null); const got = {};
    (function walk(o) { if (!o || typeof o !== 'object') return; for (const [k, id] of Object.entries(ids)) if (o.id === id && o.type && !got[k]) got[k] = JSON.parse(JSON.stringify(o)); Object.values(o).forEach(walk); })(j); return got; }, ids);
  const e = await entries();
  console.log('[D32 실측]', JSON.stringify(Object.fromEntries(Object.entries(e).map(([k, v]) => [k, { type: v.type, kind: v.kind, svgLen: (v.svg || '').length, cards: Array.isArray(v.cards) ? v.cards.length : null }]))));
  for (const k of ['coupon', 'zoom', 'bridge']) expect([e[k]?.type, e[k]?.kind, (e[k]?.svg || '').startsWith('<svg')], `★${k} = generic · svg 실림`).toEqual(['generic', k, true]);
  expect(e.layers, '[전제] 레이어 모드 블럭 항목 있음').toBeTruthy();
  await page.evaluate(async (id) => { const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(document.getElementById(id)); m.fillSetHidden(it.block, it.k, true); }, ids.bridge);
  const live = await page.evaluate((id) => document.getElementById(id).querySelector('svg')?.getAttribute('style') || '', ids.bridge);
  expect(live, '[전제] 캔버스 브리지 svg 에는 fill-opacity:0(F6-2b)').toContain('fill-opacity:0');
  const b1 = (await entries()).bridge;
  expect([b1.fillHidden, /fill-opacity:0/.test(b1.svg)], '★브리지 숨김 = fillHidden · 내보낸 svg 엔 fill-opacity:0 없음').toEqual([true, false]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F8 ① 탐침(지디 261125 «고치기 전에 캔버스에서 언제 보이나») — D33 에셋 배경색이 «캔버스 화면»에 보이는 경우 실측(로그 [D33 실측])
 *   (a) 빈 에셋 · 키 없음  (b) 빈 에셋 · bgColor #12ab34  (c) 투명 PNG 그림 + bgColor #12ab34
 *   잼: .asset-block 계산 background-color/-image(체커 repeating-conic 이 위에 있나) + 화면 스샷 가운데 화소 RGB · 단언은 장면 세우기(전제)만 — 범위(빈 칸만/투명 PNG 까지)는 이 로그로 정한다 */
test('D33 F8 ① 탐침 — 에셋 배경색: 빈 칸·투명 PNG 에서 화면 화소 · 체커 위아래', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    for (let i = 0; i < 3; i++) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.asset-block')); await window.addAssetBlock(); out.push([...sec.querySelectorAll('.asset-block')].find((x) => !before.has(x)).id); }
    const m = await import('/js/props/_fill-section.js');
    for (const id of out.slice(1)) { const it = m.fillKindOf(document.getElementById(id)); it.k.paint(it.block, '#12ab34'); }
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const png = cv.toDataURL('image/png');   // 다 투명
    window.setAssetImageFromSrc(document.getElementById(out[2]), png);
    window.deselectAll(); return out; });
  await page.waitForTimeout(600);
  const res = {};
  for (const [k, id] of [['a 빈·키없음', ids[0]], ['b 빈·bgColor', ids[1]], ['c 투명PNG·bgColor', ids[2]]]) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id); await page.waitForTimeout(200);
    const r = await page.evaluate((id) => { const b = document.getElementById(id), cs = getComputedStyle(b), rc = b.getBoundingClientRect(), img = b.querySelector('.asset-img');
      return { x: Math.round(rc.left + rc.width / 2), y: Math.round(rc.top + rc.height / 2), w: Math.round(rc.width), h: Math.round(rc.height), bgc: cs.backgroundColor, bgi: cs.backgroundImage.slice(0, 60), inlineBg: b.style.backgroundColor || '', hasImg: !!(img && img.getAttribute('src')), imgVis: img ? getComputedStyle(img).display : null }; }, id);
    const shot = await page.screenshot({ clip: { x: r.x - 2, y: r.y - 2, width: 4, height: 4 } });
    const px = await page.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return [...x.getImageData(1, 1, 1, 1).data].slice(0, 3); }, shot.toString('base64'));
    res[k] = { ...r, px };
  }
  console.log('[D33 실측]', JSON.stringify(res));
  expect([res['a 빈·키없음'].w > 0, res['b 빈·bgColor'].inlineBg !== '', res['c 투명PNG·bgColor'].hasImg], '[전제] 장면 셋이 섰다(크기 · b 인라인 색 · c 그림 있음)').toEqual([true, true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F8 ①(시트 81행 · 지디 261125) — D34 에셋 배경색 → Figma JSON image 항목 bg(렌더러가 프레임 칠로 · 그림은 자식 imgfill · 유닛 figma-fill-hidden-f7 A1~A5)
 *   ★bg = bgColor · 숨김 = fillHidden + 색 그대로 · [지킴] 키 없음 = bg·fillHidden 키 0(옛 바이트) · 'transparent'(− 누름) = bg 0
 * 양성대조: 고치기 전 판 4188f69c1 에서 D34 빨강(bg 없음) */
test('D34 에셋 배경색 — Figma JSON image bg = bgColor · 숨김 키 · [지킴] 키 없음·transparent = 키 0', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    for (let i = 0; i < 3; i++) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.asset-block')); await window.addAssetBlock(); out.push([...sec.querySelectorAll('.asset-block')].find((x) => !before.has(x)).id); }
    const m = await import('/js/props/_fill-section.js');
    { const it = m.fillKindOf(document.getElementById(out[1])); it.k.paint(it.block, '#12ab34'); }
    document.getElementById(out[2]).dataset.bgColor = 'transparent';
    window.deselectAll(); return out; });
  const entry = (id) => page.evaluate((id) => { const j = window.buildFigmaExportJSON(null); let hit = null;
    (function walk(o) { if (!o || typeof o !== 'object' || hit) return; if (o.id === id && o.type) { hit = o; return; } Object.values(o).forEach(walk); })(j); return hit ? JSON.parse(JSON.stringify(hit)) : null; }, id);
  const a = await entry(ids[0]), b = await entry(ids[1]), t = await entry(ids[2]);
  expect([a?.type, b?.type, t?.type], '[전제] 셋 다 image 항목').toEqual(['image', 'image', 'image']);
  expect(['bg' in a, 'fillHidden' in a], '[지킴] 키 없음 = bg·fillHidden 0').toEqual([false, false]);
  expect('bg' in t, "[지킴] 'transparent' = bg 0").toBe(false);
  expect(String(b.bg).toLowerCase(), '★배경색이 Figma JSON bg 로').toMatch(/^(#12ab34|rgb\(18, 171, 52\))$/);
  expect('fillHidden' in b, '안 숨기면 키 0').toBe(false);
  await page.evaluate(async (id) => { const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(document.getElementById(id)); m.fillSetHidden(it.block, it.k, true); }, ids[1]);
  const b1 = await entry(ids[1]);
  expect([b1.fillHidden, String(b1.bg).toLowerCase()], '★숨기면 fillHidden · 색 그대로').toEqual([true, String(b.bg).toLowerCase()]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F8b(미카사 F7/F8 실기 12k · 지디 OK 261125) — D35 원·네모·별 스티커 → Figma JSON(예전: bg 빈 값 · radius 0 · 글 0 = Figma 빈 프레임)
 *   ★원 = bg 화면 배경색 · radius = 짧은 변 ÷ 2 · 글 · ★네모 = radius 계산 px(>0) · ★별 = svg 에 stk-burst · [지킴] 글 스티커 bg = bgColor 그대로(+글이 이제 실림)
 * 양성대조: 고치기 전 판 1f00271d0 에서 D35 빨강 */
test('D35 원·네모·별 스티커 — Figma JSON bg·둥글기·글·별 svg', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    for (const o of [{ shape: 'circle' }, { shape: 'square' }, { shape: 'burst' }, { shape: 'text' }]) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.sticker-block')); window.addStickerBlock(o);
      out.push([...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x)).id); }
    const t = document.getElementById(out[3]); t.dataset.bgColor = '#12ab34'; window.renderStickerBlock(t); return out; });
  const entry = (id) => page.evaluate((id) => { const j = window.buildFigmaExportJSON(null); let hit = null;
    (function walk(o) { if (!o || typeof o !== 'object' || hit) return; if (o.id === id && o.type) { hit = o; return; } Object.values(o).forEach(walk); })(j); return hit ? JSON.parse(JSON.stringify(hit)) : null; }, id);
  const live = (id) => page.evaluate((id) => { const e = document.getElementById(id); const cs = getComputedStyle(e); return { bg: cs.backgroundColor, w: e.offsetWidth, h: e.offsetHeight, shape: e.dataset.shape }; }, id);
  const [c, q, b, t] = [await entry(ids[0]), await entry(ids[1]), await entry(ids[2]), await entry(ids[3])];
  const lc = await live(ids[0]);
  expect([c?.kind, q?.kind, b?.kind, t?.kind], '[전제] 넷 다 generic sticker').toEqual(['sticker', 'sticker', 'sticker', 'sticker']);
  expect([lc.shape, c.bg], '★원 bg = 화면 배경색').toEqual(['circle', lc.bg]);
  expect(c.radius, '★원 둥글기 = 짧은 변 ÷ 2').toBe(Math.round(Math.min(lc.w, lc.h) / 2));
  expect(c.texts.map((x) => x.t).join('|'), '★원 글이 실린다').toMatch(/\S/);
  expect(q.radius > 0 && q.bg !== '', `★네모 둥글기 px·bg (${q.radius} · ${q.bg})`).toBe(true);
  expect(/class="[^"]*stk-burst/.test(b.svg || ''), '★별 svg = stk-burst').toBe(true);
  expect([c.svg, q.svg, t.svg], '[지킴] 원·네모·글 스티커는 svg 안 실음(렌더러가 그리는 건 별 몸뿐)').toEqual(['', '', '']);
  expect(String(t.bg).toLowerCase(), '[지킴] 글 스티커 bg = bgColor').toBe('#12ab34');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 85행 FIGMA-GENERIC-TEXT-STYLE-LOST-01(미카사 2차 실기) — D36 쿠폰 줄(.tb-cpn-line)·스티커 글(.sticker-text) → Figma JSON 글 꼴
 *   예전: 사본 DOM 의 계산 style 을 읽어 크기 24·색 #111·자리 0·굵기 없음(=Figma 검정·보통·왼위·작게) · 고침: 살아 있는 짝에서 크기·색·굵기·자리·폭·정렬
 *   ★글마다 = 살아 있는 요소의 fontSize·color·fontWeight 와 같음 · 폭 w > 0(자리 잰 표) · 스티커 글 정렬 CENTER
 * 양성대조: 고치기 전 판 48e155c14 에서 D36 빨강 */
test('D36 쿠폰·스티커 글 꼴 — Figma JSON 크기·색·굵기·자리 = 화면', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    window.deselectAll(); window.selectSection(sec); { const before = new Set(sec.querySelectorAll('.sticker-block')); window.addStickerBlock({ shape: 'circle' }); out.push([...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x)).id); }
    window.deselectAll(); window.selectSection(sec); { const before = new Set(sec.querySelectorAll('.coupon-block')); await window.addCouponBlock(); out.push([...sec.querySelectorAll('.coupon-block')].find((x) => !before.has(x)).id); }
    return out; });
  const res = await page.evaluate((ids) => { const j = window.buildFigmaExportJSON(null); const find = (id) => { let hit = null; (function walk(o) { if (!o || typeof o !== 'object' || hit) return; if (o.id === id && o.type) { hit = o; return; } Object.values(o).forEach(walk); })(j); return hit; };
    return ids.map((id) => { const e = find(id); const live = [...document.getElementById(id).querySelectorAll('.sticker-text, .tb-cpn-line')].filter((x) => (x.innerText || '').trim());
      return { kind: e?.kind, texts: (e?.texts || []).map((t) => ({ t: t.t, fs: t.fs, color: t.color, fw: t.fw, w: t.w, align: t.align })),
        live: live.map((x) => { const cs = getComputedStyle(x); return { t: x.innerText.trim(), fs: parseInt(cs.fontSize), color: cs.color, fw: parseInt(cs.fontWeight) }; }) }; }); }, ids);
  for (const r of res) {
    expect(r.live.length > 0, `[전제] ${r.kind} 살아 있는 글 있음`).toBe(true);
    for (const l of r.live) {
      const e = r.texts.find((t) => t.t === l.t);
      expect(e, `★${r.kind} 글 «${l.t}» 이 JSON 에 없다`).toBeTruthy();
      expect([e.fs, e.color, e.fw], `★${r.kind} «${l.t}» 꼴(크기·색·굵기) ≠ 화면 ${JSON.stringify(l)}`).toEqual([l.fs, l.color, l.fw]);
      expect(e.w > 0, `★${r.kind} «${l.t}» 자리 폭 없음`).toBe(true);
    }
  }
  expect(res[0].texts[0].align, '★스티커 글 가운데').toBe('CENTER');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 86행(+81행 ②) — D37·D38 캔버스 레이어 모드 → Figma JSON «canvas-layers»(예전: card-grid · cards 0 · 배경·내용 0)
 *   D37 ★배경 = grid.bg · 숨기면 grid.bgHidden · 색 그대로 · [지킴] 심플 모드 = card-grid 그대로(키 목록 = 옛 그대로 · canvas-layers 0)
 *   D38 ★layers = dataset.layers 와 같은 꼴(알려진 칸) · grid(칸 수·틈·칸 크기) · scale = 살아 있는 .cvb-inner 배율 · ★그림 레이어 goya-asset:// → Inlined 후처리로 data URI(빈 그림 0 · IPC 만 가짜)
 * 양성대조: 고치기 전 판 c384ce4aa 에서 D37·D38 빨강 */
const CV_LAYERS = [{ type: 'shape', x: 20, y: 20, w: 120, h: 80, color: '#ff0000', radius: 8 }, { type: 'text', x: 30, y: 150, w: 260, h: 40, content: '레이어 글', fontSize: 28, color: '#000000' }];
const CARD_GRID_KEYS = ['type', 'id', 'cards', 'gridCols', 'gridRows', 'cardGap', 'canvasW', 'canvasH', 'radius', 'imgRatio', 'cardMode', 'textBg', 'labelPos', 'overlayHeight', 'overlayWidth', 'gradientBg', 'imgShape', 'titleSize', 'descSize', 'titleColor', 'descColor', 'iconColor', 'textAlign', 'padX', 'height'];
async function addCanvases(page, list) {
  return page.evaluate(async (list) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    for (const opts of list) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.canvas-block')); window.addCanvasBlock(opts); out.push([...sec.querySelectorAll('.canvas-block')].find((x) => !before.has(x)).id); }
    return out; }, list);
}
const cvEntry = (page, id, inlined) => page.evaluate(async ([id, inlined]) => { const j = inlined ? await window.buildFigmaExportJSONInlined(null) : window.buildFigmaExportJSON(null); let hit = null;
  (function walk(o) { if (!o || typeof o !== 'object' || hit) return; if (o.id === id && o.type) { hit = o; return; } Object.values(o).forEach(walk); })(j); return hit ? JSON.parse(JSON.stringify(hit)) : null; }, [id, inlined]);
test('D37 캔버스 레이어 모드 배경 — canvas-layers grid.bg · 숨김 키 · [지킴] 심플 모드 card-grid 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await addCanvases(page, [{ bg: '#12ab34', canvasW: 360, canvasH: 300, layers: CV_LAYERS }, {}]);
  const L = await cvEntry(page, ids[0]), S = await cvEntry(page, ids[1]);
  expect(L?.type, '★레이어 모드 = canvas-layers').toBe('canvas-layers');
  expect([String(L.grid.bg).toLowerCase(), 'bgHidden' in L.grid], '★배경 = grid.bg · 안 숨기면 키 0').toEqual(['#12ab34', false]);
  expect([S?.type, Object.keys(S || {})], '[지킴] 심플 모드 = card-grid 옛 키 목록 그대로').toEqual(['card-grid', CARD_GRID_KEYS]);
  await page.evaluate(async (id) => { const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(document.getElementById(id)); m.fillSetHidden(it.block, it.k, true); }, ids[0]);
  const L1 = await cvEntry(page, ids[0]);
  expect([L1.grid.bgHidden, String(L1.grid.bg).toLowerCase()], '★숨기면 bgHidden · 색 그대로').toEqual([true, '#12ab34']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('D38 캔버스 레이어 내용 — layers·grid·scale = 화면 · 그림 레이어 goya-asset → data URI', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  await page.evaluate((PNG) => { window.electronAPI = { ...(window.electronAPI || {}), assetsReadAsDataUri: async ({ projectId, filename }) => (projectId === 'proj_x' && filename === 'a1.png' ? { ok: true, dataUri: PNG } : { ok: false }) }; }, PNG);
  const layers = [...CV_LAYERS, { type: 'image', x: 200, y: 20, w: 100, h: 100, src: 'goya-asset://proj_x/a1.png', radius: 4 }];
  const [id] = await addCanvases(page, [{ bg: '#12ab34', canvasW: 360, canvasH: 300, gridCols: 2, gridRows: 2, cardGap: 12, layers }]);
  const E = await cvEntry(page, id), live = await page.evaluate((id) => { const b = document.getElementById(id); const m = /scale\(([\d.]+)\)/.exec(b.querySelector('.cvb-inner').style.transform); return { scale: m ? parseFloat(m[1]) : null, w: b.offsetWidth, layers: JSON.parse(b.dataset.layers), cw: parseInt(b.dataset.canvasW) || 360, ch: parseInt(b.dataset.canvasH) || 400 }; }, id);
  expect(E?.type).toBe('canvas-layers');
  expect(E.layers, '★layers = dataset.layers(알려진 칸)').toEqual(live.layers.map((l) => Object.fromEntries(Object.entries(l).filter(([k, v]) => ['type', 'x', 'y', 'w', 'h', 'color', 'radius', 'src', 'content', 'fontSize', 'fontWeight', 'align'].includes(k) && v !== '' && v != null))));
  expect([E.grid.cols, E.grid.rows, E.grid.gap, E.grid.cellW, E.grid.cellH], '★칸 그리드(칸 크기 = 앱이 그리는 dataset 값)').toEqual([2, 2, 12, live.cw, live.ch]);
  expect([E.scale, E.width], '★scale·폭 = 살아 있는 블럭').toEqual([live.scale, live.w]);
  const I = await cvEntry(page, id, true);
  const img = I.layers.find((l) => l.type === 'image');
  expect(String(img.src).startsWith('data:image/png;base64,'), `★그림 레이어가 data URI 로 안 바뀜(빈 그림): ${String(img.src).slice(0, 40)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 74행 ASSET-BG-NOKEY-FALSE-ON-DISPLAY-01 — D39 새 에셋(bgColor 키 없음)은 캔버스 = 체커(칠 없음)인데 패널은 «켬·A0A0A0» 이었다(거짓 표시)
 *   ★키 없음 → 패널 «칠 없음 — ＋ 로 더하기»(.ui-fill[data-empty]) · 머리 ＋ · 캔버스 체커 그대로 · ＋ 누르면 칠 생김·패널 켬 · [지킴] 색 지정한 에셋 = 켬
 * 양성대조: 고치기 전 판(fillOn = bgColor !== 'transparent') 에서 D39 빨강 */
test('D39 새 에셋(키 없음) 패널 = 칠 없음 · ＋ 로 더하면 켬 · [지킴] 색 있는 에셋 = 켬', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const st = (id) => page.evaluate((id) => { const b = document.getElementById(id); window.selectBlock?.(id); window.showAssetProperties(b);
    const f = document.querySelector('#panel-right [data-part="fill"]'); const cs = getComputedStyle(b);
    return { key: b.dataset.bgColor ?? null, empty: f?.dataset.empty === '1', none: !!document.querySelector('#panel-right .ui-fill-none'), add: !!document.getElementById('asset-fill-add'), checker: /repeating-conic/.test(cs.backgroundImage) }; }, id);
  const ids = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    for (let i = 0; i < 2; i++) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.asset-block')); await window.addAssetBlock(); out.push([...sec.querySelectorAll('.asset-block')].find((x) => !before.has(x)).id); }
    const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(document.getElementById(out[1])); it.k.paint(it.block, '#12ab34'); return out; });
  const a0 = await st(ids[0]);
  expect([a0.key, a0.checker], '[전제] 새 에셋 = 키 없음 · 캔버스 체커').toEqual([null, true]);
  expect([a0.empty, a0.none, a0.add], `★키 없음인데 패널이 «켬»(거짓 표시) ${JSON.stringify(a0)}`).toEqual([true, true, true]);
  await page.evaluate(() => document.getElementById('asset-fill-add').click());
  const a1 = await st(ids[0]);
  expect([a1.key !== null && a1.key !== 'transparent', a1.empty, a1.add, a1.checker], `＋ 뒤 = 칠 생김 · 패널 켬 · 체커 없음 ${JSON.stringify(a1)}`).toEqual([true, false, false, false]);
  const b0 = await st(ids[1]);
  expect([b0.empty, b0.add], '[지킴] 색 지정 에셋 = 켬').toEqual([false, false]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 74행 곁(지디 261125) — D40 «두 길 같은 결과»: 키 없는 에셋 = 단일 패널 «칠 없음» ⇔ 여러 고름도 «칠 없음»(옛: 여러 고름은 #a0a0a0 색으로 셈)
 *   ★키 없는 에셋 둘 = 여러 고름 Fill «칠 없음»(.ui-fill[data-empty]) · 색 칸 없음 · 단일 패널도 «칠 없음» · ★키 없음 + 색 = Mix · [지킴] 색 둘 같음 = 그 색
 * 양성대조: 고치기 전 판(cf680cce1) 에서 D40 빨강 */
test('D40 여러 고름 Fill — 키 없는 에셋 = 단일 패널과 같은 «칠 없음» · 섞이면 Mix · [지킴] 같은 색', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    for (let i = 0; i < 3; i++) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.asset-block')); await window.addAssetBlock(); out.push([...sec.querySelectorAll('.asset-block')].find((x) => !before.has(x)).id); }
    return out; });
  const open = (sel) => page.evaluate((sel) => { window.deselectAll(); sel.forEach((id) => document.getElementById(id).classList.add('selected')); window.showFlowMultiSelPanel(); }, sel);
  const ui = () => page.evaluate(() => { const f = document.querySelector('#panel-right .prop-section[data-sec="fill"]'), part = f?.querySelector('[data-part="fill"]'), hx = document.getElementById('msp-fill-hex');
    return { fill: !!f, empty: part?.dataset.empty === '1', hex: hx ? hx.value : null, mixed: !!f?.querySelector('.ui-fill-mixed') }; });
  const single = (id) => page.evaluate((id) => { window.deselectAll(); window.selectBlock?.(id); window.showAssetProperties(document.getElementById(id)); return document.querySelector('#panel-right [data-part="fill"]')?.dataset.empty === '1'; }, id);
  expect(await single(ids[0]), '[전제] 단일 패널 = 칠 없음').toBe(true);
  await open([ids[0], ids[1]]);
  expect(await ui(), '★키 없는 에셋 둘 = 여러 고름도 «칠 없음»(색 칸 0)').toEqual({ fill: true, empty: true, hex: null, mixed: false });
  await page.evaluate(async (id) => { const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(document.getElementById(id)); it.k.paint(it.block, '#12ab34'); }, ids[2]);
  await open([ids[0], ids[2]]);
  expect((await ui()).mixed, '★키 없음 + 색 = Mix').toBe(true);
  await page.evaluate(async (id) => { const m = await import('/js/props/_fill-section.js'); const it = m.fillKindOf(document.getElementById(id)); it.k.paint(it.block, '#12ab34'); }, ids[1]);
  await open([ids[1], ids[2]]);
  const same = await ui(); same.hex = String(same.hex).toLowerCase();   // 색 칸은 대문자로 보여줌(12AB34) — 값만 견줌
  expect(same, '[지킴] 같은 색 둘 = 그 색').toEqual({ fill: true, empty: false, hex: '12ab34', mixed: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 71행 FIGMA-FRAME-BG-IMAGE-MISSING-01 — D41 프레임 배경 그림 → Figma JSON frame bgImg·bgSize(prop-frame 과 같은 꼴: dataset.bgImg = 원문 src)
 *   ★그림 프레임 = bgImg 원문·bgSize · ★goya-asset:// → Inlined 후처리 data URI · [지킴] 그림 없는 프레임·자리표시(bgImgEmpty) = 키 0
 * 양성대조: 고치기 전 판(5b1a07b19) 에서 D41 빨강 */
test('D41 프레임 배경 그림 — Figma JSON bgImg·bgSize · goya-asset → data URI · [지킴] 없음·자리표시 = 키 0', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  await page.evaluate((PNG) => { window.electronAPI = { ...(window.electronAPI || {}), assetsReadAsDataUri: async ({ projectId, filename }) => (projectId === 'proj_x' && filename === 'f1.png' ? { ok: true, dataUri: PNG } : { ok: false }) }; }, PNG);
  const ids = await page.evaluate(async (PNG) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); const out = [];
    for (let i = 0; i < 4; i++) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.frame-block:not([data-text-frame])')); await window.addFrameBlock(); out.push([...sec.querySelectorAll('.frame-block:not([data-text-frame])')].find((x) => !before.has(x)).id); }
    const put = (id, src) => { const f = document.getElementById(id); f.style.backgroundImage = `url('${src}')`; f.dataset.bgImg = src; };
    put(out[0], PNG); document.getElementById(out[0]).dataset.bgSize = 'contain';
    put(out[1], 'goya-asset://proj_x/f1.png');
    const e = document.getElementById(out[3]); e.dataset.bgImg = PNG; e.dataset.bgImgEmpty = '1';
    return out; }, PNG);
  const entry = (id, inlined) => page.evaluate(async ([id, inlined]) => { const j = inlined ? await window.buildFigmaExportJSONInlined(null) : window.buildFigmaExportJSON(null); let hit = null;
    (function walk(o) { if (!o || typeof o !== 'object' || hit) return; if (o.id === id && o.type) { hit = o; return; } Object.values(o).forEach(walk); })(j); return hit ? JSON.parse(JSON.stringify(hit)) : null; }, [id, inlined]);
  const A = await entry(ids[0]), B = await entry(ids[1], true), C = await entry(ids[2]), D = await entry(ids[3]);
  expect([A?.type, A?.bgImg, A?.bgSize], '★그림 프레임 = bgImg 원문·bgSize').toEqual(['frame', PNG, 'contain']);
  expect(String(B?.bgImg).startsWith('data:image/png;base64,'), `★goya-asset 그림이 data URI 로 안 바뀜: ${String(B?.bgImg).slice(0, 40)}`).toBe(true);
  expect([C?.type, 'bgImg' in (C || {}), 'bgSize' in (C || {})], '[지킴] 그림 없는 프레임 = 키 0').toEqual(['frame', false, false]);
  expect('bgImg' in (D || {}), '[지킴] 자리표시(bgImgEmpty) = 키 0').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 87행 FRAME-BG-CONTAIN-REPEATS-01 — D42 프레임 배경 그림 «Contain» = 그림 하나(지디 261125 · Figma FIT 과 같은 뜻) · Cover 는 옛 그대로
 *   ★캔버스(본체·::before 반투명 길) computed no-repeat · 열기(serialize → applyProjectData) 뒤 그대로 · PNG(CDP) 빨강 넓이 ≈ 그림 하나 · HTML 내보내기 computed no-repeat
 *   [지킴] Cover = repeat 그대로 · 인라인 단축 background 그대로(옛 바이트)
 * 양성대조: _patches/d87-CTL-product.patch(제품 고침 되돌림) ⇒ D42 빨강 */
test('D42 프레임 배경 Contain = 반복 없음(캔버스·::before·열기·PNG·HTML) · [지킴] Cover 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
  const BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC';
  const build = async () => { const errs = await bootApp(page);
    const ids = await page.evaluate(async ([RED, BLUE]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
      const sec = await window.addSection(); sec.id = 'sD42'; sec.style.backgroundColor = '#ffffff'; const out = [];
      for (const src of [RED, BLUE, RED]) { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.frame-block:not([data-text-frame])')); await window.addFrameBlock();
        const f = [...sec.querySelectorAll('.frame-block:not([data-text-frame])')].find((x) => !before.has(x)); f.style.width = '400px'; f.style.height = '100px'; f.style.minHeight = '0px';
        /* prop-frame 그림 고르기와 같은 손(ss-bg-img-input onload) */
        f.style.backgroundImage = `url('${src}')`; f.style.backgroundSize = window.frameBgSize(f); f.style.backgroundPosition = 'center'; f.dataset.bgImg = src; out.push(f.id); }
      return out; }, [RED, BLUE]);
    return { errs, ids }; };
  const { errs, ids } = await build();
  for (const i of [0, 2]) {   /* 패널 «사이즈» = Contain (실 배선) */
    await page.evaluate((id) => { const f = document.getElementById(id); window.deselectAll(); window.selectBlock(id); window.showFrameProperties(f); }, ids[i]);
    await page.selectOption('#ss-bg-size', 'contain');
  }
  await page.evaluate((id) => { const f = document.getElementById(id); f.dataset.bgOpacity = '0.5'; f.style.setProperty('--frame-bg-opacity', '0.5'); f.classList.add('has-bg-opacity'); window.syncFrameBgVars(f); }, ids[2]);   /* ::before 길 — frame-bg.js setFrameBgOpacity 몸통(창에 안 걸림) 그대로 */
  const rep = (ids) => page.evaluate((ids) => ids.map((id) => { const f = document.getElementById(id); return { size: f.dataset.bgSize ?? null, rep: getComputedStyle(f).backgroundRepeat, before: getComputedStyle(f, '::before').backgroundRepeat, rl: f.style.backgroundRepeat }; }), ids);
  const live = await rep(ids);
  const snap = await page.evaluate(() => window.serializeProject());
  /* PNG — 실앱 capture-section-cdp 를 같은 CDP 명령으로 흉내(stroke-std installCdpCapture 와 같은 손) */
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height }) => (await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: 1 }, captureBeyondViewport: true, fromSurface: true })).data);
  const png = await page.evaluate(async () => { const old = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : old?.[k]) });
    const url = await window.exportSection(document.getElementById('sD42'), 'png', 860, { returnDataUrl: true }); window.electronAPI = old;
    if (typeof url !== 'string' || !url.startsWith('data:image/png')) return { err: 'not png' };
    const i = new Image(); i.src = url; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let red = 0, blue = 0;
    for (let k = 0; k < d.length; k += 4) { if (d[k] > 200 && d[k + 1] < 60 && d[k + 2] < 60) red++; if (d[k] < 60 && d[k + 1] < 60 && d[k + 2] > 200) blue++; }
    return { red, blue, w: i.width }; });
  /* HTML — 받은 파일을 그대로 다른 탭에 띄워 computed 를 잰다 */
  const [dh] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => { window.exportHTMLFile(); return null; })]);
  const html = require('fs').readFileSync(await dh.path(), 'utf8');
  const hp = await page.context().newPage();
  await hp.setContent(html, { waitUntil: 'domcontentloaded' });
  const htm = await hp.evaluate((ids) => ids.map((id, i) => { const f = document.getElementById(id); return f ? getComputedStyle(f, i === 2 ? '::before' : null).backgroundRepeat : null; }), ids);   /* 셋째 = ::before 길(본체는 그림 비움) */
  await hp.close();
  /* 열기 — 저장본을 새 부팅에 얹는다 */
  const errs2 = await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction((id) => !!document.getElementById(id), ids[0]);
  const reopened = await rep(ids);
  console.log('[D42 실측]', JSON.stringify({ live, png, htm, reopened }));
  expect(live.slice(0, 2).map((x) => [x.size, x.rep]), '★캔버스 Contain = no-repeat · [지킴] Cover = repeat(옛 그대로)').toEqual([['contain', 'no-repeat'], [null, 'repeat']]);
  expect(live[2].before, '★반투명(::before) 길 Contain = no-repeat').toBe('no-repeat');
  expect(live.map((x) => x.rl), '★인라인 반복 = Contain 만 no-repeat · [지킴] Cover = 단축 그대로(initial · 옛 바이트) · ::before 길 = 본체 비움').toEqual(['no-repeat', 'initial', '']);
  expect(reopened.slice(0, 2).map((x) => x.rep), '★열기 뒤 그대로').toEqual(['no-repeat', 'repeat']);
  expect(reopened[2].before, '★열기 뒤 ::before 그대로').toBe('no-repeat');
  /* 빨강 프레임 400×100 · Contain = 100×100 하나(≈10000) · 반복이면 ≈40000 · 파랑 Cover 400×100 ≈ 40000 */
  expect(png.red, `★PNG Contain 빨강 = 그림 하나 넓이(${png.red})`).toBeGreaterThan(5000);
  expect(png.red, `★PNG Contain 빨강 = 반복 없음(${png.red})`).toBeLessThan(15000);
  expect(png.blue, `[지킴] PNG Cover 파랑 = 상자 가득(${png.blue})`).toBeGreaterThan(35000);
  expect(htm, '★HTML 내보내기 Contain = no-repeat · [지킴] Cover = repeat · ::before 길 = no-repeat').toEqual(['no-repeat', 'repeat', 'no-repeat']);
  /* Contain → Cover 되돌리면 반복도 돌아온다(우리가 박은 no-repeat 만 걷음) */
  await page.evaluate((id) => { const f = document.getElementById(id); window.deselectAll(); window.selectBlock(id); window.showFrameProperties(f); }, ids[0]);
  await page.selectOption('#ss-bg-size', 'cover');
  expect(await page.evaluate((id) => { const f = document.getElementById(id); return [f.style.backgroundRepeat, getComputedStyle(f).backgroundRepeat]; }, ids[0]), '★Cover 로 되돌림 = 인라인 반복 걷힘 · repeat').toEqual(['', 'repeat']);
  expect(errs, errs.join(' | ')).toEqual([]);
  expect(errs2, errs2.join(' | ')).toEqual([]);
});
