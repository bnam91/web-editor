/* move-section-undo-334.dom.spec.js — 시트 334: 입구 moveSection(MCP move_section 이 부른다) 뒤 ⌘Z 한 번에 돌아온다.
 * 까닭: 옮긴 뒤 push 한 표본과 그 뒤 buildLayerPanel 의 data-section 번호가 어긋나 ⌘Z 첫 번이 빈 칸이었다(앱 9/9 · 두 번 눌러야 돌아옴).
 *   M1 옮기고 ⌘Z 한 번 ⇒ 순서·번호 원위치 · ⌘⇧Z ⇒ 다시.
 *   M2 대기 중 변경(push 안 한 편집)이 ⌘Z 한 번에 같이 안 뭉개진다.
 *   N  [음성] 잘못된 인자 ⇒ 이력·순서 안 바뀐다.
 *   ⛔안 재는 것: MCP 다리를 지나는 길(함수를 직접 부른다) · 저장 왕복. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await bootApp(page);
  return page.evaluate(() => {
    const c = document.getElementById('canvas');
    while (c.querySelectorAll('.section-block').length < 2) window.addSection();
    window.buildLayerPanel?.();
    window.pushHistory('장면');
    return [...c.querySelectorAll('.section-block')].slice(0, 2).map((s) => s.id);
  });
}
const read = (page) => page.evaluate(() => {
  const s = [...document.querySelectorAll('#canvas .section-block')];
  const h = window.getHistoryTip();
  return { ids: s.map((x) => x.id), nums: s.map((x) => x.dataset.section), pos: h.pos, len: h.len };
});

test('M1 옮기고 ⌘Z 한 번에 돌아오고 ⌘⇧Z 로 다시 간다', async ({ page }) => {
  const [a, b] = await scene(page);
  const s0 = await read(page);
  expect(await page.evaluate(([x, y]) => window.moveSection(x, { afterId: y }), [a, b])).toBe(true);
  const s1 = await read(page);
  expect(s1.ids, '[전제] 옮겨졌다').not.toEqual(s0.ids);
  await page.keyboard.press('Meta+z');
  const s2 = await read(page);
  expect(s2.ids, '⌘Z 첫 번이 빈 칸이다').toEqual(s0.ids);
  expect(s2.nums).toEqual(s0.nums);
  await page.keyboard.press('Meta+Shift+z');
  expect((await read(page)).ids).toEqual(s1.ids);
});
test('M2 대기 중 변경은 ⌘Z 한 번에 같이 안 뭉개진다', async ({ page }) => {
  const [a, b] = await scene(page);
  const s0 = await read(page);
  const out = await page.evaluate(([x, y]) => {
    document.getElementById(x).dataset.pending334 = 'kept';
    window.moveSection(x, { afterId: y });
    return true;
  }, [a, b]);
  expect(out).toBe(true);
  await page.keyboard.press('Meta+z');
  const r = await read(page);
  expect(r.ids).toEqual(s0.ids);
  expect(await page.evaluate((x) => document.getElementById(x).dataset.pending334 ?? null, a), '옮기기 전 변경까지 되돌아갔다').toBe('kept');
});
test('N [음성] 없는 기준 · 자기 자신 ⇒ 안 옮기고 이력도 그대로', async ({ page }) => {
  const [a] = await scene(page);
  const s0 = await read(page);
  const r = await page.evaluate((x) => [window.moveSection(x, { afterId: 'nope' }), window.moveSection(x, { beforeId: x }), window.moveSection(x, {})], a);
  expect(r).toEqual([false, false, false]);
  expect(await read(page)).toEqual(s0);
});
