// Minimal CDP driver for testing on an isolated port (no chrome-devtools MCP registered for it).
// Usage: node tools/cdp-drive.mjs <port> eval "<js expression, can be async IIFE>"
//        node tools/cdp-drive.mjs <port> screenshot <outfile.png>
import WebSocket from '/Users/a1/web-editor/node_modules/ws/index.js';

const port = process.argv[2];
const cmd = process.argv[3];
const arg = process.argv[4];

async function main() {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await res.json();
  const target = targets.find(t => t.type === 'page') || targets[0];
  if (!target) throw new Error('no target');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

  let id = 0;
  const pending = new Map();
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  function send(method, params) {
    return new Promise((resolve) => {
      const myId = ++id;
      pending.set(myId, resolve);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  }

  await send('Runtime.enable', {});
  await send('Page.enable', {});

  if (cmd === 'eval') {
    const result = await send('Runtime.evaluate', {
      expression: arg,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(JSON.stringify(result.result, null, 2));
  } else if (cmd === 'screenshot') {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    const fs = await import('fs');
    fs.writeFileSync(arg, Buffer.from(result.result.data, 'base64'));
    console.log('saved to', arg);
  }
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
