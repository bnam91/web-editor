/* cmp-cell-rclick.dom.spec.js — 비교(comparison) 셀 ★우클릭으로 텍스트/이미지 고르기. (2026-10-08 지디 발주 ②)
 *
 * ★현빈 요청(2차 전달 · ⛔원문 미확인): 「컴패리전 셀에 ★텍스트/이미지를 ★우클릭으로 선택 입력」
 *
 * ★선례를 그대로 베낀다 — ⛔새 UI 언어 0 · ⛔새 모델 필드 0 · ⛔새 직렬화 0
 *   · 판정 한 벌 `_cmpCellAddrAt(e, block)` = `_gridCellAddrAt` 과 같은 꼴
 *     (elementsFromPoint 먼저 — 선택된 블럭 위 오버레이가 «단수»를 가로채는 그 병 · block-factory.js:5390 머리말)
 *     정본 주소는 ★렌더러가 심은 data-col-idx / data-row-idx (⛔DOM 순서 역산 금지)
 *   · 메뉴 항목 = `bcm-grid-img` 계열과 같은 자리·같은 꼴(display:none 으로 시작, openMenu 가 켠다)
 *   · 모델은 ★이미 있다 — row.type('text'|'image') · imgSrc · imgFit (comparison-block.js normalizeRow)
 *
 * ★이번 라운드에 ★뺀 것 — 「이미지 교체」(파일 선택창)
 *   선례 `bcm-grid-img` 는 교체에서 파일창을 연다. ⛔이 레인 금지선에 「파일 선택창 열지 마라」가 있어
 *   ★내가 그 갈래를 못 «잰다» ⇒ 못 재는 기능은 장식이다. ★파일 고르기는 ★패널에 이미 있다
 *   (prop-comparison.js `.cmp-row-img`). 메뉴는 「칸의 ★종류」만 고른다.
 *
 * ★음성대조 — R5(헤더는 행이 아니다) · R6(★그리드 선례를 안 껐다) · R7(카드 여백)
 * ★저장 왕복 — R8
 *
 * ⛔앱을 띄우지 않는다(bootApp). 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-cell-rclick
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★cmp 전용 메뉴 항목의 명부 — ⛔수를 박지 않는다. 「id 가 bcm-cmp- 로 시작하는 것 전부」로 센다
   (항목이 늘면 여기가 저절로 따라온다 — 명부를 두 벌로 만들지 않는다). */
const CMP_ITEM_PREFIX = 'bcm-cmp-';

const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';

async function setup(page, make) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([mk, sec]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    (0, eval)(mk);
    window.__blk = [...document.querySelectorAll('#sB .comparison-block, #sB .grid-block')].pop();
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [make, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected, null, { timeout: 5000 });
  return errs;
}

const CMP2 = "window.addComparisonBlock({ cols: [" +
  "{ title: 'A', rows: [{type:'text',text:'a0'},{type:'text',text:'a1'}] }," +
  "{ title: 'B', rows: [{type:'text',text:'b0'},{type:'text',text:'b1'}] }], featured: 1 });";

/* 우클릭하고 «메뉴에 보이는 항목»을 돌려준다. 좌표는 그 요소의 가운데(실제 마우스). */
async function rclick(page, selector, nth = 0) {
  const box = await page.locator(selector).nth(nth).boundingBox();
  expect(box && box.width > 0 && box.height > 0,
    `전제 — 누를 사각형이 있다 ${selector}#${nth} (잰 값 ${JSON.stringify(box)})`).toBe(true);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await page.waitForTimeout(150);
  return page.evaluate((pfx) => {
    const m = document.getElementById('block-context-menu');
    const vis = [...m.querySelectorAll(':scope > .bcm-item')].filter(i => getComputedStyle(i).display !== 'none');
    return {
      shown: getComputedStyle(m).display,
      visible: vis.map(i => i.id),
      cmpItems: vis.filter(i => i.id.startsWith(pfx)).map(i => ({ id: i.id, text: i.textContent.trim().slice(0, 20) })),
      gridItems: vis.filter(i => i.id.startsWith('bcm-grid-')).map(i => i.id),
    };
  }, CMP_ITEM_PREFIX);
}
/* 보이는 cmp 항목 하나를 ★실제로 누른다 */
async function clickItem(page, id) {
  const box = await page.locator('#' + id).boundingBox();
  expect(box && box.height > 0, `전제 — 메뉴 항목 #${id} 이 보인다 (잰 값 ${JSON.stringify(box)})`).toBe(true);
  await page.mouse.click(box.x + 20, box.y + box.height / 2);
  await page.waitForTimeout(200);
}
const model = (page) => page.evaluate(() => window.getComparisonCols(window.__blk.dataset));
/* ⑸ 자 생존 — 칸이 안 그려졌으면 «0건 초록»이 아니라 전제에서 진다 */
async function assertRuler(page, sel = '.cmp-row') {
  const n = await page.evaluate((s) => window.__blk.querySelectorAll(s).length, sel);
  expect(n, `전제 — ${sel} 이 그려졌다 (잰 값 ${n})`).toBeGreaterThan(0);
  return n;
}

test('R1 ★cmp 행 셀 우클릭 → cmp 전용 항목이 뜬다 (지금은 0개)', async ({ page }) => {
  const errs = await setup(page, CMP2);
  await assertRuler(page);
  const r = await rclick(page, '#sB .comparison-block .cmp-row', 0);
  expect(r.shown, '전제 — 메뉴 자체는 뜬다').toBe('block');
  expect(r.cmpItems.length, `cmp 전용 항목 수 — 잰 값 ${JSON.stringify(r.cmpItems)} · 보이는 전체 ${JSON.stringify(r.visible)}`).toBeGreaterThan(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R2 ★텍스트 칸 → 「이미지 칸으로」 누르면 모델이 image 가 되고 빈 슬롯이 그려진다', async ({ page }) => {
  const errs = await setup(page, CMP2);
  await assertRuler(page);
  const m0 = await model(page);
  expect(m0[0].rows[0].type, `전제 — 처음엔 text 행이다 (잰 값 ${m0[0].rows[0].type})`).toBe('text');
  const r = await rclick(page, '#sB .comparison-block .cmp-row', 0);
  const toImg = r.cmpItems.find(i => /img/.test(i.id) && !/del/.test(i.id));
  expect(toImg, `「이미지 칸으로」 항목이 보인다 — 잰 값 ${JSON.stringify(r.cmpItems)}`).toBeTruthy();
  await clickItem(page, toImg.id);
  const m1 = await model(page);
  expect(m1[0].rows[0].type, `누른 뒤 모델 type — 잰 값 ${JSON.stringify(m1[0].rows[0])}`).toBe('image');
  expect(String(m1[0].rows[0].imgSrc || ''), '빈 슬롯이다(파일창 안 열린다)').toBe('');
  /* ⛔«내가 누른 그 칸»만 바뀐다 — 옆 칸·다른 행은 그대로 (대조는 정체로) */
  expect(m1[0].rows[1].type, '같은 칼럼 다음 행은 그대로').toBe('text');
  expect(m1[1].rows[0].type, '옆 칼럼 같은 행은 그대로').toBe('text');
  const drawn = await page.evaluate(() => {
    const r0 = window.__blk.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]');
    return { cls: r0.className, h: Math.round(r0.getBoundingClientRect().height) };
  });
  expect(drawn.cls, `그려진 클래스 — 잰 값 ${JSON.stringify(drawn)}`).toContain('cmp-img');
  expect(drawn.cls, '빈 슬롯 표시(체커보드)').toContain('cmp-img-empty');
  expect(drawn.h, `빈 슬롯도 «면적»이 있다 — 잰 값 ${drawn.h}`).toBeGreaterThan(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R3 ★이미지 칸 → 「텍스트 칸으로」 누르면 모델이 text 로 돌아온다', async ({ page }) => {
  const errs = await setup(page, "window.addComparisonBlock({ cols: [{ title: 'A', rows: [{type:'image',text:'',imgSrc:'',imgFit:'cover'}] }, { title: 'B', rows: [{type:'text',text:'b'}] }], featured: 1 });");
  await assertRuler(page);
  const m0 = await model(page);
  expect(m0[0].rows[0].type, '전제 — 처음엔 image 행이다').toBe('image');
  const r = await rclick(page, '#sB .comparison-block .cmp-row', 0);
  const toText = r.cmpItems.find(i => /text/.test(i.id));
  expect(toText, `「텍스트 칸으로」 항목이 보인다 — 잰 값 ${JSON.stringify(r.cmpItems)}`).toBeTruthy();
  await clickItem(page, toText.id);
  const m1 = await model(page);
  expect(m1[0].rows[0].type, `누른 뒤 모델 type — 잰 값 ${JSON.stringify(m1[0].rows[0])}`).toBe('text');
  const edit = await page.evaluate(() => {
    const r0 = window.__blk.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]');
    return { cls: r0.className, ce: r0.getAttribute('contenteditable') };
  });
  expect(edit.cls, `text 로 돌아온 칸엔 cmp-img 가 없다 — 잰 값 ${JSON.stringify(edit)}`).not.toContain('cmp-img');
  expect(edit.ce, '편집 규약이 붙었다(더블클릭으로 들어갈 수 있다)').toBe('false');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R4 ★그림이 든 칸 → 「이미지 삭제」는 그림만 비우고 ★자리는 남긴다 (그리드와 같은 규약)', async ({ page }) => {
  const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const errs = await setup(page, `window.addComparisonBlock({ cols: [{ title: 'A', rows: [{type:'image',text:'',imgSrc:'${PX}',imgFit:'cover'}] }, { title: 'B', rows: [{type:'text',text:'b'}] }], featured: 1 });`);
  await assertRuler(page);
  const m0 = await model(page);
  expect(String(m0[0].rows[0].imgSrc).startsWith('data:image'), '전제 — 그림이 들어 있다').toBe(true);
  const r = await rclick(page, '#sB .comparison-block .cmp-row', 0);
  const del = r.cmpItems.find(i => /del/.test(i.id));
  expect(del, `「이미지 삭제」 항목이 보인다 — 잰 값 ${JSON.stringify(r.cmpItems)}`).toBeTruthy();
  await clickItem(page, del.id);
  const m1 = await model(page);
  expect(String(m1[0].rows[0].imgSrc || ''), `imgSrc 가 비었다 — 잰 값 ${JSON.stringify(String(m1[0].rows[0].imgSrc||'').slice(0,30))}`).toBe('');
  expect(m1[0].rows[0].type, '★자리(행)는 남는다 — 줄을 빼지 않는다').toBe('image');
  expect(m1[0].rows.length, '행 수가 그대로다').toBe(m0[0].rows.length);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R5 ★음성대조: ★헤더(.cmp-hd) 우클릭엔 cmp 항목이 ★안 뜬다 (헤더는 행이 아니다)', async ({ page }) => {
  const errs = await setup(page, CMP2);
  await assertRuler(page, '.cmp-hd');
  const r = await rclick(page, '#sB .comparison-block .cmp-hd', 0);
  expect(r.cmpItems, `헤더에서 보인 cmp 항목 — 잰 값 ${JSON.stringify(r.cmpItems)}`).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R6 ★음성대조: ★그리드 블럭의 우클릭 항목을 ★안 껐다 (선례 생존)', async ({ page }) => {
  const errs = await setup(page, 'window.addGridBlock();');
  const n = await page.evaluate(() => window.__blk.querySelectorAll('.grd-line, .grd-cell').length);
  expect(n, `전제 — 그리드 칸이 그려졌다 (잰 값 ${n})`).toBeGreaterThan(0);
  const r = await rclick(page, '#sB .grid-block .grd-line', 0);
  expect(r.gridItems.length, `그리드 전용 항목 수 — 잰 값 ${JSON.stringify(r.gridItems)}`).toBeGreaterThan(0);
  expect(r.cmpItems, `그리드에서 cmp 항목이 뜨면 판정이 샌 것 — 잰 값 ${JSON.stringify(r.cmpItems)}`).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R7 ★음성대조: 카드 ★여백(행 밖) 우클릭엔 cmp 항목이 ★안 뜬다', async ({ page }) => {
  const errs = await setup(page, CMP2);
  await assertRuler(page);
  /* 블럭의 «맨 위» — 캡션/카드 바깥 그림자 여유(yPad) 자리. 행도 헤더도 아니다. */
  const pt = await page.evaluate(() => {
    const b = window.__blk.getBoundingClientRect();
    return [b.left + b.width / 2, b.top + 2];
  });
  const hit = await page.evaluate(([x, y]) => {
    const e = document.elementFromPoint(x, y);
    return { cls: (e?.className || '').toString().slice(0, 40), isRow: !!e?.closest?.('.cmp-row'), isHd: !!e?.closest?.('.cmp-hd') };
  }, pt);
  expect(hit.isRow, `전제 — 누를 자리가 행이 ★아니다 (잰 값 ${JSON.stringify(hit)})`).toBe(false);
  await page.mouse.click(pt[0], pt[1], { button: 'right' });
  await page.waitForTimeout(150);
  const r = await page.evaluate((pfx) => {
    const m = document.getElementById('block-context-menu');
    const vis = [...m.querySelectorAll(':scope > .bcm-item')].filter(i => getComputedStyle(i).display !== 'none');
    return { visible: vis.map(i => i.id), cmpItems: vis.filter(i => i.id.startsWith(pfx)).map(i => i.id) };
  }, CMP_ITEM_PREFIX);
  expect(r.cmpItems, `여백에서 보인 cmp 항목 — 잰 값 ${JSON.stringify(r)}`).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R8 ⑹ 저장 왕복 — 우클릭으로 만든 이미지 칸이 저장→다시 열기 뒤에도 이미지 칸이다', async ({ page }) => {
  await setup(page, CMP2);
  await assertRuler(page);
  const r = await rclick(page, '#sB .comparison-block .cmp-row', 0);
  const toImg = r.cmpItems.find(i => /img/.test(i.id) && !/del/.test(i.id));
  expect(toImg, `전제 — 「이미지 칸으로」가 보인다 ${JSON.stringify(r.cmpItems)}`).toBeTruthy();
  await clickItem(page, toImg.id);
  const id = await page.evaluate(() => window.__blk.id);
  expect((await model(page))[0].rows[0].type, '전제 — 왕복 «전»에 image 다').toBe('image');
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForTimeout(400);
  const after = await page.evaluate((bid) => {
    const b = document.getElementById(bid);
    if (!b) return { missing: true };
    window.__blk = b;
    const rows = window.getComparisonCols(b.dataset);
    const r0 = b.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]');
    return { type: rows[0].rows[0].type, cls: r0 ? r0.className : null };
  }, id);
  expect(after.missing, '전제 — 같은 id 로 다시 섰다').toBeUndefined();
  expect(after.type, `왕복 뒤 모델 type — 잰 값 ${JSON.stringify(after)}`).toBe('image');
  expect(after.cls, '왕복 뒤에도 이미지 슬롯으로 그려진다').toContain('cmp-img');
});

test('R9 ★선택된 블럭에서도 우클릭이 닿는다 (오버레이가 안 가로챈다)', async ({ page }) => {
  const errs = await setup(page, CMP2);
  await assertRuler(page);
  await page.evaluate(() => window.selectBlock?.(window.__blk.id));
  await page.waitForTimeout(250);
  const sel = await page.evaluate(() => window.__blk.classList.contains('selected'));
  expect(sel, '전제 — 블럭이 선택됐다').toBe(true);
  const r = await rclick(page, '#sB .comparison-block .cmp-row', 1);
  expect(r.cmpItems.length, `선택 상태에서 본 cmp 항목 — 잰 값 ${JSON.stringify(r)}`).toBeGreaterThan(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R10 ★기록한다 — 누르면 pushHistory·scheduleAutoSave 가 불린다 (패널 길과 같은 규약)', async ({ page }) => {
  const errs = await setup(page, CMP2);
  await assertRuler(page);
  const r = await rclick(page, '#sB .comparison-block .cmp-row', 0);
  const toImg = r.cmpItems.find(i => /img/.test(i.id) && !/del/.test(i.id));
  expect(toImg, `전제 — 항목이 보인다 ${JSON.stringify(r.cmpItems)}`).toBeTruthy();
  await page.evaluate(() => {
    window.__spy = { hist: 0, save: 0 };
    const h = window.pushHistory, s = window.scheduleAutoSave;
    window.pushHistory = (...a) => { window.__spy.hist++; return h?.(...a); };
    window.scheduleAutoSave = (...a) => { window.__spy.save++; return s?.(...a); };
  });
  await clickItem(page, toImg.id);
  const spy = await page.evaluate(() => window.__spy);
  expect(spy.hist, `pushHistory 호출 수 — 잰 값 ${JSON.stringify(spy)}`).toBeGreaterThan(0);
  expect(spy.save, `scheduleAutoSave 호출 수 — 잰 값 ${JSON.stringify(spy)}`).toBeGreaterThan(0);
  expect(errs, errs.join('\n')).toEqual([]);
});
