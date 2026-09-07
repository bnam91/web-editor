/* ═══════════════════════════════════════════════════════════════════════════
   run.mjs — «망가뜨리기» 시나리오 실행기 (실기).
   ───────────────────────────────────────────────────────────────────────────
   사용:
     node tools/hardening/run.mjs <시나리오> --port 9391 [옵션]
   시나리오:
     baseline        아무것도 안 부순다 — ★양성대조(정상에서 판정기가 빨개지지 않는지)
     crash-renderer  CDP Page.crash
     crash-gpu       CDP Browser.crashGpuProcess
     hang            렌더러 busy loop
     kill9-midsave   proj.json.tmp 출현 «순간» SIGKILL
     deny-write      projects 폴더 쓰기 거부(권한) — 편집·종료가 어떻게 되나
     corrupt-half    proj.json «만» 반쪽 → 기존 폴백 체인(양성대조)
     corrupt-all     proj.json·backup·history «전부» 반쪽 → A1-2 자리
     corrupt-sidecar history 가 사이드카뿐 → A2 치명 재발 감시
   옵션:
     --port N          9350~9399 (⛔9334 현빈 데모 · 9340 남의 인스턴스 금지)
     --corpus          코퍼스 «사본»으로 재현(C8). 기본은 합성 픽스처
     --pad-kb N        합성 픽스처 페이지 패딩(저장 시간을 늘려 kill9 창을 벌린다)
     --edits N         손실 창 측정용 편집 횟수(기본 3)
     --deadline-ms N   전역 상한(기본 480000) — ⛔무슨 일이 있어도 여기서 죽는다
     --out FILE        결과 JSON 경로
     --keep            끝나고 인스턴스를 남긴다(디버그용)

   ⛔실행 «전»에 반드시 «별도 명령»으로 preflight 를 돌려라(이 스크립트는 부르지 않는다):
       bash ~/.claude/skills/goditor-qa/tools/preflight.sh 9391 지디_qa_h7 --standing 2
       EX=$?; echo "preflight exit=$EX"     ← ⛔파이프 금지($? 가 깨진다)
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { EXIT, HarnessError, armGlobalDeadline, sleep, waitFor } from './lib/deadline.mjs';
import { requirePreflightPass } from './lib/preflight-gate.mjs';
import { launch, teardown, openProject, attachAndVerify, originClean, mainLogLines } from './lib/instance.mjs';
import { makeProject, copyCorpus, makeUserDataDir, piiSamples } from './lib/fixture.mjs';
import { evalJs } from './lib/cdp.mjs';
import { corrupt, snapshotDir, diffSnapshots } from './break/corrupt.mjs';
import { denyWrite } from './break/deny-write.mjs';
import { killMidSave } from './break/kill9-midsave.mjs';
import { crashRenderer, crashGpu, hangRenderer } from './break/crash.mjs';
import { judgeI7 } from './judge/i7.mjs';
import { judgePii } from './judge/pii.mjs';
import { judgeCrashLog } from './judge/crashlog.mjs';
import { newLedger, makeEdit, judgeLostWindow, diskMaxMarker } from './judge/lost-window.mjs';
import { installToastRecorder, proveToastRecorder, readToasts, readSaveIndicator, readReportBuffer, judgeToast } from './judge/ui-state.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECKOUT = path.resolve(__dirname, '../..');

/* ── 인자 ── */
const argv = process.argv.slice(2);
const scenario = argv.find(a => !a.startsWith('--')) || 'baseline';
const flag = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? (argv[i + 1] ?? true) : d; };
const has = n => argv.includes(`--${n}`);
const PORT = Number(flag('port', 0));
const USE_CORPUS = has('corpus');
const PAD_KB = Number(flag('pad-kb', USE_CORPUS ? 0 : 4096));
const EDITS = Number(flag('edits', 3));
const GLOBAL_MS = Number(flag('deadline-ms', 480000));
const OUT = flag('out', null);

const SCENARIOS = ['baseline', 'crash-renderer', 'crash-gpu', 'hang', 'kill9-midsave',
  'deny-write', 'corrupt-half', 'corrupt-all', 'corrupt-sidecar'];

function die(code, msg, extra) {
  const tag = code === EXIT.HARNESS_ERROR ? 'HARNESS_ERROR' : 'FAIL';
  process.stderr.write(`\n[${tag}] ${msg}\n${extra ? JSON.stringify(extra, null, 2) + '\n' : ''}`);
  process.exit(code);
}

/* ── 본체 ── */
const disarm = armGlobalDeadline(GLOBAL_MS, `run.mjs ${scenario}`);
const R = {
  scenario, startedAt: new Date().toISOString(), checkout: CHECKOUT,
  port: PORT, corpus: USE_CORPUS, padKb: PAD_KB, edits: EDITS,
  preflight: null, instance: null, breaker: null, judges: {}, notes: [], verdict: null,
};
let inst = null, denied = [], denyHandle = null;

try {
  if (!SCENARIOS.includes(scenario)) die(EXIT.HARNESS_ERROR, `알 수 없는 시나리오: ${scenario}\n  가능: ${SCENARIOS.join(', ')}`);
  if (!PORT) die(EXIT.HARNESS_ERROR, '--port 를 줘라 (9350~9399, ⛔9334·9340 금지)');

  // ⑴ preflight 통과 «로그»가 없으면 여기서 끝. ⛔이 스크립트는 preflight 를 «부르지 않는다».
  R.preflight = requirePreflightPass(PORT);

  // ⑵ «내» ud 에 «내가 만든» 픽스처. ⛔현빈 실제 프로젝트는 절대 대상이 아니다.
  const tag = `${scenario}-${PORT}`;
  const ud = makeUserDataDir(tag);
  const fx = USE_CORPUS ? copyCorpus(ud) : makeProject(ud, `proj_h7_${Date.now()}`, { padKb: PAD_KB, sections: 4 });
  R.fixture = { id: fx.id, dir: fx.dir, bytes: fx.bytes, corpus: USE_CORPUS, copyMs: fx.copyMs ?? null };
  const samples = piiSamples(fx.dir);
  R.piiSampleCounts = { home: samples.home.length, corpusText: samples.corpusText.length, assetNames: samples.assetNames.length };
  const before = snapshotDir(fx.dir);

  // ⑶ 격리 인스턴스 — 화면 밖으로 «옮기고 읽어서 확인»한다(플래그를 안 믿는다)
  /* ★붙을 때마다 수집기를 «다시» 심는다 — 세션이 바뀌면 등록이 사라진다(instance.mjs 주석). */
  const reinstall = async (conn) => { await installToastRecorder(conn); };
  inst = await launch({ checkoutDir: CHECKOUT, userDataDir: ud, port: PORT, projectId: fx.id,
                        onAttach: [reinstall] });
  R.instance = { pid: inst.pid, port: inst.port, userDataDir: ud, href: inst.href,
    screenX: inst.screenX, dpr: inst.dpr, innerHeight: inst.innerHeight,
    offscreen: inst.offscreen, movedWindows: inst.movedWindows };
  await installToastRecorder(inst.conn);
  /* ★수집기가 «실제로 잡는지» 먼저 증명한다 — 증명 없는 「0건」은 판정이 아니다. */
  R.toastProof = await proveToastRecorder(inst.conn);
  if (!R.toastProof.proven) R.notes.push(`⚠️토스트 수집기 자가증명 실패 — ${R.toastProof.reason}`);
  await evalJs(inst.conn, `window.ReportBuffer && window.ReportBuffer.note('[H7-marker ${scenario}]')`);
  const MARKER = `[H7-marker ${scenario}]`;

  const logsSince = Date.now();
  const ledger = newLedger();

  /* ── 시나리오 ─────────────────────────────────────────────────────────── */
  if (scenario === 'baseline') {
    for (let i = 0; i < EDITS; i++) { await makeEdit(inst.conn, ledger); await sleep(400); }
    /* ★양성대조는 «저장이 디스크에 도착할 때까지» 기다린다 — 그래야 손실 창 0 이 나온다.
       ⛔상한 있는 대기로만. 자동저장 디바운스(1.5s)+직렬화 시간을 넉넉히 잡는다. */
    await waitFor(() => diskMaxMarker(path.join(fx.dir, 'proj.json')).max >= EDITS,
      { timeout: 60000, interval: 500, label: '양성대조: 편집이 디스크에 도착하기를 대기' });
    R.breaker = { breaker: 'none', summary: '양성대조 — 아무것도 안 부쉈다' };
    R.killAt = Date.now();

  } else if (scenario === 'crash-renderer') {
    for (let i = 0; i < EDITS; i++) { await makeEdit(inst.conn, ledger); await sleep(300); }
    R.breaker = await crashRenderer(inst);
    R.killAt = R.breaker.at;
    // ⛔크래시 뒤엔 rAF 계열 대기 금지 — «파일»로만 관측한다

  } else if (scenario === 'crash-gpu') {
    for (let i = 0; i < EDITS; i++) { await makeEdit(inst.conn, ledger); await sleep(300); }
    R.breaker = await crashGpu(inst);
    R.killAt = R.breaker.at;

  } else if (scenario === 'hang') {
    for (let i = 0; i < EDITS; i++) { await makeEdit(inst.conn, ledger); await sleep(300); }
    R.breaker = await hangRenderer(inst);
    R.killAt = R.breaker.at;

  } else if (scenario === 'kill9-midsave') {
    for (let i = 0; i < EDITS - 1; i++) { await makeEdit(inst.conn, ledger); await sleep(1800); }
    R.breaker = await killMidSave(fx.dir, inst.pid, async () => { await makeEdit(inst.conn, ledger); });
    R.killAt = R.breaker.killAt;
    if (R.breaker.verdict !== 'HIT') R.notes.push(`⚠️kill9 ${R.breaker.verdict} — ${R.breaker.note}`);

  } else if (scenario === 'deny-write') {
    denyHandle = denyWrite(fx.projectsDir ?? path.join(ud, 'projects'));  // [뿌리-하네스] 비로그인 픽스처 전용 — 위 경고 참조
    denied = denyHandle.denied;
    R.breaker = { ...denyHandle, restore: undefined };
    for (let i = 0; i < EDITS; i++) { await makeEdit(inst.conn, ledger); await sleep(800); }
    await sleep(4000);
    R.killAt = Date.now();
    R.judges.saveIndicator = await readSaveIndicator(inst.conn);
    R.judges.reportBuffer = await readReportBuffer(inst.conn);

  } else if (scenario.startsWith('corrupt-')) {
    const mode = scenario.slice('corrupt-'.length);
    await teardown(inst, { reason: 'corrupt: 닫고 부순 뒤 다시 연다' });
    R.breaker = corrupt(fx.dir, mode);
    /* ★수집기를 «열기 전»에, 그리고 «붙을 때마다» 심어야 복구 토스트를 놓치지 않는다. */
    inst = await launch({ checkoutDir: CHECKOUT, userDataDir: ud, port: PORT, onAttach: [reinstall] });
    const afterCorrupt = snapshotDir(fx.dir);
    await openProject(inst, fx.id);
    await sleep(3000);
    /* ⑵ 토스트가 사라져도 «요소»는 남는다 — 원시 읽기를 증거로 같이 싣는다. */
    R.judges.toastElRaw = await evalJs(inst.conn, `(function(){
      var t = document.getElementById('editor-toast');
      return t ? { found:true, text:String(t.textContent||'').trim().slice(0,300), cls:String(t.className||'') } : { found:false };
    })()`);
    const proof = await proveToastRecorder(inst.conn);
    R.toastProof = proof;
    if (!proof.proven) R.notes.push(`⚠️토스트 수집기 자가증명 실패 — ${proof.reason}`);
    R.judges.toasts = judgeToast(await readToasts(inst.conn), { proof });
    R.judges.reportBuffer = await readReportBuffer(inst.conn);
    R.judges.saveIndicator = await readSaveIndicator(inst.conn);
    // ★C5: 「열기만 했을 때 파일이 «안 바뀐다»」 — sha 전후 동일
    R.judges.fileUnchangedAfterOpen = diffSnapshots(afterCorrupt, snapshotDir(fx.dir));
    R.killAt = Date.now();
  }

  /* ── 판정 ─────────────────────────────────────────────────────────────── */
  R.judges.i7 = judgeI7(path.join(ud, 'projects'), { checkoutDir: CHECKOUT, denied });  // [뿌리-하네스] 비로그인 픽스처 전용 — 위 경고 참조
  R.judges.lostWindow = judgeLostWindow(ledger, path.join(fx.dir, 'proj.json'), R.killAt);
  R.judges.crashLog = judgeCrashLog(ud, { sinceMs: logsSince, denied, expect: 'present' });
  R.judges.pii = judgePii(
    [path.join(ud, 'logs'), path.join(ud, 'reports-queue.json')].filter(p => fs.existsSync(p)),
    samples);
  if (R.judges.pii.filesScanned === 0) {
    R.judges.pii.notMeasured.push('검사할 기록·큐 파일이 «하나도 없다» — PII 판정은 성립하지 않는다');
    R.judges.pii.pass = null; R.judges.pii.verdict = 'NOT_MEASURED';
  }
  R.judges.fileDiffFromStart = diffSnapshots(before, snapshotDir(fx.dir));
  if (!scenario.startsWith('corrupt-') && scenario !== 'crash-renderer' && inst && inst.conn && !inst.conn.closed) {
    try { R.judges.toasts = judgeToast(await readToasts(inst.conn), { proof: R.toastProof }); }
    catch (e) { R.notes.push(`토스트 수집 실패: ${e.message}`); }
  }
  R.marker = MARKER;
  /* ★메인 프로세스가 «스스로 말한 것» — 복구·손상은 여기에만 남는 경우가 많다.
     화면에 안 뜬 것과 «아예 안 일어난 것»을 가르는 유일한 증거다. */
  R.mainLog = inst ? mainLogLines(inst) : [];

  /* ── 종합 ─────────────────────────────────────────────────────────────── */
  const fails = [];
  if (R.judges.i7.pass === false) fails.push('I7');
  if (R.judges.pii.pass === false) fails.push('PII');
  /* ★★「못 쟀다」가 있는 실행을 «그냥 PASS» 라고 말하지 않는다.
     이 하네스가 막으려는 가짜 초록의 본체가 정확히 그 문장이다(골 §5.7). */
  R.notMeasured = Object.entries(R.judges)
    .filter(([, v]) => v && (v.verdict === 'NOT_MEASURED' || (v.pass === null && v.notMeasured)))
    .map(([k, v]) => `${k}: ${v.verdict || 'NOT_MEASURED'}${v.notMeasured ? ' — ' + (Array.isArray(v.notMeasured) ? v.notMeasured.join('; ') : v.notMeasured) : ''}`);
  R.verdict = fails.length ? `FAIL(${fails.join(',')})`
    : R.notMeasured.length ? `PASS_WITH_UNMEASURED(${R.notMeasured.length})`
    : 'PASS';

} catch (e) {
  R.error = { name: e.name, message: e.message, detail: e.detail || null };
  R.verdict = e instanceof HarnessError ? 'HARNESS_ERROR' : 'ERROR';
} finally {
  try { denyHandle && denyHandle.restore(); } catch (_) {}
  if (inst && !has('keep')) { try { R.teardown = await teardown(inst); R.originClean = originClean(inst); } catch (_) {} }
  disarm();
}

R.finishedAt = new Date().toISOString();
const json = JSON.stringify(R, null, 2);
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, json); }

console.log(`\n═══ H7 ${scenario} ═══`);
console.log(`인스턴스  pid=${R.instance?.pid} port=${PORT} screenX=${R.instance?.screenX} dpr=${R.instance?.dpr} 화면밖=${R.instance?.offscreen}`);
console.log(`픽스처    ${R.fixture?.id} ${R.fixture?.bytes}B ${USE_CORPUS ? '(코퍼스 사본)' : '(합성)'}`);
console.log(`주입      ${R.breaker?.summary || '-'}`);
if (R.breaker?.sanity) console.log(`sanity    ${R.breaker.sanity}`);
for (const [k, v] of Object.entries(R.judges)) if (v && v.summary) console.log(`판정      ${v.summary}`);
if (R.judges?.lostWindow) console.log(`손실 창   ${R.judges.lostWindow.lossWindowSec}s (편집 ${R.judges.lostWindow.editsMade} → 디스크 ${R.judges.lostWindow.editsLanded})`);
for (const n of R.notes) console.log(`note      ${n}`);
for (const n of (R.notMeasured || [])) console.log(`⚠️못 잼   ${n}`);
if (R.teardown) console.log(`정리      pid ${R.teardown.pid} ${R.teardown.sigkill ? 'SIGKILL' : 'SIGTERM'} · 포트해제 ${R.teardown.portGone}`);
if (R.originClean) console.log(`원본무접촉 ${R.originClean.clean ? 'ORIGIN-CLEAN(내 ud 만 씀)' : '★위반 ' + R.originClean.offenders}`);
if (OUT) console.log(`결과      ${OUT}`);
console.log(`판정      ★${R.verdict}`);
if (R.error) console.log(`오류      ${R.error.name}: ${R.error.message}`);

/* PASS_WITH_UNMEASURED 도 «성공 종료»(0)다 — 실패가 아니다. 다만 보고서에 그 문장이 박힌다.
   ⛔이걸 3(HARNESS_ERROR)으로 만들면 「못 잰 축이 하나 있다」가 「도구가 고장났다」로 읽힌다. */
process.exit(R.verdict === 'PASS' || String(R.verdict).startsWith('PASS_WITH') ? EXIT.PASS
  : String(R.verdict).startsWith('FAIL') ? EXIT.FAIL : EXIT.HARNESS_ERROR);
