/* grid-drop-textblock-cell.dom.spec.js — G9 (현빈 2026-10-03, 수지맥 건) 「텍스트블럭을 끌어 그리드 칸에 넣으려는데 안 들어간다」
 * 측정(604602cd, 진짜 마우스 끌기): 글자 블럭을 칸 위에 놓으면 칸 줄 수 1→1 · 블럭은 섹션 형제로 남아 «행 순서만» 바뀐다.
 *   칸이 블럭을 «받는» 길이 아예 없었다(원인=기능 부재, 칸 판정 오류 아님).
 * 고침: prop-grid.js grdDropTextBlockOnCell — 섹션/프레임 드롭 처리기가 먼저 부른다. 글자 블럭 하나뿐인 행/블럭 + 놓은 자리가 바깥 그리드 칸일 때만 받는다.
 * ★양성대조: GD1001_ROOT=<604602cd 체크아웃> → T1~T4 빨강 / T5·T6 초록(지키는 시험).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js --workers=2 grid-drop-textblock-cell */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;가&quot;},{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;나&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;다&quot;},{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;라&quot;}]}]';
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:60px"></div>
<div class="row" id="rT"><div class="text-block" data-type="heading" id="tT"><div class="tb-h2" style="color: rgb(200, 0, 0);">끌 글</div></div></div>
<div class="row" id="rA"><div class="asset-block" id="aA" data-align="center"><div class="asset-overlay"></div></div></div>
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div></div>
<div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.renderGridBlock?.(document.getElementById('gG')); window.clearHistory?.(); }, SEC);
  await page.waitForTimeout(500);
}
const rect = (page, q) => page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, h: r.height }; }, q);
const cellTexts = (page, c) => page.evaluate((c) => [...document.querySelectorAll(`#gG [data-r="0"][data-c="${c}"][data-line]`)].map(e => e.textContent.trim()), c);
async function drag(page, srcSel, x, y, { pick = false } = {}) {
  const s = await rect(page, srcSel);
  if (pick) { await page.mouse.click(s.x, s.y); await page.waitForTimeout(200); }
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  await page.mouse.move(s.x + 10, s.y + 10, { steps: 3 });
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up(); await page.waitForTimeout(500);
}
const gone = (page, id) => page.evaluate((id) => !document.getElementById(id), id);

test('T1 ★글자 블럭을 칸 아랫부분에 놓으면 칸의 «끝 줄»이 되고 블럭은 사라진다 (색·종류가 따라온다)', async ({ page }) => {
  await setup(page);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);                       // 전제: 놓기 전 칸 줄
  const last = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="1"]');
  await drag(page, '#tT', last.x, last.bottom - 2);
  expect(await cellTexts(page, 1)).toEqual(['다', '라', '끌 글']);
  expect(await gone(page, 'tT')).toBe(true);
  const m = await page.evaluate(() => { const l = document.querySelector('#gG [data-r="0"][data-c="1"][data-line="2"]'); return { color: l.style.color, size: parseFloat(l.style.fontSize) }; });
  expect(m.color).toBe('rgb(200, 0, 0)');
});
test('T2 ★칸 맨 윗부분에 놓으면 «첫 줄 앞»에 들어간다', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#tT', first.x, first.top + first.h * 0.3);
  expect(await cellTexts(page, 1)).toEqual(['끌 글', '다', '라']);
});
test('T3 ★⌘Z 한 번이면 블럭이 돌아오고 칸은 원래대로 (이력 한 칸)', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#tT', first.x, first.top + first.h * 0.3);
  expect(await gone(page, 'tT')).toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(600);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .text-block').length)).toBe(1);
});
test('T4 ★먼저 눌러 고른 블럭을 끌어도 같다', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="0"][data-line="0"]');
  await drag(page, '#tT', first.x, first.top + first.h * 0.3, { pick: true });
  expect(await cellTexts(page, 0)).toEqual(['끌 글', '가', '나']);
});
test('T5 지키는 시험 — 칸 «밖»(갭)에 놓으면 종전대로 행 이동, 칸은 그대로', async ({ page }) => {
  await setup(page);
  const gap = await rect(page, '#sG .gap-block:last-child');
  await drag(page, '#tT', gap.x, gap.y);
  expect(await cellTexts(page, 0)).toEqual(['가', '나']);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);
  expect(await gone(page, 'tT')).toBe(false);
});
test('T6 지키는 시험 — 에셋 블럭 행은 칸 위에 놓아도 칸이 받지 않는다(종전 행 이동)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { document.getElementById('aA').style.minHeight = '40px'; });
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#aA', first.x, first.top + first.h * 0.3);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);
  expect(await gone(page, 'aA')).toBe(false);
});

/* ── 적대QA 보강(63d653b0 에서 빨강이던 것) ── */
test('T7 ★말풍선 블럭은 칸이 받지 않는다 — 본문이 캔버스에서 사라지지 않는다(63d653b0: «Your name» 한 줄만 남고 본문 0건)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    document.getElementById('rT').insertAdjacentHTML('afterend',
      '<div class="row" id="rB"><div class="text-block speech-bubble-block" id="tB"><div class="tb-sender-name" style="display:none">Your name</div><div class="tb-bubble">말풍선 본문</div></div></div>');
    window.rebindAll?.();
  });
  await page.waitForTimeout(300);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#tB', first.x, first.top + first.h * 0.3);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);
  expect(await page.evaluate(() => document.getElementById('canvas').innerText.includes('말풍선 본문'))).toBe(true);
});
test('T8 ★놓자마자 «바로» ⌘Z — 줄과 블럭이 둘 다 남지 않는다(줄 3 + 블럭 1 이 되던 것)', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  const s = await rect(page, '#tT');
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  await page.mouse.move(s.x + 10, s.y + 10, { steps: 3 });
  await page.mouse.move(first.x, first.top + first.h * 0.3, { steps: 12 });
  await page.mouse.up();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');                       // 기다리지 않는다
  const count = () => page.evaluate(() => ({ cell: document.querySelectorAll('#gG [data-r="0"][data-c="1"][data-line]').length, tb: document.querySelectorAll('#canvas .text-block').length }));
  const now = await count();
  await page.waitForTimeout(800);
  expect(now).toEqual({ cell: 2, tb: 1 });
  expect(await count()).toEqual({ cell: 2, tb: 1 });
});
test('T9 ★되돌린 뒤 ⌘⇧Z 로 다시 하면 줄 +1 · 블럭 0 (이력이 «한 칸»)', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#tT', first.x, first.top + first.h * 0.3);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(600);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(600);
  expect(await cellTexts(page, 1)).toEqual(['끌 글', '다', '라']);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .text-block').length)).toBe(0);
});
