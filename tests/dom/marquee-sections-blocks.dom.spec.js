/* marquee-sections-blocks.dom.spec.js — A1 (현빈 2026-10-01 「선택상자 — 지금 스크래치 패드만 되는데 섹션 및 블럭도」)
 * 앱 통째로 헤드리스(bootApp) — 진짜 마우스로 빈 바닥에서 끌어 상자를 만든다.
 * ★양성대조 판 = 7699ea33 → 빨강이어야 할 것: Q0(스크래치 0개면 상자가 안 떴다 — 실측 재현) Q1 Q2 Q3 Q4 Q5 Q7a Q7b.
 *   Q8 도 그 판에선 빨강이나 «전제»(상자로 블럭을 고른다)에서 진다 — 지키는 대상(⌘M 무토스트)은 옛 판에서 못 잰다.
 *   Q6 · Q8 은 지키는 시험(섹션 위에서 시작한 끌기는 상자가 아니다 · 블럭만 고른 평소 상태의 ⌘M 은 그대로).
 * 판정: 스크래치 = 걸치면 · 섹션·블럭 = 면적 MARQUEE_COVER_RATIO(0.5, 미측정·잠정) 이상 덮으면 · 섹션이 잡히면 그 안 블럭은 안 잡는다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SECS = `
<div class="section-block" id="qA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" style="height:80px"></div>
    <div class="row" id="rowQ"><div class="asset-block" id="abQ" style="height:200px;"></div></div>
    <div class="gap-block" data-type="gap" style="height:500px"></div></div></div>
<div class="section-block" id="qB" data-section="2" data-name="B" data-bg="#eeeeee" style="background:#eee;">
  <div class="section-hitzone"><span class="section-label">B</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" style="height:600px"></div></div></div>`;

async function setup(page, { zoom } = {}) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  await page.evaluate(([html, zoom]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    if (zoom) window.applyZoom?.(zoom);
    document.getElementById('qA').scrollIntoView({ block: 'start' }); }, [SECS, zoom || 0]);
  await page.waitForTimeout(300);
}
/* model(캔버스) 좌표 → 화면 좌표. 상자를 «캔버스 기준»으로 적어 줌이 바뀌어도 같은 상자를 그린다. */
const toScreen = (page, mx, my) => page.evaluate(([mx, my]) => {
  const sc = document.getElementById('canvas-scaler'); const r = sc.getBoundingClientRect();
  const m = sc.style.transform?.match(/scale\(([^)]+)\)/); const k = m ? parseFloat(m[1]) : 1;
  const c = document.getElementById('canvas').getBoundingClientRect();
  return [r.left + mx * k, r.top + my * k, (c.left - r.left) / k, (c.top - r.top) / k];
}, [mx, my]);
/* 캔버스 왼쪽 바깥(바닥)에서 시작해 (dx,dy) 캔버스 px 만큼 끈다 — 시작 x 는 캔버스 왼끝 -60 */
async function marquee(page, startY, dx, dy, opts = {}) {
  const [, , cx0, cy0] = await toScreen(page, 0, 0);
  const sx = cx0 - 60, sy = cy0 + startY;
  const [x0, y0] = await toScreen(page, sx, sy);
  const [x1, y1] = await toScreen(page, sx + dx, sy + dy);
  if (opts.shift) await page.keyboard.down('Shift');
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10);
  const during = await page.evaluate(() => ({ box: document.querySelectorAll('.scratch-marquee').length, hit: [...document.querySelectorAll('#canvas .marquee-hit')].map(e => e.id) }));
  await page.mouse.up();
  if (opts.shift) await page.keyboard.up('Shift');
  await page.waitForTimeout(150);
  return during;
}
const sel = (page) => page.evaluate(() => ({ secs: [...document.querySelectorAll('#canvas .section-block.multi-selected')].map(s => s.id),
  blocks: [...document.querySelectorAll('#canvas .asset-block.selected, #canvas .text-block.selected')].map(b => b.id), scratch: document.querySelectorAll('.scratch-item.scratch-selected').length }));

test('Q0 ★스크래치 항목이 0개여도 빈 바닥을 끌면 상자가 뜬다(옛 판은 안 떴다)', async ({ page }) => {
  await setup(page);
  const d = await marquee(page, 20, 200, 120);
  expect(d.box).toBe(1);
});

test('Q1 ★두 섹션 높이의 반 이상을 덮으면 두 섹션이 «여러 개 선택» · ⌘M 이 실제로 합친다', async ({ page }) => {
  await setup(page);
  const d = await marquee(page, 30, 1000, 1350);
  expect(d.hit.sort()).toEqual(['qA', 'qB']);
  expect((await sel(page)).secs.sort()).toEqual(['qA', 'qB']);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+m');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => !!document.getElementById('qB'))).toBe(false);
});

test('Q2 ★작은 상자 — 섹션은 반도 안 덮고 블럭(에셋)은 반 이상 덮으면 블럭만', async ({ page }) => {
  await setup(page);
  const d = await marquee(page, 80, 560, 200);     // 에셋(전폭 860×200)의 ~58% · 섹션 A 의 ~15%
  expect(d.hit).toEqual(['abQ']);
  const s = await sel(page);
  expect(s.blocks).toEqual(['abQ']);
  expect(s.secs).toEqual([]);
});

test('Q3 스크래치 항목과 섹션을 한 상자로 같이', async ({ page }) => {
  await setup(page);
  const [, , cx0, cy0] = await toScreen(page, 0, 0);
  await page.evaluate(async ([px, x, y]) => { await window._scratchAddAndSave(px, x, y, 40); }, [PX, cx0 - 50, cy0 + 40]);
  await marquee(page, 30, 1000, 1350);
  const s = await sel(page);
  expect(s.scratch).toBe(1);
  expect(s.secs.sort()).toEqual(['qA', 'qB']);
});

test('Q4 ★섹션+블럭이 섞이면 ⌘M 이 «왜 안 되는지» 말한다(조용히 아무 일도 안 하지 않는다)', async ({ page }) => {
  await setup(page);
  await marquee(page, 900, 1000, 600);                        // 섹션 B 만(반 이상)
  await marquee(page, 80, 560, 200, { shift: true });          // ⇧ 로 에셋 블럭 더하기
  const s = await sel(page);
  expect(s.secs).toEqual(['qB']);
  expect(s.blocks).toEqual(['abQ']);
  await page.evaluate(() => { window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); }; document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+m');
  expect((await page.evaluate(() => window.__t)).join('|')).toContain('섹션과 블럭이 같이');
});

test('Q5 빈 바닥 단순 클릭 = 셋 다 풀린다', async ({ page }) => {
  await setup(page);
  await marquee(page, 30, 1000, 1350);
  expect((await sel(page)).secs.length).toBe(2);               // 전제 — 먼저 골라져 있어야 «풀렸다»가 뜻이 있다(공짜 초록 막기)
  const [, , cx0, cy0] = await toScreen(page, 0, 0);
  const [x, y] = await toScreen(page, cx0 - 60, cy0 + 20);
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  expect(await sel(page)).toEqual({ secs: [], blocks: [], scratch: 0 });
});

test('Q6 지키는 시험 — 섹션 «위»에서 시작한 끌기는 상자가 아니다', async ({ page }) => {
  await setup(page);
  const [x0, y0] = await page.evaluate(() => { const r = document.getElementById('qB').getBoundingClientRect(); return [r.left + 100, r.top + 100]; });
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + 20 * i, y0 + 15 * i);
  const box = await page.evaluate(() => document.querySelectorAll('.scratch-marquee').length);
  await page.mouse.up();
  expect(box).toBe(0);
});

test('Q8 지키는 시험 — 블럭만 고른 평소 상태(부모 섹션도 .selected)에선 ⌘M 토스트도 합치기도 없다 · ⇧ 로 블럭을 더해도 부모 섹션이 끌려오지 않는다', async ({ page }) => {
  await setup(page);
  await marquee(page, 80, 560, 200);                          // 에셋 블럭만
  await marquee(page, 80, 560, 200, { shift: true });          // ⇧ 로 같은 자리 한 번 더(블럭이 이미 골라짐)
  const s = await sel(page);
  expect(s.blocks).toEqual(['abQ']);
  expect(s.secs).toEqual([]);
  await page.evaluate(() => { window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); }; document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+m');
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__t)).join('|')).not.toContain('섹션과 블럭이 같이');
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length)).toBe(2);
});

test('Q9 숨은 시안(data-variation-active="0" = display:none)은 상자가 덮어도 안 잡힌다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => document.getElementById('qB').setAttribute('data-variation-active', '0'));
  expect(await page.evaluate(() => document.getElementById('qB').getBoundingClientRect().height)).toBe(0);   // 전제 — 정말 숨었다
  const d = await marquee(page, 30, 1000, 1350);
  expect(d.hit).toEqual(['qA']);
  expect(await page.evaluate(() => document.getElementById('qB').classList.contains('selected'))).toBe(false);
});

for (const z of [0.5, 2]) {
  test(`Q7${z === 0.5 ? 'a' : 'b'} ★줌 ${z * 100}% 에서도 «캔버스 기준 같은 상자»가 같은 것을 고른다(Q2 와 같은 결과)`, async ({ page }) => {
    await setup(page, { zoom: z });
    const d = await marquee(page, 80, 560, 200);
    expect(d.hit).toEqual(['abQ']);
    expect((await sel(page)).blocks).toEqual(['abQ']);
  });
}
