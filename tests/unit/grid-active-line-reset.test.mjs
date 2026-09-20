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

/* ── 0918r2 T-058: 피그마식 «첫 클릭 = 블럭 선택, 이미 선택된 그리드의 클릭 = 줄 선택» ──
 * 1라운드(d7a8b9b)는 «떠났다 돌아오는» 경로만 고쳤다. 선택 안 된 그리드를 처음 눌러도 누른 곳이
 * 줄이면 곧바로 활성줄이 돼서(그리드 면적 대부분이 줄), ⌫ 가 줄 삭제 분기로 새 한 줄 칸이면 토스트만,
 * 두 줄 이상이면 줄 하나가 조용히 지워졌다(현빈 원 증상 잔존). */
const AT_LINE = { r: 0, c: 0, li: 1 };
const AT_EMPTY = { r: 0, c: 1, li: null };

test('0918r2 (a) 선택 안 된 그리드의 줄을 눌렀다 → null(블럭 선택)', () => {
  assert.equal(resolve({ at: AT_LINE, prevAddr: null, insideCell: true, wasSelected: false }), null);
  assert.equal(resolve({ at: AT_LINE, prevAddr: PREV, insideCell: true, wasSelected: false }), null);
});
test('0918r2 (b) 선택 안 된 그리드의 빈 칸을 눌렀다 → null(블럭 선택)', () => {
  assert.equal(resolve({ at: AT_EMPTY, prevAddr: null, insideCell: true, wasSelected: false }), null);
});
test('0918r2 (c) 이미 선택된 그리드의 줄/빈 칸 → at(줄/칸 선택 — T-009 흐름)', () => {
  assert.deepEqual(resolve({ at: AT_LINE, prevAddr: null, insideCell: true, wasSelected: true }), AT_LINE);
  assert.deepEqual(resolve({ at: AT_EMPTY, prevAddr: null, insideCell: true, wasSelected: true }), AT_EMPTY);
});
test('0918r2 (d) 이미 선택된 그리드, 줄 있는 칸의 여백 → 직전 줄 유지(D5)', () => {
  assert.deepEqual(resolve({ at: undefined, prevAddr: PREV, insideCell: true, wasSelected: true }), PREV);
});
test('0918r2 (e) 이미 선택된 그리드, 칸 밖 → null', () => {
  assert.equal(resolve({ at: undefined, prevAddr: PREV, insideCell: false, wasSelected: true }), null);
});
test('0918r2 (f) wasSelected 생략 = 옛 동작(하위호환)', () => {
  assert.deepEqual(resolve({ at: AT_LINE, prevAddr: null, insideCell: true }), AT_LINE);
  assert.deepEqual(resolve({ at: undefined, prevAddr: PREV, insideCell: true }), PREV);
  for (const wasSelected of [undefined, false, true])
    assert.notEqual(resolve({ at: AT_LINE, prevAddr: PREV, insideCell: true, wasSelected }), undefined);
});
test('0918r2 (g) 소스 가드: «이미 선택됐나» 캡처는 deselectAll «전», 판정에 wasSelected 로 넘긴다', () => {
  const src = read('js/block-drag.js');
  const iCap = src.indexOf('const _grdWasSelected');
  assert.ok(iCap > 0, '_grdWasSelected 캡처가 없다');
  const iDes = src.indexOf('window.deselectAll();', iCap);
  const iPrevDes = src.lastIndexOf('window.deselectAll();', iCap);
  const iPrev = src.indexOf('const _grdPrevAddr');
  assert.ok(iPrevDes < iPrev, '캡처와 _grdPrevAddr 사이에 deselectAll 이 끼면 안 된다');
  const iRes = src.indexOf('wasSelected: _grdWasSelected', iCap);
  assert.ok(iDes > iCap && iRes > iDes, '순서: 캡처 → deselectAll → 판정(뒤집으면 항상 false → 줄 선택 불가)');
  /* 조상 제외 헬퍼 — 프레임 안 그리드가 «늘 이미 선택됨»으로 보이면 원 버그가 부활한다.
     본체는 prop-grid.js grdIsSoleSelected «한 곳»(editor.js 줄 삭제 게이트와 공유), block-drag 는 위임만. */
  const helper = extractFn(PROP_GRID, 'grdIsSoleSelected');
  assert.match(helper, /el\.contains\(block\)/, '조상(부모 프레임·섹션) selected 를 빼지 않는다');
  assert.match(helper, /classList\.contains\('selected'\)/);
  const deleg = extractFn(src, '_isSoleSelectedBlock');
  assert.match(deleg, /window\.grdIsSoleSelected/, 'block-drag 가 판정 사본을 따로 들고 있다(두 판정이 갈린다)');
  assert.match(deleg, /: false/, '헬퍼 부재 시 «블럭 선택»(false) 쪽으로 떨어져야 한다');
});
test('0918r2 (h) grdIsSoleSelected: 조상/자손 selected 는 무시, 형제 selected 는 다중선택', () => {
  const src = read('js/block-drag.js');
  const mk = (sel, kids = []) => {
    const n = { sel, kids, parent: null,
      classList: { contains: (c) => c === 'selected' && n.sel },
      contains(o) { for (let x = o; x; x = x.parent) if (x === n) return true; return false; } };
    kids.forEach(k => { k.parent = n; });
    return n;
  };
  const all = (n) => [n, ...n.kids.flatMap(all)];
  const run = (root, block) => {
    const doc = { getElementById: () => ({ querySelectorAll: () => all(root).filter(x => x.sel) }) };
    return new Function('document', `${extractFn(PROP_GRID, 'grdIsSoleSelected')}; return grdIsSoleSelected;`)(doc)(block);
  };
  let g = mk(true); let fr = mk(true, [g]); let sec = mk(true, [fr]);
  assert.equal(run(mk(false, [sec]), g), true, '프레임·섹션 selected 는 조상 → 단독 선택');
  g = mk(false); sec = mk(true, [mk(true, [g])]);
  assert.equal(run(mk(false, [sec]), g), false, '그리드 자신이 selected 가 아니면 false');
  g = mk(true); const other = mk(true); sec = mk(true, [g, other]);
  assert.equal(run(mk(false, [sec]), g), false, '형제 블럭도 selected(다중선택) → false');
});

/* ── 0918r2 T-058 픽스 라운드: 다중선택에서 블럭 삭제 의도가 줄 삭제로 새던 누수 ──
 * ⌘클릭(toggleBlockSelect)은 활성줄을 안 지웠고, deleteSelectedFromCanvas 줄 삭제 분기는 선택 개수를 안 보고
 * «첫» .grid-block.selected 의 활성줄만 봤다 → [A(줄 선택)+B] 에서 ⌫/⌘X = 두 블럭 다 남고 A 의 줄 하나만 삭제.
 * 붙여넣기 뒤 [원본(줄)+사본] 도 같은 상태(사본이 selected 로 들어온다). */
test('0918r2 (i) 소스 가드: 줄 삭제 분기 «앞»에서 단독 선택(grdIsSoleSelected)을 확인하고, 아니면 줄 선택을 끝낸다', () => {
  const del = extractFn(read('js/editor.js'), 'deleteSelectedFromCanvas');
  const iGate = del.indexOf('grdIsSoleSelected(gridSel)');
  const iBranch = del.indexOf('if (gridSel && gridAddr && gridAddr.li !== null');
  assert.ok(iGate > 0, '줄 삭제 분기가 선택 개수를 안 본다(다중선택 ⌫ 가 줄로 샌다)');
  assert.ok(iGate < iBranch, '게이트는 줄 삭제 분기 «앞»이어야 한다');
  const gate = del.slice(iGate, iBranch);
  assert.match(gate, /grdDropLineSelection/);
  assert.match(gate, /gridAddr = null/);
});
test('0918r2 (j) 소스 가드: ⌘클릭 토글·붙여넣기는 그리드 줄 선택을 끝낸다', () => {
  const ed = read('js/editor.js');
  assert.match(extractFn(ed, 'toggleBlockSelect'), /grdDropLineSelection\?\.\(/, '⌘클릭이 활성줄을 남긴다');
  assert.match(extractFn(ed, 'pasteClipboard'), /grdDropLineSelection\?\.\(/, '붙여넣기가 활성줄을 남긴다');
});
test('0918r2 (k) grdDropLineSelection: 모델 + 줄/칸 마커를 모두 지운다', () => {
  const fn = new Function(`const _m = new Map();
    function grdSetActiveLine(b, a) { _m.set(b, a || null); }
    ${extractFn(PROP_GRID, 'grdClearAllActiveLines')}
    ${extractFn(PROP_GRID, 'grdDropLineSelection')}
    return { drop: grdDropLineSelection, get: (b) => _m.get(b) ?? null, set: grdSetActiveLine };`)();
  const g = { id: 'g' };
  fn.set(g, { r: 0, c: 0, li: 1 });
  const removed = [];
  const mark = (cls) => ({ classList: { remove: (c) => removed.push([cls, c]) } });
  const root = { querySelectorAll: (sel) => sel === '.grid-block' ? [g]
    : sel === '.grd-line-selected' ? [mark('L')] : sel === '.grd-cell-selected' ? [mark('C')] : [] };
  fn.drop(root);
  assert.equal(fn.get(g), null);
  assert.deepEqual(removed, [['L', 'grd-line-selected'], ['C', 'grd-cell-selected']]);
});
