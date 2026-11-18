/* slide-fx — 슬라이드 효과 묶음(현빈 «너가 판단» 261118 · handoff/PLAN-cycle-0.9.13-261118.md 끝 차례) · 각 효과 = 첫 장면(DOM) + GIF(slidePlan draw) 같은 모양.
 * D1 SLIDE-INDICATOR-DOTS-01(P224·P228): 패널 «점 표시 = 위» → 첫 장면 .sld-dots 점 3 · 첫 점 진함 · 트랙 = 블럭 − 띠(24) ·
 *    GIF: 띠 자리(카드 없음) 비움 · 넘김 둘째 머무름에서 둘째 점 진함·첫 점 옅음 · 카드는 띠 아래 · ⌘Z = 점 없음
 * D2 SLIDE-FX-SINGLE-FRAME-MULTI-01(수지 S24): 제자리 페이드 → 첫 장면 첫 카드 = 블럭 꽉 · GIF 바뀜 가운데 = 빨강·파랑 섞임 · 머무름 = 파랑 /
 *    제자리 컷 → 바뀜 가운데 = 빨강 그대로 · 머무름 = 파랑 · 프레임 모드 칸도 꽉(칸 폭 = 블럭 폭)
 * 양성대조(CTL · _patches/slide-fx-CTL1-no-gif-dots.patch): slidePlan 의 drawDots 줄 삭제 → D1 빨강(GIF 점 없음) — 예측
 *   slide-fx-CTL2-fade-no-alpha.patch(drawInPlace 페이드의 to 겹치기 줄 삭제) → D2 빨강(가운데가 섞이지 않음) — 예측
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
  await page.selectOption('#sld-dots', 'top');
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
    window.slidePlan(b).draw(ctx, W, H, null, (per + 0.5 + 0.05) / (n * per));   // 둘째 카드 머무름
    const p = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
    const total = 3 * 8 + 2 * 8, x0 = (W - total) / 2 + 4;
    return { band: p(6, 12), dot0: p(x0, 12), dot1: p(x0 + 16, 12), card: p(6, 30) };
  }, id);
  expect(g.band[3], 'GIF 띠 = 카드 없음(비움)').toBe(0);
  expect([g.dot0.slice(0, 3), g.dot1.slice(0, 3)], '★GIF 둘째 머무름 = 둘째 점 진함').toEqual([[201, 201, 201], [74, 74, 74]]);
  expect(g.card.slice(0, 3), '카드 = 띠 아래(둘째 카드 파랑)').toEqual([0, 0, 255]);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
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
