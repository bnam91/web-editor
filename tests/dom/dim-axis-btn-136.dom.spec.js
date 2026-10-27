/* dim-axis-btn-136.dom.spec.js — 시트 136 DIM-AXIS-BTN-NO-EFFECT-01 「치수선 방향 단추 먹통」(현빈 직접 GO · 261027)
 *   증상: 우측 패널 「방향」 h·v 를 누르면 dataset.dimAxis 는 바뀌는데 그려진 선의 각도·길이는 그대로.
 *   뿌리: 그리는 자리는 하나(annot-dim-geometry.js annotDimGeometry ← annotRedrawDim)인데 «선 방향»을 정하는 값이 둘이다 —
 *     dimAxis(잰 구간 방향) 와 저장된 dimA·dimB(치수선 양끝 · ③클릭이 늘 채운다). a·b 가 있으면 그대로 쓰여 dimAxis 가 선에 안 닿았다.
 *   칸
 *     X0 전제 — 비뚠 두 점(D→C 기울기) · ③클릭 꼴로 a·b 를 채운 치수선 · 처음 선 = 잰 구간과 평행(auto)
 *     X1 ★h 를 누르면 그려진 선이 «가로»(y1 = y2) · 길이 = 잰 구간의 가로 성분 |Cx − Dx|
 *     X2 ★v 를 누르면 «세로»(x1 = x2) · 길이 = |Cy − Dy|
 *     X3 ★auto 로 되돌리면 다시 잰 구간과 평행 · 길이 = |DC|
 *     X4 ★⌘Z 한 번 = 바로 앞 방향의 선(이력 한 칸에 dimAxis·dimA·dimB 같이)
 *     X5 저장 문자열 왕복(섹션 HTML 다시 들여도) 같은 선
 *     X6 [음성대조] 끝을 끌어 비뚤게 둔 선에서 «이미 고른» 방향(auto)을 다시 눌러도 선 그대로 · 이력 칸 안 늘어남(고치기 전과 같은 동작)
 *   양성대조: 고치기 전(eac99ecd) ⇒ X1·X2·X4 빨강(선이 안 바뀜) · X0·X3·X5 초록(X3·X5 는 «고친 뒤 무너지지 않나» 지키는 칸 — 옛 판은 선이 안 움직여 거저 초록).
 *   ⛔고정 대기 0 — 조건 대기만. 고르기 = 라벨 실클릭 · 방향 = 패널 단추 실클릭.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const D = [200, 160], C = [500, 260];   /* 비뚠 잰 구간 — 가로 300 · 세로 100 */

async function placeDim(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(([D, C]) => {
    document.getElementById('canvas').innerHTML = '<div class="section-block" id="secA" style="position:relative;height:520px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    const sec = document.getElementById('secA');
    /* ③클릭 꼴 — 커서(잰 구간 중점에서 수직으로 60 밖)를 치수선 중점으로 a·b 를 채운다(annotation-tool.js 가 하는 그대로) */
    const mid = [(D[0] + C[0]) / 2 + 30, (D[1] + C[1]) / 2 - 60];
    const place = window.annotDimPlaceAt([D, C], mid, { dimAxis: 'auto' });
    const b = window.makeAnnotationBlock({ points: [D, C], text: '수치입력', annotKind: 'dim', dimA: place.dimA, dimB: place.dimB });
    sec.appendChild(b); window.bindAnnotationSelect?.(b); window.deselectAll?.(); window.buildLayerPanel?.();
    /* 사람 길(annotation-tool.js _finalizeAnnotation)은 놓은 뒤 pushHistory('치수선 추가') 를 한 칸 남긴다 — 팩토리로 바로 놓은 장면도 같은 칸을 남겨야 ⌘Z 가 «놓은 직후»로 간다 */
    window.pushHistory?.('치수선 추가');
  }, [D, C]);
  const r = await waitStableRect(page, '#secA .annot-label');
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('#secA .annotation-block.selected')), '★전제: 골라졌다').toBe(true);
  await page.waitForFunction(() => !!document.querySelector('#annot-dim-axis .prop-align-btn[data-axis="h"]'), null, { timeout: 15000 });
  return errs;
}
const line = (page) => page.evaluate(() => {
  const l = document.querySelector('#secA .annot-dim-line'); const N = (k) => Number(l.getAttribute(k));
  const x1 = N('x1'), y1 = N('y1'), x2 = N('x2'), y2 = N('y2');
  return { x1, y1, x2, y2, len: +Math.hypot(x2 - x1, y2 - y1).toFixed(2), axis: document.querySelector('#secA .annotation-block').dataset.dimAxis };
});
async function pressAxis(page, a) {
  const before = await line(page);
  const b = await waitStableRect(page, `#annot-dim-axis .prop-align-btn[data-axis="${a}"]`);
  await page.mouse.click(b.cx, b.cy);
  await expect.poll(async () => (await line(page)).axis, `★전제: dataset.dimAxis = ${a}`).toBe(a);
  return before;
}
const near = (v, w) => Math.abs(v - w) <= 0.5;

test('X0 전제 — 비뚠 잰 구간 · 처음 선은 잰 구간과 평행(auto)', async ({ page }) => {
  const errs = await placeDim(page);
  const l = await line(page);
  expect(l.axis).toBe('auto');
  const dc = Math.hypot(C[0] - D[0], C[1] - D[1]);
  expect(near(l.len, dc), `처음 길이 = |DC| ${dc.toFixed(2)} · 잰 값 ${JSON.stringify(l)}`).toBe(true);
  expect(Math.abs(l.y2 - l.y1) > 50, '처음 선은 비뚤다(가로 아님)').toBe(true);
  expect(errs).toEqual([]);
});

test('X1 ★h → 그려진 선이 가로 · 길이 = |Cx − Dx|', async ({ page }) => {
  const errs = await placeDim(page);
  await pressAxis(page, 'h');
  const l = await line(page);
  expect({ flat: near(l.y1, l.y2), len: near(l.len, Math.abs(C[0] - D[0])) }, `★h 뒤 선 ${JSON.stringify(l)}`).toEqual({ flat: true, len: true });
  expect(errs).toEqual([]);
});

test('X2 ★v → 세로 · 길이 = |Cy − Dy|', async ({ page }) => {
  const errs = await placeDim(page);
  await pressAxis(page, 'v');
  const l = await line(page);
  expect({ upright: near(l.x1, l.x2), len: near(l.len, Math.abs(C[1] - D[1])) }, `★v 뒤 선 ${JSON.stringify(l)}`).toEqual({ upright: true, len: true });
  expect(errs).toEqual([]);
});

test('X3 ★h 뒤 auto → 다시 잰 구간과 평행 · 길이 = |DC|', async ({ page }) => {
  const errs = await placeDim(page);
  await pressAxis(page, 'h');
  await pressAxis(page, 'auto');
  const l = await line(page);
  const dc = Math.hypot(C[0] - D[0], C[1] - D[1]);
  const slope = (l.y2 - l.y1) / (l.x2 - l.x1), want = (C[1] - D[1]) / (C[0] - D[0]);
  expect({ len: near(l.len, dc), slope: Math.abs(slope - want) < 0.01 }, `★auto 뒤 선 ${JSON.stringify(l)}`).toEqual({ len: true, slope: true });
  expect(errs).toEqual([]);
});

test('X4 ★⌘Z 한 번 = 바로 앞 방향의 선', async ({ page }) => {
  const errs = await placeDim(page);
  const l0 = await line(page);
  await pressAxis(page, 'h');
  const l1 = await line(page);
  expect(near(l1.y1, l1.y2), '전제: h 로 바뀌었다').toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await page.evaluate(() => document.querySelector('#secA .annotation-block')?.dataset.dimAxis)), '★⌘Z 뒤 dimAxis').toBe('auto');
  const l2 = await line(page);
  expect({ x1: near(l2.x1, l0.x1), y1: near(l2.y1, l0.y1), x2: near(l2.x2, l0.x2), y2: near(l2.y2, l0.y2) }, `★⌘Z 뒤 선 = 처음 선 · 처음 ${JSON.stringify(l0)} · 뒤 ${JSON.stringify(l2)}`)
    .toEqual({ x1: true, y1: true, x2: true, y2: true });
  expect(errs).toEqual([]);
});

test('X5 저장 문자열 왕복 — v 로 바꾼 선이 섹션 HTML 을 다시 들여도 같다', async ({ page }) => {
  const errs = await placeDim(page);
  await pressAxis(page, 'v');
  const l1 = await line(page);
  await page.evaluate(() => { const sec = document.getElementById('secA'); window.deselectAll?.(); const html = sec.outerHTML; const c = document.getElementById('canvas'); sec.remove(); c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); });
  await page.waitForFunction(() => !!document.querySelector('#secA .annot-dim-line'), null, { timeout: 8000 });
  const l2 = await line(page);
  expect({ axis: l2.axis, x1: near(l2.x1, l1.x1), y1: near(l2.y1, l1.y1), x2: near(l2.x2, l1.x2), y2: near(l2.y2, l1.y2) }, `★왕복 뒤 ${JSON.stringify(l2)} · 앞 ${JSON.stringify(l1)}`)
    .toEqual({ axis: 'v', x1: true, y1: true, x2: true, y2: true });
  expect(errs).toEqual([]);
});

test('X6 [음성대조] 이미 고른 방향을 다시 누르면 선 그대로 — 끌어 둔 비뚠 a·b 를 펴지 않는다 · 이력 칸 안 늘어남', async ({ page }) => {
  const errs = await placeDim(page);
  /* 끝 끌기(annotation-select.js 의 손)가 남기는 꼴 — a 만 옮겨 선을 비뚤게 · 그 손처럼 이력 한 칸 */
  await page.evaluate(() => { const b = document.querySelector('#secA .annotation-block'); const a = JSON.parse(b.dataset.dimA);
    b.dataset.dimA = JSON.stringify([a[0] - 20, a[1] + 40]); window.annotRedrawDim(b, window.annotPropsFromDataset(b)); window.pushHistory?.('치수선 끝 끌기'); });
  expect((await line(page)).y1 !== (await line(page)).y2, '전제: 끌어 둔 선이 그려졌다(비뚤다)').toBe(true);
  const l0 = await line(page);
  const h0 = await page.evaluate(() => window.getHistoryTip?.().pos ?? null);
  const b = await waitStableRect(page, '#annot-dim-axis .prop-align-btn[data-axis="auto"]');
  await page.mouse.click(b.cx, b.cy);
  await expect.poll(() => page.evaluate(() => document.querySelector('#annot-dim-axis .prop-align-btn[data-axis="auto"]')?.classList.contains('active')), '전제: auto 단추 눌림').toBe(true);
  const l1 = await line(page);
  const h1 = await page.evaluate(() => window.getHistoryTip?.().pos ?? null);
  expect({ x1: near(l1.x1, l0.x1), y1: near(l1.y1, l0.y1), x2: near(l1.x2, l0.x2), y2: near(l1.y2, l0.y2), hist: h1 === h0 }, `★다시 누른 뒤 ${JSON.stringify(l1)} · 앞 ${JSON.stringify(l0)} · 이력 ${h0}→${h1}`)
    .toEqual({ x1: true, y1: true, x2: true, y2: true, hist: true });
  expect(errs).toEqual([]);
});
