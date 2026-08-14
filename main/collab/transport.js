/* ═══════════════════════════════════════════════════════════════════════════
   collab/transport.js — 협업 서버와의 «말하는 방법»만 담는다.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 분리했나
     지금 서버는 Vercel 서버리스라 **WebSocket 을 못 받는다**. 그래서 2초 HTTP 폴링으로
     시작한다. 나중에 상시 서버(WS)로 옮길 때 «도메인 로직(index.js)은 안 건드리고»
     이 파일만 갈아끼우려고 경계를 여기에 뒀다.
     ⇒ index.js 는 request() 만 안다. fetch·폴링·재시도는 전부 이 안의 사정이다.

   ★렌더러가 아니라 main 프로세스에서 부른다
     렌더러는 CSP 로 외부 호출이 막혀 있고, 무엇보다 **sessionToken 을 렌더러에 주지
     않는다**(auth:state 가 토큰을 빼고 돌려주는 것과 같은 이유). 네트워크는 여기서만.
═══════════════════════════════════════════════════════════════════════════ */

const { API_BASE } = require('../../services/authService');

const BASE = `${API_BASE}/api/collab`;
const TIMEOUT_MS = 12000;

/**
 * @returns {Promise<{status:number, json:object|null}>}
 * @throws  네트워크 실패·타임아웃만 throw 한다(=«판단 불가»). 서버가 4xx/5xx 로
 *          «대답»한 건 throw 가 아니라 status 로 돌려준다 — 호출부가 갈라 쓴다.
 *          (authService.verifySession 이 401 을 오프라인으로 뭉개 사고 났던 것과 같은 교훈)
 */
async function request(pathname, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctl.signal,
    });
    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { request, BASE };
