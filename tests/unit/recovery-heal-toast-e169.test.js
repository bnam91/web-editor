/* recovery-heal-toast-e169.test.js — E169 반쪽: «백업에서 복구했습니다»가 거짓 안심이던 것 (lane-drag · 2026-10-06 · 태양 승인 · 지디 «우리 몫»)
 *
 * 실앱(격리 · 핀 0f572e2a · 사본 · 폴더 쓰기 막힘 = 디스크가 꽉 찼을 때 대역): 깨진 proj.json 을 열면 백업에서 오고
 *   자가치유(proj.json 재기록)가 EACCES 로 실패하는데, main 의 catch 가 warn 만 남기고 삼켜서
 *   토스트는 «⚠️ 프로젝트 파일이 손상되어 백업에서 복구했습니다.» — 디스크에 성한 판이 없는데 사용자는 안심했다.
 * 고침: 로드 결과가 자가치유 «성패»를 싣는다(_healed · _healError) · 토스트 글은 «그 성패»로 고른다(⛔백업이 있었나로 아님).
 * 실행: node --test tests/unit/recovery-heal-toast-e169.test.js
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
const SL_SRC = readSrc(REPO, 'js/io/save-load.js');

function fnSrc(src, name) {
  for (const pat of [`async function ${name}(`, `function ${name}(`, `const ${name} = `]) {
    if (src.indexOf(pat) >= 0) return sliceBlock(src, pat, '검사가 «대상을 놓친» 것이지 통과가 아니다');
  }
  throw new Error(`★${name} 이(가) 없다 — 이름이 바뀌었으면 이 검사도 «같이» 고쳐라`);
}
function loadHandlerSrc() {
  const A = "ipcMain.handle('projects:load'";
  assert.equal(MAIN_SRC.split(A).length - 1, 1, 'projects:load 핸들러는 하나여야 한다');
  const k = MAIN_SRC.indexOf(A); let i = MAIN_SRC.indexOf('{', k), d = 0;
  for (; i < MAIN_SRC.length; i++) { const c = MAIN_SRC[i]; if (c === '{') d++; else if (c === '}' && --d === 0) break; }
  return MAIN_SRC.slice(k, MAIN_SRC.indexOf(')', i) + 1) + ';';
}
const FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath', '_resolveBackupJsonPath', '_ensureNewLayoutPaths', '_SS'];
function loader(projectsDir) {
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const handlers = {};
  const factory = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console', 'ipcMain',
    `let _ssMod = null, _ssTried = false; const _SS_FALLBACK = {};\nconst _externalizeOnOpen = () => {};\n` +
    FNS.map(n => fnSrc(MAIN_SRC, n)).join('\n\n') + '\n' + loadHandlerSrc() + '\n; return 1;');
  factory(fs, path, projectsDir, req, { log() {}, warn() {}, error() {} }, { handle: (ch, fn) => { handlers[ch] = fn; } });
  return (id) => handlers['projects:load']({}, id);
}

const ID = 'proj_1775644888754';
function scene({ readOnly }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-e169h-')); const p = path.join(dir, ID);
  fs.mkdirSync(p, { recursive: true });
  const good = JSON.stringify({ id: ID, name: 'n', pages: [{ id: 'page_1', canvas: '<div class="section-block"></div>' }] }, null, 2);
  fs.writeFileSync(path.join(p, 'proj_backup.json'), good);
  fs.writeFileSync(path.join(p, 'proj.json'), good.slice(0, 40));
  if (readOnly) fs.chmodSync(p, 0o555);   // ★디스크가 꽉 찼을 때의 대역 — tmp+rename 가 못 선다
  return { dir, p, undo: () => fs.chmodSync(p, 0o755) };
}

test('H1 ★자가치유 «실패»(폴더 쓰기 막힘) → 로드 결과가 _healed:false + _healError(코드)를 싣는다', () => {
  const s = scene({ readOnly: true });
  try {
    const proj = loader(s.dir)(ID);
    assert.equal(proj && proj._recovered, 'backup', '전제: 백업에서 옴');
    assert.deepEqual({ healed: proj._healed, code: proj._healError }, { healed: false, code: 'EACCES' });
  } finally { s.undo(); }
});

test('H2 자가치유 «성공» → _healed:true · _healError 없음', () => {
  const s = scene({ readOnly: false });
  const proj = loader(s.dir)(ID);
  assert.equal(proj._recovered, 'backup');
  assert.deepEqual({ healed: proj._healed, code: proj._healError }, { healed: true, code: undefined });
});

/* 글 고르는 자리 — save-load.js 의 순수 함수 _recoveryToastText(proj) */
// ★게으르게 — base 에 함수가 없으면 «그 시험만» 빨강(파일 통째 죽음이 아니라)
const toastText = (proj) => new Function(fnSrc(SL_SRC, '_recoveryToastText') + '; return _recoveryToastText;')()(proj);

test('T1 ★치유 성공 → «…백업에서 복구했습니다.»(옛 글 그대로)', () => {
  assert.equal(toastText({ _recovered: 'backup', _healed: true }), '⚠️ 프로젝트 파일이 손상되어 백업에서 복구했습니다.');
});

test('T2 ★치유 실패 → «…백업에서 열었습니다. 디스크의 파일은 아직 고치지 못했습니다(<까닭>) — 이대로는 저장이 안 될 수 있습니다.»', () => {
  const want = (why) => `⚠️ 프로젝트 파일이 손상되어 백업에서 열었습니다. 디스크의 파일은 아직 고치지 못했습니다(${why}) — 이대로는 저장이 안 될 수 있습니다.`;
  assert.equal(toastText({ _recovered: 'backup', _healed: false, _healError: 'ENOSPC' }), want('공간 부족'));
  assert.equal(toastText({ _recovered: 'backup', _healed: false, _healError: 'EACCES' }), want('권한'));
  assert.equal(toastText({ _recovered: 'backup', _healed: false, _healError: 'EPERM' }), want('권한'));
  assert.equal(toastText({ _recovered: 'backup', _healed: false, _healError: 'EIO' }), want('EIO'));
});

test('T3 글은 «성패»로 고른다 — 같은 _recovered(backup)인데 _healed 만 다르면 글이 다르다(⛔«백업이 있었나»로 고르지 않음)', () => {
  assert.notEqual(toastText({ _recovered: 'backup', _healed: true }), toastText({ _recovered: 'backup', _healed: false, _healError: 'EACCES' }));
});

test('T4 히스토리·변환 전 원본 갈래 이름은 그대로 · 실패 글에도 같은 이름', () => {
  assert.equal(toastText({ _recovered: 'history', _healed: true }), '⚠️ 프로젝트 파일이 손상되어 히스토리에서 복구했습니다.');
  assert.match(toastText({ _recovered: 'history', _healed: false, _healError: 'ENOSPC' }), /히스토리에서 열었습니다/);
});

test('W1 배선 — 로드 토스트가 _recoveryToastText 를 부르고 · 새 표지는 저장에 안 남는다(PROJ_RUNTIME_KEYS)', () => {
  assert.match(SL_SRC, /showToast\?\.\(_recoveryToastText\(proj\)\)/);
  const PM = readSrc(REPO, 'js/io/proj-merge.js');
  for (const k of ['_recovered', '_healed', '_healError']) assert.match(PM, new RegExp(`PROJ_RUNTIME_KEYS = \\[[^\\]]*'${k}'`), `${k} 가 런타임 키 명부에 없다 — 저장 파일에 샌다`);
});
