/* ping-mcp-identity.test.js — ★317 ㉡ «남을 내 것이라 말한다» · handlePingMcp 가 /health 의 신원을 보나 (S7 · 261031 · 지디 J317H)
 *   자: main/claude-pm/ipc.js 진짜 handlePingMcp 를 electron·mcp-server 가짜 위에서 진짜 fetch 로 돌리고, 임시 포트(운영체제가 고름)에 가짜 /health 를 앉힌다.
 *   한 쌍: P* = 남(200 · name 다름 · 본문 깨짐 · tokenFile 다름) ⇒ connected:false / N* = 제 서버 꼴 ⇒ true.
 *   ⚠️자 한계: 패널 점 · 진짜 서버와의 맞물림은 앱 칸(회신)이 잰다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const Module = require('module');

const NAME = 'goditor-claude-pm', TOKEN = '/tmp/mine/mcp-token.json';
let tokenFile = TOKEN;
const fakeServer = { SERVER_NAME: NAME, getTokenFilePath: () => tokenFile };
const load = Module._load;
Module._load = function (req, parent, ...r) {
  if (req === 'electron') return { app: {}, dialog: {}, shell: {} };
  if (req === './mcp-server' && parent && /claude-pm[\\/]ipc\.js$/.test(parent.filename)) return fakeServer;
  return load.call(this, req, parent, ...r);
};
const ipc = require('../../main/claude-pm/ipc.js');   // ipc 는 mcp-server 를 부를 때 require 한다 ⇒ 가짜를 되돌리지 않는다

async function ping(status, body) {
  const srv = http.createServer((_q, res) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(body); });
  await new Promise((r) => srv.listen(0, () => r()));   // 모든 주소 — ipc 의 localhost 가 어느 쪽으로 풀려도 닿는다
  ipc.setActualMcpPort(srv.address().port);
  try { return await ipc._internal.handlePingMcp(); } finally { await new Promise((r) => srv.close(r)); }
}
const J = (o) => JSON.stringify(o);

test('N1 제 서버 — name · tokenFile 맞음 ⇒ true', async () => {
  const r = await ping(200, J({ status: 'ok', name: NAME, tokenFile: TOKEN }));
  assert.deepEqual([r.ok, r.connected, r.status], [true, true, 200]);
});
test('N2 내 토큰 파일이 아직 없으면 name 만 본다 ⇒ true', async () => {
  tokenFile = null;
  try { assert.equal((await ping(200, J({ status: 'ok', name: NAME, tokenFile: null }))).connected, true); } finally { tokenFile = TOKEN; }
});
test('P1 남 — 200 인데 name 이 다르다 ⇒ false', async () => {
  const r = await ping(200, J({ status: 'ok', name: 'someone-else', tokenFile: TOKEN }));
  assert.deepEqual([r.ok, r.connected, r.status], [true, false, 200]);
});
test('P2 남 — 200 인데 신원 칸이 없다 ⇒ false', async () => {
  assert.equal((await ping(200, J({ status: 'ok' }))).connected, false);
});
test('P3 남 — 200 인데 JSON 이 아니다 ⇒ false', async () => {
  assert.equal((await ping(200, 'ok')).connected, false);
});
test('P4 같은 이름 · 다른 tokenFile(다른 인스턴스) ⇒ false', async () => {
  assert.equal((await ping(200, J({ status: 'ok', name: NAME, tokenFile: '/tmp/other/mcp-token.json' }))).connected, false);
});
test('P5 같은 이름 · tokenFile 칸 없음 ⇒ false', async () => {
  assert.equal((await ping(200, J({ status: 'ok', name: NAME }))).connected, false);
});
test('P6 500 ⇒ false', async () => {
  const r = await ping(500, J({ name: NAME, tokenFile: TOKEN }));
  assert.deepEqual([r.connected, r.status], [false, 500]);
});
test('P7 아무도 안 듣는다 ⇒ false', async () => {
  const srv = http.createServer(); await new Promise((r) => srv.listen(0, () => r())); const port = srv.address().port; await new Promise((r) => srv.close(r));
  ipc.setActualMcpPort(port);
  const res = await ipc._internal.handlePingMcp();
  assert.deepEqual([res.ok, res.connected], [true, false]);
});
