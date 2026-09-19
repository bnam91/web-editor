/* 0918 canvasgrad — 캔버스 그라데이션 바(피그마식) 기하 순수함수 회귀.
 * gradient-model.js 를 node 에서 직접 import 한다(DOM 무의존 — window 는 typeof 가드).
 *
 * 핵심 결함(고치기 전): 옛 오버레이는 angleToHandles(정규화 ±0.5 후 0~1 클램프)로 선을 그렸다.
 *   CSS 배경(banner02/comparison)의 실제 색 선은 길이 L=|w·sinA|+|h·cosA| 라 박스 밖으로 나가며,
 *   그 선 위 offset 자리에 칩을 두면 실제 색 위치와 어긋난다. 또 끝 핸들 각도를 정규화 좌표로
 *   계산해 비정사각형에서 커서 방향 ≠ 적용 각도였다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// package.json "type":"commonjs" 라 .js 를 직접 import 하면 CJS 로 잡힌다 → 원문을 임시 .mjs 로 복사해 로드.
const SRC = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'props', 'gradient-model.js'), 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-'));
const MOD = path.join(TMP, 'gradient-model.mjs');
fs.writeFileSync(MOD, SRC);
const GM = await import(pathToFileURL(MOD).href);
fs.rmSync(TMP, { recursive: true, force: true });
const {
  gradientLine, angleFromDrag, offsetOnLine, chipPlacement,
  sortStopsKeepSelection, sortedIndexOf, parseGradient, toCss, angleToHandles,
} = GM;

const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} vs ${b}`);

// 해석해: CSS 선(px) — 중심 ± u·L/2, u=(sinA,−cosA)
function cssRef(angle, w, h) {
  const r = angle * Math.PI / 180, ux = Math.sin(r), uy = -Math.cos(r);
  const L = Math.abs(w * ux) + Math.abs(h * uy);
  return {
    p0: { x: (w / 2 - ux * L / 2) / w, y: (h / 2 - uy * L / 2) / h },
    p1: { x: (w / 2 + ux * L / 2) / w, y: (h / 2 + uy * L / 2) / h },
  };
}

test('(a) space=css — 200×100 에서 0/90/180/45° 끝점이 CSS 해석해와 1e-6 이내', () => {
  for (const a of [0, 90, 180, 45, 135, 300]) {
    const got = gradientLine({ type: 'linear', angle: a }, { space: 'css', w: 200, h: 100 });
    const ref = cssRef(a, 200, 100);
    near(got.p0.x, ref.p0.x, 1e-6, `a=${a} p0.x`); near(got.p0.y, ref.p0.y, 1e-6, `a=${a} p0.y`);
    near(got.p1.x, ref.p1.x, 1e-6, `a=${a} p1.x`); near(got.p1.y, ref.p1.y, 1e-6, `a=${a} p1.y`);
  }
  // 0° = 아래→위(중앙 세로선), 90° = 왼→오
  const z = gradientLine({ type: 'linear', angle: 0 }, { space: 'css', w: 200, h: 100 });
  near(z.p0.x, 0.5); near(z.p0.y, 1); near(z.p1.y, 0);
});

test('(a2) space=css 45° — 끝점이 0~1 밖으로 나간다(클램프 금지 증명). 옛 angleToHandles 는 안쪽에 갇힌다', () => {
  const got = gradientLine({ type: 'linear', angle: 45 }, { space: 'css', w: 200, h: 100 });
  const outside = [got.p0.x, got.p0.y, got.p1.x, got.p1.y].some(v => v < -1e-9 || v > 1 + 1e-9);
  assert.ok(outside, `45° CSS 선 끝점이 박스 안에 있다: ${JSON.stringify(got)}`);
  // 음성대조: 옛 공식은 전부 [0,1]
  const old = angleToHandles(45);
  assert.ok([old.p0.x, old.p0.y, old.p1.x, old.p1.y].every(v => v >= 0 && v <= 1));
  // 정사각형 45°: CSS 선 길이 = √2 × 변, 옛 공식(클램프 전 ±0.5·u)은 1 × 변 → √2 배 차이
  const sq = gradientLine({ type: 'linear', angle: 45 }, { space: 'css', w: 100, h: 100 });
  const len = Math.hypot((sq.p1.x - sq.p0.x) * 100, (sq.p1.y - sq.p0.y) * 100);
  near(len, 100 * Math.SQRT2, 1e-6, 'square 45° length');
});

test('(b) space=bbox — prop-shape.js _applyShapeGradient 의 x1,y1,x2,y2 공식과 일치', () => {
  for (const angle of [0, 30, 45, 90, 135, 180, 225, 270, 333]) {
    const a = (angle - 90) * Math.PI / 180;
    const x1 = 0.5 - Math.cos(a) * 0.5, y1 = 0.5 - Math.sin(a) * 0.5;
    const x2 = 0.5 + Math.cos(a) * 0.5, y2 = 0.5 + Math.sin(a) * 0.5;
    const got = gradientLine({ type: 'linear', angle }, { space: 'bbox', w: 300, h: 80 });
    near(got.p0.x, x1, 1e-9, `${angle} x1`); near(got.p0.y, y1, 1e-9, `${angle} y1`);
    near(got.p1.x, x2, 1e-9, `${angle} x2`); near(got.p1.y, y2, 1e-9, `${angle} y2`);
  }
});

test('(b2) radial — css=farthest-corner 반경, bbox=r 50%', () => {
  const c = gradientLine({ type: 'radial' }, { space: 'css', w: 200, h: 100 });
  assert.equal(c.radial, true);
  near((c.p1.x - 0.5) * 200, Math.hypot(100, 50));
  const b = gradientLine({ type: 'radial' }, { space: 'bbox', w: 200, h: 100 });
  near(b.p1.x, 1); near(b.p1.y, 0.5);
});

test('(c) angleFromDrag — css 200×100 중심→(1,1) 코너는 45°가 아니라 px 기준 atan2(100,-50)', () => {
  const css = angleFromDrag({ x: 0.5, y: 0.5 }, { x: 1, y: 1 }, { space: 'css', w: 200, h: 100 });
  const want = (Math.atan2(100, -50) * 180 / Math.PI + 360) % 360;
  near(css, want, 1e-9);
  assert.ok(Math.abs(css - 135) > 1, `css 각도가 정규화 기준(135°)과 같다 — px 공간이 아니다: ${css}`);
  const bbox = angleFromDrag({ x: 0.5, y: 0.5 }, { x: 1, y: 1 }, { space: 'bbox', w: 200, h: 100 });
  near(bbox, 135, 1e-9);
  // 왕복: 끝점 방향으로 끌면 같은 각도가 나온다
  for (const a of [10, 77, 200, 300]) {
    const ln = gradientLine({ type: 'linear', angle: a }, { space: 'css', w: 800, h: 200 });
    near(angleFromDrag({ x: 0.5, y: 0.5 }, ln.p1, { space: 'css', w: 800, h: 200 }), a, 1e-6, `roundtrip ${a}`);
  }
});

test('(d) chipPlacement — θ=0 이면 칩이 선 위쪽(y 감소)에 d 만큼, rotDeg=θ', () => {
  const pl = chipPlacement({ x: 0, y: 50 }, { x: 100, y: 50 }, 0.3, 16);
  near(pl.x, 30); near(pl.y, 34); near(pl.rotDeg, 0);
  // 세로선(아래로) θ=90 → 법선 (1,0): 오른쪽
  const v = chipPlacement({ x: 10, y: 0 }, { x: 10, y: 100 }, 0.5, 16);
  near(v.x, 26); near(v.y, 50); near(v.rotDeg, 90);
  // 선 위 점까지 거리 = d
  const q = chipPlacement({ x: 0, y: 0 }, { x: 60, y: 80 }, 0.25, 12);
  near(Math.hypot(q.x - q.onLine.x, q.y - q.onLine.y), 12);
});

test('(e) px 공간 투영 — 비정사각형에서 선 위 30% 지점을 투영하면 0.30', () => {
  for (const [space, w, h, a] of [['css', 800, 200, 45], ['css', 200, 100, 120], ['bbox', 300, 80, 45]]) {
    const ln = gradientLine({ type: 'linear', angle: a }, { space, w, h });
    const P = { x: ln.p0.x + (ln.p1.x - ln.p0.x) * 0.3, y: ln.p0.y + (ln.p1.y - ln.p0.y) * 0.3 };
    near(offsetOnLine(ln, P, { space, w, h }), 0.3, 1e-9, `${space} ${w}x${h} ${a}`);
  }
  // css 800×200 45°: 선 법선 방향으로 벗어난 점도 같은 offset(등색선 위)
  const ln = gradientLine({ type: 'linear', angle: 45 }, { space: 'css', w: 800, h: 200 });
  const on = { x: (ln.p0.x + (ln.p1.x - ln.p0.x) * 0.3) * 800, y: (ln.p0.y + (ln.p1.y - ln.p0.y) * 0.3) * 200 };
  const nx = Math.SQRT1_2, ny = Math.SQRT1_2; // 45° 선 방향 (0.707,-0.707)의 법선
  const off = { x: (on.x + nx * 40) / 800, y: (on.y + ny * 40) / 200 };
  near(offsetOnLine(ln, off, { space: 'css', w: 800, h: 200 }), 0.3, 1e-9, 'perp');
});

test('(f) 칩 드래그로 순서 역전 → 정렬 재매핑 시 selectedIdx 가 같은 스탑 객체', () => {
  const stops = [{ color: '#a', offset: 0 }, { color: '#b', offset: 0.5 }, { color: '#c', offset: 1 }];
  const dragged = stops[0];
  dragged.offset = 0.8; // 드래그 중 순서 고정 상태 [0.8, 0.5, 1]
  assert.equal(sortedIndexOf(stops, 0), 1);
  const idx = sortStopsKeepSelection(stops, 0);
  assert.equal(stops[idx], dragged);
  assert.equal(idx, 1);
  assert.deepEqual(stops.map(s => s.color), ['#b', '#a', '#c']);
});

test('(g) toCss 왕복 — 한 스탑 offset 만 바꾸면 다른 스탑 토큰은 바이트 동일', () => {
  const css = 'linear-gradient(45deg, #ff5e3a 0%, rgba(26,166,255,0.500) 40%, #00ff00 100%)';
  const g = parseGradient(css);
  assert.equal(toCss(g), css);
  g.stops[1].offset = 0.62;
  const out = toCss(g);
  const tok = (s) => s.slice(s.indexOf(',') + 1).split(/,\s(?=[#r])/).map(t => t.trim());
  const a = tok(css), b = tok(out);
  assert.equal(a[0], b[0]);
  assert.equal(a[2], b[2]);
  assert.equal(b[1], 'rgba(26,166,255,0.500) 62%');
});
