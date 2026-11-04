/* sticker-multi-move-t901.dom.spec.js — t9-01(현빈 6655): 여러 개 고른 마킹 블럭을 끌면 같이 움직인다(옛 1013t2C1 «끈 것은 하나만» 뒤집음).
 * ⌘·⇧ 클릭 · 선택상자 · ⌘Z 한 걸음 · 저장 왕복 · 섹션 넘기 · 섞인 선택(흐름 블럭은 좌표가 없어 제자리).
 * 음성: 하나만 고름 · 안 골라진 것을 끌면 옛 선택은 풀리고 그것만 움직임. 진짜 마우스 · 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const SEC = (id, n) => `<div class="section-block" id="${id}" data-section="${n}" data-name="${id}" data-bg="#fff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">${id}</span></div>
  <div class="section-inner" style="padding-left:32px;padding-right:32px;"><div class="frame-block" id="tf${id}" data-text-frame="true"><div class="text-block" id="tb${id}" data-type="body"><div class="tb-body" contenteditable="false">글자</div></div></div><div class="gap-block" data-type="gap" style="height:420px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate((html) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100); }, SEC('sA', 1) + SEC('sB', 2));
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sA'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    const mk = (id, opts) => { window.deselectAll?.(); window.selectSection?.(sec); const before = new Set(sec.querySelectorAll(':scope > .sticker-block'));
      window.addStickerBlock(opts); const b = [...sec.querySelectorAll(':scope > .sticker-block')].find(x => !before.has(x)); b.id = id; };
    mk('m1', { count: '1', x: 120, y: 120 }); mk('m2', { count: '2', x: 300, y: 120 }); mk('m3', { count: '3', x: 480, y: 120 });
    window.deselectAll?.(); document.activeElement?.blur?.();
  });
  return errs;
}
const pos = (page, ids = ['m1', 'm2', 'm3']) => page.evaluate((ids) => Object.fromEntries(ids.map(i => { const e = document.getElementById(i); const r = e.getBoundingClientRect();
  return [i, { x: +e.dataset.x, y: +e.dataset.y, left: parseInt(e.style.left), top: parseInt(e.style.top), sec: e.parentElement.id, sx: Math.round(r.left), sy: Math.round(r.top) }]; })), ids);
const sel = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].filter(e => !e.classList.contains('section-block')).map(e => e.id).sort());
const center = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
async function clickOn(page, id, mod) { const [x, y] = await center(page, id); if (mod) await page.keyboard.down(mod); await page.mouse.click(x, y); if (mod) await page.keyboard.up(mod); }
async function drag(page, id, dx, dy) { const [x, y] = await center(page, id); await page.mouse.move(x, y); await page.mouse.down();
  for (let s = 1; s <= 6; s++) await page.mouse.move(x + dx * s / 6, y + dy * s / 6); await page.mouse.up(); }
const moved = (a, b, id) => [b[id].x - a[id].x, b[id].y - a[id].y];

for (const mod of ['Meta', 'Shift']) test(`T1 ★${mod} 클릭 둘 → 끌기 = 둘 다 같은 양 · 안 고른 셋째 제자리 · 선택 유지`, async ({ page }) => {
  const errs = await setup(page);
  await clickOn(page, 'm1'); await clickOn(page, 'm2', mod);
  await expect.poll(() => sel(page), { message: '전제: 둘' }).toEqual(['m1', 'm2']);
  const a = await pos(page);
  await drag(page, 'm2', 60, 40);
  const b = await pos(page);
  console.log('[T1] ' + JSON.stringify({ mod, a, b }));
  expect(moved(a, b, 'm2')).toEqual([60, 40]);
  expect(moved(a, b, 'm1'), '★같이 움직인다').toEqual([60, 40]);
  expect(moved(a, b, 'm3'), '음성: 안 고른 것').toEqual([0, 0]);
  expect([b.m1.left, b.m1.top], 'style 도').toEqual([b.m1.x, b.m1.y]);
  expect(await sel(page), '선택 유지').toEqual(['m1', 'm2']);
  expect(errs).toEqual([]);
});

test('T2 ★선택상자로 셋 → 끌기 = 셋 다', async ({ page }) => {
  const errs = await setup(page);
  const p = await page.evaluate(() => { const c = document.getElementById('canvas').getBoundingClientRect(); const rs = ['m1', 'm2', 'm3'].map(i => document.getElementById(i).getBoundingClientRect());
    return { x0: c.left - 40, y0: Math.max(...rs.map(r => r.bottom)) + 12, x1: Math.max(...rs.map(r => r.right)) + 8, y1: Math.min(...rs.map(r => r.top)) - 8 }; });
  await page.mouse.move(p.x0, p.y0); await page.mouse.down();
  for (let s = 1; s <= 8; s++) await page.mouse.move(p.x0 + (p.x1 - p.x0) * s / 8, p.y0 + (p.y1 - p.y0) * s / 8);
  await page.mouse.up();
  await expect.poll(() => sel(page), { message: '전제: 상자로 셋' }).toEqual(['m1', 'm2', 'm3']);
  const a = await pos(page);
  await drag(page, 'm3', -50, 70);
  const b = await pos(page);
  for (const id of ['m1', 'm2', 'm3']) expect(moved(a, b, id), id).toEqual([-50, 70]);
  expect(errs).toEqual([]);
});

test('T3 ★⌘Z 한 걸음에 전부 복귀 · ⌘⇧Z 로 전부 다시', async ({ page }) => {
  const errs = await setup(page);
  await clickOn(page, 'm1'); await clickOn(page, 'm2', 'Meta'); await clickOn(page, 'm3', 'Meta');
  await expect.poll(() => sel(page)).toEqual(['m1', 'm2', 'm3']);
  const a = await pos(page);
  const r = await expectOneUndoStep(page, async () => { await drag(page, 'm1', 70, 30); }, '마킹 셋 끌기');
  console.log('[T3] ' + JSON.stringify(r?.dPos));
  expect(await pos(page), '★셋 다 처음 자리').toEqual(a);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(async () => moved(a, await pos(page), 'm3')).toEqual([70, 30]);
  const b = await pos(page);
  expect(moved(a, b, 'm1')).toEqual([70, 30]); expect(moved(a, b, 'm2')).toEqual([70, 30]);
  expect(errs).toEqual([]);
});

test('T4 ★저장 글자 왕복 뒤 자리 유지', async ({ page }) => {
  const errs = await setup(page);
  await clickOn(page, 'm1'); await clickOn(page, 'm2', 'Meta');
  await drag(page, 'm1', 45, 55);
  const b = await pos(page);
  const r = await page.evaluate(() => { const s = window.getSerializedCanvas(); const c = document.getElementById('canvas'); c.innerHTML = s; window.rebindAll({ preserveHistory: true }); return s === window.getSerializedCanvas() ? 'same' : 'diff'; });
  const c = await pos(page);
  console.log('[T4] ' + r);
  for (const id of ['m1', 'm2', 'm3']) expect([c[id].x, c[id].y, c[id].left, c[id].top], id).toEqual([b[id].x, b[id].y, b[id].x, b[id].y]);
  expect(errs).toEqual([]);
});

test('T5 섹션을 넘어도 대열 그대로(화면 간격 같음) · 재부모', async ({ page }) => {
  const errs = await setup(page);
  await clickOn(page, 'm1'); await clickOn(page, 'm2', 'Meta');
  const a = await pos(page);
  const dy = await page.evaluate(() => { const s = document.getElementById('sA').getBoundingClientRect(), b = document.getElementById('sB').getBoundingClientRect(); const m = document.getElementById('m1').getBoundingClientRect(); return Math.round(b.top + 150 - m.top); });
  await drag(page, 'm1', 20, dy);
  const b = await pos(page);
  console.log('[T5] ' + JSON.stringify({ a, b, dy }));
  expect([b.m1.sec, b.m2.sec], '둘 다 아래 섹션으로').toEqual(['sB', 'sB']);
  expect(b.m2.sx - b.m1.sx, '★화면 가로 간격').toBe(a.m2.sx - a.m1.sx);
  expect(b.m2.sy - b.m1.sy, '★화면 세로 간격').toBe(a.m2.sy - a.m1.sy);
  expect(errs).toEqual([]);
});

test('T6 섞인 선택(마킹 둘+흐름 글자): 마킹을 끌면 마킹만 · 글자는 제자리·선택 유지 · ⌘Z 전부 복귀', async ({ page }) => {
  const errs = await setup(page);
  await clickOn(page, 'm1'); await clickOn(page, 'm2', 'Meta'); await clickOn(page, 'tbsA', 'Meta');
  await expect.poll(() => sel(page), { message: '전제: 셋' }).toEqual(['m1', 'm2', 'tbsA']);
  const a = await pos(page); const t0 = await center(page, 'tbsA'); const s0 = await page.evaluate(() => window.getSerializedCanvas());
  await drag(page, 'm1', 60, 40);
  const b = await pos(page);
  expect(moved(a, b, 'm1')).toEqual([60, 40]); expect(moved(a, b, 'm2')).toEqual([60, 40]);
  expect(await center(page, 'tbsA'), '글자 제자리').toEqual(t0);
  expect(await sel(page), '선택 유지').toEqual(['m1', 'm2', 'tbsA']);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => pos(page)).toEqual(a);
  expect(s0.length > 0).toBe(true);
  expect(errs).toEqual([]);
});

test('T9 섹션이 다른 마킹 둘 — 같이 · 각자 제 섹션에 남는다(작은 끌기)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const sec = document.getElementById('sB'); window.deselectAll?.(); window.selectSection?.(sec); const before = new Set(sec.querySelectorAll(':scope > .sticker-block')); window.addStickerBlock({ count: '4', x: 120, y: 60 }); [...sec.querySelectorAll(':scope > .sticker-block')].find(x => !before.has(x)).id = 'm4'; window.deselectAll?.(); });
  await clickOn(page, 'm1'); await clickOn(page, 'm4', 'Meta');
  await expect.poll(() => sel(page), { message: '전제: 둘' }).toEqual(['m1', 'm4']);
  const ids = ['m1', 'm4']; const a = await pos(page, ids);
  await drag(page, 'm1', 50, 20);
  const b = await pos(page, ids);
  expect(moved(a, b, 'm1')).toEqual([50, 20]); expect(moved(a, b, 'm4'), '★다른 섹션 것도').toEqual([50, 20]);
  expect([b.m1.sec, b.m4.sec]).toEqual(['sA', 'sB']);
  expect(errs).toEqual([]);
});

test('T7 음성 — 하나만 고름 = 그것만 · 안 골라진 것을 끌면 옛 선택 풀리고 그것만', async ({ page }) => {
  const errs = await setup(page);
  await clickOn(page, 'm1');
  let a = await pos(page);
  await drag(page, 'm1', 30, 30);
  let b = await pos(page);
  expect(moved(a, b, 'm1')).toEqual([30, 30]); expect(moved(a, b, 'm2')).toEqual([0, 0]); expect(moved(a, b, 'm3')).toEqual([0, 0]);
  await clickOn(page, 'm2', 'Meta');
  await expect.poll(() => sel(page)).toEqual(['m1', 'm2']);
  a = await pos(page);
  await drag(page, 'm3', 40, 20);
  b = await pos(page);
  expect(moved(a, b, 'm3')).toEqual([40, 20]);
  expect(moved(a, b, 'm1'), '★옛 선택은 안 따라온다').toEqual([0, 0]); expect(moved(a, b, 'm2')).toEqual([0, 0]);
  expect(await sel(page)).toEqual(['m3']);
  expect(errs).toEqual([]);
});

test('T8 선 스티커가 섞여도 같이 · 선을 잡고 끌어도 같이', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const sec = document.getElementById('sA'); window.deselectAll?.(); window.selectSection?.(sec); const before = new Set(sec.querySelectorAll(':scope > .sticker-block')); window.addStickerBlock({ shape: 'arrow', x1: 200, y1: 300, x2: 400, y2: 300 }); const l = [...sec.querySelectorAll(':scope > .sticker-block')].find(x => !before.has(x)); l.id = 'ln'; window.deselectAll?.(); });
  const line = () => page.evaluate(() => { const d = document.getElementById('ln').dataset; return [+d.x1, +d.y1, +d.x2, +d.y2]; });
  const l0 = await line();
  await clickOn(page, 'm1'); await clickOn(page, 'ln', 'Meta');
  await expect.poll(() => sel(page), { message: '전제: 둘' }).toEqual(['ln', 'm1']);
  const a = await pos(page);
  await drag(page, 'm1', 25, 35);
  const b = await pos(page);
  expect(moved(a, b, 'm1')).toEqual([25, 35]);
  expect(await line(), '선 peer').toEqual([l0[0] + 25, l0[1] + 35, l0[2] + 25, l0[3] + 35]);
  await drag(page, 'ln', -15, 10);
  const c = await pos(page);
  expect(moved(b, c, 'm1'), '선 leader').toEqual([-15, 10]);
  expect(errs).toEqual([]);
});
