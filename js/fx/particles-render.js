/* ═══════════════════════════════════════════════════════════════════════════
   fx/particles-render.js — 파티클(반짝이) 이펙트의 «그림» (SVG 문자열을 짓는 순수 함수).
   ───────────────────────────────────────────────────────────────────────────
   ★현빈 발주 원문(2026-10-06) — 「파티클, 반짝이 이펙트? 를 넣을 수 있게 하려는데 … 이게 랜덤으로
     매번 효과가 들어가면 좋을 것 같은데, 이게 주로 ★섹션 배경에 들어갈거란 말야 … 갯수나 배경,
     파티클 색 및 프리셋이 몇개 있어도 좋긴 할거야」 / 「랜덤으로 하고, ★클릭할때마다 바뀌는거야」
   ★★현빈 2026-10-07 — 「파티클 시안은 진행하면되는데 ★★배경색이 ★계속 바뀌면 ★안되는거 알지?」
     ⇒ ★★이 파일의 ★첫 번째 계약: ★파티클은 ★섹션 배경색을 ★«읽지도 쓰지도» 않는다.
        ⒜ PRESETS 에 ★bg 키가 ★없다 — 프리셋은 ★파티클 값만 바꾼다.
        ⒝ 그려 주는 SVG 에 ★배경 사각형이 ★없다 — 투명한 층이다(섹션 배경이 그대로 비친다).
           ⚠️지디 시안(goditor-effects-particles.html:525)은 캔버스를 보이게 하려고 bg 로 채운
             rect 를 넣는다. ⛔그 한 줄을 ★베끼지 마라 — 섹션 배경색은 «섹션 것»이고
             (js/props/prop-section.js:138 sec.style.backgroundColor = color), 이 층이 덮으면
             ★사용자가 고른 배경색이 ★프리셋을 고를 때마다 사라진다 = 현빈이 ★막은 바로 그것.
        ⒞ 파티클 색이 배경에서 안 보이면 ⇒ ★사용자가 색을 고르는 문제다. 우리가 배경을 안 바꾼다.
           (배경 휘도를 «읽어» 기본 팔레트를 고르는 것은 ★별개 판단 — 이 파일은 lum 을 내어만 준다.)
   ★★정지 ★한 장면이다 — ⛔애니메이션이 아니다. 「단추를 누르면 ★주사위를 굴린다」
     (지디 2026-10-06 ⑴: AE 로 치면 타임라인에서 ★마음에 드는 한 프레임을 ★골라 쓰는 것)
   ★★SVG <filter> 로 짓는다 — ⛔CSS filter(drop-shadow)·mix-blend-mode 를 쓰지 마라.
     까닭(실측 084e528c · js/fx/glow-render.js:7~10): ★SVG feGaussianBlur 는 내보내기 ★두 경로
     (PNG CDP · 썸네일 html2canvas) 다 살고, ★CSS drop-shadow 와 mix-blend-mode 는 html2canvas 에서 ★죽는다.
   ★★시드가 정본이다 — ⛔Math.random 을 이 파일에서 부르지 마라(리로드·썸네일·undo 마다 모습이 바뀐다).
     공용 부품 js/fx/seeded-random.js 의 FxSeed.mulberry32 를 쓴다(소비자 ②).
   ★★필터 id 는 ★호출자가 준다 — 섹션이 여럿이면 한 문서에 필터가 여럿이다.
     ⚠️시안은 id 를 'pglow' 로 ★박았다. ⛔그걸 베끼면 ★둘째 섹션부터 ★첫 섹션의 필터를 쓴다
       (SVG id 는 ★문서 전역). 선례도 호출자가 준다(glow-render.js:13 'fxg-<id>').
   ★★상한 60/섹션 — ⛔거절이 아니라 ★「60 까지만 그린다」.
     ★현빈 확정 2026-10-07 — 「개수는 ★상한 60개로 하자 컨페티나 파티클」(지디 전달). 옛 값은 320 이었다.
     ⚠️★태양 M4 표의 `20×320`(썸네일 8.9~10.7 s) 칸은 ★★이제 «범위 밖»이다 — ⛔근거로 쓰지 마라.
       ★상한 60 에서의 무게는 ★★미측정이다(2026-10-07 — load 가 높아 수트 창이 닫혔다).
       ★지금 아는 것은 ★노드 수뿐이다 — estimateNodes() 가 그것을 «계산»해 준다(⛔산문에 손으로 박지 않게).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  /** ★섹션 하나에 그리는 입자 수의 상한. ⛔막지 않는다 — 넘으면 자른다. */
  const MAX_COUNT = 60;

  /* ★모양 다섯 — 이름은 시안과 «같게» 둔다(시안이 사람에게 보여 준 어휘가 그대로 저장본에 들어간다). */
  const SHAPES = Object.freeze(['rect', 'ribbon', 'circle', 'star4', 'tri']);

  /* ★프리셋 넷 — ⛔bg 키가 ★없다(위 머리말 ⒜ · 현빈 2026-10-07).
     ★현빈 확정 2026-10-07: 「프리셋은 넷이면 충분하다 · 알맹이모양도 지금 충분하다. 이대로 유지」 ⇒ ⛔더 늘리지 마라.
     ★기본 색은 «값만» 바꾸면 되게 여기 한 자리에 둔다(글로우 PRESETS 와 같은 결).
     ★fxOpacity — 이름을 ★글로우와 «같게» 쓴다(지디 2026-10-06 · 9f062a5c 로 미리 맞춰 둔 이름).
       ⛔alpha·opacity 로 갈라 쓰면 다음 사람이 두 벌로 읽는다.
     ★★count 는 상한이 320→60 이 되며 «비례로» 줄였다(2026-10-07) — 기준은 가장 많던 party 130→60(×60/130):
       star 90→42 · gold 70→32 · party 130→60 · dust 60→28.
       ★까닭: 시안이 현빈에게 보여 준 «프리셋 사이의 상대 밀도»를 보존한다(컨페티가 가장 촘촘하고 보케가 가장 성기다).
       ⚠️★이 네 수는 ★디자인 값이다 — ★지디 판정 대기 중이고, 바꾸라면 ★여기 한 줄만 고치면 된다.
       ⛔프리셋 count 가 MAX_COUNT 를 넘으면 안 된다: 넘으면 패널이 보여 주는 수와 그려지는 수가 ★갈린다
         (normalize 가 조용히 자르므로 «동작»은 맞지만 «표»가 거짓말을 한다). 그 금지는 unit 이 잰다. */
  const PRESETS = Object.freeze({
    star:  Object.freeze({ label: '별 반짝이',   count: 42,  shapes: Object.freeze(['star4', 'star4', 'circle']),
                           colors: Object.freeze(['#FFFFFF', '#FFE9FF', '#C9A8FF', '#8E6BE0']),
                           smin: 3, smax: 14, rot: true,  dist: 'even', glow: 55, spread: 6,  fxOpacity: 100, jit: 60 }),
    gold:  Object.freeze({ label: '금색 컨페티', count: 32,  shapes: Object.freeze(['rect', 'ribbon']),
                           colors: Object.freeze(['#F5C542', '#E8B22A', '#FFE9A8', '#C98A14']),
                           smin: 6, smax: 22, rot: true,  dist: 'top',  glow: 0,  spread: 0,  fxOpacity: 100, jit: 25 }),
    party: Object.freeze({ label: '컬러 컨페티', count: 60,  shapes: Object.freeze(['rect', 'tri', 'ribbon']),
                           colors: Object.freeze(['#2D6FE8', '#F5C542', '#E0402C', '#28B463', '#FFFFFF']),
                           smin: 5, smax: 18, rot: true,  dist: 'even', glow: 0,  spread: 0,  fxOpacity: 100, jit: 15 }),
    dust:  Object.freeze({ label: '먼지 / 보케', count: 28,  shapes: Object.freeze(['circle']),
                           colors: Object.freeze(['#FFFFFF', '#FFE6B8', '#BFD8FF']),
                           smin: 4, smax: 28, rot: false, dist: 'edge', glow: 70, spread: 14, fxOpacity: 80, jit: 85 }),
  });
  const KINDS = Object.freeze(Object.keys(PRESETS));
  const DISTS = Object.freeze(['even', 'top', 'edge']);

  /* ★범위 — 패널이 이 표를 읽어 슬라이더 min/max 를 짓는다(⛔수를 패널에 또 적지 않게).
     ★명부가 둘이면 어느 날 갈린다 — 그 교훈이 레포 곳곳에 적혀 있다. */
  const RANGES = Object.freeze({
    count:     Object.freeze({ min: 0, max: MAX_COUNT }),
    smin:      Object.freeze({ min: 1, max: 90 }),
    smax:      Object.freeze({ min: 1, max: 90 }),
    glow:      Object.freeze({ min: 0, max: 100 }),
    spread:    Object.freeze({ min: 0, max: 20 }),
    fxOpacity: Object.freeze({ min: 0, max: 100 }),
    jit:       Object.freeze({ min: 0, max: 100 }),
  });

  const r1 = (n) => Math.round(n * 10) / 10;       // 문자열이 기계·판마다 같게(결정성) — 시안과 같은 자리수
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const HEX = /^#[0-9a-fA-F]{3,8}$/;
  const safeColor = (c, fb) => (typeof c === 'string' && (HEX.test(c) || /^rgba?\([0-9.,\s%]+\)$/i.test(c))) ? c : fb;
  const num = (v, fb) => (Number.isFinite(+v) ? +v : fb);

  /** 이 설정이 그릴 ★SVG 요소 수 — ⛔패널 안내 문구에 수를 «손으로» 박지 않게 여기서 «계산»해 준다.
   *  ★지디 2026-10-07: 「후광을 켜면 그리는 양이 약 2배」를 안내로 두되 ★그 수를 상수에서 끌어내라.
   *    ⇒ 상한이 또 바뀌어도 문구가 ★조용히 거짓이 되지 않는다(★산문은 말만 쓰고 수는 데이터에서).
   *  ★후광이 켜지면 조각을 ★두 벌 그린다(번짐 층 + 또렷 층) ＋ 필터 정의가 9 요소.
   *  ⚠️★태양 표의 공식(갯수×2+14)과 ★1 씩 다르다 — ★시안엔 ★배경 rect 가 하나 더 있었고 ★우리는 그것을 뺐다.
   *    ⇒ ★이 수가 맞는지는 ⛔공식을 믿지 말고 ★svg() 를 돌려 센 값과 견준다(tests/unit/fx-particles-render P10). */
  function estimateNodes(p) {
    const st = normalize(p);
    const haloOn = st.glow > 0 && st.spread > 0 && st.count > 0;
    // <svg> + <g layer> + <g 또렷> = 3 · 후광이면 ＋<defs><filter><feGaussianBlur>×3<feMerge><feMergeNode>×3 = 9, ＋<g halo> = 1
    return haloOn ? (st.count * 2 + 13) : (st.count + 3);
  }

  /** 배경 휘도 0~1 — ⛔배경을 «쓰는» 길이 아니다. «읽어» 기본 팔레트를 고르려는 쪽이 쓴다(판단은 호출자). */
  function lum(color) {
    const s = String(color || '').trim();
    let r, g, b;
    const m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) { const p = m[1].split(','); r = parseFloat(p[0]); g = parseFloat(p[1]); b = parseFloat(p[2]); }
    else {
      let h = s.replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;      // ⛔0 을 돌려주지 않는다 — 「못 읽었다」와 「검정」은 다르다
      const n = parseInt(h, 16); r = n >> 16 & 255; g = n >> 8 & 255; b = n & 255;
    }
    if (![r, g, b].every(Number.isFinite)) return null;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  /** 도형 한 개를 SVG 글자로 — 시안 shapeSVG 와 «같은 그림»(지디 시안이 현빈에게 보여 준 그 모양). */
  function shapeSVG(kind, x, y, s, rot, c, op) {
    const o = ' fill="' + c + '"' + (op < 0.999 ? ' opacity="' + (Math.round(op * 100) / 100) + '"' : '');
    const tr = rot ? ' transform="rotate(' + r1(rot) + ' ' + r1(x) + ' ' + r1(y) + ')"' : '';
    if (kind === 'circle') return '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + r1(s / 2) + '"' + o + '/>';
    if (kind === 'rect') {
      const wd = s, ht = s * 0.72;
      return '<rect x="' + r1(x - wd / 2) + '" y="' + r1(y - ht / 2) + '" width="' + r1(wd) + '" height="' + r1(ht)
           + '" rx="' + r1(Math.min(2, s * 0.12)) + '"' + tr + o + '/>';
    }
    if (kind === 'ribbon') {
      const rw = s * 0.34, rh = s * 1.5;
      return '<rect x="' + r1(x - rw / 2) + '" y="' + r1(y - rh / 2) + '" width="' + r1(rw) + '" height="' + r1(rh)
           + '" rx="' + r1(rw / 2) + '"' + tr + o + '/>';
    }
    if (kind === 'tri') {
      const th = s * 0.9;
      return '<polygon points="' + r1(x) + ',' + r1(y - th / 2) + ' ' + r1(x + s / 2) + ',' + r1(y + th / 2)
           + ' ' + r1(x - s / 2) + ',' + r1(y + th / 2) + '"' + tr + o + '/>';
    }
    const R = s / 2, k2 = R * 0.2;                       // star4 — 4갈래 별
    return '<path d="M' + r1(x) + ',' + r1(y - R) + ' L' + r1(x + k2) + ',' + r1(y - k2)
         + ' L' + r1(x + R) + ',' + r1(y) + ' L' + r1(x + k2) + ',' + r1(y + k2)
         + ' L' + r1(x) + ',' + r1(y + R) + ' L' + r1(x - k2) + ',' + r1(y + k2)
         + ' L' + r1(x - R) + ',' + r1(y) + ' L' + r1(x - k2) + ',' + r1(y - k2) + ' Z"' + tr + o + '/>';
  }

  /** 들어온 값을 «그릴 수 있는 꼴»로 — 저장본이 낡았거나 사람이 손으로 적었어도 그림이 난다.
   *  ⛔여기서 bg 를 받지 않는다(머리말 ⒜). 돌려주는 객체에도 bg 가 없다. */
  function normalize(p) {
    const o = p || {};
    const preset = KINDS.includes(o.preset) ? o.preset : 'star';
    const pre = PRESETS[preset];
    const colors = (Array.isArray(o.colors) && o.colors.length ? o.colors : pre.colors)
      .slice(0, 8).map((c) => safeColor(c, '#ffffff'));
    const shapes = (Array.isArray(o.shapes) && o.shapes.length ? o.shapes : pre.shapes)
      .filter((k) => SHAPES.includes(k));
    const a = clamp(Math.round(num(o.smin, pre.smin)), RANGES.smin.min, RANGES.smin.max);
    const b = clamp(Math.round(num(o.smax, pre.smax)), RANGES.smax.min, RANGES.smax.max);
    return {
      preset,
      seed: num(o.seed, 1) >>> 0,                       // 0 도 정당한 seed(seeded-random.js 머리말)
      count: clamp(Math.round(num(o.count, pre.count)), 0, MAX_COUNT),   // ★상한에서 «자른다» — 거절 아님
      colors: colors.length ? colors : ['#ffffff'],
      shapes: shapes.length ? shapes : ['circle'],
      smin: Math.min(a, b), smax: Math.max(a, b),
      rot: o.rot === undefined ? pre.rot : (o.rot === true || o.rot === 'true' || o.rot === '1'),
      dist: DISTS.includes(o.dist) ? o.dist : pre.dist,
      glow: clamp(Math.round(num(o.glow, pre.glow)), RANGES.glow.min, RANGES.glow.max),
      spread: clamp(Math.round(num(o.spread, pre.spread)), RANGES.spread.min, RANGES.spread.max),
      fxOpacity: clamp(Math.round(num(o.fxOpacity, pre.fxOpacity)), RANGES.fxOpacity.min, RANGES.fxOpacity.max),
      jit: clamp(Math.round(num(o.jit, pre.jit)), RANGES.jit.min, RANGES.jit.max),
    };
  }

  /**
   * ★정본 생성기 — (시드 ＋ 설정 ＋ 상자 크기) 하나만 받아 SVG 글자를 돌려준다.
   * @param {object} p  normalize 가 받는 것 ＋ { filterId, w, h }
   *   w·h — 그릴 상자(= 섹션)의 크기. ★viewBox 를 상자와 «같게» 두어 입자가 안 찌그러진다
   *          (⛔preserveAspectRatio="none" 으로 늘이면 별이 타원이 된다).
   *   filterId — 후광 필터의 문서 전역 id. ★호출자가 준다(머리말).
   * @returns {string} SVG 한 장. ★배경이 ★없다(투명) — 섹션 배경색이 그대로 비친다.
   */
  function svg(p) {
    const st = normalize(p);
    const W = Math.max(1, Math.round(num(p && p.w, 860)));
    const H = Math.max(1, Math.round(num(p && p.h, 600)));
    const fid = String((p && p.filterId) || 'pfx-tmp').replace(/[^A-Za-z0-9_-]/g, '');
    const rnd = w.FxSeed.mulberry32(st.seed);
    const parts = [];
    const cols = st.colors, shs = st.shapes;
    for (let i = 0; i < st.count; i++) {
      /* ★난수는 입자마다 «항상 10번» 뽑는다 — 회전을 끄거나 분포를 바꿔도 다음 입자의 값이 안 밀린다.
         (시안 buildSVG 와 같은 흐름이어야 같은 seed 가 같은 그림을 낸다) */
      const q1 = rnd(), q2 = rnd(), q3 = rnd(), q4 = rnd(), qs = rnd(), qr = rnd(), qc = rnd(), qo = rnd(), qk = rnd(); rnd();
      let x, y; const bw = 0.26;
      if (st.dist === 'top') { x = q1 * W; y = Math.pow(q2, 2.1) * H; }
      else if (st.dist === 'edge') {
        if (q3 < 0.5) { x = (q4 < 0.5 ? q1 * bw : 1 - q1 * bw) * W; y = q2 * H; }
        else          { y = (q4 < 0.5 ? q1 * bw : 1 - q1 * bw) * H; x = q2 * W; }
      } else { x = q1 * W; y = q2 * H; }
      const t = qs * qs * 0.62 + qs * 0.38;             // 작은 쪽으로 살짝 치우치게
      const size = st.smin + (st.smax - st.smin) * t;
      const rot = st.rot ? qr * 360 : 0;
      const col = cols[Math.floor(qc * cols.length) % cols.length];
      const op = 1 - (st.jit / 100) * qo;               // ★흔들림도 «같은 시드 흐름»(qo)에서 뽑는다
      const kind = shs[Math.floor(qk * shs.length) % shs.length];
      parts.push(shapeSVG(kind, x, y, size, rot, col, op));
    }
    const body = parts.join('');
    let defs = '', halo = '';
    if (st.glow > 0 && st.spread > 0 && st.count > 0) {
      /* ★고디터 네온글로우와 «같은 설계» — 후광을 3겹(좁·중·넓)으로 겹쳐 쌓는다.
         ★「세기」는 겹의 ★진하기로 올린다 — ⛔반경으로 올리면 같은 빛이 넓게 퍼져 ★되레 옅어진다
           (현빈 「글로우가 어느 순간 약해지네」의 원인 · glow-render.js:82~84 가 그 둘을 갈라 적었다).
         ★필터 영역은 userSpaceOnUse 로 상자보다 넓게 — ⛔objectBoundingBox 는 번짐을 ★자른다
           (glow-render.js:105~106 실측: 좁은 영역 판과 1,860 px 달랐다).
         ★여유 M 은 ★퍼짐에서 «계산»한다 — ⛔시안처럼 150 을 박지 않는다(퍼짐을 키우면 또 잘린다).
         ★입자 색이 여럿이라 ★SourceGraphic 을 그대로 흐린다 — 글로우(feFlood 로 한 색)와 ★다른 자리다. */
      const sd = (k) => r1(Math.max(0.3, k * st.spread));
      const M = Math.ceil(3 * 2 * st.spread) + 12;
      defs = '<defs><filter id="' + fid + '" filterUnits="userSpaceOnUse"'
           + ' x="' + (-M) + '" y="' + (-M) + '" width="' + (W + 2 * M) + '" height="' + (H + 2 * M) + '"'
           + ' color-interpolation-filters="sRGB">'
           + '<feGaussianBlur in="SourceGraphic" stdDeviation="' + sd(0.43) + '" result="b1"/>'
           + '<feGaussianBlur in="SourceGraphic" stdDeviation="' + sd(1) + '" result="b2"/>'
           + '<feGaussianBlur in="SourceGraphic" stdDeviation="' + sd(2) + '" result="b3"/>'
           + '<feMerge><feMergeNode in="b3"/><feMergeNode in="b2"/><feMergeNode in="b1"/></feMerge>'
           + '</filter></defs>';
      halo = '<g class="sec-fxpart-halo" filter="url(#' + fid + ')" opacity="' + (Math.round(st.glow) / 100) + '">' + body + '</g>';
    }
    /* ★전체 불투명도는 파티클 «층 통째»에 건다. ⛔배경은 건드리지 않는다(머리말 ⒝ — 애초에 없다). */
    return '<svg class="sec-fxpart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"'
         + ' width="100%" height="100%" style="display:block;pointer-events:none;">'
         + defs
         + '<g class="sec-fxpart-layer" opacity="' + (Math.round(st.fxOpacity) / 100) + '">'
         + halo + '<g>' + body + '</g></g></svg>';
  }

  w.ParticlesFx = Object.freeze({ PRESETS, KINDS, SHAPES, DISTS, RANGES, MAX_COUNT, svg, normalize, lum, estimateNodes });
})(window);
