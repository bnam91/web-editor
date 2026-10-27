/* t5-01-buzz-profile-toggle.dom.spec.js — t5-01 「프로필 넣을때, 일괄넣기 기능을 하면 원형 이미지(체크패턴) 먼저 온오프로 보이게」(현빈)
 *   버즈 패널 「프로필」 일괄 절 맨 위에 ★켬/끔 토글(#bzf-pf-on). 켜면 카드마다 ★체크무늬 원 자리(.mdl-profile-empty)가
 *   먼저 보이고, 그 뒤 이미지·이모지 일괄이 그 원을 채운다. 끄면 프로필이 걷힌다(「프로필 제거」와 같은 끝).
 *   ★체크무늬는 새 식이 아니다 — css/editor-blocks.css 의 빈 이미지 칸 규칙(.grd-img-empty · small 토큰)에 셀렉터만 더했다.
 *
 * 양성대조 핀 68ba1f1b(origin/dev, 이 고침 전): GD1001_ROOT=<핀 사본> 으로 같은 시험 → T·C·E·O 빨강 · P0 초록.
 * 하네스 = bootApp(앱 통째) · 삽입은 삽입 메뉴 「Buzz」 진짜 클릭 · 토글은 진짜 클릭(buzz-frame.dom.spec.js 와 같은 길).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js t5-01-buzz-profile-toggle
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    await document.fonts?.ready;
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection?.();
    const sec = c.querySelector('.section-block');
    window.deselectAll?.(); window.selectSection?.(sec); window.clearHistory?.();
  });
  const t = await waitStableRect(page, '#fp-component-dropdown .fp-dropdown-trigger');
  await clickAt(page, t.cx, t.cy, { sel: '#fp-component-dropdown .fp-dropdown-trigger' }, { label: 'Component 펼치기' });
  const item = page.locator('#fp-component-menu .fp-menu-item', { hasText: /^Buzz$/ });
  await expect(item, '전제: 삽입 메뉴에 「Buzz」').toBeVisible();
  const b = await item.boundingBox();
  await clickAt(page, b.x + b.width / 2, b.y + b.height / 2, { sel: '#fp-component-menu .fp-menu-item' }, { label: 'Buzz 누르기' });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .frame-block[data-buzz="1"]').length), { message: '전제: 버즈 프레임' }).toBe(1);
  const fid = await page.evaluate(() => document.querySelector('#canvas .frame-block[data-buzz="1"]').id);
  await waitStableRect(page, `[id="${fid}"]`);
  await expect(page.locator('#bzf-section'), '전제: 프레임 패널에 Buzz 절').toHaveCount(1);
  return { errs, fid };
}

/* 카드마다 프로필 상태 — 체크 원(빈 자리) · 사진 · 이모지 · 없음 */
const faces = (page, fid) => page.evaluate((fid) => {
  const ms = [...document.getElementById(fid).querySelectorAll(':scope > .row > .modal-block')];
  return ms.map((m) => {
    const e = m.querySelector('.mdl-profile .mdl-profile-empty');
    if (e) { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { kind: 'empty', checker: /conic-gradient/.test(cs.backgroundImage), radius: cs.borderRadius, w: Math.round(r.width), h: Math.round(r.height) }; }
    if (m.querySelector('.mdl-profile .mdl-profile-emoji')) return { kind: 'emoji' };
    if (m.querySelector('.mdl-profile .mdl-profile-img')) return { kind: 'img' };
    return { kind: m.querySelector('.mdl-profile') ? 'other' : 'none' };
  });
}, fid);

async function clickToggle(page) {
  const lab = page.locator('#bzf-section label.prop-toggle:has(#bzf-pf-on)');
  await expect(lab, '토글이 있다').toHaveCount(1);
  await lab.scrollIntoViewIfNeeded();
  const r = await lab.boundingBox();
  await clickAt(page, r.x + r.width / 2, r.y + r.height / 2, { sel: '#bzf-section label.prop-toggle' }, { label: '프로필 토글' });
}

test('P0 전제 — 버즈 6장 · 프로필 0 · 일괄 절(이미지 선택 · 이모지)이 있다', async ({ page }) => {
  const { errs, fid } = await setup(page);
  const f = await faces(page, fid);
  expect(f.length).toBe(6);
  expect(f.every((x) => x.kind === 'none')).toBe(true);
  await expect(page.locator('#bzf-pf-img')).toHaveCount(1);
  await expect(page.locator('#bzf-pf-emoji')).toHaveCount(1);
  expect(errs).toEqual([]);
});

test('T ★일괄 절에 프로필 켬/끔 토글 · 처음은 꺼짐', async ({ page }) => {
  const { errs, fid } = await setup(page);
  await expect(page.locator('#bzf-pf-on'), '★토글 칸').toHaveCount(1);
  expect(await page.locator('#bzf-pf-on').isChecked()).toBe(false);
  expect(errs).toEqual([]);
});

test('C ★켜면 6장 모두 «체크무늬 원»이 먼저 보인다(둥근 · 사진 칸과 같은 크기) · 토글 켜짐 · ⌘Z 한 번 = 처음', async ({ page }) => {
  const { errs, fid } = await setup(page);
  await clickToggle(page);
  await expect.poll(async () => (await faces(page, fid)).filter((x) => x.kind === 'empty').length, { message: '★체크 원 6' }).toBe(6);
  const f = await faces(page, fid);
  expect(f.every((x) => x.checker), '★체크무늬(conic-gradient)').toBe(true);
  expect(f.every((x) => x.radius === '50%'), '★원형').toBe(true);
  expect(f.every((x) => x.w > 0 && x.w === x.h), '★정사각 상자').toBe(true);
  await expect(page.locator('#bzf-pf-on'), '★패널 토글이 켜짐으로').toBeChecked();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await faces(page, fid)).every((x) => x.kind === 'none'), { message: '★⌘Z 한 번 = 프로필 0' }).toBe(true);
  expect(errs).toEqual([]);
});

test('E ★켠 뒤 이모지 일괄 → 체크 원 6 이 이모지 6 으로 채워진다', async ({ page }) => {
  const { errs, fid } = await setup(page);
  await clickToggle(page);
  await expect.poll(async () => (await faces(page, fid)).filter((x) => x.kind === 'empty').length).toBe(6);
  const em = page.locator('#bzf-pf-emoji');
  await em.scrollIntoViewIfNeeded(); await em.click(); await page.keyboard.type('😊'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await faces(page, fid)).filter((x) => x.kind === 'emoji').length, { message: '★이모지 6' }).toBe(6);
  expect((await faces(page, fid)).filter((x) => x.kind === 'empty').length, '★체크 원 0').toBe(0);
  expect(errs).toEqual([]);
});

test('O ★끄면 프로필이 걷힌다(체크 원 0 · 이모지도 0) · 토글 꺼짐', async ({ page }) => {
  const { errs, fid } = await setup(page);
  await clickToggle(page);
  await expect.poll(async () => (await faces(page, fid)).filter((x) => x.kind === 'empty').length).toBe(6);
  await clickToggle(page);
  await expect.poll(async () => (await faces(page, fid)).every((x) => x.kind === 'none'), { message: '★끄면 0' }).toBe(true);
  await expect(page.locator('#bzf-pf-on')).not.toBeChecked();
  expect(errs).toEqual([]);
});
