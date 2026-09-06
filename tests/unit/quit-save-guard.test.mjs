/* U-H4 — 종료 시 저장 실패의 «조용한 종료» 금지.
 *   실행: node --test "tests/unit/*.test.mjs"
 *
 * ★고치기 «전»의 사실(실측)
 *   main.js  : quit-ready 가 오면 app.exit(0) · 3초 뒤에도 app.exit(0). «성공·실패 구분 없음».
 *   렌더러   : 저장이 실패해도 quitReady() 를 그대로 보냈다 —
 *              게다가 saveProjectToFile 은 «던지지 않는다»({ok:false} 를 «반환»한다).
 *              옛 핸들러는 try/catch 만 봤으므로 저장 거부·EACCES 를 «한 건도» 못 봤다.
 *   ⇒ 사용자는 통지 0건, 다음 실행에 남는 흔적 0건. 그게 이 단위가 없애려는 것 전부다.
 *
 * ★이 파일이 «막는» 것 — 되돌리면 빨개지는 자리(변이로 확인함, 보고 참조)
 *   ⑴ 실패를 성공처럼 답하는 렌더러          → B3·B4·D3
 *   ⑵ 「모르겠다」를 성공으로 접는 메인       → A2·D4
 *   ⑶ 실패를 «말하지 않고» 죽는 종료          → C2·D3
 *   ⑷ ★말하려다 «안 죽는» 종료(행)            → C3·C5  ← 이 단위에서 가장 위험한 회귀
 *   ⑸ 보호성 스킵(빈 캔버스)을 실패로 오인    → B2 (골 C4 양성대조)
 *
 * ⛔현빈 기계의 실제 userData 는 건드리지 않는다 — 전부 임시 디렉터리다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { openSource } from '../../tools/hardening/lib/loadcheck.mjs';
import { denyWrite } from '../../tools/hardening/lib/denywrite.cjs';   // ★POSIX chmod / 윈도우 icacls

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const require_ = createRequire(import.meta.url);
const { mkTmpRoot } = require_('./_tmproot.js');

const guard = require_('../../main/quit/save-guard.js');

/* 상한 세 겹을 «작게» 줄여 쓴다 — 재는 것은 «순서와 상한»이지 초 단위가 아니다. */
const FAST = { saveWaitMs: 60, notifyMs: 120, hardExitMs: 300 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 상한 있는 대기 — ⛔조건 대기에 상한이 없으면 이 파일 자체가 «행»이 된다. */
async function until(fn, { timeout = 3000, interval = 10, label = '조건' } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return true; await sleep(interval); }
  throw new Error(`대기 상한 초과: ${label}`);
}

/** 가짜 판 하나 — win·ipcMain·exit·dialog 를 손에 쥐고 «진짜» 가드를 돌린다. */
function rig({ userData, dialogImpl, sendThrows = false } = {}) {
  const ud = userData || mkTmpRoot('h4-guard-');
  const exits = [];
  const logs = [];
  const dialogCalls = [];
  const sends = [];
  let ipcHandler = null;
  const dialog = {
    showMessageBox: (win, opts) => {
      dialogCalls.push({ win, opts });
      return dialogImpl ? dialogImpl(opts) : Promise.resolve({ response: 0 });
    },
  };
  const win = { webContents: { send: (ch) => { if (sendThrows) throw new Error('renderer gone'); sends.push(ch); } } };
  const ipcMain = { once: (ch, fn) => { if (ch === 'quit-ready') ipcHandler = fn; } };
  guard._reset();
  guard.init({ userDataDir: ud, dialog, shell: null, appVersion: 'test', log: (m) => logs.push(m) });
  return {
    ud, exits, logs, dialogCalls, sends,
    reply: (payload) => ipcHandler && ipcHandler({}, payload),
    run: (timings) => guard.runBeforeQuit({ win, ipcMain, exit: (c) => exits.push(c), timings: { ...FAST, ...(timings || {}) } }),
    marker: () => { try { return JSON.parse(fs.readFileSync(path.join(ud, 'quit-save-failure.json'), 'utf8')); } catch (_) { return null; } },
    emergencyFiles: () => { try { return fs.readdirSync(path.join(ud, 'emergency-saves')); } catch (_) { return []; } },
  };
}

/* ══ A. 메인 쪽 판정 — «명시적인 성공»만 성공이다 ══════════════════════════ */
test('U-H4-A1 저장 성공은 성공이다', () => {
  assert.equal(guard.classify({ ok: true, reason: 'saved' }).ok, true);
});

test('U-H4-A2 ★「결과가 없다」를 성공으로 접지 않는다 (옛 preload = 인자 없는 quitReady)', () => {
  for (const p of [undefined, null, 'ok', 0]) {
    const c = guard.classify(p);
    assert.equal(c.ok, false, `${JSON.stringify(p)} 를 성공으로 읽었다 — 조용한 종료가 여기서 다시 태어난다`);
    assert.equal(c.reason, 'no-result');
  }
});

test('U-H4-A3 실패 결과는 실패다 — 이유·원인·스냅샷이 살아 넘어온다', () => {
  const c = guard.classify({ ok: false, reason: 'exception', error: 'EACCES', projectId: 'proj_1', snapshot: '{"a":1}' });
  assert.equal(c.ok, false);
  assert.equal(c.reason, 'exception');
  assert.equal(c.error, 'EACCES');
  assert.equal(c.snapshot, '{"a":1}');
});

test('U-H4-A4 렌더러가 준 값은 «남의 데이터»다 — 타입이 다르면 안 받는다', () => {
  const c = guard.classify({ ok: false, projectId: { evil: 1 }, snapshot: 12345, reason: 'x'.repeat(500) });
  assert.equal(c.projectId, null);
  assert.equal(c.snapshot, null);
  assert.ok(c.reason.length <= 64);
});

/* ══ B. 렌더러 쪽 판정 — 제품 «원문»을 잘라 그대로 돌린다 ══════════════════
   ⛔「이렇게 생겼을 것이다」를 다시 쓰지 않는다. 다시 쓰면 제품이 바뀔 때 조용히 갈라진다. */
const RENDER_HEAD = 'function _quitSaveOutcome(result) {';
function loadRendererOutcome() {
  const S = openSource(path.join(ROOT, 'js/io/save-load.js'));
  const body = S.slice(RENDER_HEAD);
  const missing = S.missing(body, ['_quitSaveOutcome']);
  return { fn: new Function(`${body}\nreturn _quitSaveOutcome;`)(), missing, body };
}

test('U-H4-B0 렌더러 판정을 «원문 그대로» 실을 수 있다 (안 실은 의존 0)', () => {
  const { missing } = loadRendererOutcome();
  assert.deepEqual(missing, [], `잘라 쓴 함수가 부르는데 «안 실은» 선언: ${missing.join(', ')}`);
});

test('U-H4-B1 ok:true 는 성공', () => {
  assert.equal(loadRendererOutcome().fn({ ok: true }).ok, true);
});

test('U-H4-B2 ★[골 C4 양성대조] 빈 캔버스 «보호성 스킵»은 실패가 아니다 (다이얼로그가 뜨면 안 된다)', () => {
  const o = loadRendererOutcome().fn({ ok: false, skipped: true, reason: 'empty_canvas_skipped' });
  assert.equal(o.ok, true, '보호성 스킵을 실패로 읽으면 정상 종료마다 경고가 뜬다');
});

test('U-H4-B3 ★저장 «거부·예외»는 실패다 — 옛 코드가 한 건도 못 보던 자리', () => {
  /* saveProjectToFile 은 던지지 않고 {ok:false} 를 «반환»한다. 옛 핸들러는 try/catch 만 봤다. */
  for (const r of [{ ok: false, reason: 'exception', error: 'EACCES' }, { ok: false, reason: 'rejected' }, { ok: false, reason: 'quota' }]) {
    const o = loadRendererOutcome().fn(r);
    assert.equal(o.ok, false, `${r.reason} 을 성공으로 읽었다`);
  }
});

test('U-H4-B4 ★undefined(=다른 저장 중이라 큐잉됨)는 «미확정»이지 성공이 아니다', () => {
  const o = loadRendererOutcome().fn(undefined);
  assert.equal(o.ok, false);
  assert.equal(o.reason, 'unconfirmed');
});

/* ── ★큐잉된 저장의 «결과»를 읽는 자리 — 실기가 «가짜 성공»을 잡은 그 자리 ──
   2026-09-06 deny-write 실기 1차: 저장이 EACCES 로 실패했는데 종료 로그가 「저장 확인됨(saved)」.
   원인은 「큐가 빠졌으니 저장됐겠지」였다. 그 추측을 검사로 못 하게 막는다. */
const QUEUED_HEAD = 'function _quitSaveResolveQueued(isSaving, pendingHas, last, queuedAt) {';
function loadResolveQueued() {
  const S = openSource(path.join(ROOT, 'js/io/save-load.js'));
  const body = S.slice(QUEUED_HEAD);
  const missing = S.missing(body, ['_quitSaveResolveQueued']);
  assert.deepEqual(missing, [], `안 실은 선언: ${missing.join(', ')}`);
  return new Function(`${body}\nreturn _quitSaveResolveQueued;`)();
}

test('U-H4-B5 ★★「큐가 빠졌다」를 «성공»으로 읽지 않는다 (실기가 잡은 가짜 초록)', () => {
  const f = loadResolveQueued();
  const t0 = 1000;
  assert.deepEqual(f(false, false, { at: t0 + 5, result: { ok: false, reason: 'exception' } }, t0),
    { ok: false, reason: 'exception' }, '드레인된 저장이 «실패»했는데 그 결과를 안 읽었다');
  assert.equal(f(false, false, { at: t0 + 5, result: { ok: true } }, t0).ok, true, '진짜 성공은 성공이다');
  assert.equal(f(true, false, { at: t0 + 5, result: { ok: true } }, t0), undefined, '아직 저장 중인데 확정했다');
  assert.equal(f(false, true, { at: t0 + 5, result: { ok: true } }, t0), undefined, '큐가 남았는데 확정했다');
  assert.equal(f(false, false, { at: t0 - 5, result: { ok: true } }, t0), undefined,
    '★큐에 넣기 «전»의 옛 성공 기록을 지금 것으로 읽었다');
  assert.equal(f(false, false, null, t0), undefined, '기록이 없는데 확정했다');
});

/* ══ C. 종료 절차 — 상한·기록·통지 ════════════════════════════════════════ */
test('U-H4-C1 성공하면 조용히 꺼진다 — 다이얼로그 0 · 마커 0 (불필요한 안내를 만들지 않는다)', async () => {
  const R = rig();
  R.run();
  R.reply({ ok: true, reason: 'saved' });
  await until(() => R.exits.length === 1, { label: 'exit' });
  assert.deepEqual(R.exits, [0]);
  assert.equal(R.dialogCalls.length, 0);
  assert.equal(R.marker(), null);
});

test('U-H4-C2 ★실패하면 «말하고» 흔적을 남기고 죽는다', async () => {
  const R = rig();
  const snap = JSON.stringify({ pages: [{ canvas: '<div>작업물</div>' }] });
  R.run();
  R.reply({ ok: false, reason: 'exception', error: 'EACCES: permission denied', projectId: 'proj_9', projectName: '내 상세페이지', snapshot: snap });
  await until(() => R.exits.length === 1, { label: 'exit' });

  assert.equal(R.dialogCalls.length, 1, '저장이 실패했는데 «아무 말도 없이» 죽었다');
  const d = R.dialogCalls[0].opts;
  assert.match(d.message + d.detail, /내 상세페이지/);
  assert.match(d.detail, /EACCES/);

  const m = R.marker();
  assert.ok(m && m.records && m.records[0], '다음 실행이 읽을 «흔적»이 없다');
  assert.equal(m.records[0].reason, 'exception');
  assert.equal(m.records[0].projectId, 'proj_9');
  assert.equal(m.records[0].handled, false);
  const copy = m.records[0].emergencyPath;
  assert.ok(copy && fs.existsSync(copy), '비상 사본이 없다 — 흔적만 있고 되살릴 것이 없다');
  assert.equal(fs.readFileSync(copy, 'utf8'), snap, '비상 사본 내용이 스냅샷과 다르다(복구 불가)');
  assert.match(d.detail, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '사본 위치를 사용자에게 안 알려준다');
});

test('U-H4-C3 ★★사용자가 다이얼로그를 «영영 안 닫아도» 앱은 꺼진다 (행 금지)', async () => {
  /* 이 단위에서 가장 위험한 회귀. 「말하고 죽는다」가 「말하다가 안 죽는다」가 되면 반려다. */
  const R = rig({ dialogImpl: () => new Promise(() => {}) });   // 영원히 안 닫히는 다이얼로그
  R.run();
  R.reply({ ok: false, reason: 'exception', snapshot: '{}' });
  await until(() => R.exits.length === 1, { timeout: 2000, label: '알림 상한 뒤 exit' });
  assert.deepEqual(R.exits, [0]);
  const took = R.logs.join('\n');
  assert.match(took, /notify-deadline/, '알림 상한이 아니라 다른 경로로 꺼졌다');
});

test('U-H4-C4 ★렌더러가 아예 답을 안 해도 «말하고» 죽는다 (옛 코드는 조용히 죽었다)', async () => {
  const R = rig();
  R.run();                       // reply 를 «안» 한다 = 렌더러 무응답/고착
  await until(() => R.exits.length === 1, { timeout: 2000, label: 'no-response 뒤 exit' });
  assert.equal(R.dialogCalls.length, 1, '무응답으로 죽는데 아무 말도 안 했다');
  assert.equal(R.marker().records[0].reason, 'no-response');
});

test('U-H4-C5 ★맨 바깥 상한 — 알림 상한이 «고장나도» 앱은 꺼진다', async () => {
  /* notifyMs 를 hardExitMs 보다 크게 줘서 «알림 상한이 없는 것과 같은» 상태를 만든다. */
  const R = rig({ dialogImpl: () => new Promise(() => {}) });
  R.run({ notifyMs: 60000, hardExitMs: 250 });
  R.reply({ ok: false, reason: 'exception', snapshot: '{}' });
  await until(() => R.exits.length === 1, { timeout: 3000, label: 'hard-deadline' });
  assert.match(R.logs.join('\n'), /hard-deadline/);
});

test('U-H4-C6 렌더러가 이미 죽어 요청조차 못 보내면 3초를 헛기다리지 않는다', async () => {
  const R = rig({ sendThrows: true });
  const t0 = Date.now();
  R.run({ saveWaitMs: 5000 });
  await until(() => R.exits.length === 1, { timeout: 2000, label: 'send-failed' });
  assert.ok(Date.now() - t0 < 1500, '보내지도 못했는데 응답 상한을 다 기다렸다');
  assert.equal(R.marker().records[0].reason, 'send-failed');
});

test('U-H4-C7 before-quit 이 두 번 와도 exit 는 한 번이다', async () => {
  const R = rig();
  R.run(); R.run();
  R.reply({ ok: true });
  await sleep(200);
  assert.deepEqual(R.exits, [0]);
});

test('U-H4-C8 ★userData 를 통째로 못 써도 «던지지 않고» 알리고 죽는다 (deny-write 축소판)', async () => {
  const ud = mkTmpRoot('h4-denied-');
  /* ★denyWrite 가 «써 봐서» 정말 막혔는지 확인하고, 못 막으면 소리내어 던진다.
     (윈도우에서 chmod 는 디렉터리에 아무 효과가 없다 — 거기선 icacls /deny 를 쓴다.) */
  const guard = denyWrite(ud);
  try {
    const R = rig({ userData: ud });
    R.run();
    R.reply({ ok: false, reason: 'exception', error: 'EACCES', projectId: 'p', snapshot: '{"a":1}' });
    await until(() => R.exits.length === 1, { timeout: 2000, label: 'exit(쓰기 거부)' });
    assert.equal(R.dialogCalls.length, 1);
    assert.match(R.dialogCalls[0].opts.detail, /비상 사본도 만들지 못했습니다/,
      '사본을 못 만들었는데 만든 것처럼 말했다 — 안심시키는 문장이 경고 부재보다 나쁘다');
  } finally { guard.restore(); }
});

test('U-H4-C9 렌더러가 준 projectId 로 «폴더 밖»에 쓰지 않는다', async () => {
  const R = rig();
  R.run();
  R.reply({ ok: false, reason: 'exception', projectId: '../../../../tmp/evil', snapshot: '{}' });
  await until(() => R.exits.length === 1, { label: 'exit' });
  const p = R.marker().records[0].emergencyPath;
  assert.equal(path.dirname(p), path.join(R.ud, 'emergency-saves'), `사본이 폴더 밖에 쓰였다: ${p}`);
});

test('U-H4-C10 사본·기록이 무한히 쌓이지 않는다', async () => {
  const R = rig();
  for (let i = 0; i < 7; i++) {
    guard._reset();
    R.run();
    R.reply({ ok: false, reason: 'exception', projectId: `p${i}`, snapshot: `{"i":${i}}` });
    await until(() => R.exits.length === i + 1, { label: `exit#${i}` });
    await sleep(5);   // mtime 이 같은 밀리초로 뭉치지 않게
  }
  assert.equal(R.emergencyFiles().length, guard.MAX_EMERGENCY_FILES);
  assert.equal(R.marker().records.length, Math.min(7, guard.MAX_RECORDS));
});

/* ══ D. 실기 배선 — main.js 의 «진짜» before-quit 핸들러를 그대로 돌린다 ════
   ⛔흉내낸 종료는 배선 오류(채널 오타·인자 모양)를 못 잡는다. 진짜 핸들러를 부른다. */
const { loadMain } = require_('./_ipc-harness.js');
const H = loadMain();
const beforeQuit = H.appHandlers.get('before-quit');
const fakeWin = { isDestroyed: () => false, webContents: { send: (ch) => H.sent.push({ ch }) } };
H.stub.BrowserWindow.getAllWindows = () => [fakeWin];
function realQuit(payload, { reply = true } = {}) {
  guard._reset();
  H.exits.length = 0;
  let prevented = false;
  beforeQuit({ preventDefault: () => { prevented = true; } });
  if (reply) H.invokeSync('quit-ready', {}, payload);
  return { prevented };
}

test('U-H4-D1 before-quit 이 «진짜로» 저장 요청을 쏘고 종료를 붙잡는다', () => {
  const before = H.sent.length;
  const { prevented } = realQuit({ ok: true });
  assert.equal(prevented, true);
  assert.ok(H.sent.slice(before).some((s) => s.ch === 'force-save-before-quit'));
});

test('U-H4-D2 성공하면 마커 없이 꺼진다', async () => {
  realQuit({ ok: true, reason: 'saved' });
  await until(() => H.exits.length === 1, { label: 'exit' });
  const p = path.join(H.userData, 'quit-save-failure.json');
  const before = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).records.length : 0;
  assert.equal(before, 0, '성공했는데 실패 기록을 남겼다');
});

test('U-H4-D3 ★★실패하면 «실기 경로»에서도 흔적이 남는다 — 옛 코드였다면 그냥 죽었을 자리', async () => {
  const snap = '{"pages":[{"canvas":"<b>x</b>"}]}';
  realQuit({ ok: false, reason: 'exception', error: 'EACCES', projectId: 'proj_real', projectName: '실기', snapshot: snap });
  await until(() => H.exits.length === 1, { timeout: 5000, label: 'exit' });
  const m = JSON.parse(fs.readFileSync(path.join(H.userData, 'quit-save-failure.json'), 'utf8'));
  assert.equal(m.records[0].projectId, 'proj_real');
  assert.equal(fs.readFileSync(m.records[0].emergencyPath, 'utf8'), snap);
});

test('U-H4-D4 ★옛 preload(인자 없는 quitReady) 도 실패로 기록된다', async () => {
  realQuit(undefined);
  await until(() => H.exits.length === 1, { timeout: 5000, label: 'exit' });
  const m = JSON.parse(fs.readFileSync(path.join(H.userData, 'quit-save-failure.json'), 'utf8'));
  assert.equal(m.records[0].reason, 'no-result');
});

/* ══ E. preload 배선 — 「결과를 실어 보내는가」 ═════════════════════════════ */
test('U-H4-E1 preload 의 quitReady 가 «결과를» 실어 보낸다', () => {
  /* ★preload 를 «진짜로» 적재한다 — 렌더러가 보게 될 window.electronAPI 그 자체를 잡는다
     (본보기: tests/unit/history-preload-bridge.test.js). main.js 적재로 electron 스텁이
     require.cache 에 이미 올라와 있으니, 거기에 contextBridge/ipcRenderer 만 덧붙인다. */
  const stub = require_.cache['electron'].exports;
  const sent = [];
  let API = null;
  stub.contextBridge = { exposeInMainWorld: (_n, api) => { API = api; } };
  stub.ipcRenderer = { invoke: () => Promise.resolve(null), send: (ch, ...a) => sent.push({ ch, a }), sendSync: () => ({ ok: true }), on: () => {}, removeListener: () => {} };
  require_(path.join(ROOT, 'preload.js'));
  assert.ok(API && typeof API.quitReady === 'function');
  API.quitReady({ ok: false, reason: 'exception' });
  assert.deepEqual(sent[sent.length - 1], { ch: 'quit-ready', a: [{ ok: false, reason: 'exception' }] },
    'preload 가 결과를 «떨어뜨린다» — 메인은 영원히 「모르겠다」만 받는다');
});
