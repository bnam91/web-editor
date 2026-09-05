/* ═══════════════════════════════════════════════════════════════════════════
   selection-overlay.js — 선택 테두리를 «오버레이 층»에서 그린다 (울트라플랜 P0)
   ───────────────────────────────────────────────────────────────────────────
   설계 정본: _context/PLAN-selection-overlay.md (A1·A2·A3)

   ★왜 옮기나 — 현빈 2026-09-06 제보 세 건이 «한 뿌리»다.
     ⑴ 맞닿은 이웃이 아웃라인을 «덮는다»       ⑵ 아웃라인이 이웃 위에 «얹힌다»
     ⑶ 맞닿은 둘을 선택하면 경계가 «2px» 이 된다(착시가 아니라 실제 2배)
   셋 다 «선택 표시가 문서 레이아웃과 같은 좌표계·같은 페인트 순서에 있기» 때문이다.
   ⑴은 z-index 로 때웠고(6461a28), ⑵·⑶은 그 방식으로 못 고친다.

   ★⛔울트라플랜의 「옮기면 셋 다 해결」은 «틀렸다» — ⑶은 페인트 층이 아니라 «기하» 문제다.
     두 상자가 «각자» 선을 가지면 옮겨도 두 줄이 붙는다. ⇒ 유일한 해법 =
     안쪽 1px + «맞닿은 변 구간»의 중복제거(dedupe). 이 요구가 도구를 결정했다:
     div/border/box-shadow 는 변의 «일부»를 못 지운다 → SVG path.

   ★이 파일이 «하지 않는» 것 (구조적 결정 — 되돌리지 마라)
     · 블록 이름 목록을 두지 않는다. `#canvas .selected` 일반 질의뿐이다.
       (「목록으로 관리되는 규칙은 새 블록이 생길 때 조용히 빠진다」 — 이 저장소에서
        오늘 하루에만 세 번 났다: 텍스트프레임 래퍼 · .cvb-card-ph · z-index 17종.)
     · 좌표를 직접 계산하지 않는다. `_cornerScreen` 을 «호출»한다. 베끼면 핸들과 갈라진다.

   ⛔P0 의 «알려진 퇴행» — 회전한 «조상» 안의 자식
     `_cornerScreen` 은 el 자신의 dataset 회전만 본다. 45° 프레임 안의 자식은 AABB 가
     나와 오늘(CSS outline, 자식과 «함께» 회전)보다 «나쁘다». P1 에서 조상 누적행렬로 푼다.
     여기서는 최소한 «감지»해서 그 상자를 dedupe 에서 빼둔다(틀린 폴리곤으로 남의 변을
     지우면 두 배로 나쁘다).
═══════════════════════════════════════════════════════════════════════════ */
import { CORNER_DIRS, _cornerScreen, _canvasScaleNow } from './overlay-handles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ★오버레이가 «그리지 않는» 것 — CSS 중화 규칙의 :not() 과 «같아야» 한다.
 *   (섹션은 ::after 로 z-index 90 에 이미 자기 층을 갖고 있고, .col 은 선택 표시가 없다.)
 *   ⇒ 이 동치는 tests/unit/selection-overlay-scope.test.mjs 가 «검사로» 고정한다. */
export const SKIP_SELECTOR = '.section-block, .col';
/* 텍스트 계열은 «자기»가 아니라 부모 상자가 표시 단위다(CSS 의 .row:has / text-frame:has 판과 동일).
 *   ⚠️파리티: col 개선은 이번 범위 밖 — CSS 가 row 를 쓰므로 여기서도 row 다. */
const TEXT_SELECTOR = '.text-block, .speech-bubble-block';
const TEXT_HOST_SELECTOR = '.frame-block[data-text-frame="true"], .row';

/* 맞닿음 판정 임계 — 단위는 «디바이스 픽셀» 1개.
 * ★2026-09-06 실측으로 정정. 처음엔 1 CSS px 였고, 「10% 축소에서 거짓 맞닿음이 나도
 *   사람 눈에 같다」고 «판단»했다. 그 판단이 틀렸다:
 *     10% · 문서 8px 간격(=화면 0.8px) 실측 — 진실은 «1px 선 두 줄 + 그 사이 2 디바이스행의 배경»
 *     인데 dedupe 가 아래 상자의 윗변을 «통째로» 지웠다(폭 70px 전부, 화면 926 픽셀 변화).
 *     즉 「지우나 남기나 같다」가 아니라 «한 줄이 없어진다» — 두 상자가 한 상자로 읽힌다.
 * ⇒ 임계를 «디바이스 픽셀 하나»로 좁혔다. 진짜 맞닿음(간격 0)은 어떤 배율에서도 잡힌다.
 * ⛔★불변식을 정확히 쓴다(2026-09-06 적대검수 지적으로 정정):
 *   이 코드가 비교하는 것은 «두 상자의 변»이지 «그려진 두 선»이 아니다.
 *   스냅이 각 선을 자기 상자 «안»으로 밀기 때문에 그려진 선 사이는 «항상 더 벌어져 있다».
 *   실측: 상자 간격 0.40px 인데 그려진 선은 4 디바이스행 떨어져 있었고, 그래도 지웠다.
 *   ⇒ 「구분 불가능할 때만 지운다」는 «참이 아니다». 「상자 변이 1 디바이스px 안일 때 지운다」가 참이다.
 *   ★★그리고 애초에 dedupe 가 필요한지 자체가 실측으로 흔들렸다 — 아래 «필요성» 주석 참조. */
const _dpr = () => (window.devicePixelRatio || 1);
const TOUCH_DEVICE_PX = 1;
const _touchEps = () => TOUCH_DEVICE_PX / _dpr();

let _layer = null;
let _mo = null;
let _raf = null;
let _dirty = true;
let _targets = [];
let _active = false;

/* ── 층 ──────────────────────────────────────────────────────────────────── */
function _ensureLayer() {
  if (_layer && _layer.isConnected) return _layer;
  const ov = document.getElementById('ss-handles-overlay');
  if (!ov) return null;
  _layer = document.createElementNS(SVG_NS, 'svg');
  _layer.setAttribute('class', 'ss-sel-layer');
  _layer.setAttribute('aria-hidden', 'true');
  // 핸들(.ss-resize-handle 등 z-index:1)보다 «아래»에 오도록 맨 앞에 넣는다.
  ov.insertBefore(_layer, ov.firstChild);
  return _layer;
}

function _clear() {
  if (_layer) _layer.replaceChildren();
}

/* ── 대상 집합 ───────────────────────────────────────────────────────────── */
function _hostOf(el) {
  if (el.matches(TEXT_SELECTOR)) return el.closest(TEXT_HOST_SELECTOR) || el;
  return el;
}

/* ★색은 «호스트 조상»으로 결정한다 — 블록 이름표로 분기하지 않는다.
 *   에셋 오버레이 안(어두운 이미지 위)은 파랑이 안 보여 흰 점선이 «의도»다(editor-layout.css M57-b).
 *   ⚠️보라(스티커/그라데이션)만은 조상이 없어 클래스로 본다 — 이건 «층»이 아니라 «블록의 정체성»이라
 *     조상으로 환원할 수 없다. 그래도 목록이 아니라 «두 클래스»이고, 빠져도 파랑으로 그려질 뿐 사라지지 않는다. */
function _variantOf(host) {
  if (host.closest('.asset-overlay')) return 'overlay';
  if (host.classList.contains('sticker-block') || host.classList.contains('gradient-block')) return 'sticker';
  return '';
}

function _collect() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return [];
  const out = [];
  const seen = new Set();
  // querySelectorAll 은 «문서 순서»를 돌려준다 — 아래 dedupe 의 「DOM 뒤」 판정이 이 순서에 기댄다.
  for (const el of canvas.querySelectorAll('.selected')) {
    if (el.matches(SKIP_SELECTOR)) continue;
    const host = _hostOf(el);
    if (!host || seen.has(host)) continue;
    if (!canvas.contains(host)) continue;   // closest 가 캔버스 밖으로 나갔으면 버린다
    seen.add(host);
    out.push({ el: host, variant: _variantOf(host) });
  }
  return out;
}

/* ── 기하 ────────────────────────────────────────────────────────────────── */
/* 반픽셀 스냅 — 선의 «중심»을 픽셀 격자에 맞춘다. 회전 상자에는 쓰지 않는다.
 * ★두 갈래인 이유(2026-09-06 실측으로 정정) — 처음엔 round() 한 갈래였는데, 상자 변이
 *   정수 CSS px 이 «아닌» 자리(실측 429.375)에 있으면 반올림이 선을 «바깥으로» 최대 0.5px
 *   밀어낸다. dpr 2 에서 그게 디바이스 1행이고, 그 1행이 이웃 상자 안에 찍혔다
 *   (§4-3 「이웃 픽셀이 한 점도 안 바뀐다」가 860px 로 «깨졌다» — 픽셀이 잡아낸 결함이다).
 * ★격자는 «CSS px» 이 아니라 «디바이스 px» 이다 — CSS 정수로 반올림하면 핸들 꼭지점과
 *   1.54px 벌어졌다(실측). 디바이스 격자면 그 몫이 1/dpr 이하로 줄고 선은 여전히 상자 안이다.
 * ★★그리고 «반굵기»는 상수가 아니라 «그 선의 굵기»에서 나온다(2026-09-06 적대검수 조건③).
 *   흰 점선(--overlay)만 1.5px 인데 0.5 를 박아 두어 선이 상자 «밖»으로 0.25px 샜다(실측 190px).
 *   ⇒ 두 함수 모두 반굵기 h 를 «받는다». 굵기를 바꾸면 스냅이 «따라온다». */
const _snapLo = (v, k, h) => Math.ceil(v * k) / k + h;    // 좌·상 — 상자 «안쪽»으로
const _snapHi = (v, k, h) => Math.floor(v * k) / k - h;   // 우·하 — 상자 «안쪽»으로
/* ★코너 편차의 «상한 유도» — 핸들(_cornerScreen(el,dir,0))과 이 꼭지점의 축별 거리는
 *     h  (= 굵기의 절반 — «안쪽 선»이면 반드시 붙는다)
 *   + snapGap ∈ [0, 1/dpr)   (위 두 스냅이 디바이스 격자로 미는 몫)
 *   ⇒ 축별 ≤ h + 1/dpr      (대각은 그 √2 배)
 * 이건 «표류»가 아니라 «상수 상한»이다 — 줌·위치가 커져도 안 커진다(내 880 표본 + 적대검수
 * 독립 1,344 표본에서 초과 0건).
 * ⛔★한때 「줌이 올라갈수록 오히려 감소한다」고 적었다. **그건 표본 부족 착시였다**(2026-09-06 정정).
 *   줌 8종 1,344 표본에서 max 는 0.9984/0.9531/0.9938/0.9890/0.9844/0.9766/0.9922/0.9375 —
 *   단조 감소가 «아니라» 상한 바로 아래에서 «진동»한다. 결론(상수 상한)은 옳고 «이유»가 틀렸다.
 *   ★틀린 이유를 남겨두면 다음 사람이 그걸 근거로 쓴다. 커밋 40c5213 의 메시지에는 옛 문장이 남아 있다.
 * ⚠️「≤1px 통과」라고 쓰지 마라 — 적대검수 측 독립 실측은 1.146px 이었다(둘 다 상한 «안»이다). */

/* 변종별 선 굵기(CSS px). ★css/editor-blocks.css 의 stroke-width 와 «같아야» 한다 —
 * 어긋나면 스냅이 굵기를 잘못 알아 선이 상자 밖으로 샌다(조건③이 정확히 그 사고였다).
 * ⇒ tests/unit/selection-overlay-scope.test.mjs 가 CSS 값과 이 표를 «대조»한다. */
export const STROKE_W = { '': 1, overlay: 1.5, sticker: 1 };
const _strokeOf = v => STROKE_W[v] || 1;

/* ★border-radius 를 «읽어» 온다(적대검수 조건①).
 *   CSS outline 은 곡률을 따라가는데 SVG 4직선은 둥근 모서리를 «가로지른다» — 각진 테두리가
 *   되어 오늘보다 나빠진다(실측: 반경 40px 카드 모서리 파랑 0 → 57·57·59·59).
 *   ⚠️네 모서리가 «각각 다를 수 있다»(M39 의 코너 반경 핸들이 모서리별로 조절한다).
 *   ⚠️각 모서리는 타원(rx, ry)일 수 있고, %는 상자 크기 기준이다.
 *   ⚠️합이 변 길이를 넘으면 CSS 규약대로 «전부 같은 비율로» 줄인다. */
const _RAD_PROPS = { nw: 'borderTopLeftRadius', ne: 'borderTopRightRadius',
                     se: 'borderBottomRightRadius', sw: 'borderBottomLeftRadius' };
function _radiiOf(el, scale) {
  const cs = getComputedStyle(el);
  const ow = el.offsetWidth, oh = el.offsetHeight;
  const num = (tok, base) => {
    if (!tok) return 0;
    const f = parseFloat(tok);
    if (!Number.isFinite(f)) return 0;
    return tok.endsWith('%') ? f / 100 * base : f;
  };
  const r = {};
  let any = false;
  for (const d of CORNER_DIRS) {
    const parts = String(cs[_RAD_PROPS[d]] || '0px').trim().split(/\s+/);
    const rx = num(parts[0], ow) * scale;
    const ry = num(parts[1] || parts[0], oh) * scale;
    r[d] = [Math.max(0, rx), Math.max(0, ry)];
    if (rx > 0 || ry > 0) any = true;
  }
  return any ? r : null;
}
/** CSS 규약의 축소 계수 — 어느 변에서든 두 반경의 합이 변 길이를 넘으면 «전부» 같은 비율로 줄인다. */
function _clampRadii(r, w, h) {
  let f = 1;
  const lim = (sum, len) => { if (sum > 0 && len / sum < f) f = len / sum; };
  lim(r.nw[0] + r.ne[0], w); lim(r.sw[0] + r.se[0], w);
  lim(r.nw[1] + r.sw[1], h); lim(r.ne[1] + r.se[1], h);
  if (f >= 1) return r;
  const o = {};
  for (const d of CORNER_DIRS) o[d] = [r[d][0] * f, r[d][1] * f];
  return o;
}
/** 상자 «변»에서 선 «중심»까지의 거리만큼 반경을 줄인다(안쪽 선의 곡률은 그만큼 작다). */
function _insetRadii(r, dl, dt, dr, db) {
  const m = (v, d) => Math.max(0, v - d);
  return {
    nw: [m(r.nw[0], dl), m(r.nw[1], dt)], ne: [m(r.ne[0], dr), m(r.ne[1], dt)],
    se: [m(r.se[0], dr), m(r.se[1], db)], sw: [m(r.sw[0], dl), m(r.sw[1], db)],
  };
}
const _ZERO_R = { nw: [0, 0], ne: [0, 0], se: [0, 0], sw: [0, 0] };

/** 상자 하나의 기하. 좌표는 «핸들과 같은 함수»(_cornerScreen)에서만 나온다. */
function _geomOf(el, variant, scale) {
  const sw = _strokeOf(variant), h = sw / 2;
  // inset 0 = «상자 자신»의 네 꼭지점. 맞닿음 판정도 이 생값으로 한다.
  const [nw, ne, sw_, se] = CORNER_DIRS.map(d => _cornerScreen(el, d, 0));
  const axis = Math.abs(nw.y - ne.y) < 0.02 && Math.abs(sw_.y - se.y) < 0.02
            && Math.abs(nw.x - sw_.x) < 0.02 && Math.abs(ne.x - se.x) < 0.02;
  const rawR = _radiiOf(el, scale);

  if (!axis) {
    // 회전 — 로컬 축(u,v)으로 반굵기만큼 «안쪽»으로 민다. 스냅은 하지 않는다(격자가 기울어 있다).
    const len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const lu = len(nw, ne), lv = len(nw, sw_);
    const u = { x: (ne.x - nw.x) / lu, y: (ne.y - nw.y) / lu };
    const v = { x: (sw_.x - nw.x) / lv, y: (sw_.y - nw.y) / lv };
    const P = (p, a, b) => ({ x: p.x + u.x * a + v.x * b, y: p.y + u.y * a + v.y * b });
    let r = rawR ? _clampRadii(rawR, lu, lv) : _ZERO_R;
    r = _insetRadii(r, h, h, h, h);
    return { rot: true, sw, h, r, u, v, W: lu - sw, H: lv - sw,
             deg: Math.atan2(u.y, u.x) * 180 / Math.PI,
             o: { nw: P(nw, h, h), ne: P(ne, -h, h), se: P(se, -h, -h), sw: P(sw_, h, -h) },
             pts: [P(nw, h, h), P(ne, -h, h), P(se, -h, -h), P(sw_, h, -h)] };
  }

  const raw = { l: nw.x, t: nw.y, r: se.x, b: se.y };
  const k = _dpr();
  let L = _snapLo(raw.l, k, h), T = _snapLo(raw.t, k, h),
      R = _snapHi(raw.r, k, h), B = _snapHi(raw.b, k, h);
  // ⚠️굵기의 2배보다 «납작한» 상자에서는 위 스냅이 뒤집힌다 → 그때만 상자 «중심»에 한 줄.
  if (R < L) L = R = (raw.l + raw.r) / 2;
  if (B < T) T = B = (raw.t + raw.b) / 2;
  let r = rawR ? _clampRadii(rawR, raw.r - raw.l, raw.b - raw.t) : _ZERO_R;
  r = _insetRadii(r, L - raw.l, T - raw.t, raw.r - R, raw.b - B);
  // 연장 끝점 = «상자의 생 변». 스냅한 선 좌표(L,T,R,B)와 달리 상자와 정확히 같은 자리다.
  return { rot: false, raw, L, T, R, B, sw, h, r, round: !!rawR,
           xlo: raw.l, xhi: raw.r, ylo: raw.t, yhi: raw.b };
}

/** ★위험1 감지 — 회전한 «조상» 안의 자식은 _cornerScreen 이 AABB 를 준다.
 *  미회전 상자의 화면 크기는 offsetW/H × 캔버스배율과 «정확히» 같아야 한다. 어긋나면 조상 회전이다.
 *  P0 에서는 그 상자를 dedupe 에서 «뺀다» — 틀린 폴리곤으로 이웃의 변을 지우면 두 배로 나쁘다. */
function _isNestedRotated(el, g, scale) {
  if (g.rot) return false;
  const ow = el.offsetWidth * scale, oh = el.offsetHeight * scale;
  if (!ow || !oh) return false;
  return Math.abs((g.raw.r - g.raw.l) - ow) > 1 || Math.abs((g.raw.b - g.raw.t) - oh) > 1;
}

/* ── 변 구간 산술 ────────────────────────────────────────────────────────── */
/* 직선 구간 — 모서리 반경만큼 «짧게» 시작하고, 반경 0 인 모서리에서는 반굵기 h 만큼 «늘린다».
 * ★늘리는 이유(적대검수 조건②): 맞닿은 두 상자를 동시 선택하면 위 상자 아랫변은 floor,
 *   아래 상자 윗변은 ceil 로 스냅돼 세로변 사이에 «1 CSS px 구멍»이 생겼다(실측 y500.5~501.5).
 *   각 세로변을 자기 모퉁이 쪽으로 h 만큼 늘리면 두 구간이 «맞닿아» 구멍이 없어진다.
 * ⚠️h 만큼만 늘린다 — 그 이상은 상자 «밖»이라 §4-3(이웃 불가침)이 깨진다.
 *   L,T 는 raw 보다 최소 h 안쪽이므로 h 만큼 늘려도 여전히 상자 안이다. */
function _edgesOf(g) {
  const r = g.r || _ZERO_R;
  /* 반경 0 인 모퉁이에서는 «상자의 생 변까지» 늘린다(반굵기 h 가 아니라).
   * ★h 만 늘리면 구멍이 «절반만» 닫힌다(실측): 위 상자 아랫변은 floor, 아래 상자 윗변은 ceil 로
   *   스냅돼 두 선 중심이 1.5px 벌어지고, 각자 0.5 씩 덮으면 0.5px 이 남는다(디바이스 1행).
   *   생 변(raw)까지 늘리면 두 구간이 «같은 좌표»에서 만나 구멍이 0 이 된다.
   * ⚠️여전히 상자 «안»이다 — 세로변의 유출은 x 로 정해지고(L±h 는 상자 안), y 범위는 상자와 «같다».
   *   즉 §4-3(이웃 불가침)을 깨지 않는다. 끝점이 분수라도 선의 «선명도»는 x 좌표가 정하므로 안 흐려진다. */
  const iv = (a, b) => (b > a ? [[a, b]] : []);
  const xLo = r0 => (r0 > 0 ? g.L + r0 : g.xlo), xHi = r0 => (r0 > 0 ? g.R - r0 : g.xhi);
  const yLo = r1 => (r1 > 0 ? g.T + r1 : g.ylo), yHi = r1 => (r1 > 0 ? g.B - r1 : g.yhi);
  return {
    top:    iv(xLo(r.nw[0]), xHi(r.ne[0])),
    bottom: iv(xLo(r.sw[0]), xHi(r.se[0])),
    left:   iv(yLo(r.nw[1]), yHi(r.sw[1])),
    right:  iv(yLo(r.ne[1]), yHi(r.se[1])),
  };
}
/** 구간 목록에서 [c,d] 를 뺀다. 부분 겹침이면 «남는 구간만» 남는다. */
export function subtractInterval(ivs, c, d) {
  const out = [];
  for (const [a, b] of ivs) {
    if (d <= a || c >= b) { out.push([a, b]); continue; }
    if (c > a) out.push([a, c]);
    if (d < b) out.push([d, b]);
  }
  return out;
}

/* ★★dedupe 의 «필요성» — 2026-09-06 적대검수 + 내 대조 실측으로 «전제가 흔들렸다».
 *   설계안은 「§4-2 와 §4-3 을 동시에 만족하려면 dedupe 가 유일한 해법」이라고 적었다. 아니었다.
 *   증상 ⑶(2px 띠)을 없앤 것은 dedupe 가 아니라 «디바이스 격자 안쪽 스냅»(00f013b)이다.
 *   ⇒ dedupe 를 꺼도 경계의 각 선은 여전히 «1 CSS px»이고 §4-2 의 문언(경계 두께 == 단일 변)은 참이다.
 *   실측(100% · 간격 0 · 같은 픽스처, 사본 두 벌):
 *     ON  y1025·1026 파랑 / 1027~ 흰            → 선 «한 줄»
 *     OFF y1025·1026 파랑 / 1027 «흰» / 1028·1029 파랑 → 선 «두 줄 + 사이 흰 1행»
 *   즉 남는 것은 «두께» 문제가 아니라 «경계에 선이 두 줄로 보이는 게 옳은가»라는 «디자인» 문제다.
 *   ⛔그 판단은 지디·현빈이 한다. 여기서는 코드를 «그대로 두고» 근거만 남긴다.
 *   ★dedupe 를 빼면 같이 사라지는 것: 위험3(대량 O(N²) 파생)·위험4(거짓 맞닿음)·_span·위 불변식 문장.
 *     성능 실측(70개 동시선택 build 중앙값): ON 1.1ms → OFF 0.4ms.
 *   ★dedupe 와 «무관»한 것: 조건②(세로변 구멍)는 ON/OFF 둘 다 0 이다 — 그건 «생 변까지 늘리기»가 고쳤다.
 *
 * 맞닿은 «변 구간»의 중복 한 줄을 지운다.
 *   ⛔O(N²) 를 피한다: 맞닿으려면 두 변의 좌표가 1px 안이어야 하므로 round(좌표)로 버킷팅해
 *   후보를 ±1 세 칸에서만 꺼낸다(N≈200 select-all 이 사실상 O(N)).
 *   회전 상자·조상회전 상자는 참여하지 않는다. */
/* 겹침 구간의 «끝» 처리 — 직선 구간은 반경 0 인 모퉁이에서 반굵기 h 만큼 늘어나 있다(_edgesOf).
 * 두 상자의 변이 «같은 자리»에서 끝나면 그 늘림까지 함께 지워야 h 길이의 «토막»이 안 남는다.
 * ⛔반대로 끝이 어긋나 있으면(부분 겹침) 늘리지 않는다 — 남아야 할 선을 h 만큼 갉아먹는다. */
function _span(pa, pb, qa, qb, qlo, qhi) {
  let c = Math.max(pa, qa), d = Math.min(pb, qb);
  if (Math.abs(pa - qa) < 1e-6) c = qlo;   // 끝이 «같은 자리»면 늘어난 몫까지 지운다
  if (Math.abs(pb - qb) < 1e-6) d = qhi;
  return [c, d];
}
function _dedupe(items, eps = _touchEps()) {
  const byB = new Map(), byT = new Map(), byR = new Map(), byL = new Map();
  const put = (m, k, i) => { const a = m.get(k); a ? a.push(i) : m.set(k, [i]); };
  items.forEach((it, i) => {
    if (!it.dedupable) return;
    put(byB, Math.round(it.g.raw.b), i);
    put(byT, Math.round(it.g.raw.t), i);
    put(byR, Math.round(it.g.raw.r), i);
    put(byL, Math.round(it.g.raw.l), i);
  });
  const near = (m, v) => {
    const k = Math.round(v);
    return [...(m.get(k - 1) || []), ...(m.get(k) || []), ...(m.get(k + 1) || [])];
  };
  // 「DOM 뒤 상자에서 뺀다」 — q 를 돌면서 «자기보다 앞선» p 하고만 비교하면 그 규약이 그대로 성립한다.
  items.forEach((q, qi) => {
    if (!q.dedupable) return;
    const qg = q.g;
    for (const pi of near(byB, qg.raw.t)) {          // p 가 «위», q 의 윗변이 중복
      if (pi >= qi) continue;
      const pg = items[pi].g;
      if (Math.abs(pg.raw.b - qg.raw.t) >= eps) continue;
      const [c, d] = _span(pg.L, pg.R, qg.L, qg.R, qg.xlo, qg.xhi);
      if (d > c) q.edges.top = subtractInterval(q.edges.top, c, d);
    }
    for (const pi of near(byT, qg.raw.b)) {          // p 가 «아래», q 의 아랫변이 중복
      if (pi >= qi) continue;
      const pg = items[pi].g;
      if (Math.abs(pg.raw.t - qg.raw.b) >= eps) continue;
      const [c, d] = _span(pg.L, pg.R, qg.L, qg.R, qg.xlo, qg.xhi);
      if (d > c) q.edges.bottom = subtractInterval(q.edges.bottom, c, d);
    }
    for (const pi of near(byR, qg.raw.l)) {          // p 가 «왼쪽», q 의 왼변이 중복
      if (pi >= qi) continue;
      const pg = items[pi].g;
      if (Math.abs(pg.raw.r - qg.raw.l) >= eps) continue;
      const [c, d] = _span(pg.T, pg.B, qg.T, qg.B, qg.ylo, qg.yhi);
      if (d > c) q.edges.left = subtractInterval(q.edges.left, c, d);
    }
    for (const pi of near(byL, qg.raw.r)) {          // p 가 «오른쪽», q 의 오른변이 중복
      if (pi >= qi) continue;
      const pg = items[pi].g;
      if (Math.abs(pg.raw.l - qg.raw.r) >= eps) continue;
      const [c, d] = _span(pg.T, pg.B, qg.T, qg.B, qg.ylo, qg.yhi);
      if (d > c) q.edges.right = subtractInterval(q.edges.right, c, d);
    }
  });
}

const _n = v => (Math.round(v * 100) / 100);
/* 모서리 호 하나. sweep=1 = 화면상 시계방향(SVG 는 y 가 아래로 간다) — 네 모서리 모두 바깥으로 볼록.
 * ⛔호는 dedupe 대상이 «아니다». 곡선 구간을 지우면 모양이 깨진다(적대검수 경고). */
const _arc = (rx, ry, deg, x, y) => `A${_n(rx)} ${_n(ry)} ${_n(deg)} 0 1 ${_n(x)} ${_n(y)}`;

function _pathData(it) {
  const g = it.g, r = g.r;
  if (g.rot) {
    // 로컬 축(u,v) 위에서 둥근 사각형을 만든다 — 회전해도 «상자와 같이» 둥글다.
    const { o, u, v, deg } = g;
    const P = (p, a, b) => `${_n(p.x + u.x * a + v.x * b)} ${_n(p.y + u.y * a + v.y * b)}`;
    const pt = (p, a, b) => ({ x: p.x + u.x * a + v.x * b, y: p.y + u.y * a + v.y * b });
    let d = `M${P(o.nw, r.nw[0], 0)}`;
    d += `L${P(o.ne, -r.ne[0], 0)}`;
    if (r.ne[0] || r.ne[1]) { const q = pt(o.ne, 0, r.ne[1]); d += _arc(r.ne[0], r.ne[1], deg, q.x, q.y); }
    d += `L${P(o.se, 0, -r.se[1])}`;
    if (r.se[0] || r.se[1]) { const q = pt(o.se, -r.se[0], 0); d += _arc(r.se[0], r.se[1], deg, q.x, q.y); }
    d += `L${P(o.sw, r.sw[0], 0)}`;
    if (r.sw[0] || r.sw[1]) { const q = pt(o.sw, 0, -r.sw[1]); d += _arc(r.sw[0], r.sw[1], deg, q.x, q.y); }
    d += `L${P(o.nw, 0, r.nw[1])}`;
    if (r.nw[0] || r.nw[1]) { const q = pt(o.nw, r.nw[0], 0); d += _arc(r.nw[0], r.nw[1], deg, q.x, q.y); }
    return d + 'Z';
  }
  const e = it.edges;
  let d = '';
  for (const [a, b] of e.top)    d += `M${_n(a)} ${_n(g.T)}L${_n(b)} ${_n(g.T)}`;
  for (const [a, b] of e.bottom) d += `M${_n(a)} ${_n(g.B)}L${_n(b)} ${_n(g.B)}`;
  for (const [a, b] of e.left)   d += `M${_n(g.L)} ${_n(a)}L${_n(g.L)} ${_n(b)}`;
  for (const [a, b] of e.right)  d += `M${_n(g.R)} ${_n(a)}L${_n(g.R)} ${_n(b)}`;
  // 네 모서리 호 — 직선 구간과 «따로» 그린다(dedupe 가 직선만 건드리게 하기 위해서다).
  if (r.nw[0] || r.nw[1]) d += `M${_n(g.L)} ${_n(g.T + r.nw[1])}` + _arc(r.nw[0], r.nw[1], 0, g.L + r.nw[0], g.T);
  if (r.ne[0] || r.ne[1]) d += `M${_n(g.R - r.ne[0])} ${_n(g.T)}` + _arc(r.ne[0], r.ne[1], 0, g.R, g.T + r.ne[1]);
  if (r.se[0] || r.se[1]) d += `M${_n(g.R)} ${_n(g.B - r.se[1])}` + _arc(r.se[0], r.se[1], 0, g.R - r.se[0], g.B);
  if (r.sw[0] || r.sw[1]) d += `M${_n(g.L + r.sw[0])} ${_n(g.B)}` + _arc(r.sw[0], r.sw[1], 0, g.L, g.B - r.sw[1]);
  return d;
}

/* ── 프레임 ──────────────────────────────────────────────────────────────── */
function _build() {
  const scale = _canvasScaleNow();
  const items = [];
  for (const t of _targets) {
    // ★매 프레임 isConnected — undo/redo·협업 sync 가 outerHTML 을 통째로 갈아끼운다.
    //   죽은 노드를 들고 있으면 «유령 상자»가 화면에 남는다(핸들 루프와 같은 방어).
    if (!t.el.isConnected) return null;
    const g = _geomOf(t.el, t.variant, scale);
    if (!g.rot && (g.raw.r - g.raw.l < 0.5 || g.raw.b - g.raw.t < 0.5)) continue; // 접힌/숨은 상자
    const it = { el: t.el, variant: t.variant, g, edges: g.rot ? null : _edgesOf(g) };
    it.dedupable = !g.rot && !_isNestedRotated(t.el, g, scale);
    items.push(it);
  }
  if (items.length > 1) _dedupe(items);
  return items;
}

function _render(items) {
  const layer = _ensureLayer();
  if (!layer) return;
  const kids = layer.childNodes;
  for (let i = 0; i < items.length; i++) {
    let p = kids[i];
    if (!p) { p = document.createElementNS(SVG_NS, 'path'); layer.appendChild(p); }
    const g = items[i].g;
    const hasR = !!(g.r && CORNER_DIRS.some(d => g.r[d][0] > 0.05 || g.r[d][1] > 0.05));
    const cls = 'ss-sel-path'
      + (items[i].variant ? ` ss-sel-path--${items[i].variant}` : '')
      + (g.rot || hasR ? ' is-rot' : '');   // is-rot = geometricPrecision(호·기울기엔 crispEdges 가 해롭다)
    if (p.getAttribute('class') !== cls) p.setAttribute('class', cls);
    const d = _pathData(items[i]);
    if (p.getAttribute('d') !== d) p.setAttribute('d', d);
  }
  while (kids.length > items.length) layer.removeChild(layer.lastChild);
}

function _frame() {
  _raf = null;
  if (!_active) return;
  if (_dirty) { _dirty = false; _targets = _collect(); }
  let items = _build();
  if (items === null) {           // 죽은 노드를 만났다 → 집합을 다시 잡고 이 프레임에서 바로 복구
    _targets = _collect();
    items = _build() || [];
  }
  _render(items);
  if (items.length) _raf = requestAnimationFrame(_frame);   // 집합이 비면 루프 정지(MO 가 다시 깨운다)
}

function _kick() {
  if (!_active) return;
  if (_raf == null) _raf = requestAnimationFrame(_frame);
}

/* ── 수명 ────────────────────────────────────────────────────────────────── */
export function initSelectionOverlay() {
  if (_active) return true;
  if (!window.SEL_OVERLAY_ENABLED) return false;
  const canvas = document.getElementById('canvas');
  if (!canvas || !document.getElementById('ss-handles-overlay')) return false;
  if (!_ensureLayer()) return false;
  // ⛔선택 변경 «이벤트가 없다»(.selected 를 바꾸는 자리 116곳). ResizeObserver·IntersectionObserver
  //   는 스크롤·transform 을 못 본다. ⇒ MO 로 «집합이 바뀌었다»만 받고, 위치는 rAF 가 좇는다.
  _mo = new MutationObserver(() => { _dirty = true; _kick(); });
  _mo.observe(canvas, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  _active = true;
  // ★body 클래스는 «여기»에서 붙는다 — 초기화가 성공한 «뒤». 위에서 하나라도 실패해 돌아가면
  //   클래스가 안 붙고 CSS 중화가 안 걸려 문서 outline 이 그대로 산다(제품이 성립한다).
  document.body.classList.add('sel-ov');
  _kick();
  return true;
}

export function stopSelectionOverlay() {
  _active = false;
  if (_mo) { _mo.disconnect(); _mo = null; }
  if (_raf != null) { cancelAnimationFrame(_raf); _raf = null; }
  _targets = [];
  _clear();
  document.body.classList.remove('sel-ov');
}

try {
  const ok = initSelectionOverlay();
  // 계측·QA 진입점(창 밖 인스턴스에서 CDP 로 상태를 «재는» 자리). 제품 코드는 이걸 안 쓴다.
  window.__selOverlay = {
    init: initSelectionOverlay,
    stop: stopSelectionOverlay,
    get active() { return _active; },
    get layer() { return _layer; },
    targets: () => _targets.map(t => t.el),
    build: () => { _targets = _collect(); return _build(); },
  };
  if (!ok) console.warn('[sel-overlay] 초기화 안 함 — 문서 outline 이 그대로 쓰인다(플래그 OFF 또는 DOM 미존재)');
} catch (e) {
  // ★실패하면 «반드시» 원상복구한다. 중화 CSS 가 걸린 채 오버레이가 안 그려지면 선택 표시가 «사라진다».
  document.body.classList.remove('sel-ov');
  console.error('[sel-overlay] 초기화 실패 — 문서 outline 으로 되돌린다', e);
}
