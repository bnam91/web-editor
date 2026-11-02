/* frame-drop-stale-indicator — 프레임 안에 놓을 때 낡은 표시선 자리로 들어가던 것 (177 과 같은 꼴 · 지디 2차 ⑴)
 * 왜: 표시선은 dragover 의 rAF 로 늦게 따라오는데 drop 이 그 rAF 를 취소하고 표시선 자리를 그대로 썼다.
 * 자: 같은 task 에서 dragover·drop 을 쏴 rAF 가 끼어들 틈을 없앤다. 행 순서로 잰다.
 * 변이: block-drag.js 프레임 drop 의 _placeIndicator 한 줄을 빼면 F1·F2 빨강 · F3 은 늘 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:40px"></div>
<div class="frame-block" id="F" data-type="frame">
<div class="row" id="r1"><div class="text-block" data-type="heading" id="t1"><div class="tb-h2">끌 글</div></div></div>
<div class="row" id="r2"><div class="text-block" data-type="heading" id="t2"><div class="tb-h2">둘째</div></div></div>
<div class="row" id="r3"><div class="text-block" data-type="heading" id="t3"><div class="tb-h2">셋째</div></div></div>
<div class="gap-block" data-type="gap" id="gE" style="height:200px"></div></div>
<div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`;
const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.clearHistory?.(); }, SEC);
  await raf2(page);
}
const fire = (page, types, sel, at) => page.evaluate(([types, sel, at]) => {
  const dataTransfer = window.__dt || (window.__dt = new DataTransfer());
  const box = document.querySelector(sel).getBoundingClientRect();
  const clientX = box.left + box.width / 2, clientY = at === 'top' ? box.top + 1 : box.top + box.height / 2;
  const el = document.elementFromPoint(clientX, clientY) || document.querySelector(sel);
  for (const t of types) (t === 'dragstart' ? document.querySelector(sel) : el).dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, composed: true, clientX, clientY, dataTransfer }));
}, [types, sel, at]);
const rows = (page) => page.evaluate(() => [...document.getElementById('F').children].filter(e => e.classList.contains('row')).map(e => e.id));
const indBefore = (page) => page.evaluate(() => document.querySelector('#F .drop-indicator')?.nextElementSibling?.id);

test('F1 표시선이 위쪽에 낡아 있어도 끝 갭에 놓으면 그 자리로 간다', async ({ page }) => {
  await setup(page);
  await fire(page, ['dragstart'], '#r1'); await raf2(page);
  await fire(page, ['dragover'], '#r2', 'top'); await raf2(page);
  expect(await indBefore(page), '전제: 표시선이 r2 앞에 낡아 있다').toBe('r2');
  await fire(page, ['dragover', 'drop', 'dragend'], '#gE');
  expect(await rows(page)).toEqual(['r2', 'r3', 'r1']);
});
test('F2 표시선이 아래에 낡아 있어도 위쪽에 놓으면 그 자리로 간다', async ({ page }) => {
  await setup(page);
  await fire(page, ['dragstart'], '#r1'); await raf2(page);
  await fire(page, ['dragover'], '#gE'); await raf2(page);
  expect(await indBefore(page), '전제: 표시선이 끝 갭 언저리에 낡아 있다').toBe('gE');
  await fire(page, ['dragover', 'drop', 'dragend'], '#r2', 'top');
  expect(await rows(page)).toEqual(['r1', 'r2', 'r3']);
});
test('F3 [음성] 표시선이 놓는 자리까지 따라온 뒤 놓아도 결과가 같다', async ({ page }) => {
  await setup(page);
  await fire(page, ['dragstart'], '#r1'); await raf2(page);
  await fire(page, ['dragover'], '#gE'); await raf2(page);
  await fire(page, ['drop', 'dragend'], '#gE');
  expect(await rows(page)).toEqual(['r2', 'r3', 'r1']);
});
