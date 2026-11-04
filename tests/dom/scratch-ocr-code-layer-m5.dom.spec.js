/* scratch-ocr-code-layer-m5 — 행 184. 어드민 게이트는 두 겹이다: 눈 겹(CSS 가 ✨ 를 숨김) · 코드 겹(_scratchOcrOpen 이 안 열어 줌).
 * 옛 spec 은 한 test 안에 눈 → 코드 순으로 있어, 눈 겹을 걷은 m5 판에서 눈 단언이 먼저 빨개져 코드 겹이 안 돌았다. 칸을 갈랐다.
 * 게이트는 revert b75d995e 로 걷혀 지금 판엔 잴 자리가 없다 ⇒ window.adminOnlyVisible 이 없으면 건너뛴다, 돌아오면 저절로 돈다.
 * 값은 게이트가 있는 판 2c3ce08e 에 이 파일을 얹어 쟀다: 원판 · m5(눈 겹 CSS 걷음) · 코드 겹 가드 걷음(회신 S3-DEC).
 * ★OCR 호출 없음. 자: computed display · 오버레이 style.display. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
async function setup(page, admin) {
  await bootApp(page);
  test.skip(!(await page.evaluate(() => typeof window.adminOnlyVisible === 'function')), '이 판엔 어드민 게이트가 없다(행 184 · revert b75d995e)');
  await page.evaluate(async ({ PNG, admin }) => {
    window.__admin._forceState(admin ? { ok: true, isAdmin: true } : { ok: true, isAdmin: false, hasRoleField: true });
    await window.initScratchPad('pO', 'pg1');
    await window._scratchAddAndSaveFx(PNG, 10, 10, 100, undefined, 'sA');
  }, { PNG, admin });
}
const overlay = (page) => page.evaluate(() => document.getElementById('ai-prompt-overlay').style.display);
const openByCode = (page) => page.evaluate(() => window._scratchOcrOpen('sA'));

test('눈 겹: 일반 계정에겐 ✨ 가 안 보인다', async ({ page }) => {
  await setup(page, false);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.scratch-item[data-scratch-id="sA"] .scratch-ai-btn')).display)).toBe('none');
});
test('코드 겹: 일반 계정이 코드로 불러도 안 열린다', async ({ page }) => {
  await setup(page, false);
  await openByCode(page);
  expect(await overlay(page)).toBe('none');
});
test('음성: 어드민이 코드로 부르면 열린다 — 위 칸의 «안 열림» 이 자가 죽어서가 아니다', async ({ page }) => {
  await setup(page, true);
  await openByCode(page);
  await expect.poll(() => overlay(page)).not.toBe('none');
});
