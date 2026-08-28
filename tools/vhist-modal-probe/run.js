#!/usr/bin/env node
/* 버전 기록 모달 «실브라우저» 프로브 실행기.
 * 사용: node tools/vhist-modal-probe/run.js
 *
 * ★왜 실행기가 따로 필요한가: probe.html 은 있었지만 «자동으로 돌리는 것»이 없어서, 실제로는
 *   내가 손으로 열어볼 때만 돌았다. 「눌러봤다」와 「자동으로 다시 잰다」는 다르다 —
 *   전자는 다음 사람이 회귀를 못 본다(C3 적대검수 지적).
 * ★여기서만 잴 수 있는 것: CSS 실적용(display:flex·gap·색), 실제 가로폭/글자 잘림,
 *   disabled 가 진짜 클릭을 막는지, 진짜 DOMParser 로 도는 changeDiff.
 *   ⇒ CI 의 가짜 DOM 은 이 넷을 구조적으로 못 잰다.
 * ⛔격리 프로필로 «전용» 크롬을 띄운다 — 남의 세션·프로필을 빌리지 않는다.
 */
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Chromium.app/Contents/MacOS/Chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('⛔크롬을 못 찾았다'); process.exit(2); }

const PORT = Number(process.env.PROBE_PORT || 9351);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'goya-probe-'));
const url = 'file://' + path.resolve(__dirname, 'probe.html');
let child;
function cleanup() {
  try { child && child.kill('SIGKILL'); } catch (_) {}
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
}
process.on('exit', cleanup);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { cleanup(); process.exit(130); });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  child = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=1280,900', '--allow-file-access-from-files', url,
  ], { stdio: 'ignore', detached: false });

  // CDP 엔드포인트가 뜰 때까지 — ★타임아웃을 «반드시» 둔다(cdp.js 무한대기 교훈)
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch (_) {}
  }
  if (!target) { console.error('⛔CDP 가 안 떴다(15초)'); process.exit(2); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const send = (method, params) => new Promise((res, rej) => {
    const myId = ++id;
    const to = setTimeout(() => rej(new Error(`CDP 타임아웃: ${method}`)), 15000);
    const on = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== myId) return;
      clearTimeout(to); ws.removeEventListener('message', on);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    };
    ws.addEventListener('message', on);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });

  // probe.html 의 IIFE 가 __RESULT 를 채울 때까지 기다린다
  let result = null;
  for (let i = 0; i < 60 && !result; i++) {
    await sleep(250);
    const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__RESULT || null)', returnByValue: true });
    const v = r.result && r.result.value;
    if (v && v !== 'null') result = JSON.parse(v);
  }
  ws.close();
  if (!result) { console.error('⛔프로브가 결과를 안 냈다 — probe.html 에서 예외가 났을 수 있다'); process.exit(2); }

  console.log('── 환경 실측 ──');
  for (const [k, v] of Object.entries(result.env)) {
    console.log(`  ${k.padEnd(24)} ${typeof v === 'object' ? JSON.stringify(v).slice(0, 120) : v}`);
  }
  if (result.problems.length) {
    console.log('\n⛔문제 ' + result.problems.length + '건');
    result.problems.forEach(p => console.log('  · ' + p));
  } else {
    console.log('\n✅ 문제 0건');
  }
  process.exit(result.ok ? 0 : 1);
})().catch(e => { console.error('⛔', e.message); process.exit(2); });
