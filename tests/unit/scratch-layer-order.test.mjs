/* scratch-layer-order.test.mjs — 스크래치 항목 ⌘[ / ⌘] 레이어 순서 (1020t2a2 · 현빈 「스크래치패드 간 커맨드 '[',']'
 *   이것만으로도 레이어 순서 변경」)
 * 실행: node --test tests/unit/scratch-layer-order.test.mjs
 *
 * ★동작(실키·겹침·저장→재열기)은 tests/dom/scratch-layer-order.dom.spec.js 가 잰다. 여기는 그 검사가 못 무는 자리:
 *   U0  ★기존 두 갈래(㈎ 오버레이 · ㈏ 자유배치 프레임)를 품은 moveSelectedBlocks 가 «바이트 무변»
 *   U0b ★죽은 «Cmd/Ctrl + [ / ]» 핸들러(free 프레임 z-order) 무접촉 — 결정 ⑸
 *   U1  배선 — ⌘[ / ⌘] 갈래가 가드 «뒤»·moveSelectedBlocks «앞»에서 스크래치에 먼저 묻는다
 *   U2  순수 규칙 _scratchLayerNext — 기대값은 «손으로» 적었다(구현에서 베끼지 않았다)
 *   U3  배열·저장·히스토리 배선 (DOM 만 바꾸면 재열기에 옛 순서 — 조용한 미저장)
 *   U4  가드 — ⌘C·⌘X 와 같은 잣대
 *   U5  판정(지디 a2 · 261021)이 각각 «한 자리»에 있다 — ⑴ ⇧ 무시 · ⑵ 히스토리 이름 = 캔버스 갈래 글자 · ⑶ 스크래치 우선
 *   U6  복수 선택 «전부 한 덩어리» — 순수 규칙 + 실제 scratchLayerOrder 몸(평가자 변이 V4 «첫 장만»을 문다)
 * ★양성대조 — 핀 b5148b48d64fa5615953b2fb670f4e22c1adc26a 에서 빨강 (1021 실측 · HOLE-EVAL.md):
 *   제품 2파일(js/editor.js · js/scratch-pad.js)을 핀으로 `git show` 한 판 · 2026-10-21 09:38 · 로그 work-1020t2a2/hole-eval/logs/pin-unit.log
 *   빨강 7 = U0b(핀엔 비석이 없다) · U1 · U2 · U3 · U4 · U5 · U6 / 초록 1 = U0(지키는 자 — moveSelectedBlocks 는 핀과 같다).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const { sliceBlock } = require_('./_slice-block.js');
const ROOT = path.join(__dirname, '..', '..');

const ED = fs.readFileSync(path.join(ROOT, 'js', 'editor.js'), 'utf8');
const SP = fs.readFileSync(path.join(ROOT, 'js', 'scratch-pad.js'), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const has = (src, head) => src.indexOf(head) >= 0;

test('U0 ★moveSelectedBlocks(㈎ 오버레이 · ㈏ 자유배치 프레임 · 흐름) 바이트 무변 — 갈래는 «더한다»', () => {
  const MOVE = sliceBlock(ED, 'function moveSelectedBlocks(');
  // 핀 b5148b48 에서 잰 값(손으로 박음) — 길이 8,021
  assert.equal(MOVE.length, 8021, '★moveSelectedBlocks 길이가 바뀌었다 — 스크래치 갈래를 그 안에 넣지 마라');
  assert.equal(sha(MOVE), '75a419d409e0e94a6433e0d17f9df6ddee2d3ab6188cd8ea8f9cd1c6c8a09bf3',
    '★moveSelectedBlocks 가 바뀌었다 — ㈎㈏ 는 손대지 않는 약속이다');
});

test('U0b ⛔죽은 «Cmd/Ctrl + [ / ]» 핸들러 몸 무접촉 — 남기고 비석만 단다 (판정 ⑸)', () => {
  const DEAD = sliceBlock(ED, "if ((e.metaKey || e.ctrlKey) && (e.key === '[' || e.key === ']'))");
  assert.equal(DEAD.length, 1872);
  assert.equal(sha(DEAD), '9a169c6f84b1fe75ce2b47c2d59201e2c3b793561961efa790fe82b7d5d7622f',
    '★죽은 핸들러 몸이 바뀌었다 — 지우는 것은 별건');
  const at = ED.indexOf("if ((e.metaKey || e.ctrlKey) && (e.key === '[' || e.key === ']'))");
  const above = ED.slice(Math.max(0, at - 600), at);
  assert.match(above, /⚠️이 갈래는 도달하지 않는다/, '★비석이 없다');
  // ⛔비석의 줄번호(:2510 등)는 단언하지 않는다 — editor.js 위쪽 한 줄만 늘어도 남의 일이 빨개진다(history.js 「줄번호로 가리키지 않는다」).
});

test('U1 ★⌘[ / ⌘] 갈래가 가드 뒤 · moveSelectedBlocks 앞에서 window.scratchLayerOrder 에 먼저 묻는다', () => {
  const meta = ED.indexOf('if (e.metaKey || e.ctrlKey) {');
  const bl = ED.indexOf("if (e.code === 'BracketLeft') {");
  const br = ED.indexOf("if (e.code === 'BracketRight') {");
  assert.ok(meta > 0 && bl > meta && br > bl, '★대괄호 갈래를 못 찾았다');
  for (const [at, dir] of [[bl, 'up'], [br, 'down']]) {
    const end = ED.indexOf(`moveSelectedBlocks('${dir}')`, at);
    const seg = ED.slice(at, end);
    const ask = seg.indexOf(`if (window.scratchLayerOrder?.('${dir}')) { e.preventDefault(); return; }`);
    assert.ok(ask > 0, `★${dir} 갈래에 스크래치 양보 줄이 없다`);
    assert.ok(seg.indexOf('e.target.isContentEditable) return;') < ask, `★${dir}: 양보 줄이 입력 가드 «앞»이다`);
    assert.ok(seg.indexOf('.text-block.editing') < ask, `★${dir}: 양보 줄이 편집 가드 «앞»이다`);
    assert.ok(ask < seg.lastIndexOf('e.preventDefault();'), `★${dir}: 양보 줄이 preventDefault «뒤»다`);
    // W1(overlay-group-zorder-wiring) 은 갈래 머리에서 400자 안에 moveSelectedBlocks 를 찾는다 — 미리 깨지 않게
    assert.ok(end - at <= 375, `★${dir}: 갈래 머리→moveSelectedBlocks ${end - at}자 — W1 400자 창 여유가 없다`);
  }
});

const loadNext = () => {
  assert.ok(has(SP, 'function _scratchLayerNext('), '★_scratchLayerNext 가 없다');
  const body = sliceBlock(SP, 'function _scratchLayerNext(');
  return new Function(`${body}\nreturn _scratchLayerNext;`)();
};
const run = (fn, order, picked, dir) => {
  const r = fn(order.split(''), picked.split(''), dir);
  return r === null ? null : r.join('');
};

test('U2 순수 규칙 — 손으로 적은 기대값 (⇧ 없음 — 한 칸만)', () => {
  const f = loadNext();
  assert.equal(f.length, 3, '★인자가 셋이 아니다 — toEnd(⇧) 가 되살아났나');
  // 'up' = ⌘[ = 뒤로 보내기(배열 앞쪽 = 아래) · 'down' = ⌘] = 앞으로 가져오기(배열 뒤쪽 = 위)
  assert.equal(run(f, 'ABC', 'C', 'up'), 'ACB');
  assert.equal(run(f, 'ABC', 'C', 'down'), null);
  assert.equal(run(f, 'ABC', 'A', 'up'), null);
  assert.equal(run(f, 'ABC', 'A', 'down'), 'BAC');
  assert.equal(run(f, 'ABC', 'B', 'up'), 'BAC');
  assert.equal(run(f, 'ABC', 'B', 'down'), 'ACB');
  // 여럿 = 한 덩어리(상대 순서 유지)
  assert.equal(run(f, 'ABCD', 'BD', 'up'), 'BDAC');
  assert.equal(run(f, 'ABCD', 'DB', 'up'), 'BDAC', '고른 순서가 아니라 지금 순서로 묶는다');
  assert.equal(run(f, 'ABCD', 'BD', 'down'), null);
  assert.equal(run(f, 'ABCD', 'AC', 'up'), null);
  assert.equal(run(f, 'ABCD', 'AC', 'down'), 'BDAC');
  assert.equal(run(f, 'ABCD', 'BC', 'up'), 'BCAD');
  assert.equal(run(f, 'ABCD', 'BC', 'down'), 'ADBC');
  // 형제 < 2 · 고른 것 0 · 모르는 id
  for (const d of ['up', 'down']) {
    assert.equal(run(f, 'A', 'A', d), null);
    assert.equal(run(f, 'ABC', '', d), null);
    assert.equal(run(f, 'ABC', 'Z', d), null);
  }
  assert.equal(f([], ['A'], 'up'), null);
});

test('U3 배열 `_scratchItems` 와 DOM 을 같이 바꾸고 저장 · ⌘Z 한 칸(sideEffects)', () => {
  assert.ok(has(SP, 'function _applyScratchOrder('), '★_applyScratchOrder 가 없다');
  const APPLY = sliceBlock(SP, 'function _applyScratchOrder(');
  assert.match(APPLY, /_scratchItems\.splice\(0, _scratchItems\.length,/, '★배열을 재배열하지 않는다 — 재열기에 옛 순서');
  assert.match(APPLY, /_saveScratch\(\)/, '★저장을 안 부른다');
  assert.match(APPLY, /replaceWith\(s\.el\)/, '★DOM 을 안 옮긴다');
  assert.ok(has(SP, 'window.scratchLayerOrder = function scratchLayerOrder('), '★window.scratchLayerOrder 가 없다');
  const ORD = sliceBlock(SP, 'window.scratchLayerOrder = function scratchLayerOrder(');
  assert.match(ORD, /_applyScratchOrder\(next\);/);
  assert.match(ORD, /window\.pushHistory\?\.\(SCRATCH_LAYER_HISTORY_NAME\[direction\], \{/, '★히스토리를 안 쌓는다');
  assert.match(ORD, /onUndo: \(\) => _applyScratchOrder\(before\)/);
  assert.match(ORD, /onRedo: \(\) => _applyScratchOrder\(next\)/);
  // 끝이라 안 움직이면 키는 가져가되 히스토리 0 (㈎ 의 «맨 끝» 규칙)
  assert.match(ORD, /if \(!next\) return true;/);
  assert.ok(ORD.indexOf('if (!next) return true;') < ORD.indexOf('pushHistory'));
});

test('U4 가드 — ⌘C·⌘X 와 같은 _scratchKeyGuardOk 가 첫 줄', () => {
  const ORD = sliceBlock(SP, 'window.scratchLayerOrder = function scratchLayerOrder(');
  const first = ORD.slice(ORD.indexOf('{') + 1).trim().split('\n')[0];
  assert.match(first, /^if \(!_scratchKeyGuardOk\(\)\) return false;/, `★첫 줄이 가드가 아니다: ${first}`);
  // 같은 스코프(initScratchPad 안)에 있어야 지역 술어가 보인다 — ⌘X 바로 뒤
  assert.ok(SP.indexOf('window.scratchCutSelected = function') < SP.indexOf('window.scratchLayerOrder = function'));
});

test('U5 판정(지디 a2)이 각각 «한 자리» — ⑴ ⇧ 무시 · ⑵ 이름 = 캔버스 갈래 · ⑶ 스크래치 우선 · ⑷ 항목끼리', () => {
  const count = (re) => (SP.match(re) || []).length;
  const ORD = sliceBlock(SP, 'window.scratchLayerOrder = function scratchLayerOrder(');
  // ⑴ ⇧ 를 읽는 자리 0 — editor.js 도 e.shiftKey 를 안 넘긴다(⌘⇧] = ⌘] 한 칸)
  assert.doesNotMatch(ORD, /shift/i, '★스크래치 갈래가 ⇧ 를 읽는다 — 캔버스와 비대칭');
  assert.doesNotMatch(ED, /scratchLayerOrder\?\.\([^)]*shiftKey/, '★editor.js 가 ⇧ 를 넘긴다');
  assert.doesNotMatch(SP, /SCRATCH_LAYER_SHIFT_TO_END|toEnd/, '★⇧ 맨 앞/뒤 자리가 남아 있다');
  // ⑵ 이름 = 캔버스 갈래(moveSelectedBlocks) 의 pushHistory 글자 — 소스에서 읽어 대조(손으로 박지 않는다)
  const MOVE = sliceBlock(ED, 'function moveSelectedBlocks(');
  const cm = MOVE.match(/pushHistory\(direction === 'up' \? '([^']+)' : '([^']+)'\)/);
  assert.ok(cm, '★캔버스 갈래 히스토리 이름을 못 읽었다');
  const sm = SP.match(/const SCRATCH_LAYER_HISTORY_NAME = \{ up: '([^']+)', down: '([^']+)' \};/);
  assert.ok(sm, '★SCRATCH_LAYER_HISTORY_NAME 꼴이 아니다');
  assert.deepEqual([sm[1], sm[2]], [cm[1], cm[2]], '★스크래치 히스토리 이름 ≠ 캔버스 갈래 이름');
  assert.equal(count(/const SCRATCH_LAYER_HISTORY_NAME =/g), 1);
  assert.equal(count(/'레이어 순서'/g), 0, "★'레이어 순서'(죽은 갈래 이름)를 쓴다");
  // ⑶ 섞인 선택 — 상수 하나, 쓰는 자리 하나
  assert.equal(count(/const SCRATCH_LAYER_SCRATCH_FIRST = true;/g), 1);
  assert.equal((ORD.match(/SCRATCH_LAYER_SCRATCH_FIRST/g) || []).length, 1);
  // ⑷ 항목끼리 — 형제를 정하는 함수 하나
  assert.ok(has(SP, 'function _scratchLayerOrderNow('));
  assert.match(ORD, /_scratchLayerOrderNow\(\)/);
});

test('U6 ★복수 선택은 «전부 한 덩어리 · 상대순서 유지» — 순수 규칙 + 실제 scratchLayerOrder 몸이 고른 것 «전부»를 넘긴다', () => {
  /* 지키는 자: 지디 채택 1021 — V4 «전부 한 덩어리 · 상대순서 유지».
     근거: 태양 발주 ORDER-1020t2a2 ㉣ 원문 「㉣ ★복수 선택이 되나 — ★여럿 고른 상태의 ★처분을 ★정해라(★하나씩? ★전부?)」 —
     원문은 «정해라»까지다. «전부 한 덩어리»라는 처분 자체는 원문 없음 · 설계 판단(S1 PLAN — ㈎ 가 여럿을 다룬 꼴 그대로).
     평가자 변이 V4 «복수 중 첫 장만»(picked = [..._selectedItems].slice(0, 1))은 _scratchLayerNext 밖(scratchLayerOrder 몸)에 있어
     순수 규칙만 부르는 U2 로는 안 잡힌다 ⇒ ⑵ 에서 몸을 잘라 가짜 이웃으로 돌린다. 기대값은 손으로 셈(평가자 multi 실측과 같다). */
  const f = loadNext();
  // ⑴ 순수: ABCD 에서 A·B 'down' — 마지막 고른 B 바로 뒤 형제 C 뒤로 덩어리째 ⇒ C A B D
  assert.equal(run(f, 'ABCD', 'AB', 'down'), 'CABD');
  // 떨어진 B·D 'up' (지금 CABD) — 첫 고른 B 바로 앞 형제 A 앞으로 덩어리째(B<D 유지) ⇒ C B D A
  assert.equal(run(f, 'CABD', 'BD', 'up'), 'CBDA');
  // ⑵ 실제 몸 — 잘라서 가짜 이웃(가드 참 · DOM 순 = 주어진 순서 · 적용·히스토리 붙잡기)으로 부른다
  const ORD = sliceBlock(SP, 'window.scratchLayerOrder = function scratchLayerOrder(');
  const NAME = SP.match(/const SCRATCH_LAYER_HISTORY_NAME = \{[^}]*\};/)[0];
  const callOrd = (order, picked, dir) => {
    const items = order.split('').map(id => ({ id }));
    const byId = new Map(items.map(s => [s.id, s]));
    const applied = [], hist = [];
    const win = { pushHistory: (name) => hist.push(name) };
    const make = new Function('window', 'document', '_scratchKeyGuardOk', '_scratchLayerOrderNow', '_selectedItems',
      '_applyScratchOrder', '_scratchLayerNext', 'SCRATCH_LAYER_SCRATCH_FIRST',
      `${NAME}\n${ORD};\nreturn window.scratchLayerOrder;`);
    const fn = make(win, { querySelector: () => null }, () => true, () => items,
      new Set(picked.split('').map(id => byId.get(id))), (ids) => applied.push(ids.join('')), f, true);
    return { ret: fn(dir), applied, hist };
  };
  const a = callOrd('ABCD', 'AB', 'down');
  assert.deepEqual([a.ret, a.applied, a.hist.length], [true, ['CABD'], 1], '★A·B 를 골랐는데 덩어리째 안 옮긴다(첫 장만?)');
  const b = callOrd('CABD', 'BD', 'up');
  assert.deepEqual([b.ret, b.applied, b.hist.length], [true, ['CBDA'], 1], '★떨어진 B·D 를 골랐는데 덩어리째 안 옮긴다(첫 장만?)');
  const c = callOrd('CABD', 'DB', 'up');   // 고른 순서(Set 삽입순)가 달라도 지금 순서로 묶는다
  assert.deepEqual(c.applied, ['CBDA']);
});
