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
const { resizeColBoundary } = await import(pathToFileURL(aliasPath).href);
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
