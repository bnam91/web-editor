/* frame-stack-align.dom.spec.js — 현빈 「스택모드에서 중앙정렬이 안 먹는다」 (F4, 2026-10-03)
 * 원인: 프레임 정렬 단추(prop-frame _setAlign 스택 갈래)가 :scope>.row 의 align-self 만 만졌다.
 *   ① row[stack] 은 폭 100% — row 가 가운데로 가도 «안의 에셋(고정폭)»은 그대로  ② 직계 비-row 자식(text-frame·직계 에셋)은 미처리.
 * 자식 4종 × 좌·중·우 — «내용»(에셋·글 상자) 자체의 가로 위치를 프레임 안쪽 상자(패딩 제외) 기준으로 잰다.
 * ⛔그리드 «칸 안» 글자 정렬은 칸 정렬 몫(이 단추 밖). row>그리드 상자는 폭 100% 라 원래 무변화(G).
 * ⛔앱 통째 헤드리스(bootApp). 실행: npx playwright test --config=tests/dom/playwright.dom.config.js frame-stack-align --workers=2 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const KINDS = {
  'K1 row[stack]>에셋200': `<div class="row" data-layout="stack"><div class="asset-block" id="k" data-align="left" style="width:200px;height:60px;align-self:flex-start;background:#ccc"></div></div>`,
  'K2 직계 text-frame': `<div class="frame-block" id="k" data-text-frame="true" data-bg="transparent" style="background:transparent;width:133px;box-sizing:border-box;max-width:100%;align-self:flex-start"><div class="text-block" data-type="body"><div class="tb-body" style="text-align:left">안녕하세요</div></div></div>`,
  'K3 직계 에셋(변환 잔여 align-self:center)': `<div class="asset-block" id="k" data-align="center" style="width:240px;height:60px;align-self:center;background:#ccc"></div>`,
  'K4 row(레이아웃 미지정·가로)>에셋200': `<div class="row"><div class="asset-block" id="k" style="width:200px;height:60px;background:#ccc"></div></div>`,
};

async function setup(page, kindHtml, { padX } = {}) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  await page.evaluate(({ kindHtml }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div><div class="section-inner"></div></div>`);
    const ss = window.makeFrameBlock({ fullWidth: true });
    ss.style.width = '860px'; ss.style.padding = '30px'; ss.dataset.width = '860';
    ss.insertAdjacentHTML('beforeend', kindHtml);
    document.querySelector('#sec1 .section-inner').appendChild(ss);
    window.rebindAll?.();
    window.showFrameProperties(ss);
    window.__ss = ss.id;
  }, { kindHtml });
  await page.waitForTimeout(250);
}
/* «내용 가로 위치» — 프레임 안쪽(패딩 제외) 상자 기준 left / right 여백, 배율 보정 */
const pos = (page) => page.evaluate(() => {
  const ss = document.getElementById(window.__ss), k = document.getElementById('k');
  const fr = ss.getBoundingClientRect(), kr = k.getBoundingClientRect();
  const sc = fr.width / ss.offsetWidth || 1;
  const innerL = fr.left + 30 * sc, innerR = fr.right - 30 * sc;
  return { left: (kr.left - innerL) / sc, right: (innerR - kr.right) / sc, centerDiff: ((kr.left + kr.right) / 2 - (innerL + innerR) / 2) / sc, w: kr.width / sc };
});
const press = async (page, id) => { await page.click(`#${id}`); await page.waitForTimeout(150); };

for (const [name, html] of Object.entries(KINDS)) {
  test(`${name} ★가운데 정렬 → 내용 중심 차 ≤1px`, async ({ page }) => {
    await setup(page, html);
    if (!name.startsWith('K3')) expect((await pos(page)).centerDiff, '전제: 처음엔 가운데가 아니다').toBeLessThan(-100);
    await press(page, 'ss-align-hcenter');
    expect(Math.abs((await pos(page)).centerDiff)).toBeLessThanOrEqual(1);
  });
  test(`${name} ★왼쪽 → 왼 여백 0, 오른쪽 → 오른 여백 0`, async ({ page }) => {
    await setup(page, html);
    await press(page, 'ss-align-right');
    expect(Math.abs((await pos(page)).right)).toBeLessThanOrEqual(1);
    await press(page, 'ss-align-left');
    expect(Math.abs((await pos(page)).left)).toBeLessThanOrEqual(1);
  });
}

test('U1 ⌘Z 한 걸음 — 가운데 정렬 한 번이 한 걸음으로 돌아간다 (직계 text-frame)', async ({ page }) => {
  await setup(page, KINDS['K2 직계 text-frame']);
  const before = await pos(page);
  await press(page, 'ss-align-hcenter');
  expect(Math.abs((await pos(page)).centerDiff)).toBeLessThanOrEqual(1);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect((await pos(page)).left).toBeCloseTo(before.left, 0);
});
test('U2 ⌘Z 한 걸음 — row[stack]>에셋', async ({ page }) => {
  await setup(page, KINDS['K1 row[stack]>에셋200']);
  const before = await pos(page);
  await press(page, 'ss-align-hcenter');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect((await pos(page)).left).toBeCloseTo(before.left, 0);
});
test('S1 저장·다시 열기 뒤에도 가운데 (row>에셋 · 직계 text-frame)', async ({ page }) => {
  for (const key of ['K1 row[stack]>에셋200', 'K2 직계 text-frame', 'K4 row(레이아웃 미지정·가로)>에셋200']) {
    await setup(page, KINDS[key]);
    await press(page, 'ss-align-hcenter');
    const snap = await page.evaluate(() => window.serializeProject());
    await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__ss = document.querySelector('#canvas .frame-block[data-full-width]').id; });
    expect(Math.abs((await pos(page)).centerDiff), key).toBeLessThanOrEqual(1);
  }
});
test('R1 폭에 «여유 없는» 자식(row>꽉 찬 에셋)은 정렬해도 안 움직이고 안 깨진다', async ({ page }) => {
  await setup(page, `<div class="row" data-layout="stack"><div class="asset-block" id="k" style="width:100%;height:60px;background:#ccc"></div></div>`);
  const a = await pos(page);
  await press(page, 'ss-align-hcenter');
  const b = await pos(page);
  expect(b.w).toBeCloseTo(a.w, 0); expect(Math.abs(b.centerDiff)).toBeLessThanOrEqual(1);
});
