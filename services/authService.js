/**
 * 계정 인증 서비스 — GODITOR
 *
 * 홈페이지 계정(이메일 + 비밀번호)으로 로그인한다. 라이선스 키(WE-XXXXXX) 제도는 폐지.
 *
 * ★앱은 DB에 직접 붙지 않는다 — HTTPS 엔드포인트만 호출한다.
 *   구 services/licenseService.js는 process.env.MONGO_URI로 MongoDB에 직접 접속했고,
 *   배포본엔 그 env가 없어 모든 인증이 "오류가 발생했습니다"로 죽었다(2026-08-05 사고).
 *   자격증명이 앱 번들에 남을 여지도 함께 제거.
 *
 * ★만료는 에러가 아니다: HTTP 200 + {ok:false, reason:'expired'} 로 온다.
 *   throw/네트워크 오류와 구분해서 "이벤트 종료 → 구매 안내"로 분기해야 한다.
 */

const API_BASE      = 'https://hompageapp.vercel.app';
const LOGIN_URL     = `${API_BASE}/api/license/login`;
// 세션 조용한 갱신용. 2026-08-06 현재 백엔드 미구현(404) — 응답을 못 받으면
// "판단 불가"로 처리하고 로컬 캐시를 그대로 신뢰한다(=오프라인 유예와 동일 경로).
// 백엔드가 이 엔드포인트를 열면 코드 수정 없이 갱신이 살아난다.
const SESSION_URL   = `${API_BASE}/api/license/session`;
const SIGNUP_URL    = `${API_BASE}/signup.html`;
const PRICING_URL   = `${API_BASE}/pricing.html`;

const TIMEOUT_MS = 10000;

/** JSON POST. 네트워크/타임아웃은 throw, HTTP 오류는 status와 함께 반환. */
async function postJson(url, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 계정 로그인.
 * @returns {Promise<object>} 항상 아래 중 하나 (throw 하지 않음)
 *  - { ok:true,  email, plan, accessUntil, sessionToken }
 *  - { ok:false, reason:'expired', plan, accessUntil, purchaseUrl }
 *  - { ok:false, reason:'invalid_credentials' }
 *  - { ok:false, reason:'email_not_verified' }
 *  - { ok:false, reason:'server',  status }   서버 5xx 등
 *  - { ok:false, reason:'network', message }  오프라인·타임아웃
 */
async function login(email, password) {
  let r;
  try {
    r = await postJson(LOGIN_URL, { email, password });
  } catch (e) {
    return { ok: false, reason: 'network', message: e?.message || String(e) };
  }

  const j = r.json || {};

  // 200 + ok:true — 정상 로그인
  if (r.status === 200 && j.ok === true) {
    return {
      ok: true,
      email: j.email || email,
      plan: j.plan || '',
      accessUntil: j.accessUntil || '',
      sessionToken: j.sessionToken || '',
    };
  }

  // ★200 + ok:false — 만료 등 "정상 응답인 거절". 에러로 처리하면 안 된다.
  if (r.status === 200 && j.ok === false) {
    return {
      ok: false,
      reason: j.reason || 'unknown',
      plan: j.plan || '',
      accessUntil: j.accessUntil || '',
      purchaseUrl: j.purchaseUrl || PRICING_URL,
    };
  }

  if (r.status === 401) return { ok: false, reason: j.reason || 'invalid_credentials' };
  if (r.status === 403) return { ok: false, reason: j.reason || 'email_not_verified' };
  if (r.status === 400) return { ok: false, reason: j.reason || j.error || 'bad_request' };

  return { ok: false, reason: 'server', status: r.status };
}

/**
 * 저장된 세션으로 접근권한 조용히 갱신(로그인 화면을 띄우지 않는다).
 * @returns {Promise<object|null>} null = 판단 불가(오프라인·엔드포인트 부재·서버오류) → 캐시 유지
 *  - { ok:true, plan, accessUntil }
 *  - { ok:false, reason }          'expired' | 'invalid_session' 등
 */
async function verifySession(email, sessionToken) {
  if (!email || !sessionToken) return null;
  let r;
  try {
    r = await postJson(SESSION_URL, { email, sessionToken });
  } catch (_) {
    return null; // 오프라인 — 유예 유지
  }
  if (r.status !== 200 || !r.json || typeof r.json.ok !== 'boolean') return null; // 미구현(404)·서버오류
  const j = r.json;
  if (j.ok) return { ok: true, plan: j.plan || '', accessUntil: j.accessUntil || '' };
  return { ok: false, reason: j.reason || 'unknown', plan: j.plan || '', accessUntil: j.accessUntil || '' };
}

module.exports = {
  login,
  verifySession,
  API_BASE,
  SIGNUP_URL,
  PRICING_URL,
};
