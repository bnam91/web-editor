/* ★그리드 가이드 — 「편집 보조가 «문서»에 새지 않는가」 (2026-09-08 현빈 요청)
 *
 * ⛔이 기능의 유일한 위험은 «기능이 안 되는 것»이 아니라 «저장·내보내기에 섞이는 것»이다.
 *   고디터의 저장은 캔버스 DOM 을 그대로 직렬화한다(js/io/save-load.js getSerializedCanvas).
 *   ⇒ 오버레이 <div> 하나, inner.style 한 줄이면 프로젝트 파일에 가이드가 들어가고
 *     남의 컴퓨터에서 열어도 따라가며, 내보낸 이미지에도 찍힌다.
 *   ⇒ 그래서 배선을 «DOM 을 안 건드리는» 모양으로 못 박는다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const PAGE = readSrc(ROOT, 'js', 'props', 'prop-page.js');
const CSS  = readSrc(ROOT, 'css', 'editor-canvas.css');
const EXP  = readSrc(ROOT, 'js', 'io', 'export-image.js');
const SAVE = readSrc(ROOT, 'js', 'io', 'save-load.js');
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('G0 ★양성대조 — 저장이 «DOM 을 직렬화»하는 게 맞나 (이 검사의 전제)', () => {
  assert.match(SAVE, /function getSerializedCanvas/,
    '저장 방식이 바뀌었다면 이 검사의 «이유»가 달라진다 — 지우지 말고 다시 판단하라');
  assert.match(SAVE, /querySelectorAll\('\.section-block'\)|canvasEl\.innerHTML/,
    'DOM 을 훑어 저장하는 흔적이 없다');
});

test('G1 클래스는 «body 에만» 붙는다 — 캔버스 안에는 흔적이 없다', () => {
  const src = codeOnly(PAGE);
  const hits = [...src.matchAll(/classList\.(?:toggle|add|remove)\([^)]*gdt-grid[^)]*\)/g)];
  assert.ok(hits.length >= 2, `그리드 클래스 조작을 ${hits.length}곳 찾았다 — 배선이 사라졌나`);
  for (const h of hits) {
    const before = src.slice(Math.max(0, h.index - 60), h.index);
    assert.match(before, /document\.body\.$/,
      `★body 가 아닌 요소에 그리드 클래스를 붙인다 — 저장에 섞인다: …${before.slice(-40)}${h[0]}`);
  }
});

test('G2 ★섹션에 «인라인 스타일»을 쓰지 않는다 — 그게 저장에 섞이는 두 번째 길', () => {
  const src = codeOnly(PAGE);
  const i = src.indexOf('function refreshGrid');
  assert.ok(i > 0, 'refreshGrid 가 없다');
  const body = src.slice(i, src.indexOf('\n  }', i));
  assert.doesNotMatch(body, /\.section-inner[^)]*\)\.style|inner\.style\.setProperty/,
    '섹션에 직접 스타일을 쓰고 있다 — 인라인 스타일은 그대로 저장된다');
  assert.match(body, /documentElement\.style/,
    'CSS 변수는 «문서 루트»에 둬야 캔버스 DOM 이 깨끗하다');
});

test('G3 CSS 는 «패딩 안쪽»에만 그린다 — 패딩을 바꾸면 자동으로 따라온다', () => {
  assert.match(CSS, /body\.gdt-grid-on \.section-inner/, '그리드 규칙이 없다');
  assert.match(CSS, /background-origin:\s*content-box/, 'content-box 가 아니면 패딩 위에도 그려진다');
  assert.match(CSS, /background-clip:\s*content-box/);
});

test('G4 ★내보내기 «직전»에 끈다 — 가장 안쪽 함수에서', () => {
  const src = codeOnly(EXP);
  const i = src.indexOf('async function exportSection(');
  assert.ok(i > 0, 'exportSection 이 없다');
  const seg = src.slice(i, i + 700);
  assert.match(seg, /classList\.remove\('gdt-grid-on', 'gdt-grid-mid'\)/,
    '내보내기 전에 그리드를 안 끈다 — html2canvas 는 body 클래스를 복제해 캡처한다');
  assert.match(seg, /finally\s*\{/, '되돌리기가 finally 에 없으면 실패 시 가이드가 영영 꺼진다');
});

test('G5 저장 경로에는 그리드 «흔적 자체»가 없다', () => {
  assert.doesNotMatch(SAVE, /gdt-grid/,
    '저장 코드가 그리드를 알고 있다면, 그건 이미 문서에 섞였다는 뜻이다');
});

test('G6 ★변이대조 — 내보내기 가드를 빼면 G4 가 빨개진다', () => {
  const mutated = codeOnly(EXP).replace(/classList\.remove\('gdt-grid-on', 'gdt-grid-mid'\)/, 'void 0');
  const i = mutated.indexOf('async function exportSection(');
  const seg = mutated.slice(i, i + 700);
  assert.doesNotMatch(seg, /classList\.remove\('gdt-grid-on', 'gdt-grid-mid'\)/,
    '변이가 안 먹었다 = G4 는 이 배선을 «안» 본다');
});
