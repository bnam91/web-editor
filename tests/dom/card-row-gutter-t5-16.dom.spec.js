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
    made.block.id = 'cvbG';
    document.getElementById('slotK').replaceWith(made.row);
    window.applyZoom?.(40);
    window.rebindAll?.(); window.deselectAll?.();
    window.renderCanvas(made.block);
    made.block.scrollIntoView({ block: 'center' });
  }, [SEC, rows]);
  await page.waitForFunction(() => !!document.querySelector('#cvbG .cvb-card-title'));
  return errs;
}
async function pick(page) {
  const r = await waitStableRect(page, '#cvbG');
  await page.mouse.click(r.left + r.width * 0.5, r.top + r.height * 0.25);
  await page.waitForFunction(() => document.getElementById('cvbG').classList.contains('selected') && !!document.getElementById('cvb-h'), null, { timeout: 5000 });
}
const geo = (page) => page.evaluate(() => {
  const b = document.getElementById('cvbG'); const r = b.getBoundingClientRect();
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
