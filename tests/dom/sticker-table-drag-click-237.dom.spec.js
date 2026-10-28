/* sticker-table-drag-click-237.dom.spec.js — 끈 뒤 click 이 새어 고름이 풀리지 않는다: sticker-select:529(⌘드래그 · 안 골라진 스티커) · table-cell-select:85(칸 끌어 사각 · :302 갈래) (237)
 *
 * 까닭(S5 261029 · 판 333aa3d9): 두 자리는 공용 본문 무력화(237 ⒜ 분모 12)에서 «잡는 spec 없음» · 자리별 무력화(그 한 줄만 끈 사본)에서 행위로 샌다 3/3.
 *   끈 뒤 브라우저 click 의 대상 = mousedown·mouseup 공통 조상 ⇒ 안 삼키면 deselectAll 이 고름을 푼다.
 * ★놓는 점의 임자를 «먼저» 단언(스티커는 섹션 안으로 clamp 안 되고 손을 따라온다 ⇒ 섹션 밖 canvas-wrap · 표는 섹션 폭을 다 차 ⇒ 표 아래 갭).
 * 한 쌍: 자리 한 줄만 끈 사본(GD1001_ROOT)에서 그 칸 빨강 · 그대로 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect, waitZoomSettled } = require('./_root-harness.js');
const STEPS_CELL = 10;   // 칸 끌기 걸음 수(이름 상수 — dom-screen-px-census 의 3줄 창이 루프 경계 숫자를 «화면 px 문턱» 으로 읽지 않게)
async function drag(page, from, to, blkSel, steps = 14) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
  const at = await page.evaluate(([x, y, s]) => { const h = document.elementFromPoint(x, y); return { inBlk: !!h?.closest?.(s), inSec: !!h?.closest?.('.section-block'), who: h ? (h.id || String(h.className)).slice(0, 40) : null }; }, [to.x, to.y, blkSel]);
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));   // ⛔waitForFunction Promise 술어(182) · 고정 대기 없이
  return at;
}
test('S sticker-select:529 ⌘드래그(안 골라진 스티커) 섹션 밖에서 놓기 ⇒ 그 스티커 골라짐 유지', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="secA" data-section="1" style="height:600px;background:#eee;"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;"><div class="gap-block" data-type="gap" style="height:580px;"></div></div></div>');
    window.rebindAll?.(); window.selectSection(document.getElementById('secA'));
    window.addStickerBlock({ shape: 'square', x: 300, y: 200, size: 160, text: 'S' });
    const b = [...document.querySelectorAll('#secA .sticker-block')].pop(); window.deselectAll?.(); document.getElementById('secA').scrollIntoView({ block: 'center' }); return b.id;
  });
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  const r = await waitStableRect(page, '#' + id);
  const pre = await page.evaluate((i) => ({ sel: document.getElementById(i).classList.contains('selected'), x: document.getElementById(i).dataset.x, y: document.getElementById(i).dataset.y }), id);
  expect(pre.sel, '전제: 손 전 안 골라짐').toBe(false);
  const sec = await page.evaluate(() => { const s = document.getElementById('secA').getBoundingClientRect(); return { l: s.left, t: s.top }; });
  const to = { x: Math.max(6, Math.round(sec.l - 60)), y: Math.round(r.cy) };   // 섹션 왼쪽 밖(스티커는 섹션 안으로 clamp)
  await page.keyboard.down('Meta');
  let at; try { at = await drag(page, { x: r.cx, y: r.cy }, to, '#' + id); } finally { await page.keyboard.up('Meta'); }
  const s = await page.evaluate((i) => { const b = document.getElementById(i); return { sel: b.classList.contains('selected'), x: b.dataset.x, y: b.dataset.y, nSel: document.querySelectorAll('#canvas .selected:not(.section-block)').length }; }, id);
  expect(!at.inBlk, '전제: 놓는 점 = 블럭 밖 · 임자 ' + at.who).toBe(true);
  expect(s.x !== pre.x || s.y !== pre.y, '전제: 끌기가 걸렸다(x/y 바뀜)').toBe(true);
  expect(s.sel, '★끈 뒤 click 이 새어 스티커 고름이 풀렸다').toBe(true);
});
test('T table-cell-select:302 칸 끌어 고르기 → 표 밖(섹션 안)에서 놓기 ⇒ cell-selected 수 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1200 });
  await bootApp(page);
  const id = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="tS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('tS')); window.addTableBlock();
    const b = [...document.querySelectorAll('#tS table')].pop().closest('[id]'); window.deselectAll?.(); b.scrollIntoView({ block: 'center' }); return b.id;
  });
  await waitZoomSettled(page, 100);
  await waitStableRect(page, '#' + id);
  const k = await page.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return [r.left + 6, r.top + 4]; }, id);
  await page.mouse.click(k[0], k[1]);
  await expect.poll(() => page.evaluate((i) => document.getElementById(i).classList.contains('selected'), id), '전제: 표 골라짐').toBe(true);
  const cells = await page.evaluate((i) => [...document.querySelectorAll(`#${i} .tb-table tbody td`)].slice(0, 99).map((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }), id);
  expect(cells.length >= 4, '전제: tbody td ≥4 · ' + cells.length).toBe(true);
  const a = cells[0], b2 = cells[cells.length - 1];
  const sec = await page.evaluate((i) => { const s = document.getElementById('tS').getBoundingClientRect(), t = document.getElementById(i).getBoundingClientRect(); return { sb: s.bottom, tb: t.bottom, tl: t.left, sl: s.left, st: s.top, tt: t.top }; }, id);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= STEPS_CELL; i++) await page.mouse.move(a.x + (b2.x - a.x) * i / STEPS_CELL, a.y + (b2.y - a.y) * i / STEPS_CELL);
  const mid = await page.evaluate((i) => document.querySelectorAll(`#${i} .cell-selected`).length, id);
  /* v3(02:36 잼: 표 row 가 섹션 위끝부터 · 섹션 안 표 밖 = 아래 갭 16px 뿐) — 표 아래 갭에 놓는다 */
  const to = { x: Math.round(b2.x), y: Math.round((sec.tb + sec.sb) / 2) };
  for (let i = 1; i <= 6; i++) await page.mouse.move(b2.x, b2.y + (to.y - b2.y) * i / 6);
  const at = await page.evaluate(([x, y, s]) => { const h = document.elementFromPoint(x, y); return { inBlk: !!h?.closest?.(s), inSec: !!h?.closest?.('#tS'), who: h ? (h.id || String(h.className)).slice(0, 40) : null }; }, [to.x, to.y, '#' + id]);
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));   // ⛔waitForFunction Promise 술어(182) · 고정 대기 없이
  const s = await page.evaluate((i) => ({ n: document.querySelectorAll(`#${i} .cell-selected`).length, sel: document.getElementById(i).classList.contains('selected') }), id);
  expect(!at.inBlk, '전제: 놓는 점 = 표 밖 · 임자 ' + at.who).toBe(true);
  expect(mid >= 2, '전제: 끌기 중 칸 ≥2 골라짐 · ' + mid).toBe(true);
  expect(s.n, '★끈 뒤 click 이 새어 칸 고름이 풀렸다').toBe(mid);
});
