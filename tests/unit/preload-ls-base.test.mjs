/* preload-ls-base — 프로젝트 파일을 쓴 렌더러 쓰기가 localStorage 표시를 옮기는지의 자(실제 preload.js 를 스텁 electron 으로 돌린다).
 * ⛔이 자가 안 재는 것: 실제 IPC · 파일 쓰기(앱 값이 회신에 있다). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(result) {
  const store = new Map();
  let api;
  const electron = { contextBridge: { exposeInMainWorld: (_n, a) => { api = api || a; } }, ipcRenderer: { invoke: async () => result, sendSync: () => result, on() {}, send() {}, removeListener() {} } };
  const ctx = { require: (m) => (m === 'electron' ? electron : {}), localStorage: { setItem: (k, v) => store.set(k, v) }, console, process: { platform: 'darwin', env: {} }, window: {}, module: {}, exports: {} };
  vm.runInNewContext(fs.readFileSync(new URL('../../preload.js', import.meta.url), 'utf8'), ctx);
  return { api, store };
}
const KEY = 'web-editor-ls-base__p1';
const P = { id: 'p1', updatedAt: 'U1' };

test('비동기 저장 성공 → 표시가 그 판', async () => { const { api, store } = load({ ok: true }); await api.saveProject(P); assert.equal(store.get(KEY), 'U1'); });
test('동기 저장 성공 → 표시가 그 판', () => { const { api, store } = load({ ok: true }); api.saveProjectSync(P); assert.equal(store.get(KEY), 'U1'); });
test('[음성] 저장 실패 → 표시 그대로', async () => { const { api, store } = load({ ok: false }); await api.saveProject(P); api.saveProjectSync(P); assert.equal(store.has(KEY), false); });
test('숫자 updatedAt 은 글자로', async () => { const { api, store } = load({ ok: true }); await api.saveProject({ id: 'p1', updatedAt: 123 }); assert.equal(store.get(KEY), '123'); });
test('답은 그대로 돌려준다', async () => { const { api } = load({ ok: true, x: 1 }); assert.deepEqual({ ...(await api.saveProject(P)) }, { ok: true, x: 1 }); assert.deepEqual({ ...api.saveProjectSync(P) }, { ok: true, x: 1 }); });
