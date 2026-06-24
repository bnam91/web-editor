#!/usr/bin/env node
/* goditor MCP — stdio↔HTTP 브리지
   Claude 데스크톱/Code(stdio MCP 클라이언트)가 goditor의 로컬 HTTP MCP 서버
   (127.0.0.1:9345~, Streamable-HTTP 간단형 JSON-RPC)에 붙을 수 있게 중계한다.
   - stdin: 줄단위 JSON-RPC 메시지(MCP stdio framing) → goditor /mcp 로 POST
   - stdout: goditor 응답을 줄단위 JSON-RPC로 반환 (notification은 무응답)
   - 포트는 GODITOR_MCP_PORT(기본 9345)부터 +20까지 /health 로 자동 탐색.
   설정 예(claude_desktop_config.json):
     { "mcpServers": { "goditor": {
         "command": "node",
         "args": ["/Users/a1/web-editor/main/claude-pm/mcp-stdio-bridge.cjs"] } } }
   ⚠️ goditor 앱이 켜져 있어야 서버가 떠 있음(앱 종료 시 도구 호출 실패 반환). */
const http = require('http');
const BASE_PORT = parseInt(process.env.GODITOR_MCP_PORT || '9345', 10);
let port = null;

function probe(p) {
  return new Promise(res => {
    const req = http.get({ host: '127.0.0.1', port: p, path: '/health', timeout: 700 }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { const j = JSON.parse(d); res(j && j.status === 'ok'); } catch (_) { res(false); } });
    });
    req.on('error', () => res(false));
    req.on('timeout', () => { req.destroy(); res(false); });
  });
}
async function findPort() {
  for (let p = BASE_PORT; p <= BASE_PORT + 20; p++) { if (await probe(p)) return p; }
  return null;
}
function post(p, body) {
  return new Promise((res, rej) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port: p, path: '/mcp', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res(d ? JSON.parse(d) : null); } catch (e) { rej(e); } });
    });
    req.on('error', rej); req.write(data); req.end();
  });
}

let buf = '';
let pending = 0, ended = false;
const maybeExit = () => { if (ended && pending === 0 && buf.indexOf('\n') < 0) process.exit(0); };

// 한 메시지 처리(비동기). 줄 추출과 분리해 모든 줄을 먼저 큐잉(pending++)하므로
// 첫 응답 후 둘째 줄을 처리하기 전에 조기 종료되던 버그 방지.
async function handle(msg) {
  const isReq = msg.id !== undefined && msg.id !== null;
  try {
    if (port == null) {
      port = await findPort();
      if (port == null) {
        if (isReq) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id,
          error: { code: -32000, message: 'goditor MCP 서버를 찾을 수 없음 — goditor 앱이 켜져 있는지 확인하세요.' } }) + '\n');
        return;
      }
    }
    const resp = await post(port, msg);
    if (!isReq) return; // notification: 무응답
    process.stdout.write(JSON.stringify(resp && Object.keys(resp).length ? resp
      : { jsonrpc: '2.0', id: msg.id, result: {} }) + '\n');
  } catch (e) {
    port = null; // 끊겼으면 다음 호출 때 재탐색
    if (isReq) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id,
      error: { code: -32000, message: 'goditor 연결 실패: ' + e.message } }) + '\n');
  } finally {
    pending--; maybeExit();
  }
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch (_) { continue; }
    pending++;
    handle(msg); // 비동기 동시 처리(응답은 id로 매칭되므로 순서 무관)
  }
});
process.stdin.on('end', () => { ended = true; maybeExit(); });
