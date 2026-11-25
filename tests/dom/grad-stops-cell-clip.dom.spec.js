/* grad-stops-cell-clip — 0.9.14 #75 GRAD-STOPS-LIST-RIGHT-CELL-CLIP-01
 * 그라데이션 블럭 정지점 목록(#grad-stops-list .grad-stop-row)의 오른쪽 칸(위치 % · 투명도 %)이 줄 끝에서 잘렸다(«0 '»·«100 '»).
 * 줄(.prop-color-row · overflow:hidden · 183px)에 스와치 24 + hex 바닥(6ch+14) + 34 + «%» + 48 + «%» + × 가 gap 6 으로 안 들어가
 * 끝의 «%» 와 × 가 잘렸다(목록 넘침 아님 — 줄 안 잘림).
 * C1 각 줄의 투명도·위치 칸 = 표준 숫자 칸(.prop-icon-input · 높이 --ui-input-h 24 · «%» = .prop-unit 칸 안)
 * C2 칸 안 글자 안 잘림(input.scrollWidth ≤ clientWidth) · 칸·«%»·× 가 줄 안(줄 scrollWidth ≤ clientWidth) — 값 0 · 100 · 3자리(50→100 사이 중간 정지점 포함)
 * 8f184e346 에서 빨강(C1: 칸 감싸개 없음 · C2: 줄 넘침).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function gradScene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); const b = window.addGradientBlock(); const el = (b && b.id && document.getElementById(b.id)) || [...document.querySelectorAll('.gradient-block')].pop(); window.selectBlock?.(el.id); window.showGradientProperties(el); window.clearHistory?.(); return el.id; });
  await page.waitForSelector('#grad-stops-list .grad-stop-row', { state: 'attached' });
  return { errs, id };
}

const measure = (page) => page.evaluate(() => [...document.querySelectorAll('#grad-stops-list .grad-stop-row')].map((row) => {
  const rr = row.getBoundingClientRect();
  const cell = (cls) => {
    const inp = row.querySelector('.' + cls); const box = inp.closest('.prop-icon-input'); const unit = box?.querySelector(':scope > .prop-unit');
    const b = (box || inp).getBoundingClientRect(); const u = unit?.getBoundingClientRect();
    return { v: inp.value, std: !!box && row.contains(box), h: Math.round(b.height), hTok: getComputedStyle(document.documentElement).getPropertyValue('--ui-input-h').trim(),
      unit: unit?.textContent || null, textFits: inp.scrollWidth <= inp.clientWidth, sw: inp.scrollWidth, cw: inp.clientWidth,
      inRow: b.left >= rr.left - 0.5 && b.right <= rr.right + 0.5 && (!u || u.right <= rr.right + 0.5) };
  };
  const del = row.querySelector('.grad-stop-del').getBoundingClientRect();
  return { rowFits: row.scrollWidth <= row.clientWidth, rsw: row.scrollWidth, rcw: row.clientWidth, delIn: del.width > 0 && del.right <= rr.right + 0.5,
    alpha: cell('grad-stop-alpha'), offset: cell('grad-stop-offset') };
}));

function check(rows, tag) {
  expect(rows.length, `[전제] ${tag} 정지점 줄`).toBeGreaterThanOrEqual(2);
  rows.forEach((r, i) => {
    for (const k of ['alpha', 'offset']) {
      const c = r[k];
      expect([c.std, c.h, c.hTok, c.unit], `★C1 ${tag} 줄 ${i} ${k} = 표준 숫자 칸(.prop-icon-input · 24 · «%» 칸 안)`).toEqual([true, 24, '24px', '%']);
      expect(c.textFits, `★C2 ${tag} 줄 ${i} ${k}=${c.v} 글자 잘림(scrollWidth ${c.sw} > clientWidth ${c.cw})`).toBe(true);
      expect(c.inRow, `★C2 ${tag} 줄 ${i} ${k}=${c.v} 칸·«%» 가 줄 밖(잘림)`).toBe(true);
    }
    expect([r.rowFits, r.delIn], `★C2 ${tag} 줄 ${i} 넘침(scrollWidth ${r.rsw} > ${r.rcw}) · × 보임`).toEqual([true, true]);
  });
}

test('C1·C2 정지점 줄 오른쪽 칸 — 표준 칸 · 0 · 100 · 3자리 안 잘림', async ({ page }) => {
  const { errs } = await gradScene(page);
  const r0 = await measure(page);
  console.log('[C 실측 기본]', JSON.stringify(r0));
  expect(r0.map((r) => r.offset.v), '[전제] 기본 정지점 위치 0 · 100').toEqual(['0', '100']);
  check(r0, '기본');
  await page.click('#grad-add-stop'); await raf(page);
  const r1 = await measure(page);
  console.log('[C 실측 셋]', JSON.stringify(r1));
  expect(r1.length, '[전제] 중간색 추가 = 셋').toBe(3);
  expect(r1.some((r) => r.alpha.v === '100'), '[전제] 3자리 값(100) 있음').toBe(true);
  check(r1, '셋');
  expect(errs, errs.join(' | ')).toEqual([]);
});
