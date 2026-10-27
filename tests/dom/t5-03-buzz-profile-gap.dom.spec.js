/* t5-03-buzz-profile-gap.dom.spec.js — t5-03ⓐ 버즈 카드 «프로필 ↔ 글» 간격 칸(현빈 · 수지 재측 ◑: 11 모델px 고정 · 칸 0개)
 *   처방(지디 정밀 발주): 프로필 행만 dataset.profileGap ?? MODAL_ROW_GAP(11) · ⛔아이콘 행(.mdl-iconrow)은 그 상수 그대로 ·
 *   BUZZ_PROFILE_KEYS 에 profileGap · 패널 한 줄(프로필 크기 줄 선례) · 범위 0~400(chat-bounds profileGap 선례) · 음수는 현빈 답 뒤.
 *
 * 양성대조 핀 ec356d14(t5-01 · 이 고침 전): GD1001_ROOT=<핀 사본> ⇒ G·Z·S 빨강 · P0·I 초록.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js t5-03-buzz-profile-gap
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

async function clickToggle(page) {
  const lab = page.locator('#bzf-section label.prop-toggle:has(#bzf-pf-on)');
  await expect(lab, '토글이 있다').toHaveCount(1);
  await lab.scrollIntoViewIfNeeded();
  const r = await lab.boundingBox();
  await clickAt(page, r.x + r.width / 2, r.y + r.height / 2, { sel: '#bzf-section label.prop-toggle' }, { label: '프로필 토글' });
}


/* 카드마다 «프로필 상자 오른쪽 끝 ↔ 글 칸 왼쪽» 사이(레이아웃 px = 모델 px · 배율 무관) */
const gaps = (page, fid) => page.evaluate((fid) => [...document.getElementById(fid).querySelectorAll(':scope > .row > .modal-block')].map((m) => {
  const pf = m.querySelector('.mdl-profilerow > .mdl-profile'), tx = m.querySelector('.mdl-profilerow > .tb-mdl-text');
  if (!pf || !tx) return null;
  return pf.dataset.side === 'right' ? pf.offsetLeft - (tx.offsetLeft + tx.offsetWidth) : tx.offsetLeft - (pf.offsetLeft + pf.offsetWidth);
}), fid);
async function onWithProfile(page) {
  const s = await setup(page);
  await clickToggle(page);
  await expect.poll(async () => (await gaps(page, s.fid)).filter((g) => g !== null).length, { message: '전제: 프로필 행 6' }).toBe(6);
  return s;
}
async function typeGap(page, v) {
  const n = page.locator('#bzf-pfgap-number');
  await expect(n, '★간격 숫자칸').toHaveCount(1);
  await n.scrollIntoViewIfNeeded(); await n.click({ clickCount: 3 }); await page.keyboard.type(String(v)); await page.keyboard.press('Enter');
}

test('P0 전제 — 켠 뒤 6장 모두 프로필 ↔ 글 간격 = 11(옛 상수)', async ({ page }) => {
  const { errs, fid } = await onWithProfile(page);
  expect(await gaps(page, fid)).toEqual([11, 11, 11, 11, 11, 11]);
  expect(errs).toEqual([]);
});

test('G ★패널 간격 칸에 30 ⇒ 6장 모두 30 · dataset.profileGap 30 · ⌘Z 한 번 = 11', async ({ page }) => {
  const { errs, fid } = await onWithProfile(page);
  await expect(page.locator('#bzf-pfgap-slider'), '★슬라이더').toHaveCount(1);
  await typeGap(page, 30);
  await expect.poll(() => gaps(page, fid), { message: '★간격 30' }).toEqual([30, 30, 30, 30, 30, 30]);
  expect(await page.evaluate((fid) => [...document.getElementById(fid).querySelectorAll(':scope > .row > .modal-block')].map((m) => m.dataset.profileGap), fid)).toEqual(Array(6).fill('30'));
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => gaps(page, fid), { message: '★⌘Z 한 번 = 11' }).toEqual([11, 11, 11, 11, 11, 11]);
  expect(errs).toEqual([]);
});

test('Z ★0 은 된다 · 음수(−10)는 0 에서 멈춘다(음수는 현빈 답 뒤)', async ({ page }) => {
  const { errs, fid } = await onWithProfile(page);
  await typeGap(page, 0);
  await expect.poll(() => gaps(page, fid)).toEqual([0, 0, 0, 0, 0, 0]);
  await typeGap(page, -10);
  await expect.poll(() => gaps(page, fid)).toEqual([0, 0, 0, 0, 0, 0]);
  await expect(page.locator('#bzf-pfgap-number')).toHaveValue('0');
  expect(errs).toEqual([]);
});

test('I ★아이콘 행은 안 움직인다 — 같은 모달에 profileGap 30 이 적혀도 .mdl-iconrow gap 11', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => {
    if (!document.querySelector('#canvas .section-block')) window.addSection?.();
    const sec = document.querySelector('#canvas .section-block');
    const { row, block: b } = window.makeModalBlock({ variant: 'icon' });
    (sec.querySelector('.section-inner') || sec).appendChild(row);
    b.dataset.profileGap = '30';
    window.renderModalBlock(b);
    const ir = b.querySelector('.mdl-iconrow');
    return ir ? getComputedStyle(ir).columnGap : null;
  });
  expect(r, '★아이콘 행 gap = 옛 상수').toBe('11px');
  expect(errs).toEqual([]);
});

test('S ★저장 꼴 왕복 — 섹션 HTML 을 다시 들여도 간격 30 이 산다', async ({ page }) => {
  const { errs, fid } = await onWithProfile(page);
  await typeGap(page, 30);
  await expect.poll(() => gaps(page, fid)).toEqual([30, 30, 30, 30, 30, 30]);
  const fid2 = await page.evaluate((fid) => {
    const sec = document.getElementById(fid).closest('.section-block');
    const html = sec.outerHTML; const c = document.getElementById('canvas');
    sec.remove(); c.insertAdjacentHTML('beforeend', html); window.rebindAll?.();
    const f = document.getElementById(fid);
    f.querySelectorAll(':scope > .row > .modal-block').forEach((m) => window.renderModalBlock(m));
    return f.id;
  }, fid);
  await expect.poll(() => gaps(page, fid2), { message: '★다시 들인 뒤 30' }).toEqual([30, 30, 30, 30, 30, 30]);
  expect(errs).toEqual([]);
});
