/* t202c-flow-title-width.dom.spec.js — t2-02c 실앱 ❌(미카사 발주10 · int-3 2b5ae01f8 · 태양 0d552c2f5 들어 있음 · 3/3):
 *   흐름 제목(폭 가득 716 · 글자 72px) + 흐름 사각 → ⌘G → se·nw 모서리를 «조금» 끌면 ×8 은 아니지만 제목 폭이 716→100px 로 무너져 글자가 세로로 꺾임.
 * 뿌리: js/overlay-handles.js 묶음 손잡이가 «쥔 때 자식 크기»를 parseInt(style.width) 로 찍는다 — 흐름 제목 글자 프레임은 width:100% 라 100 으로 찍히고,
 *   끄는 매 틱 그 100×sx 를 style.width(px)로 «쓴다». 태양 고침은 묶음 «시작 폭»(읽기)만 막았다. 고침 = 쥔 때 크기를 읽는 한 자리 _pxOr(px 아니면 그려진 크기).
 * 장면(진짜 손): 새 섹션 · 흐름 제목(글자 프레임 width:100% · 72px) · 흐름 사각 도형 → 클릭·⌘클릭 → ⌘G → 손잡이 끌기.
 *   T1 se −40,+20 · T2 nw +40,−20 — 제목 폭 = 쥔 폭 × 묶음 비율(±2) · 100 근처로 안 무너짐 · 글자 크기 = 72×min(sx,sy)
 *   T3 ⌘Z 한 번 = 끌기 전
 *   C1 [대조] 제목 폭이 px(300)이면 옛 판도 맞다(태양 F 와 같은 꼴 — 고침 전후 초록)
 * 양성대조(지디 인텔): overlay-handles.js 묶음 스냅의 `w: _pxOr(c.style.width, c.offsetWidth, parseInt)` → 옛 `w: parseInt(c.style.width) || c.offsetWidth` → T1·T2·T3 빨강 · C1 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const HANDLE = (d) => `#ss-handles-overlay .ss-resize-handle.${d}`;
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);

async function scene(page, { titleW = '100%' } = {}) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'sG';
    window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate((titleW) => {
    const sec = document.getElementById('sG');
    const tf = sec.querySelector('.frame-block[data-text-frame]'); tf.id = 'tf1';
    const t = tf.querySelector('[class^="tb-"]'); t.textContent = '흐름 제목 무너짐 재현'; delete t.dataset.isPlaceholder; t.style.fontSize = '72px';
    tf.style.width = titleW; tf.dataset.width = titleW === '100%' ? '100%' : String(parseInt(titleW));
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const sh = [...sec.querySelectorAll('.shape-block')].find((x) => !b.has(x)); sh.id = 'sh1'; sh.closest('.frame-block').id = 'shf';
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  }, titleW);
  return errs;
}
async function grouped(page, opts) {
  const errs = await scene(page, opts);
  let [x, y] = await mid(page, '#tf1 .text-block'); await page.mouse.click(x, y);
  await page.keyboard.down('Meta'); [x, y] = await mid(page, '#sh1'); await page.mouse.click(x, y); await page.keyboard.up('Meta');
  await page.keyboard.press('Meta+g');
  await page.locator(HANDLE('se')).waitFor({ state: 'attached' });
  const g = await page.evaluate(() => { const tf = document.getElementById('tf1'); const g = tf.closest('[data-group="true"]');
    return { ok: !!g && g === document.getElementById('shf').closest('[data-group="true"]'), tfW: tf.style.width, tfPos: getComputedStyle(tf).position }; });
  expect(g.ok, '[전제] 제목·사각이 한 묶음').toBe(true);
  return { errs, pre: g };
}
async function drag(page, sel, dx, dy) {
  const [x, y] = await mid(page, sel);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}
const read = (page) => page.evaluate(() => {
  const tf = document.getElementById('tf1'); const g = tf.closest('[data-group="true"]'); const gr = g.getBoundingClientRect(); const r = tf.getBoundingClientRect();
  return { g: [gr.width, gr.height], tfW: r.width, tfStyleW: tf.style.width, fs: parseFloat(getComputedStyle(tf.querySelector('[class^="tb-"]')).fontSize) };
});

for (const [n, dir, dx, dy] of [[1, 'se', -40, 20], [2, 'nw', 40, -20]]) {
  test(`T${n} 흐름 제목(100%) + 사각 ⌘G · ${dir} ${dx},${dy} — 제목 폭이 묶음 비율대로(100 으로 안 무너짐)`, async ({ page }) => {
    const { errs, pre } = await grouped(page, { titleW: '100%' });
    expect(pre.tfW, '[전제] 제목 글자 프레임 폭이 %(흐름 가득)').toBe('100%');
    const a = await read(page);
    expect(a.tfW, '[전제] 제목이 넓다').toBeGreaterThan(400);
    await drag(page, HANDLE(dir), dx, dy);
    const b = await read(page);
    const sx = b.g[0] / a.g[0], sy = b.g[1] / a.g[1];
    console.log(`T202CROW T${n} ` + JSON.stringify({ a, b, sx, sy }));
    expect(Math.abs(b.tfW - a.tfW * sx), `★제목 폭 ${a.tfW}→${b.tfW} (기대 ${(a.tfW * sx).toFixed(1)} · style ${b.tfStyleW})`).toBeLessThanOrEqual(2);
    expect(Math.abs(b.fs - a.fs * Math.min(sx, sy)), '글자 크기').toBeLessThanOrEqual(0.2);
    expect(errs).toEqual([]);
  });
}

test('T3 ⌘Z 한 번 = 끌기 전', async ({ page }) => {
  const { errs } = await grouped(page, { titleW: '100%' });
  const a = await read(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  await expectOneUndoStep(page, async () => { await drag(page, HANDLE('se'), -40, 20); }, '흐름 제목 묶음 손잡이');
  const u = await read(page);
  expect(Math.abs(u.tfW - a.tfW), '⌘Z 뒤 제목 폭').toBeLessThanOrEqual(1);
  expect(u.g).toEqual(a.g);
  expect(errs).toEqual([]);
});

test('C1 [대조] 제목 폭이 px(300)이면 옛 판도 비율대로', async ({ page }) => {
  const { errs } = await grouped(page, { titleW: '300px' });
  const a = await read(page);
  await drag(page, HANDLE('se'), -40, 20);
  const b = await read(page);
  const sx = b.g[0] / a.g[0];
  expect(Math.abs(b.tfW - a.tfW * sx)).toBeLessThanOrEqual(2);
  expect(errs).toEqual([]);
});
