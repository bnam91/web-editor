/* grid-plus-g15.dom.spec.js — G15 그리드 캔버스 ＋ (2026-10-04 현빈·지디, 안 ㉠)
 *   오른쪽 끝 ＋ = 열 하나를 «끝에» · 아래 끝 ＋ = 행 하나를 «끝에». 4×4 상한에선 흐리고 눌러도 무변화.
 *   ~~히트 영역 = calc(40px * var(--inv-zoom)) — 화면에서 늘 ≈40px~~ ⇒ ★H9(2026-10-05): 40×40 «모델 px»(화면 = 40 × 배율) · 태그블럭 ＋ 꼴.
 *
 * ~~★뜨는 조건 = 그리드 블럭 «전체» 호버(2026-10-04 현빈 결정 — 태그블럭 ＋ 의 «선택» 선례와 다른 것이 의도)~~
 *   ⇒ ★H8(2026-10-05 현빈 재지시): 뜨는 조건 = 그리드 «선택». 진짜 클릭으로 고른다(force) — V1~V3 이 뜨고·지는 것을 잰다.
 * ★자리 H10(2026-10-05): 오른쪽 ＋ 중심 = 블럭 오른쪽 끝(옛: 안쪽 한 칸) · 아래 ＋ = 껍데기 바로 아래(자리 그대로 · 크기만 모델 40 — 행 손잡이와 겹쳐 중심을 못 올림).
 *   이 파일의 «옛 계약» 단언(호버 · 화면 40 · 안쪽/매달림)은 2026-10-05 에 새 계약으로 «뒤집었다» — 뒤집은 것이 고친 증거다.
 *   새 계약 묶음 시험 = tests/dom/grid-plus-e1.dom.spec.js.
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
  /* 자식(G19) 있는 그리드는 블럭 가운데가 자식 위다 — 격자 껍데기(.grd-inner) 가운데를 누른다(고르기 = 그리드). */
  const r = (g.querySelector(':scope > .grd-inner') || g).getBoundingClientRect(); return [r.left + r.width * 0.25, r.top + r.height / 2];
}, id);
/* 그리드 «밖» 한 점 — 블럭 위 30px(위 gap 블럭) */
const outsidePoint = (page, id) => page.evaluate((id) => {
  const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * 0.25, r.top - 30];
}, id);
/* ＋ 가 붙는 유일한 길 = 그리드를 «진짜 클릭으로 고른다»(H8 · 2026-10-05 현빈 재지시). 옛: 그리드 위에 마우스를 올림(호버 · 2026-10-04).
   첫 클릭 = 블럭 선택(T-058) — 그리드 안쪽 왼쪽 1/4 점(＋ 둘과 안 겹치는 자리). 고른 뒤 상태 대기. */
async function force(page, id) {
  const [x, y] = await gridPoint(page, id);
  await page.mouse.click(x, y);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected')
    && document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"]`).length === 2, id, { timeout: 3000 });
}
/* ＋ 가 «보이고 눌리는가» — 없으면 그 자리에 무엇이 잡히는지도 본다 */
const vis = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id), gr = g.getBoundingClientRect();
  const out = {};
  for (const axis of ['col', 'row']) {
    const b = document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${g.id}"][data-grd-add="${axis}"]`);
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
  /* 층(#grd-plus-layer)을 먼저 본다. 없으면 옛 구조(블럭 안 ＋)도 찾는다 — 양성대조(옛 구조 핀)가 «＋ 없음»이 아니라 «덮였다»로 빨개지게. */
  const b = document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"][data-grd-add="${axis}"]`) || document.querySelector(`#${id} > .grd-add-btn[data-grd-add="${axis}"]`);
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

test('V2 ★H8 — 그리드 위 «호버만»(안 고름) → ＋ 안 보임 · 고르면 → 두 ＋ 보이고 눌린다', async ({ page }) => {
  const { errs, a } = await setup(page);
  const [x, y] = await gridPoint(page, a);
  await page.mouse.move(x, y, { steps: 4 });
  await page.waitForFunction((id) => document.getElementById(id).matches(':hover'), a, { timeout: 3000 });
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), a), '전제 — 선택 안 됨(호버만)').toBe(false);
  expect(await vis(page, a), '★호버만 → 둘 다 없다(옛: 보였다)').toEqual({ col: HIDDEN, row: HIDDEN });
  await force(page, a);
  expect(await vis(page, a), '★고르면 → 둘 다 보이고 눌린다').toEqual({ col: SHOWN, row: SHOWN });
  expect(errs).toEqual([]);
});

test('V3 ★H8 — 고른 채로 마우스가 벗어나도 보인다 · 다른 것을 고르면(선택 풀림) → 안 보임', async ({ page }) => {
  const { errs, a } = await setup(page);
  await force(page, a);
  const [ox, oy] = await outsidePoint(page, a);
  await page.mouse.move(ox, oy, { steps: 4 });
  await page.waitForFunction((id) => !document.getElementById(id).matches(':hover'), a, { timeout: 3000 });
  expect(await vis(page, a), '★고른 채 마우스 밖 → 그대로 보인다(옛: 사라졌다)').toEqual({ col: SHOWN, row: SHOWN });
  await page.mouse.click(ox, oy);   // 위 gap 블럭 클릭 = 그리드 선택 풀림
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('selected'), a, { timeout: 3000 });
  expect(await vis(page, a), '★선택 풀림 → 둘 다 사라진다').toEqual({ col: HIDDEN, row: HIDDEN });
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

/* 10-05 K5 로 뒤집음 · 옛 단언 = 「4×4 상한 — 4열에서 열 ＋ 흐림 · 행 4 까지 · 4×4(dom 16) → 둘 다 비활성」(옛 제목 'P3 ★4×4 상한 — …') */
test('P3 ★8×8 상한(K5 10-05) — ＋ 흐림(disabled · --ui-disabled-opacity) · 눌러도 데이터 무변화', async ({ page }) => {
  const { errs, a } = await setup(page);
  await force(page, a);
  // 열 8 까지 ＋ 로 (2→8) — 그 사이 col 은 살아 있다
  for (let i = 0; i < 6; i++) {
    const bx = await btnBox(page, a, 'col');
    expect(bx.disabled, `전제 — ${2 + i}열에선 살아 있다`).toBe(false);
    expect(bx.hitIsBtn, `전제 — ${2 + i}열 ＋ 가운데가 눌린다 ${JSON.stringify(bx)}`).toBe(true);
    await page.mouse.click(bx.cx, bx.cy); await page.waitForTimeout(120);
  }
  let m = await model(page, a);
  expect(m.nCols, '전제 — 8열').toBe(8);
  let col = await btnBox(page, a, 'col'), row = await btnBox(page, a, 'row');
  expect(col.disabled, '★8열 → 열 ＋ 비활성').toBe(true);
  expect(col.opacity, '★흐림 = --ui-disabled-opacity').toBeCloseTo(col.tokenOpacity, 3);
  expect(col.opacity).toBeLessThan(1);
  expect(row.disabled, '★행은 아직 1 → 행 ＋ 살아 있다(축별 판정)').toBe(false);
  expect(row.opacity).toBe(1);
  const before = await model(page, a);
  await page.mouse.click(col.cx, col.cy); await page.waitForTimeout(150);
  expect(await model(page, a), '★흐린 열 ＋ 클릭 = 무변화').toEqual(before);
  // 행도 8 까지 — ★K5(10-05): 행이 늘수록 행 ＋(아래 가운데)가 내려가 화면 밖으로 나갈 수 있다(4×4 땐 안 나갔음) ⇒ 누르기 전 보이게 하고 맞힘 단언(열 고리와 같은 꼴)
  for (let i = 0; i < 7; i++) {
    await page.evaluate((id) => document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"][data-grd-add="row"]`)?.scrollIntoView({ block: 'center' }), a);
    await page.waitForTimeout(80);
    const bx = await btnBox(page, a, 'row');
    expect(bx.hitIsBtn, `전제 — ${1 + i}행 ＋ 가운데가 눌린다 ${JSON.stringify(bx)}`).toBe(true);
    await page.mouse.click(bx.cx, bx.cy); await page.waitForTimeout(120);
  }
  m = await model(page, a);
  expect({ c: m.nCols, r: m.nRows, dom: m.domCells }, '전제 — 8×8').toEqual({ c: 8, r: 8, dom: 64 });
  col = await btnBox(page, a, 'col'); row = await btnBox(page, a, 'row');
  expect([col.disabled, row.disabled], '★8×8 → 둘 다 비활성').toEqual([true, true]);
  await page.evaluate(() => { const o = window.pushHistory; window.__ph = 0; window.pushHistory = (...x) => { window.__ph++; return o(...x); }; });
  const b4 = await model(page, a);
  await page.mouse.click(col.cx, col.cy); await page.waitForTimeout(120);
  await page.mouse.click(row.cx, row.cy); await page.waitForTimeout(120);
  expect(await model(page, a), '★8×8 에서 두 ＋ 클릭 = 무변화').toEqual(b4);
  expect(await page.evaluate(() => window.__ph), '★pushHistory 0회(히스토리도 안 쌓였다)').toBe(0);
  expect(errs).toEqual([]);
});

for (const z of [40, 100]) {
  test(`P4 ★배율 ${z}% — ＋ 화면 크기 = 40 × 배율(모델 40 · H9) · 진짜 클릭이 먹는다`, async ({ page }) => {
    const { errs, a } = await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), `★재기 전 — 배율이 정말 ${z}`).toBe(z);
    await force(page, a);
    for (const axis of ['col', 'row']) {
      const bx = await btnBox(page, a, axis);
      expect(bx, `${axis} ＋ 가 있다`).not.toBeNull();
      expect(Math.abs(bx.w - 40 * z / 100), `★${axis} 폭 ${bx.w}px ≈ ${40 * z / 100}(모델 40 × 배율 · 옛: 화면 40 고정)`).toBeLessThanOrEqual(1);
      expect(Math.abs(bx.h - 40 * z / 100), `★${axis} 높이 ${bx.h}px ≈ ${40 * z / 100}`).toBeLessThanOrEqual(1);
      expect(bx.hitIsBtn, `★${axis} 가운데 elementFromPoint = 버튼 ${JSON.stringify(bx)}`).toBe(true);
    }
    // 가장자리 안쪽 4px 도 버튼이 잡는다(히트 = 보이는 원 상자 전체)
    const edge = await page.evaluate((id) => {
      const b = document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"][data-grd-add="col"]`); const r = b.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(4, r.height / 4)) === b;
    }, a);
    expect(edge, '★위 가장자리 안쪽(4px · 작으면 1/4)도 버튼').toBe(true);
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
    const live = document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"]`).length;
    const inBlock = g.querySelectorAll('.grd-add-btn').length;
    const ser = window.serializeCleanRoot ? window.serializeCleanRoot(sec.cloneNode(true)) : null;
    const serHtml = ser == null ? null : (typeof ser === 'string' ? ser : ser.outerHTML);
    return { live, inBlock, ser: serHtml == null ? null : (serHtml.match(/grd-add-btn/g) || []).length };
  }, a);
  expect(r.live, '전제 — 라이브(＋ 층)에는 둘').toBe(2);
  expect(r.inBlock, '★＋ 는 블럭 DOM «안»에 없다(E65)').toBe(0);
  if (r.ser !== null) expect(r.ser, '★직렬화본엔 0').toBe(0);
  expect(errs).toEqual([]);
});

test('P6 ★H8 — 고르기 «전»엔 ＋ 가 없다 · 1행 그리드 가운데 첫 클릭 = 선택 · 행·열 그대로 · 그 뒤 ＋ 둘', async ({ page }) => {
  const { errs, a } = await setup(page);
  const m0 = await model(page, a);
  const [x, y] = await page.evaluate((id) => { const g = document.getElementById(id); g.scrollIntoView({ block: 'center' });
    const r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, a);
  expect(await page.evaluate((id) => document.getElementById(id).getBoundingClientRect().height, a), '전제 — 1행 그리드는 ＋(40) 보다 낮다').toBeLessThan(80);
  await page.mouse.move(x, y, { steps: 4 });
  await page.waitForFunction((id) => document.getElementById(id).matches(':hover'), a, { timeout: 3000 });
  expect((await vis(page, a)).row.present, '★고르기 전(호버 중)엔 ＋ 없다(옛: 떴다)').toBe(false);
  await page.mouse.click(x, y);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), a, { timeout: 3000 });
  expect(await page.evaluate((id) => document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"]`).length, a), '★고른 뒤 ＋ 둘').toBe(2);
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
  const sel = await page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map(e => e.id || e.className.split(' ')[0]));
  return { under, selected, sel, dCols: m1.nCols - m0.nCols, dRows: m1.nRows - m0.nRows };
}
const boxOf = (page, id, axis) => page.evaluate(([id, axis]) => {
  const g = document.getElementById(id), r = document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${g.id}"][data-grd-add="${axis}"]`).getBoundingClientRect(), gr = g.getBoundingClientRect();
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
    expect(bx.w, `전제 — ＋ 상자 ${40 * z / 100}px(모델 40)`).toBeCloseTo(40 * z / 100, 0);
    const o = bx.w >= 30 ? 3 : 1;   // 원 밖 모서리 점: 상자 안 o px(작은 원에서 3px 는 원 안이다 — 16px 상자: √(5²+5²)=7.1 < 8)
    expect(bx.t >= bx.g.t + 1 && bx.b <= bx.g.b - 1, `전제 — ＋ 상자가 세로로 그리드 안 ${JSON.stringify(bx)}`).toBe(true);
    // R1 ＋ 상자 1px 옆(왼쪽 — 오른쪽은 블럭 밖이다) · 세로 가운데
    const r1 = await clickAt(page, a, bx.l - 1, bx.cy);
    expect(r1, `★R1 1px 옆 = 선택 · 열 그대로 ${JSON.stringify(r1)}`).toMatchObject({ selected: true, dCols: 0, dRows: 0 });
    // R5 원 밖 네모 모서리(왼쪽 위 · 왼쪽 아래 · 오른쪽 위 — 상자 안 3px, 중심까지 ≈24px > 반지름 20)
    /* H10 뒤: 오른쪽 ＋ 는 반이 블럭 밖이다 — 왼쪽 모서리 = 그리드 위(선택) · 오른쪽 모서리 = 블럭 밖(＋ 아님 · 열 그대로만 잰다). */
    for (const [nm, inGrid] of [['좌상', true], ['좌하', true], ['우상', false]]) {
      await page.evaluate(() => window.deselectAll?.()); await force(page, a);
      bx = await boxOf(page, a, 'col');
      const r5 = await clickAt(page, a, nm === '우상' ? bx.r - o : bx.l + o, nm === '좌하' ? bx.b - o : bx.t + o);
      expect(r5, `★R5 ${nm} 모서리(원 밖) = 열 그대로${inGrid ? ' · 선택' : ''} ${JSON.stringify(r5)}`).toMatchObject(inGrid ? { selected: true, dCols: 0 } : { dCols: 0 });
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
    const o = bx.w >= 30 ? 3 : 1;
    for (const [nm, x, y] of [['좌하', bx.l + o, bx.b - o], ['우하', bx.r - o, bx.b - o]]) {
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
  const btn = (a) => document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"][data-grd-add="${a}"]`);
  return {
    order: [...g.children].map(c => c.classList.contains('grd-add-btn') ? `btn:${c.dataset.grdAdd}` : c.className.split(' ')[0]),
    kids: box ? [...box.querySelectorAll('.text-block')].map(k => k.id) : [],
    block: R(g), inner: R(g.querySelector(':scope > .grd-inner')), kidsBox: box ? R(box) : null,
    col: btn('col') ? R(btn('col')) : null, row: btn('row') ? R(btn('row')) : null,
    nRows: g.dataset.rows ? JSON.parse(g.dataset.rows).length : 1,
  };
}, id);
const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

test('K1 ★자식 있는 그리드 — 렌더 뒤 직계 순서·＋ 둘(중복 없음) · 오른쪽 ＋ = 껍데기 세로 가운데 · 아래 ＋ = 껍데기 바로 아래', async ({ page }) => {
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
  expect(s.order, `★직계 순서(＋ 는 블럭 밖 층 — 블럭 직계에 없다) ${msg}`).toEqual(['grd-inner', 'grd-children']);
  expect(!!(s.col && s.row), `★＋ 둘이 층에 있다 ${msg}`).toBe(true);
  expect(s.kids, '★자식 그대로').toEqual(['kA', 'kB']);
  // ★기준 = 격자 껍데기(.grd-inner) — 태양 2026-10-04
  const colMid = (s.col.t + s.col.b) / 2;
  expect(colMid >= s.inner.t - 0.5 && colMid <= s.inner.b + 0.5, `★오른쪽 ＋ 가운데 ∈ 껍데기 세로 범위 ${msg}`).toBe(true);
  expect(Math.abs(colMid - (s.inner.t + s.inner.b) / 2), `★오른쪽 ＋ = 껍데기 세로 가운데 ${msg}`).toBeLessThanOrEqual(1);
  expect(Math.abs(s.row.t - s.inner.b), `★아래 ＋ 위 끝 = 껍데기 아래 끝 ${msg}`).toBeLessThanOrEqual(1);
  console.log('K1-geo', msg, 'rowXkids_overlap_px2', overlap(s.row, s.kidsBox), 'rowXkids_dy', +(s.row.b - s.kidsBox.t).toFixed(1));
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
  expect(s1.order, '★껍데기·그릇 순서 그대로(＋ 는 블럭 밖)').toEqual(['grd-inner', 'grd-children']);
  expect(s1.kidsBox.t, '★그릇은 여전히 (늘어난) 껍데기 아래').toBeGreaterThanOrEqual(s1.inner.b - 1);
  await page.evaluate(() => window.undo()); await page.waitForTimeout(200);
  const mu = await model(page, a);
  expect({ cols: mu.cols, rows: mu.rows, cells: mu.cells }, '★undo 한 번 = 처음').toEqual({ cols: m0.cols, rows: m0.rows, cells: m0.cells });
  const ku = await page.evaluate((id) => [...document.querySelectorAll(`#${id} > .grd-children .text-block`)].map(k => k.id), a);
  expect(ku, '★undo 뒤 자식 그대로').toEqual(['kA', 'kB']);
  expect(errs).toEqual([]);
});

test('K3 자식 있는 그리드 — 자식 위 호버만으론 ＋ 없음(H8) · 그리드를 고르면 ＋ 둘 · 오른쪽 ＋ 세로 자리 기록', async ({ page }) => {
  const { errs, a } = await setup(page);
  await withKids(page, a);
  const k = await page.evaluate(() => { const r = document.getElementById('kB').getBoundingClientRect(); return [r.left + r.width * 0.25, r.top + r.height / 2]; });
  await page.mouse.move(k[0], k[1], { steps: 4 });
  await page.waitForFunction((id) => document.getElementById(id).matches(':hover'), a, { timeout: 3000 });
  const s0 = await kidState(page, a);
  expect(!!(s0.col || s0.row), `★자식 위 호버만 → ＋ 없다(옛: 떴다) ${JSON.stringify(s0)}`).toBe(false);
  await force(page, a);
  const s = await kidState(page, a);
  expect(s.col && s.row, `★고르면 → ＋ 둘 ${JSON.stringify(s)}`).toBeTruthy();
  console.log('K3-geo', JSON.stringify({ colMidY: (s.col.t + s.col.b) / 2, inner: s.inner, kidsBox: s.kidsBox, block: s.block }));
  expect(errs).toEqual([]);
});

test('K0 자식 «없는» 그리드 — ＋ 는 블럭 밖 층 · 오른쪽 ＋ 중심 = 블럭 오른쪽 끝·세로 가운데(H10) · 아래 ＋ = 블럭 바로 아래', async ({ page }) => {
  const { errs, a } = await setup(page);
  await force(page, a);
  const r = await page.evaluate((id) => ({ inBlock: document.getElementById(id).querySelectorAll('.grd-add-btn').length, layer: [...document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"]`)].map(b => b.dataset.grdAdd) }), a);
  expect(r, '★＋ 는 블럭 밖 층에 둘 · 블럭 안 0').toEqual({ inBlock: 0, layer: ['col', 'row'] });
  const s = await kidState(page, a);
  expect(Math.abs((s.col.t + s.col.b) / 2 - (s.block.t + s.block.b) / 2), '★오른쪽 ＋ = 블럭(=껍데기) 세로 가운데').toBeLessThanOrEqual(1);
  expect(Math.abs(s.row.t - s.block.b), '★아래 ＋ = 블럭 바로 아래').toBeLessThanOrEqual(1);
  expect(Math.abs((s.col.l + s.col.r) / 2 - s.block.r), '★오른쪽 ＋ 중심 = 블럭 오른쪽 끝(H10 · 옛: 안쪽 한 칸)').toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('K2b ★자식 있는 그리드 — 오른쪽 ＋ 진짜 클릭 = 열 +1 · 자식 그대로 · ＋ 는 여전히 껍데기 가운데', async ({ page }) => {
  const { errs, a } = await setup(page);
  await withKids(page, a);
  await force(page, a);
  const s0 = await kidState(page, a);
  const bx = await btnBox(page, a, 'col');
  expect(bx && bx.hitIsBtn, `전제 — 오른쪽 ＋ 가 눌린다 ${JSON.stringify(bx)}`).toBe(true);
  await page.mouse.click(bx.cx, bx.cy); await page.waitForTimeout(200);
  const m1 = await model(page, a);
  expect(m1.nCols, '★열 +1').toBe(3);
  const s1 = await kidState(page, a);
  expect(s1.kids, '★자식 그대로').toEqual(['kA', 'kB']);
  const colMid = (s1.col.t + s1.col.b) / 2;
  expect(Math.abs(colMid - (s1.inner.t + s1.inner.b) / 2), `★재렌더 뒤에도 껍데기 가운데 ${JSON.stringify(s1)}`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

/* K4 측정 기록 — 아래 ＋ 와 첫 자식이 겹치는가(겹친 px) · 그 자리 클릭은 무엇이 받나. ⛔판정하지 않는다(현빈·지디 몫) — 전제만 단언하고 수를 남긴다. */
for (const z of [100, 40]) test(`K4 [측정] 배율 ${z} — 아래 ＋ × 첫 자식 겹침 px · 겹친 자리 클릭 결과`, async ({ page }) => {
  test.setTimeout(120000);
  {
    const { a } = await setup(page, z);
    await withKids(page, a);
    await force(page, a);
    const s = await kidState(page, a);
    const k = await page.evaluate(() => { const r = document.getElementById('kA').getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; });
    const ovY = +(Math.max(0, Math.min(s.row.b, k.b) - Math.max(s.row.t, k.t))).toFixed(1);
    const out = { zoom: z, rowBtn: s.row, inner: s.inner, kidsBox: s.kidsBox, firstKid: k, overlapY_px: ovY };
    if (ovY > 0) {
      const cx = (s.row.l + s.row.r) / 2, cy = (s.row.t + s.row.b) / 2, R = (s.row.r - s.row.l) / 2;
      const yIn = Math.min(s.row.b - 2, k.t + ovY / 2);          // 겹친 띠 가운데
      /* ⚠️원 안 클릭은 행을 더해 자리를 바꾸므로 «맨 끝»에 잰다(첫 판은 맨 앞이라 뒤 두 점이 자식이 아니라 늘어난 껍데기 위였다). */
      const pts = { outCircleInBox: [s.row.l + 2, yIn], besideBtn: [s.row.l - 6, yIn], inCircle: [cx, yIn] };
      out.clicks = {};
      for (const [nm, [x, y]] of Object.entries(pts)) {
        await page.evaluate(() => window.deselectAll?.()); await force(page, a);
        await page.mouse.move(x, y, { steps: 3 }); await page.waitForTimeout(80);
        const under = await page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? `${h.tagName.toLowerCase()}${h.id ? '#' + h.id : ''}.${[...h.classList].join('.')}` : 'null'; }, [x, y]);
        const r0 = (await model(page, a)).nRows;
        await page.mouse.click(x, y); await page.waitForTimeout(200);
        const after = await page.evaluate((id) => ({ kidSelected: document.getElementById('kA').classList.contains('selected'), gridSelected: document.getElementById(id).classList.contains('selected') }), a);
        out.clicks[nm] = { x: +x.toFixed(1), y: +y.toFixed(1), dist: +Math.hypot(x - cx, y - cy).toFixed(1), R, under, dRows: (await model(page, a)).nRows - r0, ...after };
      }
    }
    console.log('K4', JSON.stringify(out));
    expect(s.kids, '전제 — 자식 둘').toEqual(['kA', 'kB']);
  }
});

/* K5 ★겹친 띠(아래 ＋ × 첫 자식) — 원 안 = 행 +1 · 원 밖 1px 옆 = 그리드 선택 (현빈 「정확히 +버튼을 눌러야지만」 · 지디 ㉠)
 *   점은 «거리»로 먼저 단언한다(지난 판 40% 에서 「원 밖」으로 고른 점이 18.6 < 20 으로 원 안이었다). */
for (const z of [100, 40]) {
  test(`K5 ★배율 ${z} — 겹친 띠: 원 안 클릭 = 행 +1 · 원 밖 1px 옆 클릭 = ＋ 아님(행·열 그대로)`, async ({ page }) => {
    test.setTimeout(120000);
    const { errs, a } = await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${z}`).toBe(z);
    await withKids(page, a);
    await force(page, a);
    const s = await kidState(page, a);
    const k = await page.evaluate(() => { const r = document.getElementById('kA').getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; });
    const bandT = Math.max(s.row.t, k.t), bandB = Math.min(s.row.b, k.b);
    expect(bandB - bandT, `전제 — 아래 ＋ 와 첫 자식이 겹친다 ${JSON.stringify({ row: s.row, kid: k })}`).toBeGreaterThan(4);
    const cx = (s.row.l + s.row.r) / 2, cy = (s.row.t + s.row.b) / 2, R = (s.row.r - s.row.l) / 2;
    /* ★점은 «정수 픽셀»로 잡는다 — 마우스 이벤트는 정수 좌표로 온다. 실측(2026-10-04 probe): 경계 바깥 소수점 점
       (100%: dist 20.81 · 40%: 20.49)은 mousedown 이 ＋ 로 갔고, 21.2 이상은 언제나 자식으로 갔다.
       ⇒ 「1px 옆」 = 그 높이에서 원 경계(R)보다 1px 넘게 바깥인 «가장 가까운» 정수 픽셀 · 거리 > R + 1 을 먼저 단언한다. */
    const y = Math.round((bandT + bandB) / 2);                            // 겹친 띠 가운데(정수)
    const dy = Math.abs(y - cy);
    expect(dy, '전제 — 띠 가운데가 원의 세로 범위 안').toBeLessThan(R - 1);
    // ⑴ 원 안 — 중심 x
    const pin = [Math.round(cx), y];
    expect(Math.hypot(pin[0] - cx, pin[1] - cy), '전제 — 원 안 점: dist < R').toBeLessThan(R - 1);
    // ⑵ 원 밖 1px 옆 — 그 높이에서 원 왼쪽 경계가 걸친 픽셀의 바로 옆 픽셀
    const pout = [Math.floor(cx - Math.sqrt((R + 1) * (R + 1) - dy * dy)) - (Number.isInteger(cx - Math.sqrt((R + 1) * (R + 1) - dy * dy)) ? 1 : 0), y];
    const dOut = Math.hypot(pout[0] - cx, pout[1] - cy);
    expect(dOut, `전제 — 원 밖 점: dist ${dOut.toFixed(2)} > R+1 (${R + 1})`).toBeGreaterThan(R + 1);
    expect(pout[0] >= k.l && pout[1] >= k.t && pout[1] <= k.b, '전제 — 원 밖 점이 첫 자식 위(겹친 띠)').toBe(true);

    /* ★«첫 클릭»은 아무것도 안 골라진 상태에서 잰다(deselectAll). 실측: 섹션이 골라진 채로 누르면 그 자리 클릭은
       자식(kA)을 바로 고른다 — 이것도 ＋ 는 안 먹은 것(행 그대로)이지만 «그리드 선택»이 아니다(G19 선택 규칙 몫). */
    await page.evaluate(() => window.deselectAll?.()); await force(page, a);
    const rOut = await clickAt(page, a, pout[0], pout[1]);
    /* ★요구(현빈) = 「원 밖 1px = 열/행이 안 늘어난다(＋ 가 안 맞는다)」 — 이것만 단언한다.
       «무엇이 골라지나»는 요구가 아니다 — 그 자리 «밑»(자식이든 그리드든)이 받는다. 사실로만 남긴다(annotation).
       실제 히트가 그린 원보다 0.5~1px 크다(100% 20.81 · 40% 20.49) — 알고 넣음 */
    const msgOut = JSON.stringify({ pout, dOut, R, ...rOut });
    expect({ dRows: rOut.dRows, dCols: rOut.dCols }, `★원 밖 1px 옆 = 행·열 그대로 ${msgOut}`).toEqual({ dRows: 0, dCols: 0 });
    expect(rOut.under.includes('grd-add-btn'), `★원 밖 점에서 ＋ 가 안 맞는다 ${msgOut}`).toBe(false);
    test.info().annotations.push({ type: 'K5 원 밖 클릭이 고른 것(사실 기록 · 요구 아님)', description: `zoom ${z} · under=${rOut.under} · selected=${JSON.stringify(rOut.sel)}` });
    /* 양성대조 메모: m6(네모 히트)에서 K5@40 이 초록이다 — 미조사. */

    await page.evaluate(() => window.deselectAll?.()); await force(page, a);
    const s2 = await kidState(page, a);
    const rIn = await clickAt(page, a, Math.round((s2.row.l + s2.row.r) / 2), y);
    expect(rIn, `★원 안 = 행 +1 ${JSON.stringify(rIn)}`).toMatchObject({ dRows: 1, dCols: 0 });
    const kids = await page.evaluate((id) => [...document.querySelectorAll(`#${id} > .grd-children .text-block`)].map(e => e.id), a);
    expect(kids, '★자식 그대로').toEqual(['kA', 'kB']);
    expect(errs).toEqual([]);
  });
}

/* ══ T — ＋ 층(#grd-plus-layer)이 그리드를 «따라가나» (팀리드 조건 2026-10-04) ══════════════════════════
 * 스크롤·배율(스케일러 transform)·재렌더·크기·자식 넣고 빼기·그리드 이동·삭제(고아 0). 매번 «기준점»을 다시 잰다:
 *   오른쪽 ＋ «가로 중심» = 블럭 오른쪽 끝(H10 · 옛: 오른쪽 끝) · 세로 가운데 = 기준(자식 없으면 블럭 · 있으면 껍데기) 세로 가운데
 *   아래 ＋ 위 끝 = 기준 아래 끝 · 가로 가운데 = 블럭 가로 가운데 (모두 ±1px) */
const anchorCheck = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id);
  const q = (a) => document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"][data-grd-add="${a}"]`);
  const c = q('col'), r = q('row');
  if (!g || !c || !r) return { missing: true };
  const br = g.getBoundingClientRect(), inner = g.querySelector(':scope > .grd-inner'), kids = g.querySelector(':scope > .grd-children');
  const ar = (kids && kids.childElementCount) ? inner.getBoundingClientRect() : br;
  const cr = c.getBoundingClientRect(), rr = r.getBoundingClientRect();
  const d = { colMidX: (cr.left + cr.right) / 2 - br.right, colMidY: (cr.top + cr.bottom) / 2 - (ar.top + ar.bottom) / 2,
              rowTop: rr.top - ar.bottom, rowMidX: (rr.left + rr.right) / 2 - (br.left + br.right) / 2, colW: cr.width };
  for (const k of Object.keys(d)) d[k] = +d[k].toFixed(2);
  d.ok = Math.abs(d.colMidX) <= 1 && Math.abs(d.colMidY) <= 1 && Math.abs(d.rowTop) <= 1 && Math.abs(d.rowMidX) <= 1;
  return d;
}, id);
/* 바뀐 뒤 마우스를 «그 자리의 그리드 위로» 다시 올린다(스크롤 없이) — 스크롤·이동으로 그리드가 마우스 밑에서 빠지면
   브라우저가 mouseleave 를 내 ＋ 가 정상적으로 진다. 여기서 재는 것은 «뜬 ＋ 가 기준점에 붙나»다. */
async function settle(page, id) {
  await page.waitForTimeout(350);   // 스케일러 transition 0.15s + rAF
  const p = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * 0.25, r.top + Math.min(r.height / 2, 12)]; }, id);
  await page.mouse.move(p[0], p[1], { steps: 3 }); await page.waitForTimeout(120);
}

test('T1~T6 ★＋ 가 따라간다 — 스크롤 · 배율 100→40 · 재렌더 · 폭 · 자식 넣기/빼기 · 그리드 이동', async ({ page }) => {
  test.setTimeout(120000);
  const { errs, a } = await setup(page);
  await force(page, a);
  const steps = {};
  steps.start = await anchorCheck(page, a);
  // T1 스크롤
  await page.evaluate(() => { document.getElementById('canvas-wrap').scrollTop += 120; }); await settle(page, a);
  steps.scroll = await anchorCheck(page, a);
  // T2 배율(＋ 가 떠 있는 채로)
  await page.evaluate(() => window.applyZoom(40)); await settle(page, a);
  expect(await page.evaluate(() => window.currentZoom), '전제 — 배율 40').toBe(40);
  steps.zoom40 = await anchorCheck(page, a);
  await page.evaluate(() => window.applyZoom(100)); await settle(page, a);
  steps.zoom100 = await anchorCheck(page, a);
  // T3 재렌더(칸 간격)
  await page.evaluate((id) => window.updateGridBlock(id, { gap: 60 }), a); await settle(page, a);
  steps.rerender = await anchorCheck(page, a);
  // T4 폭
  await page.evaluate((id) => window.updateGridBlock(id, { width: 360 }), a); await settle(page, a);
  steps.width = await anchorCheck(page, a);
  // T5 자식 넣기 → 기준 = 껍데기 / 빼기 → 기준 = 블럭
  await page.evaluate((id) => { const g = document.getElementById(id); const box = window.ensureGridKidsBox(g);
    box.insertAdjacentHTML('beforeend', '<div class="row" id="rkT"><div class="text-block" data-type="heading" id="kT"><div class="tb-h2">자식</div></div></div>'); window.rebindAll?.(); }, a); await settle(page, a);
  steps.kidsIn = await anchorCheck(page, a);
  await page.evaluate((id) => { const g = document.getElementById(id); document.getElementById('rkT').remove(); window.pruneGridKidsBox(g.querySelector(':scope > .grd-children')); }, a); await settle(page, a);
  steps.kidsOut = await anchorCheck(page, a);
  // T6 그리드 이동 — 위에 200px 블럭을 끼워 넣어 아래로 민다
  await page.evaluate((id) => { const row = document.getElementById(id).closest('.row'); row.insertAdjacentHTML('beforebegin', '<div class="gap-block" data-type="gap" id="pushGap" style="height:200px"></div>'); }, a); await settle(page, a);
  steps.moved = await anchorCheck(page, a);
  const msg = JSON.stringify(steps);
  for (const [k, v] of Object.entries(steps)) expect(v.ok, `★${k} 에서 ＋ 가 기준점에 붙어 있다 ${msg}`).toBe(true);
  expect(Math.abs(steps.zoom40.colW - 16), `★배율 40 에서 ＋ 화면 16px(모델 40 × 0.4 · H9 · 옛: 화면 40 고정) ${msg}`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('T7 ★그리드 삭제 → 층에 ＋ 고아 0', async ({ page }) => {
  const { errs, a } = await setup(page);
  await force(page, a);
  expect(await page.evaluate((id) => document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"]`).length, a), '전제 — ＋ 둘이 떠 있다').toBe(2);
  await page.evaluate((id) => document.getElementById(id).closest('.row').remove(), a);
  await page.waitForTimeout(200);
  const left = await page.evaluate(() => document.querySelectorAll('#grd-plus-layer > .grd-add-btn').length);
  expect(left, '★삭제 뒤 층에 남은 ＋ = 0').toBe(0);
  expect(errs).toEqual([]);
});

/* ══ RG5 — G12 블럭 배경을 켠 채로 아래 ＋ 가 눌린다 (배경 끔/켬 × 배율 100/40) ══════════════════════════
 * 옛 구조(＋ 가 블럭 안)에선 배경이 블럭에 isolation 을 걸어 블럭 밖 아래 ＋ 가 뒤 형제 밑에 깔렸다(integ7 fec76b81 실측). */
for (const z of [100, 40]) for (const bg of [null, { on: true, color: '#ff0000' }, { on: true, color: '#ff0000', padY: 200, padX: 100 }]) {
  test(`RG5 배율 ${z} · 배경 ${bg ? (bg.padY ? '켬(여백 200/100)' : '켬(기본 여백)') : '끔'} — 아래 ＋ 가 맨 위 · 진짜 클릭 = 행 +1`, async ({ page }) => {
    test.setTimeout(120000);
    const { errs, a } = await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${z}`).toBe(z);
    if (bg) {
      const res = await page.evaluate(([id, bg]) => window.updateGridBlock(id, { blockBg: bg }), [a, bg]);
      expect(res && res.ok, `전제 — 배경이 켜졌다 ${JSON.stringify(res).slice(0, 200)}`).toBe(true);
      expect(await page.evaluate((id) => !!document.querySelector(`#${id} > .grd-bg`) && getComputedStyle(document.getElementById(id)).isolation, a), '전제 — 배경 층 · isolation').toBe('isolate');
    }
    await force(page, a);
    const bx = await btnBox(page, a, 'row');
    const stack = await page.evaluate(([x, y]) => document.elementsFromPoint(x, y).slice(0, 4).map(h => `${h.tagName.toLowerCase()}${h.id ? '#' + h.id : ''}.${[...h.classList].join('.')}`), [bx.cx, bx.cy]);
    expect(bx.hitIsBtn, `★아래 ＋ 가 맨 위(elementsFromPoint ${JSON.stringify(stack)})`).toBe(true);
    const r0 = (await model(page, a)).nRows;
    await page.mouse.click(bx.cx, bx.cy); await page.waitForTimeout(200);
    expect((await model(page, a)).nRows, `★진짜 클릭 = 행 +1 (${JSON.stringify(stack)})`).toBe(r0 + 1);
    expect(errs).toEqual([]);
  });
}
