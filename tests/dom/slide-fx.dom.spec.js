/* ★기대 바뀜(현빈 261123 ①②③ · 태양 §2c check) — 바뀐 칸의 토글 스위치(label.prop-toggle · .prop-toggle-track) → check 부품(label.ui-check · input.ui-check-box) */
/* slide-fx — 슬라이드 효과 묶음(현빈 «너가 판단» 261118 · handoff/PLAN-cycle-0.9.13-261118.md 끝 차례) · 각 효과 = 첫 장면(DOM) + GIF(slidePlan draw) 같은 모양.
 * D1 SLIDE-INDICATOR-DOTS-01(P224·P228): 패널 «점 표시 = 위» → 첫 장면 .sld-dots 점 3 · 첫 점 진함 · 트랙 = 블럭 − 띠(24) ·
 *    GIF: 띠 자리(카드 없음) 비움 · 넘김 둘째 머무름에서 둘째 점 진함·첫 점 옅음 · 카드는 띠 아래 · ⌘Z = 점 없음
 * D2 SLIDE-FX-SINGLE-FRAME-MULTI-01(수지 S24): 제자리 페이드 → 첫 장면 첫 카드 = 블럭 꽉 · GIF 바뀜 가운데 = 빨강·파랑 섞임 · 머무름 = 파랑 /
 *    제자리 컷 → 바뀜 가운데 = 빨강 그대로 · 머무름 = 파랑 · 프레임 모드 칸도 꽉(칸 폭 = 블럭 폭)
 * D3 SLIDE-FX-CENTER-CAROUSEL-01(수지 S07): 가운데 캐러셀 · 카드 폭 50 · 빨강·파랑·초록 → 첫 장면 = 파랑(둘째) 가운데 · 빨강 왼쪽 엿보기 · 초록 오른쪽 엿보기 ·
 *    GIF t=0 = 같은 자리(가운데 파랑 · 왼끝 빨강 · 오른끝 초록) · 머무름 = 초록 가운데
 * D4 SLIDE-FX-BEFORE-AFTER-WIPE-01(P127·128): 전후 비교 · 빨강(전)·파랑(후) → 첫 장면 = 왼쪽 반 빨강·오른쪽 반 파랑(겹침 + clip · 클릭 판정도) · 나눔선 가운데 ·
 *    GIF t=0 = 같은 자리 · t=¼ = 나눔선 80%(70% 자리가 빨강) · 프레임 모드 칸도 겹침
 * D5 SLIDE-FX-OVERLAP-GAP-01(P223): 카드 폭 50 · 간격 −40 → 첫 장면 둘째 왼끝 = 첫째 오른끝 − 40 · 겹친 자리 = 둘째(위) · GIF t=0 겹친 자리 = 파랑(같음) · 패널 간격 −40 까지 · 프레임 칸도
 * D6 SLIDE-FX-SWIPE-TRAIL-01(P218): 스와이프 잔상 vs 스와이프 — t=0·머무름 = 같은 그림(첫 장면 같음) · 넘기는 가운데 = 다름(잔상) · 잔상 자리(지나간 쪽)에 옅은 앞 카드 색
 * D7 SLIDE-FX-GRID-ZOOMOUT-01(수지 S16): 격자 줌아웃 · 빨강·파랑·초록 → 첫 장면 = 첫째(빨강) 한 장 가운데(카드 폭) · 나머지 숨김 = GIF t=0(가운데 빨강 · 왼끝 빔) ·
 *    끝 머무름 = 가운데 빨강 · 가운데 줄에 타일 ≥ 7 · 위 칸 = 파랑(나선 1) · 프레임 칸도 히어로만
 * X1 SLIDE-TEMP-HSCROLL-FIX-EXPORT-01: 카드 폭 50 · 셋 → 고르면 임시 가로 막대(#grd-plus-layer .sld-hscroll) · 200 밀기 = 블럭 scrollLeft 200 · 저장본·PNG 흔적 0(안 민 PNG 와 같음) ·
 *    «스크롤 고정» 켬 → data-scroll-x 200 · PNG 가 바뀜 · Figma images[0].x = −200 · 끔 → 키 0 · 저장본 흔적 0
 * L1 SLIDE-LAYOUT-STATIC-MODES-01: 효과 = 흐름 그대로 · 패널 «레이아웃» 가운데 캐러셀 → 첫 장면 파랑(둘째) 가운데 · Figma images 둘째 가운데 · GIF t=0 은 흐름 그대로(왼끝 빨강 = 별개) ·
 *    단일 컷 → 첫째 카드 = 블럭 꽉 · Figma images[0] 폭 = 블럭 폭 · ⌘Z = 가운데
 * D8 SLIDE-DOTS-SPACING-01: 점 위 · 패널 칸↔점 갭 16 · 점 간격 20 · 색 켜짐 #ff00ff · 꺼짐 #00ffff → 첫 장면 띠 40 · 점 사이 28 · 색 · 트랙 = 블럭 − 40 ·
 *    GIF t=0 같은 자리(점 가운데 y 20 · 첫 점 켜짐 · 둘째 꺼짐 · 띠 비움 · 카드는 띠 아래)
 * 양성대조(CTL · _patches/slide-fx-CTL1-no-gif-dots.patch): slidePlan 의 drawDots 줄 삭제 → D1 빨강(GIF 점 없음) — 예측
 *   slide-fx-CTL2-fade-no-alpha.patch(drawInPlace 페이드의 to 겹치기 줄 삭제) → D2 빨강(가운데가 섞이지 않음) — 예측
 *   slide-fx-CTL3-center-no-shift.patch(사진 모드 첫 장면 밀기 줄 삭제) → D3 빨강(첫 장면 ≠ GIF) — 예측
 *   slide-fx-CTL4-wipe-no-clip.patch(첫 장면 전 카드 clip 삭제) → D4 빨강(오른쪽 반도 빨강) — 예측
 *   slide-fx-CTL5-no-neg-margin.patch(사진 모드 음수 margin 삭제) → D5 빨강(첫 장면이 안 겹침 · GIF 와 다름) — 예측
 *   slide-fx-CTL6-no-trail.patch(잔상 모으는 줄 삭제) → D6 빨강(가운데도 같음) — 예측
 *   slide-fx-CTL7-gridzoom-all-cards.patch(사진 모드 히어로만 줄 삭제) → D7 빨강(첫 장면에 둘째도 보임 ≠ GIF t=0) — 예측
 *   slide-fx-CTL8-fix-no-shift.patch(사진 모드 «스크롤 고정» translate 줄 삭제) → X1 빨강(고정해도 PNG 그대로) — 예측
 *   slide-fx-CTL9-mode-no-center.patch(사진 모드 정지 꼴 «가운데» 조건 삭제) → L1 빨강 — 예측
 *   slide-fx-CTL10-dots-default-opt.patch(GIF 기본 갈래 drawDots 에 레이아웃 점 값 안 넘김) → D8 빨강(GIF 점이 옛 자리·색) — 예측
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function photoScene(page, colors, opts = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async ({ colors, opts }) => {
    const mk = (c) => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 40, 30); return cv.toDataURL('image/png'); };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'); window.selectSection(sec);
    const { row, block } = window.makeSlideBlock({ slides: colors.map((k) => ({ src: mk(k) })) });
    if (opts.fx) block.dataset.animFx = opts.fx;
    (sec.querySelector('.section-inner') || sec).appendChild(row); window.bindBlock?.(block);
    window.renderSlideBlock(block); window.pushHistory?.();
    block.scrollIntoView({ block: 'center' });
    return block.id;
  }, { colors, opts });
  return { errs, id };
}
const px = (ctx, x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);

test('D1 점 표시 — 첫 장면 점 띠 · GIF 같은 띠·앞 카드 점 · ⌘Z', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-swipe' });
  await page.evaluate((id) => window.selectBlock(id), id);
  await page.selectOption('#sld-dots-kind', 'dots'); await page.click('#sld-dots-pos'); // ★기대 바뀜(현빈 261123 D «표시 모양» 확정 · 0.9.13 195): 옛 «점 표시» select(없음/위/아래) → [표시 모양 ▾(없음·점·진행바) | 엔드슬롯 위↔아래] — «위» = 점 고르기 + 엔드슬롯 한 번
  const dom = await page.evaluate((id) => {
    const b = document.getElementById(id), d = b.querySelector(':scope > .sld-dots'), t = b.querySelector(':scope > .sld-track');
    return d ? { n: d.children.length, c0: getComputedStyle(d.children[0]).backgroundColor, c1: getComputedStyle(d.children[1]).backgroundColor, trackH: t.offsetHeight, bh: b.clientHeight, top: Math.round(t.getBoundingClientRect().top - b.getBoundingClientRect().top) } : null;
  }, id);
  expect(dom, '[전제] 첫 장면 점 띠').not.toBeNull();
  expect({ n: dom.n, c0: dom.c0, c1: dom.c1 }, '★점 3 · 첫 점 진함').toEqual({ n: 3, c0: 'rgb(74, 74, 74)', c1: 'rgb(201, 201, 201)' });
  expect(dom.bh - dom.trackH, '★트랙 = 블럭 − 띠').toBe(24);
  /* GIF — 넘김 둘째 머무름 */
  const g = await page.evaluate(async (id) => {
    const b = document.getElementById(id); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    const A = window.readSlideState(b).anim, per = 0.5 + A.dwell, n = 3;
    window.slidePlan(b).draw(ctx, W, H, null, (0.5 + 0.05) / (n * per));   // 둘째 카드 머무름 = 첫 넘김(0.5초) 끝난 바로 뒤(옛 줄은 한 칸 더 가 셋째 머무름이었다 — 지혜맥 D1 빨강 = 검사 시각)
    const p = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
    const total = 3 * 8 + 2 * 8, x0 = (W - total) / 2 + 4;
    return { band: p(6, 12), dot0: p(x0, 12), dot1: p(x0 + 16, 12), card: p(6, 30) };
  }, id);
  expect(g.band[3], 'GIF 띠 = 카드 없음(비움)').toBe(0);
  expect([g.dot0.slice(0, 3), g.dot1.slice(0, 3)], '★GIF 둘째 머무름 = 둘째 점 진함').toEqual([[201, 201, 201], [74, 74, 74]]);
  expect(g.card.slice(0, 3), '카드 = 띠 아래(둘째 카드 파랑)').toEqual([0, 0, 255]);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await page.keyboard.press('Meta+z');   // ★기대 바뀜(195 D) — 손짓 둘(점 고르기 · 엔드슬롯 위) = ⌘Z 둘(옛 = select 한 번 = ⌘Z 하나)
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-dots').length, id), '⌘Z = 점 없음').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D2 제자리 페이드·컷 — 첫 장면 꽉 · GIF 바뀜 가운데·머무름 · 프레임 칸도 꽉', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff'], { fx: 'slide-fade' });
  const full = await page.evaluate((id) => { const b = document.getElementById(id), c = b.querySelector('.sld-card'); return Math.abs(c.getBoundingClientRect().width - b.getBoundingClientRect().width) <= 1; }, id);
  expect(full, '★첫 장면 첫 카드 = 블럭 꽉').toBe(true);
  const g = (fx) => page.evaluate(async ({ id, fx }) => {
    const b = document.getElementById(id); b.dataset.animFx = fx; window.renderSlideBlock(b); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, A = window.readSlideState(b).anim, per = 0.5 + A.dwell, T = 2 * per;
    const shot = (sec) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, sec / T); return Array.from(ctx.getImageData(Math.round(W / 2), Math.round(H / 2), 1, 1).data).slice(0, 3); };
    return { mid: shot(0.25), dwell: shot(0.6) };
  }, { id, fx });
  const fade = await g('slide-fade');
  expect(fade.mid[0] > 60 && fade.mid[0] < 200 && fade.mid[2] > 60 && fade.mid[2] < 200, `★페이드 가운데 = 섞임 ${fade.mid}`).toBe(true);
  expect(fade.dwell, '페이드 머무름 = 다음 장(파랑)').toEqual([0, 0, 255]);
  const cut = await g('slide-cut');
  expect(cut.mid, '★컷 바뀜 가운데 = 지금 장 그대로(빨강)').toEqual([255, 0, 0]);
  expect(cut.dwell, '컷 머무름 = 다음 장').toEqual([0, 0, 255]);
  /* 프레임 모드 칸도 꽉 */
  const cellFull = await page.evaluate(async () => {
    const sec = document.querySelector('#canvas .section-block'); window.selectSection(sec);
    const made = window.addSlideBlock(); made.block.dataset.animFx = 'slide-fade'; window.renderSlideBlock(made.block);
    const b = made.block, c = b.querySelector('.sld-cell'); return Math.abs(c.getBoundingClientRect().width - b.getBoundingClientRect().width) <= 1;
  });
  expect(cellFull, '프레임 칸도 제자리 = 블럭 꽉').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D3 가운데 캐러셀 — 첫 장면 둘째 가운데·양옆 엿보기 = GIF t=0 · 머무름 셋째', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-center' });
  await page.evaluate((id) => { window.setSlideLayout(document.getElementById(id), { cardW: 50 }); }, id);
  const dom = await page.evaluate((id) => {
    const b = document.getElementById(id), br = b.getBoundingClientRect(), k = br.width / b.offsetWidth;
    return [...b.querySelectorAll('.sld-card')].map((c) => { const r = c.getBoundingClientRect(); return [(r.left - br.left) / k, (r.right - br.left) / k]; }).concat([[b.offsetWidth, 0]]);
  }, id);
  const bw = dom[3][0];
  expect(Math.abs((dom[1][0] + dom[1][1]) / 2 - bw / 2), `★첫 장면 파랑 가운데(${dom[1]})`).toBeLessThanOrEqual(1);
  expect(dom[0][1] > 0 && dom[0][1] < bw / 2, '빨강 왼쪽 엿보기').toBe(true);
  expect(dom[2][0] > bw / 2 && dom[2][0] < bw, '초록 오른쪽 엿보기').toBe(true);
  const g = await page.evaluate(async (id) => {
    const b = document.getElementById(id); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, A = window.readSlideState(b).anim, per = 0.5 + A.dwell, T = 3 * per;
    const shot = (sec) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, sec / T);
      const p = (x) => Array.from(ctx.getImageData(Math.round(x), Math.round(H / 2), 1, 1).data).slice(0, 3); return { l: p(4), c: p(W / 2), r: p(W - 4) }; };
    return { t0: shot(0), dw: shot(0.6) };
  }, id);
  expect(g.t0, '★GIF t=0 = 첫 장면(빨강 · 파랑 · 초록)').toEqual({ l: [255, 0, 0], c: [0, 0, 255], r: [0, 170, 0] });
  expect(g.dw.c, '머무름 = 초록 가운데').toEqual([0, 170, 0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D4 전후 비교 — 첫 장면 반반·나눔선 = GIF t=0 · ¼ 에 80% · 프레임 칸도', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff'], { fx: 'slide-wipe' });
  const dom = await page.evaluate((id) => {
    const b = document.getElementById(id), r = b.getBoundingClientRect(), cards = [...b.querySelectorAll('.sld-card')];
    const at = (fx) => { const e = document.elementFromPoint(r.left + r.width * fx, r.top + r.height / 2); return cards.findIndex((c) => c === e || c.contains(e)); };
    const w = b.querySelector(':scope > .sld-wipe')?.getBoundingClientRect();
    return { left: at(0.25), right: at(0.75), line: w ? Math.round(((w.left + w.right) / 2 - r.left) / r.width * 100) : null };
  }, id);
  expect(dom, '★첫 장면 왼쪽 반 = 전(0) · 오른쪽 반 = 후(1) · 나눔선 50%').toEqual({ left: 0, right: 1, line: 50 });
  const g = await page.evaluate(async (id) => {
    const b = document.getElementById(id); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight;
    const shot = (t) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, t);
      const p = (fx) => Array.from(ctx.getImageData(Math.round(W * fx), Math.round(H / 4), 1, 1).data).slice(0, 3); return { a: p(0.25), b: p(0.75), c: p(0.7) }; };
    return { t0: shot(0), q: shot(0.25) };
  }, id);
  expect([g.t0.a, g.t0.b], '★GIF t=0 = 첫 장면 반반').toEqual([[255, 0, 0], [0, 0, 255]]);
  expect(g.q.c, 't=¼ 나눔선 80% → 70% 자리 = 전(빨강)').toEqual([255, 0, 0]);
  const cells = await page.evaluate(async () => {
    window.selectSection(document.querySelector('#canvas .section-block'));
    const made = window.addSlideBlock(); made.block.dataset.animFx = 'slide-wipe'; window.renderSlideBlock(made.block);
    const b = made.block, [c0, c1] = b.querySelectorAll('.sld-cell'), r = b.getBoundingClientRect(), q0 = c0.getBoundingClientRect(), q1 = c1.getBoundingClientRect();
    return { same: Math.abs(q0.left - q1.left) <= 1 && Math.abs(q0.width - r.width) <= 1, clip: c0.style.clipPath, line: !!b.querySelector(':scope > .sld-wipe') };
  });
  expect(cells, '프레임 칸도 겹침·clip·나눔선').toEqual({ same: true, clip: 'inset(0px 50% 0px 0px)', line: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D5 겹침 간격 — 첫 장면 겹침 = GIF · 뒤 카드 위 · 패널 −40 · 프레임 칸도', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-flow' });
  await page.evaluate((id) => { window.setSlideLayout(document.getElementById(id), { cardW: 50 }); window.selectBlock(id); }, id);
  await page.fill('#sld-gap-number', '-40'); await page.locator('#sld-gap-number').dispatchEvent('change');
  const dom = await page.evaluate((id) => {
    const b = document.getElementById(id), br = b.getBoundingClientRect(), k = br.width / b.offsetWidth, [c0, c1] = b.querySelectorAll('.sld-card');
    const r0 = c0.getBoundingClientRect(), r1 = c1.getBoundingClientRect(), x = (r0.right + r1.left) / 2, e = document.elementFromPoint(x, r0.top + r0.height / 2);
    return { gap: JSON.parse(b.dataset.slideLayout || '{}').gap, ov: Math.round((r0.right - r1.left) / k), top: c1 === e || c1.contains(e), xm: (x - br.left) / k };
  }, id);
  expect({ gap: dom.gap, ov: dom.ov, top: dom.top }, '★첫 장면 겹침 40 · 겹친 자리 = 둘째(위)').toEqual({ gap: -40, ov: 40, top: true });
  const g = await page.evaluate(async ({ id, xm }) => {
    const b = document.getElementById(id); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    window.slidePlan(b).draw(ctx, W, H, null, 0);
    return Array.from(ctx.getImageData(Math.round(xm), Math.round(H / 2), 1, 1).data).slice(0, 3);
  }, { id, xm: dom.xm });
  expect(g, '★GIF t=0 겹친 자리 = 파랑(첫 장면과 같음)').toEqual([0, 0, 255]);
  const cell = await page.evaluate(async () => {
    window.selectSection(document.querySelector('#canvas .section-block'));
    const made = window.addSlideBlock(); window.setSlideLayout(made.block, { cardW: 50, gap: -40 });
    /* 레이아웃 px 로 바로(dom-screen-px-census Z3 — 화면 px ÷ 배율 대신 · 두 칸은 같은 트랙의 형제라 offsetLeft 기준이 같다) */
    const [c0, c1] = made.block.querySelectorAll('.sld-cell');
    return Math.round(c0.offsetLeft + c0.offsetWidth - c1.offsetLeft);
  });
  expect(cell, '프레임 칸도 겹침 40').toBe(40);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D6 스와이프 잔상 — t=0·머무름 = 스와이프 · 넘기는 가운데만 잔상', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-swipe' });
  const r = await page.evaluate(async (id) => {
    const b = document.getElementById(id); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, A = window.readSlideState(b).anim, per = 0.5 + A.dwell, T = 3 * per;
    const hash = (fx, sec) => { b.dataset.animFx = fx; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, sec / T);
      const d = ctx.getImageData(0, 0, W, H).data; let h = 2166136261; for (let i = 0; i < d.length; i += 4) { h ^= d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11; h = Math.imul(h, 16777619); } return h >>> 0; };
    const out = {};
    for (const [k, sec] of [['t0', 0], ['mid', 0.25], ['dwell', 0.9]]) out[k] = hash('slide-trail', sec) === hash('slide-swipe', sec);
    return out;
  }, id);
  expect(r, '★t=0·머무름 = 스와이프와 같은 그림 · 넘기는 가운데만 다름(잔상)').toEqual({ t0: true, mid: false, dwell: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D7 격자 줌아웃 — 첫 장면 히어로 = GIF t=0 · 끝 7×7 촘촘 · 나선 · 프레임 칸도', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-gridzoom' });
  const dom = await page.evaluate((id) => {
    const b = document.getElementById(id), br = b.getBoundingClientRect(), cs = [...b.querySelectorAll('.sld-card')], r0 = cs[0].getBoundingClientRect();
    return { shown: cs.map((c) => getComputedStyle(c).display !== 'none'), mid: Math.abs((r0.left + r0.right) / 2 - (br.left + br.right) / 2) <= 1, wr: Math.round(r0.width / br.width * 100) };
  }, id);
  expect(dom, '★첫 장면 = 첫째만 · 가운데 · 카드 폭 60%').toEqual({ shown: [true, false, false], mid: true, wr: 60 });
  const g = await page.evaluate(async (id) => {
    const b = document.getElementById(id); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight;
    const draw = (t) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, t); return ctx; };
    const p = (ctx, x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
    const c0 = draw(0), c1 = draw(0.9);
    let runs = 0, prev = null; const row = c1.getImageData(0, Math.round(H / 2), W, 1).data;
    for (let x = 0; x < W; x++) { const on = row[x * 4 + 3] > 0; if (on && !prev) runs++; prev = on; }
    let up = null; const col = c1.getImageData(Math.round(W / 2), 0, 1, Math.round(H / 2)).data;
    for (let y = Math.round(H / 2) - 1; y >= 0; y--) { const i = y * 4; if (col[i + 2] > 200 && col[i] < 60) { up = 'blue'; break; } if (col[i + 1] > 150 && col[i] < 60) { up = 'green'; break; } }
    return { c: p(c0, W / 2, H / 2).slice(0, 3), edge: p(c0, 4, H / 2)[3], endC: p(c1, W / 2, H / 2).slice(0, 3), runs, up };
  }, id);
  expect({ c: g.c, edge: g.edge }, '★GIF t=0 = 첫 장면(가운데 빨강 · 왼끝 빔)').toEqual({ c: [255, 0, 0], edge: 0 });
  expect(g.endC, '끝 = 가운데 첫째').toEqual([255, 0, 0]);
  expect(g.runs, `끝 가운데 줄 타일 ${g.runs} ≥ 7`).toBeGreaterThanOrEqual(7);
  expect(g.up, '위 칸 = 나선 1 = 둘째(파랑)').toBe('blue');
  const cells = await page.evaluate(() => {
    window.selectSection(document.querySelector('#canvas .section-block'));
    const made = window.addSlideBlock(); made.block.dataset.animFx = 'slide-gridzoom'; window.renderSlideBlock(made.block);
    return [...made.block.querySelectorAll('.sld-cell')].map((c) => getComputedStyle(c).display !== 'none');
  });
  expect(cells, '프레임 칸도 히어로만').toEqual([true, false, false]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('X1 임시 가로 막대 · 스크롤 고정 → 내보내기 자리', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-flow' });
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 }, captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real[k]) }); });
  await page.evaluate((id) => { window.setSlideLayout(document.getElementById(id), { cardW: 50 }); window.selectBlock(id); }, id);
  const bar = page.locator('#grd-plus-layer .sld-hscroll');
  await expect(bar, '★고르면 임시 가로 막대').toHaveCount(1);
  const png = () => page.evaluate((id) => window.exportSection(document.getElementById(id).closest('.section-block'), 'png', 860, { returnDataUrl: true }), id);
  const saved = () => page.evaluate((id) => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject()); const doc = new DOMParser().parseFromString(`<div>${d.pages.map((p) => p.canvas).join('')}</div>`, 'text/html'); const b = doc.getElementById(id); return { sx: b?.dataset.scrollX ?? null, tf: b?.querySelector('.sld-track')?.style.transform || '' }; }, id);
  const png0 = await png();
  await bar.evaluate((el) => { el.value = '200'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.evaluate((id) => window.slideHScroll(document.getElementById(id)), id), '★임시 = 밀기 값 200(134 부터 scrollLeft 대신 값+translate · 제품 뜻 바뀜)').toBe(200);
  expect(await saved(), '임시 = 저장본 흔적 0').toEqual({ sx: null, tf: '' });
  expect((await png()) === png0, '★임시 = PNG 흔적 0(안 민 것과 같음)').toBe(true);
  await page.click('label.ui-check:has(#sld-scroll-fix)');
  const fx = await page.evaluate((id) => { const b = document.getElementById(id); return { sx: b.dataset.scrollX, sl: window.slideHScroll(b), tf: b.querySelector('.sld-track').style.transform }; }, id);
  expect(fx, '★고정 = data-scroll-x 200 · 임시 0 · 트랙 −200').toEqual({ sx: '200', sl: 0, tf: 'translateX(-200px)' });
  expect((await png()) !== png0, '★고정 = PNG 가 그 자리').toBe(true);
  const fig = await page.evaluate((id) => { let node = null; const walk = (o) => { if (node || !o || typeof o !== 'object') return; if (o.id === id) { node = o; return; } Object.values(o).forEach(walk); }; walk(window.buildFigmaExportJSON?.(null)); return node?.images?.[0]?.x ?? null; }, id);
  expect(fig, 'Figma 첫 카드 x = −200').toBe(-200);
  await page.click('label.ui-check:has(#sld-scroll-fix)');
  expect(await saved(), '★고정 끔 = 저장본 흔적 0').toEqual({ sx: null, tf: '' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L1 정지 꼴 — 가운데 캐러셀·단일 컷 · GIF 효과와 별개 · Figma 같은 자리', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-flow' });
  await page.evaluate((id) => { window.setSlideLayout(document.getElementById(id), { cardW: 50 }); window.selectBlock(id); }, id);
  await page.selectOption('#sld-mode', 'center');
  const fig = (page) => page.evaluate((id) => { let node = null; const walk = (o) => { if (node || !o || typeof o !== 'object') return; if (o.id === id) { node = o; return; } Object.values(o).forEach(walk); }; walk(window.buildFigmaExportJSON?.(null)); return node?.images?.map((m) => [m.x, m.w]) ?? null; }, id);
  const c = await page.evaluate((id) => { const b = document.getElementById(id), br = b.getBoundingClientRect(), k = br.width / b.offsetWidth, r = b.querySelectorAll('.sld-card')[1].getBoundingClientRect(); return { mid: Math.abs((r.left + r.right) / 2 - (br.left + br.right) / 2) <= 1, bw: b.offsetWidth, mode: window.readSlideState(b).layout.mode }; }, id);
  expect({ mid: c.mid, mode: c.mode }, '★가운데 캐러셀 정지 꼴 = 둘째 가운데').toEqual({ mid: true, mode: 'center' });
  const f1 = await fig(page);
  expect(Math.abs(f1[1][0] + f1[1][1] / 2 - c.bw / 2) <= 2, `Figma 둘째 가운데 ${JSON.stringify(f1)}`).toBe(true);
  const g = await page.evaluate(async (id) => { const b = document.getElementById(id); await window.slidePrepare(b); const W = b.offsetWidth, H = b.offsetHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, 0); return Array.from(ctx.getImageData(4, Math.round(H / 2), 1, 1).data).slice(0, 3); }, id);
  expect(g, 'GIF(흐름) t=0 은 효과 그대로(왼끝 빨강 · 정지 꼴과 별개)').toEqual([255, 0, 0]);
  await page.selectOption('#sld-mode', 'single');
  const s1 = await page.evaluate((id) => { const b = document.getElementById(id), r = b.querySelector('.sld-card').getBoundingClientRect(); return Math.abs(r.width - b.getBoundingClientRect().width) <= 1; }, id);
  expect(s1, '★단일 컷 = 첫째 블럭 꽉').toBe(true);
  const f2 = await fig(page);
  expect(Math.abs(f2[0][1] - c.bw) <= 2 && f2[0][0] === 0, `Figma 단일 = 첫째 블럭 폭 ${JSON.stringify(f2)}`).toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => window.readSlideState(document.getElementById(id)).layout.mode, id), '⌘Z = 가운데').toBe('center');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D8 점 간격·색 — 패널 · 첫 장면 · GIF 같은 자리·색', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-swipe' });
  await page.evaluate((id) => window.selectBlock(id), id);
  await page.selectOption('#sld-dots-kind', 'dots'); await page.click('#sld-dots-pos'); // ★기대 바뀜(현빈 261123 D «표시 모양» 확정 · 0.9.13 195): 옛 «점 표시» select(없음/위/아래) → [표시 모양 ▾(없음·점·진행바) | 엔드슬롯 위↔아래] — «위» = 점 고르기 + 엔드슬롯 한 번
  await expect(page.locator('#sld-dotgap-number'), '[전제] 점 켜면 점 칸 줄').toHaveCount(1);
  await page.fill('#sld-dotgap-number', '16'); await page.locator('#sld-dotgap-number').dispatchEvent('change');
  await page.fill('#sld-dotspace-number', '20'); await page.locator('#sld-dotspace-number').dispatchEvent('change');
  await page.evaluate((id) => window.setSlideLayout(document.getElementById(id), { dotOn: '#ff00ff', dotOff: '#00ffff' }), id);   // 색 칸은 공용 색 고르개(color-picker) — 값 길만 잰다
  const dom = await page.evaluate((id) => {
    const b = document.getElementById(id), d = b.querySelector(':scope > .sld-dots'), t = b.querySelector(':scope > .sld-track'), k = b.getBoundingClientRect().width / b.offsetWidth;
    const [a, c] = [...d.children].map((e) => e.getBoundingClientRect());
    return { band: Math.round(d.getBoundingClientRect().height / k), step: Math.round((c.left - a.left) / k), on: getComputedStyle(d.children[0]).backgroundColor, off: getComputedStyle(d.children[1]).backgroundColor, track: b.clientHeight - t.offsetHeight };
  }, id);
  /* ★기대 바뀜(SLIDE-DOTS-GAP-SLIDER-01 · 137 d7385bc2c · 지디 261120 판정): 띠 = 칸↔점 갭 + 점 + 바깥 여백(고정 8) — 옛 «갭 × 2 + 점»(40) 이 아니다 ⇒ 갭 16 이면 16 + 8 + 8 = 32 · 트랙도 −32.
     이 칸은 137 앞(3783f8e44)에 쓰여 137 이 뜻을 바꾼 뒤 안 고쳐졌다. 점 사이(28)·색은 그대로. */
  expect(dom, '★첫 장면 띠 32 · 점 사이 28 · 색 · 트랙 −32').toEqual({ band: 32, step: 28, on: 'rgb(255, 0, 255)', off: 'rgb(0, 255, 255)', track: 32 });
  const g = await page.evaluate(async (id) => {
    const b = document.getElementById(id); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, 0);
    const p = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
    const x0 = (W - (3 * 8 + 2 * 20)) / 2 + 4;
    /* 137 판: 점 가운데 = 바깥 여백 8 + 점 반지름 4 = 12 · 띠 0~32(비움 → 28 에서 잼) · 카드 = 32 아래(36 에서 잼) */
    return { d0: p(x0, 12).slice(0, 3), d1: p(x0 + 28, 12).slice(0, 3), band: p(6, 28)[3], card: p(6, 36).slice(0, 3) };
  }, id);
  expect(g, '★GIF t=0 = 첫 장면(점 자리·색 · 띠 비움 · 카드 띠 아래)').toEqual({ d0: [255, 0, 255], d1: [0, 255, 255], band: 0, card: [255, 0, 0] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* D9 SLIDE-FX-SWIPE-TRAIL-01 «세기 조절»(83 · 지디 261120) — GIF 패널 «잔상 세기» = 공용 sliderRowHTML(슬라이더+숫자) · 스와이프 잔상에서만 ·
 *   숫자 44 → 블럭 data-anim-slide.trail 44(⌘Z 한 칸) · 그림(첫 장면 캔버스·GIF 같은 slidePlan.draw): 세기 0 = 스와이프와 같음 · 44 ≠ 22.
 * 양성대조 = _patches/slide-83-CTL-trail-fixed.patch(잔상이 세기를 무시 · 옛 고정 22) → «44 ≠ 22»·«0 = 스와이프» 빨강. */
test('D9 잔상 세기 — 패널 슬라이더+숫자 · 저장 · 세기 0 = 스와이프 · 44 ≠ 22', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-swipe' });
  await page.evaluate((id) => window.openAnimModal(document.getElementById(id)), id);
  await expect(page.locator('#anim-gif-modal'), '[전제] GIF 패널').toBeVisible();
  await expect(page.locator('#anim-slide-trail-row'), '스와이프엔 잔상 세기 없음').toBeHidden();
  await page.click('#anim-list .anim-item[data-id="slide-trail"]');
  const row = page.locator('#anim-slide-trail-row');
  await expect(row, '스와이프 잔상 = 잔상 세기 줄').toBeVisible();
  expect(await row.evaluate((r) => ({ prop: !!r.querySelector('.prop-row'), sl: !!r.querySelector('input.prop-slider#anim-slide-trail'), nu: !!r.querySelector('input.prop-number#anim-slide-trail-num'),
    v: r.querySelector('#anim-slide-trail-num').value, lab: r.querySelector('.prop-label')?.textContent })), '공용 sliderRowHTML 꼴 · 기본 22')
    .toEqual({ prop: true, sl: true, nu: true, v: '22', lab: '잔상 세기' });
  await page.fill('#anim-slide-trail-num', '44');
  await page.locator('#anim-slide-trail-num').dispatchEvent('change');
  await expect.poll(() => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.animSlide || '{}').trail, id), '★숫자 44 → 블럭 저장').toBe(44);
  expect(await page.evaluate(() => document.getElementById('anim-slide-trail').value), '슬라이더도 44').toBe('44');
  await page.evaluate(() => window.closeAnimModal());
  const r = await page.evaluate(async (id) => {
    const b = document.getElementById(id); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, A = window.readSlideState(b).anim, T = 3 * (0.5 + A.dwell);
    const hash = (fx, trail) => { b.dataset.animFx = fx; b.dataset.animSlide = JSON.stringify({ trail }); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, 0.25 / T);
      const d = ctx.getImageData(0, 0, W, H).data; let h = 2166136261; for (let i = 0; i < d.length; i += 4) { h ^= d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11; h = Math.imul(h, 16777619); } return h >>> 0; };
    return { zeroIsSwipe: hash('slide-trail', 0) === hash('slide-swipe', 22), d22vs44: hash('slide-trail', 22) !== hash('slide-trail', 44), d22vsSwipe: hash('slide-trail', 22) !== hash('slide-swipe', 22) };
  }, id);
  expect(r, '넘기는 가운데: 세기 0 = 스와이프 · 22 ≠ 44 · [전제] 22 ≠ 스와이프').toEqual({ zeroIsSwipe: true, d22vs44: true, d22vsSwipe: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* SLIDE-PROGRESS-BAR-01(0.9.13 195 · 현빈 261123 D 확정 · 정본 시안 8910 sbarend/sbarendbar) — 표시 모양 = 없음·점·진행바 · 엔드슬롯 위↔아래
 * P1 «진행바» → 아래 줄 칸↔바 갭·바 두께·채운 색·빈 색 · 첫 장면 .sld-dots[data-shape=bar] = 폭 전체 빈 막대 + 채움 1/3(첫 칸) · 띠 = 갭 8 + 두께 4 + 바깥 8 = 20
 * P2 GIF 둘째 머무름 = 채움 2/3(가운데 = 채운 색 · 오른쪽 끝 = 빈 색) · 바 자리 = 첫 장면과 같은 아래 띠
 * P3 엔드슬롯 = 위↔아래(바가 위로) · «없음» = 띠 없음
 * P4 옛 저장본(표시 모양 키 없음) = 점 그대로 · 점이면 저장 JSON 에 dotShape 안 씀(바이트 무변)
 * 양성대조: _patches/sbar-CTL.patch(slide-motion.js drawDots·slide-block.js _renderDots 의 진행바 갈래 걷음) ⇒ P1·P2 빨강 */
test('P1·P2 진행바 — 패널 줄 · 첫 장면 채움 1/3 · 띠 20 · GIF 둘째 머무름 채움 2/3', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-swipe' });
  await page.evaluate((id) => window.selectBlock(id), id);
  const opts = await page.evaluate(() => [...document.querySelectorAll('#sld-dots-kind option')].map((o) => o.value));
  expect(opts, '★표시 모양 = 없음 · 점 · 진행바(없음 맨 앞 · 현빈 261124 확정 ⓐ = 점 끔과 같은 저장값)').toEqual(['none', 'dots', 'bar']);
  await page.selectOption('#sld-dots-kind', 'bar');
  await page.waitForSelector('#sld-barh-number');
  const ui = await page.evaluate(() => ({ labels: [...document.querySelectorAll('#panel-right .prop-label')].map((e) => e.textContent.trim()).filter((t) => /바|색|점/.test(t)), pos: document.getElementById('sld-dots-pos')?.dataset.pos ?? null }));
  const dom = await page.evaluate((id) => {
    const b = document.getElementById(id), d = b.querySelector(':scope > .sld-dots'), t = b.querySelector(':scope > .sld-track'), tr = d?.querySelector('.sld-bar-track'), f = d?.querySelector('.sld-bar-fill');
    return d && { shape: d.dataset.shape ?? null, trW: tr ? Math.round(tr.getBoundingClientRect().width) : null, dW: Math.round(d.getBoundingClientRect().width), fillPct: f ? Math.round(f.offsetWidth / tr.offsetWidth * 100) : null, thick: tr?.offsetHeight ?? null, band: b.clientHeight - t.offsetHeight, fillC: f ? getComputedStyle(f).backgroundColor : null, trC: tr ? getComputedStyle(tr).backgroundColor : null };
  }, id);
  console.log('[P1 실측]', JSON.stringify({ ui, dom }));
  expect([ui.labels.includes('칸↔바 갭'), ui.labels.includes('바 두께'), ui.labels.includes('채운 색'), ui.labels.includes('빈 색'), ui.labels.includes('점 간격'), ui.pos], '★진행바 줄 넷 · 점 간격 없음 · 엔드슬롯 = 아래').toEqual([true, true, true, true, false, 'bottom']);
  expect([dom.shape, dom.trW === dom.dW, dom.fillPct, dom.thick, dom.band, dom.fillC, dom.trC], '★첫 장면 진행바 = 폭 전체 · 채움 1/3 · 두께 4 · 띠 20 · 채운/빈 색').toEqual(['bar', true, 33, 4, 20, 'rgb(74, 74, 74)', 'rgb(201, 201, 201)']);
  const g = await page.evaluate(async (id) => {
    const b = document.getElementById(id); await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    const A = window.readSlideState(b).anim, per = 0.5 + A.dwell, n = 3;
    window.slidePlan(b).draw(ctx, W, H, null, (0.5 + 0.05) / (n * per));   // 둘째 머무름(D1 과 같은 때)
    const p = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
    const y = H - 8 - 2;   // 바 가운데(바깥 여백 8 · 두께 4)
    return { mid: p(W * 0.5, y), end: p(W * 0.9, y), card: p(6, H - 40) };
  }, id);
  console.log('[P2 실측]', JSON.stringify(g));
  expect([g.mid.slice(0, 3), g.end.slice(0, 3)], '★GIF 둘째 머무름 = 채움 2/3(가운데 채운 색 · 끝 빈 색)').toEqual([[74, 74, 74], [201, 201, 201]]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P3·P4 엔드슬롯 위↔아래 · 없음 · 옛 저장본 = 점 · 점이면 dotShape 안 씀', async ({ page }) => {
  const { errs, id } = await photoScene(page, ['#ff0000', '#0000ff', '#00aa00'], { fx: 'slide-swipe' });
  await page.evaluate((id) => window.selectBlock(id), id);
  await page.selectOption('#sld-dots-kind', 'dots');
  const dotsSaved = await page.evaluate((id) => document.getElementById(id).dataset.slideLayout || '', id);
  await page.selectOption('#sld-dots-kind', 'bar');
  await page.click('#sld-dots-pos');
  const top = await page.evaluate((id) => { const b = document.getElementById(id), d = b.querySelector(':scope > .sld-dots'); return { pos: window.readSlideState(b).layout.dots, atTop: d ? Math.round(d.getBoundingClientRect().top - b.getBoundingClientRect().top) : null, btn: document.getElementById('sld-dots-pos')?.dataset.pos ?? null }; }, id);
  await page.selectOption('#sld-dots-kind', 'none');
  const none = await page.evaluate((id) => ({ dots: document.getElementById(id).querySelectorAll('.sld-dots').length, btn: !!document.getElementById('sld-dots-pos'), saved: window.readSlideState(document.getElementById(id)).layout.dots }), id);   // saved = 옛 «점 끔»과 같은 저장값 'none'(현빈 261124 ⓐ)
  const legacy = await page.evaluate((id) => { const b = document.getElementById(id); b.dataset.slideLayout = JSON.stringify({ dots: 'bottom' }); window.renderSlideBlock(b); const d = b.querySelector(':scope > .sld-dots'); return { shape: d?.dataset.shape ?? null, spans: d ? d.children.length : 0 }; }, id);
  console.log('[P3·P4 실측]', JSON.stringify({ dotsSaved, top, none, legacy }));
  expect(/dotShape/.test(dotsSaved), '★점이면 저장 JSON 에 dotShape 안 씀(기본값)').toBe(false);
  expect([top.pos, top.atTop, top.btn], '★엔드슬롯 한 번 = 위 · 바 띠가 블럭 맨 위').toEqual(['top', 0, 'top']);
  expect([none.dots, none.btn, none.saved], '★없음 = 띠 없음 · 엔드슬롯 없음 · 저장값 = 옛 «점 끔» none(현빈 261124 ⓐ · 옛 바이트)').toEqual([0, false, 'none']);
  expect([legacy.shape, legacy.spans], '★옛 저장본(키 없음) = 점 3').toEqual([null, 3]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
