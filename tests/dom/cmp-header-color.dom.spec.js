/* cmp-header-color.dom.spec.js — 비교(comparison) 블럭 «헤더만» 색 따로. (1012t1 D1)
 *
 * 현빈: 「컴패리전 블럭에 헤더만 색지정 별도로 가능하게 해줄 것」
 * ★모델은 이미 칼럼별 titleBg(헤더 배경)·titleColor(헤더 글자)를 렌더러가 읽는다 — 손잡이(패널)와 문(updateComparisonBlock)이 없었다.
 *   패널: 칼럼마다 「헤더 배경」「헤더 글자」 색 행 + 「초기화」(둘 다 지움). 단색만.
 *   문: 보존 명부 CMP_COL_KEEP — cols 전체교체가 titleBg 등을 «버리던» 구멍을 막는다(H7).
 * ★waitForTimeout 금지 — waitForFunction / expect.poll.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-header-color
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const RED = '#ff0000', RED_RGB = 'rgb(255, 0, 0)';
const GREEN = '#00ff00', GREEN_RGB = 'rgb(0, 255, 0)';

async function setup(page, make = 'window.addComparisonBlock({});') {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([mk, sec]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    (0, eval)(mk);
    window.__blk = [...document.querySelectorAll('#sB .comparison-block')].pop();
    window.buildLayerPanel?.();
    window.__blk?.scrollIntoView({ block: 'center' });
    window.showComparisonProperties(window.__blk);
  }, [make, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected
    && !!document.getElementById('cmp-c0HdBg-color'), null, { timeout: 5000 });
  return errs;
}
/* H0 전제 — 칼럼 2개 · 헤더·행이 그려졌다 · 패널에 헤더 색 칸이 칼럼마다 한 벌. */
async function assertRuler(page) {
  const n = await page.evaluate(() => {
    return {
      cols: window.getComparisonCols(window.__blk.dataset).length,
      hd: window.__blk.querySelectorAll('.cmp-hd').length,
      rows: window.__blk.querySelectorAll('.cmp-row').length,
      hdBg: [...document.querySelectorAll('[id^="cmp-c"][id$="HdBg-color"]')].map(e => e.id),
      hdTx: [...document.querySelectorAll('[id^="cmp-c"][id$="HdText-color"]')].map(e => e.id),
      clear: document.querySelectorAll('.cmp-hd-color-clear').length,
      keep: Object.keys(window.CMP_COL_KEEP || {}),
    };
  });
  expect(n.cols, `전제 — 칼럼 2개 ${JSON.stringify(n)}`).toBe(2);
  expect(n.hd, '전제 — 헤더 2칸').toBe(2);
  expect(n.rows, '전제 — 행이 그려졌다').toBeGreaterThan(0);
  expect(n.hdBg, '전제 — 헤더 배경 칸 칼럼당 1벌').toEqual(['cmp-c0HdBg-color', 'cmp-c1HdBg-color']);
  expect(n.hdTx, '전제 — 헤더 글자 칸 칼럼당 1벌').toEqual(['cmp-c0HdText-color', 'cmp-c1HdText-color']);
  expect(n.clear, '전제 — 초기화 단추 칼럼당 1개').toBe(2);
  expect(n.keep, '전제 — 보존 명부에 titleBg/titleColor').toEqual(expect.arrayContaining(['titleBg', 'titleColor']));
  return n;
}
/* 패널 색 칸을 «사람처럼» 고른다 — native color input 의 input(=onApply) → change(=onCommit). */
const pick = (page, id, hex) => page.evaluate(([i, h]) => {
  const el = document.getElementById(i);
  el.value = h;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, hex]);
/* 그려진 값(계산값)과 모델을 한 번에. */
const measure = (page) => page.evaluate(() => {
  const b = window.__blk;
  const cs = (e, p) => e ? getComputedStyle(e)[p] : null;
  const col = i => b.querySelector(`.cmp-col[data-col-idx="${i}"]`);
  const hd = i => b.querySelector(`.cmp-hd[data-col-idx="${i}"]`);
  return {
    hdBg: [0, 1].map(i => cs(hd(i), 'backgroundColor')),
    hdColor: [0, 1].map(i => cs(hd(i), 'color')),
    colBg: [0, 1].map(i => cs(col(i), 'backgroundColor')),
    rowColor: [0, 1].map(i => [...b.querySelectorAll(`.cmp-row[data-col-idx="${i}"]:not(.cmp-img)`)].map(e => cs(e, 'color'))),
    model: window.getComparisonCols(b.dataset).map(c => ({ bg: c.bg, text: c.text, titleBg: c.titleBg, titleColor: c.titleColor,
      hasBg: Object.prototype.hasOwnProperty.call(c, 'titleBg'), hasColor: Object.prototype.hasOwnProperty.call(c, 'titleColor') })),
  };
});

test('H1 「헤더 배경」을 고르면 그 칼럼 헤더만 바뀐다 — 칼럼 bg·이웃 헤더·행은 그대로', async ({ page }) => {
  const errs = await setup(page);
  await assertRuler(page);
  const before = await measure(page);
  expect(before.hdBg[0], '전제 — 칠하기 전 헤더 bg 는 빨강이 아니다').not.toBe(RED_RGB);
  await pick(page, 'cmp-c0HdBg-color', RED);
  await expect.poll(() => measure(page).then(m => m.hdBg[0])).toBe(RED_RGB);
  const after = await measure(page);
  expect(after.model[0].titleBg, '모델 cols[0].titleBg').toBe(RED);
  expect(after.colBg, '칼럼 bg 불변(칼럼 전체가 바뀌면 안 된다)').toEqual(before.colBg);
  expect(after.model.map(c => c.bg), '모델 칼럼 bg 불변').toEqual(before.model.map(c => c.bg));
  expect(after.hdBg[1], '이웃 칼럼 헤더 불변').toBe(before.hdBg[1]);
  expect(after.rowColor, '행 글자색 불변').toEqual(before.rowColor);
  expect(after.model[1].hasBg, '칼럼1 모델에 titleBg 없음').toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H2 「헤더 글자」를 고르면 헤더 글자색만 바뀐다 — 행 글자·칼럼 text 는 그대로', async ({ page }) => {
  const errs = await setup(page);
  await assertRuler(page);
  const before = await measure(page);
  expect(before.hdColor[1], '전제 — 바꾸기 전 헤더 글자는 초록이 아니다').not.toBe(GREEN_RGB);
  await pick(page, 'cmp-c1HdText-color', GREEN);
  await expect.poll(() => measure(page).then(m => m.hdColor[1])).toBe(GREEN_RGB);
  const after = await measure(page);
  expect(after.model[1].titleColor).toBe(GREEN);
  expect(after.rowColor, '행 글자색 불변').toEqual(before.rowColor);
  expect(after.model.map(c => c.text), '모델 칼럼 text 불변').toEqual(before.model.map(c => c.text));
  expect(after.hdColor[0], '이웃 헤더 글자 불변').toBe(before.hdColor[0]);
  expect(after.hdBg, '헤더 bg 불변').toEqual(before.hdBg);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H3 「초기화」 → titleBg/titleColor 키가 사라지고 헤더가 칼럼 색으로 돌아간다', async ({ page }) => {
  const errs = await setup(page);
  await assertRuler(page);
  const base = await measure(page);
  await pick(page, 'cmp-c0HdBg-color', RED);
  await pick(page, 'cmp-c0HdText-color', GREEN);
  await expect.poll(() => measure(page).then(m => [m.hdBg[0], m.hdColor[0]])).toEqual([RED_RGB, GREEN_RGB]);
  await page.evaluate(() => document.querySelector('.cmp-hd-color-clear[data-col="0"]').click());
  await expect.poll(() => measure(page).then(m => m.hdBg[0])).toBe(base.hdBg[0]);
  const after = await measure(page);
  expect(after.model[0].hasBg, 'titleBg 키 없음').toBe(false);
  expect(after.model[0].hasColor, 'titleColor 키 없음').toBe(false);
  expect(after.hdColor[0], '헤더 글자 = 처음(칼럼 text 상속)').toBe(base.hdColor[0]);
  expect(after.colBg, '칼럼 bg 불변').toEqual(base.colBg);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H4 캡션 모드(captionPos:top) 알약에도 titleBg 가 칠해진다', async ({ page }) => {
  const errs = await setup(page, "window.addComparisonBlock({}); { const b=[...document.querySelectorAll('#sB .comparison-block')].pop(); b.dataset.captionPos='top'; const c=window.getComparisonCols(b.dataset); c[0].title='캡션'; window.setComparisonCols(b,c); window.renderComparison(b); }");
  await assertRuler(page);
  const cap = await page.evaluate(() => !!window.__blk.querySelector('.cmp-caption .cmp-hd[data-col-idx="0"]'));
  expect(cap, '전제 — 캡션 모드로 그려졌다').toBe(true);
  await pick(page, 'cmp-c0HdBg-color', RED);
  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(window.__blk.querySelector('.cmp-caption .cmp-hd[data-col-idx="0"]')).backgroundColor)).toBe(RED_RGB);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H5 ⌘Z 한 걸음 — 헤더 색 하나 바꾸고 undo 하면 titleBg 가 없다', async ({ page }) => {
  const errs = await setup(page);
  await assertRuler(page);
  const id = await page.evaluate(() => window.__blk.id);
  await pick(page, 'cmp-c0HdBg-color', RED);
  await expect.poll(() => measure(page).then(m => m.model[0].titleBg)).toBe(RED);
  await page.evaluate(() => window.undo());
  await expect.poll(() => page.evaluate((bid) => {
    const b = document.getElementById(bid); if (!b) return 'missing';
    return Object.prototype.hasOwnProperty.call(window.getComparisonCols(b.dataset)[0], 'titleBg');
  }, id)).toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H6 저장 왕복 — serializeProject → applyProjectData 뒤에도 titleBg/titleColor 와 헤더 색이 산다', async ({ page }) => {
  await setup(page);
  await assertRuler(page);
  await pick(page, 'cmp-c0HdBg-color', RED);
  await pick(page, 'cmp-c0HdText-color', GREEN);
  await expect.poll(() => measure(page).then(m => [m.hdBg[0], m.hdColor[0]])).toEqual([RED_RGB, GREEN_RGB]);
  const id = await page.evaluate(() => window.__blk.id);
  const snap = await page.evaluate(() => window.serializeProject());
  const errs = await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForFunction((bid) => {
    const b = document.getElementById(bid);
    return !!b && !!b.querySelector('.cmp-hd[data-col-idx="0"]');
  }, id, { timeout: 5000 });
  await page.evaluate((bid) => { window.__blk = document.getElementById(bid); }, id);
  const after = await measure(page);
  expect(after.model[0].titleBg).toBe(RED);
  expect(after.model[0].titleColor).toBe(GREEN);
  expect(after.hdBg[0], '불러온 뒤 헤더 bg').toBe(RED_RGB);
  expect(after.hdColor[0], '불러온 뒤 헤더 글자').toBe(GREEN_RGB);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H7 문 — columnPatch 로 칠하고, cols 전체교체 뒤에도 titleBg/titleColor 가 산다(보존 명부)', async ({ page }) => {
  const errs = await setup(page);
  await assertRuler(page);
  const r = await page.evaluate(([red, green]) => {
    const b = window.__blk;
    const p1 = window.updateComparisonBlock(b.id, { columnPatch: [{ index: 0, titleBg: red, titleColor: green }] });
    const m1 = window.getComparisonCols(b.dataset)[0];
    /* ★구멍 재현 꼴: 지금 모델을 그대로 cols 로 되돌려 넣는다 — 예전엔 여기서 titleBg/titleColor 가 사라졌다. */
    const p2 = window.updateComparisonBlock(b.id, { cols: window.getComparisonCols(b.dataset) });
    const m2 = window.getComparisonCols(b.dataset)[0];
    const hd = b.querySelector('.cmp-hd[data-col-idx="0"]');
    /* 지우기: '' = 키 없음 */
    const p3 = window.updateComparisonBlock(b.id, { columnPatch: [{ index: 0, titleBg: '' }] });
    const m3 = window.getComparisonCols(b.dataset)[0];
    /* 무효: 상한 초과는 INVALID + 모델 불변 */
    const p4 = window.updateComparisonBlock(b.id, { cols: [{ title: 'x', titleColor: 'x'.repeat(65), rows: [] }, { title: 'y', rows: [] }] });
    return { p1: p1.ok, p2: p2.ok, p3: p3.ok, p4: p4.code,
             m1: [m1.titleBg, m1.titleColor], m2: [m2.titleBg, m2.titleColor],
             hd: [getComputedStyle(hd).backgroundColor, getComputedStyle(hd).color],
             m3: [Object.prototype.hasOwnProperty.call(m3, 'titleBg'), m3.titleColor],
             colsAfterInvalid: window.getComparisonCols(b.dataset).length };
  }, [RED, GREEN]);
  expect(r.p1, 'columnPatch ok').toBe(true);
  expect(r.m1, 'columnPatch 가 titleBg/titleColor 를 실었다').toEqual([RED, GREEN]);
  expect(r.p2, 'cols 교체 ok').toBe(true);
  expect(r.m2, '★cols 교체 뒤 titleBg/titleColor 생존').toEqual([RED, GREEN]);
  expect(r.hd, 'cols 교체 뒤 헤더가 그 색으로 그려진다').toEqual([RED_RGB, GREEN_RGB]);
  expect(r.p3).toBe(true);
  expect(r.m3, "'' = titleBg 지우기 · titleColor 는 그대로").toEqual([false, GREEN]);
  expect(r.p4, '상한 초과 = INVALID').toBe('INVALID');
  expect(r.colsAfterInvalid, 'INVALID 는 모델을 안 바꾼다').toBe(2);
  expect(errs, errs.join('\n')).toEqual([]);
});
