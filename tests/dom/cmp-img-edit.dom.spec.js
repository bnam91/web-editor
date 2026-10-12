/* cmp-img-edit.dom.spec.js — 1012t1D3 비교(comparison) 셀 «이미지 칸» 편집. (2026-10-12 · S1 하네스)
 *
 * ★현빈 원문: 「하나의 셀 안에 그리드 블럭처럼 우클릭을 통해서 이미지칸으로 쓸 수 있는데 이미지 삽입 후 이미지 편집이 안 되는 문제」
 *
 * ★재현(plan-D §D3 · 고치기 전 실측): 그리드 이미지 줄엔 되는데 비교 이미지 칸엔 «0» 이던 것 —
 *   ⑴ 칸 선택 표시 ⑵ 칸 단위 「Image」 패널 절 ⑷ 더블클릭 위치·확대 편집 ⑸ 캔버스에서 교체(우클릭/빈 칸 더블클릭).
 *   (⑶ 크기 손잡이는 «안 만든다» — 결정 ⑦: 비교 행 높이는 «전 칼럼 공통»이라 칸 코너가 뜻이 다르다.)
 * ★몸짓 = 그리드(2번째 클릭 = 칸 선택 · 더블클릭 = 편집기 · 우클릭 「이미지 교체」), 편집기 = 카드블럭 꼴.
 *
 * ★파일창은 «안 연다» — HTMLInputElement.prototype.click 을 가로채 «배선만» 잰다(레인 금지선).
 * ★그림은 dataURL 을 row.imgSrc 에 직접 넣는다.
 * ⛔고정 대기 0 — 무엇을 기다리는지 waitForFunction / expect.poll 로 적는다.
 *
 * 음성대조(이 칸들이 «참»인지):
 *   · js/block-drag.js 의 비교 dblclick 가지 `window.enterCmpImageEditMode?.(block, a)` 를 깨면 → E2 빨강
 *   · js/blocks/comparison-block.js cmpImgBgPos 의 `${row.imgX ?? 50}%` 식을 깨면 → E6 빨강 / 'center' 를 깨면 → E7 빨강
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-img-edit
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
/* 칼럼0: [그림 든 칸, 글자, 빈 슬롯] · 칼럼1: [그림 든 칸, 글자, 글자] */
const MAKE = `window.addComparisonBlock({ cols: [
  { title: 'A', rows: [{type:'image',text:'',imgSrc:'${PX}',imgFit:'cover'},{type:'text',text:'a1'},{type:'image',text:'',imgSrc:'',imgFit:'cover'}] },
  { title: 'B', rows: [{type:'image',text:'',imgSrc:'${PX}',imgFit:'cover'},{type:'text',text:'b1'},{type:'text',text:'b2'}] }], featured: 1 });`;

const cellSel = (c, r) => `#sB .comparison-block .cmp-row[data-col-idx="${c}"][data-row-idx="${r}"]`;

async function setup(page) {
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
    window.__bid = window.__blk?.id;
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [MAKE, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected && !window.__blk.classList.contains('selected'), null, { timeout: 5000 });
  return errs;
}
const blk = 'document.getElementById(window.__bid)';
const model = (page) => page.evaluate(`window.getComparisonCols(${blk}.dataset)`);
const count = (page, sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

/* 칸 가운데(멈춘 뒤) + «누르는 점이 그 칸 위»라는 전제 단언 */
async function at(page, c, r) {
  /* ★스크롤러는 #canvas-wrap 이다(요소 scrollIntoView 가 창을 안 움직인다 — 이벨류에이터 실측 y=1298 > 뷰포트 1200).
     그 칸의 가운데를 #canvas-wrap 의 가운데로 맞춘다. 맞춘 뒤 «누르는 점이 그 칸 위»는 아래에서 그대로 단언한다. */
  await page.evaluate((s) => {
    const el = document.querySelector(s), wrap = document.getElementById('canvas-wrap');
    if (!el || !wrap) return;
    const er = el.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    wrap.scrollTop += (er.top + er.height / 2) - (wr.top + wr.height / 2);
    wrap.scrollLeft += (er.left + er.width / 2) - (wr.left + wr.width / 2);
  }, cellSel(c, r));
  const rc = await waitStableRect(page, cellSel(c, r));
  const vp = page.viewportSize();
  expect(rc.cy > 0 && rc.cy < vp.height && rc.cx > 0 && rc.cx < vp.width, `전제 — 칸 ${c}/${r} 가운데가 뷰포트 안 (${rc.cx},${rc.cy})`).toBe(true);
  const hit = await page.evaluate(([x, y, s]) => {
    const e = document.elementFromPoint(x, y); const want = document.querySelector(s);
    return !!(e && want && (e === want || want.contains(e)));
  }, [rc.cx, rc.cy, cellSel(c, r)]);
  expect(hit, `전제 — (${rc.cx},${rc.cy}) 가 칸 ${c}/${r} 위다`).toBe(true);
  return rc;
}
/* 파일창 «배선만» 재기 — 열지 않는다 */
async function spyFileClick(page) {
  await page.evaluate(() => {
    window.__fileClicks = [];
    HTMLInputElement.prototype.click = function () { window.__fileClicks.push(this.type); };
  });
}
async function rclickItems(page, c, r) {
  const p = await at(page, c, r);
  await page.mouse.click(p.cx, p.cy, { button: 'right' });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('block-context-menu')).display === 'block', null, { timeout: 3000 });
  return page.evaluate(() => [...document.querySelectorAll('#block-context-menu > .bcm-item')]
    .filter(i => getComputedStyle(i).display !== 'none' && i.id.startsWith('bcm-cmp-')).map(i => i.id));
}
/* 메뉴 닫기 — block-factory.js 가 document 'click' 에 closeMenu 를 건다. 화면 어딘가를 «누르면» 그 자리 단추가 눌릴 수 있어 이벤트만 보낸다. */
async function closeMenu(page) {
  /* 대상은 body — document 자체에 쏘면 다른 click 리스너들의 e.target.closest 가 없어 던진다(실측 E8) */
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForFunction(() => getComputedStyle(document.getElementById('block-context-menu')).display === 'none', null, { timeout: 3000 });
}

test('E0 전제 — 그림 든 칸 2 · data: 배경 · 누르는 점이 칸 위', async ({ page }) => {
  const errs = await setup(page);
  expect(await count(page, '#sB .comparison-block .cmp-img:not(.cmp-img-empty)'), '그림 든 칸 수').toBe(2);
  const bg = await page.evaluate((s) => document.querySelector(s).style.backgroundImage, cellSel(0, 0));
  expect(bg, '배경이 data: 그림이다').toContain('data:image/png');
  await at(page, 0, 0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E1 클릭1 = 블럭만 · 클릭2(이미지 칸) = 칸 표시 1 + 「Image」 절 1 · 글자 칸 2번째 클릭 = 0', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, 0, 0);
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  expect(await count(page, '.cmp-cell-selected'), '클릭1 — 칸 표시 없음(블럭만)').toBe(0);
  expect(await count(page, '#cmp-img-section'), '클릭1 — Image 절 없음').toBe(0);
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => document.querySelectorAll('.cmp-cell-selected').length === 1 && !!document.getElementById('cmp-img-section'), null, { timeout: 3000 });
  const marked = await page.evaluate(() => { const e = document.querySelector('.cmp-cell-selected'); return [e.dataset.colIdx, e.dataset.rowIdx]; });
  expect(marked, '표시가 «누른 그 칸»에 있다').toEqual(['0', '0']);
  expect(await page.evaluate(() => document.getElementById('cmp-img-pick-btn')?.textContent.trim()), '절 첫 줄 = 교체 단추').toBe('이미지 교체…');
  /* 음성: 글자 칸 2번째 클릭 → 칸 선택 풀림 */
  const t = await at(page, 0, 1);
  await page.mouse.click(t.cx, t.cy);
  await page.waitForFunction(() => document.querySelectorAll('.cmp-cell-selected').length === 0 && !document.getElementById('cmp-img-section'), null, { timeout: 3000 });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E2 더블클릭 → 편집기 · 휠 = 확대 · 드래그 = 위치 · Esc = 끝 · ⌘Z 한 걸음 = 위치만', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, 0, 0);
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction(() => document.querySelectorAll('.cmp-img-editing').length === 1, null, { timeout: 3000 });
  expect(await page.evaluate(() => !!document.querySelector('.cmp-img-editing .img-edit-hint')), '안내 칩').toBe(true);
  // 휠 = 확대
  await page.mouse.move(p.cx, p.cy);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await model(page))[0].rows[0].imgScale || 100, { timeout: 3000 }).toBeGreaterThan(100);
  const scale1 = (await model(page))[0].rows[0].imgScale;
  // 드래그 = 위치
  await page.mouse.move(p.cx, p.cy);
  await page.mouse.down();
  await page.mouse.move(p.cx + 40, p.cy + 30, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await model(page))[0].rows[0].imgX ?? 50, { timeout: 3000 }).toBeLessThan(50);
  const r1 = (await model(page))[0].rows[0];
  expect(r1.imgY, '세로도 움직였다').toBeLessThan(50);
  expect(await count(page, '.cmp-img-editing'), '드래그 뒤에도 편집 중').toBe(1);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.cmp-img-editing').length === 0, null, { timeout: 3000 });
  expect(await page.evaluate(() => document.getElementById(window.__bid).isConnected), 'Esc 가 블럭을 안 건드렸다').toBe(true);
  // ⌘Z 한 걸음 — 위치만 되돌린다(확대는 그 앞 동작)
  await page.evaluate(() => window.undo());
  await expect.poll(async () => (await model(page))[0].rows[0].imgX, { timeout: 3000 }).toBeUndefined();
  expect((await model(page))[0].rows[0].imgScale, '확대는 그대로').toBe(scale1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E3 음성 — 글자 칸 더블클릭 = 글자 편집(contenteditable) · 편집기 0', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, 0, 1);
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', cellSel(0, 1), { timeout: 3000 });
  expect(await count(page, '.cmp-img-editing'), '편집기 0').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E4 빈 슬롯 더블클릭 = 편집기 0 · 파일 고르기 배선 1(가로챔 · 파일창 0)', async ({ page }) => {
  const errs = await setup(page);
  await spyFileClick(page);
  const p = await at(page, 0, 2);
  expect(await page.evaluate((s) => document.querySelector(s).classList.contains('cmp-img-empty'), cellSel(0, 2)), '전제 — 빈 슬롯').toBe(true);
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction(() => window.__fileClicks.length >= 1, null, { timeout: 3000 });
  expect(await page.evaluate(() => window.__fileClicks), 'file input 하나').toEqual(['file']);
  expect(await count(page, '.cmp-img-editing'), '편집기 0').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E5 편집 중 ⌫ = 그림만 비움 · 칸은 image 로 남음 · 블럭 안 지워짐', async ({ page }) => {
  const errs = await setup(page);
  const n0 = await count(page, '#sB .comparison-block');
  const p = await at(page, 0, 0);
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction(() => document.querySelectorAll('.cmp-img-editing').length === 1, null, { timeout: 3000 });
  await page.keyboard.press('Backspace');
  await expect.poll(async () => String((await model(page))[0].rows[0].imgSrc || ''), { timeout: 3000 }).toBe('');
  const m = await model(page);
  expect(m[0].rows[0].type, '칸은 image 로 남는다').toBe('image');
  expect(m[0].rows.length, '행 수 그대로').toBe(3);
  expect(await count(page, '#sB .comparison-block'), '블럭 수 그대로').toBe(n0);
  expect(await page.evaluate((s) => document.querySelector(s).classList.contains('cmp-img-empty'), cellSel(0, 0)), '빈 슬롯으로 그려진다').toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E6 저장 왕복 + 내보내기 클론 — imgX/imgY/imgScale 생존 · 그림 같음', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    const cols = window.getComparisonCols(b.dataset);
    Object.assign(cols[0].rows[0], { imgX: 20, imgY: 70, imgScale: 150 });
    window.setComparisonCols(b, cols); window.renderComparison(b);
  });
  const drawn = await page.evaluate((s) => { const e = document.querySelector(s); return { pos: e.style.backgroundPosition, size: e.style.backgroundSize }; }, cellSel(0, 0));
  expect(drawn, '그려진 위치/확대').toEqual({ pos: '20% 70%', size: '150%' });
  /* 내보내기 클론처럼 — #canvas 밖에 복제해 다시 그린다(export-image 가 클론에서 renderComparison 을 다시 부른다) */
  const cl = await page.evaluate(() => {
    const c = document.getElementById(window.__bid).cloneNode(true); c.id = 'cmp-clone-e6';
    document.body.appendChild(c); window.renderComparison(c);
    const e = c.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]');
    const out = { pos: e.style.backgroundPosition, size: e.style.backgroundSize }; c.remove(); return out;
  });
  expect(cl, '클론 그림 = 캔버스 그림').toEqual(drawn);
  const snap = await page.evaluate(() => window.serializeProject());
  const bid = await page.evaluate(() => window.__bid);
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForFunction((id) => !!document.getElementById(id)?.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]'), bid, { timeout: 5000 });
  const after = await page.evaluate((id) => {
    const b = document.getElementById(id); const r = window.getComparisonCols(b.dataset)[0].rows[0];
    const e = b.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]');
    return { x: r.imgX, y: r.imgY, s: r.imgScale, pos: e.style.backgroundPosition, size: e.style.backgroundSize };
  }, bid);
  expect(after, '왕복 뒤').toEqual({ x: 20, y: 70, s: 150, pos: '20% 70%', size: '150%' });
});

test('E7 하위호환 — 위치 키 없는 옛 행은 고치기 전과 같은 그림(cover|contain · center)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(([s, px]) => {
    const b = document.getElementById(window.__bid);
    const cols = window.getComparisonCols(b.dataset);
    cols[1].rows[0] = { type: 'image', text: '', imgSrc: px, imgFit: 'contain' };   // 옛 꼴: 위치 키 없음
    window.setComparisonCols(b, cols); window.renderComparison(b);
    /* «고치기 전» 렌더가 쓰던 바로 그 문자열을 같은 브라우저로 정규화해 견준다 */
    const old = (fit) => { const d = document.createElement('div'); d.style.cssText = `background-size:${fit};background-position:center;`; return { size: d.style.backgroundSize, pos: d.style.backgroundPosition }; };
    const cur = (sel) => { const e = document.querySelector(sel); return { size: e.style.backgroundSize, pos: e.style.backgroundPosition }; };
    return { cover: cur(s[0]), oldCover: old('cover'), contain: cur(s[1]), oldContain: old('contain'),
             keys: Object.keys(window.getComparisonCols(b.dataset)[1].rows[0]) };
  }, [[cellSel(0, 0), cellSel(1, 0)], PX]);
  expect(r.cover, 'cover 행').toEqual(r.oldCover);
  expect(r.contain, 'contain 행').toEqual(r.oldContain);
  expect(r.keys.filter(k => /^img(X|Y|Scale)$/.test(k)), '렌더가 위치 키를 «만들지» 않는다').toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E8 우클릭 「이미지 교체」 — 그림 든 칸에만 · 빈 칸/글자 칸엔 0 · 누르면 파일 고르기 배선 1', async ({ page }) => {
  const errs = await setup(page);
  const ID = 'bcm-cmp-img-replace';
  expect(await page.evaluate((id) => !!document.getElementById(id), ID), '전제 — 메뉴 항목이 있다').toBe(true);
  expect(await rclickItems(page, 0, 0), '그림 든 칸').toContain(ID);
  await closeMenu(page);
  expect(await rclickItems(page, 0, 2), '빈 슬롯').not.toContain(ID);
  await closeMenu(page);
  expect(await rclickItems(page, 0, 1), '글자 칸').not.toContain(ID);
  await closeMenu(page);
  await spyFileClick(page);
  await rclickItems(page, 1, 0);
  const box = await page.locator('#' + ID).boundingBox();
  expect(box && box.height > 0, '전제 — 항목이 보인다').toBe(true);
  await page.mouse.click(box.x + 20, box.y + box.height / 2);
  await page.waitForFunction(() => window.__fileClicks.length >= 1, null, { timeout: 3000 });
  expect(await page.evaluate(() => window.__fileClicks), 'file input 하나').toEqual(['file']);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E9 문(MCP/AI) — cols 교체 뒤 imgX/imgY/imgScale 생존 · 범위 밖은 클램프 · 수 아님은 거절', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    const cols = window.getComparisonCols(b.dataset);
    Object.assign(cols[0].rows[0], { imgX: 12, imgY: 34, imgScale: 220 });
    window.setComparisonCols(b, cols);
    const res = window.updateComparisonBlock(b.id, { cols: window.getComparisonCols(b.dataset) });
    const kept = window.getComparisonCols(b.dataset)[0].rows[0];
    const res2 = window.updateComparisonBlock(b.id, { columnPatch: [{ index: 1, rows: [{ type: 'image', imgSrc: '', imgX: 150, imgScale: 50 }] }] });
    const clamped = window.getComparisonCols(b.dataset)[1].rows[0];
    const res3 = window.updateComparisonBlock(b.id, { columnPatch: [{ index: 1, rows: [{ type: 'image', imgSrc: '', imgX: 'abc' }] }] });
    return { ok: res.ok, kept: [kept.imgX, kept.imgY, kept.imgScale], ok2: res2.ok, clamped: [clamped.imgX, clamped.imgScale], ok3: res3.ok, code3: res3.code };
  });
  expect(r.ok, 'cols 교체 ok').toBe(true);
  expect(r.kept, 'cols 교체 뒤 생존').toEqual([12, 34, 220]);
  expect(r.ok2, 'columnPatch ok').toBe(true);
  expect(r.clamped, '범위 밖 → 클램프(0~100 · 100~400)').toEqual([100, 100]);
  expect([r.ok3, r.code3], '수 아님 → INVALID').toEqual([false, 'INVALID']);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E10 편집 중 표시는 저장·히스토리에 안 실린다 — 직렬화에 cmp-img-editing·칩 0 · 나간 뒤 같은 상태 표본은 중복 차단', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, 0, 0);
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction(() => document.querySelectorAll('.cmp-img-editing').length === 1 && !!document.querySelector('.cmp-img-editing .img-edit-hint'), null, { timeout: 3000 });
  await page.mouse.move(p.cx, p.cy);
  await page.mouse.down();
  await page.mouse.move(p.cx + 30, p.cy + 20, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await model(page))[0].rows[0].imgX ?? 50, { timeout: 3000 }).toBeLessThan(50);
  /* ⒜ 편집 «중» 직렬화(자동저장 재료) — 라이브엔 있는데(전제) 저장본엔 0 */
  const ser = await page.evaluate(() => {
    const s = window.serializeProject(); const str = typeof s === 'string' ? s : JSON.stringify(s);
    return { live: document.querySelectorAll('.cmp-img-editing, .cmp-img-editing .img-edit-hint').length,
             cls: (str.match(/cmp-img-editing/g) || []).length, chip: (str.match(/img-edit-hint/g) || []).length };
  });
  expect(ser.live, '전제 — 라이브엔 편집 표시가 있다').toBe(2);
  expect([ser.cls, ser.chip], '직렬화에 편집 클래스·칩 0').toEqual([0, 0]);
  /* ⒝ 히스토리 — 편집 중 찍힌 «끝 표본»과 나간 뒤 같은 상태를 다시 찍으면 중복 차단이 걸러야 한다(클래스가 실리면 한 칸 더 생긴다 → ⌘Z 첫 번 무효) */
  const len0 = await page.evaluate(() => window.getHistoryTip().len);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.cmp-img-editing').length === 0, null, { timeout: 3000 });
  const len1 = await page.evaluate(() => { window.pushHistory('E10 같은 상태'); return window.getHistoryTip().len; });
  expect(len1, `편집 중/후 표본이 같다(len ${len0} → ${len1})`).toBe(len0);
  expect(errs, errs.join('\n')).toEqual([]);
});
