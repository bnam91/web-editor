/* mcp-delete-protected — 🔒 보호 섹션은 MCP 지우기 도구로 안 지워지고, 호출자는 이유(SECTION_PROTECTED)를 받는다.
 * main.js 의 진짜 다리 함수가 만드는 JS 를 진짜 페이지에서 돌린다(가짜 mainWindow 는 executeJavaScript 만 페이지로 넘긴다).
 * 칸: P = 보호, N = [음성] 미보호. 변이(잰 값)는 회신 w1-del 에 적는다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { sliceBlock } = require('../unit/_slice-block.js');

const ROOT = process.env.GD1001_ROOT || path.join(__dirname, '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const PROTECTED_LINE = MAIN.match(/^const _SECTION_PROTECTED_JS = .*$/m)?.[0] || 'const _SECTION_PROTECTED_JS = "null";';
const bridge = (page, head) => new Function('mainWindow', `${PROTECTED_LINE}\n${sliceBlock(MAIN, head, head)}\nreturn ${head.match(/function (\w+)/)[1]};`)({
  isDestroyed: () => false, isMinimized: () => false, webContents: { executeJavaScript: (js) => page.evaluate(js) },
});
const HEAD = {
  section: 'async function _invokeRendererDeleteSection({ sectionId } = {}) {',
  block: 'async function _invokeRendererDeleteBlock({ blockId } = {}) {',
  variation: 'async function _invokeRendererVariation({ op, sectionId, to, confirm = false } = {}) {',
};

async function scene(page, { prot, variation = false }) {
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ({ prot, variation }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((x) => x.remove());
    await window.addSection();
    const a = [...c.querySelectorAll('.section-block')].pop();
    await window.addSection();
    window.deselectAll(); window.selectSection(a); window.addFrameBlock();
    const frame = a.querySelector('.frame-block:not([data-text-frame])');
    window.deselectAll(); window._activeFrame = null; window.selectSection(a);
    window.addTextBlock('body', { content: '글' });
    const text = [...a.querySelectorAll('.text-block')].pop();
    window.deselectAll();
    if (variation) window.createVariation(a);
    const members = [...c.querySelectorAll('.section-block[data-variation-group]')];
    const active = members.find((m) => m.dataset.variationActive === '1');
    const other = members.find((m) => m !== active);
    if (prot) (variation ? members : [a]).forEach((x) => window.setSectionProtected(x.id, true));
    return { sec: a.id, frame: frame.id, text: text.id, active: active?.id, other: other?.id };
  }, { prot, variation });
  return { errs, ids };
}
const count = (page) => page.evaluate(() => ({
  secs: document.querySelectorAll('#canvas .section-block').length,
  frames: document.querySelectorAll('#canvas .frame-block:not([data-text-frame])').length,
  texts: document.querySelectorAll('#canvas .text-block').length,
}));
const CELLS = [
  ['delete_section', {}, (b, i) => b(HEAD.section)({ sectionId: i.sec })],
  ['delete_block 글자', {}, (b, i) => b(HEAD.block)({ blockId: i.text })],
  ['delete_block 프레임', {}, (b, i) => b(HEAD.block)({ blockId: i.frame })],
  ['edit_variation delete', { variation: true }, (b, i) => b(HEAD.variation)({ op: 'delete', sectionId: i.other, confirm: true })],
  ['edit_variation resolve', { variation: true }, (b, i) => b(HEAD.variation)({ op: 'resolve', sectionId: i.other, confirm: true })],
];

for (const [name, opts, call] of CELLS) {
  test(`P ${name} — 보호 섹션은 그대로고 호출자가 SECTION_PROTECTED 를 받는다`, async ({ page }) => {
    const { errs, ids } = await scene(page, { prot: true, ...opts });
    const before = await count(page);
    const res = await call((h) => bridge(page, h), ids);
    expect(res.code, '★이유를 못 받았다').toBe('SECTION_PROTECTED');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('보호');
    expect(await count(page), '★보호 섹션의 내용이 지워졌다').toEqual(before);
    expect(errs).toEqual([]);
  });
  test(`N ${name} [음성] — 미보호면 지워진다`, async ({ page }) => {
    const { errs, ids } = await scene(page, { prot: false, ...opts });
    const before = await count(page);
    const res = await call((h) => bridge(page, h), ids);
    expect(res.ok, `★미보호인데 막혔다 ${JSON.stringify(res)}`).toBe(true);
    expect(await count(page), '★안 지워졌다').not.toEqual(before);
    expect(errs).toEqual([]);
  });
}

test('P confirm 없이 물어도 보호를 먼저 말한다(지울 목록을 주지 않는다)', async ({ page }) => {
  const { ids } = await scene(page, { prot: true, variation: true });
  const v = bridge(page, HEAD.variation);
  expect((await v({ op: 'delete', sectionId: ids.other })).code).toBe('SECTION_PROTECTED');
  expect((await v({ op: 'resolve', sectionId: ids.other })).code).toBe('SECTION_PROTECTED');
});

test('window.deleteSection 직접 호출도 보호 섹션은 false · 미보호는 true', async ({ page }) => {
  const { ids } = await scene(page, { prot: true });
  const r = await page.evaluate((id) => {
    const a = window.deleteSection(id); const still = !!document.getElementById(id);
    window.setSectionProtected(id, false);
    return { a, still, b: window.deleteSection(id), gone: !document.getElementById(id) };
  }, ids.sec);
  expect(r).toEqual({ a: false, still: true, b: true, gone: true });
});

test('[음성] 사유가 섞이지 않는다 — 마지막·없는 섹션은 DELETE_FAILED, 없는 블럭은 NOT_FOUND', async ({ page }) => {
  await scene(page, { prot: false });
  const s = bridge(page, HEAD.section);
  expect((await s({ sectionId: 'sec_없음' })).code).toBe('DELETE_FAILED');
  expect((await bridge(page, HEAD.block)({ blockId: 'tb_없음' })).code).toBe('NOT_FOUND');
  const last = await page.evaluate(() => { const all = [...document.querySelectorAll('#canvas .section-block')]; all.slice(1).forEach((x) => x.remove()); return all[0].id; });
  expect((await s({ sectionId: last })).code).toBe('DELETE_FAILED');
});

test('[음성] section-cleanup 은 보호 섹션에서도 끝난다 — deleteBlock 을 막으면 while 이 안 끝난다', async ({ page }) => {
  const { ids } = await scene(page, { prot: true });
  const r = await page.evaluate((id) => {
    const inner = document.getElementById(id).querySelector(':scope > .section-inner');
    const empty = document.createElement('div'); empty.className = 'row'; empty.id = 'row_빈칸'; inner.appendChild(empty);
    const res = window.cleanupSection(id);
    return { ok: res.ok, gone: !document.getElementById('row_빈칸') };
  }, ids.sec);
  expect(r).toEqual({ ok: true, gone: true });
});
