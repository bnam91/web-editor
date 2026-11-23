/* u5-add-expands — U5: 항목을 «더하는» 동작(줄·메시지·단계·칼럼·데이터 행·칸) 뒤 새 항목이 사는 Content 절이 보인다.
 * ★기대 바뀜(패널 재설계 1차 · 현빈 확정 «표준 절 접기 없음») — 옛 판은 «접힌 Content 를 더하기가 연다(expandSection)»를 쟀다.
 *   이제 머리를 눌러도 안 접힌다 ⇒ 누른 뒤에도 보이고, 더한 뒤에도 보인다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const CASES = [
  { cls: 'chat-block',       entry: 'addChatBlock',       act: '#chb-add-msg' },
  { cls: 'banner02-block',   entry: 'addBanner02Block',   act: '#bn2-line-add' },
  { cls: 'step-block',       entry: 'addStepBlock',       act: '#stb-add-step' },
  { cls: 'comparison-block', entry: 'addComparisonBlock', act: '#cmp-col-add' },
  { cls: 'graph-block',      entry: 'addGraphBlock',      act: '#grb-add-item' },
  { cls: 'laurel-block',     entry: 'addLaurelBlock',     act: '#lrl-grid-picker .grid-picker-cell[data-r="2"][data-c="3"]' },
];

for (const C of CASES) {
  test(`E ${C.cls} — 머리를 눌러도 Content 가 안 접히고 «${C.act}» 로 더한 뒤에도 보인다`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    const errs = await bootApp(page);
    await page.evaluate(async ({ cls, entry }) => {
      const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
      await window.addSection(); const sec = c.querySelector('.section-block'); window.deselectAll?.(); window.selectSection(sec);
      const before = new Set(document.querySelectorAll('.' + cls));
      await window[entry]();
      const b = [...document.querySelectorAll('.' + cls)].find((x) => !before.has(x));
      window.selectBlock(b.id);
    }, C);
    const sec = page.locator('#panel-right .prop-section[data-sec="content"]');
    const body = sec.locator(':scope > .prop-sec-body');
    await expect(body, '[전제] Content 절이 있고 펼쳐져 있다').toBeVisible();
    await sec.locator(':scope > .prop-sec-head > .prop-section-title').click();
    await expect(body, '★머리를 누르니 Content 가 접혔다').toBeVisible();
    await expect(page.locator(C.act), '[전제] 더하기 손잡이').toBeAttached();
    await page.locator(C.act).dispatchEvent('click');
    await expect(page.locator('#panel-right .prop-section[data-sec="content"] > .prop-sec-body'), '★더한 뒤 Content 가 안 보인다').toBeVisible();
    expect(errs).toEqual([]);
  });
}
