/* sec-hitstrip.dom.spec.js — 0.9.13 208행 SEC-SELECT-HITSTRIP-01(현빈 GO 261123): 섹션 «바깥 경계 몇 px» = 섹션 고르기 과녁.
 *   위·아래·왼·오른 · 좌우 패딩 0 섹션(블럭이 가장자리까지)도 캔버스 여백 쪽에서 집힌다 · 섹션 «안»은 블럭이 이긴다 · 블럭 클릭·끌기 회귀 0.
 *   잼 = 진짜 마우스(page.mouse) · 좌표 = 섹션 rect 에서 화면 px 로.
 *   H1~H3 = 새 것(구현 전 빨강) · H4~H6 = 회귀 지킴(구현 전에도 초록이어야 한다). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const STRIP_IN = 4;     // 띠 안쪽(경계 밖 4px) — 과녁
const STRIP_OUT = 24;   // 띠 밖(경계 밖 24px) — 빈 곳(해제)

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  return page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection(); window.addSection();
    const [a, b] = [...c.querySelectorAll(':scope > .section-block')];
    a.id = a.id || 'hsA'; b.id = b.id || 'hsB';
    /* B = 좌우 패딩 0 · 글 블럭이 좌우 가장자리까지 — «안쪽 경계 1px» 은 블럭 자리 */
    const inner = b.querySelector('.section-inner'); inner.style.paddingLeft = '0px'; inner.style.paddingRight = '0px'; inner.dataset.paddingX = '0';
    window.deselectAll(); window.selectSectionWithModifier?.(b); window.addTextBlock('h1');
    window.deselectAll();
    return { a: a.id, b: b.id };
  });
}
/* ★자리가 멈춘 뒤 잰다 — bootApp 뒤 배율 맞추기가 늦게 끝나 먼저 재면 빗나간다(하네스 waitStableRect · 처음 판 단독 초록·전체 랜덤 빨강 1 실측) */
const rectOf = async (page, sel) => { await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); const q = await waitStableRect(page, sel); return { l: q.left, t: q.top, r: q.left + q.width, b: q.top + q.height, cx: q.cx, cy: q.cy }; };
const picked = (page) => page.evaluate(() => ({ secs: [...document.querySelectorAll('.section-block.selected')].map((s) => s.id), blocks: [...document.querySelectorAll('#canvas .selected:not(.section-block)')].length }));

test('H1 ★좌우 패딩 0 섹션 — 왼쪽·오른쪽 바깥 경계 4px 클릭 = 그 섹션', async ({ page }) => {
  const { b } = await scene(page);
  for (const side of ['l', 'r']) {
    await page.evaluate(() => window.deselectAll());
    const r = await rectOf(page, '#' + b);
    const x = side === 'l' ? r.l - STRIP_IN : r.r + STRIP_IN;
    const owner = await page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h && (h.id || h.className); }, [x, r.cy]);
    expect(['canvas', 'canvas-scaler', 'canvas-wrap'], `[전제] 그 점은 캔버스 빈 곳이다(${owner})`).toContain(owner);
    await page.mouse.click(x, r.cy);
    expect((await picked(page)).secs, `★${side === 'l' ? '왼' : '오른'}쪽 바깥 띠를 눌렀는데 섹션이 안 골라졌다`).toEqual([b]);
  }
});

test('H2 ★맨 위 섹션 위쪽 · 맨 아래 섹션 아래쪽 바깥 경계 4px = 그 섹션', async ({ page }) => {
  const { a, b } = await scene(page);
  const ra = await rectOf(page, '#' + a);
  await page.mouse.click(ra.cx, ra.t - STRIP_IN);
  expect((await picked(page)).secs, '★위쪽 바깥 띠 = 맨 위 섹션').toEqual([a]);
  await page.evaluate(() => window.deselectAll());
  const rb = await rectOf(page, '#' + b);
  await page.mouse.click(rb.cx, rb.b + STRIP_IN);
  expect((await picked(page)).secs, '★아래쪽 바깥 띠 = 맨 아래 섹션').toEqual([b]);
});

test('H3 ★⇧ 클릭(띠) = 여러 섹션 고르기(섹션 클릭과 같은 규칙)', async ({ page }) => {
  const { a, b } = await scene(page);
  const ra = await rectOf(page, '#' + a);
  await page.mouse.click(ra.l - STRIP_IN, ra.cy);
  const rb = await rectOf(page, '#' + b);
  await page.keyboard.down('Shift'); await page.mouse.click(rb.l - STRIP_IN, rb.cy); await page.keyboard.up('Shift');
  expect((await picked(page)).secs.sort(), '★⇧ 로 둘째 섹션을 더한다').toEqual([a, b].sort());
});

test('H4 [회귀 지킴] 띠 밖(24px) 빈 곳 클릭 = 선택 해제(옛 동작)', async ({ page }) => {
  const { b } = await scene(page);
  const r = await rectOf(page, '#' + b);
  await page.mouse.click(r.l + 2, r.cy);   // 먼저 무엇인가 고른다(안쪽)
  await page.mouse.click(r.l - STRIP_OUT, r.cy);
  expect(await picked(page), '띠 밖은 빈 곳 = 해제').toEqual({ secs: [], blocks: 0 });
});

test('H5 [회귀 지킴] 안쪽 경계 1px(블럭 자리) 클릭 = 블럭이 이긴다', async ({ page }) => {
  const { b } = await scene(page);
  const tb = await rectOf(page, '#' + b + ' .text-block');
  await page.mouse.click(tb.l + 1, tb.cy);
  const p = await picked(page);
  expect(p.blocks, '★안쪽 1px 은 블럭 — 블럭이 골라져야 한다').toBeGreaterThan(0);
});

test('H6 [회귀 지킴] 띠에서 눌러 30px 끌면 섹션을 고르지 않는다(누른 채 끌기 = 클릭 아님)', async ({ page }) => {
  const { b } = await scene(page);
  const r = await rectOf(page, '#' + b);
  await page.mouse.move(r.l - STRIP_IN, r.cy); await page.mouse.down();
  await page.mouse.move(r.l - STRIP_IN - 30, r.cy + 10, { steps: 6 }); await page.mouse.up();
  expect((await picked(page)).secs, '끌기는 클릭이 아니다').toEqual([]);
});
