/* U-A — ★설정 화면이 «거짓 단축키»를 보여주면 안 된다 (별건 A)
 *
 * ★실기가 잡은 것 (미니4호기 윈도우 실기 QA 2차 §2-2·별건 A, SHA 6dc2385)
 *   설정 창 라벨 = 「블록 그룹화 Win+G」·「그룹 해제 Win+Shift+G」
 *   실제로 먹는 키 = Ctrl+G · Ctrl+Shift+G  (Ctrl+Shift+G 로 그룹 1→0 확인,
 *                                            대조 Meta+Shift+G = _matchShortcut false)
 *   ⇒ 사용자가 화면을 믿고 «윈도우 로고 키»를 눌러도 아무 일이 안 난다.
 *     기능이 아예 없는 것보다 나쁘다 — 있다고 «써 있는데» 안 되는 것이라서.
 *
 * ★원인: 값의 정본(main.js DEFAULT_SETTINGS)은 아직 'Meta+…' 이고, 플랫폼 교정은
 *   «읽는 자리»(settings-store 의 _toPlatform, getShortcut 이 탄다)에 있다.
 *   그런데 설정 모달만 _draft.shortcuts 원본을 «날것»으로 라벨링했다.
 *
 * ★이 검사가 재는 «불변식» 하나:
 *      화면에 찍힌 라벨을 «그대로 눌렀을 때» _matchShortcut 이 true 여야 한다.
 *   ⛔라벨 문자열끼리 비교하지 않는다 — 그건 「내가 기대한 문자열」을 검사하는 것이다.
 *     라벨을 «키 이벤트로 되돌려» 진짜 판정기에 먹인다.
 * ⛔소스 정규식 없음: 진짜 settings-store.js·settings-modal.js 를 vm 으로 실행하고,
 *   기본값은 «진짜 main.js»(IPC settings:get)에서 받아 온다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { loadMain } = require('./_ipc-harness.js');
/* ⚠️new URL(...).pathname 은 윈도우에서 '/C:/…' 를 만든다 — fileURLToPath 로. */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const H = loadMain();

/** 렌더러 두 파일을 «진짜로» 돌린다. platform 으로 맥/윈도우를 가른다. */
function boot(platform) {
  const window = {};
  const ctx = {
    window,
    navigator: { platform, userAgent: platform, userAgentData: { platform } },
    document: { addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null },
    console, setTimeout, clearTimeout, CustomEvent: class { constructor(t, d) { this.type = t; Object.assign(this, d); } },
  };
  ctx.globalThis = ctx;
  window.addEventListener = () => {};
  window.dispatchEvent = () => {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/settings/settings-store.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/settings/settings-modal.js'), 'utf8'), ctx);
  return window;
}

/** 라벨을 «사용자가 읽는 대로» 키 이벤트로 되돌린다.
 *  ★'Win' → metaKey 다. 윈도우 로고 키를 누르면 브라우저가 실제로 metaKey 를 준다 —
 *    그래서 「Win+Shift+G」라는 라벨은 «metaKey 를 누르라»는 지시다. */
function eventFromLabel(label) {
  const e = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, code: null };
  let rest = label;
  const eat = (needle, set) => { if (rest.includes(needle)) { rest = rest.replace(needle, ''); set(); } };
  eat('⌘', () => { e.metaKey = true; });  eat('Win', () => { e.metaKey = true; });
  eat('⌃', () => { e.ctrlKey = true; });  eat('Ctrl', () => { e.ctrlKey = true; });
  eat('⇧', () => { e.shiftKey = true; }); eat('Shift', () => { e.shiftKey = true; });
  eat('⌥', () => { e.altKey = true; });   eat('Alt', () => { e.altKey = true; });
  rest = rest.replace(/\+/g, '').trim();
  e.code = /^[A-Z]$/.test(rest) ? 'Key' + rest : rest;
  return e;
}

const MOD_ACTIONS = ['groupBlocks', 'ungroup', 'wrapInFrame'];

/** main.js 의 «진짜» 기본 단축키. 여기가 「Meta 가 박혀 있다」는 그 자리다.
 *  ⚠️settings:get 핸들러는 whenReady 안에서 등록돼 하네스에선 안 잡힌다 ⇒ 정본을 직접 읽는다. */
const M = require(path.join(ROOT, 'main.js'));
function realDefaults() {
  assert.ok(M.DEFAULT_SHORTCUTS, 'main.js 가 DEFAULT_SHORTCUTS 를 안 내보낸다');
  return M.DEFAULT_SHORTCUTS;
}

test('U-A0 전제: main.js 기본값은 수식어 단축키를 «맥 표기(Meta)»로 준다', () => {
  const d = realDefaults();
  for (const a of MOD_ACTIONS) {
    assert.match(d[a], /^Meta\+/, `${a} 가 ${d[a]} — 이 검사의 전제(정본이 Meta)가 바뀌었다`);
  }
});

test('U-A1 ★윈도우: 화면에 찍힌 라벨을 «그대로 눌렀을 때» 실제로 먹는다', () => {
  const w = boot('Windows');
  w._settings = { shortcuts: realDefaults() };
  for (const a of MOD_ACTIONS) {
    const label = w.__settingsShortcutLabel(w._settings.shortcuts[a]);
    const e = eventFromLabel(label);
    assert.equal(w._matchShortcut(e, a), true,
      `⛔거짓 표시: ${a} 라벨이 「${label}」인데 그대로 누르면 안 먹는다 ` +
      `(실제 spec=${w.getShortcut(a)} · 라벨→이벤트=${JSON.stringify(e)})`);
  }
});

test('U-A2 ★윈도우: 라벨에 «Win»(윈도우 로고 키)이 있으면 안 된다 — 그 키는 안 먹는다', () => {
  const w = boot('Windows');
  w._settings = { shortcuts: realDefaults() };
  for (const a of MOD_ACTIONS) {
    const label = w.__settingsShortcutLabel(w._settings.shortcuts[a]);
    assert.ok(!/Win/.test(label), `⛔${a} 라벨이 「${label}」 — 사용자가 윈도우 로고 키를 누른다`);
    assert.ok(/Ctrl/.test(label), `${a} 라벨이 「${label}」 — 실제로 먹는 Ctrl 을 안 보여준다`);
  }
});

test('U-A3 ★맥 회귀: 맥에서는 여전히 ⌘ 표기이고 그대로 눌러 먹는다', () => {
  const w = boot('macOS');
  w._settings = { shortcuts: realDefaults() };
  for (const a of MOD_ACTIONS) {
    const label = w.__settingsShortcutLabel(w._settings.shortcuts[a]);
    assert.ok(/⌘/.test(label), `맥 라벨이 「${label}」 — ⌘ 가 사라졌다`);
    assert.equal(w._matchShortcut(eventFromLabel(label), a), true,
      `⛔맥에서 라벨 「${label}」이 안 먹는다`);
  }
});

test('U-A4 ★기존 사용자 저장본(옛 Meta 값)도 «윈도우에서 정직하게» 보인다', () => {
  const w = boot('Windows');
  // 저장본에 이미 박혀 있는 옛 값 — DEFAULT_SETTINGS 를 고쳐도 이건 안 고쳐진다
  w._settings = { shortcuts: { ungroup: 'Meta+Shift+KeyG', groupBlocks: 'Meta+KeyG', wrapInFrame: 'Meta+Alt+KeyG' } };
  assert.equal(w.__settingsShortcutLabel('Meta+Shift+KeyG'), 'Ctrl+Shift+G');
  assert.equal(w._matchShortcut(eventFromLabel(w.__settingsShortcutLabel('Meta+Shift+KeyG')), 'ungroup'), true);
});

test('U-A5 ★사용자가 «직접» Meta+Ctrl 조합을 지정했으면 건드리지 않는다(교정의 경계)', () => {
  const w = boot('Windows');
  w._settings = { shortcuts: { ungroup: 'Meta+Ctrl+KeyG' } };
  assert.equal(w.getShortcut('ungroup'), 'Meta+Ctrl+KeyG', '사용자 의도를 교정이 삼켰다');
  assert.equal(w.__settingsShortcutLabel('Meta+Ctrl+KeyG'), 'Win+Ctrl+G', '라벨이 spec 과 어긋난다');
});
