// figma-gradient-paint.test.mjs — 0918r2 textgrad: CSS 그라데이션 → Figma gradientTransform 이 «같은 그림»인가.
// 판정: 박스 안 여러 픽셀에서 «CSS 가 정의한 진행도 t» 와 «T·[x/w, y/h, 1] 의 x(선형) / 중심거리(방사형)» 가 1e-6 안에서 같다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssGradientToFigmaPaint, linearTransform, radialTransform, figmaStops } from '../../figma-renderer/gradient-paint.mjs';

// CSS Images 3 선형 그라데이션 정의 그대로: 선 길이 = |w sinθ| + |h cosθ|, 중심 기준 투영
function cssLinearT(deg, w, h, X, Y) {
  const th = deg * Math.PI / 180;
  const dx = Math.sin(th), dy = -Math.cos(th);
  const L = Math.abs(w * dx) + Math.abs(h * dy);
  return ((X - w / 2) * dx + (Y - h / 2) * dy) / L + 0.5;
}
const apply = (T, x, y) => [T[0][0] * x + T[0][1] * y + T[0][2], T[1][0] * x + T[1][1] * y + T[1][2]];
const BOXES = [[100, 100], [860, 120], [120, 860], [333, 57]];
const PTS = (w, h) => [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2], [w * 0.13, h * 0.71], [w * 0.9, h * 0.2]];

test('선형: 0/90/180/270/45/135/200° × 정사각·직사각 박스 — 모든 표본 픽셀에서 CSS t = Figma x', () => {
  for (const deg of [0, 90, 180, 270, 45, 135, 200, 17]) {
    for (const [w, h] of BOXES) {
      const T = linearTransform(deg, w, h);
      for (const [X, Y] of PTS(w, h)) {
        const want = cssLinearT(deg, w, h, X, Y);
        const [gx] = apply(T, X / w, Y / h);
        assert.ok(Math.abs(gx - want) < 1e-6, `${deg}° ${w}×${h} (${X},${Y}): css ${want} figma ${gx}`);
      }
      // 역행렬이 있어야 Figma 가 핸들을 그린다
      const det = T[0][0] * T[1][1] - T[0][1] * T[1][0];
      assert.ok(Math.abs(det) > 1e-9, `${deg}° ${w}×${h} 특이 행렬`);
    }
  }
});

test('선형 180°·1×1 = 기존 카드 오버레이 세로 그라데이션 행렬 [[0,1,0],[-1,0,1]] 과 같다(기존 규약과 한 몸)', () => {
  const T = linearTransform(180, 1, 1);
  const ref = [[0, 1, 0], [-1, 0, 1]];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(T[i][j] - ref[i][j]) < 1e-9, `T[${i}][${j}]=${T[i][j]}`);
});

test('선형 90°: 왼쪽 끝 t=0, 오른쪽 끝 t=1 (860×120)', () => {
  const T = linearTransform(90, 860, 120);
  assert.ok(Math.abs(apply(T, 0, 0.5)[0] - 0) < 1e-9);
  assert.ok(Math.abs(apply(T, 1, 0.5)[0] - 1) < 1e-9);
});

test('방사형(circle = farthest-corner): 중심 t=0, 네 모서리 t=1 — 정사각·직사각', () => {
  for (const [w, h] of BOXES) {
    const T = radialTransform(w, h);
    const tOf = (x, y) => { const [gx, gy] = apply(T, x, y); return Math.hypot(gx - 0.5, gy - 0.5) / 0.5; };
    assert.ok(Math.abs(tOf(0.5, 0.5)) < 1e-9);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) assert.ok(Math.abs(tOf(x, y) - 1) < 1e-9, `${w}×${h} corner ${x},${y}: ${tOf(x, y)}`);
    // 임의 픽셀: CSS 반지름 거리 / R 과 같다
    const R = Math.hypot(w, h) / 2;
    for (const [X, Y] of PTS(w, h)) {
      const want = Math.hypot(X - w / 2, Y - h / 2) / R;
      assert.ok(Math.abs(tOf(X / w, Y / h) - want) < 1e-6);
    }
  }
});

test('스탑: 위치 0..1 클램프·오름차순, opacity → a, rgba 알파 곱', () => {
  const st = figmaStops([
    { color: '#0000ff', offset: 1.4, opacity: 0.5 },
    { color: '#ff0000', offset: -0.2, opacity: 1 },
    { color: 'rgba(0,255,0,0.5)', offset: 0.5, opacity: 0.5 },
  ]);
  assert.deepEqual(st.map(s => s.position), [0, 0.5, 1]);
  assert.deepEqual(st[0].color, { r: 1, g: 0, b: 0, a: 1 });
  assert.equal(st[1].color.a, 0.25);
  assert.equal(st[2].color.a, 0.5);
});

test('cssGradientToFigmaPaint: 타입 매핑, 스탑 2개 미만은 null', () => {
  const lin = cssGradientToFigmaPaint({ type: 'linear', angle: 90, stops: [{ color: '#000', offset: 0 }, { color: '#fff', offset: 1 }] }, 10, 10);
  assert.equal(lin.type, 'GRADIENT_LINEAR');
  const rad = cssGradientToFigmaPaint({ type: 'radial', stops: [{ color: '#000', offset: 0 }, { color: '#fff', offset: 1 }] }, 10, 10);
  assert.equal(rad.type, 'GRADIENT_RADIAL');
  assert.equal(cssGradientToFigmaPaint({ type: 'linear', stops: [{ color: '#000', offset: 0 }] }, 1, 1), null);
  assert.equal(cssGradientToFigmaPaint(null, 1, 1), null);
});
