/* canvas-contrast.js — 링크 연결선을 «캔버스 배경 대비»로 고르는 단 하나의 자리.
 *
 * 발주(현빈) 「링크연결선이 캔버스 색때문에 잘안보여, 캔버스 색 고려해서 동적으로 계산해줄래?」
 * 계산 시점은 «배경이 바뀌는 순간» 셋뿐이다(솔리드/그라데이션 · 로드·부팅 · 테마변경).
 * ⛔rAF 루프 무접촉 — 색은 CSS 가 칠한다. 여기서 만드는 것은 CSS 변수 «하나»(--spl-edge-color).
 *
 * ⛔drag-utils.colorLuminance 를 쓰지 않는다 — «있는데 왜 안 썼나»의 답:
 *   그건 (0.2126R+0.7152G+0.0722B)/255 로 «감마 선형화가 없는» 근사다.
 *   그대로 쓰면 전수 16,777,216 배경 중 20.65% 가 다른 판정이고,
 *   그중 11.2%(1,874,696건)는 «진짜 대비 3 미만»인 색을 고른다.
 *   최악 #ff00ff: 근사는 «흰»을 고르는데 그 흰의 진짜 대비 1.957 (WCAG 는 «검» 4.725).
 *   ★그렇다고 저기를 고치지도 마라 — 블록 렌더러 5파일 12곳이 `lum < 0.45` 류
 *     «거친 명암 판정»에 쓴다. 틀린 물건이 아니라 «다른 일»을 하는 물건이다.
 */
import { parseGradient } from './props/gradient-model.js';

/* ★css/editor-extra.css 의 `.spl-edges line { … opacity }` 와 «같아야» 한다(검사 B6 이 대조).
   .55 로는 3:1 이 «불가능»하다 — 24비트 전수 최악 2.435(#ca0000). .70 에서 최악 3.126(#d40000). */
export const EDGE_ALPHA = 0.70;

/* 기본 하한 = WCAG 비텍스트 대비(3:1). */
export const MIN_CONTRAST = 3.0;

/* ── WCAG 상대휘도 ─────────────────────────────────────────── */
const _lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const _L   = ([r, g, b]) => 0.2126 * _lin(r / 255) + 0.7152 * _lin(g / 255) + 0.0722 * _lin(b / 255);
const _cr  = (a, b) => { const x = _L(a), y = _L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* sRGB 감마 공간 source-over. 인자 순서 = (전경, 배경, 알파). ⛔뒤집으면 검사 A0 이 잡는다. */
const _over = (fg, bg, a) => fg.map((c, i) => a * c + (1 - a) * bg[i]);

/* ★점수는 min(선, 점) 이다 — 선(α=.70)만 보면 점(α=1)이 미달할 수 있다.
     실측: accent 임의색 스트레스 16,777,216 쌍에서 «점 < 3:1» 18,796건
           (최악 accent #ff00ee · 배경 #00ee00 → 선 3.026 «통과», 점 2.040 «미달»).
   ⛔「알파가 더 크니 점은 당연히 안전」은 정리가 아니다 — 채널이 서로 반대로
     움직이면 가중합이 단조가 아니다. 검사 A6 이 이걸 못박는다. */
const _score = (c, bg) => Math.min(_cr(_over(c, bg, EDGE_ALPHA), bg), _cr(c, bg));

/* ── 색 파싱 ───────────────────────────────────────────────── */
const _clamp255 = (n) => Math.max(0, Math.min(255, n));

/** '#rgb' · '#rrggbb' · '#rrggbbaa' · 'rgb()' · 'rgba()' → { rgb:[r,g,b], a } | null */
function _parseWithAlpha(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) {
      const p = (i) => parseInt(h[i] + h[i], 16);
      return { rgb: [p(0), p(1), p(2)], a: h.length === 4 ? p(3) / 255 : 1 };
    }
    if (h.length === 6 || h.length === 8) {
      const p = (i) => parseInt(h.slice(i, i + 2), 16);
      return { rgb: [p(0), p(2), p(4)], a: h.length === 8 ? p(6) / 255 : 1 };
    }
    return null;
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (!isFinite(a)) return null;
    return { rgb: [+m[1], +m[2], +m[3]].map(_clamp255), a: Math.max(0, Math.min(1, a)) };
  }
  return null;   // 'url(...)' · 'transparent' · 이름색 · 빈 문자열 = «못 쟀다»
}
const _parse = (str) => { const c = _parseWithAlpha(str); return c ? c.rgb : null; };

const _hex = (rgb) => '#' + rgb.map(c => _clamp255(Math.round(c)).toString(16).padStart(2, '0')).join('');

/** 살아 있는 CSS 변수를 «읽는다». ⛔하드코딩 금지 — theme-system.js 가 이걸 바꾼다. */
function _cssVar(name) {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return '';
  const root = document.documentElement;
  if (!root) return '';
  return (getComputedStyle(root).getPropertyValue(name) || '').trim();
}

/* ★배경 알파 < 1 이면 뒤에 비치는 것은 #canvas-wrap 의 CSS 배경(#969696)이 «아니다».
     인라인 background 가 같은 속성이라 그 선언을 대체하고, #canvas-area 는 배경 선언이 없어
     투명이다 ⇒ body 의 --ui-bg-app 이 비친다. (DOM 을 따라가 확인함. 추론 아님.) */
const SHELL_FALLBACK = [26, 26, 26];   // #1a1a1a — 변수를 못 읽을 때만 쓰는 «폴백»

/** 배경 문자열 → «불투명» RGB 배열들. 못 읽으면 null. */
function _resolveBackdrops(css, shell) {
  const sh = _parse(shell ?? _cssVar('--ui-bg-app')) ?? SHELL_FALLBACK;
  const g = parseGradient(css);                       // gradient-model.js 재사용
  if (g) {
    const out = [];
    for (const s of g.stops) {
      const c = _parse(s.color);
      if (!c) return null;                            // 한 stop 이라도 못 읽으면 «못 쟀다»
      out.push(_over(c, sh, s.opacity));
    }
    return out.length ? out : null;
  }
  const c = _parseWithAlpha(css);
  return c ? [_over(c.rgb, sh, c.a)] : null;          // null = «못 쟀다»(투명이 아니다)
}

/**
 * 캔버스 배경 CSS 문자열 하나를 받아 연결선에 쓸 «불투명» '#rrggbb' 를 고른다.
 * 못 재면 null — 그러면 호출부가 변수를 걷어 CSS 폴백(오늘 색)이 받는다.
 */
export function edgeColorFor(css, opts = {}) {
  const bds = _resolveBackdrops(css, opts.shell);
  if (!bds) return null;                              // ★「투명」이 아니라 「못 쟀다」
  const min = opts.min ?? MIN_CONTRAST;
  /* ★그라데이션은 «최악 stop» — 평균은 「어디에도 없는 값」이고, 양끝만 보면 중간 stop 을 버린다. */
  const worst = (c) => Math.min(...bds.map(bd => _score(c, bd)));
  const acc = _parse(opts.accent ?? _cssVar('--ui-accent'));
  if (acc && worst(acc) >= min) return _hex(acc);     // 브랜드색 보존
  const W = [255, 255, 255], K = [0, 0, 0];
  return _hex(worst(W) >= worst(K) ? W : K);          // 흰/검 스냅
}

/** 변수를 «칠하는 원소와 같은 원소»에 건다. ⛔documentElement 에 걸면 캔버스가 둘이 되는 날 틀린다. */
export function updateEdgeContrast(css) {
  const el = typeof document !== 'undefined' && document.getElementById('canvas-wrap');
  if (!el) return null;
  const v = edgeColorFor(css);
  if (v) el.style.setProperty('--spl-edge-color', v);
  else   el.style.removeProperty('--spl-edge-color');  // 폴백이 오늘 색으로 받는다
  return v;
}

/** ★배경 writer 가 부르는 «단 하나의 문». 직접 canvasWrap.style.background 에 대입하지 마라(B1). */
export function applyCanvasBackground(css) {
  const el = document.getElementById('canvas-wrap');
  if (el) el.style.background = css;
  updateEdgeContrast(css);
}

/* ══ 글자 톤 — «배경 → 밝은/어두운 글자» 단 한 벌 (G5 그리드 · G6 테이블 헤더, 2026-10-03) ══
 * 현빈 G5 「어두운 배경 섹션에 그리드 블럭 추가하면 안 보임」· G6 「테이블 헤더가 어두워지면 텍스트도 자동으로 밝아지게」.
 * ★규칙 = 위 edgeColorFor 의 흰/검 스냅과 «같은 식»: cr(흰,배경) > cr(검,배경) 이면 'light'.
 *   임계값을 따로 두지 않는다 — 두 대비가 같아지는 점(L≈0.1791, 양쪽 4.58:1)이 곧 경계다.
 *   그보다 어두우면 흰 글자가 «언제나» 더 읽힌다.
 * ★배경은 «computed» 로 조상을 따라 올라가며 합성한다(칸 → 블럭 → 프레임 → 섹션). 섹션까지 보고 멈춘다.
 * ⛔못 재면 null — 그라데이션·이미지·떼어진 노드·이름색. null 은 «어둡지 않다»가 아니라 «모른다»다:
 *   부르는 쪽은 «기존 색 그대로»로 받는다(지금보다 나빠지지 않는 쪽). */
function _cs(el) {
  try { return (typeof getComputedStyle === 'function' && el && el.isConnected) ? getComputedStyle(el) : null; } catch (_) { return null; }
}
/** 그리드 블럭 배경 층(.grd-bg, 직계) — 없으면 null · 이미지면 false(못 잼) · 있으면 {rgb, a}(색 알파 × 층 불투명도).
 *  ⛔dataset 을 읽지 않는다 — 렌더된 층의 «계산된» 값을 본다(이 파일의 원칙: computed 로 합성). */
function _gridBgLayer(e) {
  if (!e.classList || !e.classList.contains('grid-block')) return null;
  let layer = null;
  for (const ch of e.children) if (ch.classList && ch.classList.contains('grd-bg')) { layer = ch; break; }
  if (!layer) return null;
  const cs = _cs(layer);
  if (!cs) return null;
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return false;
  const c = _parseWithAlpha(cs.backgroundColor);
  if (!c) return false;
  const op = parseFloat(cs.opacity);
  const a = c.a * (Number.isFinite(op) ? op : 1);
  return a > 0 ? { rgb: c.rgb, a } : null;
}
/** el(자신 포함)부터 섹션까지의 «불투명 배경» RGB. 못 재면 null. ownBg 는 el 자신의 배경 «문자열»(아직 DOM 에 없을 때). */
export function backdropRgbAt(el, ownBg) {
  const layers = [];
  if (ownBg !== undefined && ownBg !== null && ownBg !== '') {
    const t = String(ownBg).trim();
    if (t !== 'transparent') {
      const c = _parseWithAlpha(t);
      if (!c) return null;                          // var()·그라데이션 칸 배경 = 못 쟀다
      if (c.a > 0) layers.push(c);
    }
  }
  if (!layers.length || layers[layers.length - 1].a < 1) {
    let reached = false;
    for (let e = el; e; e = e.parentElement) {
      const cs = _cs(e);
      if (!cs) return null;                         // 떼어진 노드 = 못 쟀다
      /* ⚠️한계(적대QA 2026-10-03, 고치지 않음 — 지디 판정 E4 별건): ::before 로 그리는 반투명 배경(.frame-block.has-bg-opacity)은 못 본다 —
         본체가 transparent 라 위로 지나쳐 섹션 색으로 판정한다(흰 섹션 위 #000·0.9 프레임 → 그리드 글자 #555, 대비 2.33). 현빈 계정 52개에선 0건. */
      /* ★G12 그리드 «블럭 배경» — 그리드 상자 «자기» 배경은 투명이고 배경은 직계 층(.grd-bg)이 그린다(그 층은 내용 밑·상자 배경 위).
         ⇒ 칸 글자(그리드 렌더)·G19 자식(이 걸음이 .grd-children → 그리드로 올라온다) 둘 다 여기서 한 번에 본다(지디 GO: C5 필수). */
      const g = _gridBgLayer(e);
      if (g === false) return null;                 // 층에 이미지 = 못 쟀다(이미지 규약과 같다)
      if (g) { layers.push(g); if (g.a >= 1) { reached = true; break; } }
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = _parseWithAlpha(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) { reached = true; break; } }
      if (e.classList && e.classList.contains('section-block')) break;
    }
    if (!reached) return null;                      // 섹션까지 불투명 배경이 없다 = 못 쟀다
  }
  let out = layers[layers.length - 1].rgb;
  for (let i = layers.length - 2; i >= 0; i--) out = _over(layers[i].rgb, out, layers[i].a);
  return out;
}
/* ★E151(2026-10-06 · 태양 승인 ⒜ «그래프만») — 바탕의 «정지점 전부». backdropRgbAt 이 한 색을 내면 [그 색] 그대로(단색 바탕 = 바이트 같음).
 *   null 이었을 때만 다시 걷는다: 조상 중 맨 위 배경 층이 «모든 정지점 불투명» 그라디언트면 그 정지점들(그 밑 이미지는 가려진다 —
 *   섹션 «이미지 + 불투명 색» = linear-gradient(c, c), url(img) 이 이 꼴 · prop-section.js _applySectionBg) · 그 위 반투명 층은 정지점마다 합성.
 *   맨 위 층이 url(이미지) · 반투명 정지점 · 못 읽는 꼴('to right' 등) 이면 null(모른다 — 그림 픽셀은 못 본다 · 못 보는 꼴).
 * ⛔소비자는 syncGraphTone 하나다 — backdropRgbAt 의 다른 소비자 넷(G5 그리드 · G6 표 · 관찰자 · 선택 톤)은 안 바뀐다(⒝ = 현빈 결정). */
function _topBgLayer(bi) {
  let depth = 0;
  for (let i = 0; i < bi.length; i++) { const ch = bi[i]; if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ',' && depth === 0) return bi.slice(0, i).trim(); }
  return bi.trim();
}
function _opaqueGradientStops(bi) {
  const top = _topBgLayer(String(bi || ''));
  if (!/^(linear|radial)-gradient\(/i.test(top)) return null;
  const g = parseGradient(top);
  if (!g || !Array.isArray(g.stops) || !g.stops.length) return null;
  const out = [];
  for (const st of g.stops) { const c = _parseWithAlpha(st.color); if (!c || c.a < 1) return null; out.push(c.rgb); }
  return out;
}
export function backdropStopsAt(el) {
  const one = backdropRgbAt(el);
  if (one) return [one];
  const layers = [];
  const comp = (base) => { let out = base; for (let i = layers.length - 1; i >= 0; i--) out = _over(layers[i].rgb, out, layers[i].a); return out; };
  for (let e = el; e; e = e.parentElement) {
    const cs = _cs(e);
    if (!cs) return null;
    const g = _gridBgLayer(e);
    if (g === false) return null;
    if (g) { if (g.a >= 1) return [comp(g.rgb)]; layers.push(g); }
    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
      const stops = _opaqueGradientStops(cs.backgroundImage);
      return stops ? stops.map(comp) : null;
    }
    const c = _parseWithAlpha(cs.backgroundColor);
    if (c && c.a > 0) { if (c.a >= 1) return [comp(c.rgb)]; layers.push(c); }
    if (e.classList && e.classList.contains('section-block')) break;
  }
  return null;
}
/** RGB 배경 → 'light'(밝은 글자가 낫다) | 'dark'. */
export function textToneOver(rgb) {
  if (!rgb) return null;
  return _cr([255, 255, 255], rgb) > _cr([0, 0, 0], rgb) ? 'light' : 'dark';
}
/** el 의 실제 배경 위 글자 톤. 못 재면 null. */
export function textToneAt(el, ownBg) { return textToneOver(backdropRgbAt(el, ownBg)); }

/* ── 테이블 헤더(G6) ─────────────────────────────────────────
 * 사용자 글자색 자리: dataset.textColor(표 전체) · 칸 안 <span style=color> · highlightFg(인라인).
 * ★«미지정» = textColor 가 비었거나 makeTableBlock 이 구워 넣는 기본값 #222222 그대로(이 레포 선례:
 *   infocard·_applyTableThemeDefaults 의 «정확히 기본값 = 미지정»). 칸 부분색·강조색은 인라인이라 자동을 이긴다.
 * ★자동 값은 «블럭 인라인 CSS 변수 --tbl-header-fg» 에만 산다 — dataset 을 안 건드린다(저장본에 사용자 값처럼 굳지 않는다). */
export const TABLE_HEADER_FG_LIGHT = '#f2f2f2';
const _TBL_DEFAULT_TEXT = '#222222';
export function syncTableHeaderTone(block) {
  if (!block || !block.style) return null;
  const tc = String(block.dataset.textColor || '').trim().toLowerCase();
  const th = block.querySelector('thead th');
  const want = (!tc || tc === _TBL_DEFAULT_TEXT) && th && textToneAt(th) === 'light' ? TABLE_HEADER_FG_LIGHT : '';
  const cur = block.style.getPropertyValue('--tbl-header-fg').trim();
  if (cur !== want) {                               // ★멱등 — 같으면 안 쓴다(관찰자 고리 방지)
    if (want) block.style.setProperty('--tbl-header-fg', want);
    else block.style.removeProperty('--tbl-header-fg');
  }
  return want || null;
}

/* ── 그래프 자동 밝기(H6 · 현빈 2026-10-05 · 지디 결정) ─────────────────────
 * 섹션(바탕)이 어두우면(tone light) 그래프의 «자동 색»을 목표 대비까지 밝힌다 — 사용자 색이 없을 때만.
 *   격자선(H6) 3.0 = 흰색을 투명도 a 로 · 꺾은선 선·점(K7) 4.5 = 그려진 선 색을 흰 쪽으로 m 만큼 · GR3 덧선·점·눈금 4.5 = 그려진 잉크(#333)를 흰 쪽으로.
 *   ★목표는 둘로 갈린다(현빈 「꺾은선은 더 밝아져야 함」) — 한 계수로 덮지 않는다. ★흰(tone dark) 바탕은 안 바꾼다(E142 따로).
 *   ★명시 색(gridColor · labelColor · lineColor · barColor)이 있으면 그 변수는 안 쓴다(U9 와 같은 정책 — E143 따로).
 * ★자동 값은 «블럭 인라인 CSS 변수» 셋(--grb-auto-grid · --grb-auto-line · --grb-auto-ink)에만 산다(--tbl-header-fg 꼴).
 *   읽는 자 = css/editor-graph.css 끝 네 줄 · 저장에선 io/section-serialize.js 의 «파생 변수» 목록이 걷는다(굳지 않음 · E144 와 한 목록).
 * ★계산은 «변수 없는 그려진 값»을 바탕으로 한다 — 그래서 먼저 걷고 읽는다(자기 값을 다시 밝히는 고리 방지). */
const GRAPH_AUTO_VARS = ['--grb-auto-grid', '--grb-auto-line', '--grb-auto-ink', '--grb-dot-hole'];   // K6 — 속빈 점 구멍 = 바탕색(파생 · 저장에서 걷힘)
/* ★저장에서 걷을 «파생 변수»의 정본 = 이 파일이 «쓰는» 이름들(쓰는 자가 목록을 낸다 · 두 번째 목록 금지).
   io/section-serialize.js 가 이것을 그대로 읽는다 — 여기 새 자동 변수를 보태면 저장에서도 저절로 걷힌다. */
export const DERIVED_AUTO_VARS = ['--tbl-header-fg', ...GRAPH_AUTO_VARS];
const _rgbOfCss = (v) => { const c = _parseWithAlpha(String(v || '')); return c && c.a > 0 ? c.rgb : null; };
const _mixRgb = (a, b, t) => a.map((x, i) => x * (1 - t) + b[i] * t);
const _rgbCss = (c) => `rgb(${c.map(x => Math.min(255, Math.ceil(x - 1e-9))).join(', ')})`;   // 흰 쪽으로 «올림» — 반올림이면 4.49 로 목표 밑에 앉는다(실측 graph-h6 D1)
/** base 를 white 쪽으로 섞어 bg 위 대비 T 에 닿는 가장 작은 섞음 — 이미 넘으면 base 그대로. 못 닿으면 흰색. */
function _lightenTo(base, bg, T) {
  if (_cr(base, bg) >= T) return base;
  const W = [255, 255, 255];
  if (_cr(W, bg) < T) return W;
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (_cr(_mixRgb(base, W, m), bg) >= T) hi = m; else lo = m; }
  return _mixRgb(base, W, hi);
}
/** 흰색을 투명도 a 로 bg 위에 얹어 대비 T 에 닿는 가장 작은 a(소수 셋째 자리 올림). */
function _whiteAlphaTo(bg, T) {
  const W = [255, 255, 255];
  if (_cr(W, bg) < T) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const a = (lo + hi) / 2; if (_cr(_over(W, bg, a), bg) >= T) hi = a; else lo = a; }
  return Math.ceil(hi * 1000) / 1000;
}
export const GRAPH_GRID_TARGET = 3.0, GRAPH_LINE_TARGET = 4.5;
export function syncGraphTone(block) {
  if (!block || !block.style || !block.classList?.contains('graph-block')) return null;
  const d = block.dataset;
  const prev = GRAPH_AUTO_VARS.map(v => block.style.getPropertyValue(v).trim());
  GRAPH_AUTO_VARS.forEach(v => block.style.removeProperty(v));          // «변수 없는 그려진 값»을 읽기 위해 먼저 걷는다
  /* E149 — 패널 색 칸이 보일 «파생 전» 선 색을 여기서 기억한다(변수를 걷은 «지금»이 그 값 — 걷고 읽기는 이 함수가 원래 한다).
     JS 속성이라 DOM·저장·자동저장에 0. 읽는 자 = graphFieldShown(아래 한 곳). */
  { const _p = block.querySelector('.grb-line-path'); block._grbToneBase = { line: _p ? (_cs(_p)?.stroke || '') : '' }; }
  /* E151 — 바탕 «정지점 전부»(단색이면 [한 색] = 옛 길 그대로). 톤은 모든 정지점이 'light'(어두운 바탕)일 때만 · 목표 대비는 «모든» 정지점 위에서(가장 많이 밝힌 값). */
  const stops = backdropStopsAt(block);
  const bg = stops && stops.length === 1 ? stops[0] : null;   // K6 구멍은 «한 색»일 때만(그라디언트엔 한 색이 없다 · ⒦1 흰 대체 그대로)
  const want = ['', '', '', ''];
  const _lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const _lightenAll = (base) => stops.map(st => _lightenTo(base, st, GRAPH_LINE_TARGET)).reduce((a, b) => (_lum(b) > _lum(a) ? b : a));
  if (stops && stops.every(st => textToneOver(st) === 'light')) {
    /* 격자 변수는 «격자가 켜졌을 때만» — 꺼진 그래프에 읽는 자 없는 변수를 쓰지 않는다(GR-W0: 셋 다 꺼짐 = 기준판과 바이트 동일, 회귀 실측). */
    if (d.showGrid === '1' && !d.gridColor && !d.labelColor) want[0] = `rgba(255, 255, 255, ${Math.max(...stops.map(st => _whiteAlphaTo(st, GRAPH_GRID_TARGET)))})`;
    const path = block.querySelector('.grb-line-path');
    const lineBase = path && !d.lineColor && !d.barColor ? _rgbOfCss(_cs(path)?.stroke) : null;
    if (lineBase) want[1] = _rgbCss(_lightenAll(lineBase));
    const ov = block.querySelector('.grb-ov');
    const inkBase = ov && !d.labelColor ? _rgbOfCss(_cs(ov)?.color) : null;
    if (inkBase) want[2] = _rgbCss(_lightenAll(inkBase));
  }
  /* K6 — 속빈 점의 구멍 = 그 자리 바탕(단색). 톤과 무관하게 흰 바탕에서도 쓴다(구멍은 «바탕을 보여 주는» 자리).
     ⚠️그라디언트는 «한 색»이 없어 구멍 변수를 안 쓴다 → CSS 흰 대체(⒦1 · E151 은 H6 만 푼다) · 이미지 바탕도 같다(못 보는 꼴). */
  if (bg && d.pointStyle === 'hollow' && d.chartType === 'line') want[3] = _rgbCss(bg);
  GRAPH_AUTO_VARS.forEach((v, i) => { if (want[i]) block.style.setProperty(v, want[i]); });
  return { prev, want };
}

/* ── E149 그래프 패널 색 칸의 «보일 값» 한 자리 ───────────────────────────
 * 칸에 데이터 값(dataset)이 없을 때 = «그려진» 색(프리셋·CSS) — 단 H6 가 밝힌 값이 아니라 «파생 전» 색.
 *   H6 변수가 닿는 칸은 꺾은선 선 하나(--grb-auto-line) → syncGraphTone 이 걷은 채 읽어 둔 block._grbToneBase.line.
 *   나머지(막대·라벨·면·격자)는 H6 변수가 안 닿는 요소의 계산값 그대로(격자는 격자층의 글자색 — 렌더가 currentColor×0.2 로 긋는다).
 * ⛔칸마다 기본값을 박지 않는다 — 칸 → (그리는 요소 · CSS 속성) 표 «하나». 못 읽으면 ''(= 칸은 «정해지지 않음»).
 * 'label'(값+카테고리 한꺼번에)은 { c, mixed } — 두 색이 다르면 Mix. */
const _firstPlain = (b, sel) => [...b.querySelectorAll(sel)].find(e => !e.style.background && !e.style.backgroundColor) || null;
const GRAPH_FIELD_PARTS = {
  bar:    (b) => (b.dataset.chartType || 'bar-v') === 'line' ? { tone: 'line', el: b.querySelector('.grb-line-path'), prop: 'stroke' }
                 : { el: _firstPlain(b, b.dataset.chartType === 'bar-h' ? '.grb-bar-h-fill' : '.grb-bar-fill:not(.grb-bar-fill-b)'), prop: 'backgroundColor' },
  bar2:   (b) => ({ el: b.querySelector('.grb-bar-fill-b'), prop: 'backgroundColor' }),
  vlabel: (b) => ({ el: b.querySelector('.grb-bar-val-label, .grb-line-vlabel, .grb-bar-h-pct'), prop: 'color' }),
  xlabel: (b) => ({ el: b.querySelector('.grb-bar-label, .grb-line-xlabel, .grb-bar-h-desc'), prop: 'color' }),
  fill:   (b) => ({ el: b.querySelector('.grb-line-area'), prop: 'fill' }),
  grid:   (b) => ({ el: b.querySelector('.grb-ov-grid-layer') || b, prop: 'color' }),
};
export function graphFieldShown(block, field) {
  if (!block) return field === 'label' ? { c: '', mixed: false } : '';
  if (field === 'label') {
    const v = graphFieldShown(block, 'vlabel'), x = graphFieldShown(block, 'xlabel');
    return { c: x || v, mixed: !!(v && x && v !== x) };
  }
  const p = GRAPH_FIELD_PARTS[field]?.(block);
  if (!p) return '';
  if (p.tone) {
    const t = block._grbToneBase?.[p.tone];
    if (t) return t;
    if (block.style.getPropertyValue('--grb-auto-' + p.tone).trim()) return '';   // 밝힌 값만 보이고 파생 전 값을 모른다 → «정해지지 않음»
  }
  if (!p.el) return '';
  const v = _cs(p.el)?.[p.prop];
  return (typeof v === 'string' && /^rgba?\(/i.test(v.trim())) ? v.trim() : '';
}

/* ── 한 깔때기 관찰자 ─────────────────────────────────────────
 * 배경을 쓰는 자리가 20곳이 넘는다(prop-section·editor·block-factory·badge-transform·gradient-model…).
 * 자리마다 호출을 달면 하나를 빠뜨린 날 «화면만 어둡고 글자는 그대로»가 된다 ⇒ #canvas 하나를 본다.
 * ★배경 서명(인라인 bg·data-bg)이 «바뀐» 요소만 따라 내려간다 — 끌기 중 transform 같은 style 쓰기는 서명이 같아 건너뛴다.
 * ★다시 그리는 것은 «톤 표식이 달라진» 그리드뿐(멱등) — ⌘Z 로 되돌린 DOM 은 표식이 맞으니 아무것도 안 한다. */
const _bgSig = new WeakMap();
const _sigOf = (e) => (e.style ? e.style.backgroundColor + '|' + e.style.backgroundImage + '|' + e.style.background : '') + '|' + (e.dataset ? (e.dataset.bg || '') + '|' + (e.dataset.headerBg || '') + '|' + (e.dataset.textColor || '') : '');
let _toneObs = null;
export function installTextToneObserver(root, { onGrid } = {}) {
  if (_toneObs || !root || typeof MutationObserver !== 'function') return _toneObs;
  const visit = (el, out) => {
    if (!el || el.nodeType !== 1) return;
    if (el.classList.contains('grid-block')) out.add(el);
    else if (el.classList.contains('table-block')) out.add(el);
    else if (el.classList.contains('graph-block')) out.add(el);   // H6
    else el.querySelectorAll?.('.grid-block, .table-block, .graph-block').forEach(b => out.add(b));
  };
  _toneObs = new MutationObserver((muts) => {
    const hit = new Set();
    for (const m of muts) {
      if (m.type === 'attributes') {
        const t = m.target;
        if (t.nodeType !== 1) continue;
        const s = _sigOf(t);
        if (_bgSig.get(t) === s) continue;
        _bgSig.set(t, s);
        if (t.closest('.grid-block') && !t.classList.contains('grid-block')) continue;   // 그리드 «안»의 쓰기(자기 렌더)
        const tb = t.closest('.table-block');
        if (tb) { hit.add(tb); continue; }
        visit(t, hit);
      } else {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          const tb = n.closest?.('.table-block'); if (tb) { hit.add(tb); return; }
          if (n.closest?.('.grid-block') && !n.classList.contains('grid-block')) return;
          visit(n, hit);
        });
      }
    }
    hit.forEach(b => {
      if (!b.isConnected) return;
      if (b.classList.contains('table-block')) syncTableHeaderTone(b);
      else if (b.classList.contains('graph-block')) syncGraphTone(b);   // H6
      else if (onGrid && (textToneAt(b) === 'light' ? 'light' : '') !== (b.dataset.textTone || '')) onGrid(b);
    });
  });
  _toneObs.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'data-bg', 'data-header-bg', 'data-text-color'] });
  return _toneObs;
}

/* ★위생검사(A0)·회귀검사가 «같은 물건»을 잡을 수 있게 내보낸다.
   ⛔사본을 새로 만들어 내보내지 마라 — 사본을 내보내면 본체의 변이가 검사를 비껴간다.
   ⛔그리고 DOM 스펙(tests/dom)은 이걸 «import 하지 않는다» — 같은 걸 쓰면
     계산기의 버그가 검사를 통과해 «세탁»된다. 거기는 독립 구현이다. */
export { _over as compositeOver, _L as relativeLuminance, _cr as contrastRatio, _score as edgeScore };

if (typeof window !== 'undefined') {
  /* theme-system.js 는 비-ESM IIFE 라 import 를 못 한다 → window 로도 노출한다. */
  window.__updateEdgeContrast = () => updateEdgeContrast(
    (typeof document !== 'undefined' && document.getElementById('canvas-wrap')?.style.background) || ''
  );
  /* ★G5·G6 글자 톤 — grid-block.js 는 import 대신 이 전역으로 받는다(그 파일 renderGridBlock 의 주석 참조). */
  window.__gdTextTone = { backdropRgbAt, textToneOver, textToneAt, syncTableHeaderTone, syncGraphTone, DERIVED_AUTO_VARS, graphFieldShown };
  /* ★한 깔때기 관찰자 — #canvas 가 생긴 뒤 한 번. 그리드는 window.renderGridBlock 으로 다시 그린다. */
  const _goTone = () => { const cv = document.getElementById('canvas');
    if (cv) installTextToneObserver(cv, { onGrid: (b) => window.renderGridBlock?.(b) }); };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _goTone, { once: true }); else _goTone();
  }
  /* ⛔applyCanvasBackground 는 window 에 «안» 내놓는다 — 부르는 쪽이 전부 ESM 이라 쓸 사람이 없다.
     안 쓰는 전역은 B1 깔때기 밖에 «두 번째 입구»를 만들어 둘 뿐이다. */
}
