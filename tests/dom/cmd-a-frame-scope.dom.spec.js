/* cmd-a-frame-scope — 현빈 결정 6524: ⌘A 는 프레임 안이면 그 프레임 안만 고른다.
 *   들어감(자식 더블·여백 더블) = 그 프레임 안만 · 안 들어감(프레임 한 번 클릭) · 프레임 밖 = 전과 같음(섹션 전체 더하기).
 *   뒤이은 Delete·⌘X·⌘D 는 프레임을 남기고 안만 다룬다. ⌘C·⌘X·⌘D 는 앱에서 누르지 않는다(OS 클립보드) — 여기(헤드리스)서만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const FR = '.frame-block:not([data-text-frame])';

/* S1{O1, F{K1, K2, G{K3}}} · S2{O2} — 제품 함수로 짓는다 */
async function scene(page, { stack = false, empty = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  return page.evaluate(async ({ stack, empty, FR }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const S1 = [...c.querySelectorAll('.section-block')].pop();
    await window.addSection(); const S2 = [...c.querySelectorAll('.section-block')].pop();
    const made = (sec, sel, fn) => { const b = new Set(sec.querySelectorAll(sel)); fn(); return [...sec.querySelectorAll(sel)].find((x) => !b.has(x)); };
    const text = (sec, fr) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = fr || null; return made(sec, '.text-block', () => window.addTextBlock('body')); };
    const frame = (sec, fr) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = fr || null; return made(sec, FR, () => window.addFrameBlock()); };
    const place = (t, top) => { const u = t.closest('.frame-block[data-text-frame]') || t; u.style.left = '40px'; u.style.top = top + 'px'; u.style.width = '260px'; };
    const O1 = text(S1), O2 = text(S2), F = frame(S1);
    const ids = { S1: S1.id, S2: S2.id, O1: O1.id, O2: O2.id, F: F.id };
    if (!empty) {
      const K1 = text(S1, F), K2 = text(S1, F); place(K1, 30); place(K2, 170);
      const G = frame(S1, F); G.style.position = 'absolute'; G.style.left = '40px'; G.style.top = '310px'; G.style.width = '300px'; G.style.height = '160px';
      const K3 = text(S1, G); place(K3, 10);
      Object.assign(ids, { K1: K1.id, K2: K2.id, G: G.id, K3: K3.id });
    }
    F.style.height = '560px'; F.style.minHeight = '560px';
    if (stack && !window.__convertFreeLayoutToStack(F)) throw new Error('[전제] 스택 변환 실패');
    ids.stack = F.dataset.freeLayout !== 'true';
    window.deselectAll(); window._activeFrame = null; window.applyZoom?.(60);
    F.scrollIntoView({ block: 'center' });
    return ids;
  }, { stack, empty, FR }).then(async (ids) => { await settled(page, ids.F); return ids; });
}
/* 줌이 늦게 선다 — 상자가 연속 다섯 프레임 그대로일 때까지(첫 클릭 뒤 자리가 바뀌면 더블클릭이 빗나간다) */
const settled = (page, id) => page.waitForFunction((id) => {
  const r = document.getElementById(id).getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].join();
  window.__sk = window.__sk === k ? window.__sk : (window.__sn = 0, k);
  return ++window.__sn >= 5;
}, id, { polling: 'raf' });
const pt = (page, id, fx = 0.5, fy = 0.5) => page.evaluate(({ id, fx, fy }) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width * fx, y: r.top + r.height * fy }; }, { id, fx, fy });
const named = (page, ids) => page.evaluate((ids) => Object.entries(ids).filter(([, v]) => typeof v === 'string' && document.getElementById(v)?.classList.contains('selected')).map(([k]) => k).sort(), ids);
const alive = (page, ids) => page.evaluate((ids) => Object.entries(ids).filter(([, v]) => typeof v === 'string' && document.getElementById(v)).map(([k]) => k).sort(), ids);
const leafSel = (page, ids) => named(page, ids).then((a) => a.filter((k) => /^[OK]\d$/.test(k)));

async function clickOn(page, id, { dbl = false, fx, fy } = {}) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
  await settled(page, id);
  const q = await pt(page, id, fx, fy);
  if (dbl) await page.mouse.dblclick(q.x, q.y); else await page.mouse.click(q.x, q.y);
}
/* 들어가기 — 끝난 뒤 그 상태를 [전제]로 잰다 */
async function enterByKid(page, ids) {
  await clickOn(page, ids.K1, { dbl: true });
  await page.waitForFunction((id) => document.getElementById(id).querySelector('.selected'), ids.F);
  expect(await page.evaluate(() => !!document.querySelector('#canvas .editing')), '[전제] 편집 아님').toBe(false);
}
async function enterByMargin(page, ids) {
  await clickOn(page, ids.F, { dbl: true, fx: 0.9, fy: 0.97 });
  await page.waitForFunction((id) => window._enteredFrame?.id === id, ids.F);
}
const cmd = (page, k) => page.keyboard.press('Meta+' + k);

for (const stack of [false, true]) {
  const tag = stack ? '스택' : '자유';
  test(`A1 ${tag} 들어감(자식 더블) ⌘A = 그 프레임 안만`, async ({ page }) => {
    const ids = await scene(page, { stack });
    expect(ids.stack, '[전제] 프레임 꼴').toBe(stack);
    await enterByKid(page, ids);
    await cmd(page, 'a');
    expect(await leafSel(page, ids)).toEqual(['K1', 'K2', 'K3']);
  });
  test(`A2 ${tag} 들어감(여백 더블) ⌘A = 그 프레임 안만`, async ({ page }) => {
    const ids = await scene(page, { stack });
    await enterByMargin(page, ids);
    await cmd(page, 'a');
    expect(await leafSel(page, ids)).toEqual(['K1', 'K2', 'K3']);
  });
  test(`B ${tag} 안 들어감(프레임 한 번 클릭) ⌘A = 전과 같음(섹션 전체)`, async ({ page }) => {
    const ids = await scene(page, { stack });
    await clickOn(page, ids.F, { fx: 0.9, fy: 0.97 });
    await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), ids.F);
    await cmd(page, 'a');
    expect(await leafSel(page, ids)).toEqual(['K1', 'K2', 'K3', 'O1']);
    expect(await named(page, ids), '더하기 — 고른 프레임이 그대로').toContain('F');
  });
  test(`D ${tag} ⌘A→Delete = 프레임은 두고 안만 · 밖은 그대로 · ⌘Z 복구`, async ({ page }) => {
    const ids = await scene(page, { stack });
    await enterByKid(page, ids);
    await cmd(page, 'a');
    await page.keyboard.press('Delete');
    expect(await alive(page, ids)).toEqual(['F', 'G', 'O1', 'O2', 'S1', 'S2']);
    await cmd(page, 'z');
    await page.waitForFunction((id) => !!document.getElementById(id), ids.K1);
    expect(await alive(page, ids)).toEqual(['F', 'G', 'K1', 'K2', 'K3', 'O1', 'O2', 'S1', 'S2']);
  });
  test(`X ${tag} ⌘A→⌘X = 프레임은 두고 안만 · 밖은 그대로`, async ({ page }) => {
    const ids = await scene(page, { stack });
    await enterByKid(page, ids);
    await cmd(page, 'a');
    await cmd(page, 'x');
    expect(await alive(page, ids)).toEqual(['F', 'G', 'O1', 'O2', 'S1', 'S2']);
    const n = () => page.evaluate((id) => document.getElementById(id).querySelectorAll('.text-block').length, ids.S1);
    const left = await n();
    await cmd(page, 'v');
    await page.waitForFunction(({ id, n }) => document.getElementById(id).querySelectorAll('.text-block').length > n, { id: ids.S1, n: left });
    expect(await n() - left, '⌘V 가 잘라낸 셋을 다 되돌린다').toBe(3);
  });
  test(`M ${tag} ⌘A→⌘D = 프레임 안 글자만 늘고 밖은 그대로`, async ({ page }) => {
    const ids = await scene(page, { stack });
    await enterByKid(page, ids);
    await cmd(page, 'a');
    const count = () => page.evaluate((ids) => ({ inF: document.getElementById(ids.F).querySelectorAll('.text-block').length, s1: document.getElementById(ids.S1).querySelectorAll('.text-block').length, s2: document.getElementById(ids.S2).querySelectorAll('.text-block').length, frames: document.querySelectorAll('#canvas ' + '.frame-block:not([data-text-frame])').length }), ids);
    const before = await count();
    await cmd(page, 'd');
    await page.waitForFunction(({ id, n }) => document.getElementById(id).querySelectorAll('.text-block').length > n, { id: ids.S1, n: before.s1 });
    const after = await count();
    // 수는 안 잠근다: 자유 프레임 ⌘D 는 여러 개를 골라도 첫 하나만 복제한다(⌘A 없이 고른 셋도 +1 · 별건)
    expect(after.inF - before.inF, '사본이 프레임 안').toBe(after.s1 - before.s1);
    expect(after.s2).toBe(before.s2);
    expect(await alive(page, ids), '원본 그대로').toEqual(['F', 'G', 'K1', 'K2', 'K3', 'O1', 'O2', 'S1', 'S2']);
  });
}

test('A3 ⌘A 두 번 = 같은 범위', async ({ page }) => {
  const ids = await scene(page);
  await enterByKid(page, ids);
  await cmd(page, 'a');
  await cmd(page, 'a');
  expect(await leafSel(page, ids)).toEqual(['K1', 'K2', 'K3']);
});
test('A4 안쪽 프레임에 들어가 있으면 그 안쪽만', async ({ page }) => {
  const ids = await scene(page);
  await enterByKid(page, ids);
  await clickOn(page, ids.G, { dbl: true, fx: 0.5, fy: 0.9 });
  await page.waitForFunction((id) => window._enteredFrame?.id === id, ids.G);
  await cmd(page, 'a');
  expect(await leafSel(page, ids)).toEqual(['K3']);
});
test('A5 프레임 안에서 안쪽 프레임을 고르고 ⌘A = 바깥 프레임 안 전부', async ({ page }) => {
  const ids = await scene(page);
  await enterByKid(page, ids);
  await clickOn(page, ids.G, { fx: 0.5, fy: 0.9 });
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected') && !document.getElementById(id).querySelector('.selected'), ids.G);
  await cmd(page, 'a');
  expect(await leafSel(page, ids)).toEqual(['K1', 'K2', 'K3']);
});
test('A6 프레임 안 글자에 밖 글자가 섞여 골라졌으면 «안»이 아니다 = 전과 같음', async ({ page }) => {
  const ids = await scene(page);
  await enterByKid(page, ids);
  await page.evaluate((id) => document.getElementById(id).classList.add('selected'), ids.O2);
  expect(await leafSel(page, ids), '[전제] 밖이 섞였다').toContain('O2');
  await cmd(page, 'a');
  expect(await leafSel(page, ids), '더하기').toEqual(['K1', 'K2', 'K3', 'O1', 'O2']);
});
test('E 빈 프레임에 들어가 ⌘A = 아무것도 안 고른다', async ({ page }) => {
  const ids = await scene(page, { empty: true });
  await enterByMargin(page, ids);
  const before = await named(page, ids);
  await cmd(page, 'a');
  expect(await named(page, ids)).toEqual(before);
});
test('C1 프레임 밖 글자 ⌘A = 전과 같음(그 섹션 전체)', async ({ page }) => {
  const ids = await scene(page);
  await clickOn(page, ids.O1);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), ids.O1);
  await cmd(page, 'a');
  expect(await leafSel(page, ids)).toEqual(['K1', 'K2', 'K3', 'O1']);
});
test('C2 다른 섹션 글자 ⌘A = 전과 같음', async ({ page }) => {
  const ids = await scene(page);
  await clickOn(page, ids.O2);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), ids.O2);
  await cmd(page, 'a');
  expect(await leafSel(page, ids)).toEqual(['O2']);
});
test('C3 아무것도 안 골랐을 때 ⌘A = 전과 같음(첫 섹션 전체)', async ({ page }) => {
  const ids = await scene(page);
  await cmd(page, 'a');
  expect(await leafSel(page, ids)).toEqual(['K1', 'K2', 'K3', 'O1']);
});
