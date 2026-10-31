/* ★317 ㉠ «안 붙었는데 붙었다고 말한다» — 시작 실패면 포트는 «없음»이고 뱃지·ping 이 그렇게 말한다.
   앱 한 쌍(GODITOR_MCP_PORT=notaport ×3 ↔ 정상 ×3)은 런으로 잰다. 여기는 상태 칸만.
   ⚠️ipc.js 는 모듈 상태라 케이스마다 새로 싣는다. electron 은 가짜. */
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const path = require('path');
const IPC = path.join(__dirname, '..', '..', 'main', 'claude-pm', 'ipc.js');

// ipc.js 가 mcp-server 를 부를 때 늦게 require 하므로 가짜는 파일 끝까지 둔다(ping-mcp-identity 와 같은 꼴)
const load = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'electron') return { app: {}, dialog: {}, shell: {} };
  if (req === './mcp-server') return { SERVER_NAME: 'goditor-test', getTokenFilePath: () => null };   // ㉡ 신원 판정의 짝
  return load.call(this, req, ...rest);
};
function fresh() {
  delete require.cache[IPC];
  return require(IPC);
}
/* 시작 실패면 남의 서버에 닿으면 안 된다 — fetch 가 불리면 빨강 */
async function noFetch(fn) {
  const orig = globalThis.fetch; let n = 0;
  globalThis.fetch = async () => { n++; return { ok: true, status: 200, json: async () => ({ name: 'goditor-test' }) }; };
  try { await fn(); } finally { globalThis.fetch = orig; }
  return n;
}

test('시작 전 — 포트 없음 · ping 은 안 나가고 connected false · failed false(아직과 실패가 갈린다)', async () => {
  const m = fresh();
  assert.strictEqual(m._internal.MCP_PORT, null);
  let r; const n = await noFetch(async () => { r = await m._internal.handlePingMcp(); });
  assert.strictEqual(n, 0, 'fetch 가 나갔다');
  assert.deepStrictEqual([r.ok, r.connected, r.failed], [true, false, false]);
});
test('시작 실패 — getMcpInfo 는 주소 0 · 사유 · ping 도 failed', async () => {
  const m = fresh();
  m.setMcpStartFailed('GODITOR_MCP_PORT 이 포트가 아니다: "notaport"');
  const info = await m._internal.handleGetMcpInfo();
  assert.deepStrictEqual([info.ok, info.port, info.url, info.failed], [false, null, null, true]);
  assert.match(info.error, /notaport/);
  let r; const n = await noFetch(async () => { r = await m._internal.handlePingMcp(); });
  assert.strictEqual(n, 0, 'fetch 가 나갔다');
  assert.deepStrictEqual([r.connected, r.failed], [false, true]);
});
test('시작 성공 — 진짜 포트 · 주소 · ping 은 그 포트로 나간다', async () => {
  const m = fresh();
  m.setActualMcpPort(9751);
  const info = await m._internal.handleGetMcpInfo();
  assert.deepStrictEqual([info.ok, info.port, info.url], [true, 9751, 'http://127.0.0.1:9751/mcp']);
  let r; const n = await noFetch(async () => { r = await m._internal.handlePingMcp(); });
  assert.strictEqual(n, 1);
  assert.strictEqual(r.connected, true);
});
test('성공 뒤 배선이 던져도 실패로 안 적는다(서버는 듣는 중)', async () => {
  const m = fresh();
  m.setActualMcpPort(9751);
  m.setMcpStartFailed('뒤 배선 오류');
  const info = await m._internal.handleGetMcpInfo();
  assert.deepStrictEqual([info.ok, info.port], [true, 9751]);
});
test('.mcp.json 자리는 포트가 없어도 «null» 을 안 적는다 · 있으면 그 포트', () => {
  const m = fresh();
  assert.strictEqual(m._internal._mcpConfigUrl(), 'http://localhost:9345');
  m.setActualMcpPort(9751);
  assert.strictEqual(m._internal._mcpConfigUrl(), 'http://localhost:9751');
});
test('getMcpInfo 는 시작 결과를 기다린다 — 창이 서버보다 먼저 떠도 «아직»을 실패로 안 말한다', async () => {
  const m = fresh();
  const p = m._internal.handleGetMcpInfo();
  m.setActualMcpPort(9751);
  assert.strictEqual((await p).port, 9751);
});
