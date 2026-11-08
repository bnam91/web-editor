/* icontext-icon-size-valign.dom.spec.js — ICONTEXT-ICON-SIZE-POSITION-01 (현빈 0.9.10 QA): 아이콘텍스트 ⑴ 아이콘 크기 숫자칸 ⑵ 아이콘 세로 맞춤(글 기준 위·가운데·아래).
 *   I1 패널: 「아이콘 크기」(prop-slider·prop-number · 간격 줄과 같은 폭) · 「아이콘 맞춤」(prop-align-btn 셋 · 방향 단추와 같은 묶음 클래스)
 *   I2 크기 80 → 아이콘 80×80 · ⌘Z 한 번 = 40
 *   I3 맞춤 위/아래 → 아이콘 윗변 = 글 윗변 / 아랫변 = 글 아랫변 (여러 줄 글) · 가운데 = 옛 모양(속성 없음)
 *   I4 「방향」 세로로 바꾸면 맞춤 줄이 사라지고 아이콘 가로 위치는 정렬(가운데) 그대로 · 다시 가로면 맞춤이 돌아온다
 *   I5 저장 → 다시 열기 유지
 * ★양성대조: block-factory.js setIconTextValign·setIconTextIconSize 를 늘 false 로 하면 I2·I3·I5 빨강 · 템플릿 줄을 빼면 I1 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sI"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60"></div></div>`;
async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  return page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sI'));
    window.addIconTextBlock();
    const b = document.querySelector('#sI .icon-text-block');
    window.updateIconTextBlock(b.id, { text: '첫 줄 글입니다 아주 길게 써서 여러 줄로 감기게 만든다 첫 줄 글입니다 아주 길게 써서 여러 줄로 감기게 만든다 첫 줄 글입니다 아주 길게 써서 여러 줄로' });
    b.style.width = '700px';
    window.clearHistory?.();
    return b.id;
  }, SEC);
}
async function selectItb(page, id) {
  await page.evaluate(() => window.deselectAll?.());
  const r = await waitStableRect(page, `#${id} .itb-text`); await page.mouse.click(r.cx, r.cy);
  await expect(page.locator('#itb-icon-size-number')).toHaveCount(1, { timeout: 3000 });
}
const geo = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id), ic = b.querySelector('.itb-icon'), I = ic.getBoundingClientRect(), T = b.querySelector('.itb-text').getBoundingClientRect(), B = b.getBoundingClientRect();
  const r = Math.round;
  return { w: ic.offsetWidth, h: ic.offsetHeight,   // 캔버스 배율 무관 CSS px
    dTop: r(I.top - T.top), dBot: r(I.bottom - T.bottom), dMid: r((I.top + I.bottom) / 2 - (T.top + T.bottom) / 2), cx: r((I.left + I.right) / 2 - B.left), bw: r(B.width), valign: b.dataset.itbValign ?? null };
}, id);

test('I1 패널 — 아이콘 크기·맞춤 줄 · 기존 클래스·폭', async ({ page }) => {
  const id = await setup(page);
  await selectItb(page, id);
  const p = await page.evaluate(() => {
    const w = (sel) => Math.round(document.querySelector(sel)?.getBoundingClientRect().width ?? -1);
    return { sCls: document.getElementById('itb-icon-size-slider').className, nCls: document.getElementById('itb-icon-size-number').className,
      sameW: w('#itb-icon-size-slider') === w('#itb-gap-slider') && w('#itb-icon-size-number') === w('#itb-gap-number'),
      grp: document.getElementById('itb-valign-group')?.className, grpDir: document.getElementById('itb-dir-group')?.className,
      btns: [...document.querySelectorAll('#itb-valign-group .prop-align-btn')].map(b => b.dataset.itbValign + (b.classList.contains('active') ? '*' : '')),
      noDataAlign: !document.querySelector('#itb-valign-group [data-align]'), val: document.getElementById('itb-icon-size-number').value };
  });
  expect(p).toEqual({ sCls: 'prop-slider', nCls: 'prop-number', sameW: true, grp: 'prop-align-group', grpDir: 'prop-align-group', btns: ['top', 'center*', 'bottom'], noDataAlign: true, val: '40' });
});

test('I2 크기 80 → 80×80 · ⌘Z 한 번 = 40', async ({ page }) => {
  const id = await setup(page);
  await selectItb(page, id);
  await page.fill('#itb-icon-size-number', '80');
  await page.dispatchEvent('#itb-icon-size-number', 'change');
  await expect.poll(async () => { const g = await geo(page, id); return [g.w, g.h]; }).toEqual([80, 80]);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => { const g = await geo(page, id); return [g.w, g.h]; }).toEqual([40, 40]);
});

test('I3 맞춤 위/아래 = 글 윗변/아랫변 · 가운데 = 속성 없음', async ({ page }) => {
  const id = await setup(page);
  await selectItb(page, id);
  await expect.poll(async () => (await geo(page, id)).dTop, '[전제] 가운데 — 여러 줄이라 아이콘이 글 위보다 아래').toBeGreaterThan(10);
  expect(Math.abs((await geo(page, id)).dMid), '[전제] 가운데 = 글 가운데').toBeLessThanOrEqual(1);
  await page.click('#itb-valign-group [data-itb-valign="top"]');
  await expect.poll(async () => (await geo(page, id)).dTop).toBe(0);
  await page.click('#itb-valign-group [data-itb-valign="bottom"]');
  await expect.poll(async () => (await geo(page, id)).dBot).toBe(0);
  await page.click('#itb-valign-group [data-itb-valign="center"]');
  await expect.poll(async () => (await geo(page, id)).valign).toBe(null);
  expect(Math.abs((await geo(page, id)).dMid), '가운데로 돌아왔다').toBeLessThanOrEqual(1);
});

test('I4 방향 세로 — 맞춤 줄 없음 · 아이콘 가로 가운데 그대로 · 가로로 돌아오면 맞춤 복귀', async ({ page }) => {
  const id = await setup(page);
  await selectItb(page, id);
  await page.click('#itb-valign-group [data-itb-valign="top"]');
  await page.click('#itb-dir-group [data-dir="vertical"]');
  await expect(page.locator('#itb-valign-group')).toHaveCount(0);
  const g = await geo(page, id);
  expect(Math.abs(g.cx - g.bw / 2), '세로 방향 기본 = 가운데(맞춤 값이 가로 위치를 안 건드린다)').toBeLessThanOrEqual(1);
  await page.click('#itb-dir-group [data-dir="horizontal"]');
  await expect(page.locator('#itb-valign-group [data-itb-valign="top"].active')).toHaveCount(1);
  await expect.poll(async () => (await geo(page, id)).dTop).toBe(0);
});

test('I5 저장 → 다시 열기 유지', async ({ page }) => {
  const id = await setup(page);
  await page.evaluate((id) => { const b = document.getElementById(id); window.setIconTextIconSize(b, 64); window.setIconTextValign(b, 'bottom'); }, id);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  await expect.poll(async () => { const g = await geo(page, id); return [g.w, g.h, g.valign, g.dBot]; }).toEqual([64, 64, 'bottom', 0]);
});
