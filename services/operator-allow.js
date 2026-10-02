'use strict';
/* 배포판 «운영자(admin)» 허가 — 서명된 allow 파일 검증. 앱 쪽 «순수 모듈».
 *
 * ★이 파일이 하는 일 = 「입력을 주면 판정을 돌려준다」. 그것뿐이다.
 *   파일 I/O 0 · electron 의존 0 · 전역 상태 0 · `now`·`machineId`·키도 주입받는다.
 *   파일 읽기는 main.js(isAdminAuthorized)가 한다. 기기 UUID 읽기(rawMachineUuid)도 exec/read 를
 *   «주입받아서»만 한다 — 앱과 발급 CLI(tools/operator-allow/issue.mjs)가 «같은» 원천을 쓰게 하려고 여기 둔다.
 *
 * ★왜 서명인가 (0919 3라운드 adminsig)
 *   옛 판정 = 'admin' 인자 + env GODITOR_ADMIN_TOKEN 의 sha256 == userData/admin.allow.
 *   셋 다 사용자 PC 에서 사용자가 정한다 — 아무 문자열의 sha256 을 파일에 쓰면 누구나 운영자였다
 *   (라이선스 게이트 GAP-008·터미널/PM IPC GAP-010 우회). 대칭 비교는 «누가 발급했나»를 증명 못 한다.
 *   ⇒ 운영자 개인키(레포·앱 밖)로 서명한 파일만 인정한다.
 *
 * ★★키는 entitlement(k1)와 «분리»한다 (kid 'op1')
 *   k1 개인키는 EC2 에만 있고 서버 밖으로 안 꺼낸다(entitlement.js 규약). 로컬 CLI 로 서명하려면
 *   운영자 전용 키쌍이 따로 있어야 한다. 키가 다르면 사용자 auth.json 의 서명본(k1)이 운영자 허가로
 *   통하는 «교차 수용»이 구조적으로 안 생긴다. 그래도 payload.typ 검사를 한 번 더 둔다 —
 *   누가 나중에 키 맵을 합쳐도 entitlement payload(typ 없음)는 여기서 거부된다.
 *
 * ★규율 (entitlement.js 와 같다)
 *   ⑴ 서명 대상 = b64url payload «문자열 그 자체»의 utf8 바이트. `crypto.verify(null, …)`.
 *   ⑵ 서명 검증이 통과한 «뒤에만» 디코드한다. 실패 반환 객체엔 `payload` 키가 «아예 없다».
 *
 * ⛔「막았다」가 아니다. asar 는 묶음이라 코드를 고쳐 다시 묶으면 우회된다(entitlement 와 같은 한계).
 *   오프라인 시계 되돌리기로 exp 를 넘기는 것도 못 막는다 — 그래서 TTL 상한(31일)으로 피해 폭을 묶는다.
 *   올리는 문턱 = 「파일 두 개 쓰기(1분)」 → 「asar 풀고 코드 고쳐 다시 묶기」.
 */
const crypto = require('crypto');

const TYP = 'goditor-operator-allow';
const VER = 1;
const APP_ID = 'goditor';
const MACHINE_SALT = 'goditor-operator-v1:';

/* ── 공개키 ─────────────────────────────────────────────────────────────────
 * ⛔코드 상수다. userData·env 에서 받지 않는다(받으면 사용자가 자기 키로 자기가 서명한다).
 * ★초기값 = «비어 있음». 실키가 없으면 배포판 운영자 모드는 «항상 꺼짐»(safe-by-default).
 *   실키 등록 절차 = tools/operator-allow/README.md (keygen → 공개 PEM 을 여기 op1 로 → PROVENANCE 갱신).
 * ⛔entitlement.PUBLIC_KEYS 와 kid·PEM 이 겹치면 안 된다(tests/unit/operator-allow.test.mjs 가 잰다). */
const OPERATOR_PUBLIC_KEYS = Object.freeze({});

/** 'unset' | 'verified-YYYY-MM-DD'. tools/deploy-gate.js 가 «경고만» 한다
 *  (키가 없으면 운영자 없음으로 안전하게 동작하므로 배포를 막을 이유는 없다). */
const OPERATOR_KEY_PROVENANCE = 'unset';

const CONSTANTS = Object.freeze({
  /** exp - iat 상한(일). 발급자 실수로 «무기한»이 되는 걸 막는다. */
  MAX_TTL_DAYS: 31,
  /** iat 미래 허용 오차(시계 여유). ⛔exp 쪽엔 주지 않는다. */
  SKEW_MS: 5 * 60 * 1000,
});

const DAY_MS = 24 * 60 * 60 * 1000;
const B64URL = /^[A-Za-z0-9_-]+$/;
const HEX64 = /^[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** 기기 UUID(원문) → machine 해시. ⛔원문 UUID 는 파일에 안 남긴다. 못 읽었으면 null. */
function machineIdFrom(rawUuid) {
  const s = typeof rawUuid === 'string' ? rawUuid.trim() : '';
  if (!s) return null;
  return crypto.createHash('sha256').update(MACHINE_SALT + s.toUpperCase(), 'utf8').digest('hex');
}

/** 윈도우 reg.exe «절대경로». ⛔PATH 로 찾지 않는다 — PATH 앞에 가짜 reg.exe 를 두면 기기 해시를 마음대로
 *  바꿔 치울 수 있다(유출된 allow 파일 재사용). 기본은 C:\Windows\System32\reg.exe. 윈도우가 다른 드라이브에
 *  깔린 경우만 SystemRoot 를 쓰되, 모양이 «드라이브:\Windows» 일 때만 받는다(아무 폴더나 가리키지 못하게).
 *  그래도 env 는 사용자 손이다 — 목적은 «PATH 한 줄로 끝나던 것»을 막는 데까지(VM·UUID 스푸핑은 원래 한계).
 *  못 찾으면 null(= 운영자 아님). */
function winRegExePath(io) {
  const { existsSync, env } = io || {};
  const cands = ['C:\\Windows\\System32\\reg.exe'];
  const root = env && typeof env.SystemRoot === 'string' ? env.SystemRoot.trim() : '';
  if (/^[A-Za-z]:\\Windows$/i.test(root)) cands.push(root + '\\System32\\reg.exe');
  for (const c of cands) {
    try { if (typeof existsSync === 'function' && existsSync(c)) return c; } catch (_) {}
  }
  return null;
}

/** 기기 UUID 원문 읽기 — I/O 는 «주입»받는다(execFileSync·readFileSync·existsSync·env). 못 읽으면 null(= 운영자 아님).
 *  mac: /usr/sbin/ioreg 의 IOPlatformUUID · win: 절대경로 reg.exe 로 HKLM\SOFTWARE\Microsoft\Cryptography MachineGuid
 *  · 그 밖: /etc/machine-id. ★실행 파일은 전부 절대경로(PATH 불신). */
function rawMachineUuid(io) {
  const { platform, execFileSync, readFileSync } = io || {};
  const opt = { encoding: 'utf8', timeout: 3000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] };
  try {
    if (platform === 'darwin') {
      const m = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(String(execFileSync('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], opt)));
      return m ? m[1] : null;
    }
    if (platform === 'win32') {
      const reg = winRegExePath(io);
      if (!reg) return null;
      const m = /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(String(execFileSync(reg, ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], opt)));
      return m ? m[1] : null;
    }
    const t = String(readFileSync('/etc/machine-id', 'utf8')).trim();
    return t || null;
  } catch (_) {
    return null;
  }
}

function _isoMs(v) {
  if (typeof v !== 'string' || !ISO.test(v)) return NaN;
  return Date.parse(v);
}

/** payload 규약 위반이면 이유 문자열, 맞으면 null. */
function _contractViolation(p, outerKid) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'bad_payload';
  if (p.typ !== TYP) return 'bad_payload';
  if (p.ver !== VER) return 'bad_payload';
  if (p.kid !== outerKid) return 'bad_payload';
  if (p.app !== APP_ID) return 'bad_payload';
  if (typeof p.machine !== 'string' || !HEX64.test(p.machine)) return 'bad_payload';
  if (!Number.isFinite(_isoMs(p.iat)) || !Number.isFinite(_isoMs(p.exp))) return 'bad_payload';
  if (p.note !== undefined && typeof p.note !== 'string') return 'bad_payload';
  return null;
}

/**
 * 서명을 검증하고, «통과한 뒤에만» 디코드한다.
 * @param {string} fileText  operator.allow 파일 내용(JSON: {kid,payload,sig})
 * @param {Record<string,string>} keys  kid → SPKI PEM
 * @returns {{ok:true,payload:object}|{ok:false,why:string}}
 *   why ∈ no_file|bad_json|incomplete|unknown_kid|bad_sig|bad_payload. 실패면 `'payload' in r === false`.
 */
function verifyOperatorAllow(fileText, keys) {
  if (typeof fileText !== 'string') return { ok: false, why: 'no_file' };
  /* UTF-8 BOM 은 벗긴다 — 윈도우 PowerShell 5 의 Set-Content/Out-File -Encoding UTF8 이 붙인다.
     BOM 은 JSON 바깥 한 글자라 서명 대상(payload 문자열)에 안 들어간다 → 벗겨도 검증 강도는 그대로. */
  fileText = fileText.replace(/^\uFEFF/, '');
  if (!fileText.trim()) return { ok: false, why: 'no_file' };
  let doc;
  try { doc = JSON.parse(fileText); } catch (_) { return { ok: false, why: 'bad_json' }; }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, why: 'incomplete' };
  const { kid, payload, sig } = doc;
  if (typeof kid !== 'string' || !kid || typeof payload !== 'string' || !B64URL.test(payload)
      || typeof sig !== 'string' || !B64URL.test(sig)) {
    return { ok: false, why: 'incomplete' };
  }
  const pem = keys && Object.prototype.hasOwnProperty.call(keys, kid) ? keys[kid] : null;
  if (typeof pem !== 'string' || !pem) return { ok: false, why: 'unknown_kid' };

  let ok = false;
  try {
    ok = crypto.verify(null, Buffer.from(payload, 'utf8'), crypto.createPublicKey(pem),
      Buffer.from(sig, 'base64url'));
  } catch (_) { ok = false; }
  if (!ok) return { ok: false, why: 'bad_sig' };

  /* ── 여기서부터가 «검증 뒤» ── */
  let p;
  try { p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (_) {
    return { ok: false, why: 'bad_payload' };
  }
  const bad = _contractViolation(p, kid);
  if (bad) return { ok: false, why: bad };
  return { ok: true, payload: p };
}

/**
 * 판정 = 서명 + 기한 + 기기. ⛔`payload` 를 밖으로 내보내지 않는다(판정만).
 * @param {{fileText:string, keys:object, machineId:string|null, now:number}} o
 * @returns {{ok:boolean, why:string|null}}
 */
function checkOperatorAllow(o) {
  const { fileText, keys, machineId, now } = o || {};
  const v = verifyOperatorAllow(fileText, keys);
  if (!v.ok) return { ok: false, why: v.why };
  const p = v.payload;
  if (!Number.isFinite(now)) return { ok: false, why: 'bad_payload' };
  const iat = _isoMs(p.iat);
  const exp = _isoMs(p.exp);
  if (!(exp > iat)) return { ok: false, why: 'bad_payload' };
  if (exp - iat > CONSTANTS.MAX_TTL_DAYS * DAY_MS) return { ok: false, why: 'ttl_too_long' };
  if (iat > now + CONSTANTS.SKEW_MS) return { ok: false, why: 'not_yet' };
  if (!(now < exp)) return { ok: false, why: 'expired' };
  if (typeof machineId !== 'string' || !HEX64.test(machineId)) return { ok: false, why: 'no_machine' };
  const a = Buffer.from(p.machine, 'hex');
  const b = Buffer.from(machineId, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, why: 'machine_mismatch' };
  return { ok: true, why: null };
}

/**
 * 거부 «안내» 문구 — 판정과 무관(판정은 checkOperatorAllow 뿐). 배포판을 'admin' 인자로 띄웠는데 거부됐을 때,
 * 조용히 고객 화면으로 보내지 말고 «운영자 권한이 없는 실행»임을 알리려고 쓴다(0919 T-063).
 * ★0920 4라운드(pkgguard): 화면(title/detail)에서 내부 경로(README)·파일명(operator.allow·admin.allow)·
 *   변수명(GODITOR_ADMIN_TOKEN)·공개키 유무를 «뺐다» — 화면은 누구나 보는 곳이라 우회 지도가 된다.
 *   상세는 로그(log)에만 남긴다. 화면엔 사유 «코드»만(운영자가 로그 없이도 문의를 받을 수 있게).
 * @param {{why:string, legacy:boolean, keysConfigured:boolean}} o
 *   legacy = 옛 방식 흔적(userData/admin.allow 또는 env GODITOR_ADMIN_TOKEN)이 있다. ⛔로그에만 쓴다.
 * @returns {{log:string, title:string, detail:string}}
 */
function operatorDeniedNotice(o) {
  const { why, legacy, keysConfigured } = o || {};
  const w = typeof why === 'string' && /^[a-z_]{1,32}$/.test(why) ? why : 'unknown';
  const detail = [
    '운영자 권한이 없는 실행입니다. 일반(라이선스) 실행으로 계속합니다.',
    '필요하면 운영자에게 문의하세요.',
    '(코드: ' + w + ')',
  ].join('\n');
  return {
    log: '[admin] 배포판 운영자 허가 거부 — operator.allow: ' + w
      + (legacy ? ' · 옛 admin.allow/GODITOR_ADMIN_TOKEN 무효(서명 operator.allow 필요)' : '')
      + (keysConfigured ? '' : ' · 운영자 공개키 없음(이 빌드는 운영자 모드 불가)')
      + ' · 발급·설치 절차: tools/operator-allow/README.md',
    title: '운영자 권한이 없는 실행입니다',
    detail,
  };
}

module.exports = {
  TYP,
  VER,
  APP_ID,
  MACHINE_SALT,
  OPERATOR_PUBLIC_KEYS,
  OPERATOR_KEY_PROVENANCE,
  CONSTANTS,
  machineIdFrom,
  rawMachineUuid,
  winRegExePath,
  operatorDeniedNotice,
  verifyOperatorAllow,
  checkOperatorAllow,
};
