/* 확정(sticky)이 «호출자별»인가 — ★진짜 HTTP 로 두 세션을 흉내내서 잰다.
   ⛔모듈 함수를 직접 부르면 AsyncLocalStorage 문맥이 안 서서 «흉내낸 것»을 재게 된다.
     오늘 두 번 그 함정에 빠졌으므로 여기선 서버를 띄우고 «헤더»로 가른다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const srv = require('../../main/claude-pm/mcp-server.js');

srv.setAuthProbe(() => ({ authed: true }));                 // 로그인 게이트는 이 검사의 대상이 아니다
srv.setProjectsRoot(() => require('os').tmpdir());

let PORT = null, TOKEN = null;
let _active = 'proj_1';
srv.setRendererInvoker({ invoke: async () => ({ ok: true }) });
srv.setProjectOps({
  open: async ({ projectId }) => { _active = projectId; return { ok: true, activeProjectId: projectId, ready: true }; },
  list: async () => ({ ok: true, items: [{ id: 'proj_1', name: 'A' }, { id: 'proj_2', name: 'B' }] }),
});

test.before(async () => {
  const r = await srv.startMcpServer({ port: 9412, onActiveProject: () => _active });
  PORT = r.port; TOKEN = srv.getToken();
});
test.after(async () => { try { await srv.stopMcpServer(); } catch (_) {} });

/** 세션 id 를 «헤더»로 붙여 부른다. sid=null 이면 헤더 없음(직접 curl 흉내). */
function call(sid, name, args = {}) {
  const body = Buffer.from(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args },
  }));
  const headers = { 'Content-Type': 'application/json', 'Content-Length': body.length, 'x-goditor-token': TOKEN };
  if (sid) headers['Mcp-Session-Id'] = sid;
  return new Promise((res, rej) => {
    const rq = http.request({ host: '127.0.0.1', port: PORT, path: '/mcp', method: 'POST', headers }, (r) => {
      let d = ''; r.on('data', (c) => (d += c));
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    });
    rq.on('error', rej); rq.end(body);
  });
}
const said = (r) => JSON.stringify(r && r.result ? r.result : r);

test('C1 ★A 세션의 확정이 B 세션에게 «새지 않는다»', async () => {
  /* 예전엔 _confirmedProject 가 «프로세스 전역»이었다. 그래서 A 가 open_project 로 확정을 세우면
     B 의 인자 0개 쓰기가 sticky 로 그냥 통과했다 — 게이트가 「이 대화」라고 말하는 자리들이
     실제로는 「이 앱 프로세스에 붙은 모두」였다.
     ★그리고 브리지는 기본값에서 9345~9365 중 «최저 포트»에 말없이 붙는다 ⇒ 남의 실사용
       인스턴스에 붙는 일이 실제로 일어나고, 그때 확정까지 공유하면 남의 프로젝트에 쓴다. */
  await call('sess-A', 'open_project', { projectId: 'proj_1' });

  // ★양성대조 — A 는 «진짜로» 확정이 섰는가. 안 섰으면 아래 판정이 무의미하다
  const a = said(await call('sess-A', 'add_section', {}));
  assert.ok(!/PROJECT_NOT_CONFIRMED/.test(a), `★A 가 확정을 못 세웠다 — 이 검사가 성립하지 않는다: ${a.slice(0, 200)}`);

  const b = said(await call('sess-B', 'add_section', {}));
  assert.ok(/PROJECT_NOT_CONFIRMED/.test(b),
    `★B 가 A 의 확정으로 통과했다 — 남의 세션이 세운 확정으로 쓰기가 들어간다: ${b.slice(0, 200)}`);
});

test('C2 ★B 도 «자기» 확정을 세우면 통과한다 (막기만 하면 도구가 죽는다)', async () => {
  await call('sess-B', 'open_project', { projectId: 'proj_1' });
  const b = said(await call('sess-B', 'add_section', {}));
  assert.ok(!/PROJECT_NOT_CONFIRMED/.test(b), '★자기 확정은 서야 한다');
});

test('C3 ★헤더가 «없는» 호출자는 예전과 같다 (더 나빠지지 않는다)', async () => {
  /* 직접 curl 처럼 Mcp-Session-Id 를 안 보내는 호출자는 'anon' 한 칸을 공유한다.
     그건 예전 동작과 «같다» — 이 판이 그들을 더 나쁘게 만들지 않았음을 못박는다. */
  await call(null, 'open_project', { projectId: 'proj_1' });
  const anon = said(await call(null, 'add_section', {}));
  assert.ok(!/PROJECT_NOT_CONFIRMED/.test(anon), '★헤더 없는 호출자도 자기 확정으로는 통과해야 한다');
  // 그리고 anon 의 확정이 이름 있는 세션에게 새지 않는다
  const c = said(await call('sess-C', 'add_section', {}));
  assert.ok(/PROJECT_NOT_CONFIRMED/.test(c), '★anon 의 확정이 이름 있는 세션에 새면 안 된다');
});

test('C4 ★브리지가 «프로세스마다» 세션 id 를 보낸다 (안 보내면 전부 anon 으로 합쳐진다)', () => {
  const fs = require('fs'); const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'main', 'claude-pm', 'mcp-stdio-bridge.cjs'), 'utf8');
  assert.match(src, /const BRIDGE_SESSION_ID = require\('crypto'\)\.randomUUID\(\)/,
    '★프로세스마다 «다른» id 여야 한다 — 고정값이면 모든 브리지가 한 칸을 쓴다');
  assert.match(src, /'Mcp-Session-Id': BRIDGE_SESSION_ID/, '★실제로 «보내야» 한다');
  // 서버가 그걸 «읽는지»도 같이 본다(예전엔 CORS 목록에만 있고 읽는 코드가 0건이었다)
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'main', 'claude-pm', 'mcp-server.js'), 'utf8');
  assert.match(s, /req\.headers\['mcp-session-id'\]/, '★보내도 «안 읽으면» 그대로 한 칸이다');
});
