/* radial-arc-geom.js — 방사형 에셋 블럭 «호 모드»의 기하 한 자리 (프로토 · 1013t2A3 · V3 → V4 반원 · 2026-10-14).
 * 순수 함수만 — DOM·window 를 안 읽는다 ⇒ 유닛(node require)과 블럭 렌더가 «같은 식»을 쓴다. 싣는 길은 radial-geom.js 와 같다.
 *
 * 왜 있나: V2 까지 호 모드의 스테이지는 높이를 «항목 중심의 y 범위»로만 잡고 밖을 잘랐다(overflow hidden) ⇒
 *   선 연장 구간 · 원 중심 밀기 · 긴 라벨이 블럭 변에서 잘렸다. V3 은 «그려지는 것 전부의 상자»를 여기서 계산해
 *   스테이지 높이 · 원 중심 자리 · (폭이 모자라면) 반지름을 그 상자에 맞춘다 — 자르지 않는다.
 * V4 반원: 호 모드의 기본 꼴은 «반원»이다 — 시작 −90° · 끝 90° · 원 중심 x = 블럭 왼쪽 변(0) ⇒ 끝점 둘이 왼쪽 변에 서고 지름이 세로로 선다.
 *   그 꼴을 «맞추기»가 건드리지 않게 세 가지를 더했다(예전 호출 꼴은 한 글자도 안 바뀐다 — 전부 고르는 값이다):
 *   · halfCircle(R)      반원의 기준 수(끝점 둘 · 가장 오른쪽 점) — 블럭 · 유닛 · DOM 검사가 같은 수를 본다.
 *   · arcAnglesInset     항목을 «끝점을 피해» 놓는 등분(구간을 n 칸으로 나눈 칸 가운데) — 끝점에 선 항목이 왼쪽 변 밖으로 반쯤 나가지 않는다.
 *   · contentBox 의 lineCap:'butt' — 끝이 잘린 선은 끝점에서 «반지름 방향»으로만 두껍다 ⇒ ±90° 끝점의 상자 왼쪽 끝이 정확히 0 이다(둥근 끝은 두께 반만큼 더 나간다).
 *   · fit 의 padL · padR — 가로 여유를 왼쪽 · 오른쪽 따로. 블럭은 왼쪽 0 을 넘긴다 ⇒ 반원 기본에서 원 중심을 밀지 않는다(shift 0).
 *
 * 규약 (radial-geom.js 와 같다)
 *   · 좌표: y 가 아래로 자란다. x = cx + R·cos θ · y = cy + R·sin θ. 각도는 도(°).
 *   · 상자 {minX, maxX, minY, maxY} 는 «원 중심이 (0,0)»인 좌표다. 스테이지 좌표 = 상자 + (cx, cy).
 *   · 유한하지 않은 입력은 0 으로 본다 — 산출에 NaN·Infinity 가 들어갈 길이 없다. */
(function (root) {
  var fin = function (v) { var n = Number(v); return Number.isFinite(n) ? n : 0; };
  var r2 = function (n) { var v = Math.round(n * 100) / 100; return v === 0 ? 0 : v; };
  var rad = function (deg) { return deg * Math.PI / 180; };
  var MIN_RADIUS = 40;   // 반지름을 줄여 맞출 때의 바닥 기본값(원 모드의 바닥과 같은 값) — 블럭은 패널 반지름 칸의 최소를 opts.minRadius 로 넘긴다

  /* 호 위의 등분 각도 — 양 끝 포함. n 이 1 이면 가운데 하나. */
  function arcAngles(n, startDeg, endDeg) {
    var k = Math.max(0, Math.floor(fin(n))), s = fin(startDeg), e = fin(endDeg), out = [];
    for (var i = 0; i < k; i++) out.push(k > 1 ? s + (e - s) * i / (k - 1) : (s + e) / 2);
    return out;
  }

  /* 호 위의 등분 각도 — «끝점을 피해» 안쪽으로. 구간을 n 칸으로 나눈 칸 가운데(양 끝에 반 칸씩 남는다). n 이 1 이면 가운데 하나. */
  function arcAnglesInset(n, startDeg, endDeg) {
    var k = Math.max(0, Math.floor(fin(n))), s = fin(startDeg), e = fin(endDeg), out = [];
    for (var i = 0; i < k; i++) out.push(s + (e - s) * (i + 0.5) / k);
    return out;
  }

  /* 반원(−90° ~ 90° · 원 중심 x = 0)의 기준 수 — «원 중심이 (0, cy)»일 때. 끝점 둘은 왼쪽 변(x = 0) 위, 지름(2R)이 세로, 가장 오른쪽 점 x = R. */
  var HALF = Object.freeze({ startDeg: -90, endDeg: 90, centerX: 0, lineExtend: 0 });
  function halfCircle(R, cy) {
    var r = Math.max(0, fin(R)), y = fin(cy);
    var at = function (deg) { return { x: r2(r * Math.cos(rad(deg))), y: r2(y + r * Math.sin(rad(deg))) }; };
    return { start: at(HALF.startDeg), end: at(HALF.endDeg), rightmost: at(0), chord: r2(2 * r) };
  }

  /* 연결선(호)이 덮는 각도 구간 — 시작·끝·항목 각도의 최소~최대에 양 끝 extend 도를 더한다. → { lo, hi } (lo ≤ hi). */
  function lineRange(startDeg, endDeg, degs, extend) {
    var all = [fin(startDeg), fin(endDeg)].concat((Array.isArray(degs) ? degs : []).map(fin));
    var ext = Math.max(0, fin(extend));
    return { lo: Math.min.apply(null, all) - ext, hi: Math.max.apply(null, all) + ext };
  }

  /* 호 path — from~to 각도 구간만. 한 바퀴 이상이면 온 원(반원 둘). R ≤ 0 이거나 구간이 0 이면 ''. */
  function arcPath(cx, cy, R, fromDeg, toDeg) {
    var X = fin(cx), Y = fin(cy), r = fin(R), a = fin(fromDeg), b = fin(toDeg);
    if (!(r > 0) || a === b) return '';
    if (Math.abs(b - a) >= 360) {
      return 'M ' + r2(X) + ' ' + r2(Y - r) + ' A ' + r2(r) + ' ' + r2(r) + ' 0 1 1 ' + r2(X) + ' ' + r2(Y + r)
        + ' A ' + r2(r) + ' ' + r2(r) + ' 0 1 1 ' + r2(X) + ' ' + r2(Y - r) + ' Z';
    }
    var large = Math.abs(b - a) > 180 ? 1 : 0, sweep = b > a ? 1 : 0;
    return 'M ' + r2(X + r * Math.cos(rad(a))) + ' ' + r2(Y + r * Math.sin(rad(a)))
      + ' A ' + r2(r) + ' ' + r2(r) + ' 0 ' + large + ' ' + sweep + ' '
      + r2(X + r * Math.cos(rad(b))) + ' ' + r2(Y + r * Math.sin(rad(b)));
  }

  /* 단위원 위에서 lo~hi 구간의 호가 차지하는 상자 — 양 끝점과, 구간 안에 드는 90° 배수(좌우·위아래 끝)만 보면 된다. */
  function sweepBox(loDeg, hiDeg) {
    var lo = Math.min(fin(loDeg), fin(hiDeg)), hi = Math.max(fin(loDeg), fin(hiDeg));
    if (hi - lo >= 360) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    var cand = [lo, hi];
    for (var q = Math.ceil(lo / 90) * 90; q <= hi; q += 90) cand.push(q);
    var b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    cand.forEach(function (d) {
      var x = Math.cos(rad(d)), y = Math.sin(rad(d));
      if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
    });
    return b;
  }

  var grow = function (b, x0, y0, x1, y1) {
    if (x0 < b.minX) b.minX = x0; if (x1 > b.maxX) b.maxX = x1;
    if (y0 < b.minY) b.minY = y0; if (y1 > b.maxY) b.maxY = y1;
  };
  var rectOf = function (r) { return (r && typeof r === 'object') ? { x0: fin(r.x0), x1: fin(r.x1), y0: fin(r.y0), y1: fin(r.y1) } : null; };

  /* 그려지는 것 전부의 상자(원 중심 기준) — 반지름 R 일 때.
   *   spec.degs        항목 각도들
   *   spec.line        'none' | 'spoke' | 그 밖(= 호)        spec.lineLo · lineHi  호가 덮는 각도 구간      spec.lineWidth  선 두께
   *   spec.lineCap     'butt' 면 끝이 잘린 선(끝점에서 반지름 방향으로만 두껍다) · 그 밖 = 둥근 끝(사방으로 두께 반)
   *   spec.markerHalf  점·칸의 반 크기                       spec.halo             점·칸 둘레의 테(그림자 고리) 두께
   *   spec.labels      항목마다의 라벨 사각형 — «항목 중심» 기준 {x0,x1,y0,y1} 또는 null
   *   spec.center      가운데 그림·글의 사각형 — «원 중심» 기준 {x0,x1,y0,y1} 또는 null
   *   아무것도 없으면 0 상자. */
  function contentBox(R, spec) {
    var s = spec || {}, r = Math.max(0, fin(R));
    var b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    var lw = Math.max(0, fin(s.lineWidth)) / 2;
    var degs = (Array.isArray(s.degs) ? s.degs : []).map(fin);
    var mh = Math.max(0, fin(s.markerHalf)) + Math.max(0, fin(s.halo));
    var labels = Array.isArray(s.labels) ? s.labels : [];
    degs.forEach(function (d, i) {
      var x = r * Math.cos(rad(d)), y = r * Math.sin(rad(d));
      grow(b, x - mh, y - mh, x + mh, y + mh);
      var l = rectOf(labels[i]);
      if (l) grow(b, x + Math.min(l.x0, l.x1), y + Math.min(l.y0, l.y1), x + Math.max(l.x0, l.x1), y + Math.max(l.y0, l.y1));
    });
    if (s.line === 'spoke') {
      if (degs.length) grow(b, -lw, -lw, lw, lw);   // 바큇살은 원 중심에서 나온다(점 쪽 끝은 점 상자 안)
    } else if (s.line && s.line !== 'none' && r > 0 && fin(s.lineLo) !== fin(s.lineHi)) {
      var u = sweepBox(s.lineLo, s.lineHi);
      if (s.lineCap === 'butt') {
        // 두꺼운 호 = 바깥 반지름(r + 두께 반)의 호 + 안쪽 반지름의 양 끝점. 끝점에서는 접선 쪽으로 더 나가지 않는다.
        var ro = r + lw, ri = Math.max(0, r - lw);
        grow(b, ro * u.minX, ro * u.minY, ro * u.maxX, ro * u.maxY);
        if (Math.abs(fin(s.lineHi) - fin(s.lineLo)) < 360) [fin(s.lineLo), fin(s.lineHi)].forEach(function (d) {
          var ex = ri * Math.cos(rad(d)), ey = ri * Math.sin(rad(d));
          grow(b, ex, ey, ex, ey);
        });
      } else grow(b, r * u.minX - lw, r * u.minY - lw, r * u.maxX + lw, r * u.maxY + lw);   // 둥근 끝(linecap round)도 두께 반만큼
    }
    var c = rectOf(s.center);
    if (c) grow(b, Math.min(c.x0, c.x1), Math.min(c.y0, c.y1), Math.max(c.x0, c.x1), Math.max(c.y0, c.y1));
    if (!(b.minX <= b.maxX)) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    return b;
  }

  /* 상자가 스테이지 안에 들게 맞춘다.
   *   opts.radius  바라는 반지름          opts.width  스테이지 폭(블럭 폭)        opts.pad  상자 둘레 여유
   *   opts.wantCx  바라는 원 중심 x(스테이지 좌표 · 음수 = 왼쪽 바깥)             opts.minRadius  줄일 때의 바닥(기본 40)
   *   opts.padL · padR  가로 여유를 왼쪽 · 오른쪽 따로(안 주면 pad). 세로 여유는 언제나 pad.
   * 순서: ① 상자 폭이 (폭 − 2·pad) 를 넘으면 들어가는 가장 큰 반지름(정수 px)으로 줄인다(바닥까지) ② 원 중심 x 를 바라는 자리에서 «상자가 들어가는 만큼만» 민다
   *       ③ 높이 = 상자 높이 + 2·pad · 원 중심 y = pad − 상자 위 끝.
   * → { R, W, H, cx, cy, box(스테이지 좌표), fits, coreFits, shrunk(줄인 반지름 px), shift(민 px · 오른쪽 +) }
   *   fits 가 false 면 = 바닥 반지름에서도 폭이 모자란다. 그때 반지름은 바닥에서 멎고(더 무너뜨리지 않는다),
   *   상자를 가운데 놓되 «호 선 · 항목»(라벨 · 가운데를 뺀 것)이 들어갈 수 있으면 그것만은 폭 안에 담는다 — 넘치는 쪽은 라벨 · 가운데다.
   *   coreFits = 그 «호 선 · 항목»이 폭 안에 들었나(fits 면 언제나 true). 세로는 언제나 전부 담는다(높이를 늘린다). */
  function fit(spec, opts) {
    var o = opts || {};
    var W = Math.max(0, fin(o.width)), pad = Math.max(0, fin(o.pad));
    var want = Math.max(0, fin(o.radius));
    var floor = Math.min(want, Math.max(1, fin(o.minRadius === undefined ? MIN_RADIUS : o.minRadius)));
    var padL = o.padL === undefined ? pad : Math.max(0, fin(o.padL)), padR = o.padR === undefined ? pad : Math.max(0, fin(o.padR));
    var room = W - padL - padR;
    var widthAt = function (r) { var x = contentBox(r, spec); return x.maxX - x.minX; };
    var R = want;
    if (want > floor && widthAt(want) > room) {
      // 상자 폭은 R 의 «볼록» 함수다(직선들의 최대 − 직선들의 최소) ⇒ 들어가는 R 은 한 구간이고, 그 위 끝을 이분으로 찾는다.
      var okR = floor;
      if (widthAt(floor) > room) {   // 바닥에서도 넘치면 폭이 가장 좁은 자리를 먼저 찾는다(삼분)
        var a = floor, c = want;
        for (var i = 0; i < 60 && c - a > 0.25; i++) {
          var m1 = a + (c - a) / 3, m2 = c - (c - a) / 3;
          if (widthAt(m1) <= widthAt(m2)) c = m2; else a = m1;
        }
        okR = (a + c) / 2;
      }
      if (widthAt(okR) > room) R = floor;   // 어느 반지름에서도 안 들어간다
      else {
        var over = want;
        for (var j = 0; j < 60 && over - okR > 0.25; j++) {
          var mid = (okR + over) / 2;
          if (widthAt(mid) <= room) okR = mid; else over = mid;
        }
        R = Math.max(floor, Math.floor(okR));
        if (R + 1 <= want && widthAt(R + 1) <= room) R += 1;   // 이분이 경계 바로 아래에서 멎었을 때
        if (widthAt(R) > room) R = r2(okR);
      }
    }
    var b = contentBox(R, spec);
    var lo = padL - b.minX, hi = W - padR - b.maxX;
    var fits = lo <= hi + 1e-9;
    var wantCx = fin(o.wantCx);
    var cx = fits ? Math.min(Math.max(wantCx, lo), Math.max(lo, hi)) : (lo + hi) / 2;
    var coreFits = fits;
    if (!fits) {
      var s = spec || {};
      var cb = contentBox(R, { degs: s.degs, line: s.line, lineLo: s.lineLo, lineHi: s.lineHi, lineWidth: s.lineWidth, lineCap: s.lineCap, markerHalf: s.markerHalf, halo: s.halo });
      var cl = padL - cb.minX, ch = W - padR - cb.maxX;
      coreFits = cl <= ch + 1e-9;
      if (coreFits) cx = Math.min(Math.max(cx, cl), Math.max(cl, ch));
    }
    var cy = pad - b.minY;
    var H = Math.ceil(b.maxY - b.minY + 2 * pad);
    cx = r2(cx); cy = r2(cy);
    return {
      R: R, W: W, H: H, cx: cx, cy: cy, fits: fits, coreFits: coreFits,
      shrunk: r2(want - R), shift: r2(cx - wantCx),
      box: { minX: r2(cx + b.minX), maxX: r2(cx + b.maxX), minY: r2(cy + b.minY), maxY: r2(cy + b.maxY) },
    };
  }

  /* 라벨 덩어리의 «어림» 크기 — 아직 화면에 안 붙어 잴 수 없을 때만 쓴다(붙은 뒤에는 렌더가 실제 크기를 재서 다시 맞춘다).
   *   넉넉한 쪽으로 어림한다: 글자 하나 = 글자 크기 1 배 폭. 줄 수 = 줄바꿈으로 나뉜 줄마다 ⌈줄 폭 ÷ 최대 폭⌉.
   *   o: { text, fontSize, lineHeight, maxWidth, iconSize(0 = 아이콘 없음), iconGap } → { w, h } */
  function labelEstimate(o) {
    var p = o || {}, fs = Math.max(1, fin(p.fontSize)), lh = Math.max(1, fin(p.lineHeight) || 1.3);
    var maxW = Math.max(fs, fin(p.maxWidth)), icon = Math.max(0, fin(p.iconSize)), gap = Math.max(0, fin(p.iconGap));
    var src = String(p.text === undefined || p.text === null ? '' : p.text).replace(/\*\*/g, '');
    var rows = 0, widest = 0;
    src.split(/\r?\n/).forEach(function (line) {
      var w = line.length * fs;
      rows += Math.max(1, Math.ceil(w / maxW));
      widest = Math.max(widest, Math.min(w, maxW));
    });
    return { w: Math.ceil(Math.max(widest, Math.min(icon, maxW))), h: Math.ceil((icon ? icon + gap : 0) + rows * fs * lh) };
  }

  var RADIAL_ARC_GEOM = Object.freeze({
    MIN_RADIUS: MIN_RADIUS, HALF: HALF, arcAngles: arcAngles, arcAnglesInset: arcAnglesInset, halfCircle: halfCircle, lineRange: lineRange, arcPath: arcPath,
    sweepBox: sweepBox, contentBox: contentBox, fit: fit, labelEstimate: labelEstimate,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = RADIAL_ARC_GEOM;
  if (root) root.RADIAL_ARC_GEOM = RADIAL_ARC_GEOM;
})(typeof window !== 'undefined' ? window : null);
