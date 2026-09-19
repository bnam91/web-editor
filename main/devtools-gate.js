/* ═══════════════════════════════════════════════════════════════════════════
   devtools-gate.js — 배포판 «개발자 도구» 잠금 (현빈 확정 2026-09-19)
   ───────────────────────────────────────────────────────────────────────────
   ★요구: 배포판에서는 F12·⌥⌘I·메뉴 어느 길로도 개발자 도구가 안 열린다.
     예외 둘 — ⑴ 관리자 계정(coq3820@gmail.com)으로 로그인 ⑵ 톱니바퀴 「디버깅」 탭에
     «관리자코드»를 넣었을 때(이 앱 세션 동안만). dev(!app.isPackaged)는 지금처럼 자유.

   ★잠금은 «메뉴를 숨기는 것»이 아니다
     메뉴 role·가속키·새 창·우클릭 검사… 여는 길은 계속 생긴다. 그래서 «열린 뒤에 닫는»
     한 자리(web-contents-created → devtools-opened)를 둔다. 경로가 뭐든 여기서 닫힌다.
     ⛔webPreferences.devTools:false 는 안 쓴다 — 런타임에 못 되돌려서 «코드로 해제»가 불가능해진다.
     ⛔이 가드는 createWindow() «전»에 등록돼야 한다(뒤면 mainWindow 가 빠진다).

   ★이메일은 «서명 검증된» payload.email 만 본다
     auth.json 의 raw email 은 사람이 손으로 고칠 수 있다. entitlement.classify 가 서명을
     통과시켰을 때만 payload 가 생긴다(services/entitlement.js out()) — 그것만 믿는다.

   ★관리자코드 평문은 어디에도 두지 않는다(소스·주석·테스트) — 느린 KDF(scrypt) 비교만.
     0919 QA: 예전엔 소금 없는 sha256 이라 번들(app.asar, 암호화 안 됨)에서 해시를 꺼내 000000~999999 를
     대입하면 0.3초 만에 풀렸다(«관리자코드 = 공개값»). 이제 scrypt(N=2^16, r=8 → 1회 ~80ms·64MB, 소금 16바이트):
     백만 개 전수 = CPU 약 22시간, 메모리 하드라 GPU 병렬 이득도 작다.
     ⚠️남은 한계: 6자리 숫자 공간 자체가 작다 — 근본 대책은 서버 검증이나 긴 코드(현빈 결정 사항).

   ⛔isAdminAuthorized() 에 이 판정을 섞지 마라 — 그건 라이선스 우회·PM 터미널 권한이다.
     관리자 이메일/코드로 그것까지 풀리면 권한 확대다. 여기는 «개발자 도구 전용»이다.
═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const crypto = require('crypto');

const ADMIN_EMAIL = 'coq3820@gmail.com';
/** 관리자코드의 scrypt 레코드. ⛔평문을 이 옆에 적지 마라. ⛔소금 없는 빠른 해시로 되돌리지 마라(0919 QA). */
const CODE_KDF = Object.freeze({
  alg: 'scrypt', N: 65536, r: 8, p: 1, keylen: 32,
  salt: 'e9c8571588deb5b8d742a15af14c5592',
  hash: 'a684247a0f2d9b565b213662b3995834c55bb2d394887b62931b05fc11ab074d',
});
const MAX_FAILS = 5;
const LOCK_MS = 60 * 1000;

function normEmail(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

function sha256Hex(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

/** scrypt 레코드와 입력 비교 — 상수 시간. 레코드 모양이 틀리면 false(실패닫힘). */
function kdfMatches(input, kdf) {
  try {
    if (!kdf || kdf.alg !== 'scrypt' || !/^[0-9a-f]{32,}$/.test(kdf.salt) || !/^[0-9a-f]{64}$/.test(kdf.hash)) return false;
    const got = crypto.scryptSync(String(input), Buffer.from(kdf.salt, 'hex'), kdf.keylen || 32,
      { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 256 * 1024 * 1024 });
    const want = Buffer.from(kdf.hash, 'hex');
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  } catch (_) { return false; }
}

/** hex 두 개를 «상수 시간»으로 비교. 모양이 다르면 false. */
function hexEqual(a, b) {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/**
 * ★«앱을 띄울 때» 여는 디버깅 길 — devtools-opened 가드가 «못 보는» 길이다 (이벨류에이터 지적 2026-09-19).
 *   --remote-debugging-port / --remote-debugging-pipe : Chromium CDP. 렌더러 전체(window.electronAPI 포함)를
 *     조작할 수 있고 chrome://inspect 로 개발자 도구 화면도 뜬다. 창의 devtools-opened 이벤트는 안 난다.
 *   --inspect* / --debug* (argv·execArgv) · NODE_OPTIONS 의 --inspect : 메인 프로세스 Node 디버거.
 *   (ELECTRON_RUN_AS_NODE·NODE_OPTIONS·--inspect·SIGUSR1 은 package.json build.electronFuses 로도 끈다 —
 *    이 함수는 퓨즈가 안 먹은 빌드를 위한 «두 번째 자물쇠»다.)
 * 순수 함수 — 무엇이 걸렸는지 목록만 돌려준다. 끌지 말지는 부르는 쪽(main.js 최상위)이 정한다.
 * @param {{argv?:string[], execArgv?:string[], hasSwitch?:(s:string)=>boolean, env?:object, inspectorUrl?:()=>string|undefined}} o
 *   inspectorUrl — require('inspector').url. 값이 있으면 메인 Node 디버거가 «이미 켜져» 있다(인자 형태와 무관)
 * @returns {string[]} 걸린 항목 이름(없으면 빈 배열)
 */
function debugLaunchViolations(o = {}) {
  const hits = new Set();
  const argv = [].concat(o.argv || [], o.execArgv || []).filter(a => typeof a === 'string');
  const has = (s) => { try { return !!(o.hasSwitch && o.hasSwitch(s)); } catch (_) { return false; } };
  for (const sw of ['remote-debugging-port', 'remote-debugging-pipe']) {
    if (has(sw) || argv.some(a => a === '--' + sw || a.startsWith('--' + sw + '='))) hits.add(sw);
  }
  for (const a of argv) {
    /* ★디버거를 «켜는» 인자만 본다. --inspect-port·--inspect-publish-uid 는 켜지 않는다(포트·표시 설정일 뿐,
       SIGUSR1 활성화는 퓨즈가 끈다) — node --test 자식 프로세스가 이 둘을 달고 와서 오탐이 났다(실측). */
    const m = /^--(inspect(?:-brk|-wait)?|debug(?:-brk)?)(?:=|$)/.exec(a);
    if (m) hits.add(m[1]);
  }
  try { if (typeof o.inspectorUrl === 'function' && o.inspectorUrl()) hits.add('inspector-active'); } catch (_) {}
  const nodeOpts = String((o.env && o.env.NODE_OPTIONS) || '');
  if (/(^|\s)--(inspect|debug)/.test(nodeOpts)) hits.add('NODE_OPTIONS');
  return [...hits];
}

/**
 * 메뉴 「보기 › 개발자 도구」 항목. ★표준 role 「toggleDevTools」 를 쓰지 않는다 — role 은 게이트를 모른다.
 * 숨김(visible:false)은 «보이기»일 뿐이고 실제 잠금은 devtools-opened 가드다.
 */
function devToolsMenuItem({ isMac, allowed, toggle }) {
  return {
    label: '개발자 도구',
    accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
    visible: !!allowed,
    enabled: !!allowed,
    click: () => { if (typeof toggle === 'function') toggle(); },
  };
}

/**
 * @param {object} deps
 *   app                  — { isPackaged }
 *   readAuth()           — auth.json 레코드 또는 null
 *   authVerdict(record)  — entitlement.classify 결과 ({pass, payload?})
 *   isAdminAuthorized()  — 기존 운영자 admin 빌드(인자+토큰) 판정
 *   getAllWebContents()  — 열린 webContents 전부(잠길 때 닫으려고)
 *   onChange()           — 허용 여부가 바뀔 수 있을 때(메뉴 재빌드)
 *   now()                — 시계(테스트 주입)
 *   env                  — process.env 대용(테스트 주입)
 *   codeSha256           — 테스트에서 «다른 코드»로 양성대조할 때만
 *   enforceIntervalMs    — 주기 재판정 간격(0 이면 끔). 기본 60초
 */
function createDevToolsGate(deps = {}) {
  const d = {
    app: { isPackaged: false },
    readAuth: () => null,
    authVerdict: () => ({ pass: false }),
    isAdminAuthorized: () => false,
    getAllWebContents: () => [],
    onChange: () => {},
    now: () => Date.now(),
    env: process.env,
    codeKdf: CODE_KDF,
    codeSha256: null,     // ⚠️테스트 전용 주입(양성대조용 빠른 비교) — 기본은 codeKdf
    enforceIntervalMs: 60 * 1000,
    ...deps,
  };

  let unlocked = false;     // ★메모리에만 — 앱을 끄면 풀린다(현빈: 해제는 세션 동안만)
  let fails = 0;
  let lockedUntil = 0;

  /* ★GODITOR_FORCE_PACKAGED_GATE=1 — dev 에서 «배포판처럼 잠그는» 테스트 훅.
     조이는 쪽으로만 작동한다(dev 를 잠글 뿐, 배포판을 풀지 못한다). */
  function realPackaged() { try { return !!(d.app && d.app.isPackaged); } catch (_) { return true; } }
  function packaged() { return realPackaged() || (d.env && d.env.GODITOR_FORCE_PACKAGED_GATE === '1'); }

  function adminEmailSignedIn() {
    try {
      const rec = d.readAuth();
      if (!rec) return false;
      const v = d.authVerdict(rec);
      // ⛔rec.email 을 보지 않는다 — 서명 검증된 payload.email 만.
      return !!(v && v.pass && v.payload && normEmail(v.payload.email) === ADMIN_EMAIL);
    } catch (_) { return false; }
  }

  function reason() {
    if (!packaged()) return 'dev';
    if (unlocked) return 'unlocked';
    /* ⛔0919 QA(high): 예전엔 여기서 isAdminAuthorized()(=운영자 admin 빌드: 'admin' 인자 + GODITOR_ADMIN_TOKEN +
       userData/admin.allow)를 «세 번째 예외»로 허용했다. 그런데 셋 다 사용자 손에 있다 — 아무 토큰의 sha256 을
       admin.allow 에 써 두면 일반 고객도 자가 발급으로 개발자 도구·CDP 를 연다. 현빈 결정은 «관리자 계정 로그인
       또는 관리자코드» 두 가지뿐이라 이 예외를 뺀다(d.isAdminAuthorized 는 받아도 판정에 쓰지 않는다). */
    if (adminEmailSignedIn()) return 'admin-email';
    return 'locked';
  }

  function isAllowed() { return reason() !== 'locked'; }

  function verifyCode(input) {
    const t = d.now();
    if (lockedUntil && t < lockedUntil) {
      return { ok: false, reason: 'rate_limited', retryAfterMs: lockedUntil - t };
    }
    if (lockedUntil && t >= lockedUntil) { lockedUntil = 0; fails = 0; }
    const code = String(input == null ? '' : input).trim();
    const match = d.codeSha256
      ? hexEqual(sha256Hex(code), String(d.codeSha256).toLowerCase())
      : kdfMatches(code, d.codeKdf);
    if (match) {
      fails = 0;
      unlocked = true;
      try { d.onChange(); } catch (_) {}
      return { ok: true };
    }
    fails += 1;
    if (fails >= MAX_FAILS) {
      lockedUntil = t + LOCK_MS;
      return { ok: false, reason: 'rate_limited', retryAfterMs: LOCK_MS };
    }
    return { ok: false, reason: 'bad_code', remaining: MAX_FAILS - fails };
  }

  /** 잠겨 있으면 열린 개발자 도구를 전부 닫는다(로그아웃·잠금 직후). */
  function enforce() {
    if (isAllowed()) return 0;
    let n = 0;
    for (const wc of (d.getAllWebContents() || [])) {
      try {
        if (wc && !wc.isDestroyed?.() && wc.isDevToolsOpened && wc.isDevToolsOpened()) { wc.closeDevTools(); n++; }
      } catch (_) {}
    }
    return n;
  }

  function lock() {
    unlocked = false;
    try { d.onChange(); } catch (_) {}
    enforce();
  }

  /** 한 webContents 에 가드를 건다. 어떤 경로로 열리든 잠겨 있으면 곧바로 닫는다. */
  function guardWebContents(wc) {
    if (!wc || typeof wc.on !== 'function') return;
    wc.on('devtools-opened', () => {
      if (!isAllowed()) {
        try { wc.closeDevTools(); } catch (_) {}
      }
    });
  }

  /** ★createWindow() 보다 «먼저» 부른다. */
  function install(app) {
    app.on('web-contents-created', (_e, wc) => guardWebContents(wc));
    /* ★시간이 지나 판정이 바뀌는 경우(관리자 서명 만료·플랜 만료)엔 auth 쓰기가 없어서 enforce 가 안 돈다.
       그래서 주기적으로 한 번씩 다시 잰다. 허용 상태(dev·해제)면 enforce 는 곧바로 0 을 돌려준다. */
    const ms = Number(d.enforceIntervalMs);
    if (ms > 0) {
      const t = setInterval(() => { try { enforce(); } catch (_) {} }, ms);
      if (t && typeof t.unref === 'function') t.unref();
    }
  }

  function toggleFor(wc) {
    if (!wc || !isAllowed()) return false;
    if (wc.isDevToolsOpened()) wc.closeDevTools(); else wc.openDevTools();
    return true;
  }

  function state() {
    const r = reason();
    // ⛔이메일 원문은 내보내지 않는다.
    return { allowed: r !== 'locked', reason: r, packaged: packaged() };
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('devtools:state', () => state());
    ipcMain.handle('devtools:unlock', (_e, code) => {
      const r = verifyCode(code);
      return r.ok ? { ok: true, state: state() } : r;
    });
    ipcMain.handle('devtools:open', (event) => {
      if (!isAllowed()) return { ok: false, reason: 'locked' };
      try { event.sender.openDevTools({ mode: 'detach' }); } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
      return { ok: true };
    });
    ipcMain.handle('devtools:lock', () => { lock(); return state(); });
  }

  return { reason, isAllowed, verifyCode, enforce, lock, guardWebContents, install, toggleFor, state, registerIpc };
}

module.exports = { createDevToolsGate, devToolsMenuItem, debugLaunchViolations, ADMIN_EMAIL, CODE_KDF, MAX_FAILS, LOCK_MS, _normEmail: normEmail, _kdfMatches: kdfMatches };
