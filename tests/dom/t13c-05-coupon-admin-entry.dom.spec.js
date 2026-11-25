/* t13c-05-coupon-admin-entry — t13C-05: 컴포넌트 메뉴의 «Coupon» 넣기 입구는 관리자만.
 *   판정 = js/feature-flags.js animGifVisible(서버 role ∨ 앱 관리자 · 모르면 «아님») 재사용 — 공개 범위일 뿐 접근통제 아님.
 *   장면: 일반 계정(__admin._forceState isAdmin:false) → 메뉴 펼침 → Coupon 안 보임(Comparison 은 보임 = 전제) ·
 *         이미 든 쿠폰은 저장→다시 열기 뒤에도 보이고 눌러 패널(#cpn-width-slider)이 뜬다 →
 *         관리자(isAdmin:true)로 바꿔 다시 펼치면 Coupon 이 보이고 눌러 쿠폰이 생긴다.
 * ⛔고정 대기 0(조건 대기).
 * 양성대조(CTL _patches/t13c-05-coupon-gate-ctl.patch): toggleFpDropdown 의 _applyAdminEntryGate('fp-add-coupon') 호출(t13F-01 에서 이름만 일반화) 줄을 지우면
 *   관리자 장면의 «Coupon 보임» 단언 빨강(index.html 기본 display:none 이 그대로라서). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TRIGGER = '#fp-component-dropdown .fp-dropdown-trigger';
const couponItem = (page) => page.locator('#fp-component-menu .fp-menu-item', { hasText: /^Coupon$/ });

async function openMenu(page) {
  await page.click(TRIGGER);
  await expect(page.locator('#fp-component-menu .fp-menu-item', { hasText: 'Comparison' })).toBeVisible();
}

test('C1 일반 계정엔 Coupon 입구 없음·기존 쿠폰은 열리고 고쳐짐 → 관리자는 입구 보이고 눌러 생김', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await bootApp(page);

  /* 일반 계정 — 입구 없음 */
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: false, hasRoleField: true }));
  await openMenu(page);
  await expect(couponItem(page)).toBeHidden();
  await page.click(TRIGGER);   // 닫기
  await expect(page.locator('#fp-component-dropdown')).not.toHaveClass(/open/);

  /* 기존 쿠폰(API 로 넣음) — 저장→다시 열기 뒤 보이고 눌러 패널이 뜬다 */
  await page.click('.fp-btn.primary[title^="새 섹션 추가"]');
  await expect.poll(() => page.evaluate(() => !!window.getSelectedSection?.())).toBe(true);
  const id = await page.evaluate(() => window.addCouponBlock()?.block?.id);
  expect(id, '쿠폰 블록이 만들어졌다(API 는 누구에게나 살아 있다)').toBeTruthy();
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: false, hasRoleField: true }));
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); window.deselectAll?.(); }, snap);
  const el = page.locator(`[id="${id}"]`);
  await expect(el, '다시 열어도 쿠폰이 보인다').toBeVisible();
  await el.scrollIntoViewIfNeeded();
  await el.click();
  await expect.poll(() => page.evaluate(() => !!document.getElementById('cpn-width-slider')), { timeout: 4000 }).toBe(true);

  /* 관리자 — 입구 보이고 눌러 쿠폰이 하나 더 생긴다 */
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: true }));
  await page.keyboard.press('Escape');
  await page.click('.fp-btn.primary[title^="새 섹션 추가"]');   // 넣을 섹션(addCouponBlock 은 고른 섹션 필요)
  await expect.poll(() => page.evaluate(() => !!window.getSelectedSection?.())).toBe(true);
  const before = await page.locator('.coupon-block').count();
  await openMenu(page);
  await expect(couponItem(page)).toBeVisible();
  await couponItem(page).click();
  await expect.poll(() => page.locator('.coupon-block').count()).toBe(before + 1);
  expect(errs).toEqual([]);
});
