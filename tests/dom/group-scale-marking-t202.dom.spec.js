/* group-scale-marking-t202.dom.spec.js — t2-02(현빈): 「마킹 블록을 포함한 여러 객체 복수 선택 → 스케일 확대 시 마킹 블록이 다른 객체와 동일하게 확대되지 않음」.
 * 지디 범위 = ⌘G 묶음 손잡이 길만(묶지 않은 복수 선택 공용 상자는 t2-02b · 보류).
 * 뿌리: 묶음 손잡이(js/overlay-handles.js groupSnap)가 마킹을 «상자»로 보고 style.width/offsetX 만 썼다 — 마킹의 정본은 dataset(x·y·sizeW·sizeH·fontSize·끝점·hlW/hlH)이라
 *   다음 렌더·⌘Z·다시 열기에 60×60 옛 자리로 튀었다. 고침 = 마킹은 window._scaleStickerFromSnap(js/sticker-select.js)이 모델 키로 늘린다.
 * 장면: 섹션 · 번호 마킹 m1(120,120) m2(120,300) 60 · 떠 있는 사각 도형 160×100 · 떠 있는 글자 프레임 300 → 진짜 마우스 클릭·⌘클릭 → ⌘G → 손잡이 끌기.
 * 양성대조: 바닥(v0.9.10) js 두 파일로 돌리면 T1·T3·T4 빨강. 고정 대기 0(⌘Z 한 걸음은 공용 헬퍼 _history-step 이 잰다). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const HANDLE = (d) => `#ss-handles-overlay .ss-resize-handle.${d}`;
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);

/** extra = 선 마킹(arrow)·형광펜 마킹(highlight)도 더한다(T2) */
async function scene(page, { extra = false } = {}) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'sG';
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" id="gbG" data-type="gap" style="height:700px"></div>');
    window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate((extra) => {
    const sec = document.getElementById('sG');
    const mk = (id, opts) => { window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.sticker-block')); window.addStickerBlock(opts); [...sec.querySelectorAll('.sticker-block')].find((x) => !b.has(x)).id = id; };
    mk('m1', { count: '1', x: 120, y: 120 }); mk('m2', { count: '2', x: 120, y: 300 });
    if (extra) { mk('ln', { shape: 'arrow', x1: 200, y1: 460, x2: 340, y2: 520 }); mk('hl', { shape: 'highlight', x: 200, y: 400 }); }
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const sh = [...sec.querySelectorAll('.shape-block')].find((x) => !b.has(x)); sh.id = 'sh1';
    const shf = sh.closest('.frame-block'); shf.id = 'shf'; window.updateFrameBlock?.(shf.id, { width: 160, height: 100 });
    const tf = sec.querySelector('.frame-block[data-text-frame]'); tf.id = 'tf1'; tf.style.width = '300px'; tf.dataset.width = '300';
    [[shf, 40, 190], [tf, 400, 300]].forEach(([e, l, t]) => { const p = window.OverlayFloat.posElOf(e); window.OverlayFloat.enterFloat(p); p.style.left = l + 'px'; p.style.top = t + 'px'; p.dataset.offsetX = String(l); p.dataset.offsetY = String(t); });
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  }, extra);
  return errs;
}
/** 진짜 마우스: 첫째 클릭 → 나머지 ⌘클릭 */
async function pick(page, sels) {
  let [x, y] = await mid(page, sels[0]); await page.mouse.click(x, y);
  await page.keyboard.down('Meta');
  for (const s of sels.slice(1)) { [x, y] = await mid(page, s); await page.mouse.click(x, y); }
  await page.keyboard.up('Meta');
}
const STK = (extra) => ['#m1', '#m2', ...(extra ? ['#ln', '#hl'] : [])];
async function grouped(page, opts = {}) {
  const errs = await scene(page, opts);
  await pick(page, [...STK(opts.extra), '#sh1', '#tf1 .text-block']);
  await page.keyboard.press('Meta+g');
  await page.locator(HANDLE('se')).waitFor({ state: 'attached' });
  const ok = await page.evaluate((ids) => { const g = document.getElementById('m1').parentElement; window.__g = g; return g.dataset.group === 'true' && ids.every((i) => document.querySelector(i).closest('[data-group="true"]') === g); }, [...STK(opts.extra), '#shf', '#tf1']);
  expect(ok, '[전제] 다섯(일곱)이 한 묶음').toBe(true);
  return errs;
}
async function drag(page, sel, dx, dy) {
  const [x, y] = await mid(page, sel);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}
const KEYS = ['x', 'y', 'size', 'sizeW', 'sizeH', 'fontSize', 'hlW', 'hlH', 'x1', 'y1', 'x2', 'y2', 'offsetX', 'offsetY'];
/** 마킹 정본 + 그려진 상자(묶음 기준 · 줌 100) · 묶음 크기 · 도형/글자 폭 */
const read = (page, extra) => page.evaluate(([ids, KEYS]) => {
  const g = document.getElementById('m1').closest('[data-group="true"]'); const gr = g.getBoundingClientRect();
  const out = { gW: parseInt(g.style.width), gH: parseInt(g.style.height), shfW: parseInt(document.getElementById('shf').style.width), shfH: parseInt(document.getElementById('shf').style.height), tfW: parseInt(document.getElementById('tf1').style.width) };
  ids.forEach((i) => { const e = document.querySelector(i); const r = e.getBoundingClientRect(); const d = {}; KEYS.forEach((k) => { if (e.dataset[k] != null) d[k] = e.dataset[k]; });
    out[i.slice(1)] = { d, rect: [r.left - gr.left, r.top - gr.top, r.width, r.height].map(Math.round) }; });
  return out;
}, [STK(extra), KEYS]);

/** 쥔 때 a 에서 (sx,sy) 로 늘린 마킹 기대값 — js/sticker-select.js _bindCornerHandleDrag 와 같은 키 */
function expectScaled(a, b, id, sx, sy) {
  const A = a[id].d, B = b[id].d, tag = `${id} ${JSON.stringify({ A, B, sx, sy })}`;
  expect(+B.x, `${tag} x`).toBe(Math.round(+A.x * sx));
  if (A.x1 == null) expect(+B.y, `${tag} y`).toBe(Math.round(+A.y * sy));
  expect(B.offsetX, `${tag} 마킹에 offsetX 를 안 쓴다`).toBeUndefined();
  if (A.x1 != null) {
    expect([+B.x1, +B.x2], tag).toEqual([Math.round(+A.x1 * sx), Math.round(+A.x2 * sx)]);
    expect([+B.y1, +B.y2], tag).toEqual([Math.round(+A.y1 * sy), Math.round(+A.y2 * sy)]);
    return;
  }
  const w0 = a[id].rect[2], h0 = a[id].rect[3];
  expect(Math.abs(b[id].rect[2] - w0 * sx), `${tag} 그린 폭`).toBeLessThanOrEqual(1);
  expect(Math.abs(b[id].rect[3] - h0 * sy), `${tag} 그린 높이`).toBeLessThanOrEqual(1);
  expect([b[id].rect[0], b[id].rect[1]], `${tag} 그린 자리 = 정본`).toEqual([+B.x, +B.y]);
  if (A.sizeW != null) {
    expect(Math.abs(+B.sizeW - 60 * sx), tag).toBeLessThanOrEqual(1);
    expect(Math.abs(+B.sizeH - 60 * sy), tag).toBeLessThanOrEqual(1);
    expect(+B.size, tag).toBe(Math.max(+B.sizeW, +B.sizeH));
    expect(+B.fontSize, tag).toBe(Math.round(+A.fontSize * Math.min(sx, sy)));
  }
}
const sxy = (a, b) => [b.gW / a.gW, b.gH / a.gH];

test('T1 se 손잡이 +120,+80 — 마킹 정본(x·y·sizeW·sizeH·fontSize)이 묶음 비율대로 · 도형·글자도 같은 비율', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await drag(page, HANDLE('se'), 120, 80);
  const b = await read(page);
  const [sx, sy] = sxy(a, b);
  console.log('[T1] ' + JSON.stringify({ sx, sy, a, b }));
  expect(sx, '[전제] 커졌다').toBeGreaterThan(1.1);
  for (const id of ['m1', 'm2']) expectScaled(a, b, id, sx, sy);
  expect(b.shfW, '도형(바닥과 같은 길)').toBe(Math.round(a.shfW * sx));
  expect(b.shfH).toBe(Math.round(a.shfH * sy));
  expect(b.tfW, '글자(바닥과 같은 길)').toBe(Math.round(a.tfW * sx));
  // 다시 그려도 그대로(정본이 맞는가)
  const again = await page.evaluate(() => { ['m1', 'm2'].forEach((i) => window.renderStickerBlock(document.getElementById(i))); return 0; });
  expect((await read(page)).m1.rect, '다시 그려도 같다').toEqual(b.m1.rect);
  expect(again).toBe(0); expect(errs).toEqual([]);
});

test('T2 nw 손잡이(원점이 움직임) + 선 마킹·형광펜 마킹', async ({ page }) => {
  const errs = await grouped(page, { extra: true });
  const a = await read(page, true);
  await drag(page, HANDLE('nw'), -60, -40);
  const b = await read(page, true);
  const [sx, sy] = sxy(a, b);
  console.log('[T2] ' + JSON.stringify({ sx, sy, a, b }));
  expect(sx, '[전제] 커졌다').toBeGreaterThan(1.05);
  for (const id of ['m1', 'm2', 'ln', 'hl']) expectScaled(a, b, id, sx, sy);
  expect(Math.abs(+b.hl.d.hlW - 160 * sx), '형광펜 hlW').toBeLessThanOrEqual(1);
  expect(Math.abs(+b.hl.d.hlH - 28 * sy), '형광펜 hlH').toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('T3 ⌘Z 한 번이 정확히 되돌리고 ⌘⇧Z 가 다시 건다', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  let b;
  await expectOneUndoStep(page, async () => { await drag(page, HANDLE('se'), 120, 80); b = await read(page); }, '묶음 손잡이 마킹 스케일');
  const u = await read(page);
  for (const id of ['m1', 'm2']) { expect(u[id].d, `${id} ⌘Z 정본`).toEqual(a[id].d); expect(u[id].rect, `${id} ⌘Z 상자`).toEqual(a[id].rect); }
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => page.evaluate(() => document.getElementById('m1').dataset.sizeW)).toBe(b.m1.d.sizeW);
  const r = await read(page);
  for (const id of ['m1', 'm2']) { expect(r[id].d, `${id} ⌘⇧Z 정본`).toEqual(b[id].d); expect(r[id].rect).toEqual(b[id].rect); }
  expect(errs).toEqual([]);
});

test('T4 저장 → 다시 열기 뒤 같은 상자', async ({ page }) => {
  const errs = await grouped(page);
  await drag(page, HANDLE('se'), 120, 80);
  const b = await read(page);
  await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
  await page.waitForFunction(() => !!document.getElementById('m1')?.closest('[data-group="true"]'));
  const r = await read(page);
  for (const id of ['m1', 'm2']) { expect(r[id].d, `${id} 정본`).toEqual(b[id].d); expect(r[id].rect, `${id} 상자`).toEqual(b[id].rect); }
  expect(errs).toEqual([]);
});

test('T5 최소로 줄이면 마킹 ≥ 10 · 글자 ≥ 6', async ({ page }) => {
  const errs = await grouped(page);
  await drag(page, HANDLE('se'), -900, -900);
  const b = await read(page);
  console.log('[T5] ' + JSON.stringify(b));
  for (const id of ['m1', 'm2']) {
    expect(+b[id].d.sizeW, id).toBeGreaterThanOrEqual(10); expect(+b[id].d.sizeH, id).toBeGreaterThanOrEqual(10);
    expect(+b[id].d.fontSize, id).toBeGreaterThanOrEqual(6);
  }
  expect(errs).toEqual([]);
});

test('N1 [음성] 마킹 하나의 모서리 끌기는 그대로(br +30,+20 → 90×80)', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#m1']);
  await page.locator('#m1 .sticker-corner-handle[data-corner="br"]').waitFor({ state: 'attached' });
  await drag(page, '#m1 .sticker-corner-handle[data-corner="br"]', 30, 20);
  const d = await page.evaluate(() => ({ ...document.getElementById('m1').dataset }));
  expect([d.x, d.y, d.sizeW, d.sizeH, d.size, d.fontSize]).toEqual(['120', '120', '90', '80', '90', '21']);
  expect(errs).toEqual([]);
});

test('N2 [음성] 묶지 않은 복수 선택 — 도형 손잡이는 도형만 늘린다', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#m1', '#sh1']);
  const SH = '#ss-handles-overlay .shape-handle.se';
  await page.locator(SH).waitFor({ state: 'attached' });
  const m0 = await page.evaluate(() => ({ ...document.getElementById('m1').dataset }));
  const w0 = await page.evaluate(() => parseInt(document.getElementById('shf').style.width));
  await drag(page, SH, 40, 20);
  const m1 = await page.evaluate(() => ({ ...document.getElementById('m1').dataset }));
  const w1 = await page.evaluate(() => parseInt(document.getElementById('shf').style.width));
  expect(w1, '[전제] 도형이 커졌다').toBeGreaterThan(w0);
  expect(m1, '마킹은 그대로').toEqual(m0);
  expect(errs).toEqual([]);
});
