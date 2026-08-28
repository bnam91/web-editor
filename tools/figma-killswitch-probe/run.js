#!/usr/bin/env node
/* Figma 킬스위치 프로브 실행기 — 격리 프로필 헤드리스 크롬 + CDP(모든 호출 타임아웃).
 * ⛔실앱 불필요. 남의 프로필·세션 무접촉. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const { mkTmpRoot } = require('../../tests/unit/_tmproot');
const CHROME = process.env.GOYA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.PROBE_PORT || 9356);
const profile = mkTmpRoot('goya-figmaprobe-');
let child;
const cleanup = () => { try { child && child.kill('SIGKILL'); } catch (_) {} };
process.on('exit', cleanup);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { cleanup(); process.exit(130); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  if (!fs.existsSync(CHROME)) { console.error('⛔크롬 없음:', CHROME); process.exit(2); }
  child = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1280,900',
    '--allow-file-access-from-files',
    'file://' + path.resolve(__dirname, 'probe.html')], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
          target = l.find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (_) {}
  }
  if (!target) { console.error('⛔CDP 가 안 떴다(15초)'); process.exit(2); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const send = (m, p) => new Promise((res, rej) => {
    const my = ++id; const to = setTimeout(() => rej(new Error('CDP 타임아웃 ' + m)), 15000);
    const on = (e) => { const d = JSON.parse(e.data); if (d.id !== my) return;
      clearTimeout(to); ws.removeEventListener('message', on); d.error ? rej(new Error(d.error.message)) : res(d.result); };
    ws.addEventListener('message', on); ws.send(JSON.stringify({ id: my, method: m, params: p })); });
  let R = null;
  for (let i = 0; i < 60 && !R; i++) { await sleep(250);
    const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__RESULT||null)', returnByValue: true });
    const v = r.result && r.result.value; if (v && v !== 'null') R = JSON.parse(v); }
  ws.close();
  if (!R) { console.error('⛔결과 없음 — probe.html 에서 예외가 났을 수 있다'); process.exit(2); }
  console.log('env:', JSON.stringify(R.env));
  if (R.problems.length) { console.log('\n✖ 문제 ' + R.problems.length + '건'); R.problems.forEach(p => console.log('  · ' + p)); }
  else console.log('\n✔ 문제 0건');
  process.exit(R.ok ? 0 : 1);
})().catch(e => { console.error('⛔', e.message); process.exit(2); });
