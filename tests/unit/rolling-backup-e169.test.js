/* rolling-backup-e169.test.js — E169: 깨진 proj.json 이 저장 한 번에 «성한 백업»을 덮던 것 (lane-drag · 2026-10-06 · 태양 승인 «태양 E169»)
 *
 * 실앱 실측(격리 9370 · 핀 dev 0f572e2a · 사본 · reports/lane-drag/wbit/RESULT.md):
 *   proj.json 100B(깨짐) + 성한 proj_backup.json(20 섹션) · 프로젝트 폴더 쓰기 막힘(= 디스크가 꽉 찼을 때의 대역)
 *   → 열기: 백업에서 옴 · 자가치유 재기록 EACCES(main.js projects:load 의 catch → warn 만)
 *   → 글 1 곳 고침 → 저장 1 → ★proj_backup.json = 깨진 100B 와 같은 바이트 · 디스크에 성한 판 0.
 *   대조(폴더 쓰기 가능): 자가치유 성공 → 백업 성함.
 * 기구: 롤링 복사 두 곳(_saveProjectImpl · projects:save-sync)이 직전 proj.json 을 «검사 없이» 백업으로 복사.
 * 고침: 한 함수 _rollBackup(prevPath, backupPath) — 직전 파일이 프로젝트로 읽히지 않으면 백업을 안 건드린다(복사를 «불렀고 거절»).
 *
 * ★기법 — folders-list-integration.test.js 와 같은 수법: main.js 에서 대상 함수·핸들러 몸통을 떼어 진짜 fs(임시 폴더) 위에서 돌린다.
 *   여기선 폴더를 막지 않는다 — 막지 않아도 «복사 → 쓰기» 순서라 백업은 이미 깨진 바이트가 된다(본체 쓰기 성패와 무관).
 * 실행: node --test tests/unit/rolling-backup-e169.test.js
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
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
  throw new Error(`★main.js 에 ${name} 이(가) 없다 — 이름이 바뀌었으면 이 검사도 «같이» 고쳐라`);
}
const has = (name) => [`async function ${name}(`, `function ${name}(`].some(p => MAIN_SRC.includes(p));
/** ipcMain.on('projects:save-sync', …); 문 전체 — 중괄호 균형 */
function saveSyncSrc() {
  const A = "ipcMain.on('projects:save-sync'";
  assert.equal(MAIN_SRC.split(A).length - 1, 1, 'projects:save-sync 핸들러는 하나여야 한다');
  const k = MAIN_SRC.indexOf(A); let i = MAIN_SRC.indexOf('{', k), d = 0;
  for (; i < MAIN_SRC.length; i++) { const c = MAIN_SRC[i]; if (c === '{') d++; else if (c === '}' && --d === 0) break; }
  return MAIN_SRC.slice(k, MAIN_SRC.indexOf(')', i) + 1) + ';';
}

// ★_rollBackup 은 «있으면» 싣는다 — base 에는 없다(그래서 ⒜ 가 «동작으로» 빨갛다).
const FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath', '_resolveMetaJsonPath',
  '_ensureNewLayoutPaths', '_refreshListMeta', '_guardProjectName', '_SS', '_rollBackup', '_saveProjectImpl'];

/** @param {{naive?:boolean}} o naive = 양성대조(공용 함수를 «검사 없이 복사»로 꺾음) */
function load(projectsDir, { naive = false } = {}) {
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const handlers = {};
  const ipcMain = { on: (ch, fn) => { handlers[ch] = fn; } };
  const calls = []; const warns = [];
  let body = FNS.filter(n => n !== '_rollBackup' || has('_rollBackup')).map(fnSrc).join('\n\n');
  if (naive) body += `\nfunction _rollBackup(prevPath, backupPath) { fs.copyFileSync(prevPath, backupPath); return { called: true, copied: true }; }`;
  // 부른 기록(⒝ — «불렸고 거절»을 «안 불림»과 가른다). 함수 선언은 다시 묶을 수 있는 이름이다.
  body += `\nif (typeof _rollBackup === 'function') { const __rb = _rollBackup; _rollBackup = function (...a) { const r = __rb(...a); __calls.push(r); return r; }; }`;
  const factory = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console', 'ipcMain', '__calls',
    `let _ssMod = null, _ssTried = false; const _SS_FALLBACK = {};\nconst syncClaudePmTitle = async () => {};\n` + body + '\n' + saveSyncSrc() +
    `\n; return { _saveProjectImpl };`);
  const R = factory(fs, path, projectsDir, req, { log() {}, warn: (...a) => warns.push(a.join(' ')), error() {} }, ipcMain, calls);
  return {
    calls, warns,
    save: (p) => R._saveProjectImpl(p),
    saveSync: (p) => { const ev = {}; handlers['projects:save-sync'](ev, p); return ev.returnValue; },
  };
}

const ID = 'proj_1775644888754';
const doc = (n, tag) => ({ id: ID, name: '이름', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  pages: [{ id: 'page_1', canvas: Array.from({ length: n }, () => `<div class="section-block">${tag}</div>`).join('') }] });
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
/** 실앱 장면: proj.json 깨짐(잘림) · 백업 성함(20 섹션) */
function scene({ broken = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-e169-')); const p = path.join(dir, ID);
  fs.mkdirSync(p, { recursive: true });
  const good = JSON.stringify(doc(20, '백업'), null, 2);
  fs.writeFileSync(path.join(p, 'proj_backup.json'), good);
  const cur = JSON.stringify(doc(19, '직전'), null, 2);
  fs.writeFileSync(path.join(p, 'proj.json'), broken ? good.slice(0, 100) : cur);
  return { dir, proj: path.join(p, 'proj.json'), backup: path.join(p, 'proj_backup.json'), cur };
}

test('전제 — 장면의 proj.json 은 정말 깨졌고 백업은 성하다', () => {
  const s = scene();
  assert.throws(() => JSON.parse(fs.readFileSync(s.proj, 'utf8')));
  assert.equal(JSON.parse(fs.readFileSync(s.backup, 'utf8')).pages.length, 1);
});

for (const [name, run] of [['save(_saveProjectImpl)', (R, d) => R.save(d)], ['save-sync', (R, d) => R.saveSync(d)]]) {
  test(`⒜ ★${name} — 깨진 proj.json + 저장 1 → 백업 바이트 그대로(sha)`, async () => {
    const s = scene(); const before = sha(s.backup);
    await run(load(s.dir), doc(20, '새'));
    assert.equal(sha(s.backup), before, '★성한 백업이 깨진 proj.json 으로 덮였다(실앱 ro 판: backup = 깨진 100B)');
  });
  test(`⒝ ★${name} — 백업 복사를 «불렀고 거절했다»(copied:false + 까닭) — 안 불림과 다르다`, async () => {
    const s = scene(); const R = load(s.dir);
    await run(R, doc(20, '새'));
    assert.equal(R.calls.length, 1, '★_rollBackup 이 안 불렸다(복사 자리를 우회했다)');
    assert.equal(R.calls[0].called, true);
    assert.equal(R.calls[0].copied, false);
    assert.ok(R.calls[0].reason, '거절 까닭이 비었다');
  });
  test(`음성대조 ${name} — 성한 proj.json + 저장 1 → 백업이 «직전 판»으로 바뀐다(백업을 죽이지 않았다)`, async () => {
    const s = scene({ broken: false }); const R = load(s.dir);
    await run(R, doc(20, '새'));
    // ★결과만 잰다 — base 에서도 초록이어야 한다(오늘 백업이 «되는» 길을 고침이 죽이지 않았나의 자).
    assert.equal(fs.readFileSync(s.backup, 'utf8'), s.cur, '★백업이 직전 proj.json 으로 안 바뀌었다');
  });
}

test('양성대조 — _rollBackup 을 «검사 없이 복사»로 꺾으면 두 소비자(save · save-sync) «둘 다» ⒜ 가 빨개진다', async () => {
  const red = [];
  for (const [name, run] of [['save', (R, d) => R.save(d)], ['save-sync', (R, d) => R.saveSync(d)]]) {
    const s = scene(); const before = sha(s.backup);
    await run(load(s.dir, { naive: true }), doc(20, '새'));
    if (sha(s.backup) !== before) red.push(name);
  }
  assert.deepEqual(red, ['save', 'save-sync']);
});

test('배선 ⑤ — 구르는 복사 2 자리 중 2 가 _rollBackup 경유 · 날 copyFileSync→backup 0 (main.js 전체)', () => {
  const bodies = { save: fnSrc('_saveProjectImpl'), 'save-sync': saveSyncSrc() };
  const via = Object.entries(bodies).filter(([, b]) => (b.match(/_rollBackup\(/g) || []).length === 1).map(([k]) => k);
  const raw = (MAIN_SRC.match(/copyFileSync\([^)]*\bbackup\b[^)]*\)/g) || []).filter(m => !/backupPath/.test(m));
  assert.deepEqual({ via: `${via.length}/2`, raw: raw.length }, { via: '2/2', raw: 0 }, `날 복사: ${JSON.stringify(raw)}`);
});

for (const [name, run] of [['save', (R, d) => R.save(d)], ['save-sync', (R, d) => R.saveSync(d)]]) {
  test(`④ ★${name} — 깨진 상태 + 저장 «3 번» → 백업 sha 그대로 · 거절 3 · 거절이 로그에 남는다(⒞)`, async () => {
    const s = scene(); const before = sha(s.backup); const R = load(s.dir);
    // 본체 쓰기가 성공하면 다음 저장의 «직전 판»은 성해진다 — 실앱(디스크 꽉 참)처럼 본체 쓰기도 실패하는 장면은 매번 깨진 판을 다시 깐다.
    for (let i = 0; i < 3; i++) { fs.writeFileSync(s.proj, fs.readFileSync(s.backup, 'utf8').slice(0, 100)); await run(R, doc(20, '새' + i)); }
    assert.equal(sha(s.backup), before);
    assert.deepEqual(R.calls.map(c => c.copied), [false, false, false]);
    assert.equal(R.warns.filter(w => w.includes('[rolling-backup]')).length, 3, `warn=${JSON.stringify(R.warns)}`);
  });
}
