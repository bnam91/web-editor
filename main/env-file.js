/* ═══════════════════════════════════════════════════════════════════════════
   main/env-file.js — 개발자 편의 `.env` 를 «개발 빌드에서만» 읽는다.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 게이트가 필요한가 (2026-09-06 실측)
     예전엔 main.js 가 아무 조건 없이 두 파일을 읽었다:
       ⑴ <앱>/.env                      ⑵ ~/.config/secrets/.env   ← ★사용자 홈
     ⑵ 때문에 «사용자가 자기 홈에 한 줄 쓰면» 앱의 env 게이트가 전부 열렸다.
     `GODITOR_LICENSE_API`(서버 바꿔치기)·`GODITOR_ENTITLEMENT_PUBKEY`(자기 서명 키)·
     `GODITOR_ADMIN_TOKEN` 이 그 게이트에 걸려 있다. 그것들을 「패키징에선 무시」로 막아
     둔 이유가, 「env 우회는 asar 를 뜯는 것보다 쉽다」였다 — ⑵는 그보다도 더 쉬웠다.
     ⇒ 배포본에선 «한 줄도 안 읽는다». 개발 빌드는 그대로 읽는다.

   ★이 파일은 「패키징인가」를 «스스로 판정하지 않는다»
     `authService.isPackaged()` 하나만 본다. 그게 이 앱의 한 벌짜리 답이고,
     서버 주소(resolveApiBase)·collab 주소(main/collab/transport.js)도 같은 것을 본다.
     ⛔여기에 `app.isPackaged`·`process.env`·경로검사를 새로 들이지 마라.

   ★사용자 자기 API 키는 이 경로와 «무관»하다
     환경설정(settings.json `apiKeys`) → main.js `getApiKey()` → `payload.apiKey` 로
     서비스에 들어간다. `.env` 는 그 «다음» 순위의 개발자 폴백일 뿐이라, 배포본에서
     이걸 안 읽어도 AI 기능은 사용자 키로 그대로 돈다.
═══════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const os = require('os');
const _auth = require('../services/authService');

/** 파일 한 개를 env 객체에 부어넣는다. 없으면 조용히 지나간다. */
function _loadEnvFile(p, env) {
  if (!fs.existsSync(p)) return 0;
  let n = 0;
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...v] = trimmed.split('=');
    if (k && v.length) { env[k.trim()] = v.join('=').trim(); n++; }
  });
  return n;
}

/**
 * 개발 빌드에서만 `.env` 들을 읽는다.
 * @param {{appDir?:string, homeDir?:string, files?:string[], env?:object}} [opts]
 *        ⛔`isPackaged` 는 «인자로 받지 않는다» — 받으면 판정이 두 벌이 된다.
 *          검사는 `authService.applyRuntime()` 으로 «진짜 경로»를 흔들어라.
 * @returns {{skipped:boolean, files:string[], count:number}}
 */
function loadDevEnvFiles(opts) {
  const o = opts || {};
  /* ★게이트. 판정은 authService 가 한다 — 여기선 «묻기만» 한다.
     ★답을 못 얻으면 «막는 쪽»이다: 검사 하네스가 authService 를 부분 스텁으로 갈아끼우는
       일이 실제로 있고(entitlement-ipc), 그때 조용히 열리면 안 된다.
       main.js 가 `applyRuntime` 을 `typeof` 로 감싸 부르는 것과 «같은 이유»다. */
  const packaged = (typeof _auth.isPackaged === 'function') ? _auth.isPackaged() : true;
  if (packaged) return { skipped: true, files: [], count: 0 };

  const env = o.env || process.env;
  const files = Array.isArray(o.files) ? o.files : [
    path.join(o.appDir || path.join(__dirname, '..'), '.env'),
    path.join(o.homeDir || os.homedir(), '.config/secrets/.env'),
  ];
  let count = 0;
  for (const f of files) count += _loadEnvFile(f, env);
  return { skipped: false, files, count };
}

module.exports = { loadDevEnvFiles, _loadEnvFile };
