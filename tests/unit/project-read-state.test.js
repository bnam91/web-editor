/* project-read-state.test.js — BOOT-CLEANUP-WIPES-CORRUPT-PROJECT-LS-01: main 의 좁은 창구(projects:read-state)가 «proj.json 은 있는데 못 읽음» 을 가른다
 * 왜: 부팅 LS 고아 정리는 목록 밖 id 의 LS 본을 지웠는데, 깨진 프로젝트(후보 0)도 목록 밖이다. 렌더러가 그 id 를 남기려면 main 이 «깨짐» 을 말해야 한다.
 * 기법: project-list-fallback-e168.test.js 와 같다 — main.js 에서 함수만 떼어 진짜 fs(임시 폴더) 위에 꽂는다.
 * 칸: S0 [전제] 깨짐+후보 0 은 목록에 없다(티켓의 길) · S1 깨짐+후보 0 → unreadable · S2 깨짐+성한 백업 → ok · S3 기획 → planning
 *     S4 proj.json 없음 → none · S5 id 꼴이 아니면 none(경로 탈출 막음) · S6 읽기만 — proj.json·폴더 그대로(사본 안 둠) · S7 id 가 폴더와 다름 → unreadable
 * 실행: node --test tests/unit/project-read-state.test.js */
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
const has = (name) => [`function ${name}(`, `const ${name} = `].some(p => MAIN_SRC.includes(p));
const fnSrc = (name) => { for (const pat of [`function ${name}(`, `const ${name} = `]) if (MAIN_SRC.includes(pat)) return sliceBlock(MAIN_SRC, pat, '검사가 «대상을 놓친» 것이지 통과가 아니다'); };
const FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath', '_resolveMetaJsonPath', '_resolveBackupJsonPath',
  '_ensureNewLayoutPaths', '_refreshListMeta', '_listItemFor', '_isListableProjectId', '_listProjectsImpl', '_SS', '_mtimeOr', 'readProjectWithFallback', '_savedAtLabel', '_projectReadState'];

/* needReadState:false — S0(전제)는 옛 main 의 목록 동작만 본다: 새 창구가 없어도 실어야 손실 확정 근거가 선다(인텔 d2e7c76c 양성대조에서 S0 이 이 단언에 걸려 빨갰다). */
function load(dir, { needReadState = true } = {}) {
  if (needReadState) assert.ok(has('_projectReadState'), '★main.js 에 _projectReadState 가 없다 — 깨진 프로젝트를 가를 창구가 없다(고치기 전 판)');
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const body = FNS.filter(has).map(fnSrc).join('\n\n');
  const R = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console',
    `let _ssMod = null, _ssTried = false; const _SS_FALLBACK = {};\n` + body + `\n; return { _listProjectsImpl, _projectReadState: typeof _projectReadState === 'function' ? _projectReadState : null };`)(fs, path, dir, req, { log() {}, warn() {}, error() {} });
  return R;
}
const GOOD = (id, extra = {}) => ({ id, name: '이름', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  pages: [{ id: 'page_1', canvas: '<div class="section-block"></div><div class="section-block"></div>' }], ...extra });
function scene(kind) {
  const dir = mkTmpRoot('gdt-readstate-'); const id = 'proj_1775644888001'; const p = path.join(dir, id);
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, 'proj_meta.json'), JSON.stringify({ id, listMetaV: 1, name: '메타 이름' }));
  const old = new Date(Date.now() - 60000); fs.utimesSync(path.join(p, 'proj_meta.json'), old, old);   // 메타 빠른 길 못 탐(티켓 L1 칸)
  const full = JSON.stringify(GOOD(id), null, 2);
  if (kind === 'corrupt' || kind === 'corrupt+backup') fs.writeFileSync(path.join(p, 'proj.json'), '{깨짐');
  if (kind === 'corrupt+backup') fs.writeFileSync(path.join(p, 'proj_backup.json'), full);
  if (kind === 'planning') fs.writeFileSync(path.join(p, 'proj.json'), JSON.stringify({ id, name: '기획', type: 'planning', plan: {} }));
  if (kind === 'none') fs.rmSync(path.join(p, 'proj_meta.json'));
  if (kind === 'idmismatch') fs.writeFileSync(path.join(p, 'proj.json'), JSON.stringify(GOOD('proj_9999999999999'), null, 2));
  return { dir, id, p };
}

test('S0 [전제] 깨짐+후보 0 은 목록에 없다 — 티켓의 길', () => {
  const { dir, id } = scene('corrupt');
  const R = load(dir, { needReadState: false });
  assert.equal(R._listProjectsImpl().some(x => x.id === id), false);
});
test('S1 ★깨짐+후보 0 → unreadable', () => { const { dir, id } = scene('corrupt'); assert.equal(load(dir)._projectReadState(id), 'unreadable'); });
test('S2 깨짐+성한 백업 → ok(목록에 있다)', () => { const { dir, id } = scene('corrupt+backup'); assert.equal(load(dir)._projectReadState(id), 'ok'); });
test('S3 기획 → planning', () => { const { dir, id } = scene('planning'); assert.equal(load(dir)._projectReadState(id), 'planning'); });
test('S4 proj.json 없음 → none', () => { const { dir, id } = scene('none'); assert.equal(load(dir)._projectReadState(id), 'none'); });
test('S5 id 꼴이 아니면 none(경로 탈출 막음)', () => { const { dir } = scene('corrupt'); assert.equal(load(dir)._projectReadState('../x'), 'none'); });
test('S6 읽기만 — proj.json·폴더 그대로', () => {
  const { dir, id, p } = scene('corrupt');
  const before = fs.readdirSync(p).sort();
  load(dir)._projectReadState(id);
  assert.deepEqual(fs.readdirSync(p).sort(), before);
  assert.equal(fs.readFileSync(path.join(p, 'proj.json'), 'utf8'), '{깨짐');
});
test('S7 읽히지만 id 가 폴더와 다르면(목록이 안 싣는다) unreadable — 남긴다', () => { const { dir, id } = scene('idmismatch'); assert.equal(load(dir)._projectReadState(id), 'unreadable'); });
