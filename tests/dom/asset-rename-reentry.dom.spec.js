/* asset-rename-reentry.dom.spec.js — ⚠️#8 → ⑴(지디 10-06): 자산 이름을 고치는 중 «단어 고르려» 더블클릭하면 친 글자가 사라진다
 * 증상(잼 ×5 · 917420e3): 더블클릭 진입 → «새이름» → 이름 안 단어 더블클릭 → 친 글자 남음 0/5 (이름이 «새 폴더»로 되돌아감).
 * 자리: js/panels/assets-panel.js 이름 dblclick(:634) → _assetsBeginInlineRename — 들어오는 문 가드 없음 → 재진입이 nameEl.textContent = cur(저장된 이름)로 되씀.
 * 고침 = RG-N5/N5c 와 같은 들어오는 문 가드(편집 중이면 다시 들어가지 않음). 떼는 자리(finish :795)는 이미 옳다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
test.describe.configure({ timeout: 60000 });
const TYPED = '새이름';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => window.switchToTab?.('assets'));
  await page.waitForTimeout(200);
  const id = await page.evaluate(() => window.assetsCreateFolder?.());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(200);   // 만들기 자동 편집은 끝내고 «사용자 더블클릭»으로 들어간다
  const sel = `.assets-row[data-asset-id="${id}"] .assets-row-name`;
  expect(await page.evaluate((s) => !!document.querySelector(s), sel), '[전제] 새 폴더 이름 칸').toBe(true);
  return { errs, sel };
}
const at = (page, sel) => page.evaluate((s) => { const n = document.querySelector(s); n.scrollIntoView({ block: 'center' }); const r = n.getBoundingClientRect(); return [r.left + Math.min(8, r.width / 3), r.top + r.height / 2]; }, sel);
const st = (page, sel) => page.evaluate((s) => { const n = document.querySelector(s); return { ce: n.isContentEditable, text: n.textContent }; }, sel);

test('#8 ㉠ [전제] 자산 이름 더블클릭 → 편집 중', async ({ page }) => {
  const { sel } = await setup(page);
  const p = await at(page, sel); await page.mouse.dblclick(p[0], p[1]); await page.waitForTimeout(250);
  expect((await st(page, sel)).ce).toBe(true);
});

test('#8 ㉦ [새 것] 편집 중 단어 더블클릭 → 친 글자가 남는다 · 편집 중 그대로', async ({ page }) => {
  const { sel } = await setup(page);
  const p = await at(page, sel); await page.mouse.dblclick(p[0], p[1]); await page.waitForTimeout(250);
  await page.keyboard.press('End'); await page.keyboard.type(TYPED); await page.waitForTimeout(150);
  expect((await st(page, sel)).text, '[전제] 친 글자가 들어갔다').toContain(TYPED);
  const p2 = await at(page, sel); await page.mouse.dblclick(p2[0], p2[1]); await page.waitForTimeout(300);
  const s = await st(page, sel);
  expect({ ce: s.ce, keeps: s.text.includes(TYPED) }, `단어 더블클릭 뒤 «${s.text}»`).toEqual({ ce: true, keeps: true });
});
