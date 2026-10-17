/* cmp-row-lines.dom.spec.js — 1012t1D2 비교(comparison) 칸 «안»에 줄 추가 (그리드 칸처럼). (2026-10-12 · S1 하네스)
 *
 * ★현빈 원문: 「하나의 로우 안에 현재는 하나의 텍스트만 들어가는데 그리드칸처럼 줄을 추가할 수 있게 해줄 것」
 * ★길: js/blocks/line-host.js 의 «세 번째 주인»(버블·챗 다음) — 줄 데이터·렌더·패널(줄바 「+ 줄 추가」·줄 꾸미기·Typography)·
 *   T/⌫/Esc·줄 더블클릭 편집을 그 계약으로 빌린다(사본 0). 주인 계약에 「칸」 축(c)을 열었다 — 버블·챗은 c = 0 고정(cAxis false).
 * ★결정(기본값): 줄 종류 = 글자 역할 + 여백(그림 줄 없음) · 다른 칸으로 옮기기 없음(v1) · 줄이 늘면 그 행 높이 자동(전 칼럼) ·
 *   강조 칼럼 줄 글자 배율 없음 · 빈 줄 안내 = D5 와 같은 ‘내용을 입력하세요.’(비교 안에서만 덮음).
 * ⛔고정 대기 0 — 무엇을 기다리는지 waitForFunction / expect.poll 로 적는다.
 *
 * 음성대조(이 칸들이 «참»인지 — 오케스트레이터가 한 번씩 깨서 잰다):
 *   · js/blocks/comparison-block.js renderComparison 줄 가지 `} else if (row && lnHasLines(row.lines)) {` 를
 *     `} else if (false && row && lnHasLines(row.lines)) {` 로 → L1 빨강(그 칸 .ln-row 0)
 *   · 같은 파일 `if (need) { renderComparison(block, need); return; }` 를 `if (false && need)` 로 → L3 빨강(행 높이 64 그대로 · 넘침)
 *   · js/blocks/line-host.js lnCmpHost 의 `cAxis: true` 를 `cAxis: false` 로 → L1 빨강(칼럼 0 이 아닌 칸 · 칼럼 축이 0 으로 접힌다)
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-row-lines
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
/* 칼럼0(muted): [a0, a1] · 칼럼1(강조): [b0, b1] — 전부 글자 칸 · 줄 없음(= 옛 저장본 꼴) */
const MAKE = `window.addComparisonBlock({ cols: [
  { title: 'A', rows: [{type:'text',text:'a0'},{type:'text',text:'a1'}] },
  { title: 'B', rows: [{type:'text',text:'b0'},{type:'text',text:'b1'}] }], featured: 1 });`;

const cellSel = (c, r) => `#sB .comparison-block .cmp-row[data-col-idx="${c}"][data-row-idx="${r}"]`;
const lineSel = (c, r, li) => `${cellSel(c, r)} > .ln-row[data-ln="${li}"]`;

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

/* 요소 가운데(멈춘 뒤) + «누르는 점이 그 요소 위»라는 전제 단언 */
async function at(page, sel) {
  const rc = await waitStableRect(page, sel);
  const hit = await page.evaluate(([x, y, s]) => {
    const e = document.elementFromPoint(x, y); const want = document.querySelector(s);
    return !!(e && want && (e === want || want.contains(e)));
  }, [rc.cx, rc.cy, sel]);
  expect(hit, `전제 — (${rc.cx},${rc.cy}) 가 ${sel} 위다`).toBe(true);
  return rc;
}
/* 블럭 고르기(클릭1) → 칸 고르기(클릭2) */
async function pickCell(page, c, r) {
  const p = await at(page, cellSel(c, r));
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => !!document.getElementById('grd-line-add-kind'), null, { timeout: 3000 });
}
/* 「+ 줄 추가▾」 — 그리드·버블·챗과 같은 id */
async function addLine(page, kind) {
  await expect(page.locator('#grd-line-add-kind'), '전제: 「+ 줄 추가」가 패널에 있다').toBeVisible();
  await page.locator('#grd-line-add-kind').selectOption(kind);
}

test('L0 전제 — 클릭1 = 블럭만(줄바 0) · 클릭2(글자 칸) = 활성 칸 {r,c,li:null} + 줄바 1 · D3 이미지 칸 표시 0', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, cellSel(0, 1));
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  expect(await count(page, '#grd-line-add-kind'), '클릭1 — 줄바 없음').toBe(0);
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => !!document.getElementById('grd-line-add-kind'), null, { timeout: 3000 });
  expect(await page.evaluate(`window.grdGetActiveLine(${blk})`), '활성 = 그 칸(줄 없음)').toEqual({ r: 1, c: 0, li: null });
  expect(await count(page, '#ln-line-panel'), '줄 절 1').toBe(1);
  expect(await count(page, '.cmp-cell-selected'), 'D3 이미지 칸 표시는 안 뜬다').toBe(0);
  const kinds = await page.locator('#grd-line-add-kind option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
  expect(kinds, '줄 종류 — 그림 줄 없음(결정 ⑧)').not.toContain('image');
  expect(kinds, '줄 종류 — 여백 있음').toContain('gap');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('L1 「+ 줄 추가▾ 제목 2」 → 그 칸만 줄 2(첫 줄 = 굽힌 원래 글) · text 거울 · 다른 칸 0 (칼럼 1 = 강조 칸도)', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 1, 0);
  await addLine(page, 'h2');
  await expect.poll(async () => ((await model(page))[1].rows[0].lines || []).length, { timeout: 3000 }).toBe(2);
  const m = await model(page);
  expect(m[1].rows[0].lines[0].text, '첫 줄 = 원래 글을 굽힌 것').toBe('b0');
  expect(m[1].rows[0].lines[1].type, '둘째 줄 = 제목 2').toBe('h2');
  expect(m[1].rows[0].text, 'text = 줄 글자 거울(글자 줄마다 한 줄 · 빈 줄은 빈 줄 — 챗 D3 lnPlainText 그대로)').toBe('b0\n');
  expect([m[0].rows[0].lines, m[0].rows[1].lines, m[1].rows[1].lines], '다른 칸 모델 무접촉').toEqual([undefined, undefined, undefined]);
  expect(await count(page, `${cellSel(1, 0)} > .ln-row`), '그 칸 줄 2').toBe(2);
  expect(await count(page, '#sB .comparison-block .ln-row'), '블럭 전체 줄 = 그 칸 2 뿐').toBe(2);
  expect(await page.evaluate((s) => document.querySelector(s).classList.contains('cmp-lines'), cellSel(1, 0)), '줄 칸 표식').toBe(true);
  expect(await page.evaluate(`window.grdGetActiveLine(${blk})`), '활성 = 새 줄(굽기로 한 칸 밀림)').toEqual({ r: 0, c: 1, li: 1 });
  expect(await count(page, `${lineSel(1, 0, 1)}.ln-line-selected`), '줄 선택 표시 = 새 줄').toBe(1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('L2 줄 더블클릭 → 그 줄만 편집 · 입력 → lines[1].text · text 거울', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 0);
  await addLine(page, 'h2');
  await expect.poll(async () => ((await model(page))[0].rows[0].lines || []).length, { timeout: 3000 }).toBe(2);
  const q = await at(page, lineSel(0, 0, 1));
  await page.mouse.dblclick(q.cx, q.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.firstElementChild?.getAttribute('contenteditable') === 'true', lineSel(0, 0, 1), { timeout: 3000 });
  expect(await page.evaluate((s) => document.querySelector(s)?.firstElementChild?.getAttribute('contenteditable'), lineSel(0, 0, 0)), '첫 줄은 편집 안 켜짐').not.toBe('true');
  expect(await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), cellSel(0, 0)), '칸 통째 편집 0').not.toBe('true');
  await page.keyboard.type('제목');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await model(page))[0].rows[0].lines[1].text, { timeout: 3000 }).toBe('제목');
  expect((await model(page))[0].rows[0].text, 'text 거울').toBe('a0\n제목');
  expect(await page.evaluate(() => document.getElementById(window.__bid)?.isConnected), 'Esc 가 블럭을 안 건드렸다').toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('L3 줄이 늘면 그 행 높이 자동 확장(전 칼럼) · 강조 = ×featScale · 넘침 0 · 다른 행 그대로', async ({ page }) => {
  const errs = await setup(page);
  const h0 = await page.evaluate((s) => parseFloat(document.querySelector(s).style.height), cellSel(0, 0));
  expect(h0, '전제 — 기본 행 높이 64').toBe(64);
  await pickCell(page, 0, 0);
  await addLine(page, 'h2');
  await expect.poll(async () => ((await model(page))[0].rows[0].lines || []).length, { timeout: 3000 }).toBe(2);
  const g = await page.evaluate(([a, b, c, d]) => {
    const e0 = document.querySelector(a), e1 = document.querySelector(b), r1 = document.querySelector(c);
    const kids = e0.children; const span = (kids[kids.length - 1].offsetTop + kids[kids.length - 1].offsetHeight) - kids[0].offsetTop;
    return { h0: parseFloat(e0.style.height), h1: parseFloat(e1.style.height), other: parseFloat(r1.style.height),
             client: e0.clientHeight, span, feat: parseFloat(document.getElementById(window.__bid).dataset.featScale) || 1.2,
             other1: parseFloat(document.querySelector(d).style.height) };
  }, [cellSel(0, 0), cellSel(1, 0), cellSel(0, 1), cellSel(1, 1)]);
  expect(g.h0, '줄 칸 행이 늘었다').toBeGreaterThan(64);
  expect(g.h1, '같은 행 강조 칸 = 그 높이 × featScale').toBe(Math.round(g.h0 * g.feat));
  expect(g.span, '넘침 0 — 줄 내용 ≤ 칸 높이').toBeLessThanOrEqual(g.client);
  expect([g.other, g.other1], '다른 행(1)은 그대로(64 · ×1.2)').toEqual([64, Math.round(64 * g.feat)]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('L4 줄 고른 채 T = 줄 하나 더 · ⌫ = 고른 줄만(블럭 남음) · ⌘Z 한 걸음 · Esc = 줄 선택만 풀림', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 0);
  await addLine(page, 'h3');
  await expect.poll(async () => ((await model(page))[0].rows[0].lines || []).length, { timeout: 3000 }).toBe(2);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('t');
  await expect.poll(async () => (await model(page))[0].rows[0].lines.length, { timeout: 3000 }).toBe(3);
  expect(await page.evaluate(`window.grdGetActiveLine(${blk})`), 'T 뒤 활성 = 새 줄').toEqual({ r: 0, c: 0, li: 2 });
  expect(await count(page, '#sB .text-block'), 'T 가 텍스트 블럭을 안 만들었다').toBe(0);
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await model(page))[0].rows[0].lines.length, { timeout: 3000 }).toBe(2);
  expect(await page.evaluate(() => !!document.getElementById(window.__bid)), '블럭은 남았다').toBe(true);
  await page.evaluate(() => window.undo());
  await expect.poll(async () => (await model(page))[0].rows[0].lines.length, { timeout: 3000 }).toBe(3);
  /* Esc — 줄 선택만 푼다(블럭 선택은 남는다). ⌘Z 가 DOM 을 갈았으므로 다시 고른다. */
  const q = await at(page, lineSel(0, 0, 0));
  await page.mouse.click(q.cx, q.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  await page.mouse.click(q.cx, q.cy);
  await page.waitForFunction((id) => { const a = window.grdGetActiveLine(document.getElementById(id)); return !!a && a.li === 0; }, await page.evaluate(() => window.__bid), { timeout: 3000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.grdGetActiveLine(document.getElementById(window.__bid)), null, { timeout: 3000 });
  expect(await page.evaluate(() => document.getElementById(window.__bid).classList.contains('selected')), 'Esc 뒤 블럭 선택 유지').toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('L5 하위호환 — 줄 없는(옛) 블럭: 줄 표식 0 · 글자 칸 옛 꼴(가로 flex · 높이 64/77) · 옛 기하 그대로 · lines:[] = 없음과 같은 그림', async ({ page }) => {
  const errs = await setup(page);
  const g = await page.evaluate(([a, b]) => {
    const B = document.getElementById(window.__blk.id);
    const e0 = document.querySelector(a), e1 = document.querySelector(b);
    return {
      lnRows: B.querySelectorAll('.ln-row, .cmp-lines, [data-ln], [data-ln-c]').length,
      text0: e0.textContent, h0: e0.style.height, h1: e1.style.height,
      dir0: e0.style.flexDirection, align0: e0.style.alignItems, display0: e0.style.display,
      innerH: B.querySelector('.cmp-inner').style.height,
    };
  }, [cellSel(0, 0), cellSel(1, 0)]);
  /* 옛 기하(고치기 전 식 그대로): 강조 칼럼 = 헤더 72×1.2(86) + 2행 × (64×1.2(77) + 8×1.2(10)) = 260 · 높이 = 260 + 위아래 여유 24×2 = 308 */
  expect(g, '옛 꼴').toEqual({ lnRows: 0, text0: 'a0', h0: '64px', h1: '77px', dir0: '', align0: 'center', display0: 'flex', innerH: '308px' });
  const same = await page.evaluate(() => {
    const B = document.getElementById(window.__blk.id);
    const before = B.querySelector('.cmp-inner').innerHTML;
    const cols = window.getComparisonCols(B.dataset);
    cols.forEach(c => c.rows.forEach(r => { r.lines = []; }));
    window.setComparisonCols(B, cols); window.renderComparison(B);
    return before === B.querySelector('.cmp-inner').innerHTML;
  });
  expect(same, 'lines:[] 는 «줄 없음»과 같은 산출').toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('L6 저장 왕복 — serializeProject → applyProjectData 뒤 줄·거울·그림 생존', async ({ page }) => {
  await setup(page);
  await pickCell(page, 0, 1);
  await addLine(page, 'h2');
  await expect.poll(async () => ((await model(page))[0].rows[1].lines || []).length, { timeout: 3000 }).toBe(2);
  const before = (await model(page))[0].rows[1];
  const snap = await page.evaluate(() => window.serializeProject());
  const bid = await page.evaluate(() => window.__bid);
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForFunction((id) => !!document.getElementById(id)?.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="1"]'), bid, { timeout: 5000 });
  const after = await page.evaluate((id) => {
    const b = document.getElementById(id); const r = window.getComparisonCols(b.dataset)[0].rows[1];
    return { lines: r.lines, text: r.text, drawn: b.querySelectorAll('.cmp-row[data-col-idx="0"][data-row-idx="1"] > .ln-row').length,
             marks: b.querySelectorAll('.ln-line-selected').length };
  }, bid);
  expect(after.lines, '왕복 뒤 줄 모델').toEqual(before.lines);
  expect(after.text, '왕복 뒤 거울').toBe('a1\n');
  expect(after.drawn, '왕복 뒤 줄 그림 2').toBe(2);
  expect(after.marks, '선택 표시는 저장본에 안 샌다').toBe(0);
});

test('L7 문 — columnPatch{rows[].lines} ok · 그림 줄 거절 · rowLines 이미지 칸 거절 · rowLines null = 줄 걷기 · cols 교체 왕복 보존', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const id = window.__bid; const B = () => document.getElementById(id); const M = () => window.getComparisonCols(B().dataset);
    const out = {};
    const ok1 = window.updateComparisonBlock(id, { columnPatch: [{ index: 0, rows: [
      { type: 'text', lines: [{ type: 'body', text: 'x' }, { type: 'h3', text: 'y' }] }, { type: 'text', text: 'a1' }] }] });
    out.ok1 = ok1.ok; out.m1 = { n: M()[0].rows[0].lines?.length, text: M()[0].rows[0].text };
    out.drawn1 = B().querySelectorAll('.cmp-row[data-col-idx="0"][data-row-idx="0"] > .ln-row').length;
    const snap = B().dataset.cols;
    const bad = window.updateComparisonBlock(id, { columnPatch: [{ index: 0, rows: [{ type: 'text', lines: [{ type: 'image', imgSrc: '' }] }] }] });
    out.bad = [bad.ok, bad.code]; out.badUnchanged = B().dataset.cols === snap;
    /* cols 전체교체 왕복(D1 보존 명부 규칙) — 줄이 살아야 한다 */
    const rt = window.updateComparisonBlock(id, { cols: M() });
    out.rt = [rt.ok, M()[0].rows[0].lines?.length, M()[0].rows[0].text];
    /* 이미지 칸엔 줄이 없다 */
    window.updateComparisonBlock(id, { columnPatch: [{ index: 1, rows: [{ type: 'image', imgSrc: '' }, { type: 'text', text: 'b1' }] }] });
    const img = window.updateComparisonBlock(id, { rowLines: { col: 1, row: 0, lines: [{ type: 'body', text: 'z' }] } });
    out.img = [img.ok, img.code];
    /* rowLines null = 줄 걷기 → 빈 글자 칸(D5 안내 자리) */
    const clr = window.updateComparisonBlock(id, { rowLines: { col: 0, row: 0, lines: null } });
    out.clr = [clr.ok, M()[0].rows[0].lines, M()[0].rows[0].text, B().querySelectorAll('.ln-row').length];
    return out;
  });
  expect(r.ok1, 'columnPatch rows[].lines 받음').toBe(true);
  expect(r.m1, '줄 2 · text 거울').toEqual({ n: 2, text: 'x\ny' });
  expect(r.drawn1, '그림 줄 2').toBe(2);
  expect(r.bad, '그림 줄 = INVALID').toEqual([false, 'INVALID']);
  expect(r.badUnchanged, '거절은 모델 무접촉').toBe(true);
  expect(r.rt, 'cols 교체 왕복 — 줄 생존').toEqual([true, 2, 'x\ny']);
  expect(r.img, 'rowLines 이미지 칸 = INVALID').toEqual([false, 'INVALID']);
  expect(r.clr, 'rowLines null = 줄 걷기').toEqual([true, undefined, '', 0]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('L8 버블·챗 회귀 전제 — 계약을 넓혀도 옛 주인은 칼럼 축 0 · 줄 HTML 에 data-ln-c 0', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const mk = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };
    const hb = window.lnHostFor(mk('speech-bubble-block'));
    const hc = window.lnHostFor(mk('chat-block'));
    const hx = window.lnHostFor(document.getElementById(window.__bid));
    const html = window.lnLinesHtml([{ type: 'body', text: 'x' }], 2);
    return {
      cAxis: [hb.cAxis, hc.cAxis, hx.cAxis],
      bubbleAddr: hb.resolveAny({ r: 0, c: 3, li: null }),
      kind: hx.kind, hasC: html.includes('data-ln-c'), hasM: html.includes('data-ln-m="2"'),
      cmpAddr: hx.resolveAny({ r: 1, c: 1, li: null }),
    };
  });
  expect(r.cAxis, '칼럼 축 — 버블·챗 거짓 · 비교 참').toEqual([false, false, true]);
  expect(r.bubbleAddr, '버블 주소의 c 는 0 으로 접힌다(옛 동작)').toEqual({ r: 0, c: 0, li: null, line: null });
  expect([r.kind, r.hasC, r.hasM], '비교 주인 · 버블/챗 줄 HTML 무변').toEqual(['comparison', false, true]);
  expect(r.cmpAddr, '비교 주소는 c 를 산다').toEqual({ r: 1, c: 1, li: null, line: null });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('L9 빈 줄 안내 = D5 와 같은 문구(window.CMP_ROW_HINT) · 비교 안에서만', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 0);
  await addLine(page, 'body');
  await expect.poll(async () => ((await model(page))[0].rows[0].lines || []).length, { timeout: 3000 }).toBe(2);
  const r = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return { empty: el && el.childNodes.length === 0, content: el ? getComputedStyle(el, '::before').content : null, hint: window.CMP_ROW_HINT };
  }, `${lineSel(0, 0, 1)} > .grd-line`);
  expect(r.empty, '전제 — 새 줄은 비어 있다').toBe(true);
  expect(r.content, '안내 = CMP_ROW_HINT').toBe(JSON.stringify(r.hint));
  expect(errs, errs.join('\n')).toEqual([]);
});

/* ══ 이벨류에이터 지적 후속 (2026-10-13) ══════════════════════════════════════════
 * ⑴ ⌘↓ 가 비교 칸 줄 대신 «블럭»을 옮겼다 — editor.js _gridActiveOuterLine 셀렉터에 .comparison-block 이 없었고,
 *    옮기는 길이 c 를 0 으로 고정했다. ⑵ 칼럼 절 거울 입력이 줄을 붙여 보였다. ⑶ Fill 스와치가 역할 기본색(#555)이었다.
 * 음성대조: js/editor.js _gridActiveOuterLine 의 `, .comparison-block.selected` 를 빼면 → L10·L11 빨강(블럭 순서가 바뀐다). */
const TEXTS = (ls) => (ls || []).map(l => l.text);
async function setupLines(page) {
  const errs = await setup(page);
  const ok = await page.evaluate(() => window.updateComparisonBlock(window.__bid, { rowLines: { col: 1, row: 0, lines: [
    { type: 'body', text: 'A' }, { type: 'body', text: 'B' }, { type: 'body', text: 'C' }] } }).ok);
  expect(ok, '전제 — 칼럼 1 칸(0행)에 줄 셋').toBe(true);
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 3, `${cellSel(1, 0)} > .ln-row`, { timeout: 3000 });
  return errs;
}
async function pickLine(page, c, r, li) {
  const q = await at(page, lineSel(c, r, li));
  await page.mouse.click(q.cx, q.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  await page.mouse.click(q.cx, q.cy);
  await page.waitForFunction(([id, a]) => JSON.stringify(window.grdGetActiveLine(document.getElementById(id))) === JSON.stringify(a),
    [await page.evaluate(() => window.__bid), { r, c, li }], { timeout: 3000 });
  await page.evaluate(() => document.activeElement?.blur?.());
}
const blockOrder = (page) => page.evaluate(() => [...document.querySelectorAll('#sB .section-inner > *')].map(e =>
  e.querySelector('.comparison-block') || e.classList.contains('comparison-block') ? 'CMP' : (e.classList.contains('gap-block') || e.querySelector('.gap-block') ? 'gap' : e.className)));

test('L10 칼럼 1 칸 줄 셋 · 둘째 줄 고르고 ⌘↓ → 줄 순서 A,C,B · 블럭 순서 불변 · ⌘Z 한 번에 A,B,C', async ({ page }) => {
  const errs = await setupLines(page);
  const order0 = await blockOrder(page);
  expect(order0, '전제 — 블럭 순서에 CMP 가 있다').toContain('CMP');
  await pickLine(page, 1, 0, 1);
  await page.keyboard.press('Meta+ArrowDown');
  await expect.poll(async () => TEXTS((await model(page))[1].rows[0].lines), { timeout: 3000 }).toEqual(['A', 'C', 'B']);
  expect(await blockOrder(page), '블럭은 안 움직였다').toEqual(order0);
  expect(await page.evaluate(`window.grdGetActiveLine(${blk})`), '활성 줄이 따라갔다').toEqual({ r: 0, c: 1, li: 2 });
  expect((await model(page))[0].rows[0].lines, '칼럼 0 칸 무접촉').toBeUndefined();
  await page.evaluate(() => window.undo());
  await expect.poll(async () => TEXTS((await model(page))[1].rows[0].lines), { timeout: 3000 }).toEqual(['A', 'B', 'C']);
  expect(await blockOrder(page), '⌘Z 뒤에도 블럭 순서 그대로').toEqual(order0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('L11 비교 칸 줄 고른 채 ⌘←/⌘→ = 아무것도 안 함(블럭 안 옮김 · 줄 안 옮김 — 옆 칸 옮기기는 v1 제외)', async ({ page }) => {
  const errs = await setupLines(page);
  const order0 = await blockOrder(page);
  await pickLine(page, 1, 0, 1);
  const cols0 = await page.evaluate(`${blk}.dataset.cols`);
  for (const k of ['Meta+ArrowLeft', 'Meta+ArrowRight']) {
    await page.keyboard.press(k);
    expect(await blockOrder(page), `${k} — 블럭 순서 불변`).toEqual(order0);
    expect(await page.evaluate(`${blk}.dataset.cols`), `${k} — 모델 불변`).toBe(cols0);
    expect(await page.evaluate(`window.grdGetActiveLine(${blk})`), `${k} — 줄 선택 유지`).toEqual({ r: 0, c: 1, li: 1 });
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

/* ⚰️L12 — 1017t1c1 로 「칼럼 절 거울 입력」(.cmp-row-input, 줄 칸용 disabled 거울)이 ★없어졌다
 * (prop-comparison.js 글자 입력칸을 통째로 뺐다 — 쓰는 칸 :50 과 ★같이 사라진다, 발주서 그대로).
 * ⚰️옛 단언: `expect(await page.evaluate(() => document.querySelector('.cmp-row-input[data-col="1"][data-idx="0"]')?.value), '거울 = A / B / C').toBe('A / B / C');`
 * ★새 참값: 그 셀렉터 자체가 패널에 0건(아래). ★나머지(Fill 스와치 = 그려진 칼럼 글자색)는 ★무변 — 그대로 잰다. */
test('L12 ⚰️패널 — 줄 칸 거울 입력은 사라졌다(1017t1c1) · 색 없는 줄의 Fill 스와치 = 그려진 칼럼 글자색', async ({ page }) => {
  const errs = await setupLines(page);
  await pickLine(page, 1, 0, 0);
  expect(await count(page, '.cmp-row-input'), '1017t1c1 — 글자 입력칸 통째로 0').toBe(0);
  const r = await page.evaluate((s) => {
    const el = document.querySelector(s);
    const rgb = getComputedStyle(el).color.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
    return { drawn: '#' + rgb, pick: document.getElementById('grd-typo-color')?.value, lineColor: window.getComparisonCols(document.getElementById(window.__bid).dataset)[1].rows[0].lines[0].color };
  }, `${lineSel(1, 0, 0)} > .grd-line`);
  expect(r.lineColor, '전제 — 줄에 색이 없다').toBeUndefined();
  expect(r.pick, 'Fill 피커 = 캔버스에 그려진 색').toBe(r.drawn);
  expect(r.drawn, '전제 — 역할 기본색(#555555)이 아니다').not.toBe('#555555');
  expect(errs, errs.join('\n')).toEqual([]);
});
