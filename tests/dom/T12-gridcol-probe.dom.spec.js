/* T12-gridcol-probe — ★P단계 «측정 전용» 스펙. ⛔제품 코드 0줄 · ⛔커밋 대상 아님.
 * 판 = DEVPIN 4b36eb56759726f6a698772db8b697b6442a0f5a (gd/gridcol).
 * 재는 것 — ❓⑴ 렌더러가 «열마다 다른 높이»를 실제로 그리나(px)
 *           ❓⑵ 2×2(rows/cells) → 열 스택(cols[c].lines) «변환기»가 있나(행위로)
 *           ❓⑶ 그 변환의 «손실» — 칸 전용 / 줄 전용 필드를 «정의 자리»에서 이름으로
 *           ❓⑷ #sp_cqjuuu(좌 482/345 · 우 345/481) 가 «현 모델»로 나오나
 * 각 시험은 ★전제 단언 + ★양성대조(자가 눈이 보이나) 를 갈라 세운다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SCENE = '<div class="section-block" id="cS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="cI"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="cR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>';

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1600 });
  const errs = await bootApp(page);
  await page.evaluate((S) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', S);
  }, SCENE);
  return errs;
}

async function mkGrid(page, conf) {
  return page.evaluate((conf) => {
    const { block: g } = window.makeGridBlock(conf);
    g.id = 'cG'; document.getElementById('cR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100);
    return { id: g.id, cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null };
  }, conf);
}

const cellRects = (page) => page.evaluate(() => {
  const g = document.getElementById('cG');
  const inner = g.querySelector('.grd-inner');
  const out = {};
  g.querySelectorAll('.grd-cell').forEach(el => {
    const r = el.getBoundingClientRect();
    out[`r${el.dataset.r}c${el.dataset.c}`] = { h: Math.round(r.height * 100) / 100, lay: el.offsetHeight, top: Math.round(r.top * 100) / 100 };
  });
  const anyCell = g.querySelector('.grd-cell');
  const vis = anyCell.getBoundingClientRect().height, lay = anyCell.offsetHeight;
  const scale = lay > 0 ? Math.round((vis / lay) * 10000) / 10000 : 1;
  const chain = [];
  for (let n = anyCell; n && n !== document.documentElement; n = n.parentElement) {
    const t = getComputedStyle(n).transform;
    if (t && t !== 'none') chain.push({ el: n.id || n.className, t });
  }
  return { cells: out, scaleChain: chain, scale, tmplRows: inner.style.gridTemplateRows, tmplCols: inner.style.gridTemplateColumns, innerH: Math.round(inner.getBoundingClientRect().height * 100) / 100, zoom: window.currentZoom ?? window.zoom ?? null };
});

const L = (t) => [{ type: 'body', text: t }];

/* ══════════ q1 ══════════ */

test('(1)-A premise + positive control — the px ruler does see a row-height difference', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, { cols: [{ width: 1, lines: L('A0') }, { width: 1, lines: L('B0') }], rows: [{ height: 120 }, { height: 300 }] });
  const m = await cellRects(page);
  console.log('### Q1A ' + JSON.stringify(m));
  // premise 1 — the emitted track list is ONE list for the whole block (count by top-level commas/minmax, not whitespace)
  const nTracks = (s) => (s.match(/minmax\([^)]*\)|(?:^|\s)(?:auto|[\d.]+(?:px|fr|%))(?=\s|$)/g) || []).length;
  expect(nTracks(m.tmplRows), `tmplRows=${m.tmplRows}`).toBe(2);
  expect(nTracks(m.tmplCols), `tmplCols=${m.tmplCols}`).toBe(2);
  // premise 2 — the measuring scale (canvas zoom) is pinned and known, so the px below mean something
  expect(m.scale, `canvas scale ${m.scale} (zoom=${m.zoom})`).toBeGreaterThan(0);
  expect(m.cells.r0c0.h, JSON.stringify(m)).not.toBe(m.cells.r1c0.h);
  expect(m.cells.r0c0.lay, `r0 layout px (visual ${m.cells.r0c0.h}, scale ${m.scale}, chain ${JSON.stringify(m.scaleChain)})`).toBe(120);
  expect(m.cells.r1c0.lay, `r1 layout px (visual ${m.cells.r1c0.h}, scale ${m.scale})`).toBe(300);
  expect(errs).toEqual([]);
});

test('(1)-B main assertion — the two columns of a row always share one height', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, {
    cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] },
           { width: 1, lines: [{ type: 'body', text: 'B' }, { type: 'body', text: 'B' }, { type: 'body', text: 'B' }, { type: 'body', text: 'B' }, { type: 'body', text: 'B' }, { type: 'body', text: 'B' }] }],
    rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [[{}, {}], [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }, { type: 'body', text: 'D' }, { type: 'body', text: 'D' }] }]],
  });
  const m = await cellRects(page);
  console.log('### Q1B ' + JSON.stringify(m));
  expect(m.cells.r0c0.h, `row0 two cols ${JSON.stringify(m.cells)}`).toBe(m.cells.r0c1.h);
  expect(m.cells.r1c0.h, `row1 two cols ${JSON.stringify(m.cells)}`).toBe(m.cells.r1c1.h);
  expect(m.cells.r1c0.top).toBe(m.cells.r1c1.top);
  expect(errs).toEqual([]);
});

test('(1)-C model — no door accepts a per-cell / per-column height (API rejects)', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, { cols: [{ width: 1, lines: L('A') }, { width: 1, lines: L('B') }], rows: [{ height: 120 }, { height: 300 }] });
  const r = await page.evaluate(() => ({
    patchCellHeight: window.updateGridBlock('cG', { patchCell: { r: 0, c: 0, height: 200 } }),
    patchColHeight: window.updateGridBlock('cG', { patchCol: { index: 0, height: 200 } }),
    patchColRows: window.updateGridBlock('cG', { patchCol: { index: 0, rows: [{ height: 200 }] } }),
    neg_patchCellBg: window.updateGridBlock('cG', { patchCell: { r: 0, c: 0, bg: '#eeeeee' } }),
    neg_rows: window.updateGridBlock('cG', { rows: [{ height: 140 }, { height: 300 }] }),
  }));
  console.log('### Q1C ' + JSON.stringify(r));
  expect(r.patchCellHeight.ok, JSON.stringify(r.patchCellHeight)).toBe(false);
  expect(r.patchColHeight.ok, JSON.stringify(r.patchColHeight)).toBe(false);
  expect(r.patchColRows.ok, JSON.stringify(r.patchColRows)).toBe(false);
  expect(r.neg_patchCellBg.ok, JSON.stringify(r.neg_patchCellBg)).toBe(true);
  expect(r.neg_rows.ok, JSON.stringify(r.neg_rows)).toBe(true);
  expect(errs).toEqual([]);
});

test('(1)-D array height per column — rejected or silently swallowed?', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, { cols: [{ width: 1, lines: L('A') }, { width: 1, lines: L('B') }], rows: [{ height: 120 }, { height: 300 }] });
  const r = await page.evaluate(() => {
    const res = window.updateGridBlock('cG', { rows: [{ height: [120, 300] }, { height: 300 }] });
    return { res, rowsAfter: document.getElementById('cG').dataset.rows, tmpl: document.getElementById('cG').querySelector('.grd-inner').style.gridTemplateRows };
  });
  console.log('### Q1D ' + JSON.stringify(r));
  expect(typeof r.res.ok).toBe('boolean');
  expect(errs).toEqual([]);
});

/* ══════════ q2 ══════════ */

test('(2)-A positive control + main — rows 2->1 via the public door is DISCARD, not convert', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, {
    cols: [{ width: 1, lines: [{ type: 'body', text: 'MARK_R0C0' }] }, { width: 1, lines: [{ type: 'body', text: 'MARK_R0C1' }] }],
    rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [[{ bg: '#111111' }, {}],
            [{ lines: [{ type: 'body', text: 'MARK_R1C0' }], bg: '#ff0000', padding: 7 },
             { lines: [{ type: 'body', text: 'MARK_R1C1' }], radius: 9 }]],
  });
  const MARKS = ['MARK_R0C0', 'MARK_R0C1', 'MARK_R1C0', 'MARK_R1C1'];
  const probe = () => page.evaluate((MARKS) => {
    const g = document.getElementById('cG');
    const dom = g.outerHTML, ds = JSON.stringify({ cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null });
    const o = {};
    for (const m of MARKS) o[m] = { dom: dom.includes(m), data: ds.includes(m) };
    return { marks: o, dataset: ds };
  }, MARKS);

  const before = await probe();
  for (const m of MARKS) expect(before.marks[m], `before ${m}`).toEqual({ dom: true, data: true });

  const res = await page.evaluate(() => window.updateGridBlock('cG', { rows: [{ height: 'auto' }] }));
  const after = await probe();
  console.log('### Q2A res=' + JSON.stringify(res) + ' after=' + JSON.stringify(after.marks) + ' ds=' + after.dataset);

  expect(after.marks.MARK_R0C0).toEqual({ dom: true, data: true });
  expect(after.marks.MARK_R0C1).toEqual({ dom: true, data: true });
  expect(after.marks.MARK_R1C0, 'if row1 survived, a converter exists').toEqual({ dom: false, data: false });
  expect(after.marks.MARK_R1C1).toEqual({ dom: false, data: false });
  expect(errs).toEqual([]);
});

test('(2)-B other doors — column shrink is not a convert either; is there a notifier?', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, {
    cols: [{ width: 1, lines: [{ type: 'body', text: 'MK_A' }] }, { width: 1, lines: [{ type: 'body', text: 'MK_B' }] }],
    rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [[{}, {}], [{ lines: [{ type: 'body', text: 'MK_C' }] }, { lines: [{ type: 'body', text: 'MK_D' }] }]],
  });
  const r = await page.evaluate(() => {
    const out = {};
    out.colShrink = window.updateGridBlock('cG', { cols: [{ width: 1, lines: [{ type: 'body', text: 'MK_A' }] }] });
    const g = document.getElementById('cG');
    out.after = { cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null };
    out.retKeys = Object.keys(out.colShrink);
    return out;
  });
  console.log('### Q2B ' + JSON.stringify(r).slice(0, 3000));
  const txt = JSON.stringify(r.after);
  expect(txt.includes('MK_A')).toBe(true);
  expect(txt.includes('MK_B'), 'if MK_B survived, that is a convert').toBe(false);
  expect(txt.includes('MK_D')).toBe(false);
  expect(errs).toEqual([]);
});

test('(2)-C primitive — is patchCell{lines} round-trip lossless for LINE content?', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, {
    cols: [{ width: 1, lines: [{ type: 'body', text: 'X' }] }, { width: 1, lines: [{ type: 'body', text: 'Y' }] }],
    rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [[{}, {}], [{ lines: [{ type: 'h2', text: 'MOVED', fontSize: 33, color: '#123456', weight: 700, marginTop: 11 }] }, {}]],
  });
  const r = await page.evaluate(() => {
    const G = window.getGridModel(document.getElementById('cG'));
    const src = G.cells[1][0].lines;
    const dst = G.cells[0][0].lines;
    const r1 = window.updateGridBlock('cG', { patchCell: { r: 0, c: 0, lines: [...dst, ...src] } });
    const r2 = window.updateGridBlock('cG', { patchCell: { r: 1, c: 0, lines: [] } });
    const after = window.getGridModel(document.getElementById('cG'));
    return { r1ok: r1.ok, r1: r1, r2ok: r2.ok, srcLine: src[0], gotLine: after.cells[0][0].lines[1] };
  });
  console.log('### Q2C ' + JSON.stringify(r));
  expect(r.r1ok).toBe(true);
  expect(r.r2ok).toBe(true);
  expect(r.gotLine, `src=${JSON.stringify(r.srcLine)} got=${JSON.stringify(r.gotLine)}`).toEqual(r.srcLine);
  expect(errs).toEqual([]);
});

/* ══════════ q3 ══════════ */

test('(3) field census read at the DEFINITION site, at runtime', async ({ page }) => {
  const errs = await scene(page);
  const r = await page.evaluate(async () => {
    const M = await import('/js/blocks/grid-block.js');
    const CELL = [...M.GRID_CELL_FIELDS].sort();
    const LINE = [...M.GRID_LINE_FIELDS].sort();
    return {
      CELL, LINE,
      cellOnly: CELL.filter(k => !LINE.includes(k)),
      lineOnly: LINE.filter(k => !CELL.includes(k)),
      both: CELL.filter(k => LINE.includes(k)),
      counts: { cell: CELL.length, line: LINE.length },
      MAX: { MIN_COLS: M.MIN_COLS, MAX_COLS: M.MAX_COLS, MIN_ROWS: M.MIN_ROWS, MAX_ROWS: M.MAX_ROWS, MAX_CELL_LINES: M.MAX_CELL_LINES },
      NESTED: M.GRID_NESTED_LINE_TYPE,
      COLF: M.GRID_DEFAULTS ? Object.keys(M.GRID_DEFAULTS) : null,
    };
  });
  console.log('### Q3 FIELD-CENSUS ' + JSON.stringify(r));
  expect(r.counts.cell).toBeGreaterThan(0);
  expect(r.counts.line).toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('(3)-B .grd-children axis — where do nested child blocks go on a shrink?', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, {
    cols: [{ width: 1, lines: L('A') }, { width: 1, lines: L('B') }],
    rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [[{}, {}], [{ lines: L('C') }, { lines: L('D') }]],
  });
  const r = await page.evaluate(() => {
    const g = document.getElementById('cG');
    const box = document.createElement('div');
    box.className = 'grd-children';
    box.innerHTML = '<div class="text-block" data-type="text" id="kid1">KID_MARK</div>';
    g.appendChild(box);
    const before = { kid: !!g.querySelector('#kid1'), txt: g.outerHTML.includes('KID_MARK') };
    const res = window.updateGridBlock('cG', { rows: [{ height: 'auto' }] });
    const afterRows = { kid: !!g.querySelector('#kid1'), txt: g.outerHTML.includes('KID_MARK') };
    const res2 = window.updateGridBlock('cG', { cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }] });
    const afterCols = { kid: !!g.querySelector('#kid1'), txt: g.outerHTML.includes('KID_MARK') };
    return { before, afterRows, afterCols, res: res.ok, res2: res2.ok };
  });
  console.log('### Q3B CHILDREN ' + JSON.stringify(r));
  expect(r.before.kid).toBe(true);
  expect(errs).toEqual([]);
});

/* ══════════ q4  #sp_cqjuuu ══════════ */

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('(4) #sp_cqjuuu reproduction — 1 row x 2 cols with per-column lines: left 482/345, right 345/481', async ({ page }) => {
  const errs = await scene(page);
  const out = [];
  for (const cropped of [true, false]) {
    await page.evaluate(() => { const g = document.getElementById('cG'); if (g) g.remove(); });
    await mkGrid(page, { gap: 18, cols: [{ width: 1, lines: [{ type: 'body', text: 'tmp' }] }, { width: 1, lines: [{ type: 'body', text: 'tmp' }] }], rows: [{ height: 'auto' }] });
    const res = await page.evaluate(([cropped, PX]) => {
      const img = (h) => cropped
        ? { type: 'image', imgSrc: PX, height: h, imgSizePct: 100, imgPosX: 0, imgPosY: 0 }
        : { type: 'image', imgSrc: PX, height: h };
      return window.updateGridBlock('cG', { cols: [
        { width: 1, lines: [img(482), { type: 'gap', height: 18 }, img(345)] },
        { width: 1, lines: [img(345), { type: 'gap', height: 18 }, img(481)] },
      ] });
    }, [cropped, PX]);
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const g = document.getElementById('cG');
      const o = [];
      g.querySelectorAll('.grd-cell').forEach(el => {
        const parts = [...el.children].filter(n => n.nodeType === 1).map(f => ({ cls: f.className, lay: f.offsetHeight }));
        o.push({ c: el.dataset.c, cellLay: el.offsetHeight, parts });
      });
      const a = g.querySelector('.grd-cell');
      const scale = a.offsetHeight > 0 ? Math.round((a.getBoundingClientRect().height / a.offsetHeight) * 10000) / 10000 : 1;
      return { cells: o, scale, tmplRows: g.querySelector('.grd-inner').style.gridTemplateRows, blockLay: g.offsetHeight, colW: a.offsetWidth };
    });
    out.push({ cropped, ok: res.ok, m });
    console.log(`### Q4 cropped=${cropped} ok=${res.ok} ` + JSON.stringify(m));
  }
  expect(out.length).toBe(2);
  expect(errs).toEqual([]);
});

/* ══════════ ★G 전 관문 둘 (지디 지시 2026-10-07) ══════════ */

/* 관문 #4 — undo. ★「⌘Z 를 눌러 봤다」가 아니라 ★«히스토리 칸 수»로 재라.
 *   세 꼴을 가른다: ⑴ 칸이 안 쌓임(push-before 끊김) ⑵ 칸이 둘 쌓임 ⑶ 한 칸(정답).
 *   ⚠️`ensureHistoryCheckpoint` 가 undo 첫머리에서 한 칸을 구해 줄 수 있어, «행위»만 보면 거짓 초록이 난다. */
test('(G4) undo — rows 2->1 is ONE history slot and one ⌘Z brings all four markers back', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, {
    cols: [{ width: 1, lines: [{ type: 'body', text: 'UMARK_R0C0' }] }, { width: 1, lines: [{ type: 'body', text: 'UMARK_R0C1' }] }],
    rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [[{ bg: '#111111' }, {}],
            [{ lines: [{ type: 'body', text: 'UMARK_R1C0' }], bg: '#ff0000', padding: 7 },
             { lines: [{ type: 'body', text: 'UMARK_R1C1' }], radius: 9 }]],
  });
  const M = ['UMARK_R0C0', 'UMARK_R0C1', 'UMARK_R1C0', 'UMARK_R1C1'];
  const r = await page.evaluate((M) => {
    const see = () => {
      const g = document.getElementById('cG');
      if (!g) return { gone: true };
      const s = g.outerHTML + JSON.stringify({ c: g.dataset.cols, r: g.dataset.rows ?? null, x: g.dataset.cells ?? null });
      const o = {}; for (const m of M) o[m] = s.includes(m); return o;
    };
    const snap = () => ({ len: (window.historyStack || []).length, pos: window.historyPos,
                          top: (window.historyStack || [])[window.historyPos]?.action ?? null });
    const before = { marks: see(), hist: snap() };
    const res = window.updateGridBlock('cG', { rows: [{ height: 'auto' }] });
    const after = { marks: see(), hist: snap() };
    window.undo();
    const undone = { marks: see(), hist: snap() };
    return { before, res: { ok: res.ok, destructive: !!res.destructive }, after, undone };
  }, M);
  /* ★대조군을 «깨끗한 히스토리»에서 따로 잰다 — 같은 페이지에서 먼저 돌리면 그 수가
     스택을 더럽혀(redo 가지 잘림) 다음 수의 «칸 값»이 1 로 보인다. 2026-10-07 실측으로 겪었다.
     ⇒ 판을 다시 띄워 «같은 문»(window.updateGridBlock, model-update-history 래퍼 포함)으로
       무해한 한 수를 재고, 그 수를 이 집의 «한 수 값»으로 삼는다. */
  await scene(page);
  await mkGrid(page, { cols: [{ width: 1, lines: L('A') }, { width: 1, lines: L('B') }], rows: [{ height: 'auto' }, { height: 'auto' }] });
  const ctl = await page.evaluate(() => {
    const snap = () => ({ len: (window.historyStack || []).length, pos: window.historyPos });
    const a = snap();
    window.updateGridBlock('cG', { patchCell: { r: 0, c: 0, bg: '#eeeeee' } });
    const b = snap();
    window.undo();
    return { a, b, cost: b.pos - a.pos, afterUndo: snap() };
  });
  r.CTL_COST = ctl.cost; r.ctl = ctl;
  console.log('### G4 ' + JSON.stringify(r));

  // ★양성대조 — 줄이기 «전»에 네 표식이 전부 보인다
  for (const m of M) expect(r.before.marks[m], `before ${m}`).toBe(true);
  // ★전제 — 변환이 실제로 일어났다(행1 둘이 사라졌다). 안 사라졌으면 아래 복원은 «아무 일도 안 함»과 구분 안 된다
  expect(r.after.marks.UMARK_R1C0, 'row1 must actually be gone first').toBe(false);
  expect(r.after.marks.UMARK_R1C1).toBe(false);
  // ★전제 — 대조군이 «0칸»이면 자가 아무것도 안 세고 있다는 뜻이다
  expect(r.CTL_COST, `control op cost ${r.CTL_COST} slots ${JSON.stringify(r.ctl)}`).toBeGreaterThan(0);
  // ★주단언 ㉠ — 변환 한 수의 칸 값 = «이 집의 한 수 값»(대조군)과 같다. 더 먹지 않는다
  expect(r.after.hist.pos - r.before.hist.pos,
    `convert cost ${r.after.hist.pos - r.before.hist.pos} vs control ${r.CTL_COST} (len ${r.before.hist.len}→${r.after.hist.len}, top=${r.after.hist.top})`).toBe(r.CTL_COST);
  // ★주단언 ㉡ — ⌘Z ★한 번에 네 표식이 전부 돌아온다
  for (const m of M) expect(r.undone.marks[m], `after one undo ${m} · hist=${JSON.stringify(r.undone.hist)}`).toBe(true);
  // ★그리고 ⌘Z ★한 번이 포인터를 ★한 칸만 내렸다(ensureHistoryCheckpoint 가 칸을 더 만들어 구해 준 게 아니다)
  expect(r.after.hist.pos - r.undone.hist.pos, `one undo moved pos ${r.after.hist.pos} → ${r.undone.hist.pos}`).toBe(1);
  expect(errs).toEqual([]);
});

/* 관문 #3 — 피그마 내보내기. ★같은 내용을 ⑴2×2 꼴과 ⑵열 스택 꼴로 각각 짓고
 *   `buildFigmaExportJSON` 산출을 견준다. ⛔픽셀은 안 잰다 — ★«실리나»(줄 수·이미지 수)만. */
test('(G3) figma export — does the column-stack shape carry the same lines/images as 2x2?', async ({ page }) => {
  const errs = await scene(page);
  const IMG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const r = await page.evaluate(async ([IMG1]) => {
    const T = (t) => ({ type: 'h2', text: t });
    const I = () => ({ type: 'image', imgSrc: IMG1, height: 120, imgSizePct: 100, imgPosX: 0, imgPosY: 0 });
    const build = (conf, id) => {
      const { block: g } = window.makeGridBlock(conf);
      g.id = id; document.getElementById('cR').appendChild(g);
      window.rebindAll?.(); window.renderGridBlock(g);
      return g;
    };
    const count = (s) => ({
      marks: ['FX_A', 'FX_B', 'FX_C', 'FX_D'].filter(m => s.includes(m)),
      imgs: (s.match(/iVBORw0KGgo/g) || []).length,
      bytes: s.length,
    });
    const out = {};
    // ⑴ 2×2 꼴
    document.getElementById('cR').innerHTML = '';
    build({ cols: [{ width: 1, lines: [T('FX_A'), I()] }, { width: 1, lines: [T('FX_B'), I()] }],
            rows: [{ height: 'auto' }, { height: 'auto' }],
            cells: [[{}, {}], [{ lines: [T('FX_C'), I()] }, { lines: [T('FX_D'), I()] }]] }, 'gA');
    await (window.whenGridRatiosSettled?.() ?? Promise.resolve());
    window.flushCurrentPage();
    out.twoByTwo = count(JSON.stringify(window.buildFigmaExportJSON(null)));
    // ⑵ 열 스택 꼴 — «같은 내용»을 cols[c].lines 로 접어 넣는다
    document.getElementById('cR').innerHTML = '';
    build({ cols: [{ width: 1, lines: [T('FX_A'), I(), T('FX_C'), I()] }, { width: 1, lines: [T('FX_B'), I(), T('FX_D'), I()] }],
            rows: [{ height: 'auto' }] }, 'gB');
    await (window.whenGridRatiosSettled?.() ?? Promise.resolve());
    window.flushCurrentPage();
    out.colStack = count(JSON.stringify(window.buildFigmaExportJSON(null)));
    // ★음성대조 — «아무 그리드도 없는» 판에서는 표식·이미지가 0 이어야 한다
    document.getElementById('cR').innerHTML = '';
    window.flushCurrentPage();
    out.empty = count(JSON.stringify(window.buildFigmaExportJSON(null)));
    /* ★★양성대조 — ⛔「0건」을 ★고장난 자로 재지 마라.
       «실린다고 알려진» 꼴(text-block 한 개 + image-block 한 개)을 같은 자로 재서
       표식·이미지가 ★잡히는지 본다. 여기서도 0 이면 ★자가 고장난 것이지 그리드가 비는 게 아니다. */
    document.getElementById('cR').innerHTML = '';
    const tb = document.createElement('div');
    tb.className = 'text-block'; tb.dataset.type = 'text'; tb.id = 'posCtlT';
    tb.innerHTML = '<div class="tb-h2">FX_A FX_B FX_C FX_D</div>';
    document.getElementById('cR').appendChild(tb);
    const ib = document.createElement('div');
    ib.className = 'asset-block'; ib.dataset.type = 'asset'; ib.id = 'posCtlI';
    ib.dataset.imgSrc = IMG1; ib.style.height = '200px';   // ★내보내기가 읽는 자리 = dataset.imgSrc(:437)
    ib.innerHTML = `<img src="${IMG1}" style="width:100%">`;
    document.getElementById('cR').appendChild(ib);
    window.rebindAll?.();
    window.flushCurrentPage();
    out.posControl = count(JSON.stringify(window.buildFigmaExportJSON(null)));
    return out;
  }, [IMG1]);
  console.log('### G3 ' + JSON.stringify(r));

  // ★음성대조 — 빈 판은 0/0
  expect(r.empty.marks, 'negative control: empty canvas must carry nothing').toEqual([]);
  expect(r.empty.imgs).toBe(0);
  // ★★양성대조 — 자가 표식과 이미지를 ★잡을 수 있다(0건이 «안 재서»가 아님을 증명)
  expect(r.posControl.marks.length, `POSITIVE CONTROL blind: ${JSON.stringify(r.posControl)}`).toBeGreaterThan(0);
  expect(r.posControl.imgs, `POSITIVE CONTROL blind to images: ${JSON.stringify(r.posControl)}`).toBeGreaterThan(0);
  // ★주단언 — 열 스택이 2×2 «이상»을 싣는다(줄 수·이미지 수 보존)
  expect(r.colStack.marks.sort(), `2x2=${JSON.stringify(r.twoByTwo)} colStack=${JSON.stringify(r.colStack)}`).toEqual(r.twoByTwo.marks.sort());
  expect(r.colStack.imgs, `images 2x2=${r.twoByTwo.imgs} colStack=${r.colStack.imgs}`).toBeGreaterThanOrEqual(r.twoByTwo.imgs);
  expect(errs).toEqual([]);
});
