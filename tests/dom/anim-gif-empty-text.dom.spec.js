/* anim-gif-empty-text — GIF-V1-EMPTY-TEXT-SAMPLE-01(DONE40 X2): 빈 글 블럭이 «Sample Text» GIF + 성공 토스트로 나갔다.
 * ⇒ 빈 글이면 GIF 저장 단추를 끄고 까닭을 툴팁으로(지디 결정 A).
 * E1 빈 글 — 단추 꺼짐 · aria-disabled · 툴팁에 까닭 · exportAnimGif 를 불러도 GIF 를 안 만든다(콘솔 길)
 * E2 공백만 — E1 과 같다
 * E3 [지킴] 글이 있으면 — 단추 켜짐 · 툴팁 없음
 * 양성대조: js/animation-engine.js 만 부모 판으로 → E1·E2 빨강 · E3 초록 → git checkout HEAD -- js/animation-engine.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function openWith(page, text) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async (text) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.textContent = text;
    window.openAnimModal(tb);
    const btn = document.querySelector('.anim-export-btn');
    let made = 0;
    const real = window.GIF;
    window.GIF = function () { made++; throw new Error('만들기 시도 기록용'); };
    try { await window.exportAnimGif(); } finally { window.GIF = real; }
    return { disabled: btn.disabled, aria: btn.getAttribute('aria-disabled'), title: btn.title, made };
  }, text);
  return { errs, r };
}

for (const [name, text] of [['E1 빈 글', ''], ['E2 공백만', '   ']]) {
  test(`${name} — 단추 꺼짐 · 까닭 툴팁 · GIF 안 만듦`, async ({ page }) => {
    const { errs, r } = await openWith(page, text);
    expect(r.disabled, '★빈 글인데 저장 단추가 켜져 있다(«Sample Text» GIF 가 나간다)').toBe(true);
    expect(r.aria).toBe('true');
    expect(r.title).toContain('비어');
    expect(r.made, '★빈 글로 GIF 를 만들려 했다').toBe(0);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('E3 [지킴] 글이 있으면 — 단추 켜짐 · 툴팁 없음', async ({ page }) => {
  const { errs, r } = await openWith(page, '글자 있음');
  expect(r.made, '전제: 만들기를 시도했다(주입 실패로 끝남)').toBe(1);
  expect(r.disabled, '실패 뒤 단추가 돌아온다').toBe(false);
  expect(r.aria).toBeNull();
  expect(r.title).toBe('');
  expect(errs, errs.join(' | ')).toEqual([]);
});
