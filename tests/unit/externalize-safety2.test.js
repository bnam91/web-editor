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
  const iq = src.indexOf('window.electronAPI.onForceSaveBeforeQuit(');
  let ser = 0; const stub = { serializeProject: () => { ser++; return '{}'; } };
  const head = sliceBlock(src, 'function _isReloadSealed(', '대상') + '\n' + sliceBlock(src, 'function _unloadSaveNeeded(', '대상') + '\n';
  new Function('window', 'IS_ELECTRON', 'activeProjectId', '_reloadSealTok', '_reloadSealId', '_hasOwnUnsaved', '_lastSaveFailed', 'serializeProject',
    head + src.slice(src.indexOf("window.addEventListener('beforeunload'"), src.indexOf('/* ── 종료 시 저장 결과')) + '\nif (IS_ELECTRON) {\n' + src.slice(iq, src.indexOf('\n  });\n', iq) + 6) + '\n}')(win, true, 'p1', 1, 'p1', () => true, () => true, stub.serializeProject);
  hs.beforeunload();
  assert.strictEqual(ser, 0, '닫기가 직렬화까지 갔다');
  await hs.quit();
  assert.strictEqual(ser, 0, '종료가 직렬화까지 갔다');
  assert.strictEqual(hs.answer.reason, 'reload-seal');
});
