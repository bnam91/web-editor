/* grid-nested-outer-select.dom.spec.js — 1109t1A1 (현빈 「그리드 칸분리 줄 삭제가 안됨 (나란히 두칸으로 나누기 기능으로 추가한 줄)
 *   … 바깥줄 고르기가 안되서 위아래 이동도 안되는 문제」).
 * ★병: 바깥 «나란히 두 칸» 줄(.grd-nested[data-line])을 고를 길이 없었다 — 열이 줄을 꽉 채우고, 남은 8px 틈은 중첩 거터가 덮고,
 *   안 줄에서 Esc 는 곧장 블럭으로 올랐다. 고르기만 되면 ⌘↑/⌘↓·⌫·⌘Z 는 이미 돈다(플래너 대조군).
 * ★고친 길 셋 — Esc 한 단계 오르기 · 패널 「바깥 줄 고르기」 · 중첩 거터 «클릭»(끌기는 그대로 비율).
 *   O1 안 줄 → Esc → 바깥 줄 {0,0,1}(np 없음)·마커·손잡이 → Esc → 블럭
 *   O2 ⌘↑/⌘↓ 로 바깥 줄 이동 · O3 ⌫ 로 바깥 줄 삭제(블럭은 남음) + ⌘Z 한 번 복원
 *   O4 패널 단추 = O1 과 같은 상태 → ⌫ · O5 거터 클릭 = 고르기(이력 0) · 거터 끌기 = 비율 바뀜 + 이력 1 + ⌘Z 한 번 복원
 * 실행: tests/dom/playwright.dom.config.js grid-nested-outer-select */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const COND_MS = 15000;
const frames2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
async function clickAt(page, sel, opts) { const r = await waitStableRect(page, sel); await page.mouse.click(r.cx, r.cy, opts); await frames2(page); return r; }

/** 섹션 + 플로팅 Grid 단추 + 줄 우클릭 + 진짜 「나란히 두 칸」 ⇒ 칸(0,0) = [body, duo]. 돌려주는 값 = 블럭 id */
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await expect.poll(() => page.evaluate(() => !!window.getSelectedSection?.())).toBe(true);
  await page.evaluate(() => window.applyZoom?.(100));
  await page.waitForFunction(() => {
    const S = document.getElementById('canvas-scaler');
    if (!S || S.getAnimations().length) return false;
    const m = /^matrix\(([^,]+),/.exec(getComputedStyle(S).transform);
    return !!m && Math.abs(Number(m[1]) - 1) < 1e-3;
  }, null, { timeout: COND_MS });
  await page.click('#fp-grid-btn');
  await page.waitForFunction(() => !!document.querySelector('#canvas .grid-block'), null, { timeout: COND_MS });
  const id = await page.evaluate(() => {
    const b = document.querySelector('#canvas .grid-block');
    b.scrollIntoView({ block: 'center' });
    window.deselectAll?.(); document.activeElement?.blur?.();
    return b.id;
  });
  const l0 = `#${id} .grd-cell[data-r="0"][data-c="0"] [data-line="0"]`;
  await clickAt(page, l0); await clickAt(page, l0);            // 블럭 → 줄(드릴다운)
  await clickAt(page, l0, { button: 'right' });
  await clickAt(page, '#bcm-grid-nested');
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .grd-nested[data-line] [data-npath]`), id, { timeout: COND_MS });
  expect(await types(page, id), '[전제] 칸(0,0) = [body, duo]').toEqual(['body', 'duo']);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); window.clearHistory?.(); });
  return { errs, id };
}

const types = (page, id) => page.evaluate((id) => window.getGridModel(document.getElementById(id)).cells[0][0].lines.map(l => l.type), id);

const state = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  const a = b && window.grdGetActiveLine?.(b);
  const grips = [...document.querySelectorAll('#ss-handles-overlay .grd-line-grip')].filter(g => getComputedStyle(g).display !== 'none');
  return {
    exists: !!b,
    sel: !!b && b.classList.contains('selected'),
    act: a ? { r: a.r, c: a.c, li: a.li, np: a.np || null } : null,
    nestMarked: !!b?.querySelector('.grd-nested[data-line="1"].grd-line-selected'),
    grips: grips.length,
  };
}, id);

/** 안 줄(첫 열)을 사람처럼 두 번 눌러 고른다 */
async function pickInner(page, id) {
  const inner = `#${id} .grd-nested[data-line="1"] [data-npath]`;
  await clickAt(page, inner); await clickAt(page, inner);
  const s = await state(page, id);
  expect(s.act && s.act.np, `[전제] 안 줄이 골라졌다 ${JSON.stringify(s)}`).toBeTruthy();
}

const OUTER = { r: 0, c: 0, li: 1, np: null };

async function escToOuter(page, id) {
  await pickInner(page, id);
  await page.keyboard.press('Escape'); await frames2(page);
}

test('O1 안 줄 → Esc = 바깥 줄(마커·손잡이) → Esc = 블럭', async ({ page }) => {
  const { errs, id } = await setup(page);
  await escToOuter(page, id);
  const s1 = await state(page, id);
  expect(s1.act, `Esc 한 번 = 바깥 줄 ${JSON.stringify(s1)}`).toEqual(OUTER);
  expect(s1.nestMarked, '바깥 줄 마커').toBe(true);
  expect(s1.grips, '줄 손잡이').toBeGreaterThan(0);
  await page.keyboard.press('Escape'); await frames2(page);
  const s2 = await state(page, id);
  expect(s2.act, 'Esc 두 번 = 줄 선택 없음').toBeNull();
  expect(s2.sel, '블럭은 그대로 선택').toBe(true);
  expect(errs).toEqual([]);
});

test('O2 바깥 줄 ⌘↑ / ⌘↓ 이동', async ({ page }) => {
  const { errs, id } = await setup(page);
  await escToOuter(page, id);
  await page.keyboard.press('Meta+ArrowUp');
  await expect.poll(() => types(page, id)).toEqual(['duo', 'body']);
  await page.keyboard.press('Meta+ArrowDown');
  await expect.poll(() => types(page, id)).toEqual(['body', 'duo']);
  expect(errs).toEqual([]);
});

test('O3 바깥 줄 ⌫ 삭제(블럭은 남음) · ⌘Z 한 번 복원', async ({ page }) => {
  const { errs, id } = await setup(page);
  await escToOuter(page, id);
  await page.keyboard.press('Backspace');
  await expect.poll(() => types(page, id)).toEqual(['body']);
  expect((await state(page, id)).exists, '그리드 블럭은 남는다').toBe(true);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => {
    const b = document.querySelector('#canvas .grid-block');
    return b ? window.getGridModel(b).cells[0][0].lines.map(l => l.type) : null;
  })).toEqual(['body', 'duo']);
  expect(errs).toEqual([]);
});

test('O4 패널 「바깥 줄 고르기」 = O1 상태 → ⌫', async ({ page }) => {
  const { errs, id } = await setup(page);
  await pickInner(page, id);
  await clickAt(page, '#grd-nest-outer-btn');
  const s = await state(page, id);
  expect(s.act, `단추 = 바깥 줄 ${JSON.stringify(s)}`).toEqual(OUTER);
  expect(s.nestMarked).toBe(true);
  expect(s.grips).toBeGreaterThan(0);
  await page.keyboard.press('Backspace');
  await expect.poll(() => types(page, id)).toEqual(['body']);
  expect(errs).toEqual([]);
});

test('O5 중첩 거터 클릭 = 바깥 줄 고르기(이력 0) · 끌기 = 비율 + 이력 1 + ⌘Z 한 번', async ({ page }) => {
  const { errs, id } = await setup(page);
  await clickAt(page, `#${id} .grd-cell[data-r="0"][data-c="0"] [data-line="0"]`);   // 블럭 선택 → 거터가 선다
  const gut = '.grd-gutter[data-axis="ncol"]';
  await page.waitForFunction((s) => { const g = document.querySelector(s); return !!g && getComputedStyle(g).display !== 'none'; }, gut, { timeout: COND_MS });
  await page.evaluate(() => {
    window.__pushes = 0;
    const orig = window.pushHistory;
    window.pushHistory = function (...a) { window.__pushes++; return orig.apply(this, a); };
  });
  const widths = () => page.evaluate((id) => {
    const b = document.querySelector('#canvas .grid-block');
    return b ? window.getGridModel(b).cells[0][0].lines[1].cols.map(c => Number(c.width)) : null;
  }, id);
  const w0 = await widths();

  await clickAt(page, gut);
  const s = await state(page, id);
  expect(s.act, `거터 클릭 = 바깥 줄 ${JSON.stringify(s)}`).toEqual(OUTER);
  expect(s.grips).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__pushes), '클릭만으로는 이력 0').toBe(0);
  expect(await widths(), '클릭은 비율 그대로').toEqual(w0);

  const r = await waitStableRect(page, gut);
  await page.mouse.move(r.cx, r.cy);
  await page.mouse.down();
  await page.mouse.move(r.cx + 60, r.cy, { steps: 10 });
  await page.mouse.up();
  await expect.poll(widths).not.toEqual(w0);
  expect(await page.evaluate(() => window.__pushes), '끌기 = 이력 1').toBe(1);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(widths, '⌘Z 한 번 = 원래 비율').toEqual(w0);
  expect(errs).toEqual([]);
});
