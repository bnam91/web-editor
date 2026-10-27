/* fix5-158-img-h-auto.dom.spec.js — ★158 GRID-IMG-HEIGHT-ZERO-IS-AUTO-BY-CONTRACT-01 (현빈 직접 GO 2026-10-27)
 *   렌더러 계약 `h > 0 ? 지정 : 기본` ⇒ 그림 줄 height 0 = auto. 패널 «높이(px)» 칸도 «auto» 로 말한다(값은 0 그대로).
 *   ★«auto» 는 칸의 placeholder 다(빈 칸) — 이웃 칸(구분선 높이 · 반경 · 행 높이)과 같은 관용구 · ⛔value 에 글자를 넣지 않는다.
 * 칸
 *   A1 크롭 줄 h 0 → 칸 '' · placeholder auto · 모델 0 · 칸을 눌렀다 떼고 패널을 다시 그려도 모델 0 · 저장본 바이트 무변
 *   A2 원 h 0 → 칸 '' · 패널(값·placeholder·잠김)과 그려진 지름이 «높이 키 없음»과 똑같다
 *   A3 크롭 없는 줄 h 0(칸 잠김) → 칸 '' · placeholder auto
 *   A4 남의 주인 laurel 그림 줄 h 0 → 칸 '' · placeholder 64(LAUREL_IMG_DEFAULT_H) · «높이 키 없음»과 같은 칸·그림 · 모델 0
 *   N1 [음성대조] h 120 → 칸 '120'(0 이 아닌 값은 그대로 보인다)
 * 양성대조: GD1001_ROOT=<dev eac99ecd 사본> ⇒ A1·A2·A3·A4 빨강(칸이 «0»), N1 초록.
 * 줄 고르기는 진짜 마우스(t6-04b-eats0-neighbors.dom.spec.js 와 같은 손). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
async function setup(page, lines) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((lines) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  }, lines);
  await frames(page, 3);
  return errs;
}
const lineOf = (page, li) => page.evaluate((li) => window.getGridModel(document.getElementById('gG')).cells[0][0].lines[li], li);
/* 진짜 마우스로 «블럭 → 줄» 2단 선택(laurel-lines.dom.spec.js pickLine 과 같은 손) — 기다림은 전부 조건.
 *   누르는 점이 그 줄 위인지 먼저 단언 · 첫 클릭 뒤 «블럭 선택됨»을 기다린 다음 둘째 클릭 → 이미지 절이 선다. */
async function selectLine(page, sel, blockSel = '#gG') {
  const p = await waitStableRect(page, sel);
  const hit = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); const w = document.querySelector(s); return !!(e && w && (e === w || w.contains(e))); }, [p.cx, p.cy, sel]);
  expect(hit, `전제 — 누르는 점이 ${sel} 위`).toBe(true);
  if (!(await page.evaluate((b) => document.querySelector(b).classList.contains('selected'), blockSel))) {
    await page.mouse.click(p.cx, p.cy);
    await page.waitForFunction((b) => document.querySelector(b).classList.contains('selected'), blockSel, { timeout: 4000 });
  }
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => !!document.getElementById('grd-img-height'), null, { timeout: 4000 });
}
const field = (page) => page.evaluate(() => { const i = document.getElementById('grd-img-height'); return { value: i.value, placeholder: i.placeholder, disabled: i.disabled }; });
const reshow = (page) => page.evaluate(() => { const g = document.getElementById('gG'); window.showGridProperties(g, window.grdGetActiveLine(g)); });
const saved = (page) => page.evaluate(() => window.serializeProject());

test('A1 ★크롭 줄 h 0 → 칸 «auto»(빈 칸) · 모델 0 · 눌렀다 떼도 0 · 저장본 바이트 무변', async ({ page }) => {
  const errs = await setup(page, [{ type: 'image', imgSrc: PX, height: 0, imgSizePct: 100, imgPosX: 0, imgPosY: 0 }, { type: 'body', text: 'C' }]);
  const before = await saved(page);
  await selectLine(page, '#gG .grd-img-frame');
  const f = await field(page);
  console.log('[A1] ' + JSON.stringify(f));
  expect(f.disabled, '전제 — 크롭 줄이라 칸이 켜져 있다').toBe(false);
  expect({ value: f.value, placeholder: f.placeholder }, '★0 = auto(빈 칸 · placeholder auto)').toEqual({ value: '', placeholder: 'auto' });
  /* 사람이 칸을 눌렀다가 아무것도 안 하고 나간다 → 값이 «auto» 글자나 NaN 으로 되읽혀 쓰이면 안 된다 */
  const box = await page.evaluate(() => { const r = document.getElementById('grd-img-height').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(box[0], box[1]); await page.keyboard.press('Tab'); await frames(page, 3);
  await reshow(page); await frames(page, 2);
  expect((await field(page)).value, '다시 그려도 빈 칸').toBe('');
  expect((await lineOf(page, 0)).height, '★모델 0 그대로(⛔undefined · NaN · 다른 수)').toBe(0);
  await page.evaluate(() => window.deselectAll?.()); await frames(page, 2);
  expect(await saved(page) === before, '★저장본 바이트 무변').toBe(true);
  expect(errs).toEqual([]);
});

test('A2 ★원 h 0 → 칸·그림이 «높이 키 없음»과 똑같다(빈 칸 · 같은 placeholder · 같은 지름)', async ({ page }) => {
  /* ⚠️원의 0 은 «칸 채움(height:100% · 바닥 GRID_IMG_CIRCLE_D)»으로 그려진다 — placeholder 120 은 그 «바닥»이다.
   *   placeholder 가 그 뜻을 다 말하나는 이 판 밖(키 없는 원도 옛날부터 같은 120 을 보인다 · 158 리포트 별건 후보).
   *   ⇒ 여기서 잠그는 것 = «0 과 키 없음이 패널에서 구별되지 않는다»(계약 h > 0 ? 지정 : 기본 의 패널 쪽 거울). */
  const look = async (line) => {
    const errs = await setup(page, [line, { type: 'body', text: 'C' }]);
    const drawn = await page.evaluate(() => document.querySelector('#gG .grd-img-frame').offsetWidth);
    await selectLine(page, '#gG .grd-img-frame');
    return { ...(await field(page)), drawn, errs };
  };
  const zero = await look({ type: 'image', imgSrc: PX, imgShape: 'circle', height: 0 });
  expect((await lineOf(page, 0)).height, '★모델(0 쪽) 0 그대로').toBe(0);
  const none = await look({ type: 'image', imgSrc: PX, imgShape: 'circle' });
  console.log('[A2] ' + JSON.stringify({ zero, none }));
  expect(zero.value, '★0 = 빈 칸').toBe('');
  expect(zero, '★0 과 키 없음이 패널·그림에서 같다').toEqual(none);
  expect(zero.placeholder, 'placeholder = 렌더러 바닥 GRID_IMG_CIRCLE_D').toBe('120');
  expect((await lineOf(page, 0)).height, '모델(키 없는 쪽)').toBe(undefined);
});

test('A3 ★크롭 없는 줄 h 0(칸 잠김) → 빈 칸 · placeholder auto', async ({ page }) => {
  const errs = await setup(page, [{ type: 'image', imgSrc: PX, height: 0 }, { type: 'body', text: 'C' }]);
  await selectLine(page, '#gG .grd-img-frame');
  const f = await field(page);
  console.log('[A3] ' + JSON.stringify(f));
  expect(f).toEqual({ value: '', placeholder: 'auto', disabled: true });
  expect((await lineOf(page, 0)).height).toBe(0);
  expect(errs).toEqual([]);
});

test('A4 ★남의 주인 laurel 그림 줄 h 0 → 빈 칸 · placeholder 64 · «높이 키 없음»과 같다 · 모델 0', async ({ page }) => {
  /* laurel-block.js `Number(ln.height) > 0 ? … : LAUREL_IMG_DEFAULT_H` — 같은 계약 · 패널은 같은 이미지 절(prop-grid.js foreign 갈래) */
  const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
  const look = async (img) => {
    await page.setViewportSize({ width: 1700, height: 1200 });
    const errs = await bootApp(page);
    await page.evaluate(([img, sec]) => {
      const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
      c.insertAdjacentHTML('beforeend', sec); window.rebindAll?.(); window.applyZoom?.(100);
      window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
      window.addLaurelBlock({ gridCols: 1, gridRows: 1, cells: [{ lines: [{ text: '1위', fontSize: 40 }, img], leafColor: '#1a1a1a', gap: 24, height: 140 }] });
      const b = [...document.querySelectorAll('#sB .laurel-block')].pop(); b.id = 'lB'; window.deselectAll?.(); b.scrollIntoView({ block: 'center' });
    }, [img, SEC]);
    const model = await page.evaluate(() => JSON.parse(document.getElementById('lB').dataset.cells)[0].lines[1]);
    const sel = '#lB .ln-row[data-ln-m="0"][data-ln="1"]';
    /* 그림 = 레이아웃 px(offsetHeight · 인라인 height) — ⛔getBoundingClientRect 는 laurel 맞춤 변환(축소)을 같이 재서 판마다 26~64 로 흔들렸다 */
    const drawn = await page.evaluate((s) => { const i = document.querySelector(s + ' img'); return i ? [i.style.height, i.offsetHeight] : null; }, sel);
    await selectLine(page, sel, '#lB');
    return { ...(await field(page)), drawn, h: model.height ?? 'undef', errs };
  };
  const zero = await look({ type: 'image', imgSrc: PX, height: 0 });
  const none = await look({ type: 'image', imgSrc: PX });
  console.log('[A4] ' + JSON.stringify({ zero, none }));
  expect(zero.h, '전제 — laurel 문이 0 을 받아 모델 0').toBe(0);
  expect(zero.value, '★0 = 빈 칸').toBe('');
  expect(zero.placeholder, 'placeholder = LAUREL_IMG_DEFAULT_H').toBe('64');
  const { h: _a, ...z } = zero, { h: _b, ...n } = none;
  expect(z, '★0 과 키 없음이 패널·그림에서 같다').toEqual(n);
});

test('N1 [음성대조] h 120 → 칸 «120» 그대로', async ({ page }) => {
  const errs = await setup(page, [{ type: 'image', imgSrc: PX, height: 120, imgSizePct: 100, imgPosX: 0, imgPosY: 0 }, { type: 'body', text: 'C' }]);
  await selectLine(page, '#gG .grd-img-frame');
  expect((await field(page)).value).toBe('120');
  expect(errs).toEqual([]);
});
