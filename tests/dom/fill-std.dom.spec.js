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

test('D1 도형 Fill = 표준 부품 · 겹 줄 하나 · 옛 id · 눈 막힘 · 머리 ＋ 없음', async ({ page }) => {
  const { errs, id } = await scene(page);
  const ui = await page.evaluate(() => { const f = document.querySelector('#panel-right .prop-section[data-sec="fill"]'); const eye = document.getElementById('shape-fill-eye');
    return { ids: ['shape-color-color', 'shape-color-hex', 'shape-color-alpha', 'shape-fill-remove'].every((i) => f.contains(document.getElementById(i))), eye: eye?.getAttribute('aria-disabled'), why: !!eye?.title,
      oldLabel: [...f.querySelectorAll('.prop-label')].some((l) => l.textContent.trim() === '색상') }; });
  const s = await st(page, id);
  expect([s.layers, s.empty, s.add], '★겹 줄 하나 · 칠 있음 · 머리 ＋ 없음').toEqual([1, false, false]);
  expect(ui, '★옛 색 칸 id 그대로 · 눈 = 막힘(까닭 툴팁) · 옛 «색상» 라벨 없음').toEqual({ ids: true, eye: 'true', why: true, oldLabel: false });
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
  expect(out.asset, '★새 에셋 = 키 없음 · 옛 그대로 «켬»(A0A0A0 · 지디 (ㄴ)) · 머리 ＋ 없음').toEqual([null, 1, false]);
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
