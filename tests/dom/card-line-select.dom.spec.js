/* card-line-select.dom.spec.js — 1017t1d1: 심플카드 = line-host 다섯 번째 주인.
 * 「한 번 클릭 = 그 텍스트 줄에 핸들」(발주 1017t1, 그리드·laurel 과 같은 2단 클릭 규칙).
 *
 * ★장면은 ★앱이 만든다 — bootApp + window.makeCanvasBlock({cardMode:'simple'}) (card-canvas-add-line.dom.spec.js
 *   의 그 setup 재사용). ⛔손으로 DOM 을 짓지 않는다.
 * ⛔waitForTimeout 없음(래칫 tests/unit/dom-fixed-wait-census.test.mjs W3) — waitForFunction 로만 기다린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js card-line-select
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sL" data-section="1" data-name="sL"><div class="section-hitzone"></div><div class="section-inner" id="innerL">
  <div id="slotL"></div></div></div>`;

async function setup(page, opts = {}) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([sec, o]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    const made = window.makeCanvasBlock({ cardMode: 'simple', ...o });
    made.block.id = 'cvb_lsel1';
    document.getElementById('slotL').replaceWith(made.row);
    window.applyZoom?.(100);
    window.rebindAll?.(); window.deselectAll?.();
    window.renderCanvas(made.block);
    made.block.scrollIntoView({ block: 'center' });
    return made.block.id;
  }, [SEC, opts]);
  await page.waitForFunction((id) => !!document.getElementById(id), id);
  expect(await page.evaluate(() => window.currentZoom), '전제 — 배율 100%').toBe(100);
  expect(await page.evaluate(() => typeof window.lnHostFor), '전제 — lnHostFor 가 있다').toBe('function');
  expect(await page.evaluate(() => typeof window.lnClickAddr), '전제 — lnClickAddr 가 있다').toBe('function');
  expect(await page.evaluate((_id) => window.lnHostFor(document.getElementById(_id))?.kind, id), '전제 — 카드가 line-host 주인을 받는다').toBe('card');
  return { id, errs };
}

async function clickCenterOf(page, selector) {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  if (!box) throw new Error(`요소를 못 찾음: ${selector}`);
  await page.mouse.click(box.x, box.y);
}

test('M0 ★전제 — 줄 없는 카드도 line-host 주인을 받고, HOST_SEL 범위는 cardMode=simple 뿐이다', async ({ page }) => {
  const { id, errs } = await setup(page);
  expect(errs).toEqual([]);
  const layerMode = await page.evaluate(() => {
    const row = window.makeCanvasBlock({});   // cardMode 없음 = 레이어 모드
    return window.lnHostFor(row.block);
  });
  expect(layerMode, '레이어 모드(Figma 임포트) 카드는 줄 숙주가 되면 안 된다').toBeNull();
});

test('M1 ★첫 전환(D2) — 제목·설명이 있는 카드를 두 번 클릭해 고르고 T 로 줄을 더하면 그 글이 첫 줄로 구워진다 · 핸들이 뜬다', async ({ page }) => {
  const { id, errs } = await setup(page, { cards: [{ title: '제목텍스트', desc: '설명텍스트' }] });
  await clickCenterOf(page, `#${id} .cvb-card-title`);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id);
  await clickCenterOf(page, `#${id} .cvb-card-title`);
  await page.waitForFunction((id) => {
    const a = window.grdGetActiveLine?.(document.getElementById(id));
    return !!a && a.li === null;
  }, id, { timeout: 4000 });
  await page.keyboard.press('KeyT');
  /* ★commitLines 의 D2 첫 전환 — 지금 글을 «줄 0」으로 굽고 T 로 더한 빈 본문 줄은 그 뒤(줄 1)로 밀린다
     (line-host.js _baseHost.commitLines — 다른 세 주인과 같은 계약). 활성 줄도 1로 같이 밀린다. */
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .ln-row[data-ln-m="0"][data-ln="1"]`), id, { timeout: 4000 });
  const r = await page.evaluate((id) => {
    const block = document.getElementById(id);
    const row0 = block.querySelector('.ln-row[data-ln-m="0"][data-ln="0"]');
    const row1 = block.querySelector('.ln-row[data-ln-m="0"][data-ln="1"]');
    return {
      row0Text: row0 ? row0.textContent : null,
      row1Selected: row1 ? row1.classList.contains('ln-line-selected') : false,
      row0Selected: row0 ? row0.classList.contains('ln-line-selected') : false,
      titleGone: !block.querySelector('.cvb-card-title'),
      descGone: !block.querySelector('.cvb-card-desc'),
      cardsLines: JSON.parse(block.dataset.cards)[0].lines,
      gripVisible: !!document.querySelector('.grd-line-grip'),
      activeAddr: window.grdGetActiveLine(block),
    };
  }, id);
  expect(errs).toEqual([]);
  expect(r.row0Text, 'D2 — 제목과 설명이 둘 다 «구워진 첫 줄»(줄 0)에 같이 담겨야 한다(데이터 손실 금지)').toContain('제목텍스트');
  expect(r.row0Text).toContain('설명텍스트');
  expect(r.titleGone, 'D1 갈음 — 줄이 있으면 본문(.cvb-card-title) 대신 줄만 그려야 한다').toBe(true);
  expect(r.descGone, 'D1 갈음 — .cvb-card-desc 도 사라져야 한다').toBe(true);
  expect(r.cardsLines?.length, 'D2 — 구운 줄 0 ＋ T 로 더한 줄 1, 데이터에 둘 다 저장돼야 한다').toBe(2);
  expect(r.activeAddr, 'T 로 ★새로» 더한 줄(1)이 활성이어야 한다 — 굽힌 줄(0)이 아니라').toEqual({ r: 0, c: 0, li: 1 });
  expect(r.row0Selected, '굽힌 줄(0)은 선택 표시가 없어야 한다').toBe(false);
  expect(r.row1Selected, '방금 T 로 더한 줄(1)이 «고른 줄»로 표시돼야 한다').toBe(true);
  expect(r.gripVisible, '★핸들(끄는 손잡이)이 떠야 한다 — 발주 1017t1d1의 핵심').toBe(true);
});

test('M2 ★이미 줄이 있는 카드 — 두 번째 클릭이 «그 줄»을 바로 고른다(핸들 포함) · 더블클릭 = 글자 편집', async ({ page }) => {
  const { id, errs } = await setup(page, { cards: [{ lines: [{ type: 'body', text: '줄A' }, { type: 'body', text: '줄B' }] }] });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .ln-row[data-ln="1"]`), id);
  await clickCenterOf(page, `#${id}`);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id);
  await clickCenterOf(page, `#${id} .ln-row[data-ln-m="0"][data-ln="1"]`);
  await page.waitForFunction((id) => document.querySelector(`#${id} .ln-row[data-ln="1"]`)?.classList.contains('ln-line-selected'), id, { timeout: 4000 });
  const sel = await page.evaluate((id) => {
    const a = window.grdGetActiveLine(document.getElementById(id));
    return { addr: a, gripVisible: !!document.querySelector('.grd-line-grip') };
  }, id);
  expect(errs).toEqual([]);
  expect(sel.addr).toEqual({ r: 0, c: 0, li: 1 });
  expect(sel.gripVisible, '두 번째 줄을 고르면 핸들이 떠야 한다').toBe(true);

  await page.dblclick(`#${id} .ln-row[data-ln="1"] .grd-line`);
  await page.waitForFunction((id) => document.querySelector(`#${id} .ln-row[data-ln="1"] [contenteditable="true"]`), id, { timeout: 4000 });
});

test('N1 ★음성대조 — 줄 없는 옛 카드는 클릭 두 번에도 «고른 줄 표시»가 0건, 더블클릭은 ★그대로 옛 인라인 편집', async ({ page }) => {
  const { id, errs } = await setup(page, { cards: [{ title: '옛카드', desc: '옛설명' }] });
  await clickCenterOf(page, `#${id} .cvb-card-title`);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id);
  await clickCenterOf(page, `#${id} .cvb-card-title`);
  await page.waitForFunction((id) => {
    const a = window.grdGetActiveLine?.(document.getElementById(id));
    return !!a && a.li === null;
  }, id, { timeout: 4000 });
  const marked = await page.evaluate((id) => document.querySelectorAll(`#${id} .ln-line-selected`).length);
  expect(marked, '아직 줄이 없으니 «고른 줄 표시»는 0 이어야 한다(핸들도 안 뜬다)').toBe(0);
  expect(await page.evaluate(() => !!document.querySelector('.grd-line-grip')), '핸들도 안 떠야 한다').toBe(false);

  await page.dblclick(`#${id} .cvb-card-title`);
  await page.waitForFunction((id) => document.querySelector(`#${id} .cvb-card-title`)?.getAttribute('contenteditable') === 'true', id, { timeout: 4000 });
  expect(errs).toEqual([]);
});
