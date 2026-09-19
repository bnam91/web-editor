// gradient-paint.mjs — CSS 그라데이션 모델 → Figma GradientPaint (0918r2 textgrad, 순수 함수).
//
// 입력 모델 = goditor gradient-model 형식 {type:'linear'|'radial', angle(deg), stops:[{color:#hex, offset 0..1, opacity 0..1}]}
// 출력 = figma-plugin set_gradient 인자 {type, stops:[{position, color{r,g,b,a}}], gradientTransform}
//
// ★gradientTransform 의 뜻(Figma): 노드 정규화 좌표(0..1)의 점 [x,y,1] 에 T 를 곱하면 «그라데이션 공간» 좌표가 나온다.
//   선형: 그 x 가 곧 진행도 t(0=첫 스탑, 1=끝 스탑). 방사형: (0.5,0.5) 중심, 반지름 0.5 가 t=1.
//   기존 카드 오버레이의 세로 그라데이션 [[0,1,0],[-1,0,1]] 이 이 규약이며, 아래 공식에 180° 1×1 을 넣으면 정확히 그 값이 나온다.
//
// CSS 선형(각도 θ, 박스 w×h): 방향 d=(sinθ, −cosθ), 그라데이션 선 길이 L=|w·sinθ|+|h·cosθ|,
//   t(X,Y) = ((X−w/2)·d.x + (Y−h/2)·d.y)/L + 0.5  (X,Y 는 픽셀) → 정규화 x=X/w, y=Y/h 로 풀면 T 의 첫 행.
//   둘째 행은 픽셀 공간에서 d 에 수직인 축(p=(cosθ, sinθ)) — 선형에선 보이는 결과에 영향이 없고 역행렬이 존재하게만 한다.
// CSS 방사형 `circle`(= farthest-corner): 반지름 R=√(w²+h²)/2 → 모서리가 t=1.

function _hexToRgb01(hex) {
  const h = String(hex || '#000000').replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = (i) => (parseInt(full.slice(i, i + 2), 16) || 0) / 255;
  return { r: n(0), g: n(2), b: n(4) };
}

function _colorOf(c) {
  const s = String(c || '').trim();
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (m) return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: m[4] == null ? 1 : +m[4] };
  return { ..._hexToRgb01(s), a: 1 };
}

const _clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(+v) ? +v : 0));

/** 스탑 → Figma 스탑 (위치 0..1 클램프·오름차순, 알파 = 색 알파 × opacity) */
export function figmaStops(stops) {
  return (stops || [])
    .map(s => {
      const c = _colorOf(s.color);
      const op = s.opacity == null ? 1 : _clamp01(s.opacity);
      return { position: _clamp01(s.offset), color: { r: c.r, g: c.g, b: c.b, a: _clamp01(c.a * op) } };
    })
    .sort((a, b) => a.position - b.position);
}

/** 선형 CSS 각도 → gradientTransform (노드 정규화 → 그라데이션 공간) */
export function linearTransform(angleDeg, w, h) {
  const th = (Number(angleDeg) || 0) * Math.PI / 180;
  const sin = Math.sin(th), cos = Math.cos(th);
  const W = Math.max(1e-9, w), H = Math.max(1e-9, h);
  const L = Math.abs(W * sin) + Math.abs(H * cos) || 1;
  const a = W * sin / L, b = -H * cos / L;
  const a2 = W * cos / L, b2 = H * sin / L;
  return [
    [a, b, 0.5 - (a + b) / 2],
    [a2, b2, 0.5 - (a2 + b2) / 2],
  ];
}

/** 방사형(circle = farthest-corner) → gradientTransform */
export function radialTransform(w, h) {
  const W = Math.max(1e-9, w), H = Math.max(1e-9, h);
  const R = Math.sqrt(W * W + H * H) / 2;
  const a = W / (2 * R), d = H / (2 * R);
  return [
    [a, 0, 0.5 - a / 2],
    [0, d, 0.5 - d / 2],
  ];
}

/** CSS 그라데이션 모델 + 노드 크기 → set_gradient 인자(nodeId 제외). 모델이 못 쓰면 null. */
export function cssGradientToFigmaPaint(model, w, h) {
  if (!model || !Array.isArray(model.stops) || model.stops.length < 2) return null;
  const radial = model.type === 'radial';
  return {
    type: radial ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR',
    stops: figmaStops(model.stops),
    gradientTransform: radial ? radialTransform(w, h) : linearTransform(model.angle == null ? 180 : model.angle, w, h),
  };
}
