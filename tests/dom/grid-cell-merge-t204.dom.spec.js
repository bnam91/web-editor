/* grid-cell-merge-t204.dom.spec.js — 0.9.11 t2-04 그리드 셀 병합 (현빈 2026-11-10 결정 · 태양 설계 T204-DESIGN-261109)
 *   결정: 병합 = 엑셀식(★왼쪽 위 칸 글만 남김 · 경고 없음) · 해제 = 나머지 빈 칸 · ⌘M · 행/열 가로지르는 이동 막음(토스트) · 안 행/열 지우면 줄어듦.
 *   모델 = 블럭 키 하나 data-merges=[{r,c,rs,cs}] · 앵커 칸 grid-row/column span · 가려진 칸은 안 그림.
 * 길(진짜 손): 블럭 고르기 → 줄 클릭(드릴) → 칸 끌기(범위) → 우클릭 «셀 병합» / ⌘M.
 *   M1 우클릭 병합 — 앵커 상자 = 두 행×두 열 넓이 · 왼쪽 위 글만 · 나머지 칸 비움 · 토스트·확인창 0
 *   M2 ⌘Z 한 번 = 병합 전 dataset 바이트 그대로
 *   M3 ⌘M 병합 → ⌘M 해제(나머지 빈 칸 · 앵커 글 그대로) → ⌘Z 한 번 = 다시 병합
 *   M4 저장→다시 열기 — merges 키·앵커 상자 크기(블럭 기준) 같음
 *   M5 PNG(제품 캡처 파이프라인 prepareCloneForCapture → 브라우저 래스터) — 앵커 색 픽셀 = 합친 넓이 · 가려진 칸 색 0
 *   M6 Figma JSON — 그리드는 일반 폴백(칸 배치를 안 싣는다 · 기존 한계) ⇒ 잴 수 있는 것만: 가려진 칸 글 없음 · 앵커 글 한 번 · 높이 = 화면 높이
 *   M7 행 지우기(병합 안) = 병합 줄어듦 · 열 옮기기(가로지름) = 막힘 + 토스트 · 범위가 합친 칸 일부만 걸치면 통째로 넓힘
 *   M8 MCP 입구(updateGridBlock merges) — 겹침·1×1·범위 밖 거절 · 가려진 칸 patchCell 거절 · 정상값은 가려진 칸 비움
 *   M9 적대 리뷰 1회차 — 가장자리에 닿은 병합 앞 행/열 지우기(모양 유지) · 범위 붙여넣기·MCP cells 는 가려진 칸에 안 씀
 *   M10 적대 리뷰 2회차 — 합친 칸을 지나는 행 머리띠 고르기 → Delete = 그 행 지우기(병합 줄어듦) · MCP cells 가 가려진 칸에 준 글은 ignoredProps 로 말한다
 *   M11 적대 리뷰 3회차 — 합친 칸을 «걸친» 행 머리띠 ⌘M = 막고 토스트(보이는 상자 밖을 안 비움)
 *   M0 음성대조 — 병합 없는 그리드는 칸 수 R×C · style 에 grid-row 없음(옛 산출 그대로)
 * 양성대조(지디 인텔): grid-block.js gridMergeRange 첫 줄 `return null;` → M1·M3·M4·M5·M6 빨강 /
 *   renderGridBlock 의 `const merges = gridMerges(...)` 를 `const merges = [];` → M1 상자·M5 빨강 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const BG = { a1: '#c03030', b1: '#30a030', a2: '#3030c0', b2: '#a0a030', c1: '#30a0a0', c2: '#a030a0', a3: '#806040', b3: '#408060', c3: '#604080' };
const L = (t) => ({ type: 'body', text: t });
const SCENE = {
  cols: [{ width: 1, lines: [L('A1'), { type: 'caption', text: 'A1-sub' }] }, { width: 1, lines: [L('B1')] }, { width: 1, lines: [L('C1')] }],
  rows: [{ height: 'auto' }, { height: 120 }, { height: 'auto' }],
  cells: [[{ bg: BG.a1, padding: 10 }, { bg: BG.b1 }, { bg: BG.c1 }],
    [{ bg: BG.a2, lines: [L('A2')] }, { bg: BG.b2, lines: [L('B2'), { type: 'h3', text: 'B2-h' }] }, { bg: BG.c2, lines: [L('C2')] }],
    [{ bg: BG.a3, lines: [L('A3')] }, { bg: BG.b3, lines: [L('B3')] }, { bg: BG.c3, lines: [L('C3')] }]],
};
/* 실제 내용 든 판: 섹션 둘 · 그리드 위아래 글 블럭·간격 · 둘째 섹션에도 그리드 하나(병합 안 함 — 옆 블럭 무변 확인) */
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="병합"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;">
<div class="gap-block" data-type="gap" style="height:80px"></div>
<div class="row" id="rT"><div class="text-block" id="tT" data-type="text"><div class="tb-h2">병합 위 제목</div></div></div>
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="16"></div></div>
<div class="row" id="rT2"><div class="text-block" id="tT2" data-type="text"><div class="tb-body">병합 아래 본문</div></div></div>
<div class="gap-block" data-type="gap" style="height:200px"></div></div></div>
<div class="section-block" id="sH" data-section="1" data-name="옆"><div class="section-hitzone"></div><div class="section-inner">
<div class="row" id="rH"><div class="grid-block" id="gH" data-type="grid" data-gap="12"></div></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(([h, sc]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    for (const id of ['gG', 'gH']) {
      const g = document.getElementById(id);
      g.dataset.cols = JSON.stringify(sc.cols); g.dataset.rows = JSON.stringify(sc.rows); g.dataset.cells = JSON.stringify(sc.cells);
    }
    window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock(document.getElementById('gG')); window.renderGridBlock(document.getElementById('gH'));
    document.getElementById('gG').scrollIntoView({ block: 'center' });
    window.clearHistory?.();
    const t = document.getElementById('editor-toast'); if (t) t.textContent = '';
  }, [SEC, SCENE]);
  await waitStableRect(page, '#gG');
  return errs;
}
const cellSel = (r, c) => `#gG > .grd-inner > .grd-cell[data-r="${r}"][data-c="${c}"]`;
const lineSel = (r, c, li = 0) => `#gG [data-r="${r}"][data-c="${c}"][data-line="${li}"]`;
async function selectGrid(page) {
  const c = await waitStableRect(page, cellSel(2, 0));
  await clickAt(page, c.cx, c.cy, { sel: 'div#gG' }, { label: '그리드 고르기' });
  await page.waitForFunction(() => document.getElementById('gG').classList.contains('selected'));
}
async function drill(page, r, c) {
  await selectGrid(page);
  const l = await waitStableRect(page, lineSel(r, c));
  await clickAt(page, l.cx, l.cy, { sel: lineSel(r, c) }, { label: `줄 ${r}${c}` });
  await page.waitForFunction(([r, c]) => { const a = window.grdGetActiveLine(document.getElementById('gG')); return !!a && +a.r === r && +a.c === c; }, [r, c]);
  await page.evaluate(() => document.activeElement?.blur?.());
}
async function dragRange(page, a, b) {
  const ca = await waitStableRect(page, cellSel(a.r, a.c));
  const cb = await waitStableRect(page, cellSel(b.r, b.c));
  await page.mouse.move(ca.cx, ca.cy); await page.mouse.down();
  await page.mouse.move(cb.cx, cb.cy, { steps: 8 }); await page.mouse.up();
}
const model = (page, id = 'gG') => page.evaluate((id) => {
  const g = document.getElementById(id); const m = window.getGridModel(g);
  return { merges: g.dataset.merges ?? null, text: m.cells.map(r => r.map(c => (c.lines || []).map(l => l.text).join('+'))),
    n: g.querySelectorAll(':scope > .grd-inner > .grd-cell').length,
    raw: JSON.stringify({ cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null, merges: g.dataset.merges ?? null }) };
}, id);
/** 앵커 상자 vs «덮어야 할» 트랙 상자 — 트랙 끝은 그 열(행)의 «한 칸짜리» 칸에서 잰다(합친 칸 말고). */
const spanBox = (page, m) => page.evaluate(({ r, c, rs, cs }) => {
  const inner = '#gG > .grd-inner > .grd-cell';
  const a = document.querySelector(`${inner}[data-r="${r}"][data-c="${c}"]`)?.getBoundingClientRect(), g = document.getElementById('gG').getBoundingClientRect();
  const colCell = (i) => document.querySelector(`${inner}[data-c="${i}"]:not([data-cs])`).getBoundingClientRect();
  const rowCell = (i) => document.querySelector(`${inner}[data-r="${i}"]:not([data-rs])`).getBoundingClientRect();
  const left = colCell(c), right = colCell(c + cs - 1), top = rowCell(r), bot = rowCell(r + rs - 1);
  return { a: a && { x: a.left - g.left, y: a.top - g.top, w: a.width, h: a.height },
    want: { x: left.left - g.left, y: top.top - g.top, w: right.right - left.left, h: bot.bottom - top.top } };
}, m);
const toast = (page) => page.evaluate(() => document.getElementById('editor-toast')?.textContent || '');
const close = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

test('M0 음성대조 — 병합 없는 그리드는 칸 R×C · 칸 style 에 grid-row 없음(옛 산출) · data-merges 없음', async ({ page }) => {
  const errs = await setup(page);
  const m = await model(page);
  expect(m.n).toBe(9);
  expect(m.merges).toBeNull();
  expect(await page.evaluate(() => [...document.querySelectorAll('#gG .grd-cell')].some(c => c.getAttribute('style').includes('grid-row')))).toBe(false);
  expect(errs).toEqual([]);
});

test('M1 우클릭 «셀 병합» — 왼쪽 위 글만 남김 · 나머지 칸 비움 · 앵커 = 2×2 넓이 · 경고 0', async ({ page }) => {
  const errs = await setup(page);
  let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
  await drill(page, 0, 0);
  await dragRange(page, { r: 0, c: 0 }, { r: 1, c: 1 });
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG')))).toEqual({ r0: 0, c0: 0, r1: 1, c1: 1 });
  const c = await waitStableRect(page, cellSel(0, 0));
  await page.mouse.click(c.cx, c.cy, { button: 'right' });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('bcm-cell-merge')).display !== 'none', null, { timeout: 3000 });
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('bcm-cell-unmerge')).display), '해제 항목은 안 보인다(아직 병합 없음)').toBe('none');
  await page.click('#bcm-cell-merge');
  await expect.poll(async () => (await model(page)).merges).toBe('[{"r":0,"c":0,"rs":2,"cs":2}]');
  const m = await model(page);
  expect(m.text).toEqual([['A1+A1-sub', '', 'C1'], ['', '', 'C2'], ['A3', 'B3', 'C3']]);
  expect(m.n, '가려진 칸 셋은 안 그린다').toBe(6);
  const b = await spanBox(page, { r: 0, c: 0, rs: 2, cs: 2 });
  console.log('T204ROW M1 ' + JSON.stringify(b));
  for (const k of ['x', 'y', 'w', 'h']) expect(close(b.a[k], b.want[k]), `앵커 ${k} ${b.a[k]} vs 두 행·두 열 ${b.want[k]}`).toBe(true);
  expect(await toast(page), '경고 없음(현빈 결정)').toBe('');
  expect(dialogs).toBe(0);
  expect((await model(page, 'gH')).n, '옆 섹션 그리드 무변').toBe(9);
  expect(errs).toEqual([]);
});

test('M2 ⌘Z 한 번 = 병합 전 dataset 바이트 그대로(글·꾸밈 되살아남)', async ({ page }) => {
  const errs = await setup(page);
  const before = await model(page);
  await drill(page, 0, 0);
  await dragRange(page, { r: 0, c: 0 }, { r: 1, c: 1 });
  await page.keyboard.press('Meta+m');
  await expect.poll(async () => (await model(page)).merges).not.toBeNull();
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await model(page)).raw).toBe(before.raw);
  expect((await model(page)).n).toBe(9);
  expect(errs).toEqual([]);
});

test('M3 ⌘M 병합 → ⌘M 해제(나머지 빈 칸 · 앵커 글 그대로) → ⌘Z 한 번 = 다시 병합', async ({ page }) => {
  const errs = await setup(page);
  await drill(page, 1, 1);
  await dragRange(page, { r: 1, c: 1 }, { r: 2, c: 2 });
  await page.keyboard.press('Meta+m');
  await expect.poll(async () => (await model(page)).merges).toBe('[{"r":1,"c":1,"rs":2,"cs":2}]');
  expect((await model(page)).text).toEqual([['A1+A1-sub', 'B1', 'C1'], ['A2', 'B2+B2-h', ''], ['A3', '', '']]);
  const merged = await model(page);
  await page.keyboard.press('Meta+m');   // 범위 = 합친 칸 그대로 골라져 있다 → 해제
  await expect.poll(async () => (await model(page)).merges).toBeNull();
  const m = await model(page);
  expect(m.text, '해제 = 나머지 빈 칸 · 앵커 글 그대로').toEqual([['A1+A1-sub', 'B1', 'C1'], ['A2', 'B2+B2-h', ''], ['A3', '', '']]);
  expect(m.n).toBe(9);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await model(page)).raw).toBe(merged.raw);
  expect(errs).toEqual([]);
});

test('M4 저장→다시 열기 — merges 키·앵커 상자(블럭 기준) 같음', async ({ page }) => {
  await setup(page);
  await drill(page, 0, 1);
  await dragRange(page, { r: 0, c: 1 }, { r: 0, c: 2 });   // 가로 병합(행 0 — 줄이 cols 에 산다)
  await page.keyboard.press('Meta+m');
  await expect.poll(async () => (await model(page)).merges).toBe('[{"r":0,"c":1,"rs":1,"cs":2}]');
  const b0 = await spanBox(page, { r: 0, c: 1, rs: 1, cs: 2 });
  const m0 = await model(page);
  const snap = await page.evaluate(() => window.serializeProject());
  const errs = await bootApp(page);
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  await waitStableRect(page, '#gG');
  const m1 = await model(page);
  expect(m1.raw).toBe(m0.raw);
  expect(m1.n).toBe(8);
  expect(m1.text[0]).toEqual(['A1+A1-sub', 'B1', '']);
  const b1 = await spanBox(page, { r: 0, c: 1, rs: 1, cs: 2 });
  console.log('T204ROW M4 ' + JSON.stringify({ b0, b1 }));
  for (const k of ['x', 'y', 'w', 'h']) expect(close(b1.a[k], b0.a[k]), `다시 연 앵커 ${k}`).toBe(true);
  expect(errs).toEqual([]);
});

test('M5 PNG(제품 캡처 파이프라인) — 앵커 색 픽셀 ≈ 합친 넓이 · 가려진 칸 색 0', async ({ page }) => {
  const errs = await setup(page);
  await drill(page, 1, 0);
  await dragRange(page, { r: 1, c: 0 }, { r: 2, c: 1 });
  await page.keyboard.press('Meta+m');
  await expect.poll(async () => (await model(page)).merges).toBe('[{"r":1,"c":0,"rs":2,"cs":2}]');
  await page.evaluate(() => { window.deselectAll?.(); });
  await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    document.getElementById('__t204clone')?.remove();
    const clone = await ex.prepareCloneForCapture(document.getElementById('sG'), 860, true);
    ex.renderComponentsInClone(clone);
    clone.id = '__t204clone'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
    window.__h = Math.ceil(clone.getBoundingClientRect().height);
    /* 넓이는 «클론 안»에서 잰다 — 캔버스는 배율이 걸려 있어 화면 상자와 PNG 픽셀의 자가 다르다 */
    const ar = (r, c) => { const b = clone.querySelector(`.grid-block .grd-cell[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect(); return Math.round(b.width * b.height); };
    window.__area = ar(1, 0); window.__one = ar(1, 2);
  });
  const area = await page.evaluate(() => window.__area), one = await page.evaluate(() => window.__one);
  const h = await page.evaluate(() => window.__h);
  await page.setViewportSize({ width: 1500, height: Math.min(4000, Math.max(300, h + 40)) });
  const shot = await page.locator('#__t204clone').screenshot({ type: 'png' });
  const px = await page.evaluate(async ([b64, want]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, cv.width, cv.height).data;
    const hex = (s) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
    const out = {};
    for (const [k, v] of Object.entries(want)) {
      const t = hex(v); let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - t[0]) <= 4 && Math.abs(d[i + 1] - t[1]) <= 4 && Math.abs(d[i + 2] - t[2]) <= 4) n++;
      out[k] = n;
    }
    return { w: img.width, h: img.height, out };
  }, [shot.toString('base64'), { a2: BG.a2, b2: BG.b2, a3: BG.a3, b3: BG.b3, c2: BG.c2 }]);
  console.log('T204ROW M5 ' + JSON.stringify({ area, one, px }));
  expect(px.out.a2 / area, `앵커 색 픽셀 ${px.out.a2} / 합친 상자 넓이 ${area}`).toBeGreaterThan(0.8);
  expect(px.out.a2, '한 칸 넓이보다 확실히 크다').toBeGreaterThan(one * 2.5);
  expect([px.out.b2, px.out.a3, px.out.b3], '가려진 칸 색은 PNG 에 없다').toEqual([0, 0, 0]);
  expect(px.out.c2, '[전제] 안 합친 칸은 찍힌다').toBeGreaterThan(one * 0.5);
  expect(errs).toEqual([]);
});

test('M6 Figma JSON — 가려진 칸 글 없음 · 앵커 글 한 번 · 높이 = 화면 높이(그리드는 일반 폴백 — 칸 배치는 원래 안 실림)', async ({ page }) => {
  const errs = await setup(page);
  await drill(page, 1, 1);
  await dragRange(page, { r: 1, c: 1 }, { r: 1, c: 2 });
  await page.keyboard.press('Meta+m');
  await expect.poll(async () => (await model(page)).merges).toBe('[{"r":1,"c":1,"rs":1,"cs":2}]');
  const r = await page.evaluate(async () => {
    const ps = { bg: '#eeeeee', padX: 0 };
    const { state } = await import('/js/globals.js');
    state.pages = [{ canvas: document.getElementById('canvas').innerHTML, pageSettings: ps }]; state.pageSettings = ps;
    const json = window.buildFigmaExportJSON(null);
    const g = json.sections[0].blocks.find(b => b.kind === 'grid');
    return { g, liveH: document.querySelector('#gG').offsetHeight };
  });
  const texts = (r.g?.texts || []).map(t => t.t);
  console.log('T204ROW M6 ' + JSON.stringify({ texts, h: r.g?.height, liveH: r.liveH }));
  expect(r.g, '[전제] 그리드가 나갔다').toBeTruthy();
  expect(texts.filter(t => t === 'B2').length).toBe(1);
  expect(texts).not.toContain('C2');
  expect(close(r.g.height, r.liveH, 1)).toBe(true);
  expect(errs).toEqual([]);
});

test('M7 행 지우기(병합 안) = 줄어듦 · 열 옮기기(가로지름) = 막힘+토스트 · 범위가 합친 칸 일부만 걸치면 통째로 넓힘', async ({ page }) => {
  const errs = await setup(page);
  await drill(page, 0, 0);
  await dragRange(page, { r: 0, c: 0 }, { r: 1, c: 1 });
  await page.keyboard.press('Meta+m');
  await expect.poll(async () => (await model(page)).merges).toBe('[{"r":0,"c":0,"rs":2,"cs":2}]');
  /* 범위 (1,2)→(2,1) 를 끌면 합친 칸(0,0)-(1,1)을 걸친다 → (0,0)-(2,2) 로 넓어진다 */
  await dragRange(page, { r: 2, c: 1 }, { r: 1, c: 2 });
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG')))).toEqual({ r0: 0, c0: 0, r1: 2, c1: 2 });
  /* 열 옮기기: 열 1(합친 칸 안)을 끝으로 → 막힘 */
  const moved = await page.evaluate(() => window.moveGridCol(document.getElementById('gG'), 1, 2));
  expect(moved).toBe(false);
  expect(await toast(page)).toContain('합친 칸');
  expect((await model(page)).merges).toBe('[{"r":0,"c":0,"rs":2,"cs":2}]');
  /* 행 0(합친 칸 안) 지우기 → 병합이 한 행 줄어 (0,0) 1×2 가 된다 */
  const del = await page.evaluate(() => window.grdDeleteBand(document.getElementById('gG'), 'row', 0));
  expect(del).toBe(true);
  expect((await model(page)).merges).toBe('[{"r":0,"c":0,"rs":1,"cs":2}]');
  /* 열 2(합친 칸 밖)는 옮겨진다 — 합친 칸이 안 찢긴다 */
  const ok2 = await page.evaluate(() => window.moveGridCol(document.getElementById('gG'), 2, 0));
  expect(ok2).toBe(true);
  expect((await model(page)).merges).toBe('[{"r":0,"c":1,"rs":1,"cs":2}]');
  expect(errs).toEqual([]);
});

test('M8 MCP 입구 merges — 겹침·1×1·범위 밖·모르는 필드 거절 · 가려진 칸 patchCell 거절 · 정상값은 가려진 칸 비움', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const U = (p) => { const x = window.updateGridBlock('gG', p); return x.ok ? 'ok' : x.code + ':' + x.message; };
    return {
      overlap: U({ merges: [{ r: 0, c: 0, rs: 2, cs: 2 }, { r: 1, c: 1, rs: 1, cs: 2 }] }),
      one: U({ merges: [{ r: 0, c: 0, rs: 1, cs: 1 }] }),
      out: U({ merges: [{ r: 2, c: 2, rs: 2, cs: 1 }] }),
      extra: U({ merges: [{ r: 0, c: 0, rs: 2, cs: 1, x: 1 }] }),
      good: U({ merges: [{ r: 1, c: 0, rs: 2, cs: 1 }] }),
      hidden: U({ patchCell: { r: 2, c: 0, bg: '#000000' } }),
      anchor: U({ patchCell: { r: 1, c: 0, bg: '#000000' } }),
    };
  });
  expect(r.overlap).toContain('overlaps');
  expect(r.one).toContain('one cell');
  expect(r.out).toContain('out of range');
  expect(r.extra).toContain('unknown field');
  expect(r.good).toBe('ok');
  expect(r.hidden).toContain('hidden by a merge');
  expect(r.anchor).toBe('ok');
  const m = await model(page);
  expect(m.text[2][0], '가려진 칸 비움(UI 와 같은 규칙)').toBe('');
  expect(m.text[1][0]).toBe('A2');
  const un = await page.evaluate(() => window.updateGridBlock('gG', { merges: null }).ok);
  expect(un).toBe(true);
  expect((await model(page)).merges).toBeNull();
  expect(errs).toEqual([]);
});

test('M9 가장자리에 닿은 병합 — 앞 행/열을 지워도 모양 유지 · 붙여넣기·MCP cells 는 가려진 칸에 안 쓴다(해제 = 빈 칸)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const g = document.getElementById('gG');
    const out = {};
    window.updateGridBlock('gG', { merges: [{ r: 1, c: 1, rs: 2, cs: 2 }] });       // 마지막 행·열에 닿는 2×2
    out.delRow = window.removeGridRow(g, 0) && g.dataset.merges;                   // → {r:0,c:1,rs:2,cs:2}
    out.delCol = window.removeGridCol(g, 0) && g.dataset.merges;                   // → {r:0,c:0,rs:2,cs:2}
    const clip = { h: 2, w: 2, cells: [[{ lines: [{ type: 'body', text: 'P1' }] }, { lines: [{ type: 'body', text: 'P2' }] }], [{ lines: [{ type: 'body', text: 'P3' }] }, { lines: [{ type: 'body', text: 'P4' }] }]] };
    out.paste = window.pasteGridRange(g, clip, { r: 0, c: 0 });
    const m = window.getGridModel(g);
    out.afterPaste = m.cells.map(row => row.map(c => (c.lines || []).map(l => l.text).join('+')));
    const full = m.cells.map(row => row.map(c => ({ lines: [{ type: 'body', text: 'X' }] })));
    out.mcp = window.updateGridBlock('gG', { cells: full }).ok;
    out.afterMcp = window.getGridModel(g).cells.map(row => row.map(c => (c.lines || []).map(l => l.text).join('+')));
    window.gridUnmergeAt(g, 0, 0);
    out.afterUnmerge = window.getGridModel(g).cells.map(row => row.map(c => (c.lines || []).map(l => l.text).join('+')));
    return out;
  });
  expect(r.delRow).toBe('[{"r":0,"c":1,"rs":2,"cs":2}]');
  expect(r.delCol).toBe('[{"r":0,"c":0,"rs":2,"cs":2}]');
  expect(r.paste).toEqual({ written: 1, dropped: 3 });
  expect(r.afterPaste).toEqual([['P1', ''], ['', '']]);
  expect(r.mcp).toBe(true);
  expect(r.afterMcp).toEqual([['X', ''], ['', '']]);
  expect(r.afterUnmerge, '해제 = 나머지 빈 칸(숨은 글이 안 나온다)').toEqual([['X', ''], ['', '']]);
  expect(errs).toEqual([]);
});

test('M10 합친 칸을 지나는 행 머리띠 → Delete = 그 행 지우기(병합 줄어듦) · MCP cells 가 가려진 칸 글은 ignoredProps 로 말한다', async ({ page }) => {
  const errs = await setup(page);
  const mcp = await page.evaluate(() => {
    window.updateGridBlock('gG', { merges: [{ r: 0, c: 0, rs: 2, cs: 1 }] });
    const m = window.getGridModel(document.getElementById('gG'));
    const cells = m.cells.map(row => row.map(c => ({ ...c })));
    cells[1][0] = { lines: [{ type: 'body', text: 'HIDDEN' }] };
    const r = window.updateGridBlock('gG', { cells });
    return { ok: r.ok, ignored: r.ignoredProps || [], hint: r.hint || '' };
  });
  expect(mcp.ok).toBe(true);
  expect(mcp.ignored).toEqual(['cells[1][0].lines']);
  expect(mcp.hint).toContain('hidden by the merge');
  await page.evaluate(() => window.clearHistory?.());
  await selectGrid(page);
  await page.waitForSelector('#ss-handles-overlay > .grd-headband[data-axis="row"][data-i="1"]');
  const b = await waitStableRect(page, '#ss-handles-overlay > .grd-headband[data-axis="row"][data-i="1"]');
  await page.mouse.click(b.cx, b.cy);
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG')))).toEqual({ r0: 1, c0: 0, r1: 1, c1: 2, axis: 'row' });
  /* 범위 상자 = 그 행만(합친 칸 앵커가 위 행에 있어도 위로 안 늘어난다) */
  const box = await page.evaluate(() => {
    const r = document.querySelector('#ss-handles-overlay > .grd-range-rect').getBoundingClientRect();
    const t = document.querySelector('#gG > .grd-inner > .grd-cell[data-r="1"]:not([data-rs])').getBoundingClientRect();
    return { top: r.top, h: r.height, tTop: t.top, tH: t.height };
  });
  expect(Math.abs(box.top - box.tTop) <= 1.5 && Math.abs(box.h - box.tH) <= 1.5, JSON.stringify(box)).toBe(true);
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await model(page)).merges).toBeNull();   // 2×1 → 1×1 = 사라짐
  const m = await model(page);
  expect(m.text.length).toBe(2);
  expect(m.text[0][0]).toBe('A1+A1-sub');
  expect(await toast(page)).not.toContain('아직 안 돼요');
  expect(errs).toEqual([]);
});

async function tapRowBand(page, i) {
  const sel = `#ss-handles-overlay > .grd-headband[data-axis="row"][data-i="${i}"]`;
  await page.waitForSelector(sel);
  const b = await waitStableRect(page, sel);
  await page.mouse.click(b.cx, b.cy);
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG'))?.axis)).toBe('row');
}
test('M11 합친 칸을 «걸친» 행 머리띠 ⌘M = 막고 토스트(상자 밖 칸 무변)', async ({ page }) => {
  const errs = await setup(page);
  /* (「합친 칸 안의 머리띠 = 해제」 꼴은 손으로 못 만든다 — 행 전체가 합쳐지면 잴 트랙이 없어 그 머리띠가 안 뜬다 · 판정 코드만 있음) */
  await page.evaluate(() => { window.updateGridBlock('gG', { merges: [{ r: 1, c: 1, rs: 2, cs: 1 }] }); window.clearHistory?.(); const t = document.getElementById('editor-toast'); if (t) t.textContent = ''; });
  const before = await model(page);
  await selectGrid(page);
  await tapRowBand(page, 1);
  await page.keyboard.press('Meta+m');
  /* 적대 리뷰 4회차: 그 머리띠 상자는 그려진다(열 0·2 는 한 칸짜리 트랙이 있다) */
  expect(await page.evaluate(() => !!document.querySelector('#ss-handles-overlay > .grd-range-rect'))).toBe(true);
  await expect.poll(() => toast(page)).toContain('합친 칸에 걸쳐');
  expect((await model(page)).raw, '아무 칸도 안 바뀐다').toBe(before.raw);
  expect(errs).toEqual([]);
});
