/* bcm-outside-close.dom.spec.js — 1109t1B1 「그리드 블럭에 우클릭하면 나타나는 거 잘 사라지지가 않는 문제 … 일반 패널 닫히듯?」(현빈)
 *   블럭 우클릭 메뉴(#block-context-menu)는 바깥 누름(어디든) · 휠 · Esc · 창 이탈이면 닫힌다.
 *   바깥 누름은 닫기만 하고 그 클릭은 제 할 일을 한다(한 번에 다른 블럭 선택). 메뉴 안 입력칸을 쓰는 동안은 안 닫힌다.
 * 양성대조: block-factory.js 를 e7d97f1ec 판으로 바꿔 끼우면 «닫힘» 칸(빈 캔버스·패널 제외)·통과 칸이 빨강.
 * ⛔고정 대기 없음. 우클릭·클릭·휠·키는 진짜 입력(page.mouse / keyboard).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const menuOpen = (page) => page.evaluate(() => getComputedStyle(document.getElementById('block-context-menu')).display !== 'none');
const center = (page, sel) => page.evaluate((s) => {
  const el = typeof s === 'string' ? document.querySelector(s) : null;
  if (!el) throw new Error('no ' + s);
  const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
}, sel);

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection(); window.addSection();
    const [s1, s2] = c.querySelectorAll('.section-block');
    window.selectSection(s1);
    window.addGridBlock(); window.addGridBlock();
    window.addTextBlock('body');
    window.addAssetBlock('img1');
    window.addFrameBlock();
    const gs = s1.querySelectorAll('.grid-block');
    gs[0].id ||= 'g1'; gs[0].dataset.t = 'g1'; gs[1].dataset.t = 'g2';
    s1.querySelector('.text-block').dataset.t = 'tx';
    s1.querySelector('.asset-block').dataset.t = 'as';
    s1.querySelector('.frame-block').dataset.t = 'fr';
    s2.dataset.t = 's2';
    window.deselectAll?.();
    s1.scrollIntoView({ block: 'start' });
  });
  // 자리가 멎을 때까지(두 프레임 연속 같은 값)
  await page.evaluate(() => new Promise((done) => { let p = null, n = 0; const t = () => { const k = [...document.querySelectorAll('[data-t]')].map(e => { const r = e.getBoundingClientRect(); return r.left + ',' + r.top + ',' + r.height; }).join(); if (k === p) { if (++n >= 2) return done(); } else n = 0; p = k; requestAnimationFrame(t); }; requestAnimationFrame(t); }));
  return errs;
}
const cellPt = (page, t, r = 0, c = 0) => center(page, `[data-t="${t}"] .grd-cell[data-r="${r}"][data-c="${c}"]`);
const blockPt = (page, t) => center(page, `[data-t="${t}"]`);

async function openOn(page, pt, preClick = true) {
  if (preClick) { await page.mouse.click(pt[0], pt[1]); await frames(page, 2); }
  await page.mouse.click(pt[0], pt[1], { button: 'right' });
  await expect.poll(() => menuOpen(page)).toBe(true);
}
// 칸 (0,1)(오른쪽)에서 연다 — 메뉴가 커서 오른쪽에 펴져 (0,0) 칸들을 덮지 않게(빈 그리드는 1행 2열)
const openOnGrid = async (page) => openOn(page, await cellPt(page, 'g1', 0, 1));

// 바깥 표적 — 메뉴(기본 커서 근처)와 안 겹치는 자리
const TARGETS = {
  'same grid other cell': (p) => cellPt(p, 'g1', 0, 0),
  'other grid cell': (p) => cellPt(p, 'g2'),
  'text block': (p) => blockPt(p, 'tx'),
  'asset block': (p) => blockPt(p, 'as'),
  'frame': (p) => blockPt(p, 'fr'),
  'section hitzone': (p) => center(p, '[data-t="s2"] > .section-hitzone'),
  'empty canvas': (p) => p.evaluate(() => { const r = document.getElementById('canvas').getBoundingClientRect(); const s = document.querySelector('.section-block').getBoundingClientRect(); return [r.left + Math.max(8, (s.left - r.left) / 2), r.bottom - 8]; }),
  'left panel': (p) => p.evaluate(() => { const r = document.getElementById('panel-left').getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 20]; }),
  'right panel': (p) => p.evaluate(() => { const r = document.getElementById('panel-right').getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 20]; }),
  'toolbar blank': (p) => p.evaluate(() => { const r = document.getElementById('topbar').getBoundingClientRect(); for (let x = r.left + r.width / 2; x < r.right; x += 10) { const e = document.elementFromPoint(x, r.top + r.height / 2); if (e && e.closest('#topbar') && !e.closest('button,input,select,a,[onclick],.tb-badge')) return [x, r.top + r.height / 2]; } throw new Error('no blank topbar'); }),
};

test.describe('1109t1B1 — 닫힘 (그리드 칸에서 연 메뉴)', () => {
  for (const [name, at] of Object.entries(TARGETS)) {
    test(`click ${name} closes`, async ({ page }) => {
      const errs = await setup(page);
      await openOnGrid(page);
      const p = await at(page);
      await page.mouse.click(p[0], p[1]);
      await expect.poll(() => menuOpen(page)).toBe(false);
      expect(errs).toEqual([]);
    });
  }
  test('wheel over canvas closes', async ({ page }) => {
    await setup(page); await openOnGrid(page);
    const p = await blockPt(page, 'tx'); await page.mouse.move(p[0], p[1]); await page.mouse.wheel(0, 40);
    await expect.poll(() => menuOpen(page)).toBe(false);
  });
  test('Esc closes menu only (selection kept)', async ({ page }) => {
    await setup(page); await openOnGrid(page);
    await page.keyboard.press('Escape');
    await expect.poll(() => menuOpen(page)).toBe(false);
    expect(await page.evaluate(() => document.querySelector('[data-t="g1"]').classList.contains('selected'))).toBe(true);
  });
  test('window blur closes', async ({ page }) => {
    await setup(page); await openOnGrid(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(() => menuOpen(page)).toBe(false);
  });
});

for (const src of ['tx', 'fr']) {
  test.describe(`1109t1B1 — 닫힘 (${src} 에서 연 메뉴)`, () => {
    for (const name of ['other grid cell', 'asset block', 'empty canvas']) {
      test(`click ${name} closes`, async ({ page }) => {
        await setup(page);
        await openOn(page, await blockPt(page, src));
        const p = await TARGETS[name](page);
        await page.mouse.click(p[0], p[1]);
        await expect.poll(() => menuOpen(page)).toBe(false);
      });
    }
    test('Esc / wheel close', async ({ page }) => {
      await setup(page);
      await openOn(page, await blockPt(page, src));
      await page.keyboard.press('Escape');
      await expect.poll(() => menuOpen(page)).toBe(false);
      await openOn(page, await blockPt(page, src), false);
      const p = await cellPt(page, 'g2'); await page.mouse.move(p[0], p[1]); await page.mouse.wheel(0, 40);
      await expect.poll(() => menuOpen(page)).toBe(false);
    });
  });
}

test.describe('1109t1B1 — 통과(닫고 그 클릭은 제 할 일)', () => {
  for (const preSelect of [false, true]) {
    test(`one click on text closes + selects it (grid ${preSelect ? 'selected' : 'not pre-clicked'})`, async ({ page }) => {
      await setup(page);
      await openOn(page, await cellPt(page, 'g1', 0, 1), preSelect);
      const p = await blockPt(page, 'tx');
      await page.mouse.click(p[0], p[1]);
      await expect.poll(() => menuOpen(page)).toBe(false);
      await expect.poll(() => page.evaluate(() => document.querySelector('[data-t="tx"]').classList.contains('selected'))).toBe(true);
    });
  }
});

test.describe('1109t1B1 — 안 닫힘(메뉴 안 입력)', () => {
  test('template name row: input · select · tags · wheel → open; Enter saves once and closes', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => { window.__saved = []; window.saveBlockAsTemplate = (...a) => window.__saved.push(a); });
    await openOnGrid(page);
    let p = await center(page, '#bcm-save-template'); await page.mouse.click(p[0], p[1]);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('bcm-name-row')).display !== 'none')).toBe(true);
    p = await center(page, '#bcm-name-input'); await page.mouse.click(p[0], p[1]);
    await page.keyboard.type('mytpl');
    expect(await menuOpen(page)).toBe(true);
    await page.focus('#bcm-folder-select'); await page.keyboard.press('ArrowDown'); await frames(page);
    expect(await menuOpen(page)).toBe(true);
    p = await center(page, '#bcm-tags-input'); await page.mouse.click(p[0], p[1]);
    await page.keyboard.type('a,b');
    p = await center(page, '#bcm-tags-input'); await page.mouse.move(p[0], p[1]); await page.mouse.wheel(0, 30); await frames(page);
    expect(await menuOpen(page)).toBe(true);
    p = await center(page, '#bcm-name-input'); await page.mouse.click(p[0], p[1]);
    await page.keyboard.press('Enter');
    await expect.poll(() => menuOpen(page)).toBe(false);
    const saved = await page.evaluate(() => window.__saved.map(a => [a[1], a[3]]));
    expect(saved).toEqual([['mytpl', 'a,b']]);
  });
  test('disabled style-paste click keeps menu open', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => { window.hasTextStyleClipboard = () => false; });
    await openOn(page, await blockPt(page, 'tx'));
    await page.waitForFunction(() => { const e = document.getElementById('bcm-style-paste'); return e && getComputedStyle(e).display !== 'none' && e.getAttribute('aria-disabled') === 'true'; });
    const p = await center(page, '#bcm-style-paste'); await page.mouse.click(p[0], p[1]); await frames(page);
    expect(await menuOpen(page)).toBe(true);
  });
});

test.describe('1109t1B1 — 항목·다시 우클릭·칸 사이 간격 팝오버', () => {
  test('「바로 아래에 여백 넣기」 adds one gap and closes', async ({ page }) => {
    await setup(page);
    const n0 = await page.evaluate(() => document.querySelectorAll('.gap-block').length);
    await openOn(page, await blockPt(page, 'tx'));
    const p = await center(page, '#bcm-insert-gap'); await page.mouse.click(p[0], p[1]);
    await expect.poll(() => menuOpen(page)).toBe(false);
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.gap-block').length)).toBe(n0 + 1);
  });
  test('right-click another block reopens with the new target', async ({ page }) => {
    await setup(page); await openOnGrid(page);
    const p = await blockPt(page, 'tx');
    await page.mouse.click(p[0], p[1], { button: 'right' });
    await expect.poll(() => menuOpen(page)).toBe(true);
    // 새 대상 확인: 텍스트 전용 항목(스타일 복사)이 보이고 그리드 항목은 숨는다
    expect(await page.evaluate(() => ({
      copy: getComputedStyle(document.getElementById('bcm-style-copy')).display !== 'none',
      grid: getComputedStyle(document.getElementById('bcm-grid-nested')).display !== 'none',
    }))).toEqual({ copy: true, grid: false });
  });
  test('nested-gap popover keeps its own rules', async ({ page }) => {
    await setup(page);
    const c = await cellPt(page, 'g1');
    await openOn(page, c);
    let p = await center(page, '#bcm-grid-nested'); await page.mouse.click(p[0], p[1]);
    await page.waitForFunction(() => !!document.querySelector('[data-t="g1"] .grd-nested[data-line]'));
    await frames(page, 3);
    p = await center(page, '[data-t="g1"] .grd-nested[data-line] > .grd-nested-col');
    await page.mouse.click(p[0], p[1], { button: 'right' });
    await expect.poll(() => menuOpen(page)).toBe(true);
    p = await center(page, '#bcm-grid-nested-gap'); await page.mouse.click(p[0], p[1]);
    await page.waitForFunction(() => document.activeElement?.id === 'grd-nest-gap-input');
    expect(await menuOpen(page)).toBe(false);
    const popOpen = () => page.evaluate(() => !!document.getElementById('grd-nest-gap-input')?.isConnected);
    p = await center(page, '.section-memo-popover .smp-head'); await page.mouse.click(p[0], p[1]); await frames(page);
    expect(await popOpen()).toBe(true);
    p = await center(page, '#grd-nest-gap-input'); await page.mouse.click(p[0], p[1]);
    await page.keyboard.type('5'); await frames(page);
    expect(await popOpen()).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(popOpen).toBe(false);
    expect(await menuOpen(page)).toBe(false);
  });
});
