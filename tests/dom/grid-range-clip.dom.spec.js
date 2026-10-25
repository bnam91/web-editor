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

/* ══ U2b 범위 복붙 — 칸을 «끌어» 범위(A2:C3) → ⌘C → 붙일 칸 → ⌘V (확정 ② ③ ⑤ · 설계 reports/S6-GRID/plan-u2b.md §6) ══
 * ★드릴 = selectGrid(첫 클릭 = 블럭) 뒤 줄 «진짜 클릭» · 범위 끌기 = page.mouse down → move(steps 8) → up(누르기 직전 맞힌 칸을 찍는다).
 * ★⌘C = 진짜 키(page.keyboard) · ⌘V = keydown ＋ 이어지는 paste 이벤트(grid-line-paste-single 의 가짜 OS 클립보드 __os 꼴 —
 *   그 순간의 OS 내용이 paste 이벤트에 실린다). ⛔waitForTimeout 0 — 기다림은 waitForFunction · expect.poll 로만.
 * ★음성대조② = 범위가 없으면 블럭 복사·줄 복사 길은 손 0(T1 T2 T10 T12). 확정② = 모자라면 들어가는 만큼만 · 버린 수 보고(T3 T3b T5).
 * ★변이(레인 밖 사본 · GD1001_ROOT): M1 copyalways · M2 nodrop · M3 nohide · M4 noesc · M5 nostamp · M6 order · M7 intake ·
 *   M8 noswallow · M-notrim — 각자 «노린 칸만» 빨강(보고서). */
const PNG1B64 = PNG1.toString('base64');
async function installOS(page, { image = false } = {}) {
  await page.evaluate((image) => {
    window.__os = { text: null, image };
    window.electronAPI = new Proxy({}, { get: (_t, k) => k === 'clipboardWriteText'
      ? (txt) => { window.__os = { text: String(txt), image: false }; return Promise.resolve({ ok: true }); } : () => Promise.resolve(null) });
  }, image);
}
const G_ = (page) => page.evaluate(() => {
  const g = document.getElementById('gG');
  const rects = [...document.querySelectorAll('.grd-range-rect')];
  return {
    rng: g ? (window.grdGetRange?.(g) ?? null) : null,
    n: rects.length,
    name: rects[0]?.dataset.name ?? null,
    inOverlay: rects.every(r => r.parentElement?.id === 'ss-handles-overlay'),
    sel: !!g?.classList.contains('selected'),
    al: g ? (window.grdGetActiveLine?.(g) ?? null) : null,
  };
});
const toast = (page) => page.evaluate(() => document.getElementById('editor-toast')?.textContent || '');
const grids = (page) => page.evaluate(() => document.querySelectorAll('#canvas .grid-block').length);
const os = (page) => page.evaluate(() => window.__os);
const cellSel = (r, c) => `#gG > .grd-inner > .grd-cell[data-r="${r}"][data-c="${c}"]`;
const lineSel = (r, c, li = 0) => `#gG [data-r="${r}"][data-c="${c}"][data-line="${li}"]`;

/** 이미 고른 그리드에서 줄 하나를 «진짜 클릭» — 활성 줄이 그 칸이 될 때까지. */
async function clickLine(page, r, c) {
  const l = await waitStableRect(page, lineSel(r, c));
  await clickAt(page, l.cx, l.cy, { sel: lineSel(r, c) }, { label: `줄 ${r}${c}` });
  await page.waitForFunction(([r, c]) => {
    const a = window.grdGetActiveLine(document.getElementById('gG'));
    return !!a && Number(a.r) === r && Number(a.c) === c;
  }, [r, c]);
  await page.evaluate(() => document.activeElement?.blur?.());
}
/** 드릴 = 블럭 고르기 → 줄 클릭. */
async function drill(page, r, c) { await selectGrid(page); await clickLine(page, r, c); }
/** 칸 a 가운데에서 칸 b 가운데(＋off)까지 «진짜 마우스»로 끈다 — 누르기 직전 맞힌 칸을 찍는다. */
async function dragRange(page, a, b, { off = 0, from = null } = {}) {
  const ca = from || await waitStableRect(page, cellSel(a.r, a.c));
  const cb = await waitStableRect(page, cellSel(b.r, b.c));
  if (!from) {
    const hit = await page.evaluate(([x, y]) => {
      const e = document.elementFromPoint(x, y); const cell = e && e.closest('.grd-cell');
      return cell ? `${cell.dataset.r}${cell.dataset.c}` : (e ? (e.id || String(e.className)) : null);
    }, [ca.cx, ca.cy]);
    expect(hit, `누르기 직전 (${ca.cx},${ca.cy}) 맞힌 칸`).toBe(`${a.r}${a.c}`);
  }
  await page.mouse.move(ca.cx, ca.cy);
  await page.mouse.down();
  await page.mouse.move(cb.cx + off, cb.cy + off, { steps: 8 });
  await page.mouse.up();
}
async function pressCopy(page) {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    const t = document.getElementById('editor-toast'); if (t) t.textContent = '';
    window.__t0 = window._internalClipboardTime || 0;
  });
  await page.keyboard.press('Meta+c');
  await page.waitForFunction(() => (window._internalClipboardTime || 0) !== window.__t0);
}
async function pressPaste(page) {
  await page.evaluate((png) => {
    document.activeElement?.blur?.();
    const t = document.getElementById('editor-toast'); if (t) t.textContent = '';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true, cancelable: true }));
    const dt = new DataTransfer();
    if (window.__os.text !== null) dt.setData('text/plain', window.__os.text);
    if (window.__os.image) { const b = Uint8Array.from(atob(png), ch => ch.charCodeAt(0)); dt.items.add(new File([b], 'clip.png', { type: 'image/png' })); }
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG1B64);
}
const linesOf = (m, r, c) => (m.cells[r][c].lines || []).map(l => l.type === 'image' ? 'IMG' : l.text);

test.describe('U2b 범위 복붙 @grid-reorder', () => {
  test('T1 음성대조② 블럭만 골라 ⌘C → 블럭 복사 그대로(범위 0 · OS 글자 ≠ 칸 TSV · ⌘V = 그리드 1→2 · gG 무변) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    const b = await model(page);
    await selectGrid(page);
    expect(await G_(page), '[전제] 블럭 단계 = 범위 0 · 활성 줄 0').toMatchObject({ rng: null, n: 0, sel: true, al: null });
    await pressCopy(page);
    expect(await toast(page), '블럭 복사엔 «칸» 토스트 0').not.toMatch(/칸/);
    const t = (await os(page)).text || '';
    expect(t.includes('\t') || /고디터 그리드 칸/.test(t), `OS 글자가 칸 클립이다: ${JSON.stringify(t.slice(0, 80))}`).toBe(false);
    await pressPaste(page);
    await expect.poll(() => grids(page), '⌘V = 블럭 붙여넣기').toBe(2);
    expect((await model(page)).raw, 'gG dataset 무변').toEqual(b.raw);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T2 드릴했지만 범위 없음 ⌘C → 줄 복사(줄 토스트 · OS = 줄 글자) · ⌘V = 줄 삽입(칸 통째 0) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    await drill(page, 2, 0);
    expect((await G_(page)).rng, '[전제] 범위 0').toBe(null);
    await pressCopy(page);
    expect(await toast(page), '줄 복사 토스트').toMatch(/^줄 1개 복사됨/);
    expect((await os(page)).text, 'OS = 줄 글자').toBe('A3');
    await pressPaste(page);
    await expect.poll(async () => linesOf((await model(page)).m, 2, 0), '⌘V = 줄 «삽입»').toEqual(['A3', 'A3']);
    expect(await grids(page)).toBe(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T3 양성④ UI — 드릴 A2 → A2:C3 진짜 끌기 → ⌘C(3×2) → 줄 A3 → ⌘V ⇒ 행 3 = 옛 행 2 깊이 같음 · 행 1·2 무변 · 버린 3 보고 · 붙은 뒤 A3:C3 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    const b = await model(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 2, c: 2 });
    await expect.poll(() => G_(page), '끈 뒤 범위(click 삼킴 — 안 삼키면 deselectAll 이 푼다)')
      .toMatchObject({ rng: { r0: 1, c0: 0, r1: 2, c1: 2 }, n: 1, name: 'A2:C3', inOverlay: true, sel: true });
    // 디자인 일관성 — 선택색 실선 · 토큰 두께 · 새 title/힌트 0
    const look = await page.evaluate(() => {
      const r = document.querySelector('.grd-range-rect'); const cs = getComputedStyle(r);
      const p = document.createElement('div'); p.style.color = 'var(--sel-color)'; p.style.borderTop = 'var(--ui-handle-border-w) solid'; document.body.appendChild(p);
      const want = { color: getComputedStyle(p).color, w: getComputedStyle(p).borderTopWidth }; p.remove();
      return { style: cs.borderTopStyle, color: cs.borderTopColor, w: cs.borderTopWidth, pe: cs.pointerEvents, want, title: r.hasAttribute('title'), kids: r.childNodes.length, inCanvas: !!document.querySelector('#canvas .grd-range-rect') };
    });
    expect(look, '범위 사각형 꼴').toEqual({ style: 'solid', color: look.want.color, w: look.want.w, pe: 'none', want: look.want, title: false, kids: 0, inCanvas: false });
    await pressCopy(page);
    expect(await toast(page), '복사 보고').toMatch(/^칸 A2:C3 \(3×2\) 복사됨/);
    expect((await os(page)).text, 'OS = TSV(그림 칸 = 빈 글)').toBe('A2\tB2\t\nA3\tB3\tC3');
    await clickLine(page, 2, 0);
    expect((await G_(page)).rng, '줄 클릭 = 범위 풀림').toBe(null);
    await pressPaste(page);
    await expect.poll(() => toast(page), '붙임 보고(쓴 수 · 버린 수)').toMatch(/^⚠️ A3 에 칸 3개 붙임 · 3개는/);
    const a = await model(page);
    expect(a.m.cells[2], '행 3 = 옛 행 2(칸 통째 깊이 같음)').toEqual(b.m.cells[1]);
    expect([a.m.cells[0], a.m.cells[1], a.m.cols, a.m.rows], '행 1·2 · cols · rows 무변').toEqual([b.m.cells[0], b.m.cells[1], b.m.cols, b.m.rows]);
    expect(await G_(page), '붙은 뒤 = 들어간 영역 범위 · 활성 줄 0').toMatchObject({ rng: { r0: 2, c0: 0, r1: 2, c1: 2 }, n: 1, name: 'A3:C3', al: null });
    expect(await grids(page)).toBe(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T3b 해-23 대상 범위로 자름 — 3×2 복사 → 대상 B2:B3(1×2) 골라 ⌘V ⇒ 2칸만 · 나머지 무변 · 버린 4 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    const b = await model(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 2, c: 2 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:C3');
    await pressCopy(page);
    await dragRange(page, { r: 1, c: 1 }, { r: 2, c: 1 });
    await expect.poll(async () => (await G_(page)).name, '[전제] 대상 범위').toBe('B2:B3');
    await pressPaste(page);
    await expect.poll(() => toast(page)).toMatch(/^⚠️ B2 에 칸 2개 붙임 · 4개는/);
    const a = await model(page);
    expect([a.m.cells[1][1], a.m.cells[2][1]], '대상 = 클립 왼쪽 열').toEqual([b.m.cells[1][0], b.m.cells[2][0]]);
    expect([a.m.cells[1][0], a.m.cells[2][0], a.m.cells[1][2], a.m.cells[2][2], a.m.cells[0], a.m.cols],
      '범위 밖 칸 무변').toEqual([b.m.cells[1][0], b.m.cells[2][0], b.m.cells[1][2], b.m.cells[2][2], b.m.cells[0], b.m.cols]);
    expect((await G_(page)).name, '붙은 영역').toBe('B2:B3');
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T4 이미지 바이트 — C2(20만 자 넘는 그림) 1×1 끌기 → ⌘C → B3 ⌘V ⇒ 붙은 imgSrc 길이·sha256 = 원본 · 원본도 그대로 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    await drill(page, 1, 0);
    await dragRange(page, IMG_AT, IMG_AT, { off: 12 });   // ★같은 칸 안 끌기 = 1×1(해-22)
    await expect.poll(async () => (await G_(page)).name).toBe('C2');
    await pressCopy(page);
    expect((await os(page)).text, '그림만 = 이름표').toBe('고디터 그리드 칸 1×1');
    await clickLine(page, 2, 1);
    await pressPaste(page);
    await expect.poll(() => toast(page)).toBe('B3 에 칸 1개 붙임');
    const m = (await model(page)).m;
    const s = imgOf(m, 2, 1), o = imgOf(m, IMG_AT.r, IMG_AT.c);
    expect([s && s.length, s && sha(s)], '붙은 그림 바이트').toEqual([BIG.length, BIG_SHA]);
    expect([o && o.length, o && sha(o)], '원본 그림 바이트').toEqual([BIG.length, BIG_SHA]);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T5 행 0 가장자리 — A2:B3 → C1 ⌘V ⇒ 행 0 칸 줄은 cols[2].lines 로 · 행 1 칸은 cells · 열 밖 2칸 버림 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    const b = await model(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 2, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B3');
    await pressCopy(page);
    await clickLine(page, 0, 2);
    await pressPaste(page);
    await expect.poll(() => toast(page)).toMatch(/^⚠️ C1 에 칸 2개 붙임 · 2개는/);
    const a = await model(page);
    expect(JSON.parse(a.raw.cols)[2].lines, '행 0 줄 = dataset cols[2].lines').toEqual(b.m.cells[1][0].lines);
    expect(a.m.cells[0][2], '행 0 칸 통째(모델)').toEqual(b.m.cells[1][0]);
    expect(a.m.cells[1][2], '행 1 칸').toEqual(b.m.cells[2][0]);
    expect([a.m.cells[0][0], a.m.cells[0][1], a.m.cells[1][0], a.m.cells[1][1], a.m.cells[2]], '나머지 무변')
      .toEqual([b.m.cells[0][0], b.m.cells[0][1], b.m.cells[1][0], b.m.cells[1][1], b.m.cells[2]]);
    expect((await G_(page)).name).toBe('C1:C2');
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T6 ⌘Z 한 번 — 범위 붙여넣기 한 번이 ⌘Z 한 번에 dataset 글자 그대로 · ⌘⇧Z 로 붙인 판 @grid-reorder', async ({ page }) => {
    await setup(page);
    await installOS(page);
    const b = await model(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B2');
    await pressCopy(page);
    await clickLine(page, 2, 1);
    await pressPaste(page);
    await expect.poll(() => toast(page)).toMatch(/B3 에 칸 2개 붙임/);
    const pasted = await model(page);
    expect(pasted.raw, '[전제] 붙었다').not.toEqual(b.raw);
    await page.keyboard.press('Meta+z');
    await expect.poll(async () => (await model(page)).raw, '⌘Z «한 번»에 붙이기 전').toEqual(b.raw);
    expect((await G_(page)).n, '되돌린 뒤 사각형 0').toBe(0);
    await page.keyboard.press('Meta+Shift+z');
    await expect.poll(async () => (await model(page)).raw, '⌘⇧Z = 붙인 판').toEqual(pasted.raw);
  });

  test('T7 저장 왕복 — 붙인 뒤 serializeProject → 다시 띄움 → applyProjectData ⇒ 모델·그림 sha 같음 · 저장본에 grd-range 0 @grid-reorder', async ({ page }) => {
    await setup(page);
    await installOS(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 2 }, { r: 2, c: 2 });
    await expect.poll(async () => (await G_(page)).name).toBe('C2:C3');
    await pressCopy(page);
    await clickLine(page, 1, 0);
    await pressPaste(page);
    await expect.poll(() => toast(page)).toBe('A2 에 칸 2개 붙임');
    const pasted = await model(page);
    expect((await G_(page)).n, '[전제] 사각형 있음').toBe(1);
    const snap = await page.evaluate(() => window.serializeProject());
    expect(/grd-range/.test(snap), '저장본에 grd-range 0').toBe(false);
    await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
    await page.waitForFunction(() => !!document.getElementById('gG') && document.querySelectorAll('#gG .grd-cell').length === 9);
    const after = await model(page);
    expect(after.m, '다시 연 모델 = 붙인 모델').toEqual(pasted.m);
    const s = imgOf(after.m, 1, 0);
    expect([s && s.length, s && sha(s)], '왕복 뒤 붙은 그림 바이트').toEqual([BIG.length, BIG_SHA]);
  });

  test('T8 최신 A — 범위 ⌘C 뒤 줄 ⌘C ⇒ ⌘V = 줄이 붙는다(범위 클립은 묵음) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    const b = await model(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B2');
    await pressCopy(page);
    await clickLine(page, 2, 0);
    await pressCopy(page);
    expect(await toast(page), '[전제] 줄 복사').toMatch(/^줄 1개 복사됨/);
    await pressPaste(page);
    await expect.poll(async () => linesOf((await model(page)).m, 2, 0), '줄 삽입').toEqual(['A3', 'A3']);
    const a = await model(page);
    expect([a.m.cells[2][1], a.m.cells[1]], '범위 붙이기 흔적 0').toEqual([b.m.cells[2][1], b.m.cells[1]]);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T9 최신 B — 줄 ⌘C 뒤 범위 ⌘C ⇒ ⌘V = 칸 통째(줄 삽입 0) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    const b = await model(page);
    await drill(page, 2, 0);
    await pressCopy(page);
    expect(await toast(page), '[전제] 줄 복사').toMatch(/^줄 1개 복사됨/);
    await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B2');
    await pressCopy(page);
    await clickLine(page, 2, 2);
    await pressPaste(page);
    await expect.poll(() => toast(page)).toMatch(/^⚠️ C3 에 칸 1개 붙임 · 1개는/);
    const a = await model(page);
    expect(a.m.cells[2][2], 'C3 = 옛 A2 칸 통째').toEqual(b.m.cells[1][0]);
    expect(linesOf(a.m, 2, 0), '줄 삽입 0').toEqual(['A3']);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T10 최신 C — 범위 ⌘C 뒤 블럭 ⌘C ⇒ ⌘V = 그리드 2 · gG 칸 무변 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    const b = await model(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B2');
    await pressCopy(page);
    // 풀고(빈 캔버스) 다시 블럭 단계로 고른다 — 범위 클립은 남는다(최신 판정만 본다)
    const pt = await page.evaluate(() => {
      const s = document.getElementById('sG').getBoundingClientRect();
      return { x: Math.min(window.innerWidth - 20, s.right + 60), y: s.top + 40 };
    });
    await clickAt(page, pt.x, pt.y, { sel: '#canvas-area, #canvas-wrap', not: '.section-block' }, { label: '빈 캔버스' });
    await expect.poll(() => G_(page)).toMatchObject({ rng: null, n: 0, sel: false });
    await selectGrid(page);
    await expect.poll(() => G_(page)).toMatchObject({ rng: null, sel: true, al: null });
    await pressCopy(page);
    expect(await toast(page), '[전제] 블럭 복사 = 칸/줄 토스트 0').not.toMatch(/칸|줄/);
    await pressPaste(page);
    await expect.poll(() => grids(page), '블럭 붙여넣기').toBe(2);
    expect((await model(page)).raw, 'gG 무변').toEqual(b.raw);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T11 Esc 풀기 — 첫 Esc = 범위만(사각형 0 · 선택·활성 줄 유지) · 그 뒤 ⌘C = 줄 복사 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 2, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B3');
    await page.keyboard.press('Escape');
    await expect.poll(() => G_(page), '첫 Esc').toMatchObject({ rng: null, n: 0, sel: true, al: { r: 1, c: 0 } });
    await pressCopy(page);
    expect(await toast(page), '범위 푼 뒤 ⌘C = 줄 복사').toMatch(/^줄 1개 복사됨/);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T12 선택 풀기(빈 캔버스 클릭 = deselectAll) — 범위·사각형 0 · 다시 고르면 블럭 단계 ⌘C⌘V = 그리드 2 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 2, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B3');
    const pt = await page.evaluate(() => {
      const s = document.getElementById('sG').getBoundingClientRect();
      return { x: Math.min(window.innerWidth - 20, s.right + 60), y: s.top + 40 };
    });
    await clickAt(page, pt.x, pt.y, { sel: '#canvas-area, #canvas-wrap', not: '.section-block' }, { label: '빈 캔버스' });
    await expect.poll(() => G_(page), '풀린 뒤').toMatchObject({ rng: null, n: 0, sel: false });
    await selectGrid(page);
    expect(await G_(page), '다시 고름 = 블럭 단계 · 옛 범위 안 살아남').toMatchObject({ rng: null, n: 0, sel: true, al: null });
    await pressCopy(page);
    await pressPaste(page);
    await expect.poll(() => grids(page)).toBe(2);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T13 머리띠 옮기기 — 범위가 있어도 행 머리띠 끌기는 옮기고 범위·사각형은 풀린다 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    const b = await model(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 2 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:C2');
    const r2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="0"]');
    await dragBand(page, 'row', 1, undefined, r2.top + r2.height * 0.8);
    await expect.poll(async () => (await model(page)).m.rows, '옮김').toEqual(spliceMove(b.m.rows, 1, 2));
    expect(await G_(page), '옮긴 뒤 범위 0').toMatchObject({ rng: null, n: 0 });
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T14 블럭 단계(드릴 전) 칸 끌기 = 범위 0 @grid-reorder', async ({ page }) => {
    await setup(page);
    await selectGrid(page);
    await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
    expect(await G_(page), '블럭만 고른 끌기').toMatchObject({ rng: null, n: 0 });
  });

  test('T15 중첩 — 중첩 줄(duo) 안에서 시작한 끌기 = 범위 0 · 바깥 칸에서 시작해 duo 위에 놓기 = 바깥 칸 주소 @grid-reorder', async ({ page }) => {
    const NEST = JSON.parse(JSON.stringify({ ...SCENE, cells: SCENE.cells.map(r => r.map(c => ({ ...c }))) }));
    NEST.cells[1][2] = { lines: [{ type: 'body', text: 'C2' }] };
    NEST.cells[2][1] = { lines: [{ type: 'body', text: 'B3' }, { type: 'duo', cols: [
      { width: 1, lines: [{ type: 'body', text: '안1' }] }, { width: 1, lines: [{ type: 'body', text: '안2' }] }] }] };
    const errs = await setup(page, NEST);
    await drill(page, 1, 0);
    const n = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="1"] .grd-nested > .grd-nested-col');   // ★가운데 틈 = 중첩 비율 거터(오버레이)라 칸 하나를 겨눈다
    const hitN = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.grd-nested'), [n.cx, n.cy]);
    expect(hitN, '[전제] 누르는 점 = duo').toBe(true);
    await dragRange(page, null, { r: 1, c: 0 }, { from: n });
    expect(await G_(page), 'duo 안 시작 = 범위 0').toMatchObject({ rng: null, n: 0 });
    // 바깥 칸에서 시작 → duo 위에 놓기
    await setup(page, NEST);
    await drill(page, 1, 0);
    const n2 = await waitStableRect(page, '#gG .grd-cell[data-r="2"][data-c="1"] .grd-nested > .grd-nested-col');
    const c0 = await waitStableRect(page, cellSel(1, 0));
    await page.mouse.move(c0.cx, c0.cy); await page.mouse.down();
    await page.mouse.move(n2.cx, n2.cy, { steps: 8 }); await page.mouse.up();
    await expect.poll(() => G_(page), 'duo 위 = 바깥 (2,1)').toMatchObject({ rng: { r0: 1, c0: 0, r1: 2, c1: 1 }, name: 'A2:B3' });
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('T16 3px 미만 누르기 = 클릭 — 활성 줄이 그 칸으로 · 범위 0 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await drill(page, 1, 0);
    const l = await waitStableRect(page, lineSel(2, 1));
    await page.mouse.move(l.cx, l.cy); await page.mouse.down();
    await page.mouse.move(l.cx + 2, l.cy, { steps: 2 }); await page.mouse.up();
    await expect.poll(async () => { const s = await G_(page); return s.al && [Number(s.al.r), Number(s.al.c)]; }, '활성 줄 = B3').toEqual([2, 1]);
    expect(await G_(page)).toMatchObject({ rng: null, n: 0 });
    expect(errs, errs.join('\n')).toEqual([]);
  });
});

/* ══ U2b 이벨류에이터 D1~D4 고침 — 장면은 탐침 eval-u2b-probe(P5 · P1 · P12 · P8) 그대로 ══
 * ★D1 범위 클립이 최신인데 고른 그리드가 없으면 «알리고 끝»(옛 블럭 클립 떨어짐 0).
 * ★D2 GRID-CLIP-OS-NEWER-01 — 쓰기는 paste 이벤트에서 clipboardPrefersInternal 이 참일 때만 ⇒ OS 가 더 새로우면 칸 무변
 *   (이미지 = 스크래치 그림 1 · 글자 = 손 0). pressPaste 는 keydown 뒤 paste 를 «같은 evaluate 안에서» 보내므로
 *   범위 쓰기(동기)는 pressPaste 가 돌아올 때 이미 끝나 있다 — 무변 단언이 기다림 없이 결정적이다.
 * ★D3 selectBlock(gG)(MCP·삽입 길) = clearSelectionMarks ⇒ 범위·사각형 0.
 * ★D4 GRID-RANGE-DELETE-CUT-NOT-IMPL-01 — 범위 산 채 ⌫/⌘X = 삼키고 토스트 · 범위 없으면 옛 길(음성대조). */
const RANGE_KEY_TOAST = '칸 범위 지우기·잘라내기는 아직 안 돼요';
async function clickEmptyCanvas(page) {
  const pt = await page.evaluate(() => {
    const s = document.getElementById('sG').getBoundingClientRect();
    return { x: Math.min(window.innerWidth - 20, s.right + 60), y: s.top + 40 };
  });
  await clickAt(page, pt.x, pt.y, { sel: '#canvas-area, #canvas-wrap', not: '.section-block' }, { label: '빈 캔버스' });
  await page.waitForFunction(() => !document.querySelector('.grid-block.selected'));
}

test.describe('U2b 고침 D1~D4 @grid-reorder', () => {
  test('F1(D1) 블럭 ⌘C → 범위 ⌘C → 빈 캔버스 → ⌘V ⇒ 옛 블럭 클립 안 떨어짐(그리드 1) · «붙일 칸을 먼저 고르세요» @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    const b = await model(page);
    await selectGrid(page);
    await pressCopy(page);                                           // 옛 블럭 클립을 채운다
    expect(await toast(page), '[전제] 블럭 복사').not.toMatch(/칸|줄/);
    await clickEmptyCanvas(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B2');
    await pressCopy(page);
    expect(await toast(page), '[전제] 범위 복사').toMatch(/^칸 A2:B2/);
    await clickEmptyCanvas(page);
    await pressPaste(page);
    await expect.poll(() => toast(page), '알림').toBe('붙일 칸을 먼저 고르세요');
    expect(await grids(page), '옛 블럭 클립 떨어짐 0').toBe(1);
    expect((await model(page)).raw, 'gG 무변').toEqual(b.raw);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  for (const kind of ['image', 'text']) {
    test(`F2(D2) 범위 ⌘C → OS ${kind === 'image' ? '이미지' : '글자'} 복사(더 새로움) → 줄 A3 → ⌘V ⇒ 칸 무변 · ${kind === 'image' ? '스크래치 그림 1' : '스크래치 0 · 그리드 1'} @grid-reorder`, async ({ page }) => {
      const errs = await setup(page);
      await installOS(page);
      await drill(page, 1, 0);
      await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
      await expect.poll(async () => (await G_(page)).name).toBe('A2:B2');
      await pressCopy(page);
      await clickLine(page, 2, 0);
      const b = await model(page);
      const s0 = await page.evaluate(() => document.querySelectorAll('.scratch-item').length);
      await page.evaluate((k) => { window.__os = k === 'image' ? { text: null, image: true } : { text: '바깥에서 복사한 글', image: false }; }, kind);
      await pressPaste(page);
      expect((await model(page)).raw, '칸 무변(범위 쓰기는 paste 안에서 동기 — 여기서 이미 끝)').toEqual(b.raw);
      if (kind === 'image') {
        await expect.poll(() => page.evaluate(() => document.querySelectorAll('.scratch-item').length), 'OS 이미지 = 스크래치가 받는다').toBe(s0 + 1);
        expect((await model(page)).raw, '스크래치 뒤에도 칸 무변').toEqual(b.raw);
      } else {
        expect(await page.evaluate(() => document.querySelectorAll('.scratch-item').length), '스크래치 0').toBe(s0);
      }
      expect(await toast(page), '붙임 보고 0').not.toMatch(/붙임/);
      expect(await grids(page)).toBe(1);
      expect(errs, errs.join('\n')).toEqual([]);
    });
  }

  test('F3(D3) 범위 산 채 window.selectBlock(gG) ⇒ 범위·사각형 0 · 그 뒤 ⌘C = 블럭 복사(칸 토스트 0) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B2');
    await page.evaluate(() => window.selectBlock('gG'));
    expect(await G_(page), 'selectBlock 뒤').toMatchObject({ rng: null, n: 0, sel: true });
    await pressCopy(page);
    expect(await toast(page), '블럭 복사(칸·줄 토스트 0)').not.toMatch(/칸|줄/);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('F4(D4) 범위 산 채 ⌫ · Delete · ⌘X = 삼키고 알림(칸·블럭 무변 · 복사 0) · Esc 로 범위 풀면 ⌫ = 옛 길(음성대조) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await installOS(page);
    const b = await model(page);
    await drill(page, 1, 0);
    await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
    await expect.poll(async () => (await G_(page)).name).toBe('A2:B2');
    const t0 = await page.evaluate(() => window._internalClipboardTime || 0);
    for (const key of ['Backspace', 'Delete', 'Meta+x']) {
      await page.evaluate(() => { document.activeElement?.blur?.(); const t = document.getElementById('editor-toast'); if (t) t.textContent = ''; });
      await page.keyboard.press(key);
      await expect.poll(() => toast(page), `${key} 알림`).toBe(RANGE_KEY_TOAST);
      expect((await model(page)).raw, `${key} 칸 무변`).toEqual(b.raw);
      expect(await grids(page), `${key} 블럭 무변`).toBe(1);
      expect(await G_(page), `${key} 뒤 범위 그대로`).toMatchObject({ name: 'A2:B2', sel: true });
    }
    expect(await page.evaluate(() => window._internalClipboardTime || 0), '⌘X 블럭 복사 0').toBe(t0);
    // 음성대조 — 범위를 풀면 ⌫ 는 옛 길(활성 줄 지우기)
    await page.keyboard.press('Escape');
    await expect.poll(() => G_(page)).toMatchObject({ rng: null, n: 0, sel: true });
    await page.evaluate(() => { const t = document.getElementById('editor-toast'); if (t) t.textContent = ''; });
    await page.keyboard.press('Backspace');
    await expect.poll(async () => JSON.stringify((await model(page)).raw) !== JSON.stringify(b.raw), '범위 없음 = 옛 ⌫ 가 돈다').toBe(true);
    expect(await toast(page), '범위 알림 0').not.toBe(RANGE_KEY_TOAST);
    expect(errs, errs.join('\n')).toEqual([]);
  });
});

/* ══ U2b 재평가 고침 — 결함1(무장 잔존) · 결함2(:574 편집 칸 가드 · :575 stamp 재확인 시험 공백) ══
 *   장면 = 재평가 탐침 eval2-u2b-probe(P1 · P2 · P4) 그대로 + 키 누름 «안»의 장면 둘.
 * ★결함1 — 무장은 «이번 키 누름 한 번»: keydown 을 안 거친 paste(메뉴 «붙여넣기» = paste 만) = 범위 손 0(블럭·줄 클립과 같다).
 *   풂 = 다음 keydown·mousedown(capture) · 맥 Control+v = 무장 0(paste 를 안 낳는다 — 실측 P2 · [전제]로 다시 잰다).
 * ★결함2 — ⌘V keydown 과 paste «사이»(같은 키 누름 흐름)에 끼는 일: ① 고디터 복사(copySelected) ⇒ stamp 재확인이 막는다 ·
 *   ② 포커스가 입력칸으로 ⇒ 편집 칸 가드가 막는다. 사람 손의 «다음 누르기·키»는 결함1 풂이 먼저 막으므로 이 둘은 «한 evaluate 안»
 *   (keydown → 끼는 일 → paste)으로만 선다 — 다른 keydown 처리기·자동화(MCP)가 키 누름 안에서 하는 일의 대역(해석).
 * ★변이(형제 사본 · GD1001_ROOT): nofix1(풂 리스너·맥 Control+v 규칙 뺌) ⇒ G1 셋 빨강 · noguard(:574/:575 뺌) ⇒ G2 둘 빨강. */
const gKeyOnly = (page) => page.evaluate(() => {
  document.activeElement?.blur?.();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true, cancelable: true }));
});
/** 메뉴 «붙여넣기» 대역 — keydown 없이 paste 만(OS 글자 = window.__os). */
const gPasteOnly = (page) => page.evaluate(() => {
  const t = document.getElementById('editor-toast'); if (t) t.textContent = '';
  const dt = new DataTransfer();
  if (window.__os.text !== null) dt.setData('text/plain', window.__os.text);
  (document.activeElement || document).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
async function gRangeCopiedAtA3(page) {
  await installOS(page);
  await drill(page, 1, 0);
  await dragRange(page, { r: 1, c: 0 }, { r: 1, c: 1 });
  await expect.poll(async () => (await G_(page)).name).toBe('A2:B2');
  await pressCopy(page);
  expect(await toast(page), '[전제] 범위 복사').toMatch(/^칸 A2:B2/);
  await clickLine(page, 2, 0);
}

test.describe('U2b 재평가 고침 결함1·결함2 @grid-reorder', () => {
  for (const via of ['mousedown', 'keydown']) {
    test(`G1-${via} ⌘V keydown 만 → ${via === 'mousedown' ? '줄 B3 진짜 클릭(선택 바꿈)' : '다른 키(Shift 진짜)'} → paste 만(메뉴) ⇒ 칸 무변 · 붙임 0 @grid-reorder`, async ({ page }) => {
      const errs = await setup(page);
      await gRangeCopiedAtA3(page);
      await gKeyOnly(page);
      if (via === 'mousedown') await clickLine(page, 2, 1);
      else await page.keyboard.press('Shift');
      const b = await model(page);
      await gPasteOnly(page);
      expect((await model(page)).raw, '칸 무변(쓰기는 paste 안에서 동기 — 여기서 이미 끝)').toEqual(b.raw);
      expect(await toast(page), '붙임 보고 0').not.toMatch(/붙임/);
      expect(await grids(page)).toBe(1);
      expect(errs, errs.join('\n')).toEqual([]);
    });
  }

  test('G1-ctrl Control+v(맥 · 진짜 키) → paste 만(메뉴) ⇒ 칸 무변 · 그리드 1 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await gRangeCopiedAtA3(page);
    await page.evaluate(() => { window.__pc = 0; document.addEventListener('paste', () => { window.__pc++; }, true); document.activeElement?.blur?.(); });
    const b = await model(page);
    await page.keyboard.press('Control+v');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    expect(await page.evaluate(() => window.__pc), '[전제] 맥 Control+v 는 paste 를 안 낳는다(eval2 P2)').toBe(0);
    expect((await model(page)).raw, '키만으로 칸 무변').toEqual(b.raw);
    await gPasteOnly(page);
    expect((await model(page)).raw, '뒤의 메뉴 paste 도 칸 무변').toEqual(b.raw);
    expect(await toast(page), '붙임 보고 0').not.toMatch(/붙임/);
    expect(await grids(page), '옛 블럭 클립 떨어짐 0').toBe(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('G1-pos ⌘V keydown + paste(한 키 누름) ⇒ 붙는다(A3:B3 = 옛 A2:B2 · 양성 유지) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await gRangeCopiedAtA3(page);
    const b = await model(page);
    await pressPaste(page);
    await expect.poll(() => toast(page)).toBe('A3 에 칸 2개 붙임');
    const a = await model(page);
    expect([a.m.cells[2][0], a.m.cells[2][1]], 'A3:B3 = 옛 A2:B2(칸 통째)').toEqual([b.m.cells[1][0], b.m.cells[1][1]]);
    expect([a.m.cells[2][2], a.m.cells[0], a.m.cells[1]], 'C3 · 행 1·2 무변').toEqual([b.m.cells[2][2], b.m.cells[0], b.m.cells[1]]);
    expect(await grids(page)).toBe(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('G2-F① ⌘V keydown → (같은 키 누름 안) 블럭 복사 copySelected → paste ⇒ 범위 0(칸 무변) · stamp 재확인 @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await gRangeCopiedAtA3(page);
    const b = await model(page);
    const t0 = await page.evaluate(() => window._internalClipboardTime || 0);
    const t1 = await page.evaluate(() => {
      document.activeElement?.blur?.();
      const t = document.getElementById('editor-toast'); if (t) t.textContent = '';
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true, cancelable: true }));
      window.copySelected();   // 키 누름 «안»에서 낀 고디터 복사(다른 처리기·자동화 대역)
      const dt = new DataTransfer();
      if (window.__os.text !== null) dt.setData('text/plain', window.__os.text);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      return window._internalClipboardTime || 0;
    });
    expect(t1, '[전제] 블럭 복사가 끼었다(stamp 바뀜)').not.toBe(t0);
    expect((await model(page)).raw, '칸 무변').toEqual(b.raw);
    expect(await toast(page), '붙임 보고 0').not.toMatch(/붙임/);
    expect(await grids(page)).toBe(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('G2-F② ⌘V keydown → (같은 키 누름 안) 입력칸 포커스 → 그 칸에 paste ⇒ 칸 무변 · 무장도 끝(뒤 paste 만 = 무변) @grid-reorder', async ({ page }) => {
    const errs = await setup(page);
    await gRangeCopiedAtA3(page);
    const b = await model(page);
    const r = await page.evaluate(() => {
      document.activeElement?.blur?.();
      const i = document.createElement('input'); i.id = '__g2in'; document.body.appendChild(i);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true, cancelable: true }));
      i.focus();
      const dt = new DataTransfer();
      if (window.__os.text !== null) dt.setData('text/plain', window.__os.text);
      i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      return { focused: document.activeElement === i };
    });
    expect(r.focused, '[전제] paste 순간 포커스 = 입력칸').toBe(true);
    expect((await model(page)).raw, '칸 무변').toEqual(b.raw);
    await page.evaluate(() => { document.getElementById('__g2in')?.remove(); });
    await gPasteOnly(page);
    expect((await model(page)).raw, '뒤 paste 만 = 칸 무변').toEqual(b.raw);
    expect(errs, errs.join('\n')).toEqual([]);
  });
});
