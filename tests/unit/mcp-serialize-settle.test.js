/* mcp-serialize-settle.test.js — MCP 줄: 다음 호출은 앞 호출의 렌더러 정착(끝 표본) 뒤에 돈다 · 답은 안 늦는다 · 렌더러가 안 답해도 줄이 안 멈춘다.
 * 까닭: 앱에서 add_text_block→move_block 이 끝 표본 창에 끼면 ⌘Z 가 둘을 한꺼번에 되돌렸다(차례 1/6 · 동시 2/6). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startHarness } = require('./_mcp-harness.js');

test('S1~S3', async (t) => {
  const h = await startHarness({ activeProject: 'proj_1' });
  t.after(() => h.stop());
  const log = [];
  let release;
  h.setCanned('waitSettled', () => { log.push('wait'); return new Promise((r) => { release = r; }); });
  h.setCanned('addGapBlock', async () => { log.push('gap'); return { ok: true, id: 'g' }; });

  await t.test('S1 다음 호출은 정착을 기다리고 · 첫 답은 그 전에 온다', async () => {
    const a = await h.call('add_gap_block', {});   // 정착을 안 풀어도 답이 온다
    assert.equal(a.result?.ok, true, JSON.stringify(a.result));
    assert.deepEqual(log, ['gap', 'wait']);
    let second = false;
    const b = h.call('add_gap_block', {}).then((r) => { second = true; return r; });
    await new Promise((r) => setImmediate(r));
    assert.equal(log.filter((x) => x === 'gap').length, 1, '정착 전에 다음 호출이 돌았다');
    assert.equal(second, false);
    release(true);
    assert.equal((await b).result?.ok, true);
    assert.deepEqual(log, ['gap', 'wait', 'gap', 'wait']);
    release(true);
  });
  await t.test('S2 동시에 보낸 호출 — 도착 순으로 정착 사이에 하나씩 · 답이 제 호출에 간다', async () => {
    log.length = 0;
    h.setCanned('waitSettled', async () => { log.push('wait'); });
    let n = 0;
    h.setCanned('addGapBlock', async () => { const id = 'g' + (++n); log.push(id); return { ok: true, id }; });
    const rs = await Promise.all([h.call('add_gap_block', {}), h.call('add_gap_block', {}), h.call('add_gap_block', {})]);
    assert.deepEqual(log, ['g1', 'wait', 'g2', 'wait', 'g3', 'wait']);
    assert.ok(rs.every((r) => r.result?.ok === true), JSON.stringify(rs.map((r) => r.result)));
  });
  await t.test('S3 렌더러가 안 답해도(안 끝나는 정착 · 던지는 정착) 줄이 안 멈춘다', async () => {
    h.setCanned('waitSettled', () => new Promise(() => {}));
    assert.equal((await h.call('add_gap_block', {})).result?.ok, true);
    assert.equal((await h.call('add_gap_block', {})).result?.ok, true);
    h.setCanned('waitSettled', async () => { throw new Error('renderer gone'); });
    assert.equal((await h.call('add_gap_block', {})).result?.ok, true);
    assert.equal((await h.call('add_gap_block', {})).result?.ok, true);
  });
});
