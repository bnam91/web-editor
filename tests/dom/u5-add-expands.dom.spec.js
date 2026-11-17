/* u5-add-expands — U5: 항목을 «더하는» 동작(줄·메시지·단계·칼럼·데이터 행·칸)은 새 항목이 사는 Content 절이 접혀 있으면 펼친다
 * (틀 _panel-frame.js expandSection — 접기 상태는 절 key 전역이라 다른 블록에서 접어 둔 Content 가 남아 있을 수 있다).
 * 양성대조: 각 prop-*.js 의 그 핸들러 첫 줄 expandSection('content') 를 지우면 그 칸 빨강(Content 몸이 숨은 채). */
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
  test(`E ${C.cls} — 접힌 Content 에 «${C.act}» 로 항목을 더하면 Content 가 펼쳐진다`, async ({ page }) => {
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
    await expect(body, '[전제] 접었다').toBeHidden();
    await expect(page.locator(C.act), '[전제] 더하기 손잡이').toBeAttached();
    await page.locator(C.act).dispatchEvent('click');   // 손잡이가 접힌 몸 안에 있어도(보이지 않아도) 사람이 누른 것과 같은 길
    await expect(page.locator('#panel-right .prop-section[data-sec="content"] > .prop-sec-body'), '★더한 뒤 Content 가 펼쳐졌다').toBeVisible();
    expect(errs).toEqual([]);
  });
}
