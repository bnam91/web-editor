/* bt2-mcp-lines.test.js — BT2(버블·챗 «줄») MCP main 쪽 통로 (2026-10-04 태양 lane-bt2-lines)
 *
 * ★무엇 — MCP 로 준 `lines` 가 main 검증기(mcp-server.js _validateChatOpts·_validateSpeechBubbleOpts)를 «지나» 렌더러까지 가는가.
 *   핀(df43db91)에서는 두 검증기가 «아는 필드로만» 객체를 다시 만든다 ⇒ lines 를 조용히 버린다.
 *   지금은 lines 를 쓰는 블럭이 «없어서» 실제 유실은 0 이다 — 이건 «BT2 가 들어오면 생길 위험»의 증명이다.
 * ★C0 에서는 todo(빨강이어도 판을 안 깨는 «예상된 실패»)로 박는다. BT2 C6 이 고치면 todo 를 걷는다.
 *   걷은 뒤 빨강이면 = 통로가 다시 막힌 것. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');

/* ★C6(BT2) 에서 todo 를 걷었다 — main 검증기가 lines 를 통과시킨다(모양만, 깊은 검사는 렌더러). 핀 d5fe9bb8 에선 셋 다 빨강이었다. */
const TODO = false;
let H = null;
before(async () => { H = await startHarness({ activeProject: 'proj_1' }); });
after(async () => { if (H) await H.stop(); });

const LINES = [{ type: 'h2', text: '제목' }, { type: 'body', text: '본문' }];
const partialOf = (r, method) => {
  const c = r.rendererCalls.find(x => x.method === method);
  assert.ok(c, `전제: ${method} 가 불렸다(배선) — 안 불렸으면 이 검사는 «아무것도 안 잰» 것이다`);
  return c.args[0] && c.args[0].partial;
};

test('M1 update_chat_block{messages:[{…, lines}]} — lines 가 렌더러까지 간다', { todo: TODO }, async () => {
  const r = await H.call('update_chat_block', { blockId: 'chb_1', messages: [{ text: 'a', align: 'left', lines: LINES }] });
  const p = partialOf(r, 'updateChatBlock');
  assert.deepStrictEqual(p.messages[0].lines, LINES);
});

test('M2 update_chat_block{editMessage:{index, lines}} — lines 가 렌더러까지 간다', { todo: TODO }, async () => {
  const r = await H.call('update_chat_block', { blockId: 'chb_1', editMessage: { index: 0, lines: LINES } });
  const p = partialOf(r, 'updateChatBlock');
  assert.deepStrictEqual(p.editMessage.lines, LINES);
});

test('M3 update_speech_bubble_block{lines} — lines 가 렌더러까지 간다', { todo: TODO }, async () => {
  const r = await H.call('update_speech_bubble_block', { blockId: 'sb_1', lines: LINES });
  const p = partialOf(r, 'updateSpeechBubbleBlock');
  assert.deepStrictEqual(p.lines, LINES);
});
