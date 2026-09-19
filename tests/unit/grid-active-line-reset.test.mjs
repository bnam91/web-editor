/* grid-active-line-reset.test.mjs — 0918 grid: «블럭 전체 선택»과 «줄 선택»을 가르는 클릭 판정.
 * 실행: node --test tests/unit/grid-active-line-reset.test.mjs
 *
 * ★배경 — 그리드 줄을 한 번 누르면 활성줄(WeakMap)이 영영 안 지워져서, 블럭을 «블럭으로» 다시
 *   골라도 Backspace 가 줄 삭제 분기(editor.js)로 새 한 줄짜리 칸이면 토스트만 뜨고 블럭이 안
 *   지워졌다. 캔버스 클릭이 넘기던 «undefined(=기억하던 줄 되살리기)»가 입구였다.
 * ★prop-grid.js 는 UI 의존이 많아 통째 import 가 무겁다 → 순수 함수 grdResolveClickAddr 의
 *   «실물 소스»를 중괄호 균형으로 떠내 평가한다(사본을 따로 두지 않으니 두 벌로 갈라지지 않는다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

const PROP_GRID = read('js/props/prop-grid.js');
const resolve = new Function(`${extractFn(PROP_GRID, 'grdResolveClickAddr')}; return grdResolveClickAddr;`)();

const PREV = { r: 1, c: 2, li: 0 };

test('줄/빈 칸을 누르면(at 있음) at 을 그대로 돌려준다', () => {
  assert.deepEqual(resolve({ at: { r: 0, c: 0, li: 1 }, prevAddr: PREV, insideCell: true }), { r: 0, c: 0, li: 1 });
  assert.deepEqual(resolve({ at: { r: 0, c: 1, li: null }, prevAddr: null, insideCell: true }), { r: 0, c: 1, li: null });
});

test('줄 있는 칸의 여백(at 없음, 칸 안) → 직전 줄 유지(D5), 직전이 없으면 null', () => {
  assert.deepEqual(resolve({ at: undefined, prevAddr: PREV, insideCell: true }), PREV);
  assert.equal(resolve({ at: undefined, prevAddr: null, insideCell: true }), null);
});

test('★칸 밖(테두리·패딩·gap) → 직전 줄이 있어도 null = 블럭 전체 선택', () => {
  assert.equal(resolve({ at: undefined, prevAddr: PREV, insideCell: false }), null);
});

test('★어떤 입력에도 undefined 를 돌려주지 않는다(undefined = 옛 줄 되살리기 = 버그 입구)', () => {
  for (const at of [undefined, { r: 0, c: 0, li: 0 }])
    for (const prevAddr of [undefined, null, PREV])
      for (const insideCell of [undefined, false, true])
        assert.notEqual(resolve({ at, prevAddr, insideCell }), undefined, JSON.stringify({ at, prevAddr, insideCell }));
  assert.notEqual(resolve(), undefined);
});

test('소스 가드: 캔버스 클릭은 deselectAll «전에» 직전 줄을 잡고 grdResolveClickAddr 로 판정한다', () => {
  const src = read('js/block-drag.js');
  const iPrev = src.indexOf('const _grdPrevAddr');
  assert.ok(iPrev > 0, '_grdPrevAddr 캡처가 없다');
  const iDes = src.indexOf('window.deselectAll();', iPrev);
  const iRes = src.indexOf('grdResolveClickAddr', iPrev);
  assert.ok(iDes > iPrev && iRes > iDes, '순서: 캡처 → deselectAll → 판정 이어야 한다(뒤집으면 D5 가 조용히 깨진다)');
});

test('소스 가드: 블럭으로 고르는 경로(deselectAll·레이어 패널·MCP selectBlock)가 활성줄을 해제한다', () => {
  const ed = read('js/editor.js');
  const des = extractFn(ed, 'deselectAll');
  assert.match(des, /grdClearAllActiveLines\?\.\(canvas\)/, 'deselectAll 이 활성줄 모델을 안 지운다');
  assert.match(read('js/panels/layer-panel-items.js'), /isGrid\)\s*window\.showGridProperties\?\.\(block,\s*null\)/,
    '레이어 패널이 null 을 명시하지 않는다(1-인자면 옛 줄이 되살아난다)');
  assert.match(read('js/block-edit.js'), /grid-block'\)\)\s*window\.showGridProperties\?\.\(block,\s*null\)/,
    'MCP selectBlock 이 null 을 명시하지 않는다');
});

test('소스 가드: T-009 버그B 줄 삭제 분기 조건은 그대로다(DOM 마커 게이트 금지)', () => {
  const ed = read('js/editor.js');
  const del = extractFn(ed, 'deleteSelectedFromCanvas');
  assert.match(del, /if \(gridSel && gridAddr && gridAddr\.li !== null && gridAddr\.li !== undefined\)/);
  assert.doesNotMatch(del, /grd-line-selected/, '줄 삭제를 DOM 마커로 게이트하면 재렌더 틈에 블럭 통삭제로 샌다');
});
