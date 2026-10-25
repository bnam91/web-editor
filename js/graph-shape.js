/* graph-shape.js — 「SVG 를 그래프 모양으로」의 «한 자리» (1012t1G2 · G3 · G4 · 2026-10-12).
 *   G2 막대를 SVG 실루엣으로 · G3 실루엣 안에 차오르는 채움 · G4 막대/실루엣을 비율별 마디로.
 * 싣는 길은 graph-limits.js · graph-pie-geom.js 와 같다 — drag-utils.js 가 side-effect import 해 window.GRAPH_SHAPE 를 받고, 유닛은 require.
 *   ⛔이 파일은 import 를 안 쓴다(모듈 하네스는 drag-utils 의 «직접» import 만 따라 준다 · tests/dom/_drag-utils-deps.js).
 *
 * 모델(전부 «없으면 옛 세로 막대 그대로»인 덧키 — chartType 은 'bar-v' 를 안 바꾼다)
 *   dataset.barShape   없음 = 사각 막대 · 내장 이름(GRAPH_SHAPE_PRESETS) · 'custom'
 *   dataset.shapeSvg   custom 일 때의 «소독·정규화된» SVG 글자(sanitizeShapeSvg 를 지난 것만 · 상한 GRAPH_LIMITS.SHAPE_SVG_MAX)
 *   items[i].shape / shapeSvg   그 항목만 다른 모양(블럭 모양이 켜져 있을 때만 읽는다)
 *   dataset.fillMax    채움 분모. 없음 = 모양이면 SHAPE_FILL_MAX_DEFAULT(100) · 사각이면 옛 max(items)
 *   dataset.fillDir    예약(없음 = 'up' · 이번엔 up 만 그린다)
 *   dataset.trackColor 없음 = 채움과 같은 색 × SHAPE_TRACK_OPACITY
 *   items[i].segments  [{label, value, color?}] — 0번이 맨 아래. 있으면 item.value 는 «합»으로 같이 써 둔다(쓰는 자 = segSum 한 곳)
 *   dataset.segGap     마디 사이 틈(px). 없음 = SEG_GAP_DEFAULT
 *
 * 그리는 법: 실루엣은 CSS mask-image(«비 base64» data URI) · 채움은 HTML 층의 height %.
 *   ⛔base64 금지 — 저장 길목(js/io/asset-externalize.js)이 base64 data URL 을 goya-asset:// 로 바꿔 마스크가 깨진다.
 *   마스크 그림은 문서 밖 «이미지»로만 쓰인다(스크립트·외부 자원이 안 돈다) — 소독은 그 위의 둘째 방어선이다.
 * AE(차오르는 애니메이션)가 읽을 자리: 채움 요소의 data-fill(0~1 · 소수 3자리) · window.graphFillModel(block).
 *   움직일 속성은 채움 층의 height 하나(0 → ratio × 100%). */
(function (root) {
  var LIM = function () { return (root && root.GRAPH_LIMITS) || (typeof require === 'function' ? require('./graph-limits.js') : {}); };
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* 내장 실루엣 — 원·둥근 사각·단순 path 로 «직접 그린» 것(외부 아이콘 0). viewBox 는 잉크에 딱 맞는다(여백이 있으면 채움 %가 모양과 어긋난다). */
  var _svg = function (w, h, inner) { return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + inner + '</svg>'; };
  var GRAPH_SHAPE_PRESETS = Object.freeze({
    /* 사람 — 1012t1G2(10-25 현빈 「화장실픽토그램 같아 짜쳐 보인다 → 이쁜 걸로」): 직각 어깨·떨어진 팔·곧은 다리를 걷고
       둥근 머리(목 틈 6) + 둥근 어깨에서 발목까지 부드럽게 좁아지는 몸통 한 path + 아래쪽 가는 다리 틈. 키 person · viewBox 76×240 은 그대로(옛 저장 · 상자 비). */
    person: Object.freeze({ label: '사람', svg: _svg(76, 240,
      '<circle cx="38" cy="20" r="20"/>'
      + '<path d="M22 46H54C68 46 76 56 76 70C76 120 66 158 63 226C63 234 58 240 51 240H46C43 240 41 238 41 235V164C41 160 35 160 35 164V235C35 238 33 240 30 240H25C18 240 13 234 13 226C10 158 0 120 0 70C0 56 8 46 22 46Z"/>') }),
    bottle: Object.freeze({ label: '약통', svg: _svg(120, 200,
      '<path d="M29 0H91Q98 0 98 7V40H22V7Q22 0 29 0Z"/>'   // 뚜껑 — 위 모서리만 둥글다(아래가 둥글면 마디 경계가 그 근처일 때 아래 색이 실처럼 비친다) · 높이 = 전체의 1/5
      + '<rect x="30" y="38" width="60" height="22"/>'
      + '<rect x="0" y="52" width="120" height="148" rx="30"/>') }),
    drop: Object.freeze({ label: '물방울', svg: _svg(100, 140,
      '<path d="M50 0C64 24 100 60 100 90A50 50 0 0 1 50 140A50 50 0 0 1 0 90C0 60 36 24 50 0Z"/>') }),
  });

  /* ── 순수 함수(DOM 없이 require 가능 — 유닛이 잰다) ───────────────────────── */
  var num = function (v) { var n = Number(v); return (Number.isFinite(n) && n > 0) ? n : 0; };
  /** 채움 비율 0~1. 값·분모가 유한한 양수가 아니면 0 · 분모를 넘으면 1 로 자른다. */
  function fillRatio(value, max) {
    var v = num(value), m = num(max);
    if (!(m > 0) || !(v > 0)) return 0;
    return Math.min(1, v / m);
  }
  /** 마디 값 목록 → { ratios(합 1 · 합 0 이면 전부 0), total }. 값 가드는 fillRatio 와 같다(음수·NaN·글자 = 0). */
  function segRatios(segments) {
    var vals = (Array.isArray(segments) ? segments : []).map(function (s) { return num(s && typeof s === 'object' ? s.value : s); });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    if (!Number.isFinite(total)) { var mx = Math.max.apply(null, vals); vals = vals.map(function (v) { return v / mx; }); total = vals.reduce(function (a, b) { return a + b; }, 0); }
    return { ratios: vals.map(function (v) { return total > 0 ? v / total : 0; }), total: total };
  }
  /** 마디 값의 합 — item.value 를 쓰는 «한 자리». 소수 오차는 6자리에서 자른다. */
  function segSum(segments) { return +segRatios(segments).total.toFixed(6); }
  /** 색을 안 정한 i번째 마디의 불투명도 — 막대색 하나에 단조 감소(원형 조각의 사다리와 같은 다섯 단, 그 뒤로는 0.8 배씩). */
  var SEG_LADDER = [1, 0.8, 0.6, 0.45, 0.3];
  function segAlpha(i) {
    var k = Math.max(0, Math.floor(Number(i) || 0));
    return k < SEG_LADDER.length ? SEG_LADDER[k] : +(SEG_LADDER[SEG_LADDER.length - 1] * Math.pow(0.8, k - SEG_LADDER.length + 1)).toFixed(4);
  }
  var _rootTag = function (svg) { var m = /<svg\b[^>]*>/i.exec(typeof svg === 'string' ? svg : ''); return m ? m[0] : ''; };
  var _attr = function (tag, name) { var m = new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i').exec(tag); return m ? (m[1] != null ? m[1] : m[2]) : null; };
  var _len = function (v) { if (v == null) return NaN; var m = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/i.exec(String(v)); return m ? parseFloat(m[1]) : NaN; };   // % · em 은 크기를 모른다
  /** SVG 글자 → { w, h, ratio(w/h) } — viewBox 우선, 없으면 width/height(px). 둘 다 없거나 0 이하면 null. */
  function shapeAspect(svg) {
    var tag = _rootTag(svg);
    if (!tag) return null;
    var vb = _attr(tag, 'viewBox');
    var w = NaN, h = NaN;
    if (vb != null) { var p = vb.trim().split(/[\s,]+/).map(Number); if (p.length === 4) { w = p[2]; h = p[3]; } }
    if (!(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0)) { w = _len(_attr(tag, 'width')); h = _len(_attr(tag, 'height')); }
    if (!(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0)) return null;
    return { w: w, h: h, ratio: w / h };
  }
  /** SVG 글자 → CSS url('data:image/svg+xml,…'). base64 를 안 쓴다 · 작은따옴표와 괄호까지 % 로 바꿔 style 속성·url() 안에서 안 끊긴다.
   *  저장하는 글자엔 xmlns 가 없다(정규화가 걷는다) — 그림으로 읽히려면 필요하므로 «여기서만» 붙인다. */
  function shapeMaskUrl(svg) {
    var s = typeof svg === 'string' ? svg : '';
    var tag = _rootTag(s);
    if (!tag) return '';
    if (!/\sxmlns\s*=/.test(tag)) s = s.replace(/<svg\b/i, '<svg xmlns="' + SVG_NS + '"');
    var enc = encodeURIComponent(s).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    return "url('data:image/svg+xml," + enc + "')";
  }
  /** 모양 이름(+ custom 글자) → 그릴 SVG 글자. 모르는 이름 · 크기를 못 읽는 글자 = ''(사각으로 떨어진다). */
  function shapeSvgOf(name, customSvg) {
    if (!name || typeof name !== 'string') return '';
    if (name === 'custom') return (typeof customSvg === 'string' && shapeAspect(customSvg)) ? customSvg : '';
    return Object.prototype.hasOwnProperty.call(GRAPH_SHAPE_PRESETS, name) ? GRAPH_SHAPE_PRESETS[name].svg : '';
  }
  var _hasSegs = function (it) { return !!it && Array.isArray(it.segments) && it.segments.length > 0; };
  /** 블럭 모양이 «실제로» 켜졌나 — 내장 이름이거나 'custom'(+ 읽히는 shapeSvg)일 때만. 모르는 이름('zzz')·글자 없는 custom 은 꺼진 것이다(사각 막대 옛 길). */
  function shapeOn(dataset) { return !!(dataset && shapeSvgOf(dataset.barShape, dataset.shapeSvg)); }
  /** 이 블럭이 «모양·마디 길»로 그려지나 — 렌더 분기와 패널이 같이 읽는다. */
  function usesShape(dataset, items) {
    return shapeOn(dataset) || (Array.isArray(items) && items.some(_hasSegs));
  }
  /** 채움 분모 — 모양이면 dataset.fillMax(없으면 기본 100), 사각이면 옛 max(items)(value2 는 비교 막대 것이라 안 본다). */
  function fillMaxOf(dataset, items) {
    if (shapeOn(dataset)) { var m = num(dataset.fillMax); return m > 0 ? m : LIM().SHAPE_FILL_MAX_DEFAULT; }
    return Math.max.apply(null, (items || []).map(function (it) { return num(it && it.value); }).concat([1]));
  }
  var _r3 = function (r) { return +r.toFixed(3); };
  /** 채움 셈의 «한 자리» — 렌더(_renderGraphShape)와 모델(graphFillModel)이 둘 다 이것만 부른다(둘이 다른 수를 내지 않게).
   *    vItems   값의 정본을 실은 항목(마디가 있으면 value = 마디 합 — item.value 가 어긋나 있어도)
   *    max      fillMaxOf(dataset, vItems)
   *    scaleMax 축·격자가 켜졌으면 «깔끔한 상한»(drag-utils _niceScale — window.__grbNiceScale 로 받는다), 아니면 max
   *    denom    채움 비율의 분모: 모양이면 max(상자가 boxFrac 만큼 낮아진다) · 사각이면 scaleMax(막대가 눈금선에 맞는다)
   *    boxFrac  상자 높이 / 플롯 높이 */
  function fillPlan(dataset, items, niceFn) {
    var d = dataset || {};
    var vItems = (Array.isArray(items) ? items : []).map(function (it) {
      if (!_hasSegs(it)) return it || {};
      var c = {}; for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) c[k] = it[k];
      c.value = segSum(it.segments);
      return c;
    });
    var max = fillMaxOf(d, vItems);
    var nice = typeof niceFn === 'function' ? niceFn : (root && typeof root.__grbNiceScale === 'function' ? root.__grbNiceScale : null);
    var scaleMax = max;
    if (nice && (d.showAxis === '1' || d.showGrid === '1')) { var ns = nice(max); if (ns && ns.max > 0) scaleMax = ns.max; }
    return { vItems: vItems, max: max, scaleMax: scaleMax, denom: shapeOn(d) ? max : scaleMax, boxFrac: Math.min(1, max / scaleMax) };
  }

  /* ── 항목을 «다시 쓰는» 자리가 덧필드를 안 떨구게 하는 한 자리(1012t1G4) ──
   * items 를 통째로 새로 짜는 길(AI 채움 js/ai-ext/graph.js · updateGraphBlock)은 { label, value } 만 남겨 왔다 — 마디·항목 모양이 사라진다.
   * carryItemExtras(out, prev, incoming): out(새 항목)에 prev(같은 순번의 옛 항목)의 shape/shapeSvg/segments 와 원형 조각별 키(pieGrow/piePull/pieTag · 1013t1C4)를 옮긴다.
   *   incoming.segments 가 배열이면 그것을 쓴다(라벨 80자 · 값 0 이상 유한 · 색은 단순 색 글자만 · 20개까지) → out.value = 합.
   *   옛 마디를 물려받는데 새 value 가 합과 다르면 마디를 «같은 비율로» 늘이거나 줄여 합을 새 value 에 맞춘다(그림은 마디 합을 그린다 — 새 값이 묻히지 않게).
   *     맞춘 합은 «정확히» 새 value 다(최대 잔여법 · fitSegments) — [10,10,10] → 100 은 [34,33,33] 이지 33.333333×3 이 아니다.
   *     옛 마디 합이 0 이면(비율이 없다) 새 value 를 마디에 «균등하게» 나눈다 — 값이 0 으로 덮이지 않는다.
   *   새 value 가 0 이하면 마디는 그대로 두고 out.value 를 합으로 되돌린다(비율을 잃지 않는다).
   *   ⇒ 나갈 때 마디가 있으면 늘 out.value === segSum(out.segments).
   * reconcileItems(items): 마디 있는 항목마다 위 규칙을 «자기 자신»에 건다(value 와 마디 합이 어긋난 채 세로 막대로 돌아올 때 — 패널 유형 전환이 부른다). */
  var SEG_MAX_COUNT = 20;
  var _segColorOk = function (c) { return typeof c === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%]+\)|[a-zA-Z]+)$/.test(c.trim()); };
  function normSegments(list) {
    return (Array.isArray(list) ? list : []).slice(0, SEG_MAX_COUNT).map(function (sg) {
      sg = (sg && typeof sg === 'object') ? sg : {};
      var o = { label: Array.from(String(sg.label == null ? '' : sg.label)).slice(0, 80).join(''), value: num(sg.value) };
      if (_segColorOk(sg.color)) o.color = sg.color.trim();
      return o;
    });
  }
  var PIE_ITEM_INT_KEYS = ['pieGrow', 'piePull'];
  var _piePct = function (v) { if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null; var n = Number(v); return (Number.isFinite(n) && n >= 0) ? Math.min(100, Math.round(n)) : null; };
  var _pieTagOk = function (t) { return t === 'on' || t === 'off'; };
  var VLABEL_OFFSET_KEYS = ['vDx', 'vDy'];   // ★1017t1f5 — 꺾은선 값 라벨 개별 위치(js/drag-utils.js _startVLabelOffsetDrag)
  var _vOffsetNum = function (v) { if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null; var n = Math.round(Number(v)); return Number.isFinite(n) ? n : null; };
  function carryItemExtras(out, prev, incoming) {
    prev = (prev && typeof prev === 'object') ? prev : {};
    incoming = (incoming && typeof incoming === 'object') ? incoming : {};
    if (typeof prev.shape === 'string' && prev.shape) { out.shape = prev.shape; if (typeof prev.shapeSvg === 'string' && prev.shapeSvg) out.shapeSvg = prev.shapeSvg; }
    /* 1013t1C4 — 원형 조각별 키(pieGrow · piePull = 0~100 정수 % · pieTag = 'on'|'off')도 같은 자리에서 옮긴다: 들어온 값이 유효하면 그것, 아니면 옛 값. 0·무효는 키를 안 남긴다.
       아래 마디 분기가 일찍 돌아가므로 «그 앞»에 둔다. 한도(예: 크기 30)는 렌더·패널이 graph-limits 로 자른다 — 여기는 꼴만 본다. */
    PIE_ITEM_INT_KEYS.forEach(function (k) { var v = _piePct(incoming[k]); if (v === null) v = _piePct(prev[k]); if (v > 0) out[k] = v; else delete out[k]; });
    // ★1017t1f5 — 값 라벨 오프셋도 같은 자리에서 옮긴다(MCP partial update 가 items 를 통째로 다시 지어도 드래그로 옮긴 자리를 잃지 않게). 한도(±600)는 여기서 안 자른다(「꼴만 본다」 — 위와 같은 규약).
    VLABEL_OFFSET_KEYS.forEach(function (k) { var v = _vOffsetNum(incoming[k]); if (v === null) v = _vOffsetNum(prev[k]); if (v) out[k] = v; else delete out[k]; });
    var _tag = _pieTagOk(incoming.pieTag) ? incoming.pieTag : (_pieTagOk(prev.pieTag) ? prev.pieTag : '');
    if (_tag) out.pieTag = _tag; else delete out.pieTag;
    if (Array.isArray(incoming.segments)) {
      var own = normSegments(incoming.segments);
      if (own.length) { out.segments = own; out.value = segSum(own); }
      return out;
    }
    if (_hasSegs(prev)) {
      var segs = normSegments(prev.segments), sum = segSum(segs), v = num(out.value);
      if (v > 0 && Math.abs(v - sum) > 1e-9) {
        var fit = fitSegments(segs.map(function (sg) { return sg.value; }), v);
        segs.forEach(function (sg, j) { sg.value = fit[j]; });
      }
      out.segments = segs;
      out.value = segSum(segs);
    }
    return out;
  }
  var _decimals = function (x) { var s = String(x); if (/e/i.test(s)) return 6; var i = s.indexOf('.'); return i < 0 ? 0 : Math.min(6, s.length - i - 1); };
  /** 값 목록을 «같은 비율로» 늘이거나 줄여 합이 정확히 total 이 되게 한다(최대 잔여법 — 원형 범례 % 와 같은 법).
   *  소수 자릿수 = 들어온 값들·total 이 쓰던 자릿수(정수면 정수). 그 자릿수에서 어느 마디든 제 몫에서 5% 넘게 틀어지면(0 으로 꺼지는 것 포함) 한 자리씩 늘린다(6자리까지)
   *    — [40,30,20,10] → 7 은 [3,2,1,1](비율이 깨진다)이 아니라 [2.8,2.1,1.4,0.7].
   *  값의 합이 0 이면 total 을 균등하게 나눈다. total 이 0 이하면 그대로 돌려준다. */
  function fitSegments(values, total) {
    var vals = (Array.isArray(values) ? values : []).map(num), t = num(total), n = vals.length;
    if (!n || !(t > 0)) return vals;
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    var w = sum > 0 ? vals : vals.map(function () { return 1; }), wSum = sum > 0 ? sum : n;
    var dp = vals.reduce(function (m, x) { return Math.max(m, _decimals(x)); }, _decimals(t));
    for (;; dp++) {
      var scale = Math.pow(10, dp), units = Math.round(t * scale);
      var q = w.map(function (x) { return x / wSum * units; });
      var out = q.map(function (x) { return Math.floor(x + 1e-9); });
      var left = units - out.reduce(function (a, b) { return a + b; }, 0);
      var order = q.map(function (x, i) { return i; }).sort(function (a, b) { return (q[b] - out[b]) - (q[a] - out[a]) || a - b; });
      for (var k = 0; k < left && k < n; k++) out[order[k]] += 1;
      if (dp >= 6 || !out.some(function (u, i) { return q[i] > 0 && Math.abs(u - q[i]) > q[i] * 0.05; })) return out.map(function (u) { return +(u / scale).toFixed(dp); });
    }
  }
  function reconcileItems(items) {
    return (Array.isArray(items) ? items : []).map(function (it) {
      if (!_hasSegs(it)) return it;
      var out = {}; for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k) && k !== 'segments') out[k] = it[k];
      return carryItemExtras(out, it, null);
    });
  }

  /* ── 그리기(HTML 글자만 만든다 — DOM 을 안 만진다) ─────────────────────────
   * o = { esc, color, blockShape, blockSvg, boxFrac, ratioOf, blockBar, trackColor, segGap, labelSize, vSize, vCss, xCss, xInk, lhCss, colMin, fillW }
   *   esc·color 는 drag-utils 의 _escGraphHtml · _safeGraphColor(사용자 글자·색은 반드시 그 둘을 지난다 · E152).
   *   ratioOf(value) 는 «상자 안» 채움 비율(0~1) · boxFrac 는 상자 높이 / 플롯 높이(눈금 상한이 분모보다 클 때 < 1). */
  function shapeColsHTML(items, o) {
    var L = LIM();
    var gap = Number.isFinite(o.segGap) && o.segGap >= 0 ? o.segGap : L.SEG_GAP_DEFAULT;
    var trackC = o.color(o.trackColor);
    var trackSolid = trackC && !/gradient\(/i.test(trackC) ? trackC : '';
    return items.map(function (item) {
      item = item || {};
      var own = o.blockShape && item.shape ? shapeSvgOf(item.shape, item.shapeSvg) : '';
      var svg = own || o.blockSvg;
      var asp = svg ? shapeAspect(svg) : null;
      var bc = o.color(item.color) || o.blockBar;
      var bg = bc ? 'background:' + bc + ';' : '';
      var segs = _hasSegs(item) ? item.segments : null;
      var value = segs ? segSum(segs) : item.value;
      var ratio = o.ratioOf(value);
      var pct = +(ratio * 100).toFixed(2);
      var fillAttr = ' data-fill="' + ratio.toFixed(3) + '"';
      var layers = '', labels = '';
      if (segs) {
        var rs = segRatios(segs).ratios;
        if (asp && pct < 100) layers += '<div class="grb-bar-fill grb-shape-track" style="bottom:auto;height:' + +(100 - pct).toFixed(2) + '%;' + (trackSolid ? 'background:' + trackSolid + ';' : bg + 'opacity:' + L.SHAPE_TRACK_OPACITY + ';') + '"></div>';
        layers += '<div class="grb-seg-stack grb-shape-fill"' + fillAttr + ' style="height:' + pct + '%;gap:' + gap + 'px">'
          + segs.map(function (s, j) {
            var sc = o.color(s && s.color);
            var ink = sc ? 'background:' + sc + ';' : bg + 'opacity:' + segAlpha(j) + ';';
            return '<div class="grb-seg" style="' + (rs[j] > 0 ? 'flex-grow:' + +(rs[j] * 100).toFixed(4) : 'display:none') + '"><div class="grb-bar-fill grb-seg-ink" style="' + ink + '"></div></div>';
          }).join('') + '</div>';
        /* 사각 쌓기(모양 없음)의 라벨은 막대 바깥 글자 — 카테고리 라벨과 같은 색 길(o.xInk = 소독을 지난 xlabelColor || labelColor)을 탄다 · 글자는 말줄임 칸(.grb-seg-text)에 싼다.
           모양이면 둘 다 안 한다(글자색 = 마디 바탕에 맞춘 톤 변수 · 옛 바이트 그대로). */
        labels = '<div class="grb-seg-labels" style="height:' + pct + '%;gap:' + gap + 'px;font-size:' + o.labelSize + 'px' + (!asp && o.xInk ? ';' + o.xInk : '') + '">'
          + segs.map(function (s, j) {
            var txt = o.esc(s && s.label);
            return '<div class="grb-seg-label" style="' + (rs[j] > 0 ? 'flex-grow:' + +(rs[j] * 100).toFixed(4) : 'display:none') + '">' + (asp ? txt : '<span class="grb-seg-text">' + txt + '</span>') + '</div>';
          }).join('') + '</div>';
      } else {
        if (asp) layers += '<div class="grb-bar-fill grb-shape-track" style="' + (trackSolid ? 'background:' + trackSolid + ';' : bg + 'opacity:' + L.SHAPE_TRACK_OPACITY + ';') + '"></div>';
        layers += '<div class="grb-bar-fill grb-shape-fill"' + fillAttr + ' style="height:' + pct + '%;' + bg + '"></div>';
      }
      /* 상자 — 모양이면 viewBox 비(폭이 칸보다 넓어지면 폭에 맞춰 같이 줄어든다 · 찌그러지지 않는다), 사각이면 폭 = 두께 · 높이 = 플롯. */
      var box = asp
        ? '<div class="grb-shape-box grb-shape-on" style="aspect-ratio:' + asp.w + ' / ' + asp.h + ';width:min(100cqw, calc(100cqh * ' + (asp.ratio * o.boxFrac).toFixed(4) + '))">'
        : '<div class="grb-shape-box" style="' + o.fillW + 'height:100%">';
      var colCss = o.colMin + (own ? '--grb-shape:' + shapeMaskUrl(own) + ';' : '');
      return '\n            <div class="grb-bar-col"' + (colCss ? ' style="' + colCss + '"' : '') + '>'
        + '\n              <div class="grb-bar-val-label" style="font-size:' + o.vSize + 'px;' + o.vCss + o.lhCss + '">' + o.esc(value) + '</div>'
        + '\n              <div class="grb-bar-fill-wrap grb-shape-wrap">' + box + '<div class="grb-shape-mask">' + layers + '</div>' + labels + '</div></div>'
        + '\n              <div class="grb-bar-label" style="font-size:' + o.labelSize + 'px;' + o.xCss + o.lhCss + '">' + o.esc(item.label) + '</div>'
        + '\n            </div>';
    }).join('');
  }

  /* ── 소독·정규화(DOM 필요) ────────────────────────────────────────────────
   * 들어온 SVG 글자 → { ok, svg } | { ok:false, code }. code: NOT_SVG · TOO_LARGE · NO_SIZE · EMPTY · TOO_COMPLEX.
   *   ① 공용 소독(window.sanitizeCanvasHtml — script · on* · javascript:) ② inert template 안에서 파싱 ③ «그리는 요소»만 남긴다(허용 목록) —
   *   script · foreignObject · image · a(자식은 올린다) · text · 모르는 요소는 뺀다 ④ 속성: on* · 콜론 든 이름(xlink:href="#…" 만 href 로 옮긴다) ·
   *   # 로 안 시작하는 href · 값에 ://, javascript:, data:, @import, 바깥 url( 이 든 것 · «백슬래시가 든 것»(CSS 이스케이프 u\72l( 로 위 검사를 비껴간다)은 뺀다
   *   ⑤ <style> 요소는 «안 받는다»(허용 목록에 없다 — @\69mport 같은 이스케이프를 글자 검사로 다 막을 수 없다. 실루엣은 알파만 쓰니 색 규칙은 필요 없다.
   *      ⚠️단 class 로 fill:none 을 주던 SVG 는 그 면이 검정으로 «찬다» — 선만 있는 그림이 면으로 보일 수 있다)
   *   ⑤′ <use> 는 문서 안 #id 만 · 64개까지 · «use 를 품은 것(또는 use 자신)을 가리키면» 거절(TOO_COMPLEX — 겹쳐 부르면 요소 몇 개로 10^n 벌이 그려진다) · 못 찾는 id 는 그 use 만 뺀다
   *   ⑥ 루트: viewBox 없으면 width/height 로 합성 · 둘 다 없으면 NO_SIZE · 루트 svg 하나만 · xmlns 는 걷는다(마스크 URL 을 만들 때 다시 붙인다). */
  var SHAPE_ALLOWED = { svg: 1, g: 1, path: 1, rect: 1, circle: 1, ellipse: 1, line: 1, polyline: 1, polygon: 1, defs: 1, clippath: 1, mask: 1, use: 1, symbol: 1,
    lineargradient: 1, radialgradient: 1, stop: 1 };
  var SHAPE_USE_MAX = 64;
  var _badVal = function (v) { return v.indexOf('\\') >= 0 || /:\/\/|javascript:|data:|@import/i.test(v) || /url\(\s*['"]?\s*[^#'"\s]/i.test(v); };
  function sanitizeShapeSvg(text) {
    var L = LIM();
    if (typeof text !== 'string' || !/<svg[\s>]/i.test(text)) return { ok: false, code: 'NOT_SVG' };
    if (text.length > L.SHAPE_SVG_MAX * 8) return { ok: false, code: 'TOO_LARGE' };   // 파싱 전 거친 상한(정규화 뒤 길이는 아래서 다시 잰다)
    if (typeof document === 'undefined') return { ok: false, code: 'NO_DOM' };
    var clean = (root && typeof root.sanitizeCanvasHtml === 'function') ? root.sanitizeCanvasHtml(text) : text;
    var tpl = document.createElement('template');
    try { tpl.innerHTML = clean; } catch (_) { return { ok: false, code: 'NOT_SVG' }; }
    var svg = tpl.content.querySelector('svg');
    if (!svg) return { ok: false, code: 'NOT_SVG' };
    Array.prototype.slice.call(svg.querySelectorAll('*')).forEach(function (el) {
      if (!svg.contains(el)) return;
      var name = (el.localName || '').toLowerCase();
      if (name === 'a') { while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.remove(); return; }
      if (!SHAPE_ALLOWED[name] || name === 'svg') { el.remove(); return; }   // 안쪽 svg · style 도 뺀다(루트 하나만 · 색 규칙 없음)
    });
    var walker = document.createTreeWalker(svg, 128 /* SHOW_COMMENT */), dead = [];
    while (walker.nextNode()) dead.push(walker.currentNode);
    dead.forEach(function (n) { n.remove(); });
    [svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*'))).forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var n = a.name.toLowerCase(), v = a.value || '';
        if (n.indexOf(':') >= 0) {
          el.removeAttributeNode(a);
          if (n === 'xlink:href' && /^\s*#/.test(v) && !el.hasAttribute('href')) el.setAttribute('href', v.trim());
          return;
        }
        if (n.indexOf('on') === 0 || n === 'xmlns' || _badVal(v) || (n === 'href' && !/^\s*#/.test(v))) el.removeAttributeNode(a);
      });
    });
    var uses = Array.prototype.slice.call(svg.querySelectorAll('use'));
    if (uses.length > SHAPE_USE_MAX) return { ok: false, code: 'TOO_COMPLEX' };
    if (uses.length) {
      var byId = Object.create(null);
      Array.prototype.slice.call(svg.querySelectorAll('[id]')).forEach(function (el) { var id = el.getAttribute('id'); if (!(id in byId)) byId[id] = el; });
      for (var ui = 0; ui < uses.length; ui++) {
        var ref = (uses[ui].getAttribute('href') || '').trim(), tgt = ref.charAt(0) === '#' ? byId[ref.slice(1)] : null;
        if (!tgt) { uses[ui].remove(); continue; }
        if ((tgt.localName || '').toLowerCase() === 'use' || tgt.querySelector('use')) return { ok: false, code: 'TOO_COMPLEX' };
      }
    }
    if (!svg.querySelector('*')) return { ok: false, code: 'EMPTY' };
    var asp = shapeAspect('<svg' + (svg.hasAttribute('viewBox') ? ' viewBox="' + svg.getAttribute('viewBox') + '"' : '')
      + (svg.hasAttribute('width') ? ' width="' + svg.getAttribute('width') + '"' : '') + (svg.hasAttribute('height') ? ' height="' + svg.getAttribute('height') + '"' : '') + '>');
    if (!asp) return { ok: false, code: 'NO_SIZE' };
    var vb = svg.getAttribute('viewBox');
    var vbOk = vb != null && vb.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite).length === 4;
    ['width', 'height', 'x', 'y', 'preserveAspectRatio'].forEach(function (k) { svg.removeAttribute(k); });
    svg.setAttribute('viewBox', vbOk ? vb.trim().split(/[\s,]+/).map(Number).join(' ') : '0 0 ' + asp.w + ' ' + asp.h);
    svg.setAttribute('preserveAspectRatio', 'none');   // 상자가 viewBox 비라 늘어나지 않는다 — 소수 px 띠만 없앤다
    var out = new XMLSerializer().serializeToString(svg).replace(/\sxmlns(:[\w-]+)?="[^"]*"/g, '');
    if (!shapeAspect(out)) return { ok: false, code: 'NO_SIZE' };
    if (out.length > L.SHAPE_SVG_MAX) return { ok: false, code: 'TOO_LARGE' };
    return { ok: true, svg: out };
  }

  /* ── 깔때기 하나: 모양을 «쓰는» 유일한 길(패널 select · 파일 · 항목 버튼 · 자동화가 전부 이것만 부른다) ──
   * setGraphShape(blockOrId, { shape?, svg?, index? }) → { ok, code? }
   *   svg 가 있으면 소독해 custom 으로 · shape 가 내장 이름이면 그 모양 · shape 가 null/'' 이면 키를 «지운다»(사각 막대로 복귀 · 빈 글자를 안 남긴다).
   *   index 가 있으면 그 항목만(items[i].shape / shapeSvg) — 0 이상 · 항목 수 미만의 «정수»가 아니면 BAD_INDEX('__proto__' 같은 글자 키를 안 받는다).
   *   히스토리는 «부른 쪽»이 바꾼 뒤 찍는다. 실패하면 dataset 을 안 건드린다. */
  function _blockOf(b) {
    var el = (typeof b === 'string') ? (typeof document !== 'undefined' ? document.getElementById(b) : null) : b;
    return (el && el.classList && el.classList.contains('graph-block')) ? el : null;
  }
  function setGraphShape(blockOrId, opts) {
    var block = _blockOf(blockOrId);
    if (!block) return { ok: false, code: 'NOT_FOUND' };
    opts = opts || {};
    var items = null;
    if (opts.index != null) {
      try { items = JSON.parse(block.dataset.items || '[]'); } catch (_) { items = []; }
      if (!Array.isArray(items)) items = [];
      if (!Number.isInteger(opts.index) || opts.index < 0 || opts.index >= items.length) return { ok: false, code: 'BAD_INDEX' };
    }
    var shape = opts.shape, svg = null;
    if (opts.svg != null) {
      var r = sanitizeShapeSvg(opts.svg);
      if (!r.ok) return r;
      shape = 'custom'; svg = r.svg;
    } else if (shape != null && shape !== '') {
      if (shape === 'custom') {
        var cur = opts.index != null ? null : block.dataset.shapeSvg;
        if (!cur) return { ok: false, code: 'NO_SVG' };
        svg = cur;
      } else if (!shapeSvgOf(shape)) return { ok: false, code: 'UNKNOWN_SHAPE' };
    }
    var off = shape == null || shape === '';
    if (items) {
      var it = items[opts.index];
      if (!it || typeof it !== 'object') return { ok: false, code: 'NO_ITEM' };
      delete it.shape; delete it.shapeSvg;
      if (!off) { it.shape = shape; if (svg) it.shapeSvg = svg; }
      block.dataset.items = JSON.stringify(items);
    } else if (off) {
      delete block.dataset.barShape; delete block.dataset.shapeSvg;
    } else {
      block.dataset.barShape = shape;
      if (svg) block.dataset.shapeSvg = svg;   // 내장 모양으로 바꿔도 불러온 SVG 는 남긴다(다시 「사용자 SVG」로 돌아갈 수 있게 · 원형↔도넛의 pieHole 과 같은 꼴)
    }
    if (root && typeof root.renderGraph === 'function') root.renderGraph(block);
    return { ok: true, shape: off ? null : shape };
  }

  /* ── AE 가 읽을 모델 ──────────────────────────────────────────────────────
   * graphFillModel(blockOrId) → { shape, shapeSvg, dir, max, items:[{ label, value, ratio, segments:[{ label, ratio, color }] }] } | null
   *   shape    'person' 같은 이름 · 'custom' · null(사각)      shapeSvg  그릴 SVG 글자(내장이면 내장 글자 · 사각이면 null)
   *   dir      채움 방향(지금은 늘 'up')                       max       채움 분모(위 fillPlan 의 denom — 렌더가 나누는 바로 그 수:
   *                                                                     모양이면 fillMax · 사각이면 max(items), 축·격자가 켜졌으면 그 «깔끔한 상한»)
   *   value    그 항목의 값(마디가 있으면 마디 합)
   *   ratio    값 / max 를 0~1 로 자른 것(소수 3자리 = data-fill)   segments[].ratio  그 항목 «채움 안에서의» 몫(합 1) · color 는 정한 색 아니면 null */
  function graphFillModel(blockOrId) {
    var block = _blockOf(blockOrId);
    if (!block) return null;
    var d = block.dataset, items;
    try { items = JSON.parse(d.items || '[]'); } catch (_) { items = []; }
    if (!Array.isArray(items)) items = [];
    var max = fillPlan(d, items).denom;
    var shape = shapeOn(d) ? d.barShape : null;
    return {
      shape: shape,
      shapeSvg: shape ? (shapeSvgOf(shape, d.shapeSvg) || null) : null,
      dir: d.fillDir || 'up',
      max: max,
      items: items.map(function (it) {
        it = it || {};
        var segs = _hasSegs(it) ? it.segments : [];
        var value = segs.length ? segSum(segs) : num(it.value);
        var rs = segRatios(segs).ratios;
        var out = { label: String(it.label == null ? '' : it.label), value: value, ratio: _r3(fillRatio(value, max)),
          segments: segs.map(function (s, j) { return { label: String(s && s.label != null ? s.label : ''), ratio: _r3(rs[j]), color: (s && typeof s.color === 'string' && s.color) ? s.color : null }; }) };
        if (shape && it.shape) { out.shape = it.shape; if (it.shape === 'custom' && it.shapeSvg) out.shapeSvg = it.shapeSvg; }
        return out;
      }),
    };
  }

  var GRAPH_SHAPE = Object.freeze({ GRAPH_SHAPE_PRESETS: GRAPH_SHAPE_PRESETS, fillRatio: fillRatio, segRatios: segRatios, segSum: segSum, segAlpha: segAlpha,
    shapeAspect: shapeAspect, shapeMaskUrl: shapeMaskUrl, shapeSvgOf: shapeSvgOf, shapeOn: shapeOn, usesShape: usesShape, fillMaxOf: fillMaxOf, fillPlan: fillPlan,
    normSegments: normSegments, carryItemExtras: carryItemExtras, fitSegments: fitSegments, reconcileItems: reconcileItems, shapeColsHTML: shapeColsHTML, sanitizeShapeSvg: sanitizeShapeSvg, setGraphShape: setGraphShape, graphFillModel: graphFillModel });
  if (typeof module !== 'undefined' && module.exports) module.exports = GRAPH_SHAPE;
  if (root) { root.GRAPH_SHAPE = GRAPH_SHAPE; root.setGraphShape = setGraphShape; root.graphFillModel = graphFillModel; }
})(typeof window !== 'undefined' ? window : null);
