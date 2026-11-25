/* grid-scroll-sync-191 — 0.9.13 191 · 현빈 261126 «줌 인 · 트랙패드 세로 스크롤 동안 핸들이 떨어졌다가 멈추면 다시 붙음»
 *   S1 ★스크롤 사건 «같은 틱»에 머리띠·거터가 이미 그리드를 따라와 있다(rAF 기다림 0)
 *   S2 [지킴] rAF 길 그대로 — 두 프레임 뒤에도 같은 거리 · 블럭 고름 풀면 머리띠 걷힘
 *   원인 가설(관성 휠 cancelable=false · 미확정) = 진단 window.__wheelNonCancelable · 확인 = 현빈 휴먼QA */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf2 = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('S1·S2 (191) 스크롤 사건 같은 틱에 머리띠·거터 = 그리드 따라옴 · rAF 길 지킴', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    for (let i = 0; i < 6; i++) await window.addSection();
    const sec = document.querySelectorAll('#canvas .section-block')[2];
    window.selectSection(sec); window.addGridBlock();
    const g = [...sec.querySelectorAll('.grid-block')].pop(); g.id = 'gS';
    g.scrollIntoView({ block: 'center' }); window.deselectAll(); window.selectBlock('gS'); window.showGridGutters(g);
  });
  await raf2(page);
  const r = await page.evaluate(() => new Promise((res) => {
    const wrap = document.getElementById('canvas-wrap'), g = document.getElementById('gS');
    const d = () => { const b = document.querySelector('.grd-headband[data-axis="col"]'); const u = document.querySelector('.grd-gutter[data-axis="col"]');
      const gt = g.getBoundingClientRect().top; return { band: Math.round(b.getBoundingClientRect().top - gt), gut: u ? Math.round(u.getBoundingClientRect().top - gt) : null }; };
    const before = d(), top0 = wrap.scrollTop;
    wrap.addEventListener('scroll', () => res({ before, inTick: d(), moved: wrap.scrollTop - top0 }), { once: true });
    wrap.scrollTop += 120;
  }));
  console.log('[191 S1 실측]', JSON.stringify(r));
  expect(r.moved, '[전제] 스크롤 밀림').toBeGreaterThan(50);
  expect(r.inTick, '★스크롤 사건 같은 틱 = 머리띠·거터 거리 그대로(떨어짐 0)').toEqual(r.before);
  await raf2(page);
  const after = await page.evaluate(() => { const g = document.getElementById('gS'), b = document.querySelector('.grd-headband[data-axis="col"]'); return Math.round(b.getBoundingClientRect().top - g.getBoundingClientRect().top); });
  expect(after, '[지킴] rAF 뒤에도 같은 거리').toBe(r.before.band);
  await page.evaluate(() => window.deselectAll()); await raf2(page);
  expect(await page.locator('.grd-headband').count(), '[지킴] 고름 풀면 머리띠 걷힘(rAF 길)').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
