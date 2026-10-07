/* grid-flatten-columns.dom.spec.js — ★T12 «독립 칼럼으로 펴기»(2×2 → 열 스택).
 *   현빈 2026-10-07 원문: 「보기엔 2×2 지만 ★칼럼별 높이를 조절할 수 있는 것 — 구조적으로는
 *   ★두 개의 독립적인 세로 칼럼. ★#sp_cqjuuu 를 만들 수 있지 않겠니? ★그리드블럭2 를 만들어야 하나?」
 *   답 = ⛔그리드블럭2 는 안 만든다. ★목표 상태는 «이미» 그려진다(1행 N열 + cols[c].lines).
 *        ★없던 것은 «2×2 를 그 꼴로 접는» ★한 방향 문 하나뿐이고, 그것이 gridCollapseToColumns 다.
 *
 * ★머리표 — [새 것] 핀 `4b36eb56` 에서 ★빨강 · [회귀 지킴] 거기서도 ★초록 · [전제] 재기 위한 조건.
 *   ★양성대조 도는 법(실측으로 떴다):
 *     GD1001_ROOT=/tmp/t12-pinroot npx playwright test --config=tests/dom/playwright.dom.config.js \
 *       tests/dom/grid-flatten-columns.dom.spec.js
 *     (그 ROOT = 레인의 심링크 거울 + `js/blocks/grid-block.js`·`js/props/prop-grid.js` 만 ★핀 blob
 *      ⇒ blob c7ef9477…(grid-block) · ede8a122…(prop-grid). 디스크 552K.)
 *
 * ★★자 두 개를 ★머리말에 못박는다 — 다음 사람이 ★다시 안 밟게:
 *  ㉠ ★높이는 ★«layout px»(`offsetHeight`)로 재라. ⛔`getBoundingClientRect()` 금지.
 *     까닭(2026-10-07 실측) — `#canvas-scaler` 가 ★화면 맞춤 변환을 건다(`matrix(0.4,0,0,0.4,0,0)`).
 *     그래서 `grid-template-rows: minmax(120px,auto)` 인 칸이 ★48 로 읽혔다. ★zoom 은 100 이었다 —
 *     `applyZoom(100)` 을 불러도 안 사라진다. 배율은 ★캔버스 내용 높이에 따라 매번 다르다(0.4 · 0.8738 둘 다 봤다).
 *     ★내 첫 빨강은 ★제품이 아니라 ★내 시험 설계의 흠이었다.
 *  ㉡ ★「그 문이 없다」는 ★«API 거절»을 ★이름으로 재라 — 그리고 ★반드시 ★음성대조를 같이 걸어라
 *     (무해한 한 수가 ok:true 여야 한다). 안 걸면 «전부 거절하는 고장난 자»와 구분이 안 된다.
 *
 * ⛔이 스펙이 ★안 재는 축(이름으로) — 역변환(열 스택 → 2×2) · duo 로 감싼 9/9 보존 · 실앱(Electron) 저장/불러오기 왕복
 *   · 프리셋/템플릿에 박힌 2×2 수 · rows ≥ 3 의 ★픽셀 · HTML 내보내기 산출물의 픽셀. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SCENE = '<div class="section-block" id="cS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="cI"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="cR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>';
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
  }, conf);
}
const T = (t) => ({ type: 'body', text: t });
const FOUR = {
  cols: [{ width: 1, lines: [T('MK_R0C0')] }, { width: 1, lines: [T('MK_R0C1')] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [[{}, {}], [{ lines: [T('MK_R1C0')] }, { lines: [T('MK_R1C1')] }]],
};
const MARKS = ['MK_R0C0', 'MK_R0C1', 'MK_R1C0', 'MK_R1C1'];

/* ═══ F1 [새 것] — 펴기가 ★모든 줄을 지키고 ★행 축을 걷는다 ═══ */
test('F1 flatten keeps every line and drops the row axis', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, FOUR);
  const r = await page.evaluate((MARKS) => {
    const g = document.getElementById('cG');
    const see = () => { const s = g.outerHTML + JSON.stringify(g.dataset.cols) + JSON.stringify(g.dataset.cells ?? ''); const o = {}; for (const m of MARKS) o[m] = s.includes(m); return o; };
    const before = { marks: see(), rows: g.dataset.rows ?? null };
    const res = window.gridCollapseToColumns(g);
    const model = window.getGridModel(g);
    return { before, ok: res.ok, notice: res.notice, converted: res.converted,
             after: { marks: see(), rows: g.dataset.rows ?? null,
                      lineCounts: model.cols.map(c => (c.lines || []).length), rowCount: model.rows.length } };
  }, MARKS);
  console.log('### F1 ' + JSON.stringify(r));
  for (const m of MARKS) expect(r.before.marks[m], `[전제] before ${m}`).toBe(true);   // ★양성대조 — 자가 넷을 본다
  expect(r.ok, JSON.stringify(r)).toBe(true);
  for (const m of MARKS) expect(r.after.marks[m], `★줄이 사라졌다: ${m}`).toBe(true);  // ★주단언 — 손실 0
  expect(r.after.rows, '★행 축이 안 걷혔다').toBe(null);
  expect(r.after.rowCount).toBe(1);
  expect(r.after.lineCounts, '★열마다 2줄(행0 1줄 + 행1 1줄)이어야 한다').toEqual([2, 2]);
  expect(r.notice.kind).toBe('convert');
  expect(errs).toEqual([]);
});

/* ═══ F2 [새 것] ★이것이 이 카드의 본문 — 펴고 나면 ★칼럼별 높이가 ★실제로 갈린다(px) ═══ */
test('F2 after flatten the two columns really do split at DIFFERENT y (layout px)', async ({ page }) => {
  const errs = await scene(page);
  // 2×2 로 ★시작한다(현빈의 출발점) — 각 칸에 크롭 그림 한 장
  const img = (h) => ({ type: 'image', imgSrc: PX, height: h, imgSizePct: 100, imgPosX: 0, imgPosY: 0 });
  await mkGrid(page, {
    gap: 18,
    cols: [{ width: 1, lines: [img(482)] }, { width: 1, lines: [img(345)] }],
    rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [[{}, {}], [{ lines: [img(345)] }, { lines: [img(481)] }]],
  });
  const meas = () => page.evaluate(() => {
    const g = document.getElementById('cG');
    const cells = [...g.querySelectorAll('.grd-cell')].map(el => ({
      r: el.dataset.r, c: el.dataset.c, lay: el.offsetHeight,
      frames: [...el.children].filter(n => n.nodeType === 1).map(f => ({ cls: f.className, lay: f.offsetHeight })),
    }));
    const a = g.querySelector('.grd-cell');
    return { cells, tmplRows: g.querySelector('.grd-inner').style.gridTemplateRows,
             scale: a.offsetHeight > 0 ? Math.round((a.getBoundingClientRect().height / a.offsetHeight) * 1000) / 1000 : 1 };
  });
  const before = await meas();
  const res = await page.evaluate(() => window.gridCollapseToColumns(document.getElementById('cG')));
  await page.waitForTimeout(350);
  const after = await meas();
  console.log('### F2 before=' + JSON.stringify(before) + ' after=' + JSON.stringify(after));

  /* ★[전제] 2×2 일 때는 ★같은 행의 두 열이 ★같은 높이다 — 이 줄이 거짓이면 아래 «갈렸다»가 아무것도 안 말한다 */
  const b = Object.fromEntries(before.cells.map(x => [`r${x.r}c${x.c}`, x]));
  expect(b.r0c0.lay, `[전제] 2×2 의 행0 두 열 ${JSON.stringify(before)}`).toBe(b.r0c1.lay);
  expect(b.r1c0.lay, '[전제] 2×2 의 행1 두 열').toBe(b.r1c1.lay);

  expect(res.ok, JSON.stringify(res)).toBe(true);
  /* ★주단언 — 펴고 나면 ★열 안의 ★첫 그림 높이가 ★좌우에서 ★다르다(= 분할선이 다른 y) */
  expect(after.cells.length, '펴면 칸은 1행 × 2열').toBe(2);
  const f0 = after.cells[0].frames.filter(x => /grd-img-frame/.test(x.cls)).map(x => x.lay);
  const f1 = after.cells[1].frames.filter(x => /grd-img-frame/.test(x.cls)).map(x => x.lay);
  expect(f0, '★좌 열의 그림 높이').toEqual([482, 345]);
  expect(f1, '★우 열의 그림 높이').toEqual([345, 481]);
  expect(f0[0], '★★좌우 첫 분할선이 ★같은 y 면 칼럼별 높이가 아니다').not.toBe(f1[0]);
  /* ★그리고 ★한 CSS 그리드 행이다 — 행 축으로 한 게 아니라는 증거 */
  expect(after.tmplRows.trim()).toBe('auto');
  expect(errs).toEqual([]);
});

/* ═══ F3 [새 것] ★한도 관문 — 넘으면 거절하고 ★아무 것도 안 바꾼다 ═══ */
test('F3 over MAX_CELL_LINES is REJECTED with numbers, and nothing changes', async ({ page }) => {
  const errs = await scene(page);
  const r = await page.evaluate(async () => {
    const M = await import('/js/blocks/grid-block.js');
    const N = M.MAX_CELL_LINES;
    const many = (tag, n) => Array.from({ length: n }, (_, i) => ({ type: 'body', text: `${tag}${i}` }));
    const { block: g } = window.makeGridBlock({
      cols: [{ width: 1, lines: many('A', N) }, { width: 1, lines: many('B', 2) }],
      rows: [{ height: 'auto' }, { height: 'auto' }],
      cells: [[{}, {}], [{ lines: many('C', 3) }, { lines: many('D', 2) }]],
    });
    g.id = 'cG'; document.getElementById('cR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g);
    const snap = () => JSON.stringify({ c: g.dataset.cols, r: g.dataset.rows ?? null, x: g.dataset.cells ?? null });
    const b4 = snap();
    const res = window.gridCollapseToColumns(g);
    return { N, res, unchanged: snap() === b4, msg: res.message || '' };
  });
  console.log('### F3 ' + JSON.stringify(r));
  expect(r.res.ok, JSON.stringify(r.res)).toBe(false);
  expect(r.res.code).toBe('INVALID');
  // ★「초과」만 적으면 못 고친다 — ★수가 글에 있어야 한다
  expect(r.msg, `거절 글에 한도(${r.N})가 없다: ${r.msg}`).toContain(String(r.N));
  expect(r.msg, '거절 글에 «over by» 수가 없다').toMatch(/over by \d+/);
  expect(r.msg, '거절 글에 어느 열인지가 없다').toMatch(/col \d+/);
  // ★부분 적용 금지 — 한 열이라도 넘으면 아무 것도 안 바뀐다
  expect(r.unchanged, '★거절했는데 dataset 이 바뀌었다(부분 적용)').toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ F4 [새 것] ★NOOP + ★음성대조 ═══ */
test('F4 single-row grid is NOOP (not INVALID), and a benign flatten still works — negative control', async ({ page }) => {
  const errs = await scene(page);
  const r = await page.evaluate(() => {
    const out = {};
    const { block: g1 } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'x' }] }, { width: 1, lines: [{ type: 'body', text: 'y' }] }] });
    g1.id = 'g1'; document.getElementById('cR').appendChild(g1); window.renderGridBlock(g1);
    const b4 = JSON.stringify(g1.dataset.cols);
    out.noop = window.gridCollapseToColumns(g1);
    out.noopUnchanged = JSON.stringify(g1.dataset.cols) === b4;
    // ★음성대조 — «무해한» 2행 그리드는 ok:true 여야 한다(자가 전부 거절하는 고장난 자가 아님)
    const { block: g2 } = window.makeGridBlock({
      cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }],
      rows: [{ height: 'auto' }, { height: 'auto' }],
      cells: [[{}, {}], [{ lines: [{ type: 'body', text: 'c' }] }, { lines: [{ type: 'body', text: 'd' }] }]],
    });
    g2.id = 'g2'; document.getElementById('cR').appendChild(g2); window.renderGridBlock(g2);
    out.neg = window.gridCollapseToColumns(g2);
    return out;
  });
  console.log('### F4 ' + JSON.stringify(r));
  expect(r.noop.ok).toBe(false);
  expect(r.noop.code, '★「할 게 없다」를 INVALID 로 뭉개면 UI 가 까닭을 못 적는다').toBe('NOOP');
  expect(r.noopUnchanged).toBe(true);
  expect(r.neg.ok, `★음성대조 빨강 — 무해한 수까지 거절한다: ${JSON.stringify(r.neg)}`).toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ F5 [새 것] ★손실 통지 — ★명부를 «파생식»에서 재고 ★이름으로 열거한다 ═══ */
test('F5 loss notice enumerates the dropped and the deliberately-not-moved field names', async ({ page }) => {
  const errs = await scene(page);
  const r = await page.evaluate(async () => {
    const M = await import('/js/blocks/grid-block.js');
    const CELL = [...M.GRID_CELL_FIELDS], LINE = [...M.GRID_LINE_FIELDS];
    const { block: g } = window.makeGridBlock({
      cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }],
      rows: [{ height: 'auto' }, { height: 'auto' }],
      // 행 1 에 ★두 무리를 ★전부 건다 — 통지가 둘을 ★갈라 적는지 보려고
      cells: [[{}, {}],
              [{ lines: [{ type: 'body', text: 'c' }], padding: 7, bgImg: 'https://x/y.png', bgFit: 'contain', bgPos: 'top left' },
               { lines: [{ type: 'body', text: 'd' }], align: 'center', bg: '#ff0000', radius: 9, valign: 'middle' }]],
    });
    g.id = 'cG'; document.getElementById('cR').appendChild(g); window.renderGridBlock(g);
    const res = window.gridCollapseToColumns(g);
    return { DROPPED: M.GRID_CONVERT_DROPPED_CELL_FIELDS, NOT_MOVED: M.GRID_CONVERT_NOT_MOVED_FIELDS,
             CELL, LINE, ok: res.ok, notice: res.notice };
  });
  console.log('### F5 ' + JSON.stringify(r));
  expect(r.ok).toBe(true);
  /* ★명부가 ★파생식에서 온다 — ⛔수를 박지 않는다. 두 명부를 ★여기서 다시 계산해 견준다.
     (명부가 둘이면 경고 주석으로 못 막는다 ⇒ 파생. 새 칸/줄 필드가 생기면 이 단언이 ★자동으로 따라온다.) */
  const wantDropped = CELLminus(r.CELL, r.LINE, false);
  const wantNotMoved = CELLminus(r.CELL, r.LINE, true);
  expect(r.DROPPED.slice().sort(), `파생식이 어긋났다 DROPPED`).toEqual(wantDropped);
  expect(r.NOT_MOVED.slice().sort(), `파생식이 어긋났다 NOT_MOVED`).toEqual(wantNotMoved);
  /* ★두 무리가 ★겹치지 않고 ★`lines` 를 안 품는다 */
  expect(r.DROPPED.filter(k => r.NOT_MOVED.includes(k)), '두 무리가 겹친다').toEqual([]);
  expect(r.DROPPED.concat(r.NOT_MOVED).includes('lines'), "`lines` 는 내용이라 손실 축이 아니다").toBe(false);
  /* ★통지가 둘을 ★갈라 적는다 — 주소까지 */
  expect(r.notice.droppedCellFields.sort()).toEqual(['cells[1][0].bgFit', 'cells[1][0].bgImg', 'cells[1][0].bgPos', 'cells[1][0].padding']);
  expect(r.notice.notMovedCellFields.sort()).toEqual(['cells[1][1].align', 'cells[1][1].bg', 'cells[1][1].radius', 'cells[1][1].valign']);
  for (const k of r.DROPPED) expect(r.notice.message, `통지 글에 버리는 이름 '${k}' 가 없다`).toContain(k);
  for (const k of r.NOT_MOVED) expect(r.notice.message, `통지 글에 안 옮기는 이름 '${k}' 가 없다`).toContain(k);
  expect(r.notice.linesKept, '★줄은 하나도 안 버린다 — 그 수를 통지가 들고 있어야 한다').toEqual([2, 2]);
  expect(errs).toEqual([]);
});
function CELLminus(CELL, LINE, inLine) {
  return CELL.filter(k => k !== 'lines' && (LINE.includes(k) === inLine)).sort();
}

/* ═══ F6 [새 것] ★undo — «칸 수»로 재라. ⛔「⌘Z 를 눌러 봤다」는 세 꼴을 못 가른다 ═══ */
test('F6 undo — flatten costs the same history slots as its sibling door, and ONE ⌘Z restores the 2x2', async ({ page }) => {
  const errs = await scene(page);
  await mkGrid(page, FOUR);
  /* ★★자 둘을 못박는다 — 둘 다 2026-10-07 에 ★내가 틀려서 얻은 것이다:
   *  ㉠ ⛔노드 참조를 «쥐고» 재지 마라 — `undo` 는 캔버스 DOM 을 통째로 되돌려서 쥐고 있던
   *     노드가 ★떨어져 나간다(detached). 그러면 «복원됐는데도» dataset 이 옛 값으로 보여
   *     ★거짓 빨강이 난다. ★매번 `document.getElementById` 로 다시 찾는다.
   *  ㉡ ★대조군은 «같은 꼴의 문»이어야 한다. `window.updateGridBlock` 은 model-update-history.js
   *     가 감싸 «끝 표본» 한 칸을 더 쌓는다(★실측 2칸). `gridCollapseToColumns` 은
   *     `gridResizeTo` 와 같은 «직접 쓰기 + pushHistory 1회» 문이다(★실측 1칸).
   *     ⇒ 대조군을 updateGridBlock 으로 잡으면 1≠2 로 ★거짓 빨강이 난다. ★gridResizeTo 로 잡는다.
   *     ★세 문을 나란히 재 둔 수(2026-10-07): gridResizeTo 1 · gridCollapseToColumns 1 · updateGridBlock 2.
   *       그리고 ★셋 다 ⌘Z ★한 번에 2×2 가 돌아온다. */
  const r = await page.evaluate((MARKS) => {
    const see = () => {
      const q = document.getElementById('cG');
      if (!q) return { __gone: true };
      const s = q.outerHTML + JSON.stringify(q.dataset.cols) + JSON.stringify(q.dataset.cells ?? '') + JSON.stringify(q.dataset.rows ?? '');
      const o = {}; for (const m of MARKS) o[m] = s.includes(m); return o;
    };
    const rowsOf = () => { const q = document.getElementById('cG'); return q ? (q.dataset.rows ?? null) : 'GONE'; };
    const snap = () => ({ len: (window.historyStack || []).length, pos: window.historyPos });
    const b = snap();
    window.gridCollapseToColumns(document.getElementById('cG'));
    const a = snap();
    const flat = { marks: see(), rows: rowsOf() };
    window.undo();
    const u = snap();
    return { b, a, u, cost: a.pos - b.pos, flat, undone: { marks: see(), rows: rowsOf() } };
  }, MARKS);
  /* ★대조군은 ★깨끗한 히스토리에서 ★따로 잰다 — 같은 판에서 먼저 돌리면 그 수가 스택을
     더럽혀(redo 가지 잘림) 다음 수의 «칸 값»이 1 로 보인다. 실제로 그렇게 틀렸다. */
  await scene(page);
  await mkGrid(page, FOUR);
  const ctl = await page.evaluate(async () => {
    const M = await import('/js/blocks/grid-block.js');
    const snap = () => ({ len: (window.historyStack || []).length, pos: window.historyPos });
    const a = snap();
    M.gridResizeTo(document.getElementById('cG'), 2, 1);   // ★같은 꼴의 문
    const b = snap();
    return { cost: b.pos - a.pos, a, b };
  });
  console.log('### F6 ' + JSON.stringify({ r, ctl }));
  expect(ctl.cost, `[전제] 대조군이 0칸이면 자가 아무것도 안 센다 ${JSON.stringify(ctl)}`).toBeGreaterThan(0);
  expect(r.flat.rows, '[전제] 펴기가 실제로 일어나야 한다').toBe(null);
  expect(r.flat.marks, '[전제] 펴고 나서도 네 줄이 다 살아 있어야 한다').toEqual({ MK_R0C0: true, MK_R0C1: true, MK_R1C0: true, MK_R1C1: true });
  expect(r.cost, `펴기 ${r.cost}칸 vs 대조군(gridResizeTo) ${ctl.cost}칸 — 더 먹으면 ⌘Z 가 두 번 든다`).toBe(ctl.cost);
  /* ⛔`historyPos` 가 줄었는지는 ★안 본다 — 이 레포가 이미 그렇게 정해 뇌다
     (`tests/dom/grid-row0-save-undo.dom.spec.js:309` · `js/block-factory.js:465`):
     `undo` 첫머리의 `ensureHistoryCheckpoint` 가 «매번» 한 칸을 쌓았다가 곰바로 `pos--` 하므로
     술자가 제자리일 수 있다(★실측: 1 → 1). ⇒ ★복원은 «화면·데이터»로 재고,
     «⌘Z 한 번이면 충분한가» 는 위의 ★칸 값(cost) 이 대조군과 같은가로 재다. */
  for (const m of MARKS) expect(r.undone.marks[m], `⌘Z 한 번 뒤 ${m} 이 안 돌아왔다`).toBe(true);
  expect(r.undone.rows, '⌘Z 한 번에 ★행 축이 돌아와야 한다(2×2 복원)').not.toBe(null);
  expect(errs).toEqual([]);
});

/* ═══ F7 [회귀 지킴] ★안 부르면 아무 것도 안 달라진다 ═══ */
test('F7 [새 것] the flatten button appears only at rows>=2, and opening the panel never flattens on its own', async ({ page }) => {
  const errs = await scene(page);
  const r = await page.evaluate(() => {
    const out = {};
    const mk = (conf, id) => { const { block: g } = window.makeGridBlock(conf); g.id = id; document.getElementById('cR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); return g; };
    const one = mk({ cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }] }, 'q1');
    window.showGridProperties?.(one);
    out.btnAtRows1 = !!document.getElementById('grd-flatten-cols');
    const two = mk({ cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }],
                     rows: [{ height: 'auto' }, { height: 'auto' }],
                     cells: [[{}, {}], [{ lines: [{ type: 'body', text: 'c' }] }, { lines: [{ type: 'body', text: 'd' }] }]] }, 'q2');
    const htmlBefore = two.outerHTML, dsBefore = JSON.stringify({ c: two.dataset.cols, r: two.dataset.rows, x: two.dataset.cells });
    window.showGridProperties?.(two);
    out.btnAtRows2 = !!document.getElementById('grd-flatten-cols');
    // ★패널을 열고 다시 그려도 ★스스로 펴지지 않는다
    window.renderGridBlock(two);
    out.untouched = (two.outerHTML === htmlBefore) && (JSON.stringify({ c: two.dataset.cols, r: two.dataset.rows, x: two.dataset.cells }) === dsBefore);
    return out;
  });
  console.log('### F7 ' + JSON.stringify(r));
  expect(r.btnAtRows1, '★1행에서는 버튼이 없어야 한다(펼 게 없다)').toBe(false);
  expect(r.btnAtRows2, '★2행에서는 버튼이 있어야 한다').toBe(true);
  expect(r.untouched, '★패널을 열고 다시 그렸을 뿐인데 그리드가 바뀌었다').toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ F8 [회귀 지킴] ★«안 부른 그리드»의 렌더 바이트 = ★핀 판 그대로 ═══════════════════════
 *   ★이것이 「깨지는 기존 단언 0」을 ★예측이 아니라 ★실측으로 바꾸는 자리다.
 *   ★골든은 ⛔HEAD 에서 뜨지 마라 — HEAD 는 곧 «고친 판»이라 무엇과도 같아진다.
 *     ★핀 판(= /tmp/t12-pinroot, blob c7ef9477 + ede8a122)에서 «한 번» 뜬다:
 *       GD1001_ROOT=/tmp/t12-pinroot GRID_FLATTEN_GOLDEN=update \
 *         npx playwright test --config=tests/dom/playwright.dom.config.js \
 *         tests/dom/grid-flatten-columns.dom.spec.js -g F8
 *   ★그 뒤 HEAD 에서 돌면 «내가 더한 코드가 기존 산출을 한 바이트도 안 건드렸나»를 잰다.
 *   ⚠️골든 바이트 비교는 «변경 감지기»지 결함 감지기가 아니다 — 빨개지면 «무엇이» 달라졌는지
 *     그 자리에서 읽어라(여기 꼴 여섯은 전부 ★펴기를 안 부르는 꼴이다). */
const fs = require('fs');
const path = require('path');
const GOLD = path.join(__dirname, 'fixtures', 'grid-flatten-y0-golden.json');

test('F8 [회귀 지킴] grids that never flatten render byte-identical to the pinned board', async ({ page }) => {
  const errs = await scene(page);
  const got = await page.evaluate(() => {
    const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const CONF = {
      plain: {},
      twoRows: { cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }],
                 rows: [{ height: 'auto' }, { height: 120 }],
                 cells: [[{ padding: 20 }, {}], [{ lines: [{ type: 'body', text: 'c' }] }, { padding: 8, radius: 6, lines: [{ type: 'body', text: 'd' }] }]] },
      colStack: { cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }, { type: 'gap', height: 18 }, { type: 'body', text: 'c' }] },
                         { width: 1, lines: [{ type: 'body', text: 'b' }, { type: 'gap', height: 18 }, { type: 'body', text: 'd' }] }] },
      cellDeco: { cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }],
                  rows: [{ height: 'auto' }, { height: 'auto' }],
                  cells: [[{ bg: '#eeeeee' }, {}], [{ lines: [{ type: 'body', text: 'c' }], padding: 7, bgFit: 'contain' }, { lines: [{ type: 'body', text: 'd' }], align: 'center', radius: 9 }]] },
      border: { cellBorderWidth: 2, cellBorderColor: '#333333', gap: 0 },
      image: { cols: [{ width: 1, lines: [{ type: 'image', imgSrc: IMG }] }, { width: 1, lines: [{ type: 'image', imgSrc: IMG, widthPct: 60, align: 'center' }] }] },
    };
    const c = document.getElementById('canvas'); const out = {};
    for (const [k, o] of Object.entries(CONF)) {
      const { block: g } = window.makeGridBlock(o); g.id = 'y0_' + k; c.appendChild(g); window.renderGridBlock(g);
      out[k] = g.outerHTML; g.remove();
    }
    return out;
  });
  if (process.env.GRID_FLATTEN_GOLDEN === 'update') {
    if (!process.env.GD1001_ROOT) throw new Error('⛔골든은 핀 판에서만 뜬다 — GD1001_ROOT 를 걸어라(HEAD 에서 뜨면 무엇과도 같아진다)');
    fs.mkdirSync(path.dirname(GOLD), { recursive: true });
    fs.writeFileSync(GOLD, JSON.stringify(got, null, 1));
    test.info().annotations.push({ type: 'golden', description: 'written from ' + process.env.GD1001_ROOT });
    return;
  }
  const want = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
  // ★꼴 집합이 같은지부터 — 빠진 꼴이 «통과»로 보이지 않게
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
  for (const k of Object.keys(want)) {
    expect(got[k], `★«${k}» 그리드의 렌더 바이트가 핀 판과 다르다 — 펴기를 안 부른 꼴인데 산출이 바뀌었다`).toBe(want[k]);
  }
  expect(errs).toEqual([]);
});
