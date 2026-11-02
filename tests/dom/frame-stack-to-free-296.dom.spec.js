/* frame-stack-to-free-296 — 현빈 0.9.10 FRAME-STACK-TO-FREE-NO-WAY-BACK-01: stack → free (피그마 Remove auto layout). 자식이 지금 자리·크기 그대로 좌표로 고정된다.
 * 칸: F1 자리·크기·프레임·이웃 불변 · 투명 간격 블럭 걷힘 · 패널 줄 F1b 소수 자리 그대로 F2 ⌘Z 한 번·⌘⇧Z F3 안쪽 프레임 모드 그대로(깊이 3) F4 줌 40 도 같다
 *     F5 끌기가 좌표로 된다 F6 free→stack→free 왕복 — 옛 free 좌표 안 되살림 · 자리 유지 F7 다시 묶어도(rebindAll) 유지 N1 [음성] 이웃·버즈 Layout 무접촉
 * 양성대조: _convertStackToFree 를 걷으면(free 단추 없음) F1~F7 빨강 · N1 초록. F8 은 그리드 폭 줄을, F9·F10 은 transform 푸는 줄을 걷으면 빨강. 장면 준비만 evaluate — 고르기·단추·끌기·키는 진짜. 자리는 offset(레이아웃 px)으로 재 줌을 안 탄다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function scene(page, { zoom = 100, depth = 2, grid = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page);
  const ids = await page.evaluate(async ({ zoom, depth, grid }) => {
    const FR = '.frame-block:not([data-text-frame])';
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const within = (par, fn, sel) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const b = new Set(sec.querySelectorAll(sel)); fn(); const e = [...sec.querySelectorAll(sel)].find((x) => !b.has(x)); window._activeFrame = null; return e; };
    const frame = (par, opts) => within(par, () => window.addFrameBlock(opts), FR);
    const gap = (par, h) => { const g = window.makeGapBlock(); g.style.height = h + 'px'; g.dataset.h = h; par.appendChild(g); window.bindBlock?.(g); };
    const root = frame(null, { fullWidth: true });
    gap(root, 24);
    const text = within(root, () => window.addTextBlock('body', { content: '글자 AAA' }), '.text-block').closest('.frame-block[data-text-frame]');
    gap(root, 30);
    const tbl = within(root, () => window.addTableBlock(), '.table-block'); const row = tbl.closest('.row') || tbl; if (!row.id) row.id = 'tRow';
    gap(root, 16);
    const gridEl = grid ? within(root, () => window.addGridBlock({ cols: 3 }), '.grid-block') : null;
    const chain = []; let par = root;
    for (let d = 2; d <= depth; d++) { const f = frame(par, { fullWidth: true }); within(f, () => window.addTextBlock('body', { content: 'd' + d }), '.text-block'); chain.push(f.id); par = f; }
    const nb = frame(null, {}); window.updateFrameBlock(nb.id, { width: 400, height: 120 });
    window.deselectAll(); window.clearHistory?.(); window.applyZoom?.(zoom); root.scrollIntoView({ block: 'center' });
    return { root: root.id, text: text.id, row: row.id, chain, nb: nb.id, grid: gridEl?.id };
  }, { zoom, depth, grid });
  await page.waitForFunction((zoom) => { const t = document.getElementById('canvas-scaler')?.style.transform; const same = t === window.__zt; window.__zt = t; return same && (zoom === 100 || /scale/.test(t || '')); }, zoom, { polling: 150 });
  await raf(page); return { errs, ...ids };
}
/* 뿌리 기준 레이아웃 자리·크기 — 자손 전부 */
const snap = (page, root) => page.evaluate((rid) => { const r = document.getElementById(rid); const off = (el) => { let x = 0, y = 0; for (let e = el; e && e !== r; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y]; }; const it = {}; r.querySelectorAll('.text-block,.table-block,.frame-block,.grid-block').forEach((e) => { it[e.id] = [...off(e), e.offsetWidth, e.offsetHeight]; }); return { it, h: r.offsetHeight, w: r.offsetWidth, mode: r.dataset.freeLayout || 'stack', gaps: r.querySelectorAll(':scope > .gap-block').length }; }, root);
const sameSpots = (a, b) => { expect(Object.keys(b.it).sort()).toEqual(Object.keys(a.it).sort()); for (const k of Object.keys(a.it)) a.it[k].forEach((v, i) => expect(Math.abs(b.it[k][i] - v), `${k} 칸${i}`).toBeLessThanOrEqual(1)); };
const pickRoot = async (page, id) => { const L = await page.evaluate((id) => { const it = document.getElementById(id)._layerItem; it.scrollIntoView({ block: 'center' }); const q = it.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, id); await page.mouse.click(L[0], L[1]); await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), '[전제] 프레임 고름').toBe(true); };
const toFree = async (page) => { await page.locator('#ss-to-free-btn').click(); await expect(page.locator('#ss-to-stack-btn'), '패널이 free 로').toBeVisible(); };
const nbBox = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight, e.dataset.freeLayout]; }, id);

test('F1 stack → free — 자리·크기·프레임 그대로 · 자식 좌표 · 투명 간격 걷힘 · 이웃 그대로', async ({ page }) => {
  const { errs, root, text, row, nb } = await scene(page); const nb0 = await nbBox(page, nb);
  await pickRoot(page, root); const s0 = await snap(page, root); expect(s0.mode).toBe('stack'); expect(s0.gaps).toBe(3);
  await toFree(page);
  const s1 = await snap(page, root); sameSpots(s0, s1);
  expect([s1.mode, s1.gaps, s1.w], '모드·간격·폭').toEqual(['true', 0, s0.w]); expect(Math.abs(s1.h - s0.h)).toBeLessThanOrEqual(1);
  const at = await page.evaluate(([t, r]) => [t, r].map((i) => { const e = document.getElementById(i); return [e.style.position, e.dataset.offsetX === String(Math.round(parseFloat(e.style.left))), e.dataset.offsetY === String(Math.round(parseFloat(e.style.top)))]; }), [text, row]);
  expect(at).toEqual([['absolute', true, true], ['absolute', true, true]]);
  expect(await nbBox(page, nb), '이웃').toEqual(nb0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F1b 화면 자리 소수까지 그대로 — 표 줄의 화면 위치가 안 변한다', async ({ page }) => {
  const { errs, root, row } = await scene(page); await pickRoot(page, root);
  const rel = () => page.evaluate(([r, c]) => { const a = document.getElementById(r), q = a.getBoundingClientRect(), k = q.width / a.offsetWidth; return (document.getElementById(c).getBoundingClientRect().top - q.top) / k; }, [root, row]);
  const y0 = await rel(); await toFree(page); expect(Math.abs((await rel()) - y0), '반올림으로 튀지 않는다').toBeLessThan(0.02);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F2 ⌘Z 한 번에 stack · ⌘⇧Z 에 free', async ({ page }) => {
  const { errs, root } = await scene(page); await pickRoot(page, root); const s0 = await snap(page, root); await toFree(page); const s1 = await snap(page, root);
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z');
  await expect.poll(() => snap(page, root).then((s) => s.mode), '⌘Z').toBe('stack'); const u = await snap(page, root); expect(u.gaps).toBe(3); sameSpots(s0, u);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => snap(page, root).then((s) => s.mode), '⌘⇧Z').toBe('true'); sameSpots(s1, await snap(page, root));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F3 깊이 3 — 그 프레임 한 층만 바뀌고 안쪽은 stack 그대로', async ({ page }) => {
  const { errs, root, chain } = await scene(page, { depth: 3 }); await pickRoot(page, root); const s0 = await snap(page, root); await toFree(page);
  sameSpots(s0, await snap(page, root));
  expect(await page.evaluate((c) => c.map((i) => document.getElementById(i).dataset.freeLayout || 'stack'), chain)).toEqual(['stack', 'stack']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F4 줌 40 — 좌표가 줌을 안 먹는다', async ({ page }) => {
  const { errs, root } = await scene(page, { zoom: 40 }); await pickRoot(page, root); const s0 = await snap(page, root); await toFree(page);
  sameSpots(s0, await snap(page, root));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F5 전환 뒤 자식 끌기가 좌표로 된다', async ({ page }) => {
  const { errs, root, text } = await scene(page); await pickRoot(page, root); await toFree(page);
  const before = await page.evaluate((id) => document.getElementById(id).style.left, text);
  const q = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, text);
  const cx = q[0] + q[2] / 2, cy = q[1] + q[3] / 2;
  await page.mouse.click(cx, cy); await raf(page); await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + q[2] * 0.1, cy, { steps: 6 }); await page.mouse.up(); await raf(page);
  await expect.poll(() => page.evaluate((id) => parseInt(document.getElementById(id).style.left), text), '가로로 옮겨졌다').toBeGreaterThan(parseInt(before));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F6 free → stack → free 왕복 — 자리 유지 · 옛 좌표 안 되살림', async ({ page }) => {
  const { errs, root, text } = await scene(page); await pickRoot(page, root); await toFree(page); const s1 = await snap(page, root);
  await page.evaluate((id) => { const e = document.getElementById(id); e.style.top = (parseInt(e.style.top) + 3) + 'px'; }, text);   // free 에서 조금 옮긴 값 — 다음 전환이 흐름 자리로 세워야 한다
  const s1b = await snap(page, root);
  await page.locator('#ss-to-stack-btn').click(); await expect(page.locator('#ss-to-free-btn'), 'stack 으로').toBeVisible(); const s2 = await snap(page, root);
  await toFree(page); const s3 = await snap(page, root); sameSpots(s2, s3);
  expect(s3.mode).toBe('true'); expect(s1.mode).toBe('true'); expect(s1b.it[text][1]).toBe(s1.it[text][1] + 3);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F7 다시 묶어도(rebindAll · 재오픈 길) free · 자리 유지', async ({ page }) => {
  const { errs, root } = await scene(page); await pickRoot(page, root); await toFree(page); const s1 = await snap(page, root);
  await page.evaluate(() => window.rebindAll?.()); await raf(page); const s2 = await snap(page, root); expect(s2.mode).toBe('true'); sameSpots(s1, s2);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F8 그리드 든 stack — 그리드가 프레임의 80% 로 안 줄고 ⌘Z 로 돌아온다 · 다시 묶어도 그 폭', async ({ page }) => {
  const { errs, root, grid } = await scene(page, { grid: true }); await pickRoot(page, root); const s0 = await snap(page, root);
  expect(s0.it[grid][2], '[전제] 그리드가 프레임 폭').toBe(s0.w);
  await toFree(page); const s1 = await snap(page, root); sameSpots(s0, s1); expect(s1.it[grid][2]).toBe(s0.it[grid][2]);
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z');
  await expect.poll(() => snap(page, root).then((s) => s.mode), '⌘Z').toBe('stack'); sameSpots(s0, await snap(page, root));
  await page.keyboard.press('Meta+Shift+z'); await expect.poll(() => snap(page, root).then((s) => s.mode), '⌘⇧Z').toBe('true');
  await page.evaluate(() => window.rebindAll?.()); await raf(page); expect((await snap(page, root)).it[grid][2], '다시 묶은 뒤').toBe(s0.it[grid][2]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
/* 회전 상자의 자리 — 회전은 중심축이라 bbox 가 안 변해야 안 튄 것이다. 프레임 기준이 아니라 캔버스 기준으로 잰다. */
const boxes = (page, ids) => page.evaluate((ids) => { const c = document.getElementById('canvas').getBoundingClientRect(); return ids.map((i) => { const q = document.getElementById(i).getBoundingClientRect(); return [q.left - c.left, q.top - c.top, q.width, q.height]; }); }, ids);
const sameBoxes = (a, b) => a.forEach((x, i) => x.forEach((v, j) => expect(Math.abs(b[i][j] - v), `상자${i} 칸${j} ${v}→${b[i][j]}`).toBeLessThan(0.02)));
test('F9 회전한 stack — 줄 폭이 안 줄고 자식 상자가 안 튄다 · 회전 그대로 · ⌘Z', async ({ page }) => {
  const { errs, root, text, row } = await scene(page); await pickRoot(page, root);
  const deg = page.locator('#ss-rotate-deg'); await deg.fill('15'); await deg.press('Tab');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).style.transform, root), '[전제] 회전').toContain('rotate(15deg)');
  const ids = [root, text, row]; const s0 = await snap(page, root), b0 = await boxes(page, ids);
  await toFree(page); sameSpots(s0, await snap(page, root)); sameBoxes(b0, await boxes(page, ids));
  expect(await page.evaluate((id) => document.getElementById(id).style.transform, root)).toContain('rotate(15deg)');
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z');
  await expect.poll(() => snap(page, root).then((s) => s.mode), '⌘Z').toBe('stack'); sameBoxes(b0, await boxes(page, ids));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F10 회전한 자식 — 그 자식 상자가 소수까지 안 튄다 · 회전 그대로', async ({ page }) => {
  const { errs, root, chain } = await scene(page, { depth: 2 }); const f = chain[0];
  await page.evaluate((id) => { const e = document.getElementById(id); e.classList.add('selected'); window.showFrameProperties(e); }, f);
  const deg = page.locator('#ss-rotate-deg'); await deg.fill('15'); await deg.press('Tab');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).style.transform, f), '[전제] 회전').toContain('rotate(15deg)');
  await page.evaluate(() => window.deselectAll()); await pickRoot(page, root);
  const b0 = await boxes(page, [f]); await toFree(page); sameBoxes(b0, await boxes(page, [f]));
  expect(await page.evaluate((id) => document.getElementById(id).style.transform, f)).toContain('rotate(15deg)');
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('N1 [음성] free 프레임은 stack 단추 그대로 · free 단추 없음', async ({ page }) => {
  const { errs, nb } = await scene(page); await pickRoot(page, nb);
  await expect(page.locator('#ss-to-stack-btn')).toBeVisible(); await expect(page.locator('#ss-to-free-btn')).toHaveCount(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
