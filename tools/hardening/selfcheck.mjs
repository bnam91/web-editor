/* ═══════════════════════════════════════════════════════════════════════════
   selfcheck.mjs — ★«도구의 양성대조». 이 하네스가 «고장과 정상을 가르는지» 잰다.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 이게 제일 중요한가
     고장을 «못 잡는» 도구가 최악이다. H2~H6 다섯 단위의 초록이 전부 이 자에 걸려 있다.
     그래서 판정기마다 «일부러 고장난 상태»와 «정상 상태»를 «둘 다» 통과시켜
       오탐(정상인데 빨강) = 0
       미탐(고장인데 초록) = 0
     을 «수치로» 보인다. 하나라도 0 이 아니면 그 판정기는 미완이다.

   ★대조군은 «사본»에서 돈다(골 §5.1). 정상 케이스와 고장 케이스는 «다른 임시 폴더»다 —
     하나를 망가뜨렸다 되돌리는 방식은 중간에 죽으면 망가진 채로 남는다(2026-09-06 실제).

   ⛔Electron 을 안 띄운다. 여기서 재는 것은 «판정기»이지 «앱»이 아니다.
     앱을 상대로 한 실기(크래시·kill9)는 run.mjs 다.

   실행: node tools/hardening/selfcheck.mjs
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { makeProject, piiSamples, assertWritableTarget } from './lib/fixture.mjs';
import { HarnessError, waitFor, EXIT } from './lib/deadline.mjs';
import { missingSymbols, openSource } from './lib/loadcheck.mjs';
import { corrupt, snapshotDir, diffSnapshots } from './break/corrupt.mjs';
import { denyWrite, probeWritable } from './break/deny-write.mjs';
import { judgeI7 } from './judge/i7.mjs';
import { judgePii } from './judge/pii.mjs';
import { judgeCrashLog, judgeMirrorMarker } from './judge/crashlog.mjs';
import { judgeLostWindow, judgeEmptyCanvasSkip, loadIsAllCanvasEmpty, MARKER, EMPTY_HEAD } from './judge/lost-window.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CHECKOUT = path.resolve(__dirname, '../..');
const require_ = createRequire(import.meta.url);
const { mkTmpRoot } = require_(path.join(CHECKOUT, 'tests/unit/_tmproot.js'));

/** 케이스 하나 = 「이 팔(arm)에서 판정기가 이렇게 나와야 한다」. */
const CASES = [];
const C = (id, judge, arm, expect, run) => CASES.push({ id, judge, arm, expect, run });

/* ═════ I7 — 디스크 JSON 유효성 ═══════════════════════════════════════════ */
C('I7-healthy', 'I7', 'healthy', 'PASS', () => {
  const ud = mkTmpRoot('h7-i7-ok-');
  const p = makeProject(ud, 'proj_ok');
  const r = judgeI7(p.projectsDir, { checkoutDir: CHECKOUT });
  return { pass: r.pass, detail: r.summary, shapedSource: r.shapedSource };
});
for (const mode of ['half', 'all', 'zero']) {
  C(`I7-broken-${mode}`, 'I7', 'broken', 'FAIL', () => {
    const ud = mkTmpRoot(`h7-i7-${mode}-`);
    const p = makeProject(ud, 'proj_bad');
    const b = corrupt(p.dir, mode);
    const r = judgeI7(p.projectsDir, { checkoutDir: CHECKOUT });
    return { pass: r.pass, detail: `${b.summary} ⇒ ${r.summary}`, sanity: b.sanity };
  });
}
C('I7-broken-notShaped', 'I7', 'broken', 'FAIL', () => {
  // 파싱은 되는데 «프로젝트가 아닌» proj.json — A2 치명(사이드카 채택)의 자리
  const ud = mkTmpRoot('h7-i7-shape-');
  const p = makeProject(ud, 'proj_shape');
  fs.writeFileSync(path.join(p.dir, 'proj.json'), JSON.stringify({ pins: [], note: 'not a project' }));
  const r = judgeI7(p.projectsDir, { checkoutDir: CHECKOUT });
  return { pass: r.pass, detail: r.summary, notShaped: r.notShaped.length };
});
C('I7-healthy-tmpResidueIsNotFailure', 'I7', 'healthy', 'PASS', () => {
  // ★*.tmp 는 반쪽이어도 I7 실패가 아니다(rename 전에 죽은 흔적). 잔재로만 센다.
  const ud = mkTmpRoot('h7-i7-tmp-');
  const p = makeProject(ud, 'proj_tmp');
  fs.writeFileSync(path.join(p.dir, 'proj.json.tmp'), '{"broken":');
  const r = judgeI7(p.projectsDir, { checkoutDir: CHECKOUT });
  return { pass: r.pass, detail: r.summary, tmpResidue: r.tmpResidue.length };
});

C('I7-★notMeasured-when-denied', 'I7', 'broken', 'NOT_MEASURED', () => {
  /* ★★자체 실기(2026-09-06 deny-write 실행)가 나를 여기서 잡았다.
     projects 를 chmod 000 한 상태에서 초판은 «스캔 0 · 깨짐 0 → I7 PASS» 를 냈다.
     아무것도 못 열어본 실행이 초록이었다. 그게 이 도구가 막으려던 가짜 초록이다. */
  const ud = mkTmpRoot('h7-i7-denied-');
  const p = makeProject(ud, 'proj_denied');
  const h = denyWrite(p.projectsDir);
  try {
    const r = judgeI7(p.projectsDir, { checkoutDir: CHECKOUT, denied: h.denied });
    return { pass: r.pass, verdict: r.verdict, detail: r.summary };
  } finally { h.restore(); }
});
C('I7-★notMeasured-when-empty', 'I7', 'broken', 'NOT_MEASURED', () => {
  // 잴 파일이 «한 개도 없는» 폴더도 판정이 아니다.
  const ud = mkTmpRoot('h7-i7-empty-');
  const d = path.join(ud, 'projects'); fs.mkdirSync(d, { recursive: true });  // [뿌리-하네스] 비로그인 픽스처 전용 — 위 경고 참조
  const r = judgeI7(d, { checkoutDir: CHECKOUT });
  return { pass: r.pass, verdict: r.verdict, detail: r.summary };
});

/* ═════ PII — 표본 세 종 ══════════════════════════════════════════════════ */
const PII_AXES = ['home', 'corpusText', 'assetName'];
C('PII-healthy', 'PII', 'healthy', 'PASS', () => {
  const d = mkTmpRoot('h7-pii-ok-');
  const f = path.join(d, 'crash-1.json');
  fs.writeFileSync(f, JSON.stringify({ at: 1, kind: 'render-process-gone', appVersion: '0.8.6',
    os: 'darwin', arch: 'arm64', errors: ['~/…/save-load.js:12 실패'] }));
  const samples = { home: ['/Users/nobody-x'], corpusText: ['존재하지않는문장조각입니다여기'], assetNames: ['zzz-not-here.png'] };
  const r = judgePii([f], samples);
  return { pass: r.pass, detail: r.summary };
});
for (const axis of PII_AXES) {
  C(`PII-broken-${axis}`, 'PII', 'broken', 'FAIL', () => {
    const d = mkTmpRoot(`h7-pii-${axis}-`);
    const f = path.join(d, 'crash-1.json');
    const samples = { home: ['/Users/testuser42'], corpusText: ['이것은코퍼스본문조각이다여기'], assetNames: ['a1b2c3d4.png'] };
    const leak = { home: samples.home[0], corpusText: samples.corpusText[0], assetName: samples.assetNames[0] }[axis];
    fs.writeFileSync(f, JSON.stringify({ at: 1, kind: 'x', leaked: `기록에 섞여 들어간 것: ${leak}` }));
    const r = judgePii([f], samples);
    return { pass: r.pass, detail: r.summary, hitAxes: [...new Set(r.hits.map(h => h.axis))] };
  });
}
C('PII-notMeasured-isNotPass', 'PII', 'broken', 'NOT_MEASURED', () => {
  // ★표본이 0개면 「0건」이 아니라 「못 쟀다」다. 이걸 초록으로 읽으면 그게 가짜 초록이다.
  const d = mkTmpRoot('h7-pii-nm-');
  const f = path.join(d, 'crash-1.json');
  fs.writeFileSync(f, '{"at":1}');
  const r = judgePii([f], { home: [], corpusText: [], assetNames: [] });
  // ★pass 가 «true 가 아니어야» 이 케이스가 갈린 것이다 — null(NOT_MEASURED)이 정답.
  return { pass: r.pass, verdict: r.verdict, notMeasured: r.notMeasured.length, detail: r.summary };
});
C('PII-realCorpusSamples', 'PII', 'healthy', 'PASS', () => {
  // 실데이터 표본 추출기가 «실제로 표본을 뽑는지» — 못 뽑으면 위 축이 조용히 0 이 된다.
  const ud = mkTmpRoot('h7-pii-corpus-');
  const p = makeProject(ud, 'proj_corpus');
  // 합성 픽스처에 한글 본문·에셋 참조를 넣어 «추출기»를 잰다(코퍼스 원본은 안 건드린다)
  const proj = JSON.parse(fs.readFileSync(path.join(p.dir, 'proj.json'), 'utf8'));
  proj.pages[0].canvas += '<p>하네스 자체검사용 한글 본문 조각 하나</p>' +
    '<p>두번째 한글 본문 조각이 여기에 있다</p><p>세번째 한글 본문 조각도 여기</p>' +
    '<img src="goya-asset://deadbeef01.png">';
  fs.writeFileSync(path.join(p.dir, 'proj.json'), JSON.stringify(proj, null, 2));
  const s = piiSamples(p.dir);
  const ok = s.home.length >= 2 && s.corpusText.length === 3 && s.assetNames.length >= 1;
  return { pass: ok, detail: `표본 — 홈 ${s.home.length} · 본문 ${s.corpusText.length} · 에셋명 ${s.assetNames.length}` };
});

/* ═════ CRASHLOG — ★「못 쟀다」와 「없다」를 가르는가 ═══════════════════════ */
C('CRASHLOG-broken-absent', 'CRASHLOG', 'broken', 'ABSENT', () => {
  const ud = mkTmpRoot('h7-cl-absent-');
  const r = judgeCrashLog(ud, { expect: 'present' });
  return { pass: r.pass, verdict: r.verdict, detail: r.summary };
});
C('CRASHLOG-healthy-present', 'CRASHLOG', 'healthy', 'PRESENT', () => {
  const ud = mkTmpRoot('h7-cl-ok-');
  fs.mkdirSync(path.join(ud, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(ud, 'logs', `crash-${Date.now()}.json`), JSON.stringify({
    at: new Date().toISOString(), kind: 'render-process-gone', reason: 'crashed', exitCode: 133,
    appVersion: '0.8.6', os: 'darwin', arch: 'arm64', errors: ['[H7-marker-A]'], errorsAsOf: Date.now() }));
  const r = judgeCrashLog(ud, { expect: 'present', kind: 'render-process-gone' });
  const m = judgeMirrorMarker(r.records, '[H7-marker-A]');
  return { pass: r.pass && m.pass, verdict: r.verdict, detail: `${r.summary} / ${m.summary}` };
});
C('CRASHLOG-broken-malformed', 'CRASHLOG', 'broken', 'MALFORMED', () => {
  const ud = mkTmpRoot('h7-cl-bad-');
  fs.mkdirSync(path.join(ud, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(ud, 'logs', `crash-${Date.now()}.json`), JSON.stringify({ kind: 'x' }));
  const r = judgeCrashLog(ud, { expect: 'present' });
  return { pass: r.pass, verdict: r.verdict, detail: r.summary };
});
C('CRASHLOG-broken-mirrorMissing', 'CRASHLOG', 'broken', 'FAIL', () => {
  const ud = mkTmpRoot('h7-cl-mir-');
  fs.mkdirSync(path.join(ud, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(ud, 'logs', `crash-${Date.now()}.json`), JSON.stringify({
    at: 1, kind: 'render-process-gone', appVersion: '0', os: 'darwin', arch: 'arm64', errors: [] }));
  const r = judgeCrashLog(ud, { expect: 'present' });
  const m = judgeMirrorMarker(r.records, '[H7-marker-B]');
  return { pass: m.pass, detail: m.summary };
});
C('CRASHLOG-★notMeasured-when-denied', 'CRASHLOG', 'broken', 'NOT_MEASURED', () => {
  /* ★★적대검수가 지목한 바로 그 자리: logs 를 막아 놓고 「기록이 없다」고 읽으면 안 된다.
     막힌 상태에서 이 자는 «ABSENT» 가 아니라 «NOT_MEASURED» 를 내야 한다. */
  const ud = mkTmpRoot('h7-cl-denied-');
  const logs = path.join(ud, 'logs');
  fs.mkdirSync(logs, { recursive: true });
  const h = denyWrite(logs);
  try {
    const r = judgeCrashLog(ud, { expect: 'present', denied: h.denied });
    return { pass: r.pass, verdict: r.verdict, detail: r.summary };
  } finally { h.restore(); }
});

/* ═════ DENY-WRITE — 막았다는 «주장»이 아니라 «실측» ══════════════════════ */
C('DENY-healthy-writableBefore', 'DENY', 'healthy', 'PASS', () => {
  const d = mkTmpRoot('h7-deny-ok-');
  const p = probeWritable(d);
  return { pass: p.writable, detail: `쓰기 가능 ${p.writable}` };
});
C('DENY-broken-blockedAfter', 'DENY', 'broken', 'FAIL', () => {
  const d = mkTmpRoot('h7-deny-blk-');
  const h = denyWrite(d);
  try {
    const p = probeWritable(d);
    return { pass: p.writable, detail: `막은 뒤 쓰기 가능 ${p.writable} (${p.code}) · ${h.sanity}` };
  } finally { h.restore(); }
});
C('DENY-healthy-restored', 'DENY', 'healthy', 'PASS', () => {
  const d = mkTmpRoot('h7-deny-rst-');
  const h = denyWrite(d); const back = h.restore();
  return { pass: back.writable, detail: `복구 뒤 쓰기 가능 ${back.writable}` };
});

/* ═════ LOSTWINDOW — 손실 창을 «숫자»로 ═══════════════════════════════════ */
C('LOSS-healthy-noLoss', 'LOSTWINDOW', 'healthy', 'PASS', () => {
  const d = mkTmpRoot('h7-loss-ok-');
  const f = path.join(d, 'proj.json');
  const t0 = Date.now();
  const ledger = { startedAt: t0, edits: [1, 2, 3].map(n => ({ n, marker: MARKER(n), at: t0 + n * 1000 })) };
  fs.writeFileSync(f, JSON.stringify({ pages: [{ canvas: ledger.edits.map(e => e.marker).join(' ') }] }));
  const r = judgeLostWindow(ledger, f, t0 + 3000, { budgetMs: 2000 });
  return { pass: r.pass && r.editsLost === 0 && r.lossWindowMs === 0, detail: r.summary };
});
C('LOSS-broken-twoLost', 'LOSTWINDOW', 'broken', 'FAIL', () => {
  const d = mkTmpRoot('h7-loss-bad-');
  const f = path.join(d, 'proj.json');
  const t0 = Date.now();
  const ledger = { startedAt: t0, edits: [1, 2, 3].map(n => ({ n, marker: MARKER(n), at: t0 + n * 1000 })) };
  fs.writeFileSync(f, JSON.stringify({ pages: [{ canvas: MARKER(1) }] }));   // 1번까지만 디스크 도달
  const r = judgeLostWindow(ledger, f, t0 + 5000, { budgetMs: 2000 });
  return { pass: r.pass, detail: r.summary, editsLost: r.editsLost, lossWindowMs: r.lossWindowMs };
});
C('LOSS-broken-diskGone', 'LOSTWINDOW', 'broken', 'FAIL', () => {
  const d = mkTmpRoot('h7-loss-gone-');
  const t0 = Date.now();
  const ledger = { startedAt: t0, edits: [{ n: 1, marker: MARKER(1), at: t0 }] };
  const r = judgeLostWindow(ledger, path.join(d, 'nope.json'), t0 + 4000, { budgetMs: 1000 });
  return { pass: r.pass, detail: r.summary, diskExists: r.diskExists };
});
C('LOSS-healthy-emptySkipIsNotFailure', 'LOSTWINDOW', 'healthy', 'PASS', () => {
  // H4 양성대조: 「빈 캔버스라 안 저장됨」을 「저장 실패」로 오인하면 매번 다이얼로그가 뜬다
  const e = judgeEmptyCanvasSkip(CHECKOUT, { pages: [{ canvas: '' }] });
  const n = judgeEmptyCanvasSkip(CHECKOUT, { pages: [{ canvas: '<div class="section-block"></div>' }] });
  return { pass: e.empty === true && n.empty === false, detail: `빈 ${e.empty} / 내용있음 ${n.empty}` };
});

/* ═════ LOADCHECK — ★«도구의 도구»의 양성대조 ════════════════════════════ */
C('LOADCHECK-healthy-allLoaded', 'LOADCHECK', 'healthy', 'PASS', () => {
  const { missing } = loadIsAllCanvasEmpty(CHECKOUT);
  return { pass: missing.length === 0, detail: `안 실은 선언 ${missing.length}개` };
});
C('LOADCHECK-broken-detectsMissing', 'LOADCHECK', 'broken', 'FAIL', () => {
  /* 일부러 «의존을 빼고» 세어 본다 — 검사기가 갈라짐을 실제로 잡는지.
     ⛔공용 트리를 안 건드린다. «잘라낸 문자열 사본»으로만 만든다(harness.md §3-c ⑵-b). */
  const S = openSource(path.join(CHECKOUT, 'js/io/save-load.js'));
  const fakeSrc = 'function _helperX(a){return a;}\nfunction _userY(b){ return _helperX(b); }\n';
  const body = 'function _userY(b){ return _helperX(b); }\n';
  const missing = missingSymbols(body, fakeSrc, ['_userY']);
  return { pass: missing.length === 0, detail: `검사기가 찾은 «안 실은» 선언: [${missing.join(',')}]`,
    found: missing };
});
C('LOADCHECK-broken-headDrift', 'LOADCHECK', 'broken', 'FAIL', () => {
  // 소스가 바뀌어 «자를 자리»가 사라지면 조용히 넘어가면 안 된다 — 던져야 한다.
  let threw = false, msg = '';
  try { openSource(path.join(CHECKOUT, 'js/io/save-load.js')).slice('function _thisDoesNotExist_(') ; }
  catch (e) { threw = true; msg = e.message.slice(0, 90); }
  return { pass: !threw, detail: threw ? `던졌다: ${msg}` : '조용히 통과했다(나쁘다)' };
});

/* ═════ DEADLINE — ★무한 대기 금지 ═══════════════════════════════════════ */
C('DEADLINE-broken-boundedNotHang', 'DEADLINE', 'broken', 'FAIL', async () => {
  // 영원히 참이 안 되는 조건. 상한 안에 HarnessError 로 «끝나야» 한다.
  const t0 = Date.now();
  let err = null;
  try { await waitFor(() => false, { timeout: 600, interval: 50, label: '절대 안 오는 것' }); }
  catch (e) { err = e; }
  const ms = Date.now() - t0;
  const ok = err instanceof HarnessError && ms < 3000;
  return { pass: !ok, detail: `${ms}ms 만에 ${err ? err.name : '«안 끝났다»'} — 상한 작동 ${ok}` };
});
C('DEADLINE-healthy-resolves', 'DEADLINE', 'healthy', 'PASS', async () => {
  const t0 = Date.now();
  const v = await waitFor(() => (Date.now() - t0 > 150 ? 'ok' : null), { timeout: 3000, interval: 30, label: 'ok' });
  return { pass: v === 'ok', detail: `${Date.now() - t0}ms 만에 해소` };
});
C('DEADLINE-broken-noTimeoutRejected', 'DEADLINE', 'broken', 'FAIL', async () => {
  // ⛔상한을 «안 준» 대기는 애초에 만들 수 없어야 한다.
  let threw = false;
  try { await waitFor(() => true, { label: '상한 없음' }); } catch (e) { threw = e instanceof HarnessError; }
  return { pass: !threw, detail: threw ? '상한 없는 대기를 거부했다' : '상한 없이 돌았다(나쁘다)' };
});

/* ═════ 원본 무접촉 게이트 ════════════════════════════════════════════════ */
C('GUARD-broken-refusesOriginalUd', 'GUARD', 'broken', 'FAIL', () => {
  let threw = false;
  try { assertWritableTarget(path.join(os.homedir(), 'Library/Application Support/GODITOR/projects')); }
  catch (e) { threw = e instanceof HarnessError; }
  return { pass: !threw, detail: threw ? '원본 ud 쓰기를 거부했다' : '★거부 안 했다 — 위험' };
});
C('GUARD-broken-refusesCorpusOriginal', 'GUARD', 'broken', 'FAIL', () => {
  let threw = false;
  try { assertWritableTarget(path.join(os.homedir(), 'srv-지디_qa-corpus/proj_large_safebon')); }
  catch (e) { threw = e instanceof HarnessError; }
  return { pass: !threw, detail: threw ? '코퍼스 원본 쓰기를 거부했다' : '★거부 안 했다 — 위험' };
});
C('GUARD-broken-refusesHyunbinWorktree', 'GUARD', 'broken', 'FAIL', () => {
  let threw = false;
  try { assertWritableTarget(path.join(os.homedir(), 'web-editor-merge')); }
  catch (e) { threw = e instanceof HarnessError; }
  return { pass: !threw, detail: threw ? '현빈 작업본 쓰기를 거부했다' : '★거부 안 했다 — 위험' };
});
C('GUARD-healthy-allowsScratch', 'GUARD', 'healthy', 'PASS', () => {
  const d = mkTmpRoot('h7-guard-');
  const r = assertWritableTarget(d);
  return { pass: r === fs.realpathSync(d) || r === path.resolve(d), detail: `허용: ${path.basename(r)}` };
});

/* ═════ 파일 무변경 증명(C5) ══════════════════════════════════════════════ */
C('SNAP-healthy-identical', 'SNAPSHOT', 'healthy', 'PASS', () => {
  const ud = mkTmpRoot('h7-snap-ok-');
  const p = makeProject(ud, 'proj_snap');
  const a = snapshotDir(p.dir); const b = snapshotDir(p.dir);
  const d = diffSnapshots(a, b);
  return { pass: d.identical, detail: `변경 ${d.changed.length} · 추가 ${d.added.length} · 삭제 ${d.removed.length}` };
});
C('SNAP-broken-detectsChange', 'SNAPSHOT', 'broken', 'FAIL', () => {
  const ud = mkTmpRoot('h7-snap-bad-');
  const p = makeProject(ud, 'proj_snap2');
  const a = snapshotDir(p.dir);
  corrupt(p.dir, 'half');
  const d = diffSnapshots(a, snapshotDir(p.dir));
  return { pass: d.identical, detail: `변경 ${d.changed.length} 건 감지` };
});

/* ═════ 실행기 ═══════════════════════════════════════════════════════════ */
export async function runMatrix() {
  const rows = [];
  for (const c of CASES) {
    let out, error = null;
    try { out = await c.run(); }
    catch (e) { out = { pass: null }; error = `${e.name}: ${e.message}`.slice(0, 200); }
    const pass = out.pass;
    // 「기대」와 「실제」의 대조 — arm 이 healthy 면 PASS 여야, broken 이면 PASS 가 «아니어야» 한다.
    const wantPass = c.arm === 'healthy';
    const separated = error ? false : (wantPass ? pass === true : pass !== true);
    rows.push({ ...c, ...out, error, separated,
      falsePositive: c.arm === 'healthy' && !separated,   // 정상인데 빨강 = 오탐
      falseNegative: c.arm === 'broken' && !separated });  // 고장인데 초록 = 미탐
  }
  const fp = rows.filter(r => r.falsePositive);
  const fn = rows.filter(r => r.falseNegative);
  return { rows, falsePositives: fp, falseNegatives: fn,
    ok: fp.length === 0 && fn.length === 0,
    counts: { total: rows.length, healthy: rows.filter(r => r.arm === 'healthy').length,
      broken: rows.filter(r => r.arm === 'broken').length, fp: fp.length, fn: fn.length } };
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const r = await runMatrix();
  const byJudge = {};
  for (const row of r.rows) (byJudge[row.judge] ||= []).push(row);
  console.log('\n═══ H7 하네스 자체검사 — «고장/정상을 가르는가» ═══\n');
  for (const [j, rows] of Object.entries(byJudge)) {
    console.log(`── ${j} ──`);
    for (const row of rows) {
      const mark = row.separated ? '✓' : '✗';
      console.log(`  ${mark} [${row.arm.padEnd(7)}] ${row.id.padEnd(38)} ${row.error || row.detail || ''}`);
    }
  }
  console.log(`\n총 ${r.counts.total}건 (정상 ${r.counts.healthy} · 고장 ${r.counts.broken})`);
  console.log(`★오탐(정상인데 빨강) = ${r.counts.fp}건`);
  console.log(`★미탐(고장인데 초록) = ${r.counts.fn}건`);
  if (!r.ok) {
    for (const x of [...r.falsePositives, ...r.falseNegatives]) console.log(`  ✗ ${x.id}: ${x.error || x.detail}`);
    console.log('\n⛔이 도구는 «미완»이다 — 오탐·미탐이 0 이 아니다.');
    process.exit(EXIT.FAIL);
  }
  console.log('\n★도구 양성대조 통과 — 판정기 전부가 고장/정상을 갈랐다.');
  process.exit(EXIT.PASS);
}
