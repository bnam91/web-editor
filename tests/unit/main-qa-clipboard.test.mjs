/* main-qa-clipboard.test.mjs — 격리 QA 앱은 진짜 클립보드를 안 쓰고, 일반 앱은 그대로 쓴다.
 * main.js 의 진짜 조각(첫 ▼QA_HIDDEN 블록 + clipboard:* 처리기)을 가짜 electron 위에서 돌린다 — 일반 앱 음성이 진짜 클립보드를 건드리지 않게.
 * 렌더러 사본 이벤트의 실물 값은 앱에서 쟀다(회신 w1-clip). 변이(잰 값)는 회신에 적는다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sliceCall } from './_slice-block.js';
const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const SRC = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');

const qaBlock = SRC.slice(SRC.indexOf('const _QA_HIDDEN'), SRC.indexOf('// ▲QA_HIDDEN'));
const handler = (ch) => sliceCall(SRC, `ipcMain.handle('${ch}'`, ch) + ';';

/* QA_HIDDEN 값 하나로 main.js 조각을 돌린 세상 */
function boot(env) {
  const os = [], pushed = [], handlers = {}, created = [];
  const img = { isEmpty: () => false, toDataURL: () => 'data:image/png;base64,AAAA' };
  const electron = {
    clipboard: { writeText: (t) => os.push(['text', t]), writeImage: (i) => os.push(['image', i]), readText: () => 'OS값', readImage: () => 'OS그림' },
    nativeImage: { createFromDataURL: () => img, createEmpty: () => 'EMPTY' },
    webContents: { getAllWebContents: () => [{ executeJavaScript: async (js) => { pushed.push(js); } }] },
    app: { commandLine: { appendSwitch() {} }, on: (ev, fn) => created.push([ev, fn]) },
  };
  const req = (m) => (m === 'electron' ? electron : m === './main/qa-clipboard.js' ? require(path.join(ROOT, 'main/qa-clipboard.js')) : assert.fail(`모르는 require ${m}`));
  const ipcMain = { handle: (ch, fn) => { handlers[ch] = fn; } };
  new Function('process', 'app', 'require', 'ipcMain', `${qaBlock}\n${handler('clipboard:writeText')}\n${handler('clipboard:writeImage')}`)({ env }, electron.app, req, ipcMain);
  return { os, pushed, handlers, created, electron };
}

test('C1 ★[음성] 일반 앱 — 처리기가 진짜 클립보드에 그대로 쓴다, 렌더러 주입 없음', async () => {
  for (const env of [{}, { GODITOR_QA_HIDDEN: '0' }, { GODITOR_QA_HIDDEN: '' }]) {
    const w = boot(env);
    assert.deepEqual(await w.handlers['clipboard:writeText'](null, '글'), { ok: true });
    assert.deepEqual(await w.handlers['clipboard:writeImage'](null, 'data:x'), { ok: true });
    assert.deepEqual(w.os.map((x) => x[0]), ['text', 'image'], '★일반 앱이 진짜 클립보드에 안 썼다');
    assert.equal(w.os[0][1], '글');
    assert.equal(w.electron.clipboard.readText(), 'OS값');
    assert.equal(w.created.length, 0, '★일반 앱에 렌더러 문이 달렸다');
    assert.equal(w.pushed.length, 0);
  }
});

test('C2 ★QA 앱 — 진짜 클립보드 0회, 처리기는 ok, 읽기는 쓴 값, 렌더러가 값을 받는다', async () => {
  const w = boot({ GODITOR_QA_HIDDEN: '1' });
  assert.deepEqual(await w.handlers['clipboard:writeText'](null, '글'), { ok: true });
  assert.equal(w.electron.clipboard.readText(), '글');
  assert.match(w.pushed.at(-1), /"text":"글"/);
  assert.deepEqual(await w.handlers['clipboard:writeImage'](null, 'data:x'), { ok: true });
  assert.equal(w.electron.clipboard.readImage().toDataURL(), 'data:image/png;base64,AAAA');
  assert.equal(w.electron.clipboard.readText(), '', '그림을 쓰면 글자는 비는 게 OS 와 같다');
  assert.match(w.pushed.at(-1), /"image":"data:image/);
  assert.deepEqual(w.os, [], '★격리 앱이 진짜 클립보드에 썼다');
  assert.deepEqual(w.created.map((x) => x[0]), ['web-contents-created'], '★렌더러 문이 안 달렸다');
});

test('C3 QA 앱 — 못 갈면 조용히 넘어가지 않고 터진다', () => {
  const { install } = require(path.join(ROOT, 'main/qa-clipboard.js'));
  assert.throws(() => install({ clipboard: Object.freeze({ writeText() {} }), nativeImage: {}, webContents: {}, app: { on() {} } }));
});

/* 렌더러 문: 가짜 창 위에서 진짜 스크립트를 돈다 */
function renderer(active = { tagName: 'DIV' }) {
  const { RENDERER_JS } = require(path.join(ROOT, 'main/qa-clipboard.js'));
  const on = {}, exec = [], writes = [], fired = [];
  class DataTransfer { constructor() { this.d = {}; this.items = { add: (f) => { this.file = f; } }; } setData(k, v) { this.d[k] = v; } getData(k) { return this.d[k] || ''; } }
  class ClipboardEvent { constructor(type, o) { Object.assign(this, o, { type }); } }
  const window = { addEventListener: (t, fn, cap) => { assert.equal(cap, true, '★capture 가 아니면 앱 처리기가 먼저 돈다'); on[t] = fn; }, getSelection: () => '고른글', electronAPI: { clipboardWriteText: (t) => writes.push(t) } };
  const document = { activeElement: active, execCommand: (...a) => exec.push(a) };
  vm.runInNewContext(RENDERER_JS, { window, document, DataTransfer, ClipboardEvent, File: class { constructor(b, n, o) { this.type = o.type; } }, atob: () => '', Uint8Array, String });
  const real = (type, reply) => {
    const flags = { stop: 0, prevent: 0 };
    on[type]({ isTrusted: true, stopImmediatePropagation: () => flags.stop++, preventDefault: () => flags.prevent++, target: { dispatchEvent: (ev) => { fired.push(ev); return reply ? reply(ev) : true; } } });
    return flags;
  };
  return { window, on, exec, writes, fired, real };
}

test('C4 ★렌더러 paste — 진짜 이벤트를 멈추고 메모리 값을 실은 사본을 쏜다(OS 값 안 읽음)', () => {
  const r = renderer();
  r.window.__qaClip = { text: '속값', image: null };
  const f = r.real('paste');
  assert.deepEqual(f, { stop: 1, prevent: 1 });
  assert.equal(r.fired[0].clipboardData.getData('text/plain'), '속값');
  assert.equal(r.exec.length, 0, '캔버스에는 글자를 안 넣는다');
});
test('C5 렌더러 paste — 글 칸이면 처리기가 안 막았을 때만 글자가 들어간다', () => {
  const r = renderer({ tagName: 'INPUT' });
  r.window.__qaClip = { text: '속값' };
  r.real('paste');
  assert.deepEqual(r.exec, [['insertText', false, '속값']]);
  const q = renderer({ tagName: 'INPUT' });
  q.window.__qaClip = { text: '속값' };
  q.real('paste', () => false);
  assert.equal(q.exec.length, 0);
});
test('C6 ★렌더러 copy/cut — 진짜 쓰기를 막고 값은 메모리로(처리기가 실은 값이 우선)', () => {
  const r = renderer();
  const f = r.real('copy');
  assert.deepEqual(f, { stop: 1, prevent: 1 }, '★진짜 copy 가 OS 로 간다');
  assert.deepEqual(r.writes, ['고른글']);
  const q = renderer();
  q.real('copy', (ev) => { ev.clipboardData.setData('text/plain', '메모값'); return false; });
  assert.deepEqual(q.writes, ['메모값']);
  const c = renderer({ tagName: 'DIV', isContentEditable: true });
  c.real('cut');
  assert.deepEqual(c.exec, [['delete']], '★오려두기가 안 지웠다');
});
test('C7 사본 이벤트는 다시 가로채지 않는다', () => {
  const r = renderer();
  r.on.paste({ isTrusted: false, stopImmediatePropagation: () => assert.fail('★사본을 또 멈췄다') });
  r.on.copy({ isTrusted: false, stopImmediatePropagation: () => assert.fail('★사본을 또 멈췄다') });
});

test('C8 ★전수 표 — 앱 코드의 메인 clipboard.* 호출과 OS 클립보드 명령', () => {
  const files = ['main.js', 'preload.js'];
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach((e) => {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p); else if (/\.(c|m)?js$/.test(e.name) && p !== 'main/qa-clipboard.js') files.push(p);
  });
  walk('main');
  const got = [];
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of s.matchAll(/\bclipboard\.([a-zA-Z]+)\s*\(/g)) got.push(`${f}:${m[1]}`);
    assert.doesNotMatch(s, /\b(pbcopy|pbpaste)\b/, `★${f} 가 OS 명령으로 클립보드를 만진다`);
  }
  assert.deepEqual(got.sort(), ['main.js:writeImage', 'main.js:writeText'], '★새 호출이면 qa-clipboard.js stubs 에 넣고 표를 고쳐라');
});
