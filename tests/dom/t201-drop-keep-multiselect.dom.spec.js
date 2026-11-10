/* t201-drop-keep-multiselect — T2-01-DROP-KEEP-MULTISELECT-01 (현빈 2026-11-10 결정: 피그마처럼 «여럿 끌어 놓은 뒤에도 끌던 것 전부 선택 유지»)
 *   옛: 놓은 뒤 따라오는 click 이 선택을 하나로 좁혔다(프레임 끌기는 누를 때 하나로 좁혀 두고 놓은 뒤 그대로 · 블럭 끌기는 click 이 좁힘).
 *   고침: js/block-drag.js _afterDropClick — 여럿을 «끌었으면» 그 click 을 먹고 끌던 것 전부 고른 채(프레임 끌기는 피어를 다시 고름).
 * 칸(진짜 마우스 · 판 = 자유 프레임 F 안 글 블럭 K0~K3 · 그룹 P·Q·R(글 둘씩 ⌘G — 프레임 끌기 길) · 위 흐름 글):
 *   ★int-3(2b5ae01f8) 위로 옮김(지디 261110) — 기준 02f70b89e 판(4950167c0)은 «빈 자식 프레임을 더블클릭으로 고르기»가 안 돼 프레임 칸 5개가 전제에서 빨강(인텔). int-3 C1 이 쓰는 «그룹·글 클릭» 손으로 바꿈.
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
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock();
    const F = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); F.id = 'F'; window.updateFrameBlock('F', { width: 900, height: 700 });
    /* 글 블럭 K0~K3(블럭 끌기 길) · 그룹 재료 G0~G5(프레임 끌기 길 — 둘씩 ⌘G 로 묶어 P·Q·R) */
    const at = { K0: [40, 40], K1: [420, 40], K2: [40, 140], K3: [420, 140],
      G0: [40, 300], G1: [190, 400], G2: [340, 300], G3: [490, 400], G4: [640, 300], G5: [690, 400] };
    for (const [id, [l, t]] of Object.entries(at)) { const w = text(F, id, '글 ' + id).closest('.frame-block'); w.style.left = l + 'px'; w.style.top = t + 'px'; w.style.width = (id[0] === 'G' ? 140 : 300) + 'px'; }
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" data-type="gap" style="height:600px"></div>');
    window.rebindAll?.(); window.deselectAll(); window.clearHistory?.();
  }, FR);
  await raf(page);
  /* 그룹 셋을 진짜 손(클릭 → 더블클릭 → ⇧클릭 → ⌘G)으로 — int-3 t201-multi-group-outline groups() 와 같은 손. 그룹 프레임에 id P·Q·R 을 단다. */
  for (const [a, bId, name] of [['G0', 'G1', 'P'], ['G2', 'G3', 'Q'], ['G4', 'G5', 'R']]) {
    await click(page, a); await dbl(page, a); await click(page, bId, 'Shift'); await page.keyboard.press('Meta+g'); await raf(page);
    const ok = await page.evaluate(([a, name]) => { const g = document.getElementById(a)?.closest('.frame-block[data-group="true"]'); if (!g) return false; g.id = name; window.deselectAll(); return true; }, [a, name]);
    expect(ok, `[전제] 그룹 ${name} 이 섰다`).toBe(true);
    await raf(page);
  }
  await page.evaluate(() => window.clearHistory?.());
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

/* 그룹 둘 고르기 — 자유 프레임 안은 «클릭 = 바깥 F · 더블클릭 = 한 단계 안(그 글의 그룹)» · ⇧클릭 = 다른 그룹 더함(int-3 C1 과 같은 손). */
async function pickFrames(page) {
  await click(page, 'G0'); await dbl(page, 'G0'); await click(page, 'G2', 'Shift');
  expect(await sel(page, ['P', 'Q', 'R']), '[전제] P·Q 를 골랐다').toEqual({ P: true, Q: true, R: false });
}
/* 그룹의 «빈 자리»(왼쪽 아래 — 첫 글 아래 · 둘째 글 왼쪽)를 잡는 점. 글 위에서 누르면 기존 적중 규칙이 다르게 좁힌다(int-3 C1 주석). */
const groupGrab = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) { e.scrollIntoView({ block: 'center' }); } const q = e.getBoundingClientRect();
  const x = q.left + 10, y = q.bottom - 6; return { x, y, hit: document.elementFromPoint(x, y)?.closest('.frame-block:not([data-text-frame])')?.id || null }; }, id);
async function dragGroup(page, id, dx, dy) {
  const g = await groupGrab(page, id);
  expect(g.hit, `[전제] ${id} 의 빈 자리를 잡는다`).toBe(id);
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  await page.mouse.move(g.x + dx, g.y + dy, { steps: 10 }); await page.mouse.up();
  await raf(page);
}
async function clickGroup(page, id) { const g = await groupGrab(page, id); expect(g.hit).toBe(id); await page.mouse.click(g.x, g.y); await raf(page); }
async function pickTexts(page) {
  await click(page, 'K0'); await dbl(page, 'K0'); await page.evaluate(() => document.activeElement?.blur?.()); await click(page, 'K1', 'Shift');
  expect(await sel(page, ['K0', 'K1', 'K2']), '[전제] K0·K1 을 골랐다').toEqual({ K0: true, K1: true, K2: false });
}

test('D1 자식 프레임 둘(P·Q) 골라 끌기 → 놓은 뒤 둘 다 선택 유지 · 같은 Δ', async ({ page }) => {
  const errs = await build(page);
  await pickFrames(page);
  const p0 = await pos(page, ['P', 'Q', 'R']);
  await dragGroup(page, 'P', 60, 40);
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
  await clickGroup(page, 'P');
  const s = await sel(page, ['P', 'Q']);
  expect(s.Q, '안 끈 클릭은 하나로 좁힌다').toBe(false);
  expect(errs).toEqual([]);
});

test('D4 경계 — 하나만 골라 끌기 = 그 하나 그대로(옛 동작)', async ({ page }) => {
  const errs = await build(page);
  await click(page, 'G0'); await dbl(page, 'G0');
  expect(await sel(page, ['P', 'Q']), '[전제] P 하나').toEqual({ P: true, Q: false });
  await dragGroup(page, 'P', 40, 30);
  expect(await sel(page, ['P', 'Q'])).toEqual({ P: true, Q: false });
  expect(errs).toEqual([]);
});

test('D5 여럿 끌고 ⌘Z 한 번 = 둘 다 제자리', async ({ page }) => {
  const errs = await build(page);
  await pickFrames(page);
  const p0 = await pos(page, ['P', 'Q']);
  await dragGroup(page, 'P', 60, 40);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => pos(page, ['P', 'Q'])).toEqual(p0);
  expect(errs).toEqual([]);
});

test('D6 경계 — 여럿 고른 채 «안 고른 것»을 잡아 끌면 놓은 뒤는 옛처럼 잡은 것 하나', async ({ page }) => {
  const errs = await build(page);
  await pickFrames(page);
  await dragGroup(page, 'R', 30, 20);
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
