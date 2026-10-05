/* grid-role-color-preset.dom.spec.js — E127: 프리셋을 바꾸면 그리드 줄 색도 텍스트 블럭처럼 따라간다 (2026-10-06 lane-esweep · 지디 ⓒ 확정 · 태양 승인)
 * 증상(기록 · U28 곁): brand 프리셋에서 텍스트 h2 #2d4a7a vs 그리드 h2 #1a1a1a — 그리드 역할색은 _GRID_ROLES 의 hex 를 인라인으로 박았다(grid-block.js effColor).
 * 고침: 역할색을 var(--preset-<역할>-color, <hex>) 로 — h1·h2·h3·body·caption 다섯. label · 색을 정한 줄 · 어두운 칸 줄은 그대로.
 * ★기존 문서 모양: 기본이 아닌 프리셋을 쓰는 설치에서 «색을 안 정한 그리드 줄»이 바뀐다(릴리스 노트 한 줄 · 지디 결정).
 * 머리표: [새 것] 고치기 전 빨강 · [지킴] 고치기 전에도 초록. 예측 = reports/esweep/predict-e127.md.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');
const ROLES = ['h1', 'h2', 'h3', 'body', 'caption'];

async function setup(page, preset) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'presets', 'brand.json'), 'utf8'));
  await page.evaluate(async ([preset, brand, roles]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="pS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="pI"><div class="row" id="pR" data-layout="stack"></div><div class="row" id="pD" data-layout="stack"></div><div id="pT"></div></div></div>`);
    const lines = roles.map(t => ({ type: t, text: t.toUpperCase() })).concat([{ type: 'label', text: 'LBL' }, { type: 'h2', text: 'COLORED', color: '#ff0000' }]);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines }], rows: [{ height: 600 }], cells: [[{ lines }]] });
    g.id = 'pG'; document.getElementById('pR').appendChild(g);
    const { block: gd } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'h2', text: 'DARK' }] }], rows: [{ height: 120 }], cells: [[{ lines: [{ type: 'h2', text: 'DARK' }], bg: '#111111' }]] });
    gd.id = 'pGD'; document.getElementById('pD').appendChild(gd);
    for (const t of roles) { const { block } = window.makeTextBlock(t); block.id = 'tb_' + t; document.getElementById('pT').appendChild(block); }
    window.rebindAll?.(); window.renderGridBlock(g); window.renderGridBlock(gd); window.deselectAll?.(); window.applyZoom?.(100);
    if (preset === 'brand') { window.PRESETS = [brand]; await window.DesignSystem.applyBase('brand'); }
  }, [preset, brand, ROLES]);
  await page.waitForTimeout(250);
  return errs;
}
const colors = (page) => page.evaluate((roles) => {
  const lineOf = (txt) => [...document.querySelectorAll('#pG .grd-line')].find(l => l.textContent.trim() === txt);
  const out = {};
  for (const t of roles) out[t] = { grid: getComputedStyle(lineOf(t.toUpperCase())).color, text: getComputedStyle(document.querySelector('#tb_' + t + ' [class^="tb-"]')).color };
  out.label = getComputedStyle(lineOf('LBL')).color;
  out.colored = getComputedStyle(lineOf('COLORED')).color;
  out.dark = getComputedStyle([...document.querySelectorAll('#pGD .grd-line')].find(l => l.textContent.trim() === 'DARK')).color;
  return out;
}, ROLES);

test('K1 [지킴] 기본 프리셋 — 그리드 역할 다섯 = 텍스트 블럭 같은 역할 색', async ({ page }) => {
  const errs = await setup(page, 'default');
  const c = await colors(page);
  for (const t of ROLES) expect(c[t].grid, `${t} ${JSON.stringify(c[t])}`).toBe(c[t].text);
  expect(errs).toEqual([]);
});
test('K2 [새 것] brand 프리셋 — 그리드 역할 다섯이 텍스트 블럭처럼 따라간다', async ({ page }) => {
  const errs = await setup(page, 'brand');
  const c = await colors(page);
  expect(c.h2.text, '[전제] 프리셋이 걸렸다(텍스트 h2 = brand #2d4a7a)').toBe('rgb(45, 74, 122)');
  for (const t of ROLES) expect(c[t].grid, `${t} ${JSON.stringify(c[t])}`).toBe(c[t].text);
  expect(errs).toEqual([]);
});
test('K3 [지킴] brand 에서도 label 줄 #555 · 색을 정한 줄 · 어두운 칸 줄은 그대로', async ({ page }) => {
  const errs = await setup(page, 'brand');
  const c = await colors(page);
  expect(c.label, `label ${c.label}`).toBe('rgb(85, 85, 85)');
  expect(c.colored, `색을 정한 줄 ${c.colored}`).toBe('rgb(255, 0, 0)');
  expect(c.dark, `어두운 칸 h2 = 밝은 표(#fff) ${c.dark}`).toBe('rgb(255, 255, 255)');
  expect(errs).toEqual([]);
});
