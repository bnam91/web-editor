/* grid-block-bg.dom.spec.js — G12 그리드 «블럭 배경»(현빈 안 ㄴ: 「배경 여백」만큼 바깥까지 · 지디 GO 2026-10-04).
 *
 * ★재는 것: 렌더된 `.grd-bg` 층의 «사각형»(그리드 바깥 상자 ± 여백)·«픽셀»(띠·프레임 안·칸 배경·칸 테두리·G19 자식 영역)·
 *   이웃 사각형 불변·끄면 바이트 동일·고치는 문(updateGridBlock blockBg) 계약·저장 왕복.
 * ★양성대조: GD1001_ROOT=<5015a2ab 체크아웃> 에서 B* 는 빨강이어야 한다(그 판엔 모델·층이 없다). P0(전제)는 초록이어야 한다.
 *   ⛔HEAD 로 대조하지 않는다 — 고친 뒤엔 HEAD = 고친 판이라 공짜 초록이 된다.
 * 앱 통째(bootApp) · 헤드리스 · 고디터 인스턴스·MCP 대역 무접촉. 실행:
 *   npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/grid-block-bg.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const BG = '#2f3d57', RED = '#ff0000', YEL = '#ffeeaa', WHITE = '#ffffff', GREEN = '#00ff00';

/** 화면 픽셀(뷰포트 좌표) → '#rrggbb'. */
async function px(page, pts) {
  const buf = await page.screenshot();
  return page.evaluate(async ({ b64, pts }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return pts.map(([X, Y]) => { const d = x.getImageData(Math.round(X), Math.round(Y), 1, 1).data;
      return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''); });
  }, { b64: buf.toString('base64'), pts });
}

/* 장면(줌 100%): [위 이웃 = 빨강 프레임] [gap 8] [그리드 gG 2×1] [gap 8] [아래 이웃 = 텍스트블럭] [gap 60] [노란 프레임 fY 안 그리드 gF] */
async function setup(page, boot = bootApp) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await boot(page);
  await page.evaluate(({ RED, YEL }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="gI" style="padding-left:60px;padding-right:60px">
      <div class="gap-block" data-type="gap" style="height:60px"></div>
      <div class="row" id="rA" data-layout="stack"><div class="frame-block" id="nA" style="height:80px;min-height:0;background:${RED}"></div></div>
      <div class="gap-block" data-type="gap" style="height:8px"></div>
      <div class="row" id="gR" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:8px"></div>
      <div class="row" id="rB" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:60px"></div>
      <div class="row" id="rF" data-layout="stack"><div class="frame-block" id="fY" style="background:${YEL};padding:60px"></div></div>
      <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    const mk = (id) => { const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] }); g.id = id; return g; };
    document.getElementById('gR').appendChild(mk('gG'));
    const fy = document.getElementById('fY'); const r2 = document.createElement('div'); r2.className = 'row'; r2.dataset.layout = 'stack'; r2.appendChild(mk('gF')); fy.appendChild(r2);
    const { block: tb } = window.makeTextBlock('body'); tb.id = 'nB'; const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'body'); tf.appendChild(tb);
    document.getElementById('rB').appendChild(tf);
    const t = tb.querySelector('[contenteditable]') || tb.firstElementChild || tb; t.textContent = '███████████'; t.style.fontSize = '60px'; t.style.lineHeight = '1'; t.style.color = '#000';
    window.rebindAll?.(); window.renderGridBlock(document.getElementById('gG')); window.renderGridBlock(document.getElementById('gF')); window.deselectAll?.();
    window.applyZoom?.(100);
  }, { RED, YEL });
  await page.waitForTimeout(300);
  return errs;
}
const updRaw = (page, id, partial, opts) => page.evaluate(([id, p, o]) => window.updateGridBlock(id, p, o), [id, partial, opts]);
/** 성공해야 하는 고침 — 실패(INVALID·RENDER_ERROR)면 그 자리에서 빨갛게(조용한 롤백이 뒤 단언을 엉뚱하게 만들지 않게). */
const upd = async (page, id, partial, opts) => { const r = await updRaw(page, id, partial, opts); expect(r && r.ok, `updateGridBlock(${JSON.stringify(partial).slice(0, 120)}) → ${JSON.stringify(r).slice(0, 300)}`).toBe(true); return r; };
/** 섹션 기준 사각형(스크롤 무관). */
const relRects = (page, ids) => page.evaluate((ids) => { const s = document.getElementById('gS').getBoundingClientRect();
  return Object.fromEntries(ids.map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [id, [r.left - s.left, r.top - s.top, r.width, r.height].map(v => Math.round(v * 10) / 10)]; })); }, ids);
/** 그리드를 화면 가운데로 — 뷰포트 좌표 사각형들. */
const view = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id); g.scrollIntoView({ block: 'center' });
  const f = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  return { z: g.getBoundingClientRect().width / g.offsetWidth, g: f(g), bg: f(g.querySelector(':scope > .grd-bg')), nA: f(document.getElementById('nA')), nB: f(document.getElementById('nB')),
    kids: f(g.querySelector(':scope > .grd-children')), c00: f(g.querySelector('.grd-cell[data-r="0"][data-c="0"]')), c01: f(g.querySelector('.grd-cell[data-r="0"][data-c="1"]')) };
}, id);

/* ══ P0 전제 — 이 설계가 기대는 사실(핀 5015a2ab 에서도 초록이어야 한다) ══ */
test('P0 전제 — 그리드는 position:relative · section-inner 는 가로 clip · 텍스트블럭 z 2 · 프레임은 쌓임 맥락이 아니다 · 새 그리드엔 배경 키·층이 없다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const g = document.getElementById('gG'); const cs = (e) => getComputedStyle(e);
    return { pos: cs(g).position, clip: cs(document.getElementById('gI')).overflowX, tbZ: cs(document.getElementById('nB')).zIndex,
      frZ: cs(document.getElementById('fY')).zIndex, frIso: cs(document.getElementById('fY')).isolation,
      keys: Object.keys(g.dataset).filter(k => k.startsWith('blockBg')), layer: !!g.querySelector(':scope > .grd-bg'), iso: g.style.isolation };
  });
  expect(r.pos).toBe('relative');
  expect(r.clip).toBe('clip');
  expect(r.tbZ).toBe('2');
  expect(r.frZ, '★프레임은 z auto — 그래서 z-index:-1 «만»으로는 프레임 배경 밑에 깔린다').toBe('auto');
  expect(r.frIso).toBe('auto');
  expect(r.keys).toEqual([]);
  expect(r.layer).toBe(false);
  expect(r.iso).toBe('');
  expect(errs).toEqual([]);
});

/* ══ B — 기능 (핀에서는 빨강) ══ */
test('B0 ★끄면 바이트 동일 — 켰다 끄면 style·innerHTML 이 켜기 전과 같다 · blockBg:null 은 키를 전부 지운다', async ({ page }) => {
  await setup(page);
  const snap = () => page.evaluate(() => { const g = document.getElementById('gG'); return { st: g.getAttribute('style'), html: g.innerHTML }; });
  const a = await snap();
  expect((await upd(page, 'gG', { blockBg: { on: true, color: BG, padY: 20, padX: 30 } })).ok).toBe(true);
  const on = await snap();
  expect(on.html).toContain('class="grd-bg"');
  expect(on.st).toContain('isolation: isolate');
  expect((await upd(page, 'gG', { blockBg: { on: false } })).ok).toBe(true);
  const off = await snap();
  expect(off, '끄면 켜기 전과 바이트 동일').toEqual(a);
  const kept = await page.evaluate(() => ({ ...document.getElementById('gG').dataset }));
  expect(kept.blockBgOn, '끄면 마스터만 지운다').toBeUndefined();
  expect(kept.blockBgColor, '끈 뒤에도 색은 남는다(다시 켜면 돌아온다)').toBe(BG);
  expect((await upd(page, 'gG', { blockBg: null })).ok).toBe(true);
  const left = await page.evaluate(() => Object.keys(document.getElementById('gG').dataset).filter(k => k.startsWith('blockBg')));
  expect(left).toEqual([]);
  expect(await snap()).toEqual(a);
});

test('B2 ★기하 — 배경 = 그리드 바깥 상자 ± (좌우, 상하) · 외곽선 굵기만큼 보정 · 고정폭·fullBleed 를 따라간다 · 이웃 사각형 불변', async ({ page }) => {
  await setup(page);
  const ids = ['nA', 'gG', 'nB', 'fY', 'gF'];
  const before = await relRects(page, ids);
  await upd(page, 'gG', { blockBg: { on: true, color: BG, padY: 40, padX: 24 } });
  await upd(page, 'gF', { blockBg: { on: true, color: BG } });
  expect(await relRects(page, ids), '★이웃·그리드 사각형이 한 픽셀도 안 움직인다(마진도 패딩도 아니다)').toEqual(before);
  const d = (v) => ({ top: v.g.t - v.bg.t, right: v.bg.r - v.g.r, bottom: v.bg.b - v.g.b, left: v.g.l - v.bg.l });
  const near = (o, e) => Object.keys(e).every(k => Math.abs(o[k] - e[k]) <= 0.6);
  let v = await view(page, 'gG');
  expect(near(d(v), { top: 40, right: 24, bottom: 40, left: 24 }), JSON.stringify(d(v))).toBe(true);
  v = await view(page, 'gF');
  expect(near(d(v), { top: 16, right: 16, bottom: 16, left: 16 }), `기본값 16/16 ${JSON.stringify(d(v))}`).toBe(true);
  // 외곽선 굵기 보정 — 칸 테두리 4px 로 사방 외곽선 → 띠는 «바깥 상자»에서 40/24 그대로
  await upd(page, 'gG', { cellBorderWidth: 4, blockOutline: 'all' });
  v = await view(page, 'gG');
  expect(near(d(v), { top: 40, right: 24, bottom: 40, left: 24 }), `외곽선 4px 보정 ${JSON.stringify(d(v))}`).toBe(true);
  await upd(page, 'gG', { blockOutline: 'none', cellBorderWidth: 0 });
  // 고정폭 400 → 배경도 400+48
  await upd(page, 'gG', { width: 400 });
  v = await view(page, 'gG');
  expect(Math.round(v.bg.r - v.bg.l)).toBe(Math.round((400 + 48) * v.z));
  // fullBleed → 펴진 상자 기준 · 섹션 밖은 잘린다(.section-inner overflow-x:clip)
  await upd(page, 'gG', { width: null, blockBg: { padX: 100 } });   // 여백을 섹션 패딩보다 크게 — 섹션 가장자리를 넘겨야 «잘림»을 잰다
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.fullBleed = 'true'; window.renderGridBlock(g); });
  v = await view(page, 'gG');
  const sec = await page.evaluate(() => { const r = document.getElementById('gS').getBoundingClientRect(); return { l: r.left, r: r.right }; });
  expect(v.bg.l, '펴진 상자보다 바깥').toBeLessThan(v.g.l);
  const my = (v.g.t + v.g.b) / 2;
  const [outL, inL] = await px(page, [[sec.l - 6, my], [sec.l + 2, my]]);
  expect(inL, '섹션 안쪽 끝까지 배경').toBe(BG);
  expect(outL, '섹션 밖은 잘린다').not.toBe(BG);
});

test('B3 ★칠하기 — 빈 띠 · 색 있는 프레임 «안» · 칸 배경(G4)·칸 테두리 위 · G19 자식 영역 덮음 · 텍스트 이웃 글자 위 · 위 프레임은 가린다(알고 넣는 대가)', async ({ page }) => {
  await setup(page);
  await upd(page, 'gG', { blockBg: { on: true, color: BG, padY: 40, padX: 40 } });
  await upd(page, 'gF', { blockBg: { on: true, color: BG, padY: 40, padX: 40 } });
  let v = await view(page, 'gG');
  const f = await view(page, 'gF');
  v = await view(page, 'gG');
  const my = (v.g.t + v.g.b) / 2;
  const P = await px(page, [[v.g.l - 20, my], [(v.g.l + v.g.r) / 2, v.g.t - 4], [v.nB.l + 20, v.nB.t + 15], [(v.g.l + v.g.r) / 2, v.nA.b - 10]]);
  expect(P[0], '빈 띠(섹션 패딩 안)').toBe(BG);
  expect(P[1], '위 이웃과의 gap').toBe(BG);
  expect(P[2], '아래 텍스트 이웃 글자는 배경 위(z 2)').toBe('#000000');
  expect(P[3], '★알고 넣는 대가 — 배경을 켜면 바로 위 프레임을 가릴 수 있다(겹친 자리)').toBe(BG);
  const fv = await view(page, 'gF');
  const [inFrame] = await px(page, [[fv.g.l - 20, (fv.g.t + fv.g.b) / 2]]);
  expect(inFrame, '★색 있는 프레임 «안»에서도 보인다(z-index:-1 만이면 #ffeeaa — 설계 실측 M1 S1)').toBe(BG);
  // G4 칸 배경 · 칸 테두리 · G19 자식
  await upd(page, 'gG', { patchCell: { r: 0, c: 0, bg: WHITE } });
  await upd(page, 'gG', { cellBorderWidth: 2, cellBorderColor: GREEN });
  await page.evaluate(() => window.addGridChild('gG', 'body'));
  await page.waitForTimeout(150);
  v = await view(page, 'gG');
  expect(v.kids, 'G19 자식 그릇이 생겼다(전제)').not.toBeNull();
  const Q = await px(page, [[v.c00.l + 20, v.c00.b - 6], [v.c01.l + 30, v.c01.b - 6], [v.c01.l + 30, v.c01.t + 1], [v.kids.r - 6, v.kids.t + 3], [(v.kids.l + v.kids.r) / 2, v.kids.t - 6]]);
  expect(Q[0], 'G4 칸 배경이 위').toBe(WHITE);
  expect(Q[1], '배경 없는 칸 = 그리드 배경').toBe(BG);
  expect(Q[2], '칸 테두리가 위').toBe(GREEN);
  expect(Q[3], '★G19 자식 영역도 덮는다').toBe(BG);
  expect(Q[4], '격자↔자식 간격 띠도 덮는다').toBe(BG);
  expect(v.bg.b - v.kids.b, '아래 띠는 마지막 자식 밑에서 여백만큼').toBeGreaterThanOrEqual(39.4);
});

test('B4 불투명도·이미지·위치 — 띠는 섞이고 칸은 안 번진다 · 이미지는 background-image 롱핸드 · 위치 9가지', async ({ page }) => {
  await setup(page);
  await upd(page, 'gG', { patchCell: { r: 0, c: 0, bg: WHITE } });
  await upd(page, 'gG', { blockBg: { on: true, color: BG, opacity: 50, padY: 40, padX: 40 } });
  const v = await view(page, 'gG');
  const [band, cell] = await px(page, [[v.g.l - 20, (v.g.t + v.g.b) / 2], [v.c00.l + 20, v.c00.b - 6]]);
  expect(band).toBe('#979eab');   // #2f3d57 50% over #ffffff
  expect(cell, '칸에 불투명도가 안 번진다').toBe(WHITE);
  const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  for (const pos of ['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom']) {
    const r = await upd(page, 'gG', { blockBg: { image: IMG, pos } });
    expect(r.ok, pos).toBe(true);
    const st = await page.evaluate(() => { const b = document.querySelector('#gG > .grd-bg'); return { img: b.style.backgroundImage, pos: getComputedStyle(b).backgroundPosition, attr: b.getAttribute('style') }; });
    expect(st.img).toContain('data:image/png');
    expect(st.attr, '⛔background 축약 금지 — HTML 내보내기는 background-image 롱핸드만 푼다').toMatch(/background-image:\s*url/);
    expect(st.attr).not.toMatch(/(^|;)\s*background\s*:/);
    expect(st.attr).not.toMatch(/(^|;)\s*inset\s*:/);
    const [x, y] = pos.split(' ');
    const pct = { left: '0%', center: '50%', right: '100%', top: '0%', bottom: '100%' };
    expect(st.pos).toBe(`${pct[x]} ${pct[y]}`);
  }
});

test('B8 ★저장 왕복 — serializeProject → 새로 띄운 앱에 applyProjectData 해도 같은 키·같은 띠', async ({ page }) => {
  await setup(page);
  await upd(page, 'gG', { blockBg: { on: true, color: BG, padY: 32, padX: 12, opacity: 80, pos: 'right bottom' } });
  const ds0 = await page.evaluate(() => Object.fromEntries(Object.entries(document.getElementById('gG').dataset).filter(([k]) => k.startsWith('blockBg'))));
  const r0 = await relRects(page, ['gG']);
  const st0 = await page.evaluate(() => document.querySelector('#gG > .grd-bg').getAttribute('style'));
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.evaluate(() => window.applyZoom?.(100));   // 새로 띄운 앱은 기본 줌(40%) — 사각형을 같은 줌에서 잰다
  await page.waitForTimeout(400);
  const ds1 = await page.evaluate(() => Object.fromEntries(Object.entries(document.getElementById('gG').dataset).filter(([k]) => k.startsWith('blockBg'))));
  expect(ds1).toEqual(ds0);
  expect(await page.evaluate(() => document.querySelector('#gG > .grd-bg')?.getAttribute('style'))).toBe(st0);
  expect(await page.evaluate(() => document.getElementById('gG').style.isolation)).toBe('isolate');
  expect((await relRects(page, ['gG'])).gG[3]).toBe(r0.gG[3]);
});

test('B10 고치는 문 계약 — applied 는 커밋 뒤 값 · 범위 밖·모르는 하위 키·잘못된 색/이미지는 INVALID · RENDER 롤백 명부에 일곱 키', async ({ page }) => {
  await setup(page);
  let r = await upd(page, 'gG', { blockBg: { on: true, padX: 50 } });
  expect(r.ok).toBe(true);
  expect(r.applied.blockBg).toEqual({ on: true, color: '#f5f5f5', img: '', pos: 'center center', opacity: 100, padY: 16, padX: 50 });
  expect(Object.keys(r.before).filter(k => k.startsWith('blockBg')).sort()).toEqual(['blockBgColor', 'blockBgImg', 'blockBgOn', 'blockBgOpacity', 'blockBgPadX', 'blockBgPadY', 'blockBgPos']);
  for (const bad of [{ padX: 101 }, { padY: -1 }, { opacity: 101 }, { color: 'red;x:1' }, { color: '#fff"' }, { image: 'http://x/a.png' }, { image: "data:image/png;base64,a'b" }, { pos: 'middle top' }, { on: 'yes' }, { fill: '#000' }]) {
    r = await updRaw(page, 'gG', { blockBg: bad });
    expect(r.ok, JSON.stringify(bad)).toBe(false);
    expect(r.code).toBe('INVALID');
  }
  r = await updRaw(page, 'gG', { blockBg: 'on' });
  expect(r.code).toBe('INVALID');
  // 이미지 상한 — 패널(trusted)만 면제
  const big = 'data:image/png;base64,' + 'A'.repeat(200001);
  expect((await updRaw(page, 'gG', { blockBg: { image: big } })).code).toBe('INVALID');
  expect((await upd(page, 'gG', { blockBg: { image: big } }, { trusted: true })).ok).toBe(true);
  // 만드는 문 — 틀린 값은 «말하고 버린다»
  const made = await page.evaluate(() => { const drops = []; const { block } = window.makeGridBlock({ blockBg: { on: true, padX: 999 } }, drops); return { keys: Object.keys(block.dataset).filter(k => k.startsWith('blockBg')), drops }; });
  expect(made.keys).toEqual([]);
  expect(made.drops.map(d => d.path)).toContain('blockBg');
  const made2 = await page.evaluate(() => { const { block } = window.makeGridBlock({ blockBg: { on: true, color: '#123456' } }); window.renderGridBlock(block); return { on: block.dataset.blockBgOn, layer: !!block.querySelector(':scope > .grd-bg') }; });
  expect(made2).toEqual({ on: '1', layer: true });
});

test('B6 ★G17 겹침 안 A — 배경을 켜면 외곽선은 «배경 바깥 가장자리»에 · 그리드 가장자리엔 선이 없다 · 불투명도가 선을 옅게 하지 않는다 · 끄면 원래 자리', async ({ page }) => {
  await setup(page);
  /* 아래 텍스트 이웃(z 2)은 띠 위로 칠해진다(B3 에서 잰 알고 넣는 대가) — 선 자리를 재려고 그 이웃을 걷는다. */
  await page.evaluate(() => { document.getElementById('rB').innerHTML = ''; });
  await upd(page, 'gG', { cellBorderWidth: 4, cellBorderColor: GREEN, blockOutline: 'all' });
  await upd(page, 'gG', { blockBg: { on: true, color: BG, padY: 40, padX: 40, opacity: 50 } });
  let v = await view(page, 'gG');
  const my = (v.g.t + v.g.b) / 2, mx = (v.g.l + v.g.r) / 2;
  /* 띠 = 그리드 바깥 상자에서 40 · 선(4px)은 그 띠의 «안쪽» 가장자리 4px(box-sizing:border-box) ⇒ 바깥 상자 −40…−36 의 가운데 −38 */
  const P = await px(page, [[v.g.l - 38, my], [v.g.r + 38, my], [mx, v.g.t - 38], [mx, v.g.b + 38], [v.g.l + 2, my], [v.g.l - 20, my]]);
  const [outside] = await px(page, [[v.g.l - 42, my]]);
  expect(outside, '선 바깥(띠 밖)은 배경도 선도 아니다').not.toBe(GREEN);
  expect(P.slice(0, 4), '★네 변의 선이 배경 바깥 가장자리에(진한 초록 그대로 — 불투명도 안 먹음)').toEqual([GREEN, GREEN, GREEN, GREEN]);
  expect(P[4], '그리드 가장자리엔 선이 없다(블럭 테두리는 투명)').not.toBe(GREEN);
  expect(P[5], '띠 안은 50% 배경').toBe('#979eab');
  const bc = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('gG')); return [c.borderTopWidth, c.borderTopColor]; });
  expect(bc, '두께는 남기고(칸 자리 불변) 색만 투명').toEqual(['4px', 'rgba(0, 0, 0, 0)']);
  // 위 변만 → 선 하나만
  await upd(page, 'gG', { blockOutline: 'top' });
  v = await view(page, 'gG');
  const Q = await px(page, [[(v.g.l + v.g.r) / 2, v.g.t - 38], [(v.g.l + v.g.r) / 2, v.g.b + 38]]);
  expect(Q[0]).toBe(GREEN);
  expect(Q[1], '끈 변엔 선이 없다').not.toBe(GREEN);
  // 배경 끄면 → G17 원래 자리(블럭 자기 테두리, 색 그대로)
  await upd(page, 'gG', { blockBg: { on: false } });
  const back = await page.evaluate(() => { const g = document.getElementById('gG'); const c = getComputedStyle(g); return { c: c.borderTopColor, w: c.borderTopWidth, edge: !!g.querySelector(':scope > .grd-edge') }; });
  expect(back).toEqual({ c: 'rgb(0, 255, 0)', w: '4px', edge: false });
});

/* ══ 패널 (C3) ══ */
async function selectGrid(page) {
  const [x, y] = await page.evaluate(() => { const g = document.getElementById('gG'); g.scrollIntoView({ block: 'center' }); const r = g.getBoundingClientRect(); return [r.left + 8, r.top + 8]; });
  await page.mouse.click(x, y); await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('gG').classList.contains('selected')), '전제 — 그리드가 골라졌다').toBe(true);
}
async function clickEl(page, sel) {
  const p = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  expect(p, `패널에 ${sel} 가 있다`).not.toBeNull();
  await page.mouse.click(p[0], p[1]); await page.waitForTimeout(300);
}
const rowsShown = (page) => page.evaluate(() => ['grd-bbg-color', 'grd-bbg-img-btn', 'grd-bbg-op-slider', 'grd-bbg-pady-slider', 'grd-bbg-padx-slider'].filter(id => document.getElementById(id)));

test('B1 ★토글(진짜 마우스) — 끄면 제목 한 줄뿐 · 켜면 줄이 «생긴다» · 다시 끄면 사라지고 블럭 바이트가 처음과 같다 · 라벨 「배경 여백」 안 잘림', async ({ page }) => {
  const errs = await setup(page);
  const snap = () => page.evaluate(() => { const g = document.getElementById('gG'); return { st: g.getAttribute('style'), html: g.innerHTML }; });
  await selectGrid(page);
  const a = await snap();
  const t0 = await page.evaluate(() => { const s = document.getElementById('grd-bbg-section'); return s && { title: s.querySelector('.prop-section-title').textContent.trim(), n: s.querySelectorAll('.prop-row, .prop-color-row').length,
    after: s.previousElementSibling?.querySelector('#grd-outline-group') ? 'outline' : null }; });
  expect(t0, '「블럭 배경」 절이 있다').not.toBeNull();
  expect(t0.title).toBe('블럭 배경');
  expect(t0.n, '끄면 아래 줄 0').toBe(0);
  expect(t0.after, '자리 = 「블럭 외곽선」 바로 아래').toBe('outline');
  expect(await rowsShown(page)).toEqual([]);
  await clickEl(page, '#grd-bbg-section .prop-toggle');
  expect(await page.evaluate(() => document.getElementById('gG').dataset.blockBgOn)).toBe('1');
  expect(await rowsShown(page), '켜면 줄들이 생긴다').toEqual(['grd-bbg-color', 'grd-bbg-img-btn', 'grd-bbg-op-slider', 'grd-bbg-pady-slider', 'grd-bbg-padx-slider']);
  expect(await page.evaluate(() => !!document.querySelector('#gG > .grd-bg'))).toBe(true);
  const lbl = await page.evaluate(() => { const l = [...document.querySelectorAll('#grd-bbg-section .prop-label')].find(e => e.textContent.trim() === '배경 여백'); return l && { sw: l.scrollWidth, cw: l.clientWidth }; });
  expect(lbl, '라벨 「배경 여백」').not.toBeNull();
  expect(lbl.sw, '라벨이 안 잘린다').toBeLessThanOrEqual(lbl.cw);
  const over = await page.evaluate(() => { const s = document.getElementById('grd-bbg-section'); const body = s.closest('#panel-right') || document.body; const br = body.getBoundingClientRect();
    return [...s.querySelectorAll('input,button')].filter(e => e.offsetParent && e.getBoundingClientRect().right > br.right + 0.5).map(e => e.id); });
  expect(over, '패널 오른쪽 밖으로 나가는 칸이 없다').toEqual([]);
  await clickEl(page, '#grd-bbg-section .prop-toggle');
  expect(await rowsShown(page), '끄면 줄이 사라진다').toEqual([]);
  expect(await snap(), '끄면 블럭 바이트가 켜기 전과 같다').toEqual(a);
  expect(errs).toEqual([]);
});

test('B5 위치 단추 — ALIGN_ICONS(object-h/object-v) 그림 그대로 · data-align 없음 · 누르면 그 자리 · 칸 선택 상태에선 절이 없다', async ({ page }) => {
  await setup(page);
  const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  await upd(page, 'gG', { blockBg: { on: true, image: IMG } });
  await selectGrid(page);
  const icons = await page.evaluate(async () => {
    const { ALIGN_ICONS } = await import('/js/props/_helpers.js');
    const svg = (sel) => [...document.querySelectorAll(sel)].map(b => b.querySelector('svg').outerHTML);
    const norm = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild.outerHTML; };
    return { x: svg('#grd-bbg-pos-x button'), y: svg('#grd-bbg-pos-y button'),
      ex: ['left', 'center', 'right'].map(k => norm(ALIGN_ICONS['object-h'][k])), ey: ['top', 'middle', 'bottom'].map(k => norm(ALIGN_ICONS['object-v'][k])),
      dataAlign: document.querySelectorAll('#grd-bbg-section [data-align]').length };
  });
  expect(icons.x).toEqual(icons.ex);
  expect(icons.y).toEqual(icons.ey);
  expect(icons.dataAlign, '⛔data-align 이 붙으면 텍스트 정렬 배선이 잡는다').toBe(0);
  await clickEl(page, '#grd-bbg-pos-x [data-bbg-x="right"]');
  await clickEl(page, '#grd-bbg-pos-y [data-bbg-y="bottom"]');
  expect(await page.evaluate(() => document.getElementById('gG').dataset.blockBgPos)).toBe('right bottom');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#gG > .grd-bg')).backgroundPosition)).toBe('100% 100%');
  expect(await page.evaluate(() => document.querySelector('#grd-bbg-pos-x .active')?.dataset.bbgX)).toBe('right');
  // 칸 선택 상태(두 번째 클릭 = 칸) — 절이 없다(G2 골든 장면)
  const [x, y] = await page.evaluate(() => { const c = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-line'); const r = c.getBoundingClientRect(); return [r.left + 4, r.top + r.height / 2]; });
  await page.mouse.click(x, y); await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ cell: !!document.querySelector('#panel-right .prop-section-title')?.textContent, sec: !!document.getElementById('grd-bbg-section') }));
  expect(st.sec, '칸/줄을 고르면 블럭 배경 절이 없다').toBe(false);
});

test('B7 ★⌘Z 한 걸음 — 토글 · 위치 단추 · 여백 슬라이더 끌기 각각 하나씩 되돌린다', async ({ page }) => {
  await setup(page); await selectGrid(page);
  const ds = () => page.evaluate(() => { const d = document.getElementById('gG').dataset; return { on: d.blockBgOn ?? null, padX: d.blockBgPadX ?? null }; });
  await clickEl(page, '#grd-bbg-section .prop-toggle');
  expect(await ds()).toEqual({ on: '1', padX: null });
  // 좌우 슬라이더를 진짜 마우스로 끈다
  const s = await page.evaluate(() => { const e = document.getElementById('grd-bbg-padx-slider'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, y: r.top + r.height / 2 }; });
  await page.mouse.move(s.l + 2, s.y); await page.mouse.down(); await page.mouse.move(s.l + (s.r - s.l) * 0.5, s.y, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(250);
  const mid = await ds();
  expect(mid.on).toBe('1');
  expect(Number(mid.padX), '끈 값').toBeGreaterThan(30);
  const bgW = await page.evaluate(() => document.querySelector('#gG > .grd-bg').getBoundingClientRect().width - document.getElementById('gG').getBoundingClientRect().width);
  expect(Math.round(bgW / 2), '띠가 슬라이더 값을 따라간다(재렌더 없이 층만)').toBe(Number(mid.padX));
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await ds(), '⌘Z 1번 = 슬라이더만 되돌린다').toEqual({ on: '1', padX: null });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await ds(), '⌘Z 2번 = 토글 전').toEqual({ on: null, padX: null });
  expect(await page.evaluate(() => !!document.querySelector('#gG > .grd-bg'))).toBe(false);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(300);
  expect((await ds()).on).toBe('1');
});

/* ══ 내보내기 (C4) ══ */
test('B9 ★내보내기 — PNG 클론에 띠가 «픽셀로» 찍힌다 · 단독 HTML 에서도 띠가 그리드 밖으로 여백만큼 선다', async ({ page }) => {
  await setup(page);
  await upd(page, 'gG', { blockBg: { on: true, color: RED, padY: 30, padX: 30 } });
  await page.evaluate(() => window.deselectAll?.());
  const p = await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    const clone = await ex.prepareCloneForCapture(document.getElementById('gS'), 860, true);
    ex.renderComponentsInClone(clone);
    clone.id = '__clone'; clone.style.position = 'fixed'; clone.style.zIndex = '2147483647'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
    const G = clone.querySelector('#gG') || clone.querySelectorAll('.grid-block')[0]; const r = G.getBoundingClientRect(); const cr = clone.getBoundingClientRect();
    return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height, cw: cr.width };
  });
  await page.evaluate(() => document.getElementById('proj-loading-overlay')?.remove());
  const shot = await page.locator('#__clone').screenshot({ type: 'png' });
  const res = await page.evaluate(async ([b64, p]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0); const sx = img.width / p.cw;
    const isRed = (x, y) => { const d = ctx.getImageData(Math.round(x * sx), Math.round(y * sx), 1, 1).data; return d[0] > 200 && d[1] < 80 && d[2] < 80; };
    return { left: isRed(p.x - 15, p.y + p.h / 2), top: isRed(p.x + p.w / 2, p.y - 15), farLeft: isRed(p.x - 40, p.y + p.h / 2) };
  }, [shot.toString('base64'), p]);
  await page.evaluate(() => document.getElementById('__clone')?.remove());
  expect(res.left, 'PNG — 왼쪽 띠').toBe(true);
  expect(res.top, 'PNG — 위 띠').toBe(true);
  expect(res.farLeft, 'PNG — 여백 밖은 아니다(대조)').toBe(false);
  const html = await page.evaluate(async () => {
    let out = null;
    const oc = URL.createObjectURL; URL.createObjectURL = (b) => { out = b; return 'blob:none'; };
    const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck; }
    return out ? await out.text() : null;
  });
  expect(html, 'HTML 산출물을 못 받았다').toBeTruthy();
  const page2 = await page.context().newPage();
  await page2.setContent(html);
  const h2 = await page2.evaluate(() => { const G = document.getElementById('gG'); const B = G && G.querySelector(':scope > .grd-bg'); if (!B) return null;
    const g = G.getBoundingClientRect(), b = B.getBoundingClientRect(); return { pos: getComputedStyle(G).position, color: getComputedStyle(B).backgroundColor, dl: g.left - b.left, dt: g.top - b.top, zoom: g.width / G.offsetWidth }; });
  await page2.close();
  expect(h2, '단독 HTML 에 배경 층이 있다').not.toBeNull();
  expect(h2.pos, '그리드가 기준 상자다(.grid-block{position:relative} 이 실려 나갔다)').toBe('relative');
  expect(h2.color).toBe('rgb(255, 0, 0)');
  expect(Math.round(h2.dl / h2.zoom)).toBe(30);
  expect(Math.round(h2.dt / h2.zoom)).toBe(30);
});

test('B11 피그마 JSON — 켜면 blockBg 가 실린다(높이 = G19 자식 포함 상자) · 끄면 키가 없다 · 외곽선은 배경 가장자리 선 값 · ⚠️렌더러는 미구현', async ({ page }) => {
  await setup(page);
  const find = (j) => { let hit = null; JSON.stringify(j, (k, v) => { if (v && v.id === 'gG') hit = v; return v; }); return hit; };
  const get = () => page.evaluate(() => (window.flushCurrentPage(), window.buildFigmaExportJSON(null)));
  const off = find(await get());
  expect(off, '그리드가 피그마 JSON 에 있다').not.toBeNull();
  expect('blockBg' in off).toBe(false);
  await upd(page, 'gG', { blockBg: { on: true, color: BG, padY: 20, padX: 10, opacity: 60 } });
  await upd(page, 'gG', { blockOutline: 'top', cellBorderWidth: 2, cellBorderColor: GREEN });
  await page.evaluate(() => window.addGridChild('gG', 'body'));
  const on = find(await get());
  const liveH = await page.evaluate(() => document.getElementById('gG').offsetHeight);
  expect(on.blockBg).toEqual({ color: BG, opacity: 60, padX: 10, padY: 20, pos: 'center center', hasImage: false, height: liveH });
  expect(on.border.top, '선 값은 배경 가장자리 층에서(투명 아님)').toEqual({ width: 2, style: 'solid', color: 'rgb(0, 255, 0)' });
  expect(on.borderAt).toBe('bg-edge');
  expect('bg' in on && on.bg, '⛔GENERIC bg(상자 크기 칠)는 안 쓴다').toBeFalsy();
  await upd(page, 'gG', { blockBg: { on: false } });
  const off2 = find(await get());
  expect('blockBg' in off2).toBe(false);
  expect(off2.borderAt).toBeUndefined();
});

/* ══ 글자 톤 (C5 · 지디 GO 필수) ══ */
test('B12 ★글자 톤 — 어두운 배경(L<0.179)을 켜면 ⒜ 칸 글자 ⒝ G19 자식 글자 판정이 둘 다 light · 밝게 끌면 되돌아온다 · 이미지면 판정 보류', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.addGridChild('gG', 'body'); window.addGridChild('gG', 'h2'); });
  /* 둘째 자식(h2)엔 사용자가 직접 색을 준다 — 자동 톤이 «안» 건드려야 한다. */
  await page.evaluate(() => { const k = document.querySelectorAll('#gG > .grd-children .text-block')[1]; const h = k.querySelector('[class^="tb-"]'); h.textContent = 'H'; h.style.color = 'rgb(18, 52, 86)'; });
  const st = () => page.evaluate(() => {
    const g = document.getElementById('gG'); const line = g.querySelector('.grd-inner .grd-line'); const kids = g.querySelectorAll(':scope > .grd-children .text-block');
    const host = kids[0] && kids[0].querySelector('[class^="tb-"]'); const host2 = kids[1] && kids[1].querySelector('[class^="tb-"]');
    if (host && !host.textContent) host.textContent = '본문';
    const lum = (c) => { const m = c.match(/\d+/g).map(Number); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    return { blockTone: g.dataset.textTone || null, cellLum: Math.round(lum(getComputedStyle(line).color)), kidTone: window.__gdTextTone.textToneAt(host),
      kidLum: Math.round(lum(getComputedStyle(host).color)), kid2Color: getComputedStyle(host2).color };
  });
  const a = await st();
  expect(a.blockTone, '전제 — 흰 섹션 위 = 어두운 글자').toBeNull();
  expect(a.cellLum).toBeLessThan(128);
  expect(a.kidTone).toBe('dark');
  expect(a.kidLum, '전제 — G19 자식 글자(색 지정 없음)는 어둡다').toBeLessThan(128);
  await upd(page, 'gG', { blockBg: { on: true, color: '#1f2a3d' } });   // L ≈ 0.022 < 0.179
  const b = await st();
  expect(b.blockTone, '⒜ 그리드 톤 표식').toBe('light');
  expect(b.cellLum, '⒜ 칸 글자가 밝아진다').toBeGreaterThan(180);
  expect(b.kidTone, '⒝ G19 자식 글자 판정이 light').toBe('light');
  expect(b.kidLum, '★⒝ G19 자식 글자의 «계산된 색»이 실제로 밝아진다').toBeGreaterThan(180);
  expect(b.kid2Color, '사용자가 직접 준 글자색은 그대로').toBe('rgb(18, 52, 86)');
  // 끄는 동안(슬라이더·색 = applyGridBlockBg 길)에도 톤이 따라온다
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.blockBgColor = '#f5f5f5'; window.applyGridBlockBg(g); });
  const c = await st();
  expect(c.blockTone, '밝게 바꾸면 톤 표식이 걷힌다').toBeNull();
  expect(c.cellLum).toBeLessThan(128);
  expect(c.kidTone).toBe('dark');
  expect(c.kidLum, '밝은 배경이면 자식 글자도 원래 어두운 색').toBeLessThan(128);
  // 투명도 — 어두운 색이라도 10% 면 밝은 바탕
  await upd(page, 'gG', { blockBg: { color: '#1f2a3d', opacity: 10 } });
  expect((await st()).blockTone, '10% 어두운 색 위 = 밝은 바탕').toBeNull();
  // 이미지 = 못 잼(null) → 역할색 그대로
  const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  await upd(page, 'gG', { blockBg: { opacity: 100, image: IMG } });
  const d = await st();
  expect(d.kidTone, '이미지 배경 = 판정 보류(null)').toBeNull();
  expect(d.blockTone).toBeNull();
});

test('B13 ★G19 자식 밝은 글자 — 저장 데이터에 안 실린다(저장→로드해도 렌더가 다시 정한다) · 배경 끈 문서·어두운 섹션은 안 바뀐다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.addGridChild('gG', 'body'); const h = document.querySelector('#gG > .grd-children .text-block [class^="tb-"]'); h.textContent = '본문'; });
  const kidColor = () => page.evaluate(() => getComputedStyle(document.querySelector('#gG > .grd-children .text-block [class^="tb-"]')).color);
  const kidHtml = () => page.evaluate(() => document.querySelector('#gG > .grd-children').innerHTML);
  const off = { color: await kidColor(), html: await kidHtml() };
  // 어두운 «섹션» + 배경 끔 → 자식 글자 안 바뀐다(섹션 전체 자동 글자색은 범위 밖)
  await page.evaluate(() => { const s = document.getElementById('gS'); s.style.background = '#111111'; s.dataset.bg = '#111111'; window.renderGridBlock(document.getElementById('gG')); });
  expect(await kidColor(), '배경 끈 그리드 = 어두운 섹션이어도 자식 글자 그대로').toBe(off.color);
  await page.evaluate(() => { const s = document.getElementById('gS'); s.style.background = ''; delete s.dataset.bg; window.renderGridBlock(document.getElementById('gG')); });
  await upd(page, 'gG', { blockBg: { on: true, color: '#1f2a3d' } });
  const onColor = await kidColor();
  expect(onColor).not.toBe(off.color);
  expect(await kidHtml(), '★자식 블럭 DOM(=저장 데이터)은 한 바이트도 안 바뀐다 — 색은 CSS 변수로만').toBe(off.html);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(400);
  expect(await kidColor(), '로드 뒤에도 렌더가 다시 밝게').toBe(onColor);
  expect(/f2f2f2|242,\s*242,\s*242/i.test(await kidHtml()), '★저장→로드한 자식 DOM 에 밝은 글자색이 «박혀» 있지 않다 — 렌더(CSS 변수)에서 온다').toBe(false);
  await upd(page, 'gG', { blockBg: { on: false } });
  expect(await kidColor(), '끄면 원래 색').toBe(off.color);
});

/* ══ E55 겹침 측정(지디 조건) — G19 자식/그리드 Delete 가 배경 켬에서 «더 나빠지거나 달라지나». ⛔E55 자체는 고치지 않는다(별 레인). ══ */
test('B14 ★Delete 측정 — 배경 끔/켬 표 · ⒜ 자식 선택 Delete · ⒝ 그리드 선택 Delete = 그리드+배경+자식 함께 · ⒟ ⌘Z 한 걸음 · ⒠ 선택 목록 기록', async ({ page }) => {
  const rows = {};
  for (const mode of ['off', 'on']) {
    await setup(page);
    await page.evaluate(() => { window.addGridChild('gG', 'body'); const h = document.querySelector('#gG > .grd-children .text-block [class^="tb-"]'); h.textContent = '자식 글자'; h.id = h.id || 'kidH'; window.deselectAll?.(); });
    if (mode === 'on') await upd(page, 'gG', { blockBg: { on: true, color: BG, padY: 30, padX: 30 } });
    const state = () => page.evaluate(() => {
      const g = document.getElementById('gG');
      return { grid: !!g, bg: !!(g && g.querySelector(':scope > .grd-bg')), orphanBg: document.querySelectorAll('#canvas .grd-bg').length - (g && g.querySelector(':scope > .grd-bg') ? 1 : 0),
        kids: g ? g.querySelectorAll(':scope > .grd-children .text-block').length : 0,
        selected: [...document.querySelectorAll('#canvas .selected')].map(e => e.id || e.className.split(' ')[0]),
        editing: !!(document.activeElement && document.activeElement.isContentEditable) };
    });
    const r = { start: await state() };
    // ⒜ 자식 선택 → Delete
    const kp = await page.evaluate(() => { const k = document.querySelector('#gG > .grd-children .text-block'); k.scrollIntoView({ block: 'center' }); const q = k.getBoundingClientRect(); return [q.left + 10, q.top + q.height / 2]; });
    await page.mouse.click(kp[0], kp[1]); await page.waitForTimeout(300);
    r.a_selected = await state();
    await page.keyboard.press('Delete'); await page.waitForTimeout(300);
    r.a_afterDelete = await state();
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(400);
    r.a_afterUndo = await state();
    // ⒝ 그리드 선택 → Delete
    await page.evaluate(() => window.deselectAll?.());
    const gp = await page.evaluate(() => { const g = document.getElementById('gG'); if (!g) return null; g.scrollIntoView({ block: 'center' }); const q = g.getBoundingClientRect(); return [q.left + 8, q.top + 8]; });
    if (gp) {
      await page.mouse.click(gp[0], gp[1]); await page.waitForTimeout(300);
      r.b_selected = await state();
      await page.keyboard.press('Delete'); await page.waitForTimeout(300);
      r.b_afterDelete = await state();
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.keyboard.press('Meta+z'); await page.waitForTimeout(400);
      r.b_afterUndo = await state();
    }
    rows[mode] = r;
  }
  const fmt = (s) => s ? `grid=${s.grid ? 1 : 0} bg=${s.bg ? 1 : 0} orphanBg=${s.orphanBg} kids=${s.kids} sel=[${s.selected.join(',')}] edit=${s.editing ? 1 : 0}` : '—';
  for (const k of ['start', 'a_selected', 'a_afterDelete', 'a_afterUndo', 'b_selected', 'b_afterDelete', 'b_afterUndo'])
    console.log(`[B14] ${k.padEnd(13)} | off: ${fmt(rows.off[k])} | on: ${fmt(rows.on[k])}`);
  /* 자식 블럭 id 는 판마다 새로 뽑힌다(tb_…) — 「무엇이 골라졌나」만 비교하게 이름을 접는다. */
  const strip = (s) => s && ({ grid: s.grid, kids: s.kids, selected: s.selected.map(x => /^tb_/.test(x) ? 'KID' : x), editing: s.editing });
  for (const k of ['a_selected', 'a_afterDelete', 'a_afterUndo', 'b_selected', 'b_afterDelete', 'b_afterUndo'])
    expect(strip(rows.on[k]), `★G12 가 «${k}» 를 바꾸지 않는다(배경 끔과 같은 결과 — E55 는 그대로 별 레인)`).toEqual(strip(rows.off[k]));
  expect(rows.on.b_afterDelete.grid, '⒝ 그리드 선택 Delete = 그리드가 사라진다').toBe(false);
  expect(rows.on.b_afterDelete.orphanBg, '⒝ 배경 층이 고아로 남지 않는다').toBe(0);
  expect(rows.on.b_afterUndo, '⒟ ⌘Z 한 걸음 = 그리드·배경·자식이 함께 돌아온다').toMatchObject({ grid: true, bg: true, kids: 1, orphanBg: 0 });
});

test('B6n ★알고 넣는 대가(기록) — 아래 이웃이 있으면 «배경 여백이 아래 블럭과 겹치면 그 블럭이 바깥 선을 덮는다»(이웃을 안 걷고 잰다)', async ({ page }) => {
  await setup(page);   // 아래 이웃 = 텍스트블럭 ███(z 2), 그리드와 간격 8
  await upd(page, 'gG', { cellBorderWidth: 4, cellBorderColor: GREEN, blockOutline: 'all' });
  await upd(page, 'gG', { blockBg: { on: true, color: BG, padY: 40, padX: 40 } });
  const v = await view(page, 'gG');
  const mx = (v.g.l + v.g.r) / 2;
  const [top, bottom, nbGlyph] = await px(page, [[mx, v.g.t - 38], [v.nB.l + 20, v.g.b + 38], [v.nB.l + 20, v.nB.t + 15]]);
  console.log(`[B6n] 위 선 = ${top} · 아래 선 자리(이웃 글자 위 x=${Math.round(v.nB.l + 20)}, y=g.b+38) = ${bottom} · 이웃 글자 = ${nbGlyph} · 이웃 윗변 = g.b+${Math.round(v.nB.t - v.g.b)}`);
  expect(top, '위 선은 보인다(위 이웃은 프레임 — 그리드가 덮는다)').toBe(GREEN);
  expect(v.nB.t - v.g.b, '전제 — 아래 이웃이 띠 안으로 들어와 있다(간격 8 < 여백 40)').toBeLessThan(40);
  expect(bottom, '★아래 텍스트 이웃(z 2)이 그 자리의 바깥 선을 덮는다').toBe('#000000');
  expect(nbGlyph, '이웃 글자는 배경 위(가려지지 않는다)').toBe('#000000');
});
