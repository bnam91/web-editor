#!/usr/bin/env node
/* 테이블 블록 UX 3건 검증용 CDP 소켓 (fix/table-block-ux).
 * ⚠️앱을 «띄우지» 않는다 — 이미 떠 있는 GODITOR 렌더러에 붙기만 한다.
 *   PORT=9334 기본. 대상이 0개/2개↑면 조용히 고르지 않고 멈춘다(오입력 방지).
 *   모든 CDP 호출에 15초 타임아웃 — 모달 하나에 매달려 무한대기하지 않게. */
'use strict';
const path = require('path');
let WebSocketImpl = global.WebSocket;
if (!WebSocketImpl) {
  for (const p of [path.join(process.env.HOME || '', 'web-editor/node_modules/ws'),
                   path.join(__dirname, '../../node_modules/ws'), 'ws']) {
    try { WebSocketImpl = require(p); break; } catch (_) {}
  }
}
const PORT  = Number(process.env.PORT || 9334);
const MATCH = process.env.MATCH || 'index.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const pages = list.filter(t => t.type === 'page' && t.webSocketDebuggerUrl
                            && (t.url.includes(MATCH) || (t.title || '').includes(MATCH)));
  if (pages.length === 0) { console.error(`⛔TARGET_MISMATCH: port=${PORT} match="${MATCH}" 인 page 0개`); process.exit(2); }
  if (pages.length > 1)  { console.error(`⛔TARGET_AMBIGUOUS: ${pages.length}개 — MATCH 를 좁혀라\n` +
                                          pages.map(p => '  · ' + p.url).join('\n')); process.exit(2); }
  const ws = new WebSocketImpl(pages[0].webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const send = (m, p = {}) => new Promise((res, rej) => {
    const my = ++id;
    const to = setTimeout(() => rej(new Error('CDP 타임아웃 ' + m)), 15000);
    const on = (e) => { const d = JSON.parse(e.data.toString()); if (d.id !== my) return;
      clearTimeout(to); ws.removeEventListener('message', on);
      d.error ? rej(new Error(d.error.message)) : res(d.result); };
    ws.addEventListener('message', on);
    ws.send(JSON.stringify({ id: my, method: m, params: p }));
  });
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', {
      expression: `(async () => { ${expr} })()`, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result?.value;
  };
  // ★진짜 입력 주입 — 합성 이벤트가 못 잡는 버그를 잡기 위해 Input 도메인을 쓴다.
  const dblclick = async (x, y) => {
    for (const cc of [1, 2]) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed',  x, y, button: 'left', clickCount: cc, buttons: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: cc, buttons: 0 });
    }
    await sleep(150);
  };
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed',  x, y, button: 'left', clickCount: 1, buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
    await sleep(150);
  };
  // ★진짜 키 입력 — keyDown(text 포함) → char → keyUp 3발. insertText 는 선택영역 교체
  //   의미가 브라우저판마다 달라, 「전체선택 상태에서 한 글자」 검증엔 키 이벤트가 정본이다.
  const typeKey = async (ch) => {
    const base = { key: ch, text: ch, unmodifiedText: ch, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0) };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
    await send('Input.dispatchKeyEvent', { type: 'char',    ...base });
    await send('Input.dispatchKeyEvent', { type: 'keyUp',   ...base });
    await sleep(180);
  };
  const type = async (text) => { await send('Input.insertText', { text }); await sleep(150); };
  return { send, evaluate, dblclick, click, type, typeKey, close: () => ws.close() };
}
module.exports = { connect, sleep, PORT };
