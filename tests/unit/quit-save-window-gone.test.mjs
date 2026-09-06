/* U-W3 — ★창이 «이미 사라진 뒤»의 종료에서도 저장 실패를 말하고 남긴다 (W-3)
 *
 * ★무엇이 구멍이었나 (미니4호기 윈도우 실기 QA 2차, SHA 6dc2385, §5-3ⓐ)
 *   윈도우 X 버튼(WM_CLOSE) 은 이 순서로 간다:
 *     창 close → 렌더러 unload(beforeunload 동기 저장) → 창 소멸
 *       → window-all-closed → app.quit() → **before-quit (창 0개)**
 *   그런데 before-quit 은 첫 줄에서 `if (!win) return;` 한다.
 *   ⇒ H4 가드는 «한 번도 안 불린다». 저장이 EPERM 으로 실패해도
 *     다이얼로그 0 · 토스트 0 · quit-save-failure.json 없음 · emergency-saves 없음.
 *     실측: 창 소멸 260ms, 편집 토큰 디스크 0건 = 유실.
 *   ⇒ 맥도 «같은 줄»이다 — 빨간 버튼으로 창을 닫고 나서 ⌘Q 하면 똑같이 창 0개로 온다.
 *     (⌘Q 를 창이 «열린 채» 누른 경우만 기존 H4 가 걸렸다.)
 *
 * ★이 검사가 재는 것 = «디스크에 무엇이 남았나». 「가드가 불렸다」가 아니다.
 *   ⛔소스 정규식 없음 — 진짜 main.js 를 적재해 진짜 IPC·진짜 before-quit 을 부른다.
 *
 * ★변이(배선을 지우면 빨강인가)
 *   ㉮ main.js 의 save-sync catch 에서 recordSyncSaveFailure 호출을 지운다 → U-W3-1·2 빨강
 *   ㉯ main.js before-quit 의 창-없음 분기를 옛 `return` 으로 되돌린다 → U-W3-1·2·3 빨강
 *   ㉰ save-guard 의 notifyWindowGone 을 no-op 으로 만든다 → U-W3-3 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadMain } = require('./_ipc-harness.js');
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '../..');
const saveGuard = require(path.join(ROOT, 'main/quit/save-guard'));

/* ⚠️main.js 는 «프로세스당 한 번만» 적재된다(모듈 싱글턴) — loadMain 을 두 번 부르면
   두 번째부터는 IPC 핸들러가 하나도 안 붙는다. ⇒ 파일당 하네스 하나 + 시험마다 «상태만» 씻는다. */
const H = loadMain();
const TOKEN = 'QA-W3-QUIT-9002';

function reset() {
  try { fs.rmSync(path.join(H.userData, 'quit-save-failure.json'), { force: true }); } catch (_) {}
  try { fs.rmSync(path.join(H.userData, 'emergency-saves'), { recursive: true, force: true }); } catch (_) {}
  try { saveGuard._reset(); } catch (_) {}
  H.exits.length = 0;
  H.stub.BrowserWindow.getAllWindows = () => [];      // ★X 버튼 경로 = 창 0개
  return recordDialogs();
}

/** 쓰기가 «진짜로» 거부되는 프로젝트 폴더를 만든다(윈도우 icacls /deny 의 맥 대응물). */
function denyWrite(projectId) {
  const dir = path.join(H.projectsDir, projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.chmodSync(dir, 0o555);
  return dir;
}
function undeny(dir) { try { fs.chmodSync(dir, 0o755); } catch (_) {} }

function projectWithToken(id) {
  return {
    id, name: 'W3 종료저장',
    pages: [{ id: 'p1', html: `<div class="section-block">${TOKEN}</div>` }],
  };
}

/** dialog.showMessageBox 를 «기록형»으로 갈아끼운다 — 하네스 기본 스텁은 안 세어 준다. */
function recordDialogs() {
  const calls = [];
  H.stub.dialog.showMessageBox = async (win, opts) => { calls.push({ win, opts }); return { response: 0 }; };
  return calls;
}

/** before-quit 을 «진짜로» 부른다. */
function fireBeforeQuit() {
  const fn = H.appHandlers.get('before-quit');
  assert.ok(typeof fn === 'function', 'before-quit 핸들러가 등록조차 안 됐다');
  let prevented = false;
  fn({ preventDefault: () => { prevented = true; } });
  return { prevented };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('U-W3-1 ★저장 실패 뒤 창이 사라진 채 종료해도 «마커가 디스크에 남는다»', async () => {
  reset();
  const pid = 'proj_w3_marker';
  const dir = denyWrite(pid);
  try {
    const r = H.invokeSync('projects:save-sync', {}, projectWithToken(pid));
    assert.equal(r && r.ok, false, '전제 실패: 쓰기 거부인데 save-sync 가 성공했다');

    fireBeforeQuit();
    await wait(200);

    const marker = path.join(H.userData, 'quit-save-failure.json');
    assert.ok(fs.existsSync(marker), `⛔마커가 «없다» — ${marker} (조용한 유실)`);
    const j = JSON.parse(fs.readFileSync(marker, 'utf8'));
    assert.ok(Array.isArray(j.records) && j.records.length >= 1, '마커에 기록이 없다');
    assert.equal(j.records[0].projectId, pid, '어느 프로젝트였는지 안 적혔다');
    assert.equal(j.records[0].handled, false, 'H3 가 읽을 수 있게 handled=false 여야 한다');
  } finally { undeny(dir); }
});

test('U-W3-2 ★편집 «내용»이 emergency-saves 에 실제로 들어간다 (토큰으로 확인)', async () => {
  reset();
  const pid = 'proj_w3_copy';
  const dir = denyWrite(pid);
  try {
    H.invokeSync('projects:save-sync', {}, projectWithToken(pid));
    fireBeforeQuit();
    await wait(200);

    const em = path.join(H.userData, 'emergency-saves');
    assert.ok(fs.existsSync(em), `⛔emergency-saves/ 가 «없다» — ${em}`);
    const files = fs.readdirSync(em).filter((n) => n.endsWith('.json'));
    assert.ok(files.length >= 1, 'emergency-saves/ 가 비었다');
    const body = fs.readFileSync(path.join(em, files[0]), 'utf8');
    assert.ok(body.includes(TOKEN), `⛔사본에 편집 토큰(${TOKEN})이 없다 = 유실`);
  } finally { undeny(dir); }
});

test('U-W3-3 ★사용자에게 «말한다» — 다이얼로그가 실제로 뜨고, 그러고도 «꺼진다»', async () => {
  const calls = reset();
  const pid = 'proj_w3_dialog';
  const dir = denyWrite(pid);
  try {
    H.invokeSync('projects:save-sync', {}, projectWithToken(pid));
    const { prevented } = fireBeforeQuit();
    assert.equal(prevented, true, '⛔종료를 잡지도 않았다 — 말할 틈이 없다');
    await wait(200);

    assert.equal(calls.length, 1, `⛔다이얼로그 ${calls.length}건 — 조용히 죽었다`);
    const t = String(calls[0].opts.message) + String(calls[0].opts.detail);
    assert.ok(/저장/.test(t), '문구가 저장 실패를 말하지 않는다: ' + t);
    assert.ok(H.exits.length >= 1, '⛔안 꺼졌다 — 안 꺼지는 앱은 조용한 종료보다 나쁘다');
  } finally { undeny(dir); }
});

test('U-W3-4 ★양성대조: 저장이 «성공»했으면 아무것도 안 남기고 바로 꺼진다', async () => {
  const calls = reset();
  const r = H.invokeSync('projects:save-sync', {}, projectWithToken('proj_w3_ok'));
  assert.equal(r && r.ok, true, '전제 실패: 정상 저장이 실패했다: ' + JSON.stringify(r));

  const { prevented } = fireBeforeQuit();
  await wait(200);

  assert.equal(fs.existsSync(path.join(H.userData, 'quit-save-failure.json')), false,
    '⛔성공했는데 실패 마커를 남겼다(오탐)');
  assert.equal(calls.length, 0, '⛔성공했는데 다이얼로그를 띄웠다(오탐)');
  assert.equal(prevented, false, '⛔실패도 없는데 종료를 붙잡았다 — 종료가 느려진다');
});

test('U-W3-5 ★회귀: 창이 «살아 있으면» 기존 H4 경로 그대로 (force-save-before-quit 발신)', async () => {
  reset();
  const sentCh = [];
  const fakeWin = { isDestroyed: () => false, webContents: { send: (ch) => sentCh.push(ch) } };
  H.stub.BrowserWindow.getAllWindows = () => [fakeWin];
  try {
    const { prevented } = fireBeforeQuit();
    assert.equal(prevented, true, '창이 있으면 종료를 잡아 저장을 기다려야 한다');
    assert.ok(sentCh.includes('force-save-before-quit'), '⛔기존 H4 경로가 끊겼다: ' + sentCh.join(','));
  } finally { H.stub.BrowserWindow.getAllWindows = () => []; }
});

test('U-W3-6 ★다이얼로그가 «안 닫혀도» 앱은 꺼진다 (상한 타이머 — 안 꺼지는 앱 금지)', async () => {
  reset();
  // 영원히 안 끝나는 다이얼로그 = 사용자가 확인을 안 누른 상태
  H.stub.dialog.showMessageBox = () => new Promise(() => {});
  saveGuard.init({ userDataDir: H.userData, dialog: H.stub.dialog, appVersion: 'test' });
  const pending = saveGuard.recordSyncSaveFailure({
    projectId: 'proj_w3_hang', projectName: '멈춘 다이얼로그',
    snapshot: JSON.stringify({ id: 'proj_w3_hang', pages: [] }), reason: 'exception', error: 'EPERM',
  });
  const exits = [];
  const st = saveGuard.notifyWindowGone({
    pending, exit: (c) => exits.push(c), timings: { notifyMs: 60, hardExitMs: 200 },
  });
  await wait(220);
  assert.equal(exits.length, 1, `⛔exit ${exits.length}회 — 상한이 안 돌았거나 두 번 죽었다`);
  assert.ok(['notify-deadline', 'hard-deadline'].includes(st.exitReason), '상한이 아닌 이유로 꺼졌다: ' + st.exitReason);
});

test('U-W3-7 ★소비형 — 같은 실패로 두 번 말하지 않는다', () => {
  reset();
  saveGuard.init({ userDataDir: H.userData, appVersion: 'test' });
  saveGuard.recordSyncSaveFailure({
    projectId: 'proj_w3_once', snapshot: JSON.stringify({ id: 'proj_w3_once' }), reason: 'exception',
  });
  assert.ok(saveGuard.takePendingSyncFailure(), '첫 소비가 비었다');
  assert.equal(saveGuard.takePendingSyncFailure(), null, '⛔두 번째도 나온다 — 다음 종료 때 또 뜬다');
});
