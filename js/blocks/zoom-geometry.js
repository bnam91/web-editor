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
export const ZOOM_RECT_RATIO = 0.625;   // 가로:세로 = 1.6 : 1

/** 그림자 띠 개수. 많을수록 매끈하지만 노드가 늘어난다(64 = 실측상 밴딩 안 보임). */
export const ZOOM_STRIP_COUNT = 64;

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

/** A·B 를 서로 밀어 «벌린다»(spread px, 총량). AB 가 한 점이면(퇴화) 그대로 둔다. */
export function applySpread(A, B, spread) {
  var s = Number(spread) || 0;
  if (!s) return [A, B];
  var dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
  if (!(d > 1e-6)) return [A, B];
  var ux = dx / d, uy = dy / d, h = s / 2;
  return [{ x: A.x - ux * h, y: A.y - uy * h }, { x: B.x + ux * h, y: B.y + uy * h }];
}

/* a·b 자동값: A·B 를 광원 쪽으로 좁혀서.
   mid=(A+B)/2, k=1-narrow/100 → 짧은 변은 «광원 위에» 중심을 두고 AB 폭의 k 배가 된다. */
export function autoShortEdge(A, B, L, narrow) {
  var mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  var k = 1 - (Number(narrow) || 0) / 100;
  return [{ x: L.x + (A.x - mid.x) * k, y: L.y + (A.y - mid.y) * k },
          { x: L.x + (B.x - mid.x) * k, y: L.y + (B.y - mid.y) * k }];
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
 * @param {object} st  {shape,angle,length,spread,maxop,curve,narrow,size,rot}
 * @param {?object} pinned  {a:{x,y}, b:{x,y}} — 사람이 «끈» a·b. 없으면 «언제나» 자동.
 */
export function computeZoomGeometry(st, pinned) {
  /* ★실루엣 = «보이는 바깥 윤곽»이다 (지디 판정 2026-09-08).
       ⑴ 물리적으로 — 빛은 테두리에도 막힌다. 링이 있는데 그림자가 그 «안»에서 나오면 링이 떠 보인다.
       ⑵ 사용자 눈에 테두리는 «그 도형의 일부»다.
     ⛔bd==='off' 면 bw=0 이라 도형 실루엣 그대로다 — 예전 동작이 그대로 남는다.
     ⚠️알려진 한계: bdr(모서리 라운드)은 실루엣에 «안» 들어간다(꼭짓점 기준). 라운드가 크면
       사다리꼴 붙는 점이 모서리에서 살짝 뜬다 — 지디 판단으로 지금은 안 고친다. */
  var half = (Number(st.size) || 0) / 2;
  var bw = borderWidthOf(st);
  var L = lightPoint(st.angle, st.length, 0, 0);
  var sil = (st.shape === 'circle')
    ? silhouetteCircle(half + bw, L, 0, 0)
    : silhouetteFromPts(shapeCornerPts(st, bw), L, 0, 0);
  var sp = applySpread(sil[0], sil[1], st.spread);
  var A = sp[0], B = sp[1];
  var auto = autoShortEdge(A, B, L, st.narrow);
  var a = (pinned && pinned.a) ? pinned.a : auto[0];
  var b = (pinned && pinned.b) ? pinned.b : auto[1];
  return { L: L, A: A, B: B, a: a, b: b, autoA: auto[0], autoB: auto[1], r: half, bw: bw };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SVG 조립 — ★여기도 «순수»다.
   렌더 문자열을 zoom-block.js 에 두면 검사가 「기하는 실행으로, 그림은 눈으로」로 갈린다.
   여기 두면 검사가 «실제로 나가는 마크업»을 그대로 받아 잴 수 있다.
   ═══════════════════════════════════════════════════════════════════════════ */

export const ZOOM_PAD = 14;        // 뷰박스 여백(px)
export const ZOOM_HANDLE_R = 5;    // a·b 핸들 반지름(px)

/* 색을 마크업에 넣기 전 거른다 — 색 문자열로 태그가 끼어들 자리를 아예 없앤다.
   허용: #hex · rgb()/rgba()/hsl()/hsla() · CSS 변수 · 이름색. 걸리면 fallback. */
export function safeColor(v, fallback) {
  const s = String(v ?? '').trim();
  return /^[#a-zA-Z0-9(),.%\s_-]{1,64}$/.test(s) ? s : fallback;
}

/* 도형 하나를 그린다. grow>0 이면 «바깥으로» 그만큼 키운 판(=테두리)이다.
   ★rect/square 는 polygon 이 아니라 <rect rx>+rotate 로 그린다 — 모서리 라운드(bdr)를
     회전과 «같이» 쓰려면 그 길뿐이다. 실루엣 계산(shapePts)은 그대로 꼭짓점을 쓴다. */
function shapeEl(st, grow, fill, cls) {
  const half = (Number(st.size) || 0) / 2;
  const bdr = Math.max(0, Number(st.bdr) || 0);
  if (st.shape === 'circle') {
    return `<${''}circle class="${cls}" cx="0" cy="0" r="${(half + grow).toFixed(2)}" fill="${fill}"/>`;
  }
  const hw = half + grow;
  const hh = (st.shape === 'rect' ? half * ZOOM_RECT_RATIO : half) + grow;
  // ★테두리판의 모서리는 «도형 모서리 + 두께» 여야 링 두께가 어디서나 같다(동심 오프셋).
  const rx = grow > 0 ? (bdr > 0 ? bdr + grow : 0) : bdr;
  const rot = Number(st.rot) || 0;
  return `<rect class="${cls}" x="${(-hw).toFixed(2)}" y="${(-hh).toFixed(2)}" ` +
    `width="${(hw * 2).toFixed(2)}" height="${(hh * 2).toFixed(2)}" rx="${rx.toFixed(2)}"` +
    `${rot ? ` transform="rotate(${rot})"` : ''} fill="${fill}"/>`;
}

export function shapeMarkup(st) {
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
  const half = (Number(st.size) || 0) / 2;
  const hw = half + grow;
  const hh = (st.shape === 'rect' ? half * ZOOM_RECT_RATIO : half) + grow;
  const th = (Number(st.rot) || 0) * Math.PI / 180;
  const co = Math.cos(th), si = Math.sin(th);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
    .map(p => ({ x: p[0] * co - p[1] * si, y: p[0] * si + p[1] * co }));
}

/** 도형(+테두리)이 차지하는 «실제» 꼭짓점 — 뷰박스가 이걸 담아야 테두리가 안 잘린다. */
export function outerExtentPts(st) {
  const bw = borderWidthOf(st);
  const half = (Number(st.size) || 0) / 2;
  if (st.shape === 'circle') {
    const R = half + bw;
    return [{ x: -R, y: -R }, { x: R, y: R }];
  }
  return shapeCornerPts(st, bw);
}

/**
 * 확대블럭의 SVG 전부. 도형 중심이 (0,0) 인 좌표계로 그리고, 뷰박스가 그 상자를 담는다.
 * ★그리는 순서 = 그림자 → 테두리판 → 도형 → 핸들. 도형이 «가장 진한 끝»을 덮어야 사다리꼴이 도형에 «붙는다».
 * ★a·b 핸들은 «항상» 그린다 — 보이기는 CSS(.zoom-block.selected)가 정한다.
 *   선택은 renderZoomBlock 을 다시 부르지 않으므로 렌더 시점의 선택상태에 기대면 안 된다.
 */
/** 뷰박스 상자 — 조립기와 «선택 상자»가 같은 좌표계를 봐야 해서 한 자리로 뽑았다. */
export function zoomBox(st, pinned) {
  const geo = computeZoomGeometry(st, pinned);
  const ok = shadowVisible(st, geo);
  const pts = [
    ...outerExtentPts(st),
    ...(ok ? [geo.A, geo.B, geo.a, geo.b, geo.L] : []),
  ];
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs) - ZOOM_PAD, maxX = Math.max(...xs) + ZOOM_PAD;
  const minY = Math.min(...ys) - ZOOM_PAD, maxY = Math.max(...ys) + ZOOM_PAD;
  return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY), geo, ok };
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

/**
 * ★선택 아웃라인이 «shape 모양»을 따라가게 하는 상자 (현빈 2026-09-08).
 *   js/selection-overlay.js 의 _geomOf 는 «요소의 상자 + computed border-radius»로 모양을 만든다
 *   (원을 따로 아는 게 아니라 border-radius:50% 를 읽어서 원을 그린다).
 *   ⇒ 그 길에 태우는 방법 = «도형과 똑같은 상자»를 하나 두는 것이다. _geomOf 는 안 건드린다.
 *   ⛔.zoom-block 자신은 못 쓴다 — 행 전체 폭이라 상자가 그림자까지 감싼다.
 *   ⚠️테두리가 켜져 있으면 아웃라인도 «테두리 바깥»을 따른다(그림자와 같은 축).
 *   ⚠️회전은 CSS transform 이 아니라 data-rotation 으로 준다 — _cornerScreen 이 «그것»을 읽는다.
 */
export function selBoxSpec(st, pinned) {
  const half = (Number(st.size) || 0) / 2;
  const bw = borderWidthOf(st);
  const circle = st.shape === 'circle';
  const hw = half + bw;
  const hh = (circle ? half : (st.shape === 'rect' ? half * ZOOM_RECT_RATIO : half)) + bw;
  const bdr = Math.max(0, Number(st.bdr) || 0);
  const box = zoomBox(st, pinned);
  return {
    w: hw * 2, h: hh * 2,
    radius: circle ? '50%' : ((bdr > 0 ? bdr + bw : 0).toFixed(2) + 'px'),
    left: -box.minX - hw, top: -box.minY - hh,
    rot: circle ? 0 : (Number(st.rot) || 0),   // 원은 돌려도 같은 모양이다
  };
}

export function selBoxMarkup(st, pinned) {
  const s = selBoxSpec(st, pinned);
  return `<div class="zoom-sel-box" data-sel-box data-sel-variant="sticker"` +
    (s.rot ? ` data-rotation="${s.rot}"` : '') +
    ` style="left:${s.left.toFixed(2)}px;top:${s.top.toFixed(2)}px;` +
    `width:${s.w.toFixed(2)}px;height:${s.h.toFixed(2)}px;border-radius:${s.radius};"></div>`;
}

/** 블록 안에 실제로 들어가는 것 전부 — SVG + (보이지 않는) 선택 상자. */
export function buildZoomStage(st, pinned) {
  return `<div class="zoom-stage">${buildZoomSvg(st, pinned)}${selBoxMarkup(st, pinned)}</div>`;
}

export function buildZoomSvg(st, pinned) {
  const box = zoomBox(st, pinned);
  const geo = box.geo, ok = box.ok;

  const shadow = ok
    ? strips(geo.A, geo.B, geo.a, geo.b, ZOOM_STRIP_COUNT, (Number(st.curve) || 100) / 100, (Number(st.maxop) || 0) / 100)
    : '';

  const handles = ok ? `<g class="zoom-handles">` +
    `<circle class="zoom-handle" data-pt="a" cx="${geo.a.x.toFixed(2)}" cy="${geo.a.y.toFixed(2)}" r="${ZOOM_HANDLE_R}"/>` +
    `<circle class="zoom-handle" data-pt="b" cx="${geo.b.x.toFixed(2)}" cy="${geo.b.y.toFixed(2)}" r="${ZOOM_HANDLE_R}"/>` +
    `</g>` : '';

  return `<svg class="zoom-svg" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" ` +
    `viewBox="${box.minX.toFixed(2)} ${box.minY.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `<g class="zoom-shadow">${shadow}</g>${borderMarkup(st)}${shapeMarkup(st)}${handles}</svg>`;
}
