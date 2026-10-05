/* branch-scope-add.dom.spec.js — 브랜치 패널 「+ 섹션」(스코프에 섹션 추가)이 Electron 에서 «안 죽는다» (2026-10-05)
 *   뿌리 = ds-colorvar-add 와 같다: Electron 렌더러는 prompt() 를 지원하지 않는다(`Uncaught Error: prompt() is not supported.`).
 *   js/branch-system.js 「+ 섹션」이 prompt() 의 마지막 살아 있는 호출이었다 → DesignSystem.openInlineNameForm «재사용»으로 바꿨다.
 * ★하네스(_root-harness.js bootApp)는 Electron 처럼 prompt 에서 «던진다» — 옛 코드는 여기서 pageerror 로 빨강이 된다.
 * 진짜 마우스로 「+ 섹션」을 누르고 진짜 키보드로 번호를 친다.
 * ★양성대조 판 0f572e2a(고치기 전) → 빨강 예상: S1 S2 S3 / 초록 예상: S0(전제). 결과는 커밋 메시지에 «이름»으로. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const BR = 'feat-x';
async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate((BR) => {
    const canvas = document.getElementById('canvas');
    for (const [id, label] of [['sec_t1', '첫째'], ['sec_t2', '둘째'], ['sec_t3', '셋째']]) {
      if (document.getElementById(id)) continue;
      const s = document.createElement('div'); s.className = 'section-block'; s.id = id;
      s.innerHTML = `<span class="section-label">${label}</span>`;
      canvas.appendChild(s);
    }
    const store = window.loadBranchStore?.() || { current: 'main', branches: { main: {} } };
    store.branches[BR] = { scope: ['sec_t1'], createdAt: Date.now(), updatedAt: Date.now() };
    store.current = BR;
    window.saveBranchStore(store);
    window.switchToTab?.('branch');
    window.renderBranchPanel();
    window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); };
  }, BR);
  await page.waitForTimeout(250);
  return errs;
}
const scopeOf = (page) => page.evaluate((BR) => window.loadBranchStore().branches[BR].scope, BR);
/* 힌트 목록에서 그 라벨의 번호를 «화면 글자»로 읽는다(번호를 검사가 지어내지 않게) */
const numberOf = (page, label) => page.evaluate((label) => {
  const h = document.querySelector('#branch-scope-add-form .prop-hint')?.textContent || '';
  const m = h.split('\n').find(l => l.endsWith(' ' + label));
  return m ? m.split('.')[0] : null;
}, label);
async function clickAdd(page) {
  const b = page.locator('#branch-panel-body .branch-scope-add').first();
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await page.waitForTimeout(150);
}

test('S0 전제 — 현재 브랜치 행에 「+ 섹션」이 보이고 스코프는 [첫째] 하나다', async ({ page }) => {
  await setup(page);
  expect(await page.locator('#branch-panel-body .branch-scope-add').first().isVisible()).toBe(true);
  expect(await scopeOf(page)).toEqual(['sec_t1']);
});
test('S1 ★누르면 «안 죽는다»(prompt 예외 없음) — 번호 칸이 열리고 고를 목록이 보인다', async ({ page }) => {
  const errs = await setup(page);
  await clickAdd(page);
  expect(errs.filter(e => /prompt/.test(e)), '★prompt() 예외 — Electron 에서 「+ 섹션」이 통째로 죽는 그 증상').toEqual([]);
  expect(await page.isVisible('#branch-scope-add-input')).toBe(true);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('branch-scope-add-input');
  const hint = await page.textContent('#branch-scope-add-form .prop-hint');
  expect(hint).toContain('둘째');
  expect(hint).toContain('셋째');
  expect(hint, '이미 스코프에 든 섹션은 목록에 없다').not.toContain('첫째');
});
test('S2 ★번호 치고 Enter → 그 섹션이 스코프에 들어가고 폼은 닫힌다', async ({ page }) => {
  await setup(page);
  await clickAdd(page);
  const n = await numberOf(page, '셋째');
  expect(n, '전제 — 목록에서 「셋째」의 번호를 읽었다').not.toBeNull();
  await page.keyboard.type(n);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect(await scopeOf(page)).toEqual(['sec_t1', 'sec_t3']);
  expect(await page.isVisible('#branch-scope-add-input')).toBe(false);
});
test('S3 범위 밖 번호 → 안 넣고 까닭을 말하고 폼은 열린 채 · Esc 는 아무것도 안 한다', async ({ page }) => {
  await setup(page);
  await clickAdd(page);
  expect(await page.isVisible('#branch-scope-add-input'), '전제 — 폼이 열렸다(안 열리면 «안 들어감»이 공짜로 참)').toBe(true);
  await page.keyboard.type('99'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  expect(await scopeOf(page)).toEqual(['sec_t1']);
  expect(await page.isVisible('#branch-scope-add-input'), '폼은 열린 채').toBe(true);
  expect((await page.evaluate(() => window.__t)).join('|')).toMatch(/사이 번호/);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  expect(await page.isVisible('#branch-scope-add-input')).toBe(false);
  expect(await scopeOf(page)).toEqual(['sec_t1']);
});
