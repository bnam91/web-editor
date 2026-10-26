/* t6-04b-eats0-neighbors.dom.spec.js — ★요구가 아니다 · t6-04(grd-nest-gap) 의 «같이 고치면 싼 이웃» 둘 (지디 16:21 · EATS0)
 *   같은 꼴 = «`||` 기본값이 0 을 먹는다» · 같은 그리드 블럭 · 같은 파일 둘레.
 * 칸
 *   GH  여백 줄 높이(grd-line-gap-h) — 0 넣으면 ★모델 0 · ★그림 0px · ★패널 다시 그려도 «0» · ★저장 → 새로 띄워 불러와도 0 · 0px
 *       (⛔옛: 렌더러 `Number(line.height) || 16` → 16px · 패널 `|| ''` → 빈 칸(placeholder 16))
 *   IH  그림 줄 높이(grd-img-height · 크롭 줄 = 칸 켜짐) — 0 넣으면 ★모델 0 · ★패널 다시 그려도 «0» · ★저장 → 불러와도 0
 *       (⛔옛: 패널 `Number(line.height) || ''` → 빈 칸(placeholder auto) — 저장값 0 이 «auto» 로 보였다)
 *   ⚠️IH 는 그림을 안 잰다 — 크롭 줄의 그림 높이는 이번 판도 옛 판도 `height:${h}px`(0 → 0px) 로 같다(렌더러 손 안 댐).
 *   ⚠️디스크 쓰기는 하네스 밖(electronAPI 가짜) — 저장 = serializeProject() → bootApp → applyProjectData · 디스크 proj.json 은 앱값으로 잰다.
 * 양성대조: GD1001_ROOT=<5e4256d1 사본> ⇒ GH·IH 빨강.
 * 줄 고르기·입력은 진짜 마우스·키(grid-gap-line-height.dom.spec.js 와 같은 손). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
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
async function selectLine(page, sel) {
  const [x, y] = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  await page.mouse.click(x, y); await frames(page, 3);
  await page.mouse.click(x, y); await frames(page, 3);
}
async function typeInto(page, id, v) {
  await page.waitForFunction((id) => { const e = document.getElementById(id); return !!e && !e.disabled && e.getBoundingClientRect().width > 0; }, id, { timeout: 4000 });
  const box = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  await page.mouse.click(box[0], box[1]);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(String(v)); await page.keyboard.press('Enter');
  await frames(page, 3);
}
/* 패널을 «다시 그린다» — 줄이 0px 이면 다시 누를 데가 없다 ⇒ 패널이 지금 보는 줄 그대로 다시 세운다(사람이 다른 데 갔다 오는 것과 같은 그리기) */
const reshow = (page, id) => page.evaluate((id) => { const g = document.getElementById('gG'); window.showGridProperties(g, window.grdGetActiveLine(g)); return document.getElementById(id)?.value ?? null; }, id);
async function reopen(page) {
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction(() => !!document.querySelector('#gG .grd-cell'), null, { timeout: 8000 });
  await frames(page, 3);
}

test('GH ★여백 줄 높이 0 → 모델 0 · 그림 0px · 패널 «0» · 저장 왕복 0', async ({ page }) => {
  const errs = await setup(page, [{ type: 'body', text: 'A' }, { type: 'gap', height: 16 }, { type: 'body', text: 'C' }]);
  const gapH = () => page.evaluate(() => document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-gap')?.offsetHeight ?? null);
  expect(await gapH(), '전제 — 16px').toBe(16);
  await selectLine(page, '#gG .grd-gap');
  await typeInto(page, 'grd-line-gap-h', 0);
  const got = { model: (await lineOf(page, 1)).height, px: await gapH(), panel: await reshow(page, 'grd-line-gap-h') };
  expect(got, '★0 이 «0» 으로 산다(⛔16)').toEqual({ model: 0, px: 0, panel: '0' });
  await reopen(page);
  expect({ model: (await lineOf(page, 1)).height, px: await gapH() }, '★저장 → 불러와도 0').toEqual({ model: 0, px: 0 });
  expect(errs).toEqual([]);
});

test('IH ★그림 줄 높이 0(크롭 줄) → 모델 0 · 패널 «0» · 저장 왕복 0', async ({ page }) => {
  const errs = await setup(page, [{ type: 'image', imgSrc: PX, height: 120, imgSizePct: 100, imgPosX: 0, imgPosY: 0 }, { type: 'body', text: 'C' }]);
  await selectLine(page, '#gG .grd-img-frame');
  expect(await page.evaluate(() => document.getElementById('grd-img-height')?.value), '전제 — 칸 켜짐 · 120').toBe('120');
  await typeInto(page, 'grd-img-height', 0);
  const got = { model: (await lineOf(page, 0)).height, panel: await reshow(page, 'grd-img-height') };
  expect(got, '★0 이 «0» 으로 보인다(⛔빈 칸 = auto)').toEqual({ model: 0, panel: '0' });
  await reopen(page);
  expect((await lineOf(page, 0)).height, '★저장 → 불러와도 0').toBe(0);
  expect(errs).toEqual([]);
});
