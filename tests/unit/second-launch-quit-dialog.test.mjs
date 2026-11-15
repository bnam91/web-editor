/* second-launch-quit-dialog — SECOND-LAUNCH-SILENT-EXIT-DURING-QUIT-DIALOG-01
 * 티켓(S6 2/2 · S8 4/4): 멈춘 편집 화면·렌더러 사망으로 종료 상자가 도는 동안 두 번째 실행이 ~0.5초에 rc 0 으로 끝난다 — 눌러도 아무것도 안 뜬다.
 * 원인(코드): 두 번째 실행은 설계대로 잠금을 못 얻고 exit(0)(main/gdt/wire.js) · 첫 실행의 second-instance 는 «첫 창»만 앞으로 낸다.
 *   창이 이미 없는 종료(부모 없는 상자)면 앞으로 낼 창이 없고, 상자 쪽으로 눈을 끄는 일(독 반짝)이 없다 ⇒ 사용자에게 안 보인다.
 * 자: 진짜 main.js(_ipc-harness) · 진짜 쓰기 거부 → 창 없는 종료의 저장 실패 상자(열린 채 둠) · 진짜 second-instance 처리기.
 *   «보였나» 의 기계 증거 = app.focus({steal}) + app.dock.bounce (맥) — 이 맥(darwin)에서만 단언한다.
 * 칸: S1 상자가 떠 있을 때 두 번째 실행 → 앱을 앞으로 + 독 반짝 · S2 [음성] 상자 없을 때(평소) 두 번째 실행 → 독 반짝 없음(지금 동작)
 *     S3 상자가 닫히면 다시 평소(반짝 없음)
 * 실행: node --test tests/unit/second-launch-quit-dialog.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { denyWrite as denyWriteDir } from '../../tools/hardening/lib/denywrite.cjs';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { loadMain } = require('./_ipc-harness.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const saveGuard = require(path.join(ROOT, 'main/quit/save-guard'));
const H = loadMain();
const MAC = process.platform === 'darwin';

let closeDialog = null;
function reset() {
  try { fs.rmSync(path.join(H.userData, 'quit-save-failure.json'), { force: true }); } catch (_) {}
  try { fs.rmSync(path.join(H.userData, 'emergency-saves'), { recursive: true, force: true }); } catch (_) {}
  try { saveGuard._reset(); } catch (_) {}
  H.exits.length = 0;
  H.stub.BrowserWindow.getAllWindows = () => [];
  const rec = { dialogs: 0, focus: [], bounce: [] };
  H.stub.dialog.showMessageBox = () => { rec.dialogs++; return new Promise((r) => { closeDialog = () => r({ response: 0 }); }); };   // 사람이 안 닫은 상자
  H.stub.app.focus = (o) => { rec.focus.push(o || null); };
  H.stub.app.dock = { ...(H.stub.app.dock || {}), bounce: (t) => { rec.bounce.push(t); return 1; } };
  return rec;
}
const _denied = new Map();
function denyWrite(id) { const dir = path.join(H.projectsDir, id); fs.mkdirSync(dir, { recursive: true }); _denied.set(dir, denyWriteDir(dir)); return dir; }
function undeny(dir) { const h = _denied.get(dir); if (h) { h.restore(); _denied.delete(dir); } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const proj = (id) => ({ id, name: '두 번째 실행', pages: [{ id: 'p1', html: '<div class="section-block">SL</div>' }] });
const secondLaunch = () => { const fn = H.appHandlers.get('second-instance'); assert.ok(typeof fn === 'function', '[전제] second-instance 처리기가 없다(단일 인스턴스 잠금 길을 안 탔다)'); fn({}, ['GODITOR']); };
async function quitWithDialog(rec, id) {
  const dir = denyWrite(id);
  try { H.invokeSync('projects:save-sync', {}, proj(id)); } finally { undeny(dir); }
  H.appHandlers.get('before-quit')({ preventDefault() {} });
  await wait(150);
  assert.equal(rec.dialogs, 1, '[전제] 종료 저장 실패 상자가 안 떴다');
}

test('S1 ★종료 상자가 떠 있을 때 두 번째 실행 — 앱을 앞으로 + 독 반짝(사용자에게 보인다)', { skip: !MAC && '독 반짝은 맥 길' }, async () => {
  const rec = reset();
  await quitWithDialog(rec, 'proj_sl1');
  rec.focus.length = 0;
  secondLaunch();
  assert.ok(rec.focus.some((o) => o && o.steal), '⛔앱을 앞으로 안 당겼다');
  assert.ok(rec.bounce.length >= 1, '⛔종료 상자가 떠 있는데 두 번째 실행에 아무 반응이 안 보인다(독 반짝 0)');
  closeDialog?.();
});

test('S2 [음성] 상자 없는 평소 — 두 번째 실행은 지금 동작(독 반짝 없음)', { skip: !MAC && '독 반짝은 맥 길' }, async () => {
  const rec = reset();
  secondLaunch();
  assert.equal(rec.bounce.length, 0, '평소에 독을 반짝였다');
});

test('S3 상자가 닫히면 다시 평소', { skip: !MAC && '독 반짝은 맥 길' }, async () => {
  const rec = reset();
  await quitWithDialog(rec, 'proj_sl3');
  closeDialog?.();
  await wait(50);
  rec.bounce.length = 0;
  secondLaunch();
  assert.equal(rec.bounce.length, 0, '상자가 닫혔는데 아직 떠 있는 것으로 셌다');
});

/* S4·S5 — def26 D1(실기기 4/4 ❌): 맥에서 부모 없는 상자는 «닫힐 때까지 showMessageBox 호출이 안 돌아온다»(중첩 모달 루프).
 *   위 S1 의 가짜 상자는 곧바로 Promise 를 돌려줘 이 꼴을 못 흉내 냈다 → 호출 «안»에서 second-instance 를 쏴 잰다.
 *   양성대조: save-guard.js 의 `_dialogOpen++` 를 showMessageBox 호출 «뒤»로 되돌리면 S4 빨강. */
test('S4 ★상자 호출이 아직 안 돌아온 동안(맥 중첩 모달) 두 번째 실행 — 떠 있는 것으로 센다 + 독 반짝', { skip: !MAC && '독 반짝은 맥 길' }, async () => {
  const rec = reset();
  const inside = {};
  H.stub.dialog.showMessageBox = () => {
    rec.dialogs++;
    inside.open = saveGuard.failureDialogOpen();
    secondLaunch();
    inside.bounce = rec.bounce.length;
    return Promise.resolve({ response: 0 });   // 사람이 닫은 뒤에야 돌아온다
  };
  await quitWithDialog(rec, 'proj_sl4');
  assert.equal(inside.open, true, '⛔상자 호출 안(떠 있는 동안)에 failureDialogOpen()=false — 두 번째 실행이 «상자 없음» 갈래로 간다');
  assert.ok(inside.bounce >= 1, '⛔상자가 떠 있는 동안 두 번째 실행에 독 반짝 0');
  assert.equal(saveGuard.failureDialogOpen(), false, '상자가 닫혔는데 아직 떠 있는 것으로 셌다');
});

test('S5 상자 호출이 던져도 카운터가 남지 않는다', async () => {
  const rec = reset();
  H.stub.dialog.showMessageBox = () => { rec.dialogs++; throw new Error('가짜 상자 실패'); };
  await quitWithDialog(rec, 'proj_sl5');
  assert.equal(saveGuard.failureDialogOpen(), false, '던진 상자를 떠 있는 것으로 남겼다');
});

/* S6 — 미카사 261113 아이맥 0/3(1116 재발주): 창을 닫은 뒤 종료(창 없음 길) → 부모 없는 상자. 맥 Electron 은 부모 없는 상자를
 *   [NSAlert runModal] 로 띄운다(비동기 API 라도) — 그 중첩 루프 동안 메인 루프 일이 안 돌아 단일 인스턴스 ACK·상한 타이머가 멈추고,
 *   두 번째 실행이 20초 뒤 첫 실행을 SIGKILL 하고 잠금을 가져간다. ⇒ 맥에선 받침 창을 띄워 «시트»(부모 있는 상자)로 단다.
 *   잼: 상자 호출의 부모가 null 이 아니고 «이번에 새로 만든» 창이다 · 그 창이 보이고(show) 크기가 상자를 받칠 만하다 · 두 번째 실행은 그대로 반짝.
 *   양성대조: main.js 창-없음 길의 `win: _quitDialogHost()` 를 지우면 S6 빨강(부모 null = runModal). */
test('S6 ★맥 창-없음 종료 상자는 받침 창의 시트로 뜬다(부모 null = runModal 이면 루프가 멈춘다)', { skip: !MAC && '맥 runModal 길' }, async () => {
  const rec = reset();
  const parents = [];
  H.stub.dialog.showMessageBox = (win) => { rec.dialogs++; parents.push(win); return new Promise((r) => { closeDialog = () => r({ response: 0 }); }); };
  const before = H.stub.__windows.length;
  await quitWithDialog(rec, 'proj_sl6');
  const made = H.stub.__windows.slice(before);
  assert.equal(made.length, 1, `[전제] 받침 창 ${made.length}개 — 하나여야 한다`);
  assert.ok(parents[0], '⛔부모 없는 상자(null) — 맥에선 runModal 이라 두 번째 실행 ACK·상한 타이머가 멈춘다');
  assert.equal(parents[0], made[0], '상자 부모가 이번에 만든 받침 창이 아니다');
  const o = made[0].__opts;
  assert.ok(o.show !== false && o.width >= 400 && o.height >= 200, '받침 창이 안 보이거나 너무 작다: ' + JSON.stringify({ show: o.show, w: o.width, h: o.height }));
  assert.equal(o.webPreferences && o.webPreferences.nodeIntegration, false, '받침 창에 node 를 열었다');
  rec.bounce.length = 0;
  secondLaunch();
  assert.ok(rec.bounce.length >= 1, '받침 창 길에서 두 번째 실행에 반짝 0');
  closeDialog?.();
});
