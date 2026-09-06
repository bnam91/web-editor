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

// ★2026-08-18 도메인 통일(현빈 승인): 라이브 백엔드는 blacksheepwall.kr(EC2)다.
//   옛 hompageapp.vercel.app은 「개발용」으로 내려간다 — 여기 기본값이 그걸 가리키면
//   새 릴리스가 개발 서버로 로그인하러 간다. 자동 폴백은 «두지 않는다»: 주소가 둘이면
//   어느 쪽이 응답했는지 모른 채 통과해 버려, 장애를 조용히 감춘다(확장 쪽 폴백은
//   웹스토어 재심사 때문에 남긴 예외).
//   ⇒ 다른 주소를 봐야 할 때는 env로 명시한다(개발용 Vercel 확인 등).
const API_BASE      = process.env.GODITOR_LICENSE_API || 'https://blacksheepwall.kr';
const LOGIN_URL     = `${API_BASE}/api/license/login`;
// 세션 조용한 갱신용. 2026-08-06 현재 백엔드 미구현(404) — 응답을 못 받으면
// "판단 불가"로 처리하고 로컬 캐시를 그대로 신뢰한다(=오프라인 유예와 동일 경로).
// 백엔드가 이 엔드포인트를 열면 코드 수정 없이 갱신이 살아난다.
const SESSION_URL   = `${API_BASE}/api/license/session`;
const SIGNUP_URL    = `${API_BASE}/signup.html`;
const PRICING_URL   = `${API_BASE}/pricing.html`;
// 계정 찾기.
// ★이 링크를 넣던 2026-08-07 오전엔 두 페이지가 라이브에 «없었다»(404). 홈페이지 쪽에만
//   있었고 배포가 아직이어서, 링크만 넣었으면 사용자는 「이메일 찾기」를 눌러 404를 봤다.
//   그래서 링크는 화면에 두되, 여는 쪽(main.js 'auth:open-external')이 열기 전에 실제 응답을
//   확인해 죽어 있으면 브라우저를 띄우지 않는다. 「있다고 해놓고 404」가 「없다」보다 나쁘다.
//   같은 날 두 페이지가 배포되어 지금은 통과한다.
// ★그래도 가드를 남기는 이유는 «설정 사고로 페이지가 조용히 사라질 수 있어서»다. 같은 날
//   실례가 있었다: 레포에 public/ 디렉터리가 생기자 Vercel이 그걸 출력 디렉터리로 잡아
//   레포 루트가 통째로 404가 됐다(public/icons/… 만 루트에서 나왔다). 배포는 «성공»했고
//   사이트만 죽어 있었다 — 즉 배포 성공이 페이지 생존을 보장하지 않는다.
const FIND_EMAIL_URL    = `${API_BASE}/find-email.html`;
const FIND_PASSWORD_URL = `${API_BASE}/find-password.html`;

const TIMEOUT_MS = 10000;
// 링크 생사 확인은 클릭 직후에 돌아 «체감 지연»이 된다. 로그인 요청보다 짧게 잡는다.
const LINK_CHECK_TIMEOUT_MS = 4000;

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
 * 그 주소에 «진짜 페이지가 있는지» 확인한다. 죽은 링크로 사용자를 내보내지 않기 위한 것.
 *
 * ★반환값은 3갈래다 — true / false / null.
 *   null 은 «판단 불가»(오프라인·타임아웃·요청 자체 실패)이고, false 와 다르게 다뤄야 한다.
 *   판단 불가를 막아버리면 네트워크가 잠깐 흔들릴 때 멀쩡한 가입 링크까지 죽는다.
 *   그래서 호출부는 null 이면 그냥 열어준다(관대한 쪽으로).
 *
 * ★GET 을 쓴다. HEAD 가 아니다 —
 *   Electron main 의 fetch 는 Chromium net 스택이라 HEAD 응답의 status 를
 *   그대로 돌려주지 않는 경우가 있었다(2026-08-07: 200 인 주소가 전부 막혔다).
 *   본문을 안 읽고 즉시 취소하면 GET 이어도 비용은 헤더 몇 줄 수준이다.
 *
 * @param {(url:string, status:number|null)=>void} [onResult] 진단 로그용 훅.
 *   막혔을 때 «몇이 와서» 막혔는지 남기지 않으면 다음 사람이 원인을 못 찾는다.
 */
async function urlIsLive(url, onResult) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), LINK_CHECK_TIMEOUT_MS);
  let status = null;
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctl.signal });
    status = res.status;
    return status >= 200 && status < 400;
  } catch (_) {
    return null; // 오프라인·타임아웃 → 판단 불가
  } finally {
    clearTimeout(timer);
    ctl.abort();            // 본문은 받지 않는다
    if (onResult) { try { onResult(url, status); } catch (_) {} }
  }
}

/* ── 서버 응답 필드 «뭉개지 않기» ────────────────────────────────────────────
 * ★2026-09-06 재현된 사고: 서버가 준 `accessUntil: null`(= «무기한», 2099 매직넘버 금지 규약)이
 *   `j.accessUntil || ''` 에서 `''` 가 되고 → main.js writeAuth 가 `''` 를 적고 →
 *   readAuth 가 `''` 를 falsy 로 읽어 「기록이 없다」로 판정 → **돈 낸 무기한 사용자가
 *   «첫 성공적 verifySession 바로 다음 실행»부터 로그아웃 화면을 본다.** 서서히가 아니라 즉시다.
 *   게다가 sessionToken 도 같이 못 꺼내 silentRefresh 가 손도 못 대는 «자가복구 불가» 상태였다.
 * ⇒ 뭉개는 자리가 «둘»이었다(여기 + writeAuth). ★한쪽만 고치면 안 낫는다.
 */

/** `accessUntil` 을 «뜻을 지운 채» 넘기지 않는다.
 *  · `null`      = 무기한 → **null 그대로**
 *  · 키 자체 없음 = 서버가 «말하지 않은» 것 → **키를 만들지 않는다**
 *    (applyServerAnswer 의 plain 갱신이 `undefined` 를 보고 캐시를 «안 덮는다»).
 *  · 그 밖        = 문자열 */
function accessUntilField(j) {
  if (!j || j.accessUntil === undefined) return {};
  if (j.accessUntil === null) return { accessUntil: null };
  return { accessUntil: String(j.accessUntil) };
}

/** 서버 서명 블록을 «가공 없이» 통과시킨다.
 *  ⛔파싱 후 재직렬화 금지 — `payload` 는 «서명 대상 그 b64url 문자열»이라 한 바이트만
 *    달라져도 검증이 깨진다. 그래서 객체를 그대로 넘기고, 없으면 키를 만들지 않는다. */
function signedField(j) {
  const sg = j && j.signed;
  return (sg && typeof sg === 'object' && !Array.isArray(sg)) ? { signed: sg } : {};
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
    // ★app 식별자: 지금은 앱과 홈페이지가 «완전히 같은 body»를 보내 서버가 둘을 구분하지 못한다.
    //   등급 관리의 「앱 첫 로그인 = 고디터 유저 등록」이 이 필드에 걸려 있다.
    //   서버는 app 이 없으면 예전대로 동작하므로 구버전 앱과의 호환성은 그대로다.
    r = await postJson(LOGIN_URL, { email, password, app: 'goditor' });
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
      /* ★`|| ''` 를 쓰지 않는다 — 무기한(null)을 '' 로 뭉개면 그 사용자는 로그인 «직후»부터
         저장본이 무효로 읽힌다. 자세한 이유는 accessUntilField 주석. */
      ...accessUntilField(j),
      sessionToken: j.sessionToken || '',
    };
  }

  // ★200 + ok:false — 만료 등 "정상 응답인 거절". 에러로 처리하면 안 된다.
  if (r.status === 200 && j.ok === false) {
    return {
      ok: false,
      reason: j.reason || 'unknown',
      plan: j.plan || '',
      ...accessUntilField(j),
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
 *  - { ok:true,  plan, accessUntil?, signed? }
 *  - { ok:false, reason, plan, accessUntil?, signed? }   'expired' | 'invalid_session' 등
 *
 * ★`signed` = 서버 Ed25519 서명 블록 `{payload, sig, kid}`(정본 `feat/entitlement@522412a`,
 *   모듈 `api/_lib/entitlement-sign.js`). **`payload` 하나**다 — `entitlement` 가 아니다.
 *   여기서는 «가공 없이» 통과만 시킨다. 판정은 services/entitlement.js 가 한다.
 * ★서버는 **만료된 사용자에게도 서명해서 준다** ⇒ 「signed 가 있다」로 통과시키면 안 된다.
 * ★`accessUntil` 은 **null 일 수 있다 = 무기한**. `|| ''` 로 뭉개지 않는다(accessUntilField).
 */
async function verifySession(email, sessionToken) {
  if (!email || !sessionToken) return null;
  let r;
  try {
    r = await postJson(SESSION_URL, { email, sessionToken });
  } catch (_) {
    return null; // 오프라인 — 유예 유지
  }
  // ★「거절」과 「판단 불가」를 가른다.
  //   서버는 세션이 죽었을 때 401(invalid_session)·403(email_not_verified)로 «대답»한다 —
  //   그건 오프라인이 아니라 답이다. 예전엔 200 이 아니면 전부 null(판단 불가)로 뭉갰고,
  //   그 결과 ⑴ 화면엔 「오프라인」이 뜨고 ⑵ silentRefresh 의 invalid_session 분기가
  //   «도달 불가»가 됐다(폐기된 세션이 영영 안 지워진다).
  //   판단 불가로 남겨야 하는 건 «서버가 말을 안 한 경우»뿐이다 — 네트워크 실패(위 catch),
  //   엔드포인트 부재(404), 서버오류(5xx), 그리고 형식이 깨진 응답.
  const j = r.json;
  const spoke = (r.status === 200 || r.status === 401 || r.status === 403)
             && j && typeof j.ok === 'boolean';
  if (!spoke) return null;
  if (j.ok) return { ok: true, plan: j.plan || '', ...accessUntilField(j), ...signedField(j) };
  return { ok: false, reason: j.reason || 'unknown', plan: j.plan || '', ...accessUntilField(j), ...signedField(j) };
}

module.exports = {
  login,
  verifySession,
  API_BASE,
  SIGNUP_URL,
  PRICING_URL,
  FIND_EMAIL_URL,
  FIND_PASSWORD_URL,
  urlIsLive,
};
