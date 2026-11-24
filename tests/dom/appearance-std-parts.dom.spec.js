/* appearance-std-parts.dom.spec.js — 표준 Appearance A4: Opacity 칸(정본 시안 8910 #mkp-appstd AP · PLAN-appearance-layout-std-261124 §3 · A4)
 *   부품 = js/props/_appearance-section.js(op) · 첫 소비자 = asset(prop-asset.js)
 *   계약(갈래 E 몫 · 여기선 시험이 가짜로 끼운다): window.setBlockOpacity(block, v 0~100) · window.readBlockOpacity(block) → 0~100
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/appearance-std-parts.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function assetScene(page, { stub = false } = {}) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (stub) => {
    if (stub) {   // 갈래 E 계약 가짜 — 100 이면 키 지움(계약 그대로)
      window.__op = [];
      window.setBlockOpacity = (b, v) => { window.__op.push(v); if (v >= 100) { delete b.dataset.opacity; b.style.opacity = ''; } else { b.dataset.opacity = String(v); b.style.opacity = String(v / 100); } };
      window.readBlockOpacity = (b) => (b.dataset.opacity != null ? Number(b.dataset.opacity) : 100);
    }
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    window.addAssetBlock();
  }, stub);
  await expect(page.locator('#asset-opacity')).toHaveCount(1);
  return errs;
}
const lastAsset = "[...document.querySelectorAll('#canvas .asset-block')].pop()";
const setNum = (page, id, v) => page.evaluate(([id, v]) => { const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const countHistory = (page) => page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });

test('AO1 asset Appearance = 작은 라벨 «Opacity | Corner radius» · 한 줄 [불투명 칸 %][모서리 칸] + 끝 모서리 따로 · 계약 없으면 100', async ({ page }) => {
  const errs = await assetScene(page);
  const o = await page.evaluate(() => {
    const part = document.querySelector('#panel-right [data-part="appearance"]');
    const row = part?.querySelector('.ui-s2-main');
    return {
      labels: [...(row?.querySelectorAll(':scope > .ui-s2-cell > span') || [])].map((s) => s.textContent),
      field: !!document.getElementById('asset-opacity')?.closest('[data-part="appearance"] [data-field="appearance-opacity"]'),
      unit: document.querySelector('[data-field="appearance-opacity"] .ui-app-unit')?.textContent ?? null,
      v: document.getElementById('asset-opacity')?.value,
      order: [...(row?.children || [])].map((c) => c.querySelector('input')?.id || c.id),
      slider: !!document.querySelector('#panel-right .prop-section[data-sec="appearance"] input[type=range]'),
      h: Math.round(document.querySelector('[data-field="appearance-opacity"]')?.getBoundingClientRect().height || 0),
    };
  });
  expect(o).toEqual({ labels: ['Opacity', 'Corner radius'], field: true, unit: '%', v: '100', order: ['asset-opacity', 'asset-r-number', 'asset-corners'], slider: false, h: 24 });
  expect(errs).toEqual([]);
});

test('AO2 asset Opacity 칸 → setBlockOpacity(입력 = 바로 · change = 잘라 + 이력 1) · 150 → 100 · 라벨 끌기 −5 = 이력 1', async ({ page }) => {
  const errs = await assetScene(page, { stub: true });
  await countHistory(page);
  await setNum(page, 'asset-opacity', 40);
  expect(await page.evaluate((s) => [(0, eval)(s).dataset.opacity, window.__ph], lastAsset)).toEqual(['40', 1]);
  await setNum(page, 'asset-opacity', 150);
  expect(await page.evaluate((s) => [(0, eval)(s).dataset.opacity ?? null, document.getElementById('asset-opacity').value, window.__ph], lastAsset)).toEqual([null, '100', 2]);
  const h = page.locator('#asset-opacity-scrub'); await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 5, b.y + b.height / 2, { steps: 5 }); await page.mouse.up();
  await expect.poll(() => page.evaluate((s) => (0, eval)(s).dataset.opacity ?? null, lastAsset)).toBe('95');
  expect(await page.evaluate(() => window.__ph), '★끌기 한 번 = 이력 한 칸').toBe(3);
  /* 다시 그리면 readBlockOpacity 로 읽는다 */
  await page.evaluate((s) => window.showAssetProperties((0, eval)(s)), lastAsset);
  expect(await page.inputValue('#asset-opacity')).toBe('95');
  expect(errs).toEqual([]);
});

test('AO3 부품 — op 만(모서리 없음) · Mixed = placeholder + data-empty="invalid" · op 없으면 옛 꼴(Corner radius 하나)', async ({ page }) => {
  const errs = await bootApp(page);
  const o = await page.evaluate(async () => {
    const m = await import('/js/props/_appearance-section.js');
    const d = document.createElement('div');
    d.innerHTML = m.appearanceSectionHTML({ prefix: 'zz', op: { value: 30, mixed: true }, radius: null });
    const n = d.querySelector('#zz-opacity');
    const d2 = document.createElement('div');
    d2.innerHTML = m.appearanceSectionHTML({ prefix: 'yy', radius: { numberId: 'yy-r', value: 4, max: 10 } });
    return { ph: n?.placeholder, empty: n?.dataset.empty, val: n?.value, max: n?.max, corners: !!d.querySelector('#zz-corners'),
      old: [...d2.querySelectorAll('.ui-s2-cell > span')].map((s) => s.textContent), oldOp: !!d2.querySelector('[data-field="appearance-opacity"]') };
  });
  expect(o).toEqual({ ph: 'Mixed', empty: 'invalid', val: '', max: '100', corners: false, old: ['Corner radius'], oldOp: false });
  expect(errs).toEqual([]);
});
