/* multisel-union-shift-ratio.dom.spec.js — NEW-현빈QA-MULTISEL-UNION-SHIFT-RATIO-01 (현빈 9502 · 지디 261110)
 *   손순서: 마킹을 «포함»해 여럿 고른 채 모서리로 크기 조절 + Shift → 비율 유지가 안 먹음.
 *   실측(워커2 격리 int-4 8531420ec · 진짜 ⇧클릭·Shift 키·마우스 se +80,+20): 사각 둘 0/3 · 마킹+사각 0/3 · ⌘G 묶음(사각 둘+마킹) — Shift 있든 없든 숫자까지 같음.
 *     마킹 «하나만»은 스티커 자기 손잡이(sticker-select.js Shift 갈래)라 3/3 정상 · dev 02f70b89e 엔 여럿 전체 상자 자체가 없다(t2-02b 와 함께 생김).
 *   뿌리: js/overlay-handles.js onUnionHandleDown onMove — sx·sy 를 축마다 따로 · ev.shiftKey 0회. ⌘G 묶음 손잡이(_onHandleMouseDown onMove)도 Shift 갈래 없음.
 *   고침: 둘 다 «모서리 + Shift = 변화 큰 축으로 비율 고정»(단일 에셋 손잡이·스티커와 같은 어휘) · 여럿 상자는 바닥(minSx·minSy) 둘 다 지킴 · 변 손잡이·낱개 프레임은 그대로.
 *   U1 사각 둘 · U2 마킹+사각 — 전체 상자 se + Shift ⇒ sx==sy(±0.01) · 늘었다
 *   U3 [대조] Shift 없으면 종전 숫자(sx = 가로 끌기 · sy = 세로 끌기 · 서로 다름)
 *   U4 [대조] 변 손잡이 e + Shift ⇒ 세로 그대로(변은 비율 고정 안 함)
 *   G1 ⌘G 묶음(사각 둘+마킹) se + Shift ⇒ 묶음 폭·높이 비율 그대로(±0.01) · G2 [대조] Shift 없으면 종전(비율 바뀜)
 *   Z1 전체 상자 Shift 끌기 ⌘Z 한 번 = 끌기 전 · Z2 ⌘G 묶음 Shift 끌기 ⌘Z 한 번 = 끌기 전
 * 양성대조(지디 인텔): js/overlay-handles.js 의 MULTISEL-UNION-SHIFT-RATIO-01 두 `if (… ev.shiftKey …)` 줄을 지우면 U1·U2·G1 빨강 · U3·U4·G2·Z1·Z2 초록.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js multisel-union-shift-ratio
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const DX = 80, DY = 20;          // 끄는 거리(가로가 큰 축) — 화면 px
const TOL = 0.01;                // 비율 허용
const UH = (d) => `#ss-handles-overlay .ss-union-handle.${d}`;
const GH = (d) => `#ss-handles-overlay .ss-resize-handle.${d}`;
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/* 장면 — t202b-union-resize 와 같은 꼴: 떠 있는 사각 sh1f(40,190 160×100) · sh2f(400,40 200×120) · 번호 마킹 m1(500,300). */
async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'sG';
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" data-type="gap" style="height:600px"></div>');
    window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sG'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    const shape = (id) => { window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
      const sh = [...sec.querySelectorAll('.shape-block')].find((x) => !b.has(x)); sh.id = id; const f = sh.closest('.frame-block'); f.id = id + 'f'; return f; };
    const shf = shape('sh1'), shf2 = shape('sh2');
    window.updateFrameBlock?.(shf.id, { width: 160, height: 100 }); window.updateFrameBlock?.(shf2.id, { width: 200, height: 120 });
    [[shf, 40, 190], [shf2, 400, 40]].forEach(([e, l, t]) => { const p = window.OverlayFloat.posElOf(e); window.OverlayFloat.enterFloat(p); p.style.left = l + 'px'; p.style.top = t + 'px'; p.dataset.offsetX = String(l); p.dataset.offsetY = String(t); });
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.sticker-block')); window.addStickerBlock({ count: '1', x: 500, y: 300 });
    [...sec.querySelectorAll('.sticker-block')].find((x) => !b.has(x)).id = 'm1';
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  await raf(page);
  return errs;
}
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);
async function pick(page, sels) {
  let [x, y] = await mid(page, sels[0]); await page.mouse.click(x, y);
  await page.keyboard.down('Shift');
  for (const s of sels.slice(1)) { [x, y] = await mid(page, s); await page.mouse.click(x, y); }
  await page.keyboard.up('Shift'); await raf(page);
}
/** 진짜 끌기 — shift 면 누른 채(키보드 상태가 마우스 이벤트 modifiers 로 실린다) */
async function drag(page, sel, dx, dy, shift) {
  const [x, y] = await mid(page, sel);
  await page.mouse.move(x, y);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await raf(page);
}
const unionWH = (page) => page.evaluate(() => { const u = window.__selOverlay.union(); return [u.r - u.l, u.b - u.t]; });
const groupWH = (page) => page.evaluate(() => { const g = document.getElementById('sh1f').closest('[data-group="true"]'); return g ? [g.offsetWidth, g.offsetHeight] : null; });
const ratio = (a, b) => ({ sx: b[0] / a[0], sy: b[1] / a[1] });

async function unionCase(page, sels, shift, dir = 'se') {
  const errs = await scene(page);
  await pick(page, sels);
  await page.locator(UH(dir)).waitFor({ state: 'visible' });
  const a = await unionWH(page);
  await drag(page, UH(dir), DX, dir === 'e' ? 0 : DY, shift);
  const b = await unionWH(page);
  const r = ratio(a, b);
  console.log(`USHIFT ${sels.join('+')} ${dir} shift=${shift} ` + JSON.stringify({ a, b, ...r }));
  return { errs, a, b, ...r };
}
async function grouped(page) {
  const errs = await scene(page);
  await pick(page, ['#sh1', '#sh2', '#m1']);
  await page.keyboard.press('Meta+g');
  await page.locator(GH('se')).waitFor({ state: 'attached' });
  const g = await page.evaluate(() => { const g = document.getElementById('sh1f').closest('[data-group="true"]'); return !!g && g === document.getElementById('m1').closest('[data-group="true"]'); });
  expect(g, '[전제] 사각 둘 + 마킹이 한 묶음').toBe(true);
  return errs;
}

for (const [n, sels] of [[1, ['#sh1', '#sh2']], [2, ['#sh1', '#m1']]]) {
  test(`U${n} ${sels.join('+')} — 전체 상자 se + Shift ⇒ 비율 유지`, async ({ page }) => {
    const r = await unionCase(page, sels, true);
    expect(r.sx, '[전제] 늘었다').toBeGreaterThan(1);
    expect(Math.abs(r.sx - r.sy), `★Shift 인데 비율이 바뀌었다 sx ${r.sx.toFixed(3)} · sy ${r.sy.toFixed(3)}`).toBeLessThan(TOL);
    expect(r.errs).toEqual([]);
  });
}

test('U3 [대조] Shift 없으면 종전 — sx·sy 가 각 축 끌기대로(서로 다름)', async ({ page }) => {
  const r = await unionCase(page, ['#sh1', '#sh2'], false);
  expect(Math.abs(r.sx - (r.a[0] + DX) / r.a[0]), '가로 = 가로 끌기').toBeLessThan(TOL);
  expect(Math.abs(r.sy - (r.a[1] + DY) / r.a[1]), '세로 = 세로 끌기').toBeLessThan(TOL);
  expect(Math.abs(r.sx - r.sy), '[전제] 두 축이 다르게 끌렸다').toBeGreaterThan(TOL);
  expect(r.errs).toEqual([]);
});

test('U4 [대조] 변 손잡이 e + Shift ⇒ 세로 그대로', async ({ page }) => {
  const r = await unionCase(page, ['#sh1', '#sh2'], true, 'e');
  expect(r.sx, '[전제] 가로 늘었다').toBeGreaterThan(1);
  expect(Math.abs(r.sy - 1), '변 손잡이는 세로를 안 바꾼다').toBeLessThan(TOL);
  expect(r.errs).toEqual([]);
});

for (const [n, shift] of [[1, true], [2, false]]) {
  test(`G${n} ⌘G 묶음(사각 둘+마킹) se ${shift ? '+ Shift ⇒ 비율 유지' : '[대조] Shift 없음 ⇒ 종전(비율 바뀜)'}`, async ({ page }) => {
    const errs = await grouped(page);
    const a = await groupWH(page);
    await drag(page, GH('se'), DX, DY, shift);
    const b = await groupWH(page);
    const r = ratio(a, b);
    console.log(`USHIFT G${n} ` + JSON.stringify({ a, b, ...r }));
    expect(r.sx, '[전제] 늘었다').toBeGreaterThan(1);
    if (shift) expect(Math.abs(r.sx - r.sy), `★⌘G 묶음 Shift 인데 비율이 바뀌었다 sx ${r.sx.toFixed(3)} · sy ${r.sy.toFixed(3)}`).toBeLessThan(TOL);
    else expect(Math.abs(r.sx - r.sy), '종전 — 두 축 따로').toBeGreaterThan(TOL);
    expect(errs).toEqual([]);
  });
}

test('Z1 전체 상자 Shift 끌기 — ⌘Z 한 번 = 끌기 전', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#sh1', '#m1']);
  await page.locator(UH('se')).waitFor({ state: 'visible' });
  const st = () => page.evaluate(() => ['sh1f', 'm1'].map((i) => { const e = document.getElementById(i); return [e.style.left, e.style.top, e.style.width, e.style.height, e.dataset.x, e.dataset.y, e.dataset.size]; }));
  const a = await st();
  await expectOneUndoStep(page, async () => { await drag(page, UH('se'), DX, DY, true); }, '여럿 크기 Shift');
  expect(await st(), '⌘Z 한 번 = 끌기 전').toEqual(a);
  expect(errs).toEqual([]);
});

test('Z2 ⌘G 묶음 Shift 끌기 — ⌘Z 한 번 = 끌기 전', async ({ page }) => {
  const errs = await grouped(page);
  const a = await groupWH(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  await expectOneUndoStep(page, async () => { await drag(page, GH('se'), DX, DY, true); }, '⌘G 묶음 크기 Shift');
  expect(await groupWH(page), '⌘Z 한 번 = 끌기 전').toEqual(a);
  expect(errs).toEqual([]);
});
