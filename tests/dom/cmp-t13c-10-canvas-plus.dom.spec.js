/* cmp-t13c-10-canvas-plus.dom.spec.js — t13C-10 비교 블럭 캔버스 ＋(행 위·아래 추가).
 *
 * ★부품 = 그리드 ＋ 그대로(comparison-block.js cmpBindPlus): 층 #grd-plus-layer(gridPlusLayer · #canvas 밖) ·
 *   꼴 .ln-add-btn[data-grd-add="row"] (로렐 선례) · 구분 data-cmp-add="top|bottom" · 주인 data-ln-for=블럭 id.
 * ★누르면 «전 칼럼»에 빈 행 하나(위 = 맨 앞 · 아래 = 맨 끝) · pushHistory 한 번(push-after) ⇒ ⌘Z 한 걸음.
 * ⛔고정 대기 0.
 *
 * 양성대조: _patches/t13c-10-ctl-no-bind.patch(block-drag.js 의 cmpBindPlus 배선 한 줄 뺌) → D1·D2 의 «＋ 둘이 뜬다» 전제가 빨강.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-t13c-10-canvas-plus
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>';
const MAKE = `window.addComparisonBlock({ cols: [
  { title: 'A', rows: [{type:'text',text:'a0'},{type:'text',text:'a1'}] },
  { title: 'B', rows: [{type:'text',text:'b0'},{type:'text',text:'b1'}] }], featured: 1 });`;

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
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected && !window.__blk.classList.contains('selected'), null, { timeout: 5000 });
  return errs;
}
const PLUS = (where) => `#grd-plus-layer > .ln-add-btn[data-cmp-add="${where}"]`;
const texts = (page) => page.evaluate(() =>
  window.getComparisonCols(document.querySelector('#sB .comparison-block').dataset).map(c => c.rows.map(r => r.text)));

async function selectBlock(page) {
  const rc = await waitStableRect(page, `#sB .comparison-block .cmp-row[data-col-idx="0"][data-row-idx="0"]`);
  await page.mouse.click(rc.cx, rc.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  await page.waitForFunction(() => document.querySelectorAll(`#grd-plus-layer > .ln-add-btn[data-ln-for="${window.__bid}"]`).length === 2,
    null, { timeout: 3000 });
}
/* ＋ 한가운데가 그 ＋ 자신인지(가려지지 않았는지) 보고 누른다 */
async function clickPlus(page, where) {
  const rc = await waitStableRect(page, PLUS(where));
  const hit = await page.evaluate(([x, y, s]) => document.elementFromPoint(x, y) === document.querySelector(s), [rc.cx, rc.cy, PLUS(where)]);
  expect(hit, `전제 — ${where} ＋ 가운데가 ＋ 자신이다`).toBe(true);
  await page.mouse.click(rc.cx, rc.cy);
}

test('D1 위 ＋ — 블럭 위 끝 바깥에 뜨고, 누르면 전 칼럼 맨 앞에 빈 행 · 이력 한 칸 · ⌘Z 한 번 복구', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  const g = await page.evaluate(() => {
    const b = document.getElementById(window.__bid).getBoundingClientRect();
    const t = document.querySelector('#grd-plus-layer > .ln-add-btn[data-cmp-add="top"]').getBoundingClientRect();
    const d = document.querySelector('#grd-plus-layer > .ln-add-btn[data-cmp-add="bottom"]').getBoundingClientRect();
    return { bt: b.top, bb: b.bottom, bcx: (b.left + b.right) / 2, tb: t.bottom, tcx: (t.left + t.right) / 2, dt: d.top, dcx: (d.left + d.right) / 2,
             inCanvas: document.querySelectorAll('#canvas .ln-add-btn').length };
  });
  expect(g.inCanvas, '＋ 는 #canvas 안에 없다').toBe(0);
  expect(Math.abs(g.tb - g.bt), '위 ＋ 아래 끝 = 블럭 위 끝').toBeLessThan(1.5);
  expect(Math.abs(g.dt - g.bb), '아래 ＋ 위 끝 = 블럭 아래 끝').toBeLessThan(1.5);
  expect(Math.abs(g.tcx - g.bcx) < 1.5 && Math.abs(g.dcx - g.bcx) < 1.5, '둘 다 블럭 가로 가운데').toBe(true);

  expect(await texts(page), '전제').toEqual([['a0', 'a1'], ['b0', 'b1']]);
  const h0 = await page.evaluate(() => window.getHistoryTip());
  await clickPlus(page, 'top');
  await expect.poll(() => texts(page), { timeout: 3000, message: '전 칼럼 맨 앞에 빈 행' }).toEqual([['', 'a0', 'a1'], ['', 'b0', 'b1']]);
  const h1 = await page.evaluate(() => window.getHistoryTip());
  expect(h1.pos - h0.pos, `이력 한 칸 ${JSON.stringify([h0, h1])}`).toBe(1);
  expect(await page.evaluate(() => document.getElementById(window.__bid)?.classList.contains('selected')), '누른 뒤에도 블럭은 골라진 채').toBe(true);

  await page.keyboard.press('Meta+z');
  await expect.poll(() => texts(page), { timeout: 3000, message: '⌘Z 한 번 → 처음 그대로' }).toEqual([['a0', 'a1'], ['b0', 'b1']]);
  const h2 = await page.evaluate(() => window.getHistoryTip());
  expect([h2.len - h1.len, h2.pos - h1.pos], `⌘Z = 정확히 한 칸 아래 ${JSON.stringify([h1, h2])}`).toEqual([0, -1]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('D2 아래 ＋ — 누르면 전 칼럼 맨 끝에 빈 행 · 저장·직렬화에 ＋ 0 · 풀면 ＋ 0', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page);
  await clickPlus(page, 'bottom');
  await expect.poll(() => texts(page), { timeout: 3000, message: '전 칼럼 맨 끝에 빈 행' }).toEqual([['a0', 'a1', ''], ['b0', 'b1', '']]);
  await page.waitForFunction(() => document.querySelectorAll('#sB .comparison-block .cmp-row[data-row-idx="2"]').length === 2, null, { timeout: 3000 });

  const leak = await page.evaluate(() => {
    const ser = window.serializeProject?.() ?? '';
    return { saveLn: ser.includes('ln-add-btn'), saveCmp: ser.includes('cmp-add'), inCanvas: document.querySelectorAll('#canvas .ln-add-btn, #canvas [data-cmp-add]').length };
  });
  expect(leak, '저장·캔버스에 ＋ 가 안 샌다').toEqual({ saveLn: false, saveCmp: false, inCanvas: 0 });

  await page.evaluate(() => window.deselectAll?.());
  await page.waitForFunction(() => document.querySelectorAll('#grd-plus-layer > [data-cmp-add]').length === 0, null, { timeout: 3000 });
  expect(errs, errs.join('\n')).toEqual([]);
});
