/* grid-drop-cell-rect.dom.spec.js — G9 기존 결함 둘(G19 측정 M3 에서 나옴 · G19 판정 함수와 같은 자리라 같이 고침 · 범위 밖)
 *   ⑴ 선택 안 된 «흐름 프레임» 안 그리드에서는 G9(글자 → 칸 한 줄)가 죽어 있었다 — elementFromPoint 가 프레임 자신을 준다
 *      (`.frame-block:not(.selected) *{pointer-events:none}`) · 측정 M3 E 3/3. ⇒ 칸 판정을 사각형으로(grdCellAtPoint).
 *   ⑵ 칸 위를 끄는 동안 섹션 표시선이 그리드 앞/뒤에 그려지는데 놓으면 칸으로 들어갔다(표시가 거짓말 — M3 D2·D3).
 *      ⇒ G9 가 받을 칸이면 섹션 표시선 대신 «그 칸»을 표시한다(grd-cell-drop-target). 판정은 놓기와 같은 두 함수.
 * R1 ⑴ · R2 ⑵ · R3 지키는 시험(비글자는 칸 위에서도 종전처럼 섹션 표시선 · 칸 표시 없음) · R4 지키는 시험(열 간격 «사이»는 칸이 아니다 — 행 이동).
 * ★양성대조: GD1001_ROOT=<37ab1c65> 에서 R1·R2 빨강 / R3·R4 초록. ⚠️dragover 는 rAF 로 솎는다 — 목표에서 흔든다(hover).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;가&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;다&quot;}]}]';
const GRID = (id) => `<div class="grid-block" id="${id}" data-type="grid" data-gap="24" data-col-gap="60" data-valign="top" data-cols="${COLS}"></div>`;
const SEC = `<div class="section-block" id="sR" data-section="1" data-name="R"><div class="section-hitzone"></div><div class="section-inner" id="innerR">
<div class="gap-block" data-type="gap" style="height:40px"></div>
<div class="row" id="rT"><div class="text-block" data-type="heading" id="tT"><div class="tb-body">끌 글</div></div></div>
<div class="row" id="rA"><div class="asset-block" id="aA" data-align="center" style="min-height:40px"><div class="asset-overlay"></div></div></div>
<div class="row" id="rG">${GRID('gG')}</div>
<div class="frame-block" id="fF" data-full-width="true" style="background:#fff;width:100%;box-sizing:border-box;padding:20px 0;"><div class="row" id="rG2">${GRID('gF')}</div></div>
<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock(document.getElementById('gG')); window.renderGridBlock(document.getElementById('gF')); window.clearHistory?.();
  }, SEC);
  await page.waitForTimeout(400);
  return errs;
}
const rect = (page, q) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height }; }, q);
const lines = (page, g, c) => page.evaluate(({ g, c }) => [...document.querySelectorAll(`#${g} [data-r="0"][data-c="${c}"][data-line]`)].map(e => e.textContent.trim()), { g, c });
async function grab(page, sel) { const s = await rect(page, sel); await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(s.x + 10, s.y + 10, { steps: 3 }); }
async function hover(page, x, y) {
  await page.mouse.move(x, y, { steps: 10 }); await page.waitForTimeout(80);
  await page.mouse.move(x + 1, y, { steps: 1 }); await page.waitForTimeout(150);
  await page.mouse.move(x, y, { steps: 1 }); await page.waitForTimeout(150);
}
const marks = (page) => page.evaluate(() => ({
  sectionInd: [...document.querySelectorAll('.drop-indicator')].map(i => i.parentElement.id || i.parentElement.className.split(' ')[0]),
  cell: [...document.querySelectorAll('.grd-cell-drop-target')].map(c => `${c.closest('.grid-block').id}:${c.dataset.r},${c.dataset.c}`),
}));

test('R1 ★선택 안 된 흐름 프레임 안 그리드 — 글자를 칸에 놓으면 칸의 한 줄이 된다(측정 M3 E: 3/3 죽음)', async ({ page }) => {
  const errs = await setup(page);
  expect(await page.evaluate(() => document.getElementById('fF').classList.contains('selected')), '전제 — 프레임 선택 안 됨').toBe(false);
  const c = await rect(page, '#gF [data-r="0"][data-c="1"][data-line="0"]');
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, c), '전제 — elementFromPoint 는 칸이 아니라 프레임을 준다').toBe('fF');
  await grab(page, '#tT');
  await hover(page, c.x, c.bottom - 2);
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(await lines(page, 'gF', 1)).toEqual(['다', '끌 글']);
  expect(await page.evaluate(() => !document.getElementById('tT'))).toBe(true);
  expect(errs).toEqual([]);
});

test('R2 ★칸 위를 끄는 동안 — 섹션 표시선이 아니라 «그 칸»이 표시된다(놓으면 들어갈 자리와 같은 말)', async ({ page }) => {
  const errs = await setup(page);
  const c = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await grab(page, '#tT');
  await hover(page, c.x, c.y);
  const m = await marks(page);
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(m).toEqual({ sectionInd: [], cell: ['gG:0,1'] });
  expect(await lines(page, 'gG', 1), '표시한 칸에 들어갔다').toContain('끌 글');
  expect(await page.evaluate(() => document.querySelectorAll('.grd-cell-drop-target').length), '놓은 뒤 칸 표시는 걷힌다').toBe(0);
  expect(errs).toEqual([]);
});

test('R3 지키는 시험 — 비글자(에셋)는 칸 위에서도 종전처럼 섹션 표시선 · 칸 표시 없음', async ({ page }) => {
  const errs = await setup(page);
  const c = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await grab(page, '#aA');
  await hover(page, c.x, c.y);
  const m = await marks(page);
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(m.cell).toEqual([]);
  expect(m.sectionInd).toEqual(['innerR']);
  expect(errs).toEqual([]);
});

test('R4 지키는 시험 — 열 간격 «사이»에 글자를 놓으면 칸이 아니다(종전 행 이동 · 칸 줄 그대로)', async ({ page }) => {
  const errs = await setup(page);
  const a = await rect(page, '#gG [data-r="0"][data-c="0"]'), b = await rect(page, '#gG [data-r="0"][data-c="1"]');
  expect(b.left - a.right, '전제 — 열 간격이 있다').toBeGreaterThan(20);
  await grab(page, '#tT');
  await hover(page, (a.right + b.left) / 2, a.y);
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(await lines(page, 'gG', 0)).toEqual(['가']);
  expect(await lines(page, 'gG', 1)).toEqual(['다']);
  expect(await page.evaluate(() => !!document.getElementById('tT'))).toBe(true);
  expect(errs).toEqual([]);
});
