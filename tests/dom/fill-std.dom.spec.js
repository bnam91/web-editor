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
    layers: f ? f.querySelectorAll('.ui-fill[data-part="fill"] > .ui-fill-layer[data-fill-index="0"]').length : -1, empty: !!f?.querySelector('.ui-fill[data-empty="1"]'),
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
  return { v: b.dataset[key] ?? null, layers: f ? f.querySelectorAll('.ui-fill[data-part="fill"] > .ui-fill-layer[data-fill-index="0"]').length : -1, add: !!document.getElementById(`${p}-add`), hex: document.getElementById(hex)?.value ?? null }; }, [id, K.key, K.p, K.hex]);
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
