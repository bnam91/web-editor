/* mcp-update-tools-protected-table — MCP update_* 도구가 🔒 보호 섹션의 글을 빈 글로 덮나 · 표 (MCP-OTHER-UPDATE-TOOLS-NO-PROTECTED-CHECK-01)
 * 기준 = 워커2 e579d7a4(update_block 만 «보호 + 빈 글 → SECTION_PROTECTED»). 코드 읽기: 나머지 update_* 다리(main.js _invokeRendererUpdate*)와
 *   렌더러 update*Block 어디에도 isSectionProtected 가 없다 ⇒ 다 들어갈 것(추정). 이 검사가 그 값을 잰다.
 * 자: main.js 의 진짜 다리 함수를 잘라 진짜 페이지에서 돌린다(mcp-update-empty-protected 와 같은 수법).
 * 칸(도구마다 하나): 미보호에서 표지 글 MARK 를 넣고 → 섹션 보호 → ⑴ 빈 글(blank) ⑵ 다른 글(other) ⑶ 배열 비우기(arr, 있으면) 를 차례로 —
 *   ⑴ 뒤 MARK 가 남았나(=막힘) · 답 code · ⑵ 뒤 OTHER 가 들어갔나(허용) · ⑶ 은 값만. 행은 콘솔 [ROW] 로.
 *   준비 실패(다리 자르기·블럭 만들기·MARK 넣기 실패)는 빨강이 아니라 행에 «n/a 까닭»으로 적는다.
 * 단언: ⑴ 이 SECTION_PROTECTED 이고 MARK 가 남는다 — 기준판에선 빨강이 «표의 값»(막히지 않음). ⑵ 는 들어가야 한다(정책: 다른 글은 허용).
 * 픽스처: 섹션 둘 · 보호할 섹션에 글·그림과 그 도구의 블럭. 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { findBlockEnd } = require('../unit/_slice-block.js');

const ROOT = process.env.GD1001_ROOT || path.join(__dirname, '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const PROTECTED_LINE = MAIN.match(/^const _SECTION_PROTECTED_JS = .*$/m)?.[0] || 'const _SECTION_PROTECTED_JS = "null";';
function bridge(page, name) {
  const at = MAIN.indexOf(`async function ${name}(`);
  if (at < 0) return null;
  const src = MAIN.slice(at, findBlockEnd(MAIN, MAIN.indexOf(') {', at) + 2) + 1);
  return new Function('mainWindow', `${PROTECTED_LINE}\n${src}\nreturn ${name};`)({
    isDestroyed: () => false, isMinimized: () => false, webContents: { executeJavaScript: (js) => page.evaluate(js) },
  });
}
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const M = 'MARK보호글', O = 'OTHER바꾼글';
const P = (partial) => ({ partial });   // {blockId, partial} 다리
const F = (flat) => ({ flat });         // {blockId, ...평평} 다리
/* tool · 다리 · 만들기 · 클래스 조각 · MARK 넣기 · 빈 글 · 다른 글 · 배열 비우기 */
const TOOLS = [
  ['update_qa_block', '_invokeRendererUpdateQABlock', 'addQABlock', 'qa-block', P({ items: [{ text: M, done: false }] }), P({ items: [{ text: '', done: false }] }), P({ items: [{ text: O, done: false }] }), P({ items: [] })],
  ['update_table_block', '_invokeRendererUpdateTableBlock', 'addTableBlock', 'table', P({ headers: [M, 'B'], rows: [['c', 'd']] }), P({ headers: ['', 'B'], rows: [['c', 'd']] }), P({ headers: [O, 'B'], rows: [['c', 'd']] }), null],
  ['update_chat_block', '_invokeRendererUpdateChatBlock', 'addChatBlock', 'chat', P({ messages: [{ text: M, align: 'left' }] }), P({ messages: [{ text: '', align: 'left' }] }), P({ messages: [{ text: O, align: 'left' }] }), null],
  ['update_step_block', '_invokeRendererUpdateStepBlock', 'addStepBlock', 'step', P({ steps: [{ title: M, desc: 'd' }] }), P({ steps: [{ title: '', desc: 'd' }] }), P({ steps: [{ title: O, desc: 'd' }] }), null],
  ['update_label_group_block', '_invokeRendererUpdateLabelGroupBlock', 'addLabelGroupBlock', 'label-group', P({ labels: [M] }), P({ labels: [''] }), P({ labels: [O] }), P({ labels: [] })],
  ['update_sticker_block', '_invokeRendererUpdateStickerBlock', 'addStickerBlock', 'sticker', P({ text: M }), P({ text: '' }), P({ text: O }), null],
  ['update_icon_text_block', '_invokeRendererUpdateIconTextBlock', 'addIconTextBlock', 'icon-text', P({ text: M }), P({ text: '' }), P({ text: O }), null],
  ['update_speech_bubble_block', '_invokeRendererUpdateSpeechBubbleBlock', 'addSpeechBubbleBlock', 'bubble', P({ text: M }), P({ text: '' }), P({ text: O }), null],
  ['update_banner02_block', '_invokeRendererUpdateBanner02Block', 'addBanner02Block', 'banner02', P({ title: M }), P({ title: '' }), P({ title: O }), null],
  ['update_liner_block', '_invokeRendererUpdateLinerBlock', 'addLinerBlock', 'liner', F({ text: M }), F({ text: '' }), F({ text: O }), null],
  ['update_card_block', '_invokeRendererUpdateCardBlock', 'addCardBlock', 'card', F({ title: M }), F({ title: '' }), F({ title: O }), null],
  ['update_graph_block', '_invokeRendererUpdateGraphBlock', 'addGraphBlock', 'graph', P({ items: [{ label: M, value: 50 }] }), P({ items: [{ label: '', value: 50 }] }), P({ items: [{ label: O, value: 50 }] }), null],
];

async function scene(page, addFn, cls) {
  const errs = await bootApp(page);
  const r = await page.evaluate(async ({ addFn, cls, HALF }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((x) => x.remove());
    await window.addSection();
    const a = [...c.querySelectorAll('.section-block')].pop(); a.id = a.id || 'secProt';
    await window.addSection();
    window.deselectAll(); window.selectSection(a);
    window.addTextBlock('body', { content: '보호할 본문' });
    a.querySelector('.section-inner')?.insertAdjacentHTML('beforeend', `<div class="asset-block has-image" data-img-src="${HALF}"><div class="asset-img-clip"><img class="asset-img" src="${HALF}"></div></div>`);
    if (typeof window[addFn] !== 'function') return { na: 'no ' + addFn };
    const before = new Set([...a.querySelectorAll('[id]')]);
    window.deselectAll(); window.selectSection(a);
    let ret = null; try { ret = await window[addFn](); } catch (e) { return { na: addFn + ' threw ' + e.message }; }
    const el = (ret && ret.nodeType === 1 && ret) || (ret && ret.block) || [...a.querySelectorAll('[id]')].find((x) => !before.has(x) && String(x.className).includes(cls) && !x.classList.contains('row') && !x.classList.contains('frame-block'));
    if (!el || !a.contains(el)) return { na: 'block not found in section' };
    window.deselectAll(); document.activeElement?.blur?.();
    return { id: el.id, secId: a.id };
  }, { addFn, cls, HALF });
  return { errs, ...r };
}
const call = async (fn, id, arg) => { try { return arg.partial ? await fn({ blockId: id, partial: arg.partial }) : await fn({ blockId: id, ...arg.flat }); } catch (e) { return { ok: false, code: 'THREW', message: e.message }; } };
const has = (page, id, s) => page.evaluate(([id, s]) => (document.getElementById(id)?.textContent || '').includes(s) || JSON.stringify(document.getElementById(id)?.dataset || {}).includes(s), [id, s]);

for (const [tool, bridgeName, addFn, cls, mark, blank, other, arr] of TOOLS) {
  test(`${tool} — 보호 섹션 글을 빈 글로 덮으면 막히고, 다른 글로는 바뀐다`, async ({ page }) => {
    const row = { tool };
    const fn = bridge(page, bridgeName);
    if (!fn) { row.na = 'no bridge ' + bridgeName; console.log('[ROW] ' + JSON.stringify(row)); test.skip(true, row.na); return; }
    const { errs, id, secId, na } = await scene(page, addFn, cls);
    if (na) { row.na = na; console.log('[ROW] ' + JSON.stringify(row)); test.skip(true, na); return; }
    const m = await call(fn, id, mark);
    if (!(await has(page, id, M))) { row.na = 'MARK 못 넣음 ' + JSON.stringify(m).slice(0, 160); console.log('[ROW] ' + JSON.stringify(row)); test.skip(true, row.na); return; }
    await page.evaluate((s) => window.setSectionProtected(s, true), secId);
    const b = await call(fn, id, blank);
    row.blank = { code: b?.code || (b?.ok ? 'ok' : '?'), markKept: await has(page, id, M) };
    const o = await call(fn, id, other);
    row.other = { code: o?.code || (o?.ok ? 'ok' : '?'), applied: await has(page, id, O) };
    if (arr) { const a = await call(fn, id, arr); row.arr = { code: a?.code || (a?.ok ? 'ok' : '?'), textLeft: await page.evaluate((id) => (document.getElementById(id)?.textContent || '').replace(/\s/g, '').length, id) }; }
    console.log('[ROW] ' + JSON.stringify(row));
    expect(row.blank.markKept, `★${tool}: 보호 섹션 글이 빈 글로 덮였다 ${JSON.stringify(row.blank)}`).toBe(true);
    expect(row.blank.code).toBe('SECTION_PROTECTED');
    expect(errs).toEqual([]);
  });
}
