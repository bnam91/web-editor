/* ★기대 바뀜(현빈 261123 ①②③ · 태양 §2c check) — 바뀐 칸의 토글 스위치(label.prop-toggle · .prop-toggle-track) → check 부품(label.ui-check · input.ui-check-box) */
/* liner-arc — LINETEXT-ARC-RESEARCH-01(현빈 261121 발주2 #4 · 비교표 handoff/LINER-ARC-COMPARE-261121.md): 라이너 빈 곳 4 + 끝 글자 잘림
 * 고침: js/liner-transform.js — 반지름 px(arc-up/down 이 그 원 위에 글 길이만큼 · 반원 넘는 호) · 원 안쪽 뒤집기 · 외곽선(stroke · paint-order) · 가로 지킴이
 * R1 패널 «반지름» 82 → dataset radius 82 · 글이 원을 216°±12 돈다(피그마 ARC Bend 60 과 같은 «글 기준» 휨) · 글자 상자 안(잘림 0)
 * R2 [지킴] 새 칸 안 쓴 기본 라이너 = dataset 4칸 그대로 · 옛 경로 꼴(P=12 · 소호 A)
 * R3 좁은 폭(221)+곡률 100 → 글자가 상자 0..W 안(옛 판 = −15 넘침 · 비교표 2행)
 * R4 원형 «안쪽 뒤집기» 진짜 클릭 → 경로 sweep 0 · 저장 표본 → 다시 열기(ensureLiner) 뒤 radius·flip·외곽선 그대로 · undo 1번 = 뒤집기 전
 * R5 외곽선 — 패널 두께 2 · 색 → text stroke·paint-order · PNG 에 빨강 · Figma JSON 라이너 svg 에 stroke
 * R6 «둥글게(글 기준)» 프리셋 진짜 고르기 → 반지름 칸 비어도 글이 원을 120°±8 돈다 · 글을 늘리면 휨이 그대로(반지름이 글을 따라감) · 반지름을 넣으면 그 값
 * R7 아치(위로)를 «처음» 고를 때(반지름 빔) 반지름 칸이 글 길이로 채워짐(글 ≈120°) · 이미 넣은 반지름은 안 바뀜
 * R8 [미카사 채점 261121 ④ · 안B] 아치 반지름 49 + «안쪽 뒤집기» — 이웃 글자 «윗변» 겹침 길이 합(글자별 실제 자리·회전으로 셈) 고치기 전/후 수 · png(SHOT_LINER=경로)
 *    · 둥글게 프리셋이면 반지름 칸 아래 «글 길이 기준» 안내 한 줄 · 아치면 숨김
 * R9 [미카사 재채점 261122 (가)(나)(다)] «곡선 텍스트» 둥글게 + 뒤집기 · 반지름 27→49 — 돈 각이 반지름을 따름(뒤집기 끈 때와 같음) · 윗변 겹침 0 · 안내 «지금 N° · 반원 · 한 바퀴» 수
 * 양성대조(261122): _patches/liner-flip-spacing-CTL.patch(뒤집기 자간 보탬 걷음) → R8 빨강(79px) · R9 빨강(144°→101° · 겹침 38px).
 * 양성대조: _patches/liner-arc-CTL.patch(반지름 모드·가로 지킴이·외곽선 끔 · 뒤집기 무시) → R1·R3·R4·R5 빨강 · R2 초록 · (실측) liner-flip-push-CTL(뒤집기 밀어내기 걷음) → R8 빨강(겹침 110.4px · 고친 판 78.3px).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
/* captureTruth(PNG 길)는 electronAPI.captureSectionCdp 로 찍는다 — 하네스 electronAPI 는 «모든 키가 함수»인 Proxy 라 그대로 두면 null → base64,null → ci.onerror(Event).
   CDP Page.captureScreenshot 으로 갈아 끼운다(slide-frame-cells wireCdp 꼴 · 지디 Electron 전수 261122 «page.evaluate: Event» 11건 = 이 배선 빠짐). */
async function wireCdp(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real?.[k]) }); });
}

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function scene(page, preset, wpx) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page); await wireCdp(page);
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

test('R6 둥글게 — 글 기준 120° · 글을 따라감 · 넣은 반지름 우선', async ({ page }) => {
  const errs = await scene(page, 'arc-up');
  await openPanel(page);
  await page.selectOption('#lnr-preset', 'round'); await raf(page);
  const a = await geo(page);
  expect([a.ds.preset, a.ds.radius ?? null, Math.abs(a.turn - 120) <= 8, inside(a)], `★둥글게 ${a.turn.toFixed(1)}°`).toEqual(['round', null, true, true]);
  await page.evaluate(() => { const b = document.getElementById('lnL'), m = b.querySelector('.tb-liner'); m.textContent = 'GODITOR ARC TEXT 123 GODITOR ARC'; window.applyLinerText?.(b); window.applyLiner(b); }); await raf(page);
  const b = await geo(page);
  expect(Math.abs(b.turn - 120) <= 8, `★글이 길어져도 120° ${b.turn.toFixed(1)}°`).toBe(true);
  await page.fill('#lnr-radius', '60'); await page.press('#lnr-radius', 'Enter'); await raf(page);
  const c = await geo(page);
  expect([c.ds.radius, c.turn > 200], `★넣은 반지름 60 우선 ${c.turn.toFixed(1)}°`).toEqual([60, true]);
  expect(errs).toEqual([]);
});

test('R7 아치를 처음 고르면 반지름 채움 · 넣은 값은 그대로', async ({ page }) => {
  const errs = await scene(page, 'circle');
  await openPanel(page);
  await page.selectOption('#lnr-preset', 'arc-up'); await raf(page);
  const a = await geo(page), rv = await page.inputValue('#lnr-radius');
  expect([Number(rv) > 0, a.ds.radius === Number(rv), Math.abs(a.turn - 120) <= 10], `★채움 ${rv} · ${a.turn.toFixed(1)}°`).toEqual([true, true, true]);
  await page.fill('#lnr-radius', '200'); await page.press('#lnr-radius', 'Enter');
  await page.selectOption('#lnr-preset', 'arc-down'); await raf(page);
  expect((await geo(page)).ds.radius, '★넣은 200 그대로').toBe(200);
  expect(errs).toEqual([]);
});

/* 이웃 글자 윗변 겹침(px 합) — 글자 i 의 시작·끝 자리(textPath 위 실제 자리) + 회전으로 윗변(글자 위쪽 = 진행 방향의 왼쪽 법선 · 높이 = 글자 크기 × 0.72)을 세우고
   i 윗변 끝이 i+1 윗변 시작을 진행 방향으로 넘어간 길이를 더한다(겹침 = 글자 머리가 서로 먹힘) */
const topOverlap = (page) => page.evaluate(() => {
  const te = document.querySelector('#lnL svg.lnr-svg text'), fs = parseFloat(te.getAttribute('font-size')) || 16, a = fs * 0.72, n = te.getNumberOfChars();
  /* 글자 폭 = 같은 글꼴의 canvas measureText(자간 뺀 «잉크 폭») — getEndPositionOfChar 는 자간까지 더해 뒤집기 자간 보탬을 겹침으로 셌다(261122 실측) */
  const cx = document.createElement('canvas').getContext('2d'); cx.font = `${te.getAttribute('font-style') || 'normal'} ${te.getAttribute('font-weight') || 400} ${fs}px ${te.getAttribute('font-family')}`; const txt = te.textContent;
  const g = []; for (let i = 0; i < n; i++) { const s0 = te.getStartPositionOfChar(i), w = cx.measureText(txt[i]).width, r = te.getRotationOfChar(i) * Math.PI / 180; const d = [Math.cos(r), Math.sin(r)], up = [Math.sin(r), -Math.cos(r)]; g.push({ ts: [s0.x + up[0] * a, s0.y + up[1] * a], te: [s0.x + d[0] * w + up[0] * a, s0.y + d[1] * w + up[1] * a], d }); }
  let sum = 0; for (let i = 0; i + 1 < n; i++) { const o = (g[i].te[0] - g[i + 1].ts[0]) * g[i].d[0] + (g[i].te[1] - g[i + 1].ts[1]) * g[i].d[1]; if (o > 0) sum += o; }
  return { sum: +sum.toFixed(1), fs: +fs.toFixed(1), n };
});
test('R8 아치 반지름 49 + 안쪽 뒤집기 — 윗변 겹침 수 · 안내 한 줄', async ({ page }) => {
  const errs = await scene(page, 'arc-up');
  await openPanel(page);
  await page.fill('#lnr-radius', '49'); await page.press('#lnr-radius', 'Enter'); await raf(page);
  const plain = await topOverlap(page);
  await page.click('#lnr-flip-row .ui-check'); await raf(page);
  expect(await page.evaluate(() => JSON.parse(document.getElementById('lnL').dataset.liner).flip), '[전제] 뒤집기 켜짐').toBe(true);
  const flip = await topOverlap(page);
  if (process.env.SHOT_LINER) await page.locator('#lnL').screenshot({ path: process.env.SHOT_LINER });
  console.log(`[R8 겹침 수] 반지름 49 · 글자 ${flip.fs}px · 윗변 겹침 합 — 바로 ${plain.sum}px · 뒤집기 ${flip.sum}px (글자 ${flip.n})`);
  expect(flip.sum <= 5, `★뒤집기 윗변 겹침 ${flip.sum}px(바로 ${plain.sum}px)`).toBe(true);   // ★기대 바뀜(미카사 재채점 261122 (나)): 95 → 5 — 뒤집기 자간 보탬으로 0.1px(CTL liner-flip-spacing 79px · 겹침 셈은 잉크 폭 기준으로 고침)
  expect(await page.evaluate(() => { const h = document.getElementById('lnr-radius-hint'); return [h?.hidden, h?.querySelector('.lnr-hint-auto')?.hidden, /반원/.test(h?.textContent || '')]; }), '아치(반지름 모드) = 반원·한 바퀴 수만 · «비우면 글 길이 기준» 숨김').toEqual([false, true, true]);   // ★기대 바뀜(미카사 재채점 261122 (가)): 반지름 칸 안내에 «반원/한 바퀴» 수 — 반지름 모드 아치에도 뜬다 · 둥글게 전용 문장은 여전히 숨김
  await page.selectOption('#lnr-preset', 'round'); await raf(page);
  await expect(page.locator('#lnr-radius-hint'), '둥글게 = «글 길이 기준» 안내').toBeVisible();
  await expect(page.locator('#lnr-radius-hint')).toContainText('글 길이 기준');
  expect(errs).toEqual([]);
});

test('R9 뒤집기 + 반지름 27→49 — 꼴이 반지름을 따른다 · 윗변 안 맞닿음 · 안내에 «반원/한 바퀴» 수', async ({ page }) => {
  const errs = await scene(page, 'round');
  await page.evaluate(() => { const blk = document.getElementById('lnL'); blk.querySelector('.tb-liner').textContent = '곡선 텍스트'; window.applyLinerText?.(blk); window.applyLiner(blk); });
  await openPanel(page);
  const setR = async (r) => { await page.fill('#lnr-radius', String(r)); await page.press('#lnr-radius', 'Enter'); await raf(page); };
  const hint = () => page.evaluate(() => { const h = document.getElementById('lnr-radius-hint'); return h && !h.hidden ? h.textContent.trim() : null; });
  await setR(27); const p27 = await geo(page);
  await page.click('#lnr-flip-row .ui-check'); await raf(page);
  expect(await page.evaluate(() => JSON.parse(document.getElementById('lnL').dataset.liner).flip), '[전제] 뒤집기 켜짐').toBe(true);
  const f27 = await geo(page), o27 = await topOverlap(page), h27 = await hint();
  if (process.env.SHOT_LINER) await page.locator('#lnL').screenshot({ path: process.env.SHOT_LINER.replace(/\.png$/, '-r27.png') });
  await setR(49); const f49 = await geo(page), o49 = await topOverlap(page), h49 = await hint();
  if (process.env.SHOT_LINER) await page.locator('#lnL').screenshot({ path: process.env.SHOT_LINER.replace(/\.png$/, '-r49.png') });
  await page.click('#lnr-flip-row .ui-check'); await raf(page); const p49 = await geo(page);
  const t = (g) => +g.turn.toFixed(1);
  console.log(`[R9 실측] 돈 각 — 바로 r27 ${t(p27)}° · 뒤집기 r27 ${t(f27)}° · 뒤집기 r49 ${t(f49)}° · 바로 r49 ${t(p49)}° · 윗변 겹침 r27 ${o27.sum}px · r49 ${o49.sum}px · 안내 «${h27}» → «${h49}»`);
  expect(f27.turn / f49.turn > 1.5, `★(다) 뒤집기에서 반지름 27→49 가 꼴을 바꾼다(49/27=1.81) ${t(f27)}° → ${t(f49)}°`).toBe(true);
  expect(Math.abs(f27.turn / p27.turn - 1) < 0.15 && Math.abs(f49.turn / p49.turn - 1) < 0.15, `★뒤집기는 돈 각을 안 바꾼다(안쪽만 향함) r27 ${t(p27)}→${t(f27)} · r49 ${t(p49)}→${t(f49)}`).toBe(true);
  expect(o27.sum <= 2 && o49.sum <= 2, `★(나) 뒤집기 윗변 안 맞닿음 r27 ${o27.sum}px · r49 ${o49.sum}px`).toBe(true);
  expect(!!h27 && /반원/.test(h27) && /한 바퀴/.test(h27) && h27 !== h49, `★(가) 안내에 반원·한 바퀴 수 · 반지름 따라 바뀜 «${h27}» «${h49}»`).toBe(true);
  expect(errs).toEqual([]);
});
