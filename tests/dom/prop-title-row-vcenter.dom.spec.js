/* prop-title-row-vcenter.dom.spec.js — 0912 t2-03(Effects 「효과 추가」) · t2-04(Stroke 토글)
 * 절이 «접혀» 머리줄만 남을 때 손잡이가 «위 구분선 ~ 아래 구분선(다음 절 border-top)» 사이 세로 가운데인가.
 * 고치기 전: 머리줄 margin-bottom 6 + .prop-section padding-bottom 4 = 아래만 10px ⇒ 손잡이 −5px(위로 치우침).
 * 양성대조: css/editor-props.css 의 `.prop-section-title-row { … margin-bottom: -4px }` 를 6px 로 되돌리고
 *           `.prop-section > .prop-section-title-row + *` 줄을 지우면 V1 이 −5 로 빨강.
 * V2: 펼친 Stroke 의 머리줄 ↔ 내용 간격이 고치기 전과 같은 6px (펼침 리듬 불변).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const TOL = 0.5;
const SEC = '[id="secT"]';
const SEC_HTML = '<div class="section-block" id="secT" style="position:relative;height:460px;background:#f4f4f6"><div class="section-inner"></div></div>';

async function setupText(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; window.rebindAll?.(); window.applyZoom?.(100); }, SEC_HTML);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * 0.9, r.top + r.height * 0.9, { sel: SEC }, { label: '섹션 고르기' });
  await page.evaluate(() => window.toggleFpDropdown?.('fp-text-dropdown'));
  await page.locator('#fp-text-dropdown .fp-menu-item', { hasText: 'Body' }).first().click();
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secT .text-block').length)).toBe(1);
  await expect(page.locator('#txt-stroke-section')).toBeVisible();
  return errs;
}

/* 손잡이 중심 − (위 구분선 아래끝 ~ 절 아래끝) 중점. 절 아래끝 = 다음 절 border-top 위끝. */
const readCenter = (page, secId) => page.evaluate((id) => {
  const s = document.getElementById(id);
  const row = s?.querySelector(':scope > .prop-section-title-row');
  const ctl = row && [...row.children].find((c) => !c.classList.contains('prop-section-title'));
  if (!ctl) return null;
  const sb = s.getBoundingClientRect(), cb = ctl.getBoundingClientRect();
  const top = sb.top + parseFloat(getComputedStyle(s).borderTopWidth);
  return Math.round(((cb.top + cb.height / 2) - (top + sb.bottom) / 2) * 100) / 100;
}, secId);

test('V1 접힌 Stroke(꺼짐)·Effects(빈) — 손잡이가 위아래 구분선 사이 세로 가운데(≤0.5px)', async ({ page }) => {
  const errs = await setupText(page);
  expect(await page.locator('#txt-stroke-on').isChecked(), '전제: Stroke 꺼짐(접힘)').toBe(false);
  expect(await page.locator('#txt-fx-list').count(), '전제: Effects 에 걸린 효과 없음(접힘)').toBe(0);
  expect(await page.locator('#txt-fx-add').count(), '전제: 「효과 추가」 드롭다운이 있다').toBe(1);
  const d = { stroke: await readCenter(page, 'txt-stroke-section'), fx: await readCenter(page, 'txt-fx-section') };
  console.log('[V1] 손잡이 − 구분선 중점(px) ' + JSON.stringify(d));
  expect(d.stroke, 'Stroke 토글').not.toBe(null);
  expect(d.fx, 'Effects 드롭다운').not.toBe(null);
  expect(Math.abs(d.stroke), `Stroke 토글 ${d.stroke}px`).toBeLessThanOrEqual(TOL);
  expect(Math.abs(d.fx), `Effects 드롭다운 ${d.fx}px`).toBeLessThanOrEqual(TOL);
  expect(errs).toEqual([]);
});

test('V2 펼친 Stroke — 머리줄 아래 ↔ 내용 위 간격 6px 그대로(펼침 리듬 불변)', async ({ page }) => {
  const errs = await setupText(page);
  await page.locator('#txt-stroke-section .prop-toggle').click();
  await expect(page.locator('#txt-stroke-controls')).toBeVisible();
  const gap = await page.evaluate(() => {
    const row = document.querySelector('#txt-stroke-section > .prop-section-title-row').getBoundingClientRect();
    const c = document.getElementById('txt-stroke-controls').getBoundingClientRect();
    return Math.round((c.top - row.bottom) * 100) / 100;
  });
  console.log('[V2] 펼침 간격 ' + gap);
  expect(gap).toBeCloseTo(6, 1);
  expect(errs).toEqual([]);
});
