/* 최소 CDP 클라이언트 — 이 하네스 전용. 지디 공용 `cdp.js` 와 «같은 안전장치»를 지킨다:
 *   · 대상이 0개면 «첫 탭»으로 폴백하지 않는다(조용히 남의 창을 잡는 사고)
 *   · ★모든 대기에 상한이 있다. 상한 없는 대기는 «빨간 실패보다 나쁘다» — 로그로는
 *     「도는 중」과 구분이 안 돼서 검사가 한 시간 반을 조용히 태운다(2026-09-06 실사고).
 */
import http from 'node:http';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
let WebSocket = null;
for (const p of [
  `${process.env.HOME}/web-editor/node_modules/ws`,
  'ws',
]) {
  try { WebSocket = require_(p); break; } catch (_) {}
}
if (!WebSocket) throw new Error('ws 모듈을 못 찾음');

export function httpJson(port, path, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path, timeout: timeoutMs }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

/** 지정 포트에 «내 체크아웃의» 페이지가 뜰 때까지 기다린다. ⛔상한 필수. */
export async function waitForPage(port, { match, repoRoot, timeoutMs = 45000, everyMs = 400 }) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const list = await httpJson(port, '/json/list');
      const pages = list.filter((t) => t.type === 'page');
      last = pages.map((p) => p.url);
      const hit = pages.filter((p) => (!match || p.url.includes(match))
        && (!repoRoot || decodeURIComponent(p.url).includes(repoRoot)));
      if (hit.length === 1) return hit[0];
      if (hit.length > 1) throw new Error(`TARGET_AMBIGUOUS: ${hit.map((h) => h.url).join(' , ')}`);
    } catch (e) {
      if (String(e.message).startsWith('TARGET_')) throw e;
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`waitForPage TIMEOUT(${timeoutMs}ms) match=${match} seen=${JSON.stringify(last)}`);
}

export function connect(wsUrl, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    const guard = setTimeout(() => { try { ws.close(); } catch (_) {} reject(new Error('CDP connect timeout')); }, timeoutMs);
    let id = 0;
    const pending = new Map();
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch (_) { return; }
      if (m.id && pending.has(m.id)) {
        const { res, rej, timer } = pending.get(m.id);
        clearTimeout(timer); pending.delete(m.id);
        m.error ? rej(new Error(`${m.error.code} ${m.error.message}`)) : res(m.result);
      }
    });
    ws.on('error', (e) => { clearTimeout(guard); reject(e); });
    ws.on('open', () => {
      clearTimeout(guard);
      const send = (method, params = {}, ms = 15000) => new Promise((res, rej) => {
        const myId = ++id;
        const timer = setTimeout(() => { pending.delete(myId); rej(new Error(`CDP timeout: ${method}`)); }, ms);
        pending.set(myId, { res, rej, timer });
        ws.send(JSON.stringify({ id: myId, method, params }));
      });
      resolve({
        send,
        /** 표현식 평가. `returnByValue` + `awaitPromise`. */
        async evalx(expr, ms = 15000) {
          const r = await send('Runtime.evaluate', {
            expression: expr, returnByValue: true, awaitPromise: true,
          }, ms);
          if (r.exceptionDetails) throw new Error('EVAL_THROW: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
          return r.result?.value;
        },
        async shot(file, ms = 20000) {
          const r = await send('Page.captureScreenshot', { format: 'png' }, ms);
          const fsmod = await import('node:fs');
          fsmod.writeFileSync(file, Buffer.from(r.data, 'base64'));
          return file;
        },
        close() { try { ws.close(); } catch (_) {} },
      });
    });
  });
}
