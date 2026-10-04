/* s3v-mcp-dir.test.js — S3V Icon Text «방향»이 MCP main 검증기를 지나 렌더러까지 가나 (2026-10-04 태양 lane-s3-vertical)
 * C0 에서 todo(빨강) → S3V C3(MCP 커밋)에서 걷었다. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');
let H = null;
before(async () => { H = await startHarness({ activeProject: 'proj_1' }); });
after(async () => { if (H) await H.stop(); });
const partialOf = (r, m) => { const c = r.rendererCalls.find(x => x.method === m); assert.ok(c, `전제: ${m} 가 불렸다 — 결과 ${JSON.stringify(r.result || r.error).slice(0, 200)}`); return c.args[0] && c.args[0].partial; };

test('D1 update_icon_text_block{direction:"vertical"} — 렌더러까지 간다', async () => {
  const r = await H.call('update_icon_text_block', { blockId: 'itb_1', direction: 'vertical' });
  assert.strictEqual(partialOf(r, 'updateIconTextBlock').direction, 'vertical');
});
test('D2 update_icon_text_block{direction:"diagonal"} — 거절', async () => {
  const r = await H.call('update_icon_text_block', { blockId: 'itb_1', direction: 'diagonal' });
  const rejected = !!r.error || (r.result && r.result.ok === false);
  assert.ok(rejected && !r.rendererCalls.some(c => c.method === 'updateIconTextBlock'), '잘못된 값은 렌더러에 안 간다');
  assert.match(JSON.stringify(r.error || r.result), /direction/);
});
test('D3 add_icon_text_block{direction:"vertical"} — add 브리지에 실린다', async () => {
  const r = await H.call('add_icon_text_block', { direction: 'vertical' });
  const c = r.rendererCalls.find(x => x.method === 'addIconTextBlock');
  assert.ok(c, '전제: addIconTextBlock 이 불렸다');
  assert.strictEqual(c.args[0].direction, 'vertical');
});
