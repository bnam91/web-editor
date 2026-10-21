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
  /* ★[x,y] 꼴이고 ★두 수가 ★유한할 때만 ★점으로 친다 — ⛔문자열·∅·NaN 이 ★조용히 흐르면 안 된다 */
  function pt(v) {
    if (!Array.isArray(v) || v.length < 2) return null;
    var x = parseFloat(v[0]), y = parseFloat(v[1]);
    return (isFinite(x) && isFinite(y)) ? [x, y] : null;
  }

  /* ★★★261021 현빈 ★2차 설계 — ★d·c 와 ★a·b 는 ★별개다.
       현빈 원문: 「★d점과 c점은 ★기준점으로 찍지만 ★치수선(a,b)를 놓고 봤을때 ★da, cb의 길이는
         ★달라질수 있어 … ★어디로 치수선을 움직일지 모르잖아」
                 「최초에 찍은 d,c 앞의 점의 위치도 ★나중에 ★각각 잡고 ★위치 이동시킬 수 있어야해」
                 「치수선 양끝에 ★파이프인 경우 ★지금은 ★무조건 90도만 되는데 ★각도도 달라지겠지?」
     ★★왜 그래야 하나 — ★d·c 는 ★「무엇을 쟀나」(물체 위)이고 ★a·b 는 ★「어디에 표시하나」(보기 좋은 자리)다.
       물체가 비뚤거나 복잡하면 ★평행하게만 두면 ★가려지고 안 예쁘다. ⇒ ★a·b 를 ★자유롭게 놓고
       ★d→a, c→b 를 ★직접 잇는다. ⇒ ★그 둘의 길이가 ★달라지는 것이 ★정상이다.
     ⛔내 1차 모형(평행·치우침 하나)은 ★a·b 를 ★d·c 의 평행이동으로 묶어 ★da=cb 를 ★강제했다 — ★철회한다.

     ★네 점이 ★전부 ★손잡이다: d · c · a · b
     ★파이프 각도 = ★(b−a) 방향에 ★수직 — ⛔(c−d) 가 ★아니다(그래서 지금 ★무조건 90도였다).
     ★`dimA`/`dimB` 가 ★없으면(옛 저장본·막 찍은 것) ★치우침·좌우로 ★한 번 계산해 ★채운다. */
  function annotDimGeometry(points, o) {
    if (!Array.isArray(points) || points.length < 2) return null;
    var D = points[0], C = points[points.length - 1];
    o = o || {};

    /* ★d−c 는 ★「잰 구간」이다 — ★길이·방향을 ★여기서만 쓴다(축 고정 포함) */
    var mdx = C[0] - D[0], mdy = C[1] - D[1];
    var axis = o.dimAxis === 'h' || o.dimAxis === 'v' ? o.dimAxis : 'auto';
    if (axis === 'h') mdy = 0; else if (axis === 'v') mdx = 0;
    var mlen = Math.sqrt(mdx * mdx + mdy * mdy);
    var degenerate = mlen < 1e-9;
    if (degenerate) { mdx = 1; mdy = 0; mlen = 1; }
    var mu = [mdx / mlen, mdy / mlen];      /* 잰 구간 방향 */
    var mn = [-mu[1], mu[0]];               /* 그 수직 */

    /* ★치수선 양끝 a·b — ★있으면 ★그대로 쓴다(사용자가 각각 끈 자리).
       ★없으면 ★치우침·좌우로 ★한 번 만든다(③클릭 직후의 첫 자리). */
    var off = num(o.dimOffset, 0);
    var slideRaw = num(o.dimSlide, 0);
    var slide = Math.abs(slideRaw) < SNAP ? 0 : slideRaw;
    var snapped = slide === 0 && slideRaw !== 0;
    var Cp = [D[0] + mu[0] * mlen, D[1] + mu[1] * mlen];   /* 축 고정 시 C 의 투영 */
    var a = pt(o.dimA) || [D[0] + mn[0] * off + mu[0] * slide, D[1] + mn[1] * off + mu[1] * slide];
    var b = pt(o.dimB) || [Cp[0] + mn[0] * off + mu[0] * slide, Cp[1] + mn[1] * off + mu[1] * slide];

    /* ★치수선 자신의 방향 — ⛔잰 구간과 ★같다고 ★가정하지 않는다 */
    var ldx = b[0] - a[0], ldy = b[1] - a[1];
    var llen = Math.sqrt(ldx * ldx + ldy * ldy);
    var lineDegenerate = llen < 1e-9;
    if (lineDegenerate) { ldx = mu[0]; ldy = mu[1]; llen = 1; }
    var u = [ldx / llen, ldy / llen];
    var n = [-u[1], u[0]];

    /* ★보조선 = ★d→a, c→b 를 ★직접 잇는다. ★길이가 ★서로 달라도 된다(현빈 요구).
       ★간격(gap)만큼 ★기준점에서 띄우고, ★넘침(over)만큼 ★치수선을 ★지나간다. */
    var gap = Math.max(0, num(o.dimGap, 4));
    var over = Math.max(0, num(o.dimOver, 6));
    var ext = function (p, q) {
      var dx = q[0] - p[0], dy = q[1] - p[1];
      var L = Math.sqrt(dx * dx + dy * dy);
      if (L < 1e-9) return [[p[0], p[1]], [q[0], q[1]]];
      var ux = dx / L, uy = dy / L;
      return [[p[0] + ux * gap, p[1] + uy * gap], [q[0] + ux * over, q[1] + uy * over]];
    };

    /* ★파이프 각도 = ★치수선(b−a) 방향에 ★수직. ⛔잰 구간이 ★아니다 — 그래서 ★무조건 90도였다. */
    var lineDeg = Math.atan2(u[1], u[0]) * 180 / Math.PI;
    var pipeDeg = lineDeg + 90;

    /* ★라벨 — ★치수선 중점에서 ★선 밖으로 띄운다(현빈 261021 「선 중간에 겹친다」 지적) */
    var lift = Math.max(0, num(o.dimLabelLift, 11));
    var lsgn = (function () {
      var mx = (D[0] + Cp[0]) / 2, my = (D[1] + Cp[1]) / 2;   /* 잰 구간 중점 */
      var cx = (a[0] + b[0]) / 2,  cy = (a[1] + b[1]) / 2;    /* 치수선 중점 */
      var s = (cx - mx) * n[0] + (cy - my) * n[1];            /* 물체 ★반대쪽이 ★바깥이다 */
      return s === 0 ? -1 : (s > 0 ? 1 : -1);
    })();
    var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    var labelAt = [mid[0] + n[0] * lift * lsgn, mid[1] + n[1] * lift * lsgn];

    return {
      axis: axis, len: mlen, lineLen: llen, degenerate: degenerate,
      u: u, n: n, mu: mu, mn: mn,
      off: off, slide: slide, snapped: snapped, snapWidth: SNAP,
      base: [[D[0], D[1]], [Cp[0], Cp[1]]],      /* ★잰 구간(기준점 둘) */
      line: [a, b],                              /* ★치수선 — ⛔잰 구간과 ★평행이 아닐 수 있다 */
      ext: [ext(D, a), ext(Cp, b)],              /* ★보조선 — ★길이가 ★서로 달라도 된다 */
      mid: mid, labelAt: labelAt, lift: lift, lsgn: lsgn,
      pipeDeg: [pipeDeg, pipeDeg],               /* ★치수선 방향에 ★수직 */
      lineDeg: lineDeg, sgn: off === 0 ? 0 : (off > 0 ? 1 : -1),
    };
  }

  /* ★★261021 현빈 설계 — ★3클릭이다.
       클릭1 ★첫 점 · 클릭2 ★둘째 점(= ★길이 확정) · ★그 뒤 마우스를 따라 치수선이 ★왔다갔다 ·
       클릭3 ★그 자리에 ★고정 ＋ ★원래 두 점에서 ★보조선이 ★연결된다.
     ⇒ ★클릭3 의 자리를 ★`dimOffset`(부호 있는 ★수직거리)으로 ★바꾸는 자가 ★여기다.
     ⛔`dimSlide`(선 따라)는 ★여기서 안 정한다 — 치수선은 ★두 점과 ★평행해야 하고,
       선 따라 미는 것은 ★보기 값이라 ★패널(⒟)에서 고른다. */
  function annotDimOffsetFromPoint(points, pt, o) {
    if (!Array.isArray(points) || points.length < 2 || !pt) return 0;
    var A = points[0], B = points[points.length - 1];
    var dx = B[0] - A[0], dy = B[1] - A[1];
    var axis = (o && (o.dimAxis === 'h' || o.dimAxis === 'v')) ? o.dimAxis : 'auto';
    if (axis === 'h') dy = 0; else if (axis === 'v') dx = 0;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) { dx = 1; dy = 0; len = 1; }
    var nx = -dy / len, ny = dx / len;          /* 선의 ★수직 */
    return (pt[0] - A[0]) * nx + (pt[1] - A[1]) * ny;   /* ★부호 있는 거리 — 어느 쪽인지까지 담는다 */
  }

  w.annotDimGeometry = annotDimGeometry;
  w.annotDimOffsetFromPoint = annotDimOffsetFromPoint;
  w.ANNOT_DIM_SNAP = SNAP;
})(typeof window !== 'undefined' ? window : globalThis);
