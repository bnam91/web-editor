/* group-drop-grow-wiring — 「자유배치 프레임 드롭이 프레임을 «넓히는» 자리를 실제로 부르는가」 (T-088)
 *
 * ★이 검사가 있는 이유
 *   고침의 «계산»은 tests/dom/group-drop-clip.dom.spec.js 가 진짜 레이아웃으로 잰다.
 *   그런데 계산이 옳아도 «드롭 경로가 안 부르면» 증상은 그대로다 — 실앱에서 사라진
 *   그 제목이 딱 그 경우였다. 그래서 «부르는가»를 따로 못박는다.
 *
 * ★명부를 만들지 않는다 — 프레임 종류(그룹/배너/카드…)를 세지 않고, 자유배치 드롭 분기
 *   «한 자리»가 넓히기를 부르는지만 본다.
 *
 * 음성대조: js/block-drag.js 의 growFrameToFitChildren(inner) 호출을 지우면 이 검사가 빨강이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { makeStripper } from './_strip-comments.js';
import { sliceBlock } from './_slice-block.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 주석을 걷어낸 «코드 줄»만 (줄번호는 1-base 원본 기준). */
function codeLines(rel) {
  const strip = makeStripper();
  return readSrc(REPO, rel).split('\n').map((l, i) => ({ n: i + 1, code: strip(l) }));
}

test('frame-geometry 가 넓히기 술어를 «내보낸다»', () => {
  const lines = codeLines('js/frame-geometry.js');
  const names = ['absChildrenBottom', 'frameFitHeight', 'growFrameToFitChildren'];
  for (const n of names) {
    assert.ok(
      lines.some(l => new RegExp(`^export function ${n}\\b`).test(l.code.trim())),
      `js/frame-geometry.js 가 ${n} 를 export 하지 않는다`);
  }
});

test('block-drag 의 자유배치 드롭이 넓히기를 부른다 (import + 호출)', () => {
  const lines = codeLines('js/block-drag.js');
  assert.ok(
    lines.some(l => /import\s*\{[^}]*\bgrowFrameToFitChildren\b[^}]*\}\s*from\s*'\.\/frame-geometry\.js'/.test(l.code)),
    'js/block-drag.js 가 growFrameToFitChildren 를 frame-geometry 에서 import 하지 않는다');

  const calls = lines.filter(l => /\bgrowFrameToFitChildren\s*\(/.test(l.code) && !/^import/.test(l.code.trim()));
  assert.ok(calls.length >= 1,
    'js/block-drag.js 에 growFrameToFitChildren(...) 호출이 없다 — 드롭이 프레임을 안 넓힌다');
});

test('넓히기는 «넓히기만» 한다 — 줄이는 경로가 없다', () => {
  const fn = sliceBlock(readSrc(REPO, 'js/frame-geometry.js'),
    'export function frameFitHeight', 'frameFitHeight 가 사라졌거나 이름이 바뀌었다');
  assert.ok(/Math\.max\(cur,/.test(fn),
    'frameFitHeight 가 현재 높이와 max 를 취하지 않는다 — 드롭이 프레임을 줄일 수 있다');
});

test('세 값을 함께 쓴다 — dataset.height 가 빠지면 재로드가 옛 높이로 되돌린다', () => {
  const body = sliceBlock(readSrc(REPO, 'js/frame-geometry.js'),
    'export function growFrameToFitChildren', 'growFrameToFitChildren 가 사라졌거나 이름이 바뀌었다');
  for (const key of ['style.height', 'style.minHeight', 'dataset.height']) {
    assert.ok(body.includes(key), `growFrameToFitChildren 가 ${key} 를 쓰지 않는다`);
  }
});
