/* click-swallow-drag-utils-237.dom.spec.js — 시트 237: 공용 삼킴(js/click-swallow.js)을 부르는 drag-utils 두 자리의 자.
 * ★값 라벨 위치 끌기(_startVLabelOffsetDrag) · 값 라벨 크기 끌기(_vlOnHandleDown) — 그 한 줄을 끈 사본에서 그 칸만 빨강(GD1001_ROOT · 커밋 메시지에 값).
 * ★P 의 방아쇠는 합성이다 — 지금 판 실제 끌기는 onUp 의 동기 다시 그리기가 누른 노드를 떼어 브라우저 click 이 안 난다(시트 237 · L1).
 *   ⇒ mouseup 뒤 같은 태스크에 click 을 손으로 쏜다. ⛔이 초록을 «실제 끌기에서 click 이 샌다/잠겼다» 로 읽지 마라 — «그 삼킴이 돌고 먹는다» 까지다.
 * ★F 는 피해가 아니라 «호출이 돈다» 를 잠근다(이 자리는 끄고도 피해가 안 섰다 · 지디 판정 ①) · FN 은 그 짝 음성(안 움직인 누름 ⇒ 호출 0).
 * ⛔안 재는 것: radial-block 자리(실제 길에서 켜도 꺼도 값이 같아 자를 안 세운다 — 죽은 호출을 잠그지 않으려고 · 시트 값) · 사람 손. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="lnS" data-section="1" style="background:#fff"><div class="section-hitzone"></div><div class="section-inner"></div></div>');
    const { row, block } = window.makeGraphBlock();
    block.id = 'lnG';
    block.dataset.chartType = 'line';
    block.dataset.items = JSON.stringify([{ label: '1월', value: 10 }, { label: '2월', value: 40 }, { label: '3월', value: 25 }]);
    document.querySelector('#lnS .section-inner').appendChild(row);
    window.renderGraph(block);
    window.rebindAll?.();
    window.deselectAll?.();
    const real = window.swallowNextClick;
    window.__swallowCalls = 0;
    window.swallowNextClick = (o) => { window.__swallowCalls++; return real(o); };
  });
  await page.waitForFunction(() => document.querySelector('#lnG .grb-line-vlabel'));
  const r = await waitStableRect(page, '#lnG .grb-line-vlabel', { index: 1 });
  const x = r.cx, y = r.cy;
  await clickAt(page, x, y, { sel: '.grb-line-vlabel' });   // 1클릭 = 블럭
  await clickAt(page, x, y, { sel: '.grb-line-vlabel' });   // 2클릭 = 라벨
  await page.waitForFunction(() => document.querySelector('#lnG .grb-vlabel-cell-selected'));
  return { x, y };
}
const calls = (page) => page.evaluate(() => window.__swallowCalls);
async function dragTo(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
}

test('P 값 라벨 위치 끌기 — 놓는 태스크의 click 을 삼켜 고르기가 안 풀린다(방아쇠 합성)', async ({ page }) => {
  const p = await setup(page);
  const out = await page.evaluate(() => { const q = document.getElementById('lnG').getBoundingClientRect(); return { x: q.left - 40, y: q.top + q.height / 2 }; });
  await page.evaluate(() => {
    window.addEventListener('mouseup', () => document.getElementById('lnS').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })), { once: true });
  });
  await dragTo(page, p, out);
  const s = await page.evaluate(() => {
    const b = document.getElementById('lnG');
    return { moved: JSON.parse(b.dataset.items)[1].vDx ?? null, sel: b.classList.contains('selected'), picked: !!b.querySelector('.grb-vlabel-cell-selected') };
  });
  expect(s.moved, '[전제] 끌기가 실제로 일어났다').not.toBeNull();
  expect(s.sel, '놓은 click 이 새어 선택이 풀렸다').toBe(true);
  expect(s.picked, '놓은 click 이 새어 라벨 고르기가 풀렸다').toBe(true);
});

async function handle(page) {
  await page.waitForFunction(() => { const h = document.querySelector('.grb-vlabel-handle.se'); return h && h.getBoundingClientRect().width > 0; });
  return page.evaluate(() => { const q = document.querySelector('.grb-vlabel-handle.se').getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
}
test('F 값 라벨 크기 끌기 — 놓을 때 삼킴을 한 번 부른다', async ({ page }) => {
  await setup(page);
  const h = await handle(page);
  const n0 = await calls(page);
  await dragTo(page, h, { x: h.x + 30, y: h.y + 30 });
  expect(await page.evaluate(() => JSON.parse(document.getElementById('lnG').dataset.items)[1].vFs ?? null), '[전제] 크기가 바뀌었다').not.toBeNull();
  expect((await calls(page)) - n0).toBe(1);
});
test('FN [음성] 크기 손잡이를 안 움직이고 놓으면 — 부르지 않는다', async ({ page }) => {
  await setup(page);
  const h = await handle(page);
  const n0 = await calls(page);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.up();
  expect((await calls(page)) - n0).toBe(0);
});
