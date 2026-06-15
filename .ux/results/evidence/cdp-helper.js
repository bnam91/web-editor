// ux-squad U-layout CDP helper (read-mostly; only test-project interactions)
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const fs = require('fs');
const http = require('http');

function getWsUrl() {
  return new Promise((res, rej) => {
    http.get('http://localhost:9334/json', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        const list = JSON.parse(d);
        const page = list.find(t => t.type === 'page' && t.url.includes('index.html'));
        if (!page) return rej(new Error('editor page not found'));
        res(page.webSocketDebuggerUrl);
      });
    }).on('error', rej);
  });
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = {}; }
  static async connect() {
    const url = await getWsUrl();
    const ws = new WebSocket(url, { maxPayload: 256 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
    const c = new CDP(ws);
    ws.on('message', m => {
      const msg = JSON.parse(m);
      if (msg.id && c.pending[msg.id]) { c.pending[msg.id](msg); delete c.pending[msg.id]; }
    });
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending[id] = msg => msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  }
  async shot(path) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
    return path;
  }
  close() { this.ws.close(); }
}

module.exports = { CDP };
