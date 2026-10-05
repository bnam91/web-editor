/* project-list-fallback-e168.test.js — E168: proj.json 이 깨지면 목록에서 카드가 «사라지던» 것 (lane-drag · 2026-10-06 · 지디 ⒜ 승인)
 *
 * 실앱 실측(dev 0f572e2a · 격리 · 사본): proj.json 100B + 성한 proj_backup.json → 목록 카드 0 · 같은 id 를 URL 로 열면 백업 폴백 ✓.
 * 기구: 목록 _listItemFor 의 풀파싱 줄이 던지고 → _listProjectsImpl 의 catch {} 가 «말없이» 건너뛴다. 로드(projects:load)만 폴백 체인.
 * 고침(지디 ㉠): 폴백을 «한 함수» readProjectWithFallback 에 두고 로드·목록이 «둘 다» 부른다(⛔복사).
 *
 * ★기법 — folders-list-integration.test.js 와 같은 수법: main.js 에서 대상 함수만 떼어 진짜 fs(임시 폴더) 위에 꽂는다.
 *   projects:load 는 핸들러라 몸통을 떠서 가짜 ipcMain 에 건다.
 * 실행: node --test tests/unit/project-list-fallback-e168.test.js
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
const has = (name) => [`async function ${name}(`, `function ${name}(`, `const ${name} = `].some(p => MAIN_SRC.includes(p));
function fnSrc(name) {
  for (const pat of [`async function ${name}(`, `function ${name}(`, `const ${name} = `]) {
    if (MAIN_SRC.indexOf(pat) >= 0) return sliceBlock(MAIN_SRC, pat, '검사가 «대상을 놓친» 것이지 통과가 아니다');
  }
  throw new Error(`★main.js 에 ${name} 이(가) 없다 — 이름이 바뀌었으면 이 검사도 «같이» 고쳐라`);
}
/** projects:load 핸들러 문 전체(ipcMain.handle(…); 까지) — 중괄호 균형 */
function loadHandlerSrc() {
  const A = "ipcMain.handle('projects:load'";
  assert.equal(MAIN_SRC.split(A).length - 1, 1, 'projects:load 핸들러는 하나여야 한다');
  const k = MAIN_SRC.indexOf(A); let i = MAIN_SRC.indexOf('{', k), d = 0;
  for (; i < MAIN_SRC.length; i++) { const c = MAIN_SRC[i]; if (c === '{') d++; else if (c === '}' && --d === 0) break; }
  return MAIN_SRC.slice(k, MAIN_SRC.indexOf(')', i) + 1) + ';';
}
// ★새 함수(readProjectWithFallback)는 «있으면» 같이 싣는다 — base 에선 없다(그래서 L1 이 «동작으로» 빨갛다).
const FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath', '_resolveMetaJsonPath', '_resolveBackupJsonPath',
  '_ensureNewLayoutPaths', '_refreshListMeta', '_listItemFor', '_isListableProjectId', '_listProjectsImpl', '_SS', '_mtimeOr', 'readProjectWithFallback', '_savedAtLabel'].filter(n => [`function ${n}(`, `const ${n} = `].some(p => MAIN_SRC.includes(p)));

function load(projectsDir, { breakShared = false } = {}) {
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const handlers = {};
  const ipcMain = { handle: (ch, fn) => { handlers[ch] = fn; } };
  let body = FNS.filter(has).map(fnSrc).join('\n\n');
  if (breakShared) {   // ★양성대조: 공용 함수를 «proj.json 만 읽기»로 꺾는다 → 로드·목록 «둘 다» 빨개져야 한다
    body += `\nfunction readProjectWithFallback(id) { const p = _resolveProjectJsonPath(id); if (!p) return null;
      const proj = JSON.parse(fs.readFileSync(p, 'utf8')); return { proj, from: 'proj', path: p, savedAt: fs.statSync(p).mtimeMs, healed: true }; }`;
  }
  const factory = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console', 'ipcMain',
    `let _ssMod = null, _ssTried = false; const _SS_FALLBACK = {};\nconst _externalizeOnOpen = () => {};\n` + (/const _recentRecovery = new Map\(\);/.test(MAIN_SRC) ? 'const _recentRecovery = new Map();\n' : '') + body + '\n' + loadHandlerSrc() +
    `\n; return { _listProjectsImpl };`);
  const R = factory(fs, path, projectsDir, req, { log() {}, warn() {}, error() {} }, ipcMain);
  return { list: () => R._listProjectsImpl(), loadProj: (id) => handlers['projects:load']({}, id) };
}

const GOOD = (id) => ({ id, name: '백업 이름', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  pages: [{ id: 'page_1', canvas: '<div class="section-block"></div><div class="section-block"></div>' }] });
/** 실앱 장면 그대로: proj.json 100B(잘림) · 성한 백업 · meta 는 proj.json 보다 낡음(빠른 길 못 탐) */
function scene() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-e168-')); const id = 'proj_1775644888754'; const p = path.join(dir, id);
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, 'proj_meta.json'), JSON.stringify({ id, listMetaV: 1, name: '메타 이름' }));
  const old = new Date(Date.now() - 60000); fs.utimesSync(path.join(p, 'proj_meta.json'), old, old);
  const full = JSON.stringify(GOOD(id), null, 2);
  fs.writeFileSync(path.join(p, 'proj_backup.json'), full);
  fs.writeFileSync(path.join(p, 'proj.json'), full.slice(0, 100));
  return { dir, id };
}

test('전제 — 장면의 proj.json 은 정말 깨졌고 백업은 성하다', () => {
  const { dir, id } = scene();
  assert.throws(() => JSON.parse(fs.readFileSync(path.join(dir, id, 'proj.json'), 'utf8')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, id, 'proj_backup.json'), 'utf8')).pages.length, 1);
});

test('L1 ★깨진 proj.json + 성한 백업 → 목록에 카드가 «있다»(백업에서 읽음 · 표시 from=backup)', () => {
  const { dir, id } = scene();
  const it = load(dir).list().find(x => x.id === id);
  assert.ok(it, '★카드가 목록에서 사라졌다(실앱 dev 0f572e2a 실측과 같음)');
  assert.equal(it.recoveredFrom, 'backup', '폴백으로 세운 카드는 표시를 단다(말없는 복구 금지)');
  assert.equal(typeof it.recoveredAt, 'number', '배지 title 에 백업 저장 시각');
  assert.match(String(it.recoveredAtLabel), /^\d{2}-\d{2} \d{2}:\d{2}$/, '★배지 시각 글자는 main 이 만든다(한 helper)');
});

test('L2 ★목록은 «읽기만» — 두 번 그려도 proj.json · meta 그대로(자가치유는 열 때만 · 두 번째도 표시 유지)', () => {
  const { dir, id } = scene();
  const before = fs.readFileSync(path.join(dir, id, 'proj.json')); const metaBefore = fs.readFileSync(path.join(dir, id, 'proj_meta.json'));
  load(dir).list(); load(dir).list();
  assert.deepEqual(fs.readFileSync(path.join(dir, id, 'proj.json')), before, 'proj.json 이 바뀌었다(목록은 읽기만)');
  // ★meta 를 백업 내용으로 다시 쓰면 다음 목록이 빠른 길로 «표시 없는» 카드를 세운다 → 말없는 복구
  assert.deepEqual(fs.readFileSync(path.join(dir, id, 'proj_meta.json')), metaBefore, 'meta 가 바뀌었다(폴백 카드는 meta 를 안 고친다)');
});

test('D1 ★같은 장면을 «열면»(projects:load) 백업에서 오고 · 섹션 수 == 백업 · 저장 시각을 함께 준다', () => {
  const { dir, id } = scene();
  const proj = load(dir).loadProj(id);
  assert.ok(proj && Array.isArray(proj.pages), '열기 실패');
  assert.equal((proj.pages[0].canvas.match(/section-block/g) || []).length, 2);
  assert.equal(proj._recovered, 'backup');
  assert.equal(typeof proj._recoveredAt, 'number', '백업 저장 시각(그 파일 mtime) — 알림 글에 쓴다');
});

test('L3 성한 proj.json 은 지금과 같다 — 표시 없음(음성대조)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-e168n-')); const id = 'proj_1775644888754';
  fs.mkdirSync(path.join(dir, id), { recursive: true }); fs.writeFileSync(path.join(dir, id, 'proj.json'), JSON.stringify(GOOD(id)));
  const it = load(dir).list().find(x => x.id === id);
  assert.ok(it); assert.equal(it.recoveredFrom, undefined);
});

test('W1 ★한 함수 — 로드 핸들러와 _listItemFor 가 «둘 다» readProjectWithFallback 을 부르고, 로드 몸통엔 후보 루프 사본이 없다', () => {
  assert.ok(has('readProjectWithFallback'), '공용 함수가 없다');
  assert.match(loadHandlerSrc(), /readProjectWithFallback\(/);
  assert.match(fnSrc('_listItemFor'), /readProjectWithFallback\(/);
  assert.doesNotMatch(loadHandlerSrc(), /loadFallbackCandidates\(/, '★로드 몸통에 후보 루프가 남았다 = 사본');
});

test('P1 ★양성대조 — 공용 함수를 꺾으면 목록(L1) «과» 로드(D1) 가 둘 다 빨개진다', () => {
  const { dir, id } = scene();
  const R = load(dir, { breakShared: true });
  const listed = R.list().find(x => x.id === id);
  let loaded = null; try { loaded = R.loadProj(id); } catch (_) { loaded = null; }
  assert.deepEqual({ list: !!listed, loadFromBackup: loaded?._recovered === 'backup' }, { list: false, loadFromBackup: false });
});

test('W2 ★카드 표시 — 목록 카드가 recoveredFrom 이면 «기존 배지 꼴»(.folder-badge)로 «백업에서 읽음» + title 에 저장 시각', () => {
  const html = readSrc(REPO, 'pages/projects.html');
  assert.match(html, /proj\.recoveredFrom[\s\S]{0,400}class="folder-badge[^"]*"[^>]*title="[^"]*저장분/, '★폴백 카드 배지가 없다(말없는 복구)');
  // ★E170 ㉢ — 알림 둘과 같은 꼴: «…에서 읽었습니다 (MM-DD HH:mm 저장분)»
  assert.match(html, /에서 읽었습니다\$\{proj\.recoveredAtLabel \? ` \(\$\{_escHtml\(proj\.recoveredAtLabel\)\} 저장분\)` : ''\}/, '★배지 title 의 시각 꼴이 알림과 다르다');
});
