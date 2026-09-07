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

const _auth = require('../../services/authService');

/* ★주소를 갈아끼울 수 있어야 한다 — 단 «개발 빌드에서만».
 *   - 프리뷰 배포는 커밋마다 URL 이 바뀐다(브랜치 별칭이 이 프로젝트엔 안 열려 있다).
 *   - 2인 동시편집은 «가짜 서버»로 먼저 검증하는 게 빠르고 안전하다(프로덕션 DB 안 건드림).
 *   기본값은 프로덕션이다 — 사용자는 아무것도 안 해도 된다.
 *
 * ★★배포본에선 `GODITOR_COLLAB_API` 를 «무시»한다 — `resolveApiBase`(authService)·
 *   `resolveKeys`(entitlement)·`isAdminAuthorized`(main.js) 와 «같은 규약»이다.
 *   안 막으면 authService 쪽 주소를 라이브로 못박아 놔도 협업 API 전체가 이 한 줄로
 *   통째로 딴 데(위조 서버)로 간다 — 세션·초대·문서가 그쪽으로 흐른다.
 *
 * ★판정은 여기서 «안» 한다: `_auth.isPackaged()` 가 이 앱의 한 벌짜리 답이다.
 *   ⛔`app.isPackaged`·`process.execPath`·asar 경로검사를 여기 새로 들이지 마라.
 *
 * ★그리고 상수가 아니라 «함수»다 — main.js 가 `applyRuntime()` 으로 답을 확정하는
 *   시점과 이 모듈이 require 되는 시점의 선후를 믿지 않기 위해서다(구조분해로 붙잡으면
 *   옛 주소에 얼어붙는다 — authService 가 module.exports 를 다시 덮어쓰는 이유와 같다). */
function collabBase() {
  const live = _auth.API_BASE;
  /* ★답을 못 얻으면 «막는 쪽» — 부분 스텁(검사 하네스)이 게이트를 열지 못하게. */
  const packaged = (typeof _auth.isPackaged === 'function') ? _auth.isPackaged() : true;
  if (packaged) return `${live}/api/collab`;
  return `${process.env.GODITOR_COLLAB_API || live}/api/collab`;
}
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
    const res = await fetch(`${collabBase()}/${pathname}`, {
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

module.exports = { request, collabBase };
/* 옛 이름 `BASE` 는 «게터»로 남긴다 — 값으로 두면 require 시점에 얼어붙는다. */
Object.defineProperty(module.exports, 'BASE', { get: collabBase, enumerable: true });
