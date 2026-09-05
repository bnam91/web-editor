/* 앱 «안»의 게이트를 실측한다 — E1(음성 표본) · E3(비용) · E4(검산용 PNG 저장).
 * 사용: node inapp-measure.js <port> <projectId> <secCount> <width> <outDir>
 * ⛔다운로드는 «안» 한다(returnDataUrl 경로) — 현빈 Downloads 를 더럽히지 않는다.
 *   대신 export/truth 를 «앱이 만든 그대로» PNG 로 저장해 pixdiff.py 가 같은 그림을 보게 한다.
 */
const fs = require('fs');
const path = require('path');
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const [port, pid, nStr, wStr, outDir] = process.argv.slice(2);
const N = parseInt(nStr, 10), W = parseInt(wStr, 10);
fs.mkdirSync(outDir, { recursive: true });

function conn() {
  return fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()).then(pages => {
    const page = pages.find(p => p.type === 'page' && !p.url.includes('devtools'));
    return new Promise(res => {
      const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 512*1024*1024 });
      let mid = 0; const pending = {};
      ws.on('message', d => { const m = JSON.parse(d); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } });
      ws.on('open', () => res({
        ws,
        ev: (expr, ms = 180000) => new Promise((ok, no) => {
          const id = ++mid; pending[id] = m => ok(m);
          ws.send(JSON.stringify({ id, method: 'Runtime.evaluate',
            params: { expression: expr, awaitPromise: true, returnByValue: true } }));
          setTimeout(() => no(new Error('eval timeout')), ms);
        }),
      }));
    });
  });
}
const val = r => { if (r?.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,400)); return r?.result?.result?.value; };

(async () => {
  const { ws, ev } = await conn();
  await ev(`(async()=>{ await window.electronAPI.navigateToProjects(); return 1; })()`);
  await new Promise(r => setTimeout(r, 3000));
  await ev(`(()=>{const c=[...document.querySelectorAll(".project-card")].find(e=>e.dataset.id===${JSON.stringify(pid)});if(!c)return "no";c.click();return "ok"})()`);
  // ★고정 sleep 이 아니라 «섹션이 생길 때까지» 폴링 — 80MB 급은 7초 안에 안 열린다.
  let waited = 0, cnt = 0;
  while (waited < 180) {
    await new Promise(r => setTimeout(r, 2000)); waited += 2;
    cnt = val(await ev(`(()=>document.querySelectorAll(".section-block").length)()`)) || 0;
    if (cnt > 0) { await new Promise(r => setTimeout(r, 3000)); break; }
  }
  if (!cnt) { console.error('OPEN_FAIL', pid); process.exit(2); }
  const ids = val(await ev(`(()=>JSON.stringify([...document.querySelectorAll(".section-block:not([data-ghost])")].slice(0,${N}).map(e=>e.id)))()`));
  const list = JSON.parse(ids);
  for (const sid of list) {
    const EXPR = `(async()=>{
      const G = window.__exportGate, sec = document.getElementById(${JSON.stringify(sid)});
      if (!sec || !G) return JSON.stringify({ err: 'no section/gate' });
      const t0 = performance.now();
      const du = await window.exportSection(sec, 'png', ${W}, { returnDataUrl: true });
      const tExp = performance.now() - t0;
      const bg = G.sectionBgColor(sec);
      const t1 = performance.now();
      const tr = await G.captureTruth(sec, ${W}, bg);
      const tTruth = performance.now() - t1;
      const im = new Image(); im.src = du; await new Promise(r => { im.onload = r; });
      const ec = document.createElement('canvas'); ec.width = im.width; ec.height = im.height;
      ec.getContext('2d').drawImage(im, 0, 0);
      const t2 = performance.now();
      const m = G.compareRGBA(G.canvasToImageData(ec), G.canvasToImageData(tr.canvas));
      const tCmp = performance.now() - t2;
      const v = G.judgeExportDiff(m, { native: true, format: 'png', imgTimedOut: tr.imgTimedOut, repro: null });
      return JSON.stringify({ sid: ${JSON.stringify(sid)}, tier: v.tier, reasons: v.reasons,
        total: m.total, maxCell: m.maxCell, blobPx: m.blobPx, bandCount: m.bandCount,
        truthBandCount: m.truthBandCount, bandMismatch: m.bandMismatch, sizeMismatch: m.sizeMismatch,
        maxDx: m.maxDx, maxDy: m.maxDy, h: m.expSize[1], imgTimedOut: tr.imgTimedOut,
        tExp: Math.round(tExp), tTruth: Math.round(tTruth), tCmp: Math.round(tCmp),
        exportPng: du, truthPng: tr.canvas.toDataURL('image/png') });
    })()`;
    let raw;
    try { raw = val(await ev(EXPR)); }
    catch (e) { console.log(JSON.stringify({ sid, err: String(e.message).slice(0, 200) })); continue; }
    if (!raw) { console.log(JSON.stringify({ sid, err: 'empty' })); continue; }
    const o = JSON.parse(raw);
    if (o.exportPng) {
      fs.writeFileSync(path.join(outDir, `${pid}.${sid}.w${W}.export.png`), Buffer.from(o.exportPng.split(',')[1], 'base64'));
      fs.writeFileSync(path.join(outDir, `${pid}.${sid}.w${W}.truth.png`),  Buffer.from(o.truthPng.split(',')[1], 'base64'));
      delete o.exportPng; delete o.truthPng;
    }
    o.pid = pid; o.w = W;
    console.log(JSON.stringify(o));
  }
  ws.close(); process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
