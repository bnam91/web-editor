/* U-CVBRAD — 카드 블록 «코너 반경 핸들»이 에셋 블록과 동등한가.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ★[M39] 현빈 2026-09-05 제보 둘. «한 결함의 두 얼굴»이다.
 *   ⑴ 「카드 블럭 코너라디우스 조절하는거 좌측 상단에만 핸들이 있는데」
 *      showCanvasRadiusHandles 가 'nw' 를 «문자열로 박아» 한 개만 만들었다(에셋은 CORNER_DIRS 4개).
 *      위치 계산도 rect.top/left 고정이라 좌상단 하나만 잡혔다.
 *   ⑵ 「드래그하면 에셋블럭의 코너핸들과 라디우스 적용되는게 반대」
 *      부호가 뒤집혀 있었다 — 에셋 `startRadius + delta`, 카드만 `- delta`.
 *      ★그리고 카드의 delta 식은 «방향을 안 봤다»(항상 nw 판). 핸들이 하나뿐이라 안 드러났을
 *        뿐이고, ⑴을 고쳐 네 개로 늘리는 순간 ne·sw·se 가 반대로 움직인다.
 *        ⇒ ⑴만 고치고 ⑵를 안 고치면 «더 나빠진다». 이 검사가 그 짝을 묶어 둔다.
 *
 * ★기대값에 숫자를 안 박는다 — 「에셋 판과 «같은 식»인가」로 비교한다.
 *   정본이 바뀌면 둘이 «같이» 움직이고, 한쪽만 늙으면 여기서 빨강이 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/overlay-handles.js'), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const CODE = strip(SRC);

/** 이름으로 함수 본문을 잘라낸다(중괄호 균형). */
function fnBody(name) {
  const i = CODE.indexOf(`function ${name}(`);
  assert.ok(i !== -1, `${name} 를 못 찾음 — 리팩터링됐나?`);
  let d = 0, started = false;
  for (let j = CODE.indexOf('{', i); j < CODE.length; j++) {
    if (CODE[j] === '{') { d++; started = true; }
    else if (CODE[j] === '}') { d--; if (started && d === 0) return CODE.slice(i, j + 1); }
  }
  assert.fail(`${name} 본문의 끝을 못 찾음`);
}

const CVB_SHOW = fnBody('showCanvasRadiusHandles');
const CVB_POS  = fnBody('_updateCanvasRadiusHandlePositions');
const CVB_DRAG = fnBody('_onCanvasRadiusHandleMouseDown');
const AB_DRAG  = fnBody('_onAssetRadiusHandleMouseDown');

test('★M39-⑴ 카드 반경 핸들은 «네 모서리» 다 — 방향을 박지 않고 CORNER_DIRS 를 돈다', () => {
  assert.match(CVB_SHOW, /CORNER_DIRS\s*\.\s*forEach/,
    "핸들을 CORNER_DIRS 로 안 만든다 — 'nw' 를 박아 한 개만 생기던 그 결함이다");
  assert.doesNotMatch(CVB_SHOW, /canvasRadiusDir\s*=\s*['"]nw['"]/,
    "방향이 'nw' 로 박혀 있다");
});

test('★M39-⑴ 위치는 «모서리별»로 계산한다 — rect.left/top 고정이면 네 개가 한 자리에 겹친다', () => {
  assert.match(CVB_POS, /_cornerScreen\(\s*_canvasRadiusBlock\s*,\s*h\.dataset\.canvasRadiusDir/,
    '_cornerScreen(el, dir, inset) 을 안 쓴다 — 회전한 블록에서도 어긋난다(에셋 판과 같은 헬퍼)');
  assert.doesNotMatch(CVB_POS, /rect\.(left|top)\s*\+\s*INSET/,
    '좌상단 고정 계산이 남아 있다');
});

test('★M39-⑵ 드래그 부호가 «에셋과 같다» — 안쪽으로 끌면 커진다(+delta)', () => {
  const grab = body => (body.match(/startRadius\s*([+-])\s*delta/) || [])[1];
  const ab = grab(AB_DRAG), cvb = grab(CVB_DRAG);
  assert.equal(ab, '+', '정본(에셋)의 부호가 + 가 아니다 — 기준선이 흔들렸다');
  assert.equal(cvb, ab,
    `카드의 부호(${cvb})가 에셋(${ab})과 다르다 — 현빈 제보 「라디우스 적용되는게 반대」 그 자체다`);
});

test('★M39-⑵ delta 가 «방향을 본다» — 안 보면 ne·sw·se 가 반대로 움직인다', () => {
  assert.match(CVB_DRAG, /cornerSign\(\s*dir\s*\)/,
    'delta 계산이 dir 을 안 본다 — 핸들을 4개로 늘린 순간 세 개가 거꾸로 돈다');
  assert.match(CVB_DRAG, /function\s+_onCanvasRadiusHandleMouseDown\s*\([^)]*dir/,
    '핸들러가 dir 인자를 안 받는다');
});

test('★M39 두 판의 «네 방향 부호»가 수식으로 동등하다(값이 아니라 식을 비교한다)', () => {
  // 에셋: nw (dx+dy)/2 · ne (-dx+dy)/2 · sw (dx-dy)/2 · se (-dx-dy)/2
  // 카드: cornerSign 으로 일반화 — 두 식이 네 방향 모두에서 같아야 한다.
  const cornerSign = dir => ({ sx: dir.includes('e') ? 1 : -1, sy: dir.includes('s') ? 1 : -1 });
  const assetDelta = (dir, dx, dy) => dir === 'nw' ? (dx + dy) / 2
                                    : dir === 'ne' ? (-dx + dy) / 2
                                    : dir === 'sw' ? (dx - dy) / 2
                                    : (-dx - dy) / 2;
  const cardDelta = (dir, dx, dy) => { const { sx, sy } = cornerSign(dir); return (-sx * dx + -sy * dy) / 2; };
  for (const dir of ['nw', 'ne', 'sw', 'se'])
    for (const [dx, dy] of [[10, 10], [-7, 3], [0, -12], [5, 0]])
      assert.equal(cardDelta(dir, dx, dy), assetDelta(dir, dx, dy),
        `${dir} 에서 두 식이 갈린다 (dx=${dx}, dy=${dy})`);
});

test('⚠️상한은 «각자의 설계 상수» — 카드 60 / 에셋 120 은 의도된 차이다', () => {
  assert.match(CVB_DRAG, /Math\.min\(\s*60\s*,/, '카드 상한 60 이 바뀌었다 — 의도한 변경인지 확인할 것');
  assert.match(AB_DRAG,  /Math\.min\(\s*120\s*,/, '에셋 상한 120 이 바뀌었다');
});
