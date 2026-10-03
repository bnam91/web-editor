/* grid-plus-g15-place.dom.spec.js — G15 오른쪽 ＋ 자리 «측정» (지디 2026-10-04: 고르지 말고 잰다)
 *
 * 후보 ⑷ 반 걸침: 오른쪽 ＋ 중심이 블럭 오른쪽 모서리선 위(반 안·반 밖), 조건 없이 늘 같은 자리.
 * 잴 것 넷:
 *   Q1 전폭 그리드에서 ＋ 가 보이고 눌리나 (배율 40·100 × 섹션 좌우 패딩 32(페이지 기본 padX)·0)
 *   Q2 그리드 오른쪽 20px 첫 클릭이 «선택»인가(열 추가 아님) — ＋ 높이(세로 가운데)와 ＋ 밖(위 5px) 두 줄
 *   Q3 낮은 그리드(≈34px)에서 오른쪽 ＋ 와 아래 ＋ 가 안 겹치나
 *   Q4 섹션 맨 아래에 붙은 그리드의 아래 ＋ 가 잘리나(다음 섹션 · 섹션 사이 간격 20)
 * ★자르는 것: .section-inner { overflow-x: clip } (editor-layout.css) — 가로만 자른다.
 * 각 시험은 «전제»(배율·폭·높이)를 먼저 단언하고, 잰 수를 메시지에 싣는다.
 * ★측정 전용 — 평소 판(test:dom)에선 건너뛴다(G15_MEASURE=1 일 때만 돈다). 후보 넷 중 어느 것도 다 초록이 아니라서다.
 *   후보는 G15_PLACE_CSS(덮어쓰기 CSS)로 넣는다. 안 넣으면 «지금 커밋된» 자리(오른쪽 ＋ 안쪽)를 잰다.
 *   ⑷ 반 걸침: G15_PLACE_CSS='#canvas .grid-block > .grd-add-btn[data-grd-add="col"] { transform: translate(50%, -50%); }'
 *   ㉢ 전폭 아니면 밖(전폭은 ⑷): 위 ⑷ 줄 + '#canvas .grid-block[data-grid-width] > .grd-add-btn[data-grd-add="col"] { right: auto; left: 100%; transform: translateY(-50%); }'
 * 결과(2026-10-04, 잠금 안)는 보고서 G15-BUILD.md 「오른쪽 ＋ 자리 측정」 표.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const EXTRA_CSS = process.env.G15_PLACE_CSS || '';
test.skip(process.env.G15_MEASURE !== '1', '측정 전용 — G15_MEASURE=1 일 때만');

const sec = (id, padX, body) => `<div class="section-block" id="${id}" data-section="1" data-name="${id}"><div class="section-hitzone"></div><div class="section-inner" id="${id}-in" style="padding-left:${padX}px;padding-right:${padX}px;">${body}</div></div>`;

async function setup(page, { padX = 32, zoom = 100, atBottom = false, short = false, width = null } = {}) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  const body = `<div class="gap-block" data-type="gap" style="height:120px"></div><div id="slot"></div>` + (atBottom ? '' : `<div class="gap-block" data-type="gap" style="height:160px"></div>`);
  const html = sec('sP', padX, body) + sec('sNext', padX, `<div class="gap-block" data-type="gap" style="height:300px"></div>`);
  const id = await page.evaluate(({ html, short, width, css }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    if (css) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
    window.applyZoom?.(100);
    const { row, block } = window.makeGridBlock({});
    document.getElementById('slot').replaceWith(row); window.bindBlock(block); window.rebindAll?.();
    if (short) window.updateGridBlock(block.id, { cols: [{ width: 1, lines: [{ type: 'body', text: '왼쪽', fontSize: 20 }] }, { width: 1, lines: [{ type: 'body', text: '오른쪽', fontSize: 20 }] }] });
    if (width) window.updateGridBlock(block.id, { width });
    return block.id;
  }, { html, short, width, css: EXTRA_CSS });
  if (zoom !== 100) await page.evaluate((z) => window.applyZoom(z), zoom);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${zoom}`).toBe(zoom);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
  await page.waitForTimeout(150);
  return { errs, id };
}

const geo = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id), gr = g.getBoundingClientRect();
  const inner = g.closest('.section-inner'), ir = inner.getBoundingClientRect(), cs = getComputedStyle(inner);
  const z = window.currentZoom / 100;
  const contentW = (inner.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * z;
  const R = (r) => r && { l: +r.left.toFixed(1), t: +r.top.toFixed(1), r: +r.right.toFixed(1), b: +r.bottom.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  const btn = (axis) => {
    const b = g.querySelector(`:scope > .grd-add-btn[data-grd-add="${axis}"]`);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hitC = document.elementFromPoint(cx, cy);
    // 가로로 «보이는» 폭 = 섹션 안쪽(.section-inner 패딩 상자, overflow-x:clip)과 겹친 폭
    const visW = Math.max(0, Math.min(r.right, ir.right) - Math.max(r.left, ir.left));
    return { rect: R(r), visW: +visW.toFixed(1), centerHit: !!hitC?.closest?.('.grd-add-btn'),
             centerHitWhat: hitC ? `${hitC.tagName.toLowerCase()}${hitC.id ? '#' + hitC.id : ''}.${[...hitC.classList].join('.')}` : 'null' };
  };
  return { grid: R(gr), inner: R(ir), contentW: +contentW.toFixed(1), col: btn('col'), row: btn('row') };
}, id);

async function hover(page, id) {
  const [x, y] = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * 0.25, r.top + r.height / 2]; }, id);
  await page.mouse.move(x, y, { steps: 4 }); await page.waitForTimeout(100);
}

/* Q1 ─────────────────────────────────────────────────────────── */
for (const padX of [32, 0]) for (const zoom of [100, 40]) {
  test(`Q1 전폭 그리드 · 패딩 ${padX} · 배율 ${zoom} — 오른쪽 ＋ 가 «다» 보이고 가운데가 눌린다`, async ({ page }) => {
    const { errs, id } = await setup(page, { padX, zoom });
    const g0 = await geo(page, id);
    expect(Math.abs(g0.grid.w - g0.contentW), `전제 — 전폭(그리드 ${g0.grid.w} ≈ 섹션 안쪽 ${g0.contentW})`).toBeLessThanOrEqual(1);
    await hover(page, id);
    const g = await geo(page, id);
    expect(g.col, '전제 — 호버로 ＋ 가 떴다').not.toBeNull();
    const msg = JSON.stringify({ col: g.col, gridR: g.grid.r, clipR: g.inner.r });
    expect(g.col.centerHit, `★가운데가 눌린다 ${msg}`).toBe(true);
    expect(g.col.visW, `★다 보인다(가로 보이는 폭 = 40) ${msg}`).toBeGreaterThanOrEqual(39);
    expect(errs).toEqual([]);
  });
}

/* Q2 ─────────────────────────────────────────────────────────── */
for (const where of ['mid', 'top5']) {
  test(`Q2 그리드 오른쪽 20px 첫 클릭(${where === 'mid' ? '＋ 높이 = 세로 가운데' : '위 5px'}) = 선택 · 열 그대로`, async ({ page }) => {
    const { errs, id } = await setup(page, { padX: 32, zoom: 100 });
    const g = await geo(page, id);
    const x = g.grid.r - 10;
    const y = where === 'mid' ? (g.grid.t + g.grid.b) / 2 : g.grid.t + 5;
    const cols0 = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.cols).length, id);
    await page.mouse.move(x, y, { steps: 4 }); await page.waitForTimeout(100);
    const under = await page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? `${h.tagName.toLowerCase()}.${[...h.classList].join('.')}` : 'null'; }, [x, y]);
    await page.mouse.click(x, y); await page.waitForTimeout(200);
    const r = await page.evaluate((id) => { const b = document.getElementById(id); return { selected: b.classList.contains('selected'), cols: JSON.parse(b.dataset.cols).length }; }, id);
    const msg = JSON.stringify({ x, y, under, grid: g.grid, cols0, ...r });
    expect(r.cols, `★열이 안 늘었다 ${msg}`).toBe(cols0);
    expect(r.selected, `★선택됐다 ${msg}`).toBe(true);
    expect(errs).toEqual([]);
  });
}

/* Q3 ─────────────────────────────────────────────────────────── */
for (const zoom of [100, 40]) {
  test(`Q3 낮은 그리드 · 배율 ${zoom} — 오른쪽 ＋ 와 아래 ＋ 가 안 겹친다`, async ({ page }) => {
    const { errs, id } = await setup(page, { padX: 32, zoom, short: true });
    const z = zoom / 100;
    const g0 = await geo(page, id);
    const hCanvas = g0.grid.h / z;
    expect(hCanvas, `전제 — 낮은 그리드(캔버스 높이 ${hCanvas.toFixed(1)}px ≤ 40)`).toBeLessThanOrEqual(40);
    await hover(page, id);
    const g = await geo(page, id);
    const a = g.col.rect, b = g.row.rect;
    const ov = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    expect(ov, `★겹친 면적 0 ${JSON.stringify({ col: a, row: b, gridH: g.grid.h })}`).toBe(0);
    expect(errs).toEqual([]);
  });
}

/* Q4 ─────────────────────────────────────────────────────────── */
for (const zoom of [100, 40]) {
  test(`Q4 섹션 맨 아래 그리드 · 배율 ${zoom} — 아래 ＋ 가 다 보이고 가운데가 눌린다`, async ({ page }) => {
    const { errs, id } = await setup(page, { padX: 32, zoom, atBottom: true });
    const g0 = await geo(page, id);
    expect(Math.abs(g0.grid.b - g0.inner.b), `전제 — 그리드 아래 = 섹션 아래(${g0.grid.b} · ${g0.inner.b})`).toBeLessThanOrEqual(1);
    await hover(page, id);
    const g = await geo(page, id);
    const nx = await page.evaluate(() => document.getElementById('sNext').getBoundingClientRect().top);
    const r = g.row.rect;
    const msg = JSON.stringify({ row: g.row, sectionBottom: g.inner.b, nextTop: nx });
    expect(g.row.centerHit, `★가운데가 눌린다 ${msg}`).toBe(true);
    const bottomHit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest?.('.grd-add-btn'), [(r.l + r.r) / 2, r.b - 3]);
    expect(bottomHit, `★아래 끝(3px 안쪽)도 ＋ 가 잡힌다(다음 섹션에 안 덮인다) ${msg}`).toBe(true);
    expect(errs).toEqual([]);
  });
}

/* Q1n·Q2n — «전폭이 아닌» 그리드(폭 400). 후보 ㉢(전폭 아닐 때만 밖) 을 재는 자리 ─────────── */
for (const zoom of [100, 40]) {
  test(`Q1n 폭 400 그리드 · 배율 ${zoom} — 오른쪽 ＋ 가 다 보이고 가운데가 눌린다`, async ({ page }) => {
    const { errs, id } = await setup(page, { padX: 32, zoom, width: 400 });
    const g0 = await geo(page, id);
    expect(Math.abs(g0.grid.w / (zoom / 100) - 400), `전제 — 폭 400(${g0.grid.w})`).toBeLessThanOrEqual(1);
    await hover(page, id);
    const g = await geo(page, id);
    const msg = JSON.stringify({ col: g.col, grid: g.grid, clipR: g.inner.r });
    expect(g.col.centerHit, `★가운데가 눌린다 ${msg}`).toBe(true);
    expect(g.col.visW, `★다 보인다 ${msg}`).toBeGreaterThanOrEqual(39);
    expect(errs).toEqual([]);
  });
}
for (const where of ['mid', 'top5']) {
  test(`Q2n 폭 400 그리드 오른쪽 20px 첫 클릭(${where}) = 선택 · 열 그대로`, async ({ page }) => {
    const { errs, id } = await setup(page, { padX: 32, zoom: 100, width: 400 });
    const g = await geo(page, id);
    const x = g.grid.r - 10, y = where === 'mid' ? (g.grid.t + g.grid.b) / 2 : g.grid.t + 5;
    const cols0 = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.cols).length, id);
    await page.mouse.move(x, y, { steps: 4 }); await page.waitForTimeout(100);
    const under = await page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? `${h.tagName.toLowerCase()}.${[...h.classList].join('.')}` : 'null'; }, [x, y]);
    await page.mouse.click(x, y); await page.waitForTimeout(200);
    const r = await page.evaluate((id) => { const b = document.getElementById(id); return { selected: b.classList.contains('selected'), cols: JSON.parse(b.dataset.cols).length }; }, id);
    const msg = JSON.stringify({ x, y, under, grid: g.grid, cols0, ...r });
    expect(r.cols, `★열이 안 늘었다 ${msg}`).toBe(cols0);
    expect(r.selected, `★선택됐다 ${msg}`).toBe(true);
    expect(errs).toEqual([]);
  });
}
