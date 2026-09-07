'use strict';
/**
 * 자동업데이트 «설치 완료 후» 남는 pending 페이로드 정리 — R1/A1
 *
 * ★왜 여기(=다음 실행의 시작)인가
 *   윈·맥 «둘 다» 설치는 앱이 죽으면서 일어난다(윈=NSIS 를 spawn 하고 quit, 맥=Squirrel.Mac 이 종료 시 교체).
 *   그래서 quitAndInstall 직후에 지우면 «설치기가 읽을 파일»을 지운다 = 업데이트가 깨진다.
 *   설치가 «끝났다»고 말할 수 있는 첫 시점은 다음 실행이고, 그 판정식은 하나다:
 *
 *        정리한다  ⟺  version(pending 페이로드)  ≤  version(지금 도는 앱)
 *
 *   - 업데이트 완료 후 첫 실행 → 같음 → 지운다
 *   - 「나중에」 후 비정상 종료(설치 안 됨) → pending 이 더 새것 → 안 지운다(재다운로드 안 하게)
 *   - 옛 잔재(0.8.6 페이로드 + 0.9.x 앱) → 지운다
 *
 * ★무엇을 «안» 지우나
 *   캐시 루트의 `installer.exe`(윈) / `update.zip`(맥) / `current.blockmap` 은 「이전 설치파일」이 아니라
 *   «다음 업데이트의 차분 다운로드 기준»이다. 지우면 다음 업데이트가 전량 다운로드로 퇴행한다.
 *   ⇒ 이 모듈은 `pending/` «안»만 건드린다. (electron-updater 자신도 캐시가 낡으면
 *      DownloadedUpdateHelper.cleanCacheDirForPendingUpdate 로 pending 을 통째 비운다 — 같은 조작이다.)
 *
 * 이 파일은 electron 을 require 하지 않는다(순수 fs/path) → node 로 그대로 단위테스트한다.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PENDING_DIR = 'pending';
const MARKER_FILE = 'goditor-pending.json';
const UPDATE_INFO_FILE = 'update-info.json';

/* ── 경로 ─────────────────────────────────────────────────────────────── */

/**
 * electron-updater 의 AppAdapter.getAppCacheDir 과 «같은 규칙». 인자로 주입 가능하게만 바꿨다.
 * (electron-updater 내부 모듈을 require 하면 버전이 오를 때 조용히 깨진다 → 규칙만 복제하고 테스트로 못박는다.)
 */
function getAppCacheDir(platform = process.platform, env = process.env, home = os.homedir()) {
  if (platform === 'win32') return env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  if (platform === 'darwin') return path.join(home, 'Library', 'Caches');
  return env.XDG_CACHE_HOME || path.join(home, '.cache');
}

/**
 * app-update.yml 에서 updaterCacheDirName 을 읽는다.
 * ⛔못 읽으면 null 을 돌려준다 — app.getName() 으로 «추측»해서 엉뚱한 디렉터리를 지우지 않기 위해서다.
 *   (개발 실행에는 app-update.yml 이 없다 → 그때는 이 기능이 통째로 무동작이 정답.)
 */
function readUpdaterCacheDirName(configPath) {
  let text;
  try { text = fs.readFileSync(configPath, 'utf8'); } catch (_) { return null; }
  const m = /^[ \t]*updaterCacheDirName[ \t]*:[ \t]*(.+?)[ \t]*$/m.exec(text);
  if (!m) return null;
  const raw = m[1].replace(/^['"]|['"]$/g, '').trim();
  // 경로 구분자가 섞이면 캐시 루트 밖을 가리킬 수 있다 → 한 조각만 허용.
  if (!raw || raw === '.' || raw === '..' || /[\\/]/.test(raw)) return null;
  return raw;
}

/* ── 버전 ─────────────────────────────────────────────────────────────── */

/** '0.9.1-beta.2' → {core:[0,9,1], pre:['beta',2]} · 못 읽으면 null */
function parseVersion(text) {
  if (typeof text !== 'string') return null;
  const m = /^\s*v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(text.trim());
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split('.').map(id => (/^\d+$/.test(id) ? Number(id) : id)) : [],
  };
}

/**
 * 파일명에서 «코어만» 읽는다.
 * ⚠️ 여기서 프리릴리즈까지 읽으면 `GODITOR-0.9.1-arm64-mac.zip` 이 `0.9.1-arm64` 가 된다(arch 를 프리릴리즈로 오독).
 */
function parseCoreFromFileName(name) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(name || ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compareCore(a, b) {
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; }
  return 0;
}

/** semver 우선순위 비교(프리릴리즈 포함). -1 / 0 / 1 */
function compareVersion(a, b) {
  const c = compareCore(a.core, b.core);
  if (c !== 0) return c;
  if (a.pre.length === 0 && b.pre.length === 0) return 0;
  if (a.pre.length === 0) return 1;   // 정식 > 프리릴리즈
  if (b.pre.length === 0) return -1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i], y = b.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xn = typeof x === 'number', yn = typeof y === 'number';
    if (xn && yn) return x < y ? -1 : 1;
    if (xn) return -1;                 // 숫자 < 문자
    if (yn) return 1;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

/* ── 판정 ─────────────────────────────────────────────────────────────── */

/**
 * @param {{currentVersion:string, pendingVersion:string|null, source:'marker'|'filename'|null}} args
 * @returns {{clean:boolean, reason:string}}
 */
function decideCleanup({ currentVersion, pendingVersion, source }) {
  const cur = parseVersion(currentVersion);
  if (!cur) return { clean: false, reason: `현재 버전을 못 읽음(${currentVersion})` };
  if (!pendingVersion) return { clean: false, reason: 'pending 버전 판정 불가 — 보수적으로 보존' };

  if (source === 'marker') {
    const pen = parseVersion(pendingVersion);
    if (!pen) return { clean: false, reason: `마커 버전을 못 읽음(${pendingVersion})` };
    const cmp = compareVersion(pen, cur);
    return cmp <= 0
      ? { clean: true, reason: `마커 ${pendingVersion} ≤ 앱 ${currentVersion} → 소진` }
      : { clean: false, reason: `마커 ${pendingVersion} > 앱 ${currentVersion} → 설치 대기 중` };
  }

  // 폴백(파일명)은 코어만 안다 → 프리릴리즈끼리는 구분 못 하므로 «보수적으로» 판정한다.
  const pcore = parseCoreFromFileName(pendingVersion);
  if (!pcore) return { clean: false, reason: `파일명에서 버전을 못 읽음(${pendingVersion})` };
  const cmp = compareCore(pcore, cur.core);
  if (cmp < 0) return { clean: true, reason: `파일명 ${pcore.join('.')} < 앱 ${currentVersion} → 소진` };
  if (cmp > 0) return { clean: false, reason: `파일명 ${pcore.join('.')} > 앱 ${currentVersion} → 설치 대기 중` };
  if (cur.pre.length === 0) return { clean: true, reason: `파일명 ${pcore.join('.')} = 앱 ${currentVersion} → 소진` };
  return { clean: false, reason: `코어 동일인데 앱이 프리릴리즈(${currentVersion}) — 파일명만으론 구분 불가, 보존` };
}

/* ── 디스크 ───────────────────────────────────────────────────────────── */

/** pending 안에서 「이 페이로드가 몇 버전인가」를 읽는다. 마커 우선, 없으면 파일명. */
function readPendingVersion(pendingDir) {
  try {
    const raw = fs.readFileSync(path.join(pendingDir, MARKER_FILE), 'utf8');
    const j = JSON.parse(raw);
    if (j && typeof j.version === 'string' && j.version) return { version: j.version, source: 'marker' };
  } catch (_) { /* 마커 없음 = 이 기능 이전에 받은 잔재 */ }

  let entries = [];
  try { entries = fs.readdirSync(pendingDir); } catch (_) { return { version: null, source: null }; }

  // update-info.json 의 fileName 이 가장 믿을 만한 «페이로드 이름»이다.
  try {
    const info = JSON.parse(fs.readFileSync(path.join(pendingDir, UPDATE_INFO_FILE), 'utf8'));
    if (info && typeof info.fileName === 'string' && parseCoreFromFileName(info.fileName)) {
      return { version: info.fileName, source: 'filename' };
    }
  } catch (_) { /* 없거나 깨짐 → 아래로 */ }

  const payload = entries.find(n => n !== UPDATE_INFO_FILE && n !== MARKER_FILE && parseCoreFromFileName(n));
  return payload ? { version: payload, source: 'filename' } : { version: null, source: null };
}

/**
 * pending 을 «비운다». 디렉터리 자체는 남긴다(electron-updater 의 emptyDir 과 같은 결과).
 * @returns {{removed:string[], bytes:number, failed:{name:string,error:string}[]}}
 */
function emptyPendingDir(pendingDir) {
  const removed = [], failed = [];
  let bytes = 0;
  let entries = [];
  try { entries = fs.readdirSync(pendingDir, { withFileTypes: true }); } catch (_) { return { removed, bytes, failed }; }
  for (const e of entries) {
    const p = path.join(pendingDir, e.name);
    try {
      const st = fs.lstatSync(p);
      const size = st.isDirectory() ? 0 : st.size;
      fs.rmSync(p, { recursive: true, force: true });
      removed.push(e.name);
      bytes += size;
    } catch (err) {
      failed.push({ name: e.name, error: err.message });
    }
  }
  return { removed, bytes, failed };
}

/**
 * ★진입점. 소진된 pending 이면 비운다.
 * @param {{cacheDir:string, currentVersion:string, logger?:{info:Function,warn:Function}}} args
 * @returns {{cleaned:boolean, reason:string, removed:string[], bytes:number, failed:Array}}
 */
function cleanPendingIfSpent({ cacheDir, currentVersion, logger }) {
  const log = logger || { info() {}, warn() {} };
  const pendingDir = path.join(cacheDir, PENDING_DIR);
  const base = { cleaned: false, removed: [], bytes: 0, failed: [] };

  if (!fs.existsSync(pendingDir)) return { ...base, reason: 'pending 디렉터리 없음' };

  const { version, source } = readPendingVersion(pendingDir);
  const verdict = decideCleanup({ currentVersion, pendingVersion: version, source });
  if (!verdict.clean) {
    log.info(`[updater-cache] 보존 — ${verdict.reason}`);
    return { ...base, reason: verdict.reason };
  }

  const r = emptyPendingDir(pendingDir);
  if (r.failed.length) {
    log.warn(`[updater-cache] 일부 삭제 실패: ${r.failed.map(f => `${f.name}(${f.error})`).join(', ')}`);
  }
  log.info(`[updater-cache] 정리 — ${verdict.reason} · ${r.removed.length}개 / ${r.bytes}B 삭제`);
  return { cleaned: true, reason: verdict.reason, removed: r.removed, bytes: r.bytes, failed: r.failed };
}

/** update-downloaded 시점에 「이 pending 은 몇 버전인가」를 박아둔다(다음 실행의 판정 정본). */
function writePendingMarker({ cacheDir, version, fileName }) {
  const pendingDir = path.join(cacheDir, PENDING_DIR);
  fs.mkdirSync(pendingDir, { recursive: true });
  fs.writeFileSync(
    path.join(pendingDir, MARKER_FILE),
    JSON.stringify({ version: String(version || ''), fileName: fileName || null, at: new Date().toISOString() }, null, 2),
  );
}

/** 캐시 루트 계산. 이름을 못 읽으면 null(=무동작). */
function resolveUpdaterCacheDir({ appUpdateConfigPath, platform, env, home }) {
  const dirName = readUpdaterCacheDirName(appUpdateConfigPath);
  if (!dirName) return null;
  return path.join(getAppCacheDir(platform, env, home), dirName);
}

module.exports = {
  PENDING_DIR, MARKER_FILE, UPDATE_INFO_FILE,
  getAppCacheDir, readUpdaterCacheDirName, resolveUpdaterCacheDir,
  parseVersion, parseCoreFromFileName, compareVersion, compareCore,
  decideCleanup, readPendingVersion, emptyPendingDir,
  cleanPendingIfSpent, writePendingMarker,
};
