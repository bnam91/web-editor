/* R1/A1 하네스 — main/updater-cache.js (자동업데이트 pending 정리)
 * 실행: node --test "tests/unit/updater-cache.test.js"
 * 라이브 무접촉: 디스크 쓰기는 전부 _tmproot 우산 안.
 *
 * ★이 스위트가 «재려고» 하는 것
 *   ⑴ 판정식 — 「pending ≤ 앱」일 때만 지운다. ★음성대조(안 지워야 하는 경우)를 짝으로 둔다.
 *      (양성만 있으면 「항상 지운다」는 구현이 통과한다 — 2026-08 학습.)
 *   ⑵ 경계 — 프리릴리즈, arch 접미사(0.9.1-arm64-mac 오독), 판정불가.
 *   ⑶ 부작용 범위 — pending «안»만 지운다. 루트의 차분 기준파일(installer.exe/update.zip/current.blockmap)은
 *      한 바이트도 안 건드린다. → 호출 전후 디렉터리 (이름,크기) 스냅샷 대조로 «실측»한다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { mkTmpRoot: makeRoot } = require('./_tmproot');

const UC = require('../../main/updater-cache');

/* ── 도구 ────────────────────────────────────────────────────────────── */
function snap(dir) {
  const out = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const p = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { out.push([r + '/', -1]); walk(p, r); }
      else out.push([r, fs.statSync(p).size]);
    }
  };
  walk(dir, '');
  return out;
}

/** 실제 캐시 모양 그대로 만든다(루트 차분기준 + pending 페이로드). */
function makeCache(root, { payload, marker, updateInfo, rootFiles = { 'installer.exe': 1024, 'current.blockmap': 32 }, temp }) {
  const cache = path.join(root, 'sangpe-editor-updater');
  const pending = path.join(cache, 'pending');
  fs.mkdirSync(pending, { recursive: true });
  for (const [n, sz] of Object.entries(rootFiles)) fs.writeFileSync(path.join(cache, n), Buffer.alloc(sz, 1));
  if (payload) fs.writeFileSync(path.join(pending, payload), Buffer.alloc(2048, 2));
  if (temp) fs.writeFileSync(path.join(pending, temp), Buffer.alloc(512, 3));
  if (updateInfo !== null) fs.writeFileSync(path.join(pending, 'update-info.json'), JSON.stringify(updateInfo || { fileName: payload, sha512: 'x', isAdminRightsRequired: false }));
  if (marker) fs.writeFileSync(path.join(pending, 'goditor-pending.json'), JSON.stringify(marker));
  return { cache, pending };
}

/* ── ⑴ 버전 파서/비교 ────────────────────────────────────────────────── */
test('parseVersion — 코어와 프리릴리즈를 가른다', () => {
  assert.deepEqual(UC.parseVersion('0.9.1').core, [0, 9, 1]);
  assert.deepEqual(UC.parseVersion('0.9.1').pre, []);
  assert.deepEqual(UC.parseVersion('v1.2.3-beta.2').pre, ['beta', 2]);
  assert.equal(UC.parseVersion('nope'), null);
});

test('compareVersion — 정식 > 프리릴리즈, 숫자 < 문자', () => {
  const v = UC.parseVersion;
  assert.equal(UC.compareVersion(v('0.9.1'), v('0.9.1')), 0);
  assert.equal(UC.compareVersion(v('0.9.0'), v('0.9.1')), -1);
  assert.equal(UC.compareVersion(v('0.10.0'), v('0.9.9')), 1);
  assert.equal(UC.compareVersion(v('0.9.1-beta.1'), v('0.9.1')), -1);      // 프리 < 정식
  assert.equal(UC.compareVersion(v('0.9.1-beta.1'), v('0.9.1-beta.2')), -1);
  assert.equal(UC.compareVersion(v('0.9.1-beta'), v('0.9.1-1')), 1);        // 문자 > 숫자
});

test('★parseCoreFromFileName — arch 접미사를 프리릴리즈로 오독하지 않는다', () => {
  // 이걸 프리릴리즈까지 읽으면 `0.9.1-arm64-mac` 이 되어 0.9.1 보다 «작다»고 판정된다.
  assert.deepEqual(UC.parseCoreFromFileName('GODITOR-0.9.1-arm64-mac.zip'), [0, 9, 1]);
  assert.deepEqual(UC.parseCoreFromFileName('GODITOR-Setup-0.9.1.exe'), [0, 9, 1]);
  assert.deepEqual(UC.parseCoreFromFileName('temp-GODITOR-Setup-0.10.2.exe'), [0, 10, 2]);
  assert.equal(UC.parseCoreFromFileName('update-info.json'), null);
});

/* ── ⑵ 판정 (양성/음성 짝) ───────────────────────────────────────────── */
test('decideCleanup(marker) — 같거나 낮으면 지운다 / 높으면 «안» 지운다', () => {
  const d = (p, c, s = 'marker') => UC.decideCleanup({ currentVersion: c, pendingVersion: p, source: s });
  assert.equal(d('0.9.1', '0.9.1').clean, true, '설치 직후: pending == 앱 → 소진');
  assert.equal(d('0.8.6', '0.9.1').clean, true, '옛 잔재 → 소진');
  assert.equal(d('0.9.2', '0.9.1').clean, false, '★설치 대기 중 — 지우면 재다운로드를 강요한다');
  assert.equal(d('0.9.1-beta.2', '0.9.1-beta.1').clean, false, '프리릴리즈도 «더 새것»이면 보존');
  assert.equal(d('0.9.1-beta.1', '0.9.1').clean, true, '정식이 깔렸으면 그 프리릴리즈는 소진');
});

test('decideCleanup(filename) — 폴백은 «보수적»이다', () => {
  const d = (p, c) => UC.decideCleanup({ currentVersion: c, pendingVersion: p, source: 'filename' });
  assert.equal(d('GODITOR-0.8.6-arm64-mac.zip', '0.9.1').clean, true);
  assert.equal(d('GODITOR-Setup-0.9.1.exe', '0.9.1').clean, true);
  assert.equal(d('GODITOR-Setup-0.9.2.exe', '0.9.1').clean, false);
  // ★코어가 같은데 앱이 프리릴리즈면 파일명만으론 beta.1/beta.2 를 못 가른다 → 보존해야 한다.
  assert.equal(d('GODITOR-Setup-0.9.1.exe', '0.9.1-beta.1').clean, false);
});

test('decideCleanup — 판정 불가는 «보존»이다', () => {
  assert.equal(UC.decideCleanup({ currentVersion: '0.9.1', pendingVersion: null, source: null }).clean, false);
  assert.equal(UC.decideCleanup({ currentVersion: 'garbage', pendingVersion: '0.1.0', source: 'marker' }).clean, false);
});

/* ── ⑶ 디스크 — 부작용 «범위»를 실측한다 ─────────────────────────────── */
test('★소진된 pending 을 비운다 — 그리고 루트 차분기준은 «한 바이트도» 안 건드린다', () => {
  const root = makeRoot('uc-spent');
  const { cache, pending } = makeCache(root, {
    payload: 'GODITOR-Setup-0.9.1.exe',
    marker: { version: '0.9.1', fileName: 'GODITOR-Setup-0.9.1.exe' },
    temp: 'temp-GODITOR-Setup-0.9.1.exe',
  });
  const before = snap(cache).filter(([n]) => !n.startsWith('pending/'));

  const r = UC.cleanPendingIfSpent({ cacheDir: cache, currentVersion: '0.9.1' });

  assert.equal(r.cleaned, true, r.reason);
  assert.deepEqual(fs.readdirSync(pending), [], 'pending 은 «0개»여야 한다');
  assert.equal(snap(pending).reduce((a, [, s]) => a + Math.max(s, 0), 0), 0, 'pending 실측 0바이트');
  assert.deepEqual(snap(cache).filter(([n]) => !n.startsWith('pending/')), before, '루트 파일 무변경');
  assert.ok(r.bytes >= 2048 + 512, `삭제 바이트 보고: ${r.bytes}`);
});

test('★설치 대기 중인 pending 은 «건드리지 않는다»(음성대조)', () => {
  const root = makeRoot('uc-waiting');
  const { cache, pending } = makeCache(root, {
    payload: 'GODITOR-Setup-0.9.2.exe',
    marker: { version: '0.9.2', fileName: 'GODITOR-Setup-0.9.2.exe' },
  });
  const before = snap(cache);
  const r = UC.cleanPendingIfSpent({ cacheDir: cache, currentVersion: '0.9.1' });
  assert.equal(r.cleaned, false, r.reason);
  assert.deepEqual(snap(cache), before, '캐시 전체가 한 바이트도 안 바뀌어야 한다');
  assert.ok(fs.existsSync(path.join(pending, 'GODITOR-Setup-0.9.2.exe')));
});

test('마커 없는 «옛 잔재»도 update-info.json 의 fileName 으로 정리된다', () => {
  const root = makeRoot('uc-legacy');
  const { cache, pending } = makeCache(root, {
    payload: 'GODITOR-0.8.6-arm64-mac.zip',
    rootFiles: { 'update.zip': 4096 },
  });
  const r = UC.cleanPendingIfSpent({ cacheDir: cache, currentVersion: '0.8.6' });
  assert.equal(r.cleaned, true, r.reason);
  assert.deepEqual(fs.readdirSync(pending), []);
  assert.equal(fs.statSync(path.join(cache, 'update.zip')).size, 4096, 'update.zip 보존');
});

test('update-info.json 이 깨져 있어도 페이로드 파일명으로 판정한다', () => {
  const root = makeRoot('uc-broken-info');
  const { cache, pending } = makeCache(root, { payload: 'GODITOR-Setup-0.8.0.exe', updateInfo: { fileName: null } });
  const r = UC.cleanPendingIfSpent({ cacheDir: cache, currentVersion: '0.9.1' });
  assert.equal(r.cleaned, true, r.reason);
  assert.deepEqual(fs.readdirSync(pending), []);
});

test('버전을 어디서도 못 읽으면 «보존»한다', () => {
  const root = makeRoot('uc-unknown');
  const cache = path.join(root, 'sangpe-editor-updater');
  const pending = path.join(cache, 'pending');
  fs.mkdirSync(pending, { recursive: true });
  fs.writeFileSync(path.join(pending, 'mystery.bin'), Buffer.alloc(10));
  const r = UC.cleanPendingIfSpent({ cacheDir: cache, currentVersion: '0.9.1' });
  assert.equal(r.cleaned, false, r.reason);
  assert.deepEqual(fs.readdirSync(pending), ['mystery.bin']);
});

test('pending 이 없으면 무동작(예외 없음)', () => {
  const root = makeRoot('uc-nopending');
  const cache = path.join(root, 'sangpe-editor-updater');
  fs.mkdirSync(cache, { recursive: true });
  const r = UC.cleanPendingIfSpent({ cacheDir: cache, currentVersion: '0.9.1' });
  assert.equal(r.cleaned, false);
  assert.deepEqual(fs.readdirSync(cache), []);
});

/* ── ⑷ 마커 왕복 ─────────────────────────────────────────────────────── */
test('writePendingMarker → readPendingVersion 왕복 (마커가 파일명보다 «우선»)', () => {
  const root = makeRoot('uc-marker');
  const { cache, pending } = makeCache(root, { payload: 'GODITOR-Setup-0.9.1.exe' });
  UC.writePendingMarker({ cacheDir: cache, version: '0.9.2-beta.3', fileName: 'GODITOR-Setup-0.9.1.exe' });
  const got = UC.readPendingVersion(pending);
  assert.equal(got.source, 'marker');
  assert.equal(got.version, '0.9.2-beta.3', '파일명(0.9.1)이 아니라 마커를 읽어야 한다');
});

/* ── ⑸ 경로 해석 ─────────────────────────────────────────────────────── */
test('getAppCacheDir — electron-updater 의 규칙과 같다', () => {
  assert.equal(UC.getAppCacheDir('win32', { LOCALAPPDATA: 'C:\\LA' }, 'C:\\h'), 'C:\\LA');
  assert.equal(UC.getAppCacheDir('win32', {}, '/h'), path.join('/h', 'AppData', 'Local'));
  assert.equal(UC.getAppCacheDir('darwin', {}, '/h'), path.join('/h', 'Library', 'Caches'));
  assert.equal(UC.getAppCacheDir('linux', { XDG_CACHE_HOME: '/xc' }, '/h'), '/xc');
  assert.equal(UC.getAppCacheDir('linux', {}, '/h'), path.join('/h', '.cache'));
});

test('readUpdaterCacheDirName — 없으면 null(추측 금지), 경로조각이면 거부', () => {
  const root = makeRoot('uc-cfg');
  const ok = path.join(root, 'app-update.yml');
  fs.writeFileSync(ok, 'owner: bnam91\nrepo: web-editor\nprovider: github\nupdaterCacheDirName: sangpe-editor-updater\n');
  assert.equal(UC.readUpdaterCacheDirName(ok), 'sangpe-editor-updater');

  const missing = path.join(root, 'no-key.yml');
  fs.writeFileSync(missing, 'owner: bnam91\n');
  assert.equal(UC.readUpdaterCacheDirName(missing), null);
  assert.equal(UC.readUpdaterCacheDirName(path.join(root, 'nope.yml')), null, '파일 없음 → null');

  const evil = path.join(root, 'evil.yml');
  fs.writeFileSync(evil, 'updaterCacheDirName: ../../Documents\n');
  assert.equal(UC.readUpdaterCacheDirName(evil), null, '경로 구분자가 섞이면 거부');
});

test('resolveUpdaterCacheDir — 이름을 못 읽으면 null(=기능 무동작)', () => {
  const root = makeRoot('uc-resolve');
  const cfg = path.join(root, 'app-update.yml');
  fs.writeFileSync(cfg, 'updaterCacheDirName: sangpe-editor-updater\n');
  assert.equal(
    UC.resolveUpdaterCacheDir({ appUpdateConfigPath: cfg, platform: 'darwin', env: {}, home: '/h' }),
    path.join('/h', 'Library', 'Caches', 'sangpe-editor-updater'),
  );
  assert.equal(UC.resolveUpdaterCacheDir({ appUpdateConfigPath: path.join(root, 'none.yml') }), null);
});
