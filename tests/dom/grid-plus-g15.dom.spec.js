/* grid-plus-g15.dom.spec.js — G15 그리드 캔버스 ＋ (2026-10-04 현빈·지디, 안 ㉠)
 *   오른쪽 끝 ＋ = 열 하나를 «끝에» · 아래 끝 ＋ = 행 하나를 «끝에». 4×4 상한에선 흐리고 눌러도 무변화.
 *   히트 영역 = calc(40px * var(--inv-zoom)) — 화면에서 늘 ≈40px.
 *
 * ★뜨는 조건 = 그리드 블럭 «전체» 호버(2026-10-04 현빈 결정 — 태그블럭 ＋ 의 «선택» 선례와 다른 것이 의도).
 *   시험 전용 표지는 없다 — 진짜 마우스를 그리드 위에 올려서 띄운다(V1~V3 이 뜨고·지는 것을 잰다).
 *   보임 = computed opacity·visibility + elementFromPoint(눌리는가).
 *
 * 양성대조 핀 07d8178b(origin/dev, 이 기능 전): GD1001_ROOT=<핀 체크아웃> 으로 같은 시험을 돌린다.
 * 하네스 = bootApp(앱 통째 · 진짜 마우스). 배율 전제(100 · 40)는 «재기 전에» 단언한다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-plus-g15
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sG" data-section="1" data-name="sG"><div class="section-hitzone"></div><div class="section-inner" id="innerG">
  <div class="gap-block" data-type="gap" style="height:60px"></div>
  <div id="slotA"></div>
  <div class="gap-block" data-type="gap" style="height:80px"></div>
  <div id="slotB"></div>
  <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`;

async function setup(page, zoom = 100) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(100);
  }, SEC);
  await page.waitForTimeout(300);
  const ids = await page.evaluate(() => {
    const out = [];
    for (const slot of ['slotA', 'slotB']) {
      const { row, block } = window.makeGridBlock({});
      document.getElementById(slot).replaceWith(row); window.bindBlock(block);
      out.push(block.id);
    }
    window.rebindAll?.();
    return out;
  });
  if (zoom !== 100) await page.evaluate((z) => window.applyZoom?.(z), zoom);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${zoom}%`).toBe(zoom);
  return { errs, a: ids[0], b: ids[1] };
}

/* 그리드 «안쪽» 한 점 — 왼쪽 1/4 · 세로 가운데(＋ 두 개 어느 쪽과도 안 겹치는 자리) */
const gridPoint = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id); g.scrollIntoView({ block: 'center' });
  const r = g.getBoundingClientRect(); return [r.left + r.width * 0.25, r.top + r.height / 2];
}, id);
/* 그리드 «밖» 한 점 — 블럭 위 30px(위 gap 블럭) */
const outsidePoint = (page, id) => page.evaluate((id) => {
  const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * 0.25, r.top - 30];
}, id);
/* 진짜 마우스로 그리드 위에 올린다 — ＋ 가 붙는 유일한 길(호버) */
async function force(page, id) {
  const [x, y] = await gridPoint(page, id);
  await page.mouse.move(x, y, { steps: 4 });
  await page.waitForTimeout(80);
}
/* ＋ 가 «보이고 눌리는가» — 없으면 그 자리에 무엇이 잡히는지도 본다 */
const vis = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id), gr = g.getBoundingClientRect();
  const out = {};
  for (const axis of ['col', 'row']) {
    const b = g.querySelector(`:scope > .grd-add-btn[data-grd-add="${axis}"]`);
    /* 없을 때 잴 자리 = 있을 때 중심(오른쪽 안쪽 끝 · 아래 모서리선 가운데) */
    const at = b ? (() => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()
                 : (axis === 'col' ? [gr.right - 20, gr.top + gr.height / 2] : [gr.left + gr.width / 2, gr.bottom + 20]);
    const hit = document.elementFromPoint(at[0], at[1]);
    const cs = b ? getComputedStyle(b) : null;
    out[axis] = { present: !!b, opacity: cs ? +cs.opacity : 0, visibility: cs ? cs.visibility : 'none',
                  clickable: !!hit && !!hit.closest?.('.grd-add-btn') };
  }
  return out;
}, id);
const SHOWN = { present: true, opacity: 1, visibility: 'visible', clickable: true };
const HIDDEN = { present: false, opacity: 0, visibility: 'none', clickable: false };

const model = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id);
  return { cols: g.dataset.cols, rows: g.dataset.rows ?? null, cells: g.dataset.cells ?? null,
           nCols: JSON.parse(g.dataset.cols || '[]').length, nRows: g.dataset.rows ? JSON.parse(g.dataset.rows).length : 1,
           domCells: g.querySelectorAll(':scope > .grd-inner > .grd-cell').length,
           lastColCells: [...g.querySelectorAll(':scope > .grd-inner > .grd-cell')].filter(c => +c.dataset.c === JSON.parse(g.dataset.cols).length - 1).length,
           lastRowCells: [...g.querySelectorAll(':scope > .grd-inner > .grd-cell')].filter(c => +c.dataset.r === (g.dataset.rows ? JSON.parse(g.dataset.rows).length : 1) - 1).length };
}, id);

const btnBox = (page, id, axis) => page.evaluate(([id, axis]) => {
  const b = document.querySelector(`#${id} > .grd-add-btn[data-grd-add="${axis}"]`);
  if (!b) return null;
  const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  const desc = (el) => el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')}` : 'null';
  const sec = b.closest('.section-block')?.getBoundingClientRect();
  return { w: r.width, h: r.height, cx, cy, disabled: b.disabled, opacity: +cs.opacity, hitIsBtn: hit === b, hit: desc(hit),
           box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], sec: sec && [Math.round(sec.left), Math.round(sec.right)],
           tokenOpacity: +getComputedStyle(document.documentElement).getPropertyValue('--ui-disabled-opacity') };
}, [id, axis]);

/* 피커(우측 패널)로 같은 칸 수를 고른다 — ＋ 결과와 «같은 데이터»여야 한다 */
async function pickViaPanel(page, id, c, r) {
  return page.evaluate(([id, c, r]) => {
    const g = document.getElementById(id);
    window.deselectAll?.(); g.classList.add('selected'); window.showGridProperties(g);
    const cell = document.querySelector(`#grd-grid-picker .grid-picker-cell[data-r="${r}"][data-c="${c}"]`);
    if (!cell) return false;
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }, [id, c, r]);
}

test('V1 ★그리드 밖 → ＋ 안 보임(opacity·visibility·elementFromPoint)', async ({ page }) => {
  const { errs, a } = await setup(page);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), a);
  const [ox, oy] = await outsidePoint(page, a);
  await page.mouse.move(ox, oy, { steps: 4 }); await page.waitForTimeout(80);
  expect(await page.evaluate((id) => document.getElementById(id).matches(':hover'), a), '전제 — 그리드 위가 아니다').toBe(false);
  expect(await vis(page, a), '★밖이면 둘 다 없다·안 눌린다').toEqual({ col: HIDDEN, row: HIDDEN });
  expect(errs).toEqual([]);
});

test('V2 ★그리드 위(블럭 아무 데나) → 두 ＋ 보이고 눌린다 · 선택 불필요', async ({ page }) => {
  const { errs, a } = await setup(page);
  await force(page, a);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), a), '전제 — 선택 안 됨(호버만)').toBe(false);
  expect(await vis(page, a), '★호버 → 둘 다 보이고 눌린다').toEqual({ col: SHOWN, row: SHOWN });
  expect(errs).toEqual([]);
});

test('V3 ★그리드에서 벗어나면 → 다시 안 보임', async ({ page }) => {
  const { errs, a } = await setup(page);
  await force(page, a);
  expect(await vis(page, a), '전제 — 호버 중엔 보인다').toEqual({ col: SHOWN, row: SHOWN });
  const [ox, oy] = await outsidePoint(page, a);
  await page.mouse.move(ox, oy, { steps: 4 }); await page.waitForTimeout(80);
  expect(await vis(page, a), '★벗어나면 둘 다 사라진다').toEqual({ col: HIDDEN, row: HIDDEN });
  expect(errs).toEqual([]);
});

test('P1 ★오른쪽 ＋ 진짜 클릭 → 열이 «끝에» 하나 · 데이터·DOM · 피커 결과와 같다 · undo 한 번', async ({ page }) => {
  const { errs, a, b } = await setup(page);
  await force(page, a);
  const m0 = await model(page, a);
  expect(m0, '전제 — 기본 2×1').toMatchObject({ nCols: 2, nRows: 1, domCells: 2 });
  const bx = await btnBox(page, a, 'col');
  expect(bx && bx.hitIsBtn, `전제 — 버튼 가운데를 누르면 버튼이 잡힌다 ${JSON.stringify(bx)}`).toBe(true);
  await page.mouse.click(bx.cx, bx.cy);
  await page.waitForTimeout(150);
  const m1 = await model(page, a);
  expect(m1.nCols, '★열 +1').toBe(3);
  expect(m1.nRows).toBe(1);
  expect(m1.domCells, '★DOM 칸 3').toBe(3);
  const cols = JSON.parse(m1.cols);
  expect(JSON.stringify(cols.slice(0, 2)), '★기존 두 열은 그대로(앞에 안 끼었다)').toBe(JSON.stringify(JSON.parse(m0.cols)));
  expect(cols[2], '★새 열은 «끝»에 · 피커 기본값').toEqual({ width: 1, lines: [{ type: 'body', text: '내용을 입력하세요.' }] });
  // 피커 결과와 같다
  expect(await pickViaPanel(page, b, 3, 1)).toBe(true);
  const mb = await model(page, b);
  expect({ cols: mb.cols, rows: mb.rows, cells: mb.cells }, '★패널 피커 결과 == ＋ 결과').toEqual({ cols: m1.cols, rows: m1.rows, cells: m1.cells });
  // undo 한 번 = 이전(＋ 한 번 = 한 걸음). b 의 피커 한 걸음부터 되돌린 뒤 a 를 본다.
  await page.evaluate(() => { window.undo(); window.undo(); });
  await page.waitForTimeout(150);
  const mu = await model(page, a);
  expect({ cols: mu.cols, rows: mu.rows, cells: mu.cells }, '★undo 2번(피커·＋) 뒤 a 는 처음').toEqual({ cols: m0.cols, rows: m0.rows, cells: m0.cells });
  expect(errs).toEqual([]);
});

test('P2 ★아래 ＋ 진짜 클릭 → 행이 «끝에» 하나 · 데이터·DOM · 피커 결과와 같다', async ({ page }) => {
  const { errs, a, b } = await setup(page);
  await force(page, a);
  const m0 = await model(page, a);
  const bx = await btnBox(page, a, 'row');
  expect(bx && bx.hitIsBtn, `전제 — 버튼이 잡힌다 ${JSON.stringify(bx)}`).toBe(true);
  await page.mouse.click(bx.cx, bx.cy);
  await page.waitForTimeout(150);
  const m1 = await model(page, a);
  expect(m1.nRows, '★행 +1').toBe(2);
  expect(m1.nCols).toBe(2);
  expect(m1.domCells, '★DOM 칸 4').toBe(4);
  expect(m1.lastRowCells, '★마지막 행(r=1)에 칸 2').toBe(2);
  expect(m1.cols, '★행 0(cols)은 그대로').toBe(m0.cols);
  const cells = JSON.parse(m1.cells);
  expect(cells[1], '★새 행은 «끝»(r=1) · 기본 줄').toEqual([
    { lines: [{ type: 'body', text: '내용을 입력하세요.' }] }, { lines: [{ type: 'body', text: '내용을 입력하세요.' }] }]);
  expect(await pickViaPanel(page, b, 2, 2)).toBe(true);
  const mb = await model(page, b);
  expect({ cols: mb.cols, rows: mb.rows, cells: mb.cells }, '★패널 피커 결과 == ＋ 결과').toEqual({ cols: m1.cols, rows: m1.rows, cells: m1.cells });
  expect(errs).toEqual([]);
});

test('P3 ★4×4 상한 — ＋ 흐림(disabled · --ui-disabled-opacity) · 눌러도 데이터 무변화', async ({ page }) => {
  const { errs, a } = await setup(page);
  await force(page, a);
  // 열 4 까지 ＋ 로 (2→4) — 그 사이 col 은 살아 있다
  for (let i = 0; i < 2; i++) {
    const bx = await btnBox(page, a, 'col');
    expect(bx.disabled, `전제 — ${2 + i}열에선 살아 있다`).toBe(false);
    expect(bx.hitIsBtn, `전제 — ${2 + i}열 ＋ 가운데가 눌린다 ${JSON.stringify(bx)}`).toBe(true);
    await page.mouse.click(bx.cx, bx.cy); await page.waitForTimeout(120);
  }
  let m = await model(page, a);
  expect(m.nCols, '전제 — 4열').toBe(4);
  let col = await btnBox(page, a, 'col'), row = await btnBox(page, a, 'row');
  expect(col.disabled, '★4열 → 열 ＋ 비활성').toBe(true);
  expect(col.opacity, '★흐림 = --ui-disabled-opacity').toBeCloseTo(col.tokenOpacity, 3);
  expect(col.opacity).toBeLessThan(1);
  expect(row.disabled, '★행은 아직 1 → 행 ＋ 살아 있다(축별 판정)').toBe(false);
  expect(row.opacity).toBe(1);
  const before = await model(page, a);
  await page.mouse.click(col.cx, col.cy); await page.waitForTimeout(150);
  expect(await model(page, a), '★흐린 열 ＋ 클릭 = 무변화').toEqual(before);
  // 행도 4 까지
  for (let i = 0; i < 3; i++) {
    const bx = await btnBox(page, a, 'row');
    await page.mouse.click(bx.cx, bx.cy); await page.waitForTimeout(120);
  }
  m = await model(page, a);
  expect({ c: m.nCols, r: m.nRows, dom: m.domCells }, '전제 — 4×4').toEqual({ c: 4, r: 4, dom: 16 });
  col = await btnBox(page, a, 'col'); row = await btnBox(page, a, 'row');
  expect([col.disabled, row.disabled], '★4×4 → 둘 다 비활성').toEqual([true, true]);
  await page.evaluate(() => { const o = window.pushHistory; window.__ph = 0; window.pushHistory = (...x) => { window.__ph++; return o(...x); }; });
  const b4 = await model(page, a);
  await page.mouse.click(col.cx, col.cy); await page.waitForTimeout(120);
  await page.mouse.click(row.cx, row.cy); await page.waitForTimeout(120);
  expect(await model(page, a), '★4×4 에서 두 ＋ 클릭 = 무변화').toEqual(b4);
  expect(await page.evaluate(() => window.__ph), '★pushHistory 0회(히스토리도 안 쌓였다)').toBe(0);
  expect(errs).toEqual([]);
});

for (const z of [40, 100]) {
  test(`P4 ★배율 ${z}% — 히트 영역이 화면에서 ≈40px · 진짜 클릭이 먹는다`, async ({ page }) => {
    const { errs, a } = await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), `★재기 전 — 배율이 정말 ${z}`).toBe(z);
    await force(page, a);
    for (const axis of ['col', 'row']) {
      const bx = await btnBox(page, a, axis);
      expect(bx, `${axis} ＋ 가 있다`).not.toBeNull();
      expect(Math.abs(bx.w - 40), `★${axis} 폭 ${bx.w}px ≈ 40`).toBeLessThanOrEqual(1);
      expect(Math.abs(bx.h - 40), `★${axis} 높이 ${bx.h}px ≈ 40`).toBeLessThanOrEqual(1);
      expect(bx.hitIsBtn, `★${axis} 가운데 elementFromPoint = 버튼 ${JSON.stringify(bx)}`).toBe(true);
    }
    // 가장자리 안쪽 4px 도 버튼이 잡는다(히트 = 보이는 원 상자 전체)
    const edge = await page.evaluate((id) => {
      const b = document.querySelector(`#${id} > .grd-add-btn[data-grd-add="col"]`); const r = b.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + 4) === b;
    }, a);
    expect(edge, '★위 가장자리 4px 안쪽도 버튼').toBe(true);
    const bx = await btnBox(page, a, 'col');
    await page.mouse.click(bx.cx, bx.cy); await page.waitForTimeout(150);
    expect((await model(page, a)).nCols, `★${z}% 진짜 클릭 → 열 +1`).toBe(3);
    expect(errs).toEqual([]);
  });
}

test('P5 저장·내보내기에 ＋ 가 안 샌다(편집 전용)', async ({ page }) => {
  const { errs, a } = await setup(page);
  await force(page, a);
  const r = await page.evaluate((id) => {
    const g = document.getElementById(id);
    const sec = g.closest('.section-block');
    const live = g.querySelectorAll('.grd-add-btn').length;
    const ser = window.serializeCleanRoot ? window.serializeCleanRoot(sec.cloneNode(true)) : null;
    const serHtml = ser == null ? null : (typeof ser === 'string' ? ser : ser.outerHTML);
    return { live, ser: serHtml == null ? null : (serHtml.match(/grd-add-btn/g) || []).length };
  }, a);
  expect(r.live, '전제 — 라이브에는 둘').toBe(2);
  if (r.ser !== null) expect(r.ser, '★직렬화본엔 0').toBe(0);
  expect(errs).toEqual([]);
});

test('P6 ★호버 ＋ 가 «블럭 고르기» 첫 클릭을 안 먹는다 — 1행 그리드 가운데 클릭 = 선택 · 행·열 그대로', async ({ page }) => {
  const { errs, a } = await setup(page);
  const m0 = await model(page, a);
  const [x, y] = await page.evaluate((id) => { const g = document.getElementById(id); g.scrollIntoView({ block: 'center' });
    const r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, a);
  expect(await page.evaluate((id) => document.getElementById(id).getBoundingClientRect().height, a), '전제 — 1행 그리드는 ＋(40) 보다 낮다').toBeLessThan(80);
  await page.mouse.move(x, y, { steps: 4 }); await page.waitForTimeout(80);
  expect((await vis(page, a)).row.present, '전제 — 호버로 ＋ 가 떴다').toBe(true);
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), a), '★가운데 클릭 = 블럭 선택').toBe(true);
  const m1 = await model(page, a);
  expect({ cols: m1.cols, rows: m1.rows, cells: m1.cells }, '★행·열 무변화').toEqual({ cols: m0.cols, rows: m0.rows, cells: m0.cells });
  expect(errs).toEqual([]);
});


/* ══ R — 「정확히 ＋ 버튼을 눌러야지만 추가」(현빈 2026-10-04) ══════════════════════════════
 * ＋ 자리는 그대로(오른쪽 = 안쪽 끝 · 아래 = 바로 아래 바깥). ＋ «원» 밖은 클릭이 그리드로 간다.
 * ★핵심 R5: 둥근 ＋ 의 «네모 상자 모서리»(원 밖) — 네모 히트였다면 ＋ 가 먹었을 자리 — 를 누르면 선택.
 * 전제: 그리드를 3행으로 키워 오른쪽 ＋ 상자(화면 40px)가 세로로 그리드 «안»에 다 들어오게 한다.
 *   (1행 그리드는 ＋ 보다 낮아 ＋ 상자 모서리가 그리드 밖이 된다 — 그러면 「선택」을 잴 수 없다.) */
async function tall(page, id) {
  await page.evaluate((id) => { const g = document.getElementById(id); window.gridAddAtEnd(g, 'row'); window.gridAddAtEnd(g, 'row'); window.deselectAll?.(); }, id);
  await page.waitForTimeout(100);
}
/* 한 점을 진짜 마우스로 누르고, 그 전에 무엇이 잡혔는지·뒤에 무엇이 바뀌었는지 */
async function clickAt(page, id, x, y) {
  await page.mouse.move(x, y, { steps: 3 }); await page.waitForTimeout(80);
  const under = await page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? `${h.tagName.toLowerCase()}.${[...h.classList].join('.')}` : 'null'; }, [x, y]);
  const m0 = await model(page, id);
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  const m1 = await model(page, id);
  const selected = await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id);
  return { under, selected, dCols: m1.nCols - m0.nCols, dRows: m1.nRows - m0.nRows };
}
const boxOf = (page, id, axis) => page.evaluate(([id, axis]) => {
  const g = document.getElementById(id), r = g.querySelector(`:scope > .grd-add-btn[data-grd-add="${axis}"]`).getBoundingClientRect(), gr = g.getBoundingClientRect();
  return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, g: { l: gr.left, t: gr.top, r: gr.right, b: gr.bottom } };
}, [id, axis]);

for (const z of [100, 40]) {
  test(`R1·R2·R5 오른쪽 ＋ · 배율 ${z} — 1px 옆 = 선택 · 정중앙 = 열 추가 · 원 밖 네모 모서리 = 선택`, async ({ page }) => {
    test.setTimeout(120000);
    const { errs, a } = await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${z}`).toBe(z);
    await tall(page, a);
    await force(page, a);
    let bx = await boxOf(page, a, 'col');
    expect(bx.w, '전제 — ＋ 상자 40px').toBeCloseTo(40, 0);
    expect(bx.t >= bx.g.t + 1 && bx.b <= bx.g.b - 1, `전제 — ＋ 상자가 세로로 그리드 안 ${JSON.stringify(bx)}`).toBe(true);
    // R1 ＋ 상자 1px 옆(왼쪽 — 오른쪽은 블럭 밖이다) · 세로 가운데
    const r1 = await clickAt(page, a, bx.l - 1, bx.cy);
    expect(r1, `★R1 1px 옆 = 선택 · 열 그대로 ${JSON.stringify(r1)}`).toMatchObject({ selected: true, dCols: 0, dRows: 0 });
    // R5 원 밖 네모 모서리(왼쪽 위 · 왼쪽 아래 · 오른쪽 위 — 상자 안 3px, 중심까지 ≈24px > 반지름 20)
    for (const [nm, x, y] of [['좌상', bx.l + 3, bx.t + 3], ['좌하', bx.l + 3, bx.b - 3], ['우상', bx.r - 3, bx.t + 3]]) {
      await page.evaluate(() => window.deselectAll?.()); await force(page, a);
      bx = await boxOf(page, a, 'col');
      const r5 = await clickAt(page, a, nm === '우상' ? bx.r - 3 : bx.l + 3, nm === '좌하' ? bx.b - 3 : bx.t + 3);
      expect(r5, `★R5 ${nm} 모서리(원 밖) = 선택 · 열 그대로 ${JSON.stringify(r5)}`).toMatchObject({ selected: true, dCols: 0 });
      expect(r5.under.includes('grd-add-btn'), `★R5 ${nm} 모서리에서 ＋ 가 잡히지 않는다 ${r5.under}`).toBe(false);
    }
    // R2 정중앙 = 열 추가
    await page.evaluate(() => window.deselectAll?.()); await force(page, a);
    bx = await boxOf(page, a, 'col');
    const r2 = await clickAt(page, a, bx.cx, bx.cy);
    expect(r2, `★R2 정중앙 = 열 +1 ${JSON.stringify(r2)}`).toMatchObject({ dCols: 1, dRows: 0 });
    expect(errs).toEqual([]);
  });

  test(`R4 아래 ＋ · 배율 ${z} — 정중앙 = 행 추가 · 원 밖 네모 모서리 = ＋ 아님(행 그대로)`, async ({ page }) => {
    test.setTimeout(120000);
    const { errs, a } = await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${z}`).toBe(z);
    await force(page, a);
    let bx = await boxOf(page, a, 'row');
    expect(Math.abs(bx.t - bx.g.b), '전제 — 아래 ＋ 는 그리드 바로 아래').toBeLessThanOrEqual(1);
    for (const [nm, x, y] of [['좌하', bx.l + 3, bx.b - 3], ['우하', bx.r - 3, bx.b - 3]]) {
      const r = await clickAt(page, a, x, y);
      expect(r.under.includes('grd-add-btn'), `★아래 ＋ ${nm} 모서리(원 밖)에서 ＋ 가 잡히지 않는다 ${JSON.stringify(r)}`).toBe(false);
      expect(r.dRows, `★아래 ＋ ${nm} 모서리 = 행 그대로 ${JSON.stringify(r)}`).toBe(0);
      await force(page, a);
    }
    bx = await boxOf(page, a, 'row');
    const r2 = await clickAt(page, a, bx.cx, bx.cy);
    expect(r2, `★아래 ＋ 정중앙 = 행 +1 ${JSON.stringify(r2)}`).toMatchObject({ dRows: 1, dCols: 0 });
    expect(errs).toEqual([]);
  });
}

/* R6 — 낮은 1행 그리드(＋ 40 보다 낮다): 위쪽 가까이, ＋ 상자 안이지만 «원 밖» 점 첫 클릭 = 선택 (측정표 Q2 의 짝)
 * ⚠️배율 100 만 돈다. 40% 에선 1행 그리드가 화면 14px 라 ＋ 상자 안의 그리드 점이 «전부 원 안»이다
 *   (실측 2026-10-04: 그리드 t=715·b=729, ＋ 중심 y=722 · 반지름 20 → 원 밖인 그리드 점 0) — 잴 점이 없다. */
for (const z of [100]) {
  test(`R6 낮은 그리드 · 배율 ${z} — 위쪽 가까이 ＋ 원 밖 점 첫 클릭 = 선택 · 열 그대로`, async ({ page }) => {
    test.setTimeout(120000);
    const { errs, a } = await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${z}`).toBe(z);
    await force(page, a);
    const bx = await boxOf(page, a, 'col');
    const gh = bx.g.b - bx.g.t;
    expect(gh, `전제 — 그리드(${gh.toFixed(1)}px)가 ＋(40) 보다 낮다`).toBeLessThan(40);
    // 그리드 안 · ＋ 상자 안 · 원 밖인 점을 위쪽에서 찾는다(그리드 위 끝 +3px, ＋ 상자 왼쪽에서 오른쪽으로 훑음)
    const y = bx.g.t + 3, R = bx.w / 2;
    let x = null;
    for (let px = bx.l + 1; px < bx.r - 1; px += 1) {
      const d = Math.hypot(px - bx.cx, y - bx.cy);
      if (d > R + 1.5 && px >= bx.g.l && px <= bx.g.r - 1) { x = px; break; }
    }
    expect(x, `전제 — 그리드 안·＋ 상자 안·원 밖인 위쪽 점이 있다 ${JSON.stringify(bx)}`).not.toBeNull();
    const r = await clickAt(page, a, x, y);
    expect(r, `★R6 원 밖 위쪽 점 = 선택 · 열 그대로 ${JSON.stringify({ x, y, ...r })}`).toMatchObject({ selected: true, dCols: 0, dRows: 0 });
    expect(r.under.includes('grd-add-btn'), `★R6 ＋ 가 안 잡힌다 ${r.under}`).toBe(false);
    expect(errs).toEqual([]);
  });
}

/* ══ K — G19 자식(그리드 밑에 쌓인 블럭)이 있는 그리드 + ＋ (5015a2ab 위로 옮긴 뒤, 팀리드 2026-10-04) ══════════
 * 그릇 .grd-children 은 그리드의 직계, ＋ 도 직계다. 렌더(replaceShellKeepChildren)는 그릇 «말고» 직계를 다 지우고
 * 껍데기를 그릇 «앞»에 넣는다 → 그 뒤 _syncGridAddBtns 가 ＋ 를 «끝에» 다시 단다.
 * 재는 것: 직계 순서 · ＋ 개수(중복 없음) · 아래 ＋ 자리(블럭 전체 아래 = 자식 아래) · 자식과 겹침 0 · 클릭 = 행 +1 · 자식 그대로. */
async function withKids(page, id) {
  await page.evaluate((id) => {
    const g = document.getElementById(id);
    const box = window.ensureGridKidsBox(g);
    for (const k of ['kA', 'kB']) box.insertAdjacentHTML('beforeend', `<div class="row" id="r${k}"><div class="text-block" data-type="heading" id="${k}"><div class="tb-h2">자식 ${k}</div></div></div>`);
    window.rebindAll?.(); window.renderGridBlock(g);
  }, id);
  await page.waitForTimeout(150);
}
const kidState = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id), R = (e) => { const r = e.getBoundingClientRect(); return { t: +r.top.toFixed(1), b: +r.bottom.toFixed(1), l: +r.left.toFixed(1), r: +r.right.toFixed(1) }; };
  const box = g.querySelector(':scope > .grd-children');
  const btn = (a) => g.querySelector(`:scope > .grd-add-btn[data-grd-add="${a}"]`);
  return {
    order: [...g.children].map(c => c.classList.contains('grd-add-btn') ? `btn:${c.dataset.grdAdd}` : c.className.split(' ')[0]),
    kids: box ? [...box.querySelectorAll('.text-block')].map(k => k.id) : [],
    block: R(g), inner: R(g.querySelector(':scope > .grd-inner')), kidsBox: box ? R(box) : null,
    col: btn('col') ? R(btn('col')) : null, row: btn('row') ? R(btn('row')) : null,
    nRows: g.dataset.rows ? JSON.parse(g.dataset.rows).length : 1,
  };
}, id);
const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

test('K1 ★자식 있는 그리드 — 렌더 뒤 직계 순서·＋ 둘(중복 없음) · 아래 ＋ = 블럭 전체(자식 포함) 바로 아래 · 자식과 겹침 0', async ({ page }) => {
  const { errs, a } = await setup(page);
  await withKids(page, a);
  await force(page, a);
  const s0 = await kidState(page, a);
  expect(s0.kids, '전제 — 자식 둘').toEqual(['kA', 'kB']);
  expect(s0.kidsBox.t, '전제 — 그릇은 껍데기 아래').toBeGreaterThanOrEqual(s0.inner.b - 1);
  // 재렌더 한 번 더(＋ 가 붙은 채로) — 순서·개수가 그대로인가
  await page.evaluate((id) => window.renderGridBlock(document.getElementById(id)), a);
  await page.waitForTimeout(80);
  const s = await kidState(page, a);
  const msg = JSON.stringify(s);
  expect(s.order, `★직계 순서 ${msg}`).toEqual(['grd-inner', 'grd-children', 'btn:col', 'btn:row']);
  expect(s.kids, '★자식 그대로').toEqual(['kA', 'kB']);
  expect(Math.abs(s.row.t - s.block.b), `★아래 ＋ = 블럭 전체(자식 포함) 바로 아래 ${msg}`).toBeLessThanOrEqual(1);
  expect(overlap(s.row, s.kidsBox), `★아래 ＋ 와 자식 그릇 겹침 0 ${msg}`).toBe(0);
  console.log('K1-geo', msg);
  expect(errs).toEqual([]);
});

test('K2 ★자식 있는 그리드 — 아래 ＋ 진짜 클릭 = 행 +1 · 자식 그대로(순서·개수) · undo 한 번 = 처음', async ({ page }) => {
  const { errs, a } = await setup(page);
  await withKids(page, a);
  await force(page, a);
  const s0 = await kidState(page, a);
  const m0 = await model(page, a);
  expect(s0.row.b, `전제 — 아래 ＋ 가 화면 안 ${JSON.stringify(s0)}`).toBeLessThan(1400);
  const bx = await btnBox(page, a, 'row');
  expect(bx && bx.hitIsBtn, `전제 — 아래 ＋ 가 눌린다 ${JSON.stringify(bx)}`).toBe(true);
  await page.mouse.click(bx.cx, bx.cy); await page.waitForTimeout(200);
  const s1 = await kidState(page, a);
  expect(s1.nRows, '★행 +1').toBe(s0.nRows + 1);
  expect(s1.kids, '★자식 그대로').toEqual(['kA', 'kB']);
  expect(s1.order.slice(0, 2), '★껍데기·그릇 순서 그대로').toEqual(['grd-inner', 'grd-children']);
  expect(s1.kidsBox.t, '★그릇은 여전히 (늘어난) 껍데기 아래').toBeGreaterThanOrEqual(s1.inner.b - 1);
  await page.evaluate(() => window.undo()); await page.waitForTimeout(200);
  const mu = await model(page, a);
  expect({ cols: mu.cols, rows: mu.rows, cells: mu.cells }, '★undo 한 번 = 처음').toEqual({ cols: m0.cols, rows: m0.rows, cells: m0.cells });
  const ku = await page.evaluate((id) => [...document.querySelectorAll(`#${id} > .grd-children .text-block`)].map(k => k.id), a);
  expect(ku, '★undo 뒤 자식 그대로').toEqual(['kA', 'kB']);
  expect(errs).toEqual([]);
});

test('K3 자식 있는 그리드 — 자식 위에 마우스 = 그리드 호버로 ＋ 뜬다 · 오른쪽 ＋ 세로 자리 기록', async ({ page }) => {
  const { errs, a } = await setup(page);
  await withKids(page, a);
  const k = await page.evaluate(() => { const r = document.getElementById('kB').getBoundingClientRect(); return [r.left + r.width * 0.25, r.top + r.height / 2]; });
  await page.mouse.move(k[0], k[1], { steps: 4 }); await page.waitForTimeout(100);
  const s = await kidState(page, a);
  expect(s.col && s.row, `★자식 위 호버 → ＋ 둘 ${JSON.stringify(s)}`).toBeTruthy();
  console.log('K3-geo', JSON.stringify({ colMidY: (s.col.t + s.col.b) / 2, inner: s.inner, kidsBox: s.kidsBox, block: s.block }));
  expect(errs).toEqual([]);
});
