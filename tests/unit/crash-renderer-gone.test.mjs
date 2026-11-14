/* RENDERER-GONE-BLANK-WINDOW-NO-RECOVERY-01 (2026-11-14) — 렌더러가 죽으면 «사람에게» 말하고 다시 불러온다.
 *   실행: node --test tests/unit/crash-renderer-gone.test.mjs
 * 가짜 app·webContents·창·dialog 로 install() 이 건 진짜 render-process-gone 핸들러를 쏜다.
 * ★양성대조: main/crash/index.js 의 offerReload(...) 호출 한 줄을 빼면 RG-1·2·3 이 빨강(대화상자 0회).
 *   옛 판(기록만)이 바로 그 꼴이다. RG-4 의 «기록은 그대로»는 고침 전후 모두 초록이어야 한다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require_ = createRequire(import.meta.url);
const { mkTmpRoot } = require_(path.join(REPO, 'tests/unit/_tmproot.js'));
const crash = require_(path.join(REPO, 'main/crash/index.js'));

function host({ responses = [], visible = true } = {}) {
  const L = new Map();
  const app = { on: (ev, fn) => { (L.get(ev) || L.set(ev, []).get(ev)).push(fn); }, getPath: () => null, getVersion: () => '0.9.13-test' };
  const proc = { platform: 'darwin', arch: 'arm64', versions: {}, stderr: { write: () => true }, exit() {}, listenerCount: () => 1, on() {}, prependListener() {} };
  const wc = { id: 7, destroyed: false, reloads: 0, isDestroyed() { return this.destroyed; }, reload() { this.reloads++; } };
  const win = { closes: 0, visible, isVisible() { return this.visible; }, close() { this.closes++; } };
  const BrowserWindow = { fromWebContents: (w) => (w === wc ? win : null) };
  const calls = [];
  const dialog = { showMessageBox: (parent, opts) => { calls.push({ parent, opts }); return Promise.resolve({ response: responses.length ? responses.shift() : 0 }); } };
  const ud = path.join(mkTmpRoot('rg-'), 'ud');
  fs.mkdirSync(ud, { recursive: true });
  crash._resetForTest();
  crash.install({ app, proc, console: { warn() {}, error() {} }, dialog, BrowserWindow, getUserDataDir: () => ud });
  /* 핸들러가 돌려주는 약속은 없다 — 대화상자 응답 뒤 처리까지 마이크로태스크를 비운다. */
  const gone = async (details = { reason: 'crashed', exitCode: 133 }) => {
    for (const fn of L.get('render-process-gone') || []) fn({}, wc, details);
    await new Promise((r) => setImmediate(r));
  };
  return { wc, win, calls, gone, ud };
}

test('RG-1 렌더러 사망 → 그 창을 부모로 «화면이 멈췄습니다» 대화상자 · 다시 불러오기 = 그 창 reload', async () => {
  const h = host({ responses: [0] });
  await h.gone();
  assert.equal(h.calls.length, 1, '★대화상자가 안 떴다 — 빈 창만 남는다(옛 판)');
  assert.equal(h.calls[0].parent, h.win);
  assert.equal(h.calls[0].opts.message, '화면이 멈췄습니다');
  assert.deepEqual(h.calls[0].opts.buttons, ['다시 불러오기', '닫기']);
  assert.match(h.calls[0].opts.detail, /사라졌을 수 있습니다/, '저장 안 된 편집 유실 가능성 문구');
  assert.equal(h.wc.reloads, 1);
  assert.equal(h.win.closes, 0);
});

test('RG-2 «닫기» → reload 0 · 창 닫음', async () => {
  const h = host({ responses: [1] });
  await h.gone();
  assert.equal(h.calls.length, 1);
  assert.equal(h.wc.reloads, 0);
  assert.equal(h.win.closes, 1);
});

test(`RG-3 ${crash.RELOAD_WINDOW_MS / 1000}초 안 반복 사망 — reload 는 ${crash.RELOAD_MAX}번까지, 그 다음은 «닫기»만 · 창이 지나면 다시 권한다`, async () => {
  assert.equal(crash.RELOAD_MAX, 2, '안전 기본값 2회');
  const h = host({ responses: [0, 0, 0, 0] });
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    await h.gone(); await h.gone(); await h.gone();
    assert.equal(h.calls.length, 3, '세 번째도 «말은» 한다');
    assert.equal(h.wc.reloads, 2, '★상한을 넘어 reload 했다 — 무한 재시도');
    assert.deepEqual(h.calls[2].opts.buttons, ['닫기']);
    assert.equal(h.win.closes, 1, '상한 뒤 응답 0 = 유일한 단추 «닫기»');
    t += crash.RELOAD_WINDOW_MS + 1;
    await h.gone();
    assert.deepEqual(h.calls[3].opts.buttons, ['다시 불러오기', '닫기']);
    assert.equal(h.wc.reloads, 3);
  } finally { Date.now = realNow; }
});

test('RG-4 대화상자를 안 띄우는 자리 — 정상 종료 · 이미 닫힌 창 · 숨은 창(QA_HIDDEN). 기록 줄은 그대로', async () => {
  let h = host();
  await h.gone({ reason: 'clean-exit', exitCode: 0 });
  assert.equal(h.calls.length, 0, '정상 종료');
  h = host(); h.wc.destroyed = true;
  await h.gone();
  assert.equal(h.calls.length, 0, '닫히는 창');
  h = host({ visible: false });
  await h.gone();
  assert.equal(h.calls.length, 0, '숨은 창 — 포커스를 뺏지 않는다');
  const files = fs.readdirSync(path.join(h.ud, 'logs')).filter((n) => /^crash-\d+\.json$/.test(n));
  assert.equal(files.length, 1, '★기존 기록 줄이 안 돌았다');
  assert.equal(JSON.parse(fs.readFileSync(path.join(h.ud, 'logs', files[0]), 'utf8')).kind, 'render-process-gone');
});
