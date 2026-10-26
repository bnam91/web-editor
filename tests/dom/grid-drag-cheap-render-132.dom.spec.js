/* grid-drag-cheap-render-132.dom.spec.js — ★132 GRID-ROW-DRAG-MOVE (48) «싸게 그린다»: 행·열 경계를 끄는 동안 칸(innerHTML)은 안 갈아끼우고 트랙(CSS)만 —
 * 끝(mouseup)에서 renderGridBlock 한 번. (js/blocks/grid-block.js previewGridTracks · js/overlay-handles.js _onGridRowMouseDown/_onGridColMouseDown)
 * 자: ⒞ .grd-inner 교체 수(MutationObserver childList) — 고치기 전 판은 «틱마다 1» · 고친 판은 끄는 동안 0 · 놓을 때 1.
 *     ⒟ ★음성대조 — 끄는 동안 화면이 «틱마다» 따라온다(칸 높이/폭이 매 이동 바뀐다) — 없으면 「안 보이게 해서 끈 것」.
 *     ⒡ 행·열 둘 다 · 배경 그림 칸이면 옛 길(틱마다 렌더) 그대로.
 * 기다림은 전부 조건 — 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SCENE = '<div class="section-block" id="dS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="dR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>';
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
async function setup(page, { bg = false } = {}) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(([SCENE, bg, IMG]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', SCENE);
    const L = (t) => [{ type: 'body', text: t + ' 첫줄' }, { type: 'body', text: t + ' 둘째' }];
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: L('A') }, { width: 1, lines: L('B') }], rows: [{ height: 120 }, { height: 'auto' }] });   /* ★첫 행 높이 > 칸 글 높이 — 'auto' 면 끌어도 minmax 하한만 바뀌고 칸은 글 높이 그대로(화면 무변 · 하네스 실측) */
    g.id = 'dG'; document.getElementById('dR').appendChild(g); window.rebindAll?.();
    if (bg) window.updateGridBlock('dG', { cells: [[{ bgImg: IMG }, {}], [{}, {}]] });
    window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100); g.scrollIntoView({ block: 'center' });
  }, [SCENE, bg, IMG]);
  await page.waitForFunction(() => !!document.querySelector('#dG .grd-cell'));
  return errs;
}
async function pick(page) {
  const p = await page.evaluate(() => { const r = document.querySelector('#dG .grd-cell [data-line]').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => document.querySelectorAll('#ss-handles-overlay .grd-gutter').length > 0);
  await waitStableRect(page, '#dG');   /* 배율 적용이 끝난 뒤 첫 값을 잰다(하네스 실측: 고른 직후 칸 폭 167 → 첫 이동 뒤 418) */
}
const gutter = (page, cur) => page.evaluate((cur) => { const g = [...document.querySelectorAll('#ss-handles-overlay .grd-gutter')].find(e => getComputedStyle(e).cursor === cur && e.offsetParent); if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: cur === 'row-resize' ? r.top + r.height / 2 : r.top + r.height * 0.2 }; }, cur);   /* 열 거터 가운데엔 행 거터가 겹친다(원 블럭 실측) — 위 20% */
const arm = (page) => page.evaluate(() => { window.__rep = 0; const g = document.getElementById('dG'); window.__mo = new MutationObserver(ms => { for (const m of ms) for (const n of m.removedNodes) if (n.classList && n.classList.contains('grd-inner')) window.__rep++; }); window.__mo.observe(g, { childList: true }); });
const rep = (page) => page.evaluate(() => window.__rep);
const cell = (page) => page.evaluate(() => { const r = document.querySelector('#dG .grd-cell[data-r="0"][data-c="0"]').getBoundingClientRect(); return { h: +r.height.toFixed(1), w: +r.width.toFixed(1) }; });

async function drag(page, axis, steps = 5, upRenders = 1) {
  const g = await gutter(page, axis === 'row' ? 'row-resize' : 'col-resize');
  expect(g, `[전제] ${axis} 거터가 섰다`).not.toBe(null);
  await arm(page);
  const seq = [await cell(page)], reps = [];
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  for (let k = 1; k <= steps; k++) {
    if (axis === 'row') await page.mouse.move(g.x, g.y + 6 * k); else await page.mouse.move(g.x + 8 * k, g.y);
    const key = axis === 'row' ? 'h' : 'w';
    await expect.poll(async () => (await cell(page))[key], { message: `틱 ${k}: 화면이 따라온다(칸 ${key} 가 바뀐다)` }).not.toBe(seq[seq.length - 1][key]);
    seq.push(await cell(page)); reps.push(await rep(page));
  }
  const beforeUp = await rep(page);
  await page.mouse.up();
  if (upRenders) await expect.poll(() => rep(page), { message: '놓으면 정본 렌더 «한 번»' }).toBe(beforeUp + upRenders);
  else expect(await rep(page), '옛 길 — 놓을 때 덧 렌더 없음(틱마다 이미 그렸다)').toBe(beforeUp);
  return { seq, reps, beforeUp };
}

for (const axis of ['row', 'col']) {
  test(`G1-${axis} ★끄는 동안 칸을 안 갈아끼운다(⒞ 교체 0) · 화면은 «틱마다» 따라온다(⒟) · 놓으면 렌더 한 번`, async ({ page }) => {
    const errs = await setup(page);
    await pick(page);
    const ds0 = await page.evaluate((ax) => document.getElementById('dG').dataset[ax === 'row' ? 'rows' : 'cols'], axis);
    const r = await drag(page, axis);
    expect(r.reps, '⒞ 끄는 동안 .grd-inner 교체 수(틱마다 누적) — 고치기 전 판은 1,2,3,4,5').toEqual([0, 0, 0, 0, 0]);
    const key = axis === 'row' ? 'h' : 'w';
    const vals = r.seq.map(s => s[key]);
    expect(vals.slice(1).every((v, i) => v !== vals[i]), `⒟ 화면 칸 ${key} 가 매 틱 바뀐다 ${vals}`).toBe(true);
    expect(await page.evaluate((ax) => document.getElementById('dG').dataset[ax === 'row' ? 'rows' : 'cols'], axis), '모델(dataset)도 바뀌었다').not.toBe(ds0);
    /* 놓은 뒤 = 정본 렌더 결과와 같다(미리보기 트랙 ≠ 정본이면 여기서 갈린다) */
    const tpl = await page.evaluate(() => { const g = document.getElementById('dG'); const i = g.querySelector(':scope > .grd-inner'); const a = [i.style.gridTemplateRows, i.style.gridTemplateColumns]; window.renderGridBlock(g); const j = g.querySelector(':scope > .grd-inner'); return [a, [j.style.gridTemplateRows, j.style.gridTemplateColumns]]; });
    expect(tpl[0], '놓은 뒤 트랙 = 다시 그린 정본 트랙').toEqual(tpl[1]);
    expect(errs).toEqual([]);
  });
}

test('G3 (옛 길 지킴) 배경 그림 칸이 있으면 끄는 동안에도 틱마다 렌더(트랙이 칸 폭 × 그림 비율로 정착)', async ({ page }) => {
  const errs = await setup(page, { bg: true });
  expect(await page.evaluate(() => !!document.querySelector('#dG .grd-cell[style*="background-image"]')), '[전제] 배경 그림 칸').toBe(true);
  await pick(page);
  const r = await drag(page, 'col', 3, 0);
  expect(r.reps, '배경 그림 칸 = 미리보기 안 탐 = 틱마다 교체').toEqual([1, 2, 3]);
  expect(errs).toEqual([]);
});

test('G4 ⌘Z 한 번 = 끌기 전(시작 표본 mousedown · 끝 표본 onUp — 규약 그대로)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page);
  const ds0 = await page.evaluate(() => document.getElementById('dG').dataset.rows);
  await drag(page, 'row', 3);
  expect(await page.evaluate(() => document.getElementById('dG').dataset.rows)).not.toBe(ds0);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.getElementById('dG')?.dataset.rows)).toBe(ds0);
  expect(errs).toEqual([]);
});
