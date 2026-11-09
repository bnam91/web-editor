/* t202c-group-flow-child-scale.dom.spec.js — t2-02c: 흐름(안 띄운) 자식이 든 ⌘G 묶음은 손잡이 한 번에 자식이 ×8 로 부풀었다.
 * 뿌리: 흐름 갈래 ⌘G(js/block-factory.js) 가 묶음에 style.width:100% 를 단다 → 손잡이(js/overlay-handles.js)가
 *   시작 폭을 parseInt('100%') = 100 으로 읽어 sx = 796/100. 고침 = 시작 크기는 그려진 상자(startW/H)에서 잰다.
 * 장면: 섹션 · 번호 마킹 m1 · 떠 있는 사각 도형 160×100 · «흐름» 글자 프레임 300 → 진짜 클릭·⌘클릭 → ⌘G → 손잡이 끌기.
 * 양성대조: a218bd92e 의 overlay-handles.js 로 돌리면 F1·F2·F3·F4 빨강(×8). 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const HANDLE = (d) => `#ss-handles-overlay .ss-resize-handle.${d}`;
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);

/** flow = 글자 프레임을 흐름에 둔다(묶음이 width:100%) · false = 띄운다(떠 있는 것만 묶음 — 대조) */
async function scene(page, { flow }) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'sG';
    window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate((flow) => {
    const sec = document.getElementById('sG');
    window.deselectAll(); window.selectSection(sec); window.addStickerBlock({ count: '1', x: 120, y: 60 });
    sec.querySelector('.sticker-block').id = 'm1';
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const sh = [...sec.querySelectorAll('.shape-block')].find((x) => !b.has(x)); sh.id = 'sh1';
    const shf = sh.closest('.frame-block'); shf.id = 'shf'; window.updateFrameBlock?.(shf.id, { width: 160, height: 100 });
    const tf = sec.querySelector('.frame-block[data-text-frame]'); tf.id = 'tf1'; tf.style.width = '300px'; tf.dataset.width = '300';
    const fl = flow ? [[shf, 300, 30]] : [[shf, 300, 30], [tf, 40, 150]];
    fl.forEach(([e, l, t]) => { const p = window.OverlayFloat.posElOf(e); window.OverlayFloat.enterFloat(p); p.style.left = l + 'px'; p.style.top = t + 'px'; p.dataset.offsetX = String(l); p.dataset.offsetY = String(t); });
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  }, flow);
  return errs;
}
async function pick(page, sels) {
  let [x, y] = await mid(page, sels[0]); await page.mouse.click(x, y);
  await page.keyboard.down('Meta');
  for (const s of sels.slice(1)) { [x, y] = await mid(page, s); await page.mouse.click(x, y); }
  await page.keyboard.up('Meta');
}
async function grouped(page, flow) {
  const errs = await scene(page, { flow });
  await pick(page, ['#m1', '#sh1', '#tf1 .text-block']);
  await page.keyboard.press('Meta+g');
  await page.locator(HANDLE('se')).waitFor({ state: 'attached' });
  const g = await page.evaluate(() => { const g = document.getElementById('m1').parentElement;
    return { ok: g.dataset.group === 'true' && ['#shf', '#tf1'].every((i) => document.querySelector(i).closest('[data-group="true"]') === g), w: g.style.width }; });
  expect(g.ok, '[전제] 셋이 한 묶음').toBe(true);
  expect(g.w === '100%', `[전제] 흐름 묶음=100% · 떠 있는 묶음=px (${g.w})`).toBe(flow);
  return errs;
}
async function drag(page, sel, dx, dy) {
  const [x, y] = await mid(page, sel);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}
/** 그려진 상자(줌 100 = 캔버스 px) — 묶음 · 자식은 묶음 기준 [left, top, w, h] · 글자 크기 */
const read = (page) => page.evaluate(() => {
  const g = document.getElementById('m1').closest('[data-group="true"]'); const gr = g.getBoundingClientRect();
  const box = (e) => { const r = e.getBoundingClientRect(); return [r.left - gr.left, r.top - gr.top, r.width, r.height]; };
  return { g: [gr.width, gr.height], gStyleW: g.style.width, m1: box(document.getElementById('m1')), shf: box(document.getElementById('shf')),
    tf1: box(document.getElementById('tf1')), fs: parseFloat(getComputedStyle(document.querySelector('#tf1 [class^="tb-"]')).fontSize) };
});
/** 묶음의 그려진 상자 비율(sx·sy)대로 자식이 따라갔나 ±1.5px · 글자 프레임 높이는 글꼴이 정하므로 fontSize×min(sx,sy) 로 본다 */
function expectFollows(a, b, sx, sy, tag) {
  const near = (v, w, t) => expect(Math.abs(v - w), `${tag} ${t} ${v} vs ${w}`).toBeLessThanOrEqual(1.5);
  for (const id of ['m1', 'shf']) [sx, sy, sx, sy].forEach((s, i) => near(b[id][i], a[id][i] * s, `${id}[${i}]`));
  [sx, sy, sx].forEach((s, i) => near(b.tf1[i], a.tf1[i] * s, `tf1[${i}]`));
  expect(Math.abs(b.fs - a.fs * Math.min(sx, sy)), `${tag} 글자 크기`).toBeLessThanOrEqual(0.15);
}

for (const [dir, dx, dy] of [['se', -100, 60], ['nw', 100, -60]]) {
  test(`F${dir === 'se' ? 1 : 2} 흐름 자식 묶음 · ${dir} 손잡이 ${dx},${dy} — 묶음 상자 비율대로 · ×8 아님`, async ({ page }) => {
    const errs = await grouped(page, true);
    const a = await read(page);
    await drag(page, HANDLE(dir), dx, dy);
    const b = await read(page);
    console.log(`[F ${dir}] ` + JSON.stringify({ a, b }));
    const W0 = a.g[0], H0 = a.g[1];
    expect(Math.abs(b.g[0] - (W0 - Math.abs(dx))), `묶음 폭 = W0−100 (${W0}→${b.g[0]})`).toBeLessThanOrEqual(1);
    expect(Math.abs(b.g[1] - (H0 + Math.abs(dy))), `묶음 높이 = H0+60 (${H0}→${b.g[1]})`).toBeLessThanOrEqual(1);
    const sx = b.g[0] / W0, sy = b.g[1] / H0;
    expect(Math.abs(sx - (W0 - 100) / W0), 'sx 는 그려진 폭에서').toBeLessThan(0.002);
    expectFollows(a, b, sx, sy, dir);
    expect(errs).toEqual([]);
  });
}

test('F3 ⌘Z 한 번이 정확히 되돌린다', async ({ page }) => {
  const errs = await grouped(page, true);
  const a = await read(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  let b;
  await expectOneUndoStep(page, async () => { await drag(page, HANDLE('se'), -100, 60); b = await read(page); }, '흐름 묶음 손잡이');
  expectFollows(a, b, b.g[0] / a.g[0], b.g[1] / a.g[1], 'F3 끈 뒤');
  const u = await read(page);
  expect(u, '⌘Z 뒤 = 끌기 전').toEqual(a);
  expect(errs).toEqual([]);
});

test('F4 저장 → 다시 열기 뒤 같은 상자', async ({ page }) => {
  const errs = await grouped(page, true);
  const a = await read(page);
  await drag(page, HANDLE('se'), -100, 60);
  const b = await read(page);
  expectFollows(a, b, b.g[0] / a.g[0], b.g[1] / a.g[1], 'F4 끈 뒤');
  await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
  await page.waitForFunction(() => !!document.getElementById('m1')?.closest('[data-group="true"]'));
  const r = await read(page);
  expect(r, '다시 열어도 같다').toEqual(b);
  expect(errs).toEqual([]);
});

test('C1 [대조] 떠 있는 것만 묶음 · se +100,+60 — 바닥과 같은 비율', async ({ page }) => {
  const errs = await grouped(page, false);
  const a = await read(page);
  await drag(page, HANDLE('se'), 100, 60);
  const b = await read(page);
  console.log('[C1] ' + JSON.stringify({ a, b }));
  expect([b.g[0] - a.g[0], b.g[1] - a.g[1]], '묶음 +100,+60').toEqual([100, 60]);
  expectFollows(a, b, b.g[0] / a.g[0], b.g[1] / a.g[1], 'C1');
  expect(errs).toEqual([]);
});
