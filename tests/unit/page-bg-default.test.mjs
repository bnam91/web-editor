/* U-PGBG — 새 프로젝트의 «페이지 배경» 기본값이 «한 곳»에서만 온다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다.
 *
 * ★[M58] 현빈 2026-09-06: 「애초에 시작할때 캔버스 밝기가 너무 밝아서 바탕색을 777777으로」
 *   실측하니 값이 «네 벌·네 색»이었다 — 만드는 «경로»마다 다른 색이 나왔다:
 *     projects.html 새 프로젝트 #f5f5f5(거의 흰색·현빈이 본 것) / 샘플 #969696
 *     tab-system.js #9b9b9b / globals.js 레거시 폴백 #828282
 *   ★tab-system.js 주석은 스스로를 「유일한 정본」이라 부르면서 바로 옆줄에
 *     「실제로 projects.html 복사본은 bg 가 다르다」고 «경고까지» 하고 있었다.
 *     ⇒ 경고는 갈라짐을 «막지 못한다». 검사만 막는다. 이 파일이 그 검사다.
 *
 * ⛔레거시 폴백(globals.js #828282)은 «검사 대상이 아니다» — 저장본에 bg 키가 없는
 *   구 프로젝트를 열 때 쓰는 값이라 신규 기본값과 «일부러» 다르다. 그 «의도»도 여기서 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const FLAGS   = read('js/feature-flags.js');
// ★2026-10-06(SIX ①): 빈 프로젝트 모양을 js/io/empty-project.js 한 벌로 올렸다 — 생성 «정의 자리»는 그 하나다.
//   옛 두 자리(tab-system.js · projects.html)는 «사본이 다시 자라지 않는가»를 아래 M58-ONE 이 잰다.
const CREATORS = ['js/io/empty-project.js', 'pages/projects.html'];   // projects.html 에 남은 생성 자리 = «샘플 프로젝트»(샘플 캔버스를 담은 다른 모양 — 정당한 별도 생성기)

test('★M58 — 정본이 feature-flags.js 에 «하나» 있고 값이 #777777 이다', () => {
  const m = FLAGS.match(/w\.PAGE_BG_DEFAULT\s*=\s*'(#[0-9a-fA-F]{6})'/);
  assert.ok(m, 'PAGE_BG_DEFAULT 가 없다 — 정본이 사라졌다');
  assert.equal(m[1].toLowerCase(), '#777777', `기본값이 ${m[1]} 다 — 현빈 지정값은 #777777`);
});

test('★M58 — 정본은 «두 화면이 다 읽는» 파일에 있어야 한다(globals.js 면 목록 화면에서 undefined)', () => {
  for (const page of ['index.html', 'pages/projects.html']) {
    assert.match(read(page), /feature-flags\.js/,
      `${page} 가 feature-flags.js 를 안 읽는다 — 그 화면만 기본값이 샌다`);
  }
});

test('⛔M58 — 프로젝트를 «만드는» 파일에 배경색 리터럴이 없다(사본이 다시 생기면 빨강)', () => {
  const bad = [];
  for (const f of CREATORS) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    for (const m of src.matchAll(/pageSettings\s*:\s*\{[^}]*?\bbg\s*:\s*('#[0-9a-fA-F]{3,8}'|"#[0-9a-fA-F]{3,8}")/g)) {
      bad.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, [],
    '생성 경로에 배경색이 «박혀» 있다 — window.PAGE_BG_DEFAULT 를 써라. 이게 네 벌로 갈라졌던 그 모양이다');
});

test('★M58 — 생성 경로가 실제로 정본을 «본다»(리터럴만 지우고 안 쓰면 undefined 가 저장된다)', () => {
  for (const f of CREATORS) {
    assert.match(read(f), /pageSettings\s*:\s*\{[^}]*\bbg\s*:\s*window\.PAGE_BG_DEFAULT/,
      `${f} 가 window.PAGE_BG_DEFAULT 를 안 쓴다`);
  }
});

test('⚠️M58 — 레거시 폴백은 «일부러» 다르다(신규 기본값과 같아지면 구 프로젝트 색이 바뀐 것)', () => {
  const g = read('js/globals.js');
  const m = g.match(/pageSettings\s*:\s*\{\s*bg\s*:\s*'(#[0-9a-fA-F]{6})'/);
  assert.ok(m, 'globals.js 의 레거시 폴백이 사라졌다 — 구 저장본이 색을 잃는다');
  assert.notEqual(m[1].toLowerCase(), '#777777',
    '레거시 폴백이 신규 기본값과 같아졌다 — 의도한 변경이면 이 검사를 «같이» 고쳐라');
});

test('★M58-ONE — 빈 프로젝트 «사본»이 옛 두 자리에 다시 자라지 않는다(tab-system.js 전체 · projects.html createProject) · 두 화면이 단일 원본을 싣는다', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  const SHAPE = /pageSettings\s*:\s*\{[^}]*\bbg\s*:/;
  assert.doesNotMatch(strip(read('js/tab-system.js')), SHAPE, 'tab-system.js 에 빈 프로젝트 모양 사본이 다시 생겼다 — js/io/empty-project.js 를 써라');
  const pj = strip(read('pages/projects.html'));
  const i = pj.indexOf('async function createProject() {'); const j = pj.indexOf('\n}\n', i);
  assert.ok(i > 0 && j > i, '★전제: projects.html createProject 를 찾았다');
  assert.doesNotMatch(pj.slice(i, j), SHAPE, 'projects.html createProject 에 빈 프로젝트 모양 사본이 다시 생겼다');
  assert.match(pj.slice(i, j), /window\.buildEmptyProject\(/, 'createProject 가 단일 원본(window.buildEmptyProject)을 안 부른다');
  for (const page of ['index.html', 'pages/projects.html']) assert.match(read(page), /js\/io\/empty-project\.js/, `${page} 가 empty-project.js 를 안 싣는다`);
});
