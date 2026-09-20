/* U-ITBHANDLES — 「아이콘+텍스트 블럭의 오버레이 모서리 핸들」의 «변이 책임».
 *
 * 숫자(핸들 개수·글자 배율)는 tests/dom/overlay-icon-text-handles.dom.spec.js 가 실제로 잰다.
 * 그런데 tests/dom 은 `npm test` 스위트에 «안» 들어간다 ⇒ 되돌려도 조용히 지나간다.
 * 그래서 이 결함의 «문 셋»을 여기 박는다 — 하나만 닫으면 신고가 다른 문으로 그대로 산다.
 *   문① showHandlesFor 의 갈래       (레이어패널·히스토리 복원 경로의 입구)
 *   문② block-drag 의 isIconText 클릭 (사람이 실제로 밟는 입구)
 *   문③ 폰트 스냅샷의 그물           (핸들은 붙는데 글자만 안 커지는 반쪽)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const HANDLES = read('js', 'overlay-handles.js');
const DRAG    = read('js', 'block-drag.js');

/** 선언 몸통을 중괄호 짝으로 잘라 온다. */
function bodyOf(src, label) {
  const i = src.indexOf(label);
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const start = src.indexOf('{', i);
  let depth = 0;
  for (let k = start; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(start, k + 1); }
  }
  assert.fail(`★"${label}" 의 몸통 끝을 못 찾았다`);
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('문① showHandlesFor 가 .icon-text-block 을 «오버레이 텍스트»와 같은 갈래로 본다', () => {
  const body = stripComments(bodyOf(HANDLES, 'function showHandlesFor'));
  assert.match(body, /icon-text-block/,
    '★showHandlesFor 에 .icon-text-block 갈래가 없다 — 오버레이를 켜도 모서리 핸들이 0개다');
  /* 그 갈래가 «텍스트와 같은» 손잡이를 부르는지까지 본다 — 새 손잡이를 따로 만들면
     hideAssetResizeHandles 일괄 remove·커서 전수검사 같은 기존 규율에서 새어 나간다. */
  const branch = body.slice(body.indexOf('icon-text-block'));
  assert.match(branch, /showTextOverlayResizeHandles\s*\(/,
    '★아이콘텍스트가 «다른» 손잡이를 쓴다 — 오버레이 텍스트와 한 벌이어야 한다');
  assert.match(branch, /dataset\.overlayBlock\s*!?==?=\s*'true'/,
    '★오버레이 여부를 dataset.overlayBlock 으로 안 가른다(클래스로 가르면 흐름 블럭에도 붙는다)');
});

test('문② block-drag 의 isIconText 클릭 핸들러가 showHandlesFor 를 «부른다»', () => {
  const i = DRAG.indexOf("const isIconText = block.classList.contains('icon-text-block')");
  assert.notStrictEqual(i, -1, '★isIconText 판정을 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  /* 그 뒤 첫 dblclick 배선 전까지가 «클릭» 핸들러 구간이다. */
  const j = DRAG.indexOf("block.addEventListener('dblclick'", i);
  assert.ok(j > i, '★isIconText 뒤에 dblclick 배선이 없다 — 구간 판정이 낡았다');
  const clickBlock = stripComments(DRAG.slice(i, j));
  assert.match(clickBlock, /showTextProperties\s*\(/, '★전제가 바뀌었다 — 이 갈래가 텍스트 패널을 안 연다');
  assert.match(clickBlock, /showHandlesFor\s*\?\.\s*\(/,
    '★클릭 경로가 showHandlesFor 를 안 부른다 — 레이어패널로는 나오는데 «클릭하면» 안 나온다');
});

test('문③ 폰트 스냅샷이 .itb-text 를 «센다» (핸들만 붙고 글자는 안 커지는 반쪽 방지)', () => {
  const body = stripComments(bodyOf(HANDLES, 'function _tfoFontSnapshot'));
  assert.match(body, /\.itb-text/,
    '★폰트 스냅샷 그물에 .itb-text 가 없다 — `[class^="tb-"]` 는 «itb-» 를 안 잡는다');
  assert.match(body, /\[class\^="tb-"\]/, '★기존 텍스트 그물이 사라졌다 — 아이콘텍스트만 남으면 본문이 안 커진다');
});

test('가드 — 아이콘 칸(.itb-icon)에는 «아직» 손대지 않았다 (현빈 판단 대기)', () => {
  /* ⚠️바람직하다는 뜻이 아니라 «지금 이렇다»는 기록이다. 결정이 「아이콘도 같이 커진다」로
     나면 이 검사부터 뒤집어라 — 그때는 여기가 red 인 게 맞다. */
  const snap = stripComments(bodyOf(HANDLES, 'function _tfoFontSnapshot'));
  assert.ok(!/itb-icon/.test(snap),
    '★아이콘 칸을 폰트 스냅샷에 넣었다 — 그건 font-size 가 아니라 width/height 다');
});
