/* graph-point-style.dom.spec.js — K6 꺾은선 «속빈» 점 (태양 lane-f-graph 2026-10-05)
 * 현빈 K6: 「점 크기」 옆에 점 모양 프리셋 드롭다운 — 속빈 점.
 * 고침: prop-graph «점 모양» .prop-select(채움 = 키 없음 · 속빈 = dataset.pointStyle 'hollow')
 *   · editor-graph.css ::after 구멍(고리 = 점 자신의 배경 = 선 색 · 구멍 = var(--grb-dot-hole))
 *   · canvas-contrast syncGraphTone --grb-dot-hole = backdropRgbAt(단색) · GRAPH_AUTO_VARS 에 보탬 → 저장에서 저절로 걷힘(E144 derive).
 * 선택은 실클릭(elementFromPoint 확인) · 드롭다운은 selectOption(사람이 고르는 것과 같은 change).
 * 픽셀 = page.screenshot 1px(그려진 값) — 계산 스타일만 보면 ::after 가 안 그려져도 초록이다.
 * 양성대조: d1f642ff 나무 안 → H1~H5 빨강 · F1 초록 (predict: $S/fg/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-point-style.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const rgbOf = (s) => (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const near = (a, b, tol = 3) => a.length === 3 && a.every((v, i) => Math.abs(v - b[i]) <= tol);

async function setup(page, secBg = '#ffffff') {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate((secBg) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sG'); window.setSectionBg(S, secBg);
    window.selectSection(S); window.addGraphBlock({ chartType: 'line' });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    g.dataset.pointRadius = '8'; window.renderGraph(g);   // 16px 점 — 구멍·고리 픽셀이 안티에일리어싱 밖에 앉게
    window.deselectAll?.(); return g.id;
  }, secBg);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  return { errs, id };
}
async function selectBlock(page, id) {
  const p = await page.evaluate((id) => { const g = document.getElementById(id); g.scrollIntoView({ block: 'center' }); const r = g.querySelector('.grb-line-svg, svg').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.15 }; }, id);
  await clickAt(page, p.x, p.y, { sel: '.graph-block' }, { label: '그래프 선택' });
  await page.waitForSelector('#grb-pointstyle-select', { timeout: 3000 });
}
async function pickStyle(page, v) {
  await page.locator('#grb-pointstyle-select').scrollIntoViewIfNeeded();
  await page.selectOption('#grb-pointstyle-select', v);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
}
async function pixelAt(page, x, y) {
  const buf = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  return page.evaluate(async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)]; }, buf.toString('base64'));
}
/* 둘째 점: 가운데(구멍) · 왼쪽 가장자리 + 2.5px(고리 — 흰 테 1.5px 와 구멍 inset 22%(16px 점 ≈ 4.4px) 사이)
   ★setup 직후 캔버스가 맞춤 배율(0.4)에서 1.0 으로 자리 잡는다 — 멈춘 rect 로만 찍는다(첫 판: 옛 좌표 = 흰 픽셀). */
async function dotPixels(page, id) {
  await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-line-point-dot')[1].scrollIntoView({ block: 'center', inline: 'center' }), id);
  let prev = null, d = null;
  for (let k = 0; k < 40; k++) {
    d = await page.evaluate((id) => { const e = document.getElementById(id).querySelectorAll('.grb-line-point-dot')[1]; const r = e.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, left: r.left, w: r.width, bg: getComputedStyle(e).backgroundColor }; }, id);
    if (prev && prev.left === d.left && prev.cy === d.cy && prev.w === d.w) break;
    prev = d; await page.waitForTimeout(150);
  }
  expect(d.w, '점 16px(배율 1) 에서 잰다').toBe(16);
  /* bgNear = 점 아래 6px 의 바탕 픽셀 — 같은 조건(고른 블럭엔 편집기 선택 틴트가 얹힌다 · #111 위 19,24,33 실측)에서 찍어 «구멍 = 둘레 바탕»을 잰다 */
  return { centre: await pixelAt(page, Math.floor(d.cx), Math.floor(d.cy)), ring: await pixelAt(page, Math.floor(d.left + 2.5), Math.floor(d.cy)), bgNear: await pixelAt(page, Math.floor(d.cx), Math.floor(d.cy + d.w / 2 + 6)), dotBg: rgbOf(d.bg) };
}
const holeVar = (page, id) => page.evaluate((id) => document.getElementById(id).style.getPropertyValue('--grb-dot-hole').trim(), id);
const saved = (page) => page.evaluate(() => window.getSerializedCanvas());

test('H1 ★흰 바탕 속빈: 가운데 = 바탕(흰) · 고리 = 선 색 · 구멍 변수도 쓴다', async ({ page }) => {
  const { errs, id } = await setup(page, '#ffffff');
  const filled = await dotPixels(page, id);
  expect(near(filled.centre, filled.dotBg), `채움 가운데 = 선 색 ${filled.centre}`).toBe(true);
  await selectBlock(page, id); await pickStyle(page, 'hollow');
  const p = await dotPixels(page, id);
  expect(near(p.centre, p.bgNear), `가운데 ${p.centre} · 둘레 바탕 ${p.bgNear}`).toBe(true);
  expect(near(p.ring, p.dotBg), `고리 ${p.ring} · 선 ${p.dotBg}`).toBe(true);
  expect(near(p.centre, p.ring, 40), `구멍 ≠ 고리`).toBe(false);
  expect(await holeVar(page, id)).toBe('rgb(255, 255, 255)');
  expect(errs).toEqual([]);
});
test('H2 ★#111 바탕 속빈: 가운데 = #111 · 고리 = H6 밝힌 선 색(--grb-auto-line)', async ({ page }) => {
  const { errs, id } = await setup(page, '#111111');
  await selectBlock(page, id); await pickStyle(page, 'hollow');
  const p = await dotPixels(page, id);
  const auto = rgbOf(await page.evaluate((id) => document.getElementById(id).style.getPropertyValue('--grb-auto-line'), id));
  expect(auto.length, 'H6 변수 있음').toBe(3);
  expect(await holeVar(page, id)).toBe('rgb(17, 17, 17)');
  expect(near(p.centre, p.bgNear), `가운데 ${p.centre} · 둘레 바탕 ${p.bgNear}`).toBe(true);
  expect(near(p.centre, p.ring, 40), `구멍 ≠ 고리 (${p.centre} vs ${p.ring})`).toBe(false);
  expect(near(p.ring, auto), `고리 ${p.ring} · auto ${auto}`).toBe(true);
  expect(errs).toEqual([]);
});
test('H3 ★다시 열기: 저장본엔 구멍 변수 0 · 연 뒤 다시 계산(흰→ 같은 값) · 바탕 바꾸면 따라간다', async ({ page }) => {
  const { id } = await setup(page, '#ffffff');
  await selectBlock(page, id); await pickStyle(page, 'hollow');
  const proj = await page.evaluate(() => window.serializeProject());
  expect(proj.includes('--grb-dot-hole'), '저장본 변수 0').toBe(false);
  expect(proj.includes('data-point-style') || proj.includes('pointStyle'), '저장본에 모양 키').toBe(true);
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), proj);
  await page.waitForFunction((id) => document.getElementById(id)?.style.getPropertyValue('--grb-dot-hole').trim() === 'rgb(255, 255, 255)', id, { timeout: 5000 });
  await page.evaluate(() => window.setSectionBg(document.querySelector('.section-block'), '#222222'));
  await expect.poll(() => holeVar(page, id), { message: '바탕 바뀐 뒤 구멍' }).toBe('rgb(34, 34, 34)');
});
test('H4 ★저장 변수 0 · 속빈→채움 = 처음 바이트 그대로', async ({ page }) => {
  const { errs, id } = await setup(page, '#ffffff');
  await selectBlock(page, id);
  const s0 = await saved(page);
  await pickStyle(page, 'hollow');
  const s1 = await saved(page);
  expect(s1).not.toBe(s0); expect(s1.includes('--grb-dot-hole')).toBe(false);
  await pickStyle(page, '');
  expect(await saved(page)).toBe(s0);
  expect(await holeVar(page, id)).toBe('');
  expect(errs).toEqual([]);
});
test('H5 ⌘Z 한 번 = 채움으로', async ({ page }) => {
  const { errs, id } = await setup(page, '#ffffff');
  await selectBlock(page, id); await pickStyle(page, 'hollow');
  expect(await page.evaluate((id) => document.getElementById(id).dataset.pointStyle, id)).toBe('hollow');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.querySelector('#sG .graph-block')?.dataset.pointStyle ?? 'none')).toBe('none');
  expect(errs).toEqual([]);
});
test('F1 채움(기본) = 구멍 없음 · 변수 없음', async ({ page }) => {
  const { errs, id } = await setup(page, '#ffffff');
  const r = await page.evaluate((id) => { const e = document.getElementById(id).querySelector('.grb-line-point-dot'); return getComputedStyle(e, '::after').content; }, id);
  expect(r === 'none' || r === 'normal').toBe(true);
  expect(await holeVar(page, id)).toBe('');
  expect(errs).toEqual([]);
});
