/* ══════════════════════════════════════════════════════════════════════════
   U-H2 — 크래시·메인오류가 «로컬에 남는가». (2026-09-06)
     실행: node --test "tests/unit/*.test.mjs"

   ★자(ruler)를 새로 만들지 않는다
     판정은 tools/hardening/judge/crashlog.mjs·pii.mjs 로 한다. H7 하네스가 H2 를
     재려고 «먼저» 만들어 둔 자다. 여기서 별도 판정 로직을 쓰면 실기(run.mjs)와
     단위 검사가 서로 다른 자를 들게 되고, 그때 초록은 아무 말도 못 한다.
   ★판정기는 «언제나 레포 원본»에서 불러온다 — 제품을 변이시켜도 자는 안 흔들린다.
     제품 모듈만 H2_ROOT 로 갈아끼운다(변이 스윕이 이 스위치를 쓴다).

   ★이 파일의 «양성대조»는 변이다
     스크래치패드의 mut.sh 가 사본을 떠서 제품 코드 한 줄씩 망가뜨리고 이 스위트를
     돌린다. 검사가 「있다」가 아니라 «그 줄을 지난다»를 증명해야 하기 때문이다.
     각 검사 위에 「변이: …」로 무엇을 망가뜨리면 빨개지는지 적어 둔다.

   ⛔현빈 기계의 실제 userData 를 안 건드린다. 전부 임시 디렉터리다.
══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
/* 제품 코드의 뿌리. 변이 스윕이 사본 경로를 넣는다. */
const ROOT = process.env.H2_ROOT ? path.resolve(process.env.H2_ROOT) : REPO;
const require_ = createRequire(import.meta.url);
const { mkTmpRoot } = require_(path.join(REPO, 'tests/unit/_tmproot.js'));

/* 자 — ★항상 레포 원본.
   ⚠️import() 에 «절대경로»를 그대로 주면 윈도우에서 'C:\\…' 가 되어
     ERR_UNSUPPORTED_ESM_URL_SCHEME 로 거절당한다(파일이 통째로 안 돈다).
     '/C:/…'(new URL().pathname 모양)·'\\C:\\…' 도 «틀린 고침»이다 — 실측으로 둘 다 실패.
     정답은 pathToFileURL(p).href 하나뿐. */
const modUrl = (...segs) => pathToFileURL(path.join(...segs)).href;
const { judgeCrashLog, judgeMirrorMarker, CRASH_SCHEMA } =
  await import(modUrl(REPO, 'tools/hardening/judge/crashlog.mjs'));
const { judgePii } = await import(modUrl(REPO, 'tools/hardening/judge/pii.mjs'));
const { piiSamples } = await import(modUrl(REPO, 'tools/hardening/lib/fixture.mjs'));

/* 제품 — ★H2_ROOT */
const crash = require_(path.join(ROOT, 'main/crash/index.js'));
const recorder = require_(path.join(ROOT, 'main/crash/recorder.js'));
const scrubMod = require_(path.join(ROOT, 'main/crash/scrub.js'));

/* ── 도구 ────────────────────────────────────────────────────────────────── */
let _n = 0;
/** 임시 userData 하나를 만들고 recorder 를 거기에 붙인다. */
function freshUd(tag) {
  const ud = path.join(mkTmpRoot('h2-'), `ud-${tag}-${++_n}`);
  fs.mkdirSync(ud, { recursive: true });
  crash._resetForTest();
  recorder.init({ getUserDataDir: () => ud, appVersion: '0.9.1-test' });
  return ud;
}
function crashFiles(ud) {
  const d = path.join(ud, 'logs');
  try { return fs.readdirSync(d).filter(n => /^crash-\d+\.json$/.test(n)).sort(); } catch (_) { return []; }
}
/** 가짜 app/process/ipcMain — install() 이 «실제로 거는지»를 이벤트로 잰다. */
function fakeHost() {
  const listeners = new Map();
  const add = (m) => (ev, fn) => { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev)[m](fn); return undefined; };
  const app = {
    on: (ev, fn) => add('push')(ev, fn),
    getPath: () => null,
    getVersion: () => '0.9.1-test',
  };
  const proc = {
    platform: 'darwin', arch: 'arm64', versions: { electron: 'test' },
    stderrWrites: [],
    stderr: { write(x) { proc.stderrWrites.push(String(x)); return true; } },
    exitCalls: [],
    exit(code) { this.exitCalls.push(code); },
    _n: 0,
    listenerCount(ev) { return (listeners.get('proc:' + ev) || []).length; },
    on: (ev, fn) => add('push')('proc:' + ev, fn),
    prependListener: (ev, fn) => add('unshift')('proc:' + ev, fn),
  };
  const ipcMain = { on: (ev, fn) => add('push')('ipc:' + ev, fn) };
  const emit = (ev, ...args) => { for (const fn of (listeners.get(ev) || []).slice()) fn(...args); };
  return { app, proc, ipcMain, listeners, emit, con: { warn() {}, error() {} } };
}

/* ══ 0. 설치가 «실제로» 핸들러를 건다 ═══════════════════════════════════════
   변이: main/crash/index.js 에서 app.on('render-process-gone', …) 한 줄을 지우면 빨강. */
test('U-H2-0 install() 이 네 채널을 «건다» — 목록이 아니라 «등록»으로 잰다', () => {
  const ud = freshUd('install');
  const h = fakeHost();
  h.app.getPath = () => ud;
  const r = crash.install({ app: h.app, ipcMain: h.ipcMain, proc: h.proc, console: h.con, getUserDataDir: () => ud });
  assert.equal(r.installed, true);
  for (const ev of ['render-process-gone', 'child-process-gone', 'web-contents-created']) {
    assert.ok((h.listeners.get(ev) || []).length === 1, `app '${ev}' 리스너가 안 걸렸다`);
  }
  assert.equal((h.listeners.get('proc:uncaughtException') || []).length, 1, 'uncaughtException 이 안 걸렸다');
  assert.equal((h.listeners.get('ipc:crash:mirror') || []).length, 1, '미러 수신이 안 걸렸다');
  // 두 번 불러도 두 번 걸지 않는다
  assert.equal(crash.install({ app: h.app, proc: h.proc, console: h.con }).installed, false);
});

/* ══ 1. 렌더러 사망 → 기록 ══════════════════════════════════════════════════
   ★이 검사가 H2 «전»엔 반드시 빨강이었다: 고치기 전엔 render-process-gone 리스너가
     아예 없었으므로 이벤트를 쏴도 logs/ 가 안 생긴다 → judgeCrashLog = ABSENT.
   변이: recorder.record 의 writeFileSync 를 지우면 ABSENT 로 빨강. */
test('U-H2-1 렌더러가 죽으면 crash-*.json 이 남는다 — 판정기가 PRESENT 라고 말한다', () => {
  const ud = freshUd('rpg');
  const h = fakeHost();
  const since = Date.now();
  crash.install({ app: h.app, ipcMain: h.ipcMain, proc: h.proc, console: h.con, getUserDataDir: () => ud });
  h.emit('render-process-gone', {}, { id: 7 }, { reason: 'crashed', exitCode: 133 });

  const v = judgeCrashLog(ud, { sinceMs: since, expect: 'present', kind: 'render-process-gone' });
  assert.equal(v.verdict, 'PRESENT', v.summary);
  assert.deepEqual(v.schemaErrors, [], '스키마 오류: ' + JSON.stringify(v.schemaErrors));
  const rec = v.records[0];
  assert.equal(rec.reason, 'crashed');
  assert.equal(rec.exitCode, 133);
  assert.equal(rec.appVersion, '0.9.1-test');
  assert.equal(rec.arch, process.arch);
});

/* 변이: isCleanExit 를 () => false 로 바꾸면 빨강(노이즈가 기록을 밀어낸다). */
test('U-H2-1b «정상 종료»는 안 남긴다 — 그러나 exitCode≠0 이면 남긴다', () => {
  const ud = freshUd('clean');
  const h = fakeHost();
  crash.install({ app: h.app, proc: h.proc, console: h.con, getUserDataDir: () => ud });
  h.emit('render-process-gone', {}, { id: 1 }, { reason: 'clean-exit', exitCode: 0 });
  assert.equal(crashFiles(ud).length, 0, '정상 종료가 크래시로 적혔다');
  h.emit('render-process-gone', {}, { id: 1 }, { reason: 'clean-exit', exitCode: 3 });
  assert.equal(crashFiles(ud).length, 1, 'exitCode 3 은 정상 종료가 아니다');
});

/* ══ 2. 필수 스키마 ═════════════════════════════════════════════════════════
   변이: record() 에서 arch 를 빼면 MALFORMED 로 빨강. */
test('U-H2-2 필수 5필드가 «판정기 기준»으로 다 있다', () => {
  const ud = freshUd('schema');
  recorder.record('child-process-gone', { reason: 'crashed', exitCode: 5 });
  const v = judgeCrashLog(ud, { expect: 'present' });
  assert.equal(v.verdict, 'PRESENT', v.summary);
  for (const k of CRASH_SCHEMA.required) {
    assert.notEqual(v.records[0][k], undefined, `필수 필드 ${k} 가 없다`);
  }
});

/* ══ 3. 상한 — «최신»을 지우지 않는다 ═══════════════════════════════════════
   변이: pruneOld 의 files.shift() 를 files.pop() 으로 바꾸면(=최신부터 삭제) 빨강. */
test('U-H2-3 상한을 넘겨도 «최신»이 살아남는다 (버리는 건 오래된 것)', () => {
  const ud = freshUd('cap');
  const N = recorder.MAX_FILES + 5;
  let t = Date.now() - N * 1000;
  const clock = { t };
  recorder.init({ getUserDataDir: () => ud, appVersion: 'x', now: () => (clock.t += 5000) });
  for (let i = 0; i < N; i++) recorder.record('render-process-gone', { reason: 'r' + i });
  const files = crashFiles(ud);
  assert.equal(files.length, recorder.MAX_FILES, `파일이 ${files.length}개 — 상한 ${recorder.MAX_FILES}`);
  const reasons = files.map(f => JSON.parse(fs.readFileSync(path.join(ud, 'logs', f), 'utf8')).reason);
  assert.ok(reasons.includes('r' + (N - 1)), '★가장 최근 크래시가 지워졌다 — 상한이 반대 방향으로 돈다');
  assert.ok(!reasons.includes('r0'), '가장 오래된 것이 안 지워졌다');
});

/* ══ 4. PII ═════════════════════════════════════════════════════════════════
   변이: recorder.record 의 scrub(...) 를 String(...) 로 바꾸면 홈 경로가 새서 빨강. */
test('U-H2-4 기록물이 «새지 않는다» — 홈경로·에셋명·본문 세 축 (판정기 pii.mjs)', () => {
  const ud = freshUd('pii');
  /* 표본 세 축을 «진짜로» 만든다 — 표본 0개면 판정기가 NOT_MEASURED 를 낸다(그건 초록이 아니다). */
  const projDir = path.join(ud, 'projects', 'proj_pii');
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, 'proj.json'), JSON.stringify({
    pages: [{ canvas: '<img src="goya-asset://proj_pii/롯데_2026여름_메인.png">' +
      '이 문서는 고객사 상세페이지 본문입니다 절대 새면 안 됩니다' }],
  }), 'utf8');
  const samples = piiSamples(projDir);
  assert.ok(samples.home.length && samples.corpusText.length && samples.assetNames.length,
    '표본 세 축이 다 있어야 판정이 성립한다: ' + JSON.stringify(samples));

  const home = os.homedir();
  recorder.record('uncaught-exception', {
    reason: 'ENOENT ' + path.join(home, 'Library/Application Support/GODITOR/projects/proj_pii/proj.json'),
    main: 'Error: boom\n    at load (' + path.join(home, 'web-editor/main.js') + ':12:3)',
  });
  recorder.mirror({ errors: [
    { at: '2026-09-06T00:00:00.000Z', level: 'resource', msg: 'img 로드 실패: goya-asset://proj_pii/롯데_2026여름_메인.png' },
    { at: '2026-09-06T00:00:01.000Z', level: 'console.error', msg: '저장 실패 ' + path.join(home, 'x/y.json') },
  ] }, 1);
  recorder.record('render-process-gone', { reason: 'crashed', exitCode: 133 });
  recorder.appendMainLog('error', '[save] 실패: ' + path.join(home, 'Documents/a.png'));

  const v = judgePii([path.join(ud, 'logs')], samples);
  assert.equal(v.verdict, 'PASS', v.summary);
});

/* ══ 5. 못 써도 앱은 살고, 삼킨 건 «센다» ═══════════════════════════════════
   변이: swallow() 안의 _self.swallowed++ 를 지우면(=진짜 삼킴) 빨강.
   ⛔이게 「오류를 삼키는 코드」와 「삼킨 걸 말하는 코드」를 가르는 자리다. */
test('U-H2-5 기록이 실패해도 던지지 않는다 — 그리고 «삼킨 사실»이 남는다', { skip: process.getuid && process.getuid() === 0 ? 'root 는 chmod 를 무시한다' : false }, () => {
  const ud = freshUd('denied');
  fs.mkdirSync(path.join(ud, 'logs'), { recursive: true });
  fs.chmodSync(path.join(ud, 'logs'), 0o000);
  try {
    let threw = null;
    try {
      recorder.record('render-process-gone', { reason: 'crashed' });
      recorder.appendMainLog('error', '무언가');
    } catch (e) { threw = e; }
    assert.equal(threw, null, '기록기가 던졌다 — 기록하러 와서 앱을 죽인다');
    const s = recorder.stats();
    assert.ok(s.swallowed > 0, '★삼킨 걸 «안 센다» — 이 위의 모든 판정이 거짓말이 된다');
    assert.ok(s.firstSwallow && /EACCES|EPERM|ENOENT/.test(s.firstSwallow), '삼킨 «사유»가 없다: ' + s.firstSwallow);
    /* ★그리고 그 사실은 «다음 성공한 기록»에도 실린다(세 번째 자리). */
    fs.chmodSync(path.join(ud, 'logs'), 0o755);
    recorder.record('render-process-gone', { reason: 'crashed-2' });
    const v = judgeCrashLog(ud, { expect: 'present' });
    assert.ok(v.records.some(r => r.recorder && r.recorder.swallowed > 0),
      '삼킨 횟수가 기록 어디에도 안 실린다');
  } finally {
    try { fs.chmodSync(path.join(ud, 'logs'), 0o755); } catch (_) {}
  }
});

/* 「막혀 있다」를 「기록이 없다」로 읽지 않는지 — ★자 쪽 규약을 우리 쪽에서도 고정한다. */
test('U-H2-5b logs 가 막혀 있으면 판정은 NOT_MEASURED 다 («없다»가 아니다)', { skip: process.getuid && process.getuid() === 0 ? 'root' : false }, () => {
  const ud = freshUd('denied2');
  const logs = path.join(ud, 'logs');
  fs.mkdirSync(logs, { recursive: true });
  fs.chmodSync(logs, 0o000);
  try {
    const v = judgeCrashLog(ud, { expect: 'present', denied: [logs] });
    assert.equal(v.verdict, 'NOT_MEASURED', v.summary);
    assert.equal(v.pass, null);
  } finally { fs.chmodSync(logs, 0o755); }
});

/* ══ 6. 미러 ════════════════════════════════════════════════════════════════
   변이: record() 에서 rec.errors 대입을 지우면 MIRROR FAIL 로 빨강.
   ★실기(run.mjs)가 재는 것과 «같은 자»(judgeMirrorMarker)를 쓴다. */
test('U-H2-6 크래시 직전 렌더러 오류가 기록에 «도착»한다 (errors + errorsAsOf)', () => {
  const ud = freshUd('mirror');
  const MARKER = '[H7-marker crash-renderer]';
  const asOf = Date.now() - 1234;
  recorder.mirror({ errors: [{ at: '2026-09-06T00:00:00.000Z', level: 'app', msg: MARKER }], at: asOf, projectId: 'proj_zz' }, 42);
  recorder.record('render-process-gone', { reason: 'crashed', exitCode: 133, wcId: 42 });

  const v = judgeCrashLog(ud, { expect: 'present' });
  assert.equal(v.verdict, 'PRESENT', v.summary);
  const m = judgeMirrorMarker(v.records, MARKER);
  assert.equal(m.pass, true, m.summary);
  assert.equal(v.records[0].errorsAsOf, asOf, 'errorsAsOf 가 «사본의 시각»이 아니다');
  assert.equal(v.records[0].projectId, 'proj_zz');
});

test('U-H2-6b 미러가 «창 별»로 갈리고, 상한을 넘으면 오래된 창부터 버린다', () => {
  const ud = freshUd('mirror2');
  recorder.mirror({ errors: [{ at: '', level: 'app', msg: 'A창' }], at: 1000 }, 1);
  recorder.mirror({ errors: [{ at: '', level: 'app', msg: 'B창' }], at: 2000 }, 2);
  recorder.record('render-process-gone', { reason: 'crashed', wcId: 1 });
  const v = judgeCrashLog(ud, { expect: 'present' });
  assert.equal(judgeMirrorMarker(v.records, 'A창').pass, true, '죽은 창의 사본이 아니라 남의 것을 붙였다');
  assert.equal(judgeMirrorMarker(v.records, 'B창').pass, false);
});

/* ══ 7. 읽는 함수 — H3 가 이어받는 자리 ═════════════════════════════════════
   변이: readRecent 의 정렬을 (a,b)=>a.ts-b.ts 로 뒤집으면 빨강. */
test('U-H2-7 readRecent 는 «새 것부터» 주고, 깨진 파일을 «조용히» 빼지 않는다', () => {
  const ud = freshUd('read');
  const clock = { t: Date.now() };
  recorder.init({ getUserDataDir: () => ud, appVersion: 'x', now: () => (clock.t += 4000) });
  for (const r of ['old', 'mid', 'new']) recorder.record('render-process-gone', { reason: r });
  const got = recorder.readRecent(10);
  assert.deepEqual(got.map(g => g.record.reason), ['new', 'mid', 'old']);

  fs.writeFileSync(path.join(ud, 'logs', 'crash-' + (clock.t + 9000) + '.json'), '{반쪽', 'utf8');
  const got2 = recorder.readRecent(10);
  assert.equal(got2.length, 4, '깨진 파일이 «없는 것»이 됐다 — H3 가 「기록 없음」으로 읽는다');
  assert.equal(got2[0].error, 'unreadable');
  assert.equal(got2[0].record, null);
});

/* ══ 8. main.log ════════════════════════════════════════════════════════════
   변이: appendMainLog 의 회전에서 rename 대신 unlink(p) 를 쓰면 «최신»이 사라져 빨강. */
test('U-H2-8 main.log 는 씻겨서 쌓이고, 넘치면 «지지난 세대»만 버린다', () => {
  const ud = freshUd('mainlog');
  recorder.appendMainLog('warn', '[save] 실패 ' + path.join(os.homedir(), 'a/b/c.json'));
  const p = path.join(ud, 'logs', 'main.log');
  const txt = fs.readFileSync(p, 'utf8');
  assert.ok(!txt.includes(os.homedir()), '홈 경로가 main.log 에 그대로 있다');
  assert.ok(txt.includes('[warn]') && txt.includes('c.json'));

  /* ★한 줄은 «잘려서» 들어간다(1000자 상한) — 상한을 넘기려면 줄 수로 계산해야 한다.
     여기서 2000자짜리 줄 수로 어림하면 회전이 «안 일어나는데» 검사는 통과한다(초판이 그랬다). */
  const big = 'x'.repeat(2000);
  const lineBytes = fs.statSync(p).size;                       // 위에서 쓴 «실제» 한 줄 크기의 하한
  assert.ok(lineBytes > 0);
  let last = '';
  for (let i = 0; i < Math.ceil(recorder.MAIN_LOG_MAX / 900) + 4; i++) {
    last = 'seq' + i;
    recorder.appendMainLog('warn', last + ' ' + big);   // ★표식을 «앞»에 — 줄은 1000자에서 잘린다
  }
  const cur = fs.readFileSync(p, 'utf8');
  assert.ok(fs.existsSync(p + '.1'), '회전이 안 일어났다 — 무한히 쌓인다');
  assert.ok(fs.statSync(p).size < recorder.MAIN_LOG_MAX, '현재 세대가 상한을 넘었다');
  assert.ok(cur.includes(last), '★최신 줄이 사라졌다');
  assert.ok(!fs.existsSync(p + '.2'), '세대가 무한히 늘어난다');
  /* ★두 번째 회전 — 여기서 「세대가 하나」와 「회전이 조용히 죽는다」가 갈린다.
     ⚠️맥(POSIX)은 rename 이 덮어써서 unlink 없이도 통과한다. 윈도우(EEXIST)는 아니다 —
       그 갈래는 «못 쟀다»(보고서 미검증 절에 적었다). */
  for (let i = 0; i < Math.ceil(recorder.MAIN_LOG_MAX / 900) + 4; i++) {
    last = 'gen2-' + i;
    recorder.appendMainLog('warn', last + ' ' + big);
  }
  assert.ok(fs.readFileSync(p, 'utf8').includes(last), '두 번째 회전 뒤 최신 줄이 없다');
  assert.ok(fs.statSync(p).size < recorder.MAIN_LOG_MAX, '두 번째 회전이 «조용히» 실패했다');
  assert.ok(!fs.existsSync(p + '.2'));
});

/* ══ 9~10. 메인 예외 — «듣되 처분을 안 바꾼다» ══════════════════════════════
   변이: prependListener 를 on 으로 바꾸면 U-H2-9 의 «첫 번째» 단언이 빨강. */
test('U-H2-9 메인 예외를 «먼저» 듣는다 + unhandledRejection 은 origin 으로 갈린다', () => {
  const ud = freshUd('uncaught');
  const h = fakeHost();
  const order = [];
  h.proc.on('uncaughtException', () => order.push('남의 리스너'));   // ★Electron 이 이미 달고 있는 그 자리
  crash.install({ app: h.app, proc: h.proc, console: h.con, getUserDataDir: () => ud });
  const ours = h.listeners.get('proc:uncaughtException');
  assert.equal(ours.length, 2);
  ours[0](new Error('boom'), 'uncaughtException');   // 첫 번째가 «우리» 여야 한다
  assert.deepEqual(order, [], '우리 리스너가 남의 것보다 뒤에 있다 — 남이 exit 하면 기록이 안 남는다');
  ours[0](new Error('rejected!'), 'unhandledRejection');

  const v = judgeCrashLog(ud, { expect: 'present' });
  const kinds = v.records.map(r => r.kind).sort();
  assert.deepEqual(kinds, ['uncaught-exception', 'unhandled-rejection'], '실제 기록: ' + JSON.stringify(kinds));
  assert.ok(v.records.some(r => /boom/.test(r.main || '')), '메인 스택이 안 실렸다');
  assert.deepEqual(h.proc.exitCalls, [], '★선행 리스너가 있는데 우리가 exit 했다 — 처분을 바꿨다');
});

/* ★★이 검사가 «내가 틀렸던 자리»를 못 박는다 — 실기가 뒤집은 그 자리다.
   초판은 unhandledRejection 에 리스너를 «안 달고» 「Node 가 uncaughtException 으로
   넘겨준다」에 기댔다. Electron 41 은 legacy(warn) 모드라 안 넘긴다 ⇒ 기록 0건이었다.
   변이: index.js 의 unhandledRejection 등록을 지우면 빨강. */
test('U-H2-9b 미처리 거부를 «직접» 듣는다 — 그리고 처분(살아 있음·경고 한 줄)을 지킨다', () => {
  const ud = freshUd('reject');
  const h = fakeHost();
  crash.install({ app: h.app, proc: h.proc, console: h.con, getUserDataDir: () => ud });
  const ls = h.listeners.get('proc:unhandledRejection');
  assert.ok(ls && ls.length === 1, '★unhandledRejection 을 아무도 안 듣는다 — 메인의 미처리 거부가 영영 안 남는다');
  ls[0](new Error('거부됨'), Promise.resolve());
  const v = judgeCrashLog(ud, { expect: 'present', kind: 'unhandled-rejection' });
  assert.equal(v.verdict, 'PRESENT', v.summary);
  assert.deepEqual(h.proc.exitCalls, [], '거부 하나로 앱을 죽였다 — 처분을 바꿨다');
  assert.ok(h.proc.stderrWrites.some(x => /거부됨/.test(x)),
    '★리스너를 다는 순간 Node 기본 «경고 한 줄»이 사라진다 — 우리가 대신 안 쓰면 터미널에서 증발한다');
});

test('U-H2-9c 이미 누가 듣고 있었다면 경고를 «겹쳐 쓰지» 않는다', () => {
  const ud = freshUd('reject2');
  const h = fakeHost();
  h.proc.on('unhandledRejection', () => {});
  crash.install({ app: h.app, proc: h.proc, console: h.con, getUserDataDir: () => ud });
  h.listeners.get('proc:unhandledRejection')[0](new Error('거부됨2'));
  assert.equal(h.proc.stderrWrites.length, 0);
  assert.equal(judgeCrashLog(ud, { expect: 'present' }).verdict, 'PRESENT');
});

test('U-H2-10 «아무도 안 듣고 있었다면» Node 기본 처분(exit 1)을 그대로 재현한다', () => {
  const ud = freshUd('uncaught2');
  const h = fakeHost();       // 선행 리스너 0개
  crash.install({ app: h.app, proc: h.proc, console: h.con, getUserDataDir: () => ud });
  h.listeners.get('proc:uncaughtException')[0](new Error('fatal'), 'uncaughtException');
  assert.deepEqual(h.proc.exitCalls, [1],
    '★리스너를 다는 순간 Node 의 「스택 찍고 죽기」가 꺼진다 — 기록하러 와서 앱을 좀비로 만들면 안 된다');
});

/* ══ 11. 폭주 ═══════════════════════════════════════════════════════════════
   변이: DEDUPE_MS 를 0 으로, MAX_PER_SESSION 을 Infinity 로 바꾸면 빨강. */
test('U-H2-11 크래시 폭주가 디스크를 먹지 않는다 — 그리고 «막았다»고 말한다', () => {
  const ud = freshUd('storm');
  const clock = { t: Date.now() };
  recorder.init({ getUserDataDir: () => ud, appVersion: 'x', now: () => (clock.t += 60000) });  // 중복억제를 피해 «최악»으로
  for (let i = 0; i < 500; i++) recorder.record('render-process-gone', { reason: 'crashed' });
  assert.ok(crashFiles(ud).length <= recorder.MAX_FILES, '파일 상한이 안 먹었다');
  const s = recorder.stats();
  assert.equal(s.sessionRecords, recorder.MAX_PER_SESSION, '세션 상한이 안 먹었다');
  assert.ok(s.swallowed > 0 && /상한/.test(s.lastSwallow || ''), '★상한으로 «버린» 사실을 아무도 모른다');
});

test('U-H2-11b 같은 사건이 연달아 오면 «한 번»만 적는다', () => {
  const ud = freshUd('dedupe');
  for (let i = 0; i < 5; i++) recorder.record('child-process-gone', { reason: 'crashed' });
  assert.equal(crashFiles(ud).length, 1);
});

/* ══ 12. 세척기 — 정본과 «같은 답»인가 ══════════════════════════════════════
   변이: scrub.js 의 CANON 경로를 없는 파일로 바꾸면 폴백으로 내려가고, 폴백은
        파일명까지 지우므로 아래 「정본과 같다」가 빨강이 된다(=갈라짐을 잡는다). */
test('U-H2-12 메인 세척기는 렌더러 «정본»을 그대로 쓴다 (복사본이 아니다)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/report-buffer.js'), 'utf8');
  const w = { addEventListener() {}, console: {} };
  new Function('window', src)(w);
  const canon = w.ReportBuffer.scrubPaths;

  const samples = [
    'Error at /Users/hyunbin/web-editor/main.js:12:3',
    'ENOENT ' + path.join(os.homedir(), 'Library/Application Support/GODITOR/projects/p/proj.json'),
    'C:\\Users\\kim minjae\\Documents\\a.txt',
    'https://blacksheepwall.kr/api/report 로 보냄',
    '평범한 한 줄 — 경로가 없다',
  ];
  for (const s of samples) {
    assert.equal(scrubMod.scrub(s), canon(s), '세척 결과가 정본과 갈렸다: ' + s);
  }
  assert.equal(scrubMod.source().source, 'report-buffer', '정본을 «못 읽고» 폴백으로 돌고 있다: ' + JSON.stringify(scrubMod.source()));
  /* 정본이 «일부러» 안 건드리는 두 가지는 여기서 더 자른다 */
  assert.equal(scrubMod.scrub('img: goya-asset://proj_1/롯데_여름.png'), 'img: goya-asset://…');
  assert.ok(!/AAAA/.test(scrubMod.scrub('data:image/png;base64,' + 'A'.repeat(200))));
});

test('U-H2-12b 폴백 세척기는 «더 둔하다» — 못 읽었을 때 원문이 새면 안 된다', () => {
  const blunt = scrubMod._bluntScrub;
  assert.ok(!blunt('at /Users/hyunbin/web-editor/main.js:12').includes('hyunbin'));
  assert.ok(!blunt('C:\\Users\\kim\\a.txt').includes('kim'));
});

/* ══ 13. 렌더러 쪽 통로 ═════════════════════════════════════════════════════
   변이: js/report-buffer.js 의 scheduleMirror() 호출 한 줄을 지우면 빨강.
   ★이게 「크래시 직전 오류가 메인에 도착한다」의 «출발점»이다 — 여기가 끊기면
     U-H2-6 은 여전히 초록인데(메인 API 는 멀쩡하니까) 실기에선 errors 가 빈다. */
test('U-H2-13 링버퍼가 담는 «즉시» 메인으로 사본을 보낸다 (앞선 가장자리)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/report-buffer.js'), 'utf8');
  const sent = [];
  const w = {
    addEventListener() {}, console: { error() {} },
    activeProjectId: 'proj_q',
    electronAPI: { crashMirror: (p) => sent.push(p) },
  };
  new Function('window', src)(w);
  w.ReportBuffer.note('첫 오류 /Users/bob/x/y.txt');
  assert.equal(sent.length, 1, '★첫 오류가 «즉시» 안 나갔다 — 100ms 뒤에 죽으면 사본이 없다');
  assert.equal(sent[0].projectId, 'proj_q');
  assert.equal(sent[0].errors[0].msg, '첫 오류 ~/…/y.txt', '씻기 «전» 문자열이 나갔다');
  w.ReportBuffer.note('둘째');
  assert.equal(sent.length, 1, '연달아 나는 오류마다 IPC 를 쏘면 폭주한다(뒤로 모아야 한다)');
});

test('U-H2-13b 통로가 «없어도» 링버퍼는 평소대로 돈다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/report-buffer.js'), 'utf8');
  const w = { addEventListener() {}, console: { error() {} } };   // electronAPI 자체가 없다
  new Function('window', src)(w);
  w.ReportBuffer.note('통로 없음');
  assert.equal(w.ReportBuffer.size(), 1);
});
