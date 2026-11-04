/* mcp-undo-protected — undo_last_mcp_change 가 사람이 건 🔒 를 풀거나 보호 섹션을 지우지 않는다.
 * 🔒 는 히스토리 칸을 안 만들어 undo 가 같이 되돌렸다(앱: 3/3 보호 풀림 · build_basic 은 글 0).
 * main.js 진짜 다리 함수가 만드는 JS 를 진짜 페이지에서 돌린다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { findBlockEnd } = require('../unit/_slice-block.js');

const ROOT = process.env.GD1001_ROOT || path.join(__dirname, '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const PROTECTED_LINE = MAIN.match(/^const _SECTION_PROTECTED_JS = .*$/m)[0];
const at = MAIN.indexOf('async function _invokeRendererUndoOnce(');
const SRC = MAIN.slice(at, findBlockEnd(MAIN, MAIN.indexOf(') {', at) + 2) + 1);
const undoOnce = (page) => new Function('mainWindow', `${PROTECTED_LINE}\n${SRC}\nreturn _invokeRendererUndoOnce;`)({
  isDestroyed: () => false, isMinimized: () => false, webContents: { executeJavaScript: (js) => page.evaluate(js) },
})();

/* 새 섹션을 만든 뒤(히스토리 칸 생김) 잠그거나 그대로 둔다 */
async function scene(page, lock) {
  const errs = await bootApp(page);
  const id = await page.evaluate(async (lock) => {
    const before = new Set([...document.querySelectorAll('#canvas .section-block')].map((x) => x.id));
    await window.addSection();
    const sec = [...document.querySelectorAll('#canvas .section-block')].find((x) => !before.has(x.id));
    if (lock) window.setSectionProtected(sec.id, true);
    return sec.id;
  }, lock);
  return { errs, id };
}
const st = (page, id) => page.evaluate((id) => ({ here: !!document.getElementById(id), locked: window.isSectionProtected(id) }), id);

test('P 만듦 → 🔒 → undo = 거절, 섹션·보호가 그대로다', async ({ page }) => {
  const { errs, id } = await scene(page, true);
  const r = await undoOnce(page);
  expect(r.code, '★이유를 못 받았다').toBe('SECTION_PROTECTED');
  expect(r.ok).toBe(false);
  expect(await st(page, id), '★보호가 풀렸거나 섹션이 사라졌다').toEqual({ here: true, locked: true });
  const again = await undoOnce(page);
  expect(again.code, '★다시 불러도 같아야 한다').toBe('SECTION_PROTECTED');
  expect(await st(page, id)).toEqual({ here: true, locked: true });
  expect(errs).toEqual([]);
});

test('P 🔒 → 글 추가 → undo = 글은 빠지고 보호는 남는다', async ({ page }) => {
  const { errs, id } = await scene(page, true);
  const count = () => page.evaluate((id) => document.getElementById(id).querySelectorAll('.text-block').length, id);
  await page.evaluate((id) => { window.deselectAll(); window.selectSection(document.getElementById(id)); window.addTextBlock('body', { content: '글' }); window.deselectAll(); }, id);
  const n = await count();
  const r = await undoOnce(page);
  expect(r.ok, `★먼저 건 보호 때문에 되돌리기가 막혔다 ${JSON.stringify(r)}`).toBe(true);
  expect(await count(), '★글이 안 빠졌다').toBeLessThan(n);
  expect(await st(page, id)).toEqual({ here: true, locked: true });
  expect(errs).toEqual([]);
});

test('N [음성] 잠금 없으면 전처럼 되돌린다', async ({ page }) => {
  const { errs, id } = await scene(page, false);
  const r = await undoOnce(page);
  expect(r.ok).toBe(true);
  expect((await st(page, id)).here, '★안 되돌아갔다').toBe(false);
  expect(errs).toEqual([]);
});
