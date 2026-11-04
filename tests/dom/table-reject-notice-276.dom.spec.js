/* table-reject-notice-276.dom.spec.js — 시트 276 「표 패널이 거절할 때 사용자에게 보이는 말이 없다」의 자 (imac-gd-L3 · 261031 · JQ-RULER-A ⑵)
 * ★두 자리다: 숫자 칸은 공용 가드(prop-number-commit-guard · C1 죔 · B1 오타), 머리 병합 칸(type=text · 가드 회원 아님)은 js/props/prop-table.js _applyMergeInput(R1·R2).
 *   R0 [전제] 거절이 정말 일어났다(값 안 바뀜 · 칸 원복) — 없으면 R1·R2 가 «장면이 안 섬» 과 안 갈린다.
 *   N  [음성] 받아들여지는 입력엔 말이 안 뜬다 — 늘 뜨면 자가 아니다.
 * ★말을 읽는 자리 = #editor-toast.show (js/drag-utils.js showToast). 기다림은 조건(expect.poll) · 고정 대기 0.
 * ⛔이 자가 안 재는 것: 말의 문구 · 토스트 밖 안내(칸 옆 글·title·콘솔) · 표 패널의 다른 거절(행·열 추가 등 prop-table.js:626·644·674 는 이미 말한다) ·
 *   updateTableBlock 을 MCP 로 부른 거절(패널 길만) · 실앱(하네스).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec); window.addTableBlock();
    window.__t = sec.querySelector('.table-block');
  });
  const r = await page.evaluate(() => { const b = window.__t.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.mouse.click(r[0], r[1]);
  await expect(page.locator('#tbl-merge-headers'), '[전제] 표 패널이 열렸다').toBeVisible();
  return errs;
}
const toast = (page) => page.evaluate(() => { const t = document.getElementById('editor-toast'); return t && t.classList.contains('show') ? t.textContent : null; });
/* 사람처럼 친다 — ⛔fill() 은 keydown 이 없어 prop-number-commit-guard 의 타이핑 세션이 안 선다(그러면 죔·말이 안 돈다 · 첫 런 C1 빨강 ×3 의 까닭) */
const put = async (page, sel, v) => { const i = page.locator(sel); await i.click(); await i.press('ControlOrMeta+a'); await page.keyboard.type(v); await page.keyboard.press('Tab'); };
const merged = (page) => page.evaluate(() => window.__t.dataset.mergedHeaderCols ?? null);

test('R0 [전제] 거절이 정말 일어난다 — 꼴 틀림 · 범위 밖 둘 다 값 안 바뀜 · 칸 원복', async ({ page }) => {
  const errs = await setup(page);
  await put(page, '#tbl-merge-headers', '0:2');
  const before = await merged(page);
  expect(before, '[전제] 받아들여지는 입력이 먼저 먹었다').not.toBeNull();
  for (const bad of ['abc', '0:99']) {
    await put(page, '#tbl-merge-headers', bad);
    await expect.poll(() => page.locator('#tbl-merge-headers').inputValue(), { message: `${bad} 칸 원복` }).not.toBe(bad);
    expect(await merged(page), `${bad} 값 그대로`).toBe(before);
  }
  expect(errs).toEqual([]);
});
for (const [id, bad, re] of [['R1', 'abc', /「abc」.*시작:칸수/], ['R2', '0:99', /「0:99」.*2열/]]) {
  test(`${id} 거절(${bad}) 뒤 보이는 말이 뜬다 · 넣은 글자와 까닭을 말한다`, async ({ page }) => {
    await setup(page);
    await put(page, '#tbl-merge-headers', bad);
    await expect.poll(() => toast(page), { message: '거절했는데 보이는 말이 없다', timeout: 2500 }).toMatch(re);
  });
}
test('C1 ★갈림 — 같은 패널의 죔 칸(글자 크기 12~60)에 9999 ⇒ 말이 뜬다 · 칸이 죄인다', async ({ page }) => {
  const errs = await setup(page);
  await put(page, '#tbl-size-number', '9999');
  await expect.poll(() => toast(page), { message: '죔인데 말이 없다 — 이 칸이 빨강이면 R1·R2 의 빨강은 토스트 자의 고장일 수 있다', timeout: 2500 }).toMatch(/9999/);
  expect(await page.locator('#tbl-size-number').inputValue()).toBe('60');
  expect(errs).toEqual([]);
});
test('B1 ★오타 — 같은 패널의 숫자 칸에 1e ⇒ 말이 뜬다 · 칸은 이전 값(공용 가드 restorePrev)', async ({ page }) => {
  const errs = await setup(page);
  const prev = await page.locator('#tbl-pad-number').inputValue();
  await put(page, '#tbl-pad-number', '1e');
  await expect.poll(() => toast(page), { message: '오타를 거절했는데 말이 없다', timeout: 2500 }).toMatch(/숫자가 아니라/);
  expect(await page.locator('#tbl-pad-number').inputValue(), '칸 = 이전 값').toBe(prev);
  expect(errs).toEqual([]);
});
test('B2 [음성] 숫자 칸의 범위 안 값 · 빈 칸엔 오타 말이 안 뜬다(빈 칸은 지우는 중일 수 있다)', async ({ page }) => {
  const errs = await setup(page);
  await put(page, '#tbl-pad-number', '12');
  await expect.poll(() => page.evaluate(() => getComputedStyle(window.__t.querySelector('td,th')).paddingTop), { message: '[전제] 먹었다' }).toBe('12px');
  expect(await toast(page)).toBeNull();
  const i = page.locator('#tbl-pad-number'); await i.click(); await i.press('ControlOrMeta+a'); await page.keyboard.press('Backspace'); await page.keyboard.press('Tab');
  await expect.poll(() => i.inputValue(), { message: '[전제] 빈 칸이 되돌았다' }).toBe('12');
  expect(await toast(page)).toBeNull();
  expect(errs).toEqual([]);
});
test('N [음성] 받아들여지는 입력(0:2)엔 말이 안 뜬다', async ({ page }) => {
  const errs = await setup(page);
  await put(page, '#tbl-merge-headers', '0:2');
  await expect.poll(() => merged(page), { message: '[전제] 먹었다' }).not.toBeNull();
  expect(await toast(page)).toBeNull();
  expect(errs).toEqual([]);
});

/* ★DEC — 처음 비어 있던 숫자 칸(값 '' → '' 라 change 가 안 온다). 패널 전수에서 말 없던 7종 14칸의 뿌리 하나 — 대표 둘을 잰다. */
async function setupEmpty(page, add, sel) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (add) => {   // 넣으면 그 블럭 패널이 선다 — 클릭은 글상자 안에 떨어져 패널을 바꾼다(첫 런 빨강 1)
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec); window._activeFrame = null; await window[add]();
  }, add);
  const i = page.locator(sel).first();
  await expect(i, '[전제] 칸이 보인다').toBeVisible();
  expect(await i.inputValue(), '[전제] 칸이 비어 있다').toBe('');
  return { errs, i };
}
const badInput = (i) => i.evaluate((e) => e.validity.badInput);
for (const [add, sel] of [['addBanner02Block', '#bn2-h'], ['addComparisonBlock', '.cmp-row-h']]) {
  for (const key of ['Tab', 'Enter']) {
    test(`E1 빈 칸(${sel})에 오타 + ${key} ⇒ 말이 뜬다 · 칸에 오타가 안 남는다`, async ({ page }) => {
      const { errs, i } = await setupEmpty(page, add, sel);
      await i.click(); await page.keyboard.type('1e'); await page.keyboard.press(key);
      await expect.poll(() => toast(page), { message: '오타를 거절했는데 말이 없다', timeout: 2500 }).toMatch(/숫자가 아니라/);
      expect(await badInput(i), '칸에 오타가 남았다').toBe(false);
      expect(await i.inputValue()).toBe('');
      expect(errs).toEqual([]);
    });
  }
  test(`E2 [음성] 빈 칸(${sel})을 안 고치고 나가면 말이 없다`, async ({ page }) => {
    const { errs, i } = await setupEmpty(page, add, sel);
    await i.click(); await page.keyboard.press('Tab');
    expect(await toast(page)).toBeNull();
    expect(errs).toEqual([]);
  });
}
test('W1 문구 — 죔은 조사 없이 입력·적용 값을 말한다(「60 로」 금지)', async ({ page }) => {
  await setup(page);
  await put(page, '#tbl-size-number', '9999');
  await expect.poll(() => toast(page), { timeout: 2500 }).toBe('⚠️ 12~60 값만 쓸 수 있어요 — 입력 9999 → 적용 60');
});
