// UXS-flow CDP driver — eval | shot
import { createRequire } from 'module';
const require = createRequire('/Users/a1/web-editor/index.html');
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
import fs from 'fs';

const PAGE_RE = /Goya Web Design Editor|index\.html/;
const list = await (await fetch('http://localhost:9334/json')).json();
const page = list.find(p => p.type === 'page' && p.url.includes('web-editor') && !p.url.startsWith('devtools'));
if (!page) { console.error('NO_PAGE'); process.exit(2); }

const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
let id = 0; const pending = new Map();
ws.on('message', d => {
  const m = JSON.parse(d);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise(res => {
  const i = ++id; pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
await new Promise(r => ws.on('open', r));

const cmd = process.argv[2];
if (cmd === 'eval') {
  const expr = process.argv[3] === '-' ? fs.readFileSync(0, 'utf8') : process.argv[3];
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) console.log('EXC: ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  else console.log(JSON.stringify(r.result?.result?.value));
} else if (cmd === 'shot') {
  const out = process.argv[3];
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
  console.log('SAVED ' + out + ' ' + fs.statSync(out).size);
} else if (cmd === 'click') {
  // physical click at viewport coords
  const [x, y] = [Number(process.argv[3]), Number(process.argv[4])];
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  console.log('CLICKED ' + x + ',' + y);
}
ws.close();
