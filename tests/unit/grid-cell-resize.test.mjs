/* 단위 하네스 — js/grid-cell-resize.js (그리드 블록 열 경계 드래그, P2)
 * ★손으로 쓴 모델이 아니라 «실제 소스 파일»을 import 한다(save-reload-seal.test.mjs 선례와 동일
 *   패턴 — 렌더러 ESM .js를 package type=commonjs인 Node가 못 읽어 바이트 그대로 .mjs 별칭 복사).
 * P0 완료조건과 같은 성격: «가중치 합 보존»과 «클램프»를 회귀 없이 지킨다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../../js/grid-cell-resize.js');
const aliasPath = path.join(os.tmpdir(), `grid-cell-resize-alias-${process.pid}.mjs`);
fs.copyFileSync(srcPath, aliasPath);
const { resizeColBoundary, resizeRowHeight, ROW_H_MAX, ROW_H_MIN, COL_MIN_PX } = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);

test('합 보존: 델타를 얼마를 줘도 leftWeight + rightWeight === W', () => {
  const cases = [
    { wL: 200, wR: 200, W: 2, delta: 0 },
    { wL: 200, wR: 200, W: 2, delta: 37 },
    { wL: 200, wR: 200, W: 2, delta: -63 },
    { wL: 150, wR: 450, W: 4, delta: 120 },   // 비대칭 비율(1:3)에서도
    { wL: 300, wR: 100, W: 3, delta: -80 },
    { wL: 80, wR: 320, W: 1.5, delta: 500 },  // 델타가 커서 클램프에 걸리는 경우도
  ];
  for (const { wL, wR, W, delta } of cases) {
    const r = resizeColBoundary(wL, wR, W, delta);
    assert.ok(r, `null 아니어야 함: ${JSON.stringify({ wL, wR, W, delta })}`);
    // 부동소수 오차 없이 정확히 W와 같아야 한다(rightWeight = W - leftWeight로 계산하므로)
    assert.equal(r.leftWeight + r.rightWeight, W);
  }
});

test('델타 0 은 기존 비율을 그대로 보존한다(반올림 오차 허용 0.01)', () => {
  // wL:wR = 1:1, W=2 → 1:1
  let r = resizeColBoundary(200, 200, 2, 0);
  assert.equal(r.leftWeight, 1);
  assert.equal(r.rightWeight, 1);
  // wL:wR = 1:3, W=4 → 1:3
  r = resizeColBoundary(100, 300, 4, 0);
  assert.equal(r.leftWeight, 1);
  assert.equal(r.rightWeight, 3);
});

test('경계를 오른쪽으로 끌면 왼쪽 가중치가 커진다', () => {
  const r = resizeColBoundary(200, 200, 2, 50); // wL 200→250 (스케일 나눈 캔버스px 델타)
  assert.ok(r.leftWeight > 1);
  assert.ok(r.rightWeight < 1);
});

test('경계를 왼쪽으로 끌면 오른쪽 가중치가 커진다', () => {
  const r = resizeColBoundary(200, 200, 2, -50);
  assert.ok(r.leftWeight < 1);
  assert.ok(r.rightWeight > 1);
});

test('minPx 클램프: 화면 폭이 40px 밑으로는 줄지 않는다', () => {
  // total=400, minPx=40 → wL은 [40, 360] 로 클램프. 델타 -1000 은 wL=40 에서 멈춰야 한다.
  const r = resizeColBoundary(200, 200, 2, -1000, 40);
  const total = 400;
  const expectedLeftWeight = Math.round((2 * 40 / total) * 100) / 100;
  assert.equal(r.leftWeight, expectedLeftWeight);
  // 반대쪽도 동일하게 클램프
  const r2 = resizeColBoundary(200, 200, 2, 1000, 40);
  const expectedRightWeight = Math.round((2 * 40 / total) * 100) / 100;
  assert.equal(r2.rightWeight, expectedRightWeight);
});

test('두 열의 화면 폭 합이 2*minPx 미만이면 null(드래그 무의미, no-op)', () => {
  assert.equal(resizeColBoundary(30, 30, 2, 10, 40), null);   // total=60 < 80
  assert.equal(resizeColBoundary(0, 0, 2, 0, 40), null);
});

test('경계값: 화면 폭 합이 정확히 2*minPx면 클램프 상하한이 같아진다(퇴화하지만 null은 아님)', () => {
  const r = resizeColBoundary(40, 40, 2, 100, 40); // total=80, [40,40]
  assert.ok(r);
  assert.equal(r.leftWeight, 1);
  assert.equal(r.rightWeight, 1);
});

test('다른 열은 건드리지 않는다는 계약: 함수는 항상 두 값만 반환한다', () => {
  const r = resizeColBoundary(200, 200, 2, 10);
  assert.deepEqual(Object.keys(r).sort(), ['leftWeight', 'rightWeight']);
});

/* ── resizeRowHeight (P1 병합 후 신설) ──────────────────────────────────────
 * 열과 다르다 — «재분배」가 없다. 경계를 끌면 «위» 행 하나의 px 최소높이만 바뀐다.
 * 반환값은 항상 정수(px) 하나뿐 — 합 보존 계약 자체가 없다(열과의 핵심 차이).
 */
test('행 높이: 델타만큼 그대로 늘고 줄어든다(클램프 범위 안)', () => {
  assert.equal(resizeRowHeight(100, 30), 130);
  assert.equal(resizeRowHeight(100, -30), 70);
  assert.equal(resizeRowHeight(100, 0), 100);
});

test('행 높이: minPx 밑으로는 안 줄어든다(기본 24)', () => {
  assert.equal(resizeRowHeight(30, -100), 24);
  assert.equal(resizeRowHeight(30, -100, 10), 10); // 커스텀 minPx
});

test('행 높이: maxPx 위로는 안 늘어난다(기본 = ROW_H_MAX)', () => {
  // ★기대값을 «리터럴 2000» 으로 박아뒀다가, 상한을 4000 으로 올린 뒤 이 테스트가 빨강인 채로
  //   커밋이 지나갔다. 상한은 상수에서 읽는다 — 상수가 바뀌면 테스트도 같이 따라간다.
  assert.equal(resizeRowHeight(ROW_H_MAX - 10, 500), ROW_H_MAX);
  assert.equal(resizeRowHeight(100, 500, 24, 300), 300); // 커스텀 maxPx
});

test('행 높이: 결과는 항상 정수로 반올림된다', () => {
  assert.equal(resizeRowHeight(100.4, 0.4), 101); // 100.8 → round
  assert.equal(Number.isInteger(resizeRowHeight(133.7, 12.2)), true);
});

test('행 높이: 반환값은 숫자 하나뿐(합 보존 같은 계약이 없다 — 열과의 핵심 차이)', () => {
  const r = resizeRowHeight(100, 20);
  assert.equal(typeof r, 'number');
});

/* ─────────────────────────────────────────────────────────────
   ★아래 6건은 «폐기된 p2b 판에 있다가 p2 를 채택하며 같이 빠진» 계약들이다.
   적대검수가 「테스트 4건도 같이 빠졌다」고 지적한 자리 — 코드에 가드를 넣고
   테스트를 안 넣으면 다음 사람이 가드를 지워도 초록이다.
   ⚠️두 건(NaN 반환형·상한 SSOT)은 그 «가드 자체»가 틀려 있던 걸 잡은 회귀 테스트다.
───────────────────────────────────────────────────────────── */

test('행 높이: 델타 0 은 시작 높이를 그대로 반환한다', () => {
  assert.equal(resizeRowHeight(137, 0), 137);
  assert.equal(resizeRowHeight(24, 0), 24);   // 하한 경계에서도 그대로
});

test('행 높이: 아래로 끌면(양수) 커지고 위로 끌면(음수) 작아진다', () => {
  assert.equal(resizeRowHeight(100, 30), 130);
  assert.equal(resizeRowHeight(100, -30), 70);
});

test('행 높이: 커스텀 min/max 도 적용된다(기본값에만 의존하지 않는다)', () => {
  assert.equal(resizeRowHeight(100, -500, 50, 300), 50);
  assert.equal(resizeRowHeight(100, 500, 50, 300), 300);
});

test('행 높이: startPx/deltaPx 가 유효한 수가 아니면 높이를 «망가뜨리지» 않는다', () => {
  // NaN 이 dataset.rows 에 들어가면 JSON.stringify 에서 null 이 돼 행 높이가 소실된다.
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, 'abc']) {
    const r = resizeRowHeight(120, bad);
    assert.equal(Number.isFinite(r), true, `deltaPx=${String(bad)} 에서 유한수가 아니다`);
  }
  assert.equal(Number.isFinite(resizeRowHeight(NaN, 20)), true);
});

test('★열: deltaPx 가 NaN 이어도 «가중치» 계약을 지킨다(px 를 돌려주면 안 된다)', () => {
  // 회귀: 가드가 { wL, wR } 을 돌려줘 ⑴키 이름이 다르고(호출부는 leftWeight 를 읽는다)
  //       ⑵값이 «화면 px» 라 가중치 자리에 300 같은 값이 박히던 결함.
  const W = 3;
  const r = resizeColBoundary(300, 100, W, NaN, 40);
  assert.ok(r, 'null 이 아니어야 한다');
  assert.equal(typeof r.leftWeight, 'number', 'leftWeight 키가 있어야 한다');
  assert.equal(typeof r.rightWeight, 'number', 'rightWeight 키가 있어야 한다');
  assert.equal(r.leftWeight + r.rightWeight, W, '합 보존은 NaN 에서도 지켜진다');
  // 델타 0 과 같은 결과여야 한다(현재 비율 유지)
  const zero = resizeColBoundary(300, 100, W, 0, 40);
  assert.deepEqual(r, zero);
});

test('★상한/최소폭은 «상수 한 곳»에서 온다 — 호출부 리터럴로 갈라지지 않는다', () => {
  // 회귀: overlay-handles.js 가 resizeRowHeight(h, d, 24, 2000) 로 «리터럴 2000» 을 넘겨
  //       패널(4000)과 드래그(2000)의 상한이 갈라져 있던 결함. 기본값이 SSOT 다.
  assert.equal(ROW_H_MAX, 4000);
  assert.equal(ROW_H_MIN, 24);
  assert.equal(COL_MIN_PX, 40);
  assert.equal(resizeRowHeight(3900, 500), ROW_H_MAX, '기본 상한까지 늘어난다');
  assert.equal(resizeRowHeight(100, -500), ROW_H_MIN, '기본 하한까지 줄어든다');
});
