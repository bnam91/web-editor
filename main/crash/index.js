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

/* ── 렌더러 사망 → 사람에게 안내 + 다시 불러오기 (RENDERER-GONE-BLANK-WINDOW-NO-RECOVERY-01, 2026-11-14) ──
   옛 판은 기록만 했다 — 창은 «빈 화면»으로 남고 사람은 무슨 일인지 모른다.
   ★다시 불러오기 = 그 창 reload. 렌더러가 이미 죽어 «지금 화면 내용»을 받아 낼 길은 없다(비상 사본은
     렌더러가 스냅샷을 줘야 생긴다). 남는 것은 자동 저장(편집 뒤 ≤1.5초 · js/io/save-load.js)이 디스크에
     쓴 판이고, reload 뒤 부팅의 복구 띠(recovery:pending)가 이 크래시 기록을 다시 보여 준다.
   ★짧은 시간(RELOAD_WINDOW_MS) 안 RELOAD_MAX 번 넘게 죽으면 다시 불러오기를 «안 권한다» — 무한 재시도 차단.
   ⛔showMessageBoxSync 금지 — 메인 루프를 막는다(main/quit/save-guard.js 와 같은 규율).
   ★숨은 창(QA_HIDDEN show:false)엔 대화상자를 안 띄운다 — 포커스를 뺏지 않는다(main.js QA_HIDDEN 헤더). */
const RELOAD_MAX = 2;
const RELOAD_WINDOW_MS = 60 * 1000;
const _goneAt = new Map();                // webContents.id → [사망 시각…] (reload 해도 id 는 같다)

function offerReload(wc, details, o) {
  const dialog = o.dialog;
  if (!wc || !dialog || typeof dialog.showMessageBox !== 'function') return null;
  if (typeof wc.isDestroyed === 'function' && wc.isDestroyed()) return null;   // 창이 닫히는 중
  const win = (o.BrowserWindow && typeof o.BrowserWindow.fromWebContents === 'function')
    ? o.BrowserWindow.fromWebContents(wc) : null;
  if (!win || (typeof win.isVisible === 'function' && !win.isVisible())) return null;

  const now = Date.now();
  const hist = (_goneAt.get(wc.id) || []).filter((t) => now - t < RELOAD_WINDOW_MS);
  hist.push(now);
  _goneAt.set(wc.id, hist);
  const canReload = hist.length <= RELOAD_MAX;
  try {
    recorder.appendMainLog('warn', `[renderer-gone] 안내 — wc=${wc.id} reason=${details && details.reason} ` +
      `${hist.length}번째/${RELOAD_WINDOW_MS / 1000}s · ${canReload ? 'reload 권함' : 'reload 상한 — 닫기만'}`);
  } catch (_) {}

  const detail = canReload
    ? '마지막 자동 저장 뒤 몇 초 사이의 편집은 사라졌을 수 있습니다.\n다시 불러오면 마지막으로 저장된 내용으로 엽니다.'
    : '짧은 시간에 여러 번 멈춰 다시 불러오기를 멈췄습니다.\n창을 닫고 앱을 다시 실행해 주세요. 마지막 자동 저장 뒤의 편집은 사라졌을 수 있습니다.';
  const buttons = canReload ? ['다시 불러오기', '닫기'] : ['닫기'];
  return Promise.resolve(dialog.showMessageBox(win, {
    type: 'warning', title: 'GODITOR', message: '화면이 멈췄습니다', detail,
    /* Enter = 다시 불러오기(기본 · 파란 단추). ★Esc 도 다시 불러오기(cancelId 0) — «닫기»는 메인 창이면 앱 종료라
       Esc 한 번에 앱이 꺼지지 않게 한다. 닫기는 단추를 눌러야만. 상한 뒤엔 단추가 닫기 하나라 둘 다 닫기. */
    buttons, defaultId: 0, cancelId: 0, noLink: true,
  })).then((r) => {
    if (typeof wc.isDestroyed === 'function' && wc.isDestroyed()) return 'gone';
    if (canReload && r && r.response === 0) { wc.reload(); return 'reload'; }
    try { win.close(); } catch (_) {}
    return 'close';
  }).catch(() => null);
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
 * @param {object} [o.dialog]    electron dialog — 렌더러 사망 안내(없으면 기록만)
 * @param {object} [o.BrowserWindow] electron BrowserWindow — 죽은 webContents 의 창 찾기
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
      /* 기록 «뒤»에 사람에게 말한다 — 안내가 실패해도 기록은 이미 남았다. */
      try { offerReload(webContents, details, opts); } catch (_) {}
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
  _goneAt.clear();
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
  RELOAD_MAX, RELOAD_WINDOW_MS,
};
