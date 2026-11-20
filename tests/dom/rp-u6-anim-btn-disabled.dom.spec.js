/* rp-u6-anim-btn-disabled — GIF 단추는 «보이되 안 눌린다»(현빈 08-28 · 261021 어드민용으로만 공개 · U6 되돌림).
 * B1 비어드민(하네스 = 어드민 상태 없음) 글 블럭 — #open-anim-btn 이 보이고 disabled · aria-disabled · 까닭 title · GIF 절(#txt-anim-section · 1120b F1 special 「GIF」)이 있다(빈 머리 아님: 단추가 보인다)
 * B2 어드민(animGifVisible 참으로 흉내) — 같은 단추가 눌린다(disabled 아님)
 * 양성대조: prop-text.js 의 showAnimGif 를 `!isOverlayTb && _animVisible()` 로 되돌리면 B1 빨강(단추·절 없음). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function openText(page, admin) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (admin) => {
    if (admin) window.animGifVisible = () => true;
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = c.querySelector('.section-block');
    window.deselectAll?.(); window.selectSection(sec); window.addTextBlock('body', { content: '글' });
    const tb = [...sec.querySelectorAll('.text-block')].pop(); window.deselectAll?.(); tb.classList.add('selected'); window.showTextProperties(tb);
  }, admin);
  return errs;
}
const btn = (page) => page.evaluate(() => { const b = document.getElementById('open-anim-btn'); if (!b) return null;
  return { visible: b.getClientRects().length > 0, disabled: b.disabled, aria: b.getAttribute('aria-disabled'), title: b.title, inGif: b.closest('.prop-section[data-sec]')?.id === 'txt-anim-section' }; });

test('B1 비어드민 — 단추가 보이되 안 눌린다 · 까닭 툴팁 · GIF 절 있음', async ({ page }) => {
  const errs = await openText(page, false);
  const b = await btn(page);
  expect(b, '★GIF 단추가 없다(U2 의 «절째 숨김»으로 돌아갔다)').not.toBeNull();
  expect(b).toMatchObject({ visible: true, disabled: true, aria: 'true', inGif: true });
  expect(b.title, '★까닭 툴팁이 없다').not.toBe('');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B2 어드민 — 같은 단추가 눌린다', async ({ page }) => {
  const errs = await openText(page, true);
  const b = await btn(page);
  expect(b).toMatchObject({ visible: true, disabled: false, aria: null });
  expect(errs, errs.join(' | ')).toEqual([]);
});
