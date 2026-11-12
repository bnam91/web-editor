/* grid-merge-paste-0912.dom.spec.js — 0.9.12 ⑥ GRID-MERGE-COPY-PASTE-SHAPE-01 (그리드 범위 복붙 때 병합 모양째 옮기기)
 *   이번 판 범위 = «단순한 경우»만: 붙일 자리가 그리드 안에 통째로 들고 · 그 자리에 기존 병합이 하나도 안 걸칠 때.
 *   현빈 결정(0.9.12 «엑셀/스프레드시트와 같게»): 넘침 = 시트처럼 행·열을 늘림(상한 8×8) · 기존 병합의 가려진 칸 «일부»에 걸치면 = 엑셀처럼 통째 거절.
 * 길(진짜 손): 드릴 C... → 칸 끌기 → ⌘M(병합) → ⌘C → 줄 클릭 → ⌘V(keydown ＋ paste 이벤트 · grid-range-clip.dom 의 가짜 OS 꼴)
 *   P1 빈 자리(B1:C1)에 1×2 병합째 붙이기 — merges 에 새 병합 · 칸 수 9→7 · 앵커 상자 = 두 열 넓이 · 옆 그리드 무변
 *   P2 ⌘Z 한 번 = 붙이기 전(병합 하나) dataset 바이트 그대로
 *   P3 저장 왕복(serializeProject → 다시 띄움 → applyProjectData) — merges·칸 수·앵커 상자 같음
 *   N1 넘침(C2 에 1×2) — 열을 늘려 2칸 · 병합째 · ⌘Z 한 번 = 3×3
 *   N2 B2 에 2×1(B3 = 기존 병합의 가려진 칸) — 거절 토스트 · 모델 바이트 그대로
 *   N3 A2 에 2×1(A3 = 기존 병합의 앵커만) — 거절(엑셀 · 지디 Q8 채점) · N4 A3 에 1×2(병합 통째 덮음) — 붙음 · 병합 유지
 * 양성대조(지디 인텔): grid-block.js pasteGridRange 의 `if (res.merges) _gridSetMerges(block, res.merges);` 한 줄 지우면 P1·P2·P3 빨강(N1 초록) /
 *   gridCopyRange 의 `if (mg.length) out.merges = mg;` 지워도 P1·P2·P3 빨강 /
 *   gridPasteRange 의 R·C 를 R0·C0 로 되돌리면(늘림 끔) N1 빨강 / `refused: 'merge'` return 줄을 지우면 N2·N3 빨강 / 그 줄 조건에 `&& coversHid` 옛 꼴(가려진 칸 걸칠 때만)로 되돌리면 N3 만 빨강(N2·N4 초록). */
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
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="병합복붙"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;">
<div class="gap-block" data-type="gap" style="height:80px"></div>
<div class="row" id="rT"><div class="text-block" id="tT" data-type="text"><div class="tb-h2">복붙 위 제목</div></div></div>
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="16"></div></div>
<div class="row" id="rT2"><div class="text-block" id="tT2" data-type="text"><div class="tb-body">복붙 아래 본문</div></div></div>
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
    window.__os = { text: null };
    window.electronAPI = new Proxy({}, { get: (_t, k) => k === 'clipboardWriteText'
      ? (txt) => { window.__os = { text: String(txt) }; return Promise.resolve({ ok: true }); } : () => Promise.resolve(null) });
    const t = document.getElementById('editor-toast'); if (t) t.textContent = '';
  }, [SEC, SCENE]);
  await waitStableRect(page, '#gG');
  return errs;
}
const cellSel = (r, c) => `#gG > .grd-inner > .grd-cell[data-r="${r}"][data-c="${c}"]`;
const lineSel = (r, c, li = 0) => `#gG [data-r="${r}"][data-c="${c}"][data-line="${li}"]`;
async function selectGrid(page) {
  const c = await waitStableRect(page, cellSel(1, 2));
  await clickAt(page, c.cx, c.cy, { sel: 'div#gG' }, { label: '그리드 고르기' });
  await page.waitForFunction(() => document.getElementById('gG').classList.contains('selected'));
}
async function clickLine(page, r, c) {
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
async function pressCopy(page) {
  await page.evaluate(() => { document.activeElement?.blur?.(); window.__t0 = window._internalClipboardTime || 0; });
  await page.keyboard.press('Meta+c');
  await page.waitForFunction(() => (window._internalClipboardTime || 0) !== window.__t0);
}
async function pressPaste(page) {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    const t = document.getElementById('editor-toast'); if (t) t.textContent = '';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true, cancelable: true }));
    const dt = new DataTransfer();
    if (window.__os.text !== null) dt.setData('text/plain', window.__os.text);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
}
const model = (page, id = 'gG') => page.evaluate((id) => {
  const g = document.getElementById(id); const m = window.getGridModel(g);
  return { merges: g.dataset.merges ?? null, text: m.cells.map(r => r.map(c => (c.lines || []).map(l => l.text).join('+'))),
    n: g.querySelectorAll(':scope > .grd-inner > .grd-cell').length,
    raw: JSON.stringify({ cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null, merges: g.dataset.merges ?? null }) };
}, id);
/** 앵커 상자 vs 덮어야 할 트랙 상자(블럭 기준) — 트랙 끝은 그 열(행)의 한 칸짜리 칸에서 잰다. */
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
const MERGED = '[{"r":2,"c":0,"rs":1,"cs":2}]';
const BOTH = '[{"r":2,"c":0,"rs":1,"cs":2},{"r":0,"c":1,"rs":1,"cs":2}]';

/** A3:B3 를 ⌘M 으로 합치고(1×2) 그 범위 그대로 ⌘C — 이력은 비운다(⌘Z 가 붙이기만 되돌리는지 보려고). */
async function mergeAndCopy(page) {
  await selectGrid(page);
  await clickLine(page, 2, 0);
  await dragRange(page, { r: 2, c: 0 }, { r: 2, c: 1 });
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG')))).toEqual({ r0: 2, c0: 0, r1: 2, c1: 1 });
  await page.keyboard.press('Meta+m');
  await expect.poll(async () => (await model(page)).merges).toBe(MERGED);
  await pressCopy(page);
  await page.evaluate(() => window.clearHistory?.());
}

test('P1 빈 자리(B1:C1)에 1×2 병합째 붙이기 — 새 병합 · 칸 9→7 · 앵커 = 두 열 넓이 · 옆 그리드 무변', async ({ page }) => {
  const errs = await setup(page);
  await mergeAndCopy(page);
  await clickLine(page, 0, 1);
  await pressPaste(page);
  await expect.poll(() => toast(page)).toMatch(/B1 에 칸 2개 붙임/);
  const m = await model(page);
  expect(m.merges).toBe(BOTH);
  expect(m.text).toEqual([['A1+A1-sub', 'A3', ''], ['A2', 'B2+B2-h', 'C2'], ['A3', '', 'C3']]);
  expect(m.n, '가려진 칸 둘(B3 · C1)은 안 그린다').toBe(7);
  const b = await spanBox(page, { r: 0, c: 1, rs: 1, cs: 2 });
  console.log('GMP0912 P1 ' + JSON.stringify(b));
  for (const k of ['x', 'y', 'w', 'h']) expect(close(b.a[k], b.want[k]), `앵커 ${k} ${b.a[k]} vs ${b.want[k]}`).toBe(true);
  expect((await model(page, 'gH')).n, '옆 섹션 그리드 무변').toBe(9);
  expect((await model(page, 'gH')).merges).toBeNull();
  expect(errs).toEqual([]);
});

test('P2 ⌘Z 한 번 = 붙이기 전(병합 하나) dataset 바이트 그대로', async ({ page }) => {
  const errs = await setup(page);
  await mergeAndCopy(page);
  const before = await model(page);
  await clickLine(page, 0, 1);
  await pressPaste(page);
  await expect.poll(async () => (await model(page)).merges).toBe(BOTH);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await model(page)).raw).toBe(before.raw);
  expect((await model(page)).merges).toBe(MERGED);
  expect((await model(page)).n).toBe(8);
  expect(errs).toEqual([]);
});

test('P3 저장 왕복 — merges·칸 수·앵커 상자 같음', async ({ page }) => {
  await setup(page);
  await mergeAndCopy(page);
  await clickLine(page, 0, 1);
  await pressPaste(page);
  await expect.poll(async () => (await model(page)).merges).toBe(BOTH);
  const m0 = await model(page);
  const b0 = await spanBox(page, { r: 0, c: 1, rs: 1, cs: 2 });
  const snap = await page.evaluate(() => window.serializeProject());
  const errs = await bootApp(page);
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  await waitStableRect(page, '#gG');
  const m1 = await model(page);
  expect(m1.raw).toBe(m0.raw);
  expect(m1.n).toBe(7);
  const b1 = await spanBox(page, { r: 0, c: 1, rs: 1, cs: 2 });
  console.log('GMP0912 P3 ' + JSON.stringify({ b0, b1 }));
  for (const k of ['x', 'y', 'w', 'h']) expect(close(b1.a[k], b0.a[k]), `다시 연 앵커 ${k}`).toBe(true);
  expect(errs).toEqual([]);
});

test('N1 넘침(C2 에 1×2) — 시트처럼 열을 늘려 병합째 붙인다(0.9.12 ⑥ 현빈 결정)', async ({ page }) => {
  const errs = await setup(page);
  await mergeAndCopy(page);
  await clickLine(page, 1, 2);
  await pressPaste(page);
  await expect.poll(() => toast(page)).toMatch(/C2 에 칸 2개 붙임$/);
  const m = await model(page);
  expect(m.merges).toBe('[{"r":2,"c":0,"rs":1,"cs":2},{"r":1,"c":2,"rs":1,"cs":2}]');
  expect(m.text[1]).toEqual(['A2', 'B2+B2-h', 'A3', '']);
  expect(m.n, '3×4 = 12 − 가려진 칸 둘(B3 · D2)').toBe(10);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await model(page)).n, '⌘Z 한 번 = 3×3 · 병합 하나').toBe(8);
  expect((await model(page)).merges).toBe(MERGED);
  expect(errs).toEqual([]);
});

test('N2 기존 병합(A3:B3)의 가려진 칸 일부에 걸치는 붙이기 = 통째 거절(엑셀) · 모델 바이트 그대로', async ({ page }) => {
  const errs = await setup(page);
  await mergeAndCopy(page);
  await clickLine(page, 1, 2);
  await dragRange(page, { r: 1, c: 2 }, { r: 2, c: 2 });
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG')))).toEqual({ r0: 1, c0: 2, r1: 2, c1: 2 });
  await pressCopy(page);
  const before = await model(page);
  await clickLine(page, 1, 1);                         // B2 에 2×1 ⇒ B2·B3 — B3 은 A3:B3 의 가려진 칸
  await pressPaste(page);
  await expect.poll(() => toast(page)).toMatch(/병합된 칸의 일부에는 붙일 수 없어요/);
  expect((await model(page)).raw).toBe(before.raw);
  expect(errs).toEqual([]);
});

test('N3 기존 병합(A3:B3)의 «앵커 A3 만» 걸치는 붙이기도 통째 거절(엑셀 — 지디 Q8 실앱 채점) · 모델 바이트 그대로', async ({ page }) => {
  const errs = await setup(page);
  await mergeAndCopy(page);
  await clickLine(page, 1, 2);
  await dragRange(page, { r: 1, c: 2 }, { r: 2, c: 2 });
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG')))).toEqual({ r0: 1, c0: 2, r1: 2, c1: 2 });
  await pressCopy(page);
  const before = await model(page);
  await clickLine(page, 1, 0);                         // A2 에 2×1 ⇒ A2·A3 — A3 = A3:B3 의 앵커(가려진 칸 B3 은 안 덮음)
  await pressPaste(page);
  await expect.poll(() => toast(page)).toMatch(/병합된 칸의 일부에는 붙일 수 없어요/);
  expect((await model(page)).raw, 'A3 글이 덮이지 않았다').toBe(before.raw);
  expect(errs).toEqual([]);
});

test('N4 기존 병합(A3:B3)을 «통째로» 덮는 붙이기 = 붙는다(거절 아님 · 옛 동작 — 앵커만 쓰고 병합 유지)', async ({ page }) => {
  const errs = await setup(page);
  await mergeAndCopy(page);
  await clickLine(page, 0, 1);
  await dragRange(page, { r: 0, c: 1 }, { r: 0, c: 2 });
  await expect.poll(() => page.evaluate(() => window.grdGetRange(document.getElementById('gG')))).toEqual({ r0: 0, c0: 1, r1: 0, c1: 2 });
  await pressCopy(page);
  await clickLine(page, 2, 0);                         // A3 에 1×2 ⇒ A3:B3 통째
  await pressPaste(page);
  await expect.poll(() => toast(page)).toMatch(/A3 에 칸 1개 붙임/);
  const m = await model(page);
  expect(m.text[2][0]).toBe('B1');
  expect(m.merges).toBe(MERGED);
  expect(errs).toEqual([]);
});
