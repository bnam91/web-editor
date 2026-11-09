/* t304-text-drop-into-frame — 섹션 흐름의 글자 블럭을 프레임 위로 끌어 놓으면 그 프레임의 자식이 된다(t3-04 회귀 QA · 현빈).
 * 칸: 스택(빈·자식 있음: 위 절반·아래 절반·빈 자리) · 자유(빈·자식 있음) · 깊이2(자유 R 안 자유 N / 스택 N).
 * 칸마다: 새 부모 · 형제 순서 · 화면 자리 · 글·서식 무변 · ⌘Z 한 번 = 끌기 전 직렬 · ⌘⇧Z = 끌기 후 직렬 · 저장 왕복 · 남은 표시선/테두리 0.
 * 자유 프레임 자리 규칙(block-drag.js 「술어 밖 루프」 · 현빈 2026-09-05 (b)): 놓은 좌표가 아니라 «가로 가운데 · 기존 바닥+16(빈 프레임은 위 여백)».
 * 음성: 프레임 밖 섹션 자리에 놓으면 섹션 흐름에 남는다 · 대조: 프레임 안 글자를 섹션으로 끌어내기(t2-09 길) 그대로.
 * 장면 준비만 evaluate — 끌기는 진짜 마우스(HTML5 끌기는 크로미움이 마우스로 일으킨다). 고정 대기 없음. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const TXT = 'T304 드롭글';

/* host: stack|free · kids: 자식 글 수 · depth2: R(자유) 안 N 에 놓는다 · inT: 글을 프레임 안에 둔다(대조) */
async function scene(page, { host = 'free', kids = 0, depth2 = false, none = false, inT = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1600 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ({ FR, host, kids, depth2, none, inT, TXT }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block');
    const mkF = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par || null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f; };
    const mkT = (par, content, o = {}) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par || null; const b = new Set(sec.querySelectorAll('.text-block')); window.addTextBlock('body', { content, ...o }); const t = [...sec.querySelectorAll('.text-block')].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return t; };
    let T = inT ? null : mkT(null, TXT, { color: '#cc0033', fontSize: 28 });
    let R = null, F = null;
    if (!none || inT) {
      if (depth2) { R = mkF(null); window.updateFrameBlock(R.id, { width: 900, height: 700 }); F = mkF(R); window.updateFrameBlock(F.id, { width: 600, height: 400 }); F.style.left = '40px'; F.style.top = '40px'; F.dataset.offsetX = 40; F.dataset.offsetY = 40; }
      else { F = mkF(null); window.updateFrameBlock(F.id, { width: 700, height: 400 }); }
      /* 스택 = prop-frame.js _convertFreeLayoutToStack 끝 꼴(자식을 넣기 «전»에 — 자식이 흐름으로 들어온다) */
      if (host === 'stack') { delete F.dataset.freeLayout; delete F.dataset.height; F.dataset.fullWidth = 'true'; F.style.height = ''; F.style.minHeight = '120px'; }
      for (let i = 0; i < kids; i++) mkT(F, 'child ' + (i + 1));
      if (inT) T = mkT(F, TXT, { color: '#cc0033', fontSize: 28 });
    }
    if (!T.id) T.id = 'tb_t304';
    T.dataset.mk = '1';
    return { T: T.id, F: F?.id || null, R: R?.id || null };
  }, { FR, host, kids, depth2, none, inT, TXT });
  await reopen(page);
  ids.mode = await page.evaluate((id) => id && (document.getElementById(id).dataset.freeLayout === 'true' ? 'free' : 'stack'), ids.F);
  if (ids.F) expect(ids.mode, '[전제] 프레임 꼴').toBe(host);
  await page.evaluate((id) => (document.getElementById(id) || document.querySelector('#canvas [data-mk]')).scrollIntoView({ block: 'center' }), ids.F || ids.T); await raf(page);
  return { errs, ...ids };
}
const reopen = async (page) => { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); window.deselectAll?.(); }); await raf(page); };
/* 직렬 = 캔버스 몫만(저장 시각 등 «때»는 뺀다) */
const ser = (page) => page.evaluate(() => { window.deselectAll?.(); const d = JSON.parse(window.serializeProject()); delete d.savedAt; delete d.updatedAt; delete d.ts; return JSON.stringify(d); });
const state = (page) => page.evaluate(({ FR }) => {
  const e = document.querySelector('#canvas [data-mk]'); if (!e) return null;
  const unit = e.closest('.frame-block[data-text-frame]') || (e.parentElement.classList.contains('row') ? e.parentElement : e);
  const par = unit.parentElement.closest(FR);
  const r = e.getBoundingClientRect(); const ur = unit.getBoundingClientRect();
  const leaf = e.querySelector('[class^="tb-"]') || e; const cs = getComputedStyle(leaf);
  const host = unit.parentElement;
  const order = [...host.children].filter((x) => !x.classList.contains('drop-indicator')).map((x) => (x.matches('.text-block') ? x : x.querySelector('.text-block'))?.innerText.trim() || x.className.split(' ')[0]);
  return { n: document.querySelectorAll('#canvas [data-mk]').length, par: par?.id || null, inSec: !par, secFlow: !par && unit.parentElement.closest('.section-block') && e.style.position !== 'absolute',
    order, text: e.innerText.trim(), font: [cs.fontSize, cs.color, cs.fontWeight].join(' '), pos: unit.style.position, l: ur.left, t: ur.top, b: ur.bottom, cx: ur.left + ur.width / 2, w: ur.width, gy: r.top + 4,
    left: parseFloat(unit.style.left), top: parseFloat(unit.style.top),
    guide: document.querySelectorAll('.drop-indicator').length, over: document.querySelectorAll('.ss-drag-over').length, dragging: document.querySelectorAll('#canvas .dragging').length };
}, { FR });
const box = (page, sel) => page.evaluate((sel) => { const el = sel.startsWith('#') ? document.getElementById(sel.slice(1)) : document.querySelector(sel); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, pl: parseFloat(cs.paddingLeft) || 0, pt: parseFloat(cs.paddingTop) || 0 }; }, sel);
const childBox = (page, F, i) => page.evaluate(({ F, i }) => { const k = [...document.getElementById(F).querySelectorAll('.text-block')].filter((x) => !x.dataset.mk)[i]; const r = k.getBoundingClientRect(); return { t: r.top, b: r.bottom, h: r.height, cx: r.left + r.width / 2 }; }, { F, i });
/* 끌기가 시작되면 원본 자리가 접혀 아래가 올라올 수 있다 ⇒ 목표는 «끌기 시작 뒤» 화면에서 잰다(사람이 보는 자리). tgt = async () => ({x,y}) */
async function drag(page, x, y, tgt) {
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 3; i++) { await page.mouse.move(x + 4 * i, y + 4 * i); await raf(page); }
  const { x: tx, y: ty } = await tgt(); const x0 = x + 12, y0 = y + 12;
  for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x0 + (tx - x0) * i / STEPS, y0 + (ty - y0) * i / STEPS); await raf(page); }
  await page.mouse.up(); await raf(page);
}
async function pickAndDrag(page, tgt) { const s = await state(page); await page.mouse.click(s.cx, s.gy); await raf(page); const s2 = await state(page); await drag(page, s2.cx, s2.gy, tgt); }
/* 섹션 안 · 어느 프레임 밖 자리 = 섹션 첫 갭 */
const secSpot = (page) => page.evaluate(() => { const g = document.querySelector('#canvas .section-block .section-inner > .gap-block'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });

/* 한 칸 전체: 놓기 → 잰다 → ⌘Z/⌘⇧Z 직렬 → 저장 왕복. 기대 부모·순서·자리는 칸이 건넨다. */
async function runCase(page, s, tgt, check) {
  const before = await state(page); const S0 = await ser(page);
  await pickAndDrag(page, tgt);
  const a = await state(page);
  expect(a.n, '사본·유실 없음').toBe(1);
  check(a);
  expect(a.text, '글 무변').toBe(before.text);
  expect(a.font, '서식 무변').toBe(before.font);
  expect([a.guide, a.over, a.dragging], '남은 표시선·테두리·끌기 표식 0').toEqual([0, 0, 0]);
  const S1 = await ser(page);
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(() => ser(page), '⌘Z 한 번 = 끌기 전 직렬').toBe(S0);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => ser(page), '⌘⇧Z = 끌기 후 직렬').toBe(S1);
  await reopen(page);
  const r = await state(page);
  expect([r.par, r.order], '저장 왕복').toEqual([a.par, a.order]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
  return a;
}

const at = (page, sel, fx, fy) => async () => { const b = await box(page, sel); return { x: b.l + b.w * fx, y: b.t + b.h * fy }; };
const atKid = (page, F, i, fy) => async () => { const c = await childBox(page, F, i); return { x: c.cx, y: c.t + c.h * fy }; };

test.describe('스택(흐름) 프레임', () => {
  test('S1 빈 스택 위에 놓으면 안 흐름 자식', async ({ page }) => {
    const s = await scene(page, { host: 'stack' });
    await runCase(page, s, at(page, '#' + s.F, 0.5, 0.5), (a) => { expect(a.par).toBe(s.F); expect(a.pos).not.toBe('absolute'); expect(a.order).toEqual([TXT]); });
  });
  test('S2 자식 있는 스택 — 첫 자식 위 절반이면 그 앞', async ({ page }) => {
    const s = await scene(page, { host: 'stack', kids: 2 });
    await runCase(page, s, atKid(page, s.F, 0, 0.25), (a) => { expect(a.par).toBe(s.F); expect(a.order).toEqual([TXT, 'child 1', 'child 2']); });
  });
  test('S3 자식 있는 스택 — 첫 자식 아래 절반이면 그 뒤', async ({ page }) => {
    const s = await scene(page, { host: 'stack', kids: 2 });
    await runCase(page, s, atKid(page, s.F, 0, 0.75), (a) => { expect(a.par).toBe(s.F); expect(a.order).toEqual(['child 1', TXT, 'child 2']); });
  });
  test('S4 자식 있는 스택 — 자식 아래 빈 자리면 끝', async ({ page }) => {
    const s = await scene(page, { host: 'stack', kids: 2 });
    await runCase(page, s, async () => { const f = await box(page, '#' + s.F); const c = await childBox(page, s.F, 1); return { x: f.cx, y: Math.min(f.b - 4, c.b + 20) }; }, (a) => { expect(a.par).toBe(s.F); expect(a.order).toEqual(['child 1', 'child 2', TXT]); });
  });
});

test.describe('자유 프레임', () => {
  test('F1 빈 자유 프레임 — 안 자식 · 가로 가운데 · 위 여백', async ({ page }) => {
    const s = await scene(page, { host: 'free' });
    const a = await runCase(page, s, at(page, '#' + s.F, 0.2, 0.8), (a) => { expect(a.par).toBe(s.F); expect(a.pos).toBe('absolute'); });
    const f = await box(page, '#' + s.F);
    expect(Math.abs(a.cx - f.cx), '가로 가운데(놓은 x 아님)').toBeLessThanOrEqual(2);
    expect(Math.abs(a.t - (f.t + f.pt)), '위 여백(놓은 y 아님)').toBeLessThanOrEqual(2);
  });
  for (const [k, fy] of [['위 절반', 0.25], ['아래 절반', 0.75]]) {
    test(`F2 자식 있는 자유 프레임 — 자식 ${k} · 기존 자식 무변 · 기존 바닥+16`, async ({ page }) => {
      const s = await scene(page, { host: 'free', kids: 2 });
      const f0 = await box(page, '#' + s.F); const c1 = await childBox(page, s.F, 1);
      const a = await runCase(page, s, atKid(page, s.F, 0, fy), (a) => { expect(a.par).toBe(s.F); expect(a.pos).toBe('absolute'); });
      const f = await box(page, '#' + s.F); const k0 = await childBox(page, s.F, 0); const c1b = await childBox(page, s.F, 1);
      expect(c1b.t - f.t, '기존 자식 무변(프레임 기준 · 원본이 섹션에서 빠져 프레임째 올라간다)').toBeCloseTo(c1.t - f0.t, 0);
      expect(Math.abs(a.cx - f.cx)).toBeLessThanOrEqual(2);
      expect(a.t, '기존 자식과 안 겹친다').toBeGreaterThanOrEqual(c1b.b - 1);
    });
  }
});

/* ⛔NG(t3-04 · 기준판 e7d97f1ec) — 깊이 2 는 N 이 아니라 R 에 떨어진다.
 *   원인: css/editor-blocks.css:268 — 진입 안 한 프레임(R)의 자손은 pointer-events:none ⇒ dragover/drop 의 과녁이 N 이 아니라 R,
 *         R 의 _bindFrameFlowDrop(js/block-drag.js:3034·:3059)이 stopPropagation 하고 R 에 넣는다. (T209 계획 «D» 와 같은 뿌리)
 *   고치면 fixme 를 걷는다. */
test.describe('깊이 2 — 자유 R 안 프레임 N', () => {
  test.fixme('D1 R 안 빈 자유 N 위에 놓으면 N 의 자식', async ({ page }) => {
    const s = await scene(page, { host: 'free', depth2: true });
    await runCase(page, s, at(page, '#' + s.F, 0.5, 0.5), (a) => { expect(a.par, 'N(R 아님)').toBe(s.F); });
  });
  test.fixme('D2 R 안 자식 있는 스택 N 위에 놓으면 N 의 자식', async ({ page }) => {
    const s = await scene(page, { host: 'stack', kids: 1, depth2: true });
    await runCase(page, s, atKid(page, s.F, 0, 0.75), (a) => { expect(a.par, 'N(R 아님)').toBe(s.F); });
  });
});

test.describe('음성·대조', () => {
  test('N1 프레임 밖 섹션 자리(첫 갭)에 놓으면 섹션 흐름에 남는다', async ({ page }) => {
    const s = await scene(page, { host: 'free' });
    await runCase(page, s, () => secSpot(page), (a) => { expect(a.inSec).toBe(true); expect(a.secFlow).toBeTruthy(); expect(a.order.indexOf(TXT), '갭 근처로 옮겨졌다').toBeLessThan(3); });
  });
  test('N2 자유 프레임 안 글자를 섹션으로 끌어내면 섹션으로 빠진다(t2-09 길)', async ({ page }) => {
    const s = await scene(page, { host: 'free', inT: true });
    const S0 = await ser(page);   // ⚠️ser 는 고른 것을 푼다 — 고르기 «전»에 찍는다
    await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; });
    const isSel = () => page.evaluate(() => document.querySelector('#canvas [data-mk]').classList.contains('selected'));
    for (let i = 0; i < 6 && !(await isSel()); i++) { const w = await state(page); await page.mouse.dblclick(w.cx, (w.t + w.b) / 2); await raf(page); }
    expect(await isSel(), '[전제] 고르기').toBe(true);
    const w = await state(page);
    const g = await secSpot(page); const y0 = (w.t + w.b) / 2;
    await page.mouse.move(w.cx, y0); await page.mouse.down();
    for (let i = 1; i <= STEPS; i++) { await page.mouse.move(w.cx + (g.x - w.cx) * i / STEPS, y0 + (g.y - y0) * i / STEPS); await raf(page); }
    await page.mouse.up(); await raf(page);
    const a = await state(page);
    expect(a.n).toBe(1); expect(a.inSec, '섹션 직속').toBe(true);
    expect([a.guide, a.over], '남은 표시선·테두리 0').toEqual([0, 0]);
    await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
    await page.keyboard.press('Meta+z');
    await expect.poll(() => ser(page), '⌘Z 한 번').toBe(S0);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
});
