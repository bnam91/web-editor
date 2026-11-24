/* rp-small4 — 117행 소형 4(현빈 261123 GO · 근거 handoff/AUDIT-right-panel-261119.md · 가지 tp/0913-rp-small4).
 *   R15 챗 Typography — 렌더러가 안 읽는 칸(Font·굵기·B/I/S·줄간격·자간)을 «숨기지 않고 안 그림»(_typo-section omitHidden) · 크기칸은 산다·쓴다
 *   R16 그래프 방사형 — 값 표시·값 색상·Data 값 칸 안 그림 · 라벨 타이핑(syncItems)에도 항목 값이 보존된다
 *   R8ⓐ 태그 그룹 — 안 골랐을 때 힌트가 한국어(«태그를 눌러 색 바꾸기»)
 *   (R5 이미지 편집 «높이» 칸 = 편집 모드 진입이 무거워 유닛 rp-small4-src 가 소스로 잰다)
 * 양성대조: prop-chat.js 의 omitHidden: true 를 지우면 C1 빨강 · prop-graph.js syncItems 의 _vIn 대체를 옛 querySelector().value 로 되돌리면 G2 pageerror 빨강 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); });
  return errs;
}
const add = (page, entry, cls) => page.evaluate(async ({ entry, cls }) => { const before = new Set(document.querySelectorAll('.' + cls)); await window[entry](); const b = [...document.querySelectorAll('.' + cls)].find((x) => !before.has(x)); window.selectBlock(b.id); return b.id; }, { entry, cls });
const has = (page, sel) => page.evaluate((sel) => !!document.querySelector('#panel-right ' + sel), sel);

test('C1 챗 Typography — 끈 칸 DOM 0 · 크기칸 있음', async ({ page }) => {
  const errs = await scene(page);
  await add(page, 'addChatBlock', 'chat-block');
  await expect.poll(() => has(page, '#chb-typo-size-number')).toBe(true);
  for (const sel of ['#chb-typo-font-picker', '#chb-typo-font-weight', '#chb-typo-style-group', '#chb-typo-lh-number', '#chb-typo-ls-col'])
    expect(await has(page, sel), `${sel} 가 DOM 에 남았다(R15)`).toBe(false);
  expect(errs).toEqual([]);
});

test('G2 그래프 방사형 — 값 칸 셋 DOM 0 · 라벨 타이핑에 값 보존', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'addGraphBlock', 'graph-block');
  await page.evaluate(() => document.querySelector('#panel-right #grb-type-radial').click());
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.chartType, id)).toBe('radial');
  expect(await has(page, '#grb-show-vlabel'), '값 표시').toBe(false);
  expect(await has(page, '#grb-vlabel-color'), '값 색상').toBe(false);
  expect(await has(page, '.grb-data-val-input'), 'Data 값').toBe(false);
  const before = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items).map((x) => x.value), id);
  await page.evaluate(() => { const i = document.querySelector('#panel-right .grb-data-label-input'); i.value = i.value + 'x'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  const after = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items).map((x) => x.value), id);
  expect(after, '라벨만 바꿨는데 값이 바뀌었다').toEqual(before);
  expect(errs).toEqual([]);
});

test('L1 태그 그룹 — 힌트 한국어', async ({ page }) => {
  const errs = await scene(page);
  await add(page, 'addLabelGroupBlock', 'label-group-block');
  const t = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-hint')].map((e) => e.textContent.trim()).join(' | '));
  expect(t).toContain('태그를 눌러 색 바꾸기');
  expect(t).not.toContain('Click a tag');
  expect(errs).toEqual([]);
});
