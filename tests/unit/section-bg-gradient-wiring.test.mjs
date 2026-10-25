/* section-bg-gradient-wiring — 1013t2E1 (현빈 「섹션블럭에 배경색을 지정하려는데 왜 그라데이션이 적용이 안되는지?」)
 *
 * 실측(바닥 8d2435c0 · 진짜 클릭 · reports/S5-1013t2/logs/e1-repro-before.log):
 *   섹션 배경 스와치 → 피커 → 그라데이션 탭 = disabled · 툴팁 「이 항목은 그라데이션 채우기를 지원하지 않아요」.
 *   같은 길의 프레임(ss-bg)은 탭이 켜져 있고 누르면 linear-gradient 가 그려졌다.
 * 원인: prop-section.js 의 배경색 칸만 손 배선이라 wireColorField(onGradient) 를 안 탔다
 *   ⇒ native input 에 data-cp-modes 가 없고(color-picker.js _targetModes 기본 'solid'), goya-cp:gradient 를 듣는 자도 없었다.
 *   에셋 배경이 같은 병을 앓았다(tests/unit/asset-bg-gradient-wiring.test.js · T-011).
 * 동작은 tests/dom/section-bg-gradient.dom.spec.js 가 진짜 클릭으로 잰다. 여기는 «배선 자리» 핀.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceCall } from './_slice-block.js';
import { stripComments } from './_strip-comments.js';
import { readSrc } from './_srcread.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = stripComments(readSrc(ROOT, 'js', 'props', 'prop-section.js'));
const call = (s) => sliceCall(s, "wireColorField('sec-bg'", '섹션 배경색 피커 배선');

test('G0 ★전제 — 섹션 배경색 칸이 공용 colorFieldHTML(sec-bg)로 그려진다', () => {
  assert.match(SRC, /colorFieldHTML\(\{\s*idPrefix:\s*'sec-bg'/, '칸 자체가 없으면 아래 판정은 무효');
});

test('G1 sec-bg wireColorField 에 onGradient 가 배선돼 있다(없으면 그라데이션 탭이 잠긴다)', () => {
  assert.match(call(SRC), /onGradient\s*:/);
});

test('G2 재선택 시드 — gradientValue 를 넘기고 스와치도 그라데이션으로 그린다', () => {
  assert.match(call(SRC), /gradientValue\s*:/, '없으면 재선택 뒤 피커가 Solid 로 열리고 그라데이션 탭이 사용자 값을 덮는다');
  assert.match(SRC, /colorFieldHTML\(\{\s*idPrefix:\s*'sec-bg'[^}]*gradientCss:/);
});

test('G3 onGradient 는 값을 dataset.bg 에 싣고 그리개 한 자리(_applySectionBg)로 그린다 · 확정 때 기록', () => {
  const c = call(SRC);
  const body = sliceCall(c, 'onGradient: (css, commit) =>', 'onGradient 본문');
  assert.match(body, /_setSecBg\(css\)/);
  assert.match(body, /if\s*\(commit\)\s*pushHistory\(\)/, '확정이 기록에 안 남으면 ⌘Z 로 못 되돌린다');
  /* ★★261025 (prev-06) — ★본문을 ★«통째로» 박던 자를 ★«성질»로 갈랐다.
     ★왜 — ★옛 정규식은 `{` 뒤에 ★곧장 `sec.dataset.bg` 가 ★와야 참이라, ★줄 하나만 보태도 ★빨개졌다
       (★메시를 걷는 `delete` 한 줄에 ★실제로 빨개졌다). ★그런데 ★이 자가 ★지키려는 성질
       (「값을 dataset.bg 에 싣는다」＋「그리기는 _applySectionBg 한 자리」)은 ★그대로 참이었다.
     ⇒ ★성질마다 ★한 줄씩 건다. ⛔「아무 문장이나 와도 된다」로 ★느슨해진 것이 ★아니다 —
       ★세 성질이 ★전부 ★그 한 줄 안에 ★있어야 한다. */
  const setLine = (SRC.match(/const _setSecBg = \(v\) =>.*/) || [''])[0];
  assert.ok(setLine, '_setSecBg 한 줄을 못 떠냈다 — 판정 무효');
  assert.match(setLine, /sec\.dataset\.bg = v/, '값을 dataset.bg 에 안 싣는다');
  assert.match(setLine, /_applySectionBg\(sec\)/, '그리기를 그리개 한 자리에 안 맡긴다');
  /* ★★prev-06 — ★메시와 배경«색»은 ★같은 자리를 다툰다. ★안 걷으면 ★고른 색이 ★메시에 덮여
     ★아무 일도 ★안 한다(피커가 먹통). ★행위로 재는 자 = tests/dom/section-mesh-gradient-v1 ★M9.
     ★이 줄은 ★그 M9 가 ★「되돌린 판에서 빨강」임을 ★확인한 뒤에 ★걸었다. */
  assert.match(setLine, /delete sec\.dataset\.bgMesh/, '배경색을 고를 때 메시를 안 걷는다 — 고른 색이 묻힌다');
});

test('G4 그리개 — 그라데이션은 backgroundImage 에 실린다(backgroundColor 는 그라데이션을 못 받는다)', () => {
  const i = SRC.indexOf('function _applySectionBg(sec)');
  assert.ok(i > 0, '그리개를 못 찾았다 — 판정 무효');
  const body = SRC.slice(i, SRC.indexOf('function applyPreset', i));
  assert.match(body, /const grad\s*=\s*isSectionGradient\(color\)/);
  assert.match(body, /sec\.style\.backgroundImage = grad \? color : 'none'/);
  assert.match(body, /sec\.style\.backgroundColor = grad \? '' : color/);
});

test('G5 ★변이대조 — onGradient 를 빼면 G1 의 판정이 빨개진다(이 검사가 그 배선을 본다는 증거)', () => {
  const c = call(SRC);
  const mutated = c.replace(/onGradient\s*:\s*\(css, commit\)\s*=>\s*\{[\s\S]*?\n\s*\},\n/, '');
  assert.notStrictEqual(mutated, c, '변이가 한 글자도 안 잘랐다 = 이 대조는 아무것도 증명하지 않는다');
  assert.doesNotMatch(mutated, /onGradient\s*:/);
});

test('G6 손 배선 사본이 돌아오지 않았다 — sec-bg-color 에 input 리스너를 직접 거는 자 0', () => {
  assert.doesNotMatch(SRC, /getElementById\('sec-bg-color'\)/, '손 배선이 다시 생기면 wireColorField 와 이중 적용된다');
});

/* ── 1013t2E1 중-1(보안) — isSectionGradient 를 «그라데이션 함수 하나»로 좁혔다. 판정 표 ──
   함수 본문을 소스에서 떠내 그대로 돌린다(prop-section.js 는 브라우저 전역을 import 해 node 로 못 싣는다). */
const RAW = readSrc(ROOT, 'js', 'props', 'prop-section.js');
function loadIsSectionGradient() {
  const i = RAW.indexOf('export function isSectionGradient(v)');
  const j = RAW.indexOf('\nwindow.isSectionGradient', i);
  assert.ok(i > 0 && j > i, 'isSectionGradient 를 못 떠냈다 — 판정 무효');
  return new Function(RAW.slice(i, j).replace('export ', '') + '\nreturn isSectionGradient;')();
}
const TABLE = [
  // [값, 기대, 까닭]
  ['linear-gradient(90deg, #ff0000 0%, #0000ff 100%)', true, '피커가 쓰는 꼴'],
  ['linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.000) 100%)', true, '피커 기본값(알파 정지점)'],
  ['radial-gradient(circle, #fff 0%, rgba(0,0,0,0.5) 100%)', true, '피커 radial'],
  ['  linear-gradient(180deg, #000, #fff)  ', true, '앞뒤 공백'],
  ['linear-gradient(90deg, #ff0000 0%, #0000ff 100%)"><img src="" onerror="window.__pwn=1">', false, '★따옴표로 속성 깨기(E-eval J1)'],
  ["linear-gradient(#fff,#000)'><svg onload=x>", false, '홑따옴표'],
  ['linear-gradient(#fff, #000 "><img src=x onerror=window.__pwn=1> 100%)', false, '★괄호 «안»에 숨긴 따옴표(괄호 짝·꼬리 검사로는 못 거른다)'],
  ['linear-gradient(#fff,#000); color:red', false, '선언 꼬리(;)'],
  ['linear-gradient(#fff,#000)} body{x:y', false, '중괄호'],
  ['linear-gradient(#fff,#000), url(a.png)', false, '층 둘 + url(물들임 합성 결과)'],
  ['linear-gradient(#fff,#000)) x', false, '괄호 짝 안 맞음 · 꼬리'],
  ['linear-gradient(#fff,#000) linear-gradient(#000,#fff)', false, '함수 뒤에 꼬리'],
  ['linear-gradient(#fff,\\22 #000)', false, '역슬래시(CSS 이스케이프)'],
  ['linear-gradient(#fff, #000', false, '닫히지 않음'],
  ['#ff0000', false, '단색'],
  ['rgba(0,0,0,0.5)', false, '단색'],
  ['', false, '빈 값'],
  [null, false, 'null'],
];
test('X0 ★판정 표 — 정상 그라데이션은 통과, 속성/선언/층을 깨는 값은 거른다', () => {
  const f = loadIsSectionGradient();
  for (const [v, want, why] of TABLE) assert.strictEqual(f(v), want, `${why}: ${JSON.stringify(v)}`);
});
test('X0b 변이대조 — 금지 글자 검사를 빼면 X0 의 «괄호 안에 숨긴 따옴표» 줄이 통과해 버린다(이 표가 그 줄을 본다는 증거)', () => {
  /* 괄호 꼬리 검사가 꼬리 공격은 따로 거른다 — 금지 글자 줄만의 몫은 «괄호 안에 숨긴» 값이다. */
  const i = RAW.indexOf('export function isSectionGradient(v)');
  const j = RAW.indexOf('\nwindow.isSectionGradient', i);
  const body = RAW.slice(i, j).replace('export ', '');
  const LINE = "if (/[;\"<>{}\\\\'\\x60]/.test(s) || /url\\(/i.test(s)) return false;";
  assert.ok(body.includes(LINE), '금지 글자 줄을 못 찾았다 — 판정 무효');
  const mutated = body.replace(LINE, '');
  assert.notStrictEqual(mutated, body, '변이가 한 글자도 안 잘랐다');
  const g = new Function(mutated + '\nreturn isSectionGradient;')();
  assert.strictEqual(g('linear-gradient(#fff, #000 "><img src=x onerror=window.__pwn=1> 100%)'), true, '변이 뒤에도 거른다 = 표가 그 줄을 안 본다');
});
test('X1 colorFieldHTML 이 style 속성 값을 이스케이프한다(공용 한 자리)', () => {
  const cp = stripComments(readSrc(ROOT, 'js', 'props', 'color-picker.js'));
  const i = cp.indexOf('export function colorFieldHTML');
  const body = cp.slice(i, cp.indexOf('export function wireColorField', i));
  assert.match(body, /const swatchBg = escHtml\(gradientCss \|\| h\)/);
  assert.match(cp, /import \{ escHtml \} from '\.\/_helpers\.js'/);
});
