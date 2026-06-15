// capture projects.html then enter test project
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const http = require('http'); const fs = require('fs');
function targets() { return new Promise((res, rej) => { http.get('http://localhost:9334/json', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej); }); }
(async () => {
  const list = await targets();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
  await new Promise(r => ws.on('open', r));
  let id = 0; const pend = {};
  ws.on('message', m => { const x = JSON.parse(m); if (x.id && pend[x.id]) { pend[x.id](x); delete pend[x.id]; } });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend[i] = x => x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };

  console.log('url', await ev('location.href'));
  const r1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('layout-06-projects-page.png', Buffer.from(r1.data, 'base64'));

  const d = await ev(`(() => {
    const info = el => ({ t: el.tagName.toLowerCase(), id: el.id || undefined, c: (typeof el.className === 'string') ? el.className.split(' ').slice(0, 3).join('.') : undefined, x: (el.innerText || '').trim().slice(0, 60) || undefined, r: (b => [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)])(el.getBoundingClientRect()) });
    return JSON.stringify({ vw: innerWidth, vh: innerHeight, body: [...document.body.children].filter(e => e.getBoundingClientRect().width > 0).map(el => ({ ...info(el), k: [...el.children].slice(0, 12).map(info) })), buttons: [...document.querySelectorAll('button, a')].slice(0, 30).map(b => ({ x: (b.innerText || b.title || '').trim().slice(0, 30), c: (b.className || '').slice(0, 30), r: (q => [Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height)])(b.getBoundingClientRect()) })) }, null, 1);
  })()`);
  console.log(d.slice(0, 6000));
  ws.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
