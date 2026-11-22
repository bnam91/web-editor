/* t13-admin-only-entries — 0.9.13 t13E-10 · t13F-01 «우선 관리자만»(현빈 261122 · 태양)
 *   판정 = js/feature-flags.js animGifVisible 한 자리(서버 role ∨ 앱 관리자 · 모르면 «아님») — 새 판정 0.
 *   t13E-10 텍스트 «상자» 손잡이(t13D-10 showTextBoxResizeHandles · data-tbx-dir) — 관리자 아니면 안 만든다(입구가 손잡이뿐 ⇒ 끌기도 못 탐)
 *   t13F-01 무료 이미지 — 플러그인 판 #plugin-free-image 숨김 + openFreeImageModal 첫 줄 막음(전역 함수로 부르는 길까지)
 * A1 [지킴] 관리자 아님 → 흐름 텍스트 상자 손잡이 0 · 플러그인 판에 무료 이미지 안 보임 · openFreeImageModal() 해도 모달 안 뜸
 * A2 관리자 → 손잡이 8(모서리 넷 + 변 넷) · 무료 이미지 보임 · 모달 뜸
 * 양성대조: _patches/admin-only-CTL.patch(제품 세 줄 되돌림) ⇒ A1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, admin) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const tb = await page.evaluate(async (admin) => {
    window.__admin = { ...(window.__admin || {}), state: () => ({ isAdmin: admin }) };
    const pixabay = { status: async () => ({ hasKey: false, masked: '' }) };   // 가짜 main — 키 화면까지만(실호출 0)
    const base = window.electronAPI;
    window.electronAPI = new Proxy({ pixabay }, { get: (t, k) => (k in t ? t[k] : base?.[k]) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block'); window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec); window.addTextBlock('body');
    const t = sec.querySelector('.text-block'); window.deselectAll();
    return t.id;
  }, admin);
  await waitZoomSettled(page, 100);
  return { errs, tb };
}
async function look(page, tb) {
  await page.evaluate((id) => { window.selectBlock(id); window.showHandlesFor?.(document.getElementById(id)); }, tb);
  await raf(page);
  const tbx = await page.evaluate(() => document.querySelectorAll('#ss-handles-overlay [data-tbx-dir]').length);
  const plug = await page.evaluate(() => { window.toggleFpPluginPanel(); const it = document.getElementById('plugin-free-image'); return !!it && getComputedStyle(it).display !== 'none'; });
  await page.evaluate(() => window.openFreeImageModal());
  const modal = await page.evaluate(() => { const m = document.getElementById('fi-modal'); return !!m && getComputedStyle(m).display !== 'none'; });
  return { tbx, plug, modal };
}

test('A1 [지킴] 관리자 아님 → 텍스트 상자 손잡이 0 · 무료 이미지 입구 0 · 전역 함수로도 안 열림', async ({ page }) => {
  const { errs, tb } = await scene(page, false);
  const r = await look(page, tb);
  console.log('[A1 실측]', JSON.stringify(r));
  expect(r, '★관리자 아님 = 손잡이 0 · 판 숨김 · 모달 안 뜸').toEqual({ tbx: 0, plug: false, modal: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A2 관리자 → 손잡이 8 · 무료 이미지 보임 · 모달 뜸', async ({ page }) => {
  const { errs, tb } = await scene(page, true);
  const r = await look(page, tb);
  console.log('[A2 실측]', JSON.stringify(r));
  expect(r, '★관리자 = 그대로').toEqual({ tbx: 8, plug: true, modal: true });
  const shot = process.env.SHOT_ADMIN;
  if (shot) await page.screenshot({ path: `${shot}/A2-admin-modal.png` });
  expect(errs, errs.join(' | ')).toEqual([]);
});
