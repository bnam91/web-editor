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
