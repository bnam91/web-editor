/* frame-child-clamp-wiring — 「프레임 «안»의 자식 드래그가 실제로 죔을 부르는가」 (T-088 2라운드)
 *
 * ★이 검사가 있는 이유
 *   죔의 «계산»은 tests/dom/group-child-drag-clip.dom.spec.js 가 진짜 레이아웃으로 잰다.
 *   그런데 계산이 옳아도 «드래그 경로가 안 부르면» 증상은 그대로다 — 1라운드(넣는 축)에서
 *   이미 겪은 그 자리다(tests/unit/group-drop-grow-wiring.test.mjs). 그래서 «부르는가»와
 *   «어느 순서로 부르는가»를 따로 못박는다.
 *
 * ★순서가 뜻을 바꾼다 — 죔이 «끌어내기(drag-out) 판정 앞»으로 가면 자식 중심이 프레임 밖
 *   DRAGOUT_MARGIN 을 영영 못 넘어 그룹에서 빼낼 길이 사라진다. 그래서 순서도 단언한다.
 *
 * ★두 축이 서로 다른 규칙을 쓴다는 것도 같이 못박는다(카드 ⑦):
 *     밖에서 «들여놓을» 때 = 프레임을 키운다(growFrameToFitChildren)
 *     안에서 «옮길» 때     = 프레임은 그대로, 자식을 죈다(clampChildIntoFrame)
 *
 * 음성대조: js/block-drag.js 의 clampChildIntoFrame(...) 호출을 지우면 이 검사가 빨강이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { makeStripper } from './_strip-comments.js';
import { sliceBlock, sliceCall } from './_slice-block.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* 고친 자리 = bindBlock 안 「공통: 절대좌표 드래그」 핸들러다(같은 파일에 mousedown 리스너가
   여럿이라 «첫 번째»로 집지 않는다 — 그 머리 주석을 앵커로 삼아 거기서부터 잘라낸다). */
const DRAG_ANCHOR = '// \u2500\u2500 공통: 절대좌표 드래그';
function sliceAbsDrag() {
  const src = readSrc(REPO, 'js/block-drag.js');
  const at = src.indexOf(DRAG_ANCHOR);
  assert.ok(at > 0, `js/block-drag.js 에서 앵커를 못 찾았다: ${DRAG_ANCHOR}`);
  return sliceCall(src.slice(at), "block.addEventListener('mousedown', e => {",
    '「공통: 절대좌표 드래그」 핸들러가 사라졌거나 모양이 바뀌었다');
}

/** 주석을 걷어낸 «코드»만 (줄 수는 그대로 — 인덱스 비교를 위해 줄을 지우지 않는다). */
function stripAll(src) {
  const strip = makeStripper();
  return src.split('\n').map(strip).join('\n');
}

test('frame-geometry 가 죔 술어를 «내보낸다»', () => {
  const src = readSrc(REPO, 'js/frame-geometry.js');
  assert.ok(/^export function clampChildIntoFrame\b/m.test(src),
    'js/frame-geometry.js 가 clampChildIntoFrame 를 export 하지 않는다');
});

test('죔은 «양쪽»을 죈다 — 위(0)도 아래(max)도', () => {
  const fn = sliceBlock(readSrc(REPO, 'js/frame-geometry.js'),
    'export function clampChildIntoFrame', 'clampChildIntoFrame 가 사라졌거나 이름이 바뀌었다');
  const code = stripAll(fn);
  assert.ok(/Math\.min\(/.test(code), 'clampChildIntoFrame 에 위쪽 한계(min)가 없다 — 밑변 너머로 나간다');
  assert.ok(/Math\.max\(0,/.test(code), 'clampChildIntoFrame 에 0 바닥(max)이 없다 — 위로 끌면 머리가 잘린다');
});

test('block-drag 의 자식 드래그가 죔을 부른다 (import + 호출)', () => {
  const code = stripAll(readSrc(REPO, 'js/block-drag.js'));
  assert.ok(
    /import\s*\{[^}]*\bclampChildIntoFrame\b[^}]*\}\s*from\s*'\.\/frame-geometry\.js'/.test(code),
    'js/block-drag.js 가 clampChildIntoFrame 를 frame-geometry 에서 import 하지 않는다');

  const fn = stripAll(sliceAbsDrag());
  assert.ok(/\bclampChildIntoFrame\s*\(/.test(fn),
    '절대좌표 드래그 안에 clampChildIntoFrame(...) 호출이 없다 — 자식이 프레임 밖으로 끌려 나간다');
});

test('죔은 «끌어내기 판정 뒤»에 온다 — 앞서면 그룹에서 빼낼 길이 막힌다', () => {
  const fn = stripAll(sliceAbsDrag());
  const iOut   = fn.indexOf('DRAGOUT_MARGIN');
  const iClamp = fn.indexOf('clampChildIntoFrame');
  assert.ok(iOut   >= 0, '절대좌표 드래그에서 끌어내기 판정(DRAGOUT_MARGIN)을 못 찾았다');
  assert.ok(iClamp >= 0, '절대좌표 드래그에서 죔(clampChildIntoFrame)을 못 찾았다');
  assert.ok(iClamp > iOut,
    '죔이 끌어내기 판정보다 «앞»에 있다 — 중심이 프레임 밖 여유를 못 넘어 drag-out 이 영영 안 난다');
});

test('죌 기준은 «부모»에서 찾는다 — 자기 자신이 자유배치 프레임일 수 있다', () => {
  const fn = stripAll(sliceAbsDrag());
  /* 도형 래퍼는 makeFrameBlock 기본값이라 data-free-layout 을 «자기가» 갖는다.
     closest 를 자기부터 돌리면 기준이 자기 자신이 되어 maxL/maxT=0 → 도형이 (0,0) 에 못 박힌다.
     형제 경로(절대배치 프레임 드래그)도 parentElement 부터 찾는다 — 같은 식으로 맞춘다. */
  assert.ok(/parentElement\s*\?\.\s*closest\(\s*'\.frame-block\[data-free-layout\]'\s*\)/.test(fn),
    '죌 기준 프레임을 parentElement 에서 찾지 않는다 — 자기 자신이 잡히면 (0,0) 에 못 박힌다');
});

test('두 축이 갈려 있다 — 들여놓기는 «키우고», 안에서 옮기기는 «죈다»', () => {
  const src = readSrc(REPO, 'js/block-drag.js');
  const move = stripAll(sliceAbsDrag());
  const dropZone = stripAll(sliceBlock(src, 'function bindFrameDropZone(ss)',
    'bindFrameDropZone 가 사라졌거나 서명이 바뀌었다'));

  assert.ok(/\bgrowFrameToFitChildren\s*\(/.test(dropZone),
    '들여놓는 자리(bindFrameDropZone)가 프레임을 안 키운다 — 1라운드 고침이 빠졌다');
  assert.ok(!/\bgrowFrameToFitChildren\s*\(/.test(move),
    '안에서 옮기는 자리가 프레임을 키운다 — 사용자가 핸들로 정한 크기를 드래그가 몰래 바꾼다');
  assert.ok(/\bclampChildIntoFrame\s*\(/.test(move),
    '안에서 옮기는 자리가 자식을 안 죈다 — 밑변 너머로 끌면 사라진다');
});
