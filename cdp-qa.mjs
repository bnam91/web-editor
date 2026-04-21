import WebSocket from 'ws';

const targetTitle = process.argv[2] || 'Goya Web Design Editor';
const script = process.argv[3] || 'return 1+1';

const r = await fetch('http://localhost:9335/json');
const pages = await r.json();
const target = pages.find(p => p.type === 'page' && (targetTitle === '' || p.title.includes(targetTitle) || p.url.includes(targetTitle))) || pages.find(p => p.type === 'page');
if (!target) { console.error('target not found'); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

let id = 0;
const pending = new Map();
ws.on('message', (msg) => {
  const d = JSON.parse(msg.toString());
  if (d.id && pending.has(d.id)) {
    const { resolve, reject } = pending.get(d.id);
    pending.delete(d.id);
    d.error ? reject(d.error) : resolve(d.result);
  }
});
const send = (method, params={}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

try {
  if (process.env.NAV) {
    await send('Page.navigate', { url: process.env.NAV });
    await new Promise(r => setTimeout(r, 2500));
  }
  if (process.env.SHOT) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    (await import('fs')).writeFileSync(process.env.SHOT, Buffer.from(data, 'base64'));
    console.error('shot saved:', process.env.SHOT);
  }
  const result = await send('Runtime.evaluate', {
    expression: `(async () => { ${script} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    console.error('ERROR:', result.exceptionDetails.text);
    if (result.exceptionDetails.exception?.description) console.error(result.exceptionDetails.exception.description);
    process.exit(1);
  }
  console.log(JSON.stringify(result.result?.value, null, 2));
} finally {
  ws.close();
}
