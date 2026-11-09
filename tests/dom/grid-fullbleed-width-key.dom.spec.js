/* grid-fullbleed-width-key.dom.spec.js — t2-08 A (현빈 0.9.11_t2 「‘좌우 패딩 제외 (전폭)’ 옵션이 정상적으로 작동하지 않음」 · 지디: A 만)
 *   결함: 너비 키(gridWidth)가 있는 그리드는 켜면 잠깐 전폭 → 다음 다시 그리기(편집·⌘Z·다시 열기)에 원래 폭으로 돌아감(체크는 켜진 채).
 *   고침: 켤 때 너비 키를 떼고 다시 그린다(폭을 정하면 전폭을 끄는 규칙의 반대 방향).
 *   K1 섹션 padX 32 · 그리드 폭 500 → 패널 스위치 켬 → 전폭(calc(100%+64px) · margin −32px) · gridWidth 없음 · 다시 그려도 그대로 · 체크 켜짐
 *   K1b ⌘Z 한 번 → 원래 500 폭 · ⌘⇧Z → 다시 전폭 · 저장→다시 열기 유지
 *   K2 [대조] 너비 키 없는 그리드는 예전처럼 켜면 전폭 · 다시 그려도 그대로
 *   K5 수지맥 프로젝트 «사본»(scratchpad · 없으면 건너뜀) grd_84a7j_u809mj3 → 켬 + 다시 그림 → 섹션 폭과 같음
 *   ⛔B(뺄 패딩 0 인 곳 스위치 숨김)는 현빈 답 대기라 이 판에 없다.
 * ★양성대조: prop-grid.js 의 t2-08 A 줄을 빼면 K1 의 «다시 그린 뒤» 단언이 빨강(500 으로 돌아감). */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { bootApp } = require('./_root-harness.js');

const PROJ = '/private/tmp/claude-501/-Users-a1-wt-srv/15280401-eb92-4115-a360-02f2d224e5e9/scratchpad/t208-proj/proj_1793847804974/proj.json';

async function setup(page, { width } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((width) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sF" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="iF" data-padding-x="32" style="padding-left:32px;padding-right:32px">
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="rF" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gF'; document.getElementById('rF').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g);
    if (width) window.applyGridOwnWidth(g, width);
    window.deselectAll?.(); window.selectBlock?.(g); window.showGridProperties(g); window.clearHistory?.();
  }, width || null);
  await expect(page.locator('#grd-use-padx')).toHaveCount(1);
  return errs;
}
const st = (page) => page.evaluate(() => {
  const g = document.getElementById('gF'), cb = document.getElementById('grd-use-padx');
  return { w: g.style.width, ml: g.style.marginLeft, key: g.dataset.gridWidth ?? null, fb: g.dataset.fullBleed ?? null, checked: cb ? cb.checked : null };
});
const toggleOn = (page) => page.evaluate(() => { const cb = document.getElementById('grd-use-padx'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
const rerender = (page) => page.evaluate(() => window.renderGridBlock(document.getElementById('gF')));
const FULL = { w: 'calc(100% + 64px)', ml: '-32px', key: null, fb: 'true', checked: true };

test('K1 너비 키 있는 그리드 — 켜면 전폭 · 다시 그려도 전폭 · 너비 키 떨어짐', async ({ page }) => {
  await setup(page, { width: 500 });
  expect((await st(page)).key, '[전제] 너비 키 500').toBe('500');
  await toggleOn(page);
  await expect.poll(() => st(page)).toEqual(FULL);
  await rerender(page);
  expect(await st(page), '★다시 그린 뒤 원래 폭으로 돌아갔다(옛 결함)').toEqual(FULL);
});

test('K1b ⌘Z 한 번 = 500 폭 · ⌘⇧Z = 전폭 · 저장→다시 열기 유지', async ({ page }) => {
  await setup(page, { width: 500 });
  await toggleOn(page);
  await expect.poll(async () => (await st(page)).key).toBe(null);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => { const s = await st(page); return [s.key, s.w]; }).toEqual(['500', '500px']);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(async () => { const s = await st(page); return [s.key, s.w, s.fb]; }).toEqual([null, 'calc(100% + 64px)', 'true']);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  await expect.poll(async () => { const g = await page.evaluate(() => { const g = document.getElementById('gF'); return g ? [g.dataset.gridWidth ?? null, g.style.width] : null; }); return g; })
    .toEqual([null, 'calc(100% + 64px)']);
});

test('K2 [대조] 너비 키 없는 그리드 — 예전처럼 전폭 · 다시 그려도 그대로', async ({ page }) => {
  await setup(page);
  await toggleOn(page);
  await expect.poll(() => st(page)).toEqual(FULL);
  await rerender(page);
  expect(await st(page)).toEqual(FULL);
});

test('K5 수지맥 프로젝트 사본 — grd_84a7j_u809mj3 켬 + 다시 그림 → 섹션 폭', async ({ page }) => {
  test.skip(!fs.existsSync(PROJ), '사본 없음(레포 밖 파일)');
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const data = fs.readFileSync(PROJ, 'utf8');
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, data);
  const ok = await page.evaluate(() => !!document.getElementById('grd_84a7j_u809mj3'));
  test.skip(!ok, '그 그리드가 이 페이지에 없음');
  await page.evaluate(() => { const g = document.getElementById('grd_84a7j_u809mj3'); g.scrollIntoView({ block: 'center' }); window.deselectAll?.(); window.selectBlock?.(g); window.showGridProperties(g); });
  await expect(page.locator('#grd-use-padx')).toHaveCount(1);
  await page.evaluate(() => { const cb = document.getElementById('grd-use-padx'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); window.renderGridBlock(document.getElementById('grd_84a7j_u809mj3')); });
  const r = await page.evaluate(() => { const g = document.getElementById('grd_84a7j_u809mj3'), s = g.closest('.section-block');
    const a = g.getBoundingClientRect(), b = s.getBoundingClientRect(); return { dw: Math.abs(a.width - b.width), dl: Math.abs(a.left - b.left) }; });
  expect(r.dw, '그리드 폭 = 섹션 폭').toBeLessThanOrEqual(1.5);
  expect(r.dl, '그리드 왼쪽 = 섹션 왼쪽').toBeLessThanOrEqual(1.5);
});
