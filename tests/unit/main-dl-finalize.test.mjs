/* main-dl-finalize.test.mjs — DOWNLOADS-SYNC-MKDIR-ON-DOWNLOAD-01: will-download 는 ~/Downloads 를 메인 스레드 «동기»로 안 만진다.
 *   행위 = main.js 의 ▼DL_FINALIZE 블록을 «떼어» 가짜 fs.promises 로 돌린다(Electron 을 띄우지 않는다).
 *   + _makeWillDownload(핸들러)를 가짜 item·fs 로 돌린다: Downloads 가 안 돌아와도 즉시 끝·setSavePath=staging · 수집기 경로 · 실패 때 staging 에 남음.
 *   구조 = DL_FINALIZE 블록과 will-download 등록 자리에 *Sync( 호출이 없다.
 *   양성대조: GD1001_ROOT=<e7d97f1ec main.js 가 든 폴더> → F0·S1 빨강. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceCall } from './_slice-block.js';
const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');

function load() {
  const m = SRC.match(/\/\/ ▼DL_FINALIZE[^\n]*\n([\s\S]*?)\/\/ ▲DL_FINALIZE/);
  assert.ok(m, '★▼DL_FINALIZE … ▲DL_FINALIZE 블록이 없다');
  return new Function(`${m[1]}\nreturn { _dlFinalize, _makeWillDownload };`)();
}
/* 가짜 fs.promises — files 는 있는 파일 경로 집합. */
function fakeFs(files, { mkdirErr, renameErr } = {}) {
  const log = [];
  const err = (code) => Object.assign(new Error(code), { code });
  return {
    log, files,
    mkdir: async (d) => { log.push(['mkdir', d]); if (mkdirErr) throw err(mkdirErr); },
    access: async (p) => { if (!files.has(p)) throw err('ENOENT'); },
    rename: async (a, b) => { if (renameErr) throw err(renameErr); files.delete(a); files.add(b); log.push(['rename', a, b]); },
    copyFile: async (a, b) => { files.add(b); log.push(['copy', a, b]); },
    unlink: async (a) => { files.delete(a); log.push(['unlink', a]); },
    rm: async (d) => { log.push(['rm', d]); },
  };
}
const TMP = '/tmp/goditor-dl/1-1/a.png';

test('F0 전제 — 블록을 찾았고 함수가 선다', () => { assert.equal(typeof load()._dlFinalize, 'function'); assert.equal(typeof load()._makeWillDownload, 'function'); });
test('F1 겹침 없음 — dir/base 로 옮긴다', async () => {
  const f = fakeFs(new Set([TMP]));
  assert.deepEqual(await load()._dlFinalize(TMP, '/D', 'a.png', f, path), { path: '/D/a.png', moved: true });
  assert.ok(f.files.has('/D/a.png') && !f.files.has(TMP));
});
test('F2 겹침 — (1)·(2) 를 붙인다(종전 이름 규칙 그대로)', async () => {
  const f = fakeFs(new Set([TMP, '/D/a.png', '/D/a (1).png']));
  assert.equal((await load()._dlFinalize(TMP, '/D', 'a.png', f, path)).path, '/D/a (2).png');
});
test('F3 다른 볼륨(EXDEV) — 복사 후 임시 지움', async () => {
  const f = fakeFs(new Set([TMP]), { renameErr: 'EXDEV' });
  assert.deepEqual(await load()._dlFinalize(TMP, '/D', 'a.png', f, path), { path: '/D/a.png', moved: true });
  assert.ok(!f.files.has(TMP));
});
test('F4 접근 거부 — 던지지 않고 임시 경로를 돌려준다(파일 유실 없음)', async () => {
  const f = fakeFs(new Set([TMP]), { mkdirErr: 'EPERM' });
  assert.deepEqual(await load()._dlFinalize(TMP, '/D', 'a.png', f, path), { path: TMP, moved: false, error: 'EPERM' });
  assert.ok(f.files.has(TMP));
});
/* 가짜 DownloadItem — done 을 손으로 쏜다. */
function fakeItem(name) {
  const it = { saved: null, done: null };
  return Object.assign(it, {
    getFilename: () => name, setSavePath: (p) => { it.saved = p; }, getReceivedBytes: () => 2,
    once: (ev, fn) => { if (ev === 'done') it.done = fn; },
  });
}
function handler(fsp, collector, fails = []) {
  return load()._makeWillDownload({ dirFor: (c) => (c && c.outDir) || '/D', stagingDir: '/UD/downloads-staging',
    fsp, pathMod: path, getCollector: () => collector, onMoveFail: (p, e) => fails.push([p, e]) });
}
test('H1 ★Downloads 가 영영 안 돌아와도 핸들러는 즉시 끝나고 setSavePath=staging', () => {
  const never = new Promise(() => {});
  const f = { mkdir: () => never, access: () => never, rename: () => never, copyFile: () => never, unlink: () => never, rm: () => never };
  const it = fakeItem('a.png');
  assert.equal(handler(f, null)(null, it), undefined);   // 동기로 돌아왔다
  assert.match(it.saved, /^\/UD\/downloads-staging\/\d+-1\/a\.png$/);
  assert.equal(typeof it.done, 'function');
});
test('H2 수집기 — 충돌 이름 (1) · rec.path 는 옮긴 뒤 최종 경로 · state 는 맨 끝에', async () => {
  const col = { items: [], outDir: null };
  const it = fakeItem('a.png');
  handler(fakeFs(new Set(['/D/a.png'])), col)(null, it);
  assert.equal(col.items[0].state, 'pending');
  await it.done(null, 'completed');
  assert.deepEqual(col.items[0], { filename: 'a.png', intendedPath: '/D/a (1).png', state: 'completed', path: '/D/a (1).png', bytes: 2, pathMatchesIntent: true });
});
test('H3 옮기기 실패 — 파일은 staging 에 남고 알림 · rec.path=staging', async () => {
  const col = { items: [], outDir: null }, fails = [];
  const it = fakeItem('a.png');
  handler(fakeFs(new Set(), { mkdirErr: 'EPERM' }), col, fails)(null, it);
  await it.done(null, 'completed');
  assert.deepEqual(fails, [[it.saved, 'EPERM']]);
  assert.equal(col.items[0].path, it.saved);
  assert.equal(col.items[0].pathMatchesIntent, false);
});
test('H4 취소 — 옮기지 않고 알림도 없음', async () => {
  const col = { items: [], outDir: null }, fails = [];
  const f = fakeFs(new Set());
  const it = fakeItem('a.png');
  handler(f, col, fails)(null, it);
  await it.done(null, 'cancelled');
  assert.deepEqual(fails, []);
  assert.equal(col.items[0].state, 'cancelled');
  assert.ok(!f.log.some(([op]) => op === 'rename' || op === 'mkdir'));
});
test('S1 ★구조 — DL_FINALIZE 블록·will-download 등록 자리에 동기 fs(*Sync) 호출이 없다', () => {
  const strip = (t) => t.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const blk = SRC.match(/\/\/ ▼DL_FINALIZE[^\n]*\n([\s\S]*?)\/\/ ▲DL_FINALIZE/);
  assert.ok(blk, '블록이 없다');
  const reg = sliceCall(SRC, "session.on('will-download',");
  assert.deepEqual(strip(blk[1] + reg).match(/\w+Sync\(/g) || [], [], '★메인 스레드 동기 fs');
  assert.match(reg, /_makeWillDownload\(/, '★등록은 떼어 잰 그 함수로');
});
