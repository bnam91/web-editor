/* anim-gif-rich-warn — 옛 GIF-V1 RICHTEXT(⑸ · DONE40) 경고 «꾸밈(색·형광·굵기)은 GIF 에 안 실립니다»(#anim-rich-warn · 지디 결정 C)를
 *   RICHTEXT-EFFECTS-01 C7 에서 지웠다 — 부분 꾸밈을 이제 GIF 에 실제로 그린다(C1~C6 · 현빈 결정 «화면 == 내보낸 것»). 그리기 자체는 anim-gif-richtext R1~R6 이 잰다.
 * W1 조각 꾸밈(색 span · 굵게 b · 형광 background-color)이 있어도 경고 요소가 없다 · 모달 글에 «안 실립니다» 0
 * W2 [지킴] 같은 함수(_updateAnimConflictWarning)의 다른 경고 — 두 줄 글 + 카운트업이면 #anim-conflict-warn 보임
 * 양성대조(예측): index.html 에 옛 <div id="anim-rich-warn"> 를 되살리면 → W1 빨강 · W2 초록
 * 셀렉터 대조(제품 소스 grep): #anim-gif-modal · #anim-conflict-warn(index.html) · #anim-list .anim-item[data-id](animation-engine.js _buildAnimList) ·
 *   window.addSection · window.selectSection(editor.js:5271) · window.addTextBlock · window.openAnimModal(엔진 끝)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function openWith(page, html) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ({ html }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.innerHTML = html;
    window.openAnimModal(tb);
  }, { html });
  return errs;
}

test('W1 조각 꾸밈이 있어도 «안 실립니다» 경고 없음(이제 그린다)', async ({ page }) => {
  const errs = await openWith(page, '보통 <span style="color:#ff0000">빨강</span> <b>굵게</b> <span style="background-color:#ffff00">형광</span>');
  await expect(page.locator('#anim-gif-modal')).toBeVisible();
  await expect(page.locator('#anim-rich-warn'), '★옛 경고 요소가 남아 있다').toHaveCount(0);
  await expect(page.locator('#anim-gif-modal'), '★모달에 «안 실립니다»').not.toContainText('안 실립니다');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('W2 [지킴] 두 줄 글 + 카운트업 — 줄바꿈 경고(#anim-conflict-warn)는 그대로', async ({ page }) => {
  const errs = await openWith(page, '할인 12,345원<br>둘째 줄');
  await expect(page.locator('#anim-list .anim-item[data-id="count-up"]'), '[전제] 목록에 카운트업').toHaveCount(1);
  await page.click('#anim-list .anim-item[data-id="count-up"]');
  await expect(page.locator('#anim-conflict-warn')).toBeVisible();
  expect(errs, errs.join(' | ')).toEqual([]);
});
