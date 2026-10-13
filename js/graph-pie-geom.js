/* graph-pie-geom.js — 원형·도넛 그래프 조각 기하의 «한 자리» (1012t1G1 · 2026-10-12).
 * 순수 함수 둘: piePaths(값 목록 + 구멍 비율 % + 틈) → 조각마다 SVG path 의 d 문자열 · piePercents(값 목록) → 합이 100 인 정수 %. DOM·window 를 안 읽는다 ⇒ 유닛(node)과 렌더러(브라우저)가 «같은 식»을 쓴다.
 * 1013t1C3 이 셋을 보탰다: pieRanks(값 목록) → 값 내림차순 순위 · pieTagPlan(piePaths 산출) → 조각 안 라벨의 자리와 보임 · pieTagRoom(piePaths 산출) → 그 자리에서 라벨이 쓸 수 있는 사각형(아래 함수 머리말). 한도는 graph-limits.js 에서 읽는다(DOM 측정 0).
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
 *     온 원 조각(항목 하나 · 점유율 ≥ 0.9999)은 «안 키운다»(Ro = R · extent 0) — 키우면 viewBox 만 넓어져 원 전체가 줄어든다.
 *     키운 조각은 viewBox(0~1000) 밖으로 나간다 ⇒ extent(가장 멀리 나간 길이 · viewBox 단위)를 같이 돌려준다 — 그리는 쪽이 viewBox 를 그만큼 넓힌다.
 *     grow 가 없거나 0 이면 그 조각의 d 는 옛 판과 «바이트가 같다»(Ro === R). 값 0 조각의 grow 는 안 센다. 유한하지 않거나 음수면 0 · 100 에서 잘린다.
 *   · 밀어내기(1013t1C5): opts.pull[i](바깥 반지름 R 대비 %)만큼 그 조각을 «이등분각 방향으로» 통째로 옮긴다 — d 는 «한 글자도 안 바뀌고» 옮길 양만 offsets[i] = [dx, dy](글자 · 소수 둘째 자리)로 돌려준다.
 *     그리는 쪽이 path 의 transform="translate(dx dy)" 로 쓴다(좌표에 굽지 않는다 ⇒ d 의 바이트 동일성이 그대로). 값 0 조각 · 각 폭 0 조각 · 온 원 조각(밀 방향이 없다)은 ['0.00', '0.00'].
 *     extent 는 민 만큼도 센다 — max(Ro_i + R × pull_i / 100) − R. 가드는 grow 와 같다(유한하지 않거나 음수면 0 · 100 에서 잘린다).
 *   · 산출 문자열에 NaN·Infinity 가 들어갈 길이 없다(모든 수가 위 가드를 지난 유한값에서 나온다). */
(function (root) {
  var VIEW = 1000, C = 500, R = 500, FULL = 0.9999;
  var LIM = function () { return (root && root.GRAPH_LIMITS) || (typeof require === 'function' ? require('./graph-limits.js') : {}); };   // 부를 때 읽는다(graph-shape.js 와 같은 길 — 로드 순서 무관)
  var f = function (n) { return n.toFixed(2); };
  var fz = function (n) { var t = n.toFixed(2); return t === '-0.00' ? '0.00' : t; };   // 옮길 양 — 0 은 늘 '0.00' 한 글자꼴(그리는 쪽이 «안 밀었다»를 글자로 가린다)
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
   *  @param {{ start?: number, grow?: number[], pull?: number[] }} [opts] start = 시작 각도(도) · grow[i] = i 번 조각의 바깥 반지름에 더하는 % · pull[i] = i 번 조각을 이등분각 방향으로 미는 양(R 대비 %).
   *  @returns {{ paths: string[], shares: number[], angles: number[][], total: number, empty: boolean, hole: number, gap: number, start: number, outer: number[], mids: number[], offsets: string[][], extent: number }}
   *    angles 는 틈을 깎기 «전»의 경계각(이어 붙는다 · 폭의 합 360 · 첫 시작 = start). outer[i] = 그 조각의 바깥 반지름 · mids[i] = 이등분각(도)
   *    · offsets[i] = 그 조각을 옮길 양 [dx, dy](글자) · extent = 값 있는 조각 중 viewBox 밖으로 가장 멀리 나간 길이(max(outer + 민 길이) − R · 0 이상). */
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
    var out = { paths: [], shares: [], angles: [], total: total, empty: !(total > 0), hole: hole, gap: half * 2, start: start, outer: [], mids: [], offsets: [], extent: 0 };
    var acc = 0;
    vals.forEach(function (v, i) {
      var share = total > 0 ? v / total : 0;
      var a0 = start + acc * 360, a1 = start + (acc + share) * 360;
      acc += share;
      out.shares.push(share);
      out.angles.push([a0, a1]);
      out.mids.push((a0 + a1) / 2);
      var Ro = (share > 0 && share < FULL) ? R * (1 + pctOf(o.grow, i) / 100) : R;   // 값 0 조각은 안 키운다(그릴 것이 없다 — extent 에도 안 든다) · 온 원 조각도 안 키운다(견줄 이웃이 없다 — 키우면 viewBox 만 넓어져 원 전체가 «줄어든다» · 1013t1C4 고침)
      out.outer.push(Ro);
      if (!(share > 0)) { out.paths.push(''); out.offsets.push(['0.00', '0.00']); return; }
      var pl = (share >= FULL || !(a1 - a0 > 0)) ? 0 : R * pctOf(o.pull, i) / 100;   // 온 원은 밀 방향이 없다 · 각 폭 0 조각은 그릴 것이 없다
      var ma = (a0 + a1) / 2 * Math.PI / 180;
      out.offsets.push(pl > 0 ? [fz(pl * Math.sin(ma)), fz(-pl * Math.cos(ma))] : ['0.00', '0.00']);
      if (Ro + pl - R > out.extent) out.extent = Ro + pl - R;
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
  /** 순위(1013t1C3) — 값이 큰 순서로 1, 2, 3 … · «동률은 같은 순위»(다음 순위는 건너뛴다: 30·20·15·15·10 → 1·2·3·3·5). 값 0(가드에 걸린 것 포함)은 0 = 순위 없음.
   *  값 가드·넘침 처리는 piePaths 와 같다(norm). @param {Array} values @returns {number[]} */
  function pieRanks(values) {
    var vals = norm(values).vals;
    return vals.map(function (v) {
      if (!(v > 0)) return 0;
      var k = 1;
      vals.forEach(function (w) { if (w > v) k++; });
      return k;
    });
  }
  /** 조각 안 라벨의 자리와 보임(1013t1C3) — piePaths 의 산출 «만» 읽는다(DOM 을 안 잰다 ⇒ 떼어진 블럭·배율과 무관하게 같은 답 · 두 번 그려 같다).
   *  · 자리(viewBox 좌표): 이등분각 방향으로 도너츠면 고리의 한가운데((구멍 + 그 조각의 바깥) / 2) · 원형이면 그 조각 바깥 반지름의 PIE_TAG_AT % · 온 원 원형이면 중심.
   *    거기에 그 조각을 민 양(offsets)을 더한다 ⇒ 크기(C4)·밀어내기(C5)를 따라간다.
   *  · 보임: tags[i] 가 'on' 이면 보이고 'off' 면 숨는다. 그 밖(자동)은 «자리가 넉넉할 때만» — 라벨 자리의 현(2 × ra × sin(min(폭, 180°) / 2))이 PIE_TAG_MIN_CHORD 이상이고
   *    고리 두께(바깥 − 구멍)가 PIE_TAG_MIN_RADIAL 이상. 값 0 조각 · 각 폭 0 조각은 'on' 이어도 숨는다(그려진 조각이 없다).
   *  @param {ReturnType<typeof piePaths>} geo @param {{ tags?: Array }} [opts] @returns {{ x: number, y: number, show: boolean }[]} */
  function pieTagPlan(geo, opts) {
    var L = LIM(), tags = (opts && Array.isArray(opts.tags)) ? opts.tags : [];
    var lim = function (v) { var n = Number(v); return (Number.isFinite(n) && n > 0) ? n : 0; };
    var at = Math.min(100, lim(L.PIE_TAG_AT)), minChord = lim(L.PIE_TAG_MIN_CHORD), minRadial = lim(L.PIE_TAG_MIN_RADIAL);
    var g = (geo && typeof geo === 'object') ? geo : {};
    var shares = Array.isArray(g.shares) ? g.shares : [];
    var r = R * lim(g.hole) / 100, rad = Math.PI / 180;
    return shares.map(function (share, i) {
      var Ro = (g.outer && lim(g.outer[i])) || R;
      var a0 = g.angles && g.angles[i] ? Number(g.angles[i][0]) : 0, a1 = g.angles && g.angles[i] ? Number(g.angles[i][1]) : 0;
      var span = (Number.isFinite(a1 - a0) && a1 - a0 > 0) ? a1 - a0 : 0;
      var full = share >= FULL;
      var ra = r > 0 ? (r + Ro) / 2 : (full ? 0 : Ro * at / 100);
      var mid = (a0 + a1) / 2 * rad;
      var off = (g.offsets && g.offsets[i]) || [0, 0];
      var dx = Number(off[0]), dy = Number(off[1]);
      var x = C + ra * Math.sin(mid) + (Number.isFinite(dx) ? dx : 0), y = C - ra * Math.cos(mid) + (Number.isFinite(dy) ? dy : 0);
      var live = share > 0 && span > 0;
      var chord = 2 * ra * Math.sin(Math.min(span, 180) / 2 * rad);
      var room = ((full && !(r > 0)) || chord >= minChord) && (Ro - r) >= minRadial;
      var show = live && (tags[i] === 'on' ? true : (tags[i] === 'off' ? false : room));
      return { x: Number.isFinite(x) ? x : C, y: Number.isFinite(y) ? y : C, show: show };
    });
  }
  /** 조각 안 라벨이 «쓸 수 있는 자리»(1013t1C3 고침) — pieTagPlan 이 고른 자리를 가운데로 하는 «바로 선 사각형»(글자는 안 돈다)이 그 조각 안에 드는가.
   *  pieTagPlan 의 숨김은 viewBox 단위의 현·두께만 본다 ⇒ 실제 글자(차트 px · 라벨 크기 · 이름 길이)가 조각을 넘어도 모른다. 이 함수가 그 «둘째 단»의 기하다 — DOM 은 여전히 안 잰다:
   *  그리는 쪽이 잰 라벨 크기를 viewBox 단위로 바꿔 fits(w, h) 에 묻는다(drag-utils.js grbPieFitTags).
   *  · fits(w, h): 폭 w · 높이 h 인 사각형의 둘레(귀 넷 + 변마다 가운데 점들)가 전부 ① 바깥 반지름 안 ② 구멍 밖(사각형에서 중심에 가장 가까운 점으로 잰다) ③ 두 변에서 틈의 절반 + PIE_TAG_PAD 만큼 안쪽.
   *    폭이 180° 를 넘는 조각은 볼록하지 않다(두 반평면의 «합») ⇒ 귀만 보면 안 되고 변 위의 점도 본다. 값 0 조각 · 각 폭 0 조각은 늘 false.
   *    틈은 geo.gap / 2 로 잰다 — 좁은 조각은 그리는 쪽이 틈을 덜 깎으므로(piePaths) 이 판정이 «더 빡빡한 쪽»이다(안이라고 하면 그려진 조각 안이다).
   *  · boxes: 가로세로비(PIE_TAG_ASPECTS · 넓적한 것부터)마다 그 자리에 드는 «가장 큰» 사각형 { w, h }(이분법 · 안 들면 0 · 0). best = 그중 넓이가 가장 큰 것의 색인.
   *  @param {ReturnType<typeof piePaths>} geo @returns {{ boxes: { w: number, h: number }[], best: number, fits: (w: number, h: number) => boolean }[]} */
  var PIE_TAG_ASPECTS = [3, 2, 1.4, 1, 0.7, 0.5];   // 폭 ÷ 높이 — 순서 = 그리는 쪽이 먼저 써 보는 순서(넓적할수록 줄바꿈이 적다)
  function pieTagRoom(geo) {
    var L = LIM();
    var lim = function (v) { var n = Number(v); return (Number.isFinite(n) && n > 0) ? n : 0; };
    var at = Math.min(100, lim(L.PIE_TAG_AT)), pad = lim(L.PIE_TAG_PAD);
    var g = (geo && typeof geo === 'object') ? geo : {};
    var shares = Array.isArray(g.shares) ? g.shares : [];
    var r = R * lim(g.hole) / 100, rad = Math.PI / 180, edge = lim(g.gap) / 2 + pad;
    return shares.map(function (share, i) {
      var Ro = (g.outer && lim(g.outer[i])) || R;
      var a0 = g.angles && g.angles[i] ? Number(g.angles[i][0]) : 0, a1 = g.angles && g.angles[i] ? Number(g.angles[i][1]) : 0;
      var span = (Number.isFinite(a1 - a0) && a1 - a0 > 0) ? a1 - a0 : 0;
      var full = share >= FULL, live = share > 0 && span > 0;
      var ra = r > 0 ? (r + Ro) / 2 : (full ? 0 : Ro * at / 100);
      var mid = (a0 + a1) / 2 * rad;
      var px = ra * Math.sin(mid), py = -ra * Math.cos(mid);   // 라벨 자리 — «그 조각의 중심» 기준(민 양은 조각과 라벨이 같이 움직이므로 서로 지워진다)
      var n0x = Math.cos(a0 * rad), n0y = Math.sin(a0 * rad), n1x = Math.cos(a1 * rad), n1y = Math.sin(a1 * rad);   // 변의 법선(시계 쪽)
      var inside = function (x, y) {
        if (x * x + y * y > (Ro - pad) * (Ro - pad)) return false;
        if (full) return true;
        var d0 = x * n0x + y * n0y, d1 = -(x * n1x + y * n1y);
        return span > 180 ? (d0 >= edge || d1 >= edge) : (d0 >= edge && d1 >= edge);
      };
      var fits = function (w, h) {
        var a = Number(w) / 2, b = Number(h) / 2;
        if (!live || !(a >= 0) || !(b >= 0) || !(Ro - pad > 0)) return false;
        if (r > 0) {   // 구멍 — 사각형에서 중심에 가장 가까운 점
          var nx = Math.max(px - a, Math.min(0, px + a)), ny = Math.max(py - b, Math.min(0, py + b));
          if (nx * nx + ny * ny < (r + pad) * (r + pad)) return false;
        }
        for (var k = 0; k <= 6; k++) {
          var t = k / 6, x = px - a + 2 * a * t, y = py - b + 2 * b * t;
          if (!inside(x, py - b) || !inside(x, py + b) || !inside(px - a, y) || !inside(px + a, y)) return false;
        }
        return true;
      };
      var boxes = PIE_TAG_ASPECTS.map(function (asp) {
        var q = Math.sqrt(asp), lo = 0, hi = 2 * Ro;
        if (!fits(0, 0)) return { w: 0, h: 0 };
        for (var k = 0; k < 24; k++) { var m = (lo + hi) / 2; if (fits(m * q, m / q)) lo = m; else hi = m; }
        return { w: Math.floor(lo * q * 100) / 100, h: Math.floor(lo / q * 100) / 100 };
      });
      var best = 0;
      boxes.forEach(function (bx, k) { if (bx.w * bx.h > boxes[best].w * boxes[best].h) best = k; });
      return { boxes: boxes, best: best, fits: fits };
    });
  }
  var GRAPH_PIE_GEOM = Object.freeze({ piePaths: piePaths, piePercents: piePercents, pieRanks: pieRanks, pieTagPlan: pieTagPlan, pieTagRoom: pieTagRoom, VIEW: VIEW, CENTER: C, RADIUS: R });
  if (typeof module !== 'undefined' && module.exports) module.exports = GRAPH_PIE_GEOM;
  if (root) root.GRAPH_PIE_GEOM = GRAPH_PIE_GEOM;
})(typeof window !== 'undefined' ? window : null);
