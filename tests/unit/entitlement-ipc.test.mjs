/* entitlement-ipc — main.js 의 «진짜» IPC 핸들러로 자격증명 배선을 잰다.
 *
 * ★흉내낸 핸들러는 「내 흉내」를 검증한다. 배선 오타·필드 증발은 그런 검사를 전부 통과한다.
 *   그래서 `_ipc-harness.js` 로 main.js 를 통째로 적재하고 «등록된 핸들러»를 부른다.
 *
 * ★★이 파일이 «따로» 잡는 두 가지 — ⛔하나로 묶으면 어느 쪽이 깨졌는지 못 가른다:
 *     U-ENT-B1  = **H-B** (`readAuth` 가 `!raw.accessUntil` 로 «판정»까지 하던 것)
 *     U-ENT-B2  = **H-A②** (`writeAuth` 의 `String(record.accessUntil || '')`)
 *   짝인 H-A①(`verifySession`)은 `entitlement-authservice.test.mjs` 가 잡는다.
 *
 * ⛔네트워크 0 — authService 를 require.cache 에 «미리» 심어 main.js 가 그걸 받게 한다.
 * ⛔라이브 userData 무접촉 — 하네스가 임시 디렉터리로 강제한다.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

/* ── 테스트 키쌍: «실행 시» 생성한다. ⛔개인키를 파일로 두지 않는다(배포 게이트 규약). ── */
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB_PEM = publicKey.export({ type: 'spki', format: 'pem' });
/* dev(!isPackaged)에서만 먹는 주입 경로 — 하네스의 app.isPackaged 는 false 다. */
process.env.GODITOR_ENTITLEMENT_PUBKEY = PUB_PEM;

const ent = require('../../services/entitlement.js');
const C = ent.CONSTANTS;
const DAY = 86400000;
const TOKEN = 'tok-session-1';
const SID = crypto.createHash('sha256').update(TOKEN, 'utf8').digest('hex').slice(0, 16);

/** 서버가 하는 것과 «같은» 발급 — payload 는 b64url 문자열이고 서명 대상은 그 «문자열»이다. */
function issue(over = {}, iatMs = Date.now()) {
  const p = {
    ver: 1, kid: 'k1', app: 'goditor', sub: 'user-1', email: 'a@b.c', plan: 'pro',
    accessUntil: null,
    iat: new Date(iatMs).toISOString(),
    exp: new Date(iatMs + 30 * DAY).toISOString(),
    sid: SID,
    ...over,
  };
  const payload = Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64url');
  return { payload, sig, kid: 'k1' };
}

/* ── authService 스텁을 main.js «前»에 심는다 ─────────────────────────────── */
const AUTH_PATH = require.resolve('../../services/authService.js');
const stub = {
  __login: null, __verify: null, __loginCalls: 0, __verifyCalls: 0,
  login: async () => { stub.__loginCalls++; return stub.__login; },
  /* ★함수 몸에서 읽는다 — main.js 는 적재 시 «이 함수»를 구조분해로 붙잡으므로
       나중에 프로퍼티를 갈아끼워도 반영되게 하려면 «호출 시점»에 읽어야 한다. */
  verifySession: async () => { stub.__verifyCalls++; return stub.__verify; },
  urlIsLive: async () => true,
  API_BASE: 'http://127.0.0.1:1', SIGNUP_URL: 's', PRICING_URL: 'p',
  FIND_EMAIL_URL: 'fe', FIND_PASSWORD_URL: 'fp',
};
require.cache[AUTH_PATH] = { id: AUTH_PATH, filename: AUTH_PATH, loaded: true, exports: stub };

const { loadMain } = require('./_ipc-harness.js');
let H, AUTH_JSON;
const REAL_NOW = Date.now;

before(() => {
  H = loadMain();
  AUTH_JSON = path.join(H.userData, 'auth.json');
});

function putAuth(rec) { fs.writeFileSync(AUTH_JSON, JSON.stringify(rec, null, 2), 'utf8'); }
function getAuth() { return JSON.parse(fs.readFileSync(AUTH_JSON, 'utf8')); }
function rmAuth() { try { fs.unlinkSync(AUTH_JSON); } catch (_) {} }
/** ⛔모든 시간 조작에 복원이 붙는다 — 안 그러면 뒤 검사가 «남의 시계»로 돈다. */
function atTime(ms, fn) {
  Date.now = () => ms;
  try { return fn(); } finally { Date.now = REAL_NOW; }
}
async function atTimeAsync(ms, fn) {
  Date.now = () => ms;
  try { return await fn(); } finally { Date.now = REAL_NOW; }
}

/* ═══ ⑴ H-B — 로더가 «판정»까지 하던 것 ═════════════════════════════════════ */

test('U-ENT-B1 ★H-B: accessUntil:null 로 저장된 기록을 readAuth 가 «버리지 않는다»', async () => {
  /* ⛔이 검사는 «레코드가 살아 있는가» «하나»만 본다. 값이 null 인지는 B2 가 본다. */
  const signed = issue();
  stub.__login = { ok: true, email: 'a@b.c', plan: 'pro', accessUntil: null, sessionToken: TOKEN };
  stub.__verify = { ok: true, plan: 'pro', accessUntil: null, signed };
  rmAuth();
  await H.invoke('auth:login', 'a@b.c', 'pw');

  /* 「앱 재기동」 — auth:state 는 readAuth 를 다시 탄다. */
  const st = await H.invoke('auth:state');
  assert.equal(st.email, 'a@b.c',
    '★readAuth 가드에 `!raw.accessUntil` 이 살아 있으면 여기서 email 이 "" 다 = 「기록이 없다」 = 로그인 화면');
  assert.equal(st.signedIn, true, '★무기한 사용자가 통과해야 한다');
});

/* ═══ ⑵ H-A② — writeAuth 가 뜻을 지우던 것 ══════════════════════════════════ */

test('U-ENT-B2 ★H-A②: writeAuth 가 accessUntil:null(무기한)을 «""로 뭉개지 않는다»', () => {
  /* ⛔이 검사는 «디스크의 값»만 본다. 레코드 생존은 B1 이 본다. */
  const d = getAuth();
  assert.equal(d.accessUntil, null,
    '★`String(record.accessUntil || "")` 가 살아 있으면 여기서 "" 가 나온다');
  assert.notEqual(d.accessUntil, '');
});

test('U-ENT-B3 회귀: 나머지 4필드는 «여전히» 문자열 강제다 (같이 풀지 않았다)', () => {
  const d = getAuth();
  for (const k of ['email', 'plan', 'sessionToken', 'savedAt']) {
    assert.equal(typeof d[k], 'string', `${k} 가 문자열이 아니다`);
  }
});

/* ═══ ⑶ writeAuth 화이트리스트 — 서명이 «조용히» 증발하던 것 ══════════════ */

test('U-ENT-B4 ★writeAuth 가 signed 를 보존한다 — payload 바이트 동일', () => {
  const d = getAuth();
  assert.ok(d.signed, '★화이트리스트에 signed 가 없으면 여기서 undefined 다 = 전원 옛 상태로 퇴행');
  assert.equal(d.signed.payload, stub.__verify.signed.payload, '★b64url 문자열 «그대로»여야 서명이 산다');
  assert.equal(d.signed.sig, stub.__verify.signed.sig);
  assert.equal(d.signed.kid, 'k1');
  assert.equal(d.sub, 'user-1', '★sub 핀도 보존돼야 L3 가 돈다');
});

test('U-ENT-B5 ★디스크→검증 왕복: 저장된 서명본이 «그대로» 검증을 통과한다', () => {
  const d = getAuth();
  const v = ent.verifyEntitlement(d.signed, { k1: PUB_PEM });
  assert.equal(v.ok, true, '★JSON 왕복 한 번에 깨지면 배포본에서 전원이 sig_invalid 다');
  assert.equal(v.payload.sub, 'user-1');
});

test('U-ENT-B6 ★auth:refresh 경로도 서명을 지우지 않는다 (두 번째 write 경로)', async () => {
  const before = getAuth().signed.payload;
  const fresh = issue({ plan: 'pro12' }, Date.now() + 1000);
  stub.__verify = { ok: true, plan: 'pro12', accessUntil: null, signed: fresh };
  const r = await H.invoke('auth:refresh');
  assert.equal(r.ok, true);
  const d = getAuth();
  assert.ok(d.signed, '★refresh 가 서명을 날리면 「새로고침 누를 때마다 퇴행」이 된다');
  assert.equal(d.signed.payload, fresh.payload);
  assert.notEqual(d.signed.payload, before, '★더 새 서명본으로 교체됐어야 한다');
  assert.equal(d.plan, 'pro12', '★plain 은 payload 에서 «파생»된다 — 응답의 plain 값이 아니라');
});

test('U-ENT-B7 ★단조 iat: 더 «옛» 서명본으로는 안 내려간다 (리플레이)', async () => {
  const cur = getAuth().signed.payload;
  const older = issue({ plan: 'intern' }, Date.now() - 10 * DAY);
  stub.__verify = { ok: true, plan: 'intern', accessUntil: null, signed: older };
  await H.invoke('auth:refresh');
  assert.equal(getAuth().signed.payload, cur, '★옛 서명본이 저장되면 만료·해지를 되돌릴 수 있다');
});

/** main.js 의 `writeAuth(` 호출처를 «기계로» 센다. ★줄번호는 썭는다 — 이름으로 센다. */
function writeAuthCallSites() {
  const src = fs.readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
  const lines = src.split('\n');
  const out = [];
  lines.forEach((ln, i) => {
    if (!/(?:^|[^\w.])writeAuth\s*\(/.test(ln)) return;
    if (/^\s*(\*|\/\/)/.test(ln)) return;              // 주석은 안 센다
    if (/^function writeAuth\b/.test(ln)) return;        // 선언 자신
    out.push({ n: i + 1, text: ln.trim() });
  });
  return out;
}

test('U-ENT-B8 ★writeAuth 호출처 «전수» — 각각이 서명을 안 지우는지 분류된다', () => {
  const sites = writeAuthCallSites();
  /* ★분류표. 새 호출처가 생기면 개수가 틀려 «이 검사가» 빨간지면서
     그 사람이 분류를 강제당한다. ⛔경고로는 못 막는다 — 검사만 막는다. */
  const EXPECTED = [
    // ⑴ persistApplied — silentRefresh · auth:refresh 가 공유하는 «한» 자리.
    //    record 는 applyServerAnswer 가 만든 것이라 signed 가 실려 있다. (B6 가 재현)
    { key: 'writeAuth(applied.record)', why: 'applyServerAnswer 산출물 — signed 보존' },
    // ⑵ auth:login 성공 — rec 은 applyServerAnswer 를 거친 레코드. (B1·B4 가 재현)
    { key: 'writeAuth(rec)', why: 'auth:login — verifySession 1회를 거쳐 signed 획득' },
    // ⑶ auth:login 의 expired — ★자격증명은 맞는데 기간이 끝난 계정. sessionToken 이 없어
    //    물어볼 수도 없다 ⇒ 서명을 «안 실는 것이 안전한 방향»이다(남아 있으면 exp 까지 통과).
    { key: "writeAuth({ email: String(email || '').trim()", why: 'auth:login expired — 서명 삭제가 안전 방향' },
    // ⑷ 구글 경로 성공 — grec 은 applyServerAnswer 산출물.
    { key: 'writeAuth(grec)', why: 'auth:google-login — signed 보존' },
    // ⑸ 구글 경로 expired — applyServerAnswer 가 서명본을 교체 또는 삭제한 결과.
    { key: 'writeAuth(exp.record ||', why: 'auth:google-login expired — 서명된 만료 사실을 지속' },
  ];
  assert.equal(sites.length, EXPECTED.length,
    `writeAuth 호출처가 ${sites.length}곳이다(분류된 것은 ${EXPECTED.length}곳). ` +
    '★새 호출처는 «서명을 지우는가»를 분류해 이 표에 적어라:\n' +
    sites.map(s2 => `  main.js:${s2.n}  ${s2.text}`).join('\n'));
  for (const e of EXPECTED) {
    assert.ok(sites.some(s2 => s2.text.includes(e.key)),
      `분류된 호출처가 사라졌다: ${e.key} (${e.why})`);
  }
  /* ★silentRefresh 는 IPC 로 못 부른다 — 그래서 «같은 자리를 쓴다»는 것을 기계로 박는다. */
  const src = fs.readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
  const sr = src.match(/async function silentRefresh\([\s\S]*?\n\}/);
  assert.ok(sr && sr[0].includes('persistApplied('),
    '★silentRefresh 가 저장 규칙을 «따로» 쓰면 거기서만 서명이 증발한다');
  assert.ok(!/writeAuth\(\{\s*\.\.\.auth/.test(src),
    '★`writeAuth({...auth, accessUntil: r.accessUntil})` 꼴이 남아 있다 — plain 과 서명본이 따로 논다');
});

/* ═══ ⑷ 옛 사용자 업그레이드 (가장 많은 사람이 지나는 길) ══════════════════ */

test('U-ENT-B9 ★옛 auth.json(5필드·sig 없음) + 서버 OK → 사용자 개입 0 으로 서명본이 생긴다', async () => {
  rmAuth();
  putAuth({ email: 'a@b.c', plan: 'pro', accessUntil: '2027-01-01T00:00:00.000Z', sessionToken: TOKEN, savedAt: '2026-08-01T00:00:00.000Z' });
  /* 마감 «전» 이라 옛 규칙으로 통과한다 — 화면은 아무것도 안 바뀐다. */
  const st = await H.invoke('auth:state');
  assert.equal(st.signedIn, true, '★옛 사용자가 여기서 막히면 이번 배포로 «전원»이 잠긴다');
  assert.equal(st.status, 'legacy_grace');

  const signed = issue({ accessUntil: '2027-01-01T00:00:00.000Z' });
  stub.__verify = { ok: true, plan: 'pro', accessUntil: '2027-01-01T00:00:00.000Z', signed };
  await H.invoke('auth:refresh');
  const d = getAuth();
  assert.ok(d.signed, '★백그라운드/새로고침 뒤엔 «반드시» 서명본으로 교체돼 있어야 한다');
  assert.equal((await H.invoke('auth:state')).status, 'signature_ok');
});

test('U-ENT-B10 ★마감 «후» + sig 없음 + accessUntil=2099 → 오프라인 거부 (오늘의 해킹 파일)', async () => {
  rmAuth();
  putAuth({ email: 'a@b.c', plan: 'pro', accessUntil: '2099-01-01T00:00:00.000Z', sessionToken: TOKEN, savedAt: '2026-08-01T00:00:00.000Z' });
  const after = Date.parse(C.SIGLESS_GRACE_UNTIL) + DAY;
  const st = await atTimeAsync(after, () => H.invoke('auth:state'));
  assert.equal(st.signedIn, false, '★마감 후엔 「숫자 하나 고치기」가 더는 안 통해야 한다');
  assert.equal(st.pending, 'verify', '★「만료」가 아니라 「확인 필요」다 — 문구가 다르다');

  const nav = await atTimeAsync(after, () => H.invoke('license:navigate-projects'));
  assert.equal(nav.ok, false);
  assert.equal(nav.code, 'LICENSE_REQUIRED', '★게이트가 부팅과 «같은 답»을 써야 한다');
});

test('U-ENT-B11 대조: 마감 «전»이면 같은 파일이 통과한다 (마감이 진짜 기준선이다)', async () => {
  const st = await atTimeAsync(Date.parse(C.SIGLESS_GRACE_UNTIL) - DAY, () => H.invoke('auth:state'));
  assert.equal(st.signedIn, true);
});

/* ═══ ⑷' ★«전원 잠김» 방향을 막는 두 자리 ═════════════════════ */

test('U-ENT-B17 ★서버가 ok:true 인데 signed 가 «없으면» 통과한다 (서버 env 미배포 = 우리 사고)', async () => {
  rmAuth();
  putAuth({ email: 'a@b.c', plan: 'pro', accessUntil: '2027-01-01T00:00:00.000Z', sessionToken: TOKEN });
  const after = Date.parse(C.SIGLESS_GRACE_UNTIL) + DAY;   // 마감 후 = 로컬만으로는 R
  assert.equal((await atTimeAsync(after, () => H.invoke('auth:state'))).signedIn, false,
    '전제: 마감 후엔 로컬만으론 못 들어간다');

  stub.__verify = { ok: true, plan: 'pro', accessUntil: '2027-01-01T00:00:00.000Z' };  // ★signed 없음
  const r = await atTimeAsync(after, () => H.invoke('auth:refresh'));
  assert.equal(r.ok, true,
    '★서명이 없다고 거부하면 «서버 env 미배포» 하나로 전원이 잠긴다 — 서버가 정한 규약은 「ok:true 면 통과」다');
});

test('U-ENT-B18 ★sid 불일치는 「위조」가 아니라 「없음」이다 (재로그인한 사람을 안 잠그다)', async () => {
  rmAuth();
  /* 서명은 옛 토큰(TOKEN)으로 받았는데 지금 토큰은 새 것 — 정상 재로그인의 모양이다. */
  putAuth({ email: 'a@b.c', plan: 'pro', accessUntil: '2027-01-01T00:00:00.000Z',
            sessionToken: 'tok-after-relogin', sub: 'user-1', signed: issue() });
  const st = await H.invoke('auth:state');
  assert.equal(st.signedIn, true, '★거부로 보내면 재로그인한 사람이 전부 잠긴다');
  assert.equal(st.status, 'legacy_grace', '★L2(거부)가 아니라 L1(없음) 경로로 가야 한다');
});

/* ═══ ⑷'' ★«매 실행 재로그인 루프» — 한 바퀴로는 안 보인다 ═══════════════ */

test('U-ENT-B19 ★루프: accessUntil:null 이 write→read 를 «두 바퀴» 돌아도 안 무너진다', async () => {
  /* ★지디 실측(서버 api/license/login.js:112,174): **로그인 응답도 null 을 준다.**
     ⇒ 병은 「한 번 저장이 되나」가 아니라 「반복해도 살아 있나」에 있다:
        로그인 → '' 저장 → 다음 실행에 「기록 없음」 → 다시 로그인 → 1로 …  «영구 루프».
     ⛔한 바퀴만 재면 「저장은 됐는데 두 번째에 무너지는」 경우를 못 본다.
        결함이 «반복»에서 나므로 검사도 반복해야 그 결함을 «볼 수 있다». */
  rmAuth();
  stub.__login  = { ok: true, email: 'a@b.c', plan: 'pro', accessUntil: null, sessionToken: TOKEN };
  stub.__verify = { ok: true, plan: 'pro', accessUntil: null };   // ★서명 없이 — plain 경로만 재는 것

  // ── 1바퀴: login → writeAuth → (앱 재기동) → readAuth
  await H.invoke('auth:login', 'a@b.c', 'pw');
  assert.equal(getAuth().accessUntil, null, '1바퀴: 디스크가 «무기한»을 잃었다');
  const st1 = await H.invoke('auth:state');
  assert.equal(st1.email, 'a@b.c', '1바퀴: readAuth 가 기록을 버렸다 → 로그인 화면');
  assert.equal(st1.perpetual, true, '1바퀴: 무기한이라는 «뜻»이 사라졌다');

  // ── 2바퀴: 그 «읽은 결과»로 다시 write → 다시 read
  const r2 = await H.invoke('auth:refresh');   // readAuth → applyServerAnswer → writeAuth
  assert.equal(r2.ok, true, '2바퀴: 갱신이 실패했다');
  assert.equal(getAuth().accessUntil, null, '★2바퀴: 두 번째 저장에서 «무기한»이 "" 로 무너졌다 — 여기가 루프의 입구다');
  const st2 = await H.invoke('auth:state');
  assert.equal(st2.email, 'a@b.c', '★2바퀴: 여기서 빈 값이면 «매 실행 재로그인 루프»가 그대로 산다');
  assert.equal(st2.signedIn, st1.signedIn, '2바퀴: 판정이 바퀴마다 달라진다');
  assert.equal(st2.perpetual, true);

  // ── 3바퀴(덤): 값이 «수렴»하는지 — 바퀴를 돌수록 나빠지지 않아야 한다
  await H.invoke('auth:refresh');
  assert.equal(getAuth().accessUntil, null, '3바퀴: 늦게 무너지는 종류가 아닌지');
  assert.equal((await H.invoke('auth:state')).email, 'a@b.c');
});

test('U-ENT-B20 ★verifySession 이 «말을 안 할» 때 — login 이 준 값이 그대로 디스크로 간다', async () => {
  /* ★이 조합(로그인은 됐는데 /session 이 «침묵»)이 실제로 있었다 —
     서버가 /session 을 404 로 두던 시절(authService 주석, 2026-08-06).
     평소엔 verifySession 의 답이 login 값을 덮어써서 login 쪽 결함이 «가려진다».
     ⚠️단, 이 파일은 authService 를 «스텁»으로 바꿔 놓았으므로 여기서 재는 것은
       **main.js 가 받은 값을 뭉개지 않는가**이지 login() 자체가 아니다.
       login() 의 `|| ''` 는 entitlement-authservice.test.mjs 의 A7·A8·A9 가 잡는다
       (변이 M8·M10 이 그 셋만 빨갛게 하고 이 검사는 안 건드리는 것이 그 증거다). */
  rmAuth();
  stub.__login  = { ok: true, email: 'a@b.c', plan: 'pro', accessUntil: null, sessionToken: TOKEN };
  stub.__verify = null;                       // ★서버가 말을 안 한다
  await H.invoke('auth:login', 'a@b.c', 'pw');

  assert.equal(getAuth().accessUntil, null,
    '★login 이 "" 를 주면 여기서 "" 가 된다 — verifySession 이 가려 주지 못하는 유일한 조합');
  const st = await H.invoke('auth:state');
  assert.equal(st.email, 'a@b.c', '★기록은 살아 있어야 한다 (로그아웃 루프 금지)');
  assert.equal(st.perpetual, true, '★「무기한」이라는 뜻이 남아 있어야 화면이 만료라고 거짓말하지 않는다');

  /* ⛔그리고 «통과는 아니다» — 이건 결함이 아니라 «의도»다. 여기서 통과시키면
     사용자가 auth.json 의 accessUntil 을 null 로 고치는 것만으로 무기한이 된다
     (= 오늘 닫으려는 바로 그 구멍). 서명을 한 번 받아야 열린다. */
  assert.equal(st.signedIn, false, '★서명 없는 accessUntil:null 을 통과시키면 «파일 편집 = 무기한» 이 된다');
  assert.equal(st.pending, 'verify', '★문구는 「만료」가 아니라 「인터넷에 연결해 주세요」다');

  // 연결되면 «사용자 개입 0» 으로 풀린다 — 잠금이 아니라 «대기»임을 보인다
  stub.__verify = { ok: true, plan: 'pro', accessUntil: null, signed: issue({ accessUntil: null }) };
  const r = await H.invoke('auth:refresh');
  assert.equal(r.ok, true, '★연결 한 번으로 풀려야 한다 — 안 풀리면 그건 잠금이다');
  assert.equal((await H.invoke('auth:state')).signedIn, true);
});

/* ═══ ⑸ 렌더러 미노출 (C6) ═════════════════════════════════════════════════ */

test('U-ENT-B12 auth:state 응답에 sessionToken·payload·sig 가 «없다»', async () => {
  rmAuth();
  putAuth({ email: 'a@b.c', plan: 'pro', accessUntil: null, sessionToken: TOKEN, sub: 'user-1', signed: issue() });
  const st = await H.invoke('auth:state');
  const j = JSON.stringify(st);
  assert.equal(/sessionToken/.test(j), false);
  assert.equal(/"sig"/.test(j), false);
  assert.equal(/"payload"/.test(j), false);
  assert.equal(j.includes(TOKEN), false, '★토큰 «값»도 새면 안 된다');
  assert.equal(st.perpetual, true, '★무기한이라는 «사실»은 따로 알려 준다(화면이 만료로 읽지 않게)');
});

test('U-ENT-B13 신고 진단은 «한 줄»이고 이메일이 없다 (errors[] 에 실을 것)', async () => {
  const ctx = await H.invoke('report:context');
  assert.equal(typeof ctx.authDiag, 'string');
  assert.ok(ctx.authDiag.startsWith('ent:'), `진단 형식이 아니다: ${ctx.authDiag}`);
  assert.equal(ctx.authDiag.includes('@'), false, '★email 이 실리면 안 된다');
  assert.equal(ctx.authDiag.includes(TOKEN), false);
  assert.equal(ctx.authDiag.split('\n').length, 1, '★한 줄이어야 errors[] 한 칸에 들어간다');
  assert.equal('auth' in ctx, false, '★서버가 조용히 버리는 «모르는 최상위 필드»를 만들지 않는다');
});

/* ═══ ⑺ E3-b ㉯ — auth:state.daysUntilSigStale ═══════════════════════════════
 * ★진짜 main.js 핸들러로 잰다(흉내 아님) — entitlement.js 의 daysUntilSigStale 이
 *   main.js 배선을 거쳐 auth:state 에 «실제로» 나오는지가 검사 대상이다. */
test('U-ENT-B21 ★유효한 서명 + exp 가 5일 뒤 → auth:state.daysUntilSigStale === 5', async () => {
  const iat = Date.now();
  const signed = issue({ exp: new Date(iat + 5 * DAY).toISOString() }, iat);
  rmAuth();
  putAuth({ email: 'a@b.c', plan: 'pro', accessUntil: null, sessionToken: TOKEN, sub: 'user-1', signed });
  const st = await H.invoke('auth:state');
  assert.equal(st.daysUntilSigStale, 5);
});

test('U-ENT-B22 ★★서명이 없는(legacy_grace 모양) 옛 auth.json → null — SIGLESS_GRACE_UNTIL 은 별개 마감이다', async () => {
  rmAuth();
  putAuth({ email: 'a@b.c', plan: 'pro', accessUntil: new Date(Date.now() + 100 * DAY).toISOString(), sessionToken: TOKEN, savedAt: new Date().toISOString() });
  const st = await H.invoke('auth:state');
  assert.equal(st.daysUntilSigStale, null, 'legacy_grace 는 exp 가 없으니 배너 대상에서 자동으로 빠져야 한다');
});

test('U-ENT-B23 위조된 서명(다른 키) → null(위조 exp 로 예고하지 않는다)', async () => {
  const other = crypto.generateKeyPairSync('ed25519');
  const p = { ver: 1, kid: 'k1', app: 'goditor', sub: 'user-1', email: 'a@b.c', plan: 'pro',
    accessUntil: null, iat: new Date().toISOString(), exp: new Date(Date.now() + 3 * DAY).toISOString(), sid: SID };
  const payload = Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), other.privateKey).toString('base64url');
  rmAuth();
  putAuth({ email: 'a@b.c', plan: 'pro', accessUntil: null, sessionToken: TOKEN, sub: 'user-1', signed: { payload, sig, kid: 'k1' } });
  const st = await H.invoke('auth:state');
  assert.equal(st.daysUntilSigStale, null);
});

/* ═══ ⑹ 부팅이 네트워크를 기다리지 않는가 ═════════════════════════════════ */

test('U-ENT-B14 ★부팅 경로(checkAuthAndLoad)에 네트워크 await 가 0 이다', () => {
  const src = fs.readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
  const m = src.match(/async function checkAuthAndLoad\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'checkAuthAndLoad 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  /* ★주석을 «먼저» 지우고 재다 — 안 그러면 「여긴 await 가 없다」는 설명 주석이
     그 단어를 포함해서 계측기가 «자기 자신»을 잡는다(실제로 거기서 한 번 빨개졌다). */
  const body = m[0].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  assert.ok(body.includes('mainWindow.loadFile'), '★주석을 지우다가 본문까지 지워다 — 이 검사는 무효다');
  for (const bad of ['await', 'authVerifySession', 'entVerify', 'resolveAuth', 'fetch(']) {
    assert.equal(body.includes(bad), false,
      `★부팅이 «${bad}» 를 탄다 — 2026-08-05(백엔드 다운에 전원 잠김)의 약속을 깬다`);
  }
  assert.ok(body.includes('authVerdict('), '★부팅도 SSOT 를 써야 한다');
});

test('U-ENT-B15 ★authAccessValid 호출 0건 — 판정하는 문이 하나다', () => {
  const src = fs.readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
  const calls = src.match(/(?<!`)authAccessValid\s*\(/g) || [];
  assert.equal(calls.length, 0, `옛 판정 함수가 아직 ${calls.length}곳에서 불린다`);
  for (const gate of ['checkAuthAndLoad', "ipcMain.handle('auth:state'", "ipcMain.handle('license:navigate-projects'"]) {
    assert.ok(src.includes(gate), `${gate} 가 사라졌다`);
  }
});

test('U-ENT-B16 ★적재 검사(U-ENT-0): 이 파일이 «진짜» 핸들러를 부르고 있다', () => {
  for (const ch of ['auth:state', 'auth:login', 'auth:refresh', 'auth:logout', 'license:navigate-projects', 'report:context']) {
    assert.ok(H.has(ch), `IPC 채널이 등록 안 됐다: ${ch} — 하네스가 main.js 를 덜 실은 것이다`);
  }
});
