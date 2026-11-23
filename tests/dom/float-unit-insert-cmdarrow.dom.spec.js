/* float-unit-insert-cmdarrow — 0.9.13 t13E-03(블럭이 이상한 위치에 추가 · ⌘↑/⌘↓ 안 먹음 · sec > shp_ = 섹션 «직속» 도형 = 떠 있는 도형) · 현빈 261122 · 태양
 *   탐침 실측(고치기 전): 떠 있는 도형(섹션 직속 래퍼 · data-overlay-block)을 고르고
 *     ⌘↑ = 섹션 바닥 손잡이(section-bottom-handle)와 자리만 바뀜(보이는 변화 0) · ⌘↓ = 무동작
 *     글 블럭 추가 = 새 블럭이 .section-inner 밖, 섹션 직속(껍데기 사이)에 붙음
 *   고침: js/editor.js ⌘↑/↓ — 섹션 직속 떠 있는 단위면 moveSelectedBlocks(⌘[ / ⌘] 와 같은 겹침 순서) · js/drag-utils.js insertAfterSelected — 떠 있는 래퍼가 골라졌으면 흐름 끝
 * C1 떠 있는 도형 둘(S1 아래 · S2 위) — 맨 뒤 S1 ⌘↑ = 그대로(옛 판 = 섹션 바닥 손잡이와 자리 바꿈) · S2 ⌘↑ → S1 앞(뒤로) · ⌘↓ → 되돌림
 * C2 떠 있는 도형 고르고 글 블럭 추가 → 새 블럭은 .section-inner 안(흐름 끝) · 섹션 직속 아님
 * C3 [지킴] 흐름 도형(안 띄움)은 옛 동작 — ⌘↑ 로 위 글과 자리 바꿈 · 고른 채 추가하면 그 도형 바로 뒤
 * 양성대조: _patches/insert-cmdarrow-CTL.patch(두 줄 걷음) ⇒ C1·C2 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, floats) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (floats) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sE'; window.applyZoom?.(100);
    const inner = sec.querySelector('.section-inner'); [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const add = (fn, tag) => { const before = new Set(inner.children); window.deselectAll(); window.selectSection(sec); fn(); const u = [...inner.children].find((x) => !before.has(x)); u.dataset.probe = tag; return u; };
    add(() => window.addTextBlock('body'), 'A');
    const s1 = add(() => window.addShapeBlock('rectangle'), 'S1');
    const s2 = add(() => window.addShapeBlock('ellipse'), 'S2');
    if (floats) { const m = await import(new URL('js/overlay-float.js', document.baseURI).href); m.enterFloat(s1); m.enterFloat(s2); }
    window.deselectAll(); window.clearHistory?.();
  }, floats);
  await waitZoomSettled(page, 100);
  return errs;
}
const pickShape = async (page, tag) => { await page.evaluate((tag) => { const f = document.querySelector(`#sE [data-probe="${tag}"]`); window.deselectAll(); window.selectShapeBlock(f.querySelector('.shape-block')); document.activeElement?.blur?.(); }, tag); await raf(page); };
const secKids = (page) => page.evaluate(() => [...document.getElementById('sE').children].map((x) => x.dataset.probe || x.className.split(' ')[0]));
const innerKids = (page) => page.evaluate(() => [...document.querySelector('#sE .section-inner').children].filter((x) => !x.classList.contains('drop-indicator')).map((x) => x.dataset.probe || 'new'));

test('C1 떠 있는 도형 — 맨 뒤 S1 ⌘↑ = 껍데기와 안 바뀜 · S2 ⌘↑ 뒤로 · ⌘↓ 앞으로', async ({ page }) => {
  const errs = await scene(page, true);
  const k0 = await secKids(page);
  await pickShape(page, 'S1');
  await page.keyboard.press('Meta+ArrowUp'); await raf(page);
  const kS1 = await secKids(page);   // 옛 판: S1 이 섹션 바닥 손잡이 앞으로(껍데기와 자리 바꿈 · 탐침 실측)
  await pickShape(page, 'S2');
  await page.keyboard.press('Meta+ArrowUp'); await raf(page);
  const k1 = await secKids(page);
  await page.keyboard.press('Meta+ArrowDown'); await raf(page);
  const k2 = await secKids(page);
  console.log('[C1 실측]', JSON.stringify({ k0, kS1, k1, k2 }));
  const shell = k0.filter((x) => !/^S\d$/.test(x));
  expect(kS1, '★맨 뒤에서 ⌘↑ = 그대로(섹션 껍데기와 자리 안 바꿈)').toEqual(k0);
  expect([k1, k2], '★S2 ⌘↑ = S1 앞(뒤로) · ⌘↓ = 되돌림 · 껍데기는 늘 앞 그대로').toEqual([[...shell, 'S2', 'S1'], [...shell, 'S1', 'S2']]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C2 떠 있는 도형 고른 채 글 추가 → 흐름 끝(.section-inner 안)', async ({ page }) => {
  const errs = await scene(page, true);
  await pickShape(page, 'S2');
  const k0 = await secKids(page);
  await page.evaluate(() => window.addTextBlock('body')); await raf(page);
  const r = { sec: await secKids(page), inner: await innerKids(page) };
  console.log('[C2 실측]', JSON.stringify({ k0, ...r }));
  expect(r.sec, '★섹션 직속엔 안 붙음').toEqual(k0);
  expect(r.inner, '★흐름 끝').toEqual(['A', 'new']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C3 [지킴] 흐름 도형 — ⌘↑ 자리 바꿈 · 고른 채 추가 = 바로 뒤', async ({ page }) => {
  const errs = await scene(page, false);
  await pickShape(page, 'S1');
  await page.keyboard.press('Meta+ArrowUp'); await raf(page);
  const a = await innerKids(page);
  await pickShape(page, 'S1');
  await page.evaluate(() => window.addTextBlock('body')); await raf(page);
  const b = await innerKids(page);
  console.log('[C3 실측]', JSON.stringify({ a, b }));
  expect(a, '★흐름 ⌘↑ = 위 글과 자리 바꿈').toEqual(['S1', 'A', 'S2']);
  expect(b, '★고른 흐름 도형 바로 뒤').toEqual(['S1', 'new', 'A', 'S2']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
