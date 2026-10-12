/* graph-pie-geom.js — 원형·도넛 그래프 조각 기하의 «한 자리» (1012t1G1 · 2026-10-12).
 * 순수 함수 하나: 값 목록 + 구멍 비율(%) → 조각마다 SVG path 의 d 문자열. DOM·window 를 안 읽는다 ⇒ 유닛(node)과 렌더러(브라우저)가 «같은 식»을 쓴다.
 * 싣는 길은 graph-limits.js 와 같다 — drag-utils.js 가 side-effect import 해 window.GRAPH_PIE_GEOM 을 받고, 유닛은 require.
 *
 * 규약
 *   · 좌표: viewBox 0 0 1000 1000 · 중심 (500,500) · 바깥 반지름 500 · 12시에서 시작해 «시계 방향».
 *   · 값 가드: Number(v) 가 유한하지 않거나 0 이하면 0 으로 본다(음수·NaN·글자·null 전부).
 *   · 값 0 인 조각의 d 는 '' — 조각 «수»는 항목 수와 같게 둔다(색인 = 항목 순서 · 형제 순번 색 사다리가 안 밀린다).
 *   · 합 0(빈 배열 포함) → 모든 d 가 '' · empty: true (그리는 쪽이 빈 원을 대신 그린다).
 *   · 점유율이 온 원(≥ 0.9999 · 항목 하나 포함)이면 반원 둘로 그린다 — 시작점 = 끝점인 호 하나는 SVG 가 «안 그린다».
 *   · 구멍: holePct(바깥 반지름 대비 %) > 0 이면 고리 path 로 «실제로» 뚫는다(가운데를 바탕색 원으로 덮지 않는다 ⇒ 어떤 바탕 위에서도 뚫려 보인다).
 *     온 원 도넛은 바깥(시계)·안(반시계) 두 닫힌 길 — nonzero 채움에서 안쪽이 빈다.
 *   · 산출 문자열에 NaN·Infinity 가 들어갈 길이 없다(모든 수가 위 가드를 지난 유한값에서 나온다). */
(function (root) {
  var VIEW = 1000, C = 500, R = 500, FULL = 0.9999;
  var f = function (n) { return n.toFixed(2); };
  var pt = function (deg, rad) {   // 12시 = 0° · 시계 방향(SVG 는 y 가 아래로 자란다)
    var a = deg * Math.PI / 180;
    return f(C + rad * Math.sin(a)) + ' ' + f(C - rad * Math.cos(a));
  };
  var num = function (v) { var n = Number(v); return (Number.isFinite(n) && n > 0) ? n : 0; };
  var ring = function (rad, sweep) {   // 온 원 한 바퀴 = 반원 둘
    return 'M ' + pt(0, rad) + ' A ' + f(rad) + ' ' + f(rad) + ' 0 1 ' + sweep + ' ' + pt(180, rad)
      + ' A ' + f(rad) + ' ' + f(rad) + ' 0 1 ' + sweep + ' ' + pt(0, rad) + ' Z';
  };
  /** @param {Array} values 항목 값(아무 꼴) @param {number} holePct 구멍 비율 %(0 = 꽉 찬 원형)
   *  @returns {{ paths: string[], shares: number[], angles: number[][], total: number, empty: boolean, hole: number }} */
  function piePaths(values, holePct) {
    var vals = (Array.isArray(values) ? values : []).map(num);
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    var total = sum(vals);
    if (!Number.isFinite(total)) {   // 유한한 값끼리 더해 넘친 경우(1e308 둘) — 가장 큰 값으로 나눠 비율만 남긴다
      var mx = Math.max.apply(null, vals);
      vals = vals.map(function (v) { return v / mx; });
      total = sum(vals);
    }
    var h = Number(holePct);
    var hole = (Number.isFinite(h) && h > 0) ? Math.min(95, h) : 0;
    var r = R * hole / 100;
    var out = { paths: [], shares: [], angles: [], total: total, empty: !(total > 0), hole: hole };
    var acc = 0;
    vals.forEach(function (v) {
      var share = total > 0 ? v / total : 0;
      var a0 = acc * 360, a1 = (acc + share) * 360;
      acc += share;
      out.shares.push(share);
      out.angles.push([a0, a1]);
      if (!(share > 0)) { out.paths.push(''); return; }
      if (share >= FULL) { out.paths.push(ring(R, 1) + (r > 0 ? ' ' + ring(r, 0) : '')); return; }
      var large = (a1 - a0) > 180 ? 1 : 0;
      var arcOut = 'A ' + f(R) + ' ' + f(R) + ' 0 ' + large + ' 1 ' + pt(a1, R);
      out.paths.push(r > 0
        ? 'M ' + pt(a0, R) + ' ' + arcOut + ' L ' + pt(a1, r) + ' A ' + f(r) + ' ' + f(r) + ' 0 ' + large + ' 0 ' + pt(a0, r) + ' Z'
        : 'M ' + f(C) + ' ' + f(C) + ' L ' + pt(a0, R) + ' ' + arcOut + ' Z');
    });
    return out;
  }
  var GRAPH_PIE_GEOM = Object.freeze({ piePaths: piePaths, VIEW: VIEW, CENTER: C, RADIUS: R });
  if (typeof module !== 'undefined' && module.exports) module.exports = GRAPH_PIE_GEOM;
  if (root) root.GRAPH_PIE_GEOM = GRAPH_PIE_GEOM;
})(typeof window !== 'undefined' ? window : null);
