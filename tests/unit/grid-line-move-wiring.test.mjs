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

/* ★★2026-09-27 (T-227) — 이 검사는 게이트 셋이 «한 함수 안»에 있는 것으로 잼으로써
 *   그 «자리»를 잠그고 있었다. 손잡이가 둘이 되면서(⌘↑/↓ 같은 칸 · ⌘←/→ 다른 칸) 게이트가
 *   `_gridActiveOuterLine` 한 벌로 빠졌고, 그때 이 검사가 빨개졌다. ★계약(무엇을 어느 순서로
 *   묻는가)은 한 자도 안 바뀌었다 — 그래서 «자리»로 재던 것을 «흐름»으로 고쳐 다시 잠근다:
 *     ⓐ 게이트 함수 안 : 단독선택 → 중첩(np)
 *     ⓑ 손잡이 함수 안 : 게이트 호출 → 옮기기
 *     ⓒ ★손잡이는 주소를 «직접» 묻지 않는다 — 그 한 줄이 복붙(두 벌 게이트)을 막는다.
 *   ⛔ⓒ를 빼면 이 검사는 「게이트가 있다」만 잠그고, 손잡이가 제 손으로 다시 판정해도 초록이다. */
test('★줄 이동 게이트 셋이 이 순서다 — 단독선택 → 중첩(np) 막기 → 바깥 줄 옮기기', () => {
  const gate = extractFn(EDITOR, '_gridActiveOuterLine');
  const iSole = gate.indexOf('grdIsSoleSelected');
  const iNp   = gate.indexOf('gridAddr.np');
  assert.ok(iSole >= 0, '★다중선택 게이트가 없다 — ⌘클릭 다중선택에서 첫 그리드의 줄이 조용히 옮겨진다');
  assert.ok(iNp >= 0, '★중첩(np) 게이트가 없다 — 사용자가 고른 적 없는 duo 줄이 통째로 옮겨진다');
  assert.ok(iSole < iNp, '★단독선택 판정이 np 게이트보다 뒤다');

  const fn = extractFn(EDITOR, 'moveGridLineFromCanvas');
  const iGate = fn.indexOf('_gridActiveOuterLine(');
  const iNest = fn.indexOf('got.nested');
  const iMove = fn.indexOf('grdMoveLine');
  assert.ok(iGate >= 0, '★손잡이가 게이트 한 벌(_gridActiveOuterLine)을 안 부른다');
  assert.ok(iNest >= 0, '★중첩(np) 판정을 손잡이가 안 받는다 — 게이트가 막아도 흘러간다');
  assert.ok(iMove >= 0, '★옮기는 길(grdMoveLine)을 안 부른다');
  assert.ok(iGate < iMove, '★게이트를 옮기기 «뒤»에 물었다 = 먼저 옮기고 나서 막는다');
  assert.ok(iNest < iMove, '★np 게이트가 옮기기보다 뒤다 = 먼저 옮기고 나서 막는다');
  assert.match(fn.slice(iNest, iNest + 320), /showToast[\s\S]*return true;/,
    '★중첩에서 «먹고 멈추»지 않는다 — false 로 흘리면 블럭 이동으로 샌다(말도 안 해준다)');
  assert.ok(!/grdGetActiveLine/.test(fn),
    '★손잡이가 주소를 «직접» 묻는다 — 게이트가 두 벌이 되어 ⌘↑ 와 ⌘← 의 판정이 갈린다');
  assert.ok(!/pushHistory/.test(fn),
    '★여기서 pushHistory 를 부른다 — 쓰기는 updateGridBlock 이 스스로 1회 쌓는다(두 칸이 된다)');
});

/* ═══ ⑵ 셈 — grdMoveLine 의 splice 산수 ═════════════════════════════════ */

/* ★★2026-09-27 (T-228 ①) — grdMoveLine 은 이제 「끝인가」만 보고 splice 는 grdMoveLineWithin
   이 한다(끄는 손이 «놓은 자리»를 주므로 자리 기반 문이 필요했다). ⛔그래서 «둘 다» 심는다 —
   하나만 심으면 `grdMoveLineWithin is not defined` 로 이 절이 통째로 죽는다(같은 날 DOM 쪽에서
   실제로 그렇게 아홉 개가 빨개졌다). ★새 이름을 부르기 시작하면 여기에 같이 심어라. */
const MOVE_FNS = [
  extractFn(PROP_GRID, 'grdMoveLineWithin'),
  extractFn(PROP_GRID, 'grdMoveLine'),
].join(';\n');

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
  const fn = new Function(...names, `${MOVE_FNS}; return grdMoveLine;`)(...names.map(n => scope[n]));
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
  const fn = new Function(...names, `${MOVE_FNS}; return grdMoveLine;`)(...names.map(n => scope[n]));
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

/* ═══ ⑶ ⌘←/→ 「옆 칸으로」 — 배선과 셈 (T-227, 0927) ══════════════════════
 * ★⑴⑵ 와 «같은 두 축»을 새 손잡이에도 건다. ⛔여기서 재지 않으면 「⌘↑ 는 잠겨 있고 ⌘← 는
 *   안 잠긴」 상태가 된다 — 같은 뜻의 두 키가 다른 보호를 받는 것이 이 레포의 버릇이었다.
 * ★DOM 검사(tests/dom/grid-line-move-across-cells.dom.spec.js)가 «행동»(꾸밈이 따라오나·
 *   ⌘Z 한 번에 둘 다 돌아오나)을 잰다. 여기선 «소스 배선»과 «splice 산수»만 본다. */

const CMD_LR_ANCHOR = "if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (e.metaKey || e.ctrlKey)) {";
function cmdLRBlock(src) {
  const n = src.split(CMD_LR_ANCHOR).length - 1;
  assert.equal(n, 1, `⌘←/→ 분기가 ${n} 곳이다 — 하나여야 한다`);
  const k = src.indexOf(CMD_LR_ANCHOR);
  let d = 0, i = k;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) { i++; break; } }
  }
  assert.ok(i < src.length, '⌘←/→ 분기의 끝을 못 찾았다');
  return src.slice(k, i);
}

test('★⌘←/→ 분기가 «옆 칸으로» 를 묻고 소진한다 — 그리고 편집 중에는 손을 뗀다', () => {
  const blk = cmdLRBlock(EDITOR);
  assert.match(blk, /moveGridLineAcrossCells\(\{ dir: e\.key === 'ArrowLeft' \? -1 : 1 \}\)/,
    '★⌘←/→ 가 「옆 칸으로」를 안 묻는다');
  assert.match(blk, /moveGridLineAcrossCells\([^)]*\)\)\s*\{\s*e\.preventDefault\(\);\s*return;/,
    '★참이어도 소진(preventDefault+return)을 안 한다');
  assert.match(blk, /text-block\.editing/, '★글자 편집 중인데 줄을 옮긴다 — ⌘← 는 캐럿 이동이어야 한다');
  assert.match(blk, /tagName === 'INPUT'/, '★입력칸에 포커스가 있는데 줄을 옮긴다');
  /* ⛔블럭 이동(⌘↑/↓)의 pushHistory 가 여기 «새로» 들어오면 안 된다 — ⌘←/→ 에는 이어받을
     블럭 이동이 없다(있는 줄로 만들면 「⌘← 로 블럭이 옆으로 간다」는 새 뜻이 생긴다). */
  assert.ok(!/pushHistory/.test(blk), '★⌘←/→ 분기가 이력을 쌓는다 — 쓰기는 updateGridBlock 몫이다');
});

test('★「옆 칸으로」 손잡이도 게이트 한 벌을 쓴다 — 행은 안 바꾸고 열만 한 칸', () => {
  const fn = extractFn(EDITOR, 'moveGridLineAcrossCells');
  assert.match(fn, /_gridActiveOuterLine\(\)/, '★게이트 한 벌을 안 부른다 — 판정이 두 벌이 된다');
  assert.match(fn, /got\.nested/, '★중첩(np) 판정을 안 받는다');
  assert.match(fn, /grdMoveLineToCell/, '★쓰는 길(grdMoveLineToCell)을 안 부른다');
  assert.match(fn, /r: got\.addr\.r[\s\S]*r: got\.addr\.r/,
    '★도착의 행(r)이 출발과 다르다 — 「옆 칸」은 같은 행이다');
  assert.match(fn, /c: got\.addr\.c \+ step/, '★도착 열이 «한 칸 옆»이 아니다');
  assert.ok(!/grdGetActiveLine/.test(fn), '★주소를 «직접» 묻는다 — 게이트가 두 벌이 된다');
  /* ★열 수를 여기서 세면 셈이 두 벌이 된다(쓰는 함수가 이미 INVALID 로 막는다). */
  assert.ok(!/cols/.test(fn), '★여기서 열 수를 센다 — 그 셈은 grdMoveLineToCell 한 곳에만 있어야 한다');
});

/** 실물 grdMoveLineToCell 을 가짜 이웃들로 돌린다.
 *  @param cells 2차원 [[{lines}, {lines}], …] · @param verdicts updateGridBlock 이 돌려줄 답들 */
function makeCrosser(cells, verdicts = []) {
  const calls = { patch: [], opts: [], active: [], toasts: [] };
  let active = { r: 0, c: 0, li: 0 };
  let n = 0;
  const scope = {
    getGridModel: () => ({ cells }),
    grdGetActiveLine: () => active,
    grdSetActiveLine: (_b, a) => { active = a; calls.active.push(a); },
    MAX_CELL_LINES: 20,
    window: {
      showToast: (m) => calls.toasts.push(m),
      updateGridBlock: (_id, partial, opts) => {
        calls.patch.push(partial); calls.opts.push(opts);
        return verdicts[n++] || { ok: true };
      },
    },
  };
  const names = Object.keys(scope);
  const fn = new Function(...names,
    `${extractFn(PROP_GRID, 'grdMoveLineToCell')}; return grdMoveLineToCell;`)(...names.map(n2 => scope[n2]));
  return { fn, calls, getActive: () => active, setActive: (a) => { active = a; } };
}
const cell = (...ts) => ({ lines: ts.map(t => ({ text: t })) });
const G2 = () => [[cell('A', 'B'), cell('X')]];

test('★옆 칸으로 옮기면 두 문이 나간다 — 출발에서 빠지고 도착의 «끝»에 붙는다', () => {
  const m = makeCrosser(G2());
  assert.deepEqual(m.fn({}, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, null), { ok: true, li: 1 });
  assert.equal(m.calls.patch.length, 2, '★두 문이 아니다 — patchCell 은 한 칸만 받는다');
  assert.deepEqual(m.calls.patch[0].patchCell, { r: 0, c: 0, lines: [{ text: 'B' }] });
  assert.deepEqual(m.calls.patch[1].patchCell, { r: 0, c: 1, lines: [{ text: 'X' }, { text: 'A' }] });
});

test('★★이력은 «한 칸»이다 — 첫 문만 쌓고 둘째 문은 noHistory 로 끈다(⌘Z 한 번)', () => {
  const m = makeCrosser(G2());
  m.fn({}, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, null);
  assert.ok(!m.calls.opts[0] || m.calls.opts[0].noHistory !== true,
    '★첫 문이 이력을 안 쌓았다 — 그러면 ⌘Z 가 이 이동을 «아예» 못 되돌린다');
  assert.equal(m.calls.opts[1] && m.calls.opts[1].noHistory, true,
    '★★둘째 문도 이력을 쌓는다 — ⌘Z 를 한 번만 누른 사용자는 «줄이 두 칸에 다 있는» 반쪽을 본다');
});

test('★활성줄이 옮긴 줄을 따라간다 — 그리고 첫 문 «전»에는 비워 둔다(없는 li 금지)', () => {
  const m = makeCrosser(G2());
  m.fn({}, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, null);
  assert.equal(m.calls.active[0], null,
    '★첫 문 전에 활성줄을 안 비웠다 — updateGridBlock 이 그리는 패널이 «방금 사라진 li»를 가리킨다');
  assert.deepEqual(m.getActive(), { r: 0, c: 1, li: 1 }, '★선택이 옮긴 줄을 안 따라갔다');
});

test('★꾸밈은 줄 «객체째» 따라온다 — 필드를 골라 베끼지 않는다', () => {
  const cells = [[{ lines: [{ text: 'A', fontSize: 33, color: '#abc', align: 'right' }] }, { lines: [] }]];
  const m = makeCrosser(cells);
  m.fn({}, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, null);
  assert.deepEqual(m.calls.patch[1].patchCell.lines[0],
    { text: 'A', fontSize: 33, color: '#abc', align: 'right' }, '★꾸밈이 도중에 떨어졌다');
});

test('★★상한은 «먼저» 본다 — 거절되는 순간 줄이 어느 칸에도 없어서는 안 된다', () => {
  const full = { lines: Array.from({ length: 20 }, (_, i) => ({ text: `F${i}` })) };
  const m = makeCrosser([[cell('A'), full]]);
  assert.deepEqual(m.fn({}, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, null), { ok: false, code: 'LIMIT' });
  assert.equal(m.calls.patch.length, 0, '★★상한을 나중에 봤다 — 출발 칸에서 이미 뗀 뒤라 줄이 사라진다');
  assert.equal(m.calls.toasts.length, 1, '★막았는데 아무 말도 안 했다');
});

test('★둘째 문이 거절되면 «되돌린다» — 줄이 어느 칸에도 없는 상태로 끝나지 않는다', () => {
  const m = makeCrosser(G2(), [{ ok: true }, { ok: false, code: 'RENDER_ERROR', message: 'boom' }]);
  m.setActive({ r: 0, c: 0, li: 0 });
  const res = m.fn({}, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, null);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'RENDER_ERROR');
  assert.equal(m.calls.patch.length, 3, '★되돌리는 문이 안 나갔다 — 줄이 사라진 채로 끝난다');
  assert.deepEqual(m.calls.patch[2].patchCell, { r: 0, c: 0, lines: [{ text: 'A' }, { text: 'B' }] },
    '★되돌림이 «원래 줄»을 복원하지 않는다');
  assert.equal(m.calls.opts[2] && m.calls.opts[2].noHistory, true,
    '★되돌림이 이력을 쌓는다 — ⌘Z 가 「되돌림을 되돌리는」 칸을 만난다');
  assert.deepEqual(m.getActive(), { r: 0, c: 0, li: 0 }, '★거절됐는데 활성줄이 도착 자리에 남았다');
});

test('★같은 칸은 SAME_CELL — 그 일은 grdMoveLine 몫이다(두 벌 금지)', () => {
  const m = makeCrosser(G2());
  assert.deepEqual(m.fn({}, { r: 0, c: 0 }, 0, { r: 0, c: 0 }, null), { ok: false, code: 'SAME_CELL' });
  assert.equal(m.calls.patch.length, 0);
});

test('★없는 칸·무효 주소는 INVALID — 열 수를 손잡이가 안 세는 까닭', () => {
  for (const [from, to] of [[0, { r: 0, c: -1 }], [0, { r: 0, c: 2 }], [0, { r: 1, c: 0 }],
                            [null, { r: 0, c: 1 }], [2, { r: 0, c: 1 }], ['x', { r: 0, c: 1 }]]) {
    const m = makeCrosser(G2());
    assert.deepEqual(m.fn({}, { r: 0, c: 0 }, from, to, null), { ok: false, code: 'INVALID' },
      JSON.stringify([from, to]));
    assert.equal(m.calls.patch.length, 0, '★무효인데 썼다');
  }
});

test('★toLi 를 주면 그 자리에 끼운다 — 드래그(T-228)가 쓸 문이 열려 있다', () => {
  const m = makeCrosser([[cell('A'), cell('X', 'Y')]]);
  assert.deepEqual(m.fn({}, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, 0), { ok: true, li: 0 });
  assert.deepEqual(m.calls.patch[1].patchCell.lines.map(l => l.text), ['A', 'X', 'Y']);
  const m2 = makeCrosser([[cell('A'), cell('X', 'Y')]]);
  assert.deepEqual(m2.fn({}, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, 99), { ok: true, li: 2 },
    '★범위 밖 toLi 를 «끝»으로 오려내지 않는다');
});
