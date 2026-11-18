/* library-insert-overlay — LIB-INSERT-NOSEL-OVERLAY-01 · LIB-MODAL-STAY-OPEN-01(현빈 261118) · js/panels/library-panel.js _target · _floatAt · _sess
 * 장면은 앱의 제 문으로: Plugins(#fp-plugin-btn) → «내장 라이브러리»(#plugin-library) → 칸 클릭 · ⌘Z 는 진짜 키.
 * N1 ★섹션 선택 없음 → 칸 셋 연달아 = 화면 가운데에 가장 가까운 섹션의 «오버레이» 에셋 +3(흐름 블럭 0) · 섹션 상자 안 · 셋이 24px 씩 비켜 놓임 ·
 *    «선택하세요» 알림 0(대신 «넣었어요») · 모달 열린 채 · ⌘Z 3번 = 원래(오버레이 0) · Esc = 닫힘
 * N2 [음성] 섹션 골라 둠 → 칸 셋 연달아 = 그 섹션 «흐름» 에셋 +3(오버레이 0) · 모달 열린 채 · ⌘Z 3번 = 원래
 * 양성대조(CTL · _patches/): lib-nosel-CTL1-no-overlay.patch(_target 의 가운데 자리 → null) → N1 빨강(블럭 +0 · 선택하세요 알림) ·
 *   lib-stay-CTL2-close-on-insert.patch(_done 에서 모달 닫기) → N1·N2 빨강(모달 닫힘) — 예측
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, { select }) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async (select) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); await window.addSection();
    const s = c.querySelectorAll('.section-block')[0];
    s.scrollIntoView({ block: 'center' });
    if (select) window.selectSection(s); else window.deselectAll?.();
  }, select);
  return errs;
}
async function openLibrary(page) {
  if (!(await page.isVisible('#plugin-library'))) await page.click('#fp-plugin-btn');
  await page.click('#plugin-library');
  await expect(page.locator('#lib-modal')).toBeVisible();
}
const look = (page) => page.evaluate(() => {
  const all = [...document.querySelectorAll('#canvas .asset-block')];
  const ov = all.filter((b) => window.OverlayFloat.posElOf(b)?.dataset.overlayBlock === 'true');
  return {
    n: all.length, ov: ov.length,
    inSec: ov.every((b) => { const s = b.closest('.section-block'); if (!s) return false; const r = s.getBoundingClientRect(), q = b.getBoundingClientRect(); return q.left >= r.left - 1 && q.right <= r.right + 1 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1; }),
    xs: ov.map((b) => parseInt(window.OverlayFloat.posElOf(b).dataset.offsetX) || 0),
    toast: document.getElementById('editor-toast')?.textContent || '',
    modal: getComputedStyle(document.getElementById('lib-modal')).display,
  };
});
async function undo3(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  for (let i = 0; i < 3; i++) await page.keyboard.press('Meta+z');
}

test('N1 ★선택 없음 → 오버레이 셋(가운데 · 섹션 안 · 비켜 놓임) · 모달 열린 채 · ⌘Z 3번 = 원래 · Esc 닫힘', async ({ page }) => {
  const errs = await scene(page, { select: false });
  const g0 = await look(page);
  expect(g0.n, '[전제] 에셋 0').toBe(0);
  await openLibrary(page);
  for (let i = 0; i < 3; i++) {
    await page.click('#lib-grid .lib-item[title="QR 기본"]');
    await expect.poll(async () => (await look(page)).n, `${i + 1}번째 넣기`).toBe(i + 1);
  }
  const g = await look(page);
  expect({ ov: g.ov, inSec: g.inSec, modal: g.modal }).toEqual({ ov: 3, inSec: true, modal: 'flex' });
  expect(g.xs[1] > g.xs[0] && g.xs[2] > g.xs[1], `비켜 놓임 ${g.xs}`).toBe(true);
  expect(g.toast, '«선택하세요» 알림 아님').not.toContain('선택');
  expect(g.toast).toContain('넣었어요');
  await undo3(page);
  await expect.poll(async () => (await look(page)).n, '★⌘Z 3번 = 원래').toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lib-modal')).toBeHidden();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('N2 [음성] 섹션 골라 둠 → 흐름 셋 · 오버레이 0 · 모달 열린 채 · ⌘Z 3번 = 원래', async ({ page }) => {
  const errs = await scene(page, { select: true });
  await openLibrary(page);
  for (let i = 0; i < 3; i++) {
    await page.click('#lib-grid .lib-item[title="QR 기본"]');
    await expect.poll(async () => (await look(page)).n, `${i + 1}번째 넣기`).toBe(i + 1);
  }
  const g = await look(page);
  expect({ ov: g.ov, modal: g.modal }).toEqual({ ov: 0, modal: 'flex' });
  await undo3(page);
  await expect.poll(async () => (await look(page)).n, '★⌘Z 3번 = 원래').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
