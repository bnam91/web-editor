/* t201-drop-keep-multiselect — T2-01-DROP-KEEP-MULTISELECT-01 (현빈 2026-11-10 결정: 피그마처럼 «여럿 끌어 놓은 뒤에도 끌던 것 전부 선택 유지»)
 *   옛: 놓은 뒤 따라오는 click 이 선택을 하나로 좁혔다(프레임 끌기는 누를 때 하나로 좁혀 두고 놓은 뒤 그대로 · 블럭 끌기는 click 이 좁힘).
 *   고침: js/block-drag.js _afterDropClick — 여럿을 «끌었으면» 그 click 을 먹고 끌던 것 전부 고른 채(프레임 끌기는 피어를 다시 고름).
 * 칸(진짜 마우스 · 판 = 자유 프레임 F 안 글 블럭 K0~K3 · 자식 프레임 P·Q·R(각자 글 블럭 든 것) · 위아래 흐름 글):
 *   D1 프레임 둘(P·Q) 골라 P 를 끌기 → 놓은 뒤 P·Q 둘 다 .selected · R 아님 · 둘 다 같은 Δ 로 옮겨짐
 *   D2 글 블럭 둘(K0·K1) 골라 K0 를 끌기 → 놓은 뒤 둘 다 .selected · 같은 Δ
 *   D3 경계 — 여럿 고른 채 «안 끈 클릭»(K0) = 지금처럼 하나만(K1 풀림)
 *   D4 경계 — 하나만 골라 끌기 = 그 하나 그대로(옛 동작)
 *   D5 여럿 끌고 ⌘Z 한 번 = 둘 다 제자리
 *   D6 경계(적대 리뷰) — 여럿 고른 채 «안 고른 것»을 잡아 끌면 놓은 뒤는 옛처럼 잡은 것 하나(프레임 R · 글 K2)
 *   D7 경계 — 글 블럭 여럿 고른 채 안 끈 클릭 = 하나만
 * 양성대조(지디 인텔): js/block-drag.js _afterDropClick 의 `const keep = !!(peers && peers.length);` 를 `const keep = false;` → D1·D2 빨강 · D3·D4 초록 그대로. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';

async function build(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(async (FR) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'S';
    sec.querySelectorAll('.frame-block[data-text-frame]').forEach((t) => (t.closest('.row') || t).remove());
    const text = (frame, id, txt) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = frame; window.addTextBlock('body'); window._activeFrame = null;
      const tb = [...(frame || sec).querySelectorAll('.text-block')].pop(); tb.id = id; tb.closest('.frame-block[data-text-frame]').id = 'W' + id;
      const t = tb.querySelector('[class^="tb-"]'); if (t) { t.textContent = txt || id; delete t.dataset.isPlaceholder; } return tb; };
    text(null, 'TOP', '위 흐름 글');
    window.deselectAll(); window.selectSection(sec); let b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock();
    const F = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); F.id = 'F'; window.updateFrameBlock('F', { width: 900, height: 640 });
    [[40, 40], [420, 40], [40, 140], [420, 140]].forEach(([l, t], i) => { const w = text(F, 'K' + i, '글 K' + i).closest('.frame-block'); w.style.left = l + 'px'; w.style.top = t + 'px'; w.style.width = '300px'; });
    for (const [id, l] of [['P', 40], ['Q', 320], ['R', 600]]) {
      window.deselectAll(); window.selectSection(sec); window._activeFrame = F; b = new Set(F.querySelectorAll(FR)); window.addFrameBlock({}); window._activeFrame = null;
      const k = [...F.querySelectorAll(FR)].find((x) => !b.has(x)); k.id = id; window.updateFrameBlock(id, { width: 220, height: 160 });
      k.style.left = l + 'px'; k.style.top = '330px'; k.dataset.offsetX = String(l); k.dataset.offsetY = '330';
      text(k, 'T' + id, '프레임 ' + id);
    }
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" data-type="gap" style="height:600px"></div>');
    window.rebindAll?.(); window.deselectAll(); window.clearHistory?.();
  }, FR);
  await raf(page);
  return errs;
}
const ctr = (page, id, dy = 0) => page.evaluate(([id, dy]) => { const e = document.getElementById(id); const r = e.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + (dy ? dy : q.height / 2)]; }, [id, dy]);
async function click(page, id, mod, dy) { const [x, y] = await ctr(page, id, dy); if (mod) await page.keyboard.down(mod); await page.mouse.click(x, y); if (mod) await page.keyboard.up(mod); await raf(page); }
async function dbl(page, id, dy) { const [x, y] = await ctr(page, id, dy); await page.mouse.dblclick(x, y); await raf(page); }
async function drag(page, id, dx, dy, grabDy) {
  const [x, y] = await ctr(page, id, grabDy);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 }); await page.mouse.up();
  await raf(page);
}
const sel = (page, ids) => page.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, !!document.getElementById(id)?.classList.contains('selected')])), ids);
const pos = (page, ids) => page.evaluate((ids) => Object.fromEntries(ids.map((id) => { const e = document.getElementById(id); return [id, [parseFloat(e.style.left) || 0, parseFloat(e.style.top) || 0]]; })), ids);
const delta = (a, b) => [Math.round(b[0] - a[0]), Math.round(b[1] - a[1])];

/* 자식 프레임 둘 고르기 — 자유 프레임 안은 «클릭 = 바깥 F · 더블클릭 = 한 단계 안»(t201-multi-group-outline 과 같은 손). 프레임의 빈 자리(아래쪽)를 누른다. */
async function pickFrames(page) {
  await click(page, 'P', null, 140); await dbl(page, 'P', 140); await click(page, 'Q', 'Shift', 140);
  expect(await sel(page, ['P', 'Q', 'R']), '[전제] P·Q 를 골랐다').toEqual({ P: true, Q: true, R: false });
}
async function pickTexts(page) {
  await click(page, 'K0'); await dbl(page, 'K0'); await page.evaluate(() => document.activeElement?.blur?.()); await click(page, 'K1', 'Shift');
  expect(await sel(page, ['K0', 'K1', 'K2']), '[전제] K0·K1 을 골랐다').toEqual({ K0: true, K1: true, K2: false });
}

test('D1 자식 프레임 둘(P·Q) 골라 끌기 → 놓은 뒤 둘 다 선택 유지 · 같은 Δ', async ({ page }) => {
  const errs = await build(page);
  await pickFrames(page);
  const p0 = await pos(page, ['P', 'Q', 'R']);
  await drag(page, 'P', 60, 40, 140);
  const p1 = await pos(page, ['P', 'Q', 'R']);
  console.log('T201DROP D1 ' + JSON.stringify({ p0, p1 }));
  expect(delta(p0.P, p1.P)[0], '[전제] P 가 옮겨졌다').not.toBe(0);
  expect(delta(p0.Q, p1.Q), 'Q 도 같은 Δ').toEqual(delta(p0.P, p1.P));
  expect(delta(p0.R, p1.R), 'R 은 그대로').toEqual([0, 0]);
  await expect.poll(() => sel(page, ['P', 'Q', 'R']), { timeout: 2000 }).toEqual({ P: true, Q: true, R: false });
  expect(await page.evaluate(() => window._activeFrame?.id), '활성 프레임 = 잡은 것(누를 때 세운 그대로)').toBe('P');
  expect(errs).toEqual([]);
});

test('D2 글 블럭 둘(K0·K1) 골라 끌기 → 놓은 뒤 둘 다 선택 유지 · 같은 Δ', async ({ page }) => {
  const errs = await build(page);
  await pickTexts(page);
  const W = ['WK0', 'WK1', 'WK2'];
  const p0 = await pos(page, W);
  await drag(page, 'K0', 50, 30);
  const p1 = await pos(page, W);
  console.log('T201DROP D2 ' + JSON.stringify({ p0, p1 }));
  expect(delta(p0.WK0, p1.WK0)[0], '[전제] K0 가 옮겨졌다').not.toBe(0);
  expect(delta(p0.WK1, p1.WK1)).toEqual(delta(p0.WK0, p1.WK0));
  expect(delta(p0.WK2, p1.WK2)).toEqual([0, 0]);
  await expect.poll(() => sel(page, ['K0', 'K1', 'K2']), { timeout: 2000 }).toEqual({ K0: true, K1: true, K2: false });
  expect(errs).toEqual([]);
});

test('D3 경계 — 여럿 고른 채 «안 끈 클릭» = 지금처럼 하나만(나머지 풀림)', async ({ page }) => {
  const errs = await build(page);
  await pickFrames(page);
  await click(page, 'P', null, 140);
  const s = await sel(page, ['P', 'Q']);
  expect(s.Q, '안 끈 클릭은 하나로 좁힌다').toBe(false);
  expect(errs).toEqual([]);
});

test('D4 경계 — 하나만 골라 끌기 = 그 하나 그대로(옛 동작)', async ({ page }) => {
  const errs = await build(page);
  await click(page, 'P', null, 140); await dbl(page, 'P', 140);
  expect(await sel(page, ['P', 'Q']), '[전제]').toEqual({ P: true, Q: false });
  await drag(page, 'P', 40, 30, 140);
  expect(await sel(page, ['P', 'Q'])).toEqual({ P: true, Q: false });
  expect(errs).toEqual([]);
});

test('D5 여럿 끌고 ⌘Z 한 번 = 둘 다 제자리', async ({ page }) => {
  const errs = await build(page);
  await pickFrames(page);
  const p0 = await pos(page, ['P', 'Q']);
  await drag(page, 'P', 60, 40, 140);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => pos(page, ['P', 'Q'])).toEqual(p0);
  expect(errs).toEqual([]);
});

test('D6 경계 — 여럿 고른 채 «안 고른 것»을 잡아 끌면 놓은 뒤는 옛처럼 잡은 것 하나', async ({ page }) => {
  const errs = await build(page);
  await pickFrames(page);
  await drag(page, 'R', 30, 20, 140);
  const f = await sel(page, ['P', 'Q', 'R']);
  console.log('T201DROP D6f ' + JSON.stringify(f));
  expect([f.P, f.Q], '안 고른 R 을 끌었으면 P·Q 는 안 남는다').toEqual([false, false]);
  await page.evaluate(() => window.deselectAll());
  await pickTexts(page);
  await drag(page, 'K2', 30, 20);
  const t = await sel(page, ['K0', 'K1']);
  console.log('T201DROP D6t ' + JSON.stringify(t));
  expect(t, '안 고른 K2 를 끌었으면 K0·K1 은 안 남는다').toEqual({ K0: false, K1: false });
  expect(errs).toEqual([]);
});

test('D7 경계 — 글 블럭 여럿 고른 채 안 끈 클릭 = 하나만', async ({ page }) => {
  const errs = await build(page);
  await pickTexts(page);
  await click(page, 'K0');
  expect((await sel(page, ['K1'])).K1).toBe(false);
  expect(errs).toEqual([]);
});
