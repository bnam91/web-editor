/* radial-geom.js — 방사형 배치 기하의 «한 자리» (프로토 Z6 · 1012t1Z6 · 2026-10-13).
 * 순수 함수만 — DOM·window 를 안 읽는다 ⇒ 유닛(node require)과 세 안(A 방사형 블럭 · B 그래프 방사형 · C Radial Arrange)이 «같은 식»을 쓴다.
 * 싣는 길은 graph-pie-geom.js 와 같다 — 쓰는 모듈이 side-effect import 해 window.RADIAL_GEOM 을 받고, 유닛은 require.
 *
 * 규약
 *   · 좌표: y 가 아래로 자란다(화면·SVG). x = cx + R·cos θ · y = cy + R·sin θ.
 *   · 각도: 도(°). 기본 시작 −90°(12시) · i 가 늘면 «시계 방향»(θ 증가).
 *   · 원과 다각형의 «좌표»는 같다(둘 다 등분) — 다른 것은 연결선(궤도 / 외곽선)과 항목 수 한도뿐.
 *   · 수 가드: 유한하지 않은 입력은 0(좌표·반지름) 또는 def(clamp)로 — 산출 문자열에 NaN·Infinity 가 들어갈 길이 없다.
 *   · 좌표는 소수 2자리로 반올림한 «수»(문자열 아님). */
(function (root) {
  var LIMITS = Object.freeze({ COUNT_MIN: 3, COUNT_MAX: 10, POLY_MIN: 3, POLY_MAX: 8, START_MIN: -180, START_MAX: 180 });
  var fin = function (v) { var n = Number(v); return Number.isFinite(n) ? n : 0; };
  var r2 = function (n) { var v = Math.round(n * 100) / 100; return v === 0 ? 0 : v; };   // −0 → 0
  var f = function (n) { return String(r2(fin(n))); };

  /* 값 죄기 — 빈 값(undefined · null · '')과 유한하지 않은 값은 def. def 를 안 주면 min. */
  function clamp(v, min, max, def) {
    var d = (def === undefined) ? min : def;
    if (v === undefined || v === null || v === '') return d;
    var n = Number(v);
    if (!Number.isFinite(n)) return d;
    return Math.min(max, Math.max(min, n));
  }
  /* 항목 수 죄기(정수) — shape 가 'poly' 면 3~8, 그 밖(원)은 3~10. 못 읽는 값은 def(없으면 6). */
  function clampCount(shape, n, def) {
    var poly = shape === 'poly';
    var lo = poly ? LIMITS.POLY_MIN : LIMITS.COUNT_MIN, hi = poly ? LIMITS.POLY_MAX : LIMITS.COUNT_MAX;
    var d = Math.min(hi, Math.max(lo, Math.round(fin(def === undefined ? 6 : def))));
    return Math.round(clamp(n, lo, hi, d));
  }
  var cnt = function (n) { var k = Math.floor(fin(n)); return k > 0 ? Math.min(k, 360) : 0; };

  /* 등분 각도 — startDeg + 360·i/n. n 이 1 미만이면 []. */
  function angles(n, startDeg) {
    var k = cnt(n), s = (startDeg === undefined || startDeg === null || startDeg === '') ? -90 : fin(startDeg), out = [];
    for (var i = 0; i < k; i++) out.push(s + 360 * i / k);
    return out;
  }
  /* 등분 점 — [{x, y, deg}]. */
  function points(n, radius, startDeg, cx, cy) {
    var R = Math.max(0, fin(radius)), X = fin(cx), Y = fin(cy);
    return angles(n, startDeg).map(function (deg) {
      var a = deg * Math.PI / 180;
      return { x: r2(X + R * Math.cos(a)), y: r2(Y + R * Math.sin(a)), deg: r2(deg) };
    });
  }
  /* 궤도(온 원) — 반원 둘(시작점 = 끝점인 호 하나는 SVG 가 안 그린다). r ≤ 0 이면 ''. */
  function orbitPath(cx, cy, r) {
    var R = fin(r), X = fin(cx), Y = fin(cy);
    if (!(R > 0)) return '';
    return 'M ' + f(X) + ' ' + f(Y - R) + ' A ' + f(R) + ' ' + f(R) + ' 0 1 1 ' + f(X) + ' ' + f(Y + R)
      + ' A ' + f(R) + ' ' + f(R) + ' 0 1 1 ' + f(X) + ' ' + f(Y - R) + ' Z';
  }
  var ptsOf = function (pts) { return (Array.isArray(pts) ? pts : []).filter(function (p) { return p && typeof p === 'object'; }); };
  /* 외곽선(다각형) — 'M x y L … Z'. 점이 둘 미만이면 ''. */
  function polygonPath(pts) {
    var p = ptsOf(pts);
    if (p.length < 2) return '';
    return p.map(function (q, i) { return (i ? 'L ' : 'M ') + f(q.x) + ' ' + f(q.y); }).join(' ') + ' Z';
  }
  /* 중심선(바큇살) — 점마다 'M cx cy L x y'. 점이 없으면 ''. */
  function spokePath(cx, cy, pts) {
    return ptsOf(pts).map(function (q) { return 'M ' + f(cx) + ' ' + f(cy) + ' L ' + f(q.x) + ' ' + f(q.y); }).join(' ');
  }
  /* 연결선 한 입구 — type: 'none' → '' · 'orbit' · 'outline' · 'spoke'. 모르는 type 도 ''. */
  function connectorPath(type, g) {
    var o = g || {};
    if (type === 'orbit') return orbitPath(o.cx, o.cy, o.r);
    if (type === 'outline') return polygonPath(o.pts);
    if (type === 'spoke') return spokePath(o.cx, o.cy, o.pts);
    return '';
  }
  /* 이웃 칸 중심 사이 거리 — 2R·sin(π/n). 칸 지름이 이보다 크면 이웃끼리 겹친다. n < 2 면 0. */
  function chord(n, radius) {
    var k = cnt(n);
    if (k < 2) return 0;
    return r2(2 * Math.max(0, fin(radius)) * Math.sin(Math.PI / k));
  }
  /* 「바깥」 라벨 자리 — 점에서 중심 반대쪽으로 dist 만큼 나간 자리와, 그 자리에 글상자를 «어느 변으로» 붙일지.
   *   align: 점이 중심의 오른쪽이면 'left'(글이 오른쪽으로 자란다) · 왼쪽이면 'right' · 위아래면 'center'.
   *   v:     점이 중심의 위면 'bottom'(글상자의 밑변을 붙인다) · 아래면 'top' · 옆이면 'middle'.
   *   점이 중심과 겹치면 위쪽(12시)으로 본다. */
  function labelAnchor(pt, cx, cy, dist) {
    var p = pt || {}, X = fin(cx), Y = fin(cy), px = fin(p.x), py = fin(p.y), d = fin(dist);
    var dx = px - X, dy = py - Y, len = Math.sqrt(dx * dx + dy * dy);
    var ux = len > 1e-6 ? dx / len : 0, uy = len > 1e-6 ? dy / len : -1;
    var EDGE = 0.3;   // 이 안쪽이면 «가운데»로 본다(거의 수직·수평인 자리)
    return {
      x: r2(px + ux * d), y: r2(py + uy * d),
      align: ux > EDGE ? 'left' : (ux < -EDGE ? 'right' : 'center'),
      v: uy < -EDGE ? 'bottom' : (uy > EDGE ? 'top' : 'middle'),
    };
  }

  var RADIAL_GEOM = Object.freeze({
    LIMITS: LIMITS, clamp: clamp, clampCount: clampCount, angles: angles, points: points,
    orbitPath: orbitPath, polygonPath: polygonPath, spokePath: spokePath, connectorPath: connectorPath,
    chord: chord, labelAnchor: labelAnchor,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = RADIAL_GEOM;
  if (root) root.RADIAL_GEOM = RADIAL_GEOM;
})(typeof window !== 'undefined' ? window : null);
