/* canvas-shift-toggle.dom.spec.js — MARK-MULTISELECT-PICKS-UNSELECTED-MIDDLE-01 캔버스 쪽 (현빈 0.9.10 · 7119 「권장대로 ㄱㄱ」)
 *   캔버스에서 섹션·칸(col) ⇧클릭 = ⌘클릭 = 피그마식 토글(하나씩 더하기·빼기). 옛 ⇧ 범위(사이까지)는 없앴다. 마키는 무접촉.
 *   C1 섹션: s1 클릭 → s3 히트존 ⇧클릭 ⇒ s1·s3 (사이 s2 아님) → s3 몸통 ⇧ 다시 ⇒ s1 → s2 몸통 ⇧ ⇒ s1·s2 · ⌘ 로도 같은 결과
 *   C2 칸: A 일반 클릭(기준점) 뒤 C ⇧클릭 ⇒ A·C (사이 B 아님) → C ⇧ 다시 ⇒ 빠짐 · ⌘ 로도 같은 결과
 * ★양성대조: editor.js 의 ⇧ 범위 갈래를 되돌리면(base 3e1ef987d) C1·C2 의 ⇧ 칸 빨강. 진짜 마우스. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = (id, inner = '<div class="gap-block" data-type="gap" style="height:120px"></div>') => `<div class="section-block" id="${id}" data-section="1" data-name="${id}" style="background:#fff;"><div class="section-hitzone"><span class="section-label">${id}</span></div>
  <div class="section-inner" style="padding-left:40px;padding-right:40px;">${inner}</div></div>`;
const COLS = `<div class="gap-block" data-type="gap" style="height:30px"></div><div class="row" id="rC" data-layout="flex" style="display:flex;gap:20px;">${['cA', 'cB', 'cC'].map((id) => `<div class="col" id="${id}" style="flex:1;padding:30px;min-height:140px;"><div class="gap-block" data-type="gap" style="height:20px"></div></div>`).join('')}</div><div class="gap-block" data-type="gap" style="height:30px"></div>`;
async function boot(page, html) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(60); document.getElementById('canvas-wrap').scrollTop = 0; }, html);
  await page.waitForTimeout(300);
}
const pickedSec = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block.selected')].map((s) => s.id).sort());
const pickedCol = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .col.selected')].map((s) => s.id).sort());
async function clickAt(page, sel, mod, where = 'hit') {
  // 진짜 마우스 — locator.click 이 스크롤·멈춤을 기다리고 맞힌 요소를 확인한다
  await page.locator(sel).click({ position: where === 'pad' ? { x: 8, y: 8 } : where === 'body' ? { x: 10, y: 60 } : { x: 20, y: 6 }, modifiers: mod ? [mod] : [] });
  await page.waitForTimeout(700);   // 같은 자리 두 번이 더블클릭(크로미움 ~500ms)으로 안 묶이게
}

for (const mod of ['Shift', 'Meta']) {
  test(`C1 캔버스 섹션 ${mod}클릭 = 토글(사이 섹션 안 골라짐)`, async ({ page }) => {
    await boot(page, ['s1', 's2', 's3'].map((id) => SEC(id)).join(''));
    await clickAt(page, '#s1 > .section-hitzone');
    await expect.poll(() => pickedSec(page), '[전제] s1 고름').toEqual(['s1']);
    await clickAt(page, '#s3 > .section-hitzone', mod);
    await expect.poll(() => pickedSec(page), 's1·s3 만').toEqual(['s1', 's3']);
    // 고른 섹션의 히트존은 일부러 클릭을 통과시킨다(css editor-extra.css .section-block.selected .section-hitzone{pointer-events:none}) ⇒ 몸통 왼쪽 여백을 누른다
    await clickAt(page, '#s3', mod, 'body');
    await expect.poll(() => pickedSec(page), 's3 다시 = 빠짐').toEqual(['s1']);
    await clickAt(page, '#s2', mod, 'body');
    await expect.poll(() => pickedSec(page), '몸통 ⇧클릭으로도 더하기').toEqual(['s1', 's2']);
  });

  test(`C2 캔버스 칸 ${mod}클릭 = 토글(사이 칸 안 골라짐)`, async ({ page }) => {
    await boot(page, SEC('s1', COLS));
    await clickAt(page, '#cA', null, 'pad');   // 일반 클릭 = 행 활성 · 기준점(lastCol) = A (칸엔 .selected 안 붙는다 — editor.js 칸 click)
    await expect.poll(() => page.evaluate(() => document.getElementById('rC').classList.contains('row-active')), '[전제] 행 활성').toBe(true);
    await clickAt(page, '#cC', mod, 'pad');
    await expect.poll(() => pickedCol(page), 'A·C 만').toEqual(['cA', 'cC']);
    await clickAt(page, '#cC', mod, 'pad');
    await expect.poll(() => pickedCol(page), 'C 다시 = 빠짐').toEqual(['cA']);
  });
}
