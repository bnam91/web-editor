/* t13-admin-only-entries — 0.9.13 t13E-10 · t13F-01 «우선 관리자만»(현빈 261122 · 태양)
 *   판정 = js/feature-flags.js animGifVisible 한 자리(서버 role ∨ 앱 관리자 · 모르면 «아님») — 새 판정 0.
 *   t13E-10 텍스트 «상자» 손잡이(t13D-10 showTextBoxResizeHandles · data-tbx-dir) — 관리자 아니면 안 만든다(입구가 손잡이뿐 ⇒ 끌기도 못 탐)
 *   t13F-01 무료 이미지 — 플러그인 판 #plugin-free-image 숨김 + openFreeImageModal 첫 줄 막음(전역 함수로 부르는 길까지)
 * A1 [지킴] 관리자 아님 → 흐름 텍스트 상자 손잡이 0 · 플러그인 판에 무료 이미지 안 보임 · openFreeImageModal() 해도 모달 안 뜸
 * A2 관리자 → 손잡이 8(모서리 넷 + 변 넷) · 무료 이미지 보임 · 모달 뜸
 * 양성대조: _patches/admin-only-CTL.patch(제품 세 줄 되돌림) ⇒ A1 빨강.
 * ── 현빈 261123 정정 ── 관리자만 = «파란» 상자 손잡이(흐름 글)뿐 · 오버레이(Ignore Auto Layout) 글의 «보라» 손잡이·아웃라인은 일반 계정도 늘 · 슬라이드 메뉴 = 회색 예고
 *   색 실측(탐침): 흐름 tbx 테두리 rgb(45,111,232) · 오버레이 tbx·옛 모서리 rgb(153,102,255) · 오버레이 선택 선 ss-sel-path--sticker rgb(153,102,255)
 * A3 일반 계정 + 오버레이 글 → 보라 손잡이 여덟(옛 모서리 넷 + 상자 변 넷) · 다 보라 · 선택 선 보라
 * A3b 관리자 + 오버레이 글 → 그대로 여덟
 * A4 슬라이드 메뉴 — 일반 = 보이되 disabled·aria-disabled·흐림·«곧 공개» · 눌러도 0 / 관리자 = 눌림
 * 양성대조: _patches/admin-redo-CTL.patch(오버레이 예외·회색 예고 되돌림) ⇒ A3·A4 빨강.
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

const PURPLE = 'rgb(153, 102, 255)';
async function floatScene(page, admin) {
  const { errs, tb } = await scene(page, admin);
  await page.evaluate(async (id) => { const tf = document.getElementById(id).closest('.frame-block[data-text-frame]'); const m = await import(new URL('js/overlay-float.js', document.baseURI).href); m.enterFloat(tf); m._applyOverlayPos(tf, 200, 80); window.deselectAll(); }, tb);
  await page.evaluate((id) => { window.selectBlock(id); window.showHandlesFor?.(document.getElementById(id)); document.activeElement?.blur?.(); }, tb);
  await raf(page);
  return { errs, tb };
}
const purpleLook = (page) => page.evaluate(() => {
  const hs = [...document.querySelectorAll('#ss-handles-overlay .tfo-overlay-handle')].filter((h) => getComputedStyle(h).display !== 'none');
  const path = document.querySelector('svg.ss-sel-layer .ss-sel-path');
  return { tbx: hs.filter((h) => h.dataset.tbxDir).length, corner: hs.filter((h) => h.dataset.tfResizeDir).length,
    colors: [...new Set(hs.map((h) => getComputedStyle(h).borderTopColor))], line: path ? getComputedStyle(path).stroke : null };
});

test('A3 일반 계정 + 오버레이 글 → 보라 손잡이 여덟 · 선택 선 보라', async ({ page }) => {
  const { errs } = await floatScene(page, false);
  const r = await purpleLook(page);
  console.log('[A3 실측]', JSON.stringify(r));
  expect(r, '★IAL(오버레이) = 보라는 일반 계정도 보인다').toEqual({ tbx: 4, corner: 4, colors: [PURPLE], line: PURPLE });
  const shot = process.env.SHOT_ADMIN; if (shot) await page.screenshot({ path: `${shot}/A3-user-overlay-purple.png`, clip: { x: 0, y: 0, width: 1500, height: 500 } });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A3b 관리자 + 오버레이 글 → 그대로 여덟', async ({ page }) => {
  const { errs } = await floatScene(page, true);
  const r = await purpleLook(page);
  expect(r, '★관리자 = 그대로').toEqual({ tbx: 4, corner: 4, colors: [PURPLE], line: PURPLE });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A4 슬라이드 메뉴 — 일반 = 회색 예고(안 눌림 · 곧 공개) · 관리자 = 눌림', async ({ page }) => {
  const { errs } = await scene(page, false);
  const look = () => page.evaluate(() => { document.body.click(); const b = document.getElementById('fp-add-slide'); const before = document.querySelectorAll('#canvas .slide-block').length; b.click();
    return { shown: getComputedStyle(b).display !== 'none', dis: b.disabled, aria: b.getAttribute('aria-disabled'), op: b.style.opacity, tip: /곧 공개/.test(b.title), added: document.querySelectorAll('#canvas .slide-block').length - before }; });
  const u = await look();
  await page.evaluate(() => { window.__admin = { ...(window.__admin || {}), state: () => ({ isAdmin: true }) }; window.selectSection(document.querySelector('#canvas .section-block')); });
  const a = await look();
  console.log('[A4 실측]', JSON.stringify({ u, a }));
  expect(u, '★일반 = 보이되 안 눌림').toEqual({ shown: true, dis: true, aria: 'true', op: 'var(--ui-disabled-opacity)', tip: true, added: 0 });
  expect({ shown: a.shown, dis: a.dis, aria: a.aria, tip: a.tip, added: a.added }, '★관리자 = 눌림').toEqual({ shown: true, dis: false, aria: null, tip: false, added: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});
