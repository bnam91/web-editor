/* annot-measured-refresh-185.dom.spec.js — 시트 185 ANNOT-PANEL-MEASURED-LENGTH-STALE-01(H-4 · 지디 판정 «고친다 · 보이기만»)
 *   증상(앱 실측 ×3 · 7f3c6de2): 치수선 패널 「잰 길이 …px (참고)」 가 방향 단추(가로·세로) 뒤 옛 값으로 남는다 — 선은 300·100 인데 글 316.
 *   뿌리: 글을 쓰는 자리가 «패널 그릴 때» 한 번뿐 · 방향 단추는 패널을 다시 안 그린다(136 뒤로 선 길이를 바꾼다).
 *   고침: 쓰는 자리 하나(_refreshDimMeasured)를 패널 그리기·방향 바꿈이 같이 부른다. ⛔값 칸(#annot-dim-val)은 안 채운다.
 *   칸 — 기대값은 손 숫자가 아니라 그 순간 dataset 으로 annotDimGeometry 를 불러 낸다
 *     M0 전제 — 처음 고른 패널 글 = geom(auto)
 *     M1 ★가로 누름 뒤 글 = geom(h) · 그려진 선 길이와도 같다
 *     M2 ★세로 누름 뒤 글 = geom(v)
 *     M3 ★자동으로 되돌린 뒤 글 = geom(auto)(가로를 거쳐서 — 옛 판은 «처음 값이 남아 우연히 맞는» 칸이라 M1 뒤에 둔다)
 *     M4 놓았다 다시 고름(패널 열기 길 · 고치기 전에도 맞던 길 — 지키는 칸)
 *     M5 [음성대조] 어느 손짓 뒤에도 값 칸은 그대로 빈 칸(자동 채움 0)
 *   양성대조: 고치기 전 판(7f3c6de2) ⇒ M1·M2 빨강 · M0·M3·M4·M5 초록. 사본에서 방향 단추의 _refreshDimMeasured 한 줄 걷음 ⇒ M1·M2 빨강.
 *   ⛔고정 대기 0 — 조건 대기만. 고르기 = 라벨 실클릭 · 방향 = 패널 단추 실클릭(dim-axis-btn-136 과 같은 장면). */
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
    const mid = [(D[0] + C[0]) / 2 + 30, (D[1] + C[1]) / 2 - 60];
    const place = window.annotDimPlaceAt([D, C], mid, { dimAxis: 'auto' });
    const b = window.makeAnnotationBlock({ points: [D, C], text: '수치입력', annotKind: 'dim', dimA: place.dimA, dimB: place.dimB });
    sec.appendChild(b); window.bindAnnotationSelect?.(b); window.deselectAll?.(); window.buildLayerPanel?.();
    window.pushHistory?.('치수선 추가');
  }, [D, C]);
  await pick(page);
  return errs;
}
async function pick(page) {
  const r = await waitStableRect(page, '#secA .annot-label');
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('#secA .annotation-block.selected')), '★전제: 골라졌다').toBe(true);
  await page.waitForFunction(() => !!document.querySelector('#annot-dim-axis .prop-align-btn[data-axis="h"]') && !!document.getElementById('annot-dim-measured'), null, { timeout: 15000 });
}
/* 그 순간 패널 글 · 기대(geom) · 그려진 선 길이 · 값 칸 */
const read = (page) => page.evaluate(() => {
  const b = document.querySelector('#secA .annotation-block');
  const axis = b.dataset.dimAxis || 'auto';
  const g = window.annotDimGeometry(JSON.parse(b.dataset.points), { dimAxis: axis });
  const l = b.querySelector('.annot-dim-line'); const N = (k) => Number(l.getAttribute(k));
  const m = /잰 길이 (\d+)px/.exec(document.getElementById('annot-dim-measured')?.textContent || '');
  return { axis, want: Math.round(g.len), shown: m ? +m[1] : null, drawn: Math.round(Math.hypot(N('x2') - N('x1'), N('y2') - N('y1'))), val: document.getElementById('annot-dim-val')?.value ?? null };
});
async function pressAxis(page, a) {
  const b = await waitStableRect(page, `#annot-dim-axis .prop-align-btn[data-axis="${a}"]`);
  await page.mouse.click(b.cx, b.cy);
  await expect.poll(async () => (await read(page)).axis, `★전제: dataset.dimAxis = ${a}`).toBe(a);
  return read(page);
}

test('M0 전제 — 처음 고른 패널 글 = geom(auto)', async ({ page }) => {
  const errs = await placeDim(page);
  const r = await read(page);
  console.log('[M0] ' + JSON.stringify(r));
  expect(r.shown, `처음 글 ${JSON.stringify(r)}`).toBe(r.want);
  expect(errs).toEqual([]);
});

test('M1 ★가로 누름 뒤 글 = geom(h) = 그려진 선', async ({ page }) => {
  const errs = await placeDim(page);
  const r = await pressAxis(page, 'h');
  console.log('[M1] ' + JSON.stringify(r));
  expect(r.drawn, '전제: 선이 가로 길이로 바뀌었다(136)').toBe(r.want);
  expect(r.shown, `★가로 뒤 패널 글 ${JSON.stringify(r)}`).toBe(r.want);
  expect(errs).toEqual([]);
});

test('M2 ★세로 누름 뒤 글 = geom(v)', async ({ page }) => {
  const errs = await placeDim(page);
  const r = await pressAxis(page, 'v');
  console.log('[M2] ' + JSON.stringify(r));
  expect(r.shown, `★세로 뒤 패널 글 ${JSON.stringify(r)}`).toBe(r.want);
  expect(errs).toEqual([]);
});

test('M3 ★가로 → 자동 되돌림 뒤 글 = geom(auto)', async ({ page }) => {
  const errs = await placeDim(page);
  await pressAxis(page, 'h');
  const r = await pressAxis(page, 'auto');
  console.log('[M3] ' + JSON.stringify(r));
  expect(r.shown, `★자동 뒤 패널 글 ${JSON.stringify(r)}`).toBe(r.want);
  expect(errs).toEqual([]);
});

test('M4 세로 뒤 놓았다 다시 고름 — 패널 열기 길도 geom(v)', async ({ page }) => {
  const errs = await placeDim(page);
  await pressAxis(page, 'v');
  await page.evaluate(() => window.deselectAll?.());
  await expect.poll(() => page.evaluate(() => !!document.getElementById('annot-dim-measured')), '전제: 패널이 닫혔다').toBe(false);
  await pick(page);
  const r = await read(page);
  console.log('[M4] ' + JSON.stringify(r));
  expect(r.shown).toBe(r.want);
  expect(errs).toEqual([]);
});

test('M5 [음성대조] 가로·세로·자동 어느 뒤에도 값 칸은 빈 칸 그대로(자동 채움 0)', async ({ page }) => {
  const errs = await placeDim(page);
  const vals = [(await read(page)).val];
  for (const a of ['h', 'v', 'auto']) vals.push((await pressAxis(page, a)).val);
  console.log('[M5] ' + JSON.stringify(vals));
  expect(vals).toEqual(['', '', '', '']);
  expect(errs).toEqual([]);
});
