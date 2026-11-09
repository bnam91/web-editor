/* frame-paste-target-c1 — ⌘V 자리는 «지금 선택»을 따른다(1109t1C1 · 현빈 「프레임 블럭 안에 잘라내기 및 복사 후 붙여넣기 할때 포커스가 어디에 되어있는 가에 따라 붙여넣기 되는 곳이 달라야함」 · 피그마식).
 *   ㉠ 프레임 안 블럭(또는 안쪽 프레임)을 골랐다 → 그 다음 자리(같은 프레임)   ㉡ 밖에서 맨 위 프레임을 한 번 클릭 → 그 안 끝(⌘V 만 · g·⌘D 는 다음 자리 F1)
 *   ㉢ 프레임에 들어가(여백 더블클릭) 아무것도 안 고름 → 그 안 끝        ㉣ 섹션만 골랐다 → 섹션 끝        ㉤ 아무것도 안 고름 → 원본 옆 +20
 *   자유 프레임 안이면 좌표째(첫째 원본+20 · 나머지는 간격 유지) · 스택 프레임이면 흐름 끝. ⌘C·⌘X 둘 다 · 하나·여럿 · ⌘Z 한 번 · 저장 왕복.
 * 장면: 섹션 S1 = 자유 F(글자 a1 a2 a3 @ (40,50)(300,50)(40,200)) · 스택 K(k1 k2 k3) · 자유 G(자식 프레임 g1 g2 g3) · 그리고 섹션 S2.
 * ★양성대조: _pasteTarget 이 null 을 돌리면 «바뀌는 칸»이 빨강 · 대조 칸은 초록. copySelected 의 자유 프레임 여럿 갈래를 걷으면 래퍼 시험이 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
test.describe.configure({ timeout: 120000 });   // 줄마다 칸 4~8 개를 한 부팅에서 돈다
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(page) { await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page); await page.evaluate(() => window.applyZoom(40)); await waitZoomSettled(page, 40); return errs; }
/* 장면을 (다시) 짓는다 — 한 시험 안에서 칸마다 새로 짓는다(부팅 한 번). */
const scene = (page) => page.evaluate(async () => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((x) => x.remove()); window.deselectAll(); window._activeFrame = null;
  await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); const FR = '.frame-block:not([data-text-frame])';
  const add = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par || null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); if (par) { f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; } return f; };
  const unit = (k) => k.closest('.frame-block[data-text-frame]') || k;
  const text = async (fr, label, at) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = fr; await window.addTextBlock(); const k = [...fr.querySelectorAll('.text-block')].pop(); k.querySelector('[contenteditable]') ? (k.querySelector('[contenteditable]').textContent = label) : (k.textContent = label);
    const w = unit(k); w.dataset.c1 = label; if (at) { w.style.position = 'absolute'; w.style.left = at[0] + 'px'; w.style.top = at[1] + 'px'; w.dataset.offsetX = at[0]; w.dataset.offsetY = at[1]; } return w; };
  const F = add(null, 860, 420); await text(F, 'a1', [40, 50]); await text(F, 'a2', [300, 50]); await text(F, 'a3', [40, 200]);
  const K = add(null, 860, 300); delete K.dataset.freeLayout; delete K.dataset.height; K.dataset.fullWidth = 'true'; K.style.height = ''; K.style.minHeight = '300px';
  await text(K, 'k1'); await text(K, 'k2'); await text(K, 'k3');
  const G = add(null, 860, 420); [[20, 20], [300, 20], [20, 200]].forEach(([l, t], i) => { const g = add(G, 200, 120, l, t); g.dataset.c1 = 'g' + (i + 1); });
  await window.addSection(); const S2 = [...c.querySelectorAll('.section-block')].pop();
  [F, K, G].forEach((f, i) => { f.dataset.c1 = 'FKG'[i]; });
  window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; c.querySelectorAll('.section-block.selected').forEach((x) => x.classList.remove('selected'));
  window.clearHistory?.(); F.scrollIntoView({ block: 'start' });
  return { S1: sec.id, S2: S2.id, F: F.id, K: K.id, G: G.id };
});
const q = (page, name) => page.evaluate((n) => { const e = document.querySelector(`#canvas [data-c1="${n}"]`); const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, id: e.id }; }, name);
const at = async (page, name, fx, fy) => { const b = await q(page, name); return [b.l + (b.r - b.l) * fx, b.t + (b.b - b.t) * fy]; };
const clickAt = async (page, xy, mod, dbl) => { if (mod) await page.keyboard.down(mod); if (dbl) await page.mouse.dblclick(xy[0], xy[1]); else await page.mouse.click(xy[0], xy[1]); if (mod) await page.keyboard.up(mod); await raf(page); };
const show = (page, name) => page.evaluate((n) => document.querySelector(`#canvas [data-c1="${n}"]`).scrollIntoView({ block: 'center' }), name).then(() => raf(page));
const isSel = (page, name) => page.evaluate((n) => { const w = document.querySelector(`#canvas [data-c1="${n}"]`); return w.classList.contains('selected') || !!w.querySelector(':scope > .text-block.selected, :scope.text-block.selected'); }, name);
const HOST = { a: 'F', k: 'K', g: 'G' };
/* 원본 고르기 — 프레임 한 번(여백) → 첫 자식 더블클릭(B안 진입+선택) → 둘째는 ⇧ */
async function pickSrc(page, src, n) {
  await show(page, HOST[src]); await clickAt(page, await at(page, HOST[src], 0.6, 0.93));
  await clickAt(page, await at(page, src + '1', 0.5, 0.5), null, true);
  if (n === 2) await clickAt(page, await at(page, src + '2', 0.5, 0.5), 'Shift');
  for (let i = 1; i <= n; i++) expect(await isSel(page, src + i), `[전제] ${src}${i} 골라짐`).toBe(true);
}
/* 자리 고르기 */
async function pickTarget(page, tgt, src, s) {
  await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; document.querySelectorAll('#canvas .section-block.selected').forEach((x) => x.classList.remove('selected')); }); await raf(page);
  const H = tgt.host || HOST[src];
  if (tgt.k === 'obj') { await show(page, H); await clickAt(page, await at(page, H, 0.6, 0.93));
    expect(await page.evaluate((n) => { const f = document.querySelector(`[data-c1="${n}"]`); return f.classList.contains('selected') && !f.querySelector('.selected') && window._enteredFrame !== f; }, H), '[전제] ㉡ 프레임을 오브젝트로').toBe(true); }
  if (tgt.k === 'enter') { await show(page, H); await clickAt(page, await at(page, H, 0.6, 0.93)); await clickAt(page, await at(page, H, 0.6, 0.93), null, true);
    expect(await page.evaluate((n) => window._enteredFrame === document.querySelector(`[data-c1="${n}"]`) && !document.querySelector(`[data-c1="${n}"] .selected`), H), '[전제] ㉢ 들어감 · 안 고름').toBe(true); }
  if (tgt.k === 'child') { await show(page, H); await clickAt(page, await at(page, H, 0.6, 0.93)); await clickAt(page, await at(page, src + '3', 0.5, 0.5), null, true);
    expect(await isSel(page, src + '3'), '[전제] ㉠ 자식 골라짐').toBe(true); }
  if (tgt.k === 'sec') { await page.evaluate((S1) => window.selectSection(document.getElementById(S1)), s.S1); await raf(page);
    expect(await page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].every((e) => e.classList.contains('section-block'))), '[전제] ㉣ 섹션만').toBe(true); }
}
const mark = (page) => page.evaluate(() => document.querySelectorAll('#canvas *').forEach((e) => { e.__c1old = true; }));
const ids = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas [id]')].map((e) => e.id).sort().join());
async function paste(page) { const n = await page.evaluate(() => document.querySelectorAll('#canvas *').length); await page.keyboard.press('Meta+v'); await page.waitForFunction((n) => document.querySelectorAll('#canvas *').length > n, n, { timeout: 3000 }); await raf(page); }
/* 붙은 «단위»(새 요소 중 부모가 옛것) — 부모·앞 형제·좌표 */
const fresh = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas *')].filter((e) => !e.__c1old && e.parentElement.__c1old && e.closest('.section-block')).map((e) => ({
  id: e.id, par: e.parentElement.closest('[data-c1]')?.dataset.c1 || (e.parentElement.classList.contains('section-inner') ? 'inner:' + e.closest('.section-block').id : e.parentElement.className),
  prev: ((p) => (p ? ((p.__c1old && p.dataset.c1) || p.id || p.className) : null))(e.previousElementSibling), wrap: e.matches('.frame-block[data-text-frame]'),   // 사본도 data-c1 을 물려받는다 — 옛것만 이름으로 wrap: e.matches('.frame-block[data-text-frame]'),
  pos: e.style.position, x: parseInt(e.style.left) || 0, y: parseInt(e.style.top) || 0,
  afterAll: ['F', 'K', 'G'].every((n) => { const x = document.querySelector(`[data-c1="${n}"]`); return !!x && !!(x.compareDocumentPosition(e) & 4) && !x.contains(e); }) })));
const unitsAt = (page, src, n) => page.evaluate(([src, n]) => [...Array(n)].map((_, i) => { const w = document.querySelector(`[data-c1="${src}${i + 1}"]`); return [parseInt(w.style.left) || 0, parseInt(w.style.top) || 0]; }), [src, n]);
const lastKid = (page, H) => page.evaluate((H) => { const l = document.querySelector(`[data-c1="${H}"]`).lastElementChild; return l?.dataset.c1 || l?.id || l?.className || null; }, H);
const reopen = async (page) => { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await raf(page); };

/* 칸 하나: 짓기 → 원본 고르기 → ⌘C/⌘X → 자리 고르기 → ⌘V → 확인 → ⌘Z 한 번 = 붙이기 전 id 그대로 */
async function cell(page, { src, n, op, tgt, check, roundTrip }) {
  const s = await scene(page); await raf(page);
  const orig = await unitsAt(page, src, n);
  await pickSrc(page, src, n); await page.keyboard.press(op === 'X' ? 'Meta+x' : 'Meta+c'); await raf(page);
  await pickTarget(page, tgt, src, s);
  const H = tgt.host || HOST[src]; const last0 = await lastKid(page, H);
  await mark(page); const before = await ids(page);
  await paste(page);
  const f = await fresh(page);
  const tag = `${src}×${n} ⌘${op} ${tgt.k}${tgt.host ? '→' + tgt.host : ''}`;
  expect(f.length, `${tag} 붙은 단위 수 ${JSON.stringify(f)}`).toBe(n);
  await check(f, { orig, last0, s, tag, H });
  if (roundTrip) {
    const want = JSON.stringify((await fresh(page)).map((u) => [u.par, u.pos, u.x, u.y]));
    await page.evaluate(() => { window._c1keep = JSON.parse(window.serializeProject()); });
    await reopen(page); await mark(page);
    const got = await page.evaluate((idl) => idl.map((id) => { const e = document.getElementById(id); return e && [e.parentElement.closest('[data-c1]')?.dataset.c1 || (e.parentElement.classList.contains('section-inner') ? 'inner:' + e.closest('.section-block').id : e.parentElement.className), e.style.position, parseInt(e.style.left) || 0, parseInt(e.style.top) || 0]; }), f.map((u) => u.id));
    expect(JSON.stringify(got), `${tag} 저장 왕복`).toBe(want);
    return;
  }
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); }); await page.keyboard.press('Meta+z'); await raf(page);
  expect(await ids(page), `${tag} ⌘Z 한 번 = 붙이기 전`).toBe(before);
}

/* 기대 — 프레임 안 끝(㉡㉢) */
const intoEnd = (free) => async (f, { orig, last0, tag, H }) => {
  expect(f.map((u) => u.par), `${tag} 부모`).toEqual(f.map(() => H));
  expect(f[0].prev, `${tag} 맨 끝에 붙음(첫째 앞 = 붙이기 전 마지막)`).toBe(last0);
  if (f[1]) expect(f[1].prev, `${tag} 순서 유지`).toBe(f[0].id);
  if (free) {
    expect(f.map((u) => u.pos), `${tag} 좌표째`).toEqual(f.map(() => 'absolute'));
    expect([f[0].x, f[0].y], `${tag} 첫째 = 원본+20`).toEqual([orig[0][0] + 20, orig[0][1] + 20]);
    if (f[1]) expect([f[1].x - f[0].x, f[1].y - f[0].y], `${tag} 간격 유지`).toEqual([orig[1][0] - orig[0][0], orig[1][1] - orig[0][1]]);
    if (H === 'F') expect(f.every((u) => u.wrap), `${tag} 글자 래퍼째`).toBe(true);
  } else expect(f.map((u) => u.pos), `${tag} 흐름`).toEqual(f.map(() => ''));
};
const secEnd = async (f, { s, tag }) => {
  expect(f.map((u) => u.par), `${tag} 섹션 S1 직속`).toEqual(f.map(() => 'inner:' + s.S1));
  expect(f.map((u) => u.pos), `${tag} 흐름`).toEqual(f.map(() => ''));
  expect(f.map((u) => u.afterAll), `${tag} 섹션 끝(F·K·G 뒤)`).toEqual(f.map(() => true));
};
const homeStep = (H) => async (f, { orig, tag }) => {
  expect(f.map((u) => u.par), `${tag} 원래 부모`).toEqual(f.map(() => H));
  expect(f.map((u) => [u.pos, u.x, u.y]), `${tag} 원본 옆 +20`).toEqual(orig.map(([x, y]) => ['absolute', x + 20, y + 20]));
};
const afterChildFree = (src) => async (f, { orig, tag, H }) => {
  expect(f.map((u) => u.par), `${tag} 같은 프레임`).toEqual(f.map(() => H));
  expect(f.map((u) => u.pos), `${tag} 좌표째`).toEqual(f.map(() => 'absolute'));
  if (src === 'a') expect(f.every((u) => u.wrap), `${tag} 글자 래퍼째`).toBe(true);
  if (src === 'g') expect(f[0].prev, `${tag} 고른 g3 다음`).toBe('g3');
  if (f[1]) expect([f[1].x - f[0].x, f[1].y - f[0].y], `${tag} 간격 유지`).toEqual([orig[1][0] - orig[0][0], orig[1][1] - orig[0][1]]);
};
const afterChildStack = async (f, { tag }) => {
  expect(f.map((u) => u.par), `${tag} 같은 프레임`).toEqual(f.map(() => 'K'));
  expect(f[0].prev, `${tag} 고른 k3 다음`).toBe('k3');
  expect(f.map((u) => u.pos), `${tag} 흐름`).toEqual(f.map(() => ''));
};

const ROWS = [
  // [이름, 원본, 자리, 기대, 바뀌는 칸(양성대조에서 빨강이어야 할 칸)]
  ['㉡ 자유 글자', 'a', { k: 'obj' }, intoEnd(true)],
  ['㉡ 자유 안 프레임', 'g', { k: 'obj' }, intoEnd(true)],
  ['㉡ 스택 글자', 'k', { k: 'obj' }, intoEnd(false)],
  ['㉡ 자유 글자 → 스택 프레임(비지 않음)', 'a', { k: 'obj', host: 'K' }, intoEnd(false)],
  ['㉢ 자유 글자', 'a', { k: 'enter' }, intoEnd(true)],
  ['㉢ 자유 안 프레임', 'g', { k: 'enter' }, intoEnd(true)],
  ['㉢ 스택 글자', 'k', { k: 'enter' }, intoEnd(false)],
  ['㉠ 자유 글자', 'a', { k: 'child' }, afterChildFree('a')],
  ['㉠ 자유 안 프레임', 'g', { k: 'child' }, afterChildFree('g')],
  ['㉠ 스택 글자', 'k', { k: 'child' }, afterChildStack],
  ['㉣ 자유 글자', 'a', { k: 'sec' }, secEnd],
  ['㉣ 자유 안 프레임', 'g', { k: 'sec' }, secEnd],
  ['㉣ 스택 글자', 'k', { k: 'sec' }, secEnd],
  ['㉤ 자유 글자', 'a', { k: 'none' }, homeStep('F')],
  ['㉤ 자유 안 프레임', 'g', { k: 'none' }, homeStep('G')],
];
for (const [name, src, tgt, check] of ROWS) {
  test(`${name} — ⌘C·⌘X × 하나·둘 · ⌘Z 한 번${tgt.k === 'obj' || tgt.k === 'enter' ? ' · 저장 왕복' : ''}`, async ({ page }) => {
    const errs = await open(page);
    for (const op of ['C', 'X']) for (const n of [1, 2]) {
      await cell(page, { src, n, op, tgt, check });
      if (tgt.k === 'obj' || tgt.k === 'enter') await cell(page, { src, n, op, tgt, check, roundTrip: true });
    }
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('㉤ ⌘X ⌘V ⌘Z ⌘V — 두 번 다 원래 부모 안 원본 옆 +20', async ({ page }) => {
  const errs = await open(page);
  for (const n of [1, 2]) {
    await scene(page); await raf(page); const orig = await unitsAt(page, 'a', n);
    await pickSrc(page, 'a', n); await page.keyboard.press('Meta+x'); await raf(page);
    await pickTarget(page, { k: 'none' }, 'a', {});
    await mark(page); await paste(page); const f1 = await fresh(page);
    await page.keyboard.press('Meta+z'); await raf(page);
    await pickTarget(page, { k: 'none' }, 'a', {});
    await mark(page); await paste(page); const f2 = await fresh(page);
    for (const f of [f1, f2]) await homeStep('F')(f, { orig, tag: `a×${n} ⌘X⌘V⌘Z⌘V` });
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⚠️자유 프레임 글자 «하나»(freeLayout 갈래)는 고른 자유 프레임 «안»이 옛 잠금(frame-mode-roundtrip-294l B-2)이라 이 표 밖 — 보고에 결정거리로 올림. */
test('㉠ 안쪽(깊이 2) 프레임을 오브젝트로 고름 — ⌘V 는 그 «다음 자리»(안이 아니다)', async ({ page }) => {
  const errs = await open(page);
  for (const [src, n] of [['a', 2], ['g', 1], ['g', 2]]) {
    await scene(page); await raf(page);
    await pickSrc(page, src, n); await page.keyboard.press('Meta+c'); await raf(page);
    await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; }); await raf(page);
    await show(page, 'G'); await clickAt(page, await at(page, 'G', 0.6, 0.93)); await clickAt(page, await at(page, 'g3', 0.5, 0.85), null, true);
    expect(await page.evaluate(() => { const g = document.querySelector('[data-c1="g3"]'); return g.classList.contains('selected') && !g.querySelector('.selected'); }), '[전제] g3 오브젝트').toBe(true);
    const g3kids = await page.evaluate(() => document.querySelector('[data-c1="g3"]').children.length);
    await mark(page); await paste(page); const f = await fresh(page);
    const tag = `${src}×${n} → g3`;
    expect(f.map((u) => u.par), `${tag} G 안(g3 안 아님)`).toEqual(f.map(() => 'G'));
    expect(f[0].prev, `${tag} g3 다음`).toBe('g3');
    expect(f.map((u) => u.pos), `${tag} 좌표째`).toEqual(f.map(() => 'absolute'));
    expect(await page.evaluate(() => document.querySelector('[data-c1="g3"]').children.length), `${tag} g3 자식 그대로`).toBe(g3kids);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 옛 버그(1109t1C1 범위) — 자유 프레임 안 글자 여럿 ⌘C⌘V 는 래퍼·absolute 를 잃고 흐름으로 떨어졌다(copySelected 멀티 갈래가 맨 글자만 담음). */
test('자유 프레임 안 글자 둘·셋 ⌘C⌘V — 글자 래퍼째 · absolute · 원본 옆 +20 · 대조: 흐름 글자 둘은 흐름', async ({ page }) => {
  const errs = await open(page);
  for (const n of [2, 3]) {
    await scene(page); await raf(page); const orig = await unitsAt(page, 'a', n);
    await pickSrc(page, 'a', 2); if (n === 3) await clickAt(page, await at(page, 'a3', 0.5, 0.5), 'Shift');
    await page.keyboard.press('Meta+c'); await raf(page); await mark(page); await paste(page);
    const f = await fresh(page);
    expect(f.length, '단위 수').toBe(n);
    expect(f.map((u) => [u.par, u.wrap, u.pos, u.x, u.y]), `글자 ${n}`).toEqual(orig.map(([x, y]) => ['F', true, 'absolute', x + 20, y + 20]));
  }
  await scene(page); await raf(page);
  await pickSrc(page, 'k', 2); await page.keyboard.press('Meta+c'); await raf(page); await mark(page); await paste(page);
  const k = await fresh(page);
  expect(k.map((u) => [u.par, u.pos]), '대조 — 스택 글자 둘은 흐름 그대로').toEqual([['K', ''], ['K', '']]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
