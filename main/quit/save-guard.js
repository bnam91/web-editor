/* ══════════════════════════════════════════════════════════════════════════
   main/quit/save-guard.js — 종료 시 저장 실패의 «조용한 종료» 금지 (H4)
   ──────────────────────────────────────────────────────────────────────────
   ★고치기 «전»에 실제로 무슨 일이 있었나 (main.js:6169 실측)
     app.on('before-quit') 이 렌더러에 force-save-before-quit 을 쏘고
       · 'quit-ready' 가 오면            → app.exit(0)
       · 3초 안에 아무 것도 안 오면      → app.exit(0)
     그리고 렌더러(js/io/save-load.js)는 저장이 «실패해도» quitReady() 를 보냈다.
     ⇒ 저장 실패는 성공보다 «더 빨리» 조용히 죽었다. 사용자는 아무 통지도 못 받고,
       다음 실행 때 되살릴 흔적도 남지 않았다.
     ⇒ 게다가 saveProjectToFile 은 «던지지 않는다» — { ok:false, reason } 을 «반환»한다.
       옛 렌더러는 try/catch 만 봤으므로 EACCES·저장 거부 같은 «정상적으로 보고된 실패»를
       한 건도 못 봤다. (실측: 저장 거부 → 옛 코드 경로에서 통지 0건)

   ★그래서 이 모듈이 지키는 «방향»은 하나다
       「죽더라도 «말은 하고» 죽고, 흔적을 남긴다.」
     ⛔「저장이 성공할 때까지 기다린다」가 아니다. 안 꺼지는 앱은 조용한 종료보다 나쁘다.
       ⇒ 여기 있는 모든 대기에는 «상한»이 있고, 맨 바깥에 무조건 죽는 상한이 하나 더 있다.

   ★상한 세 겹 (전부 setTimeout — 어느 경로로 새도 결국 exit 로 모인다)
       saveWaitMs  3000ms  렌더러 응답 대기(기존 동작과 «같은» 값 — 종료 지연 회귀 없음)
       notifyMs    6000ms  실패를 «알리는» 창(사용자가 다이얼로그를 안 닫아도 여기서 끝)
       hardExitMs 12000ms  ★맨 바깥. 위 둘이 어떤 이유로든 안 돌아도 여기서 죽는다.
     ⛔dialog.showMessageBoxSync 를 쓰면 안 된다 — 메인 루프를 막아 위 타이머가 «안 돈다»
       (=사용자가 다이얼로그를 안 닫으면 앱이 영영 안 꺼진다). 반드시 비동기 판을 쓴다.

   ★남기는 것 두 가지 (userData 아래)
       emergency-saves/<projectId>-<ts>.json   저장 못 한 스냅샷 «원문 그대로»
                                              (프로젝트 JSON 과 같은 모양 → 그대로 복구 가능)
       quit-save-failure.json                  마커: 언제·왜·어느 프로젝트·사본 경로
     ⚠️«다음 실행 때 띄우는 복구 다이얼로그»는 여기서 만들지 않는다 — H3 담당이다.
       이 모듈은 H3 가 읽을 수 있는 «흔적»까지만 만든다(중복 구현 금지).
     ⚠️크래시 기록(logs/crash-*.json)은 H2 담당이다. 여기는 «종료 시 저장 실패»만 적는다.

   ★Electron 을 require 하지 않는다 — dialog·shell·exit 은 전부 «주입»받는다.
     그래야 유닛테스트가 Electron 없이 이 로직을 «실제로» 돌려볼 수 있다.
══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const TIMINGS = { saveWaitMs: 3000, notifyMs: 6000, hardExitMs: 12000 };
/** 마커에 남기는 실패 기록 수. 오래된 것부터 버린다. */
const MAX_RECORDS = 10;
/** 비상 사본 보관 개수. 코퍼스가 40MB 급이라 무한히 쌓으면 디스크를 먹는다. */
const MAX_EMERGENCY_FILES = 5;

let _dir = null;                 // userData
let _wsDir = null;               // ★계정 작업공간(작업물이 들어갈 자리). 미주입이면 _dir 로 폴백
let _log = () => {};
let _dialog = null;              // { showMessageBox(opts) -> Promise<{response}> }
let _shell = null;               // { showItemInFolder(p) }  — 없으면 버튼을 안 만든다
let _appVersion = null;
let _running = null;             // 재진입 방지(before-quit 은 두 번 올 수 있다)
/* ★[W-3] beforeunload 동기 저장이 «실패했다»는 사실. 창이 이미 닫히는 중이라 그 자리에선
   말할 수 없다 — 흔적은 «그 자리»에서 남기고, 말하는 건 뒤이어 오는 before-quit 이 한다. */
let _pendingSync = null;

function init({ userDataDir, log, dialog, shell, appVersion, workspaceDir} = {}) {
  if (userDataDir) _dir = userDataDir;
  if (workspaceDir) _wsDir = workspaceDir;
  if (typeof log === 'function') _log = log;
  if (dialog) _dialog = dialog;
  if (shell) _shell = shell;
  if (appVersion) _appVersion = appVersion;
}

/* ── 경로 ─────────────────────────────────────────────────────────────── */
/* ★★«작업물»과 «기계 것»을 가른다 (2026-09-07 계정별 폴더 격리).
   ⛔여기 들어가는 것은 «저장 못 한 프로젝트 원문»이다 = 사용자 작업물.
     그런데 뿌리가 공용(<userData>)이면, 철수의 저장 실패본이 ★민수 복구 화면에 뜨고
     버튼 한 번에 민수 계정 폴더로 복제된다 — 이번 판이 막으려던 시나리오 그 자체가
     «손도 안 댄 문»으로 성립한다.
   ⇒ 작업물은 «계정 작업공간»(= 프로젝트 뿌리의 부모)에 둔다.
     비로그인이면 그 값이 <userData> 라 ★오늘 동작과 «바이트 동일»이다.
   ⛔반대로 templates·presets·goditor-market·svg-presets 는 «공유가 맞다» —
     그건 «사람»이 아니라 «기계»에 붙는 도구다(지디 판단 2026-09-07). 크래시 로그도 같다.
     ★그 선을 여기 적어 둔다: 「작업물이면 가르고, 도구·진단이면 공유한다」. */
function _ws() {
  if (typeof _wsDir === 'function') { try { const r = _wsDir(); if (r) return r; } catch (_) {} }
  return _wsDir || _dir;   // 미주입이면 예전과 같은 자리(퇴행 없음)
}
function markerPath() { return path.join(_ws(), 'quit-save-failure.json'); }
function emergencyDir() { return path.join(_ws(), 'emergency-saves'); }

/** 렌더러가 준 id 로 «경로»를 만든다 — 그대로 쓰면 ../ 로 밖에 쓸 수 있다. */
function safeName(id) {
  const s = String(id == null ? '' : id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
  return s || 'unknown';
}

/* ── 판정 ──────────────────────────────────────────────────────────────────
   렌더러가 보낸 결과를 «종료 통지»로 번역한다.
   ★원칙: «명시적인 성공»만 성공이다. 애매한 것은 전부 실패로 센다.
     우리 실수로 「불필요한 안내를 봤다」는 괜찮지만, 「작업물이 조용히 사라졌다」는 안 된다.
   ★payload 는 렌더러가 만든 «남의 데이터»다 — 필드마다 타입을 확인하고 필요한 것만 꺼낸다.
   ────────────────────────────────────────────────────────────────────────── */
function classify(payload) {
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);
  const base = {
    projectId: payload && str(payload.projectId, 128),
    projectName: payload && str(payload.projectName, 200),
    error: payload && str(payload.error, 500),
    snapshot: payload && typeof payload.snapshot === 'string' ? payload.snapshot : null,
  };
  if (!payload || typeof payload !== 'object') {
    // ★옛 렌더러(인자 없이 quitReady())가 여기로 온다. 「모르겠다」를 성공으로 접지 않는다.
    return { ...base, ok: false, reason: 'no-result' };
  }
  if (payload.ok === true) return { ...base, ok: true, reason: str(payload.reason, 64) || 'saved' };
  return { ...base, ok: false, reason: str(payload.reason, 64) || 'save-failed' };
}

/* ── 흔적 남기기 ────────────────────────────────────────────────────────── */

/** 비상 사본 — «스냅샷 원문 그대로» 쓴다(프로젝트 JSON 과 같은 모양이라 그대로 복구된다). */
function writeEmergencyCopy(outcome, stamp) {
  if (!outcome.snapshot) return { emergency: null, emergencyError: 'no-snapshot' };
  try {
    const dir = emergencyDir();
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, `${safeName(outcome.projectId)}-${stamp}.json`);
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, outcome.snapshot, 'utf8');
    fs.renameSync(tmp, p);
    pruneEmergency(dir);
    return { emergency: { path: p, bytes: Buffer.byteLength(outcome.snapshot, 'utf8') }, emergencyError: null };
  } catch (e) {
    // ★사본을 못 써도 «마커»는 남긴다. 그리고 못 썼다는 사실을 사용자에게 그대로 말한다.
    return { emergency: null, emergencyError: (e && (e.code || e.message)) || 'write-failed' };
  }
}

function pruneEmergency(dir) {
  try {
    const files = fs.readdirSync(dir)
      .filter((n) => n.endsWith('.json'))
      .map((n) => { const p = path.join(dir, n); return { p, m: fs.statSync(p).mtimeMs }; })
      .sort((a, b) => b.m - a.m);
    for (const f of files.slice(MAX_EMERGENCY_FILES)) { try { fs.rmSync(f.p, { force: true }); } catch (_) {} }
  } catch (_) {}
}

function readMarker() {
  try {
    const j = JSON.parse(fs.readFileSync(markerPath(), 'utf8').replace(/^﻿/, ''));
    return j && Array.isArray(j.records) ? j.records : [];
  } catch (_) { return []; }
}

/** 마커 = «다음 실행이 읽을» 흔적. 원자적 쓰기(임시파일 → rename). */
function writeFailureRecord(outcome, now) {
  const at = new Date(now).toISOString();
  const stamp = at.replace(/[:.]/g, '-');
  const copy = writeEmergencyCopy(outcome, stamp);
  const record = {
    at,
    reason: outcome.reason,
    error: outcome.error || null,
    projectId: outcome.projectId || null,
    projectName: outcome.projectName || null,
    appVersion: _appVersion || null,
    emergencyPath: copy.emergency ? copy.emergency.path : null,
    emergencyBytes: copy.emergency ? copy.emergency.bytes : null,
    emergencyError: copy.emergencyError,
    handled: false,          // ★H3(다음 실행 복구)이 처리하고 나서 켜라 — 여기서는 안 켠다
  };
  let markerError = null;
  try {
    const records = [record, ...readMarker()].slice(0, MAX_RECORDS);
    const p = markerPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, records }, null, 2), 'utf8');
    fs.renameSync(tmp, p);
  } catch (e) {
    markerError = (e && (e.code || e.message)) || 'write-failed';
  }
  return { record, markerError, markerPath: markerPath() };
}

/* ── 사용자에게 «말하기» ────────────────────────────────────────────────── */
const WHY = {
  'save-failed': '저장 중 오류가 났습니다.',
  exception: '저장 중 오류가 났습니다.',
  rejected: '저장이 거부됐습니다.',
  corrupt_snapshot: '작업 내용을 저장할 형태로 만들지 못했습니다.',
  quota: '저장 공간이 모자랍니다.',
  unconfirmed: '저장이 끝났는지 «확인하지 못했습니다».',
  'no-response': '편집 화면이 제 시간에 응답하지 않았습니다.',
  'no-result': '저장 결과를 받지 못했습니다.',
  'send-failed': '편집 화면에 저장 요청을 보내지 못했습니다.',
};

/* ★「실패했다」와 「모른다」는 다른 말이다 — 아래 셋은 «실패의 증거가 없다».
 *   무응답/미확인은 상한(3s)에 걸린 것이지 저장이 실패한 게 아니다. 실제로 큰 프로젝트는
 *   상한 뒤에 «성공»으로 끝날 수 있다(실측: 103MB proj.json 직렬화만 543ms + IPC + 쓰기).
 *   ⇒ 그런 사람에게 「저장하지 못했습니다」라고 «단정»하면 우리가 모르는 것을 사실로 읽어 주는 것이다.
 *   ⛔이건 문구만 다르고 «동작은 같다» — 비상 사본도 마커도 그대로 남긴다. 안전은 안 낮춘다.
 *   (같은 원칙: E3-b ㉮ — 검증 안 된 accessUntil 을 사실처럼 보여주지 않는다) */
const UNKNOWN_REASONS = ['unconfirmed', 'no-response', 'no-result'];

function failureText(outcome, saved) {
  const unknown = UNKNOWN_REASONS.indexOf(outcome.reason) !== -1;
  const why = WHY[outcome.reason] || `저장에 실패했습니다. (${outcome.reason})`;
  const lines = [why];
  if (unknown) lines.push('저장이 «끝났을 수도» 있습니다 — 다음 실행에서 확인하세요.');
  if (outcome.error) lines.push(`원인: ${outcome.error}`);
  if (saved.record.emergencyPath) {
    lines.push('', '마지막 작업 내용을 «비상 사본»으로 따로 저장했습니다:', saved.record.emergencyPath,
      '다음에 앱을 켜고 이 파일에서 되살릴 수 있습니다.');
  } else {
    lines.push('', `⚠️비상 사본도 만들지 못했습니다(${saved.record.emergencyError}).`,
      '이번 종료 뒤 마지막 편집이 사라질 수 있습니다.');
  }
  return {
    title: unknown ? '저장을 «확인하지 못한» 채 종료합니다' : '저장하지 못한 채 종료합니다',
    message: unknown
      ? (outcome.projectName
          ? `「${outcome.projectName}」의 저장이 끝났는지 확인하지 못했습니다.`
          : '작업 내용의 저장이 끝났는지 확인하지 못했습니다.')
      : (outcome.projectName
          ? `「${outcome.projectName}」을(를) 저장하지 못했습니다.`
          : '작업 내용을 저장하지 못했습니다.'),
    detail: lines.join('\n'),
  };
}

/**
 * ★반드시 «비동기» 다이얼로그. 그리고 절대 던지지 않는다(던지면 exit 경로가 끊긴다).
 * ⛔showMessageBoxSync 금지 — 메인 루프를 막아 상한 타이머가 안 돈다.
 */
function showFailureDialog(win, outcome, saved) {
  const t = failureText(outcome, saved);
  if (!_dialog || typeof _dialog.showMessageBox !== 'function') {
    _log(`[quit-guard] 저장 실패 — 다이얼로그를 못 띄웠다(dialog 미주입): ${t.message}`);
    return Promise.resolve({ shown: false });
  }
  const canReveal = !!(_shell && typeof _shell.showItemInFolder === 'function' && saved.record.emergencyPath);
  const buttons = canReveal ? ['확인', '비상 사본 위치 열기'] : ['확인'];
  const opts = { type: 'error', title: t.title, message: t.message, detail: t.detail, buttons, defaultId: 0, noLink: true };
  /* ★로그 한 줄 — 네이티브 다이얼로그는 CDP 로 «안 보인다». 하네스는 이 줄로 판정한다
     (tools/hardening README §3 H3 와 같은 규약). 「화면에 떴나」의 유일한 기계 증거다. */
  _log(`[quit-guard] dialog shown — 저장 실패(${outcome.reason}) project=${outcome.projectId || '?'} ` +
       `emergency=${saved.record.emergencyPath || 'none'}`);
  let p;
  try { p = _dialog.showMessageBox(win || null, opts); }
  catch (e) { _log(`[quit-guard] 다이얼로그 호출 실패: ${e && e.message}`); return Promise.resolve({ shown: false }); }
  return Promise.resolve(p).then((r) => {
    if (canReveal && r && r.response === 1) { try { _shell.showItemInFolder(saved.record.emergencyPath); } catch (_) {} }
    return { shown: true, response: r && r.response };
  }).catch((e) => { _log(`[quit-guard] 다이얼로그 대기 실패: ${e && e.message}`); return { shown: false }; });
}

/* ── 본체 ─────────────────────────────────────────────────────────────── */
/**
 * before-quit 에서 부른다. 여기서 «반드시» exit 가 불린다 — 어느 경로로 새도.
 * @param win     BrowserWindow (webContents.send 만 쓴다)
 * @param ipcMain 'quit-ready' 를 한 번 받는다
 * @param exit    (code) => void   — app.exit
 * @param timings 상한 3종 덮어쓰기(테스트용)
 * @returns 진행 상태 객체(테스트가 들여다본다)
 */
function runBeforeQuit({ win, ipcMain, exit, timings } = {}) {
  if (_running && !_running.exited) return _running;   // 두 번째 before-quit 은 무시(핸들러 중복 방지)
  const t = { ...TIMINGS, ...(timings || {}) };
  const started = Date.now();
  const state = {
    startedAt: started, settled: false, exited: false, outcome: null, saved: null,
    exitReason: null, exitCode: null, dialog: null, timers: [],
  };
  _running = state;

  const arm = (fn, ms) => { const h = setTimeout(fn, ms); state.timers.push(h); return h; };
  const finish = (code, why) => {
    if (state.exited) return;
    state.exited = true;
    state.exitReason = why; state.exitCode = code;
    for (const h of state.timers) { try { clearTimeout(h); } catch (_) {} }
    _log(`[quit-guard] 종료(${why}) — ${Date.now() - started}ms`);
    try { exit(code); } catch (e) { _log(`[quit-guard] exit 실패: ${e && e.message}`); }
  };
  /* ★맨 바깥 상한 — «무슨 일이 있어도» 여기서 죽는다.
     저장 판정·기록·다이얼로그 중 어디가 멈춰도 이 타이머 하나가 앱을 꺼준다. */
  arm(() => finish(0, 'hard-deadline'), t.hardExitMs);

  const onFail = (outcome) => {
    state.outcome = outcome;
    _log(`[quit-guard] 저장 실패로 종료 중 — reason=${outcome.reason} error=${outcome.error || '-'}`);
    const saved = writeFailureRecord(outcome, Date.now());
    state.saved = saved;
    _log(`[quit-guard] 저장 실패 기록: ${saved.markerError ? `마커 실패(${saved.markerError})` : saved.markerPath}` +
         ` · 비상 사본 ${saved.record.emergencyPath || `없음(${saved.record.emergencyError})`}`);
    /* 알리는 창에도 상한이 있다 — 사용자가 다이얼로그를 안 닫아도 앱은 꺼진다. */
    arm(() => finish(0, 'notify-deadline'), t.notifyMs);
    showFailureDialog(win, outcome, saved).then((d) => {
      state.dialog = d;
      finish(0, d && d.shown ? 'dialog-dismissed' : 'no-dialog');
    });
  };

  const settle = (outcome) => {
    if (state.settled || state.exited) return;
    state.settled = true;
    if (outcome.ok) {
      state.outcome = outcome;
      finish(0, `저장 확인됨(${outcome.reason})`);
      return;
    }
    onFail(outcome);
  };

  try { ipcMain.once('quit-ready', (_e, payload) => settle(classify(payload))); }
  catch (e) { _log(`[quit-guard] ipc 등록 실패: ${e && e.message}`); }

  arm(() => settle({ ok: false, reason: 'no-response', projectId: null, projectName: null, error: null, snapshot: null }),
      t.saveWaitMs);

  try {
    win.webContents.send('force-save-before-quit');
  } catch (e) {
    /* 렌더러가 이미 죽어 요청조차 못 보냈다 — 3초를 기다릴 이유가 없다. 바로 알린다. */
    settle({ ok: false, reason: 'send-failed', error: (e && e.message) || String(e), projectId: null, projectName: null, snapshot: null });
  }
  return state;
}

/* ── [W-3] 창이 «이미 사라진» 종료 경로 ────────────────────────────────────
   ★무엇이 뚫려 있었나 (미니4호기 윈도우 실기 QA 2차 §5-3ⓐ, SHA 6dc2385)
     윈도우 X 버튼(WM_CLOSE) 은 이렇게 간다:
       창 close → 렌더러 unload(beforeunload → projects:save-sync) → 창 소멸
         → window-all-closed → app.quit() → before-quit «창 0개»
     그런데 before-quit 은 첫 줄에서 창이 없으면 그냥 return 했다.
     ⇒ 위 runBeforeQuit 은 «한 번도 안 불린다». 저장이 EPERM 으로 실패해도
       다이얼로그 0 · 마커 없음 · 비상 사본 없음 = 조용한 유실(실측 260ms).
     ⇒ 맥도 «같은 줄»이다. ⌘Q 를 창이 열린 채 누르면 걸리지만,
       빨간 버튼으로 창을 닫고 나서 ⌘Q 하면 똑같이 창 0개로 온다.

   ★그래서 «두 조각»으로 나눈다 — 이 순간엔 둘을 같이 할 수 없기 때문이다.
     ㉮ 남기기: 동기 저장이 실패한 «바로 그 자리»(메인이 EPERM 을 쥔 자리)에서 기록한다.
        ⇒ 창이 닫히든 프로세스가 죽든 흔적은 이미 디스크에 있다. 새로고침 경로도 같이 덮인다.
     ㉯ 말하기: 뒤이어 오는 before-quit 이 그 기록을 «소비»해 다이얼로그를 띄운다.
        ⛔여기서도 동기 다이얼로그 금지 — 상한 타이머가 안 돌아 앱이 영영 안 꺼진다.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * 동기 저장(beforeunload) 실패를 «그 자리에서» 기록한다 — 마커 + 비상 사본.
 * ⛔여기서 다이얼로그를 띄우지 않는다: 이 함수는 렌더러의 unload 를 «막고» 도는 동기 IPC 안이다.
 * @param {{projectId:string, projectName?:string, snapshot:string, reason?:string, error?:string}} o
 * @returns {{outcome:object, saved:object}|null} 기록 결과(before-quit 이 소비한다)
 */
function recordSyncSaveFailure({ projectId, projectName, snapshot, reason, error } = {}) {
  if (!projectId) return null;              // 저장할 대상이 없으면 잃을 것도 없다
  const outcome = {
    ok: false,
    reason: typeof reason === 'string' && reason ? reason.slice(0, 64) : 'save-failed',
    error: typeof error === 'string' ? error.slice(0, 500) : null,
    projectId: String(projectId).slice(0, 128),
    projectName: typeof projectName === 'string' ? projectName.slice(0, 200) : null,
    snapshot: typeof snapshot === 'string' ? snapshot : null,
  };
  const saved = writeFailureRecord(outcome, Date.now());
  _log(`[quit-guard] 동기 저장 실패 기록(${outcome.reason}) — ` +
       `${saved.markerError ? `마커 실패(${saved.markerError})` : saved.markerPath}` +
       ` · 비상 사본 ${saved.record.emergencyPath || `없음(${saved.record.emergencyError})`}`);
  _pendingSync = { outcome, saved };
  return _pendingSync;
}

/** before-quit 이 «한 번만» 소비한다. 없으면 null — 그때는 옛 동작대로 즉시 종료해야 한다. */
function takePendingSyncFailure() { const p = _pendingSync; _pendingSync = null; return p; }
/** 소비하지 않고 들여다보기(검사·진단용). */
function peekPendingSyncFailure() { return _pendingSync; }

/**
 * 창이 없는 채로 온 before-quit — 이미 남긴 기록을 «말하고» 종료한다.
 * ★반드시 exit 가 불린다. 상한 두 겹(notifyMs·hardExitMs)이 어느 경로로 새도 앱을 꺼준다.
 * @param {{pending:object, exit:function, timings?:object}} o
 */
function notifyWindowGone({ pending, exit, timings } = {}) {
  const bail = () => { try { exit(0); } catch (_) {} };
  if (!pending || !pending.outcome) { bail(); return null; }
  if (_running && !_running.exited) return _running;   // 두 번째 before-quit 은 무시
  const t = { ...TIMINGS, ...(timings || {}) };
  const started = Date.now();
  const state = {
    startedAt: started, settled: true, exited: false,
    outcome: pending.outcome, saved: pending.saved,
    exitReason: null, exitCode: null, dialog: null, timers: [], windowGone: true,
  };
  _running = state;
  const arm = (fn, ms) => { const h = setTimeout(fn, ms); state.timers.push(h); return h; };
  const finish = (code, why) => {
    if (state.exited) return;
    state.exited = true;
    state.exitReason = why; state.exitCode = code;
    for (const h of state.timers) { try { clearTimeout(h); } catch (_) {} }
    _log(`[quit-guard] 종료(창 없음/${why}) — ${Date.now() - started}ms`);
    try { exit(code); } catch (e) { _log(`[quit-guard] exit 실패: ${e && e.message}`); }
  };
  arm(() => finish(0, 'hard-deadline'), t.hardExitMs);
  arm(() => finish(0, 'notify-deadline'), t.notifyMs);
  /* ★부모 창이 «없다» — 부모 없는 다이얼로그로 띄운다(윈도우·맥 모두 독립 창으로 뜬다). */
  showFailureDialog(null, state.outcome, state.saved).then((d) => {
    state.dialog = d;
    finish(0, d && d.shown ? 'dialog-dismissed' : 'no-dialog');
  });
  return state;
}

/** 다음 실행이 읽을 «흔적». H3(복구 다이얼로그)이 이 함수를 쓴다 — 여기서 UI 를 만들지 않는다. */
function pendingFailures() {
  return readMarker().filter((r) => r && !r.handled);
}

module.exports = {
  init, runBeforeQuit, pendingFailures,
  // 검사·도구용
  classify, writeFailureRecord, failureText, readMarker, markerPath, emergencyDir,
  TIMINGS, MAX_RECORDS, MAX_EMERGENCY_FILES,
  recordSyncSaveFailure, takePendingSyncFailure, peekPendingSyncFailure, notifyWindowGone,
  _reset() { _running = null; _pendingSync = null; },
};
