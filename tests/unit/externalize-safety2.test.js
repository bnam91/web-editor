/* externalize-safety2.test.js — 자동 변환 기본 켬 2차 리뷰의 자. 진짜 externalizer · main.js·preload.js 원문 · 작은 픽스처. 앱 값은 tests/tools/conv-measure.cjs.
 * 실행: node --test tests/unit/externalize-safety2.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { readSrc } = require('./_srcread.js');
const { sliceBlock, sliceCall } = require('./_slice-block.js');
const { mkTmpRoot } = require('./_tmproot.js');
const REPO = path.join(__dirname, '..', '..');
const XPATH = path.join(REPO, 'main/project-store/externalizer.js');
const X = require(XPATH);
const PNG = (n = 7) => 'data:image/png;base64,' + Buffer.alloc(3000, n).toString('base64');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function fx(n = 7, extra = {}) {
  const root = mkTmpRoot('goya-exts-'); const id = 'p1'; const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  const proj = path.join(dir, 'proj.json');
  fs.writeFileSync(proj, JSON.stringify({ id, version: 2, updatedAt: '2026-01-01T00:00:00.000Z', pages: [{ id: 'a', canvas: `<div class="section-block"><img data-img-src="${PNG(n)}"></div>` }], ...extra }));
  return { root, id, dir, proj, pre: path.join(dir, X.BACKUP_NAME), meta: path.join(dir, 'proj_meta.json') };
}
const addImage = (f, n) => { const d = JSON.parse(fs.readFileSync(f.proj, 'utf8')); d.pages[0].canvas += `<img data-img-src="${PNG(n)}">`; fs.writeFileSync(f.proj, JSON.stringify(d)); };
const allShas = (f) => fs.readdirSync(f.dir).filter((n) => /^proj_pre-externalize/.test(n)).map((n) => sha(path.join(f.dir, n)));
test('① 재변환 쓰기 실패: 앞 변환 전 본이 고정 이름으로 돌아온다(되돌리기 버튼이 산다)', () => {
  const f = fx(); X.externalizeProjectFile(f.root, f.id);
  const prev = sha(f.pre); addImage(f, 30); const cur = sha(f.proj);
  const o = fs.renameSync;
  fs.renameSync = function (a, b) { if (String(b).endsWith('proj.json')) throw new Error('boom'); return o.call(this, a, b); };
  let r; try { r = X.externalizeProjectFile(f.root, f.id); } finally { fs.renameSync = o; }
  assert.strictEqual(r.reason, 'write_failed');
  assert.strictEqual(sha(f.proj), cur);
  assert.strictEqual(sha(f.pre), prev);
  assert.strictEqual(fs.readdirSync(f.dir).filter((n) => /^proj_pre-externalize\.\d+/.test(n)).length, 0, '회전본이 남았다');
  assert.strictEqual(X.scanProjectFile(f.root, f.id).hasBackup, true);
});
test('① 백업 자리 잡기 실패도 앞 본을 돌려놓는다', () => {
  const f = fx(); X.externalizeProjectFile(f.root, f.id);
  const prev = sha(f.pre); addImage(f, 31);
  const o = fs.renameSync;
  fs.renameSync = function (a, b) { if (String(a).endsWith('.tmp') && String(b).endsWith(X.BACKUP_NAME)) throw new Error('boom'); return o.call(this, a, b); };
  let r; try { r = X.externalizeProjectFile(f.root, f.id); } finally { fs.renameSync = o; }
  assert.strictEqual(r.reason, 'backup_failed');
  assert.strictEqual(sha(f.pre), prev);
});
const SL = () => readSrc(REPO, 'js/io/save-load.js');
function sealedFns(tok, sealId) {
  return new Function('_reloadSealTok', '_reloadSealId', '_hasOwnUnsaved', '_lastSaveFailed',
    sliceBlock(SL(), 'function _isReloadSealed(', '대상') + '\n' + sliceBlock(SL(), 'function _unloadSaveNeeded(', '대상') + '\nreturn { _isReloadSealed, _unloadSaveNeeded };')(tok, sealId, () => true, () => true);
}
function saveFn(tok, sealId) {
  const calls = [];
  const fn = new Function('window', '_reloadSealTok', '_reloadSealId', 'activeProjectId', '_isSavingToFile', '_pendingSaves', '_doSaveProjectToFile', '_isSaveFailure', '_lastSaveResult',
    'let _savingOwnerId = null, _dirtySinceSave = true;\n' + sliceBlock(SL(), 'function _isReloadSealed(', '대상') + '\n' + sliceBlock(SL(), 'async function saveProjectToFile(', '대상') + '\nreturn saveProjectToFile;')(
    {}, tok, sealId, 'p1', false, new Map(), async (_s, o) => { calls.push(o.projectId || 'p1'); return { ok: true }; }, () => false, new Map());
  return { fn, calls };
}
test('② 봉인 중 그 프로젝트 파일 저장(탭 전환·홈 이동)은 안 쓴다 · 다른 프로젝트는 쓴다', async () => {
  const a = saveFn(1, 'p1');
  const r = await a.fn('{}', { projectId: 'p1' });
  assert.deepStrictEqual(a.calls, []); assert.strictEqual(r.reason, 'reload-seal'); assert.strictEqual(r.skipped, true);
  await a.fn('{}');   // 홈 이동: 대상 없이 활성
  assert.deepStrictEqual(a.calls, []);
  await a.fn('{}', { projectId: 'p2' });
  assert.deepStrictEqual(a.calls, ['p2'], '[음성] 다른 프로젝트');
  const b = saveFn(null, null); await b.fn('{}', { projectId: 'p1' });
  assert.deepStrictEqual(b.calls, ['p1'], '[음성] 봉인 없음');
});
test('② 닫기 저장: 봉인된 프로젝트만 건너뛴다', () => {
  assert.strictEqual(sealedFns(1, 'p1')._unloadSaveNeeded('p1'), false);
  assert.strictEqual(sealedFns(1, 'p1')._unloadSaveNeeded('p2'), true, '탭을 옮긴 뒤 다른 프로젝트의 미저장은 산다');
  assert.strictEqual(sealedFns(null, null)._unloadSaveNeeded('p1'), true);
});
test('② 실제 beforeunload·종료 저장 손잡이가 봉인을 본다', async () => {
  const src = SL(); const hs = {};
  const win = { addEventListener: (n, f) => { hs[n] = f; }, electronAPI: { onForceSaveBeforeQuit: (f) => { hs.quit = f; }, quitReady: (r) => { hs.answer = r; } } };
  let ser = 0; const stub = { serializeProject: () => { ser++; return '{}'; } };
  const head = sliceBlock(src, 'function _isReloadSealed(', '대상') + '\n' + sliceBlock(src, 'function _unloadSaveNeeded(', '대상') + '\n';
  new Function('window', 'IS_ELECTRON', 'activeProjectId', '_reloadSealTok', '_reloadSealId', '_hasOwnUnsaved', '_lastSaveFailed', 'serializeProject',
    head + src.slice(src.indexOf("window.addEventListener('beforeunload'"), src.indexOf('/* ── 종료 시 저장 결과')) + '\nif (IS_ELECTRON) {\n' + sliceCall(src, 'window.electronAPI.onForceSaveBeforeQuit(', '대상') + ';' + '\n}')(win, true, 'p1', 1, 'p1', () => true, () => true, stub.serializeProject);
  hs.beforeunload();
  assert.strictEqual(ser, 0, '닫기가 직렬화까지 갔다');
  await hs.quit();
  assert.strictEqual(ser, 0, '종료가 직렬화까지 갔다');
  assert.strictEqual(hs.answer.reason, 'reload-seal');
});
test('③ 협업 차단은 내용으로: 캔버스에 goya 가 있으면 표지 없이도(복제·새 그림) 막는다', async () => {
  const src = readSrc(REPO, 'main/collab/index.js');
  const run = (f) => { let called = 0; return new Function('getRef', 'call', '_deps', 'setRef', sliceBlock(src, 'async function register(', '대상') + '\nreturn register;')(() => null, async () => { called++; return { ok: false, reason: 'x' }; }, { hasLocalImages: () => X.hasCanvasGoya(f.root, f.id), readMeta: () => ({}), readAuth: () => null }, () => {})({ projectId: f.id }).then((r) => ({ r, called })); };
  const goya = fx(); X.externalizeProjectFile(goya.root, goya.id); fs.unlinkSync(goya.meta);   // 복제: 표지가 지워진 본
  const a = await run(goya); assert.strictEqual(a.r.reason, 'local_images'); assert.strictEqual(a.called, 0);
  const b = await run(fx()); assert.strictEqual(b.called, 1, '[음성] base64 본');
  const s = fx(7, { pages: [{ id: 'a', canvas: '<div class="section-block"></div>', scratchpad: 'goya-asset://p1/x.png' }] });
  assert.strictEqual((await run(s)).called, 1, '[음성] 스크래치만 goya');
  const bad = fx(); fs.writeFileSync(bad.proj, '{잘림');
  assert.strictEqual((await run(bad)).called, 1, '[음성] 못 읽음은 막지 않는다');
  assert.match(readSrc(REPO, 'main.js'), /hasLocalImages: \(id\) => /);
});
test('④ 협업 안내: 변환 뒤 편집이 빠진다고 말한다', () => {
  const t = readSrc(REPO, 'js/collab/reasons.js').match(/local_images:\s*'([^']+)'/)[1];
  assert.match(t, /변환 뒤 편집은 빠집니다/); assert.match(t, /proj_pre-rollback\.json/);
});
test('④ 되돌리기 ×6: 최신 proj_pre-rollback 과 직전 본이 안 지워진다', () => {
  const f = fx(); const latest = [];
  for (let n = 40; n < 46; n++) {
    addImage(f, n); X.externalizeProjectFile(f.root, f.id);
    const d = JSON.parse(fs.readFileSync(f.proj, 'utf8')); d.work = n; fs.writeFileSync(f.proj, JSON.stringify(d)); latest.push(sha(f.proj));
    const t = Date.now(); while (Date.now() === t);
    assert.strictEqual(X.rollbackExternalize(f.root, f.id).ok, true);
    assert.strictEqual(sha(path.join(f.dir, 'proj_pre-rollback.json')), latest.at(-1));
  }
  const kept = fs.readdirSync(f.dir).filter((x) => /^proj_pre-rollback/.test(x)).map((x) => sha(path.join(f.dir, x)));
  assert.ok(kept.includes(latest.at(-2)), '직전 본이 회전으로 지워졌다');
});
test('⑤ 드레인 시한이면 되돌리기를 막되 잠금을 풀어 다시 시도할 수 있다', async () => {
  const src = readSrc(REPO, 'js/settings/settings-modal.js');
  let h; const rbBtn = { addEventListener: (_n, f) => { h = f; }, disabled: false }; const btn = { disabled: false };
  const st = []; let rolled = 0; let unsealed = 0;
  const window = { activeProjectId: 'p1', electronAPI: { externalizeRollback: async (o) => { if (!o.dryRun) rolled++; return { ok: true, dryRun: true }; } }, cancelPendingAutoSaveForReload: async () => false, resumeAutoSaveAfterAbortedReload: () => { unsealed++; }, location: { reload() {} } };
  new Function('window', 'rbBtn', 'btn', 'setStatus', 'confirm', 'setTimeout', src.slice(src.indexOf("rbBtn.addEventListener('click'"), src.indexOf("    btn.addEventListener('click', async () => {\n      if (typeof window.optimizeProjectImages")))(window, rbBtn, btn, (m) => st.push(m), () => true, () => {});
  await h();
  assert.strictEqual(rolled, 0); assert.strictEqual(unsealed, 1);
  assert.strictEqual(window.__optimizeImagesInFlight, false, '잠금이 남았다');
  assert.strictEqual(rbBtn.disabled, false); assert.strictEqual(btn.disabled, false);
  assert.match(st.at(-1), /저장 중이라 되돌리지 못했습니다/);
});
test('⑥ fsync 대상과 순서: 변환 전 본 → 에셋 → 새 proj.json, 각각 rename 앞', () => {
  const f = fx(); const fds = new Map(); const ev = [];
  const o = { open: fs.openSync, fsync: fs.fsyncSync, close: fs.closeSync, rename: fs.renameSync };
  fs.openSync = function (p, ...a) { const fd = o.open.call(this, p, ...a); fds.set(fd, String(p)); return fd; };
  fs.fsyncSync = function (fd) { ev.push('fsync ' + path.relative(f.dir, fds.get(fd))); return o.fsync.call(this, fd); };
  fs.renameSync = function (a, b) { ev.push('rename ' + path.relative(f.dir, String(b))); return o.rename.call(this, a, b); };
  try { assert.strictEqual(X.externalizeProjectFile(f.root, f.id).ok, true); }
  finally { fs.openSync = o.open; fs.fsyncSync = o.fsync; fs.renameSync = o.rename; }
  const at = (s) => { const i = ev.indexOf(s); assert.ok(i >= 0, `${s} 없음 — ${ev.join(' | ')}`); return i; };
  const bak = X.BACKUP_NAME, asset = ev.find((e) => /^rename assets\//.test(e)).slice(7);
  const seq = [at(`fsync ${asset}.tmp`), at(`rename ${asset}`), at(`fsync ${bak}.tmp`), at(`rename ${bak}`), at('fsync proj.json.tmp'), at('rename proj.json')];
  assert.deepStrictEqual(seq, [...seq].sort((x, y) => x - y), ev.join(' | '));
  const dirAfter = ev.slice(at('rename proj.json')).includes('fsync ');   // path.relative(dir, dir) === ''
  assert.ok(dirAfter, '폴더 fsync 없음: ' + ev.join(' | '));
});
test('⑥ 복구본 시험을 진짜 _pickLsOverFile 로: updatedAt 없는 파일은 복구본이 이기고, 되돌리기가 걷으면 파일이 이긴다', async () => {
  const store = new Map();
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const pick = new Function('localStorage', 'SAVE_KEY_PREFIX', '_lsBaseKey', '_lastOpenFallback', 'console', sliceBlock(readSrc(REPO, 'js/io/save-load.js'), 'function _pickLsOverFile(', '대상') + '\nreturn _pickLsOverFile;')(localStorage, 'web-editor-autosave', (i) => `web-editor-ls-base__${i}`, null, { warn() {} });
  const restored = { id: 'p1', version: 2, pages: [{ id: 'a', canvas: '<div class="section-block"></div>' }] };   // 마켓에서 받은 본: updatedAt 없음
  const set = () => { store.set('web-editor-autosave__p1', JSON.stringify({ version: 2, pages: [{ id: 'a', canvas: '<div class="section-block">변환본</div>' }] })); store.set('web-editor-autosave__p1_ts', String(Date.now())); store.set('web-editor-ls-base__p1', 'U'); };
  set();
  assert.ok(pick(restored, 'p1'), '재현: 걷지 않으면 복구본이 복원본을 이긴다');
  let api; const electron = { contextBridge: { exposeInMainWorld: (_n, a) => { api = api || a; } }, ipcRenderer: { invoke: async () => ({ ok: true }), on() {}, send() {}, sendSync() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(REPO, 'preload.js'), 'utf8'), { require: (m) => (m === 'electron' ? electron : {}), localStorage, console, process, Buffer, setTimeout });
  set();
  await api.externalizeRollback({ projectId: 'p1' });
  assert.strictEqual(pick(restored, 'p1'), null);
});
