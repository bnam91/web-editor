// ux-squad U-onboarding driver (read + test-project-only interactions)
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const fs = require('fs'); const http = require('http');
const PROJ = 'proj_1781188552759';
function targets() { return new Promise((res, rej) => { http.get('http://localhost:9334/json', r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); }).on('error', rej); }); }
async function connect() {
  const list = await targets();
  const page = list.find(t => t.type==='page' && t.url.includes('.html'));
  if (!page) throw new Error('no page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256*1024*1024 });
  await new Promise((res,rej)=>{ws.on('open',res);ws.on('error',rej);});
  let id=0; const pending={};
  ws.on('message', m => { const msg=JSON.parse(m); if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; } });
  const send=(method,params={})=>{ const i=++id; return new Promise((res,rej)=>{ pending[i]=msg=>msg.error?rej(new Error(JSON.stringify(msg.error))):res(msg.result); ws.send(JSON.stringify({id:i,method,params})); }); };
  const evalJs = async e => { const r = await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0,400)); return r.result.value; };
  const shot = async p => { const r = await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync(p, Buffer.from(r.data,'base64')); };
  return { ws, send, evalJs, shot, url: page.url };
}
async function ensureProject() {
  let c = await connect();
  await c.send('Page.enable');
  if (!c.url.includes(PROJ)) {
    await c.send('Page.navigate', { url: 'file:///Users/a1/web-editor/index.html?project=' + PROJ });
    await new Promise(r=>setTimeout(r,3500));
    c.ws.close(); c = await connect();
    if (!c.url.includes(PROJ)) throw new Error('hijacked again: ' + c.url);
    await c.send('Page.enable');
  }
  return c;
}
(async () => {
  const c = await ensureProject();
  const persisted = await c.evalJs(`(() => {
    const txt = document.body.innerText;
    const layers = [...document.querySelectorAll('[class*="layer"]')].map(e=>(e.innerText||'').trim()).filter(Boolean)[0];
    return { hasSection01: txt.includes('Section 01'), layerText: (layers||'').slice(0,120) };
  })()`);
  console.log('persisted:', JSON.stringify(persisted));
  const ren = await c.evalJs(`(() => {
    const inp = [...document.querySelectorAll('input')].find(i => i.value === 'Untitled' && i.getBoundingClientRect().width > 100);
    if (!inp) return 'NAME INPUT NOT FOUND: ' + [...document.querySelectorAll('input')].slice(0,8).map(i=>i.value||i.placeholder).join('|');
    inp.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'ux-squad-test-0611');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.blur();
    return 'renamed';
  })()`);
  console.log('rename:', ren);
  await new Promise(r=>setTimeout(r,1500));
  const saveTxt = await c.evalJs(`[...document.querySelectorAll('[class*="save"],[id*="save"]')].map(e=>(e.innerText||'').trim()).filter(Boolean).slice(0,4)`);
  console.log('save indicator:', JSON.stringify(saveTxt));
  // tooltips / help affordances on floating toolbar (judgment evidence)
  const fp = await c.evalJs(`(() => {
    const btns = [...document.querySelectorAll('.fp-btn')];
    return btns.map(b => ({ title: b.title, text: (b.innerText||'').trim(), hasVisibleLabel: !!(b.innerText||'').trim() }));
  })()`);
  console.log('fp-buttons:', JSON.stringify(fp));
  await c.shot('onboarding-05-renamed.png');
  c.ws.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
