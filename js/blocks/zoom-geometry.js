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
  var hw = shapeHalf(st).hw;
  var bw = borderWidthOf(st);
  var L = lightPoint(st.angle, st.length, 0, 0);
  var sil = (st.shape === 'circle')
    ? silhouetteCircle(hw + bw, L, 0, 0)
    : silhouetteFromPts(shapeCornerPts(st, bw), L, 0, 0);
  var sp = applySpread(sil[0], sil[1], st.spread);
  var A = sp[0], B = sp[1];
  var auto = autoShortEdge(A, B, L, st.narrow);
  var a = (pinned && pinned.a) ? pinned.a : auto[0];
  var b = (pinned && pinned.b) ? pinned.b : auto[1];
  return { L: L, A: A, B: B, a: a, b: b, autoA: auto[0], autoB: auto[1], r: hw, bw: bw };
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

/** 체크패턴 층 — «도형» 상자다(테두리 제외). ★좌표는 «클리핑 층» 기준(off 만큼 되민다). */
export function bgMarkup(st, pinned) {
  if (st.fill !== ZOOM_CHECKER) return '';
  const bw = borderWidthOf(st);
  const half = shapeHalf(st);
  const hw = half.hw, hh = (st.shape === 'circle') ? half.hw : half.hh;
  const bdr = Math.max(0, Number(st.bdr) || 0);
  const rot = (st.shape === 'circle') ? 0 : (Number(st.rot) || 0);
  const off = svgOffset(st, pinned);
  return `<div class="zoom-bg" style="left:${(bw - off.left).toFixed(2)}px;top:${(bw - off.top).toFixed(2)}px;` +
    `width:${(hw * 2).toFixed(2)}px;height:${(hh * 2).toFixed(2)}px;` +
    `border-radius:${st.shape === 'circle' ? '50%' : bdr.toFixed(2) + 'px'};` +
    (rot ? `transform:rotate(${rot}deg);` : '') + `"></div>`;
}

/* a·b 핸들 — ★별도 층이다.
   ★picked('a'|'b'|null) = 사람이 «집은» 앵커. 어도비 일러스트 관례대로 «채움»만 바뀐다
     (안 집힌 것 = 흰 채움 · 집힌 것 = 파란 채움, 테두리 색은 둘 다 같다 — 현빈이 준 그림 그대로).
   ⛔이 상태는 dataset 이 아니라 «JS 속성»으로 온다 — 저장본(캔버스 HTML 스냅샷)에 실리면
     안 되는 «조작 중» 상태다(section-serialize 가 임시 클래스를 털어내는 것과 같은 이유). */
/** a·b 핸들 — ★별도 층이다. 체크 배경이 SVG 위에 올라오므로 핸들이 그 «위»에 있어야 한다. */
export function handleLayerMarkup(st, pinned, picked) {
  const box = zoomBox(st, pinned);
  if (!box.ok) return '';
  const geo = box.geo;
  return `<svg class="zoom-handle-layer" ` +
    `width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" ` +
    `viewBox="${box.minX.toFixed(2)} ${box.minY.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `<circle class="zoom-handle" data-pt="a"${picked === 'a' ? ' data-picked="true"' : ''} cx="${geo.a.x.toFixed(2)}" cy="${geo.a.y.toFixed(2)}" r="${ZOOM_HANDLE_R}"/>` +
    `<circle class="zoom-handle" data-pt="b"${picked === 'b' ? ' data-picked="true"' : ''} cx="${geo.b.x.toFixed(2)}" cy="${geo.b.y.toFixed(2)}" r="${ZOOM_HANDLE_R}"/>` +
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
