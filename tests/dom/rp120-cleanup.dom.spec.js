/* rp120-cleanup.dom.spec.js — RP-CLEANUP-HINTS-HEIGHT-COMMENT-01(시트 120 · 현빈 승인 261119 · AUDIT-right-panel-261119 R8·R5·O5)
 *   지금 판(int 0e3657ad1)에서 잰 남은 것 — R8ⓐ 태그 그룹 영어 힌트 · R5 이미지 편집 «높이» 칸은 24f47fe88 에서 이미 걷힘(여기서 안 잼).
 *   C1 R8ⓑ 그라데이션 Size 힌트 — 패널 «안»에서 «우측 컨트롤»을 가리킨다 → 걷음(W/H 칸이 바로 위에 있다 · FigCraft 패널엔 안내 문단이 거의 없다 widgets.rs)
 *   C2 R8ⓒ 도형 가림막 레거시 모자이크 고지 — 내부 상태 설명(«일시 중지돼 … 되살아나면») 없이 짧게 · id·«모자이크» 낱말은 그대로(redact-mosaic-killswitch D11)
 *   C3 R8ⓓ 도형 가림막 모자이크 힌트 — 개발 말 «(mouseup)» · «실시간 추적이 아니라» 없이
 * 빨강 기대: int 0e3657ad1 = C1·C2·C3 빨강 3. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); });
  return errs;
}
const hints = (page) => page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-hint')].map((h) => h.textContent.trim()));

test('C1 그라데이션 — «우측 컨트롤» 힌트 없음', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const b = window.addGradientBlock(); const el = (b && b.id && document.getElementById(b.id)) || [...document.querySelectorAll('.gradient-block')].pop(); window.selectBlock?.(el.id); window.showGradientProperties(el); });
  await page.waitForSelector('#grad-width-num', { state: 'attached' });
  const h = await hints(page);
  expect(h.some((t) => /우측 컨트롤/.test(t)), `★C1 힌트 ${JSON.stringify(h)}`).toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C2 도형 가림막 레거시 모자이크 고지 — 내부 상태 설명 없이 · 모자이크 낱말 그대로', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const b = window.addShapeBlock('ellipse'); const el = (b && b.id && document.getElementById(b.id)) || [...document.querySelectorAll('#canvas .shape-block')].pop();
    el.dataset.shapeRedact = 'true'; el.dataset.shapeRedactMode = 'mosaic'; window.showShapeProperties(el); });
  const t = await page.evaluate(() => document.getElementById('shape-redact-legacy-note')?.textContent.trim() ?? null);
  expect(t, '[전제] 레거시 고지가 뜬다').not.toBeNull();
  expect(t, '★C2 D11 낱말').toMatch(/모자이크/);
  expect(t, '★C2 내부 상태 설명').not.toMatch(/일시 중지|되살아나면|보여 주는 중/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C3 도형 가림막 모자이크 힌트 — 개발 말(mouseup) 없음', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { window.REDACT_MOSAIC_ENABLED = true;   // 모자이크 힌트는 스위치가 켜진 판에서만 뜬다(킬스위치 feature-flags.js)
    const b = window.addShapeBlock('rectangle'); const el = (b && b.id && document.getElementById(b.id)) || [...document.querySelectorAll('#canvas .shape-block')].pop();
    el.dataset.shapeRedact = 'true'; el.dataset.shapeRedactMode = 'mosaic'; window.showShapeProperties(el); });
  await page.waitForSelector('#shape-redact-mosaic-refresh', { state: 'attached' });
  const h = await hints(page);
  const m = h.find((x) => /모자이크/.test(x));
  expect(m, `[전제] 모자이크 힌트 ${JSON.stringify(h)}`).toBeTruthy();
  expect(m, '★C3 개발 말').not.toMatch(/mouseup|실시간 추적이 아니라/);
  await page.evaluate(() => { window.REDACT_MOSAIC_ENABLED = false; });
  expect(errs.filter((e) => !/mosaic|h2c|html2canvas/i.test(e)), errs.join(' | ')).toEqual([]);
});
