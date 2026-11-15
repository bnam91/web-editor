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
  H.stub.BrowserWindow.fromWebContents = () => null;
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

/* ══ 1116 근본 — 규칙 «부모 없는 모달을 띄우지 않는다»(현빈: 빈 받침 창 ✗ · 알림으로 낮추기 ✗ · 모달 유지) ══════════════
 *   뿌리: 맥 Electron 은 부모 없는 상자를 [NSAlert runModal] 로 띄운다(shell/browser/ui/message_box_mac.mm) — 그동안 메인 루프가 멈춰
 *   두 번째 실행의 단일 인스턴스 ACK 를 못 하고, 두 번째 실행이 20초 뒤 첫 실행을 SIGKILL 하고 잠금을 가져갔다(미카사 261113 0/3).
 *   ⑴ 창을 닫는 중 저장 실패 → 닫기 보류 → «그 창»에 시트 → 확인 뒤 닫힘 · ⑵ 창이 이미 없으면 진짜 메인 창(createWindow)을 다시 만들어 시트.
 *   «루프가 안 멈춘다»는 단위로 못 잰다(네이티브 runModal) — 대신 «부모가 있다»(= 시트 = 비동기)와 상자가 떠 있는 동안 두 번째 실행이 처리되는지 잰다.
 * 양성대조
 *   CTL1: main.js before-quit 창-없음 길을 옛 꼴 `notifyWindowGone({ pending, exit })`(창 다시 만들기 없음)로 → S6 빨강(부모 null)
 *   CTL2: main.js app:hold-close-on-save-failure 의 `win._gdClosing &&` 를 지우면 → S8 빨강(새로고침도 보류) · 또는 preload 줄을 지우면 S9 빨강 */
const parentsOf = () => { const ps = []; H.stub.dialog.showMessageBox = (win) => { ps.push(win); return new Promise((r) => { closeDialog = () => r({ response: 0 }); }); }; return ps; };

test('S6 ★⑵ 창이 없는 종료의 저장 실패 상자 — 다시 만든 메인 창의 시트(부모 null 0) · 두 번째 실행 처리', { skip: !MAC && '맥 길' }, async () => {
  const rec = reset();
  const parents = parentsOf();
  const before = H.stub.__windows.length;
  const dir = denyWrite('proj_sl6');
  try { H.invokeSync('projects:save-sync', {}, proj('proj_sl6')); } finally { undeny(dir); }
  H.appHandlers.get('before-quit')({ preventDefault() {} });
  await wait(150);
  const made = H.stub.__windows.slice(before);
  assert.equal(parents.length, 1, '[전제] 저장 실패 상자가 안 떴다');
  assert.ok(parents[0], '⛔부모 없는 상자(null) — 맥에선 runModal 이라 루프가 멈춘다');
  assert.ok(made.includes(parents[0]), '상자 부모가 이번에 다시 만든 메인 창이 아니다');
  assert.equal(made[0].__opts.width, 1440, '다시 만든 창이 평소 메인 창(createWindow)이 아니다(빈 받침 창 ✗)');
  rec.bounce.length = 0; rec.focus.length = 0;
  secondLaunch();
  assert.ok(rec.bounce.length >= 1 && rec.focus.some((o) => o && o.steal), '상자가 떠 있는 동안 두 번째 실행이 처리되지 않았다');
  closeDialog?.();
});

function closingWin({ closing }) {
  const once = {};
  const win = { _gdClosing: closing, destroyed: false, isDestroyed() { return this.destroyed; }, destroy() { this.destroyed = true; },
    webContents: { once: (ev, fn) => { once[ev] = fn; } } };
  H.stub.BrowserWindow.fromWebContents = () => win;
  return { win, once };
}
async function failSync(id) { const dir = denyWrite(id); try { H.invokeSync('projects:save-sync', {}, proj(id)); } finally { undeny(dir); } }

test('S7 ★⑴ 창을 닫는 중 저장 실패 — 닫기 보류 → 그 창에 시트 → 확인 뒤 닫힘 · 종료 아님', async () => {
  const rec = reset();
  const parents = parentsOf();
  const { win, once } = closingWin({ closing: true });
  await failSync('proj_sl7');
  const ev = {};
  H.invokeSync('app:hold-close-on-save-failure', ev);
  assert.equal(ev.returnValue, true, '⛔닫는 중 저장 실패인데 닫기를 보류하지 않았다(창이 사라진 뒤 부모 없는 상자로 간다)');
  assert.equal(typeof once['will-prevent-unload'], 'function', '[전제] 닫기 취소를 기다리지 않는다');
  once['will-prevent-unload']();
  await wait(30);
  assert.equal(parents.length, 1, '보류한 창에 상자가 안 떴다');
  assert.equal(parents[0], win, '⛔상자 부모가 닫으려던 그 창이 아니다');
  assert.equal(saveGuard.peekPendingSyncFailure(), null, '알린 실패가 남아 종료 때 또 뜬다');
  assert.equal(win.destroyed, false, '상자를 닫기 전에 창을 없앴다');
  if (MAC) { rec.bounce.length = 0; secondLaunch(); assert.ok(rec.bounce.length >= 1, '시트가 떠 있는 동안 두 번째 실행에 반짝 0'); }
  closeDialog?.();
  await wait(30);
  assert.equal(win.destroyed, true, '확인 뒤 창이 안 닫혔다');
  assert.equal(H.exits.length, 0, '창 닫기인데 앱을 끝냈다');
});

test('S8 [음성] 닫는 중이 아니면(새로고침·이동) 보류 안 함 · 실패 기록은 종료 몫으로 남는다', async () => {
  const rec = reset();
  const parents = parentsOf();
  const { once } = closingWin({ closing: false });
  await failSync('proj_sl8');
  const ev = {};
  H.invokeSync('app:hold-close-on-save-failure', ev);
  assert.equal(ev.returnValue, false, '닫는 중이 아닌데 보류했다(새로고침이 막힌다)');
  assert.equal(once['will-prevent-unload'], undefined);
  assert.equal(parents.length, 0);
  assert.ok(saveGuard.peekPendingSyncFailure(), '실패 기록을 지웠다 — 종료 때 알릴 게 없어진다');
  assert.equal(rec.dialogs, 0);
});

test('S9 배선 — preload 가 묻고 beforeunload 가 실패 때만 취소한다 · 저장·종료 길 상자 호출에 null 부모 리터럴 없음', () => {
  const pre = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
  assert.match(pre, /holdCloseOnSaveFailure:\s*\(\)\s*=>\s*ipcRenderer\.sendSync\('app:hold-close-on-save-failure'\)\s*===\s*true/, 'preload 에 닫기 보류 질문이 없다');
  const sl = fs.readFileSync(path.join(ROOT, 'js/io/save-load.js'), 'utf8');
  const i = sl.indexOf("console.warn('[save-load:beforeunload] sync 저장 거부:'");
  assert.ok(i > 0, '[전제] beforeunload 실패 갈래');
  assert.match(sl.slice(i, i + 600), /holdCloseOnSaveFailure\?\.\(\)\)\s*\{\s*ev\?\.preventDefault\?\.\(\);\s*if \(ev\) ev\.returnValue = /, 'beforeunload 가 실패 때 닫기를 취소하지 않는다');
  const sg = fs.readFileSync(path.join(ROOT, 'main/quit/save-guard.js'), 'utf8');
  assert.doesNotMatch(sg, /showFailureDialog\(null\b/, '저장·종료 길에 부모 null 상자 호출이 남았다');
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  assert.doesNotMatch(main, /notifyWindowGone\(\{\s*pending,\s*exit/, '창-없음 길이 창 없이 상자를 띄운다');
});
