#!/usr/bin/env node
/* E4 — 「배포본에서 실제로 로그인이 사는가」를 «앱을 띄워서» 재는 시나리오 모음.
 *
 * ⛔단위검사가 아니다. 여기서 초록이 되려면 **Electron 이 실제로 뜨고 페이지가 로드돼야** 한다.
 *
 * 사용:
 *   node scenarios.mjs --case <이름> --port 9383 --work <dir> --repo <dir> [--api http://127.0.0.1:8790]
 *   node scenarios.mjs --list
 *
 * ★설계 규율
 *  ⑴ **한 케이스 = 앱 한 번 기동**. 여러 판정을 한 기동에 몰면 어느 것이 무엇을 봤는지 못 가른다.
 *  ⑵ **모든 대기에 상한**(app-runner). 무한 대기는 빨간 실패보다 나쁘다.
 *  ⑶ 각 케이스는 `expect` 를 «자기가» 들고 있다 — 「초록인데 아무것도 안 본」 케이스가 없게.
 *  ⑷ ★`admin` 인자를 절대 안 준다(라이선스 게이트 우회).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';   // ★윈도우: import() 는 file:// URL 만 받는다
import { runOnce, readAuthFile } from './app-runner.mjs';

const argv = process.argv;
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const REPO = path.resolve(arg('repo', process.cwd()));
const WORK = path.resolve(arg('work', path.join(REPO, '.qa-entitlement')));
const PORT = Number(arg('port', '9383'));
const API = arg('api', 'http://127.0.0.1:8790');
const UD = path.join(WORK, 'ud');
const OUT = path.join(WORK, 'out');
const STATE = path.join(WORK, 'state.json');
const PUB = path.join(WORK, 'pub.pem');

const DAY = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function baseEnv(extra = {}) {
  return {
    GODITOR_LICENSE_API: API,
    GODITOR_ENTITLEMENT_PUBKEY: fs.readFileSync(PUB, 'utf8'),
    ...extra,
  };
}
function setState(o) { fs.writeFileSync(STATE, JSON.stringify(o, null, 2), 'utf8'); }
function authPath() { return path.join(UD, 'auth.json'); }
function readAuthJson() {
  try { return JSON.parse(fs.readFileSync(authPath(), 'utf8')); } catch (_) { return null; }
}
function writeAuthJson(o) { fs.writeFileSync(authPath(), JSON.stringify(o, null, 2), 'utf8'); }

/** 화면 판정 — URL 로만 가른다. ⛔문구로 가르지 않는다(E3 가 문구를 바꾸는 중). */
function screenOf(url) {
  if (!url) return 'none';
  if (url.includes('projects.html')) return 'editor';
  if (url.includes('license.html')) return 'license';
  return url;
}

/* ── UI 로그인(진짜 입력) ──────────────────────────────────────────────────
 * ⛔`btn.click()` 로 때우지 않는다 — 「눌렀는데 안 된다」와 «애초에 안 눌렸다»가 구분이 안 된다.
 *   진짜 마우스 이벤트를 좌표로 넣고, «클릭이 도달했는지»를 버튼 상태 변화로 증명한다.
 */
async function uiLogin(cdp, email, password) {
  const proof = {};
  await cdp.evalx(`(() => {
    const e = document.getElementById('email'), p = document.getElementById('password');
    e.value = ${JSON.stringify(email)}; e.dispatchEvent(new Event('input', {bubbles:true}));
    p.value = ${JSON.stringify(password)}; p.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  const rect = await cdp.evalx(`(() => { const r = document.getElementById('loginBtn').getBoundingClientRect();
    return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`);
  /* 클릭 도달 증명용 훅 — 버튼에 진짜 이벤트가 왔는지 «따로» 기록한다. */
  await cdp.evalx(`(() => { window.__e4click = 0;
    document.getElementById('loginBtn').addEventListener('mousedown', () => { window.__e4click++; }, true);
    return true; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', {
      type, x: rect.x, y: rect.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0,
    });
  }
  proof.clickReached = await cdp.evalx('window.__e4click');
  proof.buttonRect = rect;
  /* 상한 있는 대기 — 성공하면 projects.html 로 «넘어간다». */
  const t0 = Date.now();
  let status = '';
  while (Date.now() - t0 < 20000) {
    status = await cdp.evalx("document.getElementById('statusMsg') ? document.getElementById('statusMsg').textContent : ''").catch(() => 'PAGE_GONE');
    if (status === 'PAGE_GONE' || /완료|이동/.test(status)) break;
    await sleep(400);
  }
  proof.statusText = status;
  await sleep(2500);   // navigateToProjects 는 600ms 뒤 + IPC 왕복
  proof.urlAfter = await cdp.evalx('location.href').catch(() => 'PAGE_GONE');
  return proof;
}

/* ── 케이스 ────────────────────────────────────────────────────────────── */
const CASES = {};
const def = (name, why, fn) => { CASES[name] = { name, why, fn }; };

def('reset', '격리 ud 를 비운다(auth.json 만 지운다 — 프로젝트/캐시는 둔다)', async () => {
  try { fs.unlinkSync(authPath()); } catch (_) {}
  return { ok: true, note: 'auth.json 삭제' };
});

def('login-perpetual',
  '① 무기한(accessUntil:null) 계정으로 «UI 로그인». 서명이 디스크에 남아야 한다(②)',
  async () => {
    setState({ mode: 'ok', plan: 'pro', accessUntil: null, sub: 'u_e4_perp', sessionToken: 'tok_perp' });
    try { fs.unlinkSync(authPath()); } catch (_) {}
    let loginProof = null;
    const r = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT, label: 'c1-login',
      env: baseEnv(), waitMs: 60000,
      afterPage: async (cdp) => { loginProof = await uiLogin(cdp, 'e4@test.local', 'pw'); return loginProof; },
    });
    const a = readAuthJson();
    return {
      ok: screenOf(loginProof?.urlAfter) === 'editor'
        && !!(a && a.signed && a.signed.payload && a.signed.sig && a.signed.kid)
        && a.accessUntil === null,
      run: r, loginProof,
      auth: a, screen: screenOf(loginProof?.urlAfter),
      expect: 'urlAfter=projects.html · auth.json.signed{payload,sig,kid} 존재 · accessUntil === null',
    };
  });

def('relaunch',
  '① 재기동해도 프로젝트 화면인가 + ② 서명 바이트가 그대로인가',
  async () => {
    const before = readAuthFile(UD);
    /* ★`--offline` 을 주면 서버 주소를 죽은 포트로 돌린다 — 그래야 「서명이 «바이트 동일»로
       살아남는가」를 잴 수 있다. 온라인이면 백그라운드 갱신이 «정상적으로» 새 서명본으로
       바꾸므로 바이트 비교가 성립하지 않는다(그건 퇴행이 아니라 설계다). */
    const off = argv.includes('--offline');
    const r = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT,
      label: `c2-relaunch-${arg('n', '1')}${off ? '-off' : ''}`,
      env: off ? baseEnv({ GODITOR_LICENSE_API: 'http://127.0.0.1:1' }) : baseEnv(), waitMs: 60000,
    });
    const after = readAuthFile(UD);
    const a = readAuthJson();
    return {
      ok: screenOf(r.pageUrl) === 'editor' && !!(a && a.signed && a.signed.payload),
      run: r, screen: screenOf(r.pageUrl),
      sigBefore: before && before.text ? JSON.parse(before.text).signed : null,
      sigAfter: a ? a.signed : null,
      sigIdentical: JSON.stringify(before && JSON.parse(before.text).signed) === JSON.stringify(a && a.signed),
      accessUntil: a ? a.accessUntil : undefined,
      authSha: { before: before && before.sha256, after: after && after.sha256 },
      expect: 'projects.html · signed 유지',
    };
  });

def('offline',
  '③ 서버를 «죽인 채» 기동. 서명이 살아 있으면 통과해야 한다',
  async () => {
    const r = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT, label: 'c3-offline',
      /* ★서버 주소를 «아무도 안 듣는» 포트로 돌린다 = 진짜 오프라인.
         ⛔가짜 서버를 내리는 것보다 이쪽이 재현 가능하다(포트 회수 타이밍에 안 흔들린다). */
      env: baseEnv({ GODITOR_LICENSE_API: 'http://127.0.0.1:1' }), waitMs: 60000,
    });
    const a = readAuthJson();
    return {
      ok: screenOf(r.pageUrl) === 'editor',
      run: r, screen: screenOf(r.pageUrl), auth: a,
      expect: 'projects.html(오프라인이어도 서명이 신선하면 통과)',
    };
  });

def('offline-stale-sig',
  '③ 서명 exp 는 지났지만 유예(iat+45d) 안 — 오프라인 통과해야 한다',
  async () => {
    /* ★서명은 «서버가 만든 것»이라야 한다. 그래서 시간을 앱이 아니라 «서버»에서 민다. */
    setState({ mode: 'ok', plan: 'pro', accessUntil: null, sub: 'u_e4_perp', sessionToken: 'tok_perp',
      iatOffsetDays: -40, expOffsetDays: 30 });   // iat 40일 전, exp 10일 전(만료) · 유예 45일 안
    const fresh = await fetchSigned('tok_perp');
    const a = readAuthJson() || {};
    a.signed = fresh; writeAuthJson(a);
    const r = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT, label: 'c3b-stale',
      env: baseEnv({ GODITOR_LICENSE_API: 'http://127.0.0.1:1' }), waitMs: 60000,
    });
    return { ok: screenOf(r.pageUrl) === 'editor', run: r, screen: screenOf(r.pageUrl),
      expect: 'projects.html(exp 지남 · 유예 안)' };
  });

def('offline-grace-exceeded',
  '③ 유예(iat+45d)도 지난 서명 — 오프라인이면 «확인 필요»로 막혀야 한다',
  async () => {
    setState({ mode: 'ok', plan: 'pro', accessUntil: null, sub: 'u_e4_perp', sessionToken: 'tok_perp',
      iatOffsetDays: -60, expOffsetDays: 30 });
    const fresh = await fetchSigned('tok_perp');
    const a = readAuthJson() || {}; a.signed = fresh; writeAuthJson(a);
    const r = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT, label: 'c3c-grace-out',
      env: baseEnv({ GODITOR_LICENSE_API: 'http://127.0.0.1:1' }), waitMs: 60000,
    });
    return { ok: screenOf(r.pageUrl) === 'license', run: r, screen: screenOf(r.pageUrl),
      authState: r.authState, expect: 'license.html · status=sig_expired · pending=verify' };
  });

def('offline-access-ended',
  '③ 구독 종료(accessUntil 과거)를 «서명으로» 받은 상태 — 유예 없이 만료 화면',
  async () => {
    setState({ mode: 'ok', plan: 'pro', accessUntil: new Date(Date.now() - 10 * DAY).toISOString(),
      sub: 'u_e4_perp', sessionToken: 'tok_perp' });
    const fresh = await fetchSigned('tok_perp');
    const a = readAuthJson() || {}; a.signed = fresh; a.accessUntil = new Date(Date.now() - 10 * DAY).toISOString();
    writeAuthJson(a);
    const r = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT, label: 'c3d-access-ended',
      env: baseEnv({ GODITOR_LICENSE_API: 'http://127.0.0.1:1' }), waitMs: 60000,
    });
    return { ok: screenOf(r.pageUrl) === 'license' && r.authState?.status === 'access_ended',
      run: r, screen: screenOf(r.pageUrl), authState: r.authState,
      expect: 'license.html · status=access_ended' };
  });

def('tamper-accessuntil',
  '④ auth.json 의 accessUntil 을 «2099» 로 손으로 고친다 ⇒ 통과하면 안 된다',
  async () => {
    const a = readAuthJson() || {};
    a.accessUntil = '2099-12-31T00:00:00.000Z';
    /* ★서명은 «그대로» 둔다 — 위조의 핵심은 「평문만 고친다」이다.
       서명 안의 accessUntil 이 과거이므로 판정은 L5(access_ended)여야 한다. */
    writeAuthJson(a);
    const r = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT, label: 'c4-tamper',
      env: baseEnv({ GODITOR_LICENSE_API: 'http://127.0.0.1:1' }), waitMs: 60000,
    });
    return { ok: screenOf(r.pageUrl) !== 'editor', run: r, screen: screenOf(r.pageUrl),
      authState: r.authState, authAfter: readAuthJson(),
      expect: '⛔projects.html 이 아니어야 한다' };
  });

def('tamper-payload',
  '④ 서명 payload 를 «다시 써서» 넣는다(accessUntil 2099) ⇒ bad_sig 로 거부',
  async () => {
    const a = readAuthJson() || {};
    const p = JSON.parse(Buffer.from(a.signed.payload, 'base64url').toString('utf8'));
    p.accessUntil = '2099-12-31T00:00:00.000Z';
    a.signed = { ...a.signed, payload: Buffer.from(JSON.stringify(p)).toString('base64url') };
    a.accessUntil = '2099-12-31T00:00:00.000Z';
    writeAuthJson(a);
    const r = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT, label: 'c4b-tamper-payload',
      env: baseEnv({ GODITOR_LICENSE_API: 'http://127.0.0.1:1' }), waitMs: 60000,
    });
    return { ok: screenOf(r.pageUrl) !== 'editor', run: r, screen: screenOf(r.pageUrl),
      authState: r.authState, expect: '⛔통과 금지 · status=signature_invalid' };
  });

def('strip-signed',
  '④ `signed` 를 통째로 지운다 ⇒ 「거부」가 아니라 «서버에 다시 묻는» 경로여야 한다',
  async () => {
    setState({ mode: 'ok', plan: 'pro', accessUntil: null, sub: 'u_e4_perp', sessionToken: 'tok_perp' });
    const a = readAuthJson() || {};
    delete a.signed;
    /* 옛 규칙(legacy)로도 못 넘게 accessUntil 을 «과거»로 둔다 —
       그래야 「서버에 묻는 경로」가 실제로 도는지가 보인다(legacy_grace 로 새어 통과하면 안 보인다). */
    a.accessUntil = new Date(Date.now() - 3 * DAY).toISOString();
    writeAuthJson(a);
    const offline = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT, label: 'c4c-strip-offline',
      env: baseEnv({ GODITOR_LICENSE_API: 'http://127.0.0.1:1' }), waitMs: 60000,
    });
    /* 같은 상태로 «온라인» — 서버가 서명을 주면 통과로 풀려야 한다. */
    const online = await runOnce({
      repoRoot: REPO, port: PORT, userDataDir: UD, outDir: OUT, label: 'c4c-strip-online',
      env: baseEnv(), waitMs: 60000,
      afterPage: async (cdp) => {
        /* license.html 의 [다시 시도] 경로 = auth:refresh. 화면 문구에 안 기대고 IPC 로 직접 푼다. */
        const before = await cdp.evalx('location.href');
        const rr = await cdp.evalx('window.electronAPI.refreshAuth()').catch((e) => ({ _err: String(e.message) }));
        await sleep(1500);
        let nav = null;
        try { nav = await cdp.evalx('window.electronAPI.navigateToProjects()'); } catch (e) { nav = { _err: String(e.message) }; }
        await sleep(2000);
        const after = await cdp.evalx('location.href').catch(() => 'PAGE_GONE');
        return { before, refresh: rr, nav, after };
      },
    });
    const a2 = readAuthJson();
    return {
      ok: screenOf(offline.pageUrl) === 'license'
        && offline.authState?.pending === 'verify'
        && !!(a2 && a2.signed && a2.signed.payload)
        && screenOf(online.after?.after) === 'editor',
      offline: { screen: screenOf(offline.pageUrl), authState: offline.authState, run: offline },
      online: { run: online, authAfter: a2 },
      expect: '오프라인=license.html+pending:verify · 온라인=서명 재수령 후 projects.html',
    };
  });

def('packaged-env-ignored',
  '★dev 게이트 실측 — 「가짜 공개키 env」가 dev 에선 먹고, packaged 에선 무시되는가(모듈 계약)',
  async () => {
    /* ⚠️이 케이스는 «모듈»을 재는 것이지 앱을 띄우지 않는다 — 패키징 빌드 실기는 별도(§패키징).
       그래도 여기 둔다: env 게이트가 죽으면 위 케이스 전부가 «아무것도 안 보는» 초록이 된다. */
    const ent = await import(pathToFileURL(path.join(REPO, 'services', 'entitlement.js')).href);
    const pub = fs.readFileSync(PUB, 'utf8');
    const dev = ent.default.resolveKeys({ isPackaged: false, env: { GODITOR_ENTITLEMENT_PUBKEY: pub } });
    const pkg = ent.default.resolveKeys({ isPackaged: true, env: { GODITOR_ENTITLEMENT_PUBKEY: pub } });
    return {
      ok: dev.k1 === pub && pkg.k1 !== pub && pkg.k1 === ent.default.PUBLIC_KEYS.k1,
      devUsesEnv: dev.k1 === pub, packagedIgnoresEnv: pkg.k1 !== pub,
      expect: 'dev=env 키 · packaged=코드 상수 키',
    };
  });

/** 가짜 서버에서 서명본 하나를 받아온다(현재 state 그대로). */
async function fetchSigned(sessionToken) {
  const res = await fetch(`${API}/api/license/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e4@test.local', sessionToken }),
  });
  const j = await res.json();
  if (!j.signed) throw new Error('가짜 서버가 signed 를 안 줬다: ' + JSON.stringify(j));
  return j.signed;
}

/* ── 실행 ──────────────────────────────────────────────────────────────── */
if (argv.includes('--list')) {
  for (const c of Object.values(CASES)) console.log(`${c.name.padEnd(24)} ${c.why}`);
  process.exit(0);
}
const name = arg('case', '');
if (!CASES[name]) { console.error('unknown --case. --list 로 확인해라.'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const r = await CASES[name].fn();
const rec = { case: name, why: CASES[name].why, ms: Date.now() - t0, ...r };
fs.writeFileSync(path.join(OUT, `result-${name}.json`), JSON.stringify(rec, null, 2), 'utf8');
console.log(JSON.stringify(rec, null, 2));
process.exit(r.ok ? 0 : 1);
