// capture projects.html (no navigation)
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const http = require('http'); const fs = require('fs');
http.get('http://localhost:9334/json', res => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => {
    const page = JSON.parse(d).find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
    ws.on('open', () => {
      let id = 0; const pend = {};
      ws.on('message', m => { const x = JSON.parse(m); if (x.id && pend[x.id]) { pend[x.id](x); delete pend[x.id]; } });
      const send = (me, pa = {}) => new Promise((rs, rj) => { const i = ++id; pend[i] = x => x.error ? rj(new Error(JSON.stringify(x.error))) : rs(x.result); ws.send(JSON.stringify({ id: i, method: me, params: pa })); });
      (async () => {
        const u = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
        console.log('url', u.result.value);
        if (!u.result.value.includes('projects.html')) { console.log('moved away, skip'); ws.close(); return; }
        const r = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(__dirname + '/layout-06-projects-page.png', Buffer.from(r.data, 'base64'));
        const expr = `(() => {
          const info = el => ({ t: el.tagName.toLowerCase(), id: el.id || undefined, c: ((el.className || '') + '').split(' ').slice(0, 3).join('.'), x: (el.innerText || '').trim().slice(0, 50) || undefined, r: (b => [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)])(el.getBoundingClientRect()) });
          return JSON.stringify({ vw: innerWidth, body: [...document.body.children].filter(e => e.getBoundingClientRect().width > 0).map(el => ({ ...info(el), k: [...el.children].slice(0, 14).map(info) })) });
        })()`;
        const st = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        console.log(st.result.value.slice(0, 5000));
        ws.close();
      })().catch(e => { console.error('ERR', e.message); ws.close(); });
    });
  });
});
