/* unreadable-projects-list — 깨지고 후보도 없는 프로젝트를 «목록 밖 관리자 자리»로 (CORRUPT-PROJECT-NOT-FINDABLE-IN-APP-01)
 * 왜: _listItemFor 가 null 을 주면 목록·갤러리·+메뉴 어디에도 안 떠서 앱에서 찾을 길이 없었다.
 * 현빈 2026-11-10: 목록과 분리 · 관리자만 · 디스크 무이동.
 * 기법: main.js 몸통을 떼어 진짜 fs(임시 폴더) 위에서 돌린다(corrupt-unreadable 과 같다).
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
  '_refreshListMeta', '_SS', '_mtimeOr', 'readProjectWithFallback', '_savedAtLabel', '_isListableProjectId', '_listItemFor', '_listProjectsImpl', '_listUnreadableProjectsImpl'];

function load(dir, { admin = true } = {}) {
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const h = {}; const ipcMain = { handle: (c, f) => { h[c] = f; }, on: (c, f) => { h[c] = f; } };
  const shown = [];
  const shell = { showItemInFolder: (p) => shown.push(p) };
  const body = FNS.map(fnSrc).join('\n\n') + '\n' + stmt("ipcMain.handle('projects:list-unreadable'") + '\n' + stmt("ipcMain.handle('projects:reveal-unreadable'")
  ;
  const R = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console', 'ipcMain', 'shell', 'isAdminAuthorized',
    `let _ssMod = null, _ssTried = false; const _SS_FALLBACK = {};\nconst _isProjectDeleted = () => false;\n${body}\n; return { _listProjectsImpl };`
  )(fs, path, dir, req, { log() {}, warn() {}, error() {} }, ipcMain, shell, () => admin);
  return {
    list: () => R._listProjectsImpl(),
    unreadable: () => h['projects:list-unreadable'](),
    reveal: (id) => h['projects:reveal-unreadable']({}, id),
    shown,
  };
}

const doc = (id, name) => ({ id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  pages: [{ id: 'page_1', canvas: '<div class="section-block"><div class="text-block">본문</div><img src="a.png"><img src="b.png"></div>' }] });
const BAD = 'proj_1700000000001', OK = 'proj_1700000000002', HEALED = 'proj_1700000000003', PLAN = 'plan_1700000000004';
function scene() {
  const dir = mkTmpRoot('gdt-unreadable-');
  const put = (id, file, txt) => { fs.mkdirSync(path.join(dir, id), { recursive: true }); fs.writeFileSync(path.join(dir, id, file), txt); };
  // 깨짐 + 후보 0 (meta 는 proj.json 보다 낡게 — 빠른 길이 못 세운다)
  put(BAD, 'proj_meta.json', JSON.stringify({ name: '<img src=x onerror=1>깨진 상페' }));
  const old = new Date('2020-01-01'); fs.utimesSync(path.join(dir, BAD, 'proj_meta.json'), old, old);
  put(BAD, 'proj.json', JSON.stringify(doc(BAD, '깨진 상페')).slice(0, 70));
  put(OK, 'proj.json', JSON.stringify(doc(OK, '성한 상페')));
  put(HEALED, 'proj.json', '{깨짐');
  put(HEALED, 'proj_backup.json', JSON.stringify(doc(HEALED, '백업 있는 상페')));
  put(PLAN, 'proj.json', JSON.stringify({ id: PLAN, name: '기획', type: 'planning' }));
  put(`${OK}.bak_20260101`, 'proj.json', '{깨짐');   // 백업 사본 몫
  return dir;
}

test('U1 깨짐·후보 0 → 열 수 없는 목록에 1행(이름은 meta 그대로 · 크기) · 일반 목록에는 없음', () => {
  const dir = scene(); const m = load(dir);
  const r = m.unreadable();
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.items.map((x) => x.id), [BAD]);
  assert.strictEqual(r.items[0].name, '<img src=x onerror=1>깨진 상페');
  assert.ok(r.items[0].bytes > 0);
  assert.ok(!m.list().some((p) => p.id === BAD), '목록 계약 무변 — 깨진 것은 일반 목록에 안 든다');
});

test('N1~N4 백업 있는 것(목록이 «백업에서 읽음» 으로 맡음)·성한 것·기획·bak 사본은 0행', () => {
  const m = load(scene());
  const ids = m.unreadable().items.map((x) => x.id);
  for (const id of [OK, HEALED, PLAN, `${OK}.bak_20260101`]) assert.ok(!ids.includes(id), id);
  assert.ok(m.list().some((p) => p.id === HEALED), '대조 — 백업 있는 것은 일반 목록에 있다');
});

test('N5 디스크 무접촉 — 목록을 물어도 깨진 파일·폴더가 그대로', () => {
  const dir = scene(); const before = fs.readdirSync(path.join(dir, BAD)).sort();
  const bytes = fs.readFileSync(path.join(dir, BAD, 'proj.json'), 'utf8');
  load(dir).unreadable();
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, BAD)).sort(), before);
  assert.strictEqual(fs.readFileSync(path.join(dir, BAD, 'proj.json'), 'utf8'), bytes);
});

test('A1 관리자 아님 → 값 자체를 안 준다(not_admin) · Finder 도 거절', () => {
  const m = load(scene(), { admin: false });
  assert.deepStrictEqual(m.unreadable(), { ok: false, code: 'not_admin', items: [] });
  assert.strictEqual(m.reveal(BAD).code, 'not_admin');
  assert.deepStrictEqual(m.shown, []);
});

test('R1 Finder — 진짜 id 만 · 경로 탈출·없는 id 거절 · 맞으면 proj.json 을 가리킨다', () => {
  const dir = scene(); const m = load(dir);
  assert.strictEqual(m.reveal('../etc').code, 'bad_id');
  assert.strictEqual(m.reveal(`${OK}.bak_20260101`).code, 'bad_id');
  assert.strictEqual(m.reveal('proj_1799999999999').code, 'not_found');
  assert.deepStrictEqual(m.reveal(BAD), { ok: true });
  assert.deepStrictEqual(m.shown, [path.join(dir, BAD, 'proj.json')]);
});
