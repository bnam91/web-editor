/* t201-multi-group-outline — 여럿 고르면 «각자 1px 테두리 + 전체 상자 하나 · 낱개 핸들 0» (t2-01 · 결정 문서 T201-DECISION-261109 칸 A1~C1).
 * 규칙: R1 각자 테두리 + 2개 이상이면 전체 상자(.ss-sel-union) 하나 · R2 고른 것의 조상(프레임·그룹)은 .selected 여도 안 그린다
 *       · Q2 2개 이상이면 핸들 0 · Q5 끄는 동안도 같은 모양 · 1개면 오늘과 같다(S 칸 — 옛 판에서도 초록이어야 한다).
 * 판 짜기 = 진짜 클릭·⇧클릭·더블클릭·⌘G. 흐름 T0+T1=G1 · T2+T3=G2 · T4 낱개 / 자유 프레임 F 안 K0+K1=GA · GA+K2=GB(중첩) · K3+K4=GC · K5 낱개.
 * 양성대조: js/selection-overlay.js·css/editor-blocks.css 를 기준판 e7d97f1ec 로 돌리면 S 칸 말고 다 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
/* «고른 블럭의 크기·회전» 손잡이 이름 — css/editor-blocks.css 의 body.sel-multi 목록과 같다. 넓은 «-handle» 성질로 세면 그 규칙이 모드 손잡이까지 죽여도 못 잡는다. */
const OWNER = ['ss-resize-handle', 'ss-radius-handle', 'ss-rotate-handle', 'asset-overlay-handle', 'asset-radius-handle', 'mdl-overlay-handle', 'mdl-radius-handle',
  'cpn-overlay-handle', 'icb-overlay-handle', 'canvas-overlay-handle', 'canvas-radius-handle', 'vector-overlay-handle', 'grd-overlay-handle', 'grd-img-overlay-handle',
  'zm-overlay-handle', 'zm-radius-handle', 'zm-rotate-handle', 'tfo-overlay-handle', 'gradient-corner-handle', 'frame-resize-handle', 'shape-handle', 'zoom-handle',
  'annot-handle', 'annot-rot-handle', 'hlb-handle', 'hlb-thickness-handle', 'sticker-corner-handle', 'asset-handle', 'tfh-handle', 'shape-rotate-zone', 'tb-rotate-zone',
  'mdl-rotate-zone', 'ab-rotate-zone', 'vb-rotate-zone', 'mkp-rotate-zone', 'icn-rotate-zone', 'icb-rotate-zone', 'cvb-rotate-zone', 'sticker-rotate-zone'].map((c) => '.' + c).join(',');

async function build(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(async (FR) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'S';
    sec.querySelectorAll('.frame-block[data-text-frame]').forEach((t) => (t.closest('.row') || t).remove());
    const text = (frame, id) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = frame; window.addTextBlock('body'); window._activeFrame = null;
      const tb = [...(frame || sec).querySelectorAll('.text-block')].pop(); tb.id = id; tb.closest('.frame-block[data-text-frame]').id = 'W' + id; return tb; };
    for (let i = 0; i < 5; i++) text(null, 'T' + i);
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock();
    const F = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); F.id = 'F'; window.updateFrameBlock('F', { width: 780, height: 560 });
    const at = [[40, 40], [400, 40], [40, 160], [40, 300], [400, 300], [40, 450]];
    at.forEach(([l, t], i) => { const w = text(F, 'K' + i).closest('.frame-block'); w.style.left = l + 'px'; w.style.top = t + 'px'; w.style.width = '300px'; });
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" data-type="gap" style="height:900px"></div>');
    window.rebindAll?.(); window.deselectAll(); window.clearHistory?.();
  }, FR);
  await raf(page);
  return errs;
}
const ctr = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) { e.scrollIntoView({ block: 'center' }); } const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, id);
async function click(page, id, mod) { const [x, y] = await ctr(page, id); if (mod) await page.keyboard.down(mod); await page.mouse.click(x, y); if (mod) await page.keyboard.up(mod); await raf(page); }
async function dbl(page, id) { const [x, y] = await ctr(page, id); await page.mouse.dblclick(x, y); await raf(page); }
async function group(page, a, b) { await click(page, a); await click(page, b, 'Shift'); await page.keyboard.press('Meta+g'); await raf(page);
  const g = await page.evaluate(() => { const s = [...document.querySelectorAll('#canvas .frame-block[data-group="true"].selected')].pop(); return s && s.id; }); await page.evaluate(() => window.deselectAll()); await raf(page); return g; }
/* 그룹 셋을 진짜 ⌘G 로 — G1 G2(흐름) · GA→GB(중첩) · GC. 자유 프레임 안은 «클릭=바깥 F · 더블클릭=한 단계 안» 이라 dbl 로 들어간다. */
async function groups(page) {
  const G1 = await group(page, 'T0', 'T1'); const G2 = await group(page, 'T2', 'T3');
  await click(page, 'K0'); await dbl(page, 'K0'); await click(page, 'K1', 'Shift'); await page.keyboard.press('Meta+g'); await raf(page);
  const GA = await page.evaluate(() => document.getElementById('K0').closest('.frame-block[data-group="true"]')?.id); await page.evaluate(() => window.deselectAll()); await raf(page);
  await click(page, 'K0'); await dbl(page, 'K0'); await click(page, 'K2', 'Shift'); await page.keyboard.press('Meta+g'); await raf(page);
  const GB = await page.evaluate(() => document.getElementById('K2').closest('.frame-block[data-group="true"]')?.id); await page.evaluate(() => window.deselectAll()); await raf(page);
  await click(page, 'K3'); await dbl(page, 'K3'); await click(page, 'K4', 'Shift'); await page.keyboard.press('Meta+g'); await raf(page);
  const GC = await page.evaluate(() => document.getElementById('K3').closest('.frame-block[data-group="true"]')?.id); await page.evaluate(() => window.deselectAll()); await raf(page);
  const nest = await page.evaluate(([GA, GB]) => !!GA && document.getElementById(GA).parentElement.id === GB, [GA, GB]);
  expect([G1, G2, GA, GB, GC].every(Boolean) && nest, `[전제] 그룹 ${[G1, G2, GA, GB, GC]} 중첩 ${nest}`).toBe(true);
  return { G1, G2, GA, GB, GC };
}
/* 화면 상태 — 그린 대상(호스트 id) · 테두리 path 수 · 전체 상자 bbox · 보이는 핸들 수(섹션 바닥 손잡이는 한 블럭 것이 아니라 뺀다). */
const look = (page) => page.evaluate((OWNER) => {
  const vis = (h) => h.getBoundingClientRect().width > 0 && getComputedStyle(h).display !== 'none';
  const paths = [...document.querySelectorAll('.ss-sel-layer .ss-sel-path')];
  const u = paths.filter((p) => p.classList.contains('ss-sel-union'));
  const tg = window.__selOverlay.targets();
  const hosts = tg.map((e) => e.getBoundingClientRect());
  const want = hosts.length ? { l: Math.min(...hosts.map((r) => r.left)), t: Math.min(...hosts.map((r) => r.top)), r: Math.max(...hosts.map((r) => r.right)), b: Math.max(...hosts.map((r) => r.bottom)) } : null;
  const bb = u[0] && u[0].getBBox();
  const one = paths[0] && paths[0].getBBox();
  return {
    drawn: tg.map((e) => e.id), paths: paths.length, unions: u.length,
    unionOk: !!(bb && want) && Math.abs(bb.x - want.l) <= 1 && Math.abs(bb.y - want.t) <= 1 && Math.abs(bb.x + bb.width - want.r) <= 1 && Math.abs(bb.y + bb.height - want.b) <= 1,
    unionBox: bb && [bb.x, bb.y, bb.x + bb.width, bb.y + bb.height].map(Math.round), want: want && [want.l, want.t, want.r, want.b].map(Math.round),
    oneOk: !!(one && hosts[0]) && Math.abs(one.x - hosts[0].left) <= 1 && Math.abs(one.y - hosts[0].top) <= 1 && Math.abs(one.x + one.width - hosts[0].right) <= 1 && Math.abs(one.y + one.height - hosts[0].bottom) <= 1,
    handles: [...document.querySelectorAll(OWNER)].filter(vis).length,
    multi: document.body.classList.contains('sel-multi'),
  };
}, OWNER);
/* 여럿 칸의 판정 한 자리 — 테두리 = 고른 수 + 1 · 전체 상자 = 고른 것의 합 ±1 · 핸들 0 · 그린 대상에 조상 없음. */
function expectMulti(L, ids, ancestors = []) {
  expect(L.drawn.slice().sort(), '그린 대상 = 고른 것').toEqual(ids.slice().sort());
  expect(L.paths, '테두리 수 = 고른 수 + 전체 상자 1').toBe(ids.length + 1);
  expect(L.unions, '전체 상자 하나').toBe(1);
  expect(L.unionOk, `전체 상자 = 합 ±1 (${L.unionBox} vs ${L.want})`).toBe(true);
  expect(L.handles, '여럿이면 핸들 0').toBe(0);
  for (const a of ancestors) expect(L.drawn, `조상 ${a} 안 그림`).not.toContain(a);
}
function expectSingle(L, id, handles) {
  expect(L.drawn, '그린 대상 하나').toEqual([id]);
  expect(L.paths, '테두리 하나 · 전체 상자 없음').toBe(1);
  expect(L.unions).toBe(0);
  expect(L.oneOk, '테두리 = 그 상자').toBe(true);
  expect(L.handles, '핸들 = 오늘과 같다').toBe(handles);
  expect(L.multi).toBe(false);
}

test('A1·A2·A3 흐름: 그룹 하나 = 오늘 · 그룹+⇧그룹 = 각자+전체 · +⇧낱개 · 해제하면 다 사라진다', async ({ page }) => {
  test.setTimeout(90000); const errs = await build(page); const { G1, G2 } = await groups(page);
  await click(page, 'T0'); expectSingle(await look(page), G1, 12);
  await click(page, 'T2', 'Shift'); expectMulti(await look(page), [G1, G2]);
  await click(page, 'T4', 'Shift'); expectMulti(await look(page), [G1, G2, 'WT4']);
  await page.evaluate(() => window.deselectAll()); await raf(page);
  const L = await look(page); expect([L.paths, L.unions, L.handles, L.multi], '해제 뒤 테두리·전체상자·핸들·표식 0').toEqual([0, 0, 0, false]);
  expect(errs).toEqual([]);
});

test('A4·A5 그룹 안 글자(더블클릭)는 부모 그룹을 안 그린다 · +⇧형제 = 각자+전체', async ({ page }) => {
  test.setTimeout(90000); await build(page); const { G1 } = await groups(page);
  await click(page, 'T0'); await dbl(page, 'T0');
  const L = await look(page); expectSingle(L, 'WT0', 4);
  await click(page, 'T1', 'Shift'); expectMulti(await look(page), ['WT0', 'WT1'], [G1]);
});

test('B1·B2 프레임 안 그룹 하나 = 오늘 · +⇧낱개 = 각자+전체, 부모 프레임 F 는 안 그린다', async ({ page }) => {
  test.setTimeout(90000); await build(page); const { GB } = await groups(page);
  await click(page, 'K0'); await dbl(page, 'K0'); expectSingle(await look(page), GB, 12);
  await click(page, 'K5', 'Shift');
  const fSel = await page.evaluate(() => document.getElementById('F').classList.contains('selected'));
  expectMulti(await look(page), [GB, 'WK5'], ['F']);
  console.log('  B2 F.selected(클릭 보호 — 지우지 않음) =', fSel);
});

test('B5·B6·B7 중첩 더블클릭은 한 단계씩 · 맨 안 자식 + ⇧밖 블럭 = 각자+전체, 조상 F·GB·GA 안 그림', async ({ page }) => {
  test.setTimeout(90000); await build(page); const { GA, GB } = await groups(page);
  await click(page, 'K0'); await dbl(page, 'K0'); expectSingle(await look(page), GB, 12);
  await dbl(page, 'K0'); expectSingle(await look(page), GA, 12);
  await dbl(page, 'K0'); expectSingle(await look(page), 'WK0', 4);
  await click(page, 'T4', 'Shift'); expectMulti(await look(page), ['WK0', 'WT4'], ['F', GB, GA]);
});

test('C1 그룹 둘을 끄는 동안 = 각자+전체, 핸들 0 · 놓은 뒤에도 둘 다(T2-01-DROP 현빈 2026-11-10 «피그마처럼 유지»)', async ({ page }) => {
  test.setTimeout(90000); await build(page); const { GB, GC } = await groups(page);
  await click(page, 'K0'); await dbl(page, 'K0'); await click(page, 'K3', 'Shift');
  expectMulti(await look(page), [GB, GC]);
  /* 그룹의 «빈 자리»(K1 아래 · K2 오른쪽)를 잡는다 — 자식 K0 위에서 누르면 기존 적중 규칙이 GB 하나로 좁힌다(이 티켓 밖). */
  const [x, y] = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * 0.75, r.bottom - 6]; }, GB);
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.frame-block')?.id, [x, y]);
  expect(hit, '[전제] 그룹 빈 자리를 잡는다').toBe(GB);
  const before = await page.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, GB);
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(x + 4 * i, y + 3 * i); await raf(page); }
  const moved = await page.evaluate(([id, b]) => Math.abs(document.getElementById(id).getBoundingClientRect().top - b) > 2, [GB, before]);
  const during = await look(page);
  await page.mouse.up(); await raf(page);
  expect(moved, '[전제] 실제로 끌렸다').toBe(true);
  expectMulti(during, [GB, GC]);
  expectMulti(await look(page), [GB, GC]);   /* ~~놓은 뒤 click 이 하나로 좁힌다 — 오늘 동작 그대로(Q5 는 «끄는 동안»만)~~ ⇒ 현빈 2026-11-10 결정(T2-01-DROP-KEEP-MULTISELECT-01) · ⛔이 줄 수를 늘리지 마라 — 아래 마키 칸이 dom-screen-px-census 명부 «:151» 이름이다 */
});

test('마키로 고른 것 = ⇧클릭으로 고른 것과 같은 모양', async ({ page }) => {
  test.setTimeout(90000); await build(page); const { G1, G2 } = await groups(page);
  await page.evaluate(() => { document.getElementById('S').scrollIntoView({ block: 'start' }); const w = document.getElementById('canvas-wrap');
    w.scrollLeft += document.getElementById('canvas').getBoundingClientRect().left - (w.getBoundingClientRect().left + 200); }); await raf(page);
  const [x0, y0, x1, y1] = await page.evaluate(([a, b]) => { const c = document.getElementById('canvas').getBoundingClientRect();
    const A = document.getElementById(a).getBoundingClientRect(), B = document.getElementById(b).getBoundingClientRect(); return [c.left - 60, A.top - 4, c.right - 4, B.bottom + 4]; }, [G1, G2]);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10);
  await page.mouse.up(); await raf(page);
  expectMulti(await look(page), [G1, G2]);
});

test('S 한 개 고름은 오늘과 같다 — 그룹 · 블럭 · 프레임 (옛 판에서도 초록)', async ({ page }) => {
  test.setTimeout(90000); await build(page); const { G1 } = await groups(page);
  await click(page, 'T0'); expectSingle(await look(page), G1, 12);
  await page.evaluate(() => window.deselectAll()); await raf(page);
  await click(page, 'T4'); expectSingle(await look(page), 'WT4', 4);
  await page.evaluate(() => window.deselectAll()); await raf(page);
  await click(page, 'K5'); expectSingle(await look(page), 'F', 12);
});

/* 모드 손잡이는 «고른 블럭»의 것이 아니다 — 여럿 골라도 숨기지 않는다. 양성대조: css 를 3e6e74997(넓은 «-handle» 규칙)로 돌리면 크롭 칸이 빨강. */
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const modeVis = (page, sel) => page.evaluate((sel) => { const hs = [...document.querySelectorAll(sel)];
  return { n: hs.length, vis: hs.filter((h) => getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().width > 0).length, multi: document.body.classList.contains('sel-multi') }; }, sel);

test('M1 여럿 고른 채 이미지 크롭(편집) 모드 손잡이는 보인다', async ({ page }) => {
  test.setTimeout(90000); const errs = await build(page);
  await click(page, 'T0'); await click(page, 'T1', 'Shift');
  /* 크롭은 더블클릭으로 들어가고 그 클릭이 하나로 좁힌다 → 진짜 ⇧클릭 여럿 고름은 그대로 두고 앱의 진입 함수를 직접 부른다. */
  await page.evaluate((PX) => { const sec = document.getElementById('S').querySelector('.section-inner');
    sec.insertAdjacentHTML('afterbegin', `<div class="asset-block" id="AB" style="width:200px;height:120px;position:relative;overflow:hidden"><img class="asset-img" src="${PX}" style="width:200px;height:120px"></div>`);
    window.enterImageEditMode(document.getElementById('AB'), { noColorAdjust: true }); }, PX);
  await raf(page);
  const C = await modeVis(page, '.img-corner-handle, .img-edge-handle, .img-rotate-zone');
  expect(C.multi, '[전제] 여럿 고름 표식').toBe(true);
  expect(C.n, '[전제] 크롭 손잡이 생김').toBeGreaterThan(0);
  expect(C.vis, '크롭 손잡이 다 보임').toBe(C.n);
  expect(errs).toEqual([]);
});

test('M2 여럿 고른 채 아웃페인트 손잡이는 보인다', async ({ page }) => {
  test.setTimeout(90000); await build(page);
  await click(page, 'T0'); await click(page, 'T1', 'Shift');
  /* 앱 길 = js/ai-image-gen.js 가 스크래치 칩에 window._outpaintShow(id). 스크래치 항목은 _createItem 꼴(#canvas-scaler 안 .scratch-item[data-scratch-id] > img)로 둔다. */
  await page.evaluate((PX) => { document.getElementById('canvas-scaler').insertAdjacentHTML('beforeend',
    `<div class="scratch-item" data-scratch-id="sp_t201" style="position:absolute;left:40px;top:40px;width:200px;height:120px"><img src="${PX}" style="width:200px;height:120px"></div>`);
    window._outpaintShow('sp_t201'); }, PX);
  await raf(page);
  const O = await modeVis(page, '.outpaint-handle');
  await page.evaluate(() => window._outpaintHide());
  expect(O.multi, '[전제] 여럿 고름 표식').toBe(true);
  expect(O.n, '[전제] 아웃페인트 손잡이 8').toBe(8);
  expect(O.vis, '아웃페인트 손잡이 다 보임').toBe(8);
});
