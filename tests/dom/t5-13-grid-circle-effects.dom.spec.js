/* t5-13-grid-circle-effects.dom.spec.js — t5-13ⓐ 「그리드블럭에 원형이미지 추가한뒤 원형이미지의 그림자 효과는 어떻게 주는지?」
 *
 * ★원문 전체: 「- 그리드블럭에 원형이미지 추가한뒤 원형이미지의 그림자 효과는 어떻게 주는지? (원형이미지 뿐아니라, 에셋들에 효과를 주고 싶음)」
 *   ⓐ 그리드 원형이미지의 그림자 효과 · ⓑ 에셋들에 효과 (ⓑ 는 에셋 Effects 「반사·그림자」로 원래 된다 — 정본 대기열)
 * ★잰 값(S3 실앱 c278bc39 ×3): 원 줄을 고른 패널 = Grid…Image·Typography · Effects 0 · 「그림자」 0 / 대조 에셋 패널 = Effects 1(반사·그림자).
 * ★처방(지디: 에셋 Effects 를 그 자리에 · ⛔같은 함수 두 벌 금지) —
 *   패널 = js/effects-registry.js fxSectionHtml/wireFxSection 을 «그대로» 부른다(원 줄마다 대리 하나 · js/props/prop-grid.js).
 *   저장 = 원 «줄»의 그림자 키 여섯(에셋과 같은 이름 · grid-block.js GRID_LINE_FIELDS).
 *   그리기 = grid-block.js 원 갈래가 js/effects-shadow.js fxShadowFilterOf(같은 식)로 filter.
 *
 * ★칸
 *   P  전제 — 그리드 0행 0열에 원 줄 · 사람 길로 그 줄을 골랐다 · 처음엔 원 filter 없음
 *   E1 패널에 Effects 절 · 추가 목록에 「그림자」
 *   E2 「그림자」 ⇒ 원에 drop-shadow · 줄 모델 fxShadow 'on'
 *   E3 X 숫자 칸 10 ⇒ 원 filter 에 10px · 모델 fxShadowX '10'
 *   E4 다시 그려도(renderGridBlock) · 저장→다시 열기(getSerializedCanvas → innerHTML → rebindAll) 뒤에도 filter 가 남는다
 *   E5 카드 ✕ ⇒ 키 0 · filter 없음
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({
      cols: [{ width: 1, lines: [{ type: 'image', imgSrc: '', imgShape: 'circle', height: 120 }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
      rows: [{ height: 'auto' }],
    });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  });
  const sel = '#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-circle';
  const r = await waitStableRect(page, sel);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => document.getElementById('gG')?.classList.contains('selected'), null, { timeout: 3000 });
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => [...document.querySelectorAll('#panel-right .prop-section-title')].some(t => t.textContent.trim() === 'Image'), null, { timeout: 3000 });
  return { errs, sel };
}

const st = (page, sel) => page.evaluate((sel) => {
  const f = document.querySelector(sel);
  const line = window.getGridModel ? window.getGridModel(document.getElementById('gG')).cells[0][0].lines[0] : null;
  const keys = line ? Object.fromEntries(Object.entries(line).filter(([k]) => /^fxShadow/.test(k))) : null;
  return { filter: f ? getComputedStyle(f).filter : null, keys };
}, sel);

test('P·E1~E5 ★그리드 원형이미지 — 에셋과 같은 Effects 로 그림자', async ({ page }) => {
  const { errs, sel } = await setup(page);
  const s0 = await st(page, sel);
  expect(s0.filter, 'P 처음엔 filter 없음').toBe('none');
  const addSel = await page.evaluate(() => { const s = document.querySelector('#panel-right select[id$="-fx-add"]'); return s ? { id: s.id, opts: [...s.options].map(o => o.textContent.trim()) } : null; });
  expect(addSel, 'E1 원 줄 패널에 Effects 추가 목록').not.toBeNull();
  expect(addSel.opts, 'E1 「그림자」').toContain('그림자');
  await page.selectOption('#' + addSel.id, 'shadow');
  await page.waitForFunction((sel) => /drop-shadow/.test(getComputedStyle(document.querySelector(sel)).filter), sel, { timeout: 3000 });
  const s1 = await st(page, sel);
  expect(s1.keys.fxShadow, 'E2 모델 fxShadow').toBe('on');
  const xNum = await page.evaluate(() => document.querySelector('#panel-right input[id$="-fxsh-x-num"]')?.id || null);
  expect(xNum, 'E3 전제: X 숫자 칸').not.toBeNull();
  await page.fill('#' + xNum, '10');
  await page.press('#' + xNum, 'Enter');
  await page.waitForFunction((sel) => /10px/.test(getComputedStyle(document.querySelector(sel)).filter), sel, { timeout: 3000 });
  expect((await st(page, sel)).keys.fxShadowX, 'E3 모델 fxShadowX').toBe('10');
  await page.evaluate(() => window.renderGridBlock(document.getElementById('gG')));
  expect((await st(page, sel)).filter, 'E4 다시 그려도').toMatch(/drop-shadow.*10px/);
  await page.evaluate(() => { const h = window.getSerializedCanvas(); document.getElementById('canvas').innerHTML = h; window.rebindAll?.(); });
  await page.waitForFunction((sel) => !!document.querySelector(sel), sel, { timeout: 3000 });
  expect((await st(page, sel)).filter, 'E4 저장→다시 열기 뒤').toMatch(/drop-shadow.*10px/);
  /* E5 — 다시 고르고 카드 ✕ */
  const r = await waitStableRect(page, sel);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => document.getElementById('gG')?.classList.contains('selected'), null, { timeout: 3000 });
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => !!document.querySelector('#panel-right [id$="-fxsh-del"]'), null, { timeout: 3000 });
  await page.click('#panel-right [id$="-fxsh-del"]');
  await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)).filter === 'none', sel, { timeout: 3000 });
  expect((await st(page, sel)).keys, 'E5 키 0').toEqual({});
  expect(errs).toEqual([]);
});
