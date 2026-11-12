/* sec-relay-origin-electron — 감사 ④ WS ㉮ «구멍 재기» (지디 261113 · 수지맥 실측: Chrome 은 file:// 페이지 WS Origin 을 "null" 로 보낸다)
 *   ★물음: 고디터 렌더러(file:// 로 띄운 Electron 창)가 new WebSocket 때 보내는 Origin 이 무엇인가.
 *     "null" 이면 ㉮(Origin 없음·'null' 만 허용)는 Figma 플러그인 UI 와 렌더러를 «구별 못 한다» ⇒ 악성 프로젝트 렌더러가 중계에 붙는다.
 *   E1 [측정] 렌더러 → 기록용 WS 서버(이 시험 프로세스 · 빈 포트) — 받은 Origin 헤더를 그대로 찍는다(ORIGIN=…).
 *        단언 = 페이지 CSP 가 localhost 를 열어 두면 «업그레이드 1건», ㉯ 로 닫았으면 «0건»(그때 Origin 은 못 잰다 — ㉯ 전 판에서 잰다).
 *   E2 [재현 · ㉮ 구멍] bun 이 있으면 «진짜 중계»(figma-plugin/socket.js · 빈 포트)를 띄워 렌더러가 채널 가입까지 되나.
 *        단언 = «가입 못 한다». ★E1 이 "null" 이면 지금(㉮ 만) 빨강이 «기대» — ㉯(CSP) 가 들어가면 초록이어야 한다.
 *   E3 [㉯ 안 재기] 같은 창에 «더 좁은» CSP 를 meta 로 덧댄다(덧댄 정책은 교집합 = 좁히기만 한다):
 *        E3a connect-src 에서 ws://localhost:* «만» 뺀 꼴 — http://localhost:* 가 남아도 ws 가 막히나(CSP3: http 소스가 ws 도 덮는가)
 *        E3b ws·http localhost 둘 다 뺀 꼴 — 막혀야 한다(양성대조: 막힘을 재는 자가 산다)
 *        ⇒ 결과만 찍는다(E3a 는 측정 · E3b 는 단언).
 *   ⛔앱 = 격리 프로필 + CDP 9440~9449(E2E_RELAYORIGIN_PORT · 기본 9440) · MCP 띠 9610~9629(E2E_MCP_PORT · 기본 9618) · 현빈 앱·3055 무접촉
 *   ⛔외부 전송 0 — 모든 접속은 이 맥 localhost 의 빈 포트.
 *   실행: E2E_RELAYORIGIN_PORT=9440 E2E_MCP_PORT=9618 npx playwright test tests/e2e/sec-relay-origin-electron.spec.js --retries=0 --workers=1
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { launchIsolated } = require('./helpers.js');
const { mkTmpRoot } = require('../unit/_tmproot.js');

const ROOT = path.join(__dirname, '..', '..');
const PORT = process.env.E2E_RELAYORIGIN_PORT || '9440';
const MCP = process.env.E2E_MCP_PORT || '9618';
if (!(Number(PORT) >= 9440 && Number(PORT) <= 9449)) throw new Error(`CDP 포트는 9440~9449 (받음 ${PORT})`);

let app, page;
test.beforeAll(async () => {
  app = await launchIsolated({ port: PORT, profile: path.join(mkTmpRoot('sec-relay-e2e-'), 'ud'), mcpPort: MCP, cwd: ROOT });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});
test.afterAll(async () => { if (app) await app.close().catch(() => {}); });

/** 렌더러에서 ws 를 열어 본다 — open / error / close 중 먼저 오는 것(+ join 하면 Joined 메시지). */
const rendererTry = (url, join) => page.evaluate(([url, join]) => new Promise((r) => {
  let ws;
  try { ws = new WebSocket(url); } catch (e) { r('throw:' + e.name); return; }
  ws.onopen = () => { if (join) ws.send(JSON.stringify({ type: 'join', channel: 'sec-e2e', id: 'j' })); else { r('open'); ws.close(); } };
  ws.onmessage = (m) => { if (String(m.data).includes('Joined channel: sec-e2e')) { r('joined'); ws.close(); } };
  ws.onerror = () => r('error');
  ws.onclose = (e) => r('closed:' + e.code);
}), [url, join]);

/** 기록용 WS 서버 — 업그레이드 요청의 Origin 만 적고 101 로 받는다(빈 포트). */
function recorder() {
  const seen = [];
  const srv = http.createServer((_q, s) => s.end());
  srv.on('upgrade', (req, sock) => {
    seen.push(Object.prototype.hasOwnProperty.call(req.headers, 'origin') ? req.headers.origin : '<없음>');
    const key = req.headers['sec-websocket-key'];
    const acc = require('crypto').createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  });
  return new Promise((res) => srv.listen(0, 'localhost', () => res({ port: srv.address().port, seen, close: () => srv.close() })));
}

test('E1 [측정] 렌더러(file:// Electron) 가 WS 업그레이드에 싣는 Origin', async () => {
  const rec = await recorder();
  try {
    const { url, csp } = await page.evaluate(() => ({ url: location.href,
      csp: [...document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')].map((m) => m.content).join(' | ') }));
    const opensLocal = /connect-src[^;|]*\b(?:ws|http):\/\/localhost:\*/.test(csp);   // ㉯ 전: 열려 있음 · ㉯ 후: 닫힘
    const r = await rendererTry(`ws://localhost:${rec.port}`, false);
    console.log(`  E1: PAGE=${url.slice(0, 60)} · CSP localhost ${opensLocal ? '열림' : '닫힘(㉯)'} · 결과=${r} · ORIGIN=${JSON.stringify(rec.seen)}`);
    expect(rec.seen.length, opensLocal ? `업그레이드가 기록 서버에 안 왔다(결과 ${r}) — 주소 문제부터 본다`
                                       : `★CSP 가 localhost 를 닫았는데 업그레이드가 왔다(결과 ${r})`).toBe(opensLocal ? 1 : 0);
  } finally { rec.close(); }
});

function findBun() {
  const exe = process.platform === 'win32' ? 'bun.exe' : 'bun';
  const c = [path.join(os.homedir(), '.bun', 'bin', exe), '/opt/homebrew/bin/bun', '/usr/local/bin/bun'].find((p) => fs.existsSync(p));
  if (c) return c;
  try { return spawnSync(exe, ['--version']).status === 0 ? exe : null; } catch (_) { return null; }
}
const BUN = findBun();
if (BUN) test('E2 [재현 · ㉮ 구멍] 렌더러는 진짜 중계 채널에 가입하지 못한다', async () => {
  const p = spawn(BUN, [path.join(ROOT, 'figma-plugin', 'socket.js')], { env: { ...process.env, FIGMA_RELAY_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((res, rej) => {
      let out = '';
      const on = (b) => { out += b; const m = out.match(/running on port (\d+)/); if (m) res(Number(m[1])); };
      p.stdout.on('data', on); p.stderr.on('data', on);
      p.on('error', rej); p.on('exit', (c) => rej(new Error(`중계 종료 ${c}: ${out}`)));
    });
    const r = await rendererTry(`ws://localhost:${port}`, true);
    console.log(`  E2: 렌더러 → 진짜 중계 = ${r}`);
    expect(r, '★렌더러가 중계 채널에 가입했다 — ㉮ 만으로는 file:// 렌더러를 못 막는다(Origin "null")').not.toBe('joined');
  } finally { p.kill(); }
});

test('E3 [㉯ 안 재기] connect-src 를 좁힌 meta CSP 를 덧대면 ws://localhost 가 막히나', async () => {
  const rec = await recorder();
  try {
    const add = (csp) => page.evaluate((csp) => { const m = document.createElement('meta'); m.httpEquiv = 'Content-Security-Policy'; m.content = csp; document.head.appendChild(m); }, csp);
    await add("connect-src 'self' https: http://localhost:*");                // E3a — ws://localhost:* 만 뺀 꼴
    const a = await rendererTry(`ws://localhost:${rec.port}`, false);
    const seenA = rec.seen.length;
    await add("connect-src 'self' https:");                                    // E3b — ws·http localhost 둘 다 뺀 꼴(교집합이라 더 좁아진다)
    const b = await rendererTry(`ws://localhost:${rec.port}`, false);
    console.log(`  E3a(ws 만 뺌): ${a} · 업그레이드 ${seenA}건 — ${seenA ? '★http://localhost:* 가 ws 도 덮는다 → ws 만 빼면 못 막는다' : 'ws 만 빼도 막힌다'}`);
    console.log(`  E3b(둘 다 뺌): ${b} · 업그레이드 누계 ${rec.seen.length}건`);
    expect(rec.seen.length, '★E3b 꼴인데도 업그레이드가 왔다 — CSP 로는 못 막는다').toBe(seenA);
  } finally { rec.close(); }
});
