/* mcp-banner02-add-blocked.test.js — BANNER02-HIDE-LEGACY-01 (현빈 0.9.10 · 7107 「응 막아」).
 *   UI 메뉴 «Banner 2» 숨김과 맞춰 MCP 도 «새로 넣기»만 막는다. 이미 든 bn2_ 를 고치는 명령은 그대로.
 *   T1 add_banner02_block → 거절 · 사용자에게 보이는 이유 문구 · 렌더러 호출 0
 *   T2 add_block {type:'banner02'} → 거절 · 렌더러 호출 0
 *   T3 update_banner02_block / update_block {type:'banner02'} → 렌더러 updateBanner02Block 에 닿는다
 * ★양성대조: mcp-server.js 의 throw 를 빼고 block-tools 의 add:null 을 되돌리면 T1·T2 빨강. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startHarness } = require('./_mcp-harness');

let H = null;
before(async () => { H = await startHarness({ activeProject: 'proj_1' }); await H.confirmTarget?.('proj_1'); });
after(async () => { if (H) await H.stop(); });
const said = (r) => JSON.stringify(r.error || r.result || r.rawText || '');
const work = (r) => r.rendererCalls.filter(c => c.method !== 'historyTip').map(c => c.method);

test('T1 add_banner02_block 거절 · 이유 문구 · 렌더러 무접촉', async () => {
  const r = await H.call('add_banner02_block', {});
  assert.match(said(r), /막혔다/, `거절 문구 없음: ${said(r).slice(0, 200)}`);
  assert.match(said(r), /update_banner02_block/, '고치는 길을 안 알려준다');
  assert.ok(!work(r).includes('addBanner02Block'), `렌더러에 닿았다: ${work(r)}`);
});

test('T2 add_block type banner02 거절', async () => {
  const r = await H.call('add_block', { type: 'banner02' });
  assert.match(said(r), /no add tool|막혔다/, `거절 안 함: ${said(r).slice(0, 200)}`);
  assert.ok(!work(r).includes('addBanner02Block'), `렌더러에 닿았다: ${work(r)}`);
});

test('T3 기존 배너2 고치기는 그대로', async () => {
  const a = await H.call('update_banner02_block', { blockId: 'bn2_1', variant: 'frame_8' });
  assert.ok(work(a).includes('updateBanner02Block'), `update_banner02_block 이 안 닿았다: ${said(a).slice(0, 200)}`);
  const b = await H.call('update_block', { blockId: 'bn2_1', variant: 'frame_8' });
  assert.ok(work(b).includes('updateBanner02Block'), `update_block(bn2_) 이 안 닿았다: ${said(b).slice(0, 200)}`);
});
