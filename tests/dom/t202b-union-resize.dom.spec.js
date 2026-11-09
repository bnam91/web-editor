/* t202b-union-resize — t2-02b(현빈 「하나의 선택 영역 기준으로 함께 확대·축소」): 여럿 고르면 t2-01 전체 상자(.ss-sel-union) «하나»에 손잡이 8개 → 끌면 고른 것 전부가 맞은편 꼭지/변 기준 같은 비율.
 * 장면: 섹션 · 떠 있는 사각 도형 shf(40,190 160×100) · shf2(400,40 200×120) · 떠 있는 글자 프레임 tf1(250,150 폭 160 · 20px 한 줄 — 상자 안쪽) · 흐름 글자 tf2 · 번호 마킹 m1.
 * 진짜 ⇧클릭 · 선택상자 · 레이어 패널 ⇧클릭 · 진짜 마우스 끌기. 고정 대기 0.
 * 결정: 흐름(absolute 아님) 대상이 섞이면 손잡이 «없음»(안내 글 없음) — ⌘G 의 흐름 자식 ×8 흠을 안 물려받는다.
 * 양성대조: js/selection-overlay.js·css/editor-blocks.css 를 c3a25f598 로 돌리면 S(하나) 칸·흐름 칸 말고 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const OWNER = ['ss-resize-handle', 'ss-radius-handle', 'ss-rotate-handle', 'asset-overlay-handle', 'asset-radius-handle', 'mdl-overlay-handle', 'mdl-radius-handle',
  'cpn-overlay-handle', 'icb-overlay-handle', 'canvas-overlay-handle', 'canvas-radius-handle', 'vector-overlay-handle', 'grd-overlay-handle', 'grd-img-overlay-handle',
  'zm-overlay-handle', 'zm-radius-handle', 'zm-rotate-handle', 'tfo-overlay-handle', 'gradient-corner-handle', 'frame-resize-handle', 'shape-handle', 'zoom-handle',
  'annot-handle', 'annot-rot-handle', 'hlb-handle', 'hlb-thickness-handle', 'sticker-corner-handle', 'asset-handle', 'tfh-handle', 'shape-rotate-zone', 'tb-rotate-zone',
  'mdl-rotate-zone', 'ab-rotate-zone', 'vb-rotate-zone', 'mkp-rotate-zone', 'icn-rotate-zone', 'icb-rotate-zone', 'cvb-rotate-zone', 'sticker-rotate-zone'].map((c) => '.' + c).join(',');
const UH = (d) => `#ss-handles-overlay .ss-union-handle.${d}`;
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

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
    const tf = sec.querySelector('.frame-block[data-text-frame]'); tf.id = 'tf1'; tf.style.width = '160px'; tf.dataset.width = '160';
    const tb = tf.querySelector('[class^="tb-"]'); tb.textContent = '글자'; tb.style.fontSize = '20px';   // 한 줄 — 상자 «안쪽»에 둔다(높이는 글자가 정한다)
    window.deselectAll(); window.selectSection(sec); window.addTextBlock('body');
    const tf2 = [...sec.querySelectorAll('.frame-block[data-text-frame]')].find((x) => x !== tf); tf2.id = 'tf2';
    sec.querySelector('.section-inner').appendChild(tf2.closest('.row') || tf2);   // 흐름 글자는 바닥으로 — 선택상자가 안 덮게
    [[shf, 40, 190], [shf2, 400, 40], [tf, 250, 150]].forEach(([e, l, t]) => { const p = window.OverlayFloat.posElOf(e); window.OverlayFloat.enterFloat(p); p.style.left = l + 'px'; p.style.top = t + 'px'; p.dataset.offsetX = String(l); p.dataset.offsetY = String(t); });
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.sticker-block')); window.addStickerBlock({ count: '1', x: 500, y: 300 });
    [...sec.querySelectorAll('.sticker-block')].find((x) => !b.has(x)).id = 'm1';
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  await raf(page);
  return errs;
}
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);
async function pick(page, sels, mod = 'Shift') {
  let [x, y] = await mid(page, sels[0]); await page.mouse.click(x, y);
  await page.keyboard.down(mod);
  for (const s of sels.slice(1)) { [x, y] = await mid(page, s); await page.mouse.click(x, y); }
  await page.keyboard.up(mod); await raf(page);
}
async function drag(page, sel, dx, dy) {
  const [x, y] = await mid(page, sel);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up(); await raf(page);
}
const look = (page) => page.evaluate((OWNER) => {
  const vis = (h) => h.getBoundingClientRect().width > 0 && getComputedStyle(h).display !== 'none';
  return { union: document.querySelectorAll('.ss-sel-union').length, multi: document.body.classList.contains('sel-multi'),
    uh: [...document.querySelectorAll('#ss-handles-overlay .ss-union-handle')].filter(vis).length,
    owner: [...document.querySelectorAll(OWNER)].filter(vis).length };
}, OWNER);
/** 화면 rect · style · 글자 크기 · 전체 상자 */
const read = (page, ids) => page.evaluate((ids) => {
  const out = { U: window.__selOverlay.union() };
  for (const i of ids) { const e = document.getElementById(i); const r = e.getBoundingClientRect(); const tb = e.querySelector('[class^="tb-"]');
    out[i] = { r: [r.left, r.top, r.width, r.height], st: [e.style.left, e.style.top, e.style.width, e.style.height], fs: tb ? parseFloat(getComputedStyle(tb).fontSize) : null, d: { x: e.dataset.x, y: e.dataset.y } }; }
  return out;
}, ids);
const IDS = ['sh1f', 'sh2f', 'tf1'];
const SEL3 = ['#sh1', '#sh2', '#tf1 .text-block'];
/** 고정점 기준 비율 — 새 rect = A + (옛 − A)×s · ±1.5px · 글자 프레임은 높이를 글자가 정하므로 x·y·폭만 */
function expectRatio(a, b, dir, ids) {
  const U = a.U, W0 = U.r - U.l, H0 = U.b - U.t, V = b.U;
  const ax = dir.includes('w') ? U.r : dir.includes('e') ? U.l : null, ay = dir.includes('n') ? U.b : dir.includes('s') ? U.t : null;
  const sx = ax == null ? 1 : (V.r - V.l) / W0, sy = ay == null ? 1 : (V.b - V.t) / H0;
  if (ax == null) expect([V.l, V.r].map(Math.round), '가로 그대로').toEqual([U.l, U.r].map(Math.round));
  if (ay == null) expect([V.t, V.b].map(Math.round), '세로 그대로').toEqual([U.t, U.b].map(Math.round));
  if (dir.includes('e')) expect(Math.abs(V.l - U.l), '맞은편 왼변 고정').toBeLessThanOrEqual(1.5);
  if (dir.includes('w')) expect(Math.abs(V.r - U.r), '맞은편 오른변 고정').toBeLessThanOrEqual(1.5);
  if (dir.includes('s')) expect(Math.abs(V.t - U.t), '맞은편 윗변 고정').toBeLessThanOrEqual(1.5);
  if (dir.includes('n')) expect(Math.abs(V.b - U.b), '맞은편 아랫변 고정').toBeLessThanOrEqual(1.5);
  for (const i of ids) {
    const [l, t, w, h] = a[i].r, [L, T, W, H] = b[i].r, tag = `${dir} ${i} ${JSON.stringify({ a: a[i].r, b: b[i].r, sx, sy })}`;
    const eL = ax == null ? l : ax + (l - ax) * sx, eT = ay == null ? t : ay + (t - ay) * sy;
    expect(Math.abs(L - eL), `${tag} left`).toBeLessThanOrEqual(1.5);
    expect(Math.abs(W - w * sx), `${tag} width`).toBeLessThanOrEqual(1.5);
    expect(Math.abs(T - eT), `${tag} top`).toBeLessThanOrEqual(1.5);
    if (i !== 'tf1') expect(Math.abs(H - h * sy), `${tag} height`).toBeLessThanOrEqual(1.5);
  }
  return { sx, sy };
}

test('A ★⇧클릭 · 선택상자 · 레이어 패널 ⇧클릭 — 둘 이상이면 전체 상자 손잡이 8 · 낱개 손잡이 0', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#sh1', '#sh2']);
  expect(await look(page), '⇧클릭').toEqual({ union: 1, multi: true, uh: 8, owner: 0 });
  await page.evaluate(() => window.deselectAll()); await raf(page);
  // 선택상자 — 캔버스 왼쪽 밖에서 두 도형을 덮는다(마킹 m1·글자 tf1 은 피한다)
  const p = await page.evaluate(() => { const c = document.getElementById('canvas').getBoundingClientRect(); const a = document.getElementById('sh1f').getBoundingClientRect(), b = document.getElementById('sh2f').getBoundingClientRect();
    return { x0: c.left - 30, y0: a.bottom + 6, x1: b.right + 6, y1: b.top - 6 }; });
  await page.mouse.move(p.x0, p.y0); await page.mouse.down(); await page.mouse.move(p.x1, p.y1, { steps: 8 }); await page.mouse.up(); await raf(page);
  const ms = await page.evaluate(() => window.__selOverlay.targets().map((e) => e.id).sort());
  expect(ms, '[전제] 선택상자로 고른 것').toEqual(expect.arrayContaining(['sh1f', 'sh2f']));
  expect(await look(page), '선택상자').toEqual({ union: 1, multi: true, uh: 8, owner: 0 });
  await page.evaluate(() => window.deselectAll()); await raf(page);
  await page.evaluate(() => window.buildLayerPanel?.());
  const li = (id) => page.evaluate((id) => { const b = document.getElementById(id); const i = [...document.querySelectorAll('#layer-panel-body .layer-item')].findIndex((it) => it._dragTarget === b || it._dragTarget === b.closest('.frame-block'));
    if (i < 0) return null; const it = document.querySelectorAll('#layer-panel-body .layer-item')[i]; it.scrollIntoView({ block: 'center' }); const r = it.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; }, id);
  const p1 = await li('sh1'), p2 = await li('sh2');
  expect(p1 && p2, '[전제] 레이어 패널 행 둘이 보인다').toBeTruthy();
  await page.mouse.click(...p1); await page.keyboard.down('Shift'); await page.mouse.click(...(await li('sh2'))); await page.keyboard.up('Shift'); await raf(page);
  expect(await look(page), '레이어 패널').toEqual({ union: 1, multi: true, uh: 8, owner: 0 });
  expect(errs).toEqual([]);
});

for (const [dir, dx, dy] of [['se', 80, 50], ['nw', -60, -40], ['e', 100, 0], ['s', 0, 60]]) test(`B ${dir} 끌기 — 고른 셋이 맞은편 기준 같은 비율 · 글자 = ⌘G 규칙(min(sx,sy))`, async ({ page }) => {
  const errs = await scene(page);
  await pick(page, SEL3);
  const a = await read(page, IDS);
  const tg = () => page.evaluate(() => window.__selOverlay.targets().map((e) => e.id).sort());
  const sel0 = await tg();
  await drag(page, UH(dir), dx, dy);
  const b = await read(page, IDS);
  const { sx, sy } = expectRatio(a, b, dir, IDS);
  expect(sx !== 1 || sy !== 1, '[전제] 커졌다').toBe(true);
  expect(Math.abs(b.tf1.fs - a.tf1.fs * Math.min(sx, sy)), `글자 ${a.tf1.fs}→${b.tf1.fs}`).toBeLessThanOrEqual(0.15);
  expect(await tg(), '선택 유지').toEqual(sel0);
  expect(errs).toEqual([]);
});

test('C ⌘Z 한 번에 전부 복귀 · 저장→다시 열기 뒤 결과 유지', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, SEL3);
  const a = await read(page, IDS); const pos0 = await page.evaluate(() => window.getHistoryTip().pos);
  await drag(page, UH('se'), 90, 60);
  const b = await read(page, IDS);
  expect(await page.evaluate(() => window.getHistoryTip().pos) - pos0, '끌기가 기록을 남겼다(시작·끝 표본)').toBeGreaterThanOrEqual(1);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(async () => { const c = await read(page, IDS); return IDS.map((i) => c[i].st.concat(c[i].fs)); }, { message: '⌘Z 한 번 = 처음' }).toEqual(IDS.map((i) => a[i].st.concat(a[i].fs)));
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(async () => { const c = await read(page, IDS); return IDS.map((i) => c[i].st.concat(c[i].fs)); }, { message: '다시' }).toEqual(IDS.map((i) => b[i].st.concat(b[i].fs)));
  await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
  await raf(page);
  const c = await read(page, IDS);
  expect(IDS.map((i) => c[i].st.concat(c[i].fs)), '저장 왕복').toEqual(IDS.map((i) => b[i].st.concat(b[i].fs)));
  expect(errs).toEqual([]);
});

test('D 흐름 블럭이 섞이면 손잡이 없음(안내 글 없음) · 끌 것이 없으니 아무것도 안 바뀐다', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#sh1', '#tf2 .text-block']);
  expect(await look(page), '전체 상자는 있고 손잡이는 0').toEqual({ union: 1, multi: true, uh: 0, owner: 0 });
  expect(errs).toEqual([]);
});

test('S 하나만 고르면 오늘과 같다 — 전체 상자·그 손잡이 0 · 낱개 손잡이 있음', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#sh1']);
  const L = await look(page);
  expect([L.union, L.multi, L.uh], '여럿 표시 없음').toEqual([0, false, 0]);
  expect(L.owner, '낱개 손잡이').toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('M 마킹이 섞이면 — t2-02 함수가 없는 판 = 상자만(자리·크기 비율)', async ({ page }) => {
  const errs = await scene(page);
  const has = await page.evaluate(() => typeof window._scaleStickerFromSnap === 'function');
  await pick(page, ['#sh1', '#sh2', '#m1']);
  expect((await look(page)).uh, '손잡이 8').toBe(8);
  const ids = ['sh1f', 'sh2f', 'm1'];
  const a = await read(page, ids);
  await drag(page, UH('se'), 80, 50);
  const b = await read(page, ids);
  expectRatio(a, b, 'se', ids);
  if (!has) expect([+b.m1.d.x, +b.m1.d.y], '상자만 갈래도 자리는 모델 키(dataset.x/y)에 쓴다').toEqual([parseInt(b.m1.st[0]), parseInt(b.m1.st[1])]);
  expect(errs).toEqual([]);
});
test.fixme('M2 마킹 크기를 모델 키(sizeW/H·fontSize)로 — t2-02(a218bd92e) window._scaleStickerFromSnap 합친 뒤 켠다', async () => {});
