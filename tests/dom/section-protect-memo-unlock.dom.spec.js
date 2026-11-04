/* section-protect-memo-unlock — 메모 첫 줄이 «삭제하지말것» 이어도 사람이 푼 보호는 다시 열 때 안 잠긴다.
 * 앱: 해제 → 저장 → 다시 열기 = 다시 잠김 3/3. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 메모를 달고 → [잠금·해제 손] → 저장·다시 열기 → 자동 감지(앱 시작 때와 같은 함수) 뒤 보호 값 */
async function reopen(page, memo, hand) {
  const errs = await bootApp(page);
  const locked = await page.evaluate(async ([memo, hand]) => {
    await window.addSection();
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop();
    sec.dataset.memo = memo;
    window.SectionProtection.autoDetectAll();
    if (hand === 'unlock') window.setSectionProtected(sec.id, false);
    const id = sec.id;
    const d = window.serializeProject();
    await window.applyProjectData(typeof d === 'string' ? JSON.parse(d) : d);
    window.SectionProtection.autoDetectAll();
    return window.isSectionProtected(id);
  }, [memo, hand]);
  return { errs, locked };
}

test('P 트리거 메모 → 해제 → 다시 열기 = 풀린 채다', async ({ page }) => {
  const { errs, locked } = await reopen(page, '삭제하지말것\n내용', 'unlock');
  expect(locked, '★사람이 푼 보호가 다시 잠겼다').toBe(false);
  expect(errs).toEqual([]);
});
test('P 푼 뒤 다시 잠그면 잠긴다', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(async () => {
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop() || (await window.addSection(), [...document.querySelectorAll('#canvas .section-block')].pop());
    sec.dataset.memo = '삭제하지말것';
    window.setSectionProtected(sec.id, true); window.setSectionProtected(sec.id, false);
    const off = window.isSectionProtected(sec.id);
    window.setSectionProtected(sec.id, true);
    return { off, on: window.isSectionProtected(sec.id) };
  });
  expect(r).toEqual({ off: false, on: true });
});
test('N [음성] 트리거 메모를 안 풀면 자동으로 잠긴다', async ({ page }) => {
  const { errs, locked } = await reopen(page, '삭제하지말것', null);
  expect(locked, '★자동 잠금이 죽었다').toBe(true);
  expect(errs).toEqual([]);
});
test('N [음성] 다른 메모는 안 잠긴다, 해제해도 표시가 안 남는다', async ({ page }) => {
  const { locked } = await reopen(page, '기타 메모', 'unlock');
  expect(locked).toBe(false);
  const attr = await page.evaluate(async () => { const sec = document.querySelector('#canvas .section-block'); sec.dataset.memo = '기타'; window.setSectionProtected(sec.id, true); window.setSectionProtected(sec.id, false); return sec.dataset.protected ?? null; });
  expect(attr).toBe(null);
});
