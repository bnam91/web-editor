/* t13d-08 — 0.9.13 t13D-08 신규 섹션 기본 제목 플레이스홀더 «소제목을 입력하세요» → «제목을 입력하세요»
 * A1 addSection() 으로 새 섹션 → 제목 글 칸 = «제목을 입력하세요»(글자·data-placeholder 둘 다) · 안내문구 표시(data-is-placeholder)
 * 양성대조: _patches/t13d-08-CTL.patch(옛 문구) → A1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('A1 새 섹션 제목 안내문구 = «제목을 입력하세요»', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    const h = document.querySelector('#canvas .section-block .text-block .tb-h2');
    return h && { text: h.textContent, ph: h.dataset.placeholder, isPh: h.dataset.isPlaceholder };
  });
  expect(r, '★새 섹션 제목 글 칸').toEqual({ text: '제목을 입력하세요', ph: '제목을 입력하세요', isPh: 'true' });
  expect(errs).toEqual([]);
});
