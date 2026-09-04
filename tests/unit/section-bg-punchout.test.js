/* U-SBP 하네스 — js/image-handling.js 의 _punchOutPolygon
 *   (섹션 배경 «위치 편집»에서 고스트에 프레임 구멍을 뚫는 clip-path 생성기)
 * 실행: node --test "tests/unit/*.test.js"   ·  라이브 userData 무접촉(소스 1개를 «읽기»만).
 *
 * ★왜 이 테스트가 있나 — 실측에서 한 번 깨졌다.
 *   초판은 `clip-path: path(evenodd, "…")` 였고, 런타임 검증에서 computed clip-path 가
 *   통째로 `none` 이었다(2026-09-03). CSSWG 가 path() 의 <fill-rule> 인자를 걷어낸 뒤라
 *   Chromium 이 선언을 버렸고, CSS.supports 가드가 false 를 돌려 punch-out 이 «조용히» 빠졌다
 *   — 프레임 «안»까지 42% 로 흐려 보였다. ⇒ 있는지 없는지 물어봐야 하는 문법을 버리고
 *     어디서나 되는 polygon() «열쇠구멍»으로 바꿨다. 이 파일이 그 기하를 지킨다.
 *
 * ★브라우저 없이 무엇을 증명하나: 생성된 폴리곤을 «두 채우기 규칙»(nonzero·evenodd)으로
 *   직접 래스터 판정해, 구멍 안은 잘리고 바깥은 남는지를 좌표로 확인한다.
 *   두 규칙이 «같은 답»을 내야 한다 — 그래야 브라우저가 어느 쪽을 쓰든 결과가 같다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../js/image-handling.js');
const src = fs.readFileSync(SRC, 'utf8');

/* ESM 이라 require 가 안 된다 — 함수 본문만 잘라 같은 realm 에서 평가한다(DOM 의존 0). */
const _slice = (from, to) => {
  const i = src.indexOf(from), j = src.indexOf(to);
  assert.ok(i !== -1 && j > i, `소스에서 ${from} … ${to} 구간을 못 찾음 — 리팩터링됐나?`);
  return src.slice(i, j);
};
const { _punchOutPolygon } =
  new Function(_slice('const _r2 =', 'function enterSectionBgEditMode') + '\nreturn { _punchOutPolygon };')();

/* ── 폴리곤 채우기 판정 (브라우저가 하는 일을 그대로) ── */
function parsePts(str) {
  const m = /^polygon\((.*)\)$/.exec(str);
  return m ? m[1].split(',').map(t => t.trim().split(/\s+/).map(parseFloat)) : null;
}
function evenodd(P, x, y) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function nonzero(P, x, y) {
  let w = 0;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    const cross = (xi - xj) * (y - yj) - (x - xj) * (yi - yj);
    if (yj <= y) { if (yi > y && cross > 0) w++; }
    else if (yi <= y && cross < 0) w--;
  }
  return w !== 0;
}
/** 두 규칙이 «합의»한 채움 여부. 안 맞으면 즉시 실패시킨다(브라우저마다 달라진다는 뜻). */
function filled(P, x, y) {
  const a = evenodd(P, x, y), b = nonzero(P, x, y);
  assert.equal(a, b, `(${x},${y}) 에서 evenodd=${a} nonzero=${b} — 두 규칙이 갈리면 브라우저 의존이 된다`);
  return a;
}

/* ── 판정기 자체 검증(양성대조) — 도구를 안 재고 쓰면 초록이 무의미하다 ── */
test('MD1 판정기: 구멍 없는 단순 사각형은 안이 «채워짐»', () => {
  const P = [[0, 0], [100, 0], [100, 100], [0, 100]];
  assert.ok(filled(P, 50, 50));
  assert.ok(!filled(P, 150, 50));
});

const HOLE = { w: 1200, h: 600, hx: 200, hy: 100, hw: 800, hh: 400 };

test('SBP1 전형(cover): 프레임 «안»은 잘리고 «밖»은 남는다', () => {
  const P = parsePts(_punchOutPolygon(HOLE.w, HOLE.h, HOLE.hx, HOLE.hy, HOLE.hw, HOLE.hh));
  assert.ok(P, 'polygon 문자열이 나와야 한다');
  // 구멍 안(=프레임 안) — 진짜 배경이 선명하게 보여야 하므로 고스트는 «없어야» 한다
  for (const [x, y] of [[600, 300], [210, 110], [990, 490]]) {
    assert.equal(filled(P, x, y), false, `구멍 안 (${x},${y}) 이 안 잘렸다`);
  }
  // 구멍 밖(=프레임 밖) — 원본이 반투명으로 보여야 하므로 고스트는 «남아야» 한다
  for (const [x, y] of [[10, 10], [1190, 590], [600, 50], [100, 300], [1100, 300], [600, 550]]) {
    assert.equal(filled(P, x, y), true, `프레임 밖 (${x},${y}) 이 사라졌다`);
  }
});

test('SBP2 ★양성대조: 구멍을 «안 뚫으면» 프레임 안도 채워진다 — SBP1 이 우연이 아님', () => {
  const P = [[0, 0], [HOLE.w, 0], [HOLE.w, HOLE.h], [0, HOLE.h]]; // 구멍 없는 같은 크기 사각형
  assert.equal(filled(P, 600, 300), true, '구멍 없는 폴리곤에서 중앙이 비어 보이면 판정기가 고장난 것');
});

test('SBP3 구멍이 모서리에 «닿아» 틈 길이가 0 이어도 성립', () => {
  const P = parsePts(_punchOutPolygon(1000, 800, 0, 0, 400, 300));
  assert.equal(filled(P, 200, 150), false);
  assert.equal(filled(P, 700, 600), true);
});

test('SBP4 구멍이 상자를 완전히 덮으면 «빈 폴리곤» — 고스트를 통째로 감춘다', () => {
  const P = parsePts(_punchOutPolygon(800, 400, -100, -50, 1000, 500));
  assert.deepEqual(P, [[0, 0], [0, 0], [0, 0]]);
});

test('SBP5 세로로 관통하는 구멍(위아래가 상자를 넘음) — 좌우 띠만 남는다', () => {
  const P = parsePts(_punchOutPolygon(1200, 400, 300, -100, 500, 600));
  assert.equal(filled(P, 550, 200), false, '관통 구멍 안');
  assert.equal(filled(P, 100, 200), true, '왼쪽 띠');
  assert.equal(filled(P, 1100, 200), true, '오른쪽 띠');
});

test('SBP6 프레임과 안 겹치면 클립 자체를 걸지 않는다(고스트 통째로 노출)', () => {
  assert.equal(_punchOutPolygon(400, 300, 900, 900, 100, 100), '');
});

test('SBP7 ★회귀 가드: 깨졌던 path(evenodd,…)·CSS.supports 로 되돌아가지 않는다', () => {
  // 주석(사고 기록)은 남겨 둔다 — «실행되는 대입»에만 없으면 된다
  const code = src.split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l));
  assert.ok(!code.some(l => /clipPath\s*=/.test(l) && /path\(/.test(l) && !/_punchOutPolygon/.test(l)),
    'clipPath 에 path() 를 직접 대입하고 있다 — Chromium 이 선언을 버려 punch-out 이 조용히 사라진다');
  assert.ok(!code.some(l => /CSS\.supports/.test(l) && /clip-path/.test(l)),
    'clip-path 를 CSS.supports 로 물어보고 있다 — 물어봐야 하는 문법을 쓰지 않기로 했다');
});
