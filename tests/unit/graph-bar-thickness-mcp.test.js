/* graph-bar-thickness-mcp — 막대 두께 한계가 «MCP 경로»에서도 60 이다 (B7-b, 2026-10-03 현빈 「60까지 되어야해」)
 * 재는 자리 = mcp-server 의 진짜 디스패처(HTTP). 렌더러는 가짜 — «렌더러에 무엇이 넘어가나»만 본다.
 *   M1 barThickness 60 → update_graph_block / add_graph_block 이 «통과해» 렌더러로 60 이 넘어간다
 *   M2 61·999 → 렌더러에 «가기 전에» 거절(자르지 않는다 — API 는 거절이 원래 동작)
 *   M3 도구 스키마 설명이 같은 한계를 말한다(tools/list)
 * 전제 단언: 가짜 렌더러가 «실제로 불렸다»는 호출 수로 확인한다 — 안 불렸는데 통과로 읽지 않게. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const srv = require('../../main/claude-pm/mcp-server.js');
const LIM = require('../../js/graph-limits.js');
srv.setAuthProbe(() => ({ authed: true }));

let started = null; let N = 0; const SEEN = [];
function rpc(method, params) {
  N++; const body = JSON.stringify({ jsonrpc: '2.0', id: N, method, params });
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: started.port, path: '/mcp', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goditor-token': started.token, 'Content-Length': Buffer.byteLength(body) } },
    r => { let o = ''; r.on('data', c => o += c); r.on('end', () => { try { res(JSON.parse(o)); } catch { rej(new Error(o.slice(0, 200))); } }); });
    req.on('error', rej); req.end(body);
  });
}
async function call(name, args) { const r = await rpc('tools/call', { name, arguments: args }); return r.error ? { ok: false, _rpcError: r.error.message } : JSON.parse(r.result.content[0].text); }

test.before(async () => {
  srv.setProjectOps({ list: () => ({ items: [{ id: 'proj_1000000000001', name: 'x', createdAt: 1, updatedAt: 2 }] }),
    open: async ({ projectId }) => ({ ok: true, projectId, activeProjectId: projectId, ready: true, sections: 0, waitedMs: 1 }) });
  srv.setRendererInvoker({
    updateGraphBlock: async (a) => { SEEN.push(['update', a]); return { ok: true, blockId: a.blockId }; },
    addGraphBlock: async (a) => { SEEN.push(['add', a]); return { ok: true, blockId: 'grb_t' }; },
  });
  started = await srv.startMcpServer({ port: 9412, onActiveProject: () => 'proj_1000000000001' });
  assert.ok(Number.isInteger(started.port) && started.port > 0);
  assert.equal((await call('open_project', { projectId: 'proj_1000000000001' })).ok, true);
});
test.after(async () => { await srv.stopMcpServer(); });

test('M0 전제 — 한계 상수는 60 이고 가짜 렌더러가 «불린다»', async () => {
  assert.equal(LIM.BAR_THICKNESS_MAX, 60);
  const before = SEEN.length;
  const r = await call('update_graph_block', { blockId: 'grb_t', barThickness: 24 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(SEEN.length, before + 1, '가짜 렌더러가 안 불렸다 — 아래 «통과»는 헛것');
});

for (const tool of ['update_graph_block', 'add_graph_block']) {
  const args = (v) => tool === 'update_graph_block' ? { blockId: 'grb_t', barThickness: v } : { chartType: 'bar-h', barThickness: v };
  test(`M1 ${tool} barThickness 60 → 렌더러로 60 이 넘어간다`, async () => {
    const before = SEEN.length;
    const r = await call(tool, args(60));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(SEEN.length, before + 1);
    const got = SEEN[SEEN.length - 1][1];
    assert.equal((got.partial || got).barThickness, 60);
  });
  for (const v of [61, 999]) {
    test(`M2 ${tool} barThickness ${v} → 렌더러에 가기 전에 거절`, async () => {
      const before = SEEN.length;
      const r = await call(tool, args(v));
      assert.equal(r.ok === false || !!r._rpcError || !!r.error, true, JSON.stringify(r));
      assert.equal(SEEN.length, before, '거절돼야 할 값이 렌더러까지 갔다');
    });
  }
}

test('M3 tools/list — 두 도구의 barThickness 설명이 «8~60»', async () => {
  const r = await rpc('tools/list', { includeHidden: true });
  const tools = r.result.tools.filter(t => t.name === 'add_graph_block' || t.name === 'update_graph_block');
  assert.equal(tools.length, 2);
  for (const t of tools) assert.match(t.inputSchema.properties.barThickness.description, new RegExp(`${LIM.BAR_THICKNESS_MIN}~${LIM.BAR_THICKNESS_MAX}`));
  assert.match(tools[0].inputSchema.properties.barThickness.description, /~60/);
});

/* 배포판 안전 — main 이 require 하는 js/graph-limits.js 가 패키지(build.files)에서 빠지면 MCP 기동에서 죽는다.
 * electron-builder files 는 «패턴 목록»: '**\/*' 로 넣고 '!pattern' 으로 뺀다. 이 파일이 «뺀 패턴»에 걸리지 않아야 한다. */
test('M4 패키징 — build.files 가 js/graph-limits.js 를 «포함»하고 어떤 제외 패턴에도 안 걸린다', () => {
  const files = require('../../package.json').build.files;
  assert.ok(files.includes('**/*'), '전부 포함 패턴이 사라졌다 — 아래 제외 판정이 의미를 잃는다');
  const rel = 'js/graph-limits.js';
  const hit = files.filter(f => f.startsWith('!')).map(f => f.slice(1)).filter(g => {
    const base = g.replace(/^\*\*\//, '').replace(/\/\*\*$/, '').replace(/\/$/, '');
    return rel === base || rel.startsWith(base + '/') || (g.startsWith('*') && rel.endsWith(g.replace(/^\*+/, '')));
  });
  assert.deepEqual(hit, [], '제외 패턴에 걸린다: ' + hit.join(','));
  assert.ok(require('fs').existsSync(require('path').join(__dirname, '..', '..', rel)));
});
