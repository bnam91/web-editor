/* card-row-gutter-t5-16 — 카드블럭 «행 경계» 끌기로 칸 높이 조절 (t5-16).
 *
 * 현빈 원문: 「카드블럭이 결국 그리드블럭과 구조가 같은거 아닌가? 그렇다면 카드블럭도 로우 경계에 마우스로 칸 높이 조절 가능하게 해줘.」
 * 바닥 d772f49e 실앱(원 블럭 cvb_yb8d4_28vkr8y · 2×3 · ×3): 행 경계 커서 pointer · 거터 0 · +48 끌기 → 행 190/190 불변.
 * 고침: 비교 블록 행 경계 거터 꼴(js/overlay-handles.js showCvbGutters) · 바꾸는 값 = 카드 높이 하나(canvasH · 패널 #cvb-h 와 같은 값).
 *   카드는 «모든 카드 한 크기» 모델이라 행마다 다른 높이는 안 만들었다(CARD-PER-ROW-HEIGHT-NOT-MODELED-01 · 현빈 결정 몫).
 * CG1 2행 카드를 고르면 행 경계 거터 하나 · 그 자리 커서 row-resize · (음성) 1행이면 0
 * CG2 경계를 끌면 끄는 경계가 손을 따라가고(Δ 그대로) 카드 높이·패널 칸이 같이 바뀐다 · ⌘Z 한 번 = 끌기 전
 * CG3 고르기를 풀면 거터를 거둔다
 * ⛔waitForTimeout 금지. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sK" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="iK">
  <div class="gap-block" data-type="gap" style="height:80px"></div><div id="slotK"></div>
  <div class="gap-block" data-type="gap" style="height:240px"></div></div></div>`;

async function setup(page, rows) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([sec, rows]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    const cards = Array.from({ length: 3 * rows }, (_, i) => ({ title: '카드 ' + (i + 1), desc: '', imgSrc: '', cellBg: '' }));
    const made = window.makeCanvasBlock({ cardMode: 'simple', gridCols: 3, gridRows: rows, cards, width: 250, height: 520, cardGap: 16 });
    made.block.id = 'cvb_G';
    document.getElementById('slotK').replaceWith(made.row);
    window.applyZoom?.(40);
    window.rebindAll?.(); window.deselectAll?.();
    window.renderCanvas(made.block);
    made.block.scrollIntoView({ block: 'center' });
  }, [SEC, rows]);
  await page.waitForFunction(() => !!document.querySelector('#cvb_G .cvb-card-title'));
  return errs;
}
async function pick(page) {
  const r = await waitStableRect(page, '#cvb_G');
  await page.mouse.click(r.left + r.width * 0.5, r.top + r.height * 0.25);
  await page.waitForFunction(() => document.getElementById('cvb_G').classList.contains('selected') && !!document.getElementById('cvb-h'), null, { timeout: 5000 });
}
const geo = (page) => page.evaluate(() => {
  const b = document.getElementById('cvb_G'); const r = b.getBoundingClientRect();
  const H = +b.dataset.canvasH, G = +(b.dataset.cardGap ?? 12), rows = +b.dataset.gridRows; const s = r.height / (H * rows + G * (rows - 1));
  const g = document.querySelector('.cvb-gutter'); const gr = g?.getBoundingClientRect();
  return { H, s, boundary: r.top + (H + G / 2) * s, x: r.left + r.width / 2, gutters: document.querySelectorAll('.cvb-gutter').length,
    gutterCy: gr ? gr.top + gr.height / 2 : null, panelH: document.getElementById('cvb-h')?.value ?? null };
});

test('CG1 2행 카드를 고르면 행 경계 거터 하나 · 그 자리 커서 row-resize · (음성) 1행이면 0', async ({ page }) => {
  const errs = await setup(page, 2);
  expect((await geo(page)).gutters, '★전제: 안 고르면 거터 0').toBe(0);
  await pick(page);
  await expect.poll(async () => (await geo(page)).gutters).toBe(1);
  const g = await geo(page);
  expect(Math.abs(g.gutterCy - g.boundary) <= 1.5, `거터 = 두 행 사이(${g.gutterCy} vs ${g.boundary})`).toBe(true);
  const cur = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return [e?.className, e && getComputedStyle(e).cursor]; }, [g.x, g.boundary]);
  expect(cur, '그 자리 맨 위 = 거터 · row-resize').toEqual(['cvb-gutter', 'row-resize']);
  expect(errs).toEqual([]);
});
test('CG1b (음성) 1행 카드는 경계가 없다 — 거터 0', async ({ page }) => {
  const errs = await setup(page, 1);
  await pick(page);
  expect((await geo(page)).gutters).toBe(0);
  expect(errs).toEqual([]);
});
test('CG2 경계를 +48 끌면 경계가 손을 따라가고 카드 높이·패널 칸이 같이 · ⌘Z 한 번 = 끌기 전', async ({ page }) => {
  const errs = await setup(page, 2);
  await pick(page);
  await expect.poll(async () => (await geo(page)).gutters).toBe(1);
  const g0 = await geo(page);
  await page.mouse.move(g0.x, g0.boundary);
  await page.mouse.down();
  await page.mouse.move(g0.x, g0.boundary + 24, { steps: 4 });
  await page.mouse.move(g0.x, g0.boundary + 48, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await geo(page)).H).not.toBe(g0.H);
  const g1 = await geo(page);
  expect(Math.abs((g1.boundary - g0.boundary) - 48) <= 1.5, `경계가 +48 따라갔다(${(g1.boundary - g0.boundary).toFixed(1)})`).toBe(true);
  expect(Math.abs(g1.H - Math.round(g0.H + 48 / g0.s)) <= 1, `카드 높이 ${g0.H} → ${g1.H}`).toBe(true);
  expect(g1.panelH, '패널 「높이」 칸이 같이').toBe(String(g1.H));
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await geo(page)).H, '⌘Z 한 번 = 끌기 전').toBe(g0.H);
  expect(errs).toEqual([]);
});
test('CG3 고르기를 풀면 거터를 거둔다', async ({ page }) => {
  const errs = await setup(page, 2);
  await pick(page);
  await expect.poll(async () => (await geo(page)).gutters).toBe(1);
  await page.evaluate(() => window.deselectAll());
  await expect.poll(async () => (await geo(page)).gutters).toBe(0);
  expect(errs).toEqual([]);
});
test('CG4 카드 높이 자 = 한 자리(js/blocks/card-limits.js) — 패널 칸 min/max · updateCanvasBlock 의 자 · 끌기 clamp 가 같은 값', async ({ page }) => {
  /* 지디 되돌림(261026): 끌기 clamp 가 리터럴 2000 이라 grid-callsite-ssot 가 빨갰다. 넷(쓰기 자·끌기·패널 둘)이 한 상수에서 오는지 «동작»으로 잰다. */
  const errs = await setup(page, 2);
  const L = await page.evaluate(async () => { const m = await import('./js/blocks/card-limits.js'); return { min: m.CVB_H_MIN, max: m.CVB_H_MAX }; });
  expect(L.min < L.max, '★전제: 상수를 읽었다 ' + JSON.stringify(L)).toBe(true);
  const w = await page.evaluate((L) => [window.updateCanvasBlock('cvb_G', { canvasH: L.max + 1 }).ok, window.updateCanvasBlock('cvb_G', { canvasH: L.min - 1 }).ok, window.updateCanvasBlock('cvb_G', { canvasH: L.max - 10 }).ok], L);
  expect(w, 'updateCanvasBlock: 상한+1·하한−1 거절 · 상한−10 받음').toEqual([false, false, true]);
  await pick(page);
  expect(await page.evaluate(() => { const i = document.getElementById('cvb-h'); return [+i.min, +i.max]; }), '패널 「높이」 칸 min/max').toEqual([L.min, L.max]);
  await expect.poll(async () => (await geo(page)).gutters).toBe(1);
  /* 2행 같은 높이 = 경계가 카드 한가운데 — 카드를 화면 가운데로 굴리고, 거터가 그 경계에 붙을 때까지 기다린다(거터는 오버레이라 제가 굴리지 못한다) */
  const toGutter = async () => { await page.evaluate(() => document.getElementById('cvb_G').scrollIntoView({ block: 'center' })); await waitStableRect(page, '#cvb_G');
    await expect.poll(async () => { const g = await geo(page); return g.gutterCy != null && Math.abs(g.gutterCy - g.boundary) <= 1.5 && g.boundary > 0 && g.boundary < 1200; }, '★전제: 거터가 화면 안 경계에 붙었다').toBe(true); return geo(page); };
  const g0 = await toGutter();
  expect(g0.H, '★전제: 상한 바로 아래').toBe(L.max - 10);
  await page.mouse.move(g0.x, g0.boundary); await page.mouse.down();
  await page.mouse.move(g0.x, g0.boundary + 60, { steps: 6 }); await page.mouse.up();
  await expect.poll(async () => (await geo(page)).H, '끌기는 상한에서 멈춘다').toBe(L.max);
  await page.evaluate((L) => window.updateCanvasBlock('cvb_G', { canvasH: L.min + 10 }), L);
  await expect.poll(async () => (await geo(page)).H).toBe(L.min + 10);
  const g1 = await toGutter();
  await page.mouse.move(g1.x, g1.boundary); await page.mouse.down();
  await page.mouse.move(g1.x, g1.boundary - 60, { steps: 6 }); await page.mouse.up();
  await expect.poll(async () => (await geo(page)).H, '끌기는 하한에서 멈춘다').toBe(L.min);
  expect(errs).toEqual([]);
});
