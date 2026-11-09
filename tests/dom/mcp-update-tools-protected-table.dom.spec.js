/* mcp-update-tools-protected-table — MCP update_* 도구가 🔒 보호 섹션의 글을 빈 글로 덮나 · 표 (MCP-OTHER-UPDATE-TOOLS-NO-PROTECTED-CHECK-01)
 * 기준 = 워커2 e579d7a4(update_block 만 «보호 + 빈 글 → SECTION_PROTECTED»). 코드 읽기: 나머지 update_* 다리(main.js _invokeRendererUpdate*)와
 *   렌더러 update*Block 어디에도 isSectionProtected 가 없다 ⇒ 다 들어갈 것(추정). 이 검사가 그 값을 잰다.
 * 자: main.js 의 진짜 다리 함수를 잘라 진짜 페이지에서 돌린다(mcp-update-empty-protected 와 같은 수법).
 * 칸(도구마다 하나): 미보호에서 표지 글 MARK 를 넣고 → 섹션 보호 → ⑴ 빈 글(blank) ⑵ 다른 글(other) ⑶ 배열 비우기(arr, 있으면) 를 차례로 —
 *   ⑴ 뒤 MARK 가 남았나(=막힘) · 답 code · ⑵ 뒤 OTHER 가 들어갔나(허용) · ⑶ 은 값만. 행은 콘솔 [ROW] 로.
 *   준비 실패(다리 자르기·블럭 만들기·MARK 넣기 실패)는 빨강이 아니라 행에 «n/a 까닭»으로 적는다.
 * 단언(지디 결정 ⓑ): ⑴ SECTION_PROTECTED · MARK 그대로 · 이력 칸 수 그대로(되돌림이 칸을 안 남김) ⑵ 다른 글은 들어간다 ⑶ 배열 비우기는 이번 범위 밖(값만).
 *   F1·F2 원래 빈 칸 채우기 / 빈 칸 둔 채 다른 칸 고치기 → 통과.
 * 인텔 표(3b51f14fa · 고치기 전): 11 도구 전부 빈 글 통과(markKept false) · other 전부 applied · card 준비 실패(no addCardBlock) → 이제 addCanvasBlock 카드 모드로.
 * 양성대조: main.js·js/section-protection.js 를 3b51f14fa 로 되돌리면 빈 글 칸 전부 빨강 · F1·F2 초록.
 * 픽스처: 섹션 둘 · 보호할 섹션에 글·그림과 그 도구의 블럭. 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { findBlockEnd } = require('../unit/_slice-block.js');

const ROOT = process.env.GD1001_ROOT || path.join(__dirname, '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const PROTECTED_LINE = MAIN.match(/^const _SECTION_PROTECTED_JS = .*$/m)?.[0] || 'const _SECTION_PROTECTED_JS = "null";';
const fnSrc = (name, kw = 'async function') => { const at = MAIN.indexOf(`${kw} ${name}(`); return at < 0 ? null : MAIN.slice(at, findBlockEnd(MAIN, MAIN.indexOf(') {', at) + 2) + 1); };
/* 진짜 다리 + (있으면) 입구 감싸기 _guardProtectedText — setMcpRendererInvoker 가 update* 에 씌우는 그것. 옛 판엔 없어 맨 다리(양성대조). */
function bridge(page, name, extras = []) {
  const src = fnSrc(name);
  if (!src) return null;
  const more = extras.map((n) => fnSrc(n) || '').join('\n');
  const guard = fnSrc('_guardProtectedText', 'function');
  return new Function('mainWindow', `${PROTECTED_LINE}\n${guard || ''}\n${more}\n${src}\nreturn ${guard ? `_guardProtectedText(${name})` : name};`)({
    isDestroyed: () => false, isMinimized: () => false, webContents: { executeJavaScript: (js) => page.evaluate(js) },
  });
}
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const M = 'MARK보호글', O = 'OTHER바꾼글';
const P = (partial) => ({ partial });   // {blockId, partial} 다리
const F = (flat) => ({ flat });         // {blockId, ...평평} 다리
/* tool · 다리(+같이 자를 함수) · 만들기(+인자) · 클래스 조각 · MARK 넣기 · 빈 글 · 다른 글 · 배열 비우기 */
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
  ['update_card_block', ['_invokeRendererUpdateCardBlock', '_invokeRendererUpdateCanvasBlock'], ['addCanvasBlock', { cardMode: 'simple', cards: [{ title: '카드 제목', desc: '카드 설명' }] }], 'canvas-block', F({ title: M }), F({ title: '' }), F({ title: O }), null],   // card = canvas 카드 모드 위임(main) — 렌더러에 addCardBlock 이 없다(인텔 표 준비 실패)
  ['update_graph_block', '_invokeRendererUpdateGraphBlock', 'addGraphBlock', 'graph', P({ items: [{ label: M, value: 50 }] }), P({ items: [{ label: '', value: 50 }] }), P({ items: [{ label: O, value: 50 }] }), null],
];

async function scene(page, addSpec, cls) {
  const [addFn, addArg] = Array.isArray(addSpec) ? addSpec : [addSpec, undefined];
  const errs = await bootApp(page);
  const r = await page.evaluate(async ({ addFn, addArg, cls, HALF }) => {
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
    let ret = null; try { ret = await window[addFn](addArg); } catch (e) { return { na: addFn + ' threw ' + e.message }; }
    const el = (ret && ret.nodeType === 1 && ret) || (ret && ret.block) || [...a.querySelectorAll('[id]')].find((x) => !before.has(x) && String(x.className).includes(cls) && !x.classList.contains('row') && !x.classList.contains('frame-block'));
    if (!el || !a.contains(el)) return { na: 'block not found in section' };
    window.deselectAll(); document.activeElement?.blur?.();
    return { id: el.id, secId: a.id };
  }, { addFn, addArg, cls, HALF });
  return { errs, ...r };
}
const call = async (fn, id, arg) => { try { return arg.partial ? await fn({ blockId: id, partial: arg.partial }) : await fn({ blockId: id, ...arg.flat }); } catch (e) { return { ok: false, code: 'THREW', message: e.message }; } };
const has = (page, id, s) => page.evaluate(([id, s]) => (document.getElementById(id)?.textContent || '').includes(s) || JSON.stringify(document.getElementById(id)?.dataset || {}).includes(s), [id, s]);

for (const [tool, bridgeName, addFn, cls, mark, blank, other, arr] of TOOLS) {
  test(`${tool} — 보호 섹션 글을 빈 글로 덮으면 막히고, 다른 글로는 바뀐다`, async ({ page }) => {
    const row = { tool };
    const [bName, ...bMore] = Array.isArray(bridgeName) ? bridgeName : [bridgeName];
    const fn = bridge(page, bName, bMore);
    if (!fn) { row.na = 'no bridge ' + bName; console.log('[ROW] ' + JSON.stringify(row)); test.skip(true, row.na); return; }
    const { errs, id, secId, na } = await scene(page, addFn, cls);
    if (na) { row.na = na; console.log('[ROW] ' + JSON.stringify(row)); test.skip(true, na); return; }
    const m = await call(fn, id, mark);
    if (!(await has(page, id, M))) { row.na = 'MARK 못 넣음 ' + JSON.stringify(m).slice(0, 160); console.log('[ROW] ' + JSON.stringify(row)); test.skip(true, row.na); return; }
    await page.evaluate((s) => window.setSectionProtected(s, true), secId);
    const h0 = await page.evaluate(() => { window.ensureHistoryCheckpoint?.('재기 전'); return [window.historyStack.length, window.historyPos]; });   // «현재 상태» 칸은 ⌘Z 도 먼저 찍는다 — 그걸 맞춘 뒤 거절이 칸을 더하나 잰다
    const b = await call(fn, id, blank);
    row.blank = { code: b?.code || (b?.ok ? 'ok' : '?'), markKept: await has(page, id, M), hist: [h0, await page.evaluate(() => [window.historyStack.length, window.historyPos])] };
    const o = await call(fn, id, other);
    row.other = { code: o?.code || (o?.ok ? 'ok' : '?'), applied: await has(page, id, O) };
    if (arr) { const a = await call(fn, id, arr); row.arr = { code: a?.code || (a?.ok ? 'ok' : '?'), textLeft: await page.evaluate((id) => (document.getElementById(id)?.textContent || '').replace(/\s/g, '').length, id) }; }
    console.log('[ROW] ' + JSON.stringify(row));
    expect(row.blank.markKept, `★${tool}: 보호 섹션 글이 빈 글로 덮였다 ${JSON.stringify(row.blank)}`).toBe(true);
    expect(row.blank.code).toBe('SECTION_PROTECTED');
    expect(row.blank.hist[1], '★거절한 되돌림이 이력에 칸을 남겼다').toEqual(row.blank.hist[0]);
    expect(row.other.applied, `★보호 섹션이라도 다른 글은 들어가야 한다 ${JSON.stringify(row.other)}`).toBe(true);
    expect(errs).toEqual([]);
  });
}

/* F — 원래 빈 칸은 보호 섹션에서도 고칠 수 있다(인자 판정이면 막혔을 꼴) */
for (const [cell, tool, bridgeName, addFn, cls, setup, fill] of [
  ['F1', 'update_table_block', '_invokeRendererUpdateTableBlock', 'addTableBlock', 'table', P({ headers: [M, ''], rows: [['c', '']] }), P({ headers: [M, '채움'], rows: [['c', '']] })],
  ['F2', 'update_qa_block', '_invokeRendererUpdateQABlock', 'addQABlock', 'qa-block', P({ items: [{ text: M, done: false }, { text: '', done: false }] }), P({ items: [{ text: M, done: true }, { text: '', done: false }] })],
]) {
  test(`${cell} ${tool} — 원래 빈 칸을 둔 채 고치기는 보호 섹션에서도 통과`, async ({ page }) => {
    const fn = bridge(page, bridgeName);
    const { errs, id, secId, na } = await scene(page, addFn, cls);
    test.skip(!!na || !fn, na || 'no bridge');
    await call(fn, id, setup);
    test.skip(!(await has(page, id, M)), 'MARK 못 넣음');
    await page.evaluate((s) => window.setSectionProtected(s, true), secId);
    const r = await call(fn, id, fill);
    console.log(`[${cell}] ` + JSON.stringify(r).slice(0, 200));
    expect(r?.code, `★원래 빈 칸 고치기를 막았다 ${JSON.stringify(r).slice(0, 200)}`).not.toBe('SECTION_PROTECTED');
    expect(await has(page, id, M)).toBe(true);
    expect(errs).toEqual([]);
  });
}
