/* corrupt-unreadable — 파일이 깨지고 백업·히스토리도 없을 때: 없음과 가르고, 덮기 전에 옆에 둔다 (CORRUPT · 지디 결정)
 * 왜: 옛 판은 깨짐도 null 이라 빈 프로젝트로 열리고 첫 편집이 깨진 파일을 덮었다(앱 고친 판 6/6 · 앞 판 12/12 · 15.7MB → 2.8KB · ~/gd-lane/imac-gd-L1/363d GXZ).
 * 기법: main.js 몸통을 떼어 진짜 fs(임시 폴더) 위에서 돌린다(rolling-backup-e169 와 같다).
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
const FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath', '_resolveMetaJsonPath', '_resolveBackupJsonPath', '_ensureNewLayoutPaths',
  '_refreshListMeta', '_guardProjectName', '_SS', '_mtimeOr', 'readProjectWithFallback', '_savedAtLabel', '_rollBackup', '_saveProjectImpl',
  ...(MAIN_SRC.includes('function _goneBaseRefusal(') ? ['_goneBaseRefusal'] : [])];   /* MISSING-FOLDER — 두 저장 길이 _goneBaseRefusal(최상위 _goneRecreated)을 부른다 — 있으면 같이 싣는다(옛 판엔 없다 · FOREIGN-ASSET ca2f1ae9 와 같은 꼴) */

function load(dir) {
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const h = {}; const ipcMain = { handle: (c, f) => { h[c] = f; }, on: (c, f) => { h[c] = f; } };
  const body = FNS.map(fnSrc).join('\n\n') + '\n' + stmt("ipcMain.handle('projects:load'") + '\n' + stmt("ipcMain.on('projects:save-sync'");
  const R = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console', 'ipcMain',
    `let _ssMod = null, _ssTried = false; const _SS_FALLBACK = {};\nconst syncClaudePmTitle = async () => {}; const _isProjectDeleted = () => false; const _seenProjects = new Set(); const _externalizeOnOpen = () => {}; const _recentRecovery = new Map(); const _recordSyncSaveFailure = () => {}; const _goneRecreated = new Set();\n${body}\n; return { _saveProjectImpl };`
  )(fs, path, dir, req, { log() {}, warn() {}, error() {} }, ipcMain);
  return {
    open: (id) => h['projects:load']({}, id, { open: true }),
    read: (id) => h['projects:load']({}, id),
    save: (p) => R._saveProjectImpl(p),
    saveSync: (p) => { const ev = {}; h['projects:save-sync'](ev, p); return ev.returnValue; },
  };
}
const ID = 'proj_1775644888754';
const doc = (tag) => ({ id: ID, name: '이름', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', pages: [{ id: 'page_1', canvas: `<div class="section-block">${tag}</div>` }] });
const BROKEN = JSON.stringify(doc('옛')).slice(0, 60);
function scene({ cur = BROKEN, backup = null, history = null } = {}) {
  const dir = mkTmpRoot('gdt-corrupt-'); const p = path.join(dir, ID); fs.mkdirSync(p, { recursive: true });
  if (cur != null) fs.writeFileSync(path.join(p, 'proj.json'), cur);
  if (backup) fs.writeFileSync(path.join(p, 'proj_backup.json'), backup);
  if (history) { fs.mkdirSync(path.join(p, 'proj_history')); fs.writeFileSync(path.join(p, 'proj_history', '1700000000000.json'), history); }
  return { dir, p, proj: path.join(p, 'proj.json'), side: () => fs.readdirSync(p).filter(f => f.startsWith('proj_corrupt_')) };
}

test('U1 깨짐·후보 없음 + 열기 → 못 읽음으로 답하고, 원본은 그대로 · 옆에 같은 바이트', () => {
  const s = scene(); const r = load(s.dir).open(ID);
  assert.strictEqual(r._unreadable, true, '★없음과 안 갈랐다');
  assert.strictEqual(fs.readFileSync(s.proj, 'utf8'), BROKEN);
  assert.deepStrictEqual(s.side(), [r.preservedAs]);
  assert.strictEqual(fs.readFileSync(path.join(s.p, r.preservedAs), 'utf8'), BROKEN);
});
test('U2b 기획 프로젝트 열기 → 못 연다고 답하고 파일 그대로 · 저장 병합용 로드는 그대로 null', () => {
  const plan = JSON.stringify({ id: ID, name: '기획', type: 'planning', extra: 1 });
  const s = scene({ cur: plan }); const R = load(s.dir);
  assert.deepStrictEqual(R.open(ID), { _planning: true });
  assert.strictEqual(R.read(ID), null);
  assert.strictEqual(fs.readFileSync(s.proj, 'utf8'), plan);
  assert.deepStrictEqual(s.side(), []);
});
test('U2c 기획 파일 옆 모양 있는 백업이 있어도 로드가 그 위로 안 쓴다 — 열기·비열기 둘 다', () => {
  const plan = JSON.stringify({ id: ID, name: '기획', type: 'planning' });
  for (const how of ['open', 'read']) {
    const s = scene({ cur: plan, backup: JSON.stringify(doc('옛')) }); const R = load(s.dir);
    assert.deepStrictEqual(R[how](ID), how === 'open' ? { _planning: true } : null);
    assert.strictEqual(fs.readFileSync(s.proj, 'utf8'), plan, '★' + how + ' 가 기획 파일을 덮었다');
  }
});
test('U2d 기획 파일은 저장이 못 덮는다 — 비동기·동기', async () => {
  const plan = JSON.stringify({ id: ID, name: '기획', type: 'planning' });
  const s = scene({ cur: plan }); const R = load(s.dir);
  assert.strictEqual((await R.save(doc('새'))).reason, 'planning_not_editor');
  assert.strictEqual(R.saveSync(doc('새')).reason, 'planning_not_editor');
  assert.strictEqual(fs.readFileSync(s.proj, 'utf8'), plan);
});
test('U2 [음성] 프로젝트 꼴이 아닌 JSON 은 깨짐이 아니다 — null · 옆 파일 없음 · 저장에도 옆 파일 없음', async () => {
  const plan = JSON.stringify({ id: ID, name: '이름', type: 'other' });
  const s = scene({ cur: plan }); const R = load(s.dir);
  assert.strictEqual(R.open(ID), null);
  assert.deepStrictEqual(s.side(), []);
  const r = await R.save(doc('새'));
  assert.notStrictEqual(r.ok, false);
  assert.deepStrictEqual(s.side(), []);
});
/* 진짜 fs 위에서 그 파일 읽기만 막는다 — times 번 뒤엔 풀린다 */
function blockRead(file, code, times = Infinity) {
  const real = fs.readFileSync; let n = 0;
  fs.readFileSync = function (p, ...a) { if (p === file && n < times) { n++; throw Object.assign(new Error(code), { code }); } return real.call(fs, p, ...a); };
  return { undo: () => { fs.readFileSync = real; }, count: () => n };
}
for (const code of ['EMFILE', 'EBUSY', 'EACCES']) {
  test(`U12 ${code} 가 안 풀리면 깨짐이 아니다 — 못 읽음으로 답하고 파일·백업 그대로 · 옆 파일 없음`, () => {
    const good = JSON.stringify(doc('성')); const s = scene({ cur: good, backup: JSON.stringify(doc('옛백업')) });
    const b = blockRead(s.proj, code); let r;
    try { r = load(s.dir).open(ID); } finally { b.undo(); }
    assert.strictEqual(r._readError, code);
    assert.strictEqual(r._unreadable, undefined);
    assert.strictEqual(fs.readFileSync(s.proj, 'utf8'), good, '★낡은 백업으로 덮었다');
    assert.deepStrictEqual(s.side(), []);
  });
}
test('U13 잠깐 막힌 것은 다시 읽어 그대로 연다', () => {
  const s = scene({ cur: JSON.stringify(doc('성')) });
  const b = blockRead(s.proj, 'EMFILE', 2); let r;
  try { r = load(s.dir).open(ID); } finally { b.undo(); }
  assert.strictEqual(r._readError, undefined);
  assert.strictEqual(r.pages.length, 1);
  assert.strictEqual(b.count(), 2);
});
test('U14 EACCES 는 다시 안 읽는다(풀릴 일이 아니다)', () => {
  const s = scene({ cur: JSON.stringify(doc('성')) });
  const b = blockRead(s.proj, 'EACCES'); try { load(s.dir).open(ID); } finally { b.undo(); }
  assert.strictEqual(b.count(), 1);
});
test('U15 [음성] 저장 병합용 로드는 못 읽어도 있는 후보를 준다 · 안 덮는다', () => {
  const good = JSON.stringify(doc('성')); const s = scene({ cur: good, backup: JSON.stringify(doc('옛백업')) });
  const b = blockRead(s.proj, 'EBUSY'); let r;
  try { r = load(s.dir).read(ID); } finally { b.undo(); }
  assert.ok(JSON.stringify(r).includes('옛백업'));
  assert.strictEqual(r._recovered, undefined);
  assert.strictEqual(fs.readFileSync(s.proj, 'utf8'), good);
});
for (const [name, run] of [['save', (R, d) => R.save(d)], ['save-sync', (R, d) => R.saveSync(d)]]) {
  test(`U16 ${name} — 직전 판을 못 읽어도 거절하지 않는다(성한 메모리) · 옆 파일 없음 · 백업 그대로`, async () => {
    const old = JSON.stringify(doc('옛백업')); const s = scene({ cur: JSON.stringify(doc('성')), backup: old });
    const b = blockRead(s.proj, 'EACCES'); let r;
    try { r = await run(load(s.dir), doc('새')); } finally { b.undo(); }
    assert.notStrictEqual(r.ok, false);
    assert.ok(fs.readFileSync(s.proj, 'utf8').includes('새'));
    assert.deepStrictEqual(s.side(), []);
    assert.strictEqual(fs.readFileSync(path.join(s.p, 'proj_backup.json'), 'utf8'), old);
  });
}
test('U3 [음성] 없음(새 프로젝트) → 그대로 null · 옆 파일 없음', () => {
  const s = scene({ cur: null });
  assert.strictEqual(load(s.dir).open(ID), null);
  assert.deepStrictEqual(s.side(), []);
});
test('U4 [음성] 저장 병합용 로드(open 아님)는 그대로 null · 옆 파일 없음', () => {
  const s = scene();
  assert.strictEqual(load(s.dir).read(ID), null);
  assert.deepStrictEqual(s.side(), []);
});
test('U5 [음성] 성한 파일 → 표식도 옆 파일도 없다', () => {
  const s = scene({ cur: JSON.stringify(doc('성')) }); const r = load(s.dir).open(ID);
  assert.strictEqual(r._unreadable, undefined);
  assert.strictEqual(r.pages.length, 1);
  assert.deepStrictEqual(s.side(), []);
});
for (const [name, opt] of [['백업', 'backup'], ['히스토리', 'history']]) {
  test(`U6 [음성] 성한 ${name} → 복구 길 그대로(표식·자가치유) · 깨진 판은 옆에 남는다`, () => {
    const s = scene({ [opt]: JSON.stringify(doc('복구')) }); const r = load(s.dir).open(ID);
    assert.strictEqual(r._unreadable, undefined);
    assert.strictEqual(r._recovered, opt);
    assert.strictEqual(r._healed, true);
    assert.ok(fs.readFileSync(s.proj, 'utf8').includes('복구'), '★자가치유가 안 됐다');
    assert.strictEqual(s.side().length, 1, '★덮기 전에 옆에 안 뒀다');
    assert.strictEqual(fs.readFileSync(path.join(s.p, s.side()[0]), 'utf8'), BROKEN);
  });
}
for (const [name, run] of [['save', (R, d) => R.save(d)], ['save-sync', (R, d) => R.saveSync(d)]]) {
  test(`U7 ${name} 가 깨진 판을 덮으면 옆에 먼저 둔다`, async () => {
    const s = scene(); const r = await run(load(s.dir), doc('새'));
    assert.notStrictEqual(r.ok, false);
    assert.ok(fs.readFileSync(s.proj, 'utf8').includes('새'));
    assert.strictEqual(s.side().length, 1, '★말없이 덮었다');
    assert.strictEqual(fs.readFileSync(path.join(s.p, s.side()[0]), 'utf8'), BROKEN);
  });
  test(`U8 ${name} — 옆에 못 두면 덮지 않는다`, async () => {
    const s = scene(); const R = load(s.dir); const real = fs.copyFileSync;
    fs.copyFileSync = () => { throw Object.assign(new Error('막음'), { code: 'ENOSPC' }); };
    let r; try { r = await run(R, doc('새')); } finally { fs.copyFileSync = real; }
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'unreadable_not_preserved');
    assert.strictEqual(fs.readFileSync(s.proj, 'utf8'), BROKEN);
  });
  test(`U9 [음성] ${name} — 성한 판을 덮을 땐 옆 파일이 안 생긴다`, async () => {
    const s = scene({ cur: JSON.stringify(doc('성')) }); await run(load(s.dir), doc('새'));
    assert.deepStrictEqual(s.side(), []);
  });
}
test('U10 자가치유 때 옆에 못 두면 덮지 않고 healed:false', () => {
  const s = scene({ backup: JSON.stringify(doc('복구')) }); const R = load(s.dir); const real = fs.copyFileSync;
  fs.copyFileSync = () => { throw new Error('막음'); };
  let r; try { r = R.open(ID); } finally { fs.copyFileSync = real; }
  assert.strictEqual(r._recovered, 'backup');
  assert.strictEqual(r._healed, false);
  assert.strictEqual(fs.readFileSync(s.proj, 'utf8'), BROKEN);
});
test('U11 같은 판을 여러 번 열어도 옆 파일은 한 벌 · 복구 후보에 안 든다', () => {
  const s = scene(); const R = load(s.dir);
  R.open(ID); const again = R.open(ID);
  assert.strictEqual(s.side().length, 1);
  assert.strictEqual(again._unreadable, true, '★옆 파일이 복구 후보로 먹혔다');
});
test('U17 복사 중 끊기면 이름 붙은 사본이 없다 · 다음 번에 온전히 둔다', () => {
  const s = scene(); const R = load(s.dir); const real = fs.copyFileSync;
  fs.copyFileSync = (a, b) => { fs.writeFileSync(b, 'x'); throw Object.assign(new Error('끊김'), { code: 'EIO' }); };
  let r; try { r = R.open(ID); } finally { fs.copyFileSync = real; }
  assert.strictEqual(r.preservedAs, null);
  assert.deepStrictEqual(s.side(), [], '★잘린 사본에 이름이 붙었다');
  const again = R.open(ID);
  assert.strictEqual(fs.readFileSync(path.join(s.p, again.preservedAs), 'utf8'), BROKEN);
});
test('U18 이미 있는 잘린 사본을 믿지 않는다 — 다시 둔다', async () => {
  const s = scene(); const m = Math.trunc(fs.statSync(s.proj).mtimeMs);
  fs.writeFileSync(path.join(s.p, `proj_corrupt_${m}.json`), 'x');
  await load(s.dir).save(doc('새'));
  assert.strictEqual(fs.readFileSync(path.join(s.p, `proj_corrupt_${m}.json`), 'utf8'), BROKEN, '★잘린 사본을 믿고 원본을 덮었다');
});
