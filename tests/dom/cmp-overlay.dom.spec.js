/* cmp-overlay.dom.spec.js — 1017t1c5 「컴패리전 블럭도 오버레이 기능되게해줘」. (2026-10-18)
 *
 * ★현빈 원문: 「컴패리전 블럭도 ★오버레이 기능되게해줘」
 * ★누락이었다(의도 아님) — js/overlay-float.js 전수에 comparison 언급 0, 드래그·내보내기는 이미 타입무관.
 * ★1차 범위 = 토글 ＋ X/Y 만(폭 손잡이·designW 칸은 안 만든다 — designW 는 그리드와 뜻이 다르다).
 * ★꼴은 grid-overlay.dom.spec.js 를 빌린다(공용 오버레이 — js/overlay-float.js 한 곳).
 * ⛔고정 대기 0 — waitForTimeout 미사용(grid-overlay 의 그 자리는 ★안 베꼈다 — 래칫 W3 가 늘어난다).
 *
 * 음성대조(실측 — 「돌린 결과」에 적는다):
 *   M9  comparison-block.js 의 `floating` 분기를 원복(항상 '100%') ⇒ F2 빨강(F1 초록).
 *   M10 prop-comparison.js 의 `window.wireFloatToggle?.(...)` 호출 한 줄 제거 ⇒ F1 빨강.
 *   M11 prop-comparison.js 의 `window.floatPositionRowHTML?.(...)` 호출 제거 ⇒ F3 빨강 · N9 초록.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-overlay
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB" data-name="sB"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const MAKE = `window.addComparisonBlock({ cols: [
  { title: 'A', rows: [{type:'text',text:'a0'}] },
  { title: 'B', rows: [{type:'text',text:'b0'}] }], featured: 1 });`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([mk, sec]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    (0, eval)(mk);
    window.__blk = [...document.querySelectorAll('#sB .comparison-block')].pop();
    window.__bid = window.__blk?.id;
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [MAKE, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected, null, { timeout: 5000 });
  return errs;
}
const blk = 'document.getElementById(window.__bid)';

/* 섹션 기준 자리·폭(모델 px — 배율 무관, grid-overlay.dom.spec.js geo() 와 같은 식) */
const geo = (page) => page.evaluate(() => {
  const sec = document.getElementById('sB'), b = document.getElementById(window.__bid);
  const s = sec.getBoundingClientRect(), r = b.getBoundingClientRect(), k = s.width / sec.offsetWidth;
  return { x: Math.round((r.left - s.left) / k), y: Math.round((r.top - s.top) / k), w: Math.round(r.width / k),
           float: b.dataset.overlayBlock === 'true', parent: b.parentElement?.className || '', styleW: b.style.width };
});
async function at(page, sel) {
  const rc = await waitStableRect(page, sel);
  return rc;
}
async function selectBlock(page) {
  const p = await at(page, `#${await page.evaluate(() => window.__bid)}`);
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  await page.waitForFunction(() => !!document.getElementById('cmp-float-toggle'), null, { timeout: 3000 });
}
async function toggle(page) {
  const before = await page.evaluate(() => document.getElementById(window.__bid).dataset.overlayBlock === 'true');
  await page.click('#cmp-float-toggle');
  await page.waitForFunction((b) => (document.getElementById(window.__bid).dataset.overlayBlock === 'true') !== b, before, { timeout: 3000 });
}

test('전제 — #cmp-float-toggle 이 패널에 있다 · 켜기 전 dataset.overlayBlock 없음', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  expect(await page.isVisible('#cmp-float-toggle'), '토글 버튼 있다').toBe(true);
  expect(await page.evaluate(() => document.getElementById(window.__bid).dataset.overlayBlock)).toBeUndefined();
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N9 켜기 전 — #cmp-x-number 0(floatPositionRowHTML 이 안 떠 있을 때 아무것도 안 낸다)', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  expect(await page.evaluate(() => document.querySelectorAll('#cmp-x-number').length), '토글 전 X칸 0').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('F1 토글 → dataset.overlayBlock=true · position:absolute · 부모 .section-block · offsetX/Y 생성 · X/Y 칸 뜬다', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  await toggle(page);
  const r = await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    return { float: b.dataset.overlayBlock, pos: b.style.position, parentCls: b.parentElement?.className || '',
             offX: b.dataset.offsetX, offY: b.dataset.offsetY, xN: document.querySelectorAll('#cmp-x-number').length, yN: document.querySelectorAll('#cmp-y-number').length };
  });
  expect(r.float).toBe('true');
  expect(r.pos).toBe('absolute');
  expect(r.parentCls).toContain('section-block');
  expect(r.offX, 'offsetX 생김').not.toBeUndefined();
  expect(r.offY, 'offsetY 생김').not.toBeUndefined();
  expect(r.xN).toBe(1); expect(r.yN).toBe(1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('F2 ★폭을 안 잃는다 — 띄운 폭 W0 를 renderComparison 한 번 더 불러도 유지(±1px)', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  const g0 = await geo(page);
  await toggle(page);
  const g1 = await geo(page);
  expect(g1.float).toBe(true);
  expect(Math.abs(g1.w - g0.w), '띄운 직후 폭 유지').toBeLessThanOrEqual(1);
  const w0 = g1.w;
  await page.evaluate(`window.renderComparison(${blk})`);
  await expect.poll(async () => (await geo(page)).w, { timeout: 3000 }).toBeGreaterThan(0);
  const g2 = await geo(page);
  expect(Math.abs(g2.w - w0), '재렌더 뒤에도 폭 유지(±1px)').toBeLessThanOrEqual(1);
  /* 다른 렌더 유발 길로도 한 번 더(행간격 — ResizeObserver 가 끼어들 수 있어 expect.poll) */
  await page.evaluate(`window.updateComparisonBlock(${blk}.id, { rowGap: 12 })`);
  await expect.poll(async () => Math.abs((await geo(page)).w - w0), { timeout: 3000 }).toBeLessThanOrEqual(1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('F3 X 칸에 숫자 → style.left 반영 · ⌘Z 한 걸음', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  await toggle(page);
  const before = await page.evaluate(() => document.getElementById(window.__bid).style.left);
  await page.fill('#cmp-x-number', '77');
  await page.locator('#cmp-x-number').dispatchEvent('change');
  await expect.poll(() => page.evaluate(() => document.getElementById(window.__bid).style.left), { timeout: 3000 }).toBe('77px');
  await page.evaluate(() => window.undo());
  await expect.poll(() => page.evaluate(() => document.getElementById(window.__bid).style.left), { timeout: 3000 }).toBe(before);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('F4 드래그로 옮겨진다(block-drag.js 가 이미 걸어 둔 길)', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  await toggle(page);
  const r0 = await page.evaluate(() => document.getElementById(window.__bid).getBoundingClientRect());
  await page.mouse.move(r0.left + r0.width / 2, r0.top + r0.height / 2);
  await page.mouse.down();
  await page.mouse.move(r0.left + r0.width / 2 + 40, r0.top + r0.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => {
    const r1 = await page.evaluate(() => document.getElementById(window.__bid).getBoundingClientRect());
    return Math.round(r1.left - r0.left);
  }, { timeout: 3000 }).toBeGreaterThan(20);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('F5 토글 다시 누르면 원래 자리로 돌아오고 폭이 100% 로 복귀', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  const g0 = await geo(page);
  await toggle(page);
  await toggle(page);
  const g2 = await geo(page);
  expect(g2.float).toBe(false);
  expect(g2.styleW).toBe('100%');
  expect(g2.parent, '원래 부모(.section-inner)로').not.toContain(' section-block');
  expect(Math.abs(g2.x - g0.x) + Math.abs(g2.y - g0.y), '원래 자리로').toBeLessThanOrEqual(2);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N10 떠 있는 동안 폭 손잡이·designW 칸이 안 생겼다(발주서 ③)', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  await toggle(page);
  const n = await page.evaluate(() => ({
    w: document.querySelectorAll('#cmp-w-number, #cmp-width-number, [id*="design-w"]').length,
    handles: document.querySelectorAll('.cmp-resize-handle, .overlay-resize-handle').length,
  }));
  expect(n.w, '폭 입력칸 0').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});
