/* sec-figma-relay-origin — SEC-FIGMA-UPLOAD-FILE-READ-01 · 감사 ④ WS ㉮ (현빈 261113)
 *   중계 figma-plugin/socket.js 는 인증이 없다 → 웹페이지·file:// 페이지가 ws://localhost:3055 에 붙어 채널을 엿듣던 길을
 *   업그레이드 때 Origin 허용목록(헤더 없음 · 'null')으로 막는다(figma-plugin/relay-origin.js).
 *   O0~O2 [판정·배선] 어디서나 «있는 칸».
 *   W1~W5 [진짜 WS] bun 이 있는 곳에서만 «만든다»(skip 아님 · 없는 칸 · win-portability ③-3):
 *     진짜 socket.js 를 빈 포트(FIGMA_RELAY_PORT=0)로 띄워 ws 클라이언트로 붙는다 — 3055(사용자 중계)는 안 건드린다.
 *     W1 헤더 글자가 'file://…' 인 Origin 거절 · W2 https://attacker.example 거절 · W3 http://localhost:<포트> 페이지 거절 (각 대소문자·끝 슬래시 꼴 포함)
 *       ⚠️W1 은 «헤더 글자» 를 잰다 — Chrome 브라우저 file:// 페이지 = 'null'(수지맥) · 고디터 렌더러(Electron) = 'file://'(인텔 r0913e) → ㉮ 가 막는다 · 'null' 로 바뀌면 e2e sec-relay-origin-electron E2 빨강 = ㉯ 재검토 신호.
 *     W4 Origin 없음 허용 + 채널 가입 · W5 Origin 'null' 허용 + 채널 가입
 *     WP [양성대조] 같은 socket.js 에서 검사 줄만 뺀 사본을 띄우면 W1~W3 의 Origin 이 «붙는다» — 검사가 막고 있다는 증거. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const WebSocket = require('ws');
const { mkTmpRoot } = require('./_tmproot');
const { isAllowedRelayOrigin } = require('../../figma-plugin/relay-origin');

const ROOT = path.join(__dirname, '..', '..');
const SOCKET = path.join(ROOT, 'figma-plugin', 'socket.js');
const GUARD_RE = /\n    if \(!isAllowedRelayOrigin\(req\.headers\.get\("origin"\)\)\) \{\n[\s\S]*?\n    \}\n/;

const BAD = {
  W1: ['file://', 'FILE://', 'file:///', 'file:///Users/x/index.html'],
  W2: ['https://attacker.example', 'HTTPS://ATTACKER.EXAMPLE', 'https://attacker.example/', 'http://attacker.example'],
  W3: ['http://localhost:9441', 'http://LOCALHOST:9441/', 'http://127.0.0.1:9441', 'https://localhost:9441'],
};

test('O0 [판정] 헤더 없음·null 은 허용, 그 밖은 대소문자·끝 슬래시·공백·빈 문자열과 무관하게 거절', () => {
  for (const o of [undefined, null, 'null', 'NULL', ' null ']) assert.equal(isAllowedRelayOrigin(o), true, String(o));
  for (const o of [...Object.values(BAD).flat(), '', 'null/', 'nullx', 'https://www.figma.com', 'chrome-extension://abc'])
    assert.equal(isAllowedRelayOrigin(o), false, `★허용됨: ${JSON.stringify(o)}`);
});

test('O1 [배선] socket.js 가 업그레이드 «전»에 Origin 을 검사하고 403 으로 끊는다', () => {
  const src = fs.readFileSync(SOCKET, 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /require\("\.\/relay-origin\.js"\)/);
  const g = src.search(GUARD_RE), u = src.indexOf('server2.upgrade(');
  assert.ok(g > 0 && u > g, `guard ${g} · upgrade ${u}`);
  assert.match(src.match(GUARD_RE)[0], /status: 403/);
});

test('O2 [배선] 포트를 안 주면 3055 그대로 (사용자 중계 무변)', () => {
  assert.match(fs.readFileSync(SOCKET, 'utf8'), /process\.env\.FIGMA_RELAY_PORT \? Number\(process\.env\.FIGMA_RELAY_PORT\) : 3055/);
});

/* ── 진짜 WS ── */
function findBun() {
  const exe = process.platform === 'win32' ? 'bun.exe' : 'bun';
  const c = [path.join(os.homedir(), '.bun', 'bin', exe), '/opt/homebrew/bin/bun', '/usr/local/bin/bun'].find((p) => fs.existsSync(p));
  if (c) return c;
  try { return spawnSync(exe, ['--version']).status === 0 ? exe : null; } catch (_) { return null; }
}
const BUN = findBun();
const LIMIT = { timeout: 20000 };   // 상한은 러너가 쥔다(고정 잠 아님 · unit-fixed-sleep-census S1)

function startRelay(script) {
  return new Promise((resolve, reject) => {
    const p = spawn(BUN, [script], { env: { ...process.env, FIGMA_RELAY_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    // 고정 대기 없음 — 서버가 찍는 «listening» 줄 또는 프로세스 종료를 기다린다 · 상한은 node:test 의 timeout 옵션(LIMIT)
    const on = (b) => {
      out += b;
      const m = out.match(/running on port (\d+)/);
      if (m) resolve({ port: Number(m[1]), stop: () => p.kill() });
    };
    p.stdout.on('data', on); p.stderr.on('data', on);
    p.on('error', reject);
    p.on('exit', (c) => reject(new Error(`중계 종료 ${c}: ${out}`)));
  });
}

/** 붙어 보고: 거절이면 {ok:false,status} · 붙으면 채널 가입까지 해 {ok:true,joined}. */
function tryJoin(port, origin) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, origin === undefined ? {} : { origin });
    // 고정 대기 없음 — open/message/unexpected-response/error/close 중 먼저 오는 이벤트로 끝난다
    const done = (r) => { try { ws.terminate(); } catch (_) {} resolve(r); };
    ws.on('unexpected-response', (_q, res) => done({ ok: false, status: res.statusCode }));
    ws.on('error', (e) => done({ ok: false, status: e.message }));
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', channel: 'sec-ch', id: 'j1' })));
    ws.on('message', (m) => { if (String(m).includes('Joined channel: sec-ch')) done({ ok: true, joined: true }); });
    ws.on('close', (code) => done({ ok: false, status: `closed ${code}` }));   // 먼저 끝난 쪽이 이긴다(뒤 resolve 는 무시)
  });
}

if (BUN) {
  let relay;
  test.before(async () => { relay = await startRelay(SOCKET); }, LIMIT);
  test.after(() => relay && relay.stop());

  for (const k of ['W1', 'W2', 'W3']) {
    test(`${k} [공격] Origin ${BAD[k][0]} 꼴(대소문자·끝 슬래시 포함) → 업그레이드 403 거절`, LIMIT, async () => {
      for (const o of BAD[k]) {
        const r = await tryJoin(relay.port, o);
        assert.deepEqual(r, { ok: false, status: 403 }, `★${o} 가 붙었다/다르게 끊겼다: ${JSON.stringify(r)}`);
      }
    });
  }

  test('W4 [정상] Origin 없음(노드 변환기·MCP) → 붙고 채널 가입', LIMIT, async () => {
    assert.deepEqual(await tryJoin(relay.port, undefined), { ok: true, joined: true });
  });

  test("W5 [정상] Origin 'null'(Figma 플러그인 UI) → 붙고 채널 가입", LIMIT, async () => {
    assert.deepEqual(await tryJoin(relay.port, 'null'), { ok: true, joined: true });
  });

  test('WP [양성대조] 검사 줄만 뺀 사본 중계엔 W1~W3 Origin 이 붙는다', LIMIT, async () => {
    const dir = mkTmpRoot('sec-relay-');
    const src = fs.readFileSync(SOCKET, 'utf8').replace(/\r\n/g, '\n');
    const cut = src.replace(GUARD_RE, '\n');
    assert.notEqual(cut, src, '[전제] 검사 줄을 못 찾았다');
    fs.writeFileSync(path.join(dir, 'socket.js'), cut);
    fs.copyFileSync(path.join(ROOT, 'figma-plugin', 'relay-origin.js'), path.join(dir, 'relay-origin.js'));
    const bare = await startRelay(path.join(dir, 'socket.js'));
    try {
      for (const k of ['W1', 'W2', 'W3']) {
        const r = await tryJoin(bare.port, BAD[k][0]);
        assert.deepEqual(r, { ok: true, joined: true }, `${k} 검사 없이도 막혔다 — 이 칸이 재는 게 검사가 아니다: ${JSON.stringify(r)}`);
      }
    } finally { bare.stop(); }
  });
}
