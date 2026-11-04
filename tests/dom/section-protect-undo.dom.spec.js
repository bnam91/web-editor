/* section-protect-undo — 🔒 는 ⌘Z 한 칸이고, 되돌리기가 보호를 바꾸면 안내가 뜬다.
 * 왜: 🔒 가 칸이 아니어서 ⌘Z 가 말없이 풀었고(앱 3/3), 🔒→해제→⌘Z 면 그 앞 편집까지 되돌아가 섹션이 사라졌다(앱 3/3). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const before = new Set([...document.querySelectorAll('#canvas .section-block')].map((x) => x.id));
    await window.addSection();
    window.deselectAll();
    window.__toasts = [];
    const o = window.showToast;
    window.showToast = function (m) { window.__toasts.push(String(m)); return o?.apply(this, arguments); };
    return [...document.querySelectorAll('#canvas .section-block')].find((x) => !before.has(x.id)).id;
  });
  return { errs, id };
}
const act = (page, id, name, ...a) => page.evaluate(([id, name, a]) => {
  if (name === 'lock') window.setSectionProtected(id, ...a);
  else if (name === 'text') { window.selectSection(document.getElementById(id)); window.addTextBlock('body', { content: '글' }); window.deselectAll(); }
  else window[name]();
  const e = document.getElementById(id);
  const t = window.__toasts.splice(0);
  return { here: !!e, locked: window.isSectionProtected(id), texts: e ? e.querySelectorAll('.text-block').length : null, toasts: t.filter((x) => x.includes('보호')).length, said: t.join() };
}, [id, name, a]);

test('P 🔒 → ⌘Z 는 보호만 풀고 알린다, ⌘⇧Z 는 다시 켜고 알린다', async ({ page }) => {
  const { errs, id } = await scene(page);
  await act(page, id, 'lock', true);
  const z = await act(page, id, 'undo');
  expect(z).toMatchObject({ here: true, locked: false, toasts: 1 });
  expect(z.said).toContain('풀렸습니다');
  const y = await act(page, id, 'redo');
  expect(y).toMatchObject({ here: true, locked: true, toasts: 1 });
  expect(y.said).toContain('켜졌습니다');
  expect(errs).toEqual([]);
});

test('P 🔒 → 해제 → ⌘Z 는 잠금으로 돌아간다(섹션이 안 사라진다) ', async ({ page }) => {
  const { errs, id } = await scene(page);
  await act(page, id, 'lock', true);
  await act(page, id, 'lock', false);
  const z = await act(page, id, 'undo');
  expect(z, '★앞 편집까지 되돌아갔다').toMatchObject({ here: true, locked: true, toasts: 1 });
  expect(z.said).toContain('켜졌습니다');
  expect(errs).toEqual([]);
});

test('P 글 → 🔒 → ⌘Z 두 번 = 보호 먼저, 글은 그다음', async ({ page }) => {
  const { errs, id } = await scene(page);
  const n = (await act(page, id, 'text')).texts;
  await act(page, id, 'lock', true);
  expect(await act(page, id, 'undo')).toMatchObject({ locked: false, texts: n, toasts: 1 });
  const z2 = await act(page, id, 'undo');
  expect(z2.texts).toBeLessThan(n);
  expect(z2.toasts).toBe(0);
  expect(errs).toEqual([]);
});

test('P 아직 안 찍힌 글 수정 → 🔒 → ⌘Z = 수정은 남고 보호만 풀린다', async ({ page }) => {
  const { errs, id } = await scene(page);
  await act(page, id, 'text');
  const typed = () => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.text-block')].pop().innerText, id);
  await page.evaluate((id) => { [...document.getElementById(id).querySelectorAll('.text-block')].pop().querySelector('[contenteditable], .tb-body, div').textContent = '안 찍힌 수정'; }, id);
  await act(page, id, 'lock', true);
  expect(await act(page, id, 'undo')).toMatchObject({ here: true, locked: false, toasts: 1 });
  expect(await typed(), '★보호를 되돌리다 사람 글까지 날렸다').toContain('안 찍힌 수정');
  expect(errs).toEqual([]);
});

test('N [음성] 🔒 → 글 → ⌘Z 는 글만 빼고 보호는 남는다, 안내 없음', async ({ page }) => {
  const { errs, id } = await scene(page);
  await act(page, id, 'lock', true);
  const n = (await act(page, id, 'text')).texts;
  const z = await act(page, id, 'undo');
  expect(z).toMatchObject({ locked: true, toasts: 0 });
  expect(z.texts).toBeLessThan(n);
  expect(errs).toEqual([]);
});

test('N [음성] 사유만 고치면 보호 칸이 안 늘고 ⌘Z 는 사유만 되돌린다, 안내 없음', async ({ page }) => {
  const { errs, id } = await scene(page);
  await act(page, id, 'lock', true);
  await act(page, id, 'lock', true, '사유');
  expect(await act(page, id, 'undo'), '★사유가 칸을 만들었다').toMatchObject({ locked: true, toasts: 0 });
  expect(errs).toEqual([]);
});
