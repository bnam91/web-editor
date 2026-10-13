/* graph-pie-geom.js — 원형·도넛 그래프 조각 기하의 «한 자리» (1012t1G1 · 2026-10-12).
 * 순수 함수 둘: piePaths(값 목록 + 구멍 비율 % + 틈) → 조각마다 SVG path 의 d 문자열 · piePercents(값 목록) → 합이 100 인 정수 %. DOM·window 를 안 읽는다 ⇒ 유닛(node)과 렌더러(브라우저)가 «같은 식»을 쓴다.
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
 *   · 틈: gap(viewBox 단위) > 0 이고 값 있는 조각이 둘 이상이면 조각의 두 변을 평행하게 안으로 민다(바탕색 선을 덧칠하지 않는다 ⇒ 어떤 바탕 위에서도 틈).
 *   · 시작 각도(1013t1C2): opts.start(도 · 12시 = 0 · 시계 방향)만큼 첫 조각의 시작을 돌린다. 유한하지 않으면 0 · 360 으로 접는다(450 ≡ 90 · −90 ≡ 270).
 *     opts 를 안 주거나 start 가 0 이면 산출이 옛 판과 «바이트가 같다»(0 + x 는 x 와 같은 부동소수).
 *   · 조각 크기(1013t1C4): opts.grow[i](바깥 반지름에 더하는 %)만큼 «그 조각의 바깥 반지름만» 키운다 — Ro_i = R × (1 + grow_i / 100). 구멍 반지름은 모든 조각이 같다.
 *     키운 조각은 viewBox(0~1000) 밖으로 나간다 ⇒ extent(가장 멀리 나간 길이 · viewBox 단위)를 같이 돌려준다 — 그리는 쪽이 viewBox 를 그만큼 넓힌다.
 *     grow 가 없거나 0 이면 그 조각의 d 는 옛 판과 «바이트가 같다»(Ro === R). 값 0 조각의 grow 는 안 센다. 유한하지 않거나 음수면 0 · 100 에서 잘린다.
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
  /* 값 목록 → 가드를 지난 값들과 합. 유한한 값끼리 더해 넘친 경우(1e308 둘)는 가장 큰 값으로 나눠 «비율만» 남긴다 — piePaths · piePercents 가 같이 쓴다. */
  var norm = function (values) {
    var vals = (Array.isArray(values) ? values : []).map(num);
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    var total = sum(vals);
    if (!Number.isFinite(total)) {
      var mx = Math.max.apply(null, vals);
      vals = vals.map(function (v) { return v / mx; });
      total = sum(vals);
    }
    return { vals: vals, total: total };
  };
  /* 틈 있는 조각 하나(1012t1G1 고침 D1) — 조각의 두 변을 «반지름 방향과 평행하게» h 만큼 안으로 민다 ⇒ 이웃 조각과의 틈 폭이 중심에서 가장자리까지 일정하다
   *   (각도로 깎으면 안쪽이 좁아진다). 반지름 rad 인 원과 민 변이 만나는 각 = 변의 각 ± asin(h / rad).
   *   · 볼록(180° 이하): 두 변이 만나는 꼭짓점 = 이등분선 위 h / sin(폭/2). 구멍이 그 꼭짓점보다 안쪽이면 구멍은 틈에 묻힌다 ⇒ 꼭짓점 꼴.
   *   · 오목(180° 초과): 중심 둘레를 반지름 h 의 호로 돈다(두 변을 꼭짓점까지 늘이면 중심 «너머»로 홈이 파인다). */
  var gapSlice = function (a0, a1, r, h, Ro) {   // Ro = 이 조각의 바깥 반지름(1013t1C4 — 안 키웠으면 R 그대로)
    var span = a1 - a0, deg = 180 / Math.PI;
    if (!(span > 0)) return '';   // 점유율은 양수인데 각 폭이 부동소수에서 0 으로 접힌 조각(1e17 : 1) — 그릴 폭이 없다(아래 꼭짓점 식이 0/0 = NaN 이 된다 · 1013t1C4 U14 가 잡았다)
    var dR = Math.asin(h / Ro) * deg;
    var o0 = a0 + dR, o1 = a1 - dR;
    var head = pt(o0, Ro) + ' A ' + f(Ro) + ' ' + f(Ro) + ' 0 ' + ((o1 - o0) > 180 ? 1 : 0) + ' 1 ' + pt(o1, Ro);
    if (r > h && Math.asin(h / r) * deg < span / 2) {   // 고리 — 안쪽 호가 남는다
      var dr = Math.asin(h / r) * deg, i0 = a0 + dr, i1 = a1 - dr;
      return 'M ' + head + ' L ' + pt(i1, r) + ' A ' + f(r) + ' ' + f(r) + ' 0 ' + ((i1 - i0) > 180 ? 1 : 0) + ' 0 ' + pt(i0, r) + ' Z';
    }
    if (span > 180) return 'M ' + pt(a0 + 90, h) + ' L ' + head + ' L ' + pt(a1 - 90, h) + ' A ' + f(h) + ' ' + f(h) + ' 0 0 0 ' + pt(a0 + 90, h) + ' Z';
    return 'M ' + pt((a0 + a1) / 2, h / Math.sin(span / 2 / deg)) + ' L ' + head + ' Z';
  };
  /** @param {Array} values 항목 값(아무 꼴) @param {number} holePct 구멍 비율 %(0 = 꽉 찬 원형)
   *  @param {number} [gap] 조각 사이 틈의 폭(viewBox 단위 · 기본 0 = 틈 없음 — 옛 산출과 바이트가 같다). 값 있는 조각이 하나뿐이면 틈 0.
   *    조각이 틈보다 좁으면 «그 조각 쪽» 깎는 양을 줄인다(바깥 호가 제 폭의 절반은 남는다 — 사라지지 않는다).
   *  @param {{ start?: number, grow?: number[] }} [opts] start = 시작 각도(도) · grow[i] = i 번 조각의 바깥 반지름에 더하는 %. (1013t1C5 밀어내기 pull[i] 가 같은 자리에 붙는다)
   *  @returns {{ paths: string[], shares: number[], angles: number[][], total: number, empty: boolean, hole: number, gap: number, start: number, outer: number[], mids: number[], extent: number }}
   *    angles 는 틈을 깎기 «전»의 경계각(이어 붙는다 · 폭의 합 360 · 첫 시작 = start). outer[i] = 그 조각의 바깥 반지름 · mids[i] = 이등분각(도)
   *    · extent = 값 있는 조각 중 viewBox 밖으로 가장 멀리 나간 길이(max(outer) − R · 0 이상). */
  function piePaths(values, holePct, gap, opts) {
    var o = (opts && typeof opts === 'object') ? opts : {};
    var st = Number(o.start);
    var start = Number.isFinite(st) ? ((st % 360) + 360) % 360 : 0;
    var pctOf = function (list, i) { var p = Number(Array.isArray(list) ? list[i] : 0); return (Number.isFinite(p) && p > 0) ? Math.min(100, p) : 0; };
    var n = norm(values), vals = n.vals, total = n.total;
    var h = Number(holePct);
    var hole = (Number.isFinite(h) && h > 0) ? Math.min(95, h) : 0;
    var r = R * hole / 100;
    var g = Number(gap);
    var live = vals.filter(function (v) { return v > 0; }).length;
    var half = (Number.isFinite(g) && g > 0 && live > 1) ? Math.min(g, R / 5) / 2 : 0;
    var out = { paths: [], shares: [], angles: [], total: total, empty: !(total > 0), hole: hole, gap: half * 2, start: start, outer: [], mids: [], extent: 0 };
    var acc = 0;
    vals.forEach(function (v, i) {
      var share = total > 0 ? v / total : 0;
      var a0 = start + acc * 360, a1 = start + (acc + share) * 360;
      acc += share;
      out.shares.push(share);
      out.angles.push([a0, a1]);
      out.mids.push((a0 + a1) / 2);
      var Ro = share > 0 ? R * (1 + pctOf(o.grow, i) / 100) : R;   // 값 0 조각은 안 키운다(그릴 것이 없다 — extent 에도 안 든다)
      out.outer.push(Ro);
      if (!(share > 0)) { out.paths.push(''); return; }
      if (Ro - R > out.extent) out.extent = Ro - R;
      if (share >= FULL) { out.paths.push(ring(Ro, 1) + (r > 0 ? ' ' + ring(r, 0) : '')); return; }
      if (half > 0) { out.paths.push(gapSlice(a0, a1, r, Math.min(half, R * Math.sin(Math.min(a1 - a0, 180) / 4 * Math.PI / 180)), Ro)); return; }
      var large = (a1 - a0) > 180 ? 1 : 0;
      var arcOut = 'A ' + f(Ro) + ' ' + f(Ro) + ' 0 ' + large + ' 1 ' + pt(a1, Ro);
      out.paths.push(r > 0
        ? 'M ' + pt(a0, Ro) + ' ' + arcOut + ' L ' + pt(a1, r) + ' A ' + f(r) + ' ' + f(r) + ' 0 ' + large + ' 0 ' + pt(a0, r) + ' Z'
        : 'M ' + f(C) + ' ' + f(C) + ' L ' + pt(a0, Ro) + ' ' + arcOut + ' Z');
    });
    return out;
  }
  /** 범례에 찍는 비율 %(정수) — 합이 «정확히 100»(1012t1G1 고침 D2 · 최대 잔여법). 조각마다 따로 반올림하면 1·1·1 이 33·33·33(합 99), 1 여섯이 17×6(합 102)이 된다.
   *  내림한 뒤 모자란 만큼을 소수부가 큰 순서로 1 씩 준다 · 동률은 앞 항목 우선(결정적). 합 0 이면 전부 0. 값 가드·넘침 처리는 piePaths 와 같다.
   *  @param {Array} values @returns {number[]} */
  function piePercents(values) {
    var n = norm(values);
    if (!(n.total > 0)) return n.vals.map(function () { return 0; });
    var raw = n.vals.map(function (v) { return v * 100 / n.total; });
    var pct = raw.map(function (x) { return Math.floor(x + 1e-9); });
    var left = 100 - pct.reduce(function (x, y) { return x + y; }, 0);
    var key = raw.map(function (x, i) { return Math.round((x - pct[i]) * 1e9); });   // 소수부 — 부동소수 끝자리 차이가 동률을 깨지 않게 정수로
    var order = raw.map(function (_, i) { return i; }).sort(function (a, b) { return (key[b] - key[a]) || (a - b); });
    for (var k = 0; k < left && k < order.length; k++) pct[order[k]] += 1;
    return pct;
  }
  var GRAPH_PIE_GEOM = Object.freeze({ piePaths: piePaths, piePercents: piePercents, VIEW: VIEW, CENTER: C, RADIUS: R });
  if (typeof module !== 'undefined' && module.exports) module.exports = GRAPH_PIE_GEOM;
  if (root) root.GRAPH_PIE_GEOM = GRAPH_PIE_GEOM;
})(typeof window !== 'undefined' ? window : null);
