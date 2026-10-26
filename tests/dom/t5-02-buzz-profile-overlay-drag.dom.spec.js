/* t5-02-buzz-profile-overlay-drag.dom.spec.js — t5-02㉡ 「오버레이 되면 캔버스에서 선택 후 드래그로 위치 이동도 되게 해줄것」
 *
 * ★원문(t5-01 의 하위 줄): 「↳ t5-02 오버레이 되면 캔버스에서 선택 후 드래그로 위치 이동도 되게 해줄것,」
 * ★잰 값(S3 실앱 ×3 · 8608bb13 · 46d444b1 두 판 같음): 버즈 카드(이모지 프로필 · 오버레이 켬)를 고르고 얼굴을 (+40,+20) 끌면
 *   ★얼굴과 카드가 같이 40·20 움직였다(row 째 이동) · 프로필 위치 키 0.
 * ★처방 — 오버레이일 때만 얼굴 mousedown 을 세워(× 단추와 같은 까닭) 얼굴만 끈다 · 놓을 때 profileDx/Dy(모델 px) · 렌더 = translate.
 *
 * ★칸
 *   P  전제 — 버즈 카드 하나에 이모지 프로필 · 오버레이 켬 · 사람 길로 카드를 골랐다
 *   D1 얼굴을 (+40,+20) 화면 px 끌면 — 얼굴은 움직이고(얼굴−카드 거리 변화 ≥ 30) 카드·row 자리는 그대로(±1) · profileDx/Dy 가 생긴다
 *   D2 다시 그려도(renderModalBlock) 얼굴 자리가 남는다
 *   D3 ⌘Z 한 번 ⇒ 키 0 · 얼굴이 처음 자리
 *   D4 (지키는 칸) 오버레이가 아니면 얼굴을 끌어도 프로필 키가 안 생긴다(옛 동작 — 카드 쪽 끌기)
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page, overlay) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (overlay) => {
    await window.addSection();
    window.addBuzzBlock();
    const fr = [...document.querySelectorAll('.frame-block')].filter(f => f.dataset.buzz === '1').pop();
    const card = fr.querySelector('.modal-block');
    card.dataset.profileEmoji = '😊';
    if (overlay) card.dataset.profileOverlay = '1';
    window.renderModalBlock(card); window.refitBuzzRowWidth?.(card); window.deselectAll?.();
    return { fr: fr.id, card: card.id };
  }, overlay);
  await waitStableRect(page, '#' + ids.card);
  /* 카드 고르기 — 묶음 → 카드 (사람처럼 다시 누른다) */
  for (let k = 0; k < 3; k++) {
    const r = await waitStableRect(page, '#' + ids.card + ' .mdl-profile-face');
    await page.mouse.click(r.cx, r.cy);
    const ok = await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected'), ids.card, { timeout: 1500 }).then(() => true, () => false);
    if (ok) break;
  }
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), ids.card), 'P 카드가 골라졌다').toBe(true);
  return { errs, ids };
}

const G = (page, id) => page.evaluate((id) => {
  const c = document.getElementById(id); const f = c.querySelector('.mdl-profile-face'); const row = c.closest('.row');
  const fr = f.getBoundingClientRect(), cr = c.getBoundingClientRect(), rr = row.getBoundingClientRect();
  return { fx: fr.left - cr.left, fy: fr.top - cr.top, cx: cr.left, cy: cr.top, rx: rr.left, ry: rr.top, dx: c.dataset.profileDx ?? null, dy: c.dataset.profileDy ?? null };
}, id);

async function dragFace(page, id) {
  const r = await waitStableRect(page, '#' + id + ' .mdl-profile-face');
  await page.mouse.move(r.cx, r.cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(r.cx + 4 * i, r.cy + 2 * i);
  await page.mouse.up();
}

test('P·D1~D3 ★오버레이 프로필 — 얼굴만 끌려 옮겨진다', async ({ page }) => {
  const { errs, ids } = await setup(page, true);
  const g0 = await G(page, ids.card);
  await dragFace(page, ids.card);
  await page.waitForFunction((id) => document.getElementById(id).dataset.profileDx !== undefined, ids.card, { timeout: 3000 });
  const g1 = await G(page, ids.card);
  expect(Math.abs(g1.fx - g0.fx), `D1 얼굴−카드 가로 ${g0.fx} → ${g1.fx}`).toBeGreaterThanOrEqual(30);
  expect(Math.abs(g1.cx - g0.cx) <= 1 && Math.abs(g1.cy - g0.cy) <= 1, `D1 카드 자리 그대로 (${g0.cx},${g0.cy}) → (${g1.cx},${g1.cy})`).toBe(true);
  expect(Math.abs(g1.rx - g0.rx) <= 1 && Math.abs(g1.ry - g0.ry) <= 1, 'D1 row 자리 그대로').toBe(true);
  expect(Number(g1.dx), 'D1 profileDx > 0').toBeGreaterThan(0);
  await page.evaluate((id) => window.renderModalBlock(document.getElementById(id)), ids.card);
  const g2 = await G(page, ids.card);
  expect(Math.abs(g2.fx - g1.fx) < 1 && Math.abs(g2.fy - g1.fy) < 1, 'D2 다시 그려도 남는다').toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction((id) => document.getElementById(id) && document.getElementById(id).dataset.profileDx === undefined, ids.card, { timeout: 3000 });
  const g3 = await G(page, ids.card);
  expect(Math.abs(g3.fx - g0.fx) < 1 && Math.abs(g3.fy - g0.fy) < 1, `D3 ⌘Z 뒤 얼굴 처음 자리 (${g0.fx},${g0.fy}) vs (${g3.fx},${g3.fy})`).toBe(true);
  expect(errs).toEqual([]);
});

test('D4 ★오버레이가 아니면 프로필 키가 안 생긴다(옛 동작)', async ({ page }) => {
  const { errs, ids } = await setup(page, false);
  await dragFace(page, ids.card);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const g = await G(page, ids.card);
  expect([g.dx, g.dy], 'D4 키 0').toEqual([null, null]);
  expect(errs).toEqual([]);
});
