/* cdp-lite — 의존성 «0» 인 최소 CDP 클라이언트.
 *
 * 왜 새로 쓰나: 스크래치패드의 임시 벤치들은 전부 `node_modules/ws` 를 «절대경로»로 물고 있어
 * 다른 기계(미니4호기 윈도우)에 그대로 못 넘긴다. 계측 하네스는 «넘겨서 도는 것»이 목적이므로
 * ① Node 21+ 의 전역 WebSocket 을 먼저 쓰고 ② 없으면 `ws` 로 내려간다.
 * 경로 하드코딩·플랫폼 분기 없음 → macOS/Windows 동일 동작.
 *
 * ⚠️Origin 헤더를 «안» 보낸다. DevTools 는 Origin 이 붙은 연결만 검사하므로(원격 허용 목록),
 *   헤더 없는 연결은 항상 통과한다. 앱을 --remote-allow-origins 없이 띄워도 붙는다.
 */

async function resolveWS() {
  if (typeof globalThis.WebSocket === 'function') return globalThis.WebSocket;
  try { return (await import('ws')).default; }
  catch { throw new Error('WebSocket 을 못 찾았다 — Node 21+ 를 쓰거나 `npm i ws` 해라'); }
}

async function httpJSON(port, path) {
  const r = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}

/** 페이지 타깃 하나에 붙는다. match 에 걸리는 페이지가 «정확히 1개» 가 아니면 던진다
 *  (여러 개면 남의 인스턴스를 잴 위험 — 조용히 첫 번째를 고르지 않는다). */
export async function connect(port, match = 'index.html') {
  const WS = await resolveWS();
  const list = await httpJSON(port, '/json/list');
  const pages = list.filter(p => p.type === 'page' && String(p.url).includes(match));
  if (pages.length !== 1) {
    throw new Error(`페이지 타깃이 ${pages.length}개 (match=${match}): ` +
      JSON.stringify(list.filter(p => p.type === 'page').map(p => p.url.slice(0, 90))));
  }
  const target = pages[0];
  const ws = new WS(target.webSocketDebuggerUrl);
  const pend = new Map();
  let id = 0;
  ws.addEventListener('message', ev => {
    let d; try { d = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()); } catch { return; }
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  });
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', e => rej(new Error('WS 연결 실패: ' + (e.message || 'error'))), { once: true });
  });

  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pend.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  /** 페이지에서 식을 평가한다. 예외는 «삼키지 않고» 던진다
   *  (오류를 삼키면 그 위 판정이 전부 거짓말이 된다). */
  const ev = async (expression, { awaitPromise = true } = {}) => {
    const r = await send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise, userGesture: true
    });
    const ex = r.result?.exceptionDetails;
    if (ex) throw new Error('PAGE-EXC: ' + JSON.stringify(ex.exception?.description || ex.text || ex).slice(0, 400));
    return r.result?.result?.value;
  };

  const close = () => { try { ws.close(); } catch { /* 이미 닫힘 */ } };
  return { send, ev, close, target, port };
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 휠 «한 노치» — 진짜 입력 주입(합성 이벤트 아님). ctrl:true 면 핀치=줌 경로로 간다. */
export async function wheel(cdp, { x, y, dx = 0, dy = 0, ctrl = false }) {
  return cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy,
    modifiers: ctrl ? 2 : 0, pointerType: 'mouse'
  });
}

/** 창을 화면 밖으로 — 현빈 실사용 맥에서 창이 앞으로 튀면 안 된다.
 *  ⚠️Browser.* 는 «브라우저 엔드포인트»(/json/version)에서만 확실히 받는다 —
 *    페이지 세션으로 부르면 Electron 버전에 따라 조용히 실패한다. 그래서 연결을 따로 연다.
 *  ⚠️Windows 에서 «음수 left» 는 다중 모니터 배치에 따라 클램프될 수 있다 —
 *    그때는 화면 안에 남으므로, 호출자가 반환값(ok/sx)을 «반드시» 확인해야 한다. */
export async function moveWindowOffscreen(port, left = -2400, top = 0, match = 'index.html') {
  const WS = await resolveWS();
  const ver = await httpJSON(port, '/json/version');
  const list = await httpJSON(port, '/json/list');
  const page = list.find(p => p.type === 'page' && String(p.url).includes(match)) || list.find(p => p.type === 'page');
  if (!page) return { ok: false, why: 'page 타깃 없음' };
  const ws = new WS(ver.webSocketDebuggerUrl);
  const pend = new Map(); let id = 0;
  ws.addEventListener('message', ev => {
    const d = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', () => rej(new Error('browser WS 실패')), { once: true }); });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const w = await send('Browser.getWindowForTarget', { targetId: page.id });
  const wid = w.result?.windowId;
  let r = null;
  if (wid != null) r = await send('Browser.setWindowBounds', { windowId: wid, bounds: { left, top } });
  ws.close();
  return { ok: wid != null && !r?.error, windowId: wid ?? null, error: r?.error ?? null };
}
