// ── Zoom Block 기하 (확대블럭) ────────────────────────────────────────────────
// ★이 파일은 «순수 함수만» 둔다 — window·DOM 을 만지지 않는다.
//   이유: 이 레포는 package.json 이 "type":"commonjs" 라 js/**.js 를 node 가 못 읽고,
//   검사는 tmp `.mjs` 사본을 동적 import 해서 «진짜 실행»으로 잰다
//   (tests/unit/aifill-goya-asset.test.js 의 수법). 모듈 최상단에 window 접근이 하나라도
//   있으면 그 import 가 ReferenceError 로 죽어서 «기하를 잴 수 없다».
//   ⇒ 렌더·이벤트·dataset 은 전부 zoom-block.js 몫이다.
//
// 좌표계: 도형 중심을 (cx,cy) 로 받는다. 화면 좌표(y 아래로 증가) 그대로.
//         angle 0° = +x(오른쪽), 시계방향으로 증가.

/** rect 프리셋의 세로/가로 비 — square(1.0) 와 «눈에 띄게» 달라야 프리셋이 프리셋 구실을 한다. */
/* ★6.5 : 3.5 (현빈 2026-09-08 「사각형 디폴트 가로 너비를 조금만 늘려 줄래? 6.5:3.5 비율?」).
   size 260 → 260 × 140. 260 × (7/13) = 140 «정확히» (둘 다 정수로 떨어지는 자리를 골랐다).
   ⛔«분수»로 쓴다 — 0.5385 로 적으면 140.01 이 나온다. (앞서 0.625→2/3 때와 같은 이유)
   ⛔지나온 값: 0.625(8:5, 1.6) → 2/3(3:2, 1.5) → ★7/13(6.5:3.5, 1.857142…).
     눈으로는 다 「가로로 긴 사각형」이라 «비슷하다»로 넘기면 안 된다. 검사가 리터럴로 못박는다. */
export const ZOOM_RECT_RATIO = 3.5 / 6.5;   // = 7/13. 가로:세로 = 6.5 : 3.5

/** 그림자 띠 개수. 많을수록 매끈하지만 노드가 늘어난다(64 = 실측상 밴딩 안 보임). */
export const ZOOM_STRIP_COUNT = 64;

/* ★도형 배경의 «기본» = 체크패턴 (현빈 2026-09-08 「쉐이프 배경은 기본적으로 체크패턴
   백그라운드로 — 다른 이미지에셋 들어갈 때처럼」). fill 이 이 값이면 «색이 아니라 무늬»다.
   ⛔무늬 자체는 여기서 안 그린다 — css/editor-blocks.css 의 .icb-circle 이 쓰는
     repeating-conic-gradient 가 정본이고, .zoom-bg 가 그 값을 «그대로» 재사용한다.
     SVG <pattern> 으로 베끼면 같은 무늬가 두 군데가 되어 조용히 갈라진다. */
export const ZOOM_CHECKER = 'checker';

export function lerp(p, q, t) {
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

/** 도형 꼭짓점 — rect/square 공용. rot 은 도(degree). */
export function shapePts(kind, r, rot, cx, cy) {
  const hw = r;
  const hh = (kind === 'rect') ? r * ZOOM_RECT_RATIO : r;
  const th = (Number(rot) || 0) * Math.PI / 180;
  const co = Math.cos(th), si = Math.sin(th);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(function (p) {
    return { x: cx + p[0] * co - p[1] * si, y: cy + p[0] * si + p[1] * co };
  });
}

/* 광원에서 그은 접점 = 그림자 지는 점.
   ⛔「축에 수직인 극점」은 광원이 «무한히 멀 때»만 맞다 — 가까우면 어긋난다(사각형이면 아래 꼭짓점이 맞다)

   ★알맹이를 둘로 쪼개 둔 이유: 「그림자가 붙는 윤곽」이 도형일 때도 있고 «테두리 바깥»일 때도 있다.
     반지름만 키우면 rect 는 틀린다 — rect 의 세로 반치수는 r·0.625 라, r+두께 로 키우면
     세로가 (r+두께)·0.625 가 되어 «두께가 세로에서 줄어든다». 그래서 «점 목록»을 받는다. */
export function silhouetteCircle(r, L, cx, cy) {
  var dx = cx - L.x, dy = cy - L.y, d = Math.hypot(dx, dy);
  if (d <= r + 0.5) return [{ x: cx, y: cy }, { x: cx, y: cy }];
  var phi = Math.atan2(-dy, -dx), be = Math.acos(Math.max(-1, Math.min(1, r / d)));
  return [{ x: cx + r * Math.cos(phi - be), y: cy + r * Math.sin(phi - be) },
          { x: cx + r * Math.cos(phi + be), y: cy + r * Math.sin(phi + be) }];
}

export function silhouetteFromPts(ps, L, cx, cy) {
  var base = Math.atan2(cy - L.y, cx - L.x);
  var lo = ps[0], hi = ps[0], lv = 1e9, hv = -1e9;
  ps.forEach(function (p) {
    var q = Math.atan2(p.y - L.y, p.x - L.x) - base;
    while (q > Math.PI) q -= 2 * Math.PI; while (q < -Math.PI) q += 2 * Math.PI;
    if (q < lv) { lv = q; lo = p } if (q > hv) { hv = q; hi = p }
  });
  return [lo, hi];
}

export function silhouette(kind, r, rot, L, cx, cy) {
  if (kind === 'circle') return silhouetteCircle(r, L, cx, cy);
  return silhouetteFromPts(shapePts(kind, r, rot, cx, cy), L, cx, cy);
}

/* 띠 — A·B(진함) → a·b(투명). pw=농도곡선, MAXOP=최대농도(0~1)
   ⛔선형 그라데이션(linearGradient)을 쓰지 마라. 선형은 «축에 수직인» 등농도선을 만들어서
     a·b 가 축 방향 거리가 다르면 «둘의 농도가 갈린다»(현빈이 실제로 잡은 결함).
   ⇒ a→A 와 b→B 를 «같은 비율 t» 로 훑는다. 그래야 윗변 전체 0 / 아랫변 전체가 정확히 최대농도다. */
export function strips(A, B, a, b, n, pw, MAXOP) {
  var out = '';
  for (var i = 0; i < n; i++) {
    var t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
    var L0 = lerp(A, a, t0), R0 = lerp(B, b, t0), L1 = lerp(A, a, t1), R1 = lerp(B, b, t1);
    var o = Math.pow(1 - tm, pw) * MAXOP;
    out += '<polygon points="' + [L0, R0, R1, L1].map(function (p) { return p.x.toFixed(2) + ',' + p.y.toFixed(2) }).join(' ') +
      '" fill="#000" fill-opacity="' + o.toFixed(4) + '"/>';
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ★벌림 = 「도형 «선»을 따라 미끄러진다」  (현빈 2026-09-08)
     「벌리기 슬라이드를 하면 c,d의 거리가 벌어지는데 그게아니고, c는 A부터 왼쪽으로
       쉐이프 선따라서 가고, d는 B의 바깥쪽으로 라인따라 벌려지게」
       … 「미끄러지는게 맞아 도형선따라서. 모서리 넘어가도 계속 둬.」

   ⛔옛 판(applySpread)은 A·B 를 «둘을 잇는 직선(현)» 방향으로 밀어냈다 ⇒ 두 점이 도형
     윤곽에서 «떨어져 허공으로» 나갔다. 그래서 통째로 갈아엎었다(그 함수는 지웠다 —
     남겨 두면 「어느 쪽이 정본인가」가 둘이 된다).

   ★어느 쪽으로 가나 — 두 점은 «빛을 등진 쪽(far arc)»으로 들어간다.
     실루엣 A·B 는 둘레를 두 호로 가른다. 광원을 마주 보는 호(near)와 등진 호(far)다.
     far 로 들어가야 원뿔(광원→도형)이 «깊어지고 넓어진다» = 사람이 말하는 「벌어진다」.
     near 로 가면 둘이 곧장 마주쳐 교차한다(사각형·광원 오른쪽에서 실측: 140px 만에 만난다).
   ⚠️둘레는 «닫힌 고리»다 — 모서리를 넘어도 안 멈춘다. 한 바퀴가 넘으면 그냥 돈다.
   ⚠️★두 점은 «먼 호 위에서 서로 마주 온다» ⇒ 언젠가 만나고, 그 뒤로는 지나쳐 뒤집힌다.
     만나는 자리 F = «먼 호 길이» (각 점이 spread/2 씩 걸으니 2·(F/2) = F).
     ⛔F 는 «상수가 아니다» — 광원 각도에 따라 실루엣이 어느 꼭짓점을 잡느냐로 달라진다.
       실측(rect 260×140, 둘레 800, 테두리 없음):
         광원이 «짧은 변»을 마주 봄(angle 0·180)   → 가까운 호 140, F = 660
         광원이 «긴 변»을 마주 봄(angle −90)        → 가까운 호 260, F = 540
         광원이 «대각»을 마주 봄(angle −45·−140)   → 두 호가 400·400, F = 400
       ⛔예전에 이 자리에 「사각형 기본값에서 660」이라고 «한 수»만 적어 뒀다. 그건 angle 0 의 값이고
         기본 각도(−90)에서는 540 이다. 「기본값」이라는 말이 각도를 가렸다 — 그래서 표로 바꿨다.
     ★★그리고 F 를 지나면 그림이 «되접힌다» — spread s 의 그림 = spread (2F − s) 의 그림.
       (두 점이 서로의 길을 되밟고 자리만 맞바꾸는데, 사다리꼴은 A·B 를 «구별하지 않는다»)
       ⇒ 슬라이더에서 F 위쪽은 «새 그림이 없다». 실측 중복 구간:
           angle 0 → 660~800 이 520~660 의 되풀이 · −90 → 540~800 이 280~540 의 되풀이
           −140 → 400~800 이 0~400 의 되풀이(그래서 spread 800 이 spread 0 과 «똑같다»)
     ⚠️슬라이더 상한 800 은 «기하와 무관한 리터럴»이다(prop-zoom.js, 확대블럭 첫 커밋 9c6fd13부터).
       그때 spread 는 «직선 벌림 px» 였다. 지금 둘레 기준으로 바뀌었으니 800 이 rect 기본 둘레와
       같은 건 «우연»이다 — size 를 바꾸면 어긋난다(size 80 → 둘레 246 이라 슬라이더가 3.25 바퀴).
     ⛔여기서 임의로 자르지 않는다 — 현빈이 「계속 둬」라고 못박았고, 겹치는 순간은
     shadowVisible 이 |AB|≈0 으로 이미 안전하게 처리한다(NaN 이 아니다).
     ⇒ 상한을 F 로 조일지는 «현빈 결정»이다(F 가 도형·각도마다 달라 UI 쪽 일이 된다).
   ═══════════════════════════════════════════════════════════════════════════ */

/** 닫힌 다각형의 변 길이 — e[i] = pts[i] → pts[(i+1)%n]. */
export function edgeLengths(pts) {
  var n = pts.length, out = [];
  for (var i = 0; i < n; i++) {
    var p = pts[i], q = pts[(i + 1) % n];
    out.push(Math.hypot(q.x - p.x, q.y - p.y));
  }
  return out;
}

/** 닫힌 다각형 둘레를 꼭짓점 i0 에서 dir(+1|-1) 로 «거리 t» 만큼 간 점.
 *  ★t 가 둘레보다 커도 «돈다». t 가 음수면 반대로 간다. */
export function walkPolygon(pts, i0, dir, t) {
  var n = pts.length, e = edgeLengths(pts);
  var P = e.reduce(function (s, v) { return s + v }, 0);
  if (!(P > 1e-9)) return { x: pts[i0].x, y: pts[i0].y };
  var s = ((dir >= 0 ? 1 : -1) * (Number(t) || 0)) % P;
  if (s < 0) s += P;                      // 뒤로 t = 앞으로 (P − t)
  var i = i0, guard = 0;
  while (s > e[i] && guard++ < n + 2) { s -= e[i]; i = (i + 1) % n; }
  var p = pts[i], q = pts[(i + 1) % n];
  var k = e[i] > 1e-9 ? s / e[i] : 0;
  return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
}

/** 원 둘레 — 반지름 r 의 호를 «거리» t 만큼. (호길이 = r·각) */
export function walkCircle(r, cx, cy, ang0, dir, t) {
  if (!(r > 1e-9)) return { x: cx, y: cy };
  var th = ang0 + (dir >= 0 ? 1 : -1) * (Number(t) || 0) / r;
  return { x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) };
}

/** 점 P 에 가장 가까운 꼭짓점 index. (실루엣은 «그 배열의 원소»를 돌려주지만 거리로 찾는다) */
export function nearestVertexIndex(pts, P) {
  var bi = 0, bd = Infinity;
  for (var i = 0; i < pts.length; i++) {
    var d = Math.hypot(pts[i].x - P.x, pts[i].y - P.y);
    if (d < bd) { bd = d; bi = i }
  }
  return bi;
}

/** iA 에서 dir 로 iB 까지 가는 호의 길이. */
function arcLenPoly(pts, iA, iB, dir) {
  var n = pts.length, e = edgeLengths(pts), len = 0, i = iA, guard = 0;
  while (i !== iB && guard++ < n + 2) {
    if (dir >= 0) { len += e[i]; i = (i + 1) % n }
    else { var j = (i - 1 + n) % n; len += e[j]; i = j }
  }
  return len;
}

/** A 에서 «빛을 등진 호(far)»로 들어가는 방향(+1|−1) — 두 호의 «중간점» 중 광원에서 먼 쪽. */
export function outwardDirPoly(pts, iA, iB, L) {
  var lp = arcLenPoly(pts, iA, iB, +1), lm = arcLenPoly(pts, iA, iB, -1);
  var sp = walkPolygon(pts, iA, +1, lp / 2), sm = walkPolygon(pts, iA, -1, lm / 2);
  return (Math.hypot(sp.x - L.x, sp.y - L.y) > Math.hypot(sm.x - L.x, sm.y - L.y)) ? +1 : -1;
}

/** 원판 — 각 aA 에서 far 로 들어가는 방향. */
export function outwardDirCircle(r, cx, cy, aA, aB, L) {
  var d = aB - aA;
  while (d <= 0) d += 2 * Math.PI;
  while (d > 2 * Math.PI) d -= 2 * Math.PI;
  var sp = walkCircle(r, cx, cy, aA, +1, r * d / 2);
  var sm = walkCircle(r, cx, cy, aA, -1, r * (2 * Math.PI - d) / 2);
  return (Math.hypot(sp.x - L.x, sp.y - L.y) > Math.hypot(sm.x - L.x, sm.y - L.y)) ? +1 : -1;
}

/** i0 에서 dir 로 걸을 때 «꼭짓점을 밟는» 부호 있는 거리들. 0(출발점)은 뺀다.
 *  ⛔출발점에 걸림을 두면 spread 가 작을 때 슬라이더가 «죽은 것»처럼 느껴진다. */
export function vertexDistances(pts, i0, dir, reach) {
  var n = pts.length, e = edgeLengths(pts), out = [];
  var P = e.reduce(function (s, v) { return s + v }, 0);
  if (!(P > 1e-9)) return out;
  var d = dir >= 0 ? 1 : -1;
  for (var side = 0; side < 2; side++) {
    var acc = 0, i = i0, guard = 0;
    var fwd = (side === 0) ? d : -d;                 // side 0 = t>0 쪽, side 1 = t<0 쪽
    while (acc < reach && guard++ < 4 * n + 8) {
      var len = fwd > 0 ? e[i] : e[(i - 1 + n) % n];
      if (!(len > 1e-9)) break;
      acc += len;
      i = fwd > 0 ? (i + 1) % n : (i - 1 + n) % n;
      out.push(side === 0 ? acc : -acc);
    }
  }
  return out.sort(function (x, y) { return x - y });
}

/* ★마그네틱 — 「각 꼭지점마다, 살짝씩 걸리는 느낌」(현빈)
   ⛔스냅(딱 붙기)이 «아니다». 지나갈 수 있어야 한다.
   ⇒ 「슬라이더 값 → 둘레 거리」 사상에 꼭짓점마다 «평평한 구간»을 넣는다.
      창(±w) 안에서   |u| ≤ s : 출력이 «전혀» 안 변한다  (걸림)
                      |u| > s : 기울기 1/(1−s) 로 «툭» 따라붙는다 (넘어감)
      창 끝(u=±1)에서 출력 = 입력이라 «이어진다»(점이 튀지 않는다).
   ⚠️이웃 꼭짓점과 창이 겹치면 사상이 끊긴다 ⇒ 창을 «이웃까지 거리의 절반»으로 줄인다. */
export function detent(raw, vertexDists, w, s) {
  var r = Number(raw) || 0;
  if (!(w > 0) || !vertexDists || !vertexDists.length) return r;
  var ss = Math.min(0.99, Math.max(0, Number(s) || 0));
  var bi = -1, bd = Infinity;
  for (var i = 0; i < vertexDists.length; i++) {
    var dd = Math.abs(r - vertexDists[i]);
    if (dd < bd) { bd = dd; bi = i }
  }
  var v = vertexDists[bi], wEff = w;
  if (bi > 0) wEff = Math.min(wEff, (v - vertexDists[bi - 1]) / 2);
  if (bi < vertexDists.length - 1) wEff = Math.min(wEff, (vertexDists[bi + 1] - v) / 2);
  if (!(wEff > 0) || bd >= wEff) return r;
  var u = (r - v) / wEff;
  var g = Math.abs(u) <= ss ? 0 : (u < 0 ? -1 : 1) * (Math.abs(u) - ss) / (1 - ss);
  return v + wEff * g;
}

/* ★걸림의 «폭»은 실측으로 골랐다 — 처음 16 으로 뒀다가 실제 패널에서 재고 24 로 올렸다.
     잰 것: prop-zoom 의 벌림 슬라이더는 실측 «99px» 폭에 범위 -400~800(1200칸)이다
            ⇒ 화면 1px = 12.1칸. 각 점이 걷는 거리는 spread/2 라 «둘레 1px = 슬라이더 2칸».
     ⇒ W=16 이면 죽은 구간이 슬라이더 32칸 = 화면 «2.6px». 끌면 거의 안 느껴진다.
       W=24 면 죽은 구간 슬라이더 48칸 = 화면 «4.0px», 창 전체는 7.9px.
     ★위쪽 한계도 있다: 죽은 구간(둘레 ±12px)이 도형의 짧은 변(140px)에서 «눈에» 멈춤으로 보인다.
       더 키우면 걸림이 아니라 「슬라이더가 먹통」으로 읽힌다. 24 가 둘 사이다.
   ⚠️둘 다 export 라 «두 수만 고치면» 세기를 바꿀 수 있다(검사는 이 상수를 읽어서 잰다). */
/** 걸림 창 반폭(둘레거리 px). */
export const ZOOM_DETENT_W = 24;
/** 그 창 안에서 «완전히 평평한» 비율 — 0.5 ⇒ 평평 구간 ±12px(= 슬라이더 48칸 = 화면 4.0px). */
export const ZOOM_DETENT_S = 0.5;

/** 마그네틱 설정 — ★st.magnet==='off' 면 «걸림만» 끈다. 미끄러짐(둘레 걷기)은 그대로 남는다. */
export function zoomMagnet(st) {
  if (st && st.magnet === 'off') return null;
  return { w: ZOOM_DETENT_W, s: ZOOM_DETENT_S };
}

/** 걸림을 먹인 «둘레 거리». mag 가 없으면 raw 그대로(⑵만 남는다). */
function magneticDist(pts, i0, dir, raw, mag) {
  if (!mag) return raw;
  return detent(raw, vertexDistances(pts, i0, dir, Math.abs(raw) + mag.w + 1), mag.w, mag.s);
}

/**
 * ★벌림 — A·B 를 «도형 둘레를 타고» 서로 멀어지게 미끄러뜨린다(각각 둘레거리 spread/2).
 * @param {object} outline {kind:'poly', pts} | {kind:'circle', r, cx, cy}
 * @param {object} A,B 실루엣(접점)
 * @param {object} L 광원
 * @param {number} spread 총 벌림(px)
 * @param {?object} mag  {w,s} — 없으면 마그네틱 없음
 * @returns {[object, object]} 사다리꼴 긴 변의 두 끝
 */
export function applySpreadAlongOutline(outline, A, B, L, spread, mag) {
  var s = Number(spread) || 0;
  if (!s) return [A, B];
  // ★퇴화(광원이 도형 안 ⇒ A==B) — 옛 판의 성질을 그대로 지킨다. 여기서 걷기 시작하면 방향이 없다.
  if (!(Math.hypot(B.x - A.x, B.y - A.y) > 1e-6)) return [A, B];
  var h = s / 2;
  if (outline.kind === 'circle') {
    var r = outline.r, cx = outline.cx, cy = outline.cy;
    if (!(r > 1e-6)) return [A, B];
    var aA = Math.atan2(A.y - cy, A.x - cx), aB = Math.atan2(B.y - cy, B.x - cx);
    var dc = outwardDirCircle(r, cx, cy, aA, aB, L);
    // ★원엔 꼭짓점이 없다 ⇒ 걸릴 자리도 없다. 마그네틱을 «안» 건다.
    return [walkCircle(r, cx, cy, aA, dc, h), walkCircle(r, cx, cy, aB, -dc, h)];
  }
  var pts = outline.pts;
  var iA = nearestVertexIndex(pts, A), iB = nearestVertexIndex(pts, B);
  if (iA === iB) return [A, B];
  var dp = outwardDirPoly(pts, iA, iB, L);
  return [walkPolygon(pts, iA, dp, magneticDist(pts, iA, dp, h, mag)),
          walkPolygon(pts, iB, -dp, magneticDist(pts, iB, -dp, h, mag))];
}
/* ═══════════════════════════════════════════════════════════════════════════
   ★접선 규칙 — c·d 는 «광원 L» 이 아니라 «a·b 각자» 에서 그은 접점이다.
     현빈 승인 2026-09-09. 무엇이 틀렸었나:
       옛 판은 c·d 를 «광원에서» 잰 실루엣으로 뒀다. 그러면 사람이 a·b 를 끌었을 때
       c·d 가 «안 따라와서» 도형이 빔 옆선 «밖»으로 삐져나온다.
       ⇒ 기본 배치(rect 260×140, angle −90, length 170, narrow 62)에서도 8.4px 나갔다.
     ⇒ 옆선 a→c 가 도형의 «접선»이 되게 만든다. 접선이면 도형은 정의상 그 선 «안쪽»에 있다.

   ★어느 쪽 접점인가 — 접점은 늘 둘이다. 「축 L→도형중심 을 기준으로 P 와 «같은 편»」을 고른다.
     그래야 a 쪽 옆선이 a 쪽 모서리를 잡고, b 쪽이 b 쪽을 잡아 빔이 «안 꼬인다».
     둘 다 같은 편이면(동률) «상대 점에서 먼» 쪽 — 그래야 빔이 넓게 열린다.
     ⚠️동률 가지는 장식이 아니다: rect·square × 회전24 × 광원24 × narrow5 격자에서 3,860번 실제로 탄다.

   ★★sg===0 처방 — 빼면 출시가 막힌다.
     좁아짐 100% ⇒ k=0 ⇒ a==b==L ⇒ cross(L,중심,P)=0 ⇒ 동률 가지에서 «상대»가 자기 자신 ⇒
     c==d ⇒ shadowVisible 이 |d−c|>1e-6 로 걸러 «줌 이펙트를 통째로 안 그린다».
     실측(rect·square × 회전24 × 광원24, size 260, length 250):
       narrow 0·50·95·99 → 사라짐 0/1152 · ★narrow 100 → 1152/1152 (100%)  ← 벼랑이다
     처방(sg===0 이면 실루엣으로 떨어진다)을 넣으면 narrow 100 에서도 0/1152. 검사 T4 가 못박는다.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 선분 p→q 를 기준으로 P 가 «어느 쪽»인가(부호). 0 이면 셋이 한 줄 위다.
 *  ⛔여기 나오는 «0» 은 셋 다 뜻이 있다 — 아무 데서나 «어느 편»으로 삼키지 마라(검사 T8 이 못박는다):
 *    ⑴ 잡는 점 P 가 축 위  ⇒ 접선이 «양쪽 다» 이므로 처방(sg===0 → 실루엣)으로 떨어진다
 *    ⑵ 후보 q 가 축 위      ⇒ 그 후보는 «어느 편도 아니다» ⇒ 같은 편 고르기에서 «빠진다»
 *    ⑶ 기준점 ZERO 가 도형 중심이 «아니면» ⑴⑵ 의 0 이 통째로 사라진다 ⇒ 리터럴 {0,0} 이어야 한다 */
export function crossSide(p, q, P) {
  return (q.x - p.x) * (P.y - p.y) - (q.y - p.y) * (P.x - p.x);
}

/**
 * 점 P 에서 outline 에 그은 접점 중 «축 L→중심» 기준 P 와 같은 편의 것.
 * @param {object} outline {kind:'poly', pts} | {kind:'circle', r, cx, cy} — ★테두리 포함 판
 * @param {object} P     접선을 긋는 자리(= a 또는 b)
 * @param {object} L     축(= 사람이 끈 빛 || mid(a,b))
 * @param {object} other 반대편 점(= b 또는 a) — 동률일 때 «먼 쪽»을 고르는 자
 * @param {[object,object]} sil 광원 실루엣 — ★sg===0 처방의 착지점
 * @param {number} which 0|1 — sil 의 어느 쪽으로 떨어질지
 */
export function tangentAt(outline, P, L, other, sil, which) {
  var sg = Math.sign(crossSide(L, ZERO, P));
  if (sg === 0) return sil[which];              // ★처방 — 위 주석 참조. 빼면 narrow 100 이 사라진다
  var two = (outline.kind === 'circle')
    ? silhouetteCircle(outline.r, P, outline.cx, outline.cy)
    : silhouetteFromPts(outline.pts, P, 0, 0);
  /* ★Math.sign 이어야 한다 — `> 0 ? 1 : -1` 로 쓰면 «축 위 후보»(0)가 −1 편으로 «삼켜져»
     엉뚱한 접점이 뽑힌다. 정사각형 꼭짓점이 광원 축 위에 놓이는 배치에서 실제로 갈린다(검사 T8-ⓑ). */
  var same = two.filter(function (q) { return Math.sign(crossSide(L, ZERO, q)) === sg; });
  if (same.length === 1) return same[0];
  return _dist(two[0], other) > _dist(two[1], other) ? two[0] : two[1];
}

/* ★도형 «중심». 축(L→중심)의 기준점이라 리터럴 {0,0} 이어야 한다 — 1e-12 만 밀어도
   crossSide 의 «정확히 0»(축 위)이 통째로 사라져 접점 고르기가 갈린다(검사 T8-ⓐ). */
const ZERO = { x: 0, y: 0 };
function _dist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }

/* a·b 자동값: A·B 를 광원 쪽으로 좁혀서.
   mid=(A+B)/2, k=1-narrow/100 → 짧은 변은 «광원 위에» 중심을 두고 AB 폭의 k 배가 된다. */
export function autoShortEdge(A, B, L, narrow) {
  var mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  var k = 1 - (Number(narrow) || 0) / 100;
  return [{ x: L.x + (A.x - mid.x) * k, y: L.y + (A.y - mid.y) * k },
          { x: L.x + (B.x - mid.x) * k, y: L.y + (B.y - mid.y) * k }];
}

/* ★손잡이 좌표의 상한 — 도형 중심에서 이만큼까지만 받는다(px).
   ⛔없으면 dataset 이 lx/ly=99999 를 들고 올 때 SVG 가 100206×100124 로 부풀고,
     ★선택 중에는 `.zoom-block.selected > .zoom-clip { clip-path: none }` 이라 그 거대한 층이
     «옆 섹션 위를 덮는다»(css/editor-blocks.css:2827). NaN 은 안 나지만 화면이 가려진다.
   ★2000 을 고른 근거: 「길이」 슬라이더 최대가 1200 이다(prop-zoom.js). UI 가 스스로 만들 수 있는
     가장 먼 빛보다 66% 넉넉하고, 그래도 SVG 는 4000px 대에서 멈춘다.
   ⛔«읽기»(readPinnedShortEdge)에서 자르지 않는다 — 저장본의 값을 조용히 고쳐 쓰면 안 된다.
     여기서 «쓸 때만» 조인다: 저장본은 그대로, 화면만 안전하다. */
export const ZOOM_PIN_REACH = 2000;

/** 사람이 끈 점을 상한 안으로. 축이 mid(a,b) 라 a·b 를 조이면 L 도 따라 조여진다. */
export function clampPin(P) {
  if (!P || !Number.isFinite(P.x) || !Number.isFinite(P.y)) return P;
  const R = ZOOM_PIN_REACH;
  return { x: Math.max(-R, Math.min(R, P.x)), y: Math.max(-R, Math.min(R, P.y)) };
}

/** 광원 L — 도형 중심에서 «방향 각도»로 «길이» 만큼 떨어진 점. */
export function lightPoint(angle, length, cx, cy) {
  var th = (Number(angle) || 0) * Math.PI / 180;
  var len = Number(length) || 0;
  return { x: cx + Math.cos(th) * len, y: cy + Math.sin(th) * len };
}

/** 모든 좌표가 유한한지 — 퇴화(광원이 도형 안 등)로 NaN 이 새면 SVG 가 통째로 깨진다. */
export function allFinite(pts) {
  return pts.every(function (p) { return p && Number.isFinite(p.x) && Number.isFinite(p.y); });
}

/**
 * 한 번에 기하 전부 — 렌더가 «계산»을 하지 않게 한다(같은 산식이 두 군데 생기는 것을 막음).
 *
 * ★순서가 곧 규칙이다(현빈 승인 2026-09-09) — 손잡이 «셋»(빛 L · a · b):
 *   ⑴ L0   = 사람이 끈 빛(pinned.L) || lightPoint(angle, length)
 *   ⑵ sil  = 그 L0 에서 본 실루엣            ← ★손잡이의 «자동값»을 만들려고만 쓴다
 *   ⑶ auto = autoShortEdge(sil, L0, narrow)
 *   ⑷ a·b  = 사람이 끈 값 || auto
 *   ⑸ L    = pinned.L || mid(a,b)            ★축이자 «빛» 표시 위치
 *   ⑹ c·d  = tangentAt(...)                  ★a·b 각자에서 그은 접선
 *   ⑺ 벌리기는 «그대로» — 그 뒤에 applySpreadAlongOutline 을 c·d 에 건다
 *
 * ⛔⑸ 를 「L = lightPoint」로 되돌리면 사람이 a·b 를 끌 때 축이 안 따라와 빔이 꼬인다(검사 T1·T5).
 *
 * @param {object} st  {shape,angle,length,spread,maxop,curve,narrow,size,rot}
 * @param {?object} pinned  {a?:{x,y}, b?:{x,y}, L?:{x,y}} — 사람이 «끈» 것. ★셋이 따로 온다.
 *   (a·b 는 한 묶음이고 L 은 «따로» — 옛 저장본은 ax/ay/bx/by 만 갖고 있다. 하위호환.)
 */
export function computeZoomGeometry(st, pinned) {
  /* ★실루엣 = «보이는 바깥 윤곽»이다 (지디 판정 2026-09-08).
       ⑴ 물리적으로 — 빛은 테두리에도 막힌다. 링이 있는데 그림자가 그 «안»에서 나오면 링이 떠 보인다.
       ⑵ 사용자 눈에 테두리는 «그 도형의 일부»다.
     ⛔bd==='off' 면 bw=0 이라 도형 실루엣 그대로다 — 예전 동작이 그대로 남는다.
     ⚠️알려진 한계: bdr(모서리 라운드)은 실루엣에 «안» 들어간다(꼭짓점 기준). 라운드가 크면
       사다리꼴 붙는 점이 모서리에서 살짝 뜬다 — 지디 판단으로 지금은 안 고친다. */
  var hw = shapeHalf(st).hw;
  var bw = borderWidthOf(st);
  var lPin = (pinned && pinned.L) ? clampPin(pinned.L) : null;
  var L0 = lPin || lightPoint(st.angle, st.length, 0, 0);          // ⑴
  /* ★실루엣과 «둘레»가 «같은 점 목록»을 쓴다 — 두 군데서 다르게 계산하면 벌림이
     윤곽에서 미세하게 떠 버린다(테두리 두께 bw 가 들어간 판이 정본이다).
     ⛔접선(tangentAt)도 «이 판»을 그대로 받는다 — 테두리 없는 판으로 재면 링이 어긋난다. */
  var outline = (st.shape === 'circle')
    ? { kind: 'circle', r: hw + bw, cx: 0, cy: 0 }
    : { kind: 'poly', pts: shapeCornerPts(st, bw) };
  var sil = (st.shape === 'circle')                                // ⑵
    ? silhouetteCircle(outline.r, L0, 0, 0)
    : silhouetteFromPts(outline.pts, L0, 0, 0);
  var auto = autoShortEdge(sil[0], sil[1], L0, st.narrow);         // ⑶
  var a = (pinned && pinned.a) ? clampPin(pinned.a) : auto[0];      // ⑷ ★상한은 여기서만 건다
  var b = (pinned && pinned.b) ? clampPin(pinned.b) : auto[1];
  var L = lPin || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };      // ⑸ ★축 = 짧은 변의 한가운데
  var c = tangentAt(outline, a, L, b, sil, 0);                     // ⑹
  var d = tangentAt(outline, b, L, a, sil, 1);
  /* ★★벌림은 «양(陽)만» — 현빈 2026-09-09 「벌림 음수 안 되게 양(陽) 간만」.
       패널 슬라이더 하한을 0 으로 올렸다(prop-zoom.js). 그런데 ★«이미 저장된» 음수가 있다 —
       슬라이더가 −400..800 이던 시절의 프로젝트다. 그 값은 «도메인 밖»이 됐으므로
       읽는 자리에서 기본값(0)으로 떨어뜨린다.
     ★왜 «자르는» 쪽을 골랐나 — 셋이다:
       ① 집 관용구다. zoom-block.js 의 _onOff · _dropShadow 가 이미 같은 규율로 산다 —
          「모르는 값이 들어오면 기본으로 떨어뜨린다(저장본 변조 대비)」. 새 방식을 안 만든다.
       ② 음수는 «진짜로 깨진다» — tests/unit/zoom-tangent.test.mjs T14 의 실측:
          광원이 도형 «밖»인 60,672칸 중 −30 에서 6,774칸이 「삐져나감 ≤ |s|/2」를 깨고
          (최대 128.55px), −400 에서 7,461칸(389.95px). 양수와 달리 「광원이 도형 안」으로
          설명되는 칸이 0 이다 — 계약 밖의 그림이지 «사람이 고른 모양»이 아니다.
       ③ 패널과 화면이 «같은 말»을 하게 된다. 패널은 0 을 보여 주는데 캔버스만 −30 으로
          그리면 그게 바로 «조용히 깨진» 상태다.
     ⛔저장본은 «한 글자도» 안 고친다 — dataset.spread 는 −30 으로 그대로 남는다.
       읽는 자리에서만 떨어뜨린다 ⇒ 결정이 뒤집히면 그 값이 그대로 살아나온다.
     ⛔applySpreadAlongOutline 안에서 자르지 않는다 — 그건 «원시 부품»이고, 거기서 잘라 버리면
       «잘라서 같아진 것»을 드러낼 양성대조가 사라진다(T14 가 그것으로 잰다). */
  var spread = Math.max(0, Number(st.spread) || 0);
  var sp = applySpreadAlongOutline(outline, c, d, L, spread, zoomMagnet(st));   // ⑺
  var A = sp[0], B = sp[1];
  return { L: L, A: A, B: B, a: a, b: b, autoA: auto[0], autoB: auto[1], c: c, d: d, r: hw, bw: bw };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SVG 조립 — ★여기도 «순수»다.
   렌더 문자열을 zoom-block.js 에 두면 검사가 「기하는 실행으로, 그림은 눈으로」로 갈린다.
   여기 두면 검사가 «실제로 나가는 마크업»을 그대로 받아 잴 수 있다.
   ═══════════════════════════════════════════════════════════════════════════ */

export const ZOOM_PAD = 14;        // 뷰박스 여백(px)
export const ZOOM_HANDLE_R = 5;    // 손잡이(L·a·b) 반지름(px)

/* 색을 마크업에 넣기 전 거른다 — 색 문자열로 태그가 끼어들 자리를 아예 없앤다.
   허용: #hex · rgb()/rgba()/hsl()/hsla() · CSS 변수 · 이름색. 걸리면 fallback. */
export function safeColor(v, fallback) {
  const s = String(v ?? '').trim();
  return /^[#a-zA-Z0-9(),.%\s_-]{1,64}$/.test(s) ? s : fallback;
}

/**
 * 도형의 «반치수» — ★여기가 크기의 단 하나의 출처다.
 *
 * ★왜 size 하나로 안 되나 (현빈 2026-09-08 「아웃라인으로 핸들로 높이와 너비 조절」):
 *   핸들은 가로·세로를 «따로» 끈다. size 는 «한 수»라 그걸 못 담는다.
 *   ⇒ w/h 를 «덧씌우개»로 둔다. 이건 a·b 의 자동/고정과 «같은 구조»다:
 *       기본 = size + 프리셋 비율에서 «파생»   ·   사람이 끌면 = w/h 가 «이긴다»
 *   ⛔프리셋(shape)을 바꾸거나 size 슬라이더를 움직이면 w/h 를 «지운다» — 안 지우면
 *     비율을 바꿔도 안 따라와서 프리셋이 프리셋 구실을 못 한다(a·b 에서 겪은 그 병).
 * ★rect 비율(1.6:1)과의 공존: w/h 가 «없을 때만» ZOOM_RECT_RATIO 가 세로를 만든다.
 *   w 만 있으면 square/circle 은 정비율(hh=hw), rect 는 여전히 비율로 세로를 만든다.
 * ⚠️circle 은 hw≠hh 를 «못 그린다»(silhouetteCircle 이 정원 전제). ⇒ 쓰는 쪽(핸들·패널)이
 *   circle 일 때 w=h 로 맞춰서 쓴다. 여기서는 h 가 없으면 hh=hw 로 떨어뜨려 정원을 지킨다.
 */
export function shapeHalf(st) {
  const half = (Number(st.size) || 0) / 2;
  const wv = Number(st.w), hv = Number(st.h);
  const hw = (Number.isFinite(wv) && wv > 0) ? wv / 2 : half;
  const hh = (Number.isFinite(hv) && hv > 0) ? hv / 2
           : (st.shape === 'rect' ? half * ZOOM_RECT_RATIO : hw);
  return { hw, hh };
}

/* 도형 하나를 그린다. grow>0 이면 «바깥으로» 그만큼 키운 판(=테두리)이다.
   ★rect/square 는 polygon 이 아니라 <rect rx>+rotate 로 그린다 — 모서리 라운드(bdr)를
     회전과 «같이» 쓰려면 그 길뿐이다. 실루엣 계산은 그대로 꼭짓점을 쓴다. */
function shapeEl(st, grow, fill, cls) {
  const { hw, hh } = shapeHalf(st);
  const bdr = Math.max(0, Number(st.bdr) || 0);
  if (st.shape === 'circle') {
    return `<circle class="${cls}" cx="0" cy="0" r="${(hw + grow).toFixed(2)}" fill="${fill}"/>`;
  }
  const W = hw + grow, H = hh + grow;
  // ★테두리판의 모서리는 «도형 모서리 + 두께» 여야 링 두께가 어디서나 같다(동심 오프셋).
  const rx = grow > 0 ? (bdr > 0 ? bdr + grow : 0) : bdr;
  const rot = Number(st.rot) || 0;
  return `<rect class="${cls}" x="${(-W).toFixed(2)}" y="${(-H).toFixed(2)}" ` +
    `width="${(W * 2).toFixed(2)}" height="${(H * 2).toFixed(2)}" rx="${rx.toFixed(2)}"` +
    `${rot ? ` transform="rotate(${rot})"` : ''} fill="${fill}"/>`;
}

export function shapeMarkup(st) {
  /* ★체크패턴이면 도형은 «안 칠한다» — 배경은 DOM 층(.zoom-bg)이 CSS 로 그린다.
     이유: 체크 값의 정본은 css/editor-blocks.css 의 repeating-conic-gradient 하나여야 한다.
     SVG <pattern> 으로 베끼면 «같은 무늬가 두 군데»가 되어 갈라진다. */
  if (st.fill === ZOOM_CHECKER) return shapeEl(st, 0, 'none', 'zoom-shape');
  return shapeEl(st, 0, safeColor(st.fill, '#cfd6e0'), 'zoom-shape');
}

/* 테두리 — ⛔도형 «바깥»에 그린다(크기가 안 줄게).
   ★stroke 로 그리면 선이 «경계에 걸쳐» 반은 안쪽으로 먹어 도형이 줄어든다.
     그래서 stroke 가 아니라 «한 겹 큰 판»을 도형 뒤에 깔고 도형을 그 위에 얹는다.
   ★그림자와 배타가 아니다 — 둘 다 켤 수 있다. */
export function borderWidthOf(st) {
  return (st.bd === 'on') ? Math.max(0, Number(st.bdw) || 0) : 0;
}

export function borderMarkup(st) {
  const bw = borderWidthOf(st);
  if (!(bw > 0)) return '';
  return shapeEl(st, bw, safeColor(st.bdc, '#ffffff'), 'zoom-border');
}

/** rect/square 의 «실제» 꼭짓점. grow 를 각 반치수에 «따로» 더한다(비율로 키우지 않는다). */
export function shapeCornerPts(st, grow) {
  const { hw, hh } = shapeHalf(st);
  const W = hw + grow, H = hh + grow;
  const th = (Number(st.rot) || 0) * Math.PI / 180;
  const co = Math.cos(th), si = Math.sin(th);
  return [[-W, -H], [W, -H], [W, H], [-W, H]]
    .map(p => ({ x: p[0] * co - p[1] * si, y: p[0] * si + p[1] * co }));
}

/** 도형(+테두리)이 차지하는 «실제» 꼭짓점 — 뷰박스가 이걸 담아야 테두리가 안 잘린다. */
export function outerExtentPts(st) {
  const bw = borderWidthOf(st);
  const { hw } = shapeHalf(st);
  if (st.shape === 'circle') {
    const R = hw + bw;
    return [{ x: -R, y: -R }, { x: R, y: R }];
  }
  return shapeCornerPts(st, bw);
}

/** 뷰박스 상자 — 조립기와 «선택 상자»가 같은 좌표계를 봐야 해서 한 자리로 뽑았다. */
export function zoomBox(st, pinned) {
  const geo = computeZoomGeometry(st, pinned);
  const ok = shadowVisible(st, geo);
  /* ★손잡이가 남는 경우(띠는 퇴화했는데 이펙트는 켜져 있는 경우)에도 상자가 a·b·L 을 담아야 한다.
     안 담으면 손잡이가 뷰박스 «밖»에 그려져 잘린다 = 사라진 것과 같다. */
  const hv = handlesVisible(st, geo);
  const pts = [
    ...outerExtentPts(st),
    ...(ok ? [geo.A, geo.B] : []),
    ...(ok || hv ? [geo.a, geo.b, geo.L] : []),
  ];
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs) - ZOOM_PAD, maxX = Math.max(...xs) + ZOOM_PAD;
  const minY = Math.min(...ys) - ZOOM_PAD, maxY = Math.max(...ys) + ZOOM_PAD;
  return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY), geo, ok, handles: hv };
}

/* 그림자를 실제로 그리는가 — 세 갈래를 «한 자리»에 모은다.
   ① 라디오가 꺼졌다 ② 좌표가 샌다(NaN) ③ A·B 가 «한 점»이다(광원이 도형 안).
   ③ 은 NaN 이 아니라서 ②만 보면 통과해 버리고, 넓이 0 인 띠가 64장 «조용히» 쌓인다
   (검사 ⓐ-13 이 실제로 이걸 잡았다 — 눈으로는 안 보이는 결함이다). */
export function shadowVisible(st, geo) {
  if (st.shadow === 'off') return false;
  if (!allFinite([geo.A, geo.B, geo.a, geo.b, geo.L])) return false;
  return Math.hypot(geo.B.x - geo.A.x, geo.B.y - geo.A.y) > 1e-6;
}

/* ★★손잡이를 그리나 — 「줌 이펙트를 «켰나»」로만 정한다. ⛔띠가 보이는가와 «따로»다.
     한때 손잡이가 shadowVisible 을 따라갔다. 그래서 이런 일이 났다(적대적 검수 2026-09-09):
       원(r=130)에서 빨간 빛 손잡이를 도형 «안»으로 끌면 d ≤ r+0.5 로 실루엣이 퇴화하고
       A==B 가 되어 shadowVisible 이 false ⇒ ★«방금 끌던 그 점이 커서 밑에서 사라졌다».
       화면에 다시 집을 것이 없어 우측 패널로만 되돌릴 수 있었다.
     ⛔게다가 rect·square 는 같은 조작에서 «안 사라지고» 깨진 빔을 그렸다 — 같은 손짓에
       프리셋마다 결과가 달랐다.
   ⇒ 띠가 안 보여도 손잡이는 남긴다. ★사람이 되돌릴 «탈출구»가 화면에 있어야 한다.
   ⛔「광원이 도형 안일 때 기하를 어떻게 할지」는 손대지 않았다 — 그건 현빈 결정 대기다.
      여기서 고친 것은 «탈출구가 사라지는 것» 하나뿐이다. */
export function handlesVisible(st, geo) {
  if (st.shadow === 'off') return false;          // 이펙트를 끈 것 = 스티커. 손잡이가 없다
  return allFinite([geo.a, geo.b, geo.L]);
}

/**
 * ★블록 «자신»의 상자 — 확대블럭은 스티커 계열(플로팅)이라 블록 상자가 곧 도형 상자다.
 *
 * ⛔예전엔 블록이 행(row) 안에 흐름으로 들어가 «행 전체 폭»이었고, 그래서 아웃라인이 도형과
 *   아무 상관 없는 네모로 떴다. 그때 처방을 「보이지 않는 선택상자(.zoom-sel-box)를 하나 더 둔다」로
 *   했는데, ★원인은 그게 아니라 «계열»이었다(현빈 2026-09-08: 「스티커 블럭인데 왜 블럭 안에 있어?
 *   플로팅되어야 되는 거 아냐?」). 플로팅으로 옮기니 블록 상자가 도형 상자가 되어
 *   선택 오버레이(_geomOf)가 «블록의 border-radius»를 그대로 읽는다 — 보조 상자가 필요 없어졌다.
 *   ⇒ 증상을 우회하지 말고 «왜 그 상태인가»를 한 겹 더 물었어야 했다.
 *
 * 상자는 «테두리를 포함»한다 — 아웃라인도 핸들도 테두리 바깥을 따른다(그림자와 같은 축).
 */
export function blockBoxSpec(st) {
  const bw = borderWidthOf(st);
  const circle = st.shape === 'circle';
  const half = shapeHalf(st);
  const hw = half.hw + bw;
  const hh = (circle ? half.hw : half.hh) + bw;
  const bdr = Math.max(0, Number(st.bdr) || 0);
  return {
    w: hw * 2, h: hh * 2,
    radius: circle ? '50%' : ((bdr > 0 ? bdr + bw : 0).toFixed(2) + 'px'),
    rot: circle ? 0 : (Number(st.rot) || 0),   // 원은 돌려도 같은 모양이다
  };
}

/** SVG 를 블록 «안»에 놓는 오프셋 — 도형 중심(뷰박스 0,0)을 블록 중심에 맞춘다.
 *  그림자는 블록 밖으로 삐져나간다(overflow:visible). 플로팅이라 아무것도 밀리지 않는다. */
export function svgOffset(st, pinned) {
  const box = zoomBox(st, pinned);
  const b = blockBoxSpec(st);
  return { left: b.w / 2 + box.minX, top: b.h / 2 + box.minY };
}

/* URL 을 마크업에 넣기 전 거른다 — 따옴표로 속성을 깨고 나오는 자리를 없앤다.
   ⛔허용: data: · goya-asset: · blob: · http(s): · 상대경로. 그 밖이면 «안 넣는다»(빈 문자열). */
export function safeImgSrc(v) {
  const u = String(v ?? '').trim();
  if (!u) return '';
  if (/["'<>\s]/.test(u)) return '';                       // 따옴표·꺾쇠·공백은 통째로 거른다
  return /^(data:image\/|goya-asset:|blob:|https?:|\.{0,2}\/)/.test(u) ? u : '';
}

/** 도형 층에 «이미지가» 있나 — 체크패턴을 끄는 판정과 같은 자리에서 쓴다. */
export function hasZoomImage(st) {
  return !!safeImgSrc(st.imgSrc);
}

/* 도형 «안»을 채우는 층 — 체크패턴 또는 이미지. «도형» 상자다(테두리 제외).
   ★현빈 2026-09-08: 「이미지를 넣으면 에셋블럭처럼 도형이라는 프레임 «안»에서 나오니
     도형이랑 같은 거 아닌가?」 ⇒ 맞다. 바깥 윤곽은 여전히 «도형»이라 ★기하가 한 줄도 안 바뀐다.
   ⛔이미지를 «블록»에 직접 넣으면 안 된다 — 블록은 그림자가 나가야 해서 안 자르는데,
     자르려고 overflow 를 걸면 «그림자까지» 잘린다. 그래서 도형 크기·도형 모서리를 가진
     이 층 안에 넣고 여기서만 자른다.
   ⛔이미지가 들어오면 체크무늬를 «없앤다» — 투명 PNG 의 투명부로 체크가 비쳐 Export PNG 에
     박히던 버그(현빈 실제 경험, .icon-circle-block.has-image 전례). CSS 가 .has-image 로 끈다.
   ★좌표는 «클리핑 층» 기준(off 만큼 되민다). */
export function bgMarkup(st, pinned) {
  const img = safeImgSrc(st.imgSrc);
  if (st.fill !== ZOOM_CHECKER && !img) return '';
  const bw = borderWidthOf(st);
  const half = shapeHalf(st);
  const bdr = Math.max(0, Number(st.bdr) || 0);
  const hw = half.hw, hh = (st.shape === 'circle') ? half.hw : half.hh;
  const o = svgOffset(st, pinned);
  const rot = (st.shape === 'circle') ? 0 : (Number(st.rot) || 0);
  const radius = st.shape === 'circle' ? '50%' : bdr.toFixed(2) + 'px';
  const inner = img ? `<img class="zoom-img" src="${img}" draggable="false">` : '';
  return `<div class="zoom-bg" style="left:${(bw - o.left).toFixed(2)}px;top:${(bw - o.top).toFixed(2)}px;` +
    `width:${(hw * 2).toFixed(2)}px;height:${(hh * 2).toFixed(2)}px;border-radius:${radius};` +
    (rot ? `transform:rotate(${rot}deg);` : '') + `">${inner}</div>`;
}

/* a·b 핸들 — ★별도 층이다.
   ★picked('a'|'b'|null) = 사람이 «집은» 앵커. 어도비 일러스트 관례대로 «채움»만 바뀐다
     (안 집힌 것 = 흰 채움 · 집힌 것 = 파란 채움, 테두리 색은 둘 다 같다 — 현빈이 준 그림 그대로).
   ⛔이 상태는 dataset 이 아니라 «JS 속성»으로 온다 — 저장본(캔버스 HTML 스냅샷)에 실리면
     안 되는 «조작 중» 상태다(section-serialize 가 임시 클래스를 털어내는 것과 같은 이유). */
/** 손잡이 층 — ★별도 층이다. 체크 배경이 SVG 위에 올라오므로 손잡이가 그 «위»에 있어야 한다.
 *
 * ★손잡이는 «셋»이다(현빈 승인 2026-09-09):
 *   L(빛, 빨강) — 짧은 변을 «통째로» 옮긴다. 지금 「방향°·길이」 슬라이더가 하던 일과 같다.
 *   a·b(보라)   — 각자 벌린다.
 * ⛔L 을 «마지막»에 그린다 = 맨 위. 좁아짐 100% 면 셋이 «한 점»에 겹치는데, 그때 사람이
 *   집어야 하는 것은 「통째로 옮기기」다(a 하나만 끌면 짧은 변이 한쪽으로 찌그러진다).
 * ⛔색은 CSS 가 정한다(css/editor-blocks.css 의 .zoom-handle[data-pt="L"]) — 여기 리터럴을 쓰지 마라. */
export function handleLayerMarkup(st, pinned, picked) {
  const box = zoomBox(st, pinned);
  if (!box.handles) return '';        // ★box.ok 가 «아니다» — 위 handlesVisible 주석 참조
  const geo = box.geo;
  const dot = (pt, P) =>
    `<circle class="zoom-handle" data-pt="${pt}"${picked === pt ? ' data-picked="true"' : ''} ` +
    `cx="${P.x.toFixed(2)}" cy="${P.y.toFixed(2)}" r="${ZOOM_HANDLE_R}"/>`;
  return `<svg class="zoom-handle-layer" ` +
    `width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" ` +
    `viewBox="${box.minX.toFixed(2)} ${box.minY.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    dot('a', geo.a) + dot('b', geo.b) + dot('L', geo.L) +
    `</svg>`;
}

/** 블록 안에 들어가는 것 전부.
 *  ★쌓는 순서 = 그림자·테두리·도형(SVG) → 체크배경 → a·b 핸들.
 *    체크가 SVG «위»인 이유: 테두리판은 «도형보다 큰 판»이라 SVG 안에서 도형 자리를 덮는다.
 *    아래 깔면 테두리를 켠 순간 체크가 사라진다. 그래서 핸들도 체크 «뒤»로 뒀다.
 *
 *  ★★.zoom-clip = «섹션 밖 크롭»(--sec-clip)을 받는 층이다. 왜 층을 따로 두나:
 *    스티커 계열의 규약은 `.sticker-block { clip-path: var(--sec-clip, none) }` 인데,
 *    확대블럭에 그걸 «블록»에 걸면 두 번 틀린다 —
 *      ① --sec-clip 은 «블록 자기 상자»가 섹션 밖으로 나간 만큼만 계산한다(sticker-block.js).
 *         확대블럭은 블록 상자(도형)가 섹션 «안»인데 그림자가 나간다 ⇒ 값이 0 이라 «안 잘린다».
 *      ② 값이 붙는 순간엔 clip-path 의 기준 상자가 «블록 border-box»(=도형)라
 *         그림자가 도형 경계에서 «통째로» 잘린다.
 *    ⇒ 그려지는 것 전부를 감싸는 층(=SVG 상자)을 두고 «그 층»에 클립을 건다.
 *      그러면 인셋이 전부 0 이상이고, 기준 상자가 «그려지는 영역»과 같다.
 *    ⛔블록 상자는 여전히 도형(+테두리)이다 — 아웃라인·핸들은 그대로다. */
export function buildZoomInner(st, pinned, picked) {
  const box = zoomBox(st, pinned);
  const off = svgOffset(st, pinned);
  return `<div class="zoom-clip" style="left:${off.left.toFixed(2)}px;top:${off.top.toFixed(2)}px;` +
    `width:${box.w.toFixed(2)}px;height:${box.h.toFixed(2)}px;">` +
    `${buildZoomSvg(st, pinned)}${bgMarkup(st, pinned)}${handleLayerMarkup(st, pinned, picked)}</div>`;
}

export function buildZoomSvg(st, pinned) {
  const box = zoomBox(st, pinned);
  const geo = box.geo, ok = box.ok;

  const shadow = ok
    ? strips(geo.A, geo.B, geo.a, geo.b, ZOOM_STRIP_COUNT, (Number(st.curve) || 100) / 100, (Number(st.maxop) || 0) / 100)
    : '';

  return `<svg class="zoom-svg" ` +
    `width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" ` +
    `viewBox="${box.minX.toFixed(2)} ${box.minY.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `<g class="zoom-shadow">${shadow}</g>${borderMarkup(st)}${shapeMarkup(st)}</svg>`;
}
