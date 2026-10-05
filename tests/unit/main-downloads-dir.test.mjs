/* main-downloads-dir.test.mjs — GODITOR_DOWNLOADS_DIR(2026-10-05 지디 승인): 다운로드 기본 자리를 «절대경로 env 가 있을 때만» 그 폴더로.
 *   행위 = main.js 의 ▼DOWNLOADS_DIR 블록을 «떼어» 가짜 env·getPath·isAbs·mkdir 로 돌린다(Electron 을 띄우지 않는다).
 *   구조 = env 를 읽는 자리 «하나» · app.getPath('downloads') 를 부르는 자리 «하나»(그 함수의 인자로만) — 두 자리에서 읽으면 빨강.
 *   양성대조: GD1001_ROOT=<fad9c91c main.js 가 든 폴더> → D0(블록 찾기)부터 빨강. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
/* 구조 검사는 «코드»만 센다 — // 주석 줄과 줄 끝 // 주석을 걷는다(주석이 「app.getPath('downloads')」를 말해도 세지 않게). */
const CODE = SRC.split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\s\/\/ .*$/, '')).join('\n');

function block() {
  const m = SRC.match(/\/\/ ▼DOWNLOADS_DIR[^\n]*\n([\s\S]*?)\/\/ ▲DOWNLOADS_DIR/);
  assert.ok(m, '★▼DOWNLOADS_DIR … ▲DOWNLOADS_DIR 블록이 없다');
  return m[1];
}
function load() {
  return new Function(`${block()}\nreturn _downloadsDir;`)();
}
const run = (env) => {
  const made = [];
  const out = load()(env, () => '/REAL/Downloads', path.isAbsolute, (d) => made.push(d));
  return { out, made };
};

test('D0 전제 — 블록을 찾았고 함수가 선다', () => {
  assert.equal(typeof load(), 'function');
});
test('D1 음성 — env 없음 = app.getPath(\'downloads\') 그대로 · 폴더 안 만듦', () => {
  assert.deepEqual(run({}), { out: '/REAL/Downloads', made: [] });
});
test('D2 양성 — 절대경로 env = 그 경로 · 그 폴더를 만든다(없으면 setSavePath 가 실패)', () => {
  assert.deepEqual(run({ GODITOR_DOWNLOADS_DIR: '/tmp/ud/downloads' }), { out: '/tmp/ud/downloads', made: ['/tmp/ud/downloads'] });
});
test('D3 상대경로 env = 무시(종전 자리)', () => {
  assert.deepEqual(run({ GODITOR_DOWNLOADS_DIR: 'ud/downloads' }), { out: '/REAL/Downloads', made: [] });
});
test('D4 빈 값 env = 무시(종전 자리)', () => {
  assert.deepEqual(run({ GODITOR_DOWNLOADS_DIR: '' }), { out: '/REAL/Downloads', made: [] });
});
test('D5 폴더 만들기가 실패해도 경로는 env 그대로(던지지 않는다)', () => {
  const out = load()({ GODITOR_DOWNLOADS_DIR: '/nope/x' }, () => '/REAL/Downloads', path.isAbsolute, () => { throw new Error('EACCES'); });
  assert.equal(out, '/nope/x');
});
test('S1 ★구조 — env 를 읽는 자리 하나 · getPath(\'downloads\') 자리 하나(_downloadsDir 인자로만)', () => {
  const reads = CODE.match(/env\.GODITOR_DOWNLOADS_DIR|process\.env\.GODITOR_DOWNLOADS_DIR|\[['"]GODITOR_DOWNLOADS_DIR['"]\]/g) || [];
  assert.equal(reads.length, 1, `★env 읽기 ${reads.length}곳 — 하나여야(두 자리에서 읽으면 갈라진다)`);
  const gp = CODE.match(/getPath\(\s*['"`]downloads['"`]\s*\)/g) || [];
  assert.equal(gp.length, 1, `★getPath('downloads') ${gp.length}곳`);
  assert.match(CODE, /_downloadsDir\(process\.env, \(\) => app\.getPath\('downloads'\)/, '★그 하나는 _downloadsDir 의 인자');
});
