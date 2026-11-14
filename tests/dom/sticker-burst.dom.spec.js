/* sticker-burst.dom.spec.js — 톱니(버스트) 스탬프 = 스티커 모양 burst (B2 · 현빈 261114 «BEST 처럼 톱니모양 마크»)
 *   진짜 길: 펜 ▾ «BEST 스탬프» · 우측 패널 Shape «톱니» · Burst 절(톱니 수·깊이·안쪽 링)
 *   Z1 메뉴로 만든다 — shape burst · 글 «BEST» · svg 다각형 꼭짓점 48(톱니 24) · 안쪽 링 · 블럭 바탕은 투명(색은 다각형이 든다)
 *   Z2 패널 — 톱니 수 12 → 꼭짓점 24 · 깊이 30 → 골 반지름 35(100 상자) · 링 끔 → circle 0
 *   Z3 모양 바꾸기 — 원형 스티커에서 «톱니» 누르면 다각형이 생기고 기본 톱니 값 · 다시 «원형» 이면 다각형 0 · 바탕색 복귀
 *   Z4 바탕색 = 다각형 칠 · 글자색 = 링 선
 *   Z5 [보안] 손댄 bgColor(«"/><script>…») — 다각형 속성이 깨지지 않는다(script 0 · 칠은 안전값)
 *   Z6 캔버스에서 글자 더블클릭 편집(기존 sticker-text 길 그대로)
 * 양성대조:
 *   · js/blocks/sticker-block.js 의 `_burstSvg + (` 에서 `_burstSvg + ` 를 지우면 Z1·Z2·Z3·Z4 빨강
 *   · js/blocks/burst-geometry.js burstPoints 의 `teeth * 2` 를 `teeth` 로 바꾸면 Z1·Z2 빨강(꼭짓점 수)
 *   · js/blocks/sticker-block.js _escAttrBurst 가 그대로 돌려주게(`return s;`) 하면 Z5 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.deselectAll?.(); window.selectSection(c.querySelector('.section-block'));
  });
  return errs;
}
async function addBurst(page) {
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click('#fp-add-burst');
  await page.waitForSelector('#canvas .sticker-block[data-shape="burst"] svg.stk-burst polygon');
  return page.evaluate(() => { const b = [...document.querySelectorAll('#canvas .sticker-block[data-shape="burst"]')].pop(); b.id = b.id || 'stk_qa'; return b.id; });
}
const read = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); const poly = b.querySelector('svg.stk-burst polygon');
  const pts = poly ? poly.getAttribute('points').split(' ').map((p) => p.split(',').map(Number)) : [];
  return { n: pts.length, valley: pts[1] ? +Math.hypot(pts[1][0] - 50, pts[1][1] - 50).toFixed(1) : null, ring: b.querySelectorAll('svg.stk-burst circle').length,
    fill: poly?.getAttribute('fill') ?? null, ringStroke: b.querySelector('svg.stk-burst circle')?.getAttribute('stroke') ?? null,
    text: b.querySelector('.sticker-text')?.textContent ?? null, bg: getComputedStyle(b).backgroundColor, scripts: b.querySelectorAll('script').length };
}, id);
async function panel(page, id) {
  await page.evaluate((id) => { const b = document.getElementById(id); window.selectBlock?.(id); window.showStickerProperties(b); }, id);
}

test('Z1 메뉴 «BEST 스탬프»', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  const r = await read(page, id);
  expect([r.n, r.ring, r.text, r.bg]).toEqual([48, 1, 'BEST', 'rgba(0, 0, 0, 0)']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z2 패널 — 톱니 수·깊이·링', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  await panel(page, id);
  await expect(page.locator('#stk-burst-section')).toHaveCount(1);
  await page.fill('#stk-burst-teeth-num', '12'); await page.dispatchEvent('#stk-burst-teeth-num', 'change');
  await page.fill('#stk-burst-depth-num', '30'); await page.dispatchEvent('#stk-burst-depth-num', 'change');
  await page.uncheck('#stk-burst-ring');
  const r = await read(page, id);
  expect([r.n, r.valley, r.ring]).toEqual([24, 35, 0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z3 원형 ↔ 톱니', async ({ page }) => {
  const errs = await boot(page);
  const id = await page.evaluate(() => { const sec = document.querySelector('#canvas .section-block'); const before = new Set(sec.querySelectorAll('.sticker-block'));
    window.addStickerBlock({ shape: 'circle' }); const b = [...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x)); b.id = 'stk_c'; return b.id; });
  await panel(page, id);
  await page.click('#stk-shape-group .prop-align-btn[data-shape="burst"]');
  let r = await read(page, id);
  expect(r.n, '★톱니로 바꿨는데 다각형이 없다').toBe(48);
  expect(await page.evaluate((id) => [document.getElementById(id).dataset.burstTeeth, document.getElementById(id).dataset.burstDepth], id)).toEqual(['24', '14']);
  await page.click('#stk-shape-group .prop-align-btn[data-shape="circle"]');
  r = await read(page, id);
  expect(r.n).toBe(0);
  expect(r.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z4 바탕색 = 다각형 칠 · 글자색 = 링', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  await page.evaluate((id) => { const b = document.getElementById(id); b.dataset.bgColor = '#1e88e5'; b.dataset.textColor = '#ffeb3b'; window.renderStickerBlock(b); }, id);
  const r = await read(page, id);
  expect([r.fill, r.ringStroke]).toEqual(['#1e88e5', '#ffeb3b']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z5 [보안] 손댄 바탕색', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  await page.evaluate((id) => { const b = document.getElementById(id); b.dataset.bgColor = '"/><script>window.__pwnB=1</script><x a="'; b.dataset.textColor = 'red" onload="window.__pwnR=1'; window.renderStickerBlock(b); }, id);
  const r = await read(page, id);
  expect(r.scripts).toBe(0);
  expect([r.fill, r.ringStroke]).toEqual(['#000000', '#000000']);
  expect(await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('*')].filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length, id)).toBe(0);
  expect(await page.evaluate(() => ['__pwnB', '__pwnR'].filter((k) => window[k]))).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z6 캔버스 글자 더블클릭 편집', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  await page.dblclick(`#${id} .sticker-text`);
  await expect(page.locator(`#${id} .sticker-text`)).toHaveAttribute('contenteditable', 'true');
  expect(errs, errs.join(' | ')).toEqual([]);
});
