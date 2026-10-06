/* panel-shows-rendered.dom.spec.js — 묶음 B 2단계(2026-10-05 태양 lane-b-panels → lane-b2): «새 블럭(만든 그대로) → 고르기(진짜 클릭) → 패널 값 == 그려진 값»
 * ★한 벌의 자 — 행 표는 tests/dom/_panel-rows.js(실앱 범위표 스크립트와 같은 표). 행마다 시험 하나.
 * 병: 패널이 빈 값을 «자기 기본값»(`|| 13` · `|| #888` …)으로 그려 렌더러/CSS 기본값과 달랐다 — 전수 $S/reports/PANEL-SHOWS-WRONG-CENSUS.md · 명부 E111~E119 · #16 · #18 (E105~E110 그래프 = 릴리스 후 «그래프 패널 묶음» — 팀장 2026-10-05).
 * 고침: 패널이 «그리는 요소의 계산값»을 읽는다 — js/props/_panel-rendered.js(panelRenderedPx · panelRenderedColor) 한 자리.
 * ⛔그리는 것·저장값은 안 바꿨다(표시만) — 예외 하나: #16 B 토글은 «그려진 굵기» 기준이라 B 가 «쓰는 값»이 달라진다(Heading 600 첫 클릭 = 400 · W3). 지킴 행 G-E121(라벨 알약 높이)은 이 묶음 밖 — 늘 초록이어야 한다.
 * 양성대조: dev 끝(기준) 나무 안 → E111~E119·#16·#18 행 전부 빨강 · G-E121 초록 / 도우미 몸통 둘 비움 → 그 도우미를 쓰는 행 빨강 (predict: $S/b/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/panel-shows-rendered.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { ROWS, toHex } = require('./_panel-rows.js');

async function setup(page, row) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((make) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    (0, eval)(make);
    window.buildLayerPanel?.();
    window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, row.make);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected, null, { timeout: 3000 });
  return errs;
}
async function openPanel(page, row) {
  if (row.open === 'layer-row') {
    await page.evaluate(() => { const g = [...document.querySelectorAll('.layer-row-group')].find(x => x._dragTarget === window.__blk); const h = g?.querySelector(':scope > .layer-row-header'); if (h) { h.dataset.pnl = '1'; h.scrollIntoView({ block: 'center' }); } });
    const r = await waitStableRect(page, '[data-pnl="1"]');
    await clickAt(page, r.cx, r.cy, { sel: '[data-pnl="1"]' }, { label: row.id + ' 레이어 행 머리' });
  } else {
    await page.evaluate((t) => { const e = (0, eval)(t); e.dataset.pnl = '1'; }, row.target);
    const r = await waitStableRect(page, '[data-pnl="1"]');
    await clickAt(page, r.cx, r.cy, { sel: '[data-pnl="1"]' }, { label: row.id + ' 고르기' });
  }
  await page.waitForFunction((sel) => !!document.querySelector(sel), row.panel, { timeout: 3000 }).catch(() => { throw new Error(`${row.id}: 패널 칸 ${row.panel} 이 안 떴다(고르기가 패널을 못 열었다)`); });
}

for (const row of ROWS) {
  test(`${row.id} ${row.guard ? '' : '★'}${row.item} — 패널 값 == 그려진 값`, async ({ page }) => {
    await setup(page, row);
    await openPanel(page, row);
    const r = await page.evaluate(([sel, drawn, kind]) => { const e = document.querySelector(sel); return { panel: kind === 'active' ? e.classList.contains('active') : e.value, drawn: (0, eval)(drawn) }; }, [row.panel, row.drawn, row.kind]);
    expect(r.drawn, `${row.id} 전제 — 그려진 값을 읽었다 ${JSON.stringify(r)}`).not.toBeNull();
    if (row.kind === 'active') expect(r.panel, `${row.id} 패널 켜짐 ${r.panel} vs 그려진 굵기≥600 ${r.drawn}`).toBe(r.drawn);
    else if (row.kind === 'num') expect(Number(r.panel), `${row.id} 패널 ${r.panel} vs 그려진 ${r.drawn}`).toBe(r.drawn);
    else expect(String(r.panel).replace('#', '').toUpperCase(), `${row.id} 패널 ${r.panel} vs 그려진 ${r.drawn}`).toBe(toHex(r.drawn));
  });
}

/* #16 «동작» — B 한 번이면 그려진 굵기가 «바뀐다»(옛 판: 인라인만 봐서 600 제목에 첫 클릭 = 700 — 눈에 안 바뀜). 화면 기본(600)은 그대로다. */
test('W3 ★#16 B 토글 — 새 T▾ Heading(600)에서 B 한 번 = 굵기가 600 아닌 값으로 바뀐다(400) · 한 번 더 = 700', async ({ page }) => {
  const row = ROWS.find(r => r.id === '#16b');
  await setup(page, row);
  await openPanel(page, row);
  const w = () => page.evaluate(() => parseInt(getComputedStyle(window.__blk.querySelector('.tb-h2')).fontWeight, 10));
  expect(await w(), '전제 — 새 제목은 600 으로 그려진다').toBe(600);
  const b = await waitStableRect(page, '#txt-bold-btn');
  await clickAt(page, b.cx, b.cy, { sel: '[id="txt-bold-btn"]' }, { label: 'B 1회' });
  await expect.poll(w, { message: 'B 1회 뒤 굵기' }).toBe(400);
  await clickAt(page, b.cx, b.cy, { sel: '[id="txt-bold-btn"]' }, { label: 'B 2회' });
  await expect.poll(w, { message: 'B 2회 뒤 굵기' }).toBe(700);
});
