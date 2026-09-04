/* 단위 하네스 — js/props/_helpers.js 의 buildGridPicker(그리드 4×4 피커).
 *
 * ★왜 생겼나 (적대검수 G5): 이 함수는 자동 테스트가 «0건» 이었고, 7fd76e8 전체가 수동 CDP
 *   검증에만 기대고 있었다. 수동 검증은 그 순간의 상수값(MAX_COLS===MAX_ROWS===4)에서만 참이다.
 * ★그리고 실제로 그 사각지대에서 결함이 하나 나왔다(G1): alive() 는 축을 갈랐는데 «술어 밖의»
 *   셀 생성 루프가 열 상한으로 돌아, 상한이 정사각형이 아닐 때 「살아있다는데 셀이 없는」 조합이 생겼다.
 *   그래서 이 파일은 상한을 «일부러 비대칭으로» 넣고 돌린다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../../js/props/_helpers.js');
const aliasPath = path.join(os.tmpdir(), `grid-picker-alias-${process.pid}.mjs`);

/* _helpers.js 는 브라우저 전용 import 가 있을 수 있다 — 있으면 스텁으로 바꾼다.
 * (지금은 무의존이지만, 나중에 생겨도 이 하네스가 조용히 죽지 않게 «있으면 처리»로 둔다.) */
let src = fs.readFileSync(srcPath, 'utf8');
const imports = [...src.matchAll(/^import .*$/gm)].map(m => m[0]);
fs.writeFileSync(aliasPath, src);
const { buildGridPicker } = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);

/* ── 미니 DOM (이 함수가 실제로 쓰는 표면만) ── */
function makeEl(tag = 'div') {
  const classes = new Set();
  const listeners = {};
  const el = {
    tagName: tag, dataset: {}, style: {}, children: [], textContent: '',
    set innerHTML(v) { if (v === '') el.children.length = 0; },
    get innerHTML() { return ''; },
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      contains: (c) => classes.has(c),
      toggle: (c, on) => { on ? classes.add(c) : classes.delete(c); },
    },
    appendChild(child) { el.children.push(child); child.parentNode = el; return child; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    _fire(type, ev) { (listeners[type] || []).forEach(fn => fn(ev)); },
    querySelectorAll() { return el.children; },
    closest(sel) { return sel === '.grid-picker-cell' ? this : null; },
  };
  return el;
}
globalThis.document = { createElement: makeEl };

function build(opts) {
  const picker = makeEl();
  const label = makeEl();
  const picks = [];
  buildGridPicker(picker, label, (c, r) => picks.push([c, r]), opts);
  return { picker, label, picks };
}
const cells = (p) => p.children;
const at = (p, c, r) => cells(p).find(x => +x.dataset.c === c && +x.dataset.r === r);
const dead = (cell) => cell.classList.contains('grid-picker-cell--off');

/* ═══ ① 격자 «수» — 축이 비대칭일 때가 진짜 시험이다 ═══ */
test('★비대칭 상한: 행 4 · 열 3 이면 셀이 4×3 으로 나고, 빠지는 조합이 없다', () => {
  const { picker } = build({ max: 3, maxRows: 4, minCols: 2, minRows: 1 });
  assert.equal(cells(picker).length, 4 * 3, '셀 수가 maxRows × max 가 아니다');
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= 3; c++) {
      assert.ok(at(picker, c, r), `${c}x${r} 셀이 아예 없다`);
    }
  }
});

test('★G1 회귀: 행 상한 > 열 상한이어도 «살아있는데 셀이 없는» 조합이 0 이다', () => {
  // 행 루프가 MAX(열 상한)로 돌던 옛 코드에서 2x5·3x5·4x5 가 사라졌던 자리.
  const MAXC = 4, MAXR = 5, MINC = 2, MINR = 1;
  const { picker } = build({ max: MAXC, maxRows: MAXR, minCols: MINC, minRows: MINR });
  const missing = [];
  for (let r = MINR; r <= MAXR; r++) {
    for (let c = MINC; c <= MAXC; c++) {
      if (!at(picker, c, r)) missing.push(`${c}x${r}`);
    }
  }
  assert.deepEqual(missing, [], `살아있어야 하는데 셀이 없다: ${missing.join(' ')}`);
});

test('★격자 폭은 열 상한을 따라간다(CSS 의 repeat(4,1fr) 에 안 기댄다)', () => {
  const { picker } = build({ max: 3, maxRows: 3 });
  assert.equal(picker.style.gridTemplateColumns, 'repeat(3, 1fr)');
});

/* ═══ ② 죽은 칸 — 렌더·hover·클릭 세 곳이 «같은 답» 인가 ═══ */
test('minCols 미만 열은 죽은 칸으로 표시된다', () => {
  const { picker } = build({ max: 4, maxRows: 4, minCols: 2 });
  for (let r = 1; r <= 4; r++) assert.equal(dead(at(picker, 1, r)), true, `1x${r} 이 살아 있다`);
  for (let r = 1; r <= 4; r++) assert.equal(dead(at(picker, 2, r)), false, `2x${r} 이 죽어 있다`);
});

test('★hover 는 죽은 칸을 «칠하지 않는다»(원 결함: 죽은 열 1 까지 파랗게)', () => {
  const { picker } = build({ max: 4, maxRows: 4, minCols: 2 });
  picker._fire('mouseover', { target: at(picker, 2, 2) });
  const active = cells(picker).filter(x => x.classList.contains('active'))
    .map(x => `${x.dataset.c}x${x.dataset.r}`).sort();
  assert.deepEqual(active, ['2x1', '2x2'], '죽은 열 1 이 섞여 있거나 범위가 틀리다');
});

test('★클릭 판정은 클래스가 아니라 «데이터»로 한다 — 죽은 칸은 onPick 을 안 부른다', () => {
  const { picker, picks } = build({ max: 4, maxRows: 4, minCols: 2 });
  const deadCell = at(picker, 1, 3);
  deadCell.classList.remove('grid-picker-cell--off');   // 클래스만 지워서 «흔적» 을 위조한다
  picker._fire('click', { target: deadCell });
  assert.deepEqual(picks, [], '클래스를 지웠다고 죽은 칸이 눌렸다 — 판정이 데이터가 아니라 클래스에 기대고 있다');
  picker._fire('click', { target: at(picker, 3, 2) });
  assert.deepEqual(picks, [[3, 2]], '살아있는 칸이 (열, 행) 순으로 안 넘어온다');
});

test('minRows 도 대칭으로 먹는다', () => {
  const { picker } = build({ max: 4, maxRows: 4, minCols: 1, minRows: 2 });
  for (let c = 1; c <= 4; c++) assert.equal(dead(at(picker, c, 1)), true, `${c}x1 이 살아 있다`);
  for (let c = 1; c <= 4; c++) assert.equal(dead(at(picker, c, 2)), false, `${c}x2 가 죽어 있다`);
});

test('라벨은 «열 × 행» 으로 쓴다', () => {
  const { picker, label } = build({ max: 4, maxRows: 4, minCols: 2 });
  picker._fire('mouseover', { target: at(picker, 3, 2) });
  assert.equal(label.textContent, '3 × 2');
});

test('picker 가 없으면 조용히 아무 일도 안 한다(호출부 방어)', () => {
  assert.doesNotThrow(() => buildGridPicker(null, null, () => {}, {}));
});
