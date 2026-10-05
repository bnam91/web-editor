/* graph-label-reveal.dom.spec.js — ⒥⒝ 라벨 편집 → 패널의 기존 «라벨(크기)»·«카테고리 색상» 줄로 데려감 + 패널 클릭에 편집이 안 사라짐 (태양 lane-f-graph 2026-10-05)
 * 지디 ⒥=⒝: 새 절 0 · 새 키 0 · 옮김 0. 패널 칸을 누르면 라벨 blur → (옛) 확정 + showGraphProperties 가 패널을 다시 그려 «누른 칸이 떨어져 나감»(TX1 병)
 *   ⇒ isBlurIntoPanel 이면 parkEditing(그리드 줄·텍스트블럭과 같은 술어). 값이 들어오기 직전 flush = 패널을 안 다시 그리는 확정.
 * 사용자 순서: 실클릭 고르기 → 라벨 실더블클릭 → 글자 → 패널 칸 실클릭 → 값.
 * 양성대조: d1f642ff 나무 안 → R1 R2 R3 빨강. 변형(park 를 끈 임시 커밋) → R2 R3 빨강 · R1 초록.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-label-reveal.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page, chartType = 'line') {
  await page.setViewportSize({ width: 1500, height: 900 });   // 패널이 스크롤되는 높이 — «데려감»이 일이 되게
  const errs = await bootApp(page);
  const id = await page.evaluate((chartType) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop(); window.deselectAll?.(); return g.id;
  }, chartType);
  return { errs, id };
}
async function stableEl(page, expr) {
  let prev = null;
  for (let k = 0; k < 40; k++) {
    const r = await page.evaluate((expr) => { const e = (0, eval)(expr); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }, expr);
    if (r && prev && r.join() === prev.join()) return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 };
    prev = r; await page.waitForTimeout(150);
  }
  throw new Error(`stableEl: ${expr} 가 안 멈췄다`);
}
const LBL = (id) => `document.getElementById('${id}').querySelectorAll('.grb-line-xlabel')[1]`;
async function enterEdit(page, id) {
  await page.evaluate((e) => (0, eval)(e).scrollIntoView({ block: 'center' }), LBL(id));
  const p = await stableEl(page, LBL(id));
  await clickAt(page, p.x, p.y, { sel: '.graph-block' }, { label: '그래프 선택' });
  await page.waitForSelector('#grb-label-number', { timeout: 3000 });
  await page.evaluate(() => { const pp = document.getElementById('grb-label-number').closest('.prop-panel, #prop-panel, [id*=prop]') || document.getElementById('grb-label-number').parentElement; let s = pp; while (s && s.scrollHeight <= s.clientHeight) s = s.parentElement; if (s) s.scrollTop = 0; });   // 패널을 맨 위로 — 두 줄이 화면 밖에서 시작
  const q = await stableEl(page, LBL(id));
  await clickAt(page, q.x, q.y, { sel: '.grb-line-xlabel' }, { label: '라벨 더블클릭', dbl: true });
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.matches('.grb-line-xlabel') && document.activeElement.isContentEditable), { message: '편집 진입', timeout: 3000 }).toBe(true);
}
/* 줄이 «보이는가» = 줄 rect 가 스크롤 조상(패널)의 보이는 rect 안 · elementFromPoint(줄 가운데) 가 그 줄 안 */
const rowVisible = (page, inputId) => page.evaluate((inputId) => {
  const row = document.getElementById(inputId)?.closest('.prop-row'); if (!row) return { ok: false, why: 'no row' };
  let s = row.parentElement; while (s && !(s.scrollHeight > s.clientHeight && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
  const r = row.getBoundingClientRect(), v = s ? s.getBoundingClientRect() : { top: 0, bottom: innerHeight };
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { ok: r.top >= v.top - 1 && r.bottom <= v.bottom + 1 && !!hit && row.contains(hit), anim: row.getAnimations().length };
}, inputId);

test('R1 ★라벨 더블클릭 → «라벨(크기)»·«카테고리 색상» 줄이 보이고 강조된다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await enterEdit(page, id);
  await expect.poll(() => rowVisible(page, 'grb-label-slider'), { timeout: 3000 }).toMatchObject({ ok: true });
  const a = await rowVisible(page, 'grb-label-slider'), b = await rowVisible(page, 'grb-xlabel-color');
  expect(a.anim, '라벨 크기 줄 강조').toBeGreaterThan(0);
  expect(b.anim, '카테고리 색상 줄 강조').toBeGreaterThan(0);
  expect(errs).toEqual([]);
});
test('R2 ★편집 중 «라벨 크기» 숫자칸 실클릭 → 22 Enter: 그 칸이 안 떨어져 나가고(같은 노드) 값이 들어간다 · 친 글자도 확정', async ({ page }) => {
  const { errs, id } = await setup(page);
  await enterEdit(page, id);
  await page.keyboard.press('Meta+a'); await page.keyboard.type('편집중');
  await page.evaluate(() => { document.getElementById('grb-label-number').__mark = 'k'; });
  const n = await stableEl(page, `document.getElementById('grb-label-number')`);
  await clickAt(page, n.x, n.y, { sel: '#grb-label-number' }, { label: '라벨 크기 칸' });
  await page.keyboard.press('Meta+a'); await page.keyboard.type('22'); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.labelSize, id)).toBe('22');
  const r = await page.evaluate((id) => ({ same: document.getElementById('grb-label-number')?.__mark === 'k', label: JSON.parse(document.getElementById(id).dataset.items)[1].label, fs: getComputedStyle(document.getElementById(id).querySelectorAll('.grb-line-xlabel')[1]).fontSize, editing: document.getElementById(id).classList.contains('editing') }), id);
  expect(r).toEqual({ same: true, label: '편집중', fs: '22px', editing: false });
  expect(errs).toEqual([]);
});
test('R3 ★편집 중 «카테고리 색상» HEX 칸 실클릭 → 값: 칸이 같은 노드 · 라벨 색이 바뀐다 · 친 글자 확정', async ({ page }) => {
  const { errs, id } = await setup(page);
  await enterEdit(page, id);
  await page.keyboard.press('Meta+a'); await page.keyboard.type('색편집');
  await page.evaluate(() => { document.getElementById('grb-xlabel-hex').__mark = 'h'; });
  const h = await stableEl(page, `document.getElementById('grb-xlabel-hex')`);
  await clickAt(page, h.x, h.y, { sel: '#grb-xlabel-hex' }, { label: '카테고리 색 HEX' });
  await page.keyboard.press('Meta+a'); await page.keyboard.type('FF0000'); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelectorAll('.grb-line-xlabel')[1]).color, id)).toBe('rgb(255, 0, 0)');
  const r = await page.evaluate((id) => ({ same: document.getElementById('grb-xlabel-hex')?.__mark === 'h', label: JSON.parse(document.getElementById(id).dataset.items)[1].label }), id);
  expect(r).toEqual({ same: true, label: '색편집' });
  expect(errs).toEqual([]);
});
