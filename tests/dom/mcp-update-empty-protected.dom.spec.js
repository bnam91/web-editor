/* mcp-update-empty-protected — MCP update_block content:"" 가 🔒 보호 섹션의 글을 비우지 않는다 (MCP-UPDATE-BLOCK-EMPTIES-PROTECTED-01)
 * 왜: 보호는 «지우기 금지»인데 빈 글로 덮으면 지운 것과 같다 — w1 앱 3/3 · 보호·미보호 같음.
 * 자: main.js 의 진짜 다리 _invokeRendererEditBlock 이 만드는 JS 를 진짜 페이지에서 돌린다(mcp-delete-protected 와 같은 수법).
 * 칸: E1 보호 + "" → SECTION_PROTECTED · 글 그대로 · E2 보호 + 빈칸만("  ") → 같음 · E3 [음성] 미보호 + "" → 비워짐(지금과 같음)
 *     E4 [음성] 보호 + 다른 글 → 바뀜 · E5 [음성] 보호 + 색만 → 바뀜 · 픽스처: 섹션 둘 · 보호 섹션에 글 둘·그림 하나. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { findBlockEnd } = require('../unit/_slice-block.js');

const ROOT = process.env.GD1001_ROOT || path.join(__dirname, '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const PROTECTED_LINE = MAIN.match(/^const _SECTION_PROTECTED_JS = .*$/m)?.[0] || 'const _SECTION_PROTECTED_JS = "null";';
const NAME = '_invokeRendererEditBlock';
const at = MAIN.indexOf(`async function ${NAME}(`);
const SRC = MAIN.slice(at, findBlockEnd(MAIN, MAIN.indexOf(') {', at) + 2) + 1);
const edit = (page) => new Function('mainWindow', `${PROTECTED_LINE}\n${SRC}\nreturn ${NAME};`)({
  isDestroyed: () => false, isMinimized: () => false, webContents: { executeJavaScript: (js) => page.evaluate(js) },
});
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';

async function scene(page, { prot }) {
  const errs = await bootApp(page);
  const id = await page.evaluate(async ({ prot, HALF }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((x) => x.remove());
    await window.addSection();
    const a = [...c.querySelectorAll('.section-block')].pop();
    await window.addSection();
    window.deselectAll(); window.selectSection(a);
    window.addTextBlock('h2', { content: '보호할 제목' });
    window.deselectAll(); window.selectSection(a);
    window.addTextBlock('body', { content: '보호할 본문' });
    a.querySelector('.section-inner')?.insertAdjacentHTML('beforeend', `<div class="asset-block has-image" data-img-src="${HALF}"><div class="asset-img-clip"><img class="asset-img" src="${HALF}"></div></div>`);
    const text = [...a.querySelectorAll('.text-block')].pop();
    window.deselectAll(); document.activeElement?.blur?.();
    if (prot) window.setSectionProtected(a.id, true);
    return text.id;
  }, { prot, HALF });
  return { errs, id };
}
const textOf = (page, id) => page.evaluate((id) => document.getElementById(id)?.textContent || '', id);

for (const [cell, content] of [['E1', ''], ['E2', '  ']]) {
  test(`${cell} 보호 섹션 글을 ${JSON.stringify(content)} 로 비우려 하면 SECTION_PROTECTED · 글 그대로`, async ({ page }) => {
    const { errs, id } = await scene(page, { prot: true });
    const res = await edit(page)({ blockId: id, content });
    expect(res.code, `★보호 섹션 글을 비웠다 ${JSON.stringify(res)}`).toBe('SECTION_PROTECTED');
    expect(res.ok).toBe(false);
    expect(await textOf(page, id), '★글이 비었다').toContain('보호할 본문');
    expect(errs).toEqual([]);
  });
}
test('E3 [음성] 미보호 섹션은 "" 로 비워진다(지금과 같음)', async ({ page }) => {
  const { errs, id } = await scene(page, { prot: false });
  const res = await edit(page)({ blockId: id, content: '' });
  expect(res.ok, JSON.stringify(res)).toBe(true);
  expect(await textOf(page, id)).not.toContain('보호할 본문');
  expect(errs).toEqual([]);
});
test('E4 [음성] 보호 섹션이라도 다른 글로 바꾸기는 된다', async ({ page }) => {
  const { id } = await scene(page, { prot: true });
  const res = await edit(page)({ blockId: id, content: '바꾼 본문' });
  expect(res.ok, JSON.stringify(res)).toBe(true);
  expect(await textOf(page, id)).toContain('바꾼 본문');
});
test('E5 [음성] 보호 섹션이라도 색만 바꾸기는 된다', async ({ page }) => {
  const { id } = await scene(page, { prot: true });
  const res = await edit(page)({ blockId: id, color: '#ff0000' });
  expect(res.ok, JSON.stringify(res)).toBe(true);
  expect(await textOf(page, id)).toContain('보호할 본문');
});
