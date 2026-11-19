/* panel-redesign-1 — 우측 패널 재설계 «적용 1차»(현빈 확정 261120 · PLAN.md «적용 1차 261120»). 항목마다 한 칸 + CTL 패치(_patches/prd1-*.patch).
 * ★CTL = 제품 코드를 옛 꼴로 되돌린 패치 — 그 패치를 붙인 판에서 해당 칸이 빨강이어야 이 칸이 무엇을 잰다(사람이 돌린다 · 붙여 두지 않는다).
 * 앱 통째(bootApp) · 헤드리스 · CDP·라이브 인스턴스 무접촉.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; window.clearHistory?.(); });
  return errs;
}
async function open(page, cls, entry) {
  const r = await addKind(page, { cls, entry });
  expect(r.err, `[전제] ${cls} 를 넣었다`).toBeUndefined();
  await page.evaluate((id) => window.selectBlock(id), r.id);
  await expect(page.locator('#panel-right .prop-section[data-sec]').first(), `[전제] ${cls} 패널(틀)`).toBeAttached();
  return r.id;
}

/* ① 표준 절 머리 — 쉐브론·클릭 접기 없음. CTL prd1-01-chevron.patch(머리에 role/aria-expanded 되살림) → 빨강 */
test('P1 절 머리 = 제목만 · 눌러도 안 접힘(텍스트 패널 모든 절)', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section[data-sec] > .prop-sec-head > .prop-section-title')]
    .map((h) => ({ id: h.id, svg: h.querySelectorAll('svg').length, exp: h.getAttribute('aria-expanded'), role: h.getAttribute('role') })));
  expect(r.length, '[전제] 절 머리가 있다').toBeGreaterThan(3);
  for (const h of r) expect([h.id, h.svg, h.exp, h.role], `★${h.id} 에 접기 손잡이가 남았다`).toEqual([h.id, 0, null, null]);
  for (const h of r) {
    await page.locator(`#${h.id}`).click();
    await expect(page.locator(`#${h.id.replace(/-head$/, '-body')}`), `★${h.id} 를 누르니 몸이 숨었다`).not.toHaveAttribute('hidden', '');
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ② 절 제목 색 한 규칙(빈 절도) + 간격 12 · 12 · 16. CTL prd1-02-title.patch(제목 색 토큰을 --ui-text-sub 로) → 빨강 */
test('P2 모든 절 제목 색 = --ui-text(빈 Stroke·Effects 도) · 머리 위아래 = --ui-space-3', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const probe = document.createElement('span'); probe.style.color = 'var(--ui-text)'; document.body.appendChild(probe);
    const want = getComputedStyle(probe).color; probe.remove();
    const sp3 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-space-3'));
    return { want, sp3, heads: [...document.querySelectorAll('#panel-right .prop-section[data-sec] > .prop-sec-head > .prop-section-title')].map((h) => {
      const t = h.querySelector('.prop-sec-title-text'), cs = getComputedStyle(h);
      return { id: h.id, color: getComputedStyle(t).color, op: getComputedStyle(t).opacity, pt: parseFloat(cs.paddingTop), pb: parseFloat(cs.paddingBottom) };
    }) };
  });
  expect(r.heads.map((h) => h.id), '[전제] 빈 절(Effects) 머리도 쟀다').toContain('txt-fx-section-head');
  for (const h of r.heads) expect([h.id, h.color, h.op, h.pt, h.pb], `★${h.id} 제목 색·간격`).toEqual([h.id, r.want, '1', r.sp3, r.sp3]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
