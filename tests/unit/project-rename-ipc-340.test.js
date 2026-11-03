/* project-rename-ipc-340 — 이름 바꾸기 세 입구가 렌더러에서 load→save 로 왕복하지 않는다 (시트 340 B)
 * 왜: 그 왕복 틈에 자동저장이 끼면 방금 저장된 편집이 옛 내용으로 덮인다(지연 대역 앱 값 9/9).
 * 칸: 세 입구가 projects:rename 을 부른다 · 실패면 옛 이름 + 알림 · 이름칸 빈 입력은 취소 · [음성] 성공은 새 이름 유지.
 * 변이: 세 입구를 옛 왕복으로 되돌리면 빨강. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const vm = require('vm');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const TAB = readSrc(REPO, 'js/tab-system.js');
const SL = readSrc(REPO, 'js/io/save-load.js');
const LIST = readSrc(REPO, 'pages/projects.html');

function api(result) {
  const calls = [];
  return { calls, electronAPI: {
    renameProject: async (a) => { calls.push(['rename', a]); if (result instanceof Error) throw result; return result; },
    loadProject: async () => { calls.push(['load']); return { id: 'proj_1', name: 'old' }; },
    saveProject: async (p) => { calls.push(['save', p]); return { ok: true }; },
  } };
}

function finishRig(result, inputValue) {
  const a = api(result);
  const display = { textContent: 'old', style: {} };
  const input = { value: inputValue, style: { display: 'block' } };
  const tab = { id: 'proj_1', name: 'old' };
  const toasts = [];
  const win = { IS_ELECTRON: true, electronAPI: a.electronAPI, showToast: (m) => toasts.push(m) };
  const fn = vm.runInNewContext(`(${sliceBlock(TAB, 'async function finishRenameProject(', '못 찾았다')})`, {
    document: { getElementById: (id) => (id === 'project-name-display' ? display : input) },
    window: win, _getTabs: () => [tab], _getActId: () => 'proj_1',
    renderTabBar() {}, saveTabState() {}, localStorage: {}, JSON,
  });
  return { fn, a, display, tab, toasts };
}

test('이름칸 — projects:rename 을 부르고 왕복하지 않는다', async () => {
  const r = finishRig({ ok: true, name: 'new' }, 'new');
  await r.fn();
  assert.deepStrictEqual(r.a.calls.map((c) => c[0]), ['rename'], '★렌더러에서 load/save 왕복이 돌았다');
  assert.strictEqual(r.a.calls[0][1].projectId, 'proj_1');
  assert.strictEqual(r.a.calls[0][1].name, 'new');
  assert.strictEqual(r.tab.name, 'new');
  assert.strictEqual(r.display.textContent, 'new');
  assert.strictEqual(r.toasts.length, 0);
});
test('이름칸 — 실패(ok:false)면 옛 이름으로 되돌리고 알린다', async () => {
  const r = finishRig({ ok: false, error: 'EACCES' }, 'new');
  await r.fn();
  assert.strictEqual(r.tab.name, 'old');
  assert.strictEqual(r.display.textContent, 'old');
  assert.ok(/EACCES/.test(r.toasts[0] || ''), '★실패를 말하지 않았다');
});
test('이름칸 — 호출이 던져도 옛 이름 + 알림', async () => {
  const r = finishRig(new Error('ipc 끊김'), 'new');
  await r.fn();
  assert.strictEqual(r.tab.name, 'old');
  assert.strictEqual(r.toasts.length, 1);
});
test('이름칸 — 빈 입력은 취소: 아무 호출도 없고 옛 이름 그대로', async () => {
  for (const v of ['', '   ']) {
    const r = finishRig({ ok: true }, v);
    await r.fn();
    assert.strictEqual(r.a.calls.length, 0, '★빈 입력이 저장으로 나갔다');
    assert.strictEqual(r.tab.name, 'old');
    assert.strictEqual(r.display.textContent, 'old');
  }
});

function setNameRig(result) {
  const a = api(result);
  const tab = { id: 'proj_1', name: 'old' };
  const toasts = [];
  const fn = vm.runInNewContext(`(${sliceBlock(SL, 'async function setProjectName(', '못 찾았다')})`, {
    activeProjectId: 'proj_1', openTabs: [tab], IS_ELECTRON: true,
    window: { electronAPI: a.electronAPI, renderTabBar() {}, showToast: (m) => toasts.push(m) },
  });
  return { fn, a, tab, toasts };
}
test('탭 이름 — projects:rename 을 부르고 왕복하지 않는다', async () => {
  const r = setNameRig({ ok: true });
  await r.fn('new');
  assert.deepStrictEqual(r.a.calls.map((c) => c[0]), ['rename'], '★렌더러에서 load/save 왕복이 돌았다');
  assert.strictEqual(r.tab.name, 'new');
});
test('탭 이름 — 실패면 옛 이름 + 알림', async () => {
  const r = setNameRig({ ok: false, error: 'EACCES' });
  await r.fn('new');
  assert.strictEqual(r.tab.name, 'old');
  assert.strictEqual(r.toasts.length, 1);
});

function listRig(result) {
  const a = api(result);
  const alerts = [];
  const fn = vm.runInNewContext(`(${sliceBlock(LIST, 'async function renameProject(', '못 찾았다')})`, {
    IS_ELECTRON: true, window: { electronAPI: a.electronAPI }, alert: (m) => alerts.push(m), localStorage: {}, PROJECTS_KEY: 'x', JSON,
  });
  return { fn, a, alerts };
}
test('목록 — projects:rename 을 부르고 왕복하지 않는다', async () => {
  const r = listRig({ ok: true });
  await r.fn('proj_1', 'new');
  assert.deepStrictEqual(r.a.calls.map((c) => c[0]), ['rename'], '★렌더러에서 load/save 왕복이 돌았다');
  assert.strictEqual(r.alerts.length, 0);
});
test('목록 — 실패면 알린다', async () => {
  const r = listRig({ ok: false, error: 'EACCES' });
  await r.fn('proj_1', 'new');
  assert.ok(/EACCES/.test(r.alerts[0] || ''));
});

test('main·preload — 입구가 있다', () => {
  assert.ok(readSrc(REPO, 'main.js').includes("ipcMain.handle('projects:rename'"), '★main 핸들러 없음');
  assert.ok(readSrc(REPO, 'preload.js').includes("ipcRenderer.invoke('projects:rename'"), '★preload 없음');
});
