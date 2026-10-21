/* ═══════════════════════════════════════════════════════════════════════════
   annot-dim-geometry.js — 사이즈 스티커(치수선)의 ★기하를 ★한 자리에서 센다.
   ───────────────────────────────────────────────────────────────────────────
   ★★왜 ★별 파일인가 — `js/blocks/annotation-block.js` 는 ★ESM 이고 ★최상위에서
     `window` 를 쓴다 ⇒ ★단위 검사에서 ★실리지 않는다(2026-10-21 에 `js/globals.js`
     가 ★같은 병으로 소스 게이트(약한 자)밖에 못 쓰게 했다).
     ⇒ ★여기는 ★플레인 스크립트다. ★단위 검사가 ★`vm` 으로 읽어 ★진짜로 ★부른다
       (`js/feature-flags.js` 의 `animGifVisible` 과 ★같은 관용구).

   ★꼴 (현빈 원문 「★어노테이션처럼 ★점 2개 찍어」 — 아티팩트 v6)
     A ●────────────● B      ← 사용자가 찍은 ★두 점(섹션 좌상단 기준 ★절대좌표)
       ┊            ┊        ← ★보조선(extension) — 치수선에 ★수직
       ├──── 120 ───┤        ← ★치수선 — 두 점과 ★평행하게 ★치우쳐 있다
          ↑ 라벨 = 치수선 ★중심 (⛔`points[last]` 가 ★아니다 — 그 한 줄이 함정이다)

   ★칸 넷
     dimAxis   'auto' | 'h' | 'v'   두 점이 비뚤어도 ★가로/세로로 ★재게 한다
     dimOffset 수직 치우침(px, 부호)  치수선을 선 ★밖으로 밀어낸다
     dimSlide  선 ★따라 밀기(px)     라벨·파이프를 ★좌우로 (|값|<SNAP ⇒ ★0 으로 붙는다)
     dimGap/dimOver 보조선 ★간격·★넘침

   ⛔모든 수는 ★섹션 좌표계(px)다 — ★배율은 ★부모가 건다.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  var SNAP = 12;   /* ★자석 폭 — |dimSlide| 가 이 안이면 ★0 으로 붙는다(손이 떨려도 ★가운데가 된다) */

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }

  /* ★치수선의 기하를 ★전부 센다. ⛔그리기·DOM 은 ★여기서 하지 않는다(재는 자와 그리는 자를 가른다). */
  function annotDimGeometry(points, o) {
    if (!Array.isArray(points) || points.length < 2) return null;
    var A = points[0], B = points[points.length - 1];
    o = o || {};

    var dx = B[0] - A[0], dy = B[1] - A[1];
    var axis = o.dimAxis === 'h' || o.dimAxis === 'v' ? o.dimAxis : 'auto';
    if (axis === 'h') dy = 0;
    else if (axis === 'v') dx = 0;

    /* ★길이 0 은 ★나눗셈을 죽인다 — 방향을 ★가로로 둔다(점 두 개가 겹친 판) */
    var len = Math.sqrt(dx * dx + dy * dy);
    var degenerate = len < 1e-9;
    if (degenerate) { dx = 1; dy = 0; len = 1; }

    var u = [dx / len, dy / len];      /* 선 방향 */
    var n = [-u[1], u[0]];             /* 그 ★수직 */

    var off = num(o.dimOffset, 0);
    var slideRaw = num(o.dimSlide, 0);
    var slide = Math.abs(slideRaw) < SNAP ? 0 : slideRaw;   /* ★자석 */
    var snapped = slide === 0 && slideRaw !== 0;

    /* ★치수선 양끝 = 두 점을 ★수직으로 off 만큼 밀고, ★선 따라 slide 만큼 민 자리 */
    var push = function (p) {
      return [p[0] + n[0] * off + u[0] * slide, p[1] + n[1] * off + u[1] * slide];
    };
    /* ⚠️axis 를 고정하면 B 는 ★투영된 자리를 쓴다 — 안 그러면 치수선이 두 점과 ★안 평행해진다 */
    var Bp = [A[0] + u[0] * len, A[1] + u[1] * len];
    var a = push(A), b = push(Bp);

    /* ★보조선 — ★원래 점에서 ★치수선 쪽으로. 간격(gap)만큼 띄우고 넘침(over)만큼 지나간다 */
    var gap = Math.max(0, num(o.dimGap, 4));
    var over = Math.max(0, num(o.dimOver, 6));
    var sgn = off === 0 ? 0 : (off > 0 ? 1 : -1);
    var ext = function (p, pd) {
      return [
        [p[0] + n[0] * gap * sgn, p[1] + n[1] * gap * sgn],
        [pd[0] + n[0] * over * sgn, pd[1] + n[1] * over * sgn],
      ];
    };

    /* ★파이프 각도 — ★좌우(slide)가 0 이면 ★선에 ★수직이다(=★치수선 끝의 ★막음 표시).
       ★slide 가 커지면 ★기울어진다(아티팩트 v6 의 「뽑혀 있는 느낌」을 ★각도로만 낸다). */
    var baseDeg = Math.atan2(u[1], u[0]) * 180 / Math.PI;
    var tilt = Math.atan2(slide, Math.abs(off) || 1) * 180 / Math.PI;

    /* ★★261021 현빈 지적 — 「왜 라벨텍스트 박스가 ★바로 선 중간에 위치하는지??」
       ⛔첫 판은 라벨을 ★치수선 ★정중앙(mid)에 ★겹쳐 놓았다. ★제도에서는 치수 문자가 ★선 위에 ★겹치지 않는다 —
         ⑴선이 그 자리에서 ★끊기거나 ⑵문자가 ★선 바깥으로 ★살짝 떠 있거나 ★둘 중 하나다.
       ⇒ `mid` 는 ★그대로 두고(기하의 중점이라 ★다른 것도 쓴다) ★라벨 자리는 ★`labelAt` 으로 ★따로 낸다.
       ★띄우는 쪽 = ★치우침과 ★같은 쪽(선 바깥). ★치우침이 0 이면 ★위쪽(n 의 반대)으로 둔다. */
    var lift = Math.max(0, num(o.dimLabelLift, 11));
    var lsgn = off === 0 ? -1 : (off > 0 ? 1 : -1);
    var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    var labelAt = [mid[0] + n[0] * lift * lsgn, mid[1] + n[1] * lift * lsgn];

    return {
      axis: axis, len: len, degenerate: degenerate,
      u: u, n: n, off: off, slide: slide, snapped: snapped, snapWidth: SNAP,
      line: [a, b],                          /* ★치수선 — 두 점과 ★평행 */
      ext: [ext(A, a), ext(Bp, b)],          /* ★보조선 둘 — 치수선에 ★수직 */
      mid: mid,                              /* ★치수선 ★중점(기하) — ⛔라벨 자리가 ★아니다 */
      labelAt: labelAt, lift: lift, lsgn: lsgn,   /* ★라벨 자리 = 중점에서 ★선 바깥으로 lift 만큼 */
      pipeDeg: [baseDeg + 90 + tilt, baseDeg + 90 + tilt],
      sgn: sgn,
    };
  }

  w.annotDimGeometry = annotDimGeometry;
  w.ANNOT_DIM_SNAP = SNAP;
})(typeof window !== 'undefined' ? window : globalThis);
