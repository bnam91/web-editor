/* U-SCRATCHEXPORTW — 「스크래치로 넣은 그림이 내보내기 폭을 따라가는가」의 «변이 책임».
 *
 * ★왜 유닛이 따로 필요한가
 *   숫자(잘린 px)는 tests/dom/scratch-drop-export-width.dom.spec.js 가 «실제로» 잰다.
 *   그런데 tests/dom 은 `npm test` 스위트에 «안» 들어간다 ⇒ 누가 이 자리를 되돌려도
 *   기본 검사에서는 조용히 지나간다. 그래서 «되돌리면 걸리는» 자리를 여기 박는다.
 *
 * ★이 파일이 지키는 것 셋
 *   S-1 내보내기는 «클론의 폭만» 바꾼다 — 그게 이 결함의 전제다.
 *       (DOM 스펙이 흉내 내는 한 줄이 실제로 그 모양인지 소스에서 확인 = 하네스 신뢰의 근거)
 *   S-2 스크래치 드롭의 «넘침» 밴드는 상대폭(calc)으로 적는다 — 절대 px 면 780 에서 잘린다.
 *   S-3 «넘침 없는» 밴드는 절대 px 그대로다 — 「보이던 폭 그대로」가 그쪽의 계약이다.
 *   S-4 우측패널이 calc() 를 «잰다» — 없으면 830 블록을 860 이라 말한다(다른 거짓말로 갈아타기).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const EXPORT_IMG = read('js', 'io', 'export-image.js');
const SCRATCH    = read('js', 'canvas-scratch-drop.js');
const PROP_ASSET = read('js', 'props', 'prop-asset.js');

/** 이름이 `label` 인 선언의 몸통을 중괄호 짝으로 잘라 온다. */
function bodyOf(src, label) {
  const i = src.indexOf(label);
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const start = src.indexOf('{', i);
  assert.notStrictEqual(start, -1, `★"${label}" 의 몸통 시작 { 을 못 찾았다`);
  let depth = 0;
  for (let k = start; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(start, k + 1); }
  }
  assert.fail(`★"${label}" 의 몸통 끝을 못 찾았다`);
}

test('S-1 내보내기는 «클론의 폭만» 바꾼다 (DOM 하네스가 흉내 내는 그 한 줄)', () => {
  const body = bodyOf(EXPORT_IMG, 'export async function prepareCloneForCapture');
  assert.match(body, /cloneNode\(true\)/, '★섹션을 복제하지 않는다 — 이 결함의 전제가 바뀌었다');
  assert.match(body, /clone\.style\.cssText\s*\+=[^\n]*width:'\s*\+\s*w\s*\+\s*'px/,
    '★클론 폭을 `width:` + w + `px` 로 두는 줄이 사라졌다 — DOM 스펙의 하네스도 같이 고쳐라');
  /* ★내보내기가 «안쪽 블록들»을 배율로 다시 그리지 않는다는 것도 같이 못박는다.
     만약 언젠가 전체를 scale 로 줄이는 방식으로 바뀌면 절대 px 도 따라 줄어들어
     이 카드의 전제(=상대폭이어야 한다)가 사라진다. 그때는 이 검사부터 고쳐라. */
  assert.ok(!/transform\s*=\s*[`'"]scale\(/.test(body),
    '★클론을 통째로 scale 하기 시작했다 — 폭 표현 규약을 다시 판정해야 한다');
});

test('S-2 ★스크래치 «넘침» 밴드는 상대폭(calc)으로 적는다', () => {
  const helper = bodyOf(SCRATCH, 'const applyScratchWidth');
  assert.match(helper, /over\s*>\s*0\s*\?\s*`calc\(100% \+ \$\{over \* 2\}px\)`/,
    '★넘침 밴드가 절대 px 로 돌아갔다 — 780px 내보내기에서 좌우 40px 씩 잘린다');
  // 음수마진은 여전히 «세트»여야 한다 (폭만 상대로 바꾸고 마진을 빼면 한쪽으로 밀린다)
  assert.match(helper, /marginLeft/,  '★좌 음수마진이 사라졌다 — 폭과 마진은 세트다');
  assert.match(helper, /marginRight/, '★우 음수마진이 사라졌다 — 폭과 마진은 세트다');
});

test('S-3 «넘침 없는» 밴드는 절대 px 그대로다 (「보이던 폭 그대로」 계약)', () => {
  const helper = bodyOf(SCRATCH, 'const applyScratchWidth');
  assert.match(helper, /:\s*w\s*\+\s*'px'/,
    '★넘침 없는 밴드까지 상대폭으로 바꿨다 — 220px 그림이 내보내기 폭을 따라 늘어난다');
});

test('S-4 ★우측패널이 calc() 를 «잰다» (문자열로 못 읽는다고 860 으로 폴백하지 않는다)', () => {
  const helper = bodyOf(PROP_ASSET, 'const readW =');
  assert.match(helper, /startsWith\('calc\('\)/,
    '★readW 가 calc() 갈래를 잃었다 — 830 으로 들어온 블록을 패널이 860 이라고 말한다');
  assert.match(helper, /offsetWidth/,
    '★calc() 를 offsetWidth 로 안 잰다');
  /* ⚠️주석을 걷고 «코드»만 본다 — 이 자리의 주석에는 「getBoundingClientRect 를 쓰지 마라」가
     경고로 적혀 있다. 주석째로 검사하면 그 경고문 자체가 검사를 빨갛게 만든다. */
  const code = helper.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/getBoundingClientRect/.test(code),
    '★getBoundingClientRect 로 쟀다 — 캔버스 줌(transform)이 곱해져 40% 에서 값이 틀린다');
  assert.match(code, /offsetWidth/, '★주석에만 offsetWidth 가 있고 코드엔 없다');
});
