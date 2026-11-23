/* holo-replica — FX-GRADIENT-GAZE-01 «GradientGaze 16 재현»(현빈 261123 승인 · 미카사 261123 실측 표 ① · 시안 _patches/holo-mock/holo-mock-3col.png) · 태양
 *   고침: js/fx/holo-palette.js GAZE_PRESETS 16(값 = 플러그인 · key = 옛 이름 · 이름 Holo NN · GAZE_CONIC_FROM 90) · js/effects-holo.js(새 원뿔 시작 90° · 스와치 이름)
 * R1 [지킴] 이미 넣은 블럭 색 무변 — 옛 «prism»(원뿔 0° · 옛 정지점)을 넣어 둔 도형을 저장·다시 열고 패널을 그려도 칠(shapeGradient) 그대로 · 카드는 그 칸(Holo 13)을 눌린 칸으로
 * R2 새로 고르면 새 값 — «gold»(Holo 02 · Angular) → 도형 칠 = conic · 시작각 90 · 첫 정지점 #b6d0f7
 * R3 스와치 16 = 이름 Holo 01~16(짝수 «· 원뿔형») · 순서 = 플러그인 격자
 * 양성대조: _patches/holo-replica-CTL.patch(팔레트·시작각 되돌림) ⇒ R2·R3 빨강 · R1 도 빨강이지만 «이름 Holo 13» 단언 때문(실측) — R1 의 칠 무변 단언 자체는 고침과 무관한 지킴.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const OLD_PRISM = [['#ff9ec4', 0], ['#ffd59e', 0.2], ['#f8ff9e', 0.38], ['#9effc8', 0.55], ['#9ed8ff', 0.72], ['#c99eff', 0.88], ['#ff9ec4', 1]];   // origin/dev 0669f5253 holo-palette.js «prism» 그대로

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block'); sec.id = 'sR'; window.deselectAll(); window.selectSection(sec);
    const before = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('ellipse'); const b = [...sec.querySelectorAll('.shape-block')].find((x) => !before.has(x)); b.id = 'shR';
    window.clearHistory?.();
  });
  await waitZoomSettled(page, 100);
  return errs;
}
const card = async (page) => {
  await page.evaluate(() => { window.selectBlock?.('shR'); window.showShapeProperties?.(document.getElementById('shR')); });
  await page.waitForFunction(() => !!(document.getElementById('shape-fxholo-card') || document.getElementById('shape-fx-add')), null, { polling: 100, timeout: 5000 });
  if (!(await page.$('#shape-fxholo-card'))) { await page.selectOption('#shape-fx-add', 'holo'); await raf(page); }
  await page.evaluate(() => { const b = document.getElementById('shape-fxholo-body'); if (b && b.hidden) document.getElementById('shape-fxholo-head').click(); });
};

test('R1 [지킴] 이미 넣은 옛 «prism» — 저장·다시 열기·패널 그려도 칠 그대로 · 카드 = Holo 13 눌림', async ({ page }) => {
  const errs = await scene(page);
  const g0 = await page.evaluate((OLD) => {
    const el = document.getElementById('shR');
    const d = { type: 'conic', angle: 0, stops: OLD.map(([color, offset]) => ({ color, offset })) }; d.css = `conic-gradient(from 0deg at 50% 50%, ${OLD.map(([c, o]) => `${c} ${Math.round(o * 100)}%`).join(', ')})`;
    window._applyShapeGradientFill(el, d);   // 옛 판 setFxHolo 가 쓰던 그 문(옛 정지점 · 시작 0°)
    el.dataset.fxHolo = JSON.stringify({ k: 'prism', a: 100, prev: { c: '#cccccc' } });
    return el.dataset.shapeGradient || null;
  }, OLD_PRISM);
  const reopened = await page.evaluate(async () => {
    const snap = window.serializeProject(); await window.applyProjectData(typeof snap === 'string' ? JSON.parse(snap) : snap);
    for (let i = 0; i < 50 && !document.getElementById('shR'); i++) await new Promise((r) => requestAnimationFrame(r));
    return document.getElementById('shR')?.dataset.shapeGradient || null;
  });
  await card(page);
  const after = await page.evaluate(() => { const sw = document.querySelector('#shape-fxholo-sws [data-holo="prism"]'); return { g: document.getElementById('shR').dataset.shapeGradient || null, pressed: sw?.getAttribute('aria-pressed'), title: sw?.getAttribute('title') }; });
  console.log('[R1 실측]', JSON.stringify({ g0: g0 && g0.slice(0, 90), same: [reopened === g0, after.g === g0], pressed: after.pressed, title: after.title }));
  expect(g0, '[전제] 옛 칠이 박힘').toBeTruthy();
  expect([reopened === g0, after.g === g0], '★저장·다시 열기·패널 그리기 뒤에도 칠 바이트 그대로').toEqual([true, true]);
  expect([after.pressed, after.title], '★카드 = 그 칸(key 그대로) · 이름 Holo 13').toEqual(['true', 'Holo 13']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R2 새로 고르면 새 값 — gold(Holo 02 · Angular) = conic 90° · 첫 정지점 #b6d0f7', async ({ page }) => {
  const errs = await scene(page);
  await card(page);
  await page.locator('#shape-fxholo-sws [data-holo="gold"]').click(); await raf(page);
  const g = await page.evaluate(() => { let m = null; try { m = JSON.parse(document.getElementById('shR').dataset.shapeGradient || 'null'); } catch (_) {} return m && { type: m.type, angle: m.angle, c0: String(m.stops?.[0]?.color || '').toLowerCase(), n: m.stops?.length }; });
  console.log('[R2 실측]', JSON.stringify(g));
  expect(g, '★Angular = conic · 3시 시작 90 · 플러그인 #2 첫 색 · 정지점 8').toEqual({ type: 'conic', angle: 90, c0: '#b6d0f7', n: 8 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R3 스와치 16 = Holo 01~16 · 짝수 원뿔형', async ({ page }) => {
  const errs = await scene(page);
  await card(page);
  const t = await page.evaluate(() => [...document.querySelectorAll('#shape-fxholo-sws .fx-holo-sw')].map((b) => b.getAttribute('title')));
  const want = Array.from({ length: 16 }, (_, i) => `Holo ${String(i + 1).padStart(2, '0')}${i % 2 ? ' · 원뿔형' : ''}`);
  expect(t, '★이름·순서·종류').toEqual(want);
  if (process.env.SHOT_HOLO) await page.locator('#shape-fxholo-card').screenshot({ path: `${process.env.SHOT_HOLO}/holo-card.png` });
  expect(errs, errs.join(' | ')).toEqual([]);
});
