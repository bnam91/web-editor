/* numfield-ime-session-161.dom.spec.js — 시트 161 ⒜ 기계 토막: 조합 입력에서 숫자 칸 가드 세션이 서나.
 * 자 = CDP Input.imeSetComposition · insertText(isTrusted 참 · 합성 이벤트는 가드 :248 을 그냥 지나 못 잰다).
 * ⛔이 자가 안 재는 것: 실제 OS 한글 입력기(⒝ 사람 토막 — 이 자가 초록이어도 ⒝ 를 닫았다고 적지 마라) · 입력기마다 다른 keydown 순서.
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
  await expect(page.locator('#tbl-pad-number'), '[전제] 표 패널이 열렸다').toBeVisible();
  return { errs, cdp: await page.context().newCDPSession(page) };
}
const raf2 = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const state = (page) => page.evaluate(() => { const e = document.getElementById('tbl-pad-number'); return { v: e.value, typing: !!e._pnTyping, pad: getComputedStyle(window.__t.querySelector('td,th')).paddingTop }; });
const toast = (page) => page.evaluate(() => { const t = document.getElementById('editor-toast'); return t && t.classList.contains('show') ? t.textContent : null; });
/* 조합: Process 키 + 조합 글자 ＋ 확정 — 진짜 입력기와 같은 이벤트 꼴인지는 P0 이 단언한다 */
async function compose(page, cdp, text) {
  const i = page.locator('#tbl-pad-number'); await i.click(); await i.press('ControlOrMeta+a');
  const k = { key: 'Process', code: 'KeyA', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 };
  for (let n = 1; n <= text.length; n++) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...k });
    await cdp.send('Input.imeSetComposition', { text: text.slice(0, n), selectionStart: n, selectionEnd: n });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
  }
  await raf2(page);
  const mid = await state(page);
  await cdp.send('Input.insertText', { text });
  await raf2(page);
  return mid;
}

test('P0 [전제] 조합 장면이 선다 — compositionstart · isComposing 인 trusted input · Process 키', async ({ page }) => {
  const { errs, cdp } = await setup(page);
  await page.evaluate(() => { window.__ev = []; const e = document.getElementById('tbl-pad-number'); e.addEventListener('compositionstart', () => window.__ev.push('start')); window.addEventListener('input', (x) => { if (x.target === e && x.isComposing && x.isTrusted) window.__ev.push('input'); }, true); /* window 캡처 = 가드 유예보다 앞 */ e.addEventListener('keydown', (x) => { if (x.key === 'Process') window.__ev.push('process'); }); });
  await compose(page, cdp, '12');
  const ev = await page.evaluate(() => window.__ev);
  expect(ev).toEqual(expect.arrayContaining(['start', 'input', 'process']));
  expect(errs).toEqual([]);
});
test('S1 조합 중 세션이 열려 있고 모델은 안 바뀐다', async ({ page }) => {
  const { errs, cdp } = await setup(page);
  const before = await state(page);
  const mid = await compose(page, cdp, '12');
  expect(mid.typing, '가드 세션').toBe(true);
  expect(mid.pad, '조합 중 커밋 없음').toBe(before.pad);
  await page.keyboard.press('Enter'); await raf2(page);
  expect(await state(page)).toMatchObject({ v: '12', typing: false, pad: '12px' });
  expect(await toast(page), '[음성] 범위 안은 말 없음').toBeNull();
  expect(errs).toEqual([]);
});
test('S2 조합으로 범위 밖(999) ⇒ 죄고 말한다', async ({ page }) => {
  const { errs, cdp } = await setup(page);
  await compose(page, cdp, '999');
  await page.keyboard.press('Enter'); await raf2(page);
  expect(await state(page)).toMatchObject({ v: '40', pad: '40px' });
  expect(await toast(page)).toMatch(/입력 999 → 적용 40/);
  expect(errs).toEqual([]);
});
test('S3 조합으로 오타(1e) ⇒ 이전 값 · 말한다', async ({ page }) => {
  const { errs, cdp } = await setup(page);
  const before = await state(page);
  await compose(page, cdp, '1e');
  await page.keyboard.press('Enter'); await raf2(page);
  expect(await state(page)).toMatchObject({ v: before.v, pad: before.pad });
  expect(await toast(page)).toMatch(/숫자가 아니라/);
  expect(errs).toEqual([]);
});
test('S4 조합을 확정 안 하고 Enter ⇒ 조합 글자로 규약이 돈다(999 → 40)', async ({ page }) => {
  const { errs, cdp } = await setup(page);
  const i = page.locator('#tbl-pad-number'); await i.click(); await i.press('ControlOrMeta+a');
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Process', code: 'KeyA', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 });
  await cdp.send('Input.imeSetComposition', { text: '999', selectionStart: 3, selectionEnd: 3 });
  await page.keyboard.press('Enter'); await raf2(page);
  expect(await state(page)).toMatchObject({ v: '40', typing: false, pad: '40px' });
  expect(await toast(page)).toMatch(/입력 999 → 적용 40/);
  expect(errs).toEqual([]);
});
for (const [t, v, pad] of [['7', '7', '7px'], ['+5', '5', '5px'], ['1e3', '40', '40px']]) {
  test(`N [음성] 키보드 「${t}」 는 그대로 돈다`, async ({ page }) => {
    const { errs } = await setup(page);
    const i = page.locator('#tbl-pad-number'); await i.click(); await i.press('ControlOrMeta+a');
    await page.keyboard.type(t);
    expect((await state(page)).typing, '[전제] 키보드 세션').toBe(true);
    await page.keyboard.press('Enter'); await raf2(page);
    expect(await state(page)).toMatchObject({ v, pad });
    expect(errs).toEqual([]);
  });
}
