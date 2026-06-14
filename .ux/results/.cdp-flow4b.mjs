// Flow4 Path B: inline export with confirm() auto-accept
import { createRequire } from 'module';
const require = createRequire('/Users/a1/web-editor/index.html');
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');

const list = await (await fetch('http://localhost:9334/json')).json();
const page = list.find(p => p.type === 'page' && p.url.includes('web-editor') && !p.url.startsWith('devtools'));
const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
let id = 0; const pending = new Map(); const events = [];
ws.on('message', d => {
  const m = JSON.parse(d);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method) {
    events.push(m.method);
    if (m.method === 'Page.javascriptDialogOpening') {
      console.log('DIALOG: ' + JSON.stringify(m.params.message).slice(0, 120) + ' type=' + m.params.type);
      ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
    }
  }
});
const send = (method, params = {}) => new Promise(res => {
  const i = ++id; pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
await new Promise(r => ws.on('open', r));
await send('Page.enable');

// step 1: select page (click empty canvas-area) and read export controls
const r1 = await send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: `
(async () => {
  if(!location.href.includes('1775644888754')) return 'WRONG_PROJECT';
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await new Promise(s=>setTimeout(s,300));
  const btn = document.getElementById('page-export-all-btn');
  const vis = el => el && el.offsetParent !== null;
  const fmt = document.getElementById('page-export-format');
  return JSON.stringify({btnVisible: vis(btn), fmt: fmt? fmt.value:null, w: document.getElementById('page-export-width')?.value});
})()` });
console.log('STEP1: ' + JSON.stringify(r1.result?.result?.value));

// step 2: click export (deferred so evaluate returns before confirm blocks)
await send('Runtime.evaluate', { expression: `setTimeout(()=>document.getElementById('page-export-all-btn').click(), 50); 'clicked'` });
// poll button label + toast for up to 20s
for (let i = 0; i < 40; i++) {
  await new Promise(s => setTimeout(s, 500));
  const r = await send('Runtime.evaluate', { returnByValue: true, expression: `
    JSON.stringify({label: document.getElementById('page-export-all-btn')?.textContent.trim(),
      toast: (()=>{const t=document.getElementById('editor-toast');return t&&t.classList.contains('show')? t.textContent.slice(0,80):null;})()})` });
  const v = JSON.parse(r.result?.result?.value || '{}');
  if (i % 4 === 0 || v.toast) console.log('POLL ' + (i * 0.5) + 's: ' + JSON.stringify(v));
  if (v.toast) break;
}
ws.close();
