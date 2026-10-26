/* t1017m3-bubble-no-plus.dom.spec.js — 1017t1m3 ㉡ 「그리고 해당버튼은 없어도 돼. 줄추가하는건데 왜 이게 있는거야.?」(현빈 · 261026 GO)
 *   실물 = .ln-add-btn[data-grd-add="row"][data-ln-for="sb_…"] — js/blocks/line-host.js lnSyncPlus(1012t1M1)가 붙이던 말풍선 캔버스 ＋.
 *   ⇒ ★말풍선만 뺀다(BUBBLE_CANVAS_PLUS = false). 줄 추가 입구는 남는다: 우클릭 «아래에 줄 추가 (T)»(1020t2i1).
 * 칸
 *   N0 ★말풍선을 골라도 ＋ 0 (옛: 1)
 *   N1 같은 층(#grd-plus-layer)의 그리드 ＋ 는 그대로 2(열·행) — «말풍선만» 뺐다
 *   R1 우클릭 «아래에 줄 추가» → 줄 2(구운 본문 + 새 본문) · 말풍선 골라진 채 — 줄 추가는 여전히 된다
 *   R2 R1 뒤 ⌘Z 한 번 → 줄 없음
 * 양성대조: GD1001_ROOT=<핀 8608bb13 사본> ⇒ N0 빨강(＋ 1) · N1·R1·R2 초록.
 * ⛔고정 대기 없음. 하네스 = _root-harness.bootApp · 우클릭·메뉴·⌘Z 는 진짜 입력.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="bM" data-section="1" data-name="M" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">M</span></div><div class="section-inner"></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('bM'));
    window.addSpeechBubbleBlock?.('left');
  }, SEC);
  await page.waitForFunction(() => !!document.querySelector('#canvas .speech-bubble-block.selected'));
  const id = await page.evaluate(() => { const b = document.querySelector('#canvas .speech-bubble-block.selected'); b.scrollIntoView({ block: 'center' }); return b.id; });
  /* 자리가 두 프레임 내리 같을 때까지(배율·스크롤 뒤) */
  await page.evaluate((id) => new Promise((done) => { let p = null, n = 0; const t = () => { const r = document.querySelector(`[id="${id}"] .tb-bubble`).getBoundingClientRect(); const k = [r.left, r.top, r.width].join(); if (k === p) { if (++n >= 2) return done(); } else n = 0; p = k; requestAnimationFrame(t); }; requestAnimationFrame(t); }), id);
  return { errs, id };
}
const plusCount = (page, id) => page.evaluate((id) => document.querySelectorAll(`#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`).length, id);
const bodyPt = (page, id) => page.evaluate((id) => { const r = document.querySelector(`[id="${id}"] .tb-bubble`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const lines = (page, id) => page.evaluate((id) => { const raw = document.getElementById(id)?.dataset.lines; return raw ? JSON.parse(raw).length : 0; }, id);

async function ctxAddLine(page, id) {
  const [x, y] = await bodyPt(page, id);
  await page.mouse.click(x, y, { button: 'right' });
  await page.waitForFunction(() => { const e = document.getElementById('bcm-ln-add'); return e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, null, { timeout: 4000 });
  const m = await page.evaluate(() => { const r = document.getElementById('bcm-ln-add').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(m[0], m[1]);
}

test('N0 ★말풍선을 골라도 캔버스 ＋ 0 (1017t1m3 ㉡)', async ({ page }) => {
  const { errs, id } = await setup(page);
  /* 옛 판은 고르자마자 ＋ 가 붙는다 — 붙을 «틈»을 준다: 다음 두 프레임 뒤에 센다 */
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), '전제: 말풍선 골라짐').toBe(true);
  expect(await plusCount(page, id), '★말풍선 ＋ 가 붙었다').toBe(0);
  expect(errs).toEqual([]);
});

test('N1 같은 층의 그리드 ＋ 는 그대로 — 말풍선만 뺐다', async ({ page }) => {
  const { errs } = await setup(page);
  const gid = await page.evaluate(() => { window.selectSection?.(document.getElementById('bM')); window.addGridBlock?.(); const g = document.querySelector('#canvas .grid-block.selected'); g?.scrollIntoView({ block: 'center' }); return g?.id || null; });
  expect(gid, '전제: 그리드 골라짐').toBeTruthy();
  await page.waitForFunction((gid) => document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${gid}"]`).length === 2, gid, { timeout: 4000 });
  expect(errs).toEqual([]);
});

test('R1 우클릭 «아래에 줄 추가» → 줄 2 · 골라진 채 (줄 추가 입구는 남는다)', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect(await lines(page, id), '전제: 줄 없음').toBe(0);
  await ctxAddLine(page, id);
  await page.waitForFunction((id) => !!document.getElementById(id)?.dataset.lines, id, { timeout: 4000 });
  expect(await lines(page, id), '★구운 본문 + 새 본문').toBe(2);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id)).toBe(true);
  expect(errs).toEqual([]);
});

test('R2 R1 뒤 ⌘Z 한 번 → 줄 없음', async ({ page }) => {
  const { errs, id } = await setup(page);
  await ctxAddLine(page, id);
  await page.waitForFunction((id) => !!document.getElementById(id)?.dataset.lines, id, { timeout: 4000 });
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await page.waitForFunction((id) => { const b = document.getElementById(id) || document.querySelector('#canvas .speech-bubble-block'); return b && !b.dataset.lines; }, id, { timeout: 4000 });
  expect(errs).toEqual([]);
});
