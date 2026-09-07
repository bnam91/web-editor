'use strict';
/* 서명된 자격증명(entitlement) 검증 — 앱(클라이언트) 쪽 «순수 모듈».
 *
 * ★이 파일이 하는 일 = 「입력을 주면 판정을 돌려준다」. 그것뿐이다.
 *   파일 I/O 0 · 네트워크 0 · electron 의존 0 · 전역 상태 0 · `Date.now()` 도 주입받는다.
 *   ⇒ 배선(main.js·authService)은 E2 다. 이 파일은 «무엇이 참인가»만 답한다.
 *
 * ★왜 서명인가 (계획서 §0)
 *   지금 앱은 `userData/auth.json` 의 `accessUntil` 문자열 하나로 에디터를 연다.
 *   그 파일은 사용자 것이다 — 2099 로 고치면 통과한다.
 *   ⇒ 「돈 되는 결정의 근거」를 사용자가 못 고치는 것(서버 Ed25519 서명)으로 옮긴다.
 *
 * ⛔「막았다」가 아니다. 배포본 asar 는 암호화가 아니라 묶음이라 소스가 다 보인다.
 *   올리는 것은 「auth.json 숫자 하나 고치기(누구나·1분)」 → 「asar 풀고 코드 고쳐 다시 묶기」다.
 *   그리고 «오프라인 + 시계 되돌리기»는 여전히 못 막는다(계획서 §8 ④). 과장하면 약속을 어긴 게 된다.
 *
 * ★★이 파일의 규율 셋 — 어기면 조용히 효과가 0 이 된다
 *   ⑴ **검증이 통과한 «뒤에만» 디코드한다.** 실패한 반환 객체에는 `payload` 키가 «아예 없다» —
 *      「읽은 값으로 판단하는 코드」가 생길 자리를 타입 수준에서 없앤다.
 *   ⑵ **「서명이 유효하다」와 「자격이 있다」는 다른 문장이다.** 서버는 «만료된 사용자에게도»
 *      서명해서 준다. 「signed 가 있으니 통과」로 읽으면 해지한 사람이 그대로 쓴다.
 *   ⑶ **`accessUntil` 을 `exp` «보다 먼저» 본다.** 서버의 `exp` 는 `iat + TTL` 로 «고정»이고
 *      구독 종료일과 무관하다. 순서를 바꾸면 내일 해지되는 사람이 44일을 더 쓴다(계획서 §8 ①).
 */
const crypto = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;

/** 이 앱의 식별자. 서버가 payload.app 에 찍는 값과 «같아야» 한다.
 *  ★상수로 뺀 이유 = 서버가 세션을 «제품별»로 가르는 중이다(feat/entitlements-per-app).
 *    고디브 등 다른 앱이 같은 모듈을 쓰면 여기만 바꾼다. */
const APP_ID = 'goditor';

/** payload 규격 버전. 서버 `_lib/entitlement-sign.js` 의 `VER`(@522412a). */
const PAYLOAD_VER = 1;

/* ── 공개키 ─────────────────────────────────────────────────────────────────
 * ⛔**코드 상수다. userData 에 두지 않는다** — 사용자가 자기 키로 바꿔 자기가 서명하면
 *   서명은 «항상 통과»하고 이 파일 전체가 장식이 된다.
 * ★`kid → PEM` 맵인 이유: kid 가 없으면 키를 «바꿀 수가 없다»(교체 = 전 사용자 잠김).
 * ★2026-09-06 «라이브 대조 완료»(대성, EC2 `/etc/goditor-api/env`). 두 축으로 봤다:
 *   ⑴ env 값의 sha256 앞16 = 5dfbc009f0292fe8 · 길이 161자 — 우리 키와 일치(안 잘렸다)
 *   ⑵ ★서버가 그 개인키에서 «유도한» 공개키가 아래 PEM 과 «바이트 일치»
 *      — ⑴은 「같은 문자열이다」까지고, 「node 가 개인키로 읽을 수 있다」는 별개 질문이라
 *        ⑵를 따로 쟀다(base64 가 온전해도 PEM 이 깨져 있으면 «서명 시점»에야 터진다).
 *   ⛔개인키는 서버 밖으로 안 꺼냈다 — 공개키만 유도해 받았다.
 *
 * ⚠️★그래도 «아직 안 본 것»이 있다 — 「키가 맞다」와 「서명이 돈다」는 다른 문장이다.
 *   대조 시점의 라이브는 DEPLOY_SHA=13d9b84 로 «그 키를 읽는 코드가 아직 없었다».
 *   ⇒ `signed.payload` 가 «실제로 200자 이상 실려 나오는지»는 라이브 배포 «후»에 확인한다.
 *     그때까지 이 앱은 서명 없는 응답을 legacy_grace 로 통과시키는 경로로 돈다(설계대로).
 */
const PUBLIC_KEYS = Object.freeze({
  k1: '-----BEGIN PUBLIC KEY-----\n'
    + 'MCowBQYDK2VwAyEAoxxi0fBgqRIFvbM6NSSkLWQK6kWBvkIeQ+ovrzhU0PU=\n'
    + '-----END PUBLIC KEY-----\n',
});

/** 「이 키가 라이브와 대조됐는가」. 'unverified' → 'verified-YYYY-MM-DD'(E5).
 *  ★이걸 «막는» 자리는 `tools/deploy-gate.js` 다 — release:mac/win 앞에서 돌고,
 *    'verified-YYYY-MM-DD' 형식이 아니면 배포가 exit 1 로 «중단»된다.
 *  ⛔단위검사(entitlement.test.mjs ⓡ)는 이걸 «못 막는다» — 거기서 하는 건 PEM 이
 *    ed25519 형식인지 보는 것뿐이고, 한때 이 주석이 「검사가 본다」고 적혀 있었지만
 *    실제 단언은 `typeof === 'string'` 이라 'unverified-…' 를 그대로 통과시켰다.
 *    개발 중엔 통과해야 하는 값이라 단위검사에 걸면 매일 빨강이 된다 — 그래서
 *    「개발은 통과, 배포는 차단」이 되는 릴리스 게이트 쪽에 뒀다. */
const KEY_PROVENANCE = 'verified-2026-09-06';

/** 플레이스홀더 표식 — 값이 안 들어왔을 때 «검사가 실패하게» 하는 자리.
 *  지금은 실물(추정) 키가 박혀 있어 비어 있다. */
const PLACEHOLDER_MARK = 'REPLACE_ME';

/* ── 상수 (전부 한 곳. 값이 바뀌어도 «코드»는 안 바뀐다) ───────────────────── */
const CONSTANTS = Object.freeze({
  /** 서버가 `exp = iat + 이 일수`로 찍는다. 앱은 exp 를 «읽기만» 한다(참고용). */
  SIG_VALID_DAYS: 30,
  /** exp 가 지난 뒤에도 `iat + 이 일수`까지 오프라인 통과.
   *  ★유예가 서명보다 «길어야» 서버 다운(2026-08-05 형)을 버틴다. */
  GRACE_DAYS: 45,
  /** 시계 오차 여유. ⛔`exp`·`accessUntil` «에만» 준다 — 되돌리기 바닥에 주면
   *  시계가 6분 느린 정상 사용자가 오프라인에서 잠긴다(계획서 §8 ⑥). */
  CLOCK_SKEW_MS: 5 * 60 * 1000,
  /** `now < iat − 이 값` 이면 시계 되돌림으로 본다.
   *  ★24h 인 이유: 5분이면 «로그인 직후 시계가 6분 느린 사용자»가 잠긴다.
   *    되돌리기 공격은 iat «이전»으로 가면 얻는 게 없으니(통과하려면 iat 이후여야 한다)
   *    관대해도 잃는 게 없다. */
  ROLLBACK_TOL_MS: 24 * 60 * 60 * 1000,
  /** 서명 «없는» 옛 auth.json 을 옛 규칙으로 봐 주는 마감일(ISO).
   *  = 릴리스일 + GRACE_DAYS. 사용자가 «빌드를 받는 날»부터 45일이 남아야 한다.
   *
   * ★2026-09-06 갱신: 09-06 기준으로 잡아 둔 10-21 이 «이미 44일»이 돼 있었다(하루 모자람).
   *   상수는 안 늙는데 날짜는 늙는다 — 그래서 이 값을 «날짜»로 지키지 않고
   *   `tools/deploy-gate.js` 가 릴리스 «직전에» 「지금부터 GRACE_DAYS 이상 남았나」를 재게 했다.
   *   ⇒ 지금 값은 서버 QA·배포 일정이 밀릴 여지를 두고 «약 2주»의 릴리스 창을 준다.
   *     그 창을 넘기면 게이트가 다시 막는다 — 그때 다시 잡으면 된다.
   * ⛔단위검사에 걸지 «않는» 이유: 개발 중엔 통과해야 하는 값이라 매일 빨강이 되고,
   *   매일 빨간 검사는 결국 아무도 안 본다. 「개발은 통과, 배포는 차단」이 맞는 자리다. */
  SIGLESS_GRACE_UNTIL: '2026-11-01T00:00:00.000Z',
  /** 차단형 verify 의 «상한». ⛔무한 대기 금지. */
  VERIFY_TIMEOUT_MS: 10000,
  /* ★재검증 «재시도»의 상한 — 「재검증이 필요하다」는 「지금 당장 무한히 시도해라」가 «아니다».
     ⚠️대성 실측(2026-09-06): 「10건/시간」 레이트리밋은 **신고(report) 전용·IP 기준**이고
       `license/session` 에는 «지금은» 레이트리밋이 없다.
     ⛔그걸 믿고 난사하지 않는다. 「없다」는 «지금» 없다는 것이고 유료화 전에 붙을 후보다 —
       서버가 안 막는다고 무제한으로 두면 나중에 붙는 «그날» 앱이 깨진다.
     ⇒ 상한을 «앱이 스스로» 갖는다. 실제 재시도 루프는 E2 몫이고, 이 값과
       `nextRetryDelayMs()` 를 쓴다(각자 숫자를 지어내면 두 벌이 되어 갈라진다). */
  /* ★**시도 3회 = 대기 «2회»다.** 실제 지연 수열 = `2s · 4s`, 그 다음은 `null`(=그만 물어라).
     ⛔초판 주석은 「2s → 4s → 8s」였는데 **8s 는 도달 불가**다(3회차가 상한에 걸린다).
       E2 가 지시대로 「숫자를 새로 짓지 않고」 이 값을 그대로 썼더니 주석만 어긋난 채 남았다.
     ★오늘 서버에서 겪은 그 병과 «같은 모양»이다 — 주석은 `signed.payload`, 코드는 `entitlement`.
       주석을 옮겨 적은 사람이 틀린 규격으로 착수할 뻔했다.
     ⇒ 그래서 주석을 고치는 데서 그치지 않고, «지연 수열 자체»를 검사가 잠근다(주석은 또 갈라진다). */
  VERIFY_MAX_ATTEMPTS: 3,
  VERIFY_BACKOFF_BASE_MS: 2000,
  VERIFY_BACKOFF_MAX_MS: 60000,
  /** 같은 상태로 이 간격 안에는 다시 묻지 않는다(부팅 연타·[다시 시도] 연타 방어). */
  VERIFY_MIN_INTERVAL_MS: 60000,
});

/** 다음 재시도까지 기다릴 ms. **상한을 넘으면 `null` = 「그만 물어라」**.
 *  ⛔`null` 을 「0ms 뒤 재시도」로 읽지 마라 — 그만두라는 뜻이다. */
function nextRetryDelayMs(attempt, C) {
  C = C || CONSTANTS;
  if (!Number.isFinite(attempt) || attempt < 1) return C.VERIFY_BACKOFF_BASE_MS;
  if (attempt >= C.VERIFY_MAX_ATTEMPTS) return null;
  return Math.min(C.VERIFY_BACKOFF_BASE_MS * Math.pow(2, attempt - 1), C.VERIFY_BACKOFF_MAX_MS);
}

/* ── 상태 어휘 ──────────────────────────────────────────────────────────────
 * ★「하나의 불리언」으로 내지 않는다. 섞으면 만료된 사람이 통과한다.
 *   `cls` = 계획서 §3-1 의 L0~L8 이름(세밀) · `status` = 지디 어휘(거친 분류).
 *   둘을 «같이» 내보내는 이유 = 부르는 쪽이 어느 말을 쓰든 한 곳에서만 정해지게. */
const STATUS_OF = Object.freeze({
  none:           'signature_missing',
  sig_missing:    'signature_missing',
  legacy_grace:   'legacy_grace',
  sig_invalid:    'signature_invalid',
  sub_mismatch:   'signature_invalid',
  clock_rollback: 'locked',
  access_ended:   'access_ended',
  exp_in_grace:   'sig_expired',
  grace_exceeded: 'sig_expired',
  valid:          'signature_ok',
});

/* ── 진단 문자열 ────────────────────────────────────────────────────────────
 * ⛔「sig 없음」과 「검증 실패」를 **같은 문자열에 카운트만 다르게** 적지 않는다.
 *   나중에 «세는 사람»이 둘을 못 가르기 때문이다. 뜻이 완전히 다르다:
 *     · sig 없음(`ent:sig_absent`)  = 옛 사용자(정상) 또는 ★서버 env 미배포(우리 사고)
 *     · 검증 실패(`ent:sig_bad`)    = 위조 시도 또는 ★우리 배포 사고(키·kid 오배포)
 *
 * ★★배포 후 «확인용»으로 세야 하는 상태가 바로 앞의 것이다 —
 *   앱이 «검증을 켠 채» 나갔는데 서버 env 가 «안 깔린» 조합이면 모든 응답에 signed 가 없어
 *   전원이 재검증을 돈다. **기능은 살지만 서명 보호는 0** 이고, 화면상으론 «아무 일도 없다».
 *   ⛔그 상태가 「성공」으로 읽히면 우리는 보호가 0 인 줄 «모른 채» 릴리스를 닫는다.
 *   ⇒ 릴리스 후 `ent:sig_absent` 의 «비율»을 한 번 세는 자리가 필요하다(E2/E3 신고 경로).
 *
 * ⚠️실릴 곳 = 신고의 `errors[]`. 서버는 모르는 «새 필드»(`auth` 같은)를 조용히 버린다(지디 실측)
 *   — 그래서 새 필드가 아니라 기존 배열에 한 줄로 싣는다. 제약: 20건 · 각 1000자.
 * ⛔email·sub·sessionToken·entitlement 원문은 «넣지 않는다».
 */
const DIAG_MAX = 1000;

function diagLine(verdict) {
  const v = verdict || {};
  const d = v.diag || {};
  const tag = v.status === 'signature_missing' ? 'ent:sig_absent'
            : v.status === 'signature_invalid' ? 'ent:sig_bad'
            : `ent:${v.status || 'unknown'}`;
  const parts = [
    tag,
    `cls=${v.cls || '?'}`,
    `pass=${v.pass === true ? 1 : 0}`,
    d.why ? `why=${d.why}` : null,
    d.kid ? `kid=${d.kid}` : null,
    /* ★나이는 «날짜»가 아니라 «일수»로 — 날짜는 사람을 특정하는 쪽으로 쓰인다 */
    Number.isFinite(d.iatAgeDays) ? `iatAge=${d.iatAgeDays}d` : null,
    d.sidMismatch ? 'sid=mismatch' : null,
    d.siglessDeadlinePassed ? 'sigless=after' : null,
    d.serverDocMissing ? 'srvdoc=missing' : null,
    d.serverDocInvalid ? 'srvdoc=invalid' : null,
    d.serverSpoke === false ? 'srv=silent' : null,
  ].filter(Boolean);
  return parts.join(' ').slice(0, DIAG_MAX);
}

/* ── 낮은 층 도구 ──────────────────────────────────────────────────────────── */

/** 서명 블록에서 «서명 대상 문자열»을 꺼낸다. ★받는 이름은 `payload` **하나**다.
 *
 * ★서버 정본(실측): `hompage_app` `feat/entitlement@522412a`
 *   · 모듈 `api/_lib/entitlement-sign.js` · `issue()` = `return { payload: encoded, sig, kid: KID }`
 *   · 이름이 `entitlement`(단수)가 아닌 이유 = 응답 최상위에 이미 `entitlements`(복수)가 있어
 *     `signed.entitlement` 로 두면 «한 글자» 차이가 중첩 안에서 되살아난다.
 *     `payload` 는 「이 문자열이 서명의 대상」임을 이름으로 «말한다».
 *
 * ⛔**`signed.entitlement` 폴백을 «일부러» 두지 않았다 — 빠뜨린 게 아니다.**
 *   짧게 폴백을 뒀던 이유: 서버 규격이 `f333247`(=`entitlement`) → `154abe5`(=`payload`) 로
 *   «한 커밋 사이에» 바뀌었고, 어느 쪽이 나갈지 몰라 골 파일 §6 ⑷ 「둘 다 지원」을 따랐다.
 *   지운 이유: 대성 확인 — **옛 이름은 라이브에 배포된 적이 «없다»**. 나갈 일이 없는 이름을
 *   받아 주면, 규격이 둘인 것처럼 보여 다음 사람이 «어느 쪽이 참인지» 다시 재게 된다.
 *   ⇒ 규격이 하나면 받는 이름도 하나여야 한다. 되살릴 일이 생기면 이 주석을 지우고 되살려라.
 *
 * ★같은 병이 서버 «파일명»에도 있었다(대성 실측): `_lib/entitlements`(판정·복수) 와
 *   `_lib/entitlement`(서명·단수) 가 `session.js` 안에서 «세 줄 간격»으로 나란히 require 됐다.
 *   ⛔오타가 「없는 파일」이면 즉시 터지는데 «둘 다 실재»하면 안 터지고 다르게 동작한다.
 *   ⇒ `entitlement-sign.js` 로 개명됐다. 이 파일에서도 이름은 «하는 일»을 말하게 둔다.
 */
function readSignedText(signed) {
  if (!signed || typeof signed !== 'object') return null;
  if (typeof signed.payload === 'string' && signed.payload) {
    return { text: signed.payload, field: 'payload' };
  }
  return null;
}

/** 세션 토큰 → sid(서버 `_lib/entitlement-sign.js` `issue()` 와 «같은 계산»(@522412a)). */
function sidOf(sessionToken) {
  return crypto.createHash('sha256')
    .update(String(sessionToken), 'utf8')
    .digest('hex')
    .slice(0, 16);
}

/** payload 계약 검사(계획서 §4 E1 ⑴). 통과 = null, 실패 = 'bad_payload'.
 *  ★서버가 규격을 바꾸면(예: iat 를 숫자로) «여기서» 먼저 터진다 — 조용히 통과하지 않는다. */
function contractViolation(p, outerKid) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'bad_payload';
  if (p.ver !== PAYLOAD_VER) return 'bad_payload';
  if (typeof p.kid !== 'string' || p.kid !== outerKid) return 'bad_payload';
  if (p.app !== APP_ID) return 'bad_payload';
  if (typeof p.sub !== 'string' || !p.sub) return 'bad_payload';
  /* ★iat/exp 는 ISO «문자열»이다(서버 `_lib/entitlement-sign.js` `issue()` 의 `toISOString()`).
     초/ms 숫자로 오면 계약 위반 — 「둘 다 받아 준다」로 두면 단위가 섞여 유예가 뒤틀린다. */
  if (typeof p.iat !== 'string' || typeof p.exp !== 'string') return 'bad_payload';
  const iat = Date.parse(p.iat);
  const exp = Date.parse(p.exp);
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return 'bad_payload';
  if (!(exp > iat)) return 'bad_payload';
  /* ★`accessUntil` 은 `null | ISO`. **null = 무기한**(2099 매직넘버 금지 규약).
     ⛔null 을 「파싱 실패 → 만료」로 읽으면 무기한 사용자를 «잠근다». */
  /* ⛔**키가 «아예 없는» 것과 `null` 은 다르다.** null 만 «무기한»이다.
     키 부재를 무기한으로 읽으면, 서버가 필드명을 바꾸는 날 **전원이 무기한**이 된다 —
     계약 검사가 「규격이 바뀌면 여기서 터진다」고 해 놓고 정작 안 터지는 자리였다(적대검수 A7).
     ★막는 줄은 «아래 `!== null` 하나»다 — 초판은 여기에 `&& !== undefined` 가 붙어 있어서
       키가 없으면 검사를 통째로 «건너뛰었다». `hasOwnProperty` 를 따로 두려다 뺐다:
       JSON 입력에선 「키 없음」과 「값 undefined」가 구별되지 않아 «어떤 변이로도 못 죽이는»
       줄이 된다. 검사가 못 지나는 코드는 안 두는 게 낫다. */
  if (p.accessUntil !== null) {
    if (typeof p.accessUntil !== 'string') return 'bad_payload';
    if (!Number.isFinite(Date.parse(p.accessUntil))) return 'bad_payload';
  }
  return null;
}

/**
 * 서명을 검증하고, **통과한 뒤에만** 디코드한다.
 *
 * @param {{payload?:string, entitlement?:string, sig:string, kid:string}|null} signed
 * @param {Record<string,string>} keys  kid → SPKI PEM
 * @returns {{ok:true, payload:object, field:string}|{ok:false, why:string}}
 *   why ∈ 'no_signed' | 'incomplete' | 'unknown_kid' | 'bad_sig' | 'bad_payload'
 *   ★실패면 반환 객체에 `payload` 키가 «없다». (`'payload' in r === false`)
 */
function verifyEntitlement(signed, keys) {
  const got = readSignedText(signed);
  if (!signed) return { ok: false, why: 'no_signed' };
  if (!got || typeof signed.sig !== 'string' || !signed.sig
           || typeof signed.kid !== 'string' || !signed.kid) {
    return { ok: false, why: 'incomplete' };
  }
  const pem = keys && Object.prototype.hasOwnProperty.call(keys, signed.kid)
    ? keys[signed.kid] : null;
  if (!pem) return { ok: false, why: 'unknown_kid' };

  /* ★서명 대상은 «b64url 문자열 그 자체»(utf8 바이트)다 — 디코드한 JSON 이 아니다.
     서버 `_lib/entitlement-sign.js` `verify()` 와 «같은 네 줄». 형식이 깨진 입력은 예외가 아니라 false 로. */
  let ok = false;
  try {
    ok = crypto.verify(
      null,
      Buffer.from(got.text, 'utf8'),
      crypto.createPublicKey(pem),
      Buffer.from(String(signed.sig), 'base64url')
    );
  } catch (_) {
    ok = false;
  }
  if (!ok) return { ok: false, why: 'bad_sig' };

  /* ── 여기서부터가 «검증 뒤» ─────────────────────────────────────────────── */
  let payload;
  try {
    payload = JSON.parse(Buffer.from(got.text, 'base64url').toString('utf8'));
  } catch (_) {
    return { ok: false, why: 'bad_payload' };
  }
  const bad = contractViolation(payload, signed.kid);
  if (bad) return { ok: false, why: bad };
  return { ok: true, payload, field: got.field };
}

/** ㉯(E3-b, 잠그기 전 예고) 전용 — 서명의 `exp` 까지 남은 «일수».
 *
 * ★★이건 «판정»이 «아니다». pass/reject 는 classify/resolveAuth «한 곳»의 몫이고,
 *   이 함수는 그 판정에 관여하지 않는다 — 「화면이 exp 를 직접 해석해 두 번째 판정을
 *   만드는」 사고(지디 §E3-b ㉮ 지적과 같은 종류)를 막으려고 계산 자리를 하나로 둔다.
 *   화면(예: projects.html 배너)은 이 함수가 돌려준 «숫자»만 옮겨 적어야 한다.
 *
 * ★검증된 payload 가 없으면 `null` — 서명이 없거나(legacy_grace 포함) 위조·불일치면
 *   「며칠 남았다」를 계산할 근거 자체가 없다. ⇒ legacy_grace 사용자는 이 값이 항상
 *   `null` 이라 배너 대상에서 «자동으로» 빠진다(별도 분기 없이). 그 사람들의 실제
 *   마감은 `CONSTANTS.SIGLESS_GRACE_UNTIL`(고정 전역 날짜)이지 개인별 `exp` 가 아니라서
 *   같은 배너에 실으면 «틀린 날짜»를 예고하게 된다 — 그래서 여기서 다루지 않는다
 *   (지디 결정 ⒜, 2026-09-06: 이 경로는 온라인 한 번이면 서명본으로 자동 교체돼
 *   해소되므로 겁줄 이유가 없다).
 *
 * ★음수를 돌려줄 수 있다(exp 가 이미 지남 = exp_in_grace/grace_exceeded) — «걸러내는
 *   건 부르는 쪽»이다. 이 함수는 사실만 계산한다.
 *
 * @param {object|null} record  auth.json 레코드(`record.signed` 를 본다)
 * @param {Record<string,string>} keys
 * @param {number} [now] ms — 생략하면 Date.now()
 * @returns {number|null} 정수 일수(음수 가능). 계산 불가면 null.
 */
function daysUntilSigStale(record, keys, now) {
  const v = verifyEntitlement(record && record.signed, keys);
  if (!v.ok) return null;
  const exp = Date.parse(v.payload.exp);
  if (!Number.isFinite(exp)) return null;
  const t = Number.isFinite(now) ? now : Date.now();
  return Math.ceil((exp - t) / DAY_MS);
}

/* ── 로컬 분류 (순수·동기) ──────────────────────────────────────────────────
 * 계획서 §3-1 표. **순서가 곧 우선순위다** — 특히 L5(accessUntil) 가 L6(exp) «앞»이다.
 */

/** @param {object|null} record  auth.json 레코드
 *  @param {number} now          ms
 *  @param {Record<string,string>} keys
 *  @param {object} C            상수(CONSTANTS 또는 그 변형)
 *  @returns {{cls, status, pass, screen, reason, needsVerify, diag, payload?}} */
function classify(record, now, keys, C) {
  C = C || CONSTANTS;
  const diag = {};

  // L0 — 기록 없음
  if (!record || typeof record !== 'object' || !record.email) {
    return out('none', false, 'login', 'no_record', null, diag);
  }

  const v = verifyEntitlement(record.signed || null, keys);

  // L1 — 서명이 없다(또는 3필드가 덜 왔다)
  if (!v.ok && (v.why === 'no_signed' || v.why === 'incomplete')) {
    diag.why = v.why;
    const deadline = Date.parse(C.SIGLESS_GRACE_UNTIL);
    const beforeDeadline = Number.isFinite(deadline) && now < deadline;
    /* ★옛 규칙 = 지금 `main.js:425 authAccessValid` 가 하는 «그것». 마감 전에만 인정한다.
       ⇒ 이번 변경에서 «가장 많은 사람»(옛 auth.json 전원)이 개입 0 으로 지나는 길이다. */
    const legacyOk = legacyAccessValid(record.accessUntil, now);
    diag.legacyOk = legacyOk;
    diag.siglessDeadlinePassed = !beforeDeadline;
    if (beforeDeadline && legacyOk) {
      /* 통과시키되 «반드시» 서명본으로 교체해야 한다 → 백그라운드 verify. */
      return out('legacy_grace', true, 'editor', 'sigless_legacy_grace', 'background', diag);
    }
    /* 마감 후이거나 옛 규칙도 못 넘으면 = 확인 필요(R).
       ★여기가 「오늘의 해킹 파일(accessUntil=2099·sig 없음)」이 마감 후 오프라인에서 막히는 자리다. */
    return out('sig_missing', false, 'verify', 'sigless_needs_verify', 'blocking', diag);
  }

  // L2 — 검증 실패(모르는 kid · 서명 불일치 · 디코드/계약 위반)
  if (!v.ok) {
    diag.why = v.why;
    /* ⛔여기서 payload 를 안 만든다. 반환 객체에 `payload` 키가 «없어야» 한다. */
    return out('sig_invalid', false, 'verify', 'signature_invalid', 'blocking', diag);
  }

  const p = v.payload;
  diag.kid = p.kid;
  diag.field = v.field;
  diag.iat = p.iat;

  /* L2.5 — sid 대조. ★★서버가 앱 규약을 «명시»했다(`_lib/entitlement-sign.js` 의 sid 주석 @522412a):
     「sid 가 안 맞으면 «위조»가 아니라 «없음»으로 다뤄 재검증해라 —
       정상 재로그인이면 토큰이 바뀌어 옛 서명의 sid 가 «당연히» 안 맞는다.
       즉시 거부로 처리하면 재로그인한 사람이 전부 잠긴다.」
     ⇒ 그래서 L2(거부)가 아니라 L1(없음) «과 같은 경로»로 보낸다. 방향이 반대인 자리다.
     ⚠️sid 가 없는 서명본(f333247 이전 규격)은 «건너뛴다» — 없는 걸 불일치로 읽으면 전원 재검증. */
  if (typeof p.sid === 'string' && p.sid && record.sessionToken) {
    if (sidOf(record.sessionToken) !== p.sid) {
      diag.sidMismatch = true;
      const deadline = Date.parse(C.SIGLESS_GRACE_UNTIL);
      const beforeDeadline = Number.isFinite(deadline) && now < deadline;
      if (beforeDeadline && legacyAccessValid(record.accessUntil, now)) {
        return out('legacy_grace', true, 'editor', 'sid_mismatch_regrace', 'background', diag);
      }
      return out('sig_missing', false, 'verify', 'sid_mismatch_needs_verify', 'blocking', diag);
    }
  }

  // L3 — sub 핀 불일치(직전 저장본의 sub 와 다르다)
  if (record.sub && p.sub !== record.sub) {
    diag.why = 'sub_mismatch';
    return out('sub_mismatch', false, 'verify', 'sub_mismatch', 'blocking', diag, p);
  }

  // L4 — 시계 되돌림
  const iat = Date.parse(p.iat);
  if (now < iat - C.ROLLBACK_TOL_MS) {
    diag.why = 'clock_rollback';
    return out('clock_rollback', false, 'verify', 'clock_rollback', 'blocking', diag, p);
  }

  /* L5 — ★구독이 끝났나. **`exp` 보다 «먼저» 본다**(계획서 §8 구멍 ①).
     서버는 `exp = iat + TTL` 로 «고정» 발급하고 구독 종료일과 무관하다 —
     순서를 바꾸면 내일 해지되는 사람이 서명 신선도만 믿고 44일을 더 쓴다.
     ★`accessUntil === null` = «무기한» → 이 행을 «건너뛴다».
     ⛔**명시적으로 분기한다.** `Date.parse(null)` 이 NaN 이라 «우연히» 통과하기도 하지만
       그건 우연이지 규칙이 아니다 — 쓰레기 값도 똑같이 NaN 이 되는데 그건 «거부»해야 한다.
       우연에 기대면 둘이 같은 길로 가고, 그때 무기한 사용자가 잠긴다. */
  if (p.accessUntil !== null) {
    const until = Date.parse(p.accessUntil);
    if (!Number.isFinite(until)) {
      /* 계약 검사가 이미 걸러 여기 오지 않는 게 정상이다. 그래도 «통과 쪽»으로는 절대 안 보낸다. */
      diag.why = 'access_unparsable';
      return out('access_ended', false, 'expired', 'access_unparsable', 'blocking', diag, p);
    }
    if (now > until + C.CLOCK_SKEW_MS) {
      diag.why = 'access_ended';
      diag.accessUntil = p.accessUntil;
      /* 만료엔 유예가«없다» — 구독 종료는 서버가 «서명한 사실»이다. */
      return out('access_ended', false, 'expired', 'access_ended', 'blocking', diag, p);
    }
  } else {
    diag.perpetual = true;   // 무기한
  }

  // L6 — 서명은 상했지만 유예 안
  const exp = Date.parse(p.exp);
  if (now > exp + C.CLOCK_SKEW_MS && now < iat + C.GRACE_DAYS * DAY_MS) {
    diag.why = 'sig_stale';
    return out('exp_in_grace', true, 'editor', 'sig_expired_in_grace', 'background', diag, p);
  }

  // L7 — 유예 밖
  if (now > iat + C.GRACE_DAYS * DAY_MS) {
    diag.why = 'grace_exceeded';
    return out('grace_exceeded', false, 'verify', 'grace_exceeded', 'blocking', diag, p);
  }

  // L8 — 신선
  return out('valid', true, 'editor', null, 'background', diag, p);
}

/** 옛 규칙 — 지금 `main.js:425 authAccessValid` 와 «같은 계산». 서명 없는 기록에만 쓴다. */
function legacyAccessValid(accessUntil, now) {
  const t = Date.parse(accessUntil);
  return Number.isFinite(t) && t > now;
}

/** 분류 결과 조립. ★`payload` 는 «검증을 통과했을 때만» 키가 생긴다(조건부 스프레드). */
function out(cls, pass, screen, reason, needsVerify, diag, payload) {
  return {
    cls,
    status: STATUS_OF[cls] || 'locked',
    pass,
    screen,
    reason,
    needsVerify,
    diag,
    ...(payload ? { payload } : {}),
  };
}

/* ── 서버 답 적용 (계획서 §3-2) ─────────────────────────────────────────────
 * 「온라인 응답이 캐시를 이긴다」를 «코드»로. 순수 — record 를 «새 객체»로 돌려준다.
 */

/**
 * @param {object|null} record  현재 저장본
 * @param {object|null} r       verifySession 결과. **null = 「서버가 말을 안 했다」**
 * @param {{now:number, keys:object, C:object}} ctx
 * @returns {{record:object|null, clear:boolean, changed:boolean, diag:object}}
 */
function applyServerAnswer(record, r, ctx) {
  const now = ctx && Number.isFinite(ctx.now) ? ctx.now : Date.now();
  const keys = (ctx && ctx.keys) || PUBLIC_KEYS;
  const diag = {};
  const base = record && typeof record === 'object' ? record : null;

  /* ⑴ 「말을 안 함」(네트워크·404·5xx·**429**·형식 불량) → **아무것도 안 바꾼다.**
     ★유예는 «여기»에만 있다. verifySession 이 이미 「말함/말 안 함」을 갈라 놨으니
     ⛔그 함수 «위»에 새 구분을 만들지 않는다 — 두 군데가 되면 갈라진다. */
  if (r === null || r === undefined) {
    diag.serverSpoke = false;
    return { record: base, clear: false, changed: false, diag };
  }
  diag.serverSpoke = true;

  // ⑵ 세션이 죽었다 → 지운다(지금 동작 그대로)
  if (r.ok === false && (r.reason === 'invalid_session' || r.reason === 'email_not_verified')) {
    diag.cleared = r.reason;
    return { record: null, clear: true, changed: true, diag };
  }

  const v = verifyEntitlement(r.signed || null, keys);

  // ⑶ ok:true
  if (r.ok === true) {
    if (v.ok) {
      /* ★단조 규칙 — `new.iat ≥ stored.iat` 일 때만 교체.
         더 «옛» 서명본으로는 절대 안 내려간다(리플레이). */
      const prev = verifyEntitlement(base && base.signed, keys);
      const prevIat = prev.ok ? Date.parse(prev.payload.iat) : -Infinity;
      const nextIat = Date.parse(v.payload.iat);
      if (nextIat < prevIat) {
        diag.rejectedOlderSignature = true;
        return { record: base, clear: false, changed: false, diag };
      }
      diag.replaced = true;
      diag.field = v.field;
      return { record: fromPayload(base, r.signed, v.payload), clear: false, changed: true, diag };
    }
    /* ok:true 인데 서명이 없거나(서버 서명 실패 = «우리 배포 사고») 검증을 못 넘었다.
       ★서버가 정한 규약 = 「ok:true 인데 signed 없으면 통과」(`session.js:35-37`).
       위조자는 서버에게서 ok:true 를 «못 받는다» — 그게 이 규약이 안전한 이유다.
       ⇒ 이 세션은 통과. plain 만 갱신하고 **옛 서명본은 유지**한다. */
    diag[v.why === 'no_signed' ? 'serverDocMissing' : 'serverDocInvalid'] = true;
    diag.why = v.why;
    return { record: withPlain(base, r), clear: false, changed: true, diag };
  }

  // ⑷ ok:false + expired
  if (r.ok === false && r.reason === 'expired') {
    if (v.ok) {
      /* 서버는 «만료된 사용자에게도» 서명해서 준다 — 그 서명본을 저장한다.
         다음 판정에서 L5(access_ended)로 간다. 이게 «정상» 경로다. */
      diag.storedExpiredSignature = true;
      return { record: fromPayload(base, r.signed, v.payload), clear: false, changed: true, diag };
    }
    /* ★서명 없이 expired = 서버 서명 실패 때의 «폴백».
       ⛔저장된 서명본을 «삭제»한다. 안 지우면 옛 서명본이 exp 까지 L8 로 «통과»해서
         취소·환불한 사용자가 오프라인으로 30일을 더 쓴다. */
    diag.droppedSignature = true;
    const next = withPlain(base, r);
    if (next) {
      delete next.signed;
      /* ★★서버가 `accessUntil` 을 «안 실어 주면» plain 이 «그대로» 남는다 —
         그러면 2099 로 고쳐 둔 파일이 서명 삭제 뒤에도 옛 규칙으로 통과한다.
         ⛔지금 안 열려 있는 이유가 「서버가 expired 응답에도 accessUntil 을 싣기 때문」인데,
           그건 «남의 코드에 기댄 안전»이다 — 서버가 그 필드를 빼는 날 조용히 열린다.
         ⇒ 기대지 않는다. 안 주면 «지금»으로 박아 끝난 것으로 만든다(적대검수 판정불가 항목). */
      if (!r.accessUntil) next.accessUntil = new Date(now).toISOString();
    }
    return { record: next, clear: false, changed: true, diag };
  }

  // ⑸ 그 밖의 ok:false — 판단을 바꾸지 않는다(모르는 reason 에 임의 처분 금지)
  diag.unhandledReason = r.reason || 'unknown';
  return { record: base, clear: false, changed: false, diag };
}

/** 서명본 저장 — ★`signed` 는 «받은 그대로»(바이트 동일). plain 은 **payload 에서 파생**.
 *  ⛔응답의 plain 값을 쓰지 않는다 — 그러면 서명본과 plain 이 «따로» 논다. */
function fromPayload(base, signed, payload) {
  return {
    ...(base || {}),
    email: payload.email || (base && base.email) || '',
    plan: payload.plan || '',
    /* ★null(무기한)을 «그대로» 보존한다. `|| ''` 로 뭉개면 무기한이 «빈 문자열 = 만료»가 된다. */
    accessUntil: payload.accessUntil === undefined ? null : payload.accessUntil,
    sub: payload.sub,
    signed,
  };
}

/** 서명 없이 plain 만 갱신. ⛔`accessUntil` 의 null 을 «만들지도 지우지도» 않는다. */
function withPlain(base, r) {
  if (!base) return base;
  const next = { ...base };
  if (r.plan !== undefined && r.plan !== null && r.plan !== '') next.plan = r.plan;
  if (r.accessUntil !== undefined) next.accessUntil = r.accessUntil;
  return next;
}

/* ── SSOT 진입점 ────────────────────────────────────────────────────────────
 * 에디터 진입 «모든» 자리가 이 답을 쓴다. 로컬 분류(동기) → 필요하면 네트워크(비동기).
 */

/**
 * @param {object|null} record
 * @param {{verify:Function, now?:number, keys?:object, C?:object, allowNetwork?:boolean}} ctx
 *   `verify` 는 «주입»한다 — 테스트=가짜, 실물=authService.verifySession 래퍼.
 * @returns {Promise<{pass, screen, reason, cls, status, record, diag, backgroundVerify}>}
 */
async function resolveAuth(record, ctx) {
  ctx = ctx || {};
  const now = Number.isFinite(ctx.now) ? ctx.now : Date.now();
  const keys = ctx.keys || PUBLIC_KEYS;
  const C = ctx.C || CONSTANTS;
  const allowNetwork = ctx.allowNetwork !== false;

  const local = classify(record, now, keys, C);

  /* ★로컬이 통과면 «즉시» 돌려준다 — 네트워크를 «한 번도» 기다리지 않는다.
     그게 2026-08-05(백엔드 다운에 전원 잠김)의 약속이다.
     갱신은 부르는 쪽이 `backgroundVerify` 를 보고 «비차단»으로 돈다. */
  if (local.pass) {
    return { ...local, record, backgroundVerify: local.needsVerify === 'background', local: local.cls };
  }

  // 통과 못 했다 → 서버에게 물어볼 수 있으면 «여기서» 묻는다(부팅 경로가 아니라 R 화면에서 부른다)
  if (!allowNetwork || typeof ctx.verify !== 'function') {
    return { ...local, record, backgroundVerify: false, local: local.cls };
  }

  let r = null;
  try {
    r = await withTimeout(ctx.verify(record), C.VERIFY_TIMEOUT_MS, ctx.setTimeout, ctx.clearTimeout);
  } catch (_) {
    r = null;   // 던져도 「말을 안 했다」와 같이 다룬다
  }

  const applied = applyServerAnswer(record, r, { now, keys, C });
  if (applied.clear || !applied.record) {
    return {
      cls: 'none', status: 'signature_missing', pass: false, screen: 'login',
      reason: applied.diag.cleared || 'no_record',
      record: null, diag: { ...local.diag, ...applied.diag }, backgroundVerify: false, local: local.cls,
    };
  }

  /* 서버 답을 반영한 «새» 기록으로 다시 분류한다.
     ★서버가 「말을 안 했다」면 record 가 그대로라 결과도 그대로 — 유예가 유지된다. */
  const after = classify(applied.record, now, keys, C);

  /* ★★서버가 `ok:true` 라고 «말했는데도» 로컬이 막는 경우 — 어디까지 살릴 것인가.
   *
   * ⛔초판은 이걸 «cls 목록»(sig_invalid·sig_missing)으로 적었고, 그게 **틀렸다**.
   *   적대검수(fable) 실측으로 「우리 실수 → 전원 잠금」이 네 갈래 재현됐다:
   *     ⑴ 갱신 결제한 사용자 + 서명 env 미배포 → access_ended 로 REJECT
   *     ⑵ env 깨진 채 45일 → 서명본 가진 «전원» grace_exceeded REJECT (온라인인데)
   *     ⑶ 키 로테이션이 앱 업데이트보다 먼저 → REJECT
   *     ⑷ 시계가 24h 이상 느린 사용자 → 온라인인데 clock_rollback REJECT
   *   계획서 §3-1 의 L4「서버 OK → 통과(서버 시각이 정본)」·L3「L2 와 동일 경로」와도 반대였다.
   *
   * ★고친 규칙 — 「무엇을 못 했나」로 가른다(「무슨 상태였나」가 아니라):
   *   ㉮ **새 서명본을 «못 썼다»**(serverDocMissing/Invalid) = 우리 배포 사고의 «모양».
   *      서버는 좋다고 하는데 우리가 그 진술을 못 받아 적은 것이라 사용자 탓이 아니다.
   *   ㉯ **`clock_rollback`** — 이건 «자격» 얘기가 아니라 «로컬 시계» 얘기다.
   *      서버가 답했다는 건 정본 시각을 얻었다는 뜻이므로 로컬 시계로 잠글 이유가 없다.
   *   ㉰ **`sub_mismatch`** — 계획서 L3 이 「L2 와 같은 경로」로 정해 뒀다(핀은 약한 신호다).
   *
   * ⛔**「ok:true 면 무조건 통과」로 넓히지 «않는다».** 서버가 «유효한 새 서명본»을 줬는데
   *   그게 `access_ended` 라고 말하면 그건 서명된 사실이라 그쪽이 이긴다 — 만료 서명본은 안 연다.
   *   즉 ㉮ 는 「서명본을 못 받았을 때」로 «한정»된다. 그 경계를 검사가 잠근다. */
  const couldNotStoreSignature = !!(applied.diag.serverDocMissing || applied.diag.serverDocInvalid);
  const timeOrPinOnly = after.cls === 'clock_rollback' || after.cls === 'sub_mismatch';
  if (!after.pass && r && r.ok === true && (couldNotStoreSignature || timeOrPinOnly)) {
    return {
      ...after, pass: true, screen: 'editor', reason: 'server_vouched',
      record: applied.record, backgroundVerify: false, local: local.cls,
      diag: { ...after.diag, ...applied.diag, serverVouched: true },
    };
  }

  return {
    ...after,
    record: applied.record,
    backgroundVerify: false,
    local: local.cls,
    diag: { ...after.diag, ...applied.diag },
  };
}

/** ⛔모든 대기에 상한. 상한을 넘으면 「말을 안 했다」(null)로 떨어진다 — 잠그지 않는다. */
function withTimeout(promise, ms, setT, clearT) {
  const _set = setT || setTimeout;
  const _clear = clearT || clearTimeout;
  let timer = null;
  return Promise.race([
    Promise.resolve(promise).then(v => { if (timer) _clear(timer); return v; },
                                  e => { if (timer) _clear(timer); throw e; }),
    new Promise(resolve => { timer = _set(() => resolve(null), ms); }),
  ]);
}

/* ── dev 전용 키 주입 ────────────────────────────────────────────────────────
 * `isAdminAuthorized`(main.js:439) 와 «같은 규약»: 미패키징에서만 허용, 패키징에선 «무시».
 * ⛔패키징에서 살려 두면 사용자가 자기 공개키를 넣고 자기가 서명한다 = 이 파일 전체가 장식.
 */
function resolveKeys(opts) {
  const o = opts || {};
  if (o.isPackaged !== false) return PUBLIC_KEYS;          // 기본은 «막는» 쪽
  const raw = o.env && o.env.GODITOR_ENTITLEMENT_PUBKEY;
  if (!raw) return PUBLIC_KEYS;
  const pem = String(raw).includes('-----BEGIN')
    ? String(raw)
    : `-----BEGIN PUBLIC KEY-----\n${String(raw)}\n-----END PUBLIC KEY-----\n`;
  try {
    crypto.createPublicKey(pem);   // 못 읽으면 «무시»한다(상수 키를 지우지 않는다)
  } catch (_) {
    return PUBLIC_KEYS;
  }
  return { ...PUBLIC_KEYS, [o.kid || 'k1']: pem };
}

module.exports = {
  APP_ID,
  PAYLOAD_VER,
  PUBLIC_KEYS,
  KEY_PROVENANCE,
  PLACEHOLDER_MARK,
  CONSTANTS,
  STATUS_OF,
  verifyEntitlement,
  daysUntilSigStale,
  classify,
  applyServerAnswer,
  resolveAuth,
  resolveKeys,
  readSignedText,
  diagLine,
  nextRetryDelayMs,
  sidOf,
  legacyAccessValid,
  contractViolation,
};
