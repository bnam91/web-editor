/* U-SELOV-R — dedupe 는 「선이 «이미 있는» 자리」만 지운다 (네 방향 전부).
 *   실행: node --test "tests/unit/*.test.mjs"  ·  DOM 없이 «소스에서 순수 함수만» 떼어 «실행»한다.
 *
 * ★현빈 제보 그 자체: proj_1788857381036 의 mdl(border-radius 18px) 과 그 아래 sb 를 «동시 선택»하면
 *   sb 의 «윗변이 통째로» 사라졌다. 겹침도 0픽셀 스냅도 아니었다.
 *   원인 — _dedupe 가 p 의 «생 상자» 폭(pg.L…pg.R)을 q 의 변에서 뺐다. 그런데 반경이 있는 p 는
 *   모퉁이에서 직선이 «반경만큼 물러나고» 호가 대신한다. 없는 선을 있다고 치고 지운 것이다.
 *   좌우 변까지 같으면 _span 이 qlo..qhi 로 넓혀 «윗변 전체»가 지워졌다.
 *
 * ★이 검사가 지키는 불변식: 지운 구간 ⊆ p 가 «실제로 그리는» 구간(items[pi].edges.*).
 * ★네 방향을 «다» 잰다 — 같은 결함이 top/bottom/left/right 에 똑같이 있었다. 하나만 고치기 쉬운 자리다.
 * ★양성대조를 같이 건다 — 반경 0 이면 그 변은 «여전히 통째로» 사라져야 한다.
 *   (안 그러면 「dedupe 를 꺼서」 초록이 된 것이지 고친 게 아니다.)
 *
 * ⛔되돌리면 빨개지는 것: js/selection-overlay.js 의 _subEdge 호출을 옛 subtractInterval(…, c, d) 로
 *   되돌리면 — 방향 하나만 되돌려도 — 그 방향의 「남아 있어야 한다」 단언이 0 을 보고 죽는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC = readSrc(ROOT, 'js/selection-overlay.js');

/** 이름으로 최상위 선언 한 덩이를 잘라낸다(중괄호 균형). ⛔고정 창(slice(i, i+900)) 금지. */
function slice(head) {
  const i = SRC.indexOf(head);
  assert.ok(i >= 0, `소스에서 «${head}» 를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 옮겨라`);
  let j = SRC.indexOf('{', i), depth = 0;
  for (let k = j; k < SRC.length; k++) {
    if (SRC[k] === '{') depth++;
    else if (SRC[k] === '}') { depth--; if (!depth) { j = k + 1; break; } }
  }
  assert.ok(j > SRC.indexOf('{', i), `«${head}» 의 중괄호 균형을 못 잡았다`);
  return SRC.slice(i, j).replace(/^export\s+/, '');
}

const TOUCH = SRC.match(/const TOUCH_DEVICE_PX = ([\d.]+)/);
assert.ok(TOUCH, 'TOUCH_DEVICE_PX 상수를 못 찾았다');
const SNAP = [...SRC.matchAll(/const _snap(Lo|Hi) = [^\n;]+;/g)].map(m => m[0]);
const ROWE = [...SRC.matchAll(/const _rowEdge = [^\n;]+;/g)].map(m => m[0]);
assert.equal(SNAP.length, 2, '_snapLo/_snapHi 정의를 못 찾았다');
assert.equal(ROWE.length, 1, '_rowEdge 정의를 못 찾았다');

const ctx = vm.createContext({});
vm.runInContext(
  `const TOUCH_DEVICE_PX = ${TOUCH[1]};\nconst _dpr = () => 2;\nconst _touchEps = () => TOUCH_DEVICE_PX / _dpr();\n` +
  SNAP.join('\n') + '\n' + ROWE[0] + '\n' +
  slice('export function subtractInterval') + '\n' +
  slice('function _span') + '\n' +
  slice('function _subEdge') + '\n' +
  slice('function _dedupe') + '\n' +
  slice('function _edgesOf') + '\n' +
  'const _ZERO_R = { nw:[0,0], ne:[0,0], se:[0,0], sw:[0,0] };\n' +
  'globalThis.__pure = { _dedupe, _edgesOf, _snapLo, _snapHi, _rowEdge };',
  ctx);
const { _dedupe, _edgesOf, _snapLo, _snapHi, _rowEdge } = ctx.__pure;
const DPR = 2, H = 0.5;

/** 축정렬 상자 하나를 items 원소로. (l,t,r,b) = 스크린 CSS px 생좌표. */
function box(l, t, r, b, opts = {}) {
  const h = opts.h ?? H;
  const R0 = { nw: [0, 0], ne: [0, 0], se: [0, 0], sw: [0, 0] };
  const rr = opts.rad ? { nw: [opts.rad, opts.rad], ne: [opts.rad, opts.rad],
                          se: [opts.rad, opts.rad], sw: [opts.rad, opts.rad] } : R0;
  const g = {
    rot: false, h, sw: h * 2, r: rr,
    raw: { l, t, r, b },
    L: _snapLo(l, DPR, h), T: _snapLo(t, DPR, h), R: _snapHi(r, DPR, h), B: _snapHi(b, DPR, h),
    xlo: _rowEdge(l, DPR), xhi: _rowEdge(r, DPR), ylo: _rowEdge(t, DPR), yhi: _rowEdge(b, DPR),
  };
  return { g, edges: _edgesOf(g), dedupable: true };
}
const len = ivs => ivs.reduce((s, [a, b]) => s + (b - a), 0);
const RAD = 18;   // mdl 의 border-radius 실값

/* ★네 방향 표 — 「p 를 «앞»(DOM 먼저)에 두고 q 의 어느 변이 지워지는가」.
 *   make(rad) 는 [p, q] 를 그 반경으로 만든다. qEdge = q 에서 지워지는 변, pEdge = p 가 대는 변. */
const CASES = [
  { dir: '위(p) → 아래(q) : q.top',
    qEdge: 'top', pEdge: 'bottom',
    make: rad => [box(100, 100, 300, 200, { rad }), box(100, 200, 300, 300)] },
  { dir: '아래(p) → 위(q) : q.bottom',
    qEdge: 'bottom', pEdge: 'top',
    make: rad => [box(100, 200, 300, 300, { rad }), box(100, 100, 300, 200)] },
  { dir: '왼쪽(p) → 오른쪽(q) : q.left',
    qEdge: 'left', pEdge: 'right',
    make: rad => [box(100, 100, 200, 300, { rad }), box(200, 100, 320, 300)] },
  { dir: '오른쪽(p) → 왼쪽(q) : q.right',
    qEdge: 'right', pEdge: 'left',
    make: rad => [box(200, 100, 320, 300, { rad }), box(100, 100, 200, 300)] },
];

test('★입력이 살아 있다 — 표가 비면 아래 루프는 «0바퀴»라 스스로 통과한다', () => {
  assert.equal(CASES.length, 4, '네 방향(top·bottom·left·right)을 «다» 재야 한다');
  const seen = new Set();
  for (const c of CASES) {
    const [p, q] = c.make(RAD);
    assert.ok(len(p.edges[c.pEdge]) > 0, `${c.dir}: p 가 그리는 ${c.pEdge} 구간이 비었다 — 뺄 것이 없다`);
    assert.ok(len(q.edges[c.qEdge]) > 0, `${c.dir}: q 의 ${c.qEdge} 이 지우기 «전»부터 비었다 — 잴 게 없다`);
    assert.ok(p.dedupable && q.dedupable, `${c.dir}: dedupe 에 «참여»하지 않는 상자로는 아무것도 증명 못 한다`);
    seen.add(c.qEdge);
  }
  assert.equal(seen.size, 4, `네 변이 «서로 달라야» 한다 — 실제로 잰 변: ${[...seen].join(',')}`);
});

test('★반경이 있는 p 는 q 의 변을 «통째로» 지우지 못한다 (네 방향 전부)', () => {
  let ran = 0;
  for (const c of CASES) {
    const [p, q] = c.make(RAD);
    const before = len(q.edges[c.qEdge]);
    const pDrawn = p.edges[c.pEdge].map(([a, b]) => [a, b]);   // dedupe 전 p 가 그리는 구간
    _dedupe([p, q]);
    const after = len(q.edges[c.qEdge]);
    ran++;
    // ⛔이 단언이 「고치기 전」의 값이다: 옛 판은 after == 0 이었다(현빈이 본 «윗선 소실»).
    assert.ok(after > 0,
      `${c.dir}: q 의 ${c.qEdge} 이 통째로 사라졌다 — p 의 모퉁이는 «호»라 그 자리엔 선이 없다`);
    assert.ok(after < before,
      `${c.dir}: 아무것도 안 지웠다 — 겹친 «직선» 구간은 여전히 한 줄이어야 한다`);
    // 남은 길이 = 양쪽 모퉁이 반경 몫. 반경 18 두 개 → 36 (스냅 몫 ±1 안)
    assert.ok(Math.abs(after - 2 * RAD) < 1.5,
      `${c.dir}: 남은 길이 ${after} 가 «양쪽 반경 몫»(≈${2 * RAD}) 과 다르다`);
    // ★불변식 — 지운 구간은 p 가 «그리는» 구간 안에만 있어야 한다.
    const gone = [];
    for (const [a, b] of q.edges[c.qEdge]) gone.push(b);
    assert.ok(q.edges[c.qEdge].length === 2,
      `${c.dir}: 남은 조각이 ${q.edges[c.qEdge].length} 개 — 모퉁이 «둘»이 남아야 한다`);
    const hole = [q.edges[c.qEdge][0][1], q.edges[c.qEdge][1][0]];
    assert.ok(hole[0] >= pDrawn[0][0] - 1e-9 && hole[1] <= pDrawn[0][1] + 1e-9,
      `${c.dir}: 지운 구간 [${hole}] 이 p 가 그리는 [${pDrawn[0]}] 밖으로 나갔다 — «없는 선»을 지웠다`);
    assert.ok(gone.length > 0);
  }
  assert.equal(ran, 4, `루프가 ${ran} 바퀴만 돌았다 — 네 방향을 «다» 재지 않았다`);
});

test('★양성대조 — 반경 0 이면 그 변은 «여전히 통째로» 사라진다 (네 방향 전부)', () => {
  let ran = 0;
  for (const c of CASES) {
    const [p, q] = c.make(0);
    assert.ok(len(q.edges[c.qEdge]) > 0, `${c.dir}: 지우기 전부터 비었다 — 이 대조는 못 쓴다`);
    _dedupe([p, q]);
    ran++;
    assert.equal(len(q.edges[c.qEdge]), 0,
      `${c.dir}: 반경 0 인데 q 의 ${c.qEdge} 이 남았다 — 경계가 «두 줄»로 그려진다(§4-2 퇴행)`);
    assert.ok(len(p.edges[c.pEdge]) > 0,
      `${c.dir}: p 의 ${c.pEdge} 까지 사라졌다 — 경계선이 «아예» 없어진 것이지 고친 게 아니다`);
  }
  assert.equal(ran, 4, `루프가 ${ran} 바퀴만 돌았다`);
});

test('★q 에만 반경이 있으면 — 지워지는 것은 «q 가 그리는 만큼»뿐이다', () => {
  // p 는 각지고 q 가 둥근 경우. q 의 직선은 이미 반경만큼 짧다 → 그 짧아진 구간이 지워질 뿐,
  // 「지운 길이」가 q 가 그리던 길이를 넘어설 수 없다(음수 길이·유령 구간 방지).
  const p = box(100, 100, 300, 200);
  const q = box(100, 200, 300, 300, { rad: RAD });
  const before = len(q.edges.top);
  assert.ok(before > 0, '입력이 살아 있다 — q 의 윗변이 비었으면 잴 게 없다');
  _dedupe([p, q]);
  assert.equal(len(q.edges.top), 0, 'p 의 직선이 q 의 (짧아진) 윗변을 온전히 덮는다 — 남으면 두 줄이다');
  assert.ok(len(p.edges.bottom) > 0, 'p 의 아랫변이 경계를 책임진다');
});

test('★음성대조 — 3px 떨어진 상자는 반경이 있어도 «지우지 않는다»', () => {
  const p = box(100, 100, 300, 200, { rad: RAD });
  const q = box(100, 203, 300, 300);
  const before = len(q.edges.top);
  assert.ok(before > 0, '입력이 살아 있다');
  _dedupe([p, q]);
  assert.equal(len(q.edges.top), before, '떨어진 상자의 변을 건드렸다');
});
