/* pen-esc-before-label-focus-223.dom.spec.js — 시트 223 PEN-ESCAPE-BEFORE-LABEL-FOCUS-20-55MS-01
 *   증상(앱 ×3 · df8241e1): 펜 끝내기로 라벨 편집이 열린 직후, 초점이 오기 전(setTimeout 0)에 Esc·V ⇒ 펜만 꺼지고 라벨은 편집으로 남아 다음 글자가 «텍스트»를 덮어쓴다.
 *   칸: P1 더블+Esc · P2 더블+V · P3 Enter+Esc — 틈 안 키(마이크로태스크, 초점 타이머보다 앞섬이 보장된다)
 *       N1 [음성대조] 초점이 온 뒤 Esc · N2 [음성대조] 글을 친 뒤 Esc — 글이 확정된다
 *   양성대조: _commitOpenLabel 을 옛 줄로 되돌리면 P1·P2·P3 빨강 · N1·N2 초록.
 *   키만 합성(틈을 사람 손으로 못 맞춘다) — 틈 안 진짜 키는 앱에서 쟀다. 점 찍기·이후 글자는 진짜 입력. ⛔고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function draw(page, end, key) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = '<div class="section-block" id="secA" style="position:relative;height:520px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.(); window.clearHistory?.(); window.applyZoom?.(100); window.deselectAll?.();
    document.getElementById('secA').scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  const sr = await waitStableRect(page, '#secA');
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click('#fp-pen-menu .fp-menu-item[onclick*="togglePenMode"]');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), '[전제] 펜 모드').toBe(true);
  /* 틈 안 키: 편집을 연 그 호출 뒤 마이크로태스크 — 끝내기 코드는 다 지나고 초점 타이머는 아직이다 */
  if (key) await page.evaluate((key) => {
    const begin = window.annotBeginLabelEdit;
    window.annotBeginLabelEdit = (b, l) => {
      begin(b, l);
      queueMicrotask(() => { window.__focusBefore = document.activeElement === l; document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
      window.annotBeginLabelEdit = begin;
    };
  }, key);
  const y = sr.top + sr.height * 0.6, x0 = sr.left + sr.width * 0.25, x1 = sr.left + sr.width * 0.75;
  await page.mouse.click(x0, y);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.annot-preview .annot-preview-dot').length), '[전제] 점 1').toBeGreaterThanOrEqual(1);
  if (end === 'Enter') {
    await page.mouse.click(x1, y);
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.annot-preview .annot-preview-dot').length), '[전제] 점 2').toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Enter');
  } else await page.mouse.dblclick(x1, y);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secA .annotation-block').length), '[전제] 블럭 생김').toBe(1);
  return errs;
}
const passTimers = (page) => page.evaluate(() => new Promise((r) => setTimeout(() => setTimeout(r, 0), 0)));   // 초점 타이머가 지나간 뒤
const st = (page) => page.evaluate(() => {
  const l = document.querySelector('#secA .annot-label');
  return { ce: l.getAttribute('contenteditable'), focus: document.activeElement === l, pen: document.body.classList.contains('pen-mode'), sel: getSelection().toString(), text: l.textContent, stored: l.closest('.annotation-block').dataset.text };
});
const labelFocused = (page) => page.evaluate(() => document.activeElement?.classList?.contains('annot-label'));

for (const [name, end, key] of [['P1 더블+Esc', 'dbl', 'Escape'], ['P2 더블+V', 'dbl', 'v'], ['P3 Enter+Esc', 'Enter', 'Escape']]) {
  test(`${name} — 초점 전 키: 편집이 끝나고 펜이 꺼지며 다음 글자가 라벨로 안 간다`, async ({ page }) => {
    const errs = await draw(page, end, key);
    await passTimers(page);
    expect(await page.evaluate(() => window.__focusBefore), '[전제] 키가 초점보다 앞섰다').toBe(false);
    expect(await st(page)).toEqual({ ce: 'false', focus: false, pen: false, sel: '', text: '텍스트', stored: '텍스트' });
    await page.keyboard.type('Z');
    expect((await st(page)).text, '다음 글자').toBe('텍스트');
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('N1 [음성대조] 초점이 온 뒤 Esc — 편집이 끝나고 펜이 꺼진다', async ({ page }) => {
  const errs = await draw(page, 'dbl', null);
  await expect.poll(() => labelFocused(page), '[전제] 초점이 왔다').toBe(true);
  await page.keyboard.press('Escape');
  expect(await st(page)).toEqual({ ce: 'false', focus: false, pen: false, sel: '', text: '텍스트', stored: '텍스트' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('N2 [음성대조] 글을 친 뒤 Esc — 친 글이 확정된다', async ({ page }) => {
  const errs = await draw(page, 'dbl', null);
  await expect.poll(() => labelFocused(page), '[전제] 초점이 왔다').toBe(true);
  await page.keyboard.type('AB');
  await page.keyboard.press('Escape');
  expect(await st(page)).toEqual({ ce: 'false', focus: false, pen: false, sel: '', text: 'AB', stored: 'AB' });
  expect(errs, errs.join(' | ')).toEqual([]);
});
