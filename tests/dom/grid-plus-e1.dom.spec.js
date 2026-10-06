/* grid-plus-e1.dom.spec.js — 묶음 E1 그리드 ＋ 셋(H8 · H9 · H10 · 현빈 2026-10-05) 잠금 (태양 lane-e1-plus)
 *   H8 뜨는 조건 = «선택»(옛: 호버 — 현빈 2026-10-04 결정을 현빈이 뒤집음) · H9 꼴 = 태그블럭 ＋(40×40 «모델 px» · 1.5px 점선 · «+» 글자 꼴)
 *   H10 자리 = 오른쪽 ＋ 중심이 블럭 오른쪽 끝(옛: 안쪽 한 칸) · 아래 ＋ 는 껍데기 바로 아래(자리 그대로 — 크기가 모델 px 라 배율 50 에서 매달림 화면 40 → 20).
 * ★까닭 = 단위(재현 $S/reports/BUNDLE-E/REPRO.md H9·H10): 옛 ＋ 는 화면 40px 고정(inv-zoom) + svg 14 ⇒ 배율 50 에서 라벨 ＋ 의 두 배 · 같은 단위가 H10 의 겹침·매달림.
 * 순서 = 실앱 순서: 진짜 마우스(호버 · 클릭으로 고르기 · 배율) · 좌표는 «두 번 연속 같음».
 * 형제: grid-plus-g15(옛 계약을 새 계약으로 뒤집음) · 지킴 L1 = 태그블럭 ＋ 그대로.
 * 양성대조: d1f642ff 나무 안 → S1 S2 Z50 P1 G1 빨강 · Z100 P2 L1 초록 (predict: $S/e1/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/grid-plus-e1.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = `<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
  <div class="gap-block" data-type="gap" style="height:80px"></div><div id="slotA"></div>
  <div class="gap-block" data-type="gap" style="height:120px"></div><div id="slotL"></div>
  <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`;

async function setup(page, zoom = 100) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  const ids = await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    const { row, block } = window.makeGridBlock({}); document.getElementById('slotA').replaceWith(row); window.bindBlock(block);
    window.selectSection(document.getElementById('sG'));
    window.addLabelGroupBlock();   // 태그 그룹(지킴 L1) — 섹션 끝에 붙는다
    const lg = [...document.querySelectorAll('#sG .label-group-block')].pop();
    document.getElementById('slotL').replaceWith(lg.closest('.row') || lg);
    window.rebindAll?.(); window.deselectAll?.();
    return { g: block.id, lg: lg.id };
  }, SEC);
  if (zoom !== 100) await page.evaluate((z) => window.applyZoom(z), zoom);
  await page.waitForFunction((z) => window.currentZoom === z, zoom);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), ids.g);
  return { errs, ...ids };
}
const plus = (page, id) => page.evaluate((id) => [...document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"]`)].map(b => {
  const r = b.getBoundingClientRect(); return { axis: b.dataset.grdAdd, w: +r.width.toFixed(1), h: +r.height.toFixed(1), cx: r.left + r.width / 2, cy: r.top + r.height / 2, t: r.top, l: r.left, r: r.right };
}), id);
async function selectGrid(page, id) {
  const r = await waitStableRect(page, `#${id} > .grd-inner`);
  await clickAt(page, r.left + r.width * 0.25, r.top + r.height / 2, { sel: `[id="${id}"]` }, { label: '그리드 고르기' });
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id, { timeout: 3000 });
  await page.waitForFunction((id) => document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"]`).length === 2, id, { timeout: 3000 }).catch(() => {});
}

test('S1 ★H8 — 안 고른 그리드 위에 마우스(호버) → ＋ 0', async ({ page }) => {
  const { errs, g } = await setup(page);
  const r = await waitStableRect(page, `#${g} > .grd-inner`);
  await page.mouse.move(r.left + r.width * 0.25, r.top + r.height / 2, { steps: 4 });
  await page.waitForFunction((id) => document.getElementById(id).matches(':hover'), g, { timeout: 3000 });
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), g), '전제 — 안 고름').toBe(false);
  expect((await plus(page, g)).length, '★호버만 → ＋ 없음(옛: 둘)').toBe(0);
  expect(errs).toEqual([]);
});

test('S2 ★H8 — 고르면 ＋ 둘 · 마우스를 멀리 치워도 남는다 · 다른 걸 고르면 0', async ({ page }) => {
  const { errs, g } = await setup(page);
  await selectGrid(page, g);
  await page.mouse.move(5, 5);
  await page.waitForFunction((id) => !document.getElementById(id).matches(':hover'), g, { timeout: 3000 });
  expect((await plus(page, g)).map(p => p.axis).sort(), '★고름 + 마우스 밖 → ＋ 둘(옛: 0)').toEqual(['col', 'row']);
  const gp = await waitStableRect(page, '#sG .gap-block');
  await clickAt(page, gp.cx, gp.cy, { sel: '.gap-block' }, { label: '갭 고르기' });
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('selected'), g, { timeout: 3000 });
  expect((await plus(page, g)).length, '★선택 풀림 → 0').toBe(0);
  expect(errs).toEqual([]);
});

for (const z of [50, 100]) {
  test(`Z${z} ★H9 — 배율 ${z}: ＋ 화면 지름 = 40 × ${z / 100} = ${40 * z / 100}(모델 40) · 태그블럭 ＋ 와 같은 크기`, async ({ page }) => {
    const { errs, g, lg } = await setup(page, z);
    await selectGrid(page, g);
    const ps = await plus(page, g);
    for (const p of ps) expect([p.w, p.h], `★${p.axis} ＋ 화면 크기 ${JSON.stringify(p)}`).toEqual([40 * z / 100, 40 * z / 100]);
    expect(errs).toEqual([]);
  });
}

test('P1 ★H10 — 오른쪽 ＋ 중심 = 블럭 오른쪽 끝 · 세로 = 껍데기 가운데 (배율 50)', async ({ page }) => {
  const { errs, g } = await setup(page, 50);
  await selectGrid(page, g);
  const col = (await plus(page, g)).find(p => p.axis === 'col');
  const br = await page.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect(), i = document.querySelector(`#${id} > .grd-inner`).getBoundingClientRect(); return { r: b.right, midY: (i.top + i.bottom) / 2 }; }, g);
  expect(Math.abs(col.cx - br.r), `★오른쪽 ＋ 가로 중심 − 블럭 오른쪽 끝 = ${(col.cx - br.r).toFixed(2)}px(옛: −20 화면 = 안쪽 한 칸)`).toBeLessThanOrEqual(1);
  expect(Math.abs(col.cy - br.midY), '★세로 = 껍데기 가운데').toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('P2 아래 ＋ = 껍데기 바로 아래 · 가로 가운데 (배율 50) — 자리 그대로(크기만 모델 px)', async ({ page }) => {
  const { errs, g } = await setup(page, 50);
  await selectGrid(page, g);
  const row = (await plus(page, g)).find(p => p.axis === 'row');
  const ir = await page.evaluate((id) => { const i = document.querySelector(`#${id} > .grd-inner`).getBoundingClientRect(), b = document.getElementById(id).getBoundingClientRect(); return { b: i.bottom, cx: (b.left + b.right) / 2 }; }, g);
  expect(Math.abs(row.t - ir.b), '★아래 ＋ 위 끝 = 껍데기 아래 끝').toBeLessThanOrEqual(1);
  expect(Math.abs(row.cx - ir.cx), '★가로 가운데').toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('G1 ★H9 — 글리프 = «+» 글자 꼴(::before) · 버튼 안 글자 노드·svg 0 (E65 그대로)', async ({ page }) => {
  const { errs, g } = await setup(page);
  await selectGrid(page, g);
  const r = await page.evaluate((id) => { const b = document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"][data-grd-add="col"]`);
    const cs = getComputedStyle(b), pb = getComputedStyle(b, '::before');
    const lb = getComputedStyle(document.querySelector('.label-group-add-btn'));   // 태그블럭 ＋ 와 «같은» 테두리(1.5px 는 크로미움이 화면 픽셀로 깎아 계산값이 1px 일 수 있다)
    return { before: pb.content, svg: b.querySelectorAll('svg').length, text: b.textContent, border: cs.borderTopStyle + ' ' + cs.borderTopWidth, radius: cs.borderTopLeftRadius,
             sameAsLabel: cs.borderTopStyle === lb.borderTopStyle && cs.borderTopWidth === lb.borderTopWidth && cs.fontSize === lb.fontSize }; }, g);
  expect({ before: r.before, svg: r.svg, text: r.text, radius: r.radius, sameAsLabel: r.sameAsLabel }, JSON.stringify(r)).toEqual({ before: '"+"', svg: 0, text: '', radius: '50%', sameAsLabel: true });
  expect(errs).toEqual([]);
});

test('L1 지킴 — 태그블럭 ＋ 그대로: 안 고르면 숨음 · 고르면 보임 · 배율 50 에서 화면 20(모델 40)', async ({ page }) => {
  const { errs, lg } = await setup(page, 50);
  const st = () => page.evaluate((id) => { const b = document.querySelector(`#${id} .label-group-add-btn`); const cs = getComputedStyle(b), r = b.getBoundingClientRect(); return { op: +cs.opacity, pe: cs.pointerEvents, w: +r.width.toFixed(1) }; }, lg);
  await expect.poll(st, { message: '안 고름(투명도 0.15s 전환 · 배율 전환이 끝난 뒤)' }).toEqual({ op: 0, pe: 'none', w: 20 });
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), lg);
  const r = await waitStableRect(page, `#${lg} .label-item`);
  await clickAt(page, r.cx, r.cy, { sel: `[id="${lg}"]` }, { label: '태그 그룹 고르기' });
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), lg, { timeout: 3000 });
  await expect.poll(st).toEqual({ op: 1, pe: 'auto', w: 20 });
  expect(errs).toEqual([]);
});
