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
   ★★상한 = ★`MAX_COUNT`/섹션 — ⛔거절이 아니라 ★「그 수까지만 그린다」.
     ★현빈 확정 2026-10-07 — 「개수는 ★상한 60개로 하자 컨페티나 파티클」(지디 전달). 옛 값은 320 이었다.
     ★★현빈 2026-10-08 — 「★60개 말고 ★★120개까지하자 최대」 ⇒ ★★지금 값은 ★120 이다.
       ⛔위 2026-10-07 줄을 ★지우지 않았다 — ★그것은 ★«그때 받은 말»이고 ★역사다.
     ⚠️★태양 M4 표의 `20×320`(썸네일 8.9~10.7 s) 칸은 ★★여전히 «범위 밖»이다 — ⛔근거로 쓰지 마라.
       ★★노드 수는 ★쟀다(아래 PRESETS 머리말의 표 — 2026-10-08 · 두 판을 같이).
       ⛔★여전히 ★미측정인 것: ★섹션 ★여럿에 깔릴 때의 ★프레임·메모리. ⛔「괜찮다」로 적지 마라.
       ★수는 ★estimateNodes() 가 ★«계산»해 준다(⛔산문에 손으로 박지 않게).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  /** ★섹션 하나에 그리는 입자 수의 상한. ⛔막지 않는다 — 넘으면 자른다. */
  const MAX_COUNT = 120;

  /* ★모양 다섯 — 이름은 시안과 «같게» 둔다(시안이 사람에게 보여 준 어휘가 그대로 저장본에 들어간다). */
  const SHAPES = Object.freeze(['rect', 'ribbon', 'circle', 'star4', 'tri']);

  /* ★프리셋 넷 — ⛔bg 키가 ★없다(위 머리말 ⒜ · 현빈 2026-10-07).
     ★현빈 확정 2026-10-07: 「프리셋은 넷이면 충분하다 · 알맹이모양도 지금 충분하다. 이대로 유지」 ⇒ ⛔더 늘리지 마라.
     ★기본 색은 «값만» 바꾸면 되게 여기 한 자리에 둔다(글로우 PRESETS 와 같은 결).
     ★fxOpacity — 이름을 ★글로우와 «같게» 쓴다(지디 2026-10-06 · 9f062a5c 로 미리 맞춰 둔 이름).
       ⛔alpha·opacity 로 갈라 쓰면 다음 사람이 두 벌로 읽는다.
     ★★count 는 ★넷 다 ★MAX_COUNT 다 — ★★현빈 확정 2026-10-07 「★다 60 으로」(지디가 후보 셋을 올려 받은 답).
       ★★2026-10-08 현빈 「★60개 말고 ★★120개까지하자 최대」 ⇒ ★★MAX_COUNT = ★120.
         ⛔위 줄의 「60」을 ★고치지 않았다 — ★★그것은 ★«그때 받은 말»이다. ★일괄치환하면 ★역사가 거짓이 된다.
         ★★한 줄만 고쳐도 ★RANGES.count.max · ★PRESETS 넷의 count · ★normalize 의 clamp 가 ★전부 따라왔다
           (★2026-10-08 ★vm 치환으로 ★재서 확인) ⇒ ★★명부가 ★하나라는 ★증거다.
       ⛔상한 수를 네 자리에 ★손으로 박지 않는다 — ★상수를 ★참조한다. ⇒ 상한이 또 바뀌면 ★프리셋이 ★따라온다.
       ★그것을 ★tests/unit/fx-particles-render P0b 가 ★행위로 잰다(상한을 7 로 둔 판에서 넷이 7 이 되나).
     ★★⚠️시안과 ★갈렸다 — ⛔「시안대로」로 읽지 마라. 시안은 party 130 · star 90 · gold 70 · dust 60 이었고
       (★시안 슬라이더 상한은 ★320), ★제품은 ★★120×4 다. ★출처는 ★시안이 아니라 ★현빈 결정이다.
       ★★2026-10-08 로 ★제품(120)이 ★시안의 네 수를 ★셋은 ★넘고 ★party 만 ★10 모자란다(130 → 120).
     ★★⚠️2026-10-07 에 적어 둔 위험 — ★★2026-10-08 상한을 ★120 으로 올려 ★거의 해소됐다.
       ★그때 글(★역사 · ⛔고치지 않는다): 「party 는 ★130 → 60 이라 ★여전히 ★절반 이하다 ⇒
         ★「컨페티가 옛 시안보다 ★옅다」는 신고가 ★올 수 있다」
       ★★지금: ★party 는 ★130 → ★120(★92%) ⇒ ★그 위험은 ★거의 사라졌다.
         ⛔「사라졌다」로 ★단정하지 않는다 — ★★신고가 ★온 적도 ★없어서 ★애초에 ★난 적이 있는지도 ★모른다.
       ★★⚠️대신 ★★새 위험 — ★★«무게»다. ★노드가 ★약 ★1.9배가 됐다(아래 표).
       ★★되돌릴 자리 = ★`MAX_COUNT` 다. ⛔프리셋 count 만으로는 ★못 올린다 — normalize 가 ★상한에서 자른다.
         ⇒ 밀도를 올려야 하면 ★상한을 올려라(그러면 프리셋이 ★참조로 따라온다).
       ★★무게 실측 — ★★두 판을 ★같이 적는다(⛔한 판만 적으면 ★「얼마나 늘었나」를 ★다음 사람이 ★못 센다).
         ★재는 법 = ★이 파일을 ★vm 에 싣고 ★`MAX_COUNT` 를 ★치환해 ★estimateNodes 와 ★svg() 를 돌렸다.
           ★★공식을 ★믿지 않고 ★svg() 글자의 ★여는 태그를 ★세어 ★견줬다 — ★★여덟 칸 ★전부 ★일치했다.
         ┌────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
         │ MAX_COUNT  │ star         │ gold         │ party        │ dust         │
         ├────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
         │  60 (옛)   │ 133 / 17638B │  63 /  7778B │  63 /  7645B │ 133 /  8889B │
         │ ★120(지금) │ 253 / 35796B │ 123 / 15345B │ 123 / 15112B │ 253 / 17033B │
         └────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
           ★노드 비 ★1.90x(star·dust) ~ ★1.95x(gold·party) · ★바이트 비 ★1.92x ~ ★2.03x
           ★판 = 2026-10-08 · 상자 860×600 · seed 20261008
           ★★음성대조 = ★치환한 뒤 ★원판을 ★다시 싣자 ★여전히 120 ✅(치환이 ★원판을 ★안 물들였다)
         ⇒ ★★무게를 가르는 것은 ★«후광»이다 — ★star·dust 는 ★후광이 켜져 ★조각을 ★두 벌 그린다
           (★count 가 넷 다 같으니 ★밀도 차이는 ★없다). ★후광 끈 둘 = ★`count + 3` · ★켠 둘 = ★`count*2 + 13`.
         ⛔★안 잰 것: ★섹션 ★여럿(N개)에 ★깔릴 때의 ★프레임·메모리 ⇒ ★★미측정. */
  const PRESETS = Object.freeze({
    star:  Object.freeze({ label: '별 반짝이',   count: MAX_COUNT, shapes: Object.freeze(['star4', 'star4', 'circle']),
                           colors: Object.freeze(['#FFFFFF', '#FFE9FF', '#C9A8FF', '#8E6BE0']),
                           smin: 3, smax: 14, rot: true,  dist: 'even', glow: 55, spread: 6,  fxOpacity: 100, jit: 60,
                           speed: 0, blur: 0, spin: 0 }),
    gold:  Object.freeze({ label: '금색 컨페티', count: MAX_COUNT, shapes: Object.freeze(['rect', 'ribbon']),
                           colors: Object.freeze(['#F5C542', '#E8B22A', '#FFE9A8', '#C98A14']),
                           smin: 6, smax: 22, rot: true,  dist: 'top',  glow: 0,  spread: 0,  fxOpacity: 100, jit: 25,
                           speed: 0, blur: 0, spin: 0 }),
    party: Object.freeze({ label: '컬러 컨페티', count: MAX_COUNT, shapes: Object.freeze(['rect', 'tri', 'ribbon']),
                           colors: Object.freeze(['#2D6FE8', '#F5C542', '#E0402C', '#28B463', '#FFFFFF']),
                           smin: 5, smax: 18, rot: true,  dist: 'even', glow: 0,  spread: 0,  fxOpacity: 100, jit: 15,
                           speed: 0, blur: 0, spin: 0 }),
    dust:  Object.freeze({ label: '먼지 / 보케', count: MAX_COUNT, shapes: Object.freeze(['circle']),
                           colors: Object.freeze(['#FFFFFF', '#FFE6B8', '#BFD8FF']),
                           smin: 4, smax: 28, rot: false, dist: 'edge', glow: 70, spread: 14, fxOpacity: 80, jit: 85,
                           speed: 0, blur: 0, spin: 0 }),
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
    /* ★★패닝 축 셋 (현빈 2026-10-08 「빠진게 있지않니 파티클 효과에? 시안대로 — ★패닝효과」)
       ★시안 = artifact BcCGv6AJJCp7o4pfNouY9N 「패닝 컨페티 — 네 판 비교」
         ★★그 수는 ★산문이 아니라 ★`<input type=range>` ★요소에서 뽑았다(★시안 산문은 ★틀린 적이 있다).
       ★★`speed` 의 ★min 만 ★시안과 ★다르다 — ★시안 ★10, ★우리 ★★0. ⛔눈대중이 아니라 ★까닭이 있다:
         ★`normalize` 가 ★`clamp(…, RANGES.min, RANGES.max)` 를 ★건다
         ⇒ ★min 이 ★10 이면 ★PRESETS 의 ★0 이 ★★10 으로 ★밀려 올라간다
         ⇒ ★★옛 저장본이 ★저절로 ★움직인다 = ★inert 가 ★깨진다.
         ★시안의 ★10 은 ★「멈춤이 뜻 없는 ★데모 슬라이더」의 바닥이고, ★제품에선 ★0 = 끔이다
         (★레포 선례와 같은 결 — `glow:[0,…]`·`spread:[0,…]` 도 ★0 이 ★끔이다).
         ★잠그는 자 = tests/unit/fx-particles-render ★P14b.
       ★★1차에서 ★`speed`·`spin` 은 ★«저장만» 된다 — ★그림에 ★안 들어간다(움직임은 v1.5 · rAF).
         ⇒ ⛔「시안 기본을 넣으면 그림이 달라진다」로 ★그 둘을 ★재지 마라 — ★P16 이 ★그 경계다.
         ⇒ ★그 둘의 ★기본이 ★0 인지는 ★★P14c 가 ★«값»으로 ★따로 잰다(★sha 로는 ★안 잡힌다). */
    speed:     Object.freeze({ min: 0, max: 160 }),
    blur:      Object.freeze({ min: 0, max: 14 }),
    spin:      Object.freeze({ min: 0, max: 500 }),
  });

  /** ★★«1배가 되는» 기준 속도 — ⒟(번짐을 속도에 묶기)의 ★분모.
   *  ★★출처 = ★시안 `S.speed` 의 ★기본값이다 — `<input type="range" id="speed" … value="58">` ＋
   *    `var S = { … speed:58, … }` ⇒ ★★«요소»에서 뽑았다(⛔산문 아님).
   *    ★시안 식(그 파일 `frame()`): `var mag = v.link ? S.blur * (S.speed / 58) : S.blur;`
   *  ★★⛔«우리 기본값»이 ★아니다 — ★우리 `speed` 기본은 ★★0 이다(★inert 때문에 · RANGES 머리말).
   *    ⇒ ★그래서 ★이 수를 ★`PRESETS` 에서 ★끌어올 ★수가 ★없다. ★시안에서 ★빌려 온 ★상수다.
   *    ⛔「우리 기본값인데 왜 58?」로 ★고치지 마라 — ★그 둘은 ★다른 수다. */
  const BLUR_LINK_REF_SPEED = 58;

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
    const base = haloOn ? (st.count * 2 + 13) : (st.count + 3);
    /* ★방향성 번짐 — ＋<filter><feGaussianBlur> = 2 · <defs> 가 아직 없으면 ＋1(후광이 지었으면 같이 쓴다) */
    /* ★svg() 의 `panOn` 과 ★★같은 판정이어야 한다 — ⛔둘이 갈리면 ★노드 수가 틀린다(P10 이 잡는다) */
    const panMag = (st.speed > 0) ? (st.blur * st.speed) / BLUR_LINK_REF_SPEED : st.blur;
    const panCounts = panMag > 0 && st.count > 0;
    return base + (panCounts ? (haloOn ? 2 : 3) : 0);
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
  /** 알맹이 하나의 글자.
   *  ★`mv` — ★★«움직이는 판»에서만 붙는 꼬리표(`data-fxp`). ⛔없으면 ★한 글자도 ★안 붙는다.
   *    ★★까닭: ★움직이개(js/fx/particles-animate.js)가 ★알맹이의 ★«중심·속도치우침·회전방향·처음각»을
   *      ★알아야 하는데, ★그것을 ★움직이개가 ★다시 계산하면 ★★«같은 시드 흐름»을 ★두 곳에서 뽑는 꼴이다
   *      = ★★명부가 ★둘. ⇒ ★★뽑은 자(여기)가 ★적어 준다.
   *    ★★그리고 ★패닝 축이 ★전부 0 이면 ★★안 붙인다 — ★그래야 ★옛 저장본의 글자가 ★한 자도 ★안 바뀐다
   *      (★inert · 잠그는 자 = P14a). */
  function shapeSVG(kind, x, y, s, rot, c, op, mv) {
    const o = ' fill="' + c + '"' + (op < 0.999 ? ' opacity="' + (Math.round(op * 100) / 100) + '"' : '')
            + (mv ? ' data-fxp="' + mv + '"' : '');
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
      /* ★패닝 셋 — ★없으면 ★프리셋 기본(=★0)으로 떨어진다 ⇒ ★옛 저장본은 ★그림이 ★안 바뀐다 */
      speed: clamp(Math.round(num(o.speed, pre.speed)), RANGES.speed.min, RANGES.speed.max),
      blur: clamp(Math.round(num(o.blur, pre.blur)), RANGES.blur.min, RANGES.blur.max),
      spin: clamp(Math.round(num(o.spin, pre.spin)), RANGES.spin.min, RANGES.spin.max),
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
    /* ★★w·h 는 ★«필수»다 — ⛔없으면 ★기본값으로 ★때우지 않는다. (2026-10-07 · R3 의 둘째 얼굴)
       ★★까닭: ★상자 크기는 ★그림에 ★들어간다(viewBox·입자 좌표가 W·H 에서 난다)
         ⇒ ★860×600 으로 때워 그렸다가 ★진짜 크기로 다시 그리면 ★★같은 seed 인데 모습이 바뀐다
           = 「★같은 시드 = 같은 그림」이 깨진다(seeded-random.js:7 의 그 계약).
         ⇒ ★★폴백은 ★「없을 때 메운다」인데 ★메운 값이 ★결과를 정하면
           ★「없었다」와 ★「다른 값이었다」가 ★구분이 안 된다. ⇒ ★메우지 말고 ★«물러난다».
       ⚠️⛔`Math.max(1, …)` 로 ★1×1 로 때우는 것도 ★같은 병이다(조각이 1px 안에 뭉친다) — 그래서 뺐다.
       ★★예외 명부 — ★다른 필드는 ★폴백이 ★맞다(normalize 가 ★프리셋 기본으로 떨어뜨린다):
         ★w·h 는 ★«상자 크기»라 ★모르면 ★답이 ★없다(어떤 수를 넣어도 틀린다).
         ★count·colors·glow… 는 ★«프리셋 기본»이 ★정의된 답이다 ⇒ ★떨어져도 ★틀리지 않는다.
       ★돌려주는 값 = ★빈 문자열 ＋ ★콘솔(글로우 선례 sticker-block.js:156 「빈 상자 ＋ 콘솔」과 같은 결).
         ⛔조용히 ★다른 그림을 그리지 않는다. ★잠그는 자: tests/unit/fx-particles-render P11. */
    const W = Math.round(num(p && p.w, 0));
    const H = Math.round(num(p && p.h, 0));
    if (W <= 0 || H <= 0) {
      /* 가드 — 이 모듈은 console 이 없는 판(vm 하네스)에서도 돌아야 한다 */
      if (typeof console !== 'undefined' && console.error) {
        console.error('[fx/particles] svg(): w·h 가 없다(받음 ' + W + '×' + H + ') — ⛔기본값으로 때우지 않는다');
      }
      return '';
    }
    const fid = String((p && p.filterId) || 'pfx-tmp').replace(/[^A-Za-z0-9_-]/g, '');
    const rnd = w.FxSeed.mulberry32(st.seed);
    const parts = [];
    const cols = st.colors, shs = st.shapes;
    /* ★★«움직이는 판»인가 — ★`speed`·`spin` 중 ★하나라도 ★0 이 아니면.
       ⛔`blur` 는 ★여기 안 넣는다 — ★번짐은 ★정지 그림에도 ★있다(1차에 들어갔다). */
    const moves = st.speed > 0 || st.spin > 0;
    for (let i = 0; i < st.count; i++) {
      /* ★난수는 입자마다 «항상 10번» 뽑는다 — 회전을 끄거나 분포를 바꿔도 다음 입자의 값이 안 밀린다.
         (시안 buildSVG 와 같은 흐름이어야 같은 seed 가 같은 그림을 낸다) */
      /* ★★열 번째를 ★이름 붙여 쓴다 — ★지금까지 ★`rnd();` 로 ★버리던 ★그 값이다.
         ★★«뽑는 횟수»가 ★안 바뀌므로 ★다음 입자의 값이 ★한 칸도 ★안 밀린다
         ⇒ ★★「같은 시드 = 같은 그림」이 ★그대로다(★P2 가 그 자리를 잠근다). */
      const q1 = rnd(), q2 = rnd(), q3 = rnd(), q4 = rnd(), qs = rnd(), qr = rnd(), qc = rnd(), qo = rnd(), qk = rnd(), qv = rnd();
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
      /* ★움직이는 판에서만 — ★중심(x,y) · ★속도 치우침(vj) · ★회전 방향(dir) · ★처음 각(rot) */
      const mv = moves
        ? r1(x) + ',' + r1(y) + ',' + r1(0.55 + qv * 0.9) + ',' + (q4 < 0.5 ? -1 : 1) + ',' + r1(rot)
        : '';
      parts.push(shapeSVG(kind, x, y, size, rot, col, op, mv));
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
      defs = '<filter id="' + fid + '" filterUnits="userSpaceOnUse"'
           + ' x="' + (-M) + '" y="' + (-M) + '" width="' + (W + 2 * M) + '" height="' + (H + 2 * M) + '"'
           + ' color-interpolation-filters="sRGB">'
           + '<feGaussianBlur in="SourceGraphic" stdDeviation="' + sd(0.43) + '" result="b1"/>'
           + '<feGaussianBlur in="SourceGraphic" stdDeviation="' + sd(1) + '" result="b2"/>'
           + '<feGaussianBlur in="SourceGraphic" stdDeviation="' + sd(2) + '" result="b3"/>'
           + '<feMerge><feMergeNode in="b3"/><feMergeNode in="b2"/><feMergeNode in="b1"/></feMerge>'
           + '</filter>';
      halo = '<g class="sec-fxpart-halo" filter="url(#' + fid + ')" opacity="' + (Math.round(st.glow) / 100) + '">' + body + '</g>';
    }

    /* ★★방향성 번짐 — ★「패닝」의 ★절반이다(나머지 절반 = 회전 속도, ★v1.5).
       ★★`stdDeviation` 에 ★값을 ★둘 준다 — ★앞이 가로, ★뒤가 세로. ★가로는 ★0 이라 ★또렷하고
         ★세로만 늘어난다 = ★「진행 방향으로 늘어난다」. ★컨페티는 ★떨어지는 것이 본질이라 ★세로다.
       ★★레포 선례 ★0건이었다 — ★`stdDeviation` ★8자리를 ★전부 읽었고 ★모두 ★단일 값이었다(2026-10-08 실측).
         ⇒ ★새 길이라 ★★html2canvas 에서 ★사는지를 ★먼저 쟀다(⛔추측 아님):
           ★원본 40×8 조각이 ★`"0 6"` 에서 ★★40×16(가로 그대로·세로만) ·
                              ★`"6 0"` 에서 ★★58×8(세로 그대로·가로만) 으로 캡처됐다.
           ★그 자가 ★제대로 도는지는 ★먼저 ★음성으로 확인했다 —
             ★`mix-blend-mode:screen` 과 ★`filter:drop-shadow`(div) 는 ★둘 다 ★죽는 것이 재졌다
             (★glow-render.js:9 가 적어 둔 그대로) ⇒ ★내 자는 ★「죽음」을 ★잡는다.
       ★필터 영역 — ★세로로만 번지니 ★세로 여유만 넓게. ⛔기본 영역(-10%~110%)은 ★번짐을 ★자른다.
       ★★id 는 ★후광과 ★갈라야 한다 — ★한 문서에 ★섹션이 여럿이고 ★SVG id 는 ★문서 전역이다. */
    /* ★★⒟ — ★번짐을 ★속도에 ★묶는다 (v1.5 ⒟ · 2026-10-09 · 지디 GO).
       ★시안 식 그대로: `blur × (speed / 58)`.
       ★★`speed` 가 ★0 이면 ★묶지 ★않는다 — ★★1차의 ★「고정 번짐」을 ★그대로 둔다
         (★움직이지 ★않는 섹션에 ★진행 방향 ★번짐을 ★속도로 ★줄이면 ★★0 이 되어 ★1차가 ★사라진다.
          ★잠그는 자 = P15 — ★`speed` 기본 0 에서 `blur=6` ⇒ `"0 6"`).
       ★★기준 속도 58 에서 ★배수가 ★정확히 ★1 이다 ⇒ ★그 점에서 ★1차와 ★같은 그림이다.

       ★★⛔«매 프레임 ★고치지» ★않는다 — ★★시안은 ★`frame()` 안에서 ★매번 ★다시 썼지만
         ★그 식의 ★입력(`S.blur`·`S.speed`)은 ★★슬라이더를 ★움직일 때만 ★바뀌는 ★«상수»다.
         ⇒ ★★설정 ★하나당 ★★한 값이다 ⇒ ★`svg()` 에서 ★한 번 ★계산한다.
       ★★그래서 ★«무겁다»는 ★시안의 경고가 ★우리에겐 ★해당 없다 — ★필터 쓰기가 ★0회/프레임이다.
       ★★그리고 ★★그 선택이 ★★더 중요한 것을 ★막는다:
         ★실측(2026-10-09 · html2canvas): ★`stdDeviation` 을 ★★매 프레임 ★흔들며 ★찍으면
           ★그 순간 DOM 값이 ★`"0 2.91"` / `"0 10.79"` 로 ★★분명히 달랐는데
           ★★캡처는 ★★둘 다 ★40×18 — ★★따라오지 ★않았고 ★★«흔들림의 ★최대값»에 ★굳었다.
           (★자는 산다: ★정적 값 0/2/12 는 ★8/14/18 로 ★갈렸고 ★같은 값 ×2 는 ★같았다)
         ⇒ ★★매 프레임 꼴이었다면 ★★썸네일·HTML 이 ★화면과 ★다른 번짐을 ★담았을 것이다. */
    const panBlur = (st.speed > 0) ? (st.blur * st.speed) / BLUR_LINK_REF_SPEED : st.blur;
    const panOn = panBlur > 0 && st.count > 0;
    let panAttr = '';
    if (panOn) {
      const PM = Math.ceil(3 * panBlur) + 8;
      defs += '<filter id="' + fid + '-pan" filterUnits="userSpaceOnUse"'
            + ' x="0" y="' + (-PM) + '" width="' + W + '" height="' + (H + 2 * PM) + '"'
            + ' color-interpolation-filters="sRGB">'
            + '<feGaussianBlur in="SourceGraphic" stdDeviation="0 ' + r1(panBlur) + '"/>'
            + '</filter>';
      panAttr = ' filter="url(#' + fid + '-pan)"';
    }
    const defsTag = defs ? '<defs>' + defs + '</defs>' : '';
    /* ★전체 불투명도는 파티클 «층 통째»에 건다. ⛔배경은 건드리지 않는다(머리말 ⒝ — 애초에 없다). */
    return '<svg class="sec-fxpart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"'
         + ' width="100%" height="100%" style="display:block;pointer-events:none;">'
         + defsTag
         + '<g class="sec-fxpart-layer"' + panAttr + ' opacity="' + (Math.round(st.fxOpacity) / 100) + '">'
         + halo + '<g>' + body + '</g></g></svg>';
  }

  w.ParticlesFx = Object.freeze({ PRESETS, KINDS, SHAPES, DISTS, RANGES, MAX_COUNT, svg, normalize, lum, estimateNodes });
})(window);
