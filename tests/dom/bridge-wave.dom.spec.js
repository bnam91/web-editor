/* bridge-wave — t13C-02(현빈 GO 261119 · 정정: 같은 윗변·같은 채움 꼴 · 윗/아랫변 칸 없음 · 방향 = 위상)
 * B1 브릿지 → 패널 «모양» 둥근 물결 = path 가 물결(첫 점 M0 0 · 꼬리 L860 90 L0 90 Z · 점 많음) · 높이 50 = 윗변 y 최대 50 · 방향 «골로 시작» = 첫 y 50 ·
 *    뾰족 물결 = 꼭짓점만 · ⌘Z 한 번 = 둥근 · 저장→다시 열기 = 그대로 · V 로 = 옛 V path(_buildBridgePath 와 같은 글자)
 * B2 [음성] 옛 저장본(모양 키 없음) = V 그대로 · 모르는 모양 값 = V
 * 양성대조: _patches/bridge-wave-CTL-flat.patch → B1 빨강 · 단위 W1·W2 빨강.
 * ⛔고정 대기 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    window.addBridgeBlock();
    const b = document.querySelector('#canvas .bridge-block'); b.id = 'brgT';
    window.showBridgeProperties(b);
  });
  return errs;
}
const d = (page) => page.evaluate(() => document.querySelector('#brgT svg path')?.getAttribute('d') || '');
const top = (s) => [...s.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]).slice(0, -2);
const pick = (page, id, v) => page.locator('#' + id).selectOption(v);
const slide = (page, id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const key = async (page, k) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press(k); };

test('B1 모양 둥근·뾰족 · 높이·방향 · ⌘Z · 저장 · V 로 되돌림', async ({ page }) => {
  const errs = await scene(page);
  const v0 = await d(page);
  await pick(page, 'brg-shape', 'round');
  await expect.poll(() => d(page).then((s) => s.startsWith('M0 0 ') && s.endsWith(' L860 90 L0 90 Z') && top(s).length > 40), '★둥근 물결 path').toBe(true);
  await expect(page.locator('#brg-wa-slider'), '★물결 손잡이(높이)').toHaveCount(1);
  await expect(page.locator('#brg-w-slider'), '★V 너비 손잡이 숨음').toHaveCount(0);
  await slide(page, 'brg-wa-slider', 50);
  await expect.poll(() => d(page).then((s) => Math.max(...top(s).map(([, y]) => y))), '★높이 50').toBe(50);
  await pick(page, 'brg-wp', 'trough');
  await expect.poll(() => d(page).then((s) => top(s)[0][1]), '★골로 시작 = 첫 y 50').toBe(50);
  await pick(page, 'brg-shape', 'sharp');
  await expect.poll(() => d(page).then((s) => top(s).length), '★뾰족 = 꼭짓점만(2n+1)').toBe(2 * 8 + 1);
  await key(page, 'Meta+z');
  await expect.poll(() => page.evaluate(() => document.getElementById('brgT').dataset.bridgeShape), '★⌘Z 한 번 = 둥근').toBe('round');
  const saved = await d(page);
  await page.evaluate(() => { window.flushCurrentPage?.(); const p = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(p); });
  await expect.poll(() => d(page), '★저장→다시 열기 = 그대로').toBe(saved);
  await page.evaluate(() => window.showBridgeProperties(document.getElementById('brgT')));
  await pick(page, 'brg-shape', 'v');
  await expect.poll(() => d(page), '★V 로 = 옛 V path').toBe(v0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B2 [음성] 옛 저장본·모르는 모양 = V', async ({ page }) => {
  const errs = await scene(page);
  const v0 = await d(page);
  expect(await page.evaluate(() => document.getElementById('brgT').dataset.bridgeShape ?? null), '[전제] 새 브릿지 모양 키 없음').toBeNull();
  await page.evaluate(() => { const b = document.getElementById('brgT'); b.dataset.bridgeShape = 'zigzag'; window.renderBridgeBlock(b); });
  expect(await d(page), '★모르는 값 = V').toBe(v0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
