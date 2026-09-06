#!/usr/bin/env node
/* 가짜 라이선스 서버 — 서명 자격증명(entitlement) «실기» 검증용.
 *
 * ★왜 필요한가
 *   `services/entitlement.js` 는 순수 모듈이라 단위검사로 다 잴 수 있다. 하지만 «앱이 실제로
 *   뜨는가»는 못 잰다 — writeAuth 화이트리스트가 서명을 조용히 버리는지, 무기한(null) 사용자가
 *   매 실행 로그인 화면으로 튕기는지는 «디스크와 화면»으로만 드러난다.
 *   ⇒ 그러려면 서명을 «만들어 주는» 서버가 있어야 하는데, 라이브 서버의 개인키는 우리에게 없다.
 *
 * ★그래서 이 서버가 «자기 키쌍»을 만든다.
 *   - 개인키는 **디스크에 안 남는다**(메모리에서 generateKeyPairSync). 그래서 `tools/release/
 *     asar-secret-gate.mjs` 의 PEM 스캔에 걸릴 파일이 애초에 생기지 않는다.
 *   - 공개키만 `--pub-out` 으로 뱉는다. 앱은 그걸 `GODITOR_ENTITLEMENT_PUBKEY` 로 받는다
 *     (⚠️`resolveKeys` 가 **isPackaged 면 무시**한다 — 그 동작 자체가 검증 항목이다).
 *
 * ⛔라이브 서버(blacksheepwall.kr)를 대신하지 «않는다». 실제 신고·로그인이 남지 않게
 *   앱에는 `GODITOR_LICENSE_API=http://127.0.0.1:<port>` 를 준다(dev 빌드에서만 먹는다).
 *
 * ★응답 규격은 «서버 실물»에서 옮겼다 — `hompage_app@feat/entitlement`
 *   `api/_lib/entitlement-sign.js`(issue/verify/publicKeyPem) · `api/license/session.js`.
 *   서명 대상 = b64url(payload JSON) «문자열 그 자체». 응답 키는 `signed:{payload,sig,kid}`.
 *
 * 사용:
 *   node fake-license-server.mjs --port 8790 --state <state.json> --pub-out <pub.pem> [--log <f>]
 *
 * state.json 은 «매 요청마다 다시 읽는다» — 앱을 껐다 켜는 사이에 시나리오를 바꾸려고
 * 서버까지 재기동하면 키가 바뀌어 앞 회차의 서명본이 전부 무효가 된다(그 자체가 사고 재현이
 * 아니라 «검사의 오염»이다).
 */
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DAY = 24 * 60 * 60 * 1000;
const KID = 'k1';
const VER = 1;

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const PORT = Number(arg('port', '8790'));
const STATE_PATH = arg('state', '');
const PUB_OUT = arg('pub-out', '');
const LOG_PATH = arg('log', '');

if (!STATE_PATH || !PUB_OUT) {
  console.error('usage: fake-license-server.mjs --port N --state <json> --pub-out <pem> [--log <f>]');
  process.exit(1);
}

/* ── 키쌍 — «메모리에만» 둔다 ─────────────────────────────────────────────── */
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
/* ★두 번째 키쌍 = 「위조」 시나리오용. 서버가 «다른 키»로 서명하면 앱은 bad_sig 로 거절해야 한다.
   ⛔이걸 「공개키를 안 준다」로 대신하면 unknown_kid 가 되어 «다른 갈래»를 재게 된다. */
const wrong = crypto.generateKeyPairSync('ed25519');

const PUB_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
fs.writeFileSync(PUB_OUT, PUB_PEM, 'utf8');

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}`;
  console.log(line);
  if (LOG_PATH) { try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch (_) {} }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (e) {
    log('STATE_READ_FAIL', e.message);
    return { mode: 'ok' };
  }
}

const b64url = (b) => Buffer.from(b).toString('base64url');

/** 서버 `entitlement-sign.js` `issue()` 와 «같은 계산». */
function issue(st, { email, sessionToken }) {
  const now = Date.now();
  const iat = now + Number(st.iatOffsetDays || 0) * DAY;
  const exp = iat + Number(st.expOffsetDays == null ? 30 : st.expOffsetDays) * DAY;
  const payload = {
    ver: VER,
    kid: st.kid || KID,
    app: st.app || 'goditor',
    sub: String(st.sub || 'u_e4_test'),
    email: email ? String(email) : null,
    plan: st.plan ? String(st.plan) : null,
    /* ★null = «무기한». `''` 로 뭉개면 이 검증의 ① 자체가 성립하지 않는다. */
    accessUntil: st.accessUntil === null || st.accessUntil === undefined
      ? null : new Date(st.accessUntil).toISOString(),
    iat: new Date(iat).toISOString(),
    exp: new Date(exp).toISOString(),
    sid: st.sid === false || !sessionToken
      ? null
      : crypto.createHash('sha256').update(String(sessionToken), 'utf8').digest('hex').slice(0, 16),
  };
  if (st.payloadOverride && typeof st.payloadOverride === 'object') Object.assign(payload, st.payloadOverride);

  const encoded = b64url(JSON.stringify(payload));
  const key = st.signWith === 'wrong-key' ? wrong.privateKey : privateKey;
  const sig = b64url(crypto.sign(null, Buffer.from(encoded, 'utf8'), key));
  return { payload: encoded, sig, kid: st.kidOuter || payload.kid };
}

function bodyOf(req) {
  return new Promise((res) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (_) { res({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const st = readState();
  const url = req.url || '/';
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  /* ★모든 지연에 상한이 있다 — `delayMs` 를 무한대로 두면 «검사»가 멈춘다.
     앱쪽 타임아웃(authService TIMEOUT_MS=10s)보다 조금 길게만 끌 수 있게 막는다. */
  const delay = Math.min(Number(st.delayMs || 0), 20000);
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  if (!url.startsWith('/api/license/')) {
    /* urlIsLive() 가 GET 으로 두드리는 페이지들(signup/pricing/find-*). 200 이면 된다. */
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>fake</body></html>');
    return;
  }

  const body = await bodyOf(req);
  log('REQ', req.method, url, 'mode=' + (st.mode || 'ok'), 'email=' + (body.email || ''));

  if (url.startsWith('/api/license/login')) {
    /* ★서버 `login.js` 는 `signed` 를 «안 준다» — 그래서 앱이 로그인 뒤 session 을 한 번 더 부른다.
       그 배선이 살아 있는지가 검증 대상이라, 여기서도 절대 signed 를 붙이지 않는다. */
    if (st.mode === 'invalid_credentials') return send(401, { ok: false, reason: 'invalid_credentials' });
    return send(200, {
      ok: true,
      email: body.email || st.email || 'e4@test.local',
      plan: st.plan || 'pro',
      accessUntil: st.accessUntil === undefined ? null : st.accessUntil,
      sessionToken: st.sessionToken || 'tok_e4_default',
    });
  }

  if (url.startsWith('/api/license/session')) {
    const mode = st.mode || 'ok';
    /* 「서버가 말을 안 한다」 갈래들 — 앱은 캐시를 «안 건드려야» 한다. */
    if (mode === 'down') { res.destroy(); return; }
    if (mode === 'http500') return send(500, { ok: false, reason: 'server' });
    if (mode === 'http404') return send(404, { ok: false, reason: 'not_found' });

    if (mode === 'invalid_session') return send(401, { ok: false, reason: 'invalid_session' });

    const signed = mode === 'ok_unsigned' || mode === 'expired_unsigned'
      ? null
      : issue(st, { email: body.email, sessionToken: body.sessionToken });

    if (mode === 'expired' || mode === 'expired_unsigned') {
      return send(200, {
        ok: false, reason: 'expired',
        plan: st.plan || 'pro',
        accessUntil: st.accessUntil === undefined ? null : st.accessUntil,
        ...(signed ? { signed } : {}),
      });
    }
    return send(200, {
      ok: true,
      plan: st.plan || 'pro',
      accessUntil: st.accessUntil === undefined ? null : st.accessUntil,
      ...(signed ? { signed } : {}),
    });
  }

  return send(404, { ok: false, reason: 'not_found' });
});

server.listen(PORT, '127.0.0.1', () => {
  log('LISTEN', `http://127.0.0.1:${PORT}`, 'pub=' + PUB_OUT);
  console.log('READY');
});
