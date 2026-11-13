/* save-sync-ok-after-write — SAVE-SYNC-FALSE-FAIL-AFTER-WRITE-01 (0.9.12 · 워커2 261113 관찰)
 * 왜: projects:save-sync 는 proj.json 을 쓴 «뒤» 후처리(_goneForget·_clearStalePendingFor·_recentRecovery.delete·_refreshListMeta)까지
 *   바깥 try 하나로 받았다 ⇒ 후처리가 던지면 이미 디스크에 들어간 저장을 ok:false + 실패 기록(마커·비상 사본)으로 보고했다
 *   (종료 때 거짓 «저장 실패» 상자 · 렌더러는 그 본을 «파일에 못 들어감»으로 남긴다).
 * 기법: main.js 몸통을 떼어 진짜 fs(임시 폴더) 위에서 돌린다(corrupt-unreadable · rolling-backup-e169 와 같다).
 *   후처리 하나(_recentRecovery.delete)를 던지는 놈으로 바꿔 «쓰기 뒤 예외»를 만든다 — 제품 코드는 안 건드린다.
 * 칸
 *   S1 쓰기 뒤 후처리가 던져도 ok:true · 파일에 새 글 · 실패 기록 0 · 경고 1
 *   S2 음성 — 쓰기 자체가 실패(프로젝트 폴더 자리가 파일 · ENOTDIR)하면 지금처럼 ok:false · 실패 기록 1(데이터 손실 쪽 가드 무변)
 *   S3 음성 — 평소(아무도 안 던짐)엔 ok:true · 후처리가 실제로 돈다(복구 표지가 걷힌다)
 *   A1 비동기 저장(_saveProjectImpl · projects:save) — 쓰기 뒤 후처리가 던져도 {ok:true} 로 풀린다 · 파일에 새 글 · 경고 1
 *   A2 음성 — 비동기도 쓰기 자체 실패는 지금처럼 거절(던짐)
 *   A3 음성 — 비동기 평소엔 {ok:true} · 후처리가 돈다
 * 양성대조: main.js 의 «쓰기 뒤 후처리» try { … } catch 를 걷어 옛 꼴로 되돌리면 — save-sync 쪽 → S1 빨강(ok:false 'exception' · 실패 기록 1) ·
 *   _saveProjectImpl 쪽 → A1 빨강(거절 '후처리 펑') · 음성 칸(S2·S3·A2·A3)은 초록.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { mkTmpRoot } = require('./_tmproot.js');

const REPO = path.join(__dirname, '..', '..');
const MAIN_SRC = readSrc(REPO, 'main.js');
const fnSrc = (name) => {
  for (const pat of [`async function ${name}(`, `function ${name}(`, `const ${name} = `]) if (MAIN_SRC.indexOf(pat) >= 0) return sliceBlock(MAIN_SRC, pat, '대상을 놓침');
  throw new Error(`★main.js 에 ${name} 이(가) 없다`);
};
const stmt = (A) => {
  assert.equal(MAIN_SRC.split(A).length - 1, 1, A);
  const k = MAIN_SRC.indexOf(A); let i = MAIN_SRC.indexOf('{', k), d = 0;
  for (; i < MAIN_SRC.length; i++) { const c = MAIN_SRC[i]; if (c === '{') d++; else if (c === '}' && --d === 0) break; }
  return MAIN_SRC.slice(k, MAIN_SRC.indexOf(')', i) + 1) + ';';
};
/* save-sync 가 부르는 것 전부(없으면 ReferenceError 가 바깥 catch 로 가 이 검사가 «거짓 빨강»이 된다 — int-0912-7 단위 빨강 교훈) */
const FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath', '_resolveMetaJsonPath', '_resolveBackupJsonPath', '_ensureNewLayoutPaths',
  '_refreshListMeta', '_guardProjectName', '_SS', '_mtimeOr', '_rollBackup', '_goneBaseRefusal', '_goneStamp', '_goneForget', '_clearStalePendingFor', '_saveProjectImpl'];

function load(dir, { throwAfterWrite = false } = {}) {
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const h = {}; const ipcMain = { handle: () => {}, on: (c, f) => { h[c] = f; } };
  const rec = { failures: [], warns: [], errors: [] };
  const recovery = new Map([[ID, { at: 1 }]]);
  if (throwAfterWrite) recovery.delete = () => { throw new Error('후처리 펑'); };
  const body = FNS.map(fnSrc).join('\n\n') + '\n' + stmt("ipcMain.on('projects:save-sync'");
  const R = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console', 'ipcMain', '_recentRecovery', '_recordSyncSaveFailure',
    'let _ssMod = null, _ssTried = false; const _SS_FALLBACK = {};\n'
    + 'const syncClaudePmTitle = async () => {}; const _isProjectDeleted = () => false; const _seenProjects = new Set(); const _goneRecreated = new Set();\n'
    + 'const quitSaveGuard = { peekPendingSyncFailure: () => null, takePendingSyncFailure: () => null }; const _callEachWindow = () => {};\n'
    + body + '\n; return { _saveProjectImpl };'
  )(fs, path, dir, req, { log() {}, warn: (...a) => rec.warns.push(a.join(' ')), error: (...a) => rec.errors.push(a.join(' ')) }, ipcMain, recovery,
    (p, reason) => { rec.failures.push(reason); });
  return { rec, recovery, saveSync: (p) => { const ev = {}; h['projects:save-sync'](ev, p); return ev.returnValue; }, save: (p) => R._saveProjectImpl(p) };
}
const ID = 'proj_1775644888754';
const doc = (tag) => ({ id: ID, name: '이름', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-11-13T00:00:00.000Z', pages: [{ id: 'page_1', canvas: `<div class="section-block">${tag}</div>` }] });
const projFile = (dir) => path.join(dir, ID, 'proj.json');

test('S1 쓰기 뒤 후처리가 던져도 성공으로 답한다 — 파일에 새 글 · 실패 기록 0 · 경고 1', () => {
  const dir = mkTmpRoot('gdt-ssok-');
  const R = load(dir, { throwAfterWrite: true });
  const r = R.saveSync(doc('새 글'));
  assert.ok(fs.existsSync(projFile(dir)), '[전제] proj.json 이 써졌다');
  assert.match(fs.readFileSync(projFile(dir), 'utf8'), /새 글/, '[전제] 새 글이 디스크에 있다');
  assert.deepStrictEqual(r, { ok: true }, `★디스크에 들어간 저장을 실패로 답했다: ${JSON.stringify(r)}`);
  assert.deepStrictEqual(R.rec.failures, [], '★성공한 저장에 실패 기록(마커·비상 사본)을 남겼다 — 종료 때 거짓 상자');
  assert.ok(R.rec.warns.some((w) => /후처리/.test(w) && /후처리 펑/.test(w)), `후처리 예외를 경고로 안 남겼다: ${JSON.stringify(R.rec.warns)}`);
});

test('S2 음성 — 쓰기 자체가 실패하면 지금처럼 거절 · 실패 기록 1', () => {
  const dir = mkTmpRoot('gdt-ssok-');
  fs.writeFileSync(path.join(dir, ID), '폴더 자리에 파일');   // <id>/proj.json 을 못 쓴다(ENOTDIR)
  const R = load(dir);
  const r = R.saveSync(doc('못 들어감'));
  assert.strictEqual(r.ok, false, `★쓰기 실패를 성공으로 답했다: ${JSON.stringify(r)}`);
  assert.strictEqual(r.reason, 'exception');
  assert.deepStrictEqual(R.rec.failures, ['exception'], '★쓰기 실패에 실패 기록이 없다 — 데이터 손실 쪽 가드가 약해졌다');
});

test('S3 음성 — 평소엔 성공 · 후처리가 실제로 돈다(복구 표지가 걷힌다)', () => {
  const dir = mkTmpRoot('gdt-ssok-');
  const R = load(dir);
  assert.ok(R.recovery.has(ID), '[전제] 복구 표지가 있다');
  const r = R.saveSync(doc('평소'));
  assert.deepStrictEqual(r, { ok: true });
  assert.strictEqual(R.recovery.has(ID), false, '★후처리가 안 돌았다 — 감싼 try 가 후처리를 건너뛴다');
  assert.deepStrictEqual(R.rec.failures, []);
  assert.deepStrictEqual(R.rec.warns.filter((w) => /후처리/.test(w)), []);
});

test('A1 비동기 저장 — 쓰기 뒤 후처리가 던져도 성공으로 풀린다 · 파일에 새 글 · 경고 1', async () => {
  const dir = mkTmpRoot('gdt-ssok-');
  const R = load(dir, { throwAfterWrite: true });
  const r = await R.save(doc('비동기 새 글'));
  assert.match(fs.readFileSync(projFile(dir), 'utf8'), /비동기 새 글/, '[전제] 새 글이 디스크에 있다');
  assert.deepStrictEqual(r, { ok: true }, `★디스크에 들어간 저장을 실패로 답했다: ${JSON.stringify(r)}`);
  assert.ok(R.rec.warns.some((w) => /\[projects:save\] 쓰기 뒤 후처리/.test(w) && /후처리 펑/.test(w)), `후처리 예외를 경고로 안 남겼다: ${JSON.stringify(R.rec.warns)}`);
});

test('A2 음성 — 비동기도 쓰기 자체가 실패하면 지금처럼 거절', async () => {
  const dir = mkTmpRoot('gdt-ssok-');
  fs.writeFileSync(path.join(dir, ID), '폴더 자리에 파일');
  const R = load(dir);
  await assert.rejects(() => R.save(doc('못 들어감')), '★쓰기 실패를 성공으로 풀었다 — 데이터 손실 쪽 가드가 약해졌다');
});

test('A3 음성 — 비동기 평소엔 성공 · 후처리가 돈다(복구 표지가 걷힌다)', async () => {
  const dir = mkTmpRoot('gdt-ssok-');
  const R = load(dir);
  const r = await R.save(doc('평소'));
  assert.deepStrictEqual(r, { ok: true });
  assert.strictEqual(R.recovery.has(ID), false, '★후처리가 안 돌았다');
  assert.deepStrictEqual(R.rec.warns.filter((w) => /후처리/.test(w)), []);
});
