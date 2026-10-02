/* ds-colorvar-add.dom.spec.js — 현빈 2026-10-02 「디자인시스템 탭에서 컬러변수 추가가 아예 안 된다」
 *   실앱 스택: design-system.js:521 `Uncaught Error: prompt() is not supported.` — Electron 렌더러는 prompt() 를 지원하지 않는다.
 * ★하네스(_root-harness.js bootApp)가 이제 Electron 처럼 prompt 에서 «던진다» — 그 전엔 Playwright 가 대화창을 null 로 닫아
 *   이 기능이 하네스에선 «안 죽고» 지나갔다(한 환경에서만 참인 검사).
 * 대체 = 이 레포에 이미 있는 «인라인 입력 폼» 꼴(variable-binding.js 서랍의 + → 이름칸·저장·취소). 새 모달을 만들지 않는다.
 * 진짜 마우스로 「＋ 변수 추가」를 누르고 진짜 키보드로 이름을 친다.
 * ★양성대조 판 7699ea33 → 빨강: V1(누르면 던진다 — pageerror) V2 V3 V4(전제에서 짐) V5 / 초록: V0(전제 — 단추가 보인다). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => {
    window.switchToTab?.('inspector');
    const p = document.getElementById('design-system-panel'); if (p && !p.classList.contains('open')) window.DesignSystem.togglePanel();
    /* 「컬러 변수」 절이 접혀 있으면 편다(절 머리 클릭과 같은 효과 — 접힘 클래스 제거) */
    const lbl = [...document.querySelectorAll('.ds-section-label')].find(l => l.textContent.includes('컬러 변수'));
    if (lbl?.classList.contains('collapsed')) lbl.click();
    window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); };
  });
  await page.waitForTimeout(250);
  return errs;
}
const vars = (page) => page.evaluate(() => [...document.querySelectorAll('#ds-colorvars-list .ds-colorvar-row')].map(r => r.textContent.replace('×', '').trim()));
async function clickAdd(page) {
  await page.locator('#ds-colorvar-add-btn').scrollIntoViewIfNeeded();
  await page.click('#ds-colorvar-add-btn');
  await page.waitForTimeout(150);
}

test('V0 전제 — 「＋ 변수 추가」 단추가 보인다', async ({ page }) => {
  await setup(page);
  expect(await page.isVisible('#ds-colorvar-add-btn')).toBe(true);
});
test('V1 ★누르면 «안 죽는다»(prompt 예외 없음) — 이름 칸이 그 자리에 열리고 포커스가 간다', async ({ page }) => {
  const errs = await setup(page);
  await clickAdd(page);
  expect(errs.filter(e => /prompt/.test(e)), '★prompt() 예외 — Electron 에서 기능이 통째로 죽는 그 증상').toEqual([]);
  expect(await page.isVisible('#ds-colorvar-name-input')).toBe(true);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('ds-colorvar-name-input');
});
test('V2 ★이름 치고 Enter → 변수가 목록에 생긴다 · 폼은 닫힌다', async ({ page }) => {
  await setup(page);
  const before = await vars(page);
  await clickAdd(page);
  await page.keyboard.type('brandMain');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const after = await vars(page);
  expect(after.length).toBe(before.length + 1);
  expect(after.some(v => v.includes('brandMain'))).toBe(true);
  expect(await page.isVisible('#ds-colorvar-name-input')).toBe(false);
});
test('V3 빈 이름·이미 있는 이름은 안 만든다 — 까닭을 말하고 폼은 열린 채(고쳐 칠 수 있게)', async ({ page }) => {
  await setup(page);
  await clickAdd(page);
  await page.keyboard.type('dupName'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  const n1 = (await vars(page)).length;
  await clickAdd(page);
  await page.keyboard.type('dupName'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  expect((await vars(page)).length, '같은 이름은 안 생긴다').toBe(n1);
  expect(await page.isVisible('#ds-colorvar-name-input'), '폼은 열린 채').toBe(true);
  await page.fill('#ds-colorvar-name-input', '   '); await page.press('#ds-colorvar-name-input', 'Enter'); await page.waitForTimeout(150);
  expect((await vars(page)).length, '빈 이름은 안 생긴다').toBe(n1);
  expect((await page.evaluate(() => window.__t)).join('|')).toMatch(/이미|입력/);
});
test('V4 Esc · 취소 = 아무것도 안 만들고 닫힌다', async ({ page }) => {
  await setup(page);
  const before = await vars(page);
  await clickAdd(page);
  expect(await page.isVisible('#ds-colorvar-name-input'), '전제 — 폼이 열렸다(안 열리면 «아무것도 안 생김»이 공짜로 참)').toBe(true);
  await page.keyboard.type('nope'); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  expect(await page.isVisible('#ds-colorvar-name-input')).toBe(false);
  expect(await vars(page)).toEqual(before);
});

test('V5 ★같은 탭의 「＋ New Design System」 도 prompt 없이 이름을 받는다 — 저장되면 Base 드롭다운에 그 이름', async ({ page }) => {
  const errs = await setup(page);
  await page.locator('[onclick*="saveNewPreset"]').scrollIntoViewIfNeeded();
  await page.click('[onclick*="saveNewPreset"]'); await page.waitForTimeout(150);
  expect(errs.filter(e => /prompt/.test(e)), '★prompt() 예외').toEqual([]);
  expect(await page.isVisible('#ds-preset-name-input')).toBe(true);
  await page.keyboard.type('My DS'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  expect(await page.evaluate(() => [...document.querySelectorAll('#ds-base-select option')].some(o => o.textContent === 'My DS'))).toBe(true);
  expect(await page.isVisible('#ds-preset-name-input')).toBe(false);
});
