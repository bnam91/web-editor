/* slide-lanes — 0.9.13 SLIDE-EFFECT-SAMPLES-QA-01 ③ 여러 줄 반대 방향(현빈 261123 · 지디 ⓐ = GIF 효과 고정 꼴 두 줄 · 새 칸 0) · 태양
 *   slide-flow2 «2줄 반대 방향»(윗줄 = 고른 방향 · 아랫줄 = 반대) · slide-vflow2 «세로 2열 반대 방향» · 셈 = js/fx/slide-motion.js laneGeoms·drawLanes(단위 S17)
 * L1 첫 장면 DOM = 격자(칸 i = i%2 줄 · ⌊i/2⌋ 번째) · GIF t=0 프레임에서 그 칸 DOM 가운데 = 그 칸 색(첫 장면 = GIF)
 * L2 GIF t=0.2 — 윗줄은 왼쪽으로 0.2×윗줄 주기 · 아랫줄은 오른쪽으로 0.2×아랫줄 주기(반대)
 * L3 끊김 0 — t=1 프레임 = t=0 프레임(픽셀 같음)
 * L4 세로 2열 — 첫 장면 = 두 열(칸 i = i%2 열) · GIF t=0 같은 자리 색
 * 양성대조: _patches/slide-fx3-CTL.patch(drawLanes 아랫줄도 같은 방향) ⇒ L2 빨강 · _patches/slide-fx3-CTL-dom.patch(첫 장면 격자 걷음 = 옛 한 줄) ⇒ L1·L4 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');   // 자 = offset*(레이아웃 px · dom-screen-px-census)
const COLORS = ['#ff0000', '#0000ff', '#00aa00', '#ffcc00'];
const RGB = { '#ff0000': [255, 0, 0], '#0000ff': [0, 0, 255], '#00aa00': [0, 170, 0], '#ffcc00': [255, 204, 0] };

async function scene(page, fx) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async ({ colors, fx }) => {
    const mk = (c) => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 40, 30); return cv.toDataURL('image/png'); };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = c.querySelector('.section-block'); window.selectSection(sec);
    const { row, block } = window.makeSlideBlock({ slides: colors.map((k) => ({ src: mk(k) })) });
    block.dataset.animFx = fx;
    (sec.querySelector('.section-inner') || sec).appendChild(row); window.bindBlock?.(block);
    window.renderSlideBlock(block); block.scrollIntoView({ block: 'center' });
    await window.slidePrepare(block);
    return block.id;
  }, { colors: COLORS, fx });
  return { errs, id };
}
/* DOM 칸 가운데(블럭 기준) · GIF 프레임(블럭 크기 · k=1)의 그 점 색 */
const probe = (page, id, ts) => page.evaluate(({ id, ts }) => {
  const b = document.getElementById(id), W = b.offsetWidth, H = b.offsetHeight;
  const off = (el) => { let x = 0, y = 0; for (let e = el; e && e !== b && b.contains(e); e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y]; };   // 레이아웃 px(배율 무관 · GIF 캔버스 = 블럭 px)
  const cards = [...b.querySelectorAll('.sld-card')].map((c) => { const [l, t] = off(c); return { l: Math.round(l), t: Math.round(t), w: c.offsetWidth, h: c.offsetHeight }; });
  const frames = ts.map((t) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, t); return ctx; });
  const at = (f, x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? null : Array.from(frames[f].getImageData(Math.round(x), Math.round(y), 1, 1).data).slice(0, 3);
  const same = ts.length > 1 ? (() => { const a = frames[0].getImageData(0, 0, W, H).data, z = frames[frames.length - 1].getImageData(0, 0, W, H).data; let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - z[i]); return d; })() : null;
  return { W, H, cards, samples: frames.map((_, f) => cards.map((c) => at(f, c.l + Math.min(c.w, W - c.l) / 2, c.t + Math.min(c.h, H - c.t) / 2))), at: null, same, rawAt: (() => null)() };
}, { id, ts });
const near = (a, b) => !!a && a.every((v, i) => Math.abs(v - b[i]) <= 6);

test('L1 2줄 — 첫 장면 격자 = GIF t=0', async ({ page }) => {
  const { errs, id } = await scene(page, 'slide-flow2');
  const r = await probe(page, id, [0]);
  console.log('[L1 실측]', JSON.stringify({ cards: r.cards, s: r.samples[0] }));
  expect([r.cards[0].t, r.cards[1].t > r.cards[0].t + r.cards[0].h - 1, r.cards[2].t, r.cards[0].l, r.cards[1].l], '★격자: 0·2 윗줄 · 1 아랫줄 · 0·1 같은 왼끝 0').toEqual([0, true, 0, 0, 0]);
  expect(r.cards[2].l, '★칸 2 = 윗줄 둘째 = 카드 폭 + 간격').toBe(r.cards[0].w + 16);
  r.cards.forEach((c, i) => { if (c.l < r.W) expect(near(r.samples[0][i], RGB[COLORS[i]]), `★GIF t=0 칸 ${i} 자리 = 그 칸 색 ${r.samples[0][i]}`).toBe(true); });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L2 반대 방향 — t=0.2 윗줄 왼쪽 · 아랫줄 오른쪽', async ({ page }) => {
  const { errs, id } = await scene(page, 'slide-flow2');
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id), W = b.offsetWidth, H = b.offsetHeight, cw = W * 0.6, step = cw + 16, P = 2 * step;   // 칸 넷 = 줄마다 둘 · 주기 = 2 × 한 칸
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, 0.2);
    const band = (H - 16) / 2, at = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data).slice(0, 3);
    const sh = 0.2 * P;   // 둘 다 같은 주기(칸 수 같음) · 방향만 반대
    return { top: at(cw / 2 - sh + step, band / 2), topShift: sh, bot: at(cw / 2 + sh, band + 16 + band / 2) };
  }, id);
  console.log('[L2 실측]', JSON.stringify(r));
  expect(near(r.top, RGB[COLORS[2]]), `★윗줄 왼쪽으로 — 칸 2 가 ${r.topShift}px 왼쪽 자리 ${r.top}`).toBe(true);
  expect(near(r.bot, RGB[COLORS[1]]), `★아랫줄 오른쪽으로 — 칸 1 이 오른쪽 자리 ${r.bot}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L3 끊김 0 — t=1 = t=0', async ({ page }) => {
  const { errs, id } = await scene(page, 'slide-flow2');
  const r = await probe(page, id, [0, 1]);
  expect(r.same, '★끝 프레임 = 첫 프레임(픽셀 차 합 0)').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L4 세로 2열 — 첫 장면 두 열 = GIF t=0', async ({ page }) => {
  const { errs, id } = await scene(page, 'slide-vflow2');
  const r = await probe(page, id, [0]);
  console.log('[L4 실측]', JSON.stringify({ cards: r.cards, s: r.samples[0] }));
  expect([r.cards[0].l, r.cards[1].l > r.cards[0].l + r.cards[0].w - 1, r.cards[2].l, r.cards[0].t, r.cards[1].t], '★두 열: 0·2 왼열 · 1 오른열 · 0·1 같은 위끝').toEqual([0, true, 0, 0, 0]);
  r.cards.forEach((c, i) => { if (c.t < r.H) expect(near(r.samples[0][i], RGB[COLORS[i]]), `★GIF t=0 칸 ${i} 자리 = 그 칸 색 ${r.samples[0][i]}`).toBe(true); });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L5 프레임 칸 모드(새 블럭 기본) — 첫 장면도 격자(칸 i = i%2 줄) · 칸 자식·저장 무접촉', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = c.querySelector('.section-block'); window.selectSection(sec);
    const { row, block } = window.makeSlideBlock({ cellMode: 'frame' });
    (sec.querySelector('.section-inner') || sec).appendChild(row); window.bindBlock?.(block);
    window.addSlideCell(block);   // 칸 넷
    const kidsBefore = [...block.querySelectorAll('.sld-cell')].map((x) => x.id).join(',');
    block.dataset.animFx = 'slide-flow2'; window.renderSlideBlock(block);
    const off = (el) => { let x = 0, y = 0; for (let e = el; e && e !== block && block.contains(e); e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [Math.round(x), Math.round(y)]; };
    const cells = [...block.querySelectorAll('.sld-cell')];
    return { pos: cells.map(off), w: cells[0].offsetWidth, same: cells.map((x) => x.id).join(',') === kidsBefore, n: cells.length };
  });
  console.log('[L5 실측]', JSON.stringify(r));
  expect(r.n, '[전제] 칸 넷').toBe(4);
  expect([r.pos[0], r.pos[2][1], r.pos[1][0], r.pos[1][1] > 0, r.pos[2][0] === r.w + 16, r.same], '★격자 · 칸 차례·id 무변').toEqual([[0, 0], 0, 0, true, true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
