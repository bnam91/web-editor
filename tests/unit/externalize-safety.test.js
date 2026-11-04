/* externalize-safety.test.js — 자동 변환 기본 켬 리뷰 ①~⑤ 의 자. 진짜 externalizer · main.js·preload.js 원문 · 작은 픽스처. 앱 값은 tests/tools/conv-measure.cjs.
 * 실행: node --test tests/unit/externalize-safety.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
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
test('① 새 파일을 쓰다 죽어도 proj.json 은 원본으로 남고 원본 사본도 있다', () => {
  const f = fx(); const orig = sha(f.proj);
  const crash = `const fs=require('fs');for(const k of ['writeFileSync','openSync']){const o=fs[k];fs[k]=function(p,...a){if(typeof p==='string'&&p.endsWith('proj.json.tmp'))process.kill(process.pid,'SIGKILL');return o.call(this,p,...a)}}
require(${JSON.stringify(XPATH)}).externalizeProjectFile(${JSON.stringify(f.root)},${JSON.stringify(f.id)});`;
  const r = spawnSync(process.execPath, ['-e', crash]);
  assert.strictEqual(r.signal, 'SIGKILL', '쓰기 자리까지 갔다');
  assert.strictEqual(fs.existsSync(f.proj), true, 'proj.json 이 사라졌다');
  assert.strictEqual(sha(f.proj), orig);
  assert.strictEqual(sha(f.pre), orig);
});
test('① 쓰기 실패: proj.json 그대로 · 변환 전 본을 남기지 않는다 · 정직한 실패', () => {
  const f = fx(); const orig = sha(f.proj); const o = fs.renameSync;
  fs.renameSync = function (a, b) { if (String(b).endsWith('proj.json')) throw new Error('boom'); return o.call(this, a, b); };
  let r; try { r = X.externalizeProjectFile(f.root, f.id); } finally { fs.renameSync = o; }
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'write_failed');
  assert.strictEqual(sha(f.proj), orig); assert.strictEqual(fs.existsSync(f.pre), false);
});
test('① 변환 전 본·새 파일을 디스크로 내린다(fsync)', () => {
  const f = fx(); const o = fs.fsyncSync; let n = 0;
  fs.fsyncSync = function (...a) { n++; return o.apply(this, a); };
  try { assert.strictEqual(X.externalizeProjectFile(f.root, f.id).ok, true); } finally { fs.fsyncSync = o; }
  assert.ok(n >= 3, `fsync ${n}번`);
});
test('④ 재변환이 쌓여도 최초 원본이 남는다', () => {
  const f = fx(); const first = sha(f.proj);
  assert.strictEqual(X.externalizeProjectFile(f.root, f.id).ok, true);
  for (let n = 20; n < 26; n++) { addImage(f, n); const t = Date.now(); while (Date.now() === t); assert.strictEqual(X.externalizeProjectFile(f.root, f.id).ok, true); }
  assert.ok(allShas(f).includes(first), '최초 원본이 회전으로 지워졌다');
  assert.ok(allShas(f).length <= 4, `쌓임 ${allShas(f).length}`);
});
test('③ 변환 표지가 없어도 되돌림 표지가 남아 재변환하지 않는다', () => {
  const f = fx(); X.externalizeProjectFile(f.root, f.id);
  fs.unlinkSync(f.meta);
  assert.strictEqual(X.rollbackExternalize(f.root, f.id).ok, true);
  assert.strictEqual(X.scanProjectFile(f.root, f.id).rolledBack, true);
});
test('③ [음성] 못 읽는 meta 를 되돌림이 덮지 않는다', () => {
  const f = fx(); X.externalizeProjectFile(f.root, f.id);
  fs.writeFileSync(f.meta, '{잘림');
  assert.strictEqual(X.rollbackExternalize(f.root, f.id).ok, true);
  assert.strictEqual(fs.readFileSync(f.meta, 'utf8'), '{잘림');
});
function preload(result) {
  const store = new Map(); let api;
  const electron = { contextBridge: { exposeInMainWorld: (_n, a) => { api = api || a; } }, ipcRenderer: { invoke: async () => result, on() {}, send() {}, sendSync() {} } };
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  vm.runInNewContext(fs.readFileSync(path.join(REPO, 'preload.js'), 'utf8'), { require: (m) => (m === 'electron' ? electron : {}), localStorage, console, process, Buffer, setTimeout });
  for (const s of ['', '_ts']) store.set('web-editor-autosave__p1' + s, 'x');
  store.set('web-editor-ls-base__p1', 'U');
  return { api, store };
}
test('② 되돌리기 성공이면 복구본을 걷는다: updatedAt 없는 파일에서 복구본이 복원본을 못 이긴다', async () => {
  const { api, store } = preload({ ok: true });
  await api.externalizeRollback({ projectId: 'p1' });
  assert.deepStrictEqual([...store.keys()], []);
});
test('② [음성] 미리보기·실패 되돌리기는 복구본을 안 건드린다', async () => {
  const a = preload({ ok: true }); await a.api.externalizeRollback({ projectId: 'p1', dryRun: true }); assert.strictEqual(a.store.size, 3);
  const b = preload({ ok: false }); await b.api.externalizeRollback({ projectId: 'p1' }); assert.strictEqual(b.store.size, 3);
});
test('② 봉인 중에는 닫기·종료 저장이 복원본을 덮지 않는다(저장 실패 기록이 남아 있어도)', () => {
  const src = readSrc(REPO, 'js/io/save-load.js');
  const need = (sealed, unsaved, failed) => new Function('_reloadSealTok', '_hasOwnUnsaved', '_lastSaveFailed', sliceBlock(src, 'function _unloadSaveNeeded(', '대상') + '\nreturn _unloadSaveNeeded("p");')(sealed, () => unsaved, () => failed);
  assert.strictEqual(need(1, false, true), false, '실패 기록 + 봉인');
  assert.strictEqual(need(1, true, true), false);
  assert.strictEqual(need(null, false, true), true, '[음성] 봉인 없으면 W-3-b 그대로');
  assert.strictEqual(need(null, true, false), true);
  assert.strictEqual(need(null, false, false), false);
  assert.match(src, /if \(!_unloadSaveNeeded\(activeProjectId\)\) return;/);
  assert.match(src, /if \(_reloadSealTok\) \{ answer\(\{ ok: true, reason: 'reload-seal' \}\); return; \}/);
});
test('② 되돌려도 원본 사본을 바로 지우지 않는다', () => {
  const f = fx(); const orig = sha(f.proj); X.externalizeProjectFile(f.root, f.id);
  assert.strictEqual(X.rollbackExternalize(f.root, f.id).ok, true);
  assert.strictEqual(sha(f.proj), orig);
  assert.strictEqual(fs.existsSync(f.pre), false, '되돌리기 대상은 아니다(버튼이 숨는다)');
  assert.ok(allShas(f).includes(orig), '원본 사본이 사라졌다');
  assert.strictEqual(X.scanProjectFile(f.root, f.id).hasBackup, false);
});
function mainInline(root) {
  const src = readSrc(REPO, 'main.js');
  return new Function('fs', 'path', 'PROJECTS_DIR', '_safeSeg', '_GOYA_ASSET_MIME', sliceBlock(src, 'function _readAssetDataUri(', '대상') + '\n' + sliceBlock(src, 'function _inlineGoyaAssets(', '대상') + '\nreturn _inlineGoyaAssets;')(fs, path, root, (s) => s, { png: 'image/png' });
}
test('⑤ 마켓: goya 그림을 data URL 로 되싣는다 · 없는 그림은 센다', () => {
  const root = mkTmpRoot('goya-extm-'); fs.mkdirSync(path.join(root, 'p1', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'p1', 'assets', 'a.png'), Buffer.from([1, 2, 3]));
  const inl = mainInline(root);
  const s = '{"c":"<img src=\\"goya-asset://p1/a.png\\"><i style=\\"background:url(&quot;goya-asset://p1/a.png&quot;)\\"></i>"}';
  const r = inl(s);
  assert.strictEqual(r.missing, 0); assert.strictEqual(r.data.includes('goya-asset://'), false);
  assert.strictEqual(r.data.split('data:image/png;base64,AQID').length - 1, 2);
  JSON.parse(r.data);
  const m = inl('<img src="goya-asset://p1/none.png"><img src="goya-asset://../x.png">');
  assert.strictEqual(m.missing, 2);
});
test('⑤ 마켓 올리기: 받는 쪽 본에 goya 주소가 없고 그림이 blob 으로 간다 · 없는 그림이면 안 올린다', async () => {
  const src = readSrc(REPO, 'main.js');
  const root = mkTmpRoot('goya-extm-'), repo = mkTmpRoot('goya-extr-');
  fs.mkdirSync(path.join(root, 'p1', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'p1', 'assets', 'a.png'), Buffer.alloc(3000, 9));
  let handler;
  new Function('fs', 'path', 'PROJECTS_DIR', '_safeSeg', '_GOYA_ASSET_MIME', '_crypto', 'ipcMain', '_ensureMarketRepo', '_safe', '_MAX_BYTES', '_BLOB_MIN', '_BLOB_RE', '_versionHash', '_rebuildMarketIndex', '_execFileP', '_pushWithRebase',
    ['function _readAssetDataUri(', 'function _inlineGoyaAssets(', 'function _blobsDir(', 'function _extractBlobs('].map((h) => sliceBlock(src, h, '대상')).join('\n') + '\n' + sliceBlock(src, "ipcMain.handle('market:push'", '대상') + ';')(
    fs, path, root, (x) => x, { png: 'image/png' }, crypto, { handle: (_c, f) => { handler = f; } }, async () => repo, (x) => x, 95 * 1048576, 2048, /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, () => 'v', () => {}, async () => {}, async () => ({ ok: true }));
  const push = (data, scratch) => handler(null, { account: 'a', id: 'p1', name: 'n', data, scratch });
  const r = await push('{"c":"<img src=\\"goya-asset://p1/a.png\\">"}', [{ src: 'goya-asset://p1/a.png' }]);
  assert.strictEqual(r.ok, true);
  const saved = JSON.parse(fs.readFileSync(path.join(repo, 'market', 'a', 'p1.json'), 'utf8'));
  assert.strictEqual(saved.data.includes('goya-asset://'), false); assert.ok(saved.data.includes('goditor-blob:'));
  assert.strictEqual(saved.scratch.includes('goya-asset://'), false); assert.strictEqual(saved.blobCount, 2);
  const bad = await push('{"c":"goya-asset://p1/none.png"}');
  assert.strictEqual(bad.ok, false); assert.match(bad.message, /찾지 못해/);
});
test('⑤ 협업: 변환된 프로젝트는 등록을 막고 까닭을 말한다', async () => {
  const src = readSrc(REPO, 'main/collab/index.js');
  const run = (meta) => { let called = 0; return new Function('getRef', 'call', '_deps', 'setRef', sliceBlock(src, 'async function register(', '대상') + '\nreturn register;')(() => null, async () => { called++; return { ok: false, reason: 'x' }; }, { readMeta: () => ({ externalized: meta }), readAuth: () => null }, () => {})({ projectId: 'p1' }).then((r) => ({ r, called })); };
  const a = await run({ at: 'x' }); assert.strictEqual(a.r.reason, 'externalized'); assert.strictEqual(a.called, 0);
  const b = await run(null); assert.strictEqual(b.called, 1);
  assert.ok(readSrc(REPO, 'js/collab/reasons.js').includes('externalized:'));
});
