/* grid-line-move-wiring.test.mjs — 「칸 안의 줄을 ⌘↑/↓ 로 옮긴다」의 «배선»과 «셈». (2026-09-26)
 *
 * ★DOM 검사(tests/dom/grid-line-move-cmdarrow.dom.spec.js)는 «행동»을 잰다 — 진짜 그리드에
 *   진짜 updateGridBlock 을 통과시켜 「줄이 칸 안에서 움직이고 행은 제자리인가」를 본다.
 * ★여기서 재는 건 다른 두 축이다:
 *   ⑴ «배선·순서» — 줄 이동을 묻는 자리가 «블럭 이동보다 앞»이고 «pushHistory 보다 앞»인가.
 *      ⛔뒤에 두면: 앞이면 줄이 움직이고, 뒤면 블럭이 움직인다 — 그게 이 카드의 증상이었다.
 *      ⛔이력보다 뒤면: 막는 분기가 «빈 항목»을 쌓아 ⌘Z 가 아무것도 안 되돌리는 칸을 만든다.
 *   ⑵ «셈» — grdMoveLine 의 splice 산수(경계·무효 주소·활성줄 되돌리기)를 실물 소스로 돌린다.
 *
 * ⛔사본을 두지 않는다: js/editor.js · js/props/prop-grid.js 에서 소스를 떠내 평가한다.
 * 실행: node --test tests/unit/grid-line-move-wiring.test.mjs
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
  assert.ok(m, '함수를 못 찾았다: ' + name);
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

const EDITOR = read('js/editor.js');
const PROP_GRID = read('js/props/prop-grid.js');

/** ⌘↑/↓ 분기의 «몸통» — 글자수 창이 아니라 중괄호 균형으로 떠낸다. */
const CMD_ARROW_ANCHOR = "if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (e.metaKey || e.ctrlKey)) {";
function cmdArrowBlock(src) {
  const n = src.split(CMD_ARROW_ANCHOR).length - 1;
  assert.equal(n, 1, `⌘방향키 분기가 ${n} 곳이다 — 하나여야 한다`);
  const k = src.indexOf(CMD_ARROW_ANCHOR);
  let d = 0, i = k;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) { i++; break; } }
  }
  assert.ok(i < src.length, '⌘방향키 분기의 끝을 못 찾았다');
  return src.slice(k, i);
}

/* ═══ ⑴ 배선·순서 ═══════════════════════════════════════════════════════ */

test('★⌘↑/↓ 분기가 줄 이동을 «먼저» 묻는다 — 블럭 찾기·pushHistory 보다 앞', () => {
  const blk = cmdArrowBlock(EDITOR);
  const iAsk  = blk.indexOf('moveGridLineFromCanvas(');
  const iSel  = blk.indexOf("document.querySelectorAll('.selected')");
  const iPush = blk.indexOf("pushHistory('블록 이동')");
  assert.ok(iAsk >= 0, '★⌘↑/↓ 가 줄 이동을 아예 안 묻는다 = 줄을 골라도 블럭이 통째로 움직인다');
  assert.ok(iSel >= 0, '블럭 찾기(.selected)가 사라졌다 — 블럭 이동 회귀');
  assert.ok(iPush >= 0, "블럭 이동의 pushHistory('블록 이동')가 사라졌다");
  assert.ok(iAsk < iSel, '★줄 이동을 블럭 찾기 «뒤»에 물었다 = closest(".row") 가 먼저 행을 집는다');
  assert.ok(iAsk < iPush, '★줄 이동을 이력 «뒤»에 물었다 = 막는 분기가 빈 항목을 쌓는다');
  assert.match(blk.slice(iAsk, iAsk + 140), /moveGridLineFromCanvas\([^)]*\)\)\s*\{\s*e\.preventDefault\(\);\s*return;/,
    '★참이어도 소진(preventDefault+return)을 안 한다 — 줄을 옮기고 «블럭도» 옮긴다');
});

test('★줄 이동 게이트 셋이 이 순서다 — 단독선택 → 중첩(np) 막기 → 바깥 줄 옮기기', () => {
  const fn = extractFn(EDITOR, 'moveGridLineFromCanvas');
  const iSole = fn.indexOf('grdIsSoleSelected');
  const iNp   = fn.indexOf('gridAddr.np');
  const iMove = fn.indexOf('grdMoveLine');
  assert.ok(iSole >= 0, '★다중선택 게이트가 없다 — ⌘클릭 다중선택에서 첫 그리드의 줄이 조용히 옮겨진다');
  assert.ok(iNp >= 0, '★중첩(np) 게이트가 없다 — 사용자가 고른 적 없는 duo 줄이 통째로 옮겨진다');
  assert.ok(iMove >= 0, '★옮기는 길(grdMoveLine)을 안 부른다');
  assert.ok(iSole < iNp, '★단독선택 판정이 np 게이트보다 뒤다');
  assert.ok(iNp < iMove, '★np 게이트가 옮기기보다 뒤다 = 먼저 옮기고 나서 막는다');
  assert.match(fn.slice(iNp, iNp + 260), /consumed = true;[\s\S]*showToast/,
    '★중첩에서 «먹고 멈추»지 않는다 — false 로 흘리면 블럭 이동으로 샌다(말도 안 해준다)');
  assert.ok(!/pushHistory/.test(fn),
    '★여기서 pushHistory 를 부른다 — 쓰기는 updateGridBlock 이 스스로 1회 쌓는다(두 칸이 된다)');
});

/* ═══ ⑵ 셈 — grdMoveLine 의 splice 산수 ═════════════════════════════════ */

/** 실물 grdMoveLine 을 가짜 이웃들로 돌린다. @returns {{call, calls}} */
function makeMover(lines) {
  const calls = { patch: [], active: [] };
  let active = { r: 0, c: 0, li: 0 };
  const scope = {
    getGridModel: () => ({ cells: [[{ lines }]] }),
    grdGetActiveLine: () => active,
    grdSetActiveLine: (_b, a) => { active = a; calls.active.push(a); },
    window: { updateGridBlock: (id, partial) => { calls.patch.push(partial); return { ok: true }; } },
  };
  const names = Object.keys(scope);
  const fn = new Function(...names, `${extractFn(PROP_GRID, 'grdMoveLine')}; return grdMoveLine;`)(...names.map(n => scope[n]));
  return { fn, calls, getActive: () => active, setActive: (a) => { active = a; } };
}
const texts = (partial) => partial.patchCell.lines.map(l => l.text);
const L3 = () => [{ text: 'A' }, { text: 'B' }, { text: 'C' }];

test('★아래로 옮기면 그 줄만 한 칸 내려간다 — 그리고 활성줄이 «따라간다»', () => {
  const m = makeMover(L3());
  assert.deepEqual(m.fn({}, { r: 0, c: 0 }, 1, 1), { ok: true, li: 2 });
  assert.equal(m.calls.patch.length, 1, '★patchCell 이 한 번만 나가야 한다(이력 한 칸)');
  assert.deepEqual(texts(m.calls.patch[0]), ['A', 'C', 'B']);
  assert.deepEqual(m.getActive(), { r: 0, c: 0, li: 2 }, '★선택이 옮긴 줄을 안 따라갔다');
});

test('★위로 옮기면 그 줄만 한 칸 올라간다', () => {
  const m = makeMover(L3());
  assert.deepEqual(m.fn({}, { r: 0, c: 0 }, 2, -1), { ok: true, li: 1 });
  assert.deepEqual(texts(m.calls.patch[0]), ['A', 'C', 'B']);
});

test('★칸의 끝은 EDGE — «아무것도 쓰지 않는다»(빈 이력이 안 쌓인다)', () => {
  for (const [li, dir] of [[0, -1], [2, 1]]) {
    const m = makeMover(L3());
    assert.deepEqual(m.fn({}, { r: 0, c: 0 }, li, dir), { ok: false, code: 'EDGE' }, `li=${li} dir=${dir}`);
    assert.equal(m.calls.patch.length, 0, '★갈 자리가 없는데 patchCell 이 나갔다');
    assert.equal(m.calls.active.length, 0, '★갈 자리가 없는데 활성줄을 건드렸다');
  }
});

test('★무효한 주소는 INVALID — 쓰지 않는다 (그 사이 데이터가 바뀐 경우)', () => {
  for (const [lines, li] of [[L3(), 3], [L3(), -1], [L3(), null], [L3(), 'x'], [null, 0], [[], 0]]) {
    const m = makeMover(lines);
    assert.deepEqual(m.fn({}, { r: 0, c: 0 }, li, 1), { ok: false, code: 'INVALID' }, JSON.stringify([lines, li]));
    assert.equal(m.calls.patch.length, 0);
  }
});

test('★쓰기가 거절되면 활성줄을 «되돌린다» — 없는 li 를 가리키지 않는다(grdAddLine 규약 계승)', () => {
  const lines = L3();
  const calls = { active: [] };
  let active = { r: 0, c: 0, li: 1 };
  const scope = {
    getGridModel: () => ({ cells: [[{ lines }]] }),
    grdGetActiveLine: () => active,
    grdSetActiveLine: (_b, a) => { active = a; calls.active.push(a); },
    window: { updateGridBlock: () => ({ ok: false, code: 'INVALID', message: 'nope' }) },
  };
  const names = Object.keys(scope);
  const fn = new Function(...names, `${extractFn(PROP_GRID, 'grdMoveLine')}; return grdMoveLine;`)(...names.map(n => scope[n]));
  const res = fn({}, { r: 0, c: 0 }, 1, 1);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'INVALID');
  assert.deepEqual(active, { r: 0, c: 0, li: 1 }, '★거절됐는데 활성줄이 옮긴 자리에 남았다');
});

test('★줄 «수»는 안 바뀐다 — 상한(MAX_CELL_LINES) 확인이 필요 없는 까닭', () => {
  const m = makeMover(L3());
  m.fn({}, { r: 0, c: 0 }, 0, 1);
  assert.equal(m.calls.patch[0].patchCell.lines.length, 3, '★옮기기가 줄 수를 바꿨다');
});
