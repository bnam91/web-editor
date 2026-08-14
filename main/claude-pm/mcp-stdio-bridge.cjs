#!/usr/bin/env node
/* goditor MCP — stdio↔HTTP 브리지
   Claude 데스크톱/Code(stdio MCP 클라이언트)가 goditor의 로컬 HTTP MCP 서버
   (127.0.0.1:9345~, Streamable-HTTP 간단형 JSON-RPC)에 붙을 수 있게 중계한다.
   - stdin: 줄단위 JSON-RPC 메시지(MCP stdio framing) → goditor /mcp 로 POST
   - stdout: goditor 응답을 줄단위 JSON-RPC로 반환 (notification은 무응답)

   ── 포트 선택 ─────────────────────────────────
   기본: 9345~9365를 /health로 훑어 «토큰을 요구하는(requiresToken)» 인스턴스 중 제일 낮은 포트.
   GODITOR_MCP_PORT를 주면 «그 포트만» 본다(스캔 안 함). 앱을 2개 띄웠을 때 어느 쪽에 붙일지
   못박는 용도다. 어디에 붙었는지는 stderr 로그와 goditor_which_instance 도구로 확인한다.

   ── 토큰 ─────────────────────────────────────
   1) GODITOR_MCP_TOKEN 환경변수가 있으면 그걸 쓴다(기존 설정 보존).
   2) 없으면 /health가 알려준 tokenFile(0600)을 읽는다. ★앱을 재시작해 토큰이 바뀌어도
      매 실행마다 새로 읽으므로 401이 나지 않는다 — 이게 이 브리지의 핵심이다.
   3) tokenFile을 못 받으면(구버전 앱) 기본 userData 경로들을 뒤진다.

   설정 예(claude_desktop_config.json) — ⛔토큰 하드코딩 불필요:
     { "mcpServers": { "goditor": {
         "command": "node",
         "args": ["<userData>/claude-pm/mcp-stdio-bridge.cjs"] } } }
   ⚠️ goditor 앱이 켜져 있어야 서버가 떠 있음(앱 종료 시 도구 호출 실패 반환). */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PINNED_PORT = process.env.GODITOR_MCP_PORT ? parseInt(process.env.GODITOR_MCP_PORT, 10) : null;
const SCAN_FROM = 9345, SCAN_TO = 9365;
const ENV_TOKEN = process.env.GODITOR_MCP_TOKEN || null;

let port = null;        // 붙기로 정한 포트
let health = null;      // 그 포트의 /health 응답
let token = ENV_TOKEN;  // 실제로 헤더에 실을 토큰
let tokenSource = ENV_TOKEN ? 'env(GODITOR_MCP_TOKEN)' : null;
let candidates = [];    // 살아있는 인스턴스 전부(중복 실행 감지용)

const logErr = (m) => { try { process.stderr.write('[goditor-bridge] ' + m + '\n'); } catch (_) {} };

function probe(p) {
  return new Promise(res => {
    const req = http.get({ host: '127.0.0.1', port: p, path: '/health', timeout: 700 }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { const j = JSON.parse(d); res(j && j.status === 'ok' ? j : null); } catch (_) { res(null); } });
    });
    req.on('error', () => res(null));
    req.on('timeout', () => { req.destroy(); res(null); });
  });
}

// 여러 goditor 인스턴스가 떠 있을 수 있다(검증용 2인스턴스 동시 실행 등).
// 토큰을 요구하는(신코드) 인스턴스를 우선 선택해 엉뚱한 서버에 붙는 것을 막는다.
async function findInstance() {
  const found = [];
  if (PINNED_PORT) {
    const h = await probe(PINNED_PORT);
    if (h) found.push({ p: PINNED_PORT, h });
  } else {
    for (let p = SCAN_FROM; p <= SCAN_TO; p++) {
      const h = await probe(p);
      if (h) found.push({ p, h });
    }
  }
  candidates = found;
  if (!found.length) return null;
  return found.find(f => f.h && f.h.requiresToken) || found[0];
}

// tokenFile을 못 받았을 때의 폴백 후보(구버전 앱 대비).
// ⚠️격리 인스턴스(--user-data-dir)는 여기 안 잡힌다 — 그 경우 /health의 tokenFile이 정답이다.
function defaultTokenFiles(p) {
  const bases = [];
  if (process.platform === 'darwin') {
    const as = path.join(os.homedir(), 'Library', 'Application Support');
    bases.push(path.join(as, 'GODITOR'), path.join(as, 'sangpe-editor'));
  } else if (process.platform === 'win32') {
    const ad = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    bases.push(path.join(ad, 'GODITOR'), path.join(ad, 'sangpe-editor'));
  } else {
    const cfg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    bases.push(path.join(cfg, 'GODITOR'), path.join(cfg, 'sangpe-editor'));
  }
  const out = [];
  for (const b of bases) {
    out.push(path.join(b, 'claude-pm', `mcp-${p}.json`));
    out.push(path.join(b, 'claude-pm', 'mcp.json'));
  }
  return out;
}

function readTokenFile(file, wantPort) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!j || !j.token) return null;
    // 파일이 다른 포트(다른 인스턴스) 것이면 쓰지 않는다 — 그대로 쓰면 401만 난다.
    if (wantPort != null && j.port != null && j.port !== wantPort) return null;
    return j.token;
  } catch (_) { return null; }
}

function resolveToken(inst) {
  if (ENV_TOKEN) return; // env 우선(기존 설정 안 깨짐)
  const tried = [];
  const primary = inst.h && inst.h.tokenFile;
  if (primary) {
    tried.push(primary);
    const t = readTokenFile(primary, inst.p);
    if (t) { token = t; tokenSource = primary; return; }
  }
  for (const f of defaultTokenFiles(inst.p)) {
    tried.push(f);
    const t = readTokenFile(f, inst.p);
    if (t) { token = t; tokenSource = f; return; }
  }
  token = null;
  tokenSource = null;
  logErr('토큰을 못 찾음. 찾아본 경로: ' + tried.join(' , '));
}

// 토큰을 못 구했을 때 «사용자가 읽고 뭘 해야 할지 아는» 문장.
function tokenHelp(inst) {
  const p = inst ? inst.p : '?';
  return [
    `goditor MCP 토큰을 찾지 못했습니다(포트 ${p}).`,
    '해결 방법 중 하나를 하세요:',
    ` 1) goditor 앱에서 환경설정 → 개발자 탭 → 「접속 토큰」 복사 후, 이 MCP 서버 설정의 env에 GODITOR_MCP_TOKEN 으로 넣기.`,
    ` 2) 앱을 최신 버전으로 재시작하기 — 앱이 부팅할 때 토큰 파일을 다시 씁니다.`,
    ` 3) 격리 인스턴스(--user-data-dir)로 띄웠다면 그 인스턴스의 포트를 GODITOR_MCP_PORT 로 지정하기.`,
  ].join('\n');
}

function post(p, body) {
  return new Promise((res, rej) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port: p, path: '/mcp', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length,
        ...(token ? { 'x-goditor-token': token } : {}) } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        if (r.statusCode === 401) return rej(Object.assign(new Error('unauthorized'), { status: 401 }));
        try { res(d ? JSON.parse(d) : null); } catch (e) { rej(e); }
      });
    });
    req.on('error', rej); req.write(data); req.end();
  });
}

// 어느 인스턴스에 붙었는지 사용자가 «클라이언트 안에서» 확인할 수 있어야 한다.
// 서버 도구 목록에 브리지가 직접 하나를 얹고, 호출도 브리지가 로컬에서 답한다.
const WHICH_TOOL = {
  name: 'goditor_which_instance',
  description: '이 MCP 연결이 붙어 있는 goditor 인스턴스(포트·pid·userData)와, 지금 떠 있는 다른 인스턴스 목록을 알려준다.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
};

function whichText() {
  const lines = [];
  lines.push(`연결됨: 127.0.0.1:${port}  (인스턴스 ${health && health.instance || '?'}, pid ${health && health.pid || '?'}`
    + `, 열린 프로젝트 ${health && health.activeProject || '없음'})`);
  lines.push(`토큰 출처: ${tokenSource || '(없음 — 401이 납니다)'}`);
  lines.push(`포트 선택: ${PINNED_PORT ? `GODITOR_MCP_PORT=${PINNED_PORT} 로 고정됨` : `${SCAN_FROM}~${SCAN_TO} 자동 탐색`}`);
  if (candidates.length > 1) {
    lines.push(`⚠️ 살아있는 인스턴스가 ${candidates.length}개입니다:`);
    for (const c of candidates) {
      lines.push(`   - :${c.p}  ${c.h.instance || '?'}  pid ${c.h.pid || '?'}  프로젝트 ${c.h.activeProject || '없음'}${c.p === port ? '   ← 지금 연결됨' : ''}`);
    }
    lines.push('   앱 상단바 MCP 배지에 그 창의 «실제 포트»가 찍혀 있습니다 — 붙이고 싶은 창의 포트를 거기서 확인하세요.');
    lines.push('   그 다음 MCP 설정 env에 GODITOR_MCP_PORT=<포트> 를 넣고 클라이언트를 재시작하면 그 창에 고정됩니다.');
  } else {
    lines.push('살아있는 인스턴스: 1개');
  }
  return lines.join('\n');
}

let buf = '';
let pending = 0, ended = false;
const maybeExit = () => { if (ended && pending === 0 && buf.indexOf('\n') < 0) process.exit(0); };

// 줄이 한꺼번에 들어오면 handle()이 동시에 여러 개 돈다. 탐색을 그대로 두면 인스턴스 스캔이
// 메시지 수만큼 중복 실행된다 — 진행 중인 탐색 하나를 공유한다.
let _connecting = null;
function ensureConnected() {
  if (port != null) return Promise.resolve(true);
  if (!_connecting) _connecting = _connect().finally(() => { _connecting = null; });
  return _connecting;
}

async function _connect() {
  if (port != null) return true;
  const inst = await findInstance();
  if (!inst) return false;
  port = inst.p;
  health = inst.h;
  resolveToken(inst);
  // ⛔토큰 값은 찍지 않는다. 경로/포트/인스턴스만.
  logErr(`연결 127.0.0.1:${port} (인스턴스 ${health.instance || '?'}, pid ${health.pid || '?'}, 프로젝트 ${health.activeProject || '없음'}) · 토큰출처 ${tokenSource || '없음'}`
    + (candidates.length > 1 ? ` · ⚠️인스턴스 ${candidates.length}개 감지 — goditor_which_instance 로 확인` : ''));
  return true;
}

// 한 메시지 처리(비동기). 줄 추출과 분리해 모든 줄을 먼저 큐잉(pending++)하므로
// 첫 응답 후 둘째 줄을 처리하기 전에 조기 종료되던 버그 방지.
async function handle(msg) {
  const isReq = msg.id !== undefined && msg.id !== null;
  const reply = (obj) => { if (isReq) process.stdout.write(JSON.stringify(obj) + '\n'); };
  try {
    if (!(await ensureConnected())) {
      reply({ jsonrpc: '2.0', id: msg.id,
        error: { code: -32000, message: PINNED_PORT
          ? `goditor MCP 서버를 포트 ${PINNED_PORT}에서 찾을 수 없음 — 그 인스턴스가 켜져 있는지, GODITOR_MCP_PORT 값이 맞는지 확인하세요.`
          : `goditor MCP 서버를 찾을 수 없음(${SCAN_FROM}~${SCAN_TO}) — goditor 앱이 켜져 있는지 확인하세요.` } });
      return;
    }
    // 브리지 자체 도구 — 서버에 보내지 않고 여기서 답한다.
    if (msg.method === 'tools/call' && msg.params && msg.params.name === WHICH_TOOL.name) {
      reply({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: whichText() }] } });
      return;
    }
    const resp = await post(port, msg);
    if (!isReq) return; // notification: 무응답
    // tools/list에 브리지 도구를 얹어 클라이언트에 노출.
    if (msg.method === 'tools/list' && resp && resp.result && Array.isArray(resp.result.tools)) {
      resp.result.tools = resp.result.tools.concat([WHICH_TOOL]);
    }
    reply(resp && Object.keys(resp).length ? resp : { jsonrpc: '2.0', id: msg.id, result: {} });
  } catch (e) {
    const was = { port, health: health || {} };
    port = null; health = null; // 끊겼으면 다음 호출 때 재탐색
    if (!ENV_TOKEN) { token = null; tokenSource = null; } // 파일에서 다시 읽는다(토큰 회전 대응)
    if (e && e.status === 401) {
      reply({ jsonrpc: '2.0', id: msg.id, error: { code: -32001,
        message: '토큰 거부(401) — ' + tokenHelp({ p: was.port }) } });
      return;
    }
    reply({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: 'goditor 연결 실패: ' + e.message } });
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
