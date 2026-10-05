/* u29-scratch-yield-cover.dom.spec.js — U29 ㉡(지디 A+C 2026-10-05): 칸에 넣은 줄이 스크래치 카드에 «가려지는» 일
 *
 * 머리표(지디 규율): [새 것] 9ef09f76 에서 빨강 · [회귀 지킴] 9ef09f76 에서도 초록 · [전제] 재기 위한 조건.
 *   A = 캔버스 블럭을 «끄는 동안만» 카드가 비킨다(body.scratch-yield-drag → .scratch-item 반투명·클릭 통과)
 *       켬 = dragstart · 끔 = dragend · drop · mousedown(안전망) — js/scratch-pad.js 「U29 ㉡ A」.
 *   C = 놓은 «뒤» 새 줄이 «정말» 가렸으면(겹침 넓이 > 0 ∧ 새 줄 중심 맨 위 = 카드) 알림 + 「참고 이미지 숨기기」.
 * ★음성대조(취소): Esc · 창 밖에 놓기 · 빗나간 놓기 — 끈 «동안 켜졌다»를 전제로 단언한 뒤 «끝나면 꺼졌다»를 잰다
 *   (전제가 없으면 옛 판에서 «원래 안 켜져서» 초록이 되는 헛 시험이 된다).
 * 장면 = 실측 U29b P1/P4/P5 와 같은 꼴(칸 = 이미지 줄 + 글줄 · 카드 = 칸 폭). 끌기 = 진짜 마우스(Playwright HTML5 끌기).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function scene(page, pos) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sU" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="rG" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:160px"></div></div></div>');
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 120; const x = cv.getContext('2d'); x.fillStyle = '#2a9d8f'; x.fillRect(0, 0, 200, 120);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'image', imgSrc: cv.toDataURL('image/png') }, { type: 'body', text: '칸 글줄' }] }, { width: 1, lines: [{ type: 'body', text: '칸 B' }] }] });
    g.id = 'gU'; document.getElementById('rG').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
    const sec = document.getElementById('sU'); window.deselectAll?.(); window.selectSection?.(sec);
    const before = new Set([...document.querySelectorAll('.text-block')].map(t => t.id));
    window.addTextBlock('h2');   // T▾ Heading 과 같은 함수(글자 프레임째 — 9ef09f76 G9 가 받는 꼴)
    const tb = [...document.querySelectorAll('.text-block')].find(t => !before.has(t.id));
    tb.querySelector('[class^="tb-"]').innerText = '끌 글자'; tb.querySelector('[class^="tb-"]').removeAttribute('data-is-placeholder');
    window.deselectAll?.(); window.applyZoom?.(50); window.clearHistory?.();
    return { tb: tb.id };
  });
  await page.waitForTimeout(500);
  /* 카드 자리(스케일러 좌표) — 칸(0,0) 기하에서. P1 칸 전부 · P4 칸 바로 아래 · P5 멀리 */
  const geo = await page.evaluate(() => {
    const cell = document.querySelector('#gU .grd-cell[data-r="0"][data-c="0"]'); const sc = document.getElementById('canvas-scaler'); const z = window.currentZoom / 100;
    const sr = sc.getBoundingClientRect(), cr = cell.getBoundingClientRect();
    return { x: (cr.left - sr.left) / z, w: cr.width / z, top: (cr.top - sr.top) / z, bot: (cr.bottom - sr.top) / z };
  });
  const spec = { P1: [geo.top - 6, geo.bot - geo.top + 12], P4: [geo.bot + 4, 50], P5: [geo.bot + 500, 50] }[pos];
  const ih = Math.max(4, Math.round(240 * spec[1] / geo.w));
  const src = await page.evaluate((ih) => { const cv = document.createElement('canvas'); cv.width = 240; cv.height = ih; const x = cv.getContext('2d'); x.fillStyle = '#e76f51'; x.fillRect(0, 0, 240, ih); return cv.toDataURL('image/png'); }, ih);
  await page.evaluate(async ([src, x, y, w]) => { await window._scratchAddAndSaveFx(src, x, y, w, undefined, 'sp_u29', undefined); }, [src, Math.round(geo.x), Math.round(spec[0]), Math.round(geo.w)]);
  await page.waitForFunction(() => { const im = document.querySelector('.scratch-item[data-scratch-id="sp_u29"] img'); return im && im.complete && im.naturalWidth > 0; }, null, { timeout: 10000 });
  /* 화면이 멈춘 뒤(e95 settle 꼴): 칸·카드·글자 rect 가 두 번 연속 같다 */
  await page.waitForFunction(() => { const r = (e) => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round).join(','); };
    const now = [r(document.getElementById('gU')), r(document.querySelector('.scratch-item[data-scratch-id="sp_u29"]'))].join('|');
    const ok = window.__u29s === now; window.__u29s = now; return ok; }, null, { polling: 120, timeout: 8000 });
  return { errs, tb: ids.tb };
}
const cellLines = (page) => page.evaluate(() => [...document.querySelectorAll('#gU .grd-cell[data-r="0"][data-c="0"] [data-line]')].length);
const yieldOn = (page) => page.evaluate(() => { const c = document.querySelector('.scratch-item[data-scratch-id="sp_u29"]'); const cs = getComputedStyle(c); return { on: document.body.classList.contains('scratch-yield-drag'), op: cs.opacity, pe: cs.pointerEvents }; });
/** 글자 블럭의 «카드에 안 가린» 시작 점 */
const startPoint = (page, tb) => page.evaluate((tb) => { const t = document.getElementById(tb); const i = t.getBoundingClientRect(); const y = Math.round(i.top + i.height / 2);
  for (let x = Math.round(i.right - 6); x > i.left; x -= 8) { const e = document.elementFromPoint(x, y); if (e && e.closest('#' + tb) && !e.closest('.scratch-item')) return { x, y }; } return null; }, tb);
/** 칸(0,0) 가운데선에서 아래→위로 «화면에 보이는» 첫 점(카드가 반투명이어도 맨 위 요소가 칸이어야 한다) */
const dropPoint = (page) => page.evaluate(() => { const cell = document.querySelector('#gU .grd-cell[data-r="0"][data-c="0"]'); const r = cell.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.bottom - 3) }; });
/** 진짜 끌기 시작 — 고르기 클릭 뒤 눌러 두 걸음 움직인다(dragstart 가 난다). 돌려준 함수로 «놓는 곳»을 정한다. */
async function beginDrag(page, tb) {
  const p = await startPoint(page, tb);
  expect(p, '[전제] 글자 블럭에 카드에 안 가린 시작 점이 있다').toBeTruthy();
  await clickAt(page, p.x, p.y, { sel: '.text-block' }, { label: '글자 고르기' }); await page.waitForTimeout(200);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(p.x + 8, p.y + 8, { steps: 3 });
  return p;
}

test('A1 [새 것] P4 — 끄는 동안 카드가 반투명·클릭 통과 → 놓으면 칸에 들어가고 카드는 원래대로', async ({ page }) => {
  const { errs, tb } = await scene(page, 'P4');
  const n0 = await cellLines(page); const d = await dropPoint(page);
  await beginDrag(page, tb); await page.mouse.move(d.x, d.y, { steps: 10 });
  const mid = await yieldOn(page);
  expect(mid, `★끄는 동안 ${JSON.stringify(mid)}`).toEqual({ on: true, op: '0.35', pe: 'none' });
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(await cellLines(page), '[전제] 칸에 들어갔다(G9)').toBe(n0 + 1);
  expect(await yieldOn(page), '놓은 뒤 원래대로').toEqual({ on: false, op: '1', pe: 'auto' });
  expect(errs).toEqual([]);
});

test('A2 [새 것] P1 — 칸 전부를 덮은 카드 위에서도 놓기가 «칸»으로 간다(전엔 막혔다)', async ({ page }) => {
  const { errs, tb } = await scene(page, 'P1');
  const n0 = await cellLines(page); const d = await dropPoint(page);
  expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.scratch-item'), [d.x, d.y]), '[전제] 놓는 점 맨 위 = 카드(덮였다)').toBe(true);
  await beginDrag(page, tb); await page.mouse.move(d.x, d.y, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(400);
  expect(await cellLines(page), '★카드에 덮인 칸에도 들어간다').toBe(n0 + 1);
  expect((await yieldOn(page)).on, '놓은 뒤 꺼짐').toBe(false);
  expect(errs).toEqual([]);
});

for (const [name, finish] of [
  ['Esc 로 끌기 취소', async (page) => { await page.keyboard.press('Escape'); await page.mouse.up(); }],
  ['창 밖에 놓기', async (page) => { await page.mouse.move(1499, 1199, { steps: 4 }); await page.mouse.move(1600, 1300, { steps: 2 }); await page.mouse.up(); }],
  ['빗나간 놓기(왼쪽 패널 위)', async (page) => { await page.mouse.move(60, 400, { steps: 8 }); await page.mouse.up(); }],
]) {
  test(`A3 [새 것·음성대조] ${name} — 끝나면 카드가 원래대로(영영 반투명으로 안 남는다)`, async ({ page }) => {
    const { errs, tb } = await scene(page, 'P4');
    const n0 = await cellLines(page); const d = await dropPoint(page);
    await beginDrag(page, tb); await page.mouse.move(d.x, d.y - 20, { steps: 6 });
    expect((await yieldOn(page)).on, '[전제] 끄는 동안 «켜졌다»(없으면 이 시험은 헛것)').toBe(true);
    await finish(page); await page.waitForTimeout(400);
    expect(await yieldOn(page), `★${name} 뒤 원래대로`).toEqual({ on: false, op: '1', pe: 'auto' });
    expect(await cellLines(page), `${name} — 칸 줄 수 그대로`).toBe(n0);
    expect(await page.locator('.scratch-cover-notice').count(), '알림 없음').toBe(0);
    expect(errs).toEqual([]);
  });
}

test('C1 [새 것] P4 — 넣은 줄이 카드에 «정말» 가리면 알림 · 「참고 이미지 숨기기」 → 숨김 · 새 줄이 맨 위', async ({ page }) => {
  const { errs, tb } = await scene(page, 'P4');
  const n0 = await cellLines(page); const d = await dropPoint(page);
  await beginDrag(page, tb); await page.mouse.move(d.x, d.y, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(500);
  expect(await cellLines(page), '[전제] 들어갔다').toBe(n0 + 1);
  const cover = await page.evaluate(() => { const L = [...document.querySelectorAll('#gU .grd-cell[data-r="0"][data-c="0"] [data-line]')]; const ln = L[L.length - 1]; const r = ln.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: e && e.closest('.scratch-item') ? 'card' : 'other' }; });
  expect(cover.top, '[전제] 새 줄이 정말 카드 밑').toBe('card');
  await expect(page.locator('.scratch-cover-notice'), '★알림이 떴다').toHaveCount(1);
  const b = await page.locator('.scratch-cover-notice .notice-toast-link').boundingBox();
  await clickAt(page, b.x + b.width / 2, b.y + b.height / 2, { sel: '.scratch-cover-notice' }, { label: '참고 이미지 숨기기' });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => { const L = [...document.querySelectorAll('#gU .grd-cell[data-r="0"][data-c="0"] [data-line]')]; const ln = L[L.length - 1]; const r = ln.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { hidden: document.body.classList.contains('scratch-hidden-all'), top: e && e.closest('.grd-line') === ln ? 'line' : String(e && e.className) }; });
  expect(after, '숨김 켜짐 · 새 줄이 맨 위').toEqual({ hidden: true, top: 'line' });
  expect(errs).toEqual([]);
});

test('C2 [회귀 지킴] P5 — 카드가 멀면(안 가림) 알림 없음 · 줄은 들어간다', async ({ page }) => {
  const { errs, tb } = await scene(page, 'P5');
  const n0 = await cellLines(page); const d = await dropPoint(page);
  await beginDrag(page, tb); await page.mouse.move(d.x, d.y, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(500);
  expect(await cellLines(page), '[전제] 들어갔다').toBe(n0 + 1);
  await page.waitForTimeout(300);
  expect(await page.locator('.scratch-cover-notice').count(), '안 가렸으니 알림 0').toBe(0);
  expect(errs).toEqual([]);
});
