/* ═══════════════════════════════════════════════════════════════════════════
   admin/index.js — 어드민(운영자) 기능의 main 프로세스 쪽 전부.
   ───────────────────────────────────────────────────────────────────────────
   main.js 에는 require + init() 두 줄만 남긴다(main/collab 과 같은 꼴).

   ★왜 렌더러가 직접 서버를 못 부르나
     sessionToken 은 auth.json 에 있고 «main 밖으로 나가지 않는다»(auth:state 가 토큰을
     빼고 돌려주는 것과 같은 이유). 렌더러는 CSP 로 외부 호출도 막혀 있다.
     ⇒ 어드민 화면은 여기 열린 문(admin:*)으로만 말한다.

   ★권한은 «여기서 지키는 게 아니다»
     이 파일이 하는 role 판정은 «탭을 보여줄까»를 정하는 힌트다. 진짜 거부는 서버가 한다
     (api/_lib/roles.js requireAdmin — DB 의 지금 role 을 본다). 그래서 이 판정이 틀려도
     사고가 아니라 «화면이 어긋난 것»이다. 반대로 여기서 통과시켜도 서버가 403 을 준다.
     ⛔이 파일에 「어드민이면 통과」 같은 우회로를 만들지 마라. 판정처가 둘이 되는 순간
       한쪽만 고치는 사고가 난다.

   ★주소가 두 벌인 이유 (api/license/notice.js 주석과 같은 사정)
     정본은 /api/notice·/api/report/* 인데, EC2 어댑터(server/ec2-server.js)의 ROUTES
     화이트리스트에 그 폴더가 안 올라간 배포에서는 404 다. 그래서 서버가 «확실히 도는 폴더»
     (api/license/*)에 같은 문을 냈다. 여기서는 정본을 먼저 부르고 404 면 alias 로 한 번만
     재시도한다. ⚠️「404 = 기능 없음」으로 단정하지 않는다 — 협업이 정확히 그걸로 죽었다.
═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const { API_BASE } = require('../../services/authService');

const TIMEOUT_MS = 15000;
const IMAGE_TIMEOUT_MS = 30000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;   // data URI 로 렌더러에 넘긴다 — 이보다 크면 화면이 죽는다

/** main.js 가 주입한다 — 이 모듈은 auth.json 의 «자리»를 몰라야 한다. */
let _deps = {
  /** @returns {{email:string, sessionToken:string}|null} */
  readAuth: () => null,
};

/* ── HTTP ──────────────────────────────────────────────────────────────── */

/** @throws 네트워크 실패·타임아웃만 throw(=«판단 불가»). 서버가 4xx/5xx 로 «대답»한 건 status 로 돌려준다. */
async function _fetchJson(url, { method = 'POST', body, headers } = {}, timeoutMs = TIMEOUT_MS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/** 정본 → (404 면) alias 로 한 번만 재시도. 두 주소가 «같은 핸들러»라 결과는 같다. */
async function _callWithAlias(primary, alias, body) {
  let r;
  try { r = await _fetchJson(`${API_BASE}${primary}`, { body }); }
  catch (_) { return { ok: false, reason: 'offline' }; }
  if (r.status !== 404) return _shape(r);

  try { r = await _fetchJson(`${API_BASE}${alias}`, { body }); }
  catch (_) { return { ok: false, reason: 'offline' }; }
  if (r.status !== 404) return _shape(r);

  /* ★두 주소가 «둘 다» 404 다 — 십중팔구 «아직 배포 안 된 것»이다.
   *   ⚠️그냥 두면 「찾을 수 없습니다(이미 지워졌을 수 있습니다)」로 보인다. 실측(2026-09-02):
   *     라이브가 없는 경로에 {"ok":false,"error":"not_found"} 를 준다 — 핸들러의 404 와 «코드가 같다».
   *     그 상태로 배포하면 운영자는 「공지가 왜 안 가지」를 계속 파게 된다(협업이 정확히 그랬다).
   *   가르는 표: 핸들러가 낸 404 는 사람에게 할 말(message)을 «같이» 준다. 라우팅 404 는 안 준다. */
  if (r.json && typeof r.json === 'object' && r.json.message) return _shape(r);
  return { ok: false, reason: 'not_deployed', status: 404 };
}

/** 서버 응답 → 렌더러가 그대로 쓸 수 있는 꼴. ★서버가 준 message 를 «버리지 않는다». */
function _shape(r) {
  if (!r.json || typeof r.json !== 'object') {
    // 서버가 HTML 을 줬다. 404 면 «아직 배포 안 된 것»이다 — 「권한 없음」과 구분해야 한다.
    if (r.status === 404) return { ok: false, reason: 'not_deployed', status: 404 };
    return { ok: false, reason: 'bad_response', status: r.status };
  }
  if (r.json.ok === true) return { ...r.json, status: r.status };
  return {
    ...r.json,
    ok: false,
    // 서버 error 코드를 reason 으로 옮긴다 — 화면은 reason 하나만 보면 된다.
    reason: r.json.error || r.json.reason || (r.status >= 500 ? 'server' : 'unknown'),
    status: r.status,
  };
}

/** 로그인 안 했으면 서버를 두드리지도 않는다(토큰 없이 보내면 401 인데, 원인은 이쪽이다). */
function _auth() {
  const a = _deps.readAuth();
  if (!a || !a.sessionToken) return null;
  return a;
}

/* ── role ──────────────────────────────────────────────────────────────── */

/* ★role 은 auth.json 에 «저장하지 않는다».
 *   저장하면 「서버에서 권한을 뺏겼는데 앱은 아직 어드민」인 상태가 파일로 굳는다.
 *   권한의 정본은 어차피 서버라, 여기서는 «이번 실행 동안만» 캐시한다.
 *   ⚠️캐시는 «탭을 그릴지»에만 쓴다. 서버 호출은 캐시를 보지 않는다. */
let _roleCache = null;            // { at:number, role:'admin'|null, hasRoleField:boolean, email:string }
const ROLE_TTL_MS = 5 * 60 * 1000;

/**
 * 세션 재검증으로 role 을 읽는다.
 *
 * ★세 갈래를 «구분해서» 돌려준다 (api/_lib/roles.js roleForResponse 주석과 짝):
 *   role:'admin'        → 어드민
 *   role:null (키 있음) → 일반 사용자
 *   키 자체 없음        → 이 패치가 안 실린 «구버전 서버»
 *   뒤 둘은 화면 결과가 같지만(탭 없음) 원인이 다르다. 안 가르면 「왜 안 보이지」를 두 번 조사한다.
 *   그래서 hasOwnProperty 로 «키 유무»를 본다 — `j.role == null` 로 뭉개면 이 구분이 사라진다.
 */
async function _fetchRole(force) {
  const auth = _auth();
  if (!auth) return { ok: false, reason: 'not_signed_in', isAdmin: false, hasRoleField: null };

  if (!force && _roleCache && _roleCache.email === auth.email && Date.now() - _roleCache.at < ROLE_TTL_MS) {
    return { ok: true, isAdmin: _roleCache.role === 'admin', role: _roleCache.role,
             hasRoleField: _roleCache.hasRoleField, email: auth.email, cached: true };
  }

  let r;
  try {
    r = await _fetchJson(`${API_BASE}/api/license/session`, {
      body: { email: auth.email, sessionToken: auth.sessionToken },
    });
  } catch (_) {
    // 오프라인 — «모른다». 어드민이 아니라고 «단정»하지 않되, 탭은 안 띄운다(모르면 안 보여준다).
    return { ok: false, reason: 'offline', isAdmin: false, hasRoleField: null };
  }

  /* ★★여기부터의 갈래 순서가 중요하다 (G1 지적, 2026-09-02).
   *   죽은 토큰이면 서버는 401 {ok:false, reason:'invalid_session'} 을 준다 — 그 응답엔 role 키가 «없다».
   *   그걸 먼저 안 걸러내고 hasOwnProperty 를 재면 「구버전 서버」로 읽는다. 실제로는 «로그아웃»이다.
   *   ⇒ 200 이 아닌 응답에서는 role 판정을 «아예 하지 않는다».
   *
   * ★hasRoleField 는 3값이다 — true/false/null.
   *   false = «봤는데 키가 없다»(구버전 서버)   null = «볼 기회조차 없었다»(오프라인·401·403)
   *   둘을 false 로 뭉치면 「왜 탭이 없지」를 엉뚱한 데서 찾는다(관찰과 해석을 섞는 실수). */
  const j = r.json;
  if (!j || typeof j !== 'object') return { ok: false, reason: 'bad_response', isAdmin: false, hasRoleField: null };
  if (r.status === 401) return { ok: false, reason: 'invalid_session', isAdmin: false, hasRoleField: null };
  if (r.status === 403) return { ok: false, reason: j.reason || 'forbidden', isAdmin: false, hasRoleField: null };
  if (r.status !== 200) return { ok: false, reason: 'bad_response', status: r.status, isAdmin: false, hasRoleField: null };

  const hasRoleField = Object.prototype.hasOwnProperty.call(j, 'role');
  const role = hasRoleField ? (j.role === 'admin' ? 'admin' : null) : null;
  _roleCache = { at: Date.now(), role, hasRoleField, email: auth.email };
  return { ok: true, isAdmin: role === 'admin', role, hasRoleField, email: auth.email };
}

/* ── IPC ───────────────────────────────────────────────────────────────── */

function init(ipcMain, deps) {
  _deps = { ..._deps, ...(deps || {}) };

  /** 「공지 탭을 그릴까」의 답. ⛔이 결과를 권한으로 쓰지 마라 — 서버가 다시 검사한다. */
  ipcMain.handle('admin:state', async (_e, { force } = {}) => _fetchRole(!!force));

  /* 공지 — 세 op 를 한 문으로 받는다(서버가 한 파일이라 여기서 쪼갤 이유가 없다).
   * ⚠️ op 는 «여기서» 박는다. 렌더러가 임의 op 를 밀어 넣지 못하게. */
  ipcMain.handle('admin:notice-create', async (_e, payload = {}) => {
    const auth = _auth();
    if (!auth) return { ok: false, reason: 'not_signed_in' };
    return _callWithAlias('/api/notice', '/api/license/notice', {
      sessionToken: auth.sessionToken,
      op: 'create',
      title: payload.title,
      body: payload.body,
      level: payload.level,
      target: payload.target,
      startAt: payload.startAt,
      endAt: payload.endAt,
    });
  });

  ipcMain.handle('admin:notice-list', async () => {
    const auth = _auth();
    if (!auth) return { ok: false, reason: 'not_signed_in' };
    return _callWithAlias('/api/notice', '/api/license/notice', { sessionToken: auth.sessionToken, op: 'list' });
  });

  ipcMain.handle('admin:notice-revoke', async (_e, { noticeId } = {}) => {
    const auth = _auth();
    if (!auth) return { ok: false, reason: 'not_signed_in' };
    return _callWithAlias('/api/notice', '/api/license/notice', {
      sessionToken: auth.sessionToken, op: 'revoke', noticeId: String(noticeId || ''),
    });
  });

  /* 신고 열람 (PLAN B-b) */
  ipcMain.handle('admin:report-list', async (_e, { limit, before, type, status } = {}) => {
    const auth = _auth();
    if (!auth) return { ok: false, reason: 'not_signed_in' };
    const body = { sessionToken: auth.sessionToken };
    if (limit)  body.limit = limit;
    if (before) body.before = before;
    if (type)   body.type = type;
    if (status) body.status = status;
    return _callWithAlias('/api/report/list', '/api/license/report-list', body);
  });

  ipcMain.handle('admin:report-status', async (_e, { reportId, status } = {}) => {
    const auth = _auth();
    if (!auth) return { ok: false, reason: 'not_signed_in' };
    return _callWithAlias('/api/report/list', '/api/license/report-list', {
      sessionToken: auth.sessionToken, op: 'status',
      reportId: String(reportId || ''), status: String(status || ''),
    });
  });

  /* 신고 이미지 — ★토큰이 «헤더»로 가야 한다(쿼리스트링 금지: 액세스로그에 남는다).
   * <img src> 로는 헤더를 못 붙이므로 main 이 받아서 data URI 로 넘긴다.
   * ⛔파일로 떨구지 않는다 — 남의 상세페이지 캡처가 이 디스크에 남는 게 더 나쁘다. */
  ipcMain.handle('admin:report-image', async (_e, { reportId, index } = {}) => {
    const auth = _auth();
    if (!auth) return { ok: false, reason: 'not_signed_in' };
    const id = String(reportId || '');
    const i = Number(index) || 0;
    if (!/^[0-9a-f]{24}$/i.test(id)) return { ok: false, reason: 'bad_id' };

    const qs = `?id=${encodeURIComponent(id)}&i=${encodeURIComponent(String(i))}`;
    const headers = { Authorization: `Bearer ${auth.sessionToken}` };
    const get = async (p) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), IMAGE_TIMEOUT_MS);
      try { return await fetch(`${API_BASE}${p}${qs}`, { headers, signal: ctl.signal }); }
      finally { clearTimeout(timer); }
    };

    let res;
    try {
      res = await get('/api/report/image');
      if (res.status === 404) {
        // ⚠️404 가 «이 신고에 그 이미지가 없다»일 수도, «엔드포인트가 아직 없다»일 수도 있다.
        //   alias 로 한 번 더 물어 가른다 — 둘 다 404 면 그때 not_found 다.
        const alt = await get('/api/license/report-image');
        if (alt.status !== 404) res = alt;
      }
    } catch (_) { return { ok: false, reason: 'offline' }; }

    if (res.status === 401 || res.status === 403) {
      let j = null; try { j = await res.json(); } catch (_) {}
      return { ok: false, reason: (j && j.error) || 'forbidden', message: j && j.message };
    }
    if (res.status !== 200) return { ok: false, reason: res.status === 404 ? 'not_found' : 'server', status: res.status };

    const mime = res.headers.get('content-type') || 'application/octet-stream';
    let buf;
    try { buf = Buffer.from(await res.arrayBuffer()); }
    catch (_) { return { ok: false, reason: 'offline' }; }
    if (buf.length > MAX_IMAGE_BYTES) {
      return { ok: false, reason: 'too_large', bytes: buf.length };
    }
    return { ok: true, dataUri: `data:${mime};base64,${buf.toString('base64')}`, bytes: buf.length, mime };
  });
}

module.exports = { init, _fetchRole };
