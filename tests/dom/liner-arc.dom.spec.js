/* liner-arc — LINETEXT-ARC-RESEARCH-01(현빈 261121 발주2 #4 · 비교표 handoff/LINER-ARC-COMPARE-261121.md): 라이너 빈 곳 4 + 끝 글자 잘림
 * 고침: js/liner-transform.js — 반지름 px(arc-up/down 이 그 원 위에 글 길이만큼 · 반원 넘는 호) · 원 안쪽 뒤집기 · 외곽선(stroke · paint-order) · 가로 지킴이
 * R1 패널 «반지름» 82 → dataset radius 82 · 글이 원을 216°±12 돈다(피그마 ARC Bend 60 과 같은 «글 기준» 휨) · 글자 상자 안(잘림 0)
 * R2 [지킴] 새 칸 안 쓴 기본 라이너 = dataset 4칸 그대로 · 옛 경로 꼴(P=12 · 소호 A)
 * R3 좁은 폭(221)+곡률 100 → 글자가 상자 0..W 안(옛 판 = −15 넘침 · 비교표 2행)
 * R4 원형 «안쪽 뒤집기» 진짜 클릭 → 경로 sweep 0 · 저장 표본 → 다시 열기(ensureLiner) 뒤 radius·flip·외곽선 그대로 · undo 1번 = 뒤집기 전
 * R5 외곽선 — 패널 두께 2 · 색 → text stroke·paint-order · PNG 에 빨강 · Figma JSON 라이너 svg 에 stroke
 * 양성대조: _patches/liner-arc-CTL.patch(반지름 모드·가로 지킴이·외곽선 끔 · 뒤집기 무시) → R1·R3·R4·R5 빨강 · R2 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function scene(page, preset, wpx) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ({ preset, wpx }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block'); sec.id = 'sL'; window.deselectAll(); window.selectSection(sec); window.addLinerBlock(preset);
    const blk = sec.querySelector('.liner-block'); blk.id = 'lnL'; const m = blk.querySelector('.tb-liner'); m.textContent = 'GODITOR ARC TEXT 123'; delete m.dataset.isPlaceholder;
    if (wpx) blk.style.width = wpx + 'px'; window.applyLinerText?.(blk); window.applyLiner(blk); window.clearHistory?.();
  }, { preset, wpx });
  await waitZoomSettled(page, 100);
  return errs;
}
async function openPanel(page) {
  const xy = await page.evaluate(() => { const e = document.getElementById('lnL'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + 10]; });
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(() => { if (!document.getElementById('lnr-preset')) { window.showTextProperties?.(document.getElementById('lnL')); } });
  await page.waitForFunction(() => !!document.getElementById('lnr-preset'), null, { timeout: 5000 });
}
const geo = (page) => page.evaluate(() => {
  const blk = document.getElementById('lnL'), svg = blk.querySelector('svg.lnr-svg'), path = svg.querySelector('path'), te = svg.querySelector('text'), tp = te.querySelector('textPath');
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height'), bb = te.getBBox(), L = path.getTotalLength(), n = tp.getComputedTextLength();
  /* 실제로 그린 휨 — 글이 덮는 구간(가운데 = startOffset) 첫·끝 점의 접선이 몇 도 돌았나(원호면 = 돈 각) */
  const c = L * parseFloat(tp.getAttribute('startOffset')) / 100, at = (x) => path.getPointAtLength(((x % L) + L) % L);
  const ang = (x) => { const a = at(x), b = at(x + 0.5); return Math.atan2(b.y - a.y, b.x - a.x); };
  let turn = 0, prev = ang(c - n / 2); for (let i = 1; i <= 60; i++) { const cur = ang(c - n / 2 + (n * i) / 60); let d = cur - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turn += d; prev = cur; }
  return { ds: JSON.parse(blk.dataset.liner), d: path.getAttribute('d'), W, H, box: [bb.x, bb.y, bb.x + bb.width, bb.y + bb.height], L, n, turn: Math.abs(turn) * 180 / Math.PI, stroke: te.getAttribute('stroke'), sw: te.getAttribute('stroke-width'), po: te.getAttribute('paint-order') };
});
const inside = (g) => g.box[0] >= -0.5 && g.box[2] <= g.W + 0.5 && g.box[1] >= -0.5 && g.box[3] <= g.H + 0.5;

test('R1 반지름 82 → 216° 호 · 잘림 0', async ({ page }) => {
  const errs = await scene(page, 'arc-up');
  await openPanel(page);
  await page.fill('#lnr-radius', '82'); await page.press('#lnr-radius', 'Enter'); await raf(page);
  const g = await geo(page);
  expect([g.ds.radius, Math.abs(g.turn - 216) <= 12, inside(g)], `★반지름 82 · 그린 휨 ${g.turn.toFixed(1)}°(글 길이/82 = ${((g.n / 82) * 180 / Math.PI).toFixed(1)}°) · 상자 ${JSON.stringify([g.box, g.W, g.H])}`).toEqual([82, true, true]);
  expect(errs).toEqual([]);
});

test('R2 [지킴] 기본 라이너 = 옛 꼴', async ({ page }) => {
  const errs = await scene(page, 'arc-up');
  const g = await geo(page);
  expect(Object.keys(g.ds), '★dataset 4칸 그대로').toEqual(['preset', 'curvature', 'letterSpacing', 'startAngle']);
  expect(g.d, `★옛 경로 꼴(P=12 · 소호) ${g.d}`).toMatch(new RegExp(`^M 12,\\d+ A [\\d.]+,[\\d.]+ 0 0 1 ${g.W - 12},\\d+$`));
  expect([g.stroke, g.po], '외곽선 없음').toEqual([null, null]);
  expect(errs).toEqual([]);
});

test('R3 좁은 폭 221 + 곡률 100 → 글자 상자 안', async ({ page }) => {
  const errs = await scene(page, 'arc-up', 221);
  await page.evaluate(() => window.applyLiner(document.getElementById('lnL'), { curvature: 100 })); await raf(page);
  const g = await geo(page);
  expect(inside(g), `★잘림 0 ${JSON.stringify([g.box, g.W, g.H])}`).toBe(true);
  expect(errs).toEqual([]);
});

test('R4 원형 안쪽 뒤집기 · 저장 왕복 · undo', async ({ page }) => {
  const errs = await scene(page, 'circle', 320);
  await openPanel(page);
  await page.evaluate(() => window.applyLiner(document.getElementById('lnL'), { radius: 0, strokeColor: '#1d7a3a', strokeWidth: 1.5 }));
  await openPanel(page);
  await page.evaluate(() => window.clearHistory?.());
  await page.locator('#lnr-flip').evaluate((e) => e.closest('label').scrollIntoView({ block: 'center' })); await page.locator('#lnr-flip').evaluate((e) => e.closest('label').click()); await raf(page);   /* 토글 = 숨은 checkbox 를 감싼 label */
  const a = await geo(page);
  expect([a.ds.flip, / 0 1 0 /.test(a.d)], `★뒤집기 = sweep 0 ${a.d.slice(0, 80)}`).toEqual([true, true]);
  const h = await page.evaluate(() => window.getSerializedCanvas());
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.innerHTML = h; c.querySelectorAll('.liner-block').forEach((b) => window.ensureLiner(b)); }, h); await raf(page);
  const b = await geo(page);
  expect([b.ds.flip, b.ds.strokeColor, b.ds.strokeWidth, / 0 1 0 /.test(b.d)], '★다시 열기 뒤 그대로').toEqual([true, '#1d7a3a', 1.5, true]);
  await page.evaluate(() => window.undo()); await raf(page);
  const u = await geo(page);
  expect(u.ds.flip ?? false, '★undo = 뒤집기 전').toBe(false);
  expect(errs).toEqual([]);
});

test('R5 외곽선 — 패널 · PNG · Figma', async ({ page }) => {
  const errs = await scene(page, 'arc-up');
  await openPanel(page);
  await page.locator('#lnr-outline-color').evaluate((e) => { e.value = '#d0021b'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#lnr-outline-width').evaluate((e) => { e.value = '3'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }); await raf(page);
  const g = await geo(page);
  expect([g.stroke, g.sw, g.po, g.ds.strokeWidth], '★text stroke').toEqual(['#d0021b', '3', 'stroke fill', 3]);
  const out = await page.evaluate(async () => {
    const s = document.getElementById('sL'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s)); const d = r.canvas.getContext('2d').getImageData(0, 0, r.canvas.width, r.canvas.height).data; let red = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 170 && d[i + 1] < 60 && d[i + 2] < 60) red++;
    const j = await window.buildFigmaExportJSON(['sL']); return { red, fig: /stroke=\\?"#d0021b/.test(JSON.stringify(j))   /* JSON 글 안이라 따옴표가 \" 로 이스케이프 */ };
  });
  expect(out.red > 200 && out.fig, `★PNG 빨강 ${out.red} · Figma svg stroke ${out.fig}`).toBe(true);
  expect(errs).toEqual([]);
});
