/* ══════════════════════════════════════════════════════════════════════════
   main/crash/index.js — 크래시·메인오류를 «듣는» 자리. (H2, 2026-09-06)
   ──────────────────────────────────────────────────────────────────────────
   ★main.js 는 이 파일을 «두 줄»로 부른다. 새 로직은 전부 여기 있다
     (오늘 여러 에이전트가 main.js 를 동시에 고치고 있어 충돌이 비쌌다).

   ★듣는 것 다섯
     ⑴ app 'render-process-gone'    렌더러가 죽었다 = 「앱이 갑자기 사라졌다」의 본체
     ⑵ app 'child-process-gone'     GPU·유틸리티 프로세스가 죽었다
     ⑶ process 'uncaughtException'  메인이 던졌다
     ⑷ process 'unhandledRejection' 메인의 미처리 거부
     ⑸ webContents 'unresponsive'   행(hang). ★세션당 창마다 «한 번만» 남긴다(아래 참조)

   ★★⑶⑷ 의 «처분»을 바꾸지 않는다 — 이 단위는 «기록»까지다
     이 자리에 리스너를 «새로» 다는 것은 Node/Electron 의 기본 처분을 «끄는» 일이다.
     기록하러 왔다가 제품 동작을 바꾸면 안 된다.
     실측(2026-09-06, Electron 41.8.0, 실기): 메인 top-level 에
       uncaughtException 리스너 1개 · unhandledRejection 0개.
     ⇒ ㉮ prependListener 로 «먼저» 듣는다 — 남의 리스너가 exit 하기 전에 기록을 끝낸다.
       ㉯ 우리가 붙기 «전»에 uncaughtException 리스너가 0개였다면(=우리가 기본을 끄게 되는
          경우에만) 기록 뒤에 그 기본을 재현한다(스택을 stderr 에 쓰고 exit 1).

   ★★⑷ 는 «내가 틀렸던 자리»다 — 추정으로 짓다가 실기가 뒤집었다 (2026-09-06)
     초판은 「unhandledRejection 엔 리스너를 안 단다. 0개면 Node 가 그걸 던져
     uncaughtException(origin='unhandledRejection') 으로 넘어오니 거기서 듣는다」였다.
     ⇒ ★실기로 진짜 거부를 냈더니 «기록이 0건»이었다. Electron 41 은 legacy 모드
       (--unhandled-rejections=warn)로 돈다 — 던지지 않고 stderr 경고만 찍는다.
       즉 그 설계는 「돌아는 가는데 효과가 0」이었다(이 프로젝트의 주된 실패 형태 그대로).
     ⇒ 지금은 리스너를 «단다». 처분(=프로세스가 계속 산다)은 그대로고, 대신 리스너가
       생기면 사라지는 «경고 한 줄»을 우리가 stderr 에 직접 써서 눈에 보이는 것도 유지한다.
     ⛔이 절을 「기본에 맡긴다」로 되돌리지 마라 — 그 순간 메인의 미처리 거부는 다시
       아무 데도 안 남는다. uncaughtException 쪽 origin 분기는 «다른 모드»(throw)로 도는
       Electron/Node 를 위해 그대로 둔다 — 두 자리가 겹쳐도 중복 억제가 잡는다.

   ★⑷ 를 «한 번만» 남기는 이유
     'unresponsive' 는 90MB 프로젝트 저장 같은 정상 작업에서도 뜬다. 그대로 남기면
     기록 20칸이 행(hang) 로 다 차서 «진짜 크래시»를 밀어낸다(상한이 최신을 지우진
     않지만, 최신이 전부 노이즈면 같은 손실이다).
══════════════════════════════════════════════════════════════════════════ */
'use strict';

const recorder = require('./recorder');

let _installed = false;
const _unresponsiveSeen = new Set();      // webContents.id — 세션당 한 번
let _restoreConsole = null;

/** details.reason 이 «정상 종료»인가. 정상 종료를 크래시로 적으면 기록이 노이즈가 된다. */
function isCleanExit(details) {
  return !!details && details.reason === 'clean-exit' && Number(details.exitCode || 0) === 0;
}

/** Error → 기록에 넣을 «한 덩어리». scrub 은 recorder 가 한다(여기선 모양만 만든다). */
function errText(err) {
  try {
    if (!err) return String(err);
    if (err.stack) return String(err.stack);
    return (err.name ? err.name + ': ' : '') + String(err.message || err);
  } catch (_) { return '[unprintable error]'; }
}

/* ── 메인 console 후킹 — warn/error 를 logs/main.log 로도 흘린다 ────────────
   ⚠️원본을 «먼저» 그대로 부른다. 우리 append 가 실패해도 터미널 출력은 그대로다.
   ⚠️append 안에서 console 을 다시 부르지 않는다(recorder 는 stderr.write 만 쓴다). */
function hookConsole(con) {
  const origWarn = con.warn, origError = con.error;
  if (typeof origWarn !== 'function' || typeof origError !== 'function') return null;
  const wrap = (orig, level) => function () {
    const r = orig.apply(con, arguments);
    try {
      const line = Array.prototype.map.call(arguments, (a) => {
        if (a instanceof Error) return errText(a);
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch (_) { return String(a); }
      }).join(' ');
      recorder.appendMainLog(level, line);
    } catch (_) { /* 여기서 던지면 로그 한 줄 때문에 앱이 죽는다 */ }
    return r;
  };
  con.warn = wrap(origWarn, 'warn');
  con.error = wrap(origError, 'error');
  return () => { con.warn = origWarn; con.error = origError; };
}

/**
 * 설치. ⛔두 번 불러도 한 번만 건다.
 * @param {object} o
 * @param {object} o.app         electron app
 * @param {object} [o.ipcMain]   electron ipcMain — 렌더러 링버퍼 미러를 받는다
 * @param {object} [o.proc]      기본 process (테스트에서 가짜를 넣는다)
 * @param {object} [o.console]   기본 globalThis.console
 * @param {Function} [o.getUserDataDir]  기본 () => app.getPath('userData')
 *        ★기본값을 «게으르게» 잡는다 — main.js 최상단에서 불려도 userData 이사
 *          (Goya Design Editor → GODITOR) 뒤의 경로가 잡힌다.
 */
function install(o) {
  const opts = o || {};
  const app = opts.app;
  if (_installed) return { installed: false, reason: 'already' };
  _installed = true;

  const proc = opts.proc || process;
  const con = opts.console || console;

  recorder.init({
    getUserDataDir: opts.getUserDataDir || (() => (app ? app.getPath('userData') : null)),
    appVersion: (() => { try { return app ? app.getVersion() : ''; } catch (_) { return ''; } })(),
  });

  const result = { installed: true, hooks: [], priorUncaught: proc.listenerCount('uncaughtException') };

  /* ⑴ 렌더러 사망 */
  if (app && typeof app.on === 'function') {
    app.on('render-process-gone', (_event, webContents, details) => {
      try {
        if (isCleanExit(details)) return;
        recorder.record('render-process-gone', {
          reason: details && details.reason,
          exitCode: details && details.exitCode,
          wcId: webContents && webContents.id,
        });
      } catch (_) {}
    });
    result.hooks.push('render-process-gone');

    /* ⑵ 자식 프로세스 사망(GPU·유틸리티) */
    app.on('child-process-gone', (_event, details) => {
      try {
        if (isCleanExit(details)) return;
        recorder.record('child-process-gone', {
          reason: details && details.reason,
          exitCode: details && details.exitCode,
          extra: {
            type: (details && details.type) || '',
            serviceName: (details && details.serviceName) || '',
            name: (details && details.name) || '',
          },
        });
      } catch (_) {}
    });
    result.hooks.push('child-process-gone');

    /* ⑷ 행(hang) — 창마다 세션당 한 번 */
    app.on('web-contents-created', (_e, wc) => {
      try {
        wc.on('unresponsive', () => {
          try {
            if (_unresponsiveSeen.has(wc.id)) return;
            _unresponsiveSeen.add(wc.id);
            recorder.record('unresponsive', { reason: 'renderer-unresponsive', wcId: wc.id });
          } catch (_) {}
        });
      } catch (_) {}
    });
    result.hooks.push('unresponsive');
  }

  /* ⑶ 메인 예외 — ★prepend. 남이 exit 하기 전에 기록을 끝낸다. */
  const onUncaught = (err, origin) => {
    try {
      const isRejection = origin === 'unhandledRejection';
      recorder.record(isRejection ? 'unhandled-rejection' : 'uncaught-exception', {
        reason: (err && err.message) ? String(err.message) : String(err),
        main: errText(err),
        extra: { origin: String(origin || 'uncaughtException') },
      });
    } catch (_) {}
    /* ㉯ 우리가 붙기 «전»에 아무도 안 듣고 있었다면, Node 기본 처분을 그대로 재현한다.
       (실측상 Electron 은 1개를 이미 달고 있어 이 가지는 안 탄다 — 그래도 남겨 둔다:
        Electron 이 바뀌면 「기록하러 와서 앱을 좀비로 만든」 게 된다.) */
    if (result.priorUncaught === 0) {
      try { proc.stderr.write(errText(err) + '\n'); } catch (_) {}
      try { proc.exit(1); } catch (_) {}
    }
  };
  if (typeof proc.prependListener === 'function') proc.prependListener('uncaughtException', onUncaught);
  else proc.on('uncaughtException', onUncaught);
  result.hooks.push('uncaughtException');

  /* ⑷ 미처리 거부 — ★리스너가 «없으면» Electron 41 은 경고만 찍고 만다(실기 확인).
     우리가 듣는 순간 그 경고가 사라지므로, 같은 정보를 stderr 에 직접 쓴다.
     ⛔여기서 exit 하지 않는다 — 지금 처분은 「계속 산다」이고, 그걸 바꾸는 건 이 단위 밖이다. */
  result.priorUnhandled = proc.listenerCount('unhandledRejection');
  const onRejection = (reason) => {
    try {
      recorder.record('unhandled-rejection', {
        reason: (reason && reason.message) ? String(reason.message) : String(reason),
        main: errText(reason),
        extra: { origin: 'unhandledRejection' },
      });
    } catch (_) {}
    if (result.priorUnhandled === 0) {
      try { proc.stderr.write('UnhandledPromiseRejection: ' + errText(reason) + '\n'); } catch (_) {}
    }
  };
  if (typeof proc.prependListener === 'function') proc.prependListener('unhandledRejection', onRejection);
  else proc.on('unhandledRejection', onRejection);
  result.hooks.push('unhandledRejection');

  /* 렌더러 링버퍼 미러 수신 */
  if (opts.ipcMain && typeof opts.ipcMain.on === 'function') {
    opts.ipcMain.on('crash:mirror', (event, payload) => {
      try { recorder.mirror(payload, event && event.sender ? event.sender.id : 0); } catch (_) {}
    });
    result.hooks.push('crash:mirror');
  }

  /* 메인 console.warn/error → logs/main.log */
  _restoreConsole = hookConsole(con);
  if (_restoreConsole) result.hooks.push('console');

  /* 부팅 한 줄 — 「이 실행이 여기까지는 왔다」. 다음 실행이 읽을 첫 흔적이다. */
  try {
    recorder.appendMainLog('boot', 'session start · v' + ((() => { try { return app ? app.getVersion() : '?'; } catch (_) { return '?'; } })()) +
      ' · ' + proc.platform + ' ' + proc.arch + ' · electron ' + ((proc.versions && proc.versions.electron) || '?'));
  } catch (_) {}

  result.stats = recorder.stats();
  return result;
}

/** 테스트 전용 — 다시 설치할 수 있게 되돌린다. */
function _resetForTest() {
  _installed = false;
  _unresponsiveSeen.clear();
  if (_restoreConsole) { try { _restoreConsole(); } catch (_) {} _restoreConsole = null; }
  recorder._resetForTest();
}

module.exports = {
  install,
  /* H3(신고 첨부)이 이어받는 «읽는 함수». ⛔읽기는 기록을 바꾸지 않는다. */
  readRecent: recorder.readRecent,
  stats: recorder.stats,
  record: recorder.record,
  appendMainLog: recorder.appendMainLog,
  _recorder: recorder,
  _resetForTest,
  _isCleanExit: isCleanExit,
};
