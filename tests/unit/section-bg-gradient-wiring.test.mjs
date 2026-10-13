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
  assert.match(SRC, /const _setSecBg = \(v\) => \{\s*sec\.dataset\.bg = v;\s*_applySectionBg\(sec\);\s*\}/);
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
