/* recovery-notice-once-e170.test.js — E170: 디스크가 성할 때(흔한 경우) 복구 알림이 «사라지던» 것 (lane-drag · 2026-10-06 · 지디 ⑴ · 태양 «E170»)
 *
 * 실앱(격리 · 고친 판 78526440 · 사본 · rw 판 · 관찰자 양성대조 ✓): 깨진 proj.json + 성한 백업 → 폴백 로드 «1 번»(자가치유 성공) →
 *   에디터 본 열기(loadProject(id,{open:true}) · save-load.js 의 토스트 자리)는 이미 고쳐진 proj.json 을 읽어 _recovered 없음 → 토스트 0.
 *   부팅 때 loadProject 를 부르는 이가 여럿(branch-system · commit-system · font-substitute …)이고 그중 «누가» 먼저 폴백을 먹는지는 경합(미측정).
 * 고침: main 이 프로젝트별 «최근 복구됨» 표지를 들고 있다가 «다음 열기(open:true) 로드»에 «한 번» 실어 준다 — 누가 경합에서 이기든 성립.
 *   (열기 아닌 로드에 주면 토스트 안 띄우는 호출이 또 먹는다 → 열기에만.)
 * 실행: node --test tests/unit/recovery-notice-once-e170.test.js
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const MAIN_SRC = readSrc(REPO, 'main.js');
function fnSrc(name) {
  for (const pat of [`async function ${name}(`, `function ${name}(`, `const ${name} = `]) {
    if (MAIN_SRC.indexOf(pat) >= 0) return sliceBlock(MAIN_SRC, pat, '검사가 «대상을 놓친» 것이지 통과가 아니다');
  }
  throw new Error(`★main.js 에 ${name} 이(가) 없다`);
}
function saveSyncSrc() {
  const A = "ipcMain.on('projects:save-sync'"; const k = MAIN_SRC.indexOf(A); let i = MAIN_SRC.indexOf('{', k), d = 0;
  for (; i < MAIN_SRC.length; i++) { const c = MAIN_SRC[i]; if (c === '{') d++; else if (c === '}' && --d === 0) break; }
  return MAIN_SRC.slice(k, MAIN_SRC.indexOf(')', i) + 1) + ';';
}
function loadHandlerSrc() {
  const A = "ipcMain.handle('projects:load'";
  const k = MAIN_SRC.indexOf(A); let i = MAIN_SRC.indexOf('{', k), d = 0;
  for (; i < MAIN_SRC.length; i++) { const c = MAIN_SRC[i]; if (c === '{') d++; else if (c === '}' && --d === 0) break; }
  return MAIN_SRC.slice(k, MAIN_SRC.indexOf(')', i) + 1) + ';';
}
const FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath', '_resolveBackupJsonPath', '_ensureNewLayoutPaths', '_SS', '_mtimeOr', 'readProjectWithFallback', '_savedAtLabel',
  '_resolveMetaJsonPath', '_refreshListMeta', '_guardProjectName', '_rollBackup', '_saveProjectImpl']
  .filter(n => [`function ${n}(`, `const ${n} = `].some(p => MAIN_SRC.includes(p)));
/** main 쪽 상태(표지)는 «한 앱 실행» 동안 산다 — 한 loader = 한 실행 */
function app(projectsDir) {
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const handlers = {}; const on = {};
  // 표지 상태(있으면) — 핸들러 밖 최상위 선언이라 같이 떼어 온다
  const stateDecl = /const _recentRecovery = new Map\(\);/.test(MAIN_SRC) ? 'const _recentRecovery = new Map();\n' : '';
  const R = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console', 'ipcMain',
    `let _ssMod = null, _ssTried = false; const _SS_FALLBACK = {};\nconst _externalizeOnOpen = () => {};\n` + stateDecl +
    'const syncClaudePmTitle = async () => {};\n' + FNS.map(fnSrc).join('\n\n') + '\n' + loadHandlerSrc() + '\n' + saveSyncSrc() + '\n; return { _saveProjectImpl };')(fs, path, projectsDir, req, { log() {}, warn() {}, error() {} }, { handle: (ch, fn) => { handlers[ch] = fn; }, on: (ch, fn) => { on[ch] = fn; } });
  return { load: (id, opts) => handlers['projects:load']({}, id, opts), save: (p) => R._saveProjectImpl(p), saveSync: (p) => { const ev = {}; on['projects:save-sync'](ev, p); return ev.returnValue; } };
}
const ID = 'proj_1775644888754';
function scene({ broken = true, readOnly = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-e170-')); const p = path.join(dir, ID);
  fs.mkdirSync(p, { recursive: true });
  const good = JSON.stringify({ id: ID, name: 'n', pages: [{ id: 'page_1', canvas: '<div class="section-block"></div>' }] }, null, 2);
  fs.writeFileSync(path.join(p, 'proj_backup.json'), good);
  const t = new Date(2026, 9, 6, 2, 55); fs.utimesSync(path.join(p, 'proj_backup.json'), t, t);
  fs.writeFileSync(path.join(p, 'proj.json'), broken ? good.slice(0, 40) : good);
  if (readOnly) fs.chmodSync(p, 0o555);
  return { dir, backupAt: t.getTime(), undo: () => fs.chmodSync(p, 0o755) };
}
const OPEN = { open: true };

test('R1 ★디스크 성함 · 부팅 호출(열기 아님)이 먼저 폴백을 먹어도 — 그 뒤 «열기» 로드가 복구를 «한 번» 받는다', () => {
  const s = scene(); const A = app(s.dir);
  const first = A.load(ID);                // 경합에서 이긴 부팅 호출(열기 아님) — 폴백 · 자가치유 성공
  assert.equal(first._recovered, 'backup', '전제: 첫 로드가 폴백');
  const opened = A.load(ID, OPEN);         // 에디터 본 열기 — proj.json 은 이미 고쳐짐
  assert.deepEqual({ rec: opened._recovered, at: opened._recoveredAt, label: opened._recoveredAtLabel, healed: opened._healed }, { rec: 'backup', at: s.backupAt, label: String(new Date(s.backupAt).getMonth() + 1).padStart(2, '0') + '-' + String(new Date(s.backupAt).getDate()).padStart(2, '0') + ' ' + String(new Date(s.backupAt).getHours()).padStart(2, '0') + ':' + String(new Date(s.backupAt).getMinutes()).padStart(2, '0'), healed: true },
    '★열기 로드가 복구를 모른다(실앱 rw 판: 토스트 0)');
});

test('R2 ★N ≥ 3 연속 로드 — 열기 셋 · 열기 아님 셋 섞어도 «열기에» 딱 한 번', () => {
  const s = scene(); const A = app(s.dir);
  const seq = [undefined, undefined, OPEN, undefined, OPEN, OPEN].map(o => A.load(ID, o));
  const openReports = seq.filter((r, i) => [2, 4, 5].includes(i) && r._recovered).length;
  assert.equal(openReports, 1, `열기 로드가 복구를 받은 수=${openReports}`);
  assert.equal(seq[2]._recovered, 'backup', '첫 열기가 받는다');
});

test('R3 첫 로드가 «열기» 자신이면 그 안에서 알리고 · 다음 열기들은 0(두 번 알리지 않음)', () => {
  const s = scene(); const A = app(s.dir);
  const seq = [OPEN, OPEN, OPEN, undefined, OPEN].map(o => A.load(ID, o));
  assert.deepEqual(seq.map(r => !!r._recovered), [true, false, false, false, false]);
});

test('R4 ★음성대조 — 성한 proj.json 이면 표지 0 · 몇 번 열어도 «복구» 없음', () => {
  const s = scene({ broken: false }); const A = app(s.dir);
  const seq = [undefined, OPEN, OPEN, OPEN, undefined].map(o => A.load(ID, o));
  assert.deepEqual(seq.map(r => !!r._recovered), [false, false, false, false, false]);
});

test('R5 디스크를 못 고치면(쓰기 막힘) 열 때마다 사실대로 — 매번 폴백 · _healed:false (거짓 «한 번»으로 줄이지 않음)', () => {
  const s = scene({ readOnly: true });
  try {
    const A = app(s.dir);
    const seq = [undefined, OPEN, OPEN].map(o => A.load(ID, o));
    assert.deepEqual(seq.map(r => [r._recovered, r._healed]), [['backup', false], ['backup', false], ['backup', false]]);
  } finally { s.undo(); }
});

test('R6 앱을 새로 띄우면(새 실행) 표지는 없다 — 이미 알린 복구를 다음 실행에 또 말하지 않는다', () => {
  const s = scene(); const A = app(s.dir);
  A.load(ID); A.load(ID, OPEN);
  const B = app(s.dir);
  assert.equal(B.load(ID, OPEN)._recovered, undefined);
});

test('R2b ★«열기만» 셋 연속(앞에 부팅 호출이 폴백을 먹음) → 열기에 딱 한 번', () => {
  const s = scene(); const A = app(s.dir);
  const seq = [undefined, OPEN, OPEN, OPEN].map(o => A.load(ID, o));
  assert.deepEqual(seq.slice(1).map(r => !!r._recovered), [true, false, false]);
});

for (const [name, saveFn] of [['save', (A, p) => A.save(p)], ['save-sync', (A, p) => A.saveSync(p)]]) {
  test(`R7 ★표지 수명(지디) — 복구 → 안 열고 «성한 저장» 한 번(${name}) → 그 뒤 열기 = 알림 0 («그 뒤 작업은 없을 수 있습니다»가 거짓이 되므로)`, async () => {
    const s = scene(); const A = app(s.dir);
    A.load(ID);   // 부팅 호출이 폴백 · 자가치유
    await saveFn(A, { id: ID, name: 'n', pages: [{ id: 'page_1', canvas: '<div class="section-block">새</div>' }] });
    assert.equal(A.load(ID, OPEN)._recovered, undefined, '★성한 저장 뒤에도 «복구» 알림이 남았다');
  });
}
