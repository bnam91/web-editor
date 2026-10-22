/* grid-range-clip.dom.spec.js — t3-04 그리드 «행·열 순서 바꾸기 ＋ 칸 범위 복붙» (S6 · 2026-10-22 · 현빈 GO msg5376)
 *   발주서 /Users/a1/taeyang-098/ORDER-grid-reorder-cellclip.md ⑤ 「검사 — 쌍으로」 · 시안 Version 3.
 *   ★이 파일은 두 절로 자란다: 'U2a 머리띠'(지금) · 'U2b 범위 복붙'(⌘C/⌘V — U2b 가 같은 파일에 더한다).
 *
 * ★U2a 가 잠그는 것(확정 ① ④ ⑤ — 현빈 · ⛔고쳐 읽지 마라):
 *   전제/확정① 머리띠는 «그리드를 고른 동안만» — 고르기 전 0 · 고르면 열 N ＋ 행 M · 풀면(Esc · 빈 캔버스) 0.
 *   음성대조①  고르기 전 판 ≡ 골랐다 푼 판(블럭 둘레 PNG 바이트 동일) ＋ 머리띠는 #canvas 밖(#ss-handles-overlay)에만.
 *   양성①②③   «진짜 마우스»로 행 머리띠 2 → 자리 3 · 열 머리띠 C → 자리 1 ⇒ rows/cols·cells 가 «같은 순열» ·
 *              높이(확정 ④)·폭이 따라감 · 칸 줄(확정 ③) 깊이 같음 · ★이미지 줄 imgSrc 길이·sha256 그대로(지디 덧 ⑵).
 *   음성대조③  열 = A·B·C · 행 = 1·2·3 (확정 ⑤) — 뒤집히면 빨강.
 *   ⌘Z 한 번   머리띠 끌기 한 번 = ⌘Z 한 번에 dataset 이 «글자 그대로» 돌아온다.
 *   저장 왕복   옮긴 뒤 serializeProject → 앱 다시 띄움 → applyProjectData ⇒ 순서가 남는다.
 *   토큰       머리띠 계산 스타일 = 캔버스 ＋(.grd-add-btn) 어법(점선 · --ui-handle-border-w · --ui-divider · --ui-text-muted ·
 *              hover --ui-accent-primary · 끄는 동안 --ui-disabled-opacity) — 현빈 QA 자 «디자인 일관성».
 * ★장면 = 3열 × 3행 «손으로»(지디 덧 ⑴ — 기본 1×2 로는 행 0 낀 왕복이 안 선다) · 행 높이 auto/120/200 ·
 *   (r1,c2) 칸에 20만 자 넘는 이미지 줄 — ⛔updateGridBlock 입구는 그 크기를 거절하므로 dataset 에 «직접» 얹는다(U1 단위시험과 같은 길).
 * ★변이(사본 · GD1001_ROOT) — «머리띠를 항상 그리면» ⇒ 전제·음성대조① 빨강 · «이름을 뒤집으면» ⇒ 음성대조③ 빨강 ·
 *   «옮기기에 문자열 index» ⇒ 양성 빨강. (변이 없이 모두 초록이면 그 단언은 항등식이다 — 발주서 ⑤)
 * ⛔waitForTimeout 0 — 기다림은 waitForFunction · expect.poll · waitStableRect 로만.
 * 실행: bash ~/taeyang-098/run-test.sh dom tests/dom/grid-range-clip.dom.spec.js */
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt, hitAt } = require('./_click-at.js');

/* ── 큰 이미지 줄(실제로 풀리는 PNG 1×1 ＋ 꼬리 0 바이트 → base64 25만 자 남짓) ── */
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const BIG = 'data:image/png;base64,' + Buffer.concat([PNG1, Buffer.alloc(190000)]).toString('base64');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const BIG_SHA = sha(BIG);

const SCENE = {
  cols: [
    { width: 1, lines: [{ type: 'h2', text: 'A1' }] },
    { width: 2, lines: [{ type: 'body', text: 'B1' }] },
    { width: 3, lines: [{ type: 'body', text: 'C1' }] },
  ],
  rows: [{ height: 'auto' }, { height: 120 }, { height: 200 }],
  cells: [
    [{ bg: '#111111' }, { padding: 8 }, { radius: 4 }],                         // 행 0 = 꾸밈만(줄은 cols[c].lines)
    [{ lines: [{ type: 'body', text: 'A2' }] }, { bg: '#0000ff', lines: [{ type: 'body', text: 'B2' }] },
     { lines: [{ type: 'image', imgSrc: BIG, height: 60 }] }],
    [{ padding: 12, lines: [{ type: 'body', text: 'A3' }] }, { lines: [{ type: 'body', text: 'B3' }] },
     { lines: [{ type: 'body', text: 'C3' }] }],
  ],
};
const IMG_AT = { r: 1, c: 2 };

const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top"></div></div>
<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`;

async function setup(page, scene = SCENE, html = SEC) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(([h, sc]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    const g = document.getElementById('gG');
    g.dataset.cols = JSON.stringify(sc.cols);
    if (sc.rows) g.dataset.rows = JSON.stringify(sc.rows);
    if (sc.cells) g.dataset.cells = JSON.stringify(sc.cells.map((row, r) => row.map(cell => { const o = { ...cell }; if (r === 0) delete o.lines; return o; })));
    window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock?.(g);
    g.scrollIntoView({ block: 'center' });
  }, [html, scene]);
  await waitStableRect(page, '#gG');
  return errs;
}

const BANDS = '#ss-handles-overlay > .grd-headband';
const bandCount = (page) => page.evaluate((s) => ({
  col: document.querySelectorAll(`${s}[data-axis="col"]`).length,
  row: document.querySelectorAll(`${s}[data-axis="row"]`).length,
  any: document.querySelectorAll('.grd-headband, .grd-headband-drop').length,
}), BANDS);
const labels = (page) => page.evaluate((s) => ({
  col: [...document.querySelectorAll(`${s}[data-axis="col"]`)].map(b => b.textContent),
  row: [...document.querySelectorAll(`${s}[data-axis="row"]`)].map(b => b.textContent),
}), BANDS);
/** 모델 — getGridModel(행 0 줄 포함 R×C) ＋ dataset 글자 그대로(⌘Z 대조용) ＋ 그려진 칸 글자 */
const model = (page) => page.evaluate(() => {
  const g = document.getElementById('gG');
  const m = window.getGridModel(g);
  const text = {};
  g.querySelectorAll(':scope > .grd-inner > .grd-cell').forEach(c => { text[`${c.dataset.r}${c.dataset.c}`] = (c.innerText || '').trim(); });
  return { m, raw: { cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null }, text };
});
const imgOf = (m, r, c) => { const l = m.cells[r][c].lines.find(x => x.type === 'image'); return l ? l.imgSrc : null; };
const spliceMove = (arr, from, to) => { const o = arr.slice(); const [x] = o.splice(from, 1); o.splice(to, 0, x); return o; };

/** 그리드를 «진짜 클릭»으로 고른다(첫 클릭 = 블럭 · T-058) — 칸 (2,0) 가운데. */
async function selectGrid(page) {
  const c = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
  await clickAt(page, c.cx, c.cy, { sel: 'div#gG' }, { label: '그리드 고르기' });
  await page.waitForFunction(() => document.getElementById('gG').classList.contains('selected'));
}

/** 머리띠 하나를 «진짜 마우스»로 끈다 — 누르기 직전 elementFromPoint 가 그 머리띠인지 찍는다(_click-at 규율). */
async function dragBand(page, axis, i, toX, toY) {
  const sel = `${BANDS}[data-axis="${axis}"][data-i="${i}"]`;
  const b = await waitStableRect(page, sel);
  const hit = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest(s)); }, [b.cx, b.cy, sel]);
  expect(hit, `누르기 직전 (${b.cx},${b.cy}) 맞힌 것이 머리띠 ${axis}${i} 가 아니다: ${JSON.stringify(await hitAt(page, b.cx, b.cy))}`).toBe(true);
  await page.mouse.move(b.cx, b.cy);
  await page.mouse.down();
  await page.mouse.move(toX ?? b.cx, toY ?? b.cy, { steps: 8 });
  await page.mouse.up();
}

test.describe('U2a 머리띠 @grid-reorder', () => {
  test('전제/확정① 머리띠는 «그리드를 고른 동안만» — 고르기 전 0 · 고르면 열 3 ＋ 행 3 · Esc 0 · 빈 캔버스 클릭 0 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    expect(await bandCount(page), '고르기 전').toEqual({ col: 0, row: 0, any: 0 });
    await selectGrid(page);
    await expect.poll(() => bandCount(page), '고른 뒤 = 열 N ＋ 행 M').toEqual({ col: 3, row: 3, any: 6 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('gG').classList.contains('selected'));
    await expect.poll(() => bandCount(page), 'Esc 로 푼 뒤').toEqual({ col: 0, row: 0, any: 0 });
    // 빈 캔버스(섹션 밖) 클릭으로 풀기
    await selectGrid(page);
    await expect.poll(() => bandCount(page), '다시 고름').toEqual({ col: 3, row: 3, any: 6 });
    const pt = await page.evaluate(() => {
      const s = document.getElementById('sG').getBoundingClientRect();
      return { x: Math.min(window.innerWidth - 20, s.right + 60), y: s.top + 40 };
    });
    await clickAt(page, pt.x, pt.y, { sel: '#canvas-area, #canvas-wrap', not: '.section-block' }, { label: '빈 캔버스' });
    await page.waitForFunction(() => !document.getElementById('gG').classList.contains('selected'));
    await expect.poll(() => bandCount(page), '빈 캔버스로 푼 뒤').toEqual({ col: 0, row: 0, any: 0 });
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('전제 1×1 — 옮길 것은 없어도 고른 동안 A · 1 이 선다(«해석» · 옛 :1844 return 을 걷음) · 거터는 여전히 0 @grid-reorder', async ({ page }) => {
    await setup(page, { cols: [{ width: 1, lines: [{ type: 'body', text: '하나' }] }] });
    const c = await waitStableRect(page, '#gG .grd-cell[data-r="0"][data-c="0"]');
    await clickAt(page, c.cx, c.cy, { sel: 'div#gG' }, { label: '1×1 고르기' });
    await page.waitForFunction(() => document.getElementById('gG').classList.contains('selected'));
    await expect.poll(() => labels(page)).toEqual({ col: ['A'], row: ['1'] });
    expect(await page.evaluate(() => document.querySelectorAll('#ss-handles-overlay > .grd-gutter').length), '1×1 거터 수(옛 동작 그대로)').toBe(0);
    await page.keyboard.press('Escape');
    await expect.poll(() => bandCount(page), '1×1 도 풀면 0 — 루프가 섰다').toEqual({ col: 0, row: 0, any: 0 });
  });

  test('음성대조① 안 고른 판은 그대로 — 고르기 전 PNG ≡ 골랐다 푼 PNG(블럭 둘레 40px) · 머리띠는 #canvas 밖에만 · 직렬화에 0 @grid-reorder', async ({ page }) => {
    await setup(page);
    await page.mouse.move(1, 1);
    const clip = await page.evaluate(() => {
      const r = document.getElementById('gG').getBoundingClientRect();
      return { x: Math.max(0, r.left - 40), y: Math.max(0, r.top - 40), width: r.width + 80, height: r.height + 80 };
    });
    const before = await page.screenshot({ clip });
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const where = await page.evaluate(() => ({
      inCanvas: document.querySelectorAll('#canvas .grd-headband, #canvas .grd-headband-drop, #canvas-scaler .grd-headband').length,
      inOverlay: document.querySelectorAll('#ss-handles-overlay .grd-headband').length,
      serialized: /grd-headband/.test(window.getSerializedCanvas()),
    }));
    expect(where, '머리띠 자리 — 캔버스 0 · 오버레이 6 · 저장 직렬화 0').toEqual({ inCanvas: 0, inOverlay: 6, serialized: false });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('gG').classList.contains('selected'));
    await page.mouse.move(1, 1);
    await expect.poll(async () => (await page.screenshot({ clip })).equals(before),
      { message: '골랐다 푼 판이 고르기 전 판과 픽셀이 다르다(머리띠·선택 흔적이 남았다)', timeout: 5000 }).toBe(true);
  });

  test('음성대조③ 이름 — 열 = A·B·C(알파벳) · 행 = 1·2·3(숫자) (확정 ⑤) @grid-reorder', async ({ page }) => {
    await setup(page);
    await selectGrid(page);
    await expect.poll(() => labels(page)).toEqual({ col: ['A', 'B', 'C'], row: ['1', '2', '3'] });
    // 이름은 «자리»다 — 옮긴 뒤에도 A·B·C / 1·2·3 그대로(내용이 옮겨 간다)
    const r2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    await dragBand(page, 'row', 1, undefined, r2.top + r2.height * 0.8);
    await expect.poll(async () => (await model(page)).text['20']).toBe('A2');
    await expect.poll(() => labels(page)).toEqual({ col: ['A', 'B', 'C'], row: ['1', '2', '3'] });
  });

  test('양성①②③ 행 머리띠 2 → 자리 3 (진짜 마우스) — rows·cells 같은 순열 · 높이 따라감 · 칸 줄 깊이 같음 · 이미지 바이트 그대로 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    const b = await model(page);
    expect(b.m.rows.map(r => r.height), '[전제] 행 높이가 서로 다르다').toEqual(['auto', 120, 200]);
    expect(imgOf(b.m, IMG_AT.r, IMG_AT.c).length, '[전제] 이미지 줄이 20만 자를 넘는다').toBeGreaterThan(200000);
    expect(sha(imgOf(b.m, IMG_AT.r, IMG_AT.c)), '[전제] 장면 이미지가 얹힌 그대로').toBe(BIG_SHA);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    /* ★U2a-fix D3 — 끌기 «전»에 줄 하나(행 2 · A2)를 «진짜로» 골라 둔다. 안 고르면 아래 「줄 선택이 비었다」가 늘 초록(항등식 — 이벨류 noclear 변이 9 passed). */
    const l = await waitStableRect(page, '#gG .grd-cell[data-r="1"][data-c="0"] [data-line="0"]');
    await clickAt(page, l.left + Math.min(8, l.width / 2), l.cy, { sel: '#gG .grd-cell[data-r="1"][data-c="0"]' }, { label: '줄 A2 고르기' });
    await expect.poll(() => page.evaluate(() => window.grdGetActiveLine(document.getElementById('gG'))),
      '[전제] 활성 줄 !== null — 옮기기 전 줄(1,0,0)이 골라졌다').toMatchObject({ r: 1, c: 0, li: 0 });
    const r2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    await dragBand(page, 'row', 1, undefined, r2.top + r2.height * 0.8);   // 행 3 의 가운데 «아래» = 자리 3(끝)
    await expect.poll(async () => (await model(page)).text['20'], '옮긴 뒤 행 3 자리에 A2').toBe('A2');
    const a = await model(page);
    expect(a.m.rows, '양성② rows 가 같은 순열(높이 따라감)').toEqual(spliceMove(b.m.rows, 1, 2));
    expect(a.m.rows[2].height, '양성② rows[to].height = 옛 rows[from].height').toBe(b.m.rows[1].height);
    expect(a.m.cells, '양성① cells 가 같은 순열(칸 통째 — 해-1)').toEqual(spliceMove(b.m.cells, 1, 2));
    expect(a.m.cells[2].map(c => c.lines), '양성③ cells[to].lines ≡ 옛 cells[from].lines').toEqual(b.m.cells[1].map(c => c.lines));
    expect(a.m.cols, '행 이동은 cols 를 안 바꾼다').toEqual(b.m.cols);
    const s = imgOf(a.m, 2, IMG_AT.c);
    expect([s && s.length, s && sha(s)], '덧 ⑵ 이미지 줄 imgSrc 길이·sha256 그대로').toEqual([BIG.length, BIG_SHA]);
    expect(a.text, '그려진 칸 글자').toMatchObject({ '00': 'A1', '10': 'A3', '20': 'A2', '21': 'B2', '11': 'B3' });
    await expect.poll(() => bandCount(page), '옮긴 뒤 머리띠 다시 섬(hide → show)').toEqual({ col: 3, row: 3, any: 6 });
    expect(await page.evaluate(() => [window.grdGetActiveLine(document.getElementById('gG')), window.grdGetLineSel(document.getElementById('gG')).length]),
      '옮긴 뒤 줄 선택(옛 주소)이 비었다').toEqual([null, 0]);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('양성①③ 열 머리띠 C → 자리 1 (진짜 마우스) — cols(폭·행 0 줄)·각 행 칸 같은 순열 · 이미지 바이트 그대로 · 행은 안 섞인다 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    const b = await model(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const c0 = await waitStableRect(page, '#gG .grd-cell[data-r="0"][data-c="0"]');
    const cb = await waitStableRect(page, `${BANDS}[data-axis="col"][data-i="2"]`);
    await dragBand(page, 'col', 2, c0.left + c0.width * 0.2, cb.cy + 200);   // 열 A 가운데 «왼쪽» = 자리 0 · 세로로 크게 벗어나도 열 축만 본다
    await expect.poll(async () => (await model(page)).text['00'], '옮긴 뒤 열 A 자리에 C1').toBe('C1');
    const a = await model(page);
    expect(a.m.cols, 'cols 같은 순열(폭·행 0 줄 통째)').toEqual(spliceMove(b.m.cols, 2, 0));
    expect(a.m.cols[0].width, '폭이 따라감').toBe(b.m.cols[2].width);
    expect(a.m.cells, '각 행 칸 같은 순열').toEqual(b.m.cells.map(row => spliceMove(row, 2, 0)));
    expect(a.m.rows, '열 이동은 rows(높이)를 안 바꾼다 — 행·열이 안 섞인다').toEqual(b.m.rows);
    const s = imgOf(a.m, IMG_AT.r, 0);
    expect([s && s.length, s && sha(s)], '덧 ⑵ 이미지 줄 imgSrc 길이·sha256 그대로(열 이동)').toEqual([BIG.length, BIG_SHA]);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('⌘Z 한 번 — 머리띠 끌기 한 번이 ⌘Z 한 번에 dataset 글자 그대로 돌아온다 · ⌘⇧Z 로 다시 @grid-reorder', async ({ page }) => {
    await setup(page);
    const b = await model(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const r2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    await dragBand(page, 'row', 1, undefined, r2.top + r2.height * 0.8);
    await expect.poll(async () => (await model(page)).text['20']).toBe('A2');
    const moved = await model(page);
    expect(moved.raw, '[전제] 옮겼다').not.toEqual(b.raw);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await expect.poll(async () => (await model(page)).raw, '⌘Z «한 번»에 옮기기 전 dataset').toEqual(b.raw);
    expect((await model(page)).text['10'], '그려진 화면도 돌아왔다').toBe('A2');
    await page.keyboard.press('Meta+Shift+z');
    await expect.poll(async () => (await model(page)).raw, '⌘⇧Z 로 옮긴 판').toEqual(moved.raw);
  });

  test('저장 왕복 — 옮긴 뒤 serializeProject → 앱 다시 띄움 → applyProjectData ⇒ 순서·높이·이미지 바이트가 남는다 @grid-reorder', async ({ page }) => {
    await setup(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const r2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    await dragBand(page, 'row', 1, undefined, r2.top + r2.height * 0.8);
    await expect.poll(async () => (await model(page)).text['20']).toBe('A2');
    const moved = await model(page);
    const snap = await page.evaluate(() => window.serializeProject());
    expect(snap.includes('grd-headband'), '저장본에 머리띠 0').toBe(false);
    await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
    await page.waitForFunction(() => !!document.getElementById('gG') && document.querySelectorAll('#gG .grd-cell').length === 9);
    const after = await model(page);
    expect(after.m, '다시 연 모델 = 옮긴 모델').toEqual(moved.m);
    expect(after.text['20'], '다시 그린 화면').toBe('A2');
    const s = imgOf(after.m, 2, IMG_AT.c);
    expect([s && s.length, s && sha(s)], '덧 ⑵ 저장 왕복 뒤 imgSrc 길이·sha256').toEqual([BIG.length, BIG_SHA]);
  });

  test('토큰 — 머리띠 계산 스타일 = 캔버스 ＋(.grd-add-btn) 어법 · hover = --ui-accent-primary · 끄는 동안 = --ui-disabled-opacity · 새 힌트 요소 0 @grid-reorder', async ({ page }) => {
    await setup(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    await page.waitForFunction(() => !!document.querySelector('#grd-plus-layer > .grd-add-btn'));
    await page.mouse.move(1, 1);
    const st = await page.evaluate((s) => {
      const band = document.querySelector(`${s}[data-axis="row"][data-i="0"]`);
      const plus = document.querySelector('#grd-plus-layer > .grd-add-btn');
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;border:var(--ui-handle-border-w) dashed var(--ui-divider);color:var(--ui-text-muted);';
      document.getElementById('ss-handles-overlay').appendChild(probe);
      const pick = (el) => { const c = getComputedStyle(el); return { style: c.borderTopStyle, width: c.borderTopWidth, border: c.borderTopColor, color: c.color }; };
      /* ★U2a-fix D4 — title 의 «있음/없음»은 잠그지 않는다(＋ 단추와 같은 어법 · «불필요한 프롭힌트» 여부 = 현빈 판단).
         잠그는 것 = 머리띠 안 «요소» 자식 0(글자 노드 하나만) ＋ 머리띠가 사는 층(#ss-handles-overlay)에 «힌트 요소» 0.
         (패널 쪽 힌트는 그리드 패널의 것이라 이 자로 안 센다 — 머리띠가 만드는 것만 잰다.) */
      const hints = document.querySelectorAll('#ss-handles-overlay :is([role="tooltip"], [class*="tooltip"], [class*="hint"], [class*="Hint"])').length;
      const out = { band: pick(band), plus: pick(plus), token: pick(probe), kids: band.children.length,
        nonText: [...band.childNodes].filter(n => n.nodeType !== 3).length, hints };
      probe.remove();
      return out;
    }, BANDS);
    expect(st.band.style, '점선').toBe('dashed');
    expect(st.band, '머리띠 = 토큰(--ui-handle-border-w · --ui-divider · --ui-text-muted)').toEqual({ ...st.token, style: 'dashed' });
    expect(st.band, '머리띠 = 캔버스 ＋ 어법').toEqual(st.plus);
    expect([st.kids, st.nonText], '머리띠 안 = 글자 노드뿐(요소 자식 0)').toEqual([0, 0]);
    expect(st.hints, '머리띠 층에 힌트 요소 0(머리띠 말고 새 노드 0)').toBe(0);
    const b0 = await waitStableRect(page, `${BANDS}[data-axis="row"][data-i="0"]`);
    await page.mouse.move(b0.cx, b0.cy);
    const hov = await page.evaluate((s) => {
      const band = document.querySelector(`${s}[data-axis="row"][data-i="0"]`);
      const p = document.createElement('div'); p.style.cssText = 'color:var(--ui-accent-primary);opacity:var(--ui-disabled-opacity);';
      document.body.appendChild(p); const tok = getComputedStyle(p); const out = { accent: tok.color, dis: tok.opacity }; p.remove();
      const c = getComputedStyle(band); return { ...out, border: c.borderTopColor, color: c.color };
    }, BANDS);
    expect([hov.border, hov.color], 'hover = --ui-accent-primary').toEqual([hov.accent, hov.accent]);
    // 끄는 동안 흐림 — 제자리(행 0 가운데 아래 = 자리 1 → 옮길 index 0 = 제자리)라 놓아도 쓰기 0
    const before = (await model(page)).raw;
    await page.mouse.down();
    await page.mouse.move(b0.cx, b0.cy + 12, { steps: 4 });
    const op = await page.evaluate((s) => getComputedStyle(document.querySelector(`${s}[data-axis="row"][data-i="0"]`)).opacity, BANDS);
    expect(op, '끄는 동안 = --ui-disabled-opacity').toBe(hov.dis);
    expect(await page.evaluate(() => document.querySelectorAll('#ss-handles-overlay > .grd-headband-drop').length), '놓을 자리 선').toBe(1);
    await page.mouse.up();
    expect((await model(page)).raw, '제자리 놓기 = 쓰기 0').toEqual(before);
    expect(await page.evaluate(() => document.querySelectorAll('.grd-headband-drop').length), '놓은 뒤 선 0').toBe(0);
  });
});

/* ═══ U2a-fix (독립 이벨류 PASS-WITH-FIXES 의 D1·D2) ═══════════════════════════════════════════════
 * D1 이웃 블럭 — 틈 0 으로 붙은 위 블럭 gU(1줄 짧은 그리드) · 왼쪽 이웃 gL. gG 를 고른 채 «머리띠 자리»의 이웃 점을
 *    진짜 마우스로 누르면 ⇒ 이웃이 골라진다(머리띠 없을 때와 같은 결과). 끌기는 여전히 머리띠 것 · 자기 바탕(조상) 탭 = 옛 동작.
 *    ★변이 «D1 고침 되돌림»(click 넘기기 떼기) ⇒ 이 절 빨강.
 * D2 끄는 중 Esc = 끌기 취소(쓰기 0 · 선택 유지 · 리스너 0 → 다시 끌기 정상 한 번) · 끄는 중 다른 길로 선택 풀림/블럭 지움 ⇒ 놓아도 쓰기 0.
 *    ★변이 «onUp 선택 확인 뺌» ⇒ 풀림/지움 칸 빨강.
 * ★U2a 재평가 고침(R1·R2·R4):
 *   R1 칸 편집 중 머리띠 자리 이웃 탭 ⇒ 편집 끝(.editing 0 · 포커스 그리드 밖) = 진짜 클릭. ★변이 «blur 뺌» ⇒ R1 칸 빨강.
 *   R2 끌기를 마친 뒤(정상 놓기 · Esc 취소) Esc ⇒ 선택 풀림. ★변이 keyleak(cleanup 의 keydown remove 뺌) ⇒ R2 칸 빨강.
 *   R4 머리띠 밑이 캔버스 바깥 바탕(#canvas-wrap·#canvas-scaler·#canvas)이면 조상이어도 넘김 ⇒ 선택 풀림 · 패널 Page.
 *      섹션 안 조상(row·섹션)은 종전대로 안 넘김(D1 자기 바탕 · 해-13). ★변이 «바깥 바탕 넘김 뺌» ⇒ R4 칸 빨강.
 * 장면 E1·E5 = 이벨류 탐침(reports/S6-GRID/eval-u2a-probe) 그대로(gU 2열×1행 · gG 3×3 · 두 row 사이 gap-block 없음). */
const SEC_UP = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:80px"></div>
<div class="row" id="rU"><div class="grid-block" id="gU" data-type="grid" data-gap="24" data-valign="top"></div></div>
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top"></div></div>
<div class="gap-block" data-type="gap" style="height:600px"></div></div></div>`;
const SEC_LEFT = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:80px"></div>
<div class="row" id="rG"><div class="grid-block" id="gL" data-type="grid" data-gap="24" data-valign="top" style="flex:0 0 360px;width:360px"></div><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" style="flex:1 1 0;min-width:0"></div></div>
<div class="gap-block" data-type="gap" style="height:600px"></div></div></div>`;
const UP = { cols: [{ width: 1, lines: [{ type: 'body', text: 'U-L' }] }, { width: 1, lines: [{ type: 'body', text: 'U-R' }] }] };

async function setupNeighbor(page, html, nbId) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(([h, sc, up, nb]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    const g = document.getElementById('gG');
    g.dataset.cols = JSON.stringify(sc.cols); g.dataset.rows = JSON.stringify(sc.rows);
    g.dataset.cells = JSON.stringify(sc.cells.map((row, r) => row.map(cell => { const o = { ...cell }; if (r === 0) delete o.lines; return o; })));
    const u = document.getElementById(nb); u.dataset.cols = JSON.stringify(up.cols);
    window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock?.(u); window.renderGridBlock?.(g);
    g.scrollIntoView({ block: 'center' });
  }, [html, SCENE, UP, nbId]);
  await waitStableRect(page, '#gG');
  await waitStableRect(page, `#${nbId}`);
  return errs;
}
const selState = (page) => page.evaluate(() => [...document.querySelectorAll('.grid-block.selected')].map(g => g.id).sort());
/** 점 (x,y) 의 «오버레이 밑» 첫 요소가 nbId 블럭 안인가 — [전제] 그 점이 정말 이웃 자리다 */
const underIs = (page, x, y, nbId) => page.evaluate(([x, y, nb]) => {
  const ovl = document.getElementById('ss-handles-overlay');
  const top = document.elementFromPoint(x, y);
  const under = document.elementsFromPoint(x, y).find(el => !ovl.contains(el));
  return { topIsBand: !!(top && top.closest('.grd-headband')), underInNb: !!(under && under.closest('#' + nb)) };
}, [x, y, nbId]);

/* ★U2a 재평가 R1·R4 장면·잣대 — 탐침 reports/S6-GRID/eval-u2a-probe(eval2 P5·P6) 그대로.
 *   PAGE_BG = editor.js 빈 바탕 선택 해제(#canvas-wrap click)가 보는 id 셋 — overlay-handles GRD_BAND_PAGE_BG 와 같은 글자. */
const PAGE_BG = ['canvas-wrap', 'canvas-scaler', 'canvas'];
/* 섹션 안 조상 장면 — gG 를 row 안에서 오른쪽으로 들여(margin) 행 머리띠 밑이 row/섹션 바탕이 되게 */
const SEC_INSET = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" style="flex:0 0 520px;width:520px;margin-left:160px"></div></div>
<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`;
/* 위 이웃 = 글 블럭 tT(틈 0) */
const SEC_TEXT = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:80px"></div><div id="slot"></div>
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top"></div></div>
<div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`;
async function setupText(page) {
  const errs = await setup(page, SCENE, SEC_TEXT);
  await page.evaluate(() => {
    const tb = window.makeTextBlock('h1').block; tb.id = 'tT';
    const ed = tb.querySelector('[contenteditable]'); ed.textContent = '위 글 블럭 TTTT'; delete ed.dataset.isPlaceholder;
    const row = document.createElement('div'); row.className = 'row'; row.id = 'rT'; row.appendChild(tb);
    document.getElementById('slot').replaceWith(row);
    window.rebindAll?.(); window.buildLayerPanel?.(); window.deselectAll?.();
    document.getElementById('gG').scrollIntoView({ block: 'center' });
  });
  await waitStableRect(page, '#gG');
  await waitStableRect(page, '#tT');
  return errs;
}
/** 진짜 클릭과 대조할 상태 한 벌 — 선택·편집·포커스·패널 머리·레이어 */
const snap = (page) => page.evaluate(() => {
  const pp = document.querySelector('#panel-right .panel-body');
  const a = document.activeElement;
  return {
    selected: [...document.querySelectorAll('#canvas .selected')].map(e => e.id || e.className.split(' ')[0]).sort(),
    editing: [...document.querySelectorAll('#canvas .editing')].map(e => e.id || e.className.split(' ')[0]).sort(),
    active: (a && a !== document.body) ? (a.closest('[id]')?.id || a.tagName) : 'body',
    activeInGrid: !!(a && document.getElementById('gG').contains(a)),
    panelId: pp?.querySelector('.prop-block-id')?.textContent?.trim() || null,
    panelPage: !pp?.querySelector('.prop-block-id') && /Page/.test(pp?.innerText || ''),
    layerActive: [...document.querySelectorAll('.layer-item.active')].map(i => (i.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)),
    bands: document.querySelectorAll('.grd-headband').length,
  };
});

test.describe('U2a-fix D1·D2 @grid-reorder', () => {
  test('D1 위 이웃(E1) — gG 고른 채 위 블럭 gU(1줄) 아랫단 = 열 머리띠 자리를 진짜 마우스로 누르면 gU 가 골라진다 @grid-reorder', async ({ page }) => {
    const errs = await setupNeighbor(page, SEC_UP, 'gU');
    const gap = await page.evaluate(() => document.getElementById('gG').getBoundingClientRect().top - document.getElementById('gU').getBoundingClientRect().bottom);
    expect(Math.abs(gap), '[전제] gU 와 gG 사이 틈 0').toBeLessThan(1);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const b1 = await waitStableRect(page, `${BANDS}[data-axis="col"][data-i="1"]`);
    expect(await underIs(page, b1.cx, b1.cy, 'gU'), '[전제] 그 점 = 맨 위는 머리띠 · 그 밑은 gU').toEqual({ topIsBand: true, underInNb: true });
    await page.mouse.click(b1.cx, b1.cy);
    await expect.poll(() => selState(page), '머리띠 자리 gU 점 클릭 → gU 골라짐(머리띠 없을 때와 같다)').toEqual(['gU']);
    await expect.poll(() => bandCount(page), 'gU(2열×1행) 머리띠로 바뀜').toEqual({ col: 2, row: 1, any: 3 });
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('D1 위 이웃(E5) — gG 고른 채 1줄 짧은 그리드 gU 칸 가운데를 누르면 gU 가 골라진다 · 다시 gG 고르고 열 머리띠 끌기는 여전히 된다 @grid-reorder', async ({ page }) => {
    const errs = await setupNeighbor(page, SEC_UP, 'gU');
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const u = await waitStableRect(page, '#gU .grd-cell[data-r="0"][data-c="0"]');
    const pt = { x: u.cx, y: u.cy };   // E5 그대로 = gU 칸 «가운데»(1줄 짧은 그리드라 머리띠 띠 안 — [전제]로 잰다)
    expect(await underIs(page, pt.x, pt.y, 'gU'), '[전제] gU 칸 점이 머리띠 밑에 깔렸다').toEqual({ topIsBand: true, underInNb: true });
    await page.mouse.click(pt.x, pt.y);
    await expect.poll(() => selState(page), 'gU 칸 클릭 → gU 골라짐').toEqual(['gU']);
    await expect.poll(() => bandCount(page)).toEqual({ col: 2, row: 1, any: 3 });
    // (b) 끌기는 여전히 머리띠 것 — gG 다시 고르고 gU 위에 뜬 열 머리띠 C 를 자리 0 으로
    const b = await model(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const c0 = await waitStableRect(page, '#gG .grd-cell[data-r="0"][data-c="0"]');
    const cb = await waitStableRect(page, `${BANDS}[data-axis="col"][data-i="2"]`);
    expect((await underIs(page, cb.cx, cb.cy, 'gU')).underInNb, '[전제] 끌 머리띠 C 가 gU 위에 떠 있다').toBe(true);
    await dragBand(page, 'col', 2, c0.left + c0.width * 0.2, cb.cy);
    await expect.poll(async () => (await model(page)).text['00'], '열 머리띠 끌기 = 옮김(이웃 위여도)').toBe('C1');
    expect((await model(page)).m.cols, 'cols 같은 순열').toEqual(spliceMove(b.m.cols, 2, 0));
    expect(await selState(page), '끈 뒤 gG 그대로 골라짐(이웃으로 안 넘어감)').toEqual(['gG']);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('D1 왼쪽 이웃 — gG 고른 채 왼쪽 이웃 gL 오른단 = 행 머리띠 자리를 누르면 gL 이 골라진다 @grid-reorder', async ({ page }) => {
    const errs = await setupNeighbor(page, SEC_LEFT, 'gL');
    const gap = await page.evaluate(() => document.getElementById('gG').getBoundingClientRect().left - document.getElementById('gL').getBoundingClientRect().right);
    expect(Math.abs(gap), '[전제] gL 과 gG 사이 틈 0').toBeLessThan(1);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const b = await waitStableRect(page, `${BANDS}[data-axis="row"][data-i="0"]`);
    expect(await underIs(page, b.cx, b.cy, 'gL'), '[전제] 행 머리띠 밑 = gL').toEqual({ topIsBand: true, underInNb: true });
    await page.mouse.click(b.cx, b.cy);
    await expect.poll(() => selState(page), '행 머리띠 자리 gL 점 클릭 → gL 골라짐').toEqual(['gL']);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('D1 자기 바탕 — 머리띠 밑이 gG 의 «섹션 안» 조상(row·섹션 바탕)이면 탭 = 옛 동작(아무 일 0 · gG 선택 유지 · 쓰기 0 · 해-13) @grid-reorder', async ({ page }) => {
    await setup(page, SCENE, SEC_INSET);
    const before = (await model(page)).raw;
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const b = await waitStableRect(page, `${BANDS}[data-axis="row"][data-i="1"]`);
    const anc = await page.evaluate(([x, y, bg]) => {
      const ovl = document.getElementById('ss-handles-overlay');
      const under = document.elementsFromPoint(x, y).find(el => !ovl.contains(el));
      const sG = document.getElementById('sG');
      return { anc: !!(under && under.contains(document.getElementById('gG'))), inSection: !!(under && sG.contains(under)), pageBg: !!(under && bg.includes(under.id)) };
    }, [b.cx, b.cy, PAGE_BG]);
    expect(anc, '[전제] 행 머리띠 밑 = gG 의 조상 · 섹션 안 · 캔버스 바깥 바탕 아님').toEqual({ anc: true, inSection: true, pageBg: false });
    await page.mouse.click(b.cx, b.cy);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    expect(await selState(page), '탭 뒤 gG 선택 유지').toEqual(['gG']);
    expect((await model(page)).raw, '탭 = 쓰기 0').toEqual(before);
  });

  test('R4 캔버스 바깥 바탕 — 행 머리띠 밑이 #canvas-wrap 등(조상이어도)이면 넘긴다 ⇒ 선택 풀림 · 패널 Page · 진짜 빈 바탕 클릭(4px 틈)과 같다 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const b = await waitStableRect(page, `${BANDS}[data-axis="row"][data-i="1"]`);
    const u = await page.evaluate(([x, y]) => {
      const ovl = document.getElementById('ss-handles-overlay');
      const under = document.elementsFromPoint(x, y).find(el => !ovl.contains(el));
      return { id: under ? under.id : null, anc: !!(under && under.contains(document.getElementById('gG'))) };
    }, [b.cx, b.cy]);
    expect(PAGE_BG.includes(u.id) && u.anc, `[전제] 행 머리띠 밑 = 캔버스 바깥 바탕(조상) — ${JSON.stringify(u)}`).toBe(true);
    await page.mouse.click(b.cx, b.cy);
    await expect.poll(() => selState(page), '머리띠 자리 바깥 바탕 탭 → 선택 풀림').toEqual([]);
    await expect.poll(() => bandCount(page), '머리띠 0').toEqual({ col: 0, row: 0, any: 0 });
    const fwd = await snap(page);
    expect(fwd.selected, '#canvas 안 .selected 0').toEqual([]);
    expect([fwd.panelId, fwd.panelPage], '패널 = Page').toEqual([null, true]);
    // 대조 — 같은 바탕을 머리띠 «밖»(행 머리띠 왼끝에서 6px 더 왼쪽 · 블럭 가장자리 손잡이와 떨어진 점)에서 진짜로 누른다.
    //   ⚠️u2ar 변이 noguard 런에서 «그리드 왼쪽 2px» 점의 맨 위가 id 없는 요소였다(블럭 가장자리 오버레이 추정 · 안 쟀다) ⇒ 점을 옮김.
    await setup(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const bb = await waitStableRect(page, `${BANDS}[data-axis="row"][data-i="1"]`);
    const c = { x: bb.left - 6, y: bb.cy };
    const cu = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName) : null; }, [c.x, c.y]);
    expect(PAGE_BG.includes(cu), `[전제] 대조 점 맨 위 = 캔버스 바깥 바탕 — ${cu}`).toBe(true);
    await page.mouse.click(c.x, c.y);
    await expect.poll(() => selState(page)).toEqual([]);
    const ctl = await snap(page);
    expect(fwd, '넘김 = 진짜 빈 바탕 클릭').toEqual(ctl);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('R1 칸 글 편집 중 — 머리띠 자리 위 글 블럭 탭 ⇒ 편집 끝(.editing 0 · 포커스가 그리드 칸 아님) · 진짜 클릭(4px 틈 · 머리띠 밖)과 같다 @grid-reorder', async ({ page }) => {
    const enterEdit = async () => {
      const l = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"] [data-line="0"]');
      await page.mouse.click(l.left + 6, l.cy);
      await page.mouse.dblclick(l.left + 6, l.cy);
      await expect.poll(() => page.evaluate(() => {
        const a = document.activeElement, g = document.getElementById('gG');
        return { inGrid: !!(a && g.contains(a)), ce: !!(a && a.isContentEditable), editing: g.classList.contains('editing') };
      }), '[전제] gG 칸 글 편집 중').toEqual({ inGrid: true, ce: true, editing: true });
    };
    const errs = await setupText(page);
    await selectGrid(page);
    await enterEdit();
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const b = await waitStableRect(page, `${BANDS}[data-axis="col"][data-i="0"]`);
    expect(await underIs(page, b.cx, b.cy, 'tT'), '[전제] 열 머리띠 A 밑 = 위 글 블럭 tT').toEqual({ topIsBand: true, underInNb: true });
    await page.mouse.click(b.cx, b.cy);
    await expect.poll(() => page.evaluate(() => document.getElementById('tT').classList.contains('selected')), '넘김 → tT 골라짐').toBe(true);
    const fwd = await snap(page);
    expect(fwd.editing, '넘긴 뒤 .editing 0').toEqual([]);
    expect(fwd.activeInGrid, '넘긴 뒤 포커스가 그리드 칸 아님').toBe(false);
    // 대조 — 같은 tT 를 머리띠 밖(gG 위 2px · 틈 0 이라 tT 아랫단)에서 진짜로 누른다
    await setupText(page);
    await selectGrid(page);
    await enterEdit();
    const g = await waitStableRect(page, '#gG');
    const c = { x: b.cx, y: g.top - 2 };
    expect((await underIs(page, c.x, c.y, 'tT')).underInNb, '[전제] 대조 점 = tT').toBe(true);
    await page.mouse.click(c.x, c.y);
    await expect.poll(() => page.evaluate(() => document.getElementById('tT').classList.contains('selected'))).toBe(true);
    const ctl = await snap(page);
    expect(fwd, '넘김 = 진짜 클릭(선택·편집·포커스·패널)').toEqual(ctl);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('D2 끄는 중 Esc = 끌기 취소 — 놓아도 dataset 글자 그대로 · 선택 유지 · 리스너 누수 0(다시 끌기 = 한 번 옮김) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    const b0 = await model(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const b = await waitStableRect(page, `${BANDS}[data-axis="row"][data-i="1"]`);
    const r2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    await page.mouse.move(b.cx, b.cy); await page.mouse.down();
    await page.mouse.move(b.cx, r2.top + r2.height * 0.8, { steps: 8 });
    expect(await page.evaluate(() => document.querySelectorAll('.grd-headband-drop').length), '[전제] 끄는 중 놓을 자리 선').toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.grd-headband-drop, .grd-headband.is-dragging').length), 'Esc → 선·흐림 걷힘').toBe(0);
    expect(await selState(page), 'Esc 는 끌기만 취소 — gG 선택 유지').toEqual(['gG']);
    await page.mouse.move(b.cx, r2.top + r2.height * 0.85);
    await page.mouse.up();
    expect((await model(page)).raw, 'Esc 뒤 놓기 = 쓰기 0(dataset 글자 그대로)').toEqual(b0.raw);
    await expect.poll(() => bandCount(page), '머리띠 그대로').toEqual({ col: 3, row: 3, any: 6 });
    // 리스너 누수 0 — 다시 끌면 «한 번»만 옮긴다(옛 onUp 이 살아 있으면 두 번 쓰거나 놓기 전에 쓴다)
    await dragBand(page, 'row', 1, undefined, r2.top + r2.height * 0.8);
    await expect.poll(async () => (await model(page)).m.rows, '다시 끌기 = 한 번 옮김').toEqual(spliceMove(b0.m.rows, 1, 2));
    expect((await model(page)).m.cells, 'cells 도 한 번').toEqual(spliceMove(b0.m.cells, 1, 2));
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('D2 끄는 중 다른 길로 선택 풀림(deselectAll) — 놓아도 쓰기 0 · 머리띠·선 0 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    const b0 = await model(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const b = await waitStableRect(page, `${BANDS}[data-axis="row"][data-i="1"]`);
    const r2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    await page.mouse.move(b.cx, b.cy); await page.mouse.down();
    await page.mouse.move(b.cx, r2.top + r2.height * 0.8, { steps: 8 });
    expect(await page.evaluate(() => document.querySelectorAll('.grd-headband-drop').length), '[전제] 끄는 중').toBe(1);
    await page.evaluate(() => window.deselectAll());
    expect(await selState(page), '[전제] 다른 길로 풀림').toEqual([]);
    await page.mouse.move(b.cx, r2.top + r2.height * 0.85);
    await page.mouse.up();
    expect((await model(page)).raw, '선택 풀린 뒤 놓기 = 쓰기 0').toEqual(b0.raw);
    await expect.poll(() => bandCount(page), '머리띠·선 0').toEqual({ col: 0, row: 0, any: 0 });
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('D2 끄는 중 블럭이 지워짐 — 놓아도 떨어진 블럭 dataset 쓰기 0 · 오류 0 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const b = await waitStableRect(page, `${BANDS}[data-axis="row"][data-i="1"]`);
    const r2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    await page.mouse.move(b.cx, b.cy); await page.mouse.down();
    await page.mouse.move(b.cx, r2.top + r2.height * 0.8, { steps: 8 });
    const raw0 = await page.evaluate(() => {
      const g = document.getElementById('gG'); window.__u2afG = g;
      const out = { cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null };
      g.closest('.row').remove();
      return out;
    });
    expect(await page.evaluate(() => window.__u2afG.isConnected), '[전제] 블럭이 문서에서 떨어졌다').toBe(false);
    await page.mouse.move(b.cx, r2.top + r2.height * 0.85);
    await page.mouse.up();
    const raw1 = await page.evaluate(() => { const g = window.__u2afG; return { cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null }; });
    expect(raw1, '지워진 블럭에 쓰기 0').toEqual(raw0);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('R2 끌기를 마친 뒤 Esc ⇒ gG 선택 풀림 — 정상 놓기 뒤 · Esc 취소 뒤 둘 다(끄는 동안의 Esc 리스너가 남으면 이 Esc 를 먹는다) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    const b0 = await model(page);
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const r2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    // (a) 정상 놓기 → Esc
    await dragBand(page, 'row', 1, undefined, r2.top + r2.height * 0.8);
    await expect.poll(async () => (await model(page)).m.rows, '[전제] 옮김').toEqual(spliceMove(b0.m.rows, 1, 2));
    expect(await selState(page), '[전제] 놓은 뒤 gG 골라짐').toEqual(['gG']);
    await page.keyboard.press('Escape');
    await expect.poll(() => selState(page), '정상 놓기 뒤 Esc → 선택 풀림').toEqual([]);
    await expect.poll(() => bandCount(page)).toEqual({ col: 0, row: 0, any: 0 });
    // (b) Esc 취소 → 놓기 → Esc
    await selectGrid(page);
    await expect.poll(() => bandCount(page)).toEqual({ col: 3, row: 3, any: 6 });
    const b = await waitStableRect(page, `${BANDS}[data-axis="row"][data-i="1"]`);
    const r2b = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    await page.mouse.move(b.cx, b.cy); await page.mouse.down();
    await page.mouse.move(b.cx, r2b.top + r2b.height * 0.8, { steps: 8 });
    expect(await page.evaluate(() => document.querySelectorAll('.grd-headband-drop').length), '[전제] 끄는 중').toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.grd-headband-drop').length), '[전제] Esc 취소').toBe(0);
    expect(await selState(page), '[전제] 취소 Esc 는 선택 유지').toEqual(['gG']);
    await page.mouse.up();
    await page.keyboard.press('Escape');
    await expect.poll(() => selState(page), 'Esc 취소·놓기 뒤 Esc → 선택 풀림').toEqual([]);
    expect(errs, errs.join('\n')).toEqual([]);
  });
});
